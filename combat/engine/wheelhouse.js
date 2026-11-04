"use strict";
// Hotbuild wheelhouse swap (W0a; spec ~/loci-orbit/ready-to-review/claude-hotbuilds-w7-spec/specs/HOTBUILDS.md 1a).
// When a hot-build character spawns as an NPC (foe, hire, scenario unit), one seeded roll at
// rules.wheelhouseSwap.chance replaces the secondary concept with the wheelhouse concept and the kit becomes
// blend B: the wheelhouse secondary pair, the same primary pair, the same traits. (The blend's own merge technique is not built here: the W1+ characters author it, loop 1a1a09ed98d-5c38; settle only sets u.secondary.) A player
// who plays the class never rolls: the wheelhouse stays on their sheet for the W1+ reserve/Swap path. The
// first study of a swapped NPC (Observe or Investigate) names it, so a swap is a discovery, not a surprise
// loss. Dark until a character uses it (rules.wheelhouseSwap.on is false on the shelf).
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).wheelhouse = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  // Runs in duel() right after each actor is built; mutates the actor in place. The kit follows from
  // a.secondary at use time (abilitiesOf, pair-gated merges), so the swap is the secondary plus the mark.
  function settle(s, a, ch) {
    const R = s.rules.wheelhouseSwap; if (!R?.on) return;
    if (!a || a.id === "player" || a.boss || a.eventLoadout) return;   // the player never rolls; authored and boss kits stay fixed
    const w = ch?.wheelhouse; if (!w || w === ch.secondary || !H.C?.concepts?.[w]) return;
    if (H.seededChance(`wheelhouse:${a.id}:${s.seed}`) >= (R.chance ?? 0.10)) return;
    const u = s.actors[a.id]; if (!u) return;
    u.secondary = w; u.wheelSwapped = true;
  }
  // The first study names it (called from both observe paths and Investigate after a success); later ones stay quiet.
  function nameSwap(s, t) {
    if (!t?.wheelSwapped || t.wheelNamed) return null;
    t.wheelNamed = true;
    return `Something other than what ${t.name} usually trains is in their hands.`;
  }
  return { wheelhouseSettle: settle, wheelhouseName: nameSwap };
});
