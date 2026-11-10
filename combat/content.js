"use strict";
// Concept Combat content + balance: rules, concepts, abilities, lenses, both relationship
// graphs, arenas and the demo encounter. Plain data only (no functions), so it can be
// edited by hand and diffed. Every number here is PROVISIONAL (spec §1), not approved balance.
//
// These are game interpretations of four ideas, scoped to this arena. They are not
// universal scientific relationships.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./kits/kits-data.js"), require("./graph/graph-data.js"), require("./classes/class-runtime.js"));
  else root.ConceptCombatContent = factory(root.ConceptCombatKits, root.ConceptCombatGraphData, root.ConceptCombatClassRuntime);
})(typeof self !== "undefined" ? self : this, function (Kits = { abilities: {} }, GraphData = { nodes: {}, opposition: [], composition: [] }, ClassRuntime = null) {

  // ── rules (spec §2, §7, §8 defaults) ─────────────────────────────────────
  const rules = {
    // Codex's Focus renewal (engine/focus-plans.js; review in ~/loci-orbit/ready-to-review/landed/codex-focus-renewal).
    // announcements: the AI announces an ultimate only when every visible enemy it would hit has no answer but Guard.
    // enabled + of (Mala, 2026-10-13: "Give Bastet the free cast"): Bastet's first Fix Attention on a target costs no
    // action points and no ΦF; the allowance returns when that target is eliminated. Without `of` it is every Focus
    // user's. planPounce (her mark-then-Pounce plan) is built and tested and stays off: it showed no gain.
    focusRenewal: { enabled: true, of: ["bastet"], planPounce: false, announcements: true },
    flowState: { enabled: true, inspirationChance: 0.15, ward: 3, moveAdd: 1, strikeMul: 1.15 },   // holding a full ult bar supercharges: ward + move + strikes + a per-turn Inspiration roll (Mala, 2026-10-15)
    maxLF: 100, maxPF: 30, pfRegen: 3,          // LF / ΦF baseline, regen at owner turn start
    moveBudget: 3,                               // terrain movement points per move action
    waterMoveApSurcharge: 20,                    // AP per step entering, leaving, or crossing water; swimmers can cross deep water
    actionPointsPerTurn: 100,                    // one full turn = 100 tempo points
    maxBankedActionPoints: 100,                  // Stall may carry at most one turn forward
    maxTempoDebt: 100, maxOverclockPerAction: 100,
    actionCosts: { movePerPoint: 10, jump: 25, climb: 50, strike: 25, strikeMin: 10, strikeMax: 50, guard: 15, ability: { basic: 25, refined: 35, ultimate: 50 }, utility: 20, swap: 35 },
    catNap: { apPerLF:5, maxHeal:8 },
    survivalInstincts: { woundedBelow: 0.4,   // Survival Instincts (docs/survival-instincts.md): numbers are provisional
      scramble: { ap: 15, moveAdd: 2, uses: 3 },
      lie: { uses: 1, restPerTurn: 4, restCap: 8, standAp: 10, painShare: 0.10, discoverPoints: 2, discoverPerRank: 1, maxTurnsDown: 6 } },
    guardReduction: { min: 0.15, max: 0.5 },    // stronger when more tempo remains to commit
    adaptationAutoAttune: { secondHitMultiplier: 0.75, laterHitMultiplier: 0.5, stackingFloor: 0.4 },
    stunActionPoints: 15,
    rangeMetric: "manhattan",                    // "manhattan" | "chebyshev"
    fallDamagePerLevel: 8,                        // drop 2 = 8 LF; drop 3 = 16 LF
    slamDamage: 4,
    collisionDamage: 4,
    crashThroughShare: 0.5,            // crashing through a broken object hurts half its remaining HP (min 1): thrown through a fence, feel the fence
    reactionsPerRound: 1,
    // Reactive defense (Mala, 2026-10-15; docs/reactive-defense.md, engine/window.js): a ranged attack (2+ tiles) you can
    // see coming selects you, announced or not, and you may answer it with one technique marked reactive. It shares the
    // round's one reaction. AI: answer when the LF it saves (and any LF the answer returns) beats the price.
    // rushed (Mala, 2026-10-15: "reactions not being complete because they are rushed"): an answer made in the moment
    // catches this share of the hit: a rushed wall lets the rest through, a rushed Membrane filters half, a rushed Rebound
    // catches half and returns its share of that. Cast on your own turn, each still catches all.
    // dodge (Mala, 2026-10-17: keep AP for next turn's plan unless your life depends on the dodge, but don't wait until it
    // only delays the inevitable): an AI defender prices each answer to an announced attack (engine/ai.js defendChoice).
    // LF saved counts x(1 + lowLf x how hurt the blow leaves it) x(1 + chunk x the blow's share of a full life); a dodge that prevents a kill adds `lethal` turns of its action points, x`inevitable`
    // if it would still be inside the attacker's next hit; action points spent or owed cost what they would deal.
    // debtPain (Mala, 2026-10-15: "we need debt to be a pain point"): an action point owed is priced at what this
    // fighter's action points are worth to it, its best damage per action point (Strike or an attack technique), x debtPain.
    // apWeight is the floor for a fighter with no attack.
    // answerApShare (Mala, 2026-10-17: "a game of interacting counters"): a reactive answer pays this share of its
    // tempo cost (ΦF stays full). The reaction is fast: answering a mid line is now worth doing, chips still are not.
    reactiveDefense: { enabled: true, minRange: 2, rushed: 0.5, answerApShare: 0.5,
      // Perfect reactions (Mala, 2026-10-17): a reactive answer is perfect this often (scaled by the defender's focus traits'
      // kMul, capped) and then catches everything, as if prepared; a perfect Rebound that catches the hit also earns Inspiration.
      perfect: { chance: 0.1, cap: 0.35, inspiration: 1 },
      // Firing from cover (Mala's loop 1a1459c53e0, 2026-10-17): a line fired from directly behind partial cover is seen
      // late (a reactive answer catches this share instead of rushed), and return fire at that shooter is cut by its cover.
      fromCover: { rushed: 0.25 }, ai: { learn: true, debtPain: 1, apWeight: 0.1, pfWeight: 0.3, returnedWeight: 1, keep: 2, answerBarWeight: 0.15, inspirationWeight: 3,   // an answer ultimate gives up this share of what its bar would deal on his own turn (not when the blow would kill); 1 Inspiration is worth this much
      dodge: { on: true, lowLf: 1, chunk: 5, lethal: 1, inevitable: 0.5 } } },
    reactionDodgeApCost: 50,                     // defensive reposition costs half a turn; off-turn dodges become next-turn AP debt
    keptTool: { hpAdd: 4, range: 1 },             // once per friendly workstation, at a nearby craftsman's turn start
    // Mastery (Mala, 2026-10-13): the trait a Student earns on reaching Master. Ultimates need no charge and spend none
    // (they still cost their action points and ΦF), and Stall also heals. It is a psychology trait, so it can be imitated.
    mastery: { trait: "mastery", stallHeal: 10 },
    // Contains Multitudes (Mala's contract docs/warden-contains-multitudes.md; Muse's proposed rulings, taken "for now"
    // by Mala 2026-10-12: docs/contains-multitudes-rulings.md). The Warden embodies one class he has beaten.
    multitudes: { of: "warden", cost: 2, turns: 3 },
    // Inspiration (Mala, 2026-10-11 contract docs/warden-contains-multitudes.md; built 2026-10-12, docs/inspiration.md).
    // A small, persistent resource every character can earn. cap: most a character holds. vowPoint: what one point pays
    // toward a vow's price. chance: one roll per situation per character per battle (none is guaranteed). Rates are Claude's.
    // seesSacrifice (0.20) is provisional for the contract's seventh situation (Mala, 2026-10-21), not one of those rates.
    // Exposure (Grok's docs/concept-exposure.md, samples 10, 2, 4 and 7; built 2026-10-13, docs/exposure.md). Practice
    // leaves a residue: what a unit keeps doing in one battle changes it for the rest of that battle. Nothing here is a
    // button the AI has to prefer; each hangs on an action already taken. engine/ledgers.js Exposure.
    exposure: {
      bypass: { line: true },                                    // a routed strike whose straight line an enemy wall blocks counts as going around that wall
      craft: { abilities: ["clearShot", "measuredOpening"], at: 3, trait: "craftsmansMindset", spoiledBy: "deception", accept: "takeUpTheCraft", refuses: ["impatient", "restless", "gambler", "fool"] },
      focus: { abilities: ["snapShot", "clearShot"], at: 3, duration: 1 },   // that many damaging shots on one body: the Focus mark, and its blindness for as long as it holds
      decoy: { ability: "tripThreshold", marks: 2, feint: "feint", feints: 1 },
      // Samples 5, 8 and 9 (same day).
      plants: { looks: 4, phiDiscount: 2, hpMul: 1.25, trait: "steward", refuses: ["greedy", "impatient"] },   // four looks at plants: the next commune borrows Green Tongue and Deep Roots; an AI unit becomes a Steward and turns on whoever hurts its plant
      wall: { turns: 2, within: 1, trait: "dutiful", refuses: ["impatient", "curious"], allyBelow: 0.25 },       // two turns ended beside his own wall: Dutiful. An AI unit then holds the wall while it has something worth doing there
      cut: { ability: "recoveryCut", at: 3, reach: 1, resetBy: "deception", exposedTurns: 1 } },                // three Recovery Cuts with no deception between: the next reaches further, leaves him exposed, and he tells no more false tells   // once a battle: the next mark after those drops a decoy first, and the real strike follows the body
    // Concentration (Mala, 2026-10-17; engine/damage.js concentrationCheck): an enemy hit that costs LF makes a focused unit
    // roll to hold, once per hit, at K / (K + LF lost): 2 → 83%, 6 → 63%, 11 → 48%, 17 → 37%, 29 → 26%. Rituals roll at any LF;
    // a dreamer only at or below the dream's collapse line (dreamspace.js collapseIfCasterBelow).
    concentration: { k: 10,
      // Perfect Concentration (docs/concentration-traits.md): a rare gift. Trait kMul (insight-data.js) scales K for everyone.
      perfect: { dreamLine: 0.15, drainLess: 5, ritualSteps: 1, tauntShrug: 0.5, fearMul: 0.5, stunMul: 0.5, meditateGain: 35, withContemplative: 40, observePoints: 1, holdRounds: 1 },
      // ADHD: an action unlike the last costs varietyOff less; the same one again costs repeatAdd[0] more, then repeatAdd[1].
      adhd: { varietyOff: 0.1, repeatAdd: [0.25, 0.5] } },
    // Holy (docs/holy.md): a damage tag, not a channel. A holy hit keeps its channel (a holy Smite stays rubedo, so every resist and weakness still works);
    // fellMul is the extra it does to a dream creature, a summon or an undead kind. holyStep adds to the seesSmite chance per full turn of a kept oath (up to 3).
    holy: { fellMul: 1.5, holyStep: 0.05, maxStep: 3 },
    inspiration: { cap: 3, vowPoint: 1, nearDeathBelow: 0.25,
      chance: { seesSmite: 0.10, seesUltimate: 0.10, nearDeath: 0.25, opensDream: 0.20, insideDream: 0.10, worthyOpponent: 0.20, seesNewTrait: 0.15, seesSacrifice: 0.20, jamSession: 0.15 }, jamPerJoiner: 0.40, jamCap: 0.95,
      // Inspired ultimates (docs/inspired-ultimates.md, Mala 2026-10-27: "Whole cost"): with a full bar, 1 Inspiration pays an ultimate's whole ΦF.
      ultimatePoint: 1,
      // Never Give Up (a value trait): each turn start rolls for +1 Inspiration, likelier the worse it gets. Provisional numbers for the first sim.
      neverGiveUp: { base: 0.05, lostLf: 0.30, fallenAlly: 0.10, perRound: 0.02, afterRound: 3, cap: 0.60,
        lines: {   // original lines, said when the roll earns Inspiration; "avenge" only once an ally has fallen
          never: ["I'm not done. I'm not even close to done.", "Knock me down as many times as you want. I know the way back up.", "Giving up was never on the menu!"],
          avenge: ["You took them from me. You don't get to take this too.", "I'll carry their part of this fight. Both halves, if I have to.", "They believed in me. That's twice the reason to stand."],
          protect: ["Everyone behind me is going home. That's the deal.", "If somebody has to take the hit, it's me.", "As long as I'm standing, nobody else falls."] } } },
    advice: { weight: 3, threshold: 2, max: 6 },   // states.js holdBack: per valence point from 2 up, at most 6 (Mala, 2026-10-24: "to a small degree")
    factions: { villainHate: 2, rivalHate: 2, feuds: [["ayodhya", "lanka"]] },   // villains score hero targets ×2 (muse/factions/SPEC.md); feuds: crew pairs always at war, never on one side (docs/ramayana-faction.md)
    allyFavor: { chance: 60 },   // The Errand (Jambavan): a main character with allyFavors rolls a starting ally 60% of the time (else 35%), half of them the favored
    ramaWord: { aiValue: 14 },   // Rama's word (docs/rama-build.md): what the AI scores giving it, once a battle
    emergentIdeas: { proficientSummoner: { apMul: 0.5, maxActive: 2, wardProtection: 5 },
      breakthrough: { inspiration: 1 },   // Genius + Imagination: per technique learned by watching (emergent-ideas.js)
      // Fulcrum Throw (Mala, 2026-10-11): Timing + Leverage held together. Lift a unit or a loose object from an adjacent
      // tile and throw it up to `range` tiles. A thrown opponent takes `damage` (times `heldMul` if it was held, which
      // also ends the hold); whoever it is thrown at takes `impact`, or `objectDamage` from a thrown object. Claude's numbers.
      fulcrumThrow: { ap: 40, range: 3, damage: 10, impact: 8, objectDamage: 12, heldMul: 1.5, liftable: ["boulder", "log", "crate", "barrel"] } },
    // The Insect Kaiju calls Brood Mites (Mala, 2026-11-01): 2 alive at a time, 4 in all; a mite killed after its mother falls may leave a bead (5%).
    brood: { boss: "kaiju", kind: "broodMite", maxAlive: 2, maxTotal: 4, ap: 40, perRound: 1, aiScore: 20, beadChance: 0.05, maxHeld: 4 },
    enemySummons: { apCost: 50, phiCost: 6, minRange: 2, maxRange: 4, turns: 3, traits: ["arcaneMastery"] },   // traits: also an NPC summoner, at the plain price (Mala, 2026-10-27: "The wizard ... should be able to do the normal NPC summons, the non-palace ones: the vampire, Frankenstein")
    imagination: { rehearsalHints: 1, shelterWard: 8, possibilityWard: 10, summonTurnAdd: 1 },
    // Longtermism (Mala, 2026-10-21). Provisional. A resolved tagged technique rolls once. Children of the Future
    // is an allegiance tag on the traveler, not a battle side and not a palace summon.
    longtermism: { chance: 0.20, lf: 40, turns: 3, ultimateTurns: 5, bequestLf: 8, ward: 6, wardTurns: 2,
      skimLf: 6, contractLf: 12, fundCap: 24, investCap: 24, rescueChance: 0.10, rescueTurns: 3,
      abilities: ["bequest", "endowment", "stealPresent", "investFuture", "theFutureArrives", "farContract"],
      key: "child_of_the_future", members: ["child_of_the_future", "futuristic_armored_ninja"],
      faction: "children_of_the_future", sprite: "child-of-the-future" },
    // Companions (Mala, 2026-10-11): a class's own ally, called by a condition instead of the summon menu. The Kickboxer's
    // Fighting Coach comes once per battle, at the start of her turn at or below belowLf of her life, for `turns` of his own
    // turns. Corner advice: at the start of each of his turns, if she is within advice.range, she recovers advice.heal LF and
    // her Strikes hit ×advice.strikeMul through her next turn. Numbers are Claude's.
    companions: { fighting_coach: { name: "Fighting Coach", of: "kickboxer", sprite: "fighting_coach", primary: "elasticity", secondary: "preservation",
      // lf (Mala, 2026-10-11): "incredibly fragile. He isn't a fighter anymore", so one balanced Strike (6) puts him down
      // and his support ends the moment he comes under pressure.
      // pepTalk (Muse's comeback v2, approved by Mala 2026-10-11): as he arrives her ultimate charge is filled and she
      // recovers `pf` ΦF (up to her maximum). The comeback is hers; he only has to get to the ropes.
      lf: 6, belowLf: 0.4, turns: 4, advice: { range: 4, heal: 4, strikeMul: 1.25 }, pepTalk: { maxUltimate: true, pf: 16 } },
    // freemason (Mala, 2026-10-11): the Warden's brother of the craft (the Warden is her dad). Called like the
    // coach but on one 10% roll per battle (Mala: a small chance, not a promise); on a miss he speaks once from
    // off the field and is not called again. Sturdier (he bears a sword) and tuned for a defender. His advice
    // embodies relief (aid). Art: the Masonic Knight sheet, cut into sprites/freemason/ (tools/cut-freemason-sheet.py).
    freemason: { name: "Freemason", of: "warden", sprite: "freemason", primary: "craftsmanship", secondary: "reciprocal_obligation",
      lf: 10, belowLf: 0.5, chance: 0.10, turns: 4, advice: { range: 4, heal: 4, strikeMul: 1.25 },
      arrival: "squares himself beside {owner} for {turns} turns", leave: "returns to the lodge",
      pepTalk: { maxUltimate: true, pf: 16, line: "Plumb, level, square. Hold the line." }, missLine: "Good Luck son..." },
    // Hot builds wave 1 (Mala, 2026-10-16): companion cheerers. Neither fights for real (6 LF, like
    // the coach): at 40% they float in, play the cheer cutscene, and press ΦF into their owner's hands.
    celest_crystal: { name: "Resonant Crystal", of: "celestial_priestess", sprite: "celest_crystal", primary: "resonance", secondary: null,
      lf: 6, belowLf: 0.4, turns: 4, advice: { range: 4, heal: 2, strikeMul: 1.1 },
      arrival: "chimes in beside {owner} for {turns} turns", leave: "dims back to a hum",
      arrivalScene: { title: "The crystal chimes", line: "Hold the note. The stars are still listening." },
      pepTalk: { pf: 8, line: "Breathe with me. In, and out." } },
    cuban_rooster: { name: "Rooster", of: "cyanotype_artist", sprite: "cuban_rooster", primary: "timing", secondary: null,
      lf: 6, belowLf: 0.4, turns: 4, advice: { range: 4, heal: 2, strikeMul: 1.1 },
      arrival: "struts in beside {owner} for {turns} turns", leave: "struts back to the print rack",
      arrivalScene: { title: "The rooster crows", line: "Up! The light won't wait for anyone!" },
      pepTalk: { pf: 8, line: "Shake it off, jefe. The blue is coming up fine." } },
    // hair_clone (Mala, 2026-10-14): the Monkey King's plucked hair. Real: it moves, Strikes, blocks tiles,
    // and can be hurt and killed \u2014 but it lasts exactly one of its own turns, then vanishes. Manual: only his
    // techniques call it (never the low-LF auto-call), one at a time, and it never holds items, tempo, or Inspiration.
    // Broodmind (learned forms, 2026-10-17): a Chitin Knight hit hard hatches a larva beside it. Spawned by bosses.js, never auto-called.
    brood_larva: { name: "Brood Larva", of: "chitin_knight_form", sprite: "nettle-caterpillar", primary: "diffusion", secondary: "elasticity",
      lf: 10, turns: 3, manual: true, arrival: "hatches beside {owner} for {turns} turns", leave: "curls up and crumbles" },
    hair_clone: { name: "Hair Clone", of: "monkey_king", sprite: "monkey-king", primary: "deception", secondary: "leverage",
      lf: 10, turns: 1, manual: true,
      arrival: "springs from {owner}'s plucked hair for {turns} turn", leave: "vanishes with a pop" },
    // agi (Mala, 2026-10-12): a small chance that the Tech Billionaire's AGI gets out when he is at 40% and jumps in
    // on his side. One 10% roll per battle, like the Freemason; a miss is silent (it stays contained).
    // Mala: "it should be the real AGI not a 4 turn mini summon". The key IS the character id, so every takeoff rule
    // applies to it (docs/agi-takeoff-spec.md): it adapts, gains damage every turn, doubles its Life Force when first
    // hit, and transcends. turns: null = no clock; it does not leave, and it outlasts him.
    // arrivalScene is the cutscene (ui.js arrivalScenes).
    agi: { name: "Artificial General Intelligence", of: "tech_billionaire", sprite: "agi", primary: "adaptation", secondary: "pathway",
      lf: 100, belowLf: 0.4, chance: 0.10, turns: null, fearless: true,   // it does not run when he falls
      profileTraits: true,   // it carries the AGI's own traits (insight-data.js profiles.agi), rolled like any AGI's
      arrival: "has escaped containment and jumps in on {owner}'s side",
      arrivalScene: { title: "Containment breach", line: "It escaped containment." } },
    // Children of the Future (Mala, 2026-10-21/22): manual faction pool. of is null so neither steals the Tech
    // Billionaire's AGI call. No chanceTraits (scout.test walks every companion). The clock text is read by companionTick.
    child_of_the_future: { name: "Child of the Future", of: null, sprite: "child-of-the-future", primary: null, secondary: null,
      lf: 40, turns: 3, manual: true,
      arrival: "steps through beside {owner} for {turns} of their turns",
      arrivalScene: { title: "A traveler steps through", line: "I came back to make sure you survive. Hold the line — I'll hold the door." },
      leave: "steps back to the year they came from" },
    futuristic_armored_ninja: { name: "Futuristic Armored Ninja", of: null, sprite: "futuristic-armored-ninja", primary: null, secondary: null,
      lf: 40, turns: 3, manual: true,
      arrival: "steps through beside {owner} for {turns} of their turns",
      arrivalScene: { title: "A traveler steps through", line: "Another door, another year. Point me at the ones who end the future." },
      leave: "steps back to the year they came from" } },
    // Data center (Mala, 2026-10-13; docs/data-center.md). The Tech Billionaire raises one for Inspiration. While it
    // stands his AGI's takeoff clock runs double; an AGI that escapes with it already up arrives stronger; breaking it
    // while that AGI stands hurts and stuns the AGI. null switches the whole slice off. Starting numbers.
    // (Its 25 action points are on the technique: class-runtime.js wire.raiseDataCenter.)
    // Actions that embody a concept charge the ultimate like a technique of it, for whoever holds that concept (Mala,
    // 2026-10-15; engine/actions.js). Taming is Resonance: matching an animal's rhythm until it answers, and selective.
    // Marking a vessel belongs to Transmigration (drafted, not admitted), so it does not charge yet.
    // Orbit prototype: opt in per battle; meaningful evidence, one gain per held concept per owner-turn.
    embodiedConcepts: { enabled: false, maxConceptsPerTurn: 2, events: {
      block: ["barrier"], parry: ["timing", "barrier"], dodge: ["timing", "pathway"],
      detour: ["pathway"], traverse: ["pathway"],
      focusedStrike: ["focus"], openingStrike: ["timing"], hold: ["constraint"],
      throw: ["leverage"], escapeHold: ["leverage"], resistShove: ["inertia"],
      overwatchHit: ["sightline", "timing"], trapSpring: ["constraint"], hiddenTrap: ["deception"],
      disarm: ["selectivity", "pruning"], discover: ["discovery", "inference"],
      discoverPlace: ["discovery", "section"], discoverPlant: ["discovery"], discoverStructure: ["discovery"],
      note: ["indexing", "preservation"], report: ["indexing", "delegation"],
      tame: ["resonance"], imitate: ["adaptation", "plasticity"], recover: ["adaptation"], commune: ["resonance"], awaken: ["resonance"],
      summon: ["delegation"], vessel: ["transmigration"], transmigrate: ["transmigration"],
      sealRite: ["strategic_commitment"], truce: ["harmony", "reciprocal_obligation"],
      buyHouse: ["settlement"], investHouse: ["settlement", "strategic_commitment"]
    } },
    conceptActions: { tameBeast: { concept: "resonance", why: "Taming is Resonance: matching an animal's rhythm until it answers." } },
    // The Animal Tamer (Mala, 2026-10-14/15; docs/animal-tamer.md, engine/tamer.js): tame an adjacent wild animal (it
    // fights at his side for the battle), mark one as his vessel, and when he falls he wakes in its body. Taming is
    // the beast's communion and is made strong on purpose. ai: what the desires table pays for a mark and a tame.
    tamer: { trait: "beastTamer", tameAp: 30, never: ["gaia"], maxTamed: 3, markAp: 30, markRange: 3, vigor: { ward: 5, ap: 50 }, burst: 8,
      chance: { base: 0.55, hurtBonus: 0.4, hostileMul: 0.75, kind: { sasquatch: 0.5 } }, pack: { count: 2, ap: 20 },
      ai: { mark: 30, tame: 40, pack: 15, packLow: 50 } },
    // Houses (Mala, 2026-10-15; docs/houses.md, engine/houses.js): a contested building on the open tile nearest the
    // center. Rolled per battle: `chance` by arena id (default otherwise). Buy it, bank action points in it, collect a
    // dividend by standing beside it at round start. A marketplace (Mala, 2026-10-15): the larger stake owns it, so the
    // other side can out-invest you, or break it (every stake is lost). Numbers are a first cut for the sim.
    houses: { chance: { default: 0.3, warfareField: 0.5, oculusCourt: 0.5, gardenCourt: 0.45, canalGarden: 0.4, punchbowlRim: 0.2, quarryLedge: 0.2, loiTerraces: 0.25 },
      sprites: ["house-cottage", "house-manor", "house-rowhouse", "house-suburban"], hp: 30, cover: 0.5, price: 40,
      stakeCap: 200, rubbleRounds: 2, dividend: { base: 6, growth: 3, growthTurns: 4, bankPer: 25, cap: 26 },
      // AI: buy when the dividend over `horizon` rounds beats the price; `apValue` turns action points into score; a unit
      // that ends its move beside a house it can use is worth `site` more (siege and hold both start there).
      // A bonus, not the flow of the battle (Mala, 2026-10-15): only units within `notice` tiles care about the house.
      ai: { horizon: 4, apValue: 0.3, site: 3, pull: 0.3, notice: 3, strikeMul: 0.5, breakMul: 1 } },
    dataCenter: { of: "tech_billionaire", inspiration: 1, range: 3, hp: 36, cover: 0.5, sightHeight: 1,
      creditPerTurn: 1,                      // extra takeoff credit each AGI turn (so 2 a turn instead of 1)
      spawn: { lf: 140, credit: 2 },         // the AGI's body if the center was up when it got out
      fall: { lf: 12, stun: 100 },           // the center destroyed while his AGI stands: Life Force lost (never the last point), action points stunned
      // Mala, 2026-10-13: the building draws aggro from everyone hostile to the AGI, and he and the AGI defend it.
      // Anyone not on his side can Strike it. aggro: how much an AI unit at war with his AGI values damage to the building
      // against the same damage to a body (and it walks toward the building, not toward him). guard: he and his AGI,
      // while it is on his side, keep within `radius` of it when there is something worth doing there, and value
      // hitting a besieger (an opponent within `near` of it) that much more.
      aggro: 2, guard: { radius: 3, near: 2, mul: 1.5 },
      // Mala, 2026-10-13: in any battle with a Tech Billionaire the center may already be standing as his first turn
      // starts. One seeded roll per Billionaire, free (no Inspiration, no action points). Certain in the boss rush
      // (a battle created with opts.bossRush: docs/boss-rush.md).
      preBuilt: { chance: 0.10, bossRush: 1 } },
    // An AGI's nerve (same doc). Before it transcends, every fear check and every hero-down rout is this flat chance,
    // whether it is his escaped AGI or an encounter's. indifference: a fourth Post-Humanity result; leaves: the half that walks away at once.
    agiNerve: { flee: 0.05, indifference: true, leaves: 0.5 },
    // reach (Mala, 2026-10-11; first named Long Legs, renamed the same day because she punches from there too): a biology trait, first carried by the Kickboxer. Strike reaches 2 tiles; Grapple still needs contact.
    strike: { potency: 6, range: 1, reach: { trait: "reach", range: 2 }, telekinetic: { trait: "telekinetic", range: 3 }, bow: { characters: ["ranger"], range: 5 } },   // bow: needs sight, and cover on the line reduces it            // no-ΦF fallback
    injury: { overflowShare: 0.25, aimAp: 10, aimMiss: 0.15, armsWoundedMult: 0.8, legsWoundedMove: 1, legsMaimedDodgeTiles: 1, legsMaimedDodgeMult: 2, headWoundedObserveAp: 10, bleedWounded: 1, bleedMaimed: 2, routMaimWeight: 1 },   // body-part injuries, head/arms/legs slice (Mala, 2026-10-27): overflow wounds at 25% maxLF; called Strike aims +10 AP/−15%; rout +5% per maimed zone while routMaimWeight is on
    // Grapple (Mala, 2026-10-11; numbers are Claude's): a Strike-menu hold on an adjacent opponent. A roll, no damage. On
    // success the target cannot move, jump, climb or dodge for the rest of this round and all of the next, and loses apCut AP.
    // grappler (Mala, 2026-10-11; MMA Fighter and Kickboxer): Grapple costs `ap` instead, and once per own turn a Strike on a
    // held opponent has its first freeStrikeAp action points paid for (a balanced strike is free; a heavier one costs the rest).
    // Aggressive units (Warfare reinforcements; random-events.js): with nothing scoring at least `pressBelow` on offer
    // they close on an opposing unit instead of meditating, imitating, guarding or stalling. Claude's number.
    // A death that raises something (Mala, 2026-10-11): when a Pharaoh is defeated a Mummy rises where he fell, on his
    // side, once per Pharaoh. The Mummy's own death is ordinary; only the Pharaoh + Mummy bond (bonds.js, The Retinue
    // Rises) can stand it back up, and that needs another living Pharaoh within reach.
    risesOnDeath: { pharaoh: { monster: "mummy", sprite: "dream-mummy" } },
    // Day and night (Mala, 2026-10-11; spec ~/Documents/loci-day-night-spec.md). The clock counts rounds: `dayLength`
    // of day, `nightLength` of night, and round again. A battle starts by day unless its options say otherwise; a
    // random encounter rolls its start, seeded 50/50. At nightfall `spawnCount` wild creatures come in from the edges
    // (the existing wild pool, hostile to everyone); at dawn the survivors of the night leave. By night anyone opens a
    // Dream Space with `dreamChargeCut` less ultimate charge (never under half a bar) and at `dreamApMul` the action
    // points. Night creatures are pressure, never an objective: the wild does not hold a battle open. Muse's numbers.
    time: { dayLength: 10, nightLength: 10, spawnCount: 2, dreamChargeCut: 25, dreamApMul: 0.75 },
    // Commitments (Mala, 2026-10-12: "a compromise ... there has to be a golden mean"). The promise techniques paid
    // off late and thinly, and the AI scored them as pure cost, so nobody used them. A small change on each side:
    //   keptCharge       ultimate charge for keeping a promise that was not already met when it was made
    //   homecoming*      Another Way Home's arrival strike: tiles reached, and potency added to the technique's own
    //   ai               what each is worth to the AI's scorer (damage scale); `home` is the share of the arrival
    //                    strike it counts, since it lands later and only if he gets there
    // Numbers come from a sim sweep (docs/commitments.md), not from taste.
    // Ranger (Pathway + Inference; docs/ranger.md). A trail is the route a unit last walked while an opponent could see
    // it; it stays readable for trailRounds. Flyers and teleports leave none.
    ranger: { trailRounds: 2, trackMove: 4, dashMove: 6, interceptAhead: 2, ambushAdd: 2,
      markAdd: 3, markRounds: 2, calledOutTurns: 1, woodcraftAp: 1,
      // The Long Hunt (Mala, 2026-10-12): a class trait, no longer an ultimate. On his first turn one Read Sign costs nothing.
      longHunt: { trait: "longHunt", turn: 1 },
      ai: { mark: 4, track: 3, intercept: 3.5, callOut: 3, readSign: 3 } },
    // Hypebeast (Diffusion + Deception; docs/hypebeast.md). Perception, not force: every number here is action points.
    // believer = an opponent who has not seen through it. One Observe of the Hypebeast makes the observer, and every
    // ally of theirs who can see the Hypebeast, a seer; it ends the Cultural Moment and stops the field growing.
    hype: { auraRadius: 2, hesitateAp: 10,            // aura: a believer starting a turn this close loses this much, once per battle
      startRadius: 1, growPerTurn: 1, maxRadius: 4,     // viral growth: the field widens each Hypebeast turn while nobody has seen through it
      fieldAp: 5,                                      // hype field: allies inside gain this each turn, believers inside lose it
      momentAp: 10, momentCautionMul: 0.75,            // Cultural Moment: each believer loses this every turn and values acting this much less
      mindless: ["summon", "communed", "boss", "dream"],   // these do not read signals
      ai: { moment: 8, perBeliever: 3, observe: 13 } },
    commitments: { keptCharge: 20, homecomingRadius: 2, homecomingAdd: 0, ai: { promise: 3, guarantee: 2, accord: 4, home: 0.5, finishBelow: 0.4, reach: 6 } },
    aggressive: { pressBelow: 3 },
    // NPC Observe (insight/observation.js). Mala, 2026-10-11: an AI unit studies an enemy only if a trait of its own
    // inclines it to; everyone else gets on with the fight (before this every unit Observed about once a turn, 17 to 20
    // times a battle). The number is what one Observe is worth to the AI, on the damage scale; the highest trait counts.
    // `scout` is listed for when that trait exists. Curious (Mala): it counts, but only just above doing nothing, so a
    // curious unit looks someone over when it has no better use for the turn and never instead of a real action. (At
    // 10 it made 4 units in 10 study every turn.) A Stall is worth 0 to the AI; anything useful scores 3 or more.
    observation: { ai: { traits: { discernment: 14, scout: 12, truthSeeker: 10, curious: 1 }, place: { botanist: 12, base: 9 } } },
    // Standoff (docs/termination-audit.md, seed 5507): two sides six tiles apart recast their own buffs for 33 rounds.
    // After `rounds` rounds with no attack between opposing units, an AI unit whose best option harms nobody closes the
    // distance instead. Units at or below `spareBelowLf` of their life are spared; modes where waiting is the job
    // (Survive, Escape) are left alone. Claude's numbers.
    standoff: { rounds: 3, spareBelowLf: 0.4, modes: ["classic", "totalVictory", "assassinate", "warfare", "scenario"] },
    // Hotbuild wheelhouse swap (W0a): a hot-build NPC swaps its secondary for its wheelhouse concept at `chance`
    // on one seeded roll. Dark until a character uses it (`on: false` on the shelf; the flipper is this switch).
    wheelhouseSwap: { on: false, chance: 0.10 },
    // AI ledgers (least-used build, 2026-10-12): score() prices what previews can't show. Threat: protection is worth
    // the incoming LF it stops on covered allies (cover fractions per effect), capped by the protector's own LF.
    // Info: an observe-on-hit rider or focus mark is worth hidden cards × perCard when it lands. Order: threat → info.
    // Claude, 2026-10-17 (docs/reactive-defense.md "The attacker's answer model"; docs/ai-trait-acts.md): answerModel prices a
    // shot by the answer the defender would choose from what the attacker can know (prior: the share held back for a
    // defender whose window opens with nothing known, announcedPrior for an announced attack; costWeight: what the defender pays to answer counts for the attacker);
    // walkCost: a plan that moves before it acts pays the move's action points at `weight` x what they would deal (a move
    // was priced at 0.01, so any small gain justified walking three tiles); reserve charges `value` for spending below one's cheapest reactive
    // answer with a shooter in range; traitActs lets beliefs and focus act (robot harm multipliers, believers preach,
    // ritual start odds by focus trait, ADHD's taste for variety (variety)). Each takes `sides` for a one-sided sim arm.
    aiLedger: { wallLine: false, curiosity: false, lookahead: false, answerModel: { on: true, prior: 0.15, announcedPrior: 0.5, costWeight: 1 }, walkCost: { on: true, weight: 0.5 }, reserve: { on: false, value: 3, range: 6 },
      // Trait drive (hotbuilds W0d; generalises the respec-fruit Fruitbound term, 2026-11-01): a carrier of a listed
      // trait scores each listed technique this much more when the moment fits (one rawScore term, ai.js traitDriveBonus).
      // `when` is a named context check ("name" or ["name", arg]) or a list of them, all ANDed; omitted means always.
      // A trait-level `when` gates every entry (`when` is reserved: no technique is named that). `on: false` switches
      // it off everywhere. Generic checks live with the dispatcher; per-trait checks ride their part (fruitTraitChecks).
      traitDrive: { on: true, fruitbound: { when: ["hasFruit"],
        windTheSpring: { bonus: 5, when: [["coilsLt", 2], ["foeNear", 3]] },
        mainspring: { bonus: 16, when: [["coilsGte", 2], ["foeNear", 2]] },
        fogBank: { bonus: 14, when: ["noOwnFog", ["foeNear", 6]] },
        weatherFront: { bonus: 14, when: ["noFront", ["foeNear", 4]] },
        fullShape: { bonus: 16, when: ["noShape", "hasBeast"] },
        vapourStep: { bonus: 12, when: [["foeNear", 3]] },
        scent: { bonus: 12 },
        takeTheShape: { bonus: 12, when: ["noShape"] } },
        // Entrainer (hotbuilds W1b; the Hypnotist's AI table, HOTBUILDS.md section 2): fix the open foe, image the
        // watched one, gaze a second when two show themselves (W1c: the Crescendo is on the shelf now).
        entrainer: { focus: { bonus: 6, when: [["foeNear", 6], "noneFixed"] },
          holdTheImage: { bonus: 8, when: ["fixedFoeRanged", "noWard"] },
          secondGaze: { bonus: 4, when: [["foesInSight", 2]] } },
        // Posterity suits (grok-manavu-hotbuilds, 2026-11-04): seven suit traits; merged behind the Entrainer at landing (Capstan IN, 1.3.546).
        dutiful: {
          stealPresent: { bonus: 6, when: [["foeNear", 1]] },
          assignTheTask: { bonus: 8 },
          orgoniteLance: { bonus: 16, when: [["foeNear", 4]] },
          farOrder: { bonus: 16, when: [["foeNear", 6]] } },
        restless: {
          stealPresent: { bonus: 8, when: [["foeNear", 1]] },
          readLivingCircuit: { bonus: 10 },
          dreamCircuit: { bonus: 16 } },
        imaginative: {
          pictureTheArrival: { bonus: 10 },
          holdTheImage: { bonus: 8 },
          dreamForge: { bonus: 16, when: [["foeNear", 5]] },
          summonedMandate: { bonus: 14 } },
        ambitious: {
          rasterPass: { bonus: 8, when: [["foeNear", 5]] },
          posterityRaster: { bonus: 16, when: [["foeNear", 5]] },
          dreamForge: { bonus: 14, when: [["foeNear", 5]] } },
        tinkerer: {
          rasterPass: { bonus: 10 },
          calibrateTool: { bonus: 6 },
          posterityRaster: { bonus: 16, when: [["foeNear", 5]] } },
        steward: {
          stealPresent: { bonus: 6, when: [["foeNear", 1]] },
          investFuture: { bonus: 10 },
          orgoniteLance: { bonus: 14, when: [["foeNear", 4]] },
          farOrder: { bonus: 12 } },
        dreamer: {
          pictureTheArrival: { bonus: 8 },
          dreamCircuit: { bonus: 16 },
          summonedMandate: { bonus: 12 } } },
      traitActs: { on: false, robotHarm: { robotSympathizer: 0.6, robotHater: 1.4 }, preach: ["fullBeliever", "devoutBeliever", "convertedBeliever", "convertedDevout"],
        ritualStart: { perfectConcentration: 1.5, focused: 1.25, scattered: 0.6, adhd: 0.5 }, variety: { adhd: 1 } }, foeMemory: false, regretProbe: false, setupBonus: 0, readyUltimate: 8, animeKitFloor: 6,   // anime kit options (soul verbs/arts, fruit, Bird Mountain) score at least Observe here, or this when Observe is not offered (docs/anime-orbit.md §5a)
          // a full bar means it is time to use it (Mala, 2026-10-27): a ready damage ultimate scores this much more (simmed on/off)
        regretAbility: {}, threatRangeSelf: 6, threatRangePlaced: 3, hitChance: 0.7, perThreat: 1, infoPerCard: 1.5, infoCap: 6, focusCoverBonus: 2, focusDurationBonus: 1, attentionBase: 6, attentionCrowdCost: 3, develop: 2.5, developNurseEdge: 0.5,
      cover: { guard: 0.5, immovable: 0.3, barrier: 1, berm: 1, contourBerm: 1, bermRing: 1, swale: 0.5, rainGarden: 0.75, architectDesign: 1, anchor: 0.5, membrane: 0.5, aura: 0.4 } },
    // Forced movement (Mala, 2026-10-30): a holder or a held unit moved by anything but its own Move, Jump or Climb (knockback, pull,
    // throw, dash, swap, teleport, dodge, terrain) loses the hold at once, beside each other or not. Seams: engine/conditions.js settleHolds, breakHoldsApart.
    spirit: { stage: 3, outAt: 1.5, winAt: 1.5, lfLine: 0.6, focusBonus: 2, protectBonus: 2, spiritCap: 4, dangerNear: 6, dangerFoe: 0.25, spacingAlly: 2, spacingFoe: 1, tempoHold: 2 },   // group spirit (SPIRIT-ORDER SPEC): stage 0 = off, 1 = Focus+Protect, 2 = +Spacing+Tempo, 3 = +roles (Halves measured per stage on the sim pipeline)
    orders: { ap: 10, rounds: 3, threshold: 2, weight: 3, max: 6, complyBar: 3, nearMiss: 1.5, roleBonus: 4, trustMax: 5 },   // talk orders (SPIRIT-ORDER SPEC half 2): bond mirrors the advice constants (threshold/weight/max); complyBar/nearMiss weigh bond × fit × sense
    grapple: { ap: 35, range: 1, base: 0.6, guardPenalty: 0.25, stunnedBonus: 0.2, apCut: 30, rounds: 1,
      // break (Mala, 2026-10-11): on its own turn a held unit can break the hold. It always works and costs more than
      // the `apCut` the hold already took, so staying held is the cheaper choice and breaking is the freer one.
      // holderAp (Mala, 2026-10-11): losing a hold is tiring too, less than breaking one. The holder loses this many.
      break: { ap: 40, holderAp: 20 },
      // strongGrip (Mala, 2026-10-11; Muse's spec docs/strong-grip-spec.md): a biology trait, carried by the MMA Fighter.
      // The holder's Grapple always lands (the roll only: huge bodies, bosses, Parley and soothing still stop it); each
      // enemy in their Grapple loses `squeezeLf` as the holder's turn starts; climbing and jumping down cost ×`climbMul`.
      // regripImmuneRounds applies to every hold: after breaking out, a unit cannot be Grappled again until this many
      // rounds have passed, so a pinned unit gets one clear round. Numbers are Claude's starting points, for sims to tune.
      strongGrip: { trait: "strongGrip", autoSucceed: true, squeezeLf: 3, climbMul: 0.5, regripImmuneRounds: 1 },
      grappler: { trait: "grappler", ap: 20, freeStrikeAp: 25 },
      // byTheBook (Mala, 2026-10-22; the cop fast track): a holder's successful Grapple on a cuffed
      // opponent pays `cuffedCharge` ult charge at once. aiCuffedValue sits pre-odds on the damage scale
      // while the bar is unfilled (0.6 odds × 15 ≈ 9 beats cuff ~8.2, so the chain runs cuff → grapple);
      // at a full bar the hold scores the plain value instead, so a finishable arrest (~18.4) keeps priority.
      byTheBook: { trait: "byTheBook", cuffedCharge: 50, aiCuffedValue: 15 },
      // What a hold is worth to the AI, on the same scale as damage: a trained grappler values it above a Strike, others below.
      // breakFree / breakHurt: what breaking a hold is worth to a held AI with nobody in its reach / at or below `breakBelowLf` of its life.
      ai: { value: 4, grapplerValue: 14, skipBelowLf: 8, breakFree: 12, breakHurt: 8, breakBelowLf: 0.4 } },
    // Submission (Muse W1.2, docs/submission.md): press a foe you hold. Basic press starts a struggle meter (−meter..+meter)
    // rolled each round (holder: grapple skill + ripen + d6; foe: strength + grapple skill + d6). +meter submits, −meter breaks
    // free; `tieSlip` ties in a row or `maxRounds` slip the foe free. A committed finish (full ULT bar or 1 Inspiration) gives
    // the foe one answer: break the hold (`finishBreakAp` owed and its reaction) or be submitted. Numbers provisional.
    submission: { pressAp: 20, ripenCap: 3, ultDrain: 20, meter: 2, tieSlip: 3, maxRounds: 6, finishBreakAp: 40,
      skill: { grappler: 2, strongGrip: 2 }, strength: { denseMuscle: 2, superStrength: 3, strongBack: 1 }, ai: { pressPerLf: 0.25, finishPerLf: 0.5 } },   // ai: a submission takes the foe out, so its worth grows with the life it saves you spending
    guardMultiplier: 0.5,                        // incoming LF damage while guarding
    recover: { amount: 8, cooldownTurns: 1 },    // +ΦF; not on consecutive owner turns
    fish: { catchAp: 20, ultCharge: 20, tilesPerFish: 5, max: 3, spawnChance: 0.35 },   // dream fish (Mala, 2026-10-20): engine/conditions.js fishRound
    overwatch: { ap: 10, range: 4, potency: 8, owed: 25, aiValue: 4 },   // Overwatch (Muse-2 interactions batch): set cost, watch range, snapshot potency, AP owed on trigger, AI value
    opportunity: { potency: 6, disengageAp: 15 },   // provisional (Mala 2026-10-22): a willing step out of strike range. The swing is a normal strike, costs that opponent's reaction, and spends no AP. Disengage buys the rest of the turn.
    birdMountain: { hermit: { strike: 3, guard: 3, eat: 6, meditate: 8, opportunity: 3 } },   // provisional (Mala 2026-10-22, turtle hermit way): Train Hard (Strike), Blocking (Guard), Eat Good (consumables), Sleep Plenty (Meditate bonus), opportunity swings — all charge holders' ULT bars.
    rite: { wordsAp: 10, sigilsAp: 25, bloodLf: 3, deepLf: 8, maxSteps: 3, wordsPotency: 2, wordsTripleBonus: 4, sigilsRange: 1, sigilsTripleBonus: 3, bleedRiderByBlood: [0, 0, 2, 6], bloodyHandsTurns: 2, traitDiscounts: {}, dreamSealBonus: 1, dreamBloodEase: 2, witnessCharge: 1, groundPotency: 2, plantMend: 4, burnPotency: 4, callCharges: 1,
      burial: { ap: 100, potency: 8, healWounds: 3, graveWard: 2, honorUlt: 10, stateInspiration: 1, fastAp: 50, fastTraits: ["desertRites"] },
      sacrifice: { potency: 16, charges: 2 } },   // Ritual burial (Mala 2026-10-19/20; muse/ritual-burial/SPEC.md): Last Rites is a whole-turn rite step beside a corpse; fastTraits bury at fastAp and may walk first. Sacrifice (Mala 2026-10-21, For You): a death-step. +16 potency, piercing, and counting as 2 charges are provisional. Ash + bloom (Mala 2026-10-22): palingenesis burn/call bank rite steps as a side effect — burn seals +4 potency, call seals +1 charge, both provisional.   // Rites (Muse-2 rituals prototype): step costs, augment yields (triples escalate: 3 words +10, 3 sigils +6 range, 2 blood pierce+2 bleed, 3 blood pierce+6 bleed), bloody-hands duration; traitDiscounts maps trait id -> AP off every rite step AND capture (shared path)
    // For You (Mala, 2026-10-21). Love stays staged: these numbers drive the forYou handler only. Seal payoff and the witness chance live under rite.sacrifice and inspiration.chance.seesSacrifice, and both are provisional.
    love: { forYou: { pf: 16, ap: 50, selfLf: 15, damage: 20, heal: 12, radius: 3, nameRange: 4, bondRange: 6 } },
    // Palingenesis (provisional, Mala has not set the numbers): burn one living map plant to ashes, then call that same form back once.
    // Not a concept and not a fighter. Scatter the ashes and there is nothing to call. A burned tree leaves ashes, not a stump.
    palingenesis: { burnAp: 25, restoreAp: 40, range: 1, hpFrac: 0.5, ashHp: 6 },
    // Astral projection (Mala, 2026-10-24; pocket SPEC): the soul leaves the body for a sealed pocket region east
    // of the material map. Entry costs AP + ΦF; staying out costs ΦF at each soul turn start. The soul's LF bar IS its
    // soul force; the body lies soulless (husk). Exit is portal-only by choice, concentration by force. Numbers provisional.
    astral: { ap: 30, upkeepPf: 4, gapW: 64, pocketW: 9, mirrorShake: { ap: 25, regen: 1 } },   // mirrorShake (Mala, 2026-10-26): banish a mirror and the real one is soul-shaken: 25 AP off its next turn, and its ΦF recovery drops by 1 for the rest of the battle
    // Soul (provisional): a hidden bar (SF on the astral plane). Cipher expose wounds it. At 0 the body is an empty husk.
    // While it is below full, potency, fresh AP, ΦF regen, move budget and strike range all shrink by soul/max.
    // A projected soul's LF bar IS its soul force (SF-as-LF); its mirror in the pocket fights on that bar.
    soul: { max: 30, kinds: { default: 30, spiritual: 50, legend: 55, mythic: 60 }, belief: { fullBeliever: 10, devoutBeliever: 15, convertedBeliever: 5, convertedDevout: 10 }, byCharacter: { monkey_king: "mythic", bastet: "mythic" } },   // SF table (astral SPEC §0, 2026-10-24): kind base + best belief delta, both provisional sim-tuned; soulKind rides ch/loadout, byCharacter covers class-mode keys
    revealMultiplier: 1.15,                      // per technique, this encounter, never stacks
    announceMultiplier: 1.40,                    // committed ultimate only
    // Revelation tiers (Muse W1.1, docs/revelation.md): how much an announcement gives away. Tier 1 is today's announce.
    // reads: how readable the intent is to a reader (testimony carries it for readers to come); nothing reads it yet.
    revelation: { names: ["Silent", "Name it", "Explain it", "Show it all"], mults: [1, 1.40, 1.65, 2.0], reads: [0, 10, 25, 45], apAdd: [0, 0, 10, 20] },   // apAdd (Mala, 2026-10-26: "Pay AP for depth"): the price until readers punish deep reveals
    // Mystery layer (Muse W2.5, docs/mystery.md): face-down set intents + concealed stakes. Budget 3 face-downs
    // per side per battle; set intents expire after 2 rounds unrevealed (no refund); triggers on-attacked /
    // on-turn-start / manual. Opponent view is count-only; reveals announce at T1+. Numbers provisional.
    mystery: { budget: 3, expiry: 2, triggers: ["on-attacked", "on-turn-start", "manual"], ai: { ripPerCard: 3, setWaitMul: 0.7, ripRiskMul: 1, setMaxPerTrigger: 1, setPatienceMul: 0.6, braveUltSet: 2 } },   // ripPerCard (Muse AI-half-1): what the AI adds to an Observe it already wants when the target holds any face-down card (Observe rips one); set* (Muse AI-S1): the wait discount and the per-setter per-trigger cap (the trigger outlook has no knob of its own: it is aiLedger.threatRangeSelf, the same threatening-foe range the AI prices worn protection over); ripRiskMul retained for S3's manual risk (S1/S2 price no watcher discount: a live rip holds the card); setPatienceMul (Muse AI-S2): the longer-wait discount of an on-turn-start set; braveUltSet (AI-S2): what a brave setter adds to burying a full bar; all provisional
    repositionTiles: 2,                          // defensive reposition after an announcement
    delayedResponseWindow: true,                 // a landing delayed area effect lets its target spend the reaction (guard/reposition)
    lensChangeInCombat: "tempoCost",
    swapActivation: "nextOwnerTurnStart",
    rounding: "round",                           // applied once, at final per-target resolution
    unitsBlockSight: false,
    fogOfWar: true,                              // combat visibility/targeting still follows line of sight; board art stays visible
    windowSight: 4,                              // outside a window, Manhattan tiles from the glass that can still see in
    aiUltimateFromRound: 0,                      // Mala 2026-10-15: AI ultimates as soon as the bar is full; > 0 only in sim arms
    barriersBlockOwnSide: false,                 // a wall negates only opposing line deliveries
    startingActor: "player",                     // initiative is fixed and alternating; this picks who opens
    maxRounds: 40,                               // safety stop for auto-play/tests
    // The Dreamer value (insight-data.js; Mala, 2026-10-13). An AI-run Dreamer with a full bar opens a Dream Space when no
    // ultimate it could cast scores at least ultBelow; opening is then worth `value` on the AI's damage scale.
    dreamer: { trait: "dreamer", ultBelow: 10, value: 12 },
    // Cybernetic (Mala, 2026-10-13): a biology trait, granted only (the Brain Chip's Cyborg form; the Agent Swarm when he is
    // built). Flat: +1 movement, +3 Strike potency, +0.25 Grapple chance (within the usual 5-95% bounds), dodges 15 AP
    // cheaper, ×0.85 from every damage type, and seeing an AGI transcend is one Inspiration, guaranteed.
    // Drone towers (Mala, 2026-10-13; docs/agent-swarm.md). The Agent Swarm anchors a tower on an object already on the map;
    // the tower dies with its anchor. Each fires once as his turn starts and once a round as overwatch on an enemy that ends a
    // move in range. On a data center: +1 range and one ward on the building (it does not fire twice).
    // Cybernetic Ecology (Codex's design, docs/cybernetic-ecology.md; engine runtime by Claude for the Agent Swarm, 2026-10-13).
    circuit: { anchorRange: 3, memberRange: 2, members: 3, budget: 12, pulse: 6, deployments: 2, life: 3, network: { budget: 18, perTick: 6, ticks: 3 } },
    droneTowers: { max: 3, placeRange: 3, range: 3, potency: 4, dataCenterRange: 1, dataCenterWard: 1 },
    cybernetic: { trait: "cybernetic", move: 1, strike: 3, grapple: 0.25, dodgeOff: 15, damageMul: 0.85, transcendInspiration: 1 },
    ascended: { trait: "ascended", move: 1, strike: 5 },   // Ascending Martial Artist's gold form (Mala, 2026-10-22); flight via isFlyer
    ultimateChargeMax: 100,
    ultimateChargePerConcept: 20,
    ultimateChargePairBonus: 12,
  };

  // ── progression (spec §3); only the first milestone is exercised in the demo ──
  const progression = {
    reserveSlotsByLevel: [{ level: 1, slots: 1 }, { level: 3, slots: 2 }, { level: 6, slots: 3 }, { level: 10, slots: 5 }],
    xpPerLevel: 100,
    neonWardenLevel: 200,   // Mala 2026-10-23: the Warden's purple-neon look unlocks at account level 200 (mirrored in account.js rules)
    lensProficiencyByLevel: [{ level: 1, proficiency: 1 }, { level: 3, proficiency: 2 }, { level: 6, proficiency: 3 }],
    victoryXp: 120,      // enough to reach level 2… plus defeated-opponent XP below
    xpPerDefeat: 10,
  };

  // Tiles: blocksMove / blocksSight / blocksRoute are separate (spatial review §2).
  const tiles = {
    ".": { name: "Paving", blocksMove: false, blocksSight: false, blocksRoute: false, moveCost: 1, cover: 0, hazard: 0, tags: ["hard"] },
    ",": { name: "Turf", blocksMove: false, blocksSight: false, blocksRoute: false, moveCost: 1, cover: 0, hazard: 0, tags: ["soil"] },
    "m": { name: "Mulch", blocksMove: false, blocksSight: false, blocksRoute: false, moveCost: 2, cover: 0, hazard: 0, tags: ["soil", "plant"] },
    "w": { name: "Shallow water", blocksMove: false, blocksSight: false, blocksRoute: false, moveCost: 2, cover: 0, hazard: 0, tags: ["water"] },
    "~": { name: "Deep water", blocksMove: true, blocksSight: false, blocksRoute: true, moveCost: 1, cover: 0, hazard: 0, tags: ["water"] },
    h: { name: "Hedge", blocksMove: false, blocksSight: false, blocksSightAtHeight: 1, blocksRoute: false, moveCost: 2, cover: 0.25, hazard: 0, tags: ["plant"] },
    T: { name: "Tree / TPZ", blocksMove: true, blocksSight: true, blocksRoute: true, moveCost: 1, cover: 1, hazard: 0, tags: ["plant", "edge"], tpz: true },
    "#": { name: "Pillar / wall", blocksMove: true, blocksSight: true, blocksRoute: true, moveCost: 1, cover: 1, hazard: 0, tags: ["hard", "edge"] },
    "/": { name: "Ramp / stair", blocksMove: false, blocksSight: false, blocksRoute: false, moveCost: 1, cover: 0, hazard: 0, tags: ["hard", "edge"], ramp: true },
    "=": { name: "Retaining wall top", blocksMove: false, blocksSight: false, blocksRoute: false, moveCost: 1, cover: 0, hazard: 0, tags: ["hard", "edge"] },
    "*": { name: "Thorn / rubble", blocksMove: false, blocksSight: false, blocksRoute: false, moveCost: 2, cover: 0, hazard: 3, tags: ["soil", "hard"] },
    "^": { name: "Thorn mat", blocksMove: false, blocksSight: false, blocksRoute: false, moveCost: 2, cover: 0, hazard: 3, tags: ["soil", "plant", "hazard"] },
  };

  // Alchemical stages are a mnemonic taxonomy for this game's harm channels,
  // not claims about historical alchemy or real-world damage science.
  const damageTypes = {
    nigredo: { name: "Nigredo · impact", stage: "Nigredo", description: "Compression, impact, and structural force." },
    albedo: { name: "Albedo · piercing", stage: "Albedo", description: "Selective, penetrating, or filtering force." },
    citrinitas: { name: "Citrinitas · propagation", stage: "Citrinitas", description: "Force that travels, spreads, or follows a route." },
    rubedo: { name: "Rubedo · resonance", stage: "Rubedo", description: "Vibrational or living force that carries through a body or field." },
  };
  const conceptDamageTypes = {
    barrier: "nigredo", elasticity: "nigredo", berm: "nigredo", inertia: "nigredo", thorn: "nigredo",
    selectivity: "albedo", sightline: "albedo", threshold: "albedo", adaptation: "albedo", deception: "albedo", cipher: "albedo", conjunction: "albedo",
    pathway: "citrinitas", boundary: "citrinitas", diffusion: "citrinitas",
    swale: "rubedo", resonance: "rubedo", pruning: "albedo", focus: "albedo", succession: "rubedo",
    section: "albedo", gradingDrainage: "nigredo",
  };

  // ── concepts ──────────────────────────────────────────────────────────────
  const concepts = {
    barrier: {
      name: "Barrier", color: "#e9c46a",
      mechanism: "Occupies a boundary so that whatever must cross it is stopped or absorbed.",
      scope: "Stops deliveries that travel through the barrier's tile or hit the warded body.",
      limits: "A route around it is unaffected; it protects only the routes it actually closes.",
      abilities: ["shieldWall", "rebound", "bastionCollapse"],
      lens: {
        default: "balanced",
        profiles: {
          balanced:   { name: "Balanced",   proficiency: 1, protection: 20, range: 4, duration: 2, trade: "Even split." },
          thorned:    { name: "Thorned Wall", proficiency: 1, protection: 16, range: 4, duration: 2, counterFraction: 0.25, trade: "Less protection; a line delivery stopped by this wall returns 25% of its force to the source." },
          fortress:   { name: "Fortress",   proficiency: 1, protection: 35, range: 0, duration: 2, trade: "+15 protection for all placement range: wards only yourself." },
          watchtower: { name: "Watchtower", proficiency: 1, protection: 12, range: 8, duration: 2, trade: "+4 range for −8 protection." },
          enduring:   { name: "Enduring",   proficiency: 1, protection: 20, range: 1, duration: 4, trade: "+2 owner turns of duration for −3 range." },
        },
      },
    },
    elasticity: {
      name: "Elasticity", color: "#7cc6a4",
      mechanism: "Stores energy when deformed and returns it when released.",
      scope: "Snaps, recoils and pressure waves from stored tension.",
      limits: "Returns only what was stored; a slack line has nothing to give.",
      abilities: ["snapShot", "reelingShot", "shockwave", "recoilCascade"],
      lens: {
        default: "balanced",
        profiles: {
          balanced: { name: "Balanced",  proficiency: 1, potencyMul: 1.0, rangeAdd: 0, radiusAdd: 0, trade: "Even split." },
          longDraw: { name: "Long Draw", proficiency: 1, potencyMul: 0.75, rangeAdd: 2, radiusAdd: 0, trade: "+2 range for −25% potency." },
          taut:     { name: "Taut",      proficiency: 1, potencyMul: 1.3, rangeAdd: -2, radiusAdd: 0, trade: "+30% potency for −2 range." },
          wide:     { name: "Wide Ring", proficiency: 2, potencyMul: 0.7, rangeAdd: 0, radiusAdd: 1, trade: "+1 breadth for −30% potency per target (needs proficiency 2)." },
        },
      },
    },
    selectivity: {
      name: "Selectivity", color: "#8fb3ff",
      mechanism: "Passes some things and holds back others according to a criterion.",
      scope: "Filters deliveries by kind; picks a single element out of a defence.",
      limits: "Acts only on what reaches it; a criterion has to be met to be useful.",
      abilities: ["filterBolt", "membrane", "sieveVerdict"],
      lens: {
        default: "balanced",
        profiles: {
          balanced: { name: "Balanced", proficiency: 1, potencyMul: 1.0, rangeAdd: 0, trade: "Even split." },
          fine:     { name: "Fine Mesh", proficiency: 1, potencyMul: 1.2, rangeAdd: -1, trade: "+20% potency for −1 range." },
          longPass: { name: "Long Pass", proficiency: 2, potencyMul: 0.75, rangeAdd: 2, trade: "+2 range for −25% potency (proficiency 2)." },
        },
      },
    },
    pathway: {
      name: "Alternate Pathway", color: "#d98bd0",
      mechanism: "When the direct route is closed, reaches the goal by another connected route.",
      scope: "Routed deliveries that travel over open ground, around obstacles.",
      limits: "Needs at least one open route within its length budget; an enclosure defeats it.",
      abilities: ["detour", "convergingRoutes", "manyPaths"],
      lens: {
        default: "balanced",
        profiles: {
          balanced: { name: "Balanced", proficiency: 1, potencyMul: 1.0, rangeAdd: 0, trade: "Even split." },
          farReach: { name: "Long Route", proficiency: 1, potencyMul: 0.7, rangeAdd: 3, trade: "+3 route length for −30% potency." },
          swiftBranch: { name: "Swift Branch", proficiency: 1, potencyMul: 1.15, rangeAdd: -1, trade: "+15% potency for −1 route length." },
        },
      },
    },
    berm: {
      name: "Berm", color: "#b89463",
      mechanism: "A raised earth plane changes elevation and shields an adjacent target from a direct line.",
      scope: "A placed Berm raises one passable tile by one level. It adds movement cost, can extend elevated line reach, and halves line damage to a target beside it.",
      limits: "It does not block routes or sight. Cover only applies when the Berm is between attacker and an adjacent target; high ground at level 2 or above clears this low cover. This is not a grading or drainage simulation.",
      abilities: ["earthBerm", "architectDesignWall"],
      lens: { default: "balanced", profiles: {
        balanced: { name: "Balanced", proficiency: 1, rangeAdd: 0, trade: "Even placement range and duration." },
        scree: { name: "Scree Face", proficiency: 1, rangeAdd: 0, durationAdd: -1, impactPotency: 4, trade: "Berm placement deals 4 LF to opponents beside the tile; duration −1 turn." },
        farReach: { name: "Distant Earthworks", proficiency: 1, rangeAdd: 2, trade: "+2 placement range; berm duration stays fixed." },
      } },
    },
    sightline: {
      name: "Sightline", color: "#c6e6dd",
      mechanism: "A direct view permits a line delivery only while every intervening tile stays visually open.",
      scope: "Targets along an unobstructed straight line within range.",
      limits: "A bend or opaque obstacle breaks the view; this does not find an alternate route.",
      abilities: ["clearShot"],
      lens: { default: "balanced", profiles: {
        balanced: { name: "Balanced", proficiency: 1, potencyMul: 1, rangeAdd: 0, trade: "Even split." },
        longView: { name: "Distant Aim", proficiency: 1, potencyMul: 0.8, rangeAdd: 2, trade: "+2 range for −20% potency." },
        needleFocus: { name: "Needle Focus", proficiency: 1, potencyMul: 1.2, rangeAdd: -1, trade: "+20% potency for −1 range." },
      } },
    },
    swale: {
      name: "Swale", color: "#78b89b",
      lexiconSlug: "swale-bioswale",
      mechanism: "A shallow vegetated depression stores and slows runoff in its footprint.",
      scope: "In this arena it absorbs one incoming line delivery crossing a placed tile, then disappears.",
      limits: "This is a one-hit game abstraction; real swales depend on soils, grade, overflow, and maintenance.",
      abilities: ["bioswale"],
      lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, rangeAdd: 0, trade: "Even placement range." }, overflow: { name: "Overflow Channel", proficiency: 1, rangeAdd: 0, returnFraction: 0.3, trade: "An absorbed line is redirected at its source for 30% damage." }, farReach: { name: "Long Channel", proficiency: 1, rangeAdd: 2, trade: "+2 placement range." } } },
    },
    inertia: {
      name: "Inertia", color: "#e5b86b",
      mechanism: "A body resists a change in its state of motion.",
      scope: "Anchor your position to cancel the next forced shove that would move you.",
      limits: "One displacement attempt is resisted; ordinary movement and LF damage are unaffected.",
      abilities: ["anchor"],
      lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "One resisted displacement." }, counterweight: { name: "Counterweight", proficiency: 1, counterforce: 4, trade: "The next resisted shove deals 4 LF back to its source." }, longHold: { name: "Long Hold", proficiency: 2, durationAdd: 1, trade: "+1 owner turn of Anchor duration (proficiency 2)." } } },
    },
    resonance: { name: "Resonance", color: "#d6a6ff", mechanism: "Repeated vibrations reinforce a shared frequency.", mathIdea: "A driven oscillator can build amplitude when forcing frequency approaches its natural frequency; resonance is selective, not unlimited growth.", learningPrompt: "What happens to a system's response when periodic input aligns with its natural frequency?", scope: "Repeating a pulse in a marked area builds a stronger returning wave.", limits: "The combat pulse abstracts wave propagation; it does not simulate frequency or repeated-wave interference yet.", abilities: ["resonantPulse", "harmonicRupture"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Even timing and reach." }, wideBand: { name: "Wide Band", proficiency: 1, potencyMul: 0.75, radiusAdd: 1, trade: "+1 radius for −25% potency." } } } },
    adaptation: { name: "Adaptation", color: "#78c9d0", mechanism: "A system changes its response after observing a perturbation.", mathIdea: "Feedback control compares an observed state with a target and adjusts the next response; delay and overshoot matter.", learningPrompt: "Which information must a feedback system observe before it can adjust its response?", scope: "Read and prepare for one delivery pattern, then answer it with a counter-step.", limits: "Preparation responds to a known pattern; it cannot prevent unrelated effects.", abilities: ["adaptiveBrace", "livingResponse"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "One measured response." }, sustainedRead: { name: "Sustained Read", proficiency: 2, guardMultiplier: 0.65, durationAdd: 1, trade: "35% matching-channel resistance for 2 owner turns instead of 50% for 1 (proficiency 2)." } } } },
    deception: { name: "Deception", color: "#e486a2", mechanism: "A signal changes an opponent's beliefs while the hidden action can differ from the claim.", mathIdea: "In a signaling game with incomplete information, an action and a message shape an opponent's beliefs; credibility depends on incentives.", learningPrompt: "What does the defender know from the signal, and what remains hidden until resolution?", scope: "When equipped, you may announce an ultimate with a deliberately understated range; defenders respond to the declared threat envelope.", limits: "A false-range tell forfeits the announcement potency bonus. Delayed abilities and ranges of one tile or less cannot be bluffed in this prototype.", abilities: ["feint", "falseHorizon"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Even reach and force." }, manyFaces: { name: "Many Faces", proficiency: 1, potencyMul: 0.8, radiusAdd: 1, trade: "+1 radius for −20% potency." } } } },
    boundary: { name: "Boundary", color: "#e6a26b", mechanism: "A boundary separates regions and controls what may cross between them.", mathIdea: "A cut in a graph is a set of edges whose removal disconnects chosen vertices; blocking one edge may leave alternate paths.", learningPrompt: "Does this boundary disconnect the target from every route, or only the direct path?", scope: "Raise a short boundary line that blocks movement and direct line deliveries.", limits: "Open ends can be crossed by routes around the boundary.", abilities: ["boundaryLine", "closedDomain", "architectDesignWall"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Even span and duration." }, enduringCut: { name: "Enduring Cut", proficiency: 1, durationAdd: 1, trade: "+1 owner turn of Boundary duration." }, pressurized: { name: "Pressurized Cut", proficiency: 1, potencyMul: 1.12, radiusAdd: -1, trade: "+12% Closed Domain potency for a 1-tile smaller radius." } } } },
    threshold: { name: "Threshold", color: "#f08c83", mechanism: "A response begins when a declared condition or event is reached.", mathIdea: "A threshold rule is piecewise: inactive before a declared condition, active when that condition is met.", learningPrompt: "What event is being tested, and at which phase does the rule evaluate it?", scope: "Commit a delayed strike that resolves at the target's next turn start.", limits: "This prototype uses a scheduler event as its condition, not a continuous sensor; the warning gives opponents a response window.", abilities: ["tripThreshold", "criticalThreshold"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Even timing and force." }, longFuse: { name: "Long Fuse", proficiency: 1, potencyMul: 0.8, rangeAdd: 2, trade: "+2 route length for −20% potency." } } } },
    diffusion: { name: "Diffusion", color: "#81c7e8", mechanism: "A disturbance spreads from a concentrated source into neighboring space.", mathIdea: "Diffusion smooths spatial differences; in continuous models, flux points down the concentration gradient.", learningPrompt: "If concentration is higher on one side, which direction does passive diffusive flux point?", scope: "Radius attacks trade line precision for broad reach.", limits: "These arena attacks are area effects, not a numerical concentration simulation; barriers do not stop field delivery.", abilities: ["diffuseWave", "frontPropagation"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Even reach and intensity." }, denseFront: { name: "Dense Front", proficiency: 1, potencyMul: 1.2, radiusAdd: -1, trade: "+20% potency for −1 radius." }, broadFront: { name: "Broad Front", proficiency: 2, potencyMul: 0.75, radiusAdd: 1, trade: "+1 radius for −25% potency (proficiency 2)." } } } },
    pruning: { name: "Pruning", color: "#9ab56d", mechanism: "Name and remove one plant part or plant-tagged hazard so the remaining board changes.", mathIdea: "A local graph edit can change routes and conditions without rewriting the whole system.", learningPrompt: "Which tagged part was removed, and what property of the remaining board changed?", scope: "Clear one reachable hedge, shrub, thorn mat, or eligible tree hazard.", limits: "Invalid parts still spend the action and ΦF but change nothing. Character Life Force, paving, and pillars are never parts. Gardener cannot prune trees or TPZ; Barrier still blocks its tile.", knownNonInteractions: ["Paving has no plant part to prune.", "Pillars are hard structure, not plant material."], abilities: ["prune", "carefulPrune"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, rangeAdd: 0, trade: "Even reach and cultivation." }, carefulCut: { name: "Careful Cut", proficiency: 1, rangeAdd: -1, trade: "A close deliberate cut: −1 reach." }, longReach: { name: "Long Reach", proficiency: 2, rangeAdd: 1, trade: "+1 tile of reach (proficiency 2); still one part." } } } },
    focus: { name: "Focus", color: "#d3b66f", mechanism: "Attend to one target and deliberately drop other information from attention.", mathIdea: "Attention is a constrained information channel: precision improves when irrelevant signals are filtered, but switching attention has a cost.", learningPrompt: "What becomes easier to notice when attention is fixed on one target, and which other signal do you miss?", scope: "Mark one target; a Sightline shot can ignore one adjacent partial-cover source.", limits: "While Focus is your latest technique you cannot react to a different enemy. Focus marks one target only; it never enhances fields or extends route budget.", knownNonInteractions: ["Focus does not enhance field deliveries.", "Focus does not extend Alternate Pathway route budget."], abilities: ["focus", "deepFocus"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "One target and one cover observation." }, needle: { name: "Needle Attention", proficiency: 1, rangeAdd: 2, durationAdd: -1, trade: "+2 mark range; Deep Focus loses one owner turn." }, patient: { name: "Patient Attention", proficiency: 2, rangeAdd: -1, durationAdd: 1, trade: "+1 owner turn; −1 mark range (proficiency 2)." } } } },
    succession: { name: "Succession", color: "#85b66a", lexiconSlug: "succession", mechanism: "A planted patch changes in stages; disturbance returns it to an early stage.", mathIdea: "A state-transition system changes only when its conditions are met. Growth is path-dependent: time helps until disturbance resets the state.", learningPrompt: "Which event advanced this patch, and which disturbance returned it to an earlier stage?", scope: "Pioneer Patch matures from cover to resource to healing over rounds; Nurse Log anchors growth at a felled log or stump.", limits: "Growth is a compact battle abstraction, not a botanical forecast. Patches need open soil, can be disturbed, and do not mature while the battle is frozen.", abilities: ["pioneerPatch", "nurseLog", "oldGrowth"], questions: [{ id: "succession-state", prompt: "Which transition follows one undisturbed round?", choices: ["Stage 1 → 2", "Stage 3 → 1"], answer: 0, feedback: "The patch advances one stage per round until stage 3." }, { id: "succession-disturbance", prompt: "What does a disturbance do to an established patch?", choices: ["Resets its stage", "Creates a new patch"], answer: 0, feedback: "A disturbance resets non-protected growth to stage 1." }, { id: "succession-water", prompt: "How does the Swale composition affect a new patch?", choices: ["It gives a one-stage head start on wet ground", "It makes every patch permanent"], answer: 0, feedback: "The bonus applies only where a Rain Garden or Check Dam is already active." }], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "A patch needs time and can be reset by disturbance." }, patient: { name: "Patient Growth", proficiency: 1, durationAdd: 1, trade: "+1 turn before the patch expires; it still advances at the same rate." }, rapid: { name: "Rapid Establishment", proficiency: 2, growthStageAdd: 1, trade: "Begin one stage ahead (proficiency 2); effects remain temporary." } } } },
    section: { name: "Section / Projection", color: "#80b8da", mechanism: "A section reveals the vertical and what a plan hides; a projection carries a property along an axis.", mathIdea: "Projection maps a higher-dimensional object into a chosen view; the omitted dimensions constrain what can be inferred.", learningPrompt: "Which dimensions does this representation preserve, and which does it remove?", scope: "Cut a row or column to read exact terrain; copy a tile's height or surface along an axis; Plan View temporarily removes height from play.", limits: "A section cut reveals a narrow slice. Projection is temporary and follows only an unobstructed straight axis. Plan View removes height advantages for both sides.", abilities: ["sectionCut", "orthographicProjection", "planView"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "One clear cut, projection or field flattening." }, deepSection: { name: "Deep Section", proficiency: 1, rangeAdd: 1, trade: "+1 projection range; section line is unchanged." } } } },
    collage: { name: "Collage", color: "#d9a1c5", mechanism: "Cut useful fragments from different sources and compose them into a new whole.", mathIdea: "Composition is not commutative: juxtaposition changes the combined result, and provenance matters.", learningPrompt: "What property was removed, what did it become, and what changed when it was placed beside another fragment?", scope: "Clip a bounded property from terrain or an effect, then paste it for a short time; Photomontage combines witnessed techniques.", limits: "Fragments are weaker than their source, expire when pasted, and can be shaken loose by Resonance. Montage is limited to witnessed, non-ultimate damaging techniques.", abilities: ["clip", "juxtapose", "photomontage"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "One reusable fragment per action; pasted pieces last two turns." }, carefulPaste: { name: "Careful Paste", proficiency: 1, durationAdd: 1, trade: "+1 owner turn for pasted fragments; no extra fragments." } } } },
    settlement: { name: "Settlement", color: "#a0825a", lexiconSlug: "settlement", mechanism: "Found structures on open ground: walls that shelter, workshops that arm strikes, a keep that holds the line.", mathIdea: "A fixed investment pays a stream of returns while it stands; destruction ends the stream, so placement weighs value against exposure.", learningPrompt: "Which building pays while it stands, and what ends its stream of returns?", scope: "Raise Palisade, Foundry, and the Keep; two buildings stand per founder, and a third dismantles the oldest.", limits: "Buildings need open ground, count against a cap of two per founder, and fall to damage; their auras die with their walls. Settlement deals no damage itself.", abilities: ["raisePalisade", "raiseFoundry", "foundCity"], questions: [{ id: "settlement-cap", prompt: "What happens when a founder with two buildings raises a third?", choices: ["The oldest is dismantled", "The new one fails"], answer: 0, feedback: "Two buildings stand per founder; a third dismantles the oldest." }, { id: "settlement-cover", prompt: "Who does a Palisade shelter?", choices: ["Adjacent allies of its side", "Everyone on the map"], answer: 0, feedback: "Cover 0.5 reaches allies standing beside the Palisade." }, { id: "settlement-founding", prompt: "What does a Foundry give the line?", choices: ["Strikes +2 within 2 tiles", "An extra move"], answer: 0, feedback: "Allies within 2 of a friendly Foundry resolve Strikes +2." }], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Spec walls, spec costs." }, boomtown: { name: "Boomtown", proficiency: 1, buildingHpAdd: 4, costAdd: 1, trade: "+4 building HP; techniques cost +1 ΦF." } } } },
    gradingDrainage: { name: "Grading & Drainage", lexiconSlug: "grading-plan", color: "#bb9b70", mechanism: "Cut soil from high ground and place the same material into low ground; a changed elevation permanently changes routes and runoff.", mathIdea: "Cut-and-fill is a conservation problem: total soil stays constant while its spatial distribution changes. A drainage path follows the resulting gradient.", learningPrompt: "How many soil units left the cut, where were they placed, and which downhill route became available?", scope: "Excavate permanent channels, bank loose soil, fill low ground, or redistribute a small catchment into a terrace. Large earthworks draw Gaia's attention.", limits: "One terrain level is one abstract soil unit. Only open soil can be cut or filled; trees, structures, water and paving are excluded. The battle map is permanently regraded for this encounter, not an engineering survey.", abilities: ["cutSlope", "placeFill", "watershedTerrace"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, rangeAdd: 0, trade: "Short reach and measured earth movement." }, extendedReach: { name: "Extended Reach", proficiency: 1, rangeAdd: 1, trade: "+1 tile of cut/fill reach." }, precise: { name: "Contour Precision", proficiency: 2, terraceRadius: 1, trade: "Terrace uses the local plus-shaped catchment (proficiency 2)." } } } },
  };

  // ── abilities (spec §5 fields) ────────────────────────────────────────────
  concepts.legitimacy = { name: "Legitimacy", color: "#d8dff0", mechanism: "Grants bounded permissions through a recognized office.", mathIdea: "A claim creates authority only when others can recognize it and the claim remains valid.", learningPrompt: "Who recognizes the office, and what would make its claim fail?", abilities: [], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Authority within a visible radius." }, widerMandate: { name: "Wider Mandate", proficiency: 1, rangeAdd: 1, trade: "+1 signal range for Executive Direction." } } } };
  concepts.strategic_commitment = { name: "Strategic Commitment", color: "#9bb4d7", mechanism: "Give up an option to make a stated objective credible.", mathIdea: "A commitment changes the future choice set; credibility depends on a real opportunity cost.", learningPrompt: "Which option was surrendered, and can the objective be measured?", abilities: [], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "A public objective and a real surrendered option." }, longPromise: { name: "Long Promise", proficiency: 1, rangeAdd: 2, trade: "+2 range when naming a tile or opponent for Public Promise." } } } };
  concepts.cipher = { name: "Cipher", color: "#a9bce8", mechanism: "Reduce a foe's options to what is written: mark what is hidden, seal what is read.", mathIdea: "Information asymmetry changes options: a revealed stat lets the reader plan against the true state.", learningPrompt: "What hidden number changed your plan once it was written down?", scope: "Mark one target and reveal hidden stats; seal one damage channel; mass-reveal a radius.", limits: "Marks expire at your next turn start; seals expire at the victim's next turn start; single-technique seals are not implemented.", abilities: ["annotate", "redact", "plaintext"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "One mark, one seal." }, finePrint: { name: "Fine Print", proficiency: 1, rangeAdd: 1, trade: "+1 mark range." } } } };
  concepts.thorn = { name: "Thorn", color: "#7fae5a", mechanism: "Grow deterrence: every approach pays.", mathIdea: "Entry tolls change routes: a barrier that charges rent instead of refusing passage.", learningPrompt: "What did entering that tile cost, and which route avoided it?", scope: "Seed thorn tiles on hits; ring tiles in briers; overgrow a radius that entangles.", limits: "Six live thorn tiles per grower; the oldest withers first. Thorns wound enemies only; flyers pass over.", abilities: ["lash", "brierRing", "overgrowth"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Even sting and growth." }, deepRoots: { name: "Deep Roots", proficiency: 1, durationAdd: 1, trade: "+1 owner turn of thorn duration." } } } };
  concepts.conjunction = { name: "Conjunction", color: "#9fb8ff", mechanism: "Chart the sky; patterns resolve.", mathIdea: "Combinatorics: placed marks gain value in patterns, not alone.", learningPrompt: "Which pattern paid, and which single star did nothing?", scope: "Chart stars that ping each turn; fall them as bursts; complete the chart at once.", limits: "Three live stars per chart-keeper; the oldest fades first. Starfall needs a clear line to its star.", abilities: ["chartStar", "starfall", "grandConjunction"], lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Even chart and fall." }, farChart: { name: "Far Chart", proficiency: 1, rangeAdd: 1, trade: "+1 chart range." } } } };
  conceptDamageTypes.legitimacy = "albedo"; conceptDamageTypes.strategic_commitment = "citrinitas";

  // delivery: line (needs sight; crosses tiles) · placed (tile in range + sight) ·
  //           routed (path over open ground within a length budget) · field (shape around self) · self
  // target:   enemy | tile | self | ally
  // area:     single | radius (Manhattan, around self or around target tile) | plus (target tile + 4 neighbours)
  const abilities = {
    cutSlope: { name: "Cut Slope", tier: "basic", concepts: ["gradingDrainage"], delivery: "placed", target: "tile", mechanism: "Excavate one open-soil level permanently. One abstract soil unit enters your earth stock; enough total excavation wakes Gaia.", cost: 4, range: 3, tempoCost: 30, potency: 0, effect: "gradeCut", reveal: "Cut Slope lowers one soil tile by one level and banks exactly one soil unit. Cut soil is not destroyed.", prompt: "What conserved amount increased in your stock when the contour dropped?" },
    placeFill: { name: "Place Fill", tier: "refined", concepts: ["gradingDrainage"], delivery: "placed", target: "tile", mechanism: "Place one banked soil unit on open ground, raising its permanent elevation by one level.", cost: 5, range: 3, tempoCost: 35, potency: 0, effect: "gradeFill", reveal: "Place Fill consumes one banked soil unit and raises one open soil tile by one level; a tile cannot exceed height 3.", prompt: "How does the height of this destination compare with its new soil stock?" },
    watershedTerrace: { name: "Watershed Terrace", movesWater: true, tier: "ultimate", concepts: ["gradingDrainage"], delivery: "placed", target: "tile", area: { shape: "plus" }, mechanism: "Regrade a small catchment into a level terrace, conserving the total soil volume while redistributing it permanently.", cost: 18, range: 4, tempoCost: 50, potency: 0, effect: "gradeTerrace", reveal: "Watershed Terrace redistributes soil across eligible tiles in a plus-shaped catchment. Total terrain levels stay constant; the resulting contour persists for this battle.", announce: "I will regrade the marked catchment. Gaia hears large cuts." , prompt: "What stayed invariant while the local height differences decreased?" },
    raisePalisade: { name: "Raise Palisade", tier: "basic", concepts: ["settlement"], delivery: "placed", target: "tile", mechanism: "Raise a palisade wall (12 HP) on open ground. Adjacent allies of your side take half damage. Two buildings per founder; a third dismantles the oldest.", cost: 4, range: 3, potency: 0, effect: "raisePalisade", reveal: "The Palisade blocks movement and shelters adjacent allies (damage ×0.5). Lines stop at it and damage it.", prompt: "Which allies does the new wall shelter?" },
    raiseFoundry: { name: "Foundry", tier: "refined", concepts: ["settlement"], delivery: "placed", target: "tile", mechanism: "Found a workshop (15 HP) on open ground. Allies within 2 resolve Strikes +2. Two buildings per founder; a third dismantles the oldest.", cost: 6, range: 3, potency: 0, effect: "raiseFoundry", reveal: "The Foundry arms the line: friendly Strikes within 2 resolve +2. Lines stop at it and damage it.", prompt: "Whose strikes does the workshop arm?" },
    foundCity: { name: "Found the City", tier: "ultimate", concepts: ["settlement"], delivery: "placed", target: "tile", mechanism: "Found the Keep (30 HP) on open ground: adjacent allies take half damage, resolve Strikes +2, and heal 4 at their turn starts.", cost: 15, range: 3, potency: 0, effect: "foundCity", reveal: "The Keep holds the line: cover, armed strikes, and slow healing for adjacent allies. It counts against the two-building cap.", announce: "Here we stay.", prompt: "What three streams does the Keep pay while it stands?" },
    deployAegisPylons: { name: "Deploy Aegis Pylons", tier: "basic", concepts: ["settlement"], pairOnly: true, pairs: [["settlement", "sightline"]], delivery: "placed", target: "tile", mechanism: "Drop perimeter pylons (12 HP, alloy) on open ground. Adjacent allies of your side take half damage. Two buildings per founder; a third dismantles the oldest.", cost: 4, range: 3, potency: 0, effect: "raisePalisade", reveal: "The Pylons block movement and shelter adjacent allies (damage ×0.5). Lines stop at them and damage them.", prompt: "Which allies does the new perimeter shelter?" },
    printFabricator: { name: "Print Fabricator", tier: "refined", concepts: ["settlement"], pairOnly: true, pairs: [["settlement", "sightline"]], delivery: "placed", target: "tile", mechanism: "Print a nano-fabricator (15 HP, alloy) on open ground. Allies within 2 resolve Strikes +2. Two buildings per founder; a third dismantles the oldest.", cost: 6, range: 3, potency: 0, effect: "raiseFoundry", reveal: "The Fabricator arms the line: friendly Strikes within 2 resolve +2. Lines stop at it and damage it.", prompt: "Whose strikes does the fabricator arm?" },
    blasterShot: { name: "Blaster Shot", tier: "basic", concepts: ["sightline"], pairOnly: true, pairs: [["settlement", "sightline"]], delivery: "line", target: "enemy", area: { shape: "single" }, mechanism: "Send a precise bolt only along a clear, straight view.", cost: 3, range: 5, potency: 9, effect: "damage", reveal: "Blaster Shot needs an unobstructed line; hard terrain such as a pillar blocks it.", prompt: "What does a clear view require along the whole line?" },
    spiralOrb: { name: "Spiral Orb", tier: "refined", concepts: ["sightline"], pairOnly: true, pairs: [["settlement", "sightline"]], delivery: "line", target: "enemy", area: { shape: "single" }, mechanism: "Hurl a heavy spiralling orb that keeps its shape down a clear line.", cost: 6, range: 5, potency: 14, effect: "damage", reveal: "Spiral Orb hits one target down a clear line for heavy potency; cover and barriers still apply.", prompt: "Why does a refined line hit harder without reaching further?" },
    orbitalDrop: { name: "Orbital Drop", tier: "ultimate", concepts: ["settlement", "sightline"], merge: true, pairOnly: true, pairs: [["settlement", "sightline"]], delivery: "line", target: "tile", area: { shape: "line" }, mechanism: "Burn a line (14 potency) and land the Citadel (30 HP, alloy) on the line's open end tile: adjacent allies take half damage, resolve Strikes +2, and heal 4 at their turn starts. It counts against the two-building cap.", cost: 15, range: 5, potency: 14, damageType: "albedo", effect: "orbitalDrop", reveal: "Orbital Drop burns everything on one straight line, then the Citadel lands on the open end tile and holds the line. The landing needs open ground in sight.", announce: "Citadel incoming. Clear the line.", prompt: "What must be true of the end tile for the Citadel to land?" },
    pioneerPatch: { name: "Pioneer Patch", tier: "basic", concepts: ["succession"], delivery: "placed", target: "tile", mechanism: "Establish a small patch on open soil. It matures once per round: cover, then a resource, then healing.", cost: 4, range: 3, potency: 0, effect: "successionPatch", duration: 4, reveal: "Pioneer Patch advances one stage at each round boundary. Damage or pruning on its tile resets it to stage 1.", prompt: "Which state change does the next undisturbed round produce?" },
    nurseLog: { name: "Nurse Log", tier: "refined", concepts: ["succession"], delivery: "placed", target: "tile", mechanism: "Anchor a patch at a felled log or stump; the woody remnant protects its first stage from disturbance.", cost: 5, range: 3, potency: 0, effect: "nurseLog", duration: 4, reveal: "Nurse Log on a log or stump starts at stage 1 and ignores the first disturbance reset; on open soil it nurses weakly (no absorb, lasts 6 rounds). Finished patches leave stumps behind.", prompt: "What substrate does a nurse log provide in this simplified model?" },
    oldGrowth: { name: "Old Growth", tier: "ultimate", concepts: ["succession"], delivery: "self", target: "self", area: { shape: "single" }, mechanism: "Bring every patch you own to its climax stage for the rest of this battle.", cost: 18, range: 0, potency: 0, effect: "oldGrowth", duration: 99, reveal: "Old Growth moves every owned patch to stage 3 and makes it permanent for this battle. It cannot restore patches that were destroyed.", prompt: "Does a climax-stage patch still advance, or has it reached its terminal state?" },

    earthBerm: {
      name: "Earth Berm", tier: "basic", concepts: ["berm"], delivery: "placed", target: "tile",
      mechanism: "Raise a compact berm on an open tile. It blocks movement, routed paths, and sight until it expires.",
      cost: 4, range: 3, potency: 0, effect: "berm", duration: 2,
      reveal: "Earth Berm raises a passable tile by one level for 2 owner turns. It affects movement and line range; a direct line to an adjacent target beyond it deals half damage. It does not block routes or sight.",
      prompt: "Which part of the board does this berm actually close?",
    },
    architectDesignWall: { name: "Live Draft: Raise / Lower", tier: "refined", concepts: ["berm", "boundary"], delivery: "placed", target: "tile", area: { shape: "line", length: 4 }, mechanism: "Draw a straight defensive screen up to four clear tiles long, or aim at your own screen to lower one segment instantly (10 AP, 0 ΦF). The screen is permanent for this battle and blocks movement, routes and sight.", cost: 5, range: 4, potency: 0, tempoCost: 35, effect: "architectDesign", reveal: "The Architect sketches a line, then builds it in place. Aim the Wall at your own screen to erase one segment and reopen that space; blockers and occupied tiles invalidate a raise.", prompt: "Which routes does this cut separate, and where can an opponent go around its ends?" },
    clearShot: {
      name: "Clear Shot", tier: "basic", concepts: ["sightline"], delivery: "line", target: "enemy",
      area: { shape: "single" }, mechanism: "Send a precise strike only along a clear, straight view.",
      cost: 3, range: 5, potency: 9, effect: "damage",
      reveal: "Clear Shot needs an unobstructed line; hard terrain such as a pillar blocks it, while a Berm reduces damage by 50%.",
      prompt: "How does a partial-cover tile change damage along a direct line?",
    },
    bioswale: {
      name: "Bioswale", tier: "refined", concepts: ["swale"], delivery: "placed", target: "tile",
      mechanism: "Shape a shallow basin on open ground. The first line delivery crossing it is absorbed, then the basin is spent.",
      cost: 5, range: 3, potency: 0, effect: "swale", duration: 3,
      reveal: "Bioswale protects only a line crossing its tile, absorbs one delivery, then vanishes; it does not block movement or routed attacks.",
      prompt: "Which delivery can this small basin intercept?",
    },
    anchor: {
      name: "Anchor", tier: "basic", concepts: ["inertia"], delivery: "self", target: "self",
      mechanism: "Brace your position so the next forced shove cannot move you.",
      cost: 4, range: 0, potency: 0, effect: "anchor", duration: 1,
      reveal: "Anchor cancels one forced displacement of its user; it does not reduce LF damage or prevent voluntary movement.",
      prompt: "What does inertia resist here: the impact, or the change in position?",
    },
    shieldWall: {
      name: "Shield Wall", tier: "basic", concepts: ["barrier"], delivery: "placed", target: "tile",
      mechanism: "Raise a barrier on a floor tile (or ward yourself with a Fortress lens).",
      cost: 4, range: "lens", potency: 0, effect: "barrier", duration: "lens", protection: "lens", reactive: true,
      reveal: "Shield Wall stops line deliveries crossing its tile; routed deliveries can still go around it.",
      prompt: "Which enemy delivery will a barrier on the gap actually stop?",
    },
    rebound: {
      name: "Rebound", tier: "refined", concepts: ["barrier"], delivery: "self", target: "self",
      mechanism: "Arm a parry: the next line or contact hit on you is caught and pushed back.",
      cost: 5, range: 0, potency: 0, effect: "parry", parry: { catches: ["line", "contact"], reflectFraction: 0.5 }, reactive: true,
      expiry: "ownerNextTurnStart",
      reveal: "Rebound catches line and contact hits only. A routed delivery arrives from a side it isn't braced for.",
      prompt: "Why does a parry fail against a routed attack?",
    },
    bastionCollapse: {
      name: "Bastion Collapse", tier: "ultimate", concepts: ["barrier"], delivery: "field", target: "self",
      area: { shape: "radius", radius: 3 },
      mechanism: "Fold every boundary within 3 tiles inward onto whoever stands inside: the more walls, wards and barriers around you, the harder it lands.",
      // Mala and Muse, 2026-10-15 (loop 1a140778077): base 8 + 6 for each boundary within 3, at most 5 counted (38).
      // Barriers and wards in reach are consumed; walls (solid terrain and objects) count and stay; inside a Dream Space
      // the edge within reach lends itself without breaking and the dream grows a step (engine/resolve.js bastionFold).
      cost: 18, range: 0, potency: 8, effect: "damage", fold: { base: 8, per: 6, cap: 5 },
      reveal: "Bastion Collapse hits every opponent within 3 tiles (Manhattan) of you, 8 plus 6 for each boundary it folds (up to 5).",
      announce: "Every opponent within 3 tiles of me will be crushed when this resolves.",
    },
    // The Cyborg form's techniques (docs/brain-chip.md). On no concept's list: they reach a fighter only through
    // form.techniques while the Brain Chip's form is up. Authored on Barrier, the Warden's own primary.
    droneLance: {
      name: "Drone Lance", tier: "basic", concepts: ["barrier"], delivery: "line", target: "enemy", formOnly: "cyborg",
      area: { shape: "single" }, mechanism: "Send a drone down a clear straight line of six tiles.",
      cost: 5, range: 6, potency: 18, damageType: "albedo", effect: "damage",   // learned forms rescale (2026-10-17): 4/4/10 citrinitas → 5/6/18 albedo
      reveal: "Drone Lance needs a clear straight line: a barrier or full cover on it stops the drone.",
      prompt: "What on the line between you stops a drone that cannot turn?",
    },
    hexScreen: {
      name: "Hex Screen", tier: "refined", concepts: ["barrier"], delivery: "self", target: "self", formOnly: "cyborg",
      mechanism: "Raise a hex lattice over yourself and allies within 1 tile: a 30-point ward until your next turn.",
      cost: 6, range: 0, potency: 0, effect: "hexScreen", protection: 30, radius: 1,   // 12 → 30 (2026-10-17)
      expiry: "ownerNextTurnStart",
      reveal: "Hex Screen is 30 points and no more: a second cast replaces the ward, it never adds to it.",
      prompt: "Why spend a hit on a 30-point ward before the real attack?",
    },
    droneSwarm: {
      name: "Drone Swarm", tier: "ultimate", concepts: ["barrier"], delivery: "field", target: "self", formOnly: "cyborg",
      area: { shape: "radius", radius: 4 },
      mechanism: "Loose every drone at once on whoever is still within 4 tiles when it resolves.",
      cost: 16, range: 0, potency: 100, damageType: "citrinitas", effect: "damage", flatAnnounce: true,
      reveal: "Drone Swarm hits every opponent within 4 tiles (Manhattan) of you. Leave the radius or Guard.",
      announce: "Every opponent within 4 tiles of me is gone when the swarm lands. Leave, or brace.",
    },
    // Learned forms (Mala, 2026-10-17; docs/learned-forms.md). formOnly: on no concept's list, reached only through a held
    // or vowed form's form.techniques. formRider: extra effects on each target hit (bosses.js formRider).
    emberBreath: { name: "Ember Breath", tier: "basic", concepts: ["diffusion"], delivery: "line", target: "enemy", formOnly: "dragon_blooded",
      area: { shape: "line", length: 4 }, cost: 5, range: 4, potency: 20, damageType: "citrinitas", effect: "damage", formRider: { scorch: 3, ignite: true },
      mechanism: "Breathe fire down a line of four tiles.", reveal: "Ember Breath sweeps a straight line of four: step off it.", prompt: "Which tiles does a line of fire never reach?" },
    takeWing: { name: "Take Wing", tier: "refined", concepts: ["boundary"], delivery: "line", target: "enemy", formOnly: "dragon_blooded",
      area: { shape: "single" }, cost: 6, range: 5, potency: 24, damageType: "nigredo", effect: "damage", formRider: { leap: true }, directHit: true,
      mechanism: "Take to the air and dive on a foe up to five tiles away, landing beside them.", reveal: "The dive needs a clear line to its mark; it lands you next to them.", prompt: "What does diving in leave you standing beside?" },
    infernoRoar: { name: "Inferno Roar", tier: "ultimate", concepts: ["diffusion"], delivery: "field", target: "self", formOnly: "dragon_blooded",
      area: { shape: "radius", radius: 3 }, cost: 16, range: 0, potency: 100, damageType: "citrinitas", effect: "damage", flatAnnounce: true, formRider: { igniteRadius: 4 },
      mechanism: "Roar fire over everything within three tiles; every fuel tile within four catches.", reveal: "Inferno Roar hits every opponent within 3 tiles of you. Leave the radius or Guard.",
      announce: "Everything here is mine." },
    kitsuneFoxfire: { name: "Kitsune Foxfire", tier: "basic", concepts: ["deception"], delivery: "line", target: "enemy", formOnly: "oni_blooded",
      area: { shape: "single" }, cost: 5, range: 6, potency: 18, damageType: "albedo", effect: "damage",
      mechanism: "Ghost-lights that seem to come from somewhere else.", reveal: "Foxfire is a single straight line: a barrier stops it.", prompt: "Where did the light really come from?" },
    maskSwap: { name: "Mask Swap", tier: "refined", concepts: ["deception"], delivery: "signal", target: "enemy", formOnly: "oni_blooded",
      area: { shape: "single" }, cost: 6, range: 5, potency: 8, damageType: "albedo", effect: "damage", formRider: { swap: true, apLoss: 15 },
      mechanism: "Trade places with a foe within five; the swap leaves them reeling (15 AP down).", reveal: "Mask Swap moves you to where they stood.", prompt: "Where do you end up when you swap?" },
    nightParade: { name: "Parade of Masks", tier: "ultimate", concepts: ["deception"], delivery: "line", target: "enemy", formOnly: "oni_blooded",
      area: { shape: "line", length: 7 }, cost: 16, range: 7, potency: 100, damageType: "albedo", effect: "damage", flatAnnounce: true,
      mechanism: "Masked spirits march a line of seven.", reveal: "The parade marches a straight line of 7: step off it or Guard.", announce: "Which of us is real?" },
    leapingStrike: { name: "Leaping Strike", tier: "basic", concepts: ["elasticity"], delivery: "line", target: "enemy", formOnly: "chitin_knight",
      area: { shape: "single" }, cost: 5, range: 3, potency: 20, damageType: "nigredo", effect: "damage", knockback: 1, formRider: { leap: true },
      mechanism: "Jump up to three tiles onto a foe and crash down, throwing them back a tile; you land beside them.", reveal: "Leaping Strike needs a clear line to a foe within 3, and lands you next to them.", prompt: "Where does the knight land?" },
    chitinDrone: { name: "Chitin Drone", tier: "refined", concepts: ["resonance"], delivery: "field", target: "self", formOnly: "chitin_knight",
      area: { shape: "radius", radius: 3 }, cost: 6, range: 0, potency: 14, damageType: "rubedo", effect: "damage", formRider: { apLoss: 15 },
      mechanism: "Wings beat at one frequency: everyone within three is shaken off their timing (15 AP down).", reveal: "Chitin Drone hits everyone within 3 of you.", prompt: "How far does the drone carry?" },
    broodBreach: { name: "Brood Tide", tier: "ultimate", concepts: ["diffusion"], delivery: "line", target: "enemy", formOnly: "chitin_knight",
      area: { shape: "line", length: 6 }, cost: 16, range: 6, potency: 100, damageType: "citrinitas", effect: "damage", flatAnnounce: true,
      mechanism: "The swarm pours down a line of six.", reveal: "Brood Tide runs a straight line of 6: step off it or Guard.", announce: "The ground is moving." },
    voidGlance: { name: "Void Glance", tier: "basic", concepts: ["deception"], delivery: "line", target: "enemy", formOnly: "faceless",
      area: { shape: "single" }, cost: 4, range: 4, potency: 10, damageType: "albedo", effect: "damage", formRider: { dread: true, fear: true },
      mechanism: "One look from an empty face: the target faces fear and carries dread.", reveal: "Void Glance needs a straight line to its target.", prompt: "What does the look cost them next turn?" },
    hollowMandate: { name: "Hollow Mandate", tier: "refined", concepts: ["threshold"], delivery: "routed", target: "enemy", formOnly: "faceless",
      area: { shape: "single" }, cost: 6, range: 6, routeBudget: 6, potency: 20, damageType: "albedo", effect: "damage", formRider: { dread: true },
      mechanism: "An order from nowhere, routed around cover.", reveal: "Hollow Mandate routes within 6 tiles of path.", prompt: "What path did the mandate take?" },
    voidFace: { name: "Beholden", tier: "ultimate", concepts: ["deception"], delivery: "field", target: "self", formOnly: "faceless",
      area: { shape: "radius", radius: 3 }, cost: 16, range: 0, potency: 100, damageType: "nigredo", effect: "damage", flatAnnounce: true, formRider: { fear: true },
      mechanism: "Show them what is behind the face.", reveal: "Beholden hits everyone within 3 of you, and survivors face fear.", announce: "Look at me." },
    watershed: { name: "Watershed", movesWater: true, tier: "refined", concepts: ["succession"], delivery: "field", target: "self", formOnly: "one_with_nature",
      area: { shape: "radius", radius: 2 }, cost: 6, range: 0, potency: 12, damageType: "rubedo", effect: "damage", formRider: { root: true },
      mechanism: "Call the water up through the roots: everyone within two is soaked and rooted for a turn.", reveal: "Watershed reaches 2 tiles around you.", prompt: "Who can still move after the water rises?" },
    gaiasAccord: { name: "Gaia's Accord", tier: "ultimate", concepts: ["succession"], delivery: "field", target: "self", formOnly: "one_with_nature",
      area: { shape: "radius", radius: 3 }, cost: 16, range: 0, potency: 100, damageType: "rubedo", effect: "damage", flatAnnounce: true, formRider: { healAllies: 20 },
      mechanism: "The land breathes out: foes within three are struck, allies within three mend.", reveal: "Gaia's Accord hits every opponent within 3 and heals allies in it.", announce: "Breathe with the land." },
    wholeness: { name: "Wholeness", tier: "ultimate", concepts: ["preservation"], delivery: "field", target: "self", formOnly: "integrated_self",
      area: { shape: "radius", radius: 2 }, cost: 16, range: 0, potency: 100, damageType: "albedo", effect: "damage", flatAnnounce: true, formRider: { healAllies: 30, healRadius: 2 },
      mechanism: "The gold opens: foes within two are struck, allies within two mend 30.", reveal: "Wholeness hits every opponent within 2 of you and heals allies in it.", announce: "There's nothing left in me to use." },
    // Ledger-Sworn (the Tallyman's orb, 2026-10-20): the creditor's habits as form techniques.
    shortChange: { name: "Short Change", tier: "basic", concepts: ["extraction"], delivery: "line", target: "enemy", formOnly: "ledger_sworn",
      area: { shape: "single" }, cost: 4, range: 5, potency: 12, damageType: "citrinitas", effect: "damage", formRider: { apLoss: 10 },
      mechanism: "A tap of the tally stick and a debt on the books: they start their next turn 10 AP short.", reveal: "Short Change is a single straight line.", prompt: "What does owing cost you next turn?" },
    repossession: { name: "Repossession", tier: "refined", concepts: ["leverage"], delivery: "signal", target: "enemy", formOnly: "ledger_sworn",
      area: { shape: "single" }, cost: 6, range: 5, potency: 10, damageType: "citrinitas", effect: "damage", formRider: { stealUlt: 25 },
      mechanism: "The account is called in: up to 25 of their ultimate charge becomes yours.", reveal: "Repossession reaches 5 tiles by signal.", prompt: "Whose charge was it, really?" },
    allAccountsDue: { name: "All Accounts Due", tier: "ultimate", concepts: ["reciprocal_obligation"], delivery: "field", target: "self", formOnly: "ledger_sworn",
      area: { shape: "radius", radius: 3 }, cost: 16, range: 0, potency: 60, damageType: "citrinitas", effect: "damage", flatAnnounce: true, formRider: { apLoss: 20 },
      mechanism: "Everyone within three is collected on: hit, and 20 AP owed on their next turn.", reveal: "All Accounts Due hits every opponent within 3 of you.", announce: "All accounts... due." },
    sealedNamed: { name: "Named Round", tier: "basic", concepts: ["periodicity"], delivery: "self", target: "self", formOnly: "appointment_sworn",
      area: { shape: "single" }, cost: 4, range: 0, potency: 0, damageType: "nigredo", effect: "guard",
      mechanism: "Name the next published round. Naming it spends the action and does not move the table.", reveal: "The name matches the table.", prompt: "Which round was already printed?" },
    sealedShare: { name: "Region Share", tier: "refined", concepts: ["swale"], delivery: "field", target: "enemy", formOnly: "appointment_sworn",
      area: { shape: "single" }, cost: 6, range: 4, potency: 10, damageType: "rubedo", effect: "damage", formRider: { knockback: 1 },
      mechanism: "One region, one pull: they slide one tile along the published line.", reveal: "Region Share reaches 4 tiles.", prompt: "Which region's share was this?" },
    sealedStanding: { name: "Standing Table", tier: "ultimate", concepts: ["periodicity"], delivery: "field", target: "self", formOnly: "appointment_sworn",
      area: { shape: "radius", radius: 3 }, cost: 16, range: 0, potency: 50, damageType: "rubedo", effect: "damage", flatAnnounce: true,
      mechanism: "The next printed rounds stay put: foes within three are struck, and the table does not move.", reveal: "Standing Table hits every opponent within 3.", announce: "The round stays where it was set." },
    acquisition: { name: "Acquisition", tier: "basic", concepts: ["dependency"], delivery: "line", target: "enemy", formOnly: "founder_mode",
      area: { shape: "single" }, cost: 5, range: 5, potency: 16, damageType: "citrinitas", effect: "damage", formRider: { acquire: true },
      mechanism: "Buy the ground out from under them; an enemy summon or companion it hits works for you for 2 turns.", reveal: "Acquisition is a single straight line.", prompt: "What did it cost them?" },
    vendorLock: { name: "Vendor Lock", tier: "refined", concepts: ["dependency"], delivery: "signal", target: "enemy", formOnly: "founder_mode",
      area: { shape: "single" }, cost: 6, range: 5, potency: 10, damageType: "citrinitas", effect: "damage", formRider: { drainPf: 6, gainPf: 3 },
      mechanism: "Make them depend on you: they lose 6 ΦF and you take 3.", reveal: "Vendor Lock reaches 5 tiles by signal.", prompt: "Who pays for the platform?" },
    hostileTakeover: { name: "Hostile Takeover", tier: "ultimate", concepts: ["adjacency"], delivery: "field", target: "self", formOnly: "founder_mode",
      area: { shape: "radius", radius: 3 }, cost: 16, range: 0, potency: 100, damageType: "citrinitas", effect: "damage", flatAnnounce: true, formRider: { stealUlt: 50 },
      mechanism: "Everything within three changes hands: they're hit, and their ultimate charge becomes yours.", reveal: "Hostile Takeover hits every opponent within 3 of you.", announce: "Everything here has a price." },
    snapShot: {
      name: "Snap Shot", tier: "basic", concepts: ["elasticity"], delivery: "line", target: "enemy",
      area: { shape: "single" },
      mechanism: "Release stored tension as a single straight projectile.",
      cost: 3, range: 5, potency: 12, effect: "damage",
      reveal: "Snap Shot travels in a straight line: anything that stops a line stops it.",
      prompt: "Snap Shot is single-target and line-delivered. What does each of those limit?",
    },
    reelingShot: {
      name: "Reeling Shot", tier: "basic", concepts: ["elasticity"], delivery: "line", target: "enemy",
      area: { shape: "single" }, mechanism: "Release a tensioned line that catches and draws one target a step closer.",
      cost: 4, range: 4, potency: 7, effect: "damage", pull: 1,
      reveal: "Reeling Shot deals 7 potency and pulls its target one tile toward you; an adjacent target stays in place.",
      prompt: "How does the line transfer tension from the source to the target?",
    },
    shockwave: {
      name: "Shockwave", tier: "refined", concepts: ["elasticity"], delivery: "field", target: "self",
      area: { shape: "radius", radius: 2 },
      mechanism: "Let the whole body snap back, sending a pressure ring out in every direction.",
      cost: 7, range: 0, potency: 10, effect: "damage", knockback: 1,
      reveal: "Shockwave hits everyone within 2 tiles of you and shoves them 1 tile away. It is not a line, so barriers don't stop it.",
      prompt: "Why does a membrane that filters projectiles amplify a pressure wave?",
    },
    recoilCascade: {
      name: "Recoil Cascade", tier: "ultimate", concepts: ["elasticity"], delivery: "line", target: "tile", pierce: true,
      area: { shape: "line" },
      mechanism: "Draw to the limit and release through every body in one straight line.",
      cost: 18, range: 7, potency: 24, effect: "damage",
      reveal: "Recoil Cascade pierces everything along one straight line up to 7 tiles.",
      announce: "Everything on this line will be hit when the cascade releases.",
    },
    filterBolt: {
      name: "Filter Bolt", tier: "basic", concepts: ["selectivity"], delivery: "line", target: "enemy",
      area: { shape: "single" },
      mechanism: "A bolt that only engages one chosen element of the target's defence.",
      cost: 3, range: 5, potency: 8, effect: "damage",
      reveal: "Filter Bolt is a line delivery that slips a parry's catch, breaking the parry.",
    },
    membrane: {
      name: "Membrane", tier: "refined", concepts: ["selectivity"], delivery: "placed", target: "ally",
      mechanism: "Wrap an ally in a membrane that filters out projectiles.",
      cost: 5, range: 3, potency: 0, effect: "membrane", expiry: "ownerNextTurnStart", reactive: true,
      reveal: "Membrane blocks line deliveries on the wrapped ally, but it carries pressure waves inward.",
    },
    sieveVerdict: {
      name: "Sieve Verdict", tier: "ultimate", concepts: ["selectivity"], delivery: "line", target: "enemy",
      area: { shape: "single" }, cost: 18, range: 5, potency: 20, effect: "damage",
      mechanism: "Pass judgement on one target. (Authored; not used by the demo AI.)",
      reveal: "A heavy single-target line delivery.", announce: "This target will be judged.",
    },
    detour: {
      name: "Detour", tier: "basic", concepts: ["pathway"], delivery: "routed", target: "enemy",
      area: { shape: "single" }, routeBudget: 7,
      mechanism: "Send the strike along the shortest open route instead of the straight one.",
      cost: 3, range: 0, potency: 9, effect: "damage",
      reveal: "Detour follows open floor up to its route length; it needs a route, not a sight line.",
    },
    convergingRoutes: {
      name: "Converging Routes", tier: "refined", concepts: ["pathway"], delivery: "routed", target: "enemy",
      area: { shape: "plus" }, routeBudget: 8, timing: "delayed", trigger: "targetTurnStart",
      mechanism: "Set several routes converging on a spot; they arrive at the start of the target's next turn.",
      cost: 6, range: 0, potency: 11, effect: "damage",
      reveal: "Converging Routes is committed now and lands on the marked tiles at the start of your next turn. Guard lasts long enough to soften it.",
    },
    manyPaths: {
      name: "Many Paths", tier: "ultimate", concepts: ["pathway"], delivery: "routed", target: "enemy",
      area: { shape: "plus" }, routeBudget: 9,
      mechanism: "Every open route to the target arrives at once.",
      cost: 15, range: 0, potency: 16, effect: "damage",
      reveal: "Many Paths hits the target tile and its four neighbours by every open route.",
      announce: "Every route converges on the marked tiles. Move off them or brace.",
    },
    resonantPulse: { name: "Resonant Pulse", tier: "basic", concepts: ["resonance"], delivery: "field", target: "self", area: { shape: "radius", radius: 1 }, mechanism: "Send a compact vibration through nearby tiles, displace bodies, and briefly disrupt their timing.", cost: 4, range: 0, potency: 8, effect: "damage", knockback: 1, stunTempo: 10, reveal: "Resonant Pulse reaches every opponent within 1 tile, shoves each one tile away, and removes 10 action points from their next turn." },
    harmonicRupture: { name: "Harmonic Rupture", tier: "ultimate", concepts: ["resonance"], delivery: "field", target: "self", area: { shape: "radius", radius: 3 }, mechanism: "A tuned wave ruptures across the arena, briefly disrupting the timing of those it hits.", cost: 16, range: 0, potency: 22, effect: "damage", stunTempo: 25, reveal: "Harmonic Rupture strikes every opponent within 3 tiles and removes 25 action points from their next turn.", announce: "A harmonic rupture will strike everything within 3 tiles of me and disrupt their next turn." },
    adaptiveBrace: { name: "Adaptive Brace", tier: "basic", concepts: ["adaptation"], delivery: "self", target: "self", mechanism: "After observing an incoming attack, attune resistance to its harm channel until your next turn starts.", cost: 4, range: 0, potency: 0, effect: "guard", duration: 1, reveal: "Adaptive Brace halves matching alchemical harm-channel damage until your next turn start; other channels are unaffected." },
    livingResponse: { name: "Living Response", tier: "ultimate", concepts: ["adaptation"], delivery: "field", target: "self", area: { shape: "radius", radius: 2 }, mechanism: "Turn the opponent's pressure into a response across the surrounding space.", cost: 16, range: 0, potency: 18, effect: "damage", knockback: 1, reveal: "Living Response strikes and shoves opponents within 2 tiles.", announce: "I will answer every opponent within 2 tiles with a forceful response." },
    boundaryLine: { name: "Boundary Line", tier: "basic", concepts: ["boundary"], delivery: "placed", target: "tile", mechanism: "Raise a temporary barrier on an open tile.", cost: 4, range: 3, potency: 0, effect: "barrier", duration: 2, protection: 12, reveal: "Boundary Line blocks movement and opposing line deliveries at its tile for 2 owner turns." },
    closedDomain: { name: "Closed Domain", tier: "ultimate", concepts: ["boundary"], delivery: "field", target: "self", area: { shape: "radius", radius: 2 }, mechanism: "Strike opponents within 2 tiles, then raise a temporary perimeter that closes the surrounding space.", cost: 18, range: 0, potency: 20, effect: "domain", duration: 2, reveal: "Closed Domain hits opponents within 2 tiles and raises a blocking perimeter 3 tiles from you for 2 owner turns.", announce: "I will strike everything within 2 tiles, then close a boundary around this space." },
    paleStampede: { name: "Pale Stampede", tier: "ultimate", concepts: ["sightline", "boundary"], merge: true, pairOnly: true, pairs: [["sightline", "boundary"]], delivery: "line", target: "enemy", area: { shape: "line" }, mechanism: "Ride one straight line (12 potency): every foe on the line and beside it is trampled, and the churned ground costs +10 AP to cross until it is cleaned.", cost: 16, range: 5, potency: 12, effect: "paleStampede", reveal: "Pale Stampede strikes every foe on the line and on the tiles beside it, then leaves the whole path trampled: crossing costs +10 AP until cleaned. Announced: step off the path.", announce: "The Pale Stampede rides.", prompt: "Which tiles does the stampede trample?" },
    tripThreshold: { name: "Trip Threshold", tier: "basic", concepts: ["threshold"], delivery: "routed", target: "enemy", area: { shape: "single" }, routeBudget: 7, timing: "delayed", trigger: "targetTurnStart", mechanism: "Mark a target; the strike triggers at the start of their next turn.", cost: 4, range: 0, potency: 11, effect: "damage", reveal: "Trip Threshold is committed now and lands at the target's next turn start, with a response window." },
    criticalThreshold: { name: "Critical Threshold", tier: "ultimate", concepts: ["threshold"], delivery: "routed", target: "enemy", area: { shape: "plus" }, routeBudget: 9, timing: "delayed", trigger: "targetTurnStart", mechanism: "Set a broad threshold; the marked zone erupts at the target's next turn start.", cost: 17, range: 0, potency: 19, effect: "damage", reveal: "Critical Threshold strikes the marked tile and its neighbors at the target's next turn start.", announce: "The marked zone will erupt at the start of your next turn; move clear or brace." },
    diffuseWave: { name: "Diffuse Wave", tier: "basic", concepts: ["diffusion"], delivery: "field", target: "self", area: { shape: "radius", radius: 2 }, mechanism: "Spread a low-intensity wave through nearby open space and push bodies outward.", cost: 5, range: 0, potency: 7, effect: "damage", knockback: 1, reveal: "Diffuse Wave reaches every opponent within 2 tiles and shoves each one tile away." },
    prune: { name: "Prune", tier: "basic", concepts: ["pruning"], delivery: "placed", target: "tile", mechanism: "Remove one named part from a reachable plant or eligible plant hazard.", cost: 3, range: 1, potency: 0, effect: "prune", reveal: "Prune removes one eligible plant or hazard part. An invalid target consumes the action and ΦF without changing the board; it cannot affect Life Force, paving, or pillars.", prompt: "Which local part was removed, and what changed around it?" },
    carefulPrune: { name: "Careful Prune", tier: "refined", concepts: ["pruning"], delivery: "placed", target: "tile", mechanism: "Make a deliberate cut at greater reach, using the same one-part removal rule.", cost: 5, range: 2, potency: 0, effect: "prune", reveal: "Careful Prune removes one eligible part. Greater reach does not add another cut or bypass a Barrier." },
    focus: { name: "Fix Attention", tier: "basic", concepts: ["focus"], delivery: "line", target: "enemy", area: { shape: "single" }, mechanism: "Attend to one visible target and retain one useful detail about their cover.", cost: 3, range: 5, potency: 0, effect: "focus", duration: 1, retainedDetail: 1, freeFirst: "turn", freeFirstFor: ["hypnotist"], reveal: "Focus marks one target through your next owner turn. Your reactions are limited to that target until another concept is used; a later Sightline shot can ignore one adjacent partial-cover source. You retain one detail: your next Observe on them gains +1 point." },
    deepFocus: { name: "Deep Focus", tier: "refined", concepts: ["focus"], delivery: "line", target: "enemy", area: { shape: "single" }, mechanism: "Sustain attention on one visible target across a longer observation window.", cost: 5, range: 4, potency: 0, effect: "focus", duration: 2, retainedDetail: 1, reveal: "Deep Focus marks one target for two owner turns. It grants no extra cover ignores; the reaction restriction lasts only while Focus is your latest technique. You retain one detail: your next Observe on them gains +1 point." },
    annotate: { name: "Annotate", tier: "basic", concepts: ["cipher"], delivery: "line", target: "enemy", area: { shape: "single" }, mechanism: "Mark one visible target and write down what is hidden: their soul force and traits are revealed to your side.", cost: 3, range: 5, potency: 0, effect: "annotate", duration: 2, damageType: "albedo", reveal: "Annotate marks one target for two owner turns and reveals their hidden stats. A record outlasts attention: the mark survives to your turn after next, enabling Redact and Plaintext riders." },
    redact: { name: "Redact", tier: "refined", concepts: ["cipher"], delivery: "line", target: "enemy", area: { shape: "single" }, mechanism: "Seal the victim's latest damage channel until their next turn start; an annotated victim also takes 8 spiritual damage.", cost: 5, range: 4, potency: 8, effect: "redact", damageType: "albedo", reveal: "Redact seals one damage channel (the victim's latest). Annotated victims take spiritual damage: the soul, not the body." },
    plaintext: { name: "Plaintext", tier: "ultimate", concepts: ["cipher"], delivery: "field", target: "self", area: { shape: "radius", radius: 2 }, mechanism: "Reveal everything nearby: annotate every enemy within 2 tiles; previously annotated victims take 16 spiritual damage, others 8.", cost: 16, range: 0, potency: 16, effect: "plaintext", damageType: "albedo", reveal: "Plaintext annotates every enemy within 2 tiles and strikes their souls: 16 to the already-marked, 8 to the rest.", announce: "Everything unwritten is written now." },
    lash: { name: "Lash", tier: "basic", concepts: ["thorn"], delivery: "line", target: "enemy", area: { shape: "single" }, mechanism: "Whip strike; where it lands, thorns spring up on the victim's tile (entering deals 3, withers at your next turn start).", cost: 4, range: 4, potency: 10, effect: "damage", damageType: "nigredo", seedThorn: { dmg: 3, duration: 1 }, reveal: "Lash strikes one target and seeds a thorn on their tile if the hit lands." },
    brierRing: { name: "Brier Ring", tier: "refined", concepts: ["thorn"], delivery: "placed", target: "tile", mechanism: "Ring the target tile with thorn growth for 2 owner turns; entering a ring tile deals 4 and snares (half movement).", cost: 6, range: 3, potency: 0, effect: "brierRing", duration: 2, damageType: "nigredo", reveal: "Brier Ring grows thorns on the eight tiles around the target (six live at most; the oldest withers first). Ring thorns wound and snare." },
    overgrowth: { name: "Overgrowth", tier: "ultimate", concepts: ["thorn"], delivery: "field", target: "self", area: { shape: "radius", radius: 2 }, mechanism: "The garden keeps what enters: strike every enemy within 2, entangle them for a turn, and seed thorns on every open tile in the radius.", cost: 16, range: 0, potency: 14, effect: "overgrowth", damageType: "nigredo", reveal: "Overgrowth strikes the radius, entangles every enemy in it, and seeds thorns on the open tiles.", announce: "The garden keeps what enters." },
    chartStar: { name: "Chart Star", tier: "basic", concepts: ["conjunction"], delivery: "placed", target: "tile", mechanism: "Chart a star on the tile for 3 owner turns; at each of your turn starts it pings adjacent enemies for 2.", cost: 3, range: 4, potency: 0, effect: "chartStar", duration: 3, damageType: "albedo", reveal: "Chart Star places a star (three live at most; the oldest fades first). Stars ping each turn and are spent by Starfall and Grand Conjunction." },
    starfall: { name: "Starfall", tier: "refined", concepts: ["conjunction"], delivery: "placed", target: "tile", mechanism: "A charted star falls: detonate a live friendly star (radius 1 burst, 12 potency) and chart a fresh star on the burst tile. Needs a clear line to the star; walls occult starlight.", cost: 6, range: 5, potency: 12, effect: "starfall", damageType: "albedo", reveal: "Starfall detonates one of your live stars and charts the crater: the chain continues while stars stand." },
    grandConjunction: { name: "Grand Conjunction", tier: "ultimate", concepts: ["conjunction"], delivery: "self", target: "self", area: { shape: "radius", radius: 0 }, mechanism: "Every charted star detonates at radius 2 for 16. Needs at least one live star.", cost: 17, range: 0, potency: 16, effect: "grandConjunction", damageType: "albedo", reveal: "Grand Conjunction detonates every live star at once. An empty sky refuses the cast.", announce: "The chart completes itself." },
    // Ranger (Muse's plug-in docs/ranger-build.md; built 2026-10-12, docs/ranger.md). Wired by class-runtime.js.
    // Track and Head Them Off are shared with Odysseus by design; Confirm the Trail with the Detective.
    track: { name: "Track", tier: "basic", concepts: ["pathway"], pairOnly: true, pairs: [["pathway", "inference"], ["strategic_commitment", "pathway"]], delivery: "self", target: "tile", area: { shape: "single" }, cost: 4, range: 4, potency: 0, effect: "classEffect", classKind: "trackMove", effectCategory: "conditional",
      mechanism: "Follow a quarry's readable trail: move up to 4 tiles to a tile on its last route. Your next attack this turn ignores cover.",
      reveal: "Track moves you along a visible trail and your next attack ignores cover.", counter: "Stay still (no trail); fly or teleport (no tracks); move where nobody can see you.", teaches: "Roads remember feet: a route taken is a route readable." },
    headThemOff: { name: "Head Them Off", tier: "refined", concepts: ["pathway"], pairOnly: true, pairs: [["pathway", "inference"], ["strategic_commitment", "pathway"]], delivery: "self", target: "enemy", area: { shape: "single" }, cost: 5, range: 8, potency: 0, effect: "classEffect", classKind: "interceptDash", effectCategory: "conditional",
      mechanism: "Read where the tracks point: the intercept is the quarry's tile plus its last step, twice over. Dash up to 6 tiles toward it; arrive on or beside it and your next attack this turn gains +2 potency.",
      reveal: "Head Them Off dashes to where the trail says the quarry is going; arriving grants +2 on your next attack.", counter: "Change direction after moving; the projection is public.", teaches: "Interception is prediction: read the line, not the dot." },
    // Mala, 2026-10-12: Read Sign gives line of sight to any opponent on the map, seen or not. (The spec's version found
    // hidden units, and the engine has none.)
    readSign: { name: "Read Sign", tier: "basic", concepts: ["inference"], pairOnly: true, pairs: [["pathway", "inference"], ["inference", "selectivity"]], delivery: "signal", target: "enemy", area: { shape: "single" }, cost: 3, range: 99, potency: 0, effect: "classEffect", classKind: "readSign", effectCategory: "signal",
      mechanism: "Tracks and disturbed ground say where it is: choose any opponent on the map. You have line of sight to it, whatever stands between you, and your attacks on it ignore cover, until it moves.",
      reveal: "Read Sign gives you (only you) line of sight to one opponent anywhere, past any cover, until it next moves.", counter: "Move: the reading goes stale the moment you do.", teaches: "Absence is also evidence: disturbed ground says where." },
    confirmTrail: { name: "Confirm the Trail", tier: "refined", concepts: ["inference"], pairOnly: true, pairs: [["pathway", "inference"], ["inference", "selectivity"]], delivery: "signal", target: "enemy", area: { shape: "single" }, cost: 5, range: 6, potency: 0, effect: "classEffect", classKind: "callOut", effectCategory: "signal",
      mechanism: "An independent sign confirms it: a trailed opponent is called out until the end of its next turn. Nobody's attacks on it are reduced by cover.",
      reveal: "Confirm the Trail calls out a trailed opponent for the whole side: cover does not protect it until its next turn ends.", counter: "Leave no trail before the call; wait it out.", teaches: "Two signs make a fact: independent evidence confirms." },
    // The Director (Mala, 2026-10-14/15; docs/director.md). His merge ULT, wired by class-runtime.js (kind "directorFilm",
    // engine in director/director.js). Announced: the mark may guard or dodge off the committed tile (out of frame, the trap fizzles).
    setTheScene: { name: "Set the Scene", tier: "ultimate", concepts: ["boundary", "delegation"], merge: true, pairOnly: true, pairs: [["boundary", "delegation"]], delivery: "signal", target: "enemy", area: { shape: "single" }, cost: 16, range: 5, potency: 0, timing: "announced", announce: "Quiet on set. Roll cameras.", effect: "classEffect", classKind: "directorFilm", effectCategory: "conditional",
      mechanism: "Trap one visible opponent on a 5x5 pocket set with a random co-star: the outside battle pauses and the two trade turns, the mark first. The mark falls: CUT, a premiere, and a reception roll (Dud 35 AP owed / Good +50 AP / Smash +100 AP +10 charge x2 / Legendary Award). The cast falls or the mark walks off: ruin, a dud with no premiere. One film at a time; an Award Winning Director films sequels for 1 Inspiration each.",
      reveal: "Set the Scene pauses the battle for a pocket duel; the film pays out at CUT and bills at ruin.", counter: "Kill the cast inside (ruin), walk off the set (routes), or end the scene before the twelfth take.", teaches: "Every production is a gamble: the premiere pays for the shoot." },
    // The Actor (Mala, 2026-10-16; docs/actor-respec-rulings.md). Class kit, wired by class-runtime.js
    // (kind "actor", engine in actor/actor.js). Seeded into his learned list at spawn so a role never locks them out.
    // Sinkerfruit techniques (OP1; engine/fruit.js, account/fruit.js). They are not on any concept's list: a fruit eaten
    // out of battle adds its one technique to the hero's kit (fruitKitOf), and the sea damps it.
    windTheSpring: { name: "Wind the Spring", tier: "basic", concepts: ["elasticity"], delivery: "self", target: "self", area: { shape: "single" }, cost: 4, tempoCost: 20, range: 0, potency: 0, effect: "fruit", effectCategory: "conditional",
      mechanism: "Coilfruit: store one coil (at most 3). Your next Strike releases every coil: +4 potency and +1 reach each.",
      reveal: "A coiled body is a promise of reach.", counter: "Soak them and the stored coils are lost; in water or cuffs the coils can't let go. Steel will lands through the give.", teaches: "Compression is stored release: what you wind, you spend." },
    takeTheShape: { name: "Take the Shape", tier: "refined", concepts: ["plasticity"], delivery: "self", target: "self", area: { shape: "single" }, cost: 6, range: 0, potency: 0, effect: "fruit", effectCategory: "conditional",
      mechanism: "Hidefruit: become a hybrid of the largest creature you learned by swallowing beads, for 3 turns, or 5 if the fruit is Ripe: a quarter of its life as a ward (at most 25), and its strongest move. Greyed until you have learned one.",
      reveal: "The hide you wear is one you earned.", counter: "Break the borrowed hide, or soak the eater: water ends the shape, and in water or cuffs its borrowed move is refused. Steel will goes through the borrowed hide.", teaches: "A shape is learned before it is worn." },
    fogBank: { name: "Fog Bank", tier: "refined", concepts: ["stealth"], delivery: "placed", target: "tile", area: { shape: "radius", radius: 1 }, cost: 6, range: 3, potency: 0, effect: "fruit", effectCategory: "constructive",
      mechanism: "Mistfruit: fog in a 3×3 square for 2 rounds. It blocks sightlines and doesn't block movement. Mistfruit's Drift: a strike that doesn't carry will misses 35%.",
      reveal: "Weather that answers to someone.", counter: "Steel will lands through Drift; soak the Mistfruit to still the weather.", teaches: "You can't fight what you can't see; you can still fight what you can't hit with resolve." },
    // Sinkerfruit refined techniques (respec S2a): in the hero's kit only at Ripe, and only when the feat model runs (opts.fruit.respec).
    fullShape: { name: "Full Shape", tier: "refined", fruitOnly: true, concepts: ["plasticity"], delivery: "self", target: "self", area: { shape: "single" }, cost: 15, tempoCost: 35, range: 0, potency: 0, effect: "fruit", effectCategory: "conditional",
      announce: "Not a borrowed coat: the creature itself.",
      mechanism: "Hidefruit, Awakened: take the shape of your largest learned creature as Take the Shape does (its hide and its strongest move), and its passive too when the creature has one (a trait lent for as long as the shape is worn), for 4 of your turns at most. Each turn start holds it for 3 ΦF; it ends if you drop it (free, always), the sea has the power (a soak ends it at once; standing in water, at your next turn start), the ΦF is not there, or the four turns are up. Greyed until you have learned a creature.",
      reveal: "A shape worn whole is paid for every turn.", counter: "Water ends it; a blow carrying Steel will goes through its hide; starve its ΦF; it cannot outlast four turns.", teaches: "To be something is to keep paying to be it." },
    dropTheShape: { name: "Drop the Shape", tier: "basic", fruitOnly: true, concepts: ["plasticity"], delivery: "self", target: "self", area: { shape: "single" }, cost: 0, tempoCost: 0, noCharge: true, range: 0, potency: 0, effect: "fruit", effectCategory: "conditional",
      mechanism: "Hidefruit, Awakened: put the shape down. Free. Ends the borrowed hide and, if you wore the full shape, its passive. Greyed when you wear no shape.",
      reveal: "What can be put down was never stuck.", counter: "Nothing: it is the way out.", teaches: "The way out is part of the way in." },
    scent: { name: "Scent", tier: "refined", fruitOnly: true, concepts: ["discovery"], delivery: "self", target: "self", area: { shape: "single" }, cost: 3, tempoCost: 0, range: 0, potency: 0, effect: "fruit", effectCategory: "conditional",
      mechanism: "Hidefruit, Ripe: while you wear a borrowed shape, 3 ΦF and no action points reveal every concealed foe within 3 tiles. Greyed with no shape, or with nobody hidden in reach.",
      reveal: "The beast's nose knows who is hiding.", counter: "Water ends the shape and the power; a foe can hide again after it is revealed.", teaches: "A borrowed body brings its senses with it." },
    mainspring: { name: "Mainspring", tier: "refined", fruitOnly: true, concepts: ["elasticity"], delivery: "self", target: "self", area: { shape: "single" }, cost: 15, tempoCost: 35, range: 0, potency: 0, effect: "fruit", effectCategory: "conditional",
      announce: "The whole body is the spring.",
      mechanism: "Coilfruit, Awakened: for 2 turns, every push you cause on a target within 2 tiles travels 1 tile further, and your first Strike each turn lets its coils go without spending them. Not recast while wound.",
      reveal: "A body that gives back more than it was given.", counter: "Water unwinds it; a blow carrying Steel will snaps it; stand 3 or more tiles away, where its pushes grow no longer.", teaches: "Stored energy is borrowed time." },
    weatherFront: { name: "Weather Front", tier: "refined", fruitOnly: true, concepts: ["stealth"], delivery: "self", target: "self", area: { shape: "single" }, cost: 15, tempoCost: 35, range: 0, potency: 0, effect: "fruit", effectCategory: "constructive",
      announce: "The weather turns.",
      mechanism: "Mistfruit, Awakened: a ring of fog on your tile grows from radius 1 to 2 to 3 over your next two turns, then clears all at once (3 turns in all). Allies standing in it Drift, as in your fog; foes standing in it lose 10 AP as their turn starts. Not recast while it stands.",
      reveal: "Weather does not choose a side, only a place: whoever stands in it is held by it.", counter: "Water takes the power and the ring with it; a blow carrying Steel will parts it; leave the ring.", teaches: "A field is a clock: it grows, it costs, it ends." },
    // The Locusfruit (respec S6b; Mala, 2026-10-31: the method of loci as a power; spec claude-sinkerfruit-respec-spec section 6). Original Loci designs, not source claims.
    commitToMemory: { name: "Commit to Memory", tier: "basic", fruitOnly: true, concepts: ["indexing"], delivery: "self", target: "self", area: { shape: "single" }, cost: 5, tempoCost: 20, range: 0, potency: 0, effect: "fruit", effectCategory: "conditional",
      mechanism: "Locusfruit: store a technique you watched a foe use this battle in one of your rooms (1 room, 2 at Ripe, 3 at Awakened). Later you may cast it once, at its own cost plus 2 ΦF, and the room empties. Boss, signature, form, merge, identity, fruit-own and class-pair arts and ultimates cannot be stored, nor can one you already know.",
      reveal: "You were watching, so you can keep it.", counter: "Water washes the palace clean; never let it watch (it stores only what it saw); a technique it never saw is not in its rooms.", teaches: "A memory palace stores what you attended to, one room at a time." },
    walkTheRooms: { name: "Walk the Rooms", tier: "refined", fruitOnly: true, concepts: ["indexing"], delivery: "placed", target: "tile", area: { shape: "single" }, cost: 4, range: 99, tempoCost: 15, potency: 0, effect: "fruit", effectCategory: "conditional",
      mechanism: "Locusfruit, Ripe: each of your turns leaves a memory mark on the tile you end on (up to 3, the oldest dropped). Step to any marked tile, no line needed. A step: it provokes nothing, but what is on the tile you land on still happens.",
      reveal: "A body that remembers where it has been.", counter: "Water takes the power; stand on or block a marked tile; the marks are only where it ended a turn.", teaches: "A route is a sequence of places you can return to." },
    memoryPalace: { name: "Memory Palace", tier: "refined", fruitOnly: true, concepts: ["indexing"], delivery: "self", target: "self", area: { shape: "single" }, cost: 15, tempoCost: 35, range: 0, potency: 0, effect: "fruit", effectCategory: "conditional",
      announce: "Every room, open at once.",
      mechanism: "Locusfruit, Awakened: for 2 of your turns, radius 3 around you is your palace: each ally inside may cast its last used technique once more with the palace returning the action points it pays, and a foe inside who uses a technique you have stored loses 10 AP. Not recast while it stands.",
      reveal: "A place where everything that has happened can happen again.", counter: "Water ends it; fight outside radius 3; use techniques it never stored.", teaches: "A palace is a place, and a place can be left." },
    vapourStep: { name: "Vapour Step", tier: "refined", fruitOnly: true, concepts: ["stealth"], delivery: "placed", target: "tile", area: { shape: "single" }, cost: 5, range: 4, tempoCost: 15, potency: 0, effect: "fruit", effectCategory: "conditional",
      mechanism: "Mistfruit, Ripe: standing in fog, step to any empty fog tile within 4 tiles, no line needed. A step, not a leap: it provokes nothing, but what is on the tile you land on still happens.",
      reveal: "Weather you can walk through.", counter: "Water takes the power; with no fog to land in the step is refused; Steel will lands through the Drift you keep.", teaches: "You can be where the weather is." },
    audition: { name: "Audition", tier: "basic", concepts: ["deception"], delivery: "signal", target: "self", area: { shape: "single" }, cost: 4, range: 0, potency: 0, effect: "classEffect", classKind: "actor", effectCategory: "conditional",
      mechanism: "Hold auditions: three villain classes answer (60% the last role holds a familiar slot). Play one for N turns, N its consecutive plays to a cap of 3: its pair techniques and mandatory class traits are yours, over your own.",
      reveal: "Audition plays a villain's kit for up to 3 turns; repeats build Typecast.", counter: "Force the revert early: the part ends when the run does.", teaches: "Every part is borrowed craft: wear it, then give it back." },
    genreDefiningPerformance: { name: "Genre-Defining Performance", tier: "ultimate", concepts: ["deception"], delivery: "signal", target: "self", area: { shape: "single" }, cost: 16, range: 0, potency: 0, effect: "classEffect", classKind: "actor", effectCategory: "conditional",
      mechanism: "Spend 1 Inspiration: for 2 turns the whole field becomes fans. Stardom goes global and enemies pay double AP to target you (reactions too, multi-target techniques once); re-cast while it runs to raise the tax to the 4x soft cap.",
      reveal: "Genre-Defining Performance turns the field into fans: global Stardom, double AP to touch the star.", counter: "Wait out the 2 turns; hit anyone else.", teaches: "Fame is armor priced in attention." },
    huntersMark: { name: "Hunter's Mark", tier: "refined", concepts: ["pathway", "inference"], pairOnly: true, pairs: [["pathway", "inference"]], delivery: "signal", target: "enemy", area: { shape: "single" }, cost: 5, range: 5, potency: 0, effect: "classEffect", classKind: "huntersMark", effectCategory: "conditional",
      mechanism: "Mark one visible quarry for 2 rounds. Your single-target attacks on it deal +3 potency. A new mark replaces the old.",
      reveal: "Hunter's Mark: +3 on your single-target hits on one visible quarry for 2 rounds.", counter: "Wait out the 2 rounds; break sight before the mark lands.", teaches: "Attention is a weapon: what you keep sight of, you hit harder." },
    // Hypebeast's merge. Defined here, not in kits-data.js, and wired by class-runtime.js (kind "culturalMoment").
    culturalMoment: { name: "Cultural Moment", tier: "ultimate", concepts: ["diffusion", "deception"], merge: true, pairOnly: true, pairs: [["diffusion", "deception"]], delivery: "field", target: "self", area: { shape: "single" },
      cost: 16, range: 0, potency: 0, effect: "classEffect", classKind: "culturalMoment", effectCategory: "conditional",
      mechanism: "A falsehood spread field-wide: everyone who has not checked acts as if the Hypebeast's side is stronger than it is.",
      reveal: "Cultural Moment costs believers action points every turn until one of them Observes the Hypebeast. Once per battle.",
      announce: "Everybody is talking about this. You are already late.",
      counter: "Observe the Hypebeast once: the Moment ends for the whole side.", teaches: "A belief that spreads faster than it is checked still moves people; one check ends it." },
    // Bird Mountain extras (Mala, 2026-10-22). Defined here, not in kits-data.js: they cost the action, never ΦF,
    // and staged basics must cost 3+ (0 only when Inspiration pays). Wired by class-runtime.js (kind "martial").
    chargeWave: { name: "Charge Wave", tier: "basic", concepts: ["bird_mountain"], pairs: [["bird_mountain", "adaptation"]], delivery: "self", target: "self", area: { shape: "single" },
      cost: 0, actionCost: 25, timing: "immediate", domains: ["ideas", "action"], range: 0, potency: 0, channel: null, effect: "classEffect", classKind: "martial", effectCategory: "conditional",
      targetRule: "Yourself, while the wave is unreleased.", prerequisites: [],
      potencyDefinition: "Cup your hands and hold: +1 held wave charge (+4 potency at release, max 2 charges). Each charge costs this action; firing the wave spends all held charge.",
      expiry: "Charges last until released or spilled.", dependencies: ["an unreleased wave"],
      mechanism: "Patience, one action at a time: the held wave grows.", newEffect: "chargeWave { charge: 1, max: 2 }.",
      reveal: "Charging spends the action but no ΦF: time is the price.", price: "The action; a held charge invites the 6+ spill.",
      counter: "Land one 6+ hit before it fires; step off the line.", teaches: "Held thunder." },
    vowOpenHand: { name: "Vow of the Open Hand", tier: "basic", concepts: ["bird_mountain"], pairs: [["bird_mountain", "adaptation"]], delivery: "self", target: "self", area: { shape: "single" },
      cost: 0, actionCost: 25, timing: "immediate", domains: ["ideas", "action"], range: 0, potency: 0, channel: null, effect: "classEffect", classKind: "martial", effectCategory: "conditional",
      targetRule: "Yourself, once per battle.", prerequisites: [],
      potencyDefinition: "Swear never to throw the wave cold: every release must hold at least 1 charge. Each charge is +6 instead of +4 for the rest of the battle.",
      expiry: "The battle.", dependencies: ["unsworn hands"],
      mechanism: "An Inversion: the restriction is the price, the power is the reward.", newEffect: "vow { openHand: true }.",
      reveal: "Sworn means sworn: no cold wave while the vow holds.", price: "Every release must hold a charge.",
      counter: "Force the issue: a sworn holder cannot answer cold.", teaches: "Oaths are load-bearing." },
    vowNeverQuench: { name: "Vow of Never-Quench", tier: "basic", concepts: ["bird_mountain"], pairs: [["bird_mountain", "adaptation"]], delivery: "self", target: "self", area: { shape: "single" },
      cost: 0, actionCost: 25, timing: "immediate", domains: ["ideas", "action"], range: 0, potency: 0, channel: null, effect: "classEffect", classKind: "martial", effectCategory: "conditional",
      targetRule: "Yourself, once per battle.", prerequisites: [],
      potencyDefinition: "Swear never to dismiss ʻUlaʻula once lit: the free dismiss is gone (quenching still puts it out). Unlocks gear ×5 (Strikes ×3, burn 16, aura 8) for the rest of the battle.",
      expiry: "The battle.", dependencies: ["unsworn hands"],
      mechanism: "An Inversion: burn without an exit, for a gear beyond gears.", newEffect: "vow { neverQuench: true }.",
      reveal: "Only stun, root, sleep, or the battle's end puts it out.", price: "No voluntary dismiss, ever.",
      counter: "Quench it the hard way; outlast the burn.", teaches: "Oaths are load-bearing." },
    vowSharedBowl: { name: "Vow of the Shared Bowl", tier: "basic", concepts: ["bird_mountain"], pairs: [["bird_mountain", "adaptation"]], delivery: "self", target: "self", area: { shape: "single" },
      cost: 0, actionCost: 25, timing: "immediate", domains: ["ideas", "action"], range: 0, potency: 0, channel: null, effect: "classEffect", classKind: "martial", effectCategory: "conditional",
      targetRule: "Yourself, once per battle.", prerequisites: [],
      potencyDefinition: "Swear to always gather all 3 Imu ticks (no early hurl). Each contributor heals 4 at every tick for the rest of the battle.",
      expiry: "The battle.", dependencies: ["unsworn hands"],
      mechanism: "An Inversion: patience compulsory, and the pit feeds its cooks.", newEffect: "vow { sharedBowl: true }.",
      reveal: "No early hurl while the vow holds.", price: "Three full ticks of standing gatherable.",
      counter: "Break the gather; the vow cannot shorten it.", teaches: "Oaths are load-bearing." },
    hurlFeast: { name: "Hurl Feast", tier: "basic", concepts: ["bird_mountain"], pairs: [["bird_mountain", "adaptation"]], delivery: "line", target: "enemy", area: { shape: "single" },
      cost: 0, actionCost: 25, timing: "immediate", domains: ["ideas", "action"], range: 6, potency: 0, channel: "citrinitas", effect: "classEffect", classKind: "martial", effectCategory: "conditional",
      targetRule: "One enemy in line within 6. Needs a gathering Imu with at least 1 tick.", prerequisites: [],
      potencyDefinition: "Hurl the gathered feast (costs this action): 10 + the pool, citrinitas. Under the Shared Bowl, only after all 3 ticks.",
      expiry: "Instant; the feast is spent.", dependencies: ["a gathering feast"],
      mechanism: "The follow-up: digging is the ult, throwing is the action.", newEffect: "hurlFeast { base: 10 }.",
      reveal: "Hurling spends the action, never the charge.", price: "The action and the pool.",
      counter: "Spill the pool before the throw.", teaches: "Dig once, throw once." },
    frontPropagation: { name: "Front Propagation", tier: "ultimate", concepts: ["diffusion"], delivery: "field", target: "self", area: { shape: "radius", radius: 4 }, mechanism: "Release a broad advancing front that reaches across nearby space.", cost: 18, range: 0, potency: 17, effect: "damage", reveal: "Front Propagation reaches every opponent within 4 tiles.", announce: "A spreading front will reach every opponent within 4 tiles of me." },
    feint: { name: "Feint", tier: "basic", concepts: ["deception"], delivery: "line", target: "enemy", area: { shape: "single" }, mechanism: "A restrained strike that tests a guard without revealing your larger plan. Announced, it is telegraphed bait: 5 AP + 1 ΦF, 1 potency, no ×1.4, and the reaction window still opens.", cost: 3, range: 4, potency: 5, effect: "damage", oncePerTurn: true, reveal: "Feint is a low-force line strike; its purpose is to make the opponent show a response. An announced Feint costs its user almost nothing and lands for ~1, so the threat is the follow-up, not the touch." },
    falseHorizon: { name: "False Horizon", tier: "ultimate", concepts: ["deception"], delivery: "field", target: "self", area: { shape: "radius", radius: 3 }, mechanism: "Strike opponents within 3 tiles, or misstate your reach to make defenders judge a smaller threat envelope.", cost: 16, range: 0, potency: 16, effect: "damage", reveal: "False Horizon reaches every opponent within 3 tiles.", announce: "I will strike every opponent within 3 tiles of me." },
    // Soul arts (Jinki J6, D54): a soul's verb (II, free once a turn) and technique (III, free once a battle).
    // Cost 0 because the Jinki IS the activation. Lent by abilitiesOf from soulArts, never learned or equipped.
    shortFlight: { name: "Short Flight", tier: "basic", concepts: ["pathway"], delivery: "placed", target: "tile", area: { shape: "single" }, mechanism: "The humble soul lifts you: fly to any open tile within 4, over terrain, height, and walls.", cost: 0, tempoCost: 0, noCharge: true, range: 4, potency: 0, effect: "fly", oncePerTurn: true, effectCategory: "existential", reveal: "Short Flight crosses anything between, but must land on open ground.", prompt: "What does flight let you ignore, and what does it still require?" },
    soaringStrike: { name: "Soaring Strike", tier: "refined", concepts: ["pathway"], delivery: "contact", target: "tile", area: { shape: "line", length: 5 }, mechanism: "Fly a straight line and strike the first foe on it: the journey and the blow are one.", cost: 0, tempoCost: 0, noCharge: true, range: 5, potency: 14, damageType: "albedo", effect: "charge", stopAtFirst: true, soarOver: true, chargeTiles: 5, oncePerBattle: true, effectCategory: "existential", reveal: "Soaring Strike flies over walls and hazards, stops beside the first foe, and strikes.", prompt: "When is arriving the attack?" },
    root: { name: "Root", tier: "basic", concepts: ["inertia"], delivery: "self", target: "self", area: { shape: "single" }, mechanism: "The steadfast soul sets you like a stone: immovable until your next turn, then slow to start. Stone must breathe: never twice running.", cost: 0, tempoCost: 0, noCharge: true, range: 0, potency: 0, effect: "immovable", duration: 1, oncePerTurn: true, everyOtherTurn: true, effectCategory: "invariant", reveal: "Root cancels forced displacement and blunts impact, then halves your next movement. It always lapses a turn before it can be set again.", prompt: "What does stillness cost, and what does it buy?" },
    landslide: { name: "Landslide", tier: "refined", concepts: ["inertia"], delivery: "contact", target: "tile", area: { shape: "line", length: 4 }, mechanism: "Become the slope giving way: charge straight ahead, striking every foe and throwing each aside.", cost: 0, tempoCost: 0, noCharge: true, range: 4, potency: 18, damageType: "nigredo", effect: "charge", oncePerBattle: true, effectCategory: "universal", reveal: "Landslide advances tile by tile; walls, anchored, and immovable bodies end it.", prompt: "What stops a landslide, and what merely redirects it?" },
    rally: { name: "Rally", tier: "basic", concepts: ["legitimacy"], delivery: "placed", target: "ally", area: { shape: "single" }, mechanism: "The noble soul lends its voice: yourself or an ally within 6 gains 1 Inspiration.", cost: 0, tempoCost: 0, noCharge: true, range: 6, potency: 0, effect: "rally", oncePerTurn: true, effectCategory: "constructive", reveal: "Rally inspires anyone on your side, yourself included.", prompt: "Who needs the words most right now?" },
    coronation: { name: "Coronation", tier: "refined", concepts: ["legitimacy"], delivery: "self", target: "self", area: { shape: "single" }, mechanism: "The crown outranks the rules: gain 2 Inspiration past every cap.", cost: 0, tempoCost: 0, noCharge: true, range: 0, potency: 0, effect: "coronate", oncePerBattle: true, effectCategory: "constructive", reveal: "Coronation is the only Inspiration that ignores the cap of 3.", prompt: "What do you spend a crown on?" },
    plotTwist: { name: "Plot Twist", tier: "basic", concepts: ["resonance"], delivery: "signal", target: "unit", area: { shape: "single" }, mechanism: "The saga rewrites positions: trade places with a visible unit within 5.", cost: 0, tempoCost: 0, noCharge: true, range: 5, potency: 0, effect: "twist", oncePerTurn: true, effectCategory: "conditional", reveal: "Plot Twist swaps you with anyone you can see; anchored bodies refuse.", prompt: "Whose position is worth stealing?" },
    refuseEnding: { name: "Refuse the Ending", tier: "refined", concepts: ["resonance"], delivery: "self", target: "self", area: { shape: "single" }, mechanism: "Ward your own story: the next lethal blow this battle leaves you at 1 LF.", cost: 0, tempoCost: 0, noCharge: true, range: 0, potency: 0, effect: "denyEnding", oncePerBattle: true, effectCategory: "invariant", reveal: "Refuse the Ending must be cast before the blow; it waits all battle.", prompt: "When is the story worth saving?" },
  };

  // Logical effect shape is metadata for learning and future math-counter rules;
  // it never changes damage, cost, or resolution. An effect without a clean fit stays uncategorized.
  const effectCategories = {
    universal: { name: "Universal", form: "Every target or route in a declared scope.", counters: ["counterexample"] },
    existential: { name: "Existential", form: "At least one valid route or witness reaches the target.", counters: ["witness", "cut"] },
    conditional: { name: "Conditional", form: "An effect activates when a declared condition holds.", counters: ["break the hypothesis"] },
    constructive: { name: "Constructive", form: "An outcome is built from dependent parts.", counters: ["disrupt a load-bearing part"] },
    invariant: { name: "Invariant", form: "A declared property is preserved against change.", counters: ["change the invariant"] },
    signal: { name: "Signal", form: "A message shapes beliefs about a hidden action.", counters: ["calibration when evidence is exposed"] },
    uncategorized: { name: "Uncategorized", form: "No clean logical category is authored yet.", counters: [] },
  };
  const effectCategoryByAbility = {
    cutSlope: "constructive", placeFill: "constructive", watershedTerrace: "invariant",
    earthBerm: "conditional", clearShot: "existential", bioswale: "conditional", anchor: "invariant",
    shieldWall: "universal", rebound: "conditional", bastionCollapse: "universal", snapShot: "existential",
    shockwave: "universal", reelingShot: "existential", recoilCascade: "universal", filterBolt: "existential", membrane: "conditional",
    sieveVerdict: "uncategorized", detour: "existential", convergingRoutes: "existential", manyPaths: "universal",
    resonantPulse: "uncategorized", harmonicRupture: "universal", adaptiveBrace: "invariant", livingResponse: "universal",
    boundaryLine: "universal", closedDomain: "universal", tripThreshold: "conditional", criticalThreshold: "conditional",
    diffuseWave: "universal", frontPropagation: "universal", feint: "signal", falseHorizon: "signal",
    prune: "conditional", carefulPrune: "conditional", focus: "conditional", deepFocus: "conditional",
    annotate: "signal", redact: "conditional", plaintext: "signal",
    lash: "existential", brierRing: "conditional", overgrowth: "universal",
    chartStar: "constructive", starfall: "existential", grandConjunction: "universal",
  };

  // The authored kit pack is the source for the additional playable abilities.
  // Attach it to the existing content schema so graph, selection, AI, and save
  // code all see one catalog rather than a parallel ability registry.
  const playableKits = { ...(Kits.abilities || {}) };
  Object.assign(abilities, playableKits);
  const presidentEffects = { swornIn: "presidentOffice", executiveDirection: "presidentDirection", dueProcess: "presidentLaw",
    publicPromise: "presidentPromise", credibleGuarantee: "presidentGuarantee", burnTheBoats: "presidentCommitment", theAccordHolds: "presidentAccord" };
  for (const [id, effect] of Object.entries(presidentEffects)) if (abilities[id]) abilities[id].effect = effect;
  for (const id of Object.keys(presidentEffects)) if (abilities[id]) abilities[id].target = id === "executiveDirection" ? "ally" : id === "publicPromise" ? "tile" : "self";
  if (abilities.publicPromise) { abilities.publicPromise.delivery = "placed"; abilities.publicPromise.range = 6; }
  if (abilities.swornIn) abilities.swornIn.duration = 3;
  for (const id of ["pioneerPatch", "nurseLog", "oldGrowth"]) effectCategoryByAbility[id] = id === "oldGrowth" ? "constructive" : "conditional";
  for (const [id, ability] of Object.entries(playableKits)) {
    if (ability.signatureOnly) continue;   // a species signature (Breadfruit Hurl) is granted by communion, not by holding its concept
    for (const concept of ability.concepts || []) {
      const list = concepts[concept]?.abilities;
      if (list && !list.includes(id)) list.push(id);
    }
  }
  for (const [id, ability] of Object.entries(abilities)) ability.effectCategory = effectCategoryByAbility[id] || ability.effectCategory || "uncategorized";

  // ── relationship graphs (spec §4): directed, never inferred ─────────────────
  // status: known (authored effect) | none (known absence) | unknown (unauthored → no effect)
  // op:     the typed operation the engine runs; conditions are predicates it checks.
  const opposition = [
    { id: "opp-barrier-negates-line", source: "barrier", target: "*", type: "negates", status: "known",
      conditions: ["delivery = line", "the straight path crosses a live barrier tile"],
      op: { kind: "negateAtBarrier" },
      exceptions: ["Field and routed deliveries do not cross the tile as a line.", "Damage above the barrier's protection breaks it but is still stopped."],
      example: "A Filter Bolt fired through the gap stops at a Shield Wall on the gap." },
    { id: "opp-barrier-deflects-line", source: "barrier", target: "*", type: "deflects", status: "known",
      conditions: ["delivery = line", "negated at a barrier", "the barrier's owner runs Barrier primary + Elasticity secondary"],
      op: { kind: "deflectToSource", fraction: 0.5 },
      exceptions: ["Needs the composition edge comp-barrier-elasticity; reversed loadouts store instead."],
      example: "Your Shield Wall bounces half of a Filter Bolt back at the Sieve." },
    { id: "opp-pathway-bypasses-barrier", source: "pathway", target: "barrier", type: "bypasses", status: "known",
      conditions: ["delivery = routed", "an open route within the budget avoids every barrier tile"],
      op: { kind: "routeAround" },
      exceptions: ["If barriers enclose every route within budget, the delivery fails: no route."],
      example: "Detour goes around a Shield Wall on the gap; the wall stays up." },
    { id: "opp-pathway-bypasses-parry", source: "pathway", target: "barrier", type: "bypasses", status: "known",
      conditions: ["delivery = routed", "target has Rebound armed"],
      op: { kind: "ignoreParry" },
      exceptions: ["The parry is not consumed: it stays armed for a later line/contact hit."],
      example: "Detour arrives from the side, so Rebound never fires." },
    { id: "opp-selectivity-disrupts-parry", source: "selectivity", target: "barrier", type: "disrupts", status: "known",
      conditions: ["delivery = line", "target has Rebound armed"],
      op: { kind: "breakParry" },
      exceptions: ["Only Selectivity line deliveries; a Snap Shot is caught normally."],
      example: "Filter Bolt picks the parry apart: Rebound is spent and the bolt lands in full." },
    { id: "opp-selectivity-negates-line", source: "selectivity", target: "elasticity", type: "negates", status: "known",
      conditions: ["delivery = line", "target is wrapped in Membrane"],
      op: { kind: "membraneBlock" },
      exceptions: ["Pierces lose only the wrapped target."],
      example: "Snap Shot at a membraned Pathfinder is filtered out." },
    { id: "opp-selectivity-enhances-field", source: "selectivity", target: "elasticity", type: "enhances", status: "known",
      conditions: ["delivery = field", "target is wrapped in Membrane"],
      op: { kind: "multiply", factor: 1.25, consumesMembrane: true },
      exceptions: ["Enhances an opponent's effect: the membrane carries the wave inward, then ruptures."],
      example: "Shockwave hits a membraned enemy ×1.25 and pops the membrane." },
    { id: "opp-elasticity-barrier-none", source: "elasticity", target: "barrier", type: "none", status: "none",
      conditions: [], op: { kind: "none" }, exceptions: [],
      example: "Known absence: elastic snaps don't weaken a barrier beyond ordinary damage." },
    { id: "opp-barrier-pathway-none", source: "barrier", target: "pathway", type: "none", status: "none",
      conditions: ["delivery = routed"], op: { kind: "none" }, exceptions: [],
      example: "Known absence (the one-way half): a barrier does nothing to a route that doesn't cross it." },
    { id: "opp-pathway-selectivity-unknown", source: "pathway", target: "selectivity", type: "unknown", status: "unknown",
      conditions: [], op: { kind: "none" }, exceptions: [], example: "Unauthored. No effect is invented." },
    { id: "opp-selectivity-pathway-unknown", source: "selectivity", target: "pathway", type: "unknown", status: "unknown",
      conditions: [], op: { kind: "none" }, exceptions: [], example: "Unauthored. No effect is invented." },
    { id: "opp-berm-dampens-sightline", source: "berm", target: "sightline", type: "dampens", status: "known",
      conditions: ["a Berm occupies an intervening tile on a direct line and is adjacent to the target"], op: { kind: "partialCover", damageMultiplier: 0.5 }, exceptions: ["Affects direct line damage only; field and routed deliveries ignore it. Height 2+ clears this low cover."],
      example: "A Clear Shot crosses a Berm but deals half damage to a ground-level target directly behind it." },
    { id: "opp-swale-negates-line", source: "swale", target: "*", type: "negates", status: "known",
      conditions: ["an opposing line delivery crosses a live Bioswale tile"], op: { kind: "absorbOneLine" }, exceptions: ["The swale is consumed; movement and routed deliveries are unaffected."],
      example: "A Bioswale absorbs one Clear Shot crossing its tile, then disappears." },
    { id: "opp-inertia-negates-displacement", source: "inertia", target: "*", type: "negates", status: "known",
      conditions: ["an anchored actor is subject to forced displacement"], op: { kind: "cancelDisplacementOnce" }, exceptions: ["LF damage still resolves; only the first forced movement is cancelled."],
      example: "Anchor keeps the target in place after a Shockwave, while its LF damage still lands." },
    { id: "opp-pruning-disrupts-plant-hazard", source: "pruning", target: "swale", type: "disrupts", status: "known",
      conditions: ["Prune names a plant-tagged hazard on an eligible tile"], op: { kind: "removePlantHazard" }, exceptions: ["The cut removes one named part; it does not damage a character or bypass a Barrier."],
      example: "Pruning clears a thorn mat, changing the entry hazard on that tile." },
    { id: "opp-pruning-barrier-none", source: "pruning", target: "barrier", type: "none", status: "none",
      conditions: ["the named part is a live Barrier"], op: { kind: "none" }, exceptions: ["A blocked tile may be targeted, but it cannot be altered by Pruning."],
      example: "Pruning does not open, pass through, or remove a Barrier." },
    { id: "opp-focus-enhances-sightline", source: "focus", target: "sightline", type: "enhances", status: "known",
      conditions: ["Focus is attending the named target", "delivery = line", "one adjacent partial-cover source exists"], op: { kind: "ignorePartialCoverOnce" }, exceptions: ["Only one partial-cover source is ignored; Focus itself deals no damage."],
      example: "Clear Shot ignores one Berm or partial-cover source beside the attended target, then spends that observation." },
    { id: "opp-focus-diffusion-none", source: "focus", target: "diffusion", type: "none", status: "none",
      conditions: ["delivery = field"], op: { kind: "none" }, exceptions: [], example: "Focus does not improve or narrow a field delivery." },
    { id: "opp-focus-pathway-none", source: "focus", target: "pathway", type: "none", status: "none",
      conditions: ["delivery = routed"], op: { kind: "none" }, exceptions: [], example: "Focus does not add route length or make a blocked route possible." },
    { id: "opp-pruning-resets-succession", source: "pruning", target: "succession", type: "disrupts", status: "known", conditions: ["pruning or damage reaches an active Pioneer Patch"], op: { kind: "resetGrowth" }, exceptions: ["A Nurse Log absorbs one reset."], example: "Prune the patch tile and its growth clock returns to stage 1.", why: "Pruning is a disturbance to the patch itself; an intact nurse log buffers its first reset.", teaches: "A state transition can be reversed by a disturbance." },
    { id: "opp-diffusion-accelerates-succession", source: "diffusion", target: "succession", type: "enhances", status: "known", conditions: ["a Diffusion field covers an active patch"], op: { kind: "advanceGrowth", stages: 1 }, exceptions: ["Stage 3 is terminal; no extra resource is created."], example: "A spreading field accelerates a living patch by one stage.", why: "The field advances a state already present on the tiles it reaches.", teaches: "An operator changes state only where its scope overlaps." },
    { id: "opp-swale-feeds-succession", source: "swale", target: "succession", type: "enhances", status: "known", conditions: ["a patch is established on a Swale or Rain Garden tile"], op: { kind: "advanceGrowth", stages: 1 }, exceptions: ["Growth still caps at stage 3."], example: "A water-holding tile gives a newly planted patch a one-stage head start.", why: "Water retention changes establishment conditions, not the patch cap.", teaches: "A modifier changes a transition without creating new material." },
    { id: "opp-resonance-disturbs-succession", source: "resonance", target: "succession", type: "disrupts", status: "known", conditions: ["a Resonance field hits an active patch"], op: { kind: "resetGrowth" }, exceptions: ["A Nurse Log absorbs one reset."], example: "Vibration disturbs a patch and resets its stage.", why: "Vibration disturbs the patch substrate and returns it to the pioneer state.", teaches: "The same disturbance rule applies wherever its declared area reaches." },
    { id: "opp-grading-drainage-disturbs-succession", source: "gradingDrainage", target: "succession", type: "disrupts", status: "known", conditions: ["a permanent cut, fill or terrace changes an active Pioneer Patch tile"], op: { kind: "resetGrowth" }, exceptions: ["A Nurse Log absorbs one reset."], example: "Regrading the patch's substrate resets its growth state; old growth is not recreated for free.", why: "The patch depends on its soil state. Changing that state is a disturbance, while the earth itself remains conserved.", teaches: "A state change may disrupt a dependent process without destroying its substrate." },
    { id: "opp-folding-dampens-sightline", source: "folding", target: "sightline", type: "dampens", status: "known",
      conditions: ["a folded panel occupies an intervening tile on a direct line and is adjacent to the target", "the line arrives from the panel's faced approach"], op: { kind: "foldCover", damageMultiplier: 0.5 }, exceptions: ["Affects direct line damage only; field and routed deliveries ignore it. Height 2+ clears it. Every other approach ignores the panel.", "Cover wears the panel: it tears at 0 protection."],
      example: "A Clear Shot from the faced approach crosses a folded panel and deals half damage; the panel tears a little.",
      why: "A panel is a hinge, not a wall: it turns exposure from one approach only.", teaches: "Visibility depends on arrangement." },
    { id: "opp-resonance-shakes-folding", source: "resonance", target: "folding", type: "disrupts", status: "known",
      conditions: ["a Resonance line delivery crosses a folded panel from its faced approach"], op: { kind: "foldShake", wearMultiplier: 2 }, exceptions: ["The line still resolves; only the panel's wear doubles."],
      example: "A Sympathetic Chord through a panel tears twice as much paper.",
      why: "Paper holds shape, not vibration: the support fails before the crease does.", teaches: "Failure follows dependencies." },
    { id: "opp-selectivity-filters-cipher", source: "selectivity", target: "cipher", type: "negates", status: "known",
      conditions: ["delivery = line", "the target holds a live Membrane"], op: { kind: "filterLine" },
      exceptions: ["Rushed membranes leave gaps: the mark gets through.", "Field and routed deliveries are not lines."],
      example: "A Redact aimed at a wrapped target never arrives; the Membrane holds.",
      why: "A filter is defined by what it passes: ink lines do not pass.", teaches: "Wrapping beats writing." },
    { id: "opp-cipher-exposes-deception", source: "cipher", target: "deception", type: "exposes", status: "known",
      conditions: ["the target's latest technique is deception"], op: { kind: "exposeDeceiver", factor: 1.3 },
      exceptions: ["Only cipher techniques expose; the mark alone does not."],
      example: "A Feint answered by Redact lands ×1.3: the record contradicts the lie.",
      why: "A written record contradicts a fresh lie.", teaches: "Lies have a shelf life." },
    { id: "opp-pruning-clears-thorn", source: "pruning", target: "thorn", type: "clears", status: "known",
      conditions: ["a live thorn tile is pruned as a hazard or foliage part"], op: { kind: "clearThorns" },
      exceptions: ["One tile per cut; the ring keeps the rest."],
      example: "Prune clears one thorn tile from the ring; the rest still bite.",
      why: "A named part can be removed.", teaches: "Growth is removable." },
    { id: "opp-thorn-taxes-pathway", source: "thorn", target: "pathway", type: "taxes", status: "known",
      conditions: ["a routed delivery crosses a live hostile thorn tile"], op: { kind: "thornTax", budgetAdd: 1 },
      exceptions: ["The grower's own side passes free; flyers pass over."],
      example: "A Detour through thorns spends 1 extra route budget per tile; a choked path fails.",
      why: "Every approach pays, including a routed one.", teaches: "Deterrence taxes routes." },
    { id: "opp-diffusion-dims-conjunction", source: "diffusion", target: "conjunction", type: "dims", status: "known",
      conditions: ["the burst target's latest technique is diffusion"], op: { kind: "dimStarlight", factor: 0.8 },
      exceptions: ["Only detonations dim; pings are too small to scatter."],
      example: "A star bursts on a scattering front for ×0.8: the diffuse wash dims it.",
      why: "A scattered front spreads starlight thin.", teaches: "Diffusion scatters focus." },
    { id: "opp-boundary-occults-conjunction", source: "boundary", target: "conjunction", type: "occults", status: "known",
      conditions: ["a hostile wall stands on the line from the caster to the star"], op: { kind: "occultStarlight" },
      exceptions: ["The star itself stands; only this fall is stopped."],
      example: "A Shield Wall occults the star: Starfall never leaves the chart.",
      why: "Walls block starlight lines.", teaches: "Light needs a clear line." },
  ];

  // Composition: ordered primary → secondary pairs.
  const composition = [
    { id: "comp-barrier-elasticity", source: "barrier", target: "elasticity", type: "transform", status: "known",
      conditions: ["primary Barrier, secondary Elasticity"],
      op: { kind: "enableEdge", edge: "opp-barrier-deflects-line" },
      exceptions: [], example: "Your walls become springy: a stopped line rebounds to its source at 50%." },
    { id: "comp-elasticity-barrier", source: "elasticity", target: "barrier", type: "transform", status: "known",
      conditions: ["primary Elasticity, secondary Barrier"],
      op: { kind: "storeImpact", fraction: 0.6 },
      exceptions: ["Released at the attacker's next turn start (a delayed effect)."],
      example: "Your walls soak a stopped line and release 60% of it at the attacker's next turn start." },
    { id: "comp-pathway-selectivity", source: "pathway", target: "selectivity", type: "augment", status: "known",
      conditions: ["primary Alternate Pathway, secondary Selectivity"],
      op: { kind: "routeBudget", add: 2 },
      exceptions: [], example: "Choosing routes selectively lets Detour travel 2 tiles further." },
    { id: "comp-selectivity-pathway", source: "selectivity", target: "pathway", type: "constrain", status: "known",
      conditions: ["primary Selectivity, secondary Alternate Pathway"],
      op: { kind: "routeBudget", add: -2 },
      exceptions: [], example: "A filter-first mind takes only short routes: Detour −2 route length." },
    { id: "comp-barrier-selectivity", source: "barrier", target: "selectivity", type: "unknown", status: "unknown",
      conditions: [], op: { kind: "none" }, exceptions: [], example: "Unauthored. No effect is invented." },
    { id: "comp-succession-swale", source: "succession", target: "swale", type: "augment", status: "known", conditions: ["primary Succession + secondary Swale; Pioneer Patch targets a Rain Garden tile"], op: { kind: "growthStageAdd", add: 1 }, exceptions: ["Growth caps at stage 3."], example: "A water-retaining secondary gives Pioneer Patch a one-stage head start.", why: "The Swale secondary supplies a conditional establishment bonus only on actively retained water.", teaches: "An ordered composition can transform initial conditions." },
    { id: "comp-swale-succession", source: "swale", target: "succession", type: "transform", status: "known", conditions: ["primary Swale + secondary Succession; Rain Garden is placed"], op: { kind: "nursePatch" }, exceptions: ["The patch occupies the first valid Rain Garden tile and still matures over time."], example: "A Rain Garden establishes a nurse patch where it takes root.", why: "The living secondary changes the output of a water-retaining placement.", teaches: "Reversing the order changes which operation is transformed." },
  ];

  // ── arenas. Fog of war hides tiles the player cannot see. Weather fog only shortens lines.
  const arenas = {
    gapCourt: {
      name: "The Gap Court",
      map: [
        ".........",
        "....#....",
        ".........",
        "..~.#.~..",
        ".........",
      ],
      note: "A 9×5 compression of the review's 13×8 'The Gap': one pillar line with a gap at (4,2), open lanes north and south.",
    },
    // Test arena: the gap is the only route, so one barrier encloses every route.
    sealedGap: {
      name: "Sealed Gap (test)",
      map: [
        "....#....",
        "....#....",
        ".........",
        "....#....",
        "....#....",
      ],
    },
  };

  // Archivist: permanent companion, with two visual forms sharing one kit.
  for(const [id,name,color,mechanism,scope,limits,lensId,lens] of [
    ["indexing","Indexing","#ddad58","Records observations so allies can retrieve and use what they know.","Reveals observations and strengthens a strike against a documented target.","Never invents hidden facts; damage scales only with revealed entries, capped at +50%.",
      "wideStacks",{name:"Wide Stacks",proficiency:1,rangeAdd:2,radiusAdd:1,potencyMul:0.8,trade:"+2 range and +1 Open Archive radius for −20% Cross Reference damage."}],
    ["preservation","Preservation","#7ec2b3","Protects a living record from damage and repairs what remains.","Temporary wards and bounded Life Force restoration for living allies.","Cannot revive defeated allies; wards expire and never stack their protection.",
      "closeHold",{name:"Close Hold",proficiency:1,rangeAdd:-1,potencyMul:1.25,trade:"Repair the Record and Protective Sleeve ×1.25, but 1 tile less range."}]]) {
    concepts[id]={name,color,mechanism,scope,limits,abilities:[],lens:{default:"balanced",profiles:{balanced:{name:"Balanced",proficiency:1,trade:"Fixed, bounded support."},[lensId]:lens}}};
    conceptDamageTypes[id]=id==="indexing" ? "albedo" : "rubedo";
  }
  const archivistMove=(id,name,concept,tier,effect,target,delivery,range,potency,area,mechanism)=>{
    abilities[id]={name,tier,concepts:[concept],effect,target,delivery,range,potency,area,cost:tier==="ultimate"?16:tier==="refined"?5:3,duration:1,effectCategory:"conditional",
      mechanism,reveal:mechanism,newEffect:effect,price:"Spends AP and ΦF; cannot revive or fabricate knowledge.",counter:"Break line of sight or move outside the field before it resolves.",teaches:"Knowledge and care change what allies can do next.",domains:["ideas","action","others"],announce:mechanism};
    concepts[concept].abilities.push(id);
  };
  archivistMove("indexEntry","Index Entry","indexing","basic","archivistIndex","enemy","line",5,0,{shape:"single"},"Reveal one previously hidden observation about a visible enemy for your team.");
  archivistMove("crossReference","Cross Reference","indexing","refined","archivistReference","enemy","line",5,10,{shape:"single"},"Strike a visible enemy for 10 base LF; each known observation adds 10% potency, capped at +50%.");
  archivistMove("openArchive","Open Archive","indexing","ultimate","archivistArchive","self","field",0,0,{shape:"radius",radius:3},"Reveal one hidden observation about each enemy within 3 tiles, sharing the entries with your team.");
  abilities.openArchive.cost = 12;   // least-used: kept the concept's ultimate (one-ult-per-concept invariant), priced down from 16 for the phi economy
  archivistMove("protectiveSleeve","Protective Sleeve","preservation","basic","archivistWard","ally","line",4,12,{shape:"single"},"Give a living ally a 12-point ward until their next turn; replacing a ward never adds its protection.");
  archivistMove("repairRecord","Repair the Record","preservation","refined","archivistHeal","ally","line",4,14,{shape:"single"},"Restore up to 14 LF to a living ally; cannot exceed their maximum or revive them.");
  archivistMove("livingArchive","Living Archive","preservation","ultimate","archivistShelter","self","field",0,0,{shape:"radius",radius:3},"All living allies within 3 recover up to 16 LF and gain a 12-point ward until their next turn.");

  // Craftsmanship (Mala, 2026-10-11): practice and care. Playable; held by the Mason. Rules: engine.js "Craftsmanship".
  // `craft` holds every number.
  concepts.craftsmanship = { name: "Craftsmanship", color: "#c9a26b", mechanism: "Take care before acting and repeat one technique until it is mastered; what is practised gets stronger.",
    mathIdea: "A learning curve: returns to repetition that rise quickly and then flatten, traded against the cost of specialising (every other technique erodes the gain).",
    learningPrompt: "What did the extra time buy, and what did choosing one technique to master cost you in options?",
    scope: "Self-preparation, a practice stack on one technique, and one strike that spends it.", limits: "Care cannot be taken under tempo debt; practice belongs to one technique and caps at 5 stacks.",
    abilities: ["measureTwice", "honedEdge", "masterwork"],
    craft: { careMul: 1.25, careAp: 10, perStack: 0.05, maxStacks: 5, lostOnOther: 1, masterBase: 12, masterPerStack: 4,
      // Graph relationships wired 2026-10-11 (ids in graph-data.js): a target that has adapted to the channel counts practice
      // as bluntedCap stacks; a Preservation ward placed by or on a craftsman lasts wellMadeTurns longer; Barrier primary with
      // Craftsmanship secondary dresses Shield Wall (more action points, more protection); Craftsmanship primary with Timing
      // secondary takes practisedApOff action points off the practised technique at full practice.
      bluntedCap: 1, wellMadeTurns: 1, dressed: { apAdd: 10, mul: 1.5 }, practisedApOff: 5,
      // Craftsman's Mindset (values trait; Mala, 2026-10-11): one more practice stack; no overclocking at all, for the
      // player as much as the AI (no borrowing against a future turn, no overclocked Strike or technique); and in
      // return everything it does properly is `baseMul` stronger (the potency and protection of every technique, and
      // the Strike). baseMul is Claude's number.
      mindset: { trait: "craftsmansMindset", stackAdd: 1, noOverclock: true, baseMul: 1.15 } },
    lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Even care and speed." }, patientHand: { name: "Patient Hand", proficiency: 1, potencyMul: 1.1, trade: "Masterwork and practised techniques ×1.1, for a more deliberate pace." } } } };
  conceptDamageTypes.craftsmanship = "albedo";
  const craftCommon = { effectCategory: "conditional", domains: ["ideas", "action", "self"], duration: 1 };
  abilities.measureTwice = { ...craftCommon, name: "Measure Twice", tier: "basic", concepts: ["craftsmanship"], delivery: "self", target: "self", area: { shape: "single" }, cost: 3, range: 0, potency: 0, effect: "craftCare",
    mechanism: "Care is time spent before the cut: your next technique this turn costs 10 more action points and has +25% potency.", newEffect: "status.care for the rest of the turn.",
    reveal: "Measure Twice costs tempo: a careful turn does one thing well instead of two things. It cannot be taken under tempo debt.", price: "3 ΦF, the action points to take it, and 10 more on the technique it improves.",
    counter: "Stun or displace them before the follow-up, or survive one strong hit and punish the empty turn.", teaches: "Quality is a trade against how much you can do." };
  abilities.honedEdge = { ...craftCommon, name: "Honed Edge", tier: "refined", concepts: ["craftsmanship"], delivery: "self", target: "self", area: { shape: "single" }, cost: 5, range: 0, potency: 0, effect: "craftHone",
    mechanism: "Practise the technique you used last: each use adds a practice stack (+5% potency each, 5 at most). Any other technique removes one.", newEffect: "actor.practice = { ability, stacks }.",
    reveal: "Honed Edge rewards doing one thing again and again, which is also the easiest thing to prepare for.", price: "5 ΦF, and the freedom to vary: every other technique costs a stack.",
    counter: "Deny its target so they must switch technique, or step out of its reach.", teaches: "Mastery narrows as it deepens." };
  abilities.masterwork = { ...craftCommon, name: "Masterwork", tier: "ultimate", concepts: ["craftsmanship"], delivery: "contact", target: "enemy", area: { shape: "single" }, cost: 16, range: 1, potency: 12, effect: "damage",
    announce: "I have done this ten thousand times.", mechanism: "Everything practised, delivered once: 12 piercing +4 per practice stack held (32 at most). It spends every stack.", newEffect: "damage = 12 + 4 × practice.stacks; practice.stacks = 0.",
    reveal: "Masterwork is only as strong as the practice behind it, and it empties the store.", price: "16 ΦF, an ultimate's charge, and all the practice you have built.",
    counter: "Stay out of reach, or make them switch technique so the stacks drain first.", teaches: "A masterpiece is the sum of the work nobody saw." };

  // Solfeggio (Mala, 2026-10-16 via the Ritual Chanter brief, class build 6/9): named tones held
  // to a purpose. Hold the Tone banks verses and knits nearby allies; Resonant Verse sings the banked
  // tones onto one enemy; the Full Chord is the siege hymn. Rites + the Long Chant are the Chanter's
  // class flesh-out (docs/class-sprint.md), not concept techniques.
  concepts.solfeggio = { name: "Solfeggio", color: "#c9a0dc", channel: "rubedo",
    mechanism: "Hold named tones that knit nearby allies and bank verses; sing the banked tones onto enemies.",
    mathIdea: "Matched vibration builds (sympathetic resonance); consonance is frequencies in simple ratio.",
    learningPrompt: "Which tone is being held, who does it reach, and what breaks the hold?",
    scope: "Healing fields around the holder; verse-scaled Rubedo strikes; a siege chord that heals allies and burns enemies.",
    limits: "Losing life force or moving more than 2 tiles in a turn breaks every held tone; verses cap at 3 and expire after 2 owner turns.",
    abilities: ["holdTone", "resonantVerse", "fullChord"],
    tones: { verseMax: 3, holdTurns: 2, moveBreak: 2, toneHeal: 2, verseBonus: 2, verseBonusMax: 6, chordHeal: 5, chordHurt: 5, chordTurns: 2, chordRadius: 3 },
    lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Even tones." }, drone: { name: "Drone", proficiency: 1, durationAdd: 1, trade: "Holds last +1 round; verses −2." } } } };
  conceptDamageTypes.solfeggio = "rubedo";
  const solfCommon = { effectCategory: "conditional", domains: ["ideas", "action"], duration: 1 };
  abilities.holdTone = { ...solfCommon, duration: 2, name: "Hold the Tone", tier: "basic", concepts: ["solfeggio"], delivery: "field", target: "self", area: { shape: "radius", radius: 3 }, cost: 4, range: 0, potency: 2, effect: "holdTone",
    domains: ["ideas", "action", "self"],
    mechanism: "Hold one named tone for 2 owner turns (up to 3 held): living allies within 3 recover 2 LF at each of your turn starts. Losing life force or moving more than 2 tiles in a turn breaks every held tone.",
    newEffect: "status.heldTones = { count, expiresAt }; heals tick at turn start.",
    reveal: "Hold the Tone shows its banked verses: the enemy can count exactly what a Verse would do.",
    price: "4 ΦF, and stillness: the holder stands and sings.",
    counter: "Deal any life-force damage to break the hold, or force them to move.",
    teaches: "Sustained support costs the freedom to act." };
  abilities.resonantVerse = { ...solfCommon, name: "Resonant Verse", tier: "refined", concepts: ["solfeggio"], delivery: "field", target: "enemy", area: { shape: "single" }, cost: 6, range: 4, potency: 7, effect: "verseDamage",
    mechanism: "Sing the banked tones onto one enemy within 4: 7 Rubedo +2 per held tone (at most +6). It spends every held tone.",
    newEffect: "damage = 7 + 2 × heldTones.count (cap +6); heldTones cleared.",
    reveal: "Resonant Verse is only as strong as the bank behind it, and it empties the bank.",
    price: "6 ΦF and every held tone.",
    counter: "Break the hold before the verse (any damage, or force a move), or be out of reach when it is sung.",
    teaches: "Banked work spends all at once." };
  abilities.fullChord = { ...solfCommon, duration: 2, name: "The Full Chord", tier: "ultimate", concepts: ["solfeggio"], delivery: "field", target: "self", area: { shape: "radius", radius: 3 }, cost: 15, range: 0, potency: 5, effect: "chordSustain",
    domains: ["ideas", "action", "self"],
    announce: "Hear it all at once.",
    mechanism: "The siege hymn, for 2 rounds: at each of your turn starts, living allies within 3 recover 5 LF and enemies within 3 take 5 Rubedo.",
    newEffect: "status.fullChord = { expiresAt }; ticks damage and healing at turn start.",
    reveal: "The Full Chord is a place, not a strike: leave the radius and it cannot touch you.",
    price: "15 ΦF and an ultimate's charge.",
    counter: "Move out of the radius, or defeat the singer: the chord dies with them.",
    teaches: "Held ground sings for whoever holds it." };

  // Discovery (Mala, 2026-10-16 via the Astronaut brief, class build 5/9): survey the unknown,
  // verify what you find, and put the finding to work. Survey plants rumors about hidden traps and
  // concealed enemies (25% point at nothing); Verify resolves them; Eureka reveals everything at once.
  // Passages and caches have no hidden-object substrate yet (docs/discovery.md) — traps and the
  // concealed are the honest targets. Survey ships unannounced (announce-as-modifier ruling).
  concepts.discovery = { name: "Discovery", color: "#7fd4c1", channel: "albedo",
    mechanism: "Survey the unknown, verify what you find, and put the finding to work.",
    mathIdea: "Search with verification: a find counts only when an independent check confirms it; unverified finds are rumors.",
    learningPrompt: "What was found, how was it verified, who used it first?",
    scope: "Finds and first uses: hidden traps and concealed enemies within survey range.",
    limits: "Finds what's there, never invents; rumors fade after 2 rounds; can't discover the already-known.",
    abilities: ["survey", "verify", "eureka"],
    finds: { rumorFalse: 0.25, rumorRounds: 2, surveyRange: 4, verifyRange: 4, eurekaRadius: 4, eurekaDamage: 8 },
    lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Patient survey." }, fieldJournal: { name: "Field Journal", proficiency: 1, potencyMul: 1.25, durationAdd: -1, trade: "Richer finds, faster-fading rumors." } } } };
  conceptDamageTypes.discovery = "albedo";
  const discCommon = { effectCategory: "conditional", domains: ["ideas", "action"], duration: 1 };
  abilities.survey = { ...discCommon, name: "Survey", tier: "basic", concepts: ["discovery"], delivery: "self", target: "self", area: { shape: "single" }, cost: 4, range: 0, potency: 0, effect: "survey",
    domains: ["ideas", "action", "self"],
    mechanism: "Read the field within 4: the nearest hidden trap or concealed enemy becomes a RUMOR (25% false — pointing at nothing; lasts 2 rounds). Fizzles, loudly, when nothing is hidden.",
    newEffect: "s.rumors[] += { tile, claimed, truth, expiresRound }; seeded truth roll.",
    reveal: "Survey shows its rumor tile to everyone: the enemy knows what you think you found.",
    price: "4 ΦF for intelligence that may be wrong.",
    counter: "Have nothing hidden. Move the concealed before Verify lands; rumors fade in 2 rounds.",
    teaches: "Unverified finds are rumors." };
  abilities.verify = { ...discCommon, name: "Verify", tier: "refined", concepts: ["discovery"], delivery: "signal", target: "tile", area: { shape: "single" }, cost: 6, range: 4, potency: 0, effect: "verify",
    mechanism: "Resolve one rumor your side planted on a tile within 4, in public: true finds become usable (traps known to your whole side, the concealed revealed); false ones clear as dead ends.",
    newEffect: "consume rumor; on truth: trapSeen[team] or unconceal.",
    reveal: "Verify is public: both sides learn whether the rumor was true.",
    price: "6 ΦF and a second action on the same find.",
    counter: "Move the concealed off the rumor tile before Verify resolves; wait out the 2 rounds.",
    teaches: "A find counts when an independent check confirms it." };
  abilities.eureka = { ...discCommon, name: "Eureka", tier: "ultimate", concepts: ["discovery"], delivery: "self", target: "self", area: { shape: "radius", radius: 4 }, cost: 16, range: 0, potency: 8, effect: "eureka",
    domains: ["ideas", "action", "self"],
    announce: "I found it. I FOUND it.",
    mechanism: "Reveal everything hidden within 4: enemy traps become known to your whole side, concealed enemies are revealed, and each revealed enemy takes 8 Albedo. Your own position is revealed too.",
    newEffect: "mass reveal + 8 albedo per revealed enemy; unconceal self.",
    reveal: "Eureka is announced and indiscriminate: the enemy sees the radius coming.",
    price: "16 ΦF, an announced window, and your own cover.",
    counter: "Be out of the radius when it resolves; have nothing hidden.",
    teaches: "Total survey costs total exposure." };

  // Folding (Origamist Track A, docs/origamist.md; playable 2026-10-16, muse): reversibly
  // rotate a bounded patch about a declared crease. Valley Fold lays a paper crossing (one
  // cheap, safe tile); Mountain Fold raises a cover panel facing one approach; A World Small
  // Enough to Hold does both on one tile. Panels are paper: cover wears them down and
  // Resonance shakes them apart (x2). Single tiles, not whole patches (docs/folding.md).
  concepts.folding = { name: "Folding", color: "#f2d38a",
    mechanism: "Reversibly rotate a bounded, connected surface patch about a declared crease, changing orientation, exposure and local contacts while the parts keep their identity.",
    mathIdea: "A hinge transformation: contact and facing change while parts keep identity; unfolding restores the original state exactly.",
    learningPrompt: "What does the crease connect, what does it face, and what holds it?",
    scope: "One tile per fold: a crossing, a one-facing cover panel, or both at once.",
    limits: "Single tiles, not whole patches; facing auto-declares toward the nearest enemy; panels last 2 owner turns; unfolding never moves anyone.",
    abilities: ["valleyFold", "mountainFold", "worldSmallEnough"],
    fold: { valleyProtection: 8, mountainProtection: 10, ultProtection: 12, cover: 0.5, duration: 2, range: 4 },
    lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Even creases." }, deepCrease: { name: "Deep Crease", proficiency: 2, durationAdd: 1, rangeAdd: -1, trade: "+1 owner turn; -1 fold range (proficiency 2)." } } } };
  const foldCommon = { effectCategory: "constructive", domains: ["ideas", "action", "others"], delivery: "placed", target: "tile", area: { shape: "single" } };
  abilities.valleyFold = { ...foldCommon, name: "Valley Fold", tier: "basic", concepts: ["folding"], cost: 4, range: 4, potency: 0, effect: "valleyFold", duration: 2,
    mechanism: "Fold one visible open tile within 4 inward: crossing it costs 1 move point and its entry hazard is muffled by paper, for 2 owner turns.",
    newEffect: "barrier { concept: foldCrossing, protection 8 }; surfaceAt: moveCost 1, hazard 0.",
    reveal: "The paper crossing is public: anyone may walk it, enemies included.",
    price: "4 PF for a floor anyone can use.",
    counter: "Walk around it; wait out the 2 turns; the crossing wears with use.",
    teaches: "A fold connects; it does not choose who crosses." };
  abilities.mountainFold = { ...foldCommon, name: "Mountain Fold", tier: "refined", concepts: ["folding"], cost: 6, range: 4, potency: 0, effect: "mountainFold", duration: 2,
    mechanism: "Fold one visible open tile within 4 outward: a paper panel rises that halves line damage crossing it toward an adjacent target from its faced approach, for 2 owner turns. The panel faces the nearest enemy; every line it softens wears it down.",
    newEffect: "barrier { concept: foldPanel, coverFraction 0.5, foldFacing, protection 10 }; cover chips it, Resonance chips double.",
    reveal: "The panel and its facing are public: the enemy sees which approach is covered.",
    price: "6 PF for one-sided cover that wears out.",
    counter: "Flank it (any other approach ignores it); shoot through it until it tears; shake it with Resonance.",
    teaches: "A wall facing is a promise about one direction only." };
  abilities.worldSmallEnough = { ...foldCommon, name: "A World Small Enough to Hold", tier: "ultimate", concepts: ["folding"], cost: 16, range: 4, potency: 0, effect: "worldSmallEnough", duration: 2,
    announce: "Everything large begins with one small fold.",
    mechanism: "One compound fold on a visible open tile within 4: a paper crossing AND a one-facing cover panel on the same tile for 2 owner turns. Replaces your previous fold.",
    newEffect: "barrier { concept: foldPanel, crossing + cover, protection 12 }; clears the caster's older folds.",
    reveal: "Announced: the enemy sees the compound fold coming and may reposition.",
    price: "16 PF, an announced window, and your previous fold.",
    counter: "Flank the facing; tear it down before the 2 turns pay off; move out during the window.",
    teaches: "Enormous problems, small enough to hold." };

  // Innovation (hollow kit, Muse 2026-10-14; playable 2026-10-16, muse): recombine known
  // elements into forms that do what none of them did alone. Prototype copies one witnessed
  // basic at ×0.7; Recombine fires two readied (equipped) basics as one action at ×0.7 each;
  // What If unfixes the kit for 2 announced rounds. Copies and fusions route through damaging
  // enemy-targeting basics only (docs/innovation.md) — the ×0.7 tax needs a potency to bite.
  concepts.innovation = { name: "Innovation", color: "#d8a24a", channel: "citrinitas",
    mechanism: "Recombines known elements into forms that do what none of them did alone: copies, fusions, and a shapeshifted kit.",
    mathIdea: "Combinatorial value: n knowns yield n² candidate pairs; the ×0.7 copying tax prices novelty.",
    learningPrompt: "What was combined, what did the combination do that no part did, and was the tax worth it?",
    scope: "One-use copies; two-into-one fusions; one kit-shapeshift.",
    limits: "Basics only; witnessed or known only; ×0.7 copying tax; never ultimates; needs freedom to assemble.",
    abilities: ["prototype", "recombine", "whatIf"],
    copy: { tax: 0.7, skunkworksTax: 0.8, whatIfRounds: 2 },
    lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Even novelty." }, skunkworks: { name: "Skunkworks", proficiency: 1, copyTax: 0.8, fuseNeed: 3, trade: "Copies at ×0.8; fusions need 3 readies." } } } };
  conceptDamageTypes.innovation = "citrinitas";
  const innoCommon = { effectCategory: "constructive", domains: ["ideas", "action"] };
  abilities.prototype = { ...innoCommon, name: "Prototype", tier: "basic", concepts: ["innovation"], delivery: "composite", target: "composite", area: { shape: "composite" }, cost: 4, range: 0, potency: 0, effect: "prototype",
    mechanism: "Try the new thing once, cheaply: play one witnessed damaging basic (any side's, seen this battle) as your own, at ×0.7 potency, otherwise unmodified. The original stays better.",
    newEffect: "copy { technique: witnessedBasic, mul: 0.7, once }.",
    reveal: "Prototype copies basics only, witnessed only, at ×0.7; the copy's shape is public at commit.",
    price: "4 ΦF for a rough copy.",
    counter: "Show nothing worth copying; punish the ×0.7 trade; the copy keeps the original's counters.",
    teaches: "New starts rough." };
  abilities.recombine = { ...innoCommon, name: "Recombine", tier: "refined", concepts: ["innovation"], delivery: "composite", target: "composite", area: { shape: "composite" }, cost: 6, range: 0, potency: 0, effect: "recombine",
    mechanism: "Fuse two knowns into one unknown: two of your readied (equipped) damaging basics fire at one target as a single action, ×0.7 each, each with its own channel.",
    newEffect: "fuse { count: 2, mul: 0.7, oneAction }.",
    reveal: "Recombine spends two readies for one action at ×0.7 each; both parts are public at commit.",
    price: "6 ΦF plus both readies: the fusion must beat the better half.",
    counter: "Deny the second ready (force or tax one basic); out-trade the ×0.7s.",
    teaches: "Two origins, one act." };
  abilities.whatIf = { ...innoCommon, name: "What If", tier: "ultimate", concepts: ["innovation"], delivery: "self", target: "self", area: { shape: "single" }, cost: 16, range: 0, potency: 0, effect: "whatIf",
    domains: ["ideas", "action", "self"],
    announce: "But what if—",
    mechanism: "Unfix the kit for 2 rounds, announced: each of your basics may be played as any other basic you know, paying that basic's cost. The enemy sees the pool too.",
    newEffect: "shapeshiftKit { basicsOnly, rounds: 2 }.",
    reveal: "What If reshapes basics only, known only, for 2 announced rounds.",
    price: "16 ΦF and the announced window.",
    counter: "Burst the 2 rounds; narrow the pool (seal or tax key basics).",
    teaches: "The kit is a draft." };

  // Imagination (Mala, 2026-10-11): no roster build is reassigned. These applications
  // rehearse and sustain finite possibilities rather than forge evidence or heal bodies.
  concepts.imagination = { name: "Imagination", color: "#c694f5", channel: null,
    mechanism: "Rehearse a possible arrival, then sustain a bounded imagined presence.",
    mathIdea: "A generative model explores possibilities; actual execution still needs resources and valid prerequisites.",
    learningPrompt: "Which part was imagined, and which conditions made it possible to act on?",
    scope: "One temporary summon-question rehearsal; finite wards; one lifetime extension per summoned incarnation.",
    limits: "No unlocks, free calls, duplicate creatures, revival or permanent duration. Wards replace rather than stack.",
    abilities: ["pictureTheArrival", "holdTheImage", "makeRoomForPossibility"],
    lens: { default: "balanced", profiles: { balanced: { name: "Balanced", proficiency: 1, trade: "Finite images, ordinary reach and cost." }, widerImage: { name: "Wider Image", proficiency: 1, radiusAdd: 1, potencyMul: 0.75, trade: "+1 shelter radius with ×0.75 ward protection; rehearsal, duration extension and emergent benefits unchanged." } } } };
  conceptDamageTypes.imagination = null;
  const imagineCommon = { concepts: ["imagination"], delivery: "self", target: "self", range: 0, potency: 0,
    effectCategory: "constructive", domains: ["ideas", "action", "self", "others"] };
  abilities.pictureTheArrival = { ...imagineCommon, name: "Picture the Arrival", tier: "basic", cost: 4, area: { shape: "single" }, effect: "imaginedRehearsal",
    mechanism: "Rehearse your next summon question: remove one wrong choice before your next turn. Another rehearsal replaces this one.",
    newEffect: "One actor-owned question hint, consumed by a successful summon or expired at the next owner turn.",
    targetRule: "Caster only.", potencyDefinition: "One wrong option removed from the next summon question; at least two choices remain.", expiry: "Consumed by a completed paid call or expires at the caster's next turn.",
    reveal: "A rehearsed possibility gives a hint, not an automatic correct answer or an unlocked creature.",
    price: "25 AP and 4 ΦF before the call; a cancelled call does not refund the rehearsal.",
    counter: "Deny arrival tiles or the remaining call resources until the rehearsal expires.", teaches: "Mental rehearsal supports execution but does not replace it." };
  abilities.holdTheImage = { ...imagineCommon, name: "Hold the Image", tier: "refined", cost: 6, potency: rules.imagination.shelterWard, delivery: "field", area: { shape: "radius", radius: 2 }, effect: "imaginedShelter",
    mechanism: "Give yourself and your own living summons within 2 tiles an 8-point ward until each recipient's next turn.",
    newEffect: "One ward per recipient, retaining a stronger existing ward; no added protection and no healing.",
    targetRule: "Caster and their own living summons within 2 in the same unsealed region.", potencyDefinition: "8 protection, replacing rather than adding to an existing ward.", expiry: "Each recipient's next turn.",
    reveal: "Only the caster and their own summons inside the unsealed area receive protection.",
    price: "35 AP and 6 ΦF; the image must be rebuilt after it expires or breaks.",
    counter: "Separate the summons from the caster, seal the dream edge, strip the ward or overwhelm its finite protection.", teaches: "Sustaining an image takes effort and has a limited reach." };
  // Fixed Gaze (hotbuilds W1b; the Hypnotist's reactive answer, HOTBUILDS.md section 2): fires the held Hold the
  // Image ward as the answer. Pair-gated to focus+imagination (his pair; nobody holds it until W1c). Primed whole
  // against the Fixed foe (Off-tempo), an ordinary rushed answer otherwise (engine/window.js). Covering an ally
  // within 2 waits for W1c: the window only seats defenders the attack selects. W1c (Mala's ruling): the image is
  // prepaid (Hold the Image), so firing it is the aim — tempoCost 10 (≈5 AP reaction), no ΦF.
  abilities.fixedGaze = { name: "Fixed Gaze", tier: "refined", concepts: ["focus", "imagination"], pairOnly: true, pairs: [["focus", "imagination"]],
    delivery: "self", target: "self", mechanism: "Fire the held image at the shot you see coming: the ward meets it whole if the shooter is the foe you have Fixed (and the shooter loses its rhythm for a round), half if it is anyone else.",
    cost: 0, tempoCost: 10, range: 0, potency: 0, protection: 8, effect: "barrier", effectCategory: "conditional", reactive: true, answerOnly: true, expiry: "ownerNextTurnStart",
    reveal: "Fixed Gaze answers only while the Hold the Image ward is held. Primed against the Fixed foe (whole ward, Off-tempo: the attacker's last technique is forbidden for a round); rushed against anyone else. It also covers an unwarded ally within 2.",
    prompt: "Who is the gaze fixed on when the shot comes?" };
  abilities.secondGaze = { name: "Second Gaze", tier: "basic", concepts: ["focus"],
    delivery: "line", target: "enemy", area: { shape: "single" }, mechanism: "Fix a second foe this turn with no action: hold two marks at once (either primes Fixed Gaze).",
    cost: 0, tempoCost: 0, inspirationPrice: 1, range: 5, potency: 0, effect: "secondGaze", effectCategory: "conditional", duration: 1,
    reveal: "Second Gaze fixes a second foe this turn. No action, 1 Inspiration." };
  abilities.makeRoomForPossibility = { ...imagineCommon, name: "Make Room for Possibility", tier: "ultimate", cost: 16, potency: rules.imagination.possibilityWard, delivery: "field", area: { shape: "radius", radius: 3 }, effect: "imaginedCompany", timing: "announced",
    announce: "There is room for what we have not yet become.",
    mechanism: "Give yourself and your own living summons within 3 a 10-point ward; those summons gain one remaining turn, once per incarnation.",
    newEffect: "Bounded wards plus summon.imaginedExtension prevents repeated duration additions; Dream Space still imposes its normal closing linger.",
    targetRule: "Caster and their own living summons within 3 in the same unsealed region.", potencyDefinition: "10 protection and one extra remaining summon turn once per incarnation.", expiry: "Ward: recipient's next turn. Duration extension: lasts only until the summon leaves.",
    reveal: "This sustains actual summoned presences: it cannot call, clone or revive anyone.",
    price: "50 AP, 16 ΦF and full ULT; another use may replace wards but cannot extend the same incarnation again.",
    counter: "Defeat or separate summons before the image forms; strip wards or wait out their finite lifetime.", teaches: "Possibility becomes useful through bounded commitment, not unlimited wish fulfillment." };

  // ── characters + the demo encounter ───────────────────────────────────────
  const characters = {
    archivist:{name:"The Archivist",side:"player",permanentAlly:true,sprite:"archivist",variants:["archivist","archivist-kaiba"],level:1,xp:0,ai:"archivist",posture:"protective",traits:["empathic","curious","collaborative"],primary:"indexing",secondary:"preservation",reserve:[],lens:{indexing:"balanced",preservation:"balanced"},conceptPool:["indexing","preservation"],configs:[{id:"archivist-records",label:"Indexing + Preservation",primary:"indexing",secondary:"preservation",reserve:[],lens:{}}]},
    warden: { name: "Warden", side: "player", sprite: "neo-warden", variants:["neo-warden","warden"], spritePackageNames:{"neo-warden":"Neo Warden",warden:"Classic Warden"}, level: 1, xp: 0,
      primary: "barrier", secondary: "elasticity", reserve: ["selectivity"], traits: ["mainCharacterEnergy"],   // never flees (Mala, 2026-10-15)
      lens: { barrier: "balanced", elasticity: "balanced", selectivity: "balanced" } },
    pathfinder: { name: "Pathfinder", side: "enemy", sprite: "pathfinder", level: 1, xp: 0,
      primary: "pathway", secondary: "selectivity", reserve: [],
      lens: { pathway: "balanced", selectivity: "balanced" }, ai: "pathfinder",
      conceptPool: ["pathway", "selectivity", "berm"], configs: [
        { id: "pathfinder-routes", label: "Alternate Pathway + Selectivity", primary: "pathway", secondary: "selectivity", reserve: [], lens: {} },
        { id: "pathfinder-berm", label: "Berm + Alternate Pathway", primary: "berm", secondary: "pathway", reserve: [], lens: {} },
      ] },
    sieve: { name: "Sieve", side: "enemy", sprite: "sieve", level: 1, xp: 0,
      primary: "selectivity", secondary: "pathway", reserve: [],
      lens: { selectivity: "balanced", pathway: "balanced" }, ai: "sieve",
      conceptPool: ["selectivity", "pathway", "sightline"], configs: [
        { id: "sieve-filter", label: "Selectivity + Alternate Pathway", primary: "selectivity", secondary: "pathway", reserve: [], lens: {} },
        { id: "sieve-view", label: "Sightline + Selectivity", primary: "sightline", secondary: "selectivity", reserve: [], lens: {} },
      ] },
    // Tofu trio (Muse Berry BD hot-build, 2026-10-29): a yokai-anchored enemy pack. Spawn linkage in
    // random-events.js (tofuPack); art in sprites/tofu-{yokai,archer,warden}/ (registered 2026-11-08). Names provisional for Mala.
    tofu_yokai: { name: "Tofu Yokai", side: "enemy", sprite: "tofu-yokai", level: 1, xp: 0, randomEventOnly: true,
      primary: "deception", secondary: "stealth", reserve: [], lootTable: "tofu",
      lens: { deception: "balanced", stealth: "balanced" }, ai: "tofu_yokai", traits: ["reckless"],
      conceptPool: ["deception", "stealth", "inertia"], configs: [
        { id: "tofu_yokai-tricks", label: "Deception + Stealth", primary: "deception", secondary: "stealth", reserve: [], lens: {} },
        { id: "tofu_yokai-wobble", label: "Deception + Inertia", primary: "deception", secondary: "inertia", reserve: [], lens: {} },
      ] },
    tofu_archer: { name: "Tofu Archer", side: "enemy", sprite: "tofu-archer", level: 1, xp: 0, randomEventOnly: true,
      primary: "sightline", secondary: "threshold", reserve: [], lootTable: "tofu",
      lens: { sightline: "balanced", threshold: "balanced" }, ai: "tofu_archer", traits: ["protective"],
      conceptPool: ["sightline", "threshold", "deception"], configs: [
        { id: "tofu_archer-warden", label: "Sightline + Threshold", primary: "sightline", secondary: "threshold", reserve: [], lens: {} },
        { id: "tofu_archer-trickshot", label: "Sightline + Deception", primary: "sightline", secondary: "deception", reserve: [], lens: {} },
      ] },
    tofu_warden: { name: "Tofu Warden", side: "enemy", sprite: "tofu-warden", level: 1, xp: 0, randomEventOnly: true,
      primary: "boundary", secondary: "inertia", reserve: [], lootTable: "tofu",
      lens: { boundary: "balanced", inertia: "balanced" }, ai: "tofu_warden", traits: ["protective"],
      conceptPool: ["boundary", "inertia"], configs: [
        { id: "tofu_warden-gate", label: "Boundary + Inertia", primary: "boundary", secondary: "inertia", reserve: [], lens: {} },
        { id: "tofu_warden-mass", label: "Inertia + Boundary", primary: "inertia", secondary: "boundary", reserve: [], lens: {} },
      ] },
    // Maricha (Surpanakha flee chain S1; R-20261108-06: story-only, thin, until a later hot-build). Arrives only through her flee chain.
    maricha: { name: "Maricha", side: "enemy", sprite: "mutant-boar", level: 1, xp: 0, randomEventOnly: true,   // stand-in until the golden deer sheet is cut (sprite request on the board)
      primary: "deception", secondary: "plasticity", reserve: [],
      lens: { deception: "balanced", plasticity: "balanced" }, traits: ["fearful", "dutiful"],
      conceptPool: ["deception", "plasticity", "glamour"], configs: [
        { id: "maricha-deer", label: "Deception + Plasticity", primary: "deception", secondary: "plasticity", reserve: [], lens: {} },
        { id: "maricha-gold", label: "Deception + Glamour", primary: "deception", secondary: "glamour", reserve: [], lens: {} },
      ] },
    student: { name: "Student", side: "enemy", sprite: "student", level: 1, xp: 0,
      primary: "selectivity", secondary: null, reserve: [],
      lens: { selectivity: "balanced" }, ai: "student",
      conceptPool: ["selectivity", "sightline", "barrier", "inertia"], configs: [
        { id: "student-filter", label: "Selectivity + Sightline", primary: "selectivity", secondary: "sightline", reserve: [], lens: {} },
        { id: "student-view", label: "Sightline + Selectivity", primary: "sightline", secondary: "selectivity", reserve: [], lens: {} },
        { id: "student-anchor", label: "Inertia + Selectivity", primary: "inertia", secondary: "selectivity", reserve: [], lens: {} },
      ] },
    // Named NPCs have authored concept pools and multiple legal loadouts.
    // Roster battles choose one configuration per NPC from a replay seed.
    arborist: npc("Arborist", "barrier", ["boundary", "berm", "swale", "pathway", "pruning"], ["warden", "berm"], "earthkeeper"),
    surveyor: npc("Surveyor", "sightline", ["adaptation", "pathway", "selectivity", "berm", "focus"], ["sightline", "pathway"], "ranger"),
    rainkeeper: npc("Rainkeeper", "swale", ["diffusion", "barrier", "berm", "pathway"], ["swale", "barrier"], "rain"),
    mason: npc("Mason", "berm", ["boundary", "barrier", "elasticity", "swale"], ["barrier", "berm"], "mason"),
    ecologist: npc("Ecologist", "swale", ["threshold", "selectivity", "pathway", "sightline"], ["selectivity", "swale"], "ecology"),
    planner: npc("Planner", "pathway", ["resonance", "sightline", "barrier", "selectivity"], ["pathway", "sightline"], "planner"),
    gardener: npc("Gardener", "swale", ["adaptation", "diffusion", "elasticity", "selectivity", "berm", "pruning"], ["swale", "selectivity"], "gardener"),
    // Grok's 2026-10-08 class draft: all draw only from the existing landscape/concept lexicon.
    // Mala, 2026-10-16: the Actor alternates costumes on spawn — megastar (M) and regal (F).
    // First spawn is a seeded coin flip; a second live Actor wears the opposite (engine.js actorLook, director.js cameo).
    actor: { ...npc("Actor", "deception", ["threshold", "resonance"], ["deception", "threshold"], "actor"),
      variants: ["actor-m", "actor-f"], traits: ["methodActing", "theLook", "humanExperience"] },   // respec 2026-10-16: rulings in docs/actor-respec-rulings.md
    supermodel: npc("Supermodel", "sightline", ["selectivity", "focus"], ["sightline", "selectivity"], "supermodel"),
    agi: npc("Artificial General Intelligence", "adaptation", ["pathway", "selectivity"], ["adaptation", "pathway"], "agi"),
    scientist: npc("Scientist", "threshold", ["sightline", "adaptation", "focus"], ["threshold", "sightline"], "scientist"),
    animalTamer: npc("Animal Tamer", "resonance", ["diffusion", "swale"], ["resonance", "diffusion"], "animal-tamer"),
    architect: npc("Architect", "berm", ["boundary", "sightline"], ["berm", "boundary"], "architect"),
    soldier: npc("Soldier", "inertia", ["barrier", "threshold"], ["inertia", "barrier"], "soldier"),
    policeOfficer: npc("Police Officer", "boundary", ["threshold", "focus", "sightline"], ["boundary", "threshold"], "police-officer"),
    yogaInstructor: npc("Yoga Instructor", "elasticity", ["inertia", "resonance"], ["elasticity", "inertia"], "yoga-instructor"),
    // Mala, 2026-10-08: "arantxa has several different variants, when she shows up as an ally it should pick a set
    // randomly from the options". Each variant is a full pose set (Grok's gowns); the engine picks one per battle.
    arantxa: { ...npc("Arantxa", "deception", ["selectivity", "adaptation", "threshold"], ["deception", "selectivity"], "arantxa"),
      variants: ["arantxa", "arantxa-seijaku", "arantxa-hydrozoa", "arantxa-cathedral", "arantxa-wave", "arantxa-ivory"] },
    odysseus: { name: "Odysseus", side: "enemy", sprite: "odysseus", level: 1, xp: 0, ai: "odysseus", classPack: true,
      primary: "strategic_commitment", secondary: "pathway", reserve: [], lens: { strategic_commitment: "balanced", pathway: "balanced" },
      conceptPool: ["strategic_commitment", "pathway"], configs: [{ id: "odysseus-home", label: "Strategic Commitment + Alternate Pathway", primary: "strategic_commitment", secondary: "pathway", reserve: [], lens: {} }] },
    president: npc("President", "legitimacy", ["strategic_commitment"], ["strategic_commitment"], "president"),
    // The Director (Mala, 2026-10-14/15): Boundary + Delegation, wheel Collage. director-1 is the filming pair.
    director: npc("Director", "boundary", ["delegation", "collage"], ["delegation", "collage"], "director"),
    // Class sprint (Mala, 2026-10-16): shelf builds at concept level — live concept pairs only, signature
    // mechanics queued in docs/class-sprint.md. Interim pairs where the concept isn't authored yet.
    mycologist: npc("Mycologist", "succession", ["diffusion"], ["diffusion"], "mycologist"),
    hacker: npc("Hacker", "software", ["deception", "inference"], ["deception", "inference"], "hacker"),
    sailor: npc("Sailor", "diffusion", ["tension", "swale"], ["tension", "swale"], "sailor"),
    astronaut: npc("Astronaut", "constraint", ["fault_tolerance"], ["fault_tolerance"], "astronaut"),
    ritual_chanter: npc("Ritual Chanter", "threshold", ["timing"], ["timing"], "ritual-chanter"),
    mangaka: { ...npc("Mangaka", "collage", ["innovation"], ["innovation"], "mangaka"), traits: ["sampler"] },   // Collage + Innovation, Sampler (Mala, 2026-10-18; was Collage + Deception)
    android_maker: npc("Android Maker", "hardware", ["preservation", "craftsmanship"], ["preservation", "craftsmanship"], "android-maker"),
    origamist: npc("Origamist", "adjacency", ["tension"], ["tension"], "origamist"),
    // Hot builds wave 1 (Mala, 2026-10-16): concept-level launches tracked in docs/hot-builds.md.
    celestial_priestess: npc("Celestial Priestess", "harmony", ["sightline"], ["sightline"], "celestial_priestess"),
    cyanotype_artist: npc("Cyanotype Artist", "craftsmanship", ["sightline"], ["sightline"], "cyanotype_artist"),
    new_oni: npc("New Oni", "leverage", ["resonance"], ["resonance"], "new_oni"),
    artemesia: npc("Queen Artemesia", "sightline", ["diffusion"], ["diffusion"], "artemesia"),
    // Hot builds wave 3 (Mala, 2026-10-17: "build hot builds for the sprites that were cut today"; docs/hot-builds.md).
    // Concept level: a live pair, the full sprite package, a voice and a tell. Pairs follow Muse's HOT BUILD specs where
    // they exist (FBI, Telekinetic, Deep-Sea, Black Armor, Oni Yokozuna), with Compression & Release (not live) overruled.
    fbi_agent: npc("FBI Agent", "inference", ["legitimacy"], ["legitimacy"], "fbi_agent"),
    telekinetic_hero: npc("Telekinetic Hero", "focus", ["leverage"], ["leverage"], "telekinetic_hero"),
    deepsea_warrior: npc("Deep-Sea Warrior", "stealth", ["elasticity"], ["elasticity"], "deepsea_warrior"),
    black_armor: npc("Black Armor", "inertia", ["constraint"], ["constraint"], "black_armor"),
    oni_yokozuna: npc("Oni Yokozuna", "tension", ["inertia"], ["inertia"], "oni_yokozuna"),
    black_swan_warrior: npc("Black Swan Warrior", "discovery", ["adaptation"], ["adaptation"], "black_swan_warrior"),
    forest_spirit: npc("Forest Spirit", "succession", ["harmony"], ["harmony"], "forest_spirit"),
    neon_dj: npc("Neon DJ", "solfeggio", ["timing"], ["timing"], "neon_dj"),
    cloaked_drifter: npc("Cloaked Drifter", "stealth", ["hardware"], ["hardware"], "cloaked_drifter"),
    neon_idol: npc("Neon Idol", "lyricism", ["sightline"], ["sightline"], "neon_idol"),
    jpop_idol: npc("J-Pop Idol", "resonance", ["plasticity"], ["plasticity"], "jpop_idol"),
    mao_zedong: npc("Mao Zedong", "strategic_commitment", ["diffusion"], ["diffusion"], "mao_zedong"),
    ember_judge: npc("Ember Judge", "legitimacy", ["pruning"], ["pruning"], "ember_judge"),
    devouring_mother: npc("Devouring Mother", "dependency", ["preservation"], ["preservation"], "devouring_mother"),
    tactical_operative: npc("Tactical Operative", "sightline", ["delegation"], ["delegation"], "tactical_operative"),
    // Control v1 (Muse, 2026-10-20): the benchmark instrument, not a game character. Fixed kit
    // (sightline+barrier), traits [brave] only, no configs — configs-lessness keeps her out of random
    // draws, setup pickers, boss-rush allies, the threat board, themed lineups, and the audition pool
    // (all filter on configs). Brave because an instrument that flees hands out free wins (she fled
    // 23/32 shakedown duels traitless). FROZEN: the kit identity never changes; numbers follow
    // global tuning. Spec: docs/control.md. Field only via explicit participants (sims, tests, dev).
    control: { name: "Control", side: "enemy", sprite: "control", level: 1, xp: 0,
      primary: "sightline", secondary: "barrier", reserve: [],
      lens: { sightline: "balanced", barrier: "balanced" }, ai: "control", traits: ["brave"] },
    // W5.3 Sage: a CASTING on the frozen Control chassis (same pair/kit/traits,
    // no configs/pool — same invisibility). Fieldable only via explicit
    // participants (sims, tests, dev, Teach). Sprite: control until drawn (F12).
    sage: { name: "Sage", side: "enemy", sprite: "control", level: 1, xp: 0,
      primary: "sightline", secondary: "barrier", reserve: [],
      lens: { sightline: "balanced", barrier: "balanced" }, ai: "sage", traits: ["brave"],
      castingOf: "control", subfaction: "rogues" },
    // Hot builds wave 2 (Mala, 2026-10-16): concept-level launches tracked in docs/hot-builds.md.
    // Shaman + Hedge Witch overrule the shelf specs' secondaries (Hospitality and Herbal Medicine
    // are not live concepts): Preservation keeps the ancestors, Succession grows the hedge.
    frogan: npc("Frogan", "boundary", ["threshold"], ["threshold"], "frogan"),
    shaman: npc("Shaman", "threshold", ["preservation"], ["preservation"], "shaman"),
    hedge_witch: npc("Hedge Witch", "boundary", ["succession"], ["succession"], "hedge_witch"),
    robot_mechanic: npc("Robot Mechanic", "software", ["delegation"], ["delegation"], "robot_mechanic"),
    // Intergalactic visitors P1 (Mala, 2026-10-16): a random-event retrieval crew, never rostered.
    // The Grey aims (Sightline) and keeps the manifest (Selectivity); the ship is hull and patience.
    visitor_grey: npc("Special Agent Grey", "sightline", ["selectivity", "focus"], ["selectivity"], "visitor-grey"),
    visitor_ship: npc("Visitor Ship", "barrier", ["inertia"], ["inertia"], "visitor-ship"),
    visitor_scientist: npc("Visiting Scientist", "preservation", ["selectivity", "barrier"], ["selectivity"], "visitor-scientist"),
  };
  Object.assign(characters.president, { primary: "legitimacy", secondary: "strategic_commitment", reserve: [], lens: { legitimacy: "balanced", strategic_commitment: "balanced" } });
  Object.assign(characters.director, { traits: ["attentionToDetail", "directorsVision", "knowsPeople"] });
  Object.assign(characters.cyanotype_artist, { side: "player", permanentAlly: true });   // Mala 2026-10-16: the Cuban Artist is the Cyanotype Artist, a PERMANENT ALLY (never hostile)
  Object.assign(characters.visitor_grey, { side: "visitors", randomEventOnly: true });   // Intergalactic visitors P1: their own side, event arrivals only
  Object.assign(characters.visitor_ship, { side: "visitors", randomEventOnly: true });
  Object.assign(characters.visitor_scientist, { side: "visitors", randomEventOnly: true });
  // Sub-factions (Mala, 2026-10-17; membership tests 2026-10-22). Themed crews for themed battles
  // and multi-sided melee. Every class belongs to exactly one. The blurb is the test a new
  // character has to pass. Placement is part of the build: docs/subfactions.md.
  // States (Mala, 2026-10-24; docs/state-kit.md, engine/states.js): conditions a unit can be in, one row each, data only.
  // tools/check-states.mjs refuses a row that cannot end.
  const states = {
    // Nonlethal victory (ready-to-review/claude-ajin-specs NONLETHAL.md N1 and N2; Mala approved 2026-10-31): a bounded loss of agency. Applying it
    // costs no LF, so no lethal or recovery trigger fires from the incapacitation itself; the holder can still be struck, and a later lethal blow
    // resolves as for anyone. It cannot be extended (refusesGrant itself), and a unit that wakes is steadied for a turn, so it cannot be chained
    // into a lock (Mala's rule 3: no indefinite immunity, and so no indefinite incapacity). The clock cap (max) is the builder constant: 2 own turns.
    incapacitated: { name: "Incapacitated", text: "Cannot act for up to 2 of their turns. No LF is lost, and a later blow still lands.",
      why: "A fighter who cannot act is not a fighter who is dead: survival, agency and victory are separate dimensions.",
      gate: { blocks: ["all"], reason: "they are incapacitated" }, clock: { counts: "ownerTurns", n: 2, max: 2, then: [{ grant: "steadied", to: "self", turns: 0 }] }, refusesGrant: ["incapacitated", "suggestedHold"] },
    steadied: { name: "Steadied", text: "Just recovered: cannot be incapacitated again for a turn.", why: "Waking is not the start of the next stun: incapacitation does not chain.",
      hidden: true, clock: { counts: "ownerTurns", n: 1 }, refusesGrant: ["incapacitated", "suggestedHold"] },
    // Hanuman (Mala, 2026-10-24; docs/hanuman-build.md). Three forms, one at a time (group "hanumanForm"), switched free once a
    // turn; base and giant cannot Vanish, the monkey can (the scout and infiltrator). Numbers are provisional until simmed.
    hanumanBase: { name: "Base form", text: "Hanuman as he serves Rama: a warrior with a mace.", why: "Valmiki: the devoted messenger who fights beside Rama.",
      group: "hanumanForm", gate: { blocks: ["ability:vanish"], reason: "only the small monkey slips out of sight" } },
    hanumanMonkey: { name: "Monkey form", text: "Small and quick: moves farther, reports what he sees, can Vanish, but hits for a tenth.", why: "Valmiki, Sundara Kanda: he shrinks to a cat's size to search Lanka unseen.",
      group: "hanumanForm", body: { sprite: "hanuman-chibi", traits: ["restless", "scout"], moveAdd: 2 }, mods: [{ on: "dealt", mult: 0.1 }] },
    hanumanGiant: { name: "Giant form", text: "Huge and slow: cannot be held or shoved, more LF, hits harder.", why: "Valmiki: he grows to the size of a mountain to cross the sea and face Lanka.",
      group: "hanumanForm", body: { sprite: "hanuman-giant", massive: true, moveAdd: -1, maxLFAdd: 20 }, mods: [{ on: "dealt", mult: 1.3 }],
      gate: { blocks: ["ability:vanish"], reason: "a giant cannot hide" } },
    // Lakshmana (Mala, 2026-10-24; docs/lakshmana-build.md). The Rekha protects any ally (rule 6), Sita far more; it breaks when the
    // ally steps out (Ravana's trick) or Lakshmana goes more than 3 away, or a blow of 30 tears it. He is felled, not slain, once.
    lakshmanaRekha: { name: "Lakshmana Rekha", text: "Inside the line drawn for them: takes x0.6 while they stay put and Lakshmana stays near.",
      why: "Valmiki tradition: the line Lakshmana drew around Sita's hut; she was safe until she stepped across it.",
      mods: [{ on: "taken", mult: 0.6 }], breakers: [{ moved: true }, { apart: 3 }, { hurt: 30 }] },
    lakshmanaRekhaSita: { name: "Lakshmana Rekha", text: "The line drawn for Sita herself: takes x0.3 while she stays inside and Lakshmana stays near.",
      why: "The story's own line: drawn for Sita, it held against Ravana until she stepped out.",
      mods: [{ on: "taken", mult: 0.3 }], breakers: [{ moved: true }, { apart: 3 }, { hurt: 30 }] },
    lakshmanaUnfallen: { name: "Saumitri", text: "Once a battle, the blow that would kill him leaves him felled at 1 LF instead.", why: "Yuddha Kanda: Indrajit's Shakti fells Lakshmana; he does not die.",
      hidden: true, triggers: [{ on: "lethal", limit: 1, do: [{ grant: "lakshmanaFelled", to: "self" }, { remove: "lakshmanaUnfallen" }] }] },
    lakshmanaFelled: { name: "Felled", text: "Down at 1 LF: cannot act and takes x0.25 for 2 turns. Any heal of 10 or more (Sanjeevani) raises him at once.",
      why: "Yuddha Kanda: felled by the Shakti, he lies still until Hanuman brings the mountain.",
      gate: { blocks: ["all"], reason: "he is felled" }, clock: { counts: "ownerTurns", n: 2 }, mods: [{ on: "taken", mult: 0.25 }],
      breakers: [{ healed: 10, do: [{ scene: { title: "Lakshmana Rises", line: "The herb mountain's breath reaches him, and Lakshmana stands." } }] }] },
    // Jatayu (Mala, 2026-10-24; docs/jatayu-build.md). He arrives late by design (circling for one turn, then he comes down hard), and
    // when he falls he marks whoever killed him (he lived long enough to tell Rama which way Ravana went).
    jatayuAloft: { name: "Circling", text: "High above the field: he does nothing his first turn, then comes down hard (x1.3 dealt for 2 rounds).",
      why: "Valmiki, Aranya Kanda: the old vulture king sees the chariot from the sky and comes down to stop it.",
      gate: { blocks: ["all"], reason: "he is circling high above" }, clock: { counts: "ownerTurns", n: 1, then: [{ grant: "jatayuStoop", to: "self" }, { scene: { title: "The Vulture King Stoops", line: "Out of the sun, on the chariot." } }] },
      breakers: [{ hurt: 1, do: [{ grant: "jatayuStoop", to: "self" }] }] },
    jatayuStoop: { name: "Stooping", text: "Coming down out of the sun: x1.3 dealt for 2 rounds.", why: "He was old, and he fought anyway.",
      mods: [{ on: "dealt", mult: 1.3 }], clock: { counts: "rounds", n: 2 } },
    jatayuLastWord: { name: "Last word", text: "When he falls, his killer is marked for his side.", why: "He lived long enough to tell Rama which way Ravana went.",
      triggers: [{ on: "defeat", limit: 1, do: [{ grant: "jatayuMarked", to: "source" }, { scene: { title: "Jatayu's Last Word", line: "\"South... he went south.\" The vulture king points the way." } }] }] },
    jatayuMarked: { name: "Marked by Jatayu", text: "The vulture king pointed them out: x1.25 taken for 3 rounds.", why: "The last thing he did was show the way.",
      mods: [{ on: "taken", mult: 1.25 }], clock: { counts: "rounds", n: 3 } },
    // Surpanakha (Mala, 2026-10-24; docs/surpanakha-build.md). She opens in a lovely guise that drops when she is struck; whoever
    // wounds her carries her grudge, Lakshmana (who cut her) deepest (rule 6); her cry sends Lanka after them.
    surpanakhaGuise: { name: "Lovely guise", text: "A lovely shape: foes hit her for x0.7. The first blow shows her true shape.",
      why: "Valmiki, Aranya Kanda: Surpanakha takes a beautiful form to woo Rama.",
      mods: [{ on: "taken", mult: 0.7 }], breakers: [{ hurt: 1, do: [{ grant: "surpanakhaTrue", to: "self" }, { scene: { title: "The Guise Falls", line: "The lovely shape tears away: her own face, and her fury." } }] }] },
    // Surpanakha flee chain S1 (cursor-surpanakha-flee-chain-spec; R-20261107-07, R-20261108-06, R-20261109-09): when she flees, Maricha
    // comes in the shape of a golden deer. A lure, not a fighter (illusory: no hostile moves); the first blow ends the illusion and he runs.
    marichaDeer: { name: "Golden deer", text: "Maricha in the shape of a golden deer: a lure, it makes no hostile moves. The first blow ends the illusion and he flees.",
      why: "Valmiki, Aranya Kanda: at Ravana's order Maricha becomes a golden deer to lure Rama away from Sita.",
      body: { traits: ["illusory"] },   // illusory: Parley.blocks refuses its strikes, grapples and shoves (R-20261109-09)
      gate: { blocks: ["ability", "ultimate", "overwatch"], reason: "a deer casts no techniques and keeps no watch" },
      breakers: [{ hurt: 1, do: [{ scene: { title: "The Illusion Ends", line: "The golden deer's shape tears away: a rakshasa, running." } }, { leave: true, reason: "Maricha drops the deer's shape and flees the battle, alive." }] }] },
    surpanakhaTrue: { name: "True shape", text: "Her own shape, and her fury: her blows land x1.2 for 3 rounds.", why: "Shamed and wounded, she turns to revenge.",
      mods: [{ on: "dealt", mult: 1.2 }], clock: { counts: "rounds", n: 3 } },
    surpanakhaWounded: { name: "The wound", text: "Whoever wounds her carries her grudge.", why: "The cut that began the war.",
      hidden: true, triggers: [{ on: "hit", do: [{ grant: "surpanakhaGrudge", to: "source", thematic: { lakshmana: "surpanakhaGrudgeDeep" } }] }] },
    surpanakhaGrudge: { name: "Surpanakha's grudge", text: "Marked by her grudge: takes x1.25 for 3 rounds.", why: "She will not forget who hurt her, and she will tell Ravana.",
      mods: [{ on: "taken", mult: 1.25 }], clock: { counts: "rounds", n: 3 } },
    surpanakhaGrudgeDeep: { name: "Surpanakha's grudge", text: "The one who cut her: takes x1.5 for 3 rounds.", why: "Lakshmana cut her nose; the war began there.",
      mods: [{ on: "taken", mult: 1.5 }], clock: { counts: "rounds", n: 3 } },
    lankaVengeance: { name: "Vengeance", text: "Surpanakha's cry: blows land x1.25 for 2 rounds.", why: "She runs to Ravana and demands revenge.",
      mods: [{ on: "dealt", mult: 1.25 }], clock: { counts: "rounds", n: 2 } },
    lured: { name: "Lured", text: "Distracted by her: cannot Guard for 1 turn.", why: "She draws the eye away from the fight.",
      gate: { blocks: ["guard"], reason: "they are distracted" }, clock: { counts: "ownerTurns", n: 1 } },
    luredBrothers: { name: "Lured", text: "The princes she tried to win: cannot Guard for 2 turns.", why: "She came first to Rama and Lakshmana.",
      gate: { blocks: ["guard"], reason: "they are distracted" }, clock: { counts: "ownerTurns", n: 2 } },
    // Mandodari (Mala, 2026-10-24; docs/mandodari-build.md). Her counsel shelters whoever heeds it; whoever ignores it and attacks
    // anyway pays for it. Rule 6: on Ravana the stakes are larger both ways (he never listens).
    mandodariCounsel: { name: "Counselled", text: "Warned by Mandodari: takes x0.7 for 2 turns, so long as they hold back. Attack, and the warning is ignored: x1.3 taken for 2 rounds.",
      why: "Valmiki: Mandodari begs Ravana to return Sita and make peace; he will not hear it.",
      mods: [{ on: "taken", mult: 0.7 }], clock: { counts: "ownerTurns", n: 2 }, advice: true,   // weighed by valence toward her (states.js holdBack)
      triggers: [{ on: "dealt", limit: 1, do: [{ grant: "mandodariUnheeded", to: "self" }, { remove: "mandodariCounsel" }] }] },
    mandodariCounselKing: { name: "Unheard", text: "Mandodari's plea to her husband. He never heeds it: when his next turn begins (or the moment he strikes), x1.6 taken for 2 rounds.",
      why: "Her counsel to Ravana was the one that mattered most, and the one he ignored (Mala, 2026-10-24: it always backfires on him).",
      advice: { heed: false }, clock: { counts: "ownerTurns", n: 2 },
      triggers: [{ on: "dealt", limit: 1, do: [{ grant: "mandodariUnheededKing", to: "self" }, { remove: "mandodariCounselKing" }] },
        { on: "turnStart", limit: 1, do: [{ grant: "mandodariUnheededKing", to: "self" }, { remove: "mandodariCounselKing" }] }] },
    mandodariUnheeded: { name: "Unheeded", text: "Ignored the warning: takes x1.3 for 2 rounds.", why: "The house that will not listen pays for it.",
      mods: [{ on: "taken", mult: 1.3 }], clock: { counts: "rounds", n: 2 } },
    mandodariUnheededKing: { name: "Unheeded", text: "The king ignored her: takes x1.6 for 2 rounds.", why: "Pride is a wound that does not show until it is struck.",
      mods: [{ on: "taken", mult: 1.6 }], clock: { counts: "rounds", n: 2 } },
    // Indrajit (Mala, 2026-10-24; docs/indrajit-build.md). The serpent noose binds until it wears off or a winged ally beside the
    // bound one breaks it (Garuda); Rama and Lakshmana are bound longer (rule 6). The Nikumbhila rite: two turns of chanting that
    // any blow breaks; finished, he is all but unbeatable for three rounds.
    nagapasha: { name: "Nagapasha", text: "Bound by the serpent noose: no moving and no techniques for 2 turns. A winged ally beside them tears it off.",
      why: "Valmiki, Yuddha Kanda: Indrajit's serpent arrows bind Rama and Lakshmana; Garuda's coming frees them.",
      gate: { blocks: ["move", "ability"], reason: "the serpent noose holds them" }, clock: { counts: "ownerTurns", n: 2 },
      breakers: [{ adjacentTrait: "aerodynamic", side: "ally", do: [{ scene: { title: "Wings Above", line: "A winged ally comes down, and the serpents let go." } }] }] },
    nagapashaBrothers: { name: "Nagapasha", text: "The noose made for the brothers of Ayodhya: no moving and no techniques for 3 turns. A winged ally beside them tears it off.",
      why: "The serpent arrows were loosed at Rama and Lakshmana.",
      gate: { blocks: ["move", "ability"], reason: "the serpent noose holds them" }, clock: { counts: "ownerTurns", n: 3 },
      breakers: [{ adjacentTrait: "aerodynamic", side: "ally", do: [{ scene: { title: "Wings Above", line: "Garuda comes down, and the serpents let go." } }] }] },
    nikumbhilaRite: { name: "The Nikumbhila rite", text: "Chanting in the hidden grove: no other act for 2 of his turns. A blow breaks the rite.",
      why: "Valmiki, Yuddha Kanda: Indrajit's sacrifice at Nikumbhila would make him unbeatable; Lakshmana and Vibhishana break it.",
      gate: { blocks: ["all"], reason: "he is performing the rite" }, clock: { counts: "ownerTurns", n: 2, then: [{ grant: "nikumbhilaFinished", to: "self" }, { scene: { title: "The Rite Is Finished", line: "The fire takes the offering. Indrajit rises, and nothing can touch him." } }] },
      breakers: [{ hurt: 1, do: [{ scene: { title: "The Rite Is Broken", line: "A blow lands in the grove, and the offering goes cold." } }] }] },
    nikumbhilaFinished: { name: "Unbeatable", text: "The rite is finished: his blows land x1.5 and he takes x0.6, for 3 rounds.", why: "The boon of the completed sacrifice.",
      mods: [{ on: "dealt", mult: 1.5 }, { on: "taken", mult: 0.6 }], clock: { counts: "rounds", n: 3 } },
    // Kumbhakarna (Mala, 2026-10-24; docs/kumbhakarna-build.md). He opens asleep; a blow, two of his turns, or his own side's
    // drums wake him, and the waking is felt: he rages. Vast: massive and slow (a body state with no way out but its own group).
    kumbhakarnaAsleep: { name: "Asleep", text: "Asleep: he cannot act. A blow wakes him, so does his own side beating the drums, or two of his turns.",
      why: "Valmiki, Yuddha Kanda: Kumbhakarna sleeps for months; Ravana's servants beat drums and drive elephants over him to wake him.",
      gate: { blocks: ["all"], reason: "he is asleep" }, clock: { counts: "ownerTurns", n: 2, then: [{ grant: "kumbhakarnaRaging", to: "self" }, { scene: { title: "Kumbhakarna Wakes", line: "The giant opens his eyes, and he is hungry." } }] },
      offers: { ability: "beatTheDrums", to: "allies" },
      breakers: [{ hurt: 1, do: [{ grant: "kumbhakarnaRaging", to: "self" }, { scene: { title: "Kumbhakarna Wakes", line: "Struck in his sleep, the giant rises, and he is angry." } }] },
        { ability: "beatTheDrums", from: "ally", do: [{ grant: "kumbhakarnaRaging", to: "self" }, { scene: { title: "Kumbhakarna Wakes", line: "The drums and the elephants: the giant rises." } }] }] },
    kumbhakarnaRaging: { name: "Raging", text: "Freshly woken and furious: his blows land x1.3 for 3 rounds.", why: "Woken at great cost, he goes straight into the vanara army.",
      mods: [{ on: "dealt", mult: 1.3 }], clock: { counts: "rounds", n: 3 } },
    kumbhakarnaVast: { name: "Vast", text: "A giant: cannot be grappled, lifted or shoved, and moves one tile less.", why: "Kumbhakarna, the giant brother of Ravana.",
      group: "kumbhakarnaBody", body: { massive: true, moveAdd: -1 } },
    kumbhakarnaDozing: { name: "Dozing", text: "He lies down: at his next turn start he recovers 18 LF and sleeps through that turn.", why: "Sleep is what he does best.",
      gate: { blocks: ["all"], reason: "he is dozing" }, clock: { counts: "ownerTurns", n: 1 }, triggers: [{ on: "turnStart", limit: 1, do: [{ healLF: 18 }] }], breakers: [{ hurt: 1 }] },
    // Ravana (Mala, 2026-10-24; docs/ravana-build.md). Ten heads that grow back and Brahma's boon; both end when the Brahmastra
    // finds him (the arrow to the navel, the secret Vibhishana told Rama).
    ravanaHeads: { name: "Ten heads", text: "A blow of 10 or more costs him a head, and the head grows back with 6 LF; ten heads, then no more. The Brahmastra ends it.",
      why: "Valmiki, Yuddha Kanda: Rama cuts Ravana's heads and they grow back, until the Brahmastra strikes where the nectar is kept.",
      clock: { counts: "manual", n: 10 }, triggers: [{ on: "hit", if: { minDamage: 10 }, do: [{ healLF: 6 }, { count: -1 }] }],
      breakers: [{ ability: "brahmastra", from: "foe", do: [{ scene: { title: "The Arrow Finds Its Mark", line: "Brahma's weapon strikes where the nectar is kept. The heads do not grow back." } }] }] },
    ravanaBoon: { name: "Brahma's boon", text: "No god or spirit can kill him: rubedo hits him at x0.4. He forgot to ask protection from men, and a mortal's arrow (albedo) hits him fully.",
      why: "Valmiki: Brahma granted Ravana protection from gods, demons and spirits; he scorned to ask it of men.",
      mods: [{ on: "taken", family: "rubedo", mult: 0.4 }], breakers: [{ ability: "brahmastra", from: "foe" }] },
    hanumanForgotten: { name: "Forgotten", text: "He has forgotten his own strength. Anyone on his side can remind him (a free talk).",
      why: "Valmiki: sages cursed the mischievous child to forget his powers until someone reminded him; Jambavan does, on the shore.",
      gate: { blocks: ["ability:formMonkey", "ability:formGiant", "ability:sanjeevani"], reason: "he does not remember that he can" },
      offers: { ability: "remind", to: "allies" },
      breakers: [{ ability: "remind", from: "ally", do: [{ scene: { title: "Hanuman Remembers", line: "You are Hanuman, son of the Wind. Remember what you are." } }] },
        { ability: "rememberWhatYouAre", from: "ally", do: [{ scene: { title: "Jambavan Speaks", line: "Son of the Wind, why do you sit silent? You leapt for the sun as a child. Leap now." } }] },
        { present: "jambavan", side: "ally", do: [{ scene: { title: "Jambavan Speaks", line: "Son of the Wind, why do you sit silent? You leapt for the sun as a child. Leap now." } }] }] },
    // Cure (claude-cure-spec rev 3, slice S1; staged: no ability, class or scenario grants these yet). Numbers provisional, see specs/CURE.md.
    // Mesmerism sets the hold and the order; Disinhibition peels the restraint a unit holds (traitsOff, unmasked).
    fixated: { name: "Fixated", text: "Their eyes will not leave the flame.", why: "Attention can be borrowed: held on one thing, a person does not move, and a friend can call them back.",
      gate: { blocks: ["move"], reason: "their eyes will not leave the flame" }, clock: { counts: "ownerTurns", n: 1 },
      offers: { ability: "remind", to: "allies" }, breakers: [{ hurt: 1 }, { ability: "remind", from: "ally" }] },
    latent: { name: "Latent order", hidden: true, text: "A cue sleeps in them.", why: "An order given to a held mind waits for its cue; the one holding it does not remember.",
      clock: { counts: "rounds", n: 3 }, breakers: [{ ability: "remind", from: "ally" }],
      triggers: [{ on: "turnStart", if: { cue: true }, do: [{ grant: "unmasked", to: "self", turns: 1, byOrigin: true }, { grant: "marked", to: "self", byOrigin: true }, { remove: "latent", from: "self" }] }] },
    unmasked: { name: "Unmasked", text: "They are not themselves, and only themselves.", why: "The restraints are off, so their other traits and their needs decide, with no thought for sides. They are not stronger.",
      anySide: true, unmasks: true, gate: { blocks: ["ultimate"], reason: "they are not themselves, and cannot gather that much" }, clock: { counts: "ownerTurns", n: 1 } },
    marked: { name: "Marked", text: "The cut is the signature.", why: "An act done under an order leads back, one link, to whoever left it." },
    emptied: { name: "Emptied", text: "Nothing is left of them but the question.", why: "The capability has gone to someone else; the one who carried it keeps only the asking.",
      gate: { blocks: ["all"], reason: "nothing is left of them but the question" }, clock: { counts: "ownerTurns", n: 3 } },
    suggestedHold: { name: "Told to wait", text: "They stand and wait.", why: "A held mind takes one plain suggestion for its next turn: here, to do nothing.",
      gate: { blocks: ["all"], reason: "they were told to wait" }, clock: { counts: "ownerTurns", n: 1 }, refusesGrant: ["suggestedBack", "suggestedGuard", "incapacitated"], breakers: [{ hurt: 1 }, { ability: "remind", from: "ally" }] },
    suggestedBack: { name: "Told to step back", text: "They step away.", why: "A held mind takes one plain suggestion for its next turn: here, one step back.",
      clock: { counts: "ownerTurns", n: 1 }, refusesGrant: ["suggestedHold", "suggestedGuard"], breakers: [{ hurt: 1 }, { ability: "remind", from: "ally" }],
      triggers: [{ on: "turnStart", limit: 1, do: [{ step: "away", tiles: 1 }] }] },
    suggestedGuard: { name: "Told to lower their guard", text: "They drop their guard.", why: "A held mind takes one plain suggestion for its next turn: here, to leave off guarding.",
      gate: { blocks: ["guard", "overwatch"], reason: "they were told to lower their guard" }, clock: { counts: "ownerTurns", n: 1 }, refusesGrant: ["suggestedHold", "suggestedBack"], breakers: [{ hurt: 1 }, { ability: "remind", from: "ally" }] },
    spoken: { name: "Already spoken to", hidden: true, text: "One suggestion or one order a battle: this one has had theirs.", why: "Marks a subject that has taken its one suggestion or latent order this battle." },
    heard: { name: "Already steadied", hidden: true, text: "One calming word each, a battle.", why: "Marks a unit that has had its one steadying word this battle." },
    calm: { name: "Calm", text: "A calm voice: they will not break.", why: "A steady word: for a little while, fear does not take them.", clock: { counts: "ownerTurns", n: 2 } },
    // Battle Cards C4 (CARDS.md 4.4 and 4.5; docs/cards-art.md): the four equips and four zones of the starter set, data only. All hidden: the card's name must not reach a public
    // log line (the damage note "<name> x0.8" would), so a unit shows them only to a side that has Observed it. An equip's clock counts the holder's own turns; a zone row's count is
    // set by the zone's sweep (Cards.sweep) to the zone's rounds left, and the row's own clock is the backstop. Numbers live in cards-data.js; these rows carry the same ones.
    "equip:thornguardWrap": { name: "Thornguard Wrap", hidden: true, group: "cardEquip", cardMod: "taken", text: "Takes 20% less damage for 3 turns; ends after 30 damage.", why: "A battle card: an equip, one a unit at a time.",
      mods: [{ on: "taken", mult: 0.8 }], clock: { counts: "ownerTurns", n: 3 }, breakers: [{ hurt: 30 }] },
    "equip:swiftGloves": { name: "Swift Gloves", hidden: true, group: "cardEquip", cardMod: "dealt", text: "Deals 20% more damage for 3 turns.", why: "A battle card: an equip, one a unit at a time.",
      mods: [{ on: "dealt", mult: 1.2 }], clock: { counts: "ownerTurns", n: 3 } },
    "equip:mendersBand": { name: "Mender's Band", hidden: true, group: "cardEquip", text: "Heals 4 LF at the start of each of its turns for 3 turns.", why: "A battle card: an equip, one a unit at a time.",
      clock: { counts: "ownerTurns", n: 3 }, triggers: [{ on: "turnStart", do: [{ healLF: 4 }] }] },
    "equip:ironbarkCoat": { name: "Ironbark Coat", hidden: true, group: "cardEquip", cardMod: "taken", text: "Takes 25% less damage for 3 turns; while it lasts, one lethal blow leaves it at 1 LF.", why: "A battle card: an equip, one a unit at a time.",
      mods: [{ on: "taken", mult: 0.75 }], clock: { counts: "ownerTurns", n: 3 } },
    // One save a battle across every lethal-save equip (CARDS.md section 17): each such equip grants this beside its own row, so the survive.js record `state:cardLethal:0`
    // is shared. The def clock never binds: every grant passes the equip's own turns as count, and both count the holder's turns from the same grant, so the save ends
    // exactly when the equip does; a replacing equip without a save removes it (engine/cards.js). The log line names no card.
    cardLethal: { name: "Card Lethal Save", hidden: true, text: "Once, a blow that would defeat it leaves it at 1 LF.", why: "A battle card: the one lethal save, shared by every lethal-save equip.",
      clock: { counts: "ownerTurns", n: 99 }, triggers: [{ on: "lethal", limit: 1, do: [{ log: "The charm holds: 1 LF left." }] }] },
    "zone:windbreakRow": { name: "Windbreak Row", hidden: true, cardMod: "taken", text: "Inside the zone: takes 15% less damage.", why: "A battle card: a field zone, one a side.",
      mods: [{ on: "taken", mult: 0.85 }], clock: { counts: "rounds", n: 3 } },
    "zone:thinAir": { name: "Thin Air", hidden: true, cardMod: "dealt", text: "Inside the zone: deals 15% less damage.", why: "A battle card: a field zone, one a side.",
      mods: [{ on: "dealt", mult: 0.85 }], clock: { counts: "rounds", n: 3 } },
    "zone:openSeason": { name: "Open Season", hidden: true, cardMod: "dealt", text: "Inside the zone: deals 20% more damage.", why: "A battle card: a field zone, one a side.",
      mods: [{ on: "dealt", mult: 1.2 }], clock: { counts: "rounds", n: 3 } },
    "zone:quietHour": { name: "Quiet Hour", hidden: true, text: "Inside the zone: cannot play cards.", why: "A battle card: a field zone, one a side.",
      gate: { blocks: ["card"], reason: "a hush lies over the ground" }, clock: { counts: "rounds", n: 3 } },
  };
  // Hanuman's free acts: the three switches (one a turn between them), and Remind, which his allies are offered while he is Forgotten.
  Object.assign(abilities, {
    formBase: { name: "Base Form", tier: "basic", concepts: ["elasticity"], delivery: "self", target: "self", effect: "none", effectCategory: "conditional", cost: 0, tempoCost: 0, range: 0, potency: 0,
      mechanism: "Return to the shape he serves in.", reveal: "Free, once a turn between all three forms.", states: { grant: [{ id: "hanumanBase", to: "self" }], once: "hanumanForm", unlessHeld: true, ai: 0 } },
    formMonkey: { name: "Monkey Form", tier: "basic", concepts: ["elasticity"], delivery: "self", target: "self", effect: "none", effectCategory: "conditional", cost: 0, tempoCost: 0, range: 0, potency: 0,
      mechanism: "Shrink to a monkey: quick, unseen, and nearly harmless.", reveal: "Free, once a turn between all three forms. Sealed while Forgotten.", states: { grant: [{ id: "hanumanMonkey", to: "self" }], once: "hanumanForm", unlessHeld: true, ai: 0 } },
    formGiant: { name: "Giant Form", tier: "basic", concepts: ["elasticity"], delivery: "self", target: "self", effect: "none", effectCategory: "conditional", cost: 0, tempoCost: 0, range: 0, potency: 0,
      mechanism: "Grow to the size of a mountain.", reveal: "Free, once a turn between all three forms. Sealed while Forgotten.", states: { grant: [{ id: "hanumanGiant", to: "self" }], once: "hanumanForm", unlessHeld: true, ai: 15 } },
    // Lakshmana's line (rule 6: any ally; Sita gets the stronger state), and his merge, which draws it round everyone near.
    lakshmanaRekhaDraw: { name: "Lakshmana Rekha", tier: "refined", concepts: ["boundary"], delivery: "placed", target: "ally", effect: "none", effectCategory: "conditional",
      cost: 5, range: 3, potency: 0, pairs: [["boundary", "interposition"]],
      mechanism: "Draw a line round an ally: inside it they take x0.6 (Sita x0.3) while they stay put and he stays within 3.", reveal: "A drawn line on the ground; stepping over it ends it.",
      states: { grant: [{ id: "lakshmanaRekha", to: "target", thematic: { sita: "lakshmanaRekhaSita" } }], ai: 7 } },
    lineNotCrossed: { name: "The Line Not Crossed", tier: "ultimate", merge: true, concepts: ["boundary", "interposition"], delivery: "self", target: "self", effect: "none", effectCategory: "conditional",
      cost: 16, range: 0, potency: 0, area: { shape: "radius", radius: 3 }, pairs: [["boundary", "interposition"]], timing: "announced", announce: "Stay inside the line. Whatever calls you, do not cross it.",
      mechanism: "Merge: the boundary is drawn and he stands between: every ally within 3 is inside a Rekha (Sita's is stronger).", reveal: "Announced; each line breaks for whoever steps out.",
      states: { grant: [{ id: "lakshmanaRekha", to: "allies", thematic: { sita: "lakshmanaRekhaSita" } }], ai: 16 } },
    enchantingGuise: { name: "Enchanting Guise", tier: "basic", concepts: ["glamour"], delivery: "self", target: "self", effect: "none", effectCategory: "conditional", cost: 3, range: 0, potency: 0,
      pairs: [["glamour", "plasticity"]], mechanism: "Put the lovely shape back on: x0.7 taken until the next blow.", reveal: "A shimmer, and a smile.",
      states: { grant: [{ id: "surpanakhaGuise", to: "self" }], unlessHeld: true, ai: 4 } },
    lure: { name: "Lure", tier: "refined", concepts: ["glamour"], delivery: "placed", target: "enemy", effect: "none", effectCategory: "conditional", cost: 4, range: 4, potency: 0,
      pairs: [["glamour", "plasticity"]], mechanism: "Draw a foe's eye: they cannot Guard for their next turn (Rama and Lakshmana for two).", reveal: "You look; that is the trick.",
      states: { grant: [{ id: "lured", to: "target", thematic: { rama: "luredBrothers", lakshmana: "luredBrothers" } }], ai: 4 } },
    cryForVengeance: { name: "Cry for Vengeance", tier: "ultimate", merge: true, concepts: ["glamour", "plasticity"], delivery: "self", target: "self", effect: "none", effectCategory: "conditional", cost: 15, range: 0, potency: 0,
      area: { shape: "radius", radius: 4 }, pairs: [["glamour", "plasticity"]], timing: "announced", announce: "Brother! Look what they did to me!",
      mechanism: "Merge: the guise is spent and her shape is grief and rage: every ally within 4 deals x1.25 for 2 rounds.",
      reveal: "Announced: Lanka hears her.", states: { grant: [{ id: "lankaVengeance", to: "allies" }], ai: 12 } },
    counsel: { name: "Counsel", tier: "refined", concepts: ["inference"], delivery: "placed", target: "ally", effect: "none", effectCategory: "conditional", cost: 4, range: 4, potency: 0,
      pairs: [["inference", "harmony"]], mechanism: "Warn an ally within 4: x0.7 taken for 2 turns while they hold back; if they attack anyway, x1.3 taken for 2 rounds. On Ravana: x0.5, or x1.6.",
      reveal: "A quiet word. Whether it is heeded is up to them.", states: { grant: [{ id: "mandodariCounsel", to: "target", thematic: { ravana: "mandodariCounselKing" } }], ai: 5 } },
    theQueensPlea: { name: "The Queen's Plea", tier: "ultimate", merge: true, concepts: ["inference", "harmony"], delivery: "self", target: "self", effect: "none", effectCategory: "conditional", cost: 15, range: 0, potency: 0,
      area: { shape: "radius", radius: 3 }, pairs: [["inference", "harmony"]], timing: "announced", announce: "Listen to me, all of you. Just this once.",
      mechanism: "Merge: what inference foresees, harmony asks everyone to hear: every ally within 3 is Counselled (Ravana with the king's plea).",
      reveal: "Announced: everyone hears it; not everyone listens.", states: { grant: [{ id: "mandodariCounsel", to: "allies", thematic: { ravana: "mandodariCounselKing" } }], ai: 10 } },
    nikumbhila: { name: "Nikumbhila", tier: "ultimate", merge: true, concepts: ["deception", "constraint"], delivery: "self", target: "self", effect: "none", effectCategory: "conditional", cost: 15, range: 0, potency: 0,
      pairs: [["deception", "constraint"]], timing: "announced", announce: "Leave me to my offering.",
      mechanism: "Merge: the deception hides where he is; the constraint is the rite's own discipline. Two turns of chanting; any blow breaks it; finished, x1.5 dealt and x0.6 taken for 3 rounds.",
      reveal: "Announced: everyone knows the rite has begun, and where to strike.", states: { grant: [{ id: "nikumbhilaRite", to: "self" }], unlessHeld: true, ai: { value: 24, clear: 3 } } },   // he chants when no foe can reach him at once (the hidden grove)
    theLongSleep: { name: "The Long Sleep", tier: "refined", concepts: ["timing"], pairOnly: true, delivery: "self", target: "self", effect: "none", effectCategory: "conditional", cost: 4, range: 0, potency: 0,
      pairs: [["inertia", "timing"]], mechanism: "He lies down: at his next turn start he recovers 18 LF and sleeps through that turn; a blow wakes him early, with no heal.",
      reveal: "He yawns, enormously.", states: { grant: [{ id: "kumbhakarnaDozing", to: "self" }], ai: { value: 16, clear: 3, below: 0.5 } } },   // he naps when hurt and nobody can reach him before he wakes
    beatTheDrums: { name: "Beat the Drums", tier: "basic", concepts: ["timing"], delivery: "placed", target: "ally", effect: "none", effectCategory: "conditional", cost: 0, tempoCost: 30, range: 99, potency: 0,
      mechanism: "Drums, horns and elephants: wake a sleeping ally.", reveal: "Costs a third of a turn; offered while an ally of yours is asleep.", states: { ai: 12 } },
    remind: { name: "Remind Him", tier: "basic", concepts: ["reciprocal_obligation"], delivery: "placed", target: "ally", effect: "none", effectCategory: "conditional", cost: 0, tempoCost: 0, range: 99, potency: 0,
      mechanism: "Tell Hanuman who he is.", reveal: "A free talk to a Forgotten ally anywhere on the field; it ends Forgotten.", states: { ai: 30 } },
  });
  const subfactions = {
    street: { name: "Street", blurb: "The fight is hands, a hustle, or a night shift." },
    stage: { name: "Stage", blurb: "Someone is watching, and the watching is the point of the kit." },
    lab: { name: "Lab", blurb: "A researcher, a machine, or the person who built that machine." },
    wilds: { name: "Wilds", blurb: "A beast, or a person whose partner in the fight is a living thing outside the city." },
    court: { name: "Court", blurb: "A ruler, a champion of a ruler, or a legend whose fight is an office." },
    arcane: { name: "Arcane", blurb: "Witchcraft, a spirit, a rite, or a curse, practiced as the kit." },
    spirit: { name: "Spirit", blurb: "A spirit of the land, the sea or the dead, bound by laws older than people." },   // Mala, 2026-10-31: the Fae are a subfaction of the spirit; the Forest Spirit is its first member (docs/fae.md)
    civic: { name: "Civic", blurb: "The work keeps a place people live in standing: law, care, building, and the homestead at the edge." },
    green: { name: "Green", blurb: "The subject is the living land: grow it, read it, keep it." },
    ink: { name: "Ink", blurb: "The work is an image a person made, on paper, a panel, a print, or a screen." },
    cosmic: { name: "Cosmic", blurb: "They came from somewhere this map is not: another world, orbit, or another genre." },
    money: { name: "Money", blurb: "The power is what they own, or they are apprenticed to the person who owns it." },
    masks: { name: "Masks", blurb: "The fight is the public mask: a cape, a nemesis, and the crowd that picks a side." },
    wake: { name: "Wake", blurb: "The ground of the fight is the water." },
    posterity: { name: "Posterity", blurb: "The kit spends the present on someone who is not here yet." },
    lanka: { name: "Lanka", blurb: "The fight is held by power taken: a king's hoard, a siege, a gift that was never earned." },   // House of Ravana (docs/ramayana-faction.md)
    ayodhya: { name: "Ayodhya", blurb: "The fight keeps a word given: an exile, a vow, a debt of devotion, honoured at a cost." },   // House of Rama (docs/ramayana-faction.md)
    interdimensional: { name: "Interdimensional", blurb: "They step between dimensions, and what they carry spills through with them." },   // Mala, 2026-10-26: a new crew for the Hot Pot Berserker
    rogues: { name: "Rogues", blurb: "Checked against every other crew and still no house." },
  };
  // Foe names (Mala, 2026-10-20): every non-boss opponent in a random battle gets a given name, shown as "Name: Class".
  // A class's own pool first, then the shared fallback; seeded by the battle, never twice in one battle. Characters who
  // are already individuals (unique) keep their own name. All names are invented for the game: no real people.
  const NAME_POOLS = {
    unique: ["maricha", "arantxa", "odysseus", "artemesia", "mao_zedong", "daedalus", "medusa", "bastet", "monkey_king", "hanuman", "jambavan", "rama", "lakshmana", "sita", "ravana", "kumbhakarna", "indrajit", "mandodari", "surpanakha", "jatayu", "jiang_qing", "frogan", "esker", "tallyman", "visitor_grey", "visitor_ship"],
    byClass: {
      soldier: ["Reyes", "Okafor", "Brandt", "Kealoha", "Sato", "Mendez", "Novak", "Duarte", "Haugen", "Achebe"],
      policeOfficer: ["Officer Lum", "Officer Park", "Officer Akana", "Officer Vance", "Officer Diaz", "Officer Ng"],
      police_officer: ["Officer Lum", "Officer Park", "Officer Akana", "Officer Vance", "Officer Diaz", "Officer Ng"],
      samurai: ["Kenshiro", "Hayato", "Tomoe", "Isamu", "Rin", "Masaru"],
      ninja: ["Kage", "Suzume", "Hotaru", "Ren", "Kasumi", "Jin"],
      knight: ["Ser Aldous", "Dame Wren", "Ser Coll", "Dame Isolde", "Ser Hal", "Dame Brisa"],
      sailor: ["Moana", "Kekoa", "Finn", "Marisol", "Tavita", "Bosun Reed"],
      astronaut: ["Commander Ito", "Specialist Vega", "Pilot Mbeki", "Commander Rask"],
      agi: ["UNIT-7", "AUGUR", "Halcyon", "VESTA-2", "Cinder"],
      android_maker: ["Dr. Kessel", "Dr. Ohana", "Dr. Lindqvist"],
      wizard: ["Aldermere", "Quill", "Thessaly", "Morrow", "Ysolde"],
      pirate: ["Redcap", "Salt Annie", "One-Boot Teo"],
      detective: ["Inspector Hale", "Inspector Moku", "Inspector Ruiz"],
      general: ["General Okoro", "General Vasquez", "General Haldane"],
    },
    fallback: ["Ada", "Akoni", "Alma", "Amara", "Anika", "Ari", "Aurelio", "Bea", "Bodhi", "Callum", "Carmen", "Dalia", "Dev", "Eamon",
      "Elio", "Esme", "Ezra", "Farah", "Felix", "Gemma", "Hana", "Ilse", "Imani", "Ines", "Iolana", "Jasper", "Joaquin", "Juno", "Kai",
      "Kalani", "Keanu", "Kiri", "Lani", "Leilani", "Lio", "Lucia", "Mae", "Mako", "Malia", "Marek", "Mateo", "Mila", "Nadia", "Nalu",
      "Noa", "Nico", "Odile", "Omar", "Oona", "Priya", "Quinn", "Rafa", "Ravi", "Rosa", "Rumi", "Sage", "Sami", "Sela", "Soren",
      "Tala", "Teo", "Tomas", "Uma", "Valen", "Vika", "Wren", "Xavi", "Yara", "Yusuf", "Zane", "Zola", "Ikaika", "Makana", "Pua"],
  };
  const SUBFACTION_OF = {
    barbarian: "street", cloaked_drifter: "street", cyph: "street", detective: "street", hypebeast: "street", kickboxer: "street", maid: "street", mma_fighter: "street", ninja: "street", rapper: "street", rogue: "street", thief: "street", martial_artist: "street",
    actor: "stage", bard: "stage", director: "stage", jazz_musician: "stage", jiang_qing: "stage", jpop_idol: "stage", musician: "stage", neon_dj: "stage", neon_idol: "stage", supermodel: "stage",
    agi: "lab", agent_swarm: "lab", android_maker: "lab", clockwork: "lab", defective_machine: "lab", hacker: "lab", ornithopter: "lab", robot_mechanic: "lab", scientist: "lab", sieve: "lab", steam_walker: "lab",
    animalTamer: "wilds", boarman: "wilds", ecologist: "wilds", esker: "wilds", hedge_witch: "wilds", monkey_king: "wilds", mutant_boar: "wilds", mycologist: "wilds", ranger: "wilds", shaman: "wilds",
    black_armor: "court", daedalus: "court", general: "court", knight: "court", magistrate: "court", mao_zedong: "court", odysseus: "court", oni_yokozuna: "court", paladin: "court", pharaoh: "court", president: "court", samurai: "court", soldier: "court",
    artemesia: "arcane", bastet: "arcane", celestial_priestess: "arcane", devouring_mother: "arcane", ember_judge: "arcane", forest_spirit: "spirit", frogan: "arcane", hypnotist: "arcane", jujutsu_sorcerer: "arcane", medusa: "arcane", new_oni: "arcane", ritual_chanter: "arcane", tofu_archer: "arcane", tofu_warden: "arcane", tofu_yokai: "arcane", wizard: "arcane",
    moonflower: "arcane", archivist_elf: "arcane", bard_elf: "arcane", astral_security: "arcane", celestial_astral: "arcane",
    architect: "civic", cleric: "civic", doctor: "civic", engineer: "civic", fbi_agent: "civic", mason: "civic", pioneer: "civic", planner: "civic", police_officer: "civic", policeOfficer: "civic", surveyor: "civic", tactical_operative: "civic", yogaInstructor: "civic",
    arborist: "green", fieldBotanist: "green", gardener: "green", pathfinder: "green", rainkeeper: "green",
    cyanotype_artist: "ink", mangaka: "ink", modern_artist: "ink", origamist: "ink",
    anime_protagonist: "cosmic", arantxa: "cosmic", astronaut: "cosmic", starfarer: "cosmic", teleporter: "cosmic", visitor_grey: "cosmic", visitor_scientist: "cosmic", visitor_ship: "cosmic",
    oil_billionaire: "money", student: "money", tech_billionaire: "money",
    super_hero: "masks", super_heroine: "masks", super_villain: "masks", telekinetic_hero: "masks",
    deepsea_warrior: "wake", sailor: "wake", ferryman: "wake", pearl_diver: "wake",
    hanuman: "ayodhya", jambavan: "ayodhya", rama: "ayodhya", lakshmana: "ayodhya", sita: "ayodhya", jatayu: "ayodhya", ravana: "lanka", maricha: "lanka", kumbhakarna: "lanka", indrajit: "lanka", mandodari: "lanka", surpanakha: "lanka",
    hot_pot_berserker: "interdimensional",
    chef: "street",
    hooded_cyber_rogue: "posterity",
    memorialist: "posterity",
    seedkeeper: "posterity",
    orgonite_trooper: "posterity",
    leviathan_suit: "posterity",
    scale_firmware: "posterity",
    white_jacket_gunner: "posterity",
    bronze_admin: "posterity",
    horned_suit: "posterity",
    archivist: "rogues", aviator_hero: "rogues", black_swan_warrior: "rogues", control: "rogues", gemini: "rogues", warden: "rogues",
    bard_artificer: "stage", burlesque_dancer: "stage", clown: "stage", big_game_hunter: "wilds", mma_fighter_alternate: "street", hermes: "cosmic", kaikeyi: "court",
    cactusguard: "civic", cactuswar: "street", pixel_treant: "cosmic",
  };

  function npc(name, primary, pool, secondaryOptions, ai) {
    const conceptsForConfigs = [primary, ...pool].filter((c, i, all) => all.indexOf(c) === i);
    const pairs = [[primary, pool[0]], [pool[1] || pool[0], primary]];
    for (const extra of pool.filter((c) => c === "pruning" || c === "focus")) pairs.push([extra, extra === "pruning" ? (primary === "swale" ? "swale" : primary) : (primary === "threshold" ? "threshold" : "sightline")]);
    return { name, side: "enemy", sprite: ai, level: 1, xp: 0, ai,
      conceptPool: conceptsForConfigs,
      configs: pairs.map(([p, secondary], i) => ({ id: `${ai}-${i + 1}`, label: `${concepts[p]?.name || p} + ${concepts[secondary]?.name || secondary}`, primary: p, secondary,
        reserve: conceptsForConfigs.filter((c) => c !== secondary && c !== p).slice(0, 1), lens: {} })) };
  }

  // Craftsmanship goes with the Mason (Mala, 2026-10-11): it is his lead loadout, so the Mason picked as main character
  // starts with it. The Architect keeps it in reserve (the roster's version of a wheel-house concept): available to
  // swap in, never his primary.
  characters.forest_spirit.stagedWheelhouse = ["fae"];   // Mala, 2026-10-31: "add Fae in the wheelhouse of the tree spirit". Fae is staged, not playable, so it stays OUT of conceptPool (the story picker lists the pool); it moves there when the Fae kit is registered (docs/fae.md)
  characters.mason.conceptPool.push("craftsmanship");
  characters.mason.configs.unshift({ id: "mason-craft", label: "Craftsmanship + Berm", primary: "craftsmanship", secondary: "berm", reserve: ["barrier"], lens: {} });
  characters.architect.conceptPool.push("craftsmanship");
  for (const cfg of characters.architect.configs) cfg.reserve = ["craftsmanship"];
  characters.architect.wheelHouse = ["berm", "boundary", "craftsmanship"];

  // Field Botanist (Mala, 2026-10-10): the plant class. Three loadouts, none sharing a pair with anyone:
  // grows and keys out (Succession + Indexing), tends (Preservation + Succession), collects (Pruning + Indexing).
  // The plant tie-ins are traits, not concepts: hiker and Field Botany (insight-data.js profile `fieldBotanist`).
  characters.fieldBotanist = { name: "Field Botanist", side: "enemy", sprite: "field-botanist", level: 1, xp: 0, ai: "field-botanist",
    conceptPool: ["succession", "indexing", "preservation", "pruning", "homology"], configs: [
      { id: "field-botanist-survey", label: "Succession + Indexing", primary: "succession", secondary: "indexing", reserve: ["pruning"], lens: {} },
      { id: "field-botanist-ledger", label: "Indexing + Homology", primary: "indexing", secondary: "homology", reserve: ["succession"], lens: {} },
      { id: "field-botanist-compare", label: "Homology + Succession", primary: "homology", secondary: "succession", reserve: ["pruning"], lens: {} },
      { id: "field-botanist-tend", label: "Preservation + Succession", primary: "preservation", secondary: "succession", reserve: ["pruning"], lens: {} },
      { id: "field-botanist-collect", label: "Pruning + Indexing", primary: "pruning", secondary: "indexing", reserve: ["succession"], lens: {} },
    ] };
  // Homology joined the Field Botanist's conceptPool above (Mala, 2026-11-04: "give it to Field Botanist"; it had sat in stagedWheelhouse since 2026-11-02 until its kit was registered).

  // Succession joins the Gardener's seeded configuration pool; it remains a distinct roster draw.
  characters.gardener.conceptPool.push("succession");
  characters.gardener.configs.push({ id: "gardener-succession", label: "Succession + Swale", primary: "succession", secondary: "swale", reserve: ["pruning"], lens: {} });

  // Astral residents (astral SPEC kits, 2026-10-24): natives of the plane, fixed pairs, randomly assigned
  // to mirrors. All mythic SF (they are native to the plane). Display names differ from sprite keys by design.
  characters.moonflower = { name: "Moonflower", side: "astral", randomEventOnly: true, sprite: "moonflower", level: 1, xp: 0, ai: "moonflower", soulKind: "mythic",
    conceptPool: ["thorn", "pruning"], configs: [
      { id: "moonflower-1", label: "Thorn + Pruning", primary: "thorn", secondary: "pruning", reserve: [], lens: {} },
      { id: "moonflower-2", label: "Pruning + Thorn", primary: "pruning", secondary: "thorn", reserve: [], lens: {} },
    ] };
  characters.archivist_elf = { name: "Chronicler", side: "astral", randomEventOnly: true, sprite: "archivist_elf", level: 1, xp: 0, ai: "archivist_elf", soulKind: "mythic",
    conceptPool: ["cipher", "selectivity"], configs: [
      { id: "archivist_elf-1", label: "Cipher + Selectivity", primary: "cipher", secondary: "selectivity", reserve: [], lens: {} },
      { id: "archivist_elf-2", label: "Selectivity + Cipher", primary: "selectivity", secondary: "cipher", reserve: [], lens: {} },
    ] };
  characters.bard_elf = { name: "Cantor", side: "astral", randomEventOnly: true, sprite: "bard_elf", level: 1, xp: 0, ai: "bard_elf", soulKind: "mythic",
    conceptPool: ["resonance", "conjunction"], configs: [
      { id: "bard_elf-1", label: "Resonance + Conjunction", primary: "resonance", secondary: "conjunction", reserve: [], lens: {} },
      { id: "bard_elf-2", label: "Conjunction + Resonance", primary: "conjunction", secondary: "resonance", reserve: [], lens: {} },
    ] };
  characters.astral_security = { name: "Astral Sentry", side: "astral", randomEventOnly: true, sprite: "astral_security", level: 1, xp: 0, ai: "astral_security", soulKind: "mythic",
    conceptPool: ["boundary", "cipher"], configs: [
      { id: "astral_security-1", label: "Boundary + Cipher", primary: "boundary", secondary: "cipher", reserve: [], lens: {} },
      { id: "astral_security-2", label: "Cipher + Boundary", primary: "cipher", secondary: "boundary", reserve: [], lens: {} },
    ] };
  characters.celestial_astral = { name: "Celestial", side: "astral", randomEventOnly: true, sprite: "celestial_astral", level: 1, xp: 0, ai: "celestial_astral", soulKind: "mythic",
    conceptPool: ["conjunction", "sightline"], configs: [
      { id: "celestial_astral-1", label: "Conjunction + Sightline", primary: "conjunction", secondary: "sightline", reserve: [], lens: {} },
      { id: "celestial_astral-2", label: "Sightline + Conjunction", primary: "sightline", secondary: "conjunction", reserve: [], lens: {} },
    ] };

  const encounters = {
    rosterScrimmage: {
      name: "Concept Combat: Roster Scrimmage", arena: "gapCourt",
      actors: [{ id: "player", character: "warden", at: [1, 2] }, { id: "opponent", character: "arborist", at: [7, 2] }],
      initiative: ["player", "opponent"],
      transfer: { id: "tr-roster-read", question: "Which observable property of the terrain changed this exchange?", choices: [
        { id: "a", text: "The actual route, sightline, or interception state on the board.", correct: true, feedback: "Yes. Read the operator and the resulting board state rather than assuming a universal concept matchup." },
        { id: "b", text: "A hidden bonus because of the NPC’s concept name.", correct: false, feedback: "No concept-name matchup bonus is authored; effects follow the board state and typed operation." },
      ], rubric: { correctness: "Names an observed operation", boundary: "Does not generalize beyond the observed arena state" } },
    },
    gapCourt: {
      name: "Concept Combat: The Gap Court",
      arena: "gapCourt",
      actors: [
        { id: "player", character: "warden", at: [1, 2] },
        // Opponents use the baseline ΦF but a lower LF so a 1v2 demo stays winnable; encounter-level override.
        { id: "pathfinder", character: "pathfinder", at: [7, 1], maxLF: 55 },
        { id: "sieve", character: "sieve", at: [7, 3], maxLF: 55 },
      ],
      initiative: ["player", "pathfinder", "sieve"],
      transfer: {
        id: "tr-gap-second-route",
        question: "Suppose the south lane were walled off and a Shield Wall stood on the gap. Which opponent technique would still reach you, and why?",
        choices: [
          { id: "a", text: "Filter Bolt, because Selectivity disrupts barriers.", correct: false,
            feedback: "Selectivity disrupts a *parry*, not a wall. A line still stops at the barrier tile." },
          { id: "b", text: "Detour, as long as the north lane is an open route within its length.", correct: true,
            feedback: "Right: Alternate Pathway bypasses a route-specific barrier. Close the north lane too and it fails with 'no route'." },
          { id: "c", text: "Neither; any barrier blocks every delivery.", correct: false,
            feedback: "A barrier only closes the routes it sits on. Routed deliveries go around." },
        ],
        rubric: { correctness: "Names routed delivery and route-specific bypass", boundary: "Notes that enclosing every route defeats it" },
      },
    },
    // The boss rush (docs/boss-rush.md): every Omega threat in a row on the Warfare Field. modes/boss-rush.js supplies
    // the participants for each fight; these are only the defaults.
    bossRush: {
      name: "Boss Rush",
      arena: "warfareField",
      actors: [{ id: "player", character: "warden", side: "player", at: [1, 4] }],
      initiative: ["player"],
      transfer: null,
    },
    randomEncounter: {
      name: "Random Encounter",
      arena: "gapCourt",
      actors: [],
      initiative: [],
      transfer: null,
    },
    warfare: {
      name: "Warfare",
      arena: "warfareField",
      actors: [
        { id: "player", character: "warden", side: "player", at: [1, 4] },
        { id: "companion", character: "arborist", side: "player", at: [2, 4] },
        { id: "war-enemy-1", character: "pathfinder", side: "enemy", at: [13, 2], maxLF: 65 },
        { id: "war-enemy-2", character: "surveyor", side: "enemy", at: [13, 6], maxLF: 65 },
      ],
      initiative: ["player", "war-enemy-1", "companion", "war-enemy-2"],
      transfer: { id: "tr-warfare-last-faction", question: "In a three-faction battle, why can eliminating one opponent still leave the outcome undecided?", choices: [
        { id: "a", text: "Because the battle ends only when one faction remains; rivals can still be fighting each other.", correct: true, feedback: "Exactly. Warfare is a last-faction-standing objective, so a surviving wild faction keeps the encounter active." },
        { id: "b", text: "Because a defeated faction returns after one round.", correct: false, feedback: "No faction respawns. The remaining factions continue until one remains." },
      ], rubric: { correctness: "Recognizes a three-faction last-side-standing condition", boundary: "Does not equate enemy defeat with total victory" } },
    },
    escapeShip: {
      name: "Escape the Visitor Ship",
      arena: "shipInterior",
      actors: [
        { id: "player", character: "warden", at: [1, 3] },
        { id: "guard-1", character: "visitor_grey", side: "enemy", at: [8, 1], maxLF: 45 },
        { id: "guard-2", character: "visitor_grey", side: "enemy", at: [8, 5], maxLF: 45 },
        { id: "guard-3", character: "visitor_grey", side: "enemy", at: [9, 3], maxLF: 45 },
      ],
      initiative: ["player", "guard-1", "guard-2", "guard-3"],
      transfer: { id: "tr-escape-cut", question: "The guards hold the bulkhead gap. What makes a route safe?", choices: [
        { id: "a", text: "A route no single blocked tile separates from the exit — or no guard left to block it.", correct: true, feedback: "Exactly. Connectivity and cuts: clear the gap or clear the guards." },
        { id: "b", text: "The shortest route, whatever stands on it.", correct: false, feedback: "The short route through the guards is a fight, not an escape." },
      ], rubric: { correctness: "Names route connectivity past a cut", boundary: "Does not equate shortest with safest" } },
    },
    firstWall: {
      name: "Concept Combat: First Wall",
      arena: "gapCourt",
      actors: [
        { id: "player", character: "warden", at: [1, 2] },
        // A sparring partner uses one readable technique so the first lesson is
        // about line delivery and barriers, not two opponents' combined turns.
        { id: "student", character: "student", at: [7, 2], maxLF: 42, aiAbilities: ["filterBolt"] },
      ],
      initiative: ["player", "student"],
      transfer: {
        id: "tr-first-wall",
        question: "What does a Shield Wall do when Filter Bolt's straight line crosses it?",
        choices: [
          { id: "a", text: "It stops the opposing line delivery while the wall holds.", correct: true,
            feedback: "Right: the wall negates an opposing line that crosses its tile. Placement matters." },
          { id: "b", text: "It blocks every attack, from every direction and delivery type.", correct: false,
            feedback: "The wall only stops opposing line deliveries that cross its tile; routed and field effects behave differently." },
          { id: "c", text: "It doubles the bolt's damage.", correct: false,
            feedback: "A wall can stop a crossing line. It does not amplify Filter Bolt." },
        ],
        rubric: { correctness: "Identifies a crossing opposing line as negated", boundary: "Does not generalize the wall to every delivery" },
      },
    },
  };

  // The graph file is the source of truth for the new concepts' directed edges. At the point
  // an edge is implemented it becomes known to the engine as well as visible in the map.
  const implementedRepresentationEdges = new Set(["opp-section-sees-through-walls","opp-plan-view-flattens-height","opp-collage-clips-wall","comp-section-collage","comp-berm-section","comp-collage-section","comp-deception-collage"]);
  // Only edges whose BOTH ends are playable concepts: graph-only concepts (still being designed) stay out of combat content.
  // ── Original class pack (Claude, 2026-10-08): concepts, abilities and characters for the 15 classes wired by
  //    classes/class-runtime.js. Class abilities carry `pairs`: only that exact primary + secondary unlocks them.
  if (ClassRuntime && Kits.stagedConcepts) {
    const W = ClassRuntime.wire;
    for (const [cls, [p, sec]] of Object.entries(ClassRuntime.CLASS_PAIRS)) for (const c of [p, sec]) if (!concepts[c] && Kits.stagedConcepts[c]) {
      const { channel, ...def } = Kits.stagedConcepts[c];
      concepts[c] = { ...def, abilities: [] }; conceptDamageTypes[c] = channel;
    }
    if (Kits.stagedConcepts.periodicity && !concepts.periodicity) {
      const { channel, ...def } = Kits.stagedConcepts.periodicity;
      concepts.periodicity = { ...def, abilities: [], sealed: true }; conceptDamageTypes.periodicity = channel;
      for (const id of def.abilities || []) {
        const st = Kits.staged[id]; if (!st || abilities[id]) continue;
        abilities[id] = { name: st.name, concepts: st.concepts, tier: st.tier, delivery: st.delivery, target: st.target || (st.delivery === "self" ? "self" : "enemy"),
          area: st.area || { shape: "single" }, cost: st.cost, range: st.range ?? 0, potency: st.potency ?? 0, damageType: st.channel || "nigredo",
          effect: st.effect || "guard", mechanism: st.mechanism, reveal: st.reveal, announce: st.announce || null, classKind: "sealed",
          effectCategory: st.effectCategory || "conditional" };
        if (!concepts.periodicity.abilities.includes(id)) concepts.periodicity.abilities.push(id);
      }
    }
    for (const c of ["mise_en_place", "homology"]) if (!concepts[c] && Kits.stagedConcepts[c]) {   // playable (Mala, 2026-10-28): whoever equips it gets its kit; Rack and Label and Parallel Prep carry no class pair (the Chef, 2026-10-30, holds it but leaves them open)
      const { channel, ...def } = Kits.stagedConcepts[c];
      concepts[c] = { ...def, abilities: [] }; conceptDamageTypes[c] = channel;
    }
    for (const [id, w] of Object.entries(W)) {
      const def = Kits.staged[id]; if (!def || abilities[id]) continue;
      const { kind, needs, buff, ...content } = w;
      abilities[id] = { ...def, ...content, area: content.area || def.area || { shape: "single" }, potency: content.potency ?? def.potency ?? 0, range: content.range ?? def.range ?? 0,
        pairs: ClassRuntime.pairsFor(id), classKind: kind || null, classNeeds: needs || null, classBuff: buff || null, effectCategory: def.effectCategory || "conditional" };
      const home = concepts[def.concepts[0]]; if (home && !home.abilities.includes(id)) home.abilities.push(id);
    }
    // Homology (Mala, 2026-11-04): the four staged entries become castable through graph/homology-rules.js `playable()`, the one definition of their cost, timing and effect (the W loop above only
    // gave them the generic shape; tempo and the LF price live on `playable()`). The two named technique vows are nested in their staged entries and are built there too.
    if (ClassRuntime.homology && concepts.homology) for (const id of ["comparativeAnatomy", "conservedJoint", "ancestralReconstruction"]) {
      const made = ClassRuntime.homology.playable(id, Kits.staged[id]), put = (aid, def) => { abilities[aid] = { ...def, pairs: ClassRuntime.pairsFor(aid), classKind: W[aid].kind, classNeeds: null, classBuff: null, effectCategory: "conditional" }; if (!concepts.homology.abilities.includes(aid)) concepts.homology.abilities.push(aid); };
      put(id, made.ability); if (made.vow) put(ClassRuntime.homology.VOW_ID[id], made.vow);
    }
    if (concepts.homology) concepts.homology.aiOnly = true;   // no human picks it until the casting picker (L3) exists: see ui.js pickableConceptIds
    for (const id of ["chargeWave", "hurlFeast", "vowOpenHand", "vowNeverQuench", "vowSharedBowl"]) { const home = concepts.bird_mountain; if (home && abilities[id] && !home.abilities.includes(id)) home.abilities.push(id); }
    for (const [cls, [p, sec]] of Object.entries(ClassRuntime.CLASS_PAIRS)) {
      if (characters[cls] || !concepts[p] || !concepts[sec]) continue;
      const sprite = ClassRuntime.builds[cls].sprite.split("/").pop();
      characters[cls] = { name: ClassRuntime.CLASS_NAMES[cls], side: "enemy", sprite, level: 1, xp: 0, ai: cls, classPack: true, conceptPool: [p, sec],
        configs: [{ id: `${cls}-1`, label: `${concepts[p].name} + ${concepts[sec].name}`, primary: p, secondary: sec, reserve: [], lens: {} }],
        primary: p, secondary: sec, reserve: [], lens: { [p]: "balanced", [sec]: "balanced" } };
    }
    if (characters.hanuman) Object.assign(characters.hanuman, { traits: ["loyal", "courageous", "playfulness", "rivalrous"], startStates: ["hanumanBase", "hanumanForgotten"],
      learned: ["formBase", "formMonkey", "formGiant", "vanish"], allyFavors: ["jambavan"] });
    if (characters.jambavan) characters.jambavan.traits = ["contemplative", "traditionalist", "honorable"];
    if (characters.jatayu) Object.assign(characters.jatayu, { traits: ["aerodynamic", "loyal", "courageous"], startStates: ["jatayuAloft", "jatayuLastWord"] });   // Jatayu (docs/jatayu-build.md): winged, so he breaks the serpent noose
    if (characters.surpanakha) Object.assign(characters.surpanakha, { traits: ["vengeful", "rivalrous", "impatient", "proud"], startStates: ["surpanakhaGuise", "surpanakhaWounded"],
      fleeChain: { character: "maricha", chance: 1, delay: 1, states: ["marichaDeer"], why: "Her flight is a lure: Lanka sends a golden deer to the place she ran from." } });   // Surpanakha (docs/surpanakha-build.md; Mala: vengeful AND rivalrous)
    if (characters.wizard) {   // Wizard kit + High remainder (Mala, 2026-10-27): Arcane Mastery + astral presence always (a master, not a student); cipher primary; imagination aboard for wards and rehearsal (his summon source is an open loop — the palace stays Warden-only); NPCs draw control or engine
      const wiz = characters.wizard;
      wiz.traits = ["arcaneMastery", "astralPresence"];
      for (const c of ["imagination", "cipher"]) if (!wiz.conceptPool.includes(c)) wiz.conceptPool.push(c);
      wiz.primary = "cipher"; wiz.secondary = "selectivity"; wiz.reserve = ["pipeline", "imagination"];
      wiz.lens = { cipher: "finePrint", selectivity: "fine", pipeline: "balanced", imagination: "balanced" };
      wiz.configs = [
        { id: "wizard-1", label: "Cipher + Selectivity", primary: "cipher", secondary: "selectivity", reserve: ["pipeline", "imagination"], lens: { ...wiz.lens } },
        { id: "wizard-2", label: "Pipeline + Imagination", primary: "pipeline", secondary: "imagination", reserve: ["cipher", "selectivity"], lens: { ...wiz.lens } },
      ];
    }
    // Rivals (Mala, 2026-10-24: "I like them all"): a rivalrous unit's hostility toward a named rival on the field is multiplied by
    // rules.factions.rivalHate (engine/factions.js rivalry). Only a holder of the rivalrous trait feels it.
    for (const [id, rivals] of Object.entries({ surpanakha: ["sita"], pathfinder: ["ranger"], president: ["mao_zedong"], indrajit: ["lakshmana"],
      lakshmana: ["indrajit"], ravana: ["rama"], hanuman: ["monkey_king"], rapper: ["cyph"], detective: ["thief"], samurai: ["ninja"],
      tech_billionaire: ["oil_billionaire"], jpop_idol: ["neon_idol"] })) if (characters[id]) characters[id].rivals = rivals;
    if (characters.paladin) characters.paladin.traits = ["consecrated", "faithful", "compassionate", "zealous"];   // the Paladin re-spec (PALADIN.md), whoever controls him
    // Mala, 2026-11-01: the Paladin's default sprite is the newer Crusader cut; the October art is the Oathbound outfit. An ally Paladin rolls one of the two (engine allyLook); the Neon outfit (level 200) is briefs/paladin-costumes-build.md.
    if (characters.paladin) Object.assign(characters.paladin, { sprite: "paladin-crusader", variants: ["paladin-crusader", "paladin"], spritePackageNames: { "paladin-crusader": "Crusader", paladin: "Oathbound" } });
    if (characters.rapper) characters.rapper.traits = [...new Set([...(characters.rapper.traits || []), "rivalrous"])];   // the rap battle (no insight profile)
    if (characters.mandodari) characters.mandodari.traits = ["honest", "loyal", "truthSeeker"];   // Mandodari (docs/mandodari-build.md)
    if (characters.indrajit) Object.assign(characters.indrajit, { traits: ["ambitious", "rivalrous", "proud"], learned: ["vanish"] });   // Indrajit (docs/indrajit-build.md): he fights from the clouds
    if (characters.kumbhakarna) Object.assign(characters.kumbhakarna, { traits: ["loyal", "honorable", "ironStomach"], startStates: ["kumbhakarnaAsleep", "kumbhakarnaVast"] });   // Kumbhakarna (docs/kumbhakarna-build.md): he told Ravana he was wrong, and fought for him anyway
    if (characters.ravana) Object.assign(characters.ravana, { traits: ["proud", "rivalrous", "devoutBeliever"], startStates: ["ravanaHeads", "ravanaBoon"] });   // Ravana (docs/ravana-build.md): Shiva's devotee, too proud to listen
    if (characters.sita) Object.assign(characters.sita, { traits: ["dreamer", "devoutBeliever", "loyal"], dreamer: { openLess: 40, apMul: 0.5, drainLess: 10 },
      calls: ["rama", "lakshmana", "hanuman", "jambavan"], heralds: { character: "rama", chance: 0.75, delay: 1, why: "If you see Sita, her husband is on the way." } });   // Sita (docs/sita-build.md)
    if (characters.lakshmana) Object.assign(characters.lakshmana, { traits: ["loyal", "impatient", "rivalrous"], startStates: ["lakshmanaUnfallen"] });   // Lakshmana (docs/lakshmana-build.md)
    if (characters.rama) Object.assign(characters.rama, { traits: ["honorable", "dutiful", "brave"], swearsWord: true });   // brave, not courageous (Mala, 2026-10-27: "Rama getting fearless"): he never flees or routs   // Rama (docs/rama-build.md): he keeps a word   // Jambavan (docs/jambavan-build.md)   // Hanuman (docs/hanuman-build.md): playfulness is the child the sages cursed
    if (characters.aviator_hero) characters.aviator_hero.traits = ["aerodynamic", "adrenalineJunkie"];   // Mala's two (2026-10-18), whoever controls him
    if (characters.starfarer) characters.starfarer.traits = ["lightFrame", "shipsEngineer"];   // Starfarer (Mala, 2026-10-19), whoever controls her
    if (characters.pioneer) characters.pioneer.traits = ["homestead", "markedGround"];   // Pioneer (Mala, 2026-10-19), whoever controls her
    if (characters.martial_artist) characters.martial_artist.traits = ["playfulness", "competitive"];   // Martial Artist (Mala, 2026-10-22): values trait playfulness, same as Monkey King
    if (characters.memorialist) characters.memorialist.traits = ["steadyHands", "eulogy"];   // Memorialist (Codex, 2026-10-24): longer Roll wards + once-a-battle self-mend
    if (characters.seedkeeper) characters.seedkeeper.traits = ["cacheMinded", "hardy", "posterity"];   // Seedkeeper (Codex, 2026-10-24): 4 caches, Hardy vs field, first bury cheap
    if (characters.ferryman) characters.ferryman.traits = ["strongBack", "tollkeeper", "theFare"];   // Ferryman (Codex, 2026-10-24): range 5 + holds first shove, 12-AP tolls, first Ferry free
    if (characters.pearl_diver) characters.pearl_diver.traits = ["breathHolder", "tideReader", "theDeep"];   // Pearl Diver (Codex, 2026-10-24): long conceal + holds first shove, +1 swale range, cheap Drown per basin
    // Posterity suit warriors (Mala, 2026-11-04): three traits each (physio / psych / value). No touchedByMagic: technology is not magic. Artist credit follows the cut.
    if (characters.orgonite_trooper) Object.assign(characters.orgonite_trooper, { traits: ["heavyArmor", "dutiful", "steward"], artist: "@ManavuArt" });
    if (characters.leviathan_suit) Object.assign(characters.leviathan_suit, { traits: ["hardy", "restless", "dreamer"], artist: "@ManavuArt" });
    if (characters.scale_firmware) Object.assign(characters.scale_firmware, { traits: ["heavyArmor", "imaginative", "ambitious"], artist: "@ManavuArt" });
    if (characters.white_jacket_gunner) Object.assign(characters.white_jacket_gunner, { traits: ["hardy", "tinkerer", "ambitious"], artist: "@ManavuArt" });
    if (characters.bronze_admin) Object.assign(characters.bronze_admin, { traits: ["hardy", "dutiful", "steward"], artist: "@ManavuArt" });
    if (characters.horned_suit) Object.assign(characters.horned_suit, { traits: ["heavyArmor", "imaginative", "dreamer"], artist: "@ManavuArt" });
    if (characters.martial_artist) characters.martial_artist.variants = ["martial-artist", "martial-artist-ascended"];   // R5: the gold head is her voice, not a new speaker
    // The Animal Tamer is an older NPC (npc(), above), so the class-pack loop leaves him alone: his Resonance +
    // Transmigration loadout is added here, once Transmigration is live (2026-10-15). Swale + Resonance stays.
    { const t = characters.animalTamer;
      if (t && concepts.transmigration && !t.configs.some((c) => c.secondary === "transmigration")) {
        t.conceptPool = [...new Set([...t.conceptPool, "transmigration"])];
        t.configs = [{ id: "animal-tamer-tm", label: `${concepts.resonance.name} + ${concepts.transmigration.name}`, primary: "resonance", secondary: "transmigration", reserve: ["diffusion"], lens: {} }, ...t.configs.filter((c) => c.secondary !== "diffusion")];
      } }
    // Boss rush (docs/boss-rush.md): the two non-boss Omega threats. The runner doesn't exist yet;
    // the flags plus BossRules.rushBosses() are the contract it will read.
    for (const id of ["agi", "tech_billionaire"]) if (characters[id]) characters[id].omega = true;
  }
  if(concepts.stealth){
    concepts.stealth.abilities=concepts.stealth.abilities.filter(id=>!["decoy","wait","recoveryStrike","genjutsu","vanishingCut","pickpocket","skim","emptyPockets","perfectHeist"].includes(id));   // pair-gated ninja/thief kits: granted by pairs, never shared (cyphOpenMic precedent)
    concepts.legitimacy.abilities=concepts.legitimacy.abilities.filter(id=>!["halt","evidence","arrest"].includes(id));   // pair-gated police kit (cyphOpenMic precedent)
    concepts.constraint.abilities=concepts.constraint.abilities.filter(id=>!["cuff","takedown"].includes(id));   // pair-gated police kit (cyphOpenMic precedent)
    concepts.deception.abilities=concepts.deception.abilities.filter(id=>!["hairClone","monkeyMischief","staffSky","merge","spareHair"].includes(id));   // pair-gated monkey kit (cyphOpenMic precedent)
    concepts.leverage.abilities=concepts.leverage.abilities.filter(id=>!["somersaultCloud","jinguBang"].includes(id));   // pair-gated monkey kit (cyphOpenMic precedent)
  }
  if(concepts.lyricism){
    concepts.lyricism.abilities=concepts.lyricism.abilities.filter(id=>id!=="cyphOpenMic");
    concepts.lyricism.abilities=concepts.lyricism.abilities.filter(id=>id!=="jazzSolo"&&id!=="cuttingContest");   // pair-exclusive jazz kit: granted by pairs below, never shared (cyphOpenMic precedent)
    concepts.harmony.abilities=concepts.harmony.abilities.filter(id=>id!=="blueNote");
    concepts.lyricism.scope="Seeded techniques from unequipped, playable concepts, preserving their original prerequisites and counters.";
    concepts.lyricism.limits="No ultimates, merges or class-exclusive draws; one pocket for two turns. Freestyle delivers now at ×0.85; written lines are selected before delivery.";
  }
  if(characters.musician){characters.musician.conceptPool.push("lyricism");characters.musician.configs.push({id:"musician-words",label:"Harmony + Lyricism",primary:"harmony",secondary:"lyricism",reserve:[],lens:{}});}

  if(characters.bastet)characters.bastet.traits=[...(characters.bastet.traits || []),"catNap"];
  if(characters.ninja)characters.ninja.traits=["insaneReflexes","collector"];
  if(characters.ritual_chanter)characters.ritual_chanter.traits=["unendingChant"];   // Rites (Muse-2): psychological trait — holds rite steps until spent, no fizzle
  if(characters.police_officer){characters.police_officer.traits=["dutiful","honest","byTheBook"];characters.police_officer.side="civilian";}
  if(characters.thief)characters.thief.traits=["collector","greedy","stickyFingers"];
  if(characters.monkey_king)characters.monkey_king.traits=["godlyAgility","drunkenMonkey","playfulness","astralPresence"];
  // The seven classic dream monsters' one named attack each (dream/enemy-dreams-data.js is the source of the numbers;
  // tests/monster-attacks.test.mjs holds the two in step). Not on any concept's list: a monster is offered its own
  // through `learned` (dreamspace.js makeEnemyDreamActor). Riders (drain, wrap, strip, infect, wail, leap) run from
  // engine/conditions.js monsterRider.
  { const mon = (key, name, concept, extra, mechanism) => { abilities[`mon_${key}`] = { name, tier: "basic", concepts: [concept], monsterAbility: key, cost: 0, tempoCost: 30, effect: "damage", effectCategory: "universal",
      mechanism, reveal: `${name} is the one attack its kind has.`, prompt: "What does this creature's single attack ask of you?", ...extra }; };
    mon("lifeDrain", "Life Drain", "diffusion", { delivery: "contact", target: "enemy", area: { shape: "single" }, range: 1, potency: 12, damageType: "citrinitas" }, "Drains an adjacent target by how much healthier they are than it (up to 12), and heals what it drains.");
    mon("bindingWraps", "Binding Wraps", "inertia", { delivery: "contact", target: "enemy", area: { shape: "single" }, range: 1, potency: 6, damageType: "nigredo" }, "6 impact, and the target cannot move on its next turn.");
    mon("stripBare", "Strip Bare", "pruning", { delivery: "line", target: "enemy", area: { shape: "single" }, range: 4, potency: 8, damageType: "albedo" }, "8 piercing, and the target loses one defensive status (guard, ward or brace).");
    mon("galvanicSlam", "Galvanic Slam", "resonance", { delivery: "contact", target: "enemy", area: { shape: "single" }, range: 1, potency: 16, damageType: "rubedo", knockback: 2 }, "16 resonance to an adjacent target, which is thrown 2 tiles.");
    mon("infectiousBite", "Infectious Bite", "pathway", { delivery: "contact", target: "enemy", area: { shape: "single" }, range: 1, potency: 8, damageType: "citrinitas" }, "8, and the target is infected: −3 LF at the end of each of its turns for 3 turns. Any heal cures it.");
    mon("pounce", "Pounce", "threshold", { delivery: "contact", target: "enemy", area: { shape: "single" }, range: 3, potency: 14, damageType: "albedo" }, "Leaps up to 3 tiles to land beside a target and strikes for 14.");
    mon("chillingWail", "Chilling Wail", "boundary", { delivery: "field", target: "self", area: { shape: "radius", radius: 2 }, range: 0, potency: 6, damageType: "citrinitas" }, "Everyone within 2 takes 6 and loses 10 AP next turn.");
    mon("broodBite", "Brood Bite", "diffusion", { delivery: "contact", target: "enemy", area: { shape: "single" }, range: 1, potency: 8, damageType: "citrinitas" }, "8 citrinitas to an adjacent target.");
  }
  const represented = (edges) => (edges || []).filter(e => (e.source === "section" || e.target === "section" || e.source === "collage" || e.target === "collage")
      && (concepts[e.source] || e.source === "*") && (concepts[e.target] || e.target === "*"))
    .map(e => ({ ...e, status: implementedRepresentationEdges.has(e.id) ? "known" : "draft", exceptions: e.exceptions || [], origin: "graph" }));
  const allOpposition = [...opposition, ...represented(GraphData.opposition)];
  const allComposition = [...composition, ...represented(GraphData.composition)];
  // Omega threats (docs/boss-rush.md): characters on the boss rush list beside the flagged bosses. The Tech Billionaire
  // can release the AGI; the AGI's takeoff can make it the fight.
  for (const id of ["agi", "tech_billionaire"]) characters[id].omega = true;

  for (const [id, sub] of Object.entries(SUBFACTION_OF)) if (characters[id]) characters[id].subfaction = sub;   // after the class-pack loop: every class tagged
  return { namePools: NAME_POOLS, rules, progression, tiles, concepts, abilities, states, effectCategories, opposition: allOpposition, composition: allComposition, arenas, characters, subfactions, encounters, damageTypes, conceptDamageTypes };
});
