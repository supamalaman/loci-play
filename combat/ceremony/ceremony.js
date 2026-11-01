"use strict";
// Ceremony (W7.3 build): rites over the Workshop verbs. Every rite beats
// twice (the act, then the seal) and sounds its sting: claims chime,
// mints ignite and seal, namings flourish, rewrites ring the ripple-bell
// one semitone-pair per cascade step. Care, ascension, and gold rites wait
// on their systems (registry-listed, never called). Pure: the screen fires
// the cues and speaks the beats.
//   RITES / STUBS                        → live rites + gated futures
//   rite(id, ctx)                         → { beats: [b1, b2], cues: [{ slot, opts }] } or null
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatCeremony = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RITES = ["claim", "mint", "naming", "rewrite"];
  const STUBS = ["care", "ascension", "gold"];
  function rite(id, ctx = {}) {
    switch (id) {
      case "claim":
        return { beats: [`${ctx.name || "The node"} hears you.`, "Owned — yours, until a GateLess ending seals it."],
          cues: [{ slot: "claim-chime", opts: {} }] };
      case "mint":
        return { beats: ["The theorem ignites.", `${ctx.eq || "The merge"} holds — sealed in the ledger.`],
          cues: [{ slot: "ignite-sting", opts: {} }, { slot: "seal-thump", opts: {} }] };
      case "naming":
        return { beats: [`${ctx.name || "It"} is named.`, "The lore is earned — sealed."],
          cues: [{ slot: "naming-flourish", opts: {} }] };
      case "rewrite": {
        const depth = Math.max(1, ctx.depth || 1);
        return { beats: [`The cascade runs ${depth} deep.`, "The tree holds its new shape — sealed."],
          cues: [{ slot: "ripple-bell", opts: { pitchStep: depth } }] };
      }
      default: return null;   // stubs + unknowns: no rite, no sound
    }
  }
  return { RITES, STUBS, rite };
});
