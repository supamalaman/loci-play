"use strict";
// Class roles (Mala, 2026-10-11): which classes are naturally attack focused, support / defense focused, or specialists.
//
// A role is READ OFF the data, not typed in: every ability of a loadout's two concepts is sorted into one of three
// buckets, the primary counts for more than the secondary, and the largest share names the role. So a class whose
// concepts change, or whose concepts gain abilities, is re-sorted without anyone remembering to. `overrides` is for the
// cases where the count is wrong about what the class is for; each one carries its reason.
//
//   abilityRole(ability)                 → "attack" | "support" | "specialist"
//   conceptMix(conceptId, pair?)         → { attack, support, specialist }   shares that sum to 1, or null (no abilities);
//                                          pairOnly techniques count only for that exact [primary, secondary]
//   mixFor([primary, secondary])         → the same, weighted across a loadout
//   roleFor([primary, secondary])        → role id
//   roleOf(characterOrClassId)           → { role, mix, concepts, source: "derived" | "override", reason? } or null
//   loadoutRoles(characterId)            → one entry per loadout of a roster character
//   all()                                → { id: roleOf(id) } for every roster character and class brief
//
// Thresholds and the support lists are Claude's, PROVISIONAL.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../content.js"), require("./classes-data.js"));
  else root.ConceptCombatRoles = factory(root.ConceptCombatContent, root.ConceptCombatClassData);
})(typeof self !== "undefined" ? self : this, function (C, ClassData) {
  const rules = {
    roles: {
      attack:     { name: "Attack",            text: "Wins by dealing damage. Most of what it can do hurts an enemy." },
      support:    { name: "Support / defense", text: "Wins by keeping its side standing: wards, guards, heals and cover for allies." },
      specialist: { name: "Specialist",        text: "Wins by changing the situation: terrain, information, control, movement or rules." },
    },
    primaryWeight: 1.5,          // the primary concept counts this much against the secondary's 1
    attackAt: 0.45,              // attack share at or above this, and not below the support share → attack
    supportAt: 0.35,             // otherwise support share at or above this, and not below the attack share → support
    // An ability is support when it targets an ally, or when its effect / class kind is one of these (it protects,
    // heals or shelters, whoever it is aimed at).
    supportEffects: ["barrier", "parry", "membrane", "guard", "anchor", "immovable", "archivistWard", "archivistHeal", "archivistShelter",
      "archivistArchive", "craftCare", "imaginedShelter", "imaginedCompany", "presidentDirection", "presidentGuarantee", "oldGrowth",
      "nurseLog", "crownRaise"],
    supportKinds: ["guard", "guardArea", "shieldFace", "cushion", "cushionArea", "share", "rescue", "exempt", "artistMask", "cyphService",
      "maidProtect", "maidRestore", "departureFor", "delegate", "oathGuard", "faithWard"],
    // Potency on these is not damage (a domain's size, a shelter's strength).
    notDamage: ["domain"],
    overrides: {
      super_heroine: { role: "attack", reason: "Mala, 2026-10-11: the superhero and superheroine are physically unmatched. Her count sits at 44% attack, one point under the line." },
      hooded_cyber_rogue: { role: "specialist", mix: { attack: 0, support: 0.4, specialist: 0.6 }, reason: "Steals present life into a capped fund and spends it on one later ally. The count calls that a specialist." },
      hot_pot_berserker: { role: "attack", mix: { attack: 0.5, support: 0.4, specialist: 0.1 }, reason: "A brawler whose bank grows from varied hits; feeds allies with Mapo tofu and Family Style." },
      memorialist: { role: "support", mix: { attack: 0.1, support: 0.6, specialist: 0.3 }, reason: "Wards and heals the living; the Roll converts banked deaths into team ward plus foe damage." },
      seedkeeper: { role: "support", mix: { attack: 0.1, support: 0.5, specialist: 0.4 }, reason: "Buries tempo where allies will stand; blooms pay the ground twice. The count calls prepaid tempo support." },
      ferryman: { role: "support", mix: { attack: 0.1, support: 0.7, specialist: 0.2 }, reason: "Trades places to rescue or advance allies; the Crossing gathers the whole side. Pure team motion." },
      pearl_diver: { role: "attack", mix: { attack: 0.5, support: 0.1, specialist: 0.4 }, reason: "Shapes water early, drags foes into it, bursts a basin for the kill. Setup pays the strike." },
      orgonite_trooper: { role: "attack", mix: { attack: 0.5, support: 0.1, specialist: 0.4 }, reason: "Steals present life through the suit and fires it as an orgonite lance. Setup pays the shot." },
      leviathan_suit: { role: "specialist", mix: { attack: 0.2, support: 0.3, specialist: 0.5 }, reason: "Mends the present body and knocks for a later one. The circuit is the invitation." },
      scale_firmware: { role: "attack", mix: { attack: 0.6, support: 0.1, specialist: 0.3 }, reason: "Compiles a pictured arrival through the suit. The image is the weapon." },
      white_jacket_gunner: { role: "attack", mix: { attack: 0.5, support: 0.2, specialist: 0.3 }, reason: "Prints a raster then spends it into a certain call. The buffer is the invitation." },
      bronze_admin: { role: "support", mix: { attack: 0.1, support: 0.5, specialist: 0.4 }, reason: "Files an order the nearest ally, or a later traveler, already holds." },
      horned_suit: { role: "support", mix: { attack: 0.1, support: 0.5, specialist: 0.4 }, reason: "Pictures an ally already carrying the brief and wards them for it." },
    },
  };
  const ROLES = Object.keys(rules.roles);
  const blank = () => ({ attack: 0, support: 0, specialist: 0 });

  function abilityRole(v) {
    if (!v) return "specialist";
    if (v.target === "ally" || rules.supportEffects.includes(v.effect) || (v.effect === "classEffect" && rules.supportKinds.includes(v.classKind))) return "support";
    if ((v.potency || 0) > 0 && !rules.notDamage.includes(v.effect)) return "attack";
    return "specialist";
  }
  // A technique marked pairOnly counts only for the exact pairs that can cast it (a Pathfinder does not become a
  // specialist because the Ranger's tracking techniques are authored on Pathway). Older pair-gated class techniques
  // still count for their concept: the accepted anchors (Warden as support) were set with them in.
  const castable = (v, pair) => !v.pairOnly || !v.pairs || (!!pair && v.pairs.some(([p, s]) => p === pair[0] && s === pair[1]));
  const memo = new Map();
  function conceptCounts(pair) {
    const k = pair ? pair.join("+") : ""; if (memo.has(k)) return memo.get(k);
    const counts = {};
    for (const v of Object.values(C.abilities || {})) if (!v.signatureOnly && !v.formOnly && castable(v, pair)) for (const c of v.concepts || []) (counts[c] ||= blank())[abilityRole(v)]++;
    memo.set(k, counts); return counts;
  }
  const normal = (t) => { const n = ROLES.reduce((s, k) => s + t[k], 0); if (!n) return null; const out = {}; for (const k of ROLES) out[k] = t[k] / n; return out; };
  const conceptMix = (id, pair = null) => { const b = conceptCounts(pair)[id]; return b ? normal(b) : null; };
  function mixFor(concepts) {
    const t = blank(), pair = (concepts || []).filter(Boolean).slice(0, 2);
    pair.forEach((c, i) => { const m = conceptMix(c, pair); if (m) for (const k of ROLES) t[k] += (i ? 1 : rules.primaryWeight) * m[k]; });
    return normal(t);
  }
  function roleFromMix(m) {
    if (!m) return null;
    if (m.attack >= rules.attackAt && m.attack >= m.support) return "attack";
    if (m.support >= rules.supportAt && m.support >= m.attack) return "support";
    return "specialist";
  }
  const roleFor = (concepts) => roleFromMix(mixFor(concepts));
  // A roster character's default loadout is its first; a class brief has one pair.
  function conceptsOf(id) {
    const ch = C.characters?.[id], cl = ClassData?.classes?.[id];
    if (ch?.configs?.length) return [ch.configs[0].primary, ch.configs[0].secondary];
    if (ch?.primary) return [ch.primary, ch.secondary];
    if (cl?.concepts?.length) return cl.concepts.slice(0, 2);
    return null;
  }
  function entry(concepts, id) {
    const mix = mixFor(concepts), o = id && rules.overrides[id];
    if (o) return { role: o.role, mix: mix || o.mix, concepts, source: "override", reason: o.reason };
    const role = roleFromMix(mix);
    return role ? { role, mix, concepts, source: "derived" } : null;
  }
  const roleOf = (id) => { const cs = conceptsOf(id); return cs ? entry(cs, id) : null; };
  const loadoutRoles = (id) => (C.characters?.[id]?.configs || []).map((cfg) => ({ id: cfg.id, label: cfg.label, ...entry([cfg.primary, cfg.secondary]) }));
  function all() {
    const out = {};
    for (const id of [...Object.keys(C.characters || {}), ...Object.keys(ClassData?.classes || {})]) if (!(id in out)) { const r = roleOf(id); if (r) out[id] = r; }
    return out;
  }
  return { rules, ROLES, abilityRole, conceptMix, mixFor, roleFor, roleOf, loadoutRoles, all };
});
