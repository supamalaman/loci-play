"use strict";
// Orgonite tower (ORGONITE.md §10.2): a 1-tile anti-dream structure. Plant orgonite spends 1 puck
// and 40 AP to raise it on an adjacent open tile. Its Chebyshev r=2 field grounds Dream Space,
// dream-monster surfacing, and summons. One live tower per side. Neutral: it hurts the planter too.
//
//   liveTowers(objects) / inField(objects, x, y) / extraTicks(objects, x, y)
//   dreamDamageMul(attacker, target, objects)   1.25 only inside a live tower field (R-20261110-41)
//   plantError(s, a, at) / plantSites(s, a) / makeTower(s, a, x, y)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatOrgonite = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = {
    ap: 40,
    hp: 24,
    radius: 2,
    perSide: 1,
    damageMul: 1.25,
    extraSummonTicks: 1,
    sprite: "fence",
    name: "Orgonite tower",
  };
  const COPY = {
    plant: "Plant orgonite",
    refusal: "Orgonite grounds the dream here.",
    help: "Plant orgonite · 40 AP · 1 puck. Raises a 24 HP tower on an adjacent open tile. Its r=2 field (5×5, two tiles in any direction including diagonals) stops Dream Space from opening, stops dream monsters from surfacing, hits dream monsters ×1.25 inside the field, and costs any summon 1 extra turn at turn end (overrides a frozen Dream Space clock; two fields still cost 1 extra, not 2). One tower per side. Neutral: it grounds your own dream and summons too.",
    thin: "stay thins in the orgonite field",
  };

  const cheb = (x0, y0, x1, y1) => Math.max(Math.abs(x0 - x1), Math.abs(y0 - y1));
  const live = (o) => !!o && o.type === "orgonite" && (o.hp ?? 0) > 0 && !o.dead;
  function liveTowers(objects) {
    return (objects || []).filter(live);
  }
  function inField(objects, x, y) {
    return liveTowers(objects).some((o) => cheb(o.x, o.y, x, y) <= RULES.radius);
  }
  function extraTicks(objects, x, y) {
    return inField(objects, x, y) ? RULES.extraSummonTicks : 0;
  }
  function dreamDamageMul(attacker, target, objects) {
    if (!target?.dream) return 1;
    return inField(objects, target.x, target.y) ? RULES.damageMul : 1;
  }

  function occupied(s, x, y) {
    if (Object.values(s.actors || {}).some((u) => !u.defeated && u.x === x && u.y === y)) return true;
    if ((s.wild || []).some((w) => w.form === "unit" && !w.defeated && w.x === x && w.y === y)) return true;
    return (s.arena?.objects || []).some((o) => o.x === x && o.y === y && ((o.hp ?? 0) > 0 || o.blocksMove));
  }
  function passableTile(s, x, y) {
    const map = s.arena?.map;
    if (!map || y < 0 || y >= map.length || x < 0 || x >= (map[y] || "").length) return false;
    const ch = map[y][x];
    if (/[#~T]/.test(ch)) return false;
    return !occupied(s, x, y);
  }
  function plantError(s, a, at) {
    if (!a) return "Choose who plants.";
    const stash = s.orgonite?.[a.side] ?? 0;
    if (stash < 1) return "Plant orgonite needs 1 orgonite.";
    if ((a.tempo ?? 0) < RULES.ap) return `Plant orgonite needs ${RULES.ap} action points.`;
    const mine = liveTowers(s.arena?.objects).filter((o) => o.side === a.side);
    if (mine.length >= RULES.perSide) return "One orgonite tower per side.";
    const [x, y] = at || [];
    if (!Number.isInteger(x) || !Number.isInteger(y)) return "Choose an adjacent open tile.";
    if (cheb(a.x, a.y, x, y) !== 1) return "Plant orgonite on an adjacent open tile.";
    if (!passableTile(s, x, y)) return "That tile is not open ground.";
    return "";
  }
  function plantSites(s, a) {
    if (!a || !s?.arena?.map) return [];
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const at = [a.x + dx, a.y + dy];
      if (!plantError(s, a, at)) out.push(at);
    }
    return out;
  }
  function makeTower(s, a, x, y) {
    return {
      id: `orgonite-${a.side}`,
      type: "orgonite",
      name: RULES.name,
      tags: ["structure", "building"],
      building: true,
      side: a.side,
      owner: a.id,
      sprite: RULES.sprite,
      x, y,
      hp: RULES.hp,
      maxHp: RULES.hp,
      cover: 0.5,
      blocksMove: true,
      moveCost: 0,
      material: "stone",
    };
  }

  return { RULES, COPY, liveTowers, inField, extraTicks, dreamDamageMul, plantError, plantSites, makeTower };
});
