/* Enemy dialogue (copied into Loci from ~/Documents/Game Dev/enemy-dialogue/dialogue.js on 2026-10-07; this copy is canonical for the game): Tracery-compatible text from a shared base grammar, with each enemy's
 * lines chosen by swapping `origin` per battle event.
 *
 *   const d = await EnemyDialogue.load(enemySpec, baseGrammar);   // or .fromObjects(...)
 *   d.say("encounter", { seed: "battle-42:turn-1" })  → "Welcome to the Arantxa Cinematic Universe"
 *
 * Enemy spec (JSON):
 *   { "enemy": "arantxa", "name": "Arantxa", "base": "<path to grammar JSON>",
 *     "events": { "encounter": ["#welcome response#", ...], "hurt": [...], ... },   // each list = that event's origin
 *     "rules":  { "extra rule": ["..."] },                                         // optional additions/overrides
 *     "filters": { "drop": ["{img", "http"], "maxLength": 140 },
 *     "fallback": { "hurt": "Ow." } }
 *
 * Supports the Tracery features the Arantxa grammar actually uses: #rule#, modifiers
 * .capitalize .s .a, and [key:#rule#] actions. Deterministic with a seed (combat replays, spec §10).
 * Lines with filtered text, unknown rules or excess length are rejected and re-rolled.
 * Works in browsers (WKWebView) and Node.
 */
(function (root) {
  "use strict";

  // Small seeded PRNG (mulberry32) from a string seed.
  function rngFrom(seed) {
    let h = 1779033703 ^ String(seed).length;
    for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const MODS = {
    capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1),
    s: (s) => /(s|sh|ch|x|z)$/i.test(s) ? s + "es" : /[^aeiou]y$/i.test(s) ? s.slice(0, -1) + "ies" : s + "s",
    a: (s) => (/^[aeiou]/i.test(s) ? "an " : "a ") + s,
  };

  class Dialogue {
    constructor(spec, base) {
      this.spec = spec;
      this.grammar = { ...base, ...(spec.rules || {}) };
      this.drop = (spec.filters && spec.filters.drop) || ["{img", "http"];
      this.maxLength = (spec.filters && spec.filters.maxLength) || 140;
      this.maxDepth = 12;
    }

    events() { return Object.keys(this.spec.events || {}); }

    // One line for a battle event. Returns { text, event, tries, fallback }.
    say(event, { seed = Math.random(), tries = 25 } = {}) {
      const origin = (this.spec.events || {})[event];
      if (!origin) throw new Error(`enemy ${this.spec.enemy} has no dialogue for "${event}"`);
      const rng = rngFrom(seed);
      for (let i = 1; i <= tries; i++) {
        const ctx = { rng, bad: false, saved: {} };
        const pick = origin[Math.floor(rng() * origin.length)];
        const text = this.expand(pick, ctx, 0).replace(/\s+/g, " ").trim();
        if (!ctx.bad && text && text.length <= this.maxLength && !this.drop.some((d) => text.includes(d)))
          return { text, event, tries: i, fallback: false };
      }
      const fb = (this.spec.fallback || {})[event] || "…";
      return { text: fb, event, tries, fallback: true };
    }

    expand(str, ctx, depth) {
      if (depth > this.maxDepth) { ctx.bad = true; return ""; }
      // [key:#rule#] actions save a value for later #key# references
      str = str.replace(/\[([^\[\]:]+):([^\[\]]*)\]/g, (_, key, val) => { ctx.saved[key] = [this.expand(val, ctx, depth + 1)]; return ""; });
      return str.replace(/#([^#]+)#/g, (_, ref) => {
        const [name, ...mods] = ref.split(".");
        const list = ctx.saved[name] || this.grammar[name];
        if (!Array.isArray(list) || !list.length) { ctx.bad = true; return ""; }   // unknown / typo'd rule
        let out = this.expand(String(list[Math.floor(ctx.rng() * list.length)]), ctx, depth + 1);
        for (const m of mods) { if (MODS[m]) out = MODS[m](out); else { ctx.bad = true; } }
        return out;
      });
    }
  }

  const api = {
    fromObjects: (spec, base) => new Dialogue(spec, base),
    async load(spec, base) {
      if (typeof spec === "string") spec = await (await fetch(spec)).json();
      if (typeof base === "string") base = await (await fetch(base)).json();
      return new Dialogue(spec, base);
    },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.EnemyDialogue = api;
})(typeof window !== "undefined" ? window : globalThis);
