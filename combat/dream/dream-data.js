"use strict";
// Dream monsters (Mala's pack, 2026-10-08; source: ~/Documents/concept-combat-dream-monsters.yaml).
// They are monsters: the "wild" side, hostile to everyone. Unlike the ecological monsters (wild/), they
// fight like characters with real concepts. Until their own techniques are built they use the
// existing abilities of their configured concepts; basic/refined/ultimate/exclusive stay as specs.
//
// Claude added (needs Mala's OK):
//   appear  when each one surfaces in an ordinary battle (a board condition that echoes its dream),
//   wake    "Name it": answer its transfer question to wake from it (expected answer + 2 misconceptions),
//   fade    dreams end on their own at dawn (after `rounds`), or when badly hurt.
// Plain data. Numbers PROVISIONAL.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatDreamData = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const rules = {
    side: "wild", maxActive: 1, noAppearBeforeRound: 3, lf: 40,
    dawnRounds: 5,                 // a dream fades by itself after this many rounds
    dissolveAt: 0.25,              // ...or when its LF falls to 25%
    nameIt: { actionCost: 20, correct: "fadesAtRoundEnd", wrong: { potencyMul: 1.2, retryAfterRounds: 2 }, xpAsCorrectAnswer: true },
    perimeterGuardianDamageMul: 1.25,   // the Perimeter Guardian summon was once a nightmare: it hits dream monsters harder
  };

  const monsters = {
    last_span: {
      name: "The Last Span", configs: [{ id: "crossing", primary: "threshold", secondary: "boundary" }, { id: "detour", primary: "pathway", secondary: "threshold" }],
      teaches: "A safe destination does not guarantee a safe route.",
      techniques: {
        basic: { name: "Missing Railing", mechanism: "Remove protection from one eligible terrain edge without changing the floor.", status: "spec" },
        refined: { name: "The Last Step", mechanism: "Mark an existing weakened tile. A declared crossing condition triggers its collapse; intact terrain cannot collapse for free.", status: "spec", uses: "terrain/structures.js cliff integrity and bridges" },
        ultimate: { name: "Almost Across", mechanism: "Announce several vulnerable crossing points and arm their triggers. The player can change routes, reinforce terrain, or interrupt preparation.", status: "spec" },
        exclusive: { name: "Borrowed Passage", mechanism: "Temporarily support one otherwise broken crossing. The support expires at an announced event rather than after an unseen timer.", price: "The monster cannot collapse a crossing while its own support remains active.", counterplay: "Leave before expiry or establish an independent route.", status: "spec" },
      },
      appear: [{ when: "bridgeCollapse", chance: 0.6 }, { when: "heroFellOrStaggered", requires: "ledgeOrBridgeOnMap", chance: 0.35 }],
      wake: { question: "What distinguishes destination accessibility from route continuity?",
        choices: ["Every required segment must remain traversable when it is used.", "If the destination can be seen, the route is safe.", "A route that held once will hold again."], answer: 0 },
    },
    many_mouths: {
      name: "The Many-Mouthed Hound", configs: [{ id: "pack", primary: "diffusion", secondary: "threshold" }, { id: "encircle", primary: "boundary", secondary: "diffusion" }],
      teaches: "Stopping one attacker is different from interrupting propagation.",
      techniques: {
        basic: { name: "Scent Trail", mechanism: "Spread a tracking disturbance through connected eligible tiles.", status: "spec" },
        refined: { name: "Flanking Echo", mechanism: "Activate a bite at a connected marked location. Disconnected marks cannot receive the activation.", status: "spec" },
        ultimate: { name: "Every Mouth Arrives", mechanism: "Announce simultaneous attacks from existing reachable marks. Each attack uses part of a shared potency budget.", status: "spec" },
        exclusive: { name: "One Hunger, Many Bodies", mechanism: "Distribute one attack's potency among several manifestations. Manifestations cannot duplicate the original damage budget.", price: "More manifestations reduce potency per manifestation.", counterplay: "Break connections, close approaches, or force the pack into one route.", status: "spec" },
      },
      appear: [{ when: "heroPursued", hostilesWithin: 2, atLeast: 2, chance: 0.3 }],
      wake: { question: "Why can a strong local defense fail against a distributed threat?",
        choices: ["Because the defense was not strong enough.", "Other connected routes remain available.", "Because distributed threats ignore walls."], answer: 1 },
    },
    amber_host: {
      name: "The Amber Host", configs: [{ id: "swarm", primary: "diffusion", secondary: "selectivity" }, { id: "chorus", primary: "resonance", secondary: "selectivity" }],
      teaches: "Filtering depends on an explicit criterion and a functioning boundary.",
      techniques: {
        basic: { name: "Find the Opening", mechanism: "Propagate through routes that satisfy a declared passage criterion.", status: "spec" },
        refined: { name: "Matched Hum", mechanism: "Reinforce an eligible vibration through repeated matched excitation.", status: "spec" },
        ultimate: { name: "The Hive Agrees", mechanism: "Announce a shared frequency and concentrate the swarm's output into matching targets within its connected region.", status: "spec" },
        exclusive: { name: "Distributed Antennae", mechanism: "Observe whether a probe passes through a local opening. Return only that observation; do not reveal hidden enemy abilities.", price: "Probing spends an action and exposes the probe.", counterplay: "Reject the probe, change the criterion, or sever its return route.", status: "spec" },
      },
      appear: [{ when: "plantsDestroyed", atLeast: 2, chance: 0.35 }, { when: "manyFlowers", hedgesAtLeast: 4, fromRound: 4, chance: 0.1 }],
      wake: { question: "What must you specify before claiming that a filter blocks something?",
        choices: ["Only that a wall is present.", "How strong the filter is.", "Its acceptance criterion, the relevant input properties, and possible bypass routes."], answer: 2 },
    },
    witness_vessel: {
      name: "The Witness Vessel", configs: [{ id: "witness", primary: "deception", secondary: "sightline" }, { id: "verdict", primary: "threshold", secondary: "deception" }],
      teaches: "A signal about an action is not the action itself.",
      techniques: {
        basic: { name: "False Glance", mechanism: "Display a misleading indication of an eligible hidden commitment.", status: "spec" },
        refined: { name: "Held Gaze", mechanism: "Prepare an effect requiring an unobstructed sightline at resolution.", status: "spec" },
        ultimate: { name: "You Saw It Coming", mechanism: "Announce an attack through the game's deception rules. Calibration and legal defensive responses remain available.", status: "spec" },
        exclusive: { name: "The Expected Wound", mechanism: "Record the defender's declared prediction before resolution. A wrong prediction activates one bounded follow-up effect.", price: "Must offer a truthful calibration opportunity before prediction.", counterplay: "Inspect evidence, break sightline, or decline an optional prediction.", status: "spec", uses: "math draft R8 calibration" },
      },
      appear: [{ when: "announcementOrTell", chance: 0.3 }],
      wake: { question: "How do you distinguish deceptive signaling from a changed mechanism?",
        choices: ["Compare the signal with independently observable execution evidence.", "Trust the announcement unless it seems unlikely.", "Assume every announcement is a lie."], answer: 0 },
    },
    salt_heir: {
      name: "The Salt Heir", configs: [{ id: "collector", primary: "swale", secondary: "diffusion" }, { id: "impounder", primary: "boundary", secondary: "swale" }],
      teaches: "Routing, storage and removal are different operations.",
      techniques: {
        basic: { name: "Low Ground", mechanism: "Slow and store eligible runoff in a vegetated depression.", status: "spec" },
        refined: { name: "Closed Outlet", mechanism: "Restrict an existing outlet, increasing local retention.", status: "spec" },
        ultimate: { name: "Everything Flows Here", mechanism: "Announce a drainage region and redirect available runoff toward it. Cannot create water or make it move uphill without a supported mechanism.", status: "spec", uses: "wild flash flood + terrain heights" },
        exclusive: { name: "Inheritance of the Basin", mechanism: "Gain a bounded benefit from runoff genuinely retained in its controlled depression.", price: "Retention has finite capacity; overflow follows existing terrain.", counterplay: "Open an outlet, intercept inflow, or exceed storage capacity.", status: "spec" },
      },
      appear: [{ when: "floodOrBurst", chance: 0.4 }, { when: "wetMap", waterTilesAtLeast: 8, fromRound: 4, chance: 0.1 }],
      wake: { question: "Why does slowing runoff not necessarily remove flood risk?",
        choices: ["Slowed water evaporates before it can flood.", "Stored water remains, capacity is finite, and overflow needs a route.", "Swales remove water from the site entirely."], answer: 1 },
    },
    unfinished_customer: {
      name: "The Unfinished Customer", configs: [{ id: "routine", primary: "adaptation", secondary: "inertia" }, { id: "pursuit", primary: "pathway", secondary: "adaptation" }],
      teaches: "An adaptive response can remain trapped inside a limited repertoire.",
      techniques: {
        basic: { name: "Same Aisle", mechanism: "Resist displacement while following its declared route.", status: "spec" },
        refined: { name: "Another Entrance", mechanism: "Reach a destination through an existing alternate passage.", status: "spec" },
        ultimate: { name: "The Mall Never Closes", mechanism: "Announce a destination and prepare pursuit through several existing routes. Route closure and terrain damage can invalidate its plan.", status: "spec" },
        exclusive: { name: "Habit's Armor", mechanism: "Strengthen resistance to repeated observed harm channels while remaining on its committed route.", price: "Leaving the route removes the additional protection.", counterplay: "Force a detour, alter the harm channel, or change the destination's accessibility.", status: "spec", uses: "Adaptation auto-attunement (engine 1.3.14)" },
      },
      appear: [{ when: "enclosedLongFight", modes: ["survive", "escape"], fromRound: 4, pillarsAtLeast: 4, chance: 0.2 }],
      wake: { question: "When does a successful repeated response become a liability?",
        choices: ["Never: if it worked before, it will work again.", "Only when it is used too often.", "When conditions change and the response cannot change with them."], answer: 2 },
    },
  };

  return { rules, monsters };
});
