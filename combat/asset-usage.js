"use strict";
// Catalog facts live apart from speculative future uses. File presence is not a runtime assignment.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./status-presentation.js"), require("./classes/class-builds.js"), require("./fx-sprites.js"), require("./content.js"));
  else root.ConceptCombatAssetUsage = factory(root.ConceptCombatStatus, root.ConceptCombatClassBuilds, root.ConceptCombatFXSprites, root.ConceptCombatContent);
})(typeof self !== "undefined" ? self : this, function (Status, Classes, FX, Content) {
  const stripUses = new Map();
  for (const def of Object.values(Content.abilities)) {
    const strip = FX.stripFor(def); if (!strip) continue;
    const src = `combat/sprites/${strip}.png`;
    if (!stripUses.has(src)) stripUses.set(src, []);
    stripUses.get(src).push(def.name);
  }
  const labels = { used: "In use", unused: "Unused", alternate: "Alternate art", cleanup: "Needs cleanup" };
  function describe(it) {
    let state = "unused", currentUse = "No runtime assignment recorded.", proposal = it.use;
    const file = it.source || "", icon = /^combat\/sprites\/fx\/status\/([^/]+)\.png$/.exec(it.src)?.[1];
    const marker = Status.artUses().find(r => r.icon === icon);
    const techniques = stripUses.get(it.src);
    if (it.live) { state = "used"; currentUse = `In the game as sprites/${it.live}.`; proposal = ""; }
    if (techniques) { state = "used"; currentUse = `Technique illustrations · ${techniques.slice(0,3).join(", ")}${techniques.length > 3 ? ` and ${techniques.length - 3} more` : ""}.`; proposal = ""; }
    if (it.src === "combat/sprites/auras/power-ascend/frame-1.png") { state = "used"; currentUse = "Belief conversion scene · upright power aura."; proposal = ""; }
    if (it.src === "combat/sprites/auras/mystery/frame-1.png") { state = "used"; currentUse = "Shaken belief scene · mystery aura."; proposal = ""; }
    if (marker) { state = "used"; currentUse = `${marker.name} · board markers and condition panels.`; proposal = ""; }
    if (file === "Pixel Doctor Sprite Sheet.png" && Classes.builds.doctor?.status === "live") {
      state = "used"; currentUse = "Doctor · playable class uses the doctor pose set."; proposal = "";
    }
    if (file === "Customer.png") {
      state = "alternate"; currentUse = "Retired shopping-cart appearance. The live Customer civilian carries bags.";
      proposal = "An optional alternate appearance; retain the current civilian kit.";
    }
    if (file === "MMA Fighter Alternate.jpg" || it.title === "Genghis Khan true form (B)") { state = "alternate"; currentUse = "Unassigned alternate artwork for an existing character or form."; }
    if (file === "bittermelon.png") proposal = "A food consumable; its effect is not defined yet.";
    if (file === "burled-wood.png") proposal = "A material once a concrete repair or crafting recipe consumes it.";
    if (["Monkey Trainer Sprite.jpg", "Animal Tamer Sprite.jpg", "Construction Worker Sprite Sheet.jpg", "Ani Sprite Kit.jpg"].includes(file)) {
      state = "cleanup"; currentUse = "Unused. Transparent cuts are on the review shelf; caption and overlapping edges need final review.";
    }
    return { ...it, state, stateLabel: labels[state], currentUse, proposal };
  }
  function catalog(data) {
    return { groups: (data.groups || []).map(g => ({ ...g, items: g.items.map(describe) })) };
  }
  function filter(data, { group = "all", state = "all" } = {}) {
    return data.groups.filter(g => group === "all" || g.id === group).map(g => ({ ...g, items: g.items.filter(it => state === "all" || it.state === state) })).filter(g => g.items.length);
  }
  return { labels, describe, catalog, filter };
});
