"use strict";
// Export and import your save (Mala, 2026-11-01: "export character/import character option would be sick").
// One pure module: buildExport reads an explicit allow list of storage keys into a versioned file object;
// parseImport validates a file's text and returns the keys to write plus a one-line preview. It never touches
// storage itself: the caller reads before and writes after (ui.js), so the round trip is testable without a page.
// The store the caller passes needs { get, set, remove } plus keys(prefix) for the pins prefix below.
// Secrets stay home: loci:llm:settings (may hold an API key) and diagnostics are not on the allow list and can
// never be written to a file; unknown keys are dropped and counted, never written. Also excluded on purpose:
// loci:combat:last (a battle resume snapshot, meaningless on another device), the *-open:v1 keys (which panel
// was open: UI-ephemeral), and ccCommune/ccTsukumogami (externally-set preview flags with no writer in web/).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./account/account.js"));
  else root.ConceptCombatSaveFile = factory(root.ConceptCombatAccount);
})(typeof self !== "undefined" ? self : this, function (A) {
  const ACCOUNT_KEY = "loci:combat:account:v1";
  const ALLOW = [ACCOUNT_KEY, "loci:combat:profile", "loci:combat:character", "loci:combat:saved-characters",
    "loci:combat:sprite-packages", "loci:combat:neon-warden-offered", "loci:combat:pace", "loci:combat:follow",
    "loci:combat:zoom", "loci:combat:dialogue", "loci:combat:narration", "loci:combat:full-animation",
    "loci:combat:iso-view", "loci:combat:iso-cutaway", "loci:combat:teach-mode", "loci:combat:hints:v1",
    "loci:vignettes:phase-one", "loci:hall:v1", "loci:combat:math:graph-theory:v1", "loci:npc:keepers", "loci-mute"];
  // Command pins are one key per character (ui.js pinKey): `loci:combat:pins:<character>`. They travel as a
  // prefix rule, not a static entry (triage 2026-11-04: the pins keys were left home).
  const PINS_PREFIX = "loci:combat:pins:";
  const FORMAT = 1, MAX_BYTES = 5 * 1024 * 1024;
  // Shape checks, one per key: an import must carry values the game can read, not just a version it knows.
  // Each predicate mirrors its read site (ui.js, app.js, keeper-ui.js, lab-ui.js, tracks.js); deeper checks
  // happen where the value is used (account deserialize, VignetteCampaign.deserialize, Hall.valid).
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const isArr = Array.isArray;
  const isBool = (v) => typeof v === "boolean";
  const isStr = (v) => typeof v === "string";
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const oneOf = (...xs) => (v) => xs.includes(v);
  const SHAPES = {
    [ACCOUNT_KEY]: null,   // validated by A.deserialize below, not by a predicate
    "loci:combat:profile": [isObj, "profile"],
    "loci:combat:character": [(v) => v === null || isObj(v), "character"],
    "loci:combat:saved-characters": [isArr, "saved characters"],
    "loci:combat:sprite-packages": [isObj, "sprite choices"],
    "loci:combat:neon-warden-offered": [isBool, "neon warden offer"],
    "loci:combat:pace": [oneOf("slow", "normal"), "pace"],
    "loci:combat:follow": [(v) => v === null || isBool(v), "follow"],
    "loci:combat:zoom": [isNum, "zoom"],
    "loci:combat:dialogue": [isBool, "dialogue"],
    "loci:combat:narration": [isStr, "narration"],
    "loci:combat:full-animation": [isBool, "animation"],
    "loci:combat:iso-view": [isBool, "iso view"],
    "loci:combat:iso-cutaway": [isBool, "iso cutaway"],
    "loci:combat:teach-mode": [isBool, "teach mode"],
    "loci:combat:hints:v1": [isObj, "hints"],
    "loci:vignettes:phase-one": [isObj, "story campaign"],
    "loci:hall:v1": [isObj, "hall"],
    "loci:combat:math:graph-theory:v1": [(v) => isObj(v) && (v.completed === undefined || isArr(v.completed)), "lab mastery"],
    "loci:npc:keepers": [oneOf("full", "text", "off"), "keeper faces"],
    "loci-mute": [(v) => v === 0 || v === 1 || v === "0" || v === "1", "mute"],
  };
  // -1/0/1 on dotted versions ("1.3.516" vs "1.3.509"); a missing part reads 0. Unparseable reads 0 (equal):
  // it cannot prove the file is newer, so it allows it; the account-version check below stays the real gate.
  function compareVersions(a, b) {
    const pa = String(a || "").split("."), pb = String(b || "").split(".");
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] === undefined ? 0 : Number(pa[i]), y = pb[i] === undefined ? 0 : Number(pb[i]);
      if (Number.isNaN(x) || Number.isNaN(y)) return 0;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }
  function byteLength(s) {
    if (typeof Buffer !== "undefined" && Buffer.byteLength) return Buffer.byteLength(s, "utf8");
    return new TextEncoder().encode(s).length;
  }
  const sizeRefusal = () => "That file is too big to be a Loci save (over 5 MB).";
  const gameVersion = () => (typeof self !== "undefined" ? self : this)?.ConceptCombatVersion
    || (typeof globalThis !== "undefined" ? globalThis.ConceptCombatVersion : null) || "unknown";
  // store.get(key) may return undefined for a missing key; only present keys travel.
  function buildExport(store, now = Date.now()) {
    const data = {};
    for (const k of ALLOW) { const v = store.get(k); if (v !== undefined) data[k] = v; }
    for (const k of (store.keys ? store.keys(PINS_PREFIX) : [])) { const v = store.get(k); if (v !== undefined) data[k] = v; }
    return { loci: "save", format: FORMAT, game: gameVersion(), exportedAt: now, data };
  }
  function fail(error) { return { ok: false, error }; }
  // text: the file's text; runningGame: ConceptCombatVersion of this build. Every refusal is plain words, no jargon.
  function parseImport(text, runningGame) {
    if (typeof text !== "string" || byteLength(text) > MAX_BYTES) return fail(sizeRefusal());
    let file = null;
    try { file = JSON.parse(text); } catch { return fail("That is not a Loci save file."); }
    if (!file || file.loci !== "save") return fail("That is not a Loci save file.");
    if (typeof file.format !== "number") return fail("That save file isn't one this Loci can read.");
    if (file.format > FORMAT) return fail("That save uses a newer file format. Update Loci first.");
    if (file.format !== FORMAT) return fail("That save file isn't one this Loci can read.");
    if (typeof file.game !== "string" || !file.game) return fail("That is not a Loci save file.");
    if (compareVersions(file.game, runningGame) > 0) return fail("This save is from a newer Loci. Update first.");
    if (!file.data || typeof file.data !== "object") return fail("That save has no character in it.");
    if (file.data[ACCOUNT_KEY] === undefined) return fail("That save has no character in it.");
    let account = null;
    try { account = A.deserialize(file.data[ACCOUNT_KEY]); }
    catch { const v = file.data[ACCOUNT_KEY] && file.data[ACCOUNT_KEY].version; return fail(`That save's character is version ${v ?? "unknown"}; this Loci reads version ${A.VERSION ?? 1}.`); }
    for (const k of ALLOW) {
      const shape = SHAPES[k];
      if (shape && file.data[k] !== undefined && !shape[0](file.data[k])) return fail(`That save's ${shape[1]} isn't readable.`);
    }
    const pinsShape = (v) => isArr(v) && v.length <= 6 && v.every(isStr);   // mirrors ui.js pins(): an array of command keys, at most 6 pinned
    for (const [k, v] of Object.entries(file.data)) {
      if (k.startsWith(PINS_PREFIX) && !pinsShape(v)) return fail("That save's command pins aren't readable.");
    }
    const data = {}, dropped = [];
    for (const [k, v] of Object.entries(file.data)) { if (ALLOW.includes(k) || k.startsWith(PINS_PREFIX)) data[k] = v; else dropped.push(k); }
    const day = typeof file.exportedAt === "number" && !Number.isNaN(new Date(file.exportedAt).valueOf()) ? new Date(file.exportedAt).toISOString().slice(0, 10) : "an unknown date";
    const preview = `${account.name || "Unnamed"} · level ${account.level} · fame ${account.fame || 0} · ${account.battles || 0} battles · saved from Loci ${file.game}, ${day}`;
    return { ok: true, preview, data, dropped };
  }
  // The write loop the importer runs after the player confirms (Replace): every allow-listed key wholesale,
  // nothing else — and allow-listed keys the file lacks are removed, so this device's leftovers don't linger.
  // It re-filters: only parseImport's output should ever arrive here, but a secret must not depend on the caller.
  function applyImport(store, data) {
    const wanted = (k) => ALLOW.includes(k) || k.startsWith(PINS_PREFIX);
    for (const [k, v] of Object.entries(data)) if (wanted(k)) store.set(k, v);
    for (const k of ALLOW) if (!(k in data)) store.remove(k);
    for (const k of (store.keys ? store.keys(PINS_PREFIX) : [])) if (!(k in data)) store.remove(k);
  }
  function exportFilename(name, now = Date.now()) {
    const clean = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "warden";
    return `loci-save-${clean}-${new Date(now).toISOString().slice(0, 10)}.json`;
  }
  // Saves move only outside battle (and never in a test battle); null when the dialog may open.
  function battleBlock(u) {
    return (u.testSnapshot || (u.s && !u.s.outcome)) ? "Finish or leave the battle first: saves move only outside battle." : null;
  }
  // The native backup panel resolves {cancelled:true} when dismissed; a cancelled backup must not swap.
  // The browser path resolves {} (download kicked off), which swaps.
  function shouldSwapAfterBackup(r) { return !(r && r.cancelled); }
  // Native app: prefer the Swift save/open panels; the browser path is the fallback. Replies arrive through _resolve,
  // which app.js routes here when its own pending map has no such id.
  const pending = new Map(); let seq = 0;
  const native = () => (typeof window !== "undefined" ? window.webkit?.messageHandlers?.loci : null) || null;
  function nativeCall(cmd, ...args) {
    const loci = native(); if (!loci) return Promise.resolve(null);
    return new Promise((resolve) => { const id = ++seq + 1000000; pending.set(id, resolve); loci.postMessage({ id, cmd, args: args.map(String) }); });
  }
  function _resolve(id, data) { const r = pending.get(Number(id)); if (r) { pending.delete(Number(id)); r(typeof data === "string" ? data : JSON.stringify(data)); } }
  return { ALLOW, PINS_PREFIX, FORMAT, MAX_BYTES, ACCOUNT_KEY, compareVersions, byteLength, sizeRefusal, buildExport, parseImport, applyImport, exportFilename, battleBlock, shouldSwapAfterBackup, nativeCall, _resolve };
});
