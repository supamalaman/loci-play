"use strict";
// Concept Combat effect sprites. Presentation only: assigns the imported magic-effect art
// (sprites/fx, sliced by tools/import-magic-fx.py) to concepts, and turns the effect player's
// drawing ops into sprite draws. It adds no rule and no tile the ops did not already name.
// The art is glow on transparency: draw it with additive blending.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ConceptCombatFXSprites = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PHASES = { cast: 3, projectile: 4, impact: 3, linger: 3 };
  const ELEMENTS = ["fire", "earth", "nature", "shadow", "ice", "poison", "water", "air", "holy", "arcane", "electric", "blood"];
  const UTILITY = { buff: 4, shield: 4, teleport: 4, summon: 3, debuff: 4 };
  const STATUS = ["stun", "sleep", "doom", "bleed", "burn", "regrow", "confuse", "poison"];
  // The element is the picture of how the concept acts, not a damage type.
  const CONCEPT_ELEMENT = {
    barrier: "earth", berm: "earth", inertia: "earth", gradingDrainage: "earth", interposition: "earth", load_distribution: "earth", settlement: "earth",
    elasticity: "air", tension: "air", leverage: "air", lyricism: "air", folding: "air",
    selectivity: "ice", preservation: "ice", fault_tolerance: "ice", constraint: "ice",
    cybernetic_ecology: "nature",   // the Agent Swarm's living circuit (2026-10-13)
    sightline: "holy", focus: "holy", legitimacy: "holy", complementarity: "holy", delegation: "holy", harmony: "holy",
    threshold: "electric", resonance: "electric", timing: "electric", pipeline: "electric", hardware: "electric", mise_en_place: "electric", enhancement: "electric",
    adaptation: "water", swale: "water", plasticity: "water", periodicity: "water",
    deception: "shadow", reversal: "shadow", stealth: "shadow",
    pathway: "arcane", section: "arcane", collage: "arcane", indexing: "arcane", adjacency: "arcane", inference: "arcane", software: "arcane", retrieval: "arcane", imagination: "arcane", longtermism: "arcane",
    boundary: "fire", strategic_commitment: "fire", antifragility: "fire", hospitality: "fire",   // the Hot Pot Berserker: the boiling pot and the hearth (2026-10-25)
    diffusion: "poison", obsolescence: "poison",
    pruning: "nature", succession: "nature", traditional_medicine: "nature", herbal_medicine: "nature",
    reciprocal_obligation: "blood", dependency: "blood", extraction: "blood",
  };
  const CHANNEL_ELEMENT = { nigredo: "earth", albedo: "holy", citrinitas: "poison", rubedo: "blood" };
  // Effects that are not harm get a utility set in place of the concept's element.
  const EFFECT_UTILITY = { heal: "buff", mend: "buff", buff: "buff", guard: "shield", ward: "shield", shield: "shield", teleport: "teleport", blink: "teleport", summon: "summon", debuff: "debuff", weaken: "debuff", slow: "debuff" };

  // A technique with art of its own (one frame each) in place of its concept's element set. Breadfruit Hurl: the
  // flying fruit and its burst, from the ʻulu sheet (sprites/fx/ulu/).
  const SIGNATURE = { uluHurl: { projectile: "fx/ulu/projectile", impact: "fx/ulu/hit" } };
  // Technique pictures (sprites/fx/spells/, 40 strips imported and unused until 2026-10-11). A technique's strip is
  // chosen by what it does (its shape) and its concept's element, so every technique gets one without a hand-made
  // list. The pictures are illustration only: the name on a strip's file is not the technique's name.
  const STRIP_SHAPES = {
    shield: { ice: "cat-hail-wave", water: "ice-wall", fire: "flame-wall", arcane: "arcane-shield", holy: "arcane-shield", shadow: "arcane-shield", "*": "barrier" },
    heal:   { nature: "healing-blossom", poison: "purify", water: "purify", "*": "healing-light" },
    move:   { shadow: "vanish", "*": "teleport" },
    trick:  { "*": "illusion" },
    bolt:   { fire: "cat-fire-fireball", ice: "cat-hail-shards", water: "ice-spear", shadow: "shadow-bolt", poison: "poison-bolt", electric: "lightning-bolt", nature: "vine-whip", earth: "telekinetic-slam", holy: "smite", blood: "corrupting-touch", "*": "magic-missile" },
    touch:  { electric: "electric-surge", nature: "thorns", earth: "telekinetic-slam", holy: "smite", "*": "corrupting-touch" },
    nova:   { fire: "cat-fire-burst", ice: "cat-hail-burst", water: "frost-nova", earth: "cat-quake-burst", holy: "radiant-nova", arcane: "mana-burst", poison: "disease-burst", blood: "disease-burst", nature: "thorns", shadow: "darkness-field", "*": "thunderclap" },
    field:  { fire: "cat-fire-wall", ice: "cat-hail-shower", water: "blizzard", electric: "storm-field", air: "storm-field", poison: "toxic-cloud", shadow: "darkness-field", nature: "entangling-roots", earth: "cat-quake-eruption", holy: "radiant-nova", blood: "acid-splash", "*": "arcane-blast" },
    chain:  { "*": "chain-lightning" },
    // Everything else (terrain work, information, laws, performances): a picture only where one fits. A third of all
    // techniques land here, and one stock "mana burst" on all of them would say nothing.
    other:  { nature: "seed-bomb", shadow: "darkness-field" },
  };
  const SHIELD_EFFECTS = ["barrier", "guard", "parry", "membrane", "anchor", "immovable", "ward", "shield", "berm", "bermRing", "fence", "checkDam", "archivistWard", "archivistShelter", "imaginedShelter"];
  const HEAL_EFFECTS = ["heal", "mend", "archivistHeal", "craftCare", "oldGrowth", "nurseLog", "rainGarden"];
  function stripShape(def) {
    const d = def || {}, kind = d.classKind || "";
    if (SHIELD_EFFECTS.includes(d.effect) || /^(guard|shield|cushion|share)/.test(kind) || typeof d.protection === "number") return "shield";
    if (HEAL_EFFECTS.includes(d.effect) || /^(rescue)/.test(kind)) return "heal";
    if (/teleport|relocate|departure/.test(kind) || d.effect === "teleport") return "move";
    if (d.delivery === "signal" || ["mimic", "ambush"].includes(d.effect)) return "trick";
    if ((d.potency || 0) > 0) {
      if (d.delivery === "routed") return "chain";
      if (d.delivery === "contact") return "touch";
      if (d.target === "self" || d.area?.shape === "radius" || d.area?.shape === "ring") return "nova";
      if (d.delivery === "line" || d.target === "enemy") return "bolt";
      return "field";
    }
    return d.delivery === "field" || d.area?.shape === "radius" ? "field" : "other";
  }
  function stripFor(def) {
    if (!def) return null;
    const table = STRIP_SHAPES[stripShape(def)], el = CONCEPT_ELEMENT[(def.concepts || [])[0] || def.concept] || CHANNEL_ELEMENT[def.damageType || def.channel] || "*";
    const name = table[el] || table["*"];
    return name ? `fx/spells/${name}` : null;
  }
  function elementFor(cue) {
    const c = cue || {};
    return CONCEPT_ELEMENT[c.concept] || CHANNEL_ELEMENT[c.damageType] || null;
  }
  function utilityFor(cue) {
    const c = cue || {};
    return EFFECT_UTILITY[c.effect] || (c.type === "summon" ? "summon" : null);
  }
  function step(p, n) { return Math.min(n, 1 + Math.floor(Math.max(0, Math.min(0.9999, p == null ? 0 : p)) * n)); }

  // groups: [{ cue, ops }] from the effect player. Returns [{ src, at:[x,y], angle, size, alpha }]
  // with `at` in tile coordinates and `size` in tiles.
  function draws(groups) {
    const out = [];
    for (const g of groups || []) {
      const el = elementFor(g.cue), util = utilityFor(g.cue), sig = SIGNATURE[g.cue?.ability] || null;
      if (!el && !util && !sig) continue;
      for (const op of g.ops || []) {
        const p = op.p == null ? 1 : op.p;
        if (op.op === "stamp" && op.at) {
          if (sig?.impact) out.push({ src: sig.impact, at: op.at.slice(0, 2), angle: 0, size: 1.5, alpha: 1 });
          else if (util) out.push({ src: `fx/${util}/frame-${step(p, UTILITY[util])}`, at: op.at.slice(0, 2), angle: 0, size: 1.5, alpha: 1 });
          else out.push({ src: `fx/${el}/impact-${step(p, PHASES.impact)}`, at: op.at.slice(0, 2), angle: 0, size: 1.5, alpha: 1 });
        } else if (op.op === "polyline" && op.head && !op.hold && !op.dash && (el || sig?.projectile) && p < 1 && (op.points || []).length > 1) {
          const pts = op.points, a = pts[pts.length - 2], b = pts[pts.length - 1];
          out.push({ src: sig?.projectile || `fx/${el}/projectile-${step(p, PHASES.projectile)}`, at: [b[0], b[1]], angle: Math.atan2(b[1] - a[1], b[0] - a[0]), size: 1, alpha: 1 });
        } else if (op.op === "rise" && el) {
          for (const t of op.tiles || []) out.push({ src: `fx/${el}/linger-${step(1 - p, PHASES.linger)}`, at: [t[0], t[1]], angle: 0, size: 1, alpha: 0.9 });
        } else if (op.op === "aura" && op.origin) {
          if (util) out.push({ src: `fx/${util}/frame-${step(p, UTILITY[util])}`, at: op.origin.slice(0, 2), angle: 0, size: 1.6, alpha: 1 });
          else if (el) out.push({ src: `fx/${el}/cast-${step(p, PHASES.cast)}`, at: op.origin.slice(0, 2), angle: 0, size: 1.4, alpha: 1 });
        } else if (op.op === "ring" && op.origin && el && p < 0.5) {
          out.push({ src: `fx/${el}/cast-${step(p * 2, PHASES.cast)}`, at: op.origin.slice(0, 2), angle: 0, size: 1.4, alpha: 1 });
        }
      }
    }
    return out;
  }

  // Body auras: the upright power and plant-communing art (sprites/auras/power-*, commune-*), one frame each,
  // drawn behind a unit. They show a state the engine already holds; the ground rings in auras/auras.js are separate.
  const POWER = ["surge", "shatter", "storm", "wind", "dark", "ascend", "bolt", "divine"];
  const COMMUNE = ["vine", "blossom", "thorn", "fern", "broadleaf", "seed", "root", "water"];
  function bodyAura(actor, rules) {
    const a = actor || {};
    if (a.defeated) return null;
    if (a.communed && COMMUNE.includes(a.communed.aura)) return `commune-${a.communed.aura}`;
    if (a.summon && a.summon.trueForm) return a.summon.key === "zherm" ? "power-shatter" : "power-divine";   // Zherm rages
    if (a.boss && a.conditions && a.conditions.enraged) return "power-dark";
    const max = rules && rules.ultimateChargeMax;
    if (max && (a.ultimateCharge || 0) >= max && !a.aura) return "power-surge";
    return null;
  }

  // Every file this module can ask for, for the importer check and preloading.
  function files() {
    const out = [];
    for (const el of ELEMENTS) for (const [ph, n] of Object.entries(PHASES)) for (let i = 1; i <= n; i++) out.push(`fx/${el}/${ph}-${i}`);
    for (const [u, n] of Object.entries(UTILITY)) for (let i = 1; i <= n; i++) out.push(`fx/${u}/frame-${i}`);
    for (const s of Object.values(SIGNATURE)) out.push(...Object.values(s));
    return out;
  }

  return { STRIP_SHAPES, stripShape, stripFor, SIGNATURE, PHASES, ELEMENTS, UTILITY, STATUS, CONCEPT_ELEMENT, CHANNEL_ELEMENT, EFFECT_UTILITY, elementFor, utilityFor, draws, files, POWER, COMMUNE, bodyAura };
});
