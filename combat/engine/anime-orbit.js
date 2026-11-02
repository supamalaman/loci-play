"use strict";
// The anime orbit (docs/anime-orbit.md; Mala, 2026-10-27: "whenever you face an anime hero, he will have one of the anime
// sets ... the full Choir set will only be for the boss version of him"). At round 1 every Anime Protagonist who is not
// the player's own hero rolls ONE kit from ANIME_KITS (seeded per unit, so a replay draws the same kit). A participant
// with `orbit: "choir"` is the boss version: all four souls at tier III. A new anime kit joins by adding a row.
// A part of the Concept Combat engine: engine.js installs it with the host object H.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).animeOrbit = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  const JK = typeof module === "object" && module.exports ? require("../workshop/jinki.js") : self.ConceptCombatJinki;   // the soul gifts (workshop/jinki.js)
  return (function () {
    const SOUL_KINDS = ["humble", "steadfast", "noble", "mythic"];
    const NUMERAL = [null, "I", "II", "III"];
    const FRUIT_NAMES = { coil: "Coilfruit", hide: "Hidefruit", mist: "Mistfruit" };
    const ORBIT_CHARACTERS = ["anime_protagonist"];   // who keeps the anime orbit; another anime-genre character joins here
    const pick = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];
    // Weighted table (docs/anime-orbit.md §2; weights and Jinki tiers are the spec's provisional 50/25/25 and 60/30/10).
    const ANIME_KITS = [
      { id: "jinki", weight: 50, apply(s, u, roll) {
          const kind = pick(SOUL_KINDS, roll("kind")), t = roll("tier"), tier = t < 0.6 ? 1 : t < 0.9 ? 2 : 3;
          wearSouls(s, u, { [kind]: tier });
          return `carries an awakened charm (${kind} ${NUMERAL[tier]}: ${JK.GIFTS[kind].name})`;
        } },
      { id: "sinkerfruit", weight: 25, apply(s, u, roll) {
          const all = Object.keys(H.fruitRules?.kits || FRUIT_NAMES), w = s.fruitWorld;   // respec (S4c): not the fruit the player holds, nor the one a rival eater carries (one copy of each in the world)
          const left = w ? all.filter((x) => x !== w.held && x !== s.actors.rival?.fruit?.id) : all, id = pick(left.length ? left : all, roll("fruit"));
          if (w && H.armAnimeFruit?.(s, u, id)) return `ate the ${FRUIT_NAMES[id] || id} and has made it his own, Awakened (he gives up the sea)`;
          u.fruit = { id, ripe: true };
          u.passives = { ...(u.passives || {}), cantSwim: true, drowningDamageMul: Math.max(u.passives?.drowningDamageMul || 1, H.fruitRules?.drowningMul ?? 1.5) };   // the fruit's curse, as engine/fruit.js carryFruit
          return `ate the ${FRUIT_NAMES[id] || id} (he gives up the sea)`;
        } },
      { id: "birdMountain", weight: 25, apply(s, u) {
          if (!H.C.concepts.bird_mountain) return null;
          // Added on top of his own pair (Mala, 2026-10-28: "give him the bird mountain kit without replacing elasticity"):
          // he keeps Plasticity + Elasticity (Snap Shot) and learns the Bird Mountain techniques a secondary would give
          // (no ultimates). styleConcept lets the hermit charge and martial/martial.js treat him as a holder.
          u.styleConcept = "bird_mountain";
          for (const id of H.C.concepts.bird_mountain.abilities) if (H.C.abilities[id] && H.C.abilities[id].tier !== "ultimate" && !(u.learned ||= []).includes(id)) u.learned.push(id);
          return "trains in the Bird Mountain style";
        } },
    ];
    // Souls on a non-player unit: the same gifts loot.js reads off the player's gear (workshop/jinki.js GIFTS), written
    // straight into the unit's passives. Noble's +1 Inspiration lands now (the engine gives it to the player at create).
    function wearSouls(s, u, arts) {
      const p = (u.passives ||= {});
      for (const [kind, tier] of Object.entries(arts)) {
        if (!JK?.GIFTS?.[kind] || tier < 1) continue;
        for (const [k, v] of Object.entries(JK.GIFTS[kind].inject())) p[k] = /Mul$/.test(k) ? (p[k] ?? 1) * v : (p[k] ?? 0) + v;
      }
      p.soulArts = { ...(p.soulArts || {}), ...arts };
      p.soulArtIds = [...new Set([...(p.soulArtIds || []), ...(JK.artIds(arts) || [])])];
      if (arts.noble) u.inspiration = Math.min(s.rules.inspiration?.cap ?? 3, (u.inspiration || 0) + 1);
    }
    function rollKit(s, u) {
      const r = (what) => H.seededChance(`${s.seed}:animeOrbit:${u.id}:${what}`);
      const total = ANIME_KITS.reduce((n, k) => n + k.weight, 0);
      let x = r("kit") * total, kit = ANIME_KITS[ANIME_KITS.length - 1];
      for (const k of ANIME_KITS) { if (x < k.weight) { kit = k; break; } x -= k.weight; }
      return { kit, text: kit.apply(s, u, r) };
    }
    function show(s, u, id, text) {
      u.orbitKit = { id, text };
      const deck = s.insight?.decks?.[u.id];
      if (deck) deck.cards.push({ id: `${u.id}:state:animeOrbit`, kind: "state", sourceId: `animeOrbit:${id}`, key: `state:animeOrbit:${id}`, text: `${u.name} ${text}.`, open: false, difficulty: 1, unlocks: [], tie: 0 });
      H.log(s, { kind: "effect", actor: u.id, text: `${u.name} ${text}.`, why: ["The anime orbit: an Anime Protagonist always brings one anime kit (docs/anime-orbit.md). Observe can read it."] });
    }
    // Round 1 (turns.js beginRound): every orbit character on the field, before anyone acts.
    function animeOrbit(s) {
      if (s.animeOrbitDone) return; s.animeOrbitDone = true;
      for (const u of Object.values(s.actors)) {
        if (!ORBIT_CHARACTERS.includes(u.character) || u.id === "player" || u.ai === "summon" || u.dream || u.wild) continue;
        if (u.orbit === "choir") {
          wearSouls(s, u, Object.fromEntries(SOUL_KINDS.map((k) => [k, 3])));
          let more = "";   // respec (S4c): the boss gets one of everything: the Choir, the Bird Mountain style and one maxed fruit (only one fruit)
          if (s.fruitWorld) { const r = (what) => H.seededChance(`${s.seed}:animeOrbit:${u.id}:${what}`); for (const k of ANIME_KITS.filter((k) => k.id !== "jinki")) { const t = k.apply(s, u, r); if (t) more += `; ${t}`; } }
          show(s, u, "choir", `sings the full Soul Choir: four awakened souls, each at III${more}`); continue;
        }
        if (u.orbit === "none") continue;
        const { kit, text } = rollKit(s, u);
        if (text) show(s, u, kit.id, text);
      }
    }
    return { animeOrbit, ANIME_KITS, wearSouls };
  })();
});
