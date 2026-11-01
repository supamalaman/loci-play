"use strict";
// Swallowing beads (Mala, 2026-10-26: "did we input swallowing beads to add them to my summon list?"; she chose "needs
// several beads", and "should be a tracker that says how many beads of the creature youve swallowed"). From the Field Kit,
// out of battle, a bead can be swallowed: it is used up and counts toward that creature. At the threshold the creature is
// learned and joins the summon list as a beast summon (engine/actions.js callBeast), called like a released bead.
//
//   RULES                              → thresholds (wild 3, dream 4, big 5)
//   keyOf(bead)                        → the creature a bead counts toward ("feralPig", "dream:amber_host")
//   need(bead)                         → beads to swallow to learn it
//   swallow(account, index, monsters?)            → { ok, account, learned, line } | { ok: false, error }
//   tracker(account)                   → [{ key, name, swallowed, need, learned, held }] (every creature you have touched)
//   trackerLine(row)                   → "Feral pig · 2 of 3 swallowed" / "Feral pig · Learned"
//   captureLines(before, after, account) → battle-over lines for beads a battle added
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatBeadSwallow = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = { wild: 3, dream: 4, big: 5, bigLF: 80 };
  const keyOf = (b) => b?.kind === "dream" ? `dream:${b.mind?.key || b.name}` : (b?.kind || b?.name);   // legacy beads have no kind: key by name, never "undefined" (audit 1.3.449)
  // Which beads a battle can carry: the engine takes wild-monster kinds and named dream beads only (engine.js create). The rest
  // (stakes beads named for a person, legacy kindless beads) sit out the battle but stay on the account (audit 1.3.449: the
  // UI used to overwrite account.beads with the battle's list and delete them).
  const carriable = (b, monsters) => !!b && (!!monsters?.[b.kind] || (b.kind === "dream" && typeof b.mind?.key === "string" && !!b.mind.key && !!b.name));
  const benched = (beads, monsters) => (beads || []).filter((b) => b && !carriable(b, monsters));
  // Beads in the stakes escrow (ante.js escrowOut) are off the account until the stake settles: drop one match per vessel.
  const same = (a, b) => a?.kind === b?.kind && a?.name === b?.name && (a?.mind?.key || null) === (b?.mind?.key || null);
  // Every copy of this bead in hand is staked: releasing it would spend what is on the table.
  function isStaked(beads, index, held) {
    const b = (beads || [])[index]; if (!b) return false;
    const inHand = beads.filter((x) => same(x, b)).length;
    const staked = (held?.vessels || []).filter((v) => v.kind === "bead" && same(v.snap, b)).length;
    return staked >= inHand;
  }
  function withoutEscrow(beads, held) {
    const out = (beads || []).slice();
    for (const v of held?.vessels || []) if (v.kind === "bead" && v.snap) { const i = out.findIndex((b) => same(b, v.snap)); if (i >= 0) out.splice(i, 1); }
    return out;
  }
  const need = (b) => b?.kind === "dream" ? RULES.dream : (b?.maxLF || 0) >= RULES.bigLF ? RULES.big : RULES.wild;
  const learnedOf = (a) => Array.isArray(a?.beastSummons) ? a.beastSummons : [];
  const isLearned = (a, key) => learnedOf(a).some((x) => x.key === key);
  function swallow(account, index, monsters = null) {
    const beads = account?.beads || [], b = beads[index];
    if (!b) return { ok: false, error: "No bead there to swallow." };
    if (monsters && !carriable(b, monsters)) return { ok: false, error: `${b.name || "That bead"} holds no creature to learn: keep it as a trophy or a stake.` };   // a person or legacy bead can never be summoned (audit 1.3.449)
    if (b.kind === "gaia") return { ok: false, error: "Gaia is not a bead: she answers as a summon already." };
    const key = keyOf(b), n = need(b);
    if (isLearned(account, key)) return { ok: false, error: `${b.name} is learned already: it answers your summons. Keep the bead to release it.` };
    const counts = { ...(account.beadSwallows || {}) }, got = (counts[key] || 0) + 1; counts[key] = got;
    const rest = beads.filter((_, i) => i !== index);
    let a = { ...account, beads: rest, beadSwallows: counts }, learned = null;
    if (got >= n) {
      learned = { key, kind: b.kind, name: b.name, maxLF: b.maxLF, ...(b.mind ? { mind: b.mind } : {}) };
      a = { ...a, beastSummons: [...learnedOf(account), learned] };
    }
    const line = learned ? `${b.name} · ${n} of ${n} swallowed: learned. It joins your summon list.`
      : `${b.name} · ${got} of ${n} swallowed: ${n - got} more to learn it.`;
    return { ok: true, account: a, learned, line };
  }
  function tracker(account) {
    const rows = new Map(), counts = account?.beadSwallows || {};
    for (const b of account?.beads || []) { const k = keyOf(b); const r = rows.get(k) || { key: k, name: b.name, need: need(b), held: 0 }; r.held++; rows.set(k, r); }
    for (const l of learnedOf(account)) if (!rows.has(l.key)) rows.set(l.key, { key: l.key, name: l.name, need: need(l), held: 0 });
    for (const k of Object.keys(counts)) if (!rows.has(k)) rows.set(k, { key: k, name: k.replace(/^dream:/, ""), need: k.startsWith("dream:") ? RULES.dream : RULES.wild, held: 0 });
    return [...rows.values()].map((r) => ({ ...r, swallowed: Math.min(r.need, counts[r.key] || 0), learned: isLearned(account, r.key) }));
  }
  const trackerLine = (r) => r.learned ? `${r.name} · Learned` : `${r.name} · ${r.swallowed} of ${r.need} swallowed`;
  // Beads a battle added: "you hold one more", with where that creature's tracker stands.
  function captureLines(before, after, account) {
    const count = (list) => { const m = {}; for (const b of list || []) { const k = keyOf(b); m[k] = (m[k] || 0) + 1; } return m; };
    const was = count(before), now = count(after), out = [];
    for (const b of after || []) {
      const k = keyOf(b); if ((now[k] || 0) <= (was[k] || 0)) continue; was[k] = now[k];
      const r = tracker(account).find((x) => x.key === k);
      const disp = (b.name || b.kind || "bead").replace(/ bead$/, "");   // legacy wager beads already end in "'s bead"
      out.push(r?.learned ? `${disp} bead captured: you hold ${now[k]}. Already learned.` : `${disp} bead captured: you hold ${now[k]}. Swallowed ${r ? r.swallowed : 0} of ${need(b)}.`);
    }
    return out;
  }
  return { RULES, keyOf, need, swallow, tracker, trackerLine, captureLines, carriable, benched, withoutEscrow, isStaked };
});
