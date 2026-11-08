"use strict";
// Wiring-ready builds for the original class pack (Mala, 2026-10-08: "lets build them out so all thats left is being
// wired in"). For each class: its full kit (new staged abilities + shared existing ones), machine-readable passives
// (trigger, effect, bound, counter), and its sprite folder. Concepts: graph-data.js; abilities: kits-data.js staged;
// concept definitions: kits-data.js stagedConcepts. Kept out of classes-data.js so concurrent class edits don't collide.
//
// Passive spec: { trigger, effect: { …numbers }, bound, counter }. Every passive is bounded (pack rule: no unlimited
// resources, actions or resistance) and has observable counterplay.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatClassBuilds = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const B = (kit, shared, passives, sprite, status = "live") => ({ status, kit, shared, passives, sprite: `combat/sprites/${sprite}` });

  const builds = {
    rapper: B(["freestyle","writtenVerse","clip","juxtapose","dissTrack"], {}, {
      embodiment:{trigger:"perform a borrowed technique",effect:{keepsOriginalCounters:true},bound:"no ultimates or class-exclusive draws",counter:"Deny its prerequisites or silence the performer."},
      sampling:{trigger:"Clip a witnessed technique",effect:{needsSourceSight:false},bound:"only techniques seen this battle; normal fragment capacity",counter:"Withhold the technique or outlast its sample."},
      wordplay:{trigger:"discard an unperformed freestyle",effect:{redraws:1},bound:"one redraw per battle",counter:"The redraw is still random."}
    },"rapper"),
    musician: B(["consonance","lullaby","resonantPulse","sympatheticChord","encore"], {secondaryBasic:"resonantPulse"}, {
      in_key:{trigger:"Harmony or Resonance on consecutive turns",effect:{add:.05,cap:.2},bound:"one increment per owner turn; skipped turn resets",counter:"Stun, silence or interrupt the key."},
      sympathetic_strings:{trigger:"the next actor is an ally",effect:{ap:10},bound:"once per round",counter:"Break the turn order."},
      pastoral:{trigger:"Lullaby on a wild creature",effect:{chance:.85,turns:2},bound:"breaks on harm from singer's side",counter:"Keep fighting or block the sound."}
    },"musician"),
    bard: B(["consonance","enchantingAir","secondContribution","pairedFunction","balladOfTheBattle"], {secondaryBasic:"secondContribution"}, {
      glamour:{trigger:"Enchanting Air",effect:{dreamChance:.85},bound:"two target turns; breaks on harm",counter:"Membrane, anchoring, or magic-trained characters."},
      inspiration:{trigger:"an ally acts after the bard",effect:{echo:true},bound:"once per round; one eligible basic/refined ally technique",counter:"Deny the echoed technique prerequisites."},
      tale_told:{trigger:"the next ally acts",effect:{shareWitnessedTell:true},bound:"one already-witnessed technique; no hidden disclosures",counter:"Show the bard no usable material."}
    },"bard"),
    jazz_musician: B(["riff","freestyle","lullaby","jazzSolo","blueNote","cuttingContest"], {secondaryBasic:"riff"}, {
      session_player:{trigger:"perform a Harmony or Lyricism technique",effect:{jam:true},bound:"joiners spend their round reaction; no chains",counter:"Silence, stun or deafen; drain reactions; deny targets."},
      trading_fours:{trigger:"2 or more join a session",effect:{tempo:10},bound:"once per round",counter:"Keep the band to one voice."}
    },"jazz-musician"),
    modern_artist: B(["deployWorkstation","calibrateTool","rasterPass","layerMask","renderEngine","compileTheCanvas"],{}, {
      finite_workbench:{trigger:"Deploy Workstation",effect:{deployments:2,activeTools:1,workingRadius:2},bound:"two per battle; three owner turns per tool",counter:"Deny access or destroy the tool."},
      single_buffer:{trigger:"Raster Pass",effect:{buffers:1},bound:"one program, two owner turns; compile consumes it",counter:"Outlast it or deny the workstation."}
    },"modern-artist"),
    cyph: B(["cyphOffTheTop","cyphPocketVerse","cyphOpenMic","filterBolt","cyphCheckTheLabel","cyphCuratedCypher"],{secondaryBasic:"filterBolt"},{
      careful_service:{trigger:"an ally accepts service",effect:{portions:3,nextHitMul:0.8},bound:"three per battle; no stacking",counter:"Outlast his stock or separate the ally."},
      curated_catalogue:{trigger:"Pocket Verse",effect:{draw:3,keep:1},bound:"one pocket, two owner turns",counter:"Deny the held bar's range or line."}
    },"cyph"),
    // Agent Swarm (Mala, 2026-10-13; docs/agent-swarm.md): drone towers on whatever the map offers, and a living circuit.
    agent_swarm: B(["droneStation", "droneVolley", "readLivingCircuit", "correctivePulse", "holographicSwarm"], {}, {
      relay_anchor: { trigger: "a living circuit's plant is within 3 and in sight of one of his towers", effect: { circuitReachFromTowers: true }, bound: "his own towers; one circuit at a time", counter: "Break the tower, or the plant." },
      data_hub: { trigger: "a tower anchored on a data center", effect: { towerRangeAdd: 1, buildingWard: 1 }, bound: "one ward per anchoring; it does not fire twice", counter: "Spend a hit on the ward, then break the building." },
    }, "agent-swarm"),
    knight: B(["shieldFace", "coveredAdvance", "stepBetween", "escortScreen", "lineRemains"], {}, {
      established_guard: { trigger: "you didn't move last turn", effect: { nextDirectionalDefenseMul: 0.8 }, bound: "once per turn; only the next directional defense", counter: "Force movement (shoves) to reset it." },
      // Mala, 2026-10-13: replaces Interception Training (which repeated Step Between and fired twice in 96 sim trios).
      lance_charge: { trigger: "your first Strike in a turn after walking 3 or more tiles that turn", effect: { strikePotencyAdd: 6 }, bound: "once per turn", counter: "Close the distance yourself, or stand where he cannot build a run." },
    }, "knight"),
    paladin: B(["smite", "layOnHands", "swear", "keepFaith", "hymnOfTheOath"], {}, {
      oathbound: { trigger: "you name a ward, or intercept for them; you keep faith", effect: { wardInterceptsFree: true, faithReturnsPf: 2 }, bound: "one ward per battle until they fall; interceptions still spend the granting ability's uses; the ΦF returns only when Keep Faith resolves", counter: "Threaten someone else: the oath names one ally. Break the oath and Keep Faith locks." },
      unbroken_oath: { trigger: "your oath holds (and you intercept while your ward lives)", effect: { damageTakenMul: 0.9, interceptMul: 0.6 }, bound: "only while the oath is unbroken; interceptions only for the ×0.6", counter: "Break the oath (bait a retreat, drop the ward below half); fields can't be intercepted." },
    }, "paladin"),
    pharaoh: B(["swornIn", "executiveDirection", "boundaryLine", "royalException", "lawBindsItsMaker"], { primaryBasic: "swornIn", primaryRefined: "executiveDirection", secondaryBasic: "boundaryLine" }, {
      recognized_office: { trigger: "you stand inside a boundary you own with a valid claim", effect: { permissionsGrantable: 1 }, bound: "1 bounded permission at a time", counter: "Disprove the claim (Inference); leave the territory." },
      reciprocal_law: { trigger: "you create a restriction", effect: { bindsOwner: true, restrictionPotencyMul: 1.15 }, bound: "applies to your own restrictions only", counter: "Bait the Pharaoh into breaking its own rule." },
    }, "pharaoh"),
    daedalus: B(["earthBerm", "keylineTerrace", "sectionCut", "designedPassage", "exitWasDesigned"], { primaryBasic: "earthBerm", primaryRefined: "keylineTerrace", secondaryBasic: "sectionCut" }, {
      reusable_works: { trigger: "you dismantle an intact construct you own", effect: { refundPf: 2 }, bound: "max 2 refunds per battle", counter: "Destroy constructs before they're dismantled (no refund)." },
      designed_access: { trigger: "you raise a construct", effect: { hiddenPassage: 1 }, bound: "1 passage per construct", counter: "A Section cut reveals passages." },
    }, "daedalus"),
    samurai: B(["readTheOpening", "recoveryCut", "clearShot", "measuredOpening", "oneDeclaredMoment"], { secondaryBasic: "clearShot" }, {
      measured_stillness: { trigger: "you Observe while stationary", effect: { nextAimedMul: 1.15 }, bound: "1 aimed commitment", counter: "Force it to move." },
      recovery_read: { trigger: "you saw a target execute an announced or delayed technique", effect: { readsRecoveryWindow: true }, bound: "public windows only; no hidden information", counter: "Avoid announced techniques near it; Quickened activations have no window." },
    }, "samurai"),
    gemini: B(["secondContribution", "pairedFunction", "resonantPulse", "antiphonalStrike", "neitherAlone"], { secondaryBasic: "resonantPulse" }, {
      paired_bodies: { trigger: "always", effect: { bodies: 2, sharedLF: true, sharedPf: true, sharedAp: true }, bound: "one LF, ΦF and AP budget for both", counter: "Focus either body: the damage hits the shared pool." },
      divided_roles: { trigger: "a paired technique", effect: { eachSuppliesOnePrerequisite: true }, bound: "both bodies must be standing and linked", counter: "Separate them (Boundary) or down one." },
    }, "gemini"),
    wizard: B(["chainOperations", "changeTheOrder", "inputFilter", "typedChannel", "provenFormula"], {}, {
      prepared_formula: { trigger: "you run a chain validated earlier this battle", effect: { chainCostDelta: -1 }, bound: "−1 ΦF per chain, min 1 per step", counter: "Change the inputs so validation fails." },
      interface_check: { trigger: "you commit an invalid chain", effect: { rejectBeforeCommit: true, refund: "all" }, bound: "never grants unlearned concepts", counter: "None: it's a safeguard, not a power." },
    }, "wizard"),
    jujutsu_sorcerer: B(["bindingTerm", "sharedContract", "boundaryLine", "authorizedEntry", "contractedDomain"], { secondaryBasic: "boundaryLine" }, {
      enforceable_vow: { trigger: "an active Binding Term you're keeping", effect: { declaredParameterMul: 1.3 }, bound: "one parameter per vow; one vow at a time", counter: "Force a breach (taunt, shove): stun." },
      truthful_disclosure: { trigger: "you reveal a technique", effect: { revealBonusOnce: true }, bound: "once per technique (the existing ×1.15 reveal rule)", counter: "None beyond knowing what it does." },
    }, "jujutsu-sorcerer"),
    super_hero: B(["shareTheLoad", "supportNetwork", "stepBetween", "rescueCorridor", "nobodyBehindMe"], { secondaryBasic: "stepBetween" }, {
      flight: { trigger: "always (Super Hero / Super Heroine loadout)", effect: { moveBudgetAdd: 3, moveApMul: 0.5, ignoresTerrainCosts: true }, bound: "movement only; knocked into water = grounded (normal movement) until a turn starts on dry land; no extra actions", counter: "Hold them (Clinch), tether-cut, or stun: flight doesn't help a unit that can't move." },
      rescue_vector: { trigger: "you move toward an ally below half LF", effect: { freeInterceptOnArrival: 1 }, bound: "once per round", counter: "Threaten two allies far apart." },
      shared_support: { trigger: "you intercept a hit", effect: { shareAcrossLinks: true, perLinkCap: 15 }, bound: "links' capacity", counter: "Cut a support; common-mode damage." },
    }, "super-hero"),
    super_heroine: B(["tether", "suspendedRoute", "catchFall", "snapBack", "livingSafetyNet"], { secondaryRefined: "snapBack" }, {
      flight: { trigger: "always (Super Hero / Super Heroine loadout)", effect: { moveBudgetAdd: 3, moveApMul: 0.5, ignoresTerrainCosts: true }, bound: "movement only; knocked into water = grounded (normal movement) until a turn starts on dry land; no extra actions", counter: "Hold them (Clinch), tether-cut, or stun: flight doesn't help a unit that can't move." },
      connected_rescue: { trigger: "a tethered ally would fall or be shoved", effect: { cushionMul: 0.4 }, bound: "tethered allies only; anchors must hold", counter: "Hit the anchor." },
      yielding_connection: { trigger: "a tether is loaded", effect: { tetherSurvivesLoad: 1 }, bound: "one overload per tether", counter: "Snap it with Resonance; cut it." },
    }, "super-heroine"),
    super_villain: B(["requiredInput", "chokePoint", "feint", "manufacturedChoice", "youNeedWhatIHold"], { secondaryBasic: "feint" }, {
      engineered_prerequisite: { trigger: "you create or negotiate an effect", effect: { installDependency: 1 }, bound: "one installed dependency at a time", counter: "Inference finds it." },
      invested_misdirection: { trigger: "an enemy acts on a prediction you falsified", effect: { preparedConsequence: 1 }, bound: "once per battle; needs a verified mistaken prediction", counter: "Independent evidence before acting." },
    }, "super-villain"),
    defective_machine: B(["failover", "gracefulDegradation", "resonantPulse", "overdrive", "productiveFailure"], { secondaryBasic: "resonantPulse" }, {
      degraded_operation: { trigger: "a function is disabled", effect: { continueAt: 0.7 }, bound: "2 spares per battle", counter: "Common-mode failure (Dependency)." },
      diagnostic_error: { trigger: "after each of your techniques", effect: { showsExpectedVsActual: true }, bound: "no hidden information gained", counter: "None: it's honest self-report." },
    }, "defective-machine"),
    teleporter: B(["linkedStep", "remoteDoor", "departureClause", "arrivalGate", "elsewhereOnCue"], {}, {
      surveyed_endpoint: { trigger: "you stand on a tile", effect: { endpointMemory: 6 }, bound: "the last 6 tiles visited", counter: "Occupy, seal or make them hazardous." },
      atomic_transit: { trigger: "a transfer is invalid", effect: { stayAtOrigin: true, refund: "all" }, bound: "no partial transfers", counter: "None: it's a safeguard." },
    }, "teleporter"),
    mutant_boar: B(["loadResponse", "heavyFrame", "anchor", "runawayMass", "growingMomentum"], { secondaryBasic: "anchor" }, {
      sustained_loading: { trigger: "you survive a hit of 10+", effect: { growthStack: 1, maxLFPerStack: 8, upkeepPfPerStack: 1 }, bound: "max 3 stacks; upkeep each turn", counter: "Prune a stack; drain ΦF." },
      committed_charge: { trigger: "you move in a straight line", effect: { displacementResistPerTile: 1 }, bound: "max +3; resets on turning or stopping", counter: "Make it turn; break the footing." },
    }, "mutant-boar"),
    boarman: B(["findTheBase", "turnTheWeight", "yieldingGuard", "snapBack", "springLeverThrow"], { primaryBasic: "findTheBase" }, {
      braced_geometry: { trigger: "you have a fulcrum and stable footing", effect: { forceTransferMul: 1.15 }, bound: "contact techniques only", counter: "Remove the fulcrum or footing." },
      yielding_contact: { trigger: "you take a contact hit", effect: { storeFraction: 0.2, storeCap: 20 }, bound: "cap 20", counter: "Ranged or non-contact damage." },
    }, "boarman"),
    anime_protagonist: B(["newConfiguration", "tradeTheOldAnswer", "yieldingGuard", "snapBack", "myAnswerHasChanged"], { secondaryBasic: "yieldingGuard", secondaryRefined: "snapBack" }, {
      earned_revision: { trigger: "you survive below 30% LF or resolve a trauma", effect: { revisionAvailable: 1 }, bound: "once per battle", counter: "Finish it before it drops that low, or burst past." },
      held_potential: { trigger: "you take an impact", effect: { storeFraction: 0.25, storeCap: 30 }, bound: "cap 30", counter: "Non-impact damage." },
    }, "anime-protagonist"),
    mma_fighter: B(["findTheBase", "offBalance", "clinch", "jointControl", "controlledDescent"], {}, {
      // Mala, 2026-10-11: Contact Reading doubles what everything costs an enemy he is holding (a Grapple or a Clinch),
      // breaking the hold included. Position Before Force is live too (class-runtime.js damageMods).
      contact_reading: { trigger: "an enemy is in your hold", effect: { heldApCostMul: 2 }, bound: "only the unit you hold, only while the hold lasts; breaking out counts", counter: "Do not get held, or pay the doubled price to break out." },
      position_before_force: { trigger: "you have a fulcrum", effect: { contactDamageMul: 1.1 }, bound: "contact techniques only", counter: "Remove the fulcrum." },
    }, "mma-fighter"),
    // Kickboxer: every technique but the merge is shared (Samurai's Timing pair, the Boarman's Leverage pair).
    // Odysseus and President (Muse's build plug-ins docs/odysseus-build.md, docs/president-build.md; pasted 2026-10-11).
    // Neither adds a technique: both kits are existing shared-concept abilities plus their pair-gated merge.
    odysseus: B(["publicPromise", "credibleGuarantee", "detour", "convergingRoutes", "anotherWayHome"], {}, {
      destination_over_method: { trigger: "leave a vowed route, or the route closes", effect: { goalOnlyPromise: true }, bound: "close EVERY route and even a goal vow breaks (forceBreach); method-specific vows still bind", counter: "Close every route; forceBreach." },
      prepared_return: { trigger: "Detour along an already-walked route", effect: { phiCostMinus: 1 }, bound: "route must revalidate as still open", counter: "Close the walked route so revalidation fails." },
    }, "odysseus"),
    // coalition is specified but has no mechanics in the engine yet (Muse's one gap; loop filed).
    president: B(["swornIn", "executiveDirection", "publicPromise", "credibleGuarantee", "theAccordHolds"], {}, {
      mandate: { trigger: "fulfill a public commitment", effect: { nextLegitimacyMul: 1.25 }, bound: "one technique, then spent; trivial or guaranteed promises don't qualify", counter: "Force breach before fulfillment (debt disables the benefit until repaired)." },
      coalition: { trigger: "a willing ally accepts the shared objective", effect: { contributionsSupport: true }, bound: "no extra actions; voluntary; recognition withdrawable under explicit conditions", counter: "Invalidate recognition, disrupt cooperation, or expose a breach." },
    }, "president"),
    // Ranger (Muse's plug-in docs/ranger-build.md; built 2026-10-12, docs/ranger.md).
    // Hunter's Mark is his too, granted by the exact pair (content.js pairs) and never kit-listed. His merge is a
    // technique, not an ultimate: Dead Reckoning (refined). The Long Hunt is a class trait (Mala, 2026-10-12) and his
    // ultimate is Pathway's Many Paths.
    ranger: B(["track", "headThemOff", "readSign", "confirmTrail", "deadReckoning"], {}, {
      long_hunt: { trigger: "his first turn", effect: { freeReadSign: 1 }, bound: "one Read Sign, that turn only; the reading still goes stale when the opponent moves", counter: "Move before he shoots." },
      tracking: { trigger: "an opponent walks while someone on the ranger's side can see it", effect: { readableTrailRounds: 2 }, bound: "its last route only; flyers, teleports and stillness leave nothing", counter: "Move unseen; fly; teleport; stay still." },
      woodcraft: { trigger: "the ranger steps onto soil or a plant", effect: { apMinus: 1 }, bound: "never below 1 action point a step; after every other multiplier", counter: "Force it onto stone, water or open ground." },
    }, "ranger"),
    // Hypebeast (Muse's plug-in docs/hypebeast-build.md; built 2026-10-12, docs/hypebeast.md). Downhill is still staged
    // and Equilibrium was dropped, so the kit is the live Diffusion and Deception techniques plus the merge. The spec's
    // "drop" passive (scarce buffs) waits until he has a buff to give.
    hypebeast: B(["diffuseWave", "concentrationGradient", "feignedRetreat", "manufacturedChoice", "culturalMoment"], { primaryBasic: "diffuseWave", primaryRefined: "concentrationGradient", secondaryBasic: "feignedRetreat", secondaryRefined: "manufacturedChoice" }, {
      aura: { trigger: "an opponent who has not Observed you starts a turn within 2", effect: { hesitateAp: 10 }, bound: "once per battle per opponent; never a seer", counter: "Observe the Hypebeast: the aura is over for you and every ally who can see him." },
      viral_growth: { trigger: "your turn starts and no opponent has seen through you", effect: { hypeRadiusPlus: 1, fieldAp: 5 }, bound: "radius 4 at most; one Observe stops the growth for good (it never shrinks)", counter: "Observe him once, or stay out of the field." },
    }, "hypebeast"),
    // Tech Billionaire (Muse's plug-in docs/tech-billionaire-build.md; built 2026-10-12, docs/tech-billionaire.md).
    // The spec mapped his four slots onto Linked Step, Remote Door, Required Input and Choke Point with new behaviour for
    // him alone; they are his own pair-gated techniques instead, so the Teleporter's and the Villain's stay as they were.
    // His ultimate is Adjacency's Everywhere at Once (the primary's, as for every class); Platform Shift is the merge. Rules: class-runtime.js (PLATFORM).
    tech_billionaire: B(["onboard", "bridge", "lockIn", "deprecate", "platformShift"], {}, {
      network_effect: { trigger: "a unit links to your platform", effect: { linkedPotencyMulPerLink: 0.03, maxLinks: 4 }, bound: "4 links at most (+12%); linked units only, never the Billionaire himself; recounted on every hit", counter: "Break links: stay beyond 6 tiles of him for a full round, or drop the Billionaire and every link falls." },
      subscription_fees: { trigger: "an opponent who signed up ends its turn", effect: { lifeForce: 15 }, bound: "signed-up opponents only, never his allies; while the link holds; never the last point of Life Force", counter: "Do not sign up; cancel by staying beyond 6 tiles of him for a full round; drop the Billionaire." },
      terms_of_service: { trigger: "a linked unit's turn starts", effect: { linkLocked: true, platformRange: 6 }, bound: "ends once the unit starts two turns in a row beyond 6 tiles of the Billionaire, or when he falls", counter: "Outrun the platform for a round; focus the owner." },
    }, "tech-billionaire"),
    // Oil Billionaire (Muse's plug-in docs/oil-billionaire-build.md; built 2026-10-12, docs/oil-billionaire.md).
    // Mala, 2026-10-12: where the Tech Billionaire gets you to sign up, he forces his way in by buying people out.
    // His four techniques are his own (the spec mapped them onto the Maid's and the Hypebeast's). Rules: class-runtime.js (OIL).
    oil_billionaire: B(["drill", "buyOut", "spill", "flare", "gusher"], {}, {
      reserves: { trigger: "you Drill", effect: { barrelCap: 3, perDrill: 1 }, bound: "3 barrels at most; a barrel is spent when it buys someone out or burns in a Gusher, and for nothing else", counter: "Keep him too busy to drill; make him spend barrels on small buyouts before the surge." },
      externalities: { trigger: "you Drill, Spill or Gusher", effect: { slickTurns: 2, slickApLoss: 10, flammable: true }, bound: "lasts 2 of his turns; costs anyone who starts a turn on it 10 action points, his own side included; burns once", counter: "Fight from off the slick; fly; clear it like any ground effect; let him stand in his own spill." },
    }, "oil-billionaire"),
    // Doctor (Muse's plug-in docs/doctor-build.md; built 2026-10-12, docs/doctor.md). His four techniques are his own:
    // the spec retargeted the Succession patch techniques and the Detective's Inference pair onto allies.
    doctor: B(["stabilize", "continueTreatment", "diagnose", "secondOpinion", "fullRecovery"], {}, {
      triage: { trigger: "you Stabilize", effect: { range: 3, lowestShareFirst: true }, bound: "the most hurt ally within 3, himself included; never the same patient twice running, so a lone patient is stabilized every other time", counter: "Keep a second ally hurt as the decoy; keep the real patient beyond 3 tiles of him." },
      bedside_read: { trigger: "a treatment of yours lands on a patient", effect: { freeDiagnosis: 1 }, bound: "that patient's own condition only; unconfirmed until a Second Opinion", counter: "Nothing: the information is the point. Deny the treatment instead." },
    }, "doctor"),
    // Animal Tamer, Resonance + Transmigration (2026-10-15; engine/tamer.js, docs/animal-tamer.md, docs/transmigration.md).
    // Taming, possession and Call the Pack run in engine/tamer.js; Mark the Vessel is his Transmigration technique.
    animalTamer: B(["resonantPulse", "sympatheticChord", "markTheVessel", "effigy", "callThePack"], { primaryBasic: "resonantPulse", primaryRefined: "sympatheticChord", secondaryBasic: "markTheVessel", secondaryRefined: "effigy" }, {
      crossing_burst: { trigger: "you migrate into your vessel", effect: { damage: 8, channel: "nigredo", radius: 1 }, bound: "once per migration; enemies beside the body you left", counter: "Stand off from the bearer when he is low; kill the vessel first." },
      attuned_vessel: { trigger: "you arrive in a beast you tamed (Resonance primary)", effect: { arrivalWardMul: 2 }, bound: "tamed beasts only; the ward is spent by hits as usual", counter: "Break the ward, or kill the vessel before he needs it." },
    }, "animal-tamer"),
    ninja: B(["vanish", "smokeVeil", "wait", "recoveryStrike", "vanishingCut"], { primaryBasic: "vanish", primaryRefined: "smokeVeil", secondaryBasic: "wait", secondaryRefined: "recoveryStrike" }, {
      unseen_step: { trigger: "you move while Concealed", effect: { concealmentHolds: true }, bound: "attacking breaks it; fields and blasts never cared", counter: "Force it to act; blast where it was." },
      first_strike: { trigger: "your first attack from Concealed", effect: { ignoresReactions: true }, bound: "that one strike only; concealment breaks on the swing", counter: "Break concealment before it strikes; Guard still halves what it cannot parry." },
      from_darkness: { trigger: "your Concealed-breaking strike lands", effect: { inspiration: 1 }, bound: "the purse cap (3) still holds", counter: "Nothing: the dark pays its own." },
    }, "ninja"),
    // Police Officer (Mala, 2026-10-14): the enforcement arm; the thief's hard counter. Rules: class-runtime.js (POLICE wire) + police/police.js.
    police_officer: B(["halt", "cuff", "evidence", "takedown", "arrest"], { primaryBasic: "halt", primaryRefined: "evidence", secondaryBasic: "cuff", secondaryRefined: "takedown" }, {
      hot_pursuit: { trigger: "always (Legitimacy + Constraint loadout)", effect: { moveBudgetAdd: 2 }, bound: "movement budget only; nothing else", counter: "Outrun the +2; hold ground that matters." },
      officer_presence: { trigger: "an enemy adjacent to you uses a consumable", effect: { consumablesBarred: true }, bound: "adjacent enemies only; ends the moment they leave", counter: "Step away before popping anything." },
    }, "police-officer"),
    // Magistrate (Laws of Gods of Men + Threshold, Legitimacy in the wheel house; Mala 2026-10-12, playable 2026-10-19).
    // Statute and Warrant are the law's; Departure Clause and Arrival Gate are Threshold's. Rules: law/law.js.
    magistrate: B(["statute", "warrant", "departureClause", "arrivalGate", "exilesGate"], { primaryBasic: "statute", primaryRefined: "warrant", secondaryBasic: "departureClause", secondaryRefined: "arrivalGate" }, {
      jurisdiction: { trigger: "an enemy casts its first technique of the round inside her Statute", effect: { pfAdd: 3 }, bound: "once per enemy per round; her own Statute only", counter: "Step out of the zone before casting, or wait it out." },
      contempt: { trigger: "an Outlaw damages the Magistrate", effect: { slow: 1 }, bound: "once per round", counter: "Outlast the mark before you strike her." },
    }, "magistrate"),
    // Thief (Mala, 2026-10-14): the stealing half of Stealth. Ninja kills from cover; Thief robs from cover — loot and time. Rules: class-runtime.js (STEALTH wire) + stealth/stealth.js.
    thief: B(["vanish", "smokeVeil", "pickpocket", "skim", "emptyPockets"], { primaryBasic: "vanish", primaryRefined: "smokeVeil", secondaryBasic: "pickpocket", secondaryRefined: "skim" }, {
      ghost_hands: { trigger: "you Skim or Empty Pockets while Concealed", effect: { concealmentHolds: true }, bound: "pure theft only; Pickpocket's bump is an attack and breaks it as always", counter: "Blast the cover; there is no take without the approach." },
      getaway: { trigger: "you dodge", effect: { dodgeApOff: 10 }, bound: "dodges only; stacks before the reflex halving", counter: "Guard-breaking pressure; pin it down." },
    }, "thief"),
    // Monkey King (Mala, 2026-10-14): Deception-primary trickster-mobility. Rules: monkey/monkey.js.
    monkey_king: B(["hairClone", "monkeyMischief", "somersaultCloud", "jinguBang", "staffSky"], { primaryBasic: "hairClone", primaryRefined: "monkeyMischief", secondaryBasic: "somersaultCloud", secondaryRefined: "jinguBang" }, {
      cloud_walker: { trigger: "you Somersault Cloud", effect: { pathIgnore: true }, bound: "the path only; the landing tile must be open", counter: "Hold the landing tiles." },
      one_real_hair: { trigger: "you pluck while your clone lives", effect: { fizzle: true }, bound: "one clone of your own; a depth-1 copy never plucks", counter: "Kill the hair; the next pluck needs a new action." },
      looks_real: { trigger: "always (the clone)", effect: { realUnit: true }, bound: "it never holds items, tempo, or Inspiration", counter: "Hit it like anything else: 10 LF." },
    }, "monkey-king"),
    // Hanuman (Mala, 2026-10-24; docs/hanuman-build.md): Aeronautics + Elasticity, crew ayodhya. The leap, the mace, the giant's
    // stomp and the mountain. His three forms and his forgotten power are State Kit data (content.js states), not passives code.
    hanuman: B(["fourForces", "propulsion", "gada", "shockwave", "sanjeevani"], { primaryBasic: "fourForces", primaryRefined: "propulsion", secondaryBasic: "gada", secondaryRefined: "shockwave" }, {
      three_bodies: { trigger: "his free form switch (once a turn)", effect: { states: "hanumanBase | hanumanMonkey | hanumanGiant" }, bound: "one switch a turn; one form at a time", counter: "Observe the form: hit the monkey when he is small, outrange the giant." },
      forgotten_strength: { trigger: "every battle opens with him Forgotten", effect: { states: "hanumanForgotten" }, bound: "monkey, giant and Sanjeevani sealed until an ally on his side reminds him (a free talk)", counter: "Fight him alone, or drop his allies before anyone speaks." },
    }, "hanuman"),
    // Jatayu (Mala, 2026-10-24; docs/jatayu-build.md): Interposition + Timing, crew ayodhya. Late by design, wings over an ally,
    // and his last word marks his killer.
    jatayu: B(["shieldOfWings", "keenSight", "talonDive", "recoveryCut", "againstTheChariot"], { primaryBasic: "shieldOfWings", primaryRefined: "keenSight", secondaryBasic: "talonDive", secondaryRefined: "recoveryCut" }, {
      late_by_design: { trigger: "the battle opens", effect: { states: "jatayuAloft -> jatayuStoop" }, bound: "one turn circling, then x1.3 dealt for 2 rounds", counter: "Strike first, before he stoops." },
      last_word: { trigger: "he falls", effect: { states: "jatayuMarked on his killer" }, bound: "once; x1.25 taken for 3 rounds", counter: "Kill him from where you can afford to be marked." },
    }, "jatayu"),
    // Surpanakha (Mala, 2026-10-24; docs/surpanakha-build.md): Glamour + Plasticity, crew lanka. The guise, the wound, the grudge.
    surpanakha: B(["enchantingGuise", "lure", "talons", "vengefulRake", "cryForVengeance"], { primaryBasic: "enchantingGuise", primaryRefined: "lure", secondaryBasic: "talons", secondaryRefined: "vengefulRake" }, {
      the_guise: { trigger: "the battle opens; the first blow", effect: { states: "surpanakhaGuise -> surpanakhaTrue" }, bound: "x0.7 taken until struck; then x1.2 dealt for 3 rounds", counter: "Hit her early with something small." },
      the_grudge: { trigger: "she is wounded", effect: { states: "surpanakhaGrudge on the attacker (Lakshmana: deep)" }, bound: "x1.25 taken for 3 rounds (Lakshmana x1.5); refreshed by each wound", counter: "Let someone expendable hit her." },
    }, "surpanakha"),
    // Mandodari (Mala, 2026-10-24; docs/mandodari-build.md): Inference + Harmony, crew lanka. Counsel that shelters whoever heeds it
    // and costs whoever ignores it; on Ravana, more both ways (rule 6).
    mandodari: B(["readTheOmens", "counsel", "consonance", "lullaby", "theQueensPlea"], { primaryBasic: "readTheOmens", primaryRefined: "counsel", secondaryBasic: "consonance", secondaryRefined: "lullaby" }, {
      counsel_unheeded: { trigger: "a Counselled ally attacks", effect: { states: "mandodariCounsel -> mandodariUnheeded" }, bound: "once per warning; 2 rounds", counter: "Make them attack: bait the warned one." },
      the_kings_plea: { trigger: "Counsel on Ravana", effect: { taken: "x0.5 heeded, x1.6 unheeded" }, bound: "Ravana only (rule 6)", counter: "Ravana's own pride does the work." },
    }, "mandodari"),
    // Indrajit (Mala, 2026-10-24; docs/indrajit-build.md): Deception + Constraint, crew lanka. He fights from the clouds (Vanish),
    // binds with the serpent noose, fells with the Shakti, and the Nikumbhila rite is the merge.
    indrajit: B(["feint", "feignedRetreat", "nagapashaShot", "shakti", "nikumbhila"], { primaryBasic: "feint", primaryRefined: "feignedRetreat", secondaryBasic: "nagapashaShot", secondaryRefined: "shakti" }, {
      from_the_clouds: { trigger: "always", effect: { learned: "vanish" }, bound: "Vanish's own cost and rules", counter: "Area attacks; Observe." },
      the_rite: { trigger: "Nikumbhila", effect: { states: "nikumbhilaRite -> nikumbhilaFinished" }, bound: "two turns of chanting, broken by any blow; three rounds after", counter: "Hit him while he chants." },
    }, "shadow-archer"),
    // Kumbhakarna (Mala, 2026-10-24; docs/kumbhakarna-build.md): Inertia + Timing, crew lanka. He opens asleep (a blow, two of his
    // turns, or his own side's drums wake him, and he rages); vast (massive, slow); his reach, his nap, and the hungry giant.
    kumbhakarna: B(["anchor", "immovable", "giantsReach", "theLongSleep", "theHungryGiant"], { primaryBasic: "anchor", primaryRefined: "immovable", secondaryBasic: "giantsReach", secondaryRefined: "theLongSleep" }, {
      the_sleeper: { trigger: "the battle opens", effect: { states: "kumbhakarnaAsleep -> kumbhakarnaRaging" }, bound: "asleep until struck, two of his turns, or Beat the Drums; then x1.3 for 3 rounds", counter: "Leave him asleep: do not hit him first." },
      the_giant: { trigger: "always", effect: { states: "kumbhakarnaVast (massive, move -1)" }, bound: "no grapple, lift or shove; one tile slower", counter: "Outrange him; he is slow." },
    }, "kumbhakarna"),
    // Ravana (Mala, 2026-10-24; docs/ravana-build.md): Extraction + Delegation, crew lanka. Ten heads that grow back, Brahma's boon,
    // the seizing hand and the chariot. Rule 6: The Abduction takes anyone, Sita farther; the Brahmastra always finds him.
    ravana: B(["chandrahasa", "seize", "assignTheTask", "delegateTheDecision", "theAbduction"], { primaryBasic: "chandrahasa", primaryRefined: "seize", secondaryBasic: "assignTheTask", secondaryRefined: "delegateTheDecision" }, {
      ten_heads: { trigger: "a blow of 10 or more", effect: { healLF: 6, heads: 10 }, bound: "ten heads, then no more; the Brahmastra ends it", counter: "Many small blows (under 10) never cost a head; or Rama's Brahmastra." },
      brahmas_boon: { trigger: "rubedo damage", effect: { takenMul: 0.4 }, bound: "rubedo only; albedo (a mortal's arrow) hits him fully; the Brahmastra ends it", counter: "Shoot him: albedo." },
    }, "ravana"),
    // Sita (Mala, 2026-10-24; docs/sita-build.md): Imagination + Preservation, crew ayodhya. The dreamer (opens Dream Space more
    // cheaply than anyone) whose faith calls her house: Rama is usually already on the way, and Call of Faith brings another.
    sita: B(["pictureTheArrival", "holdTheImage", "protectiveSleeve", "repairRecord", "callOfFaith"], { primaryBasic: "pictureTheArrival", primaryRefined: "holdTheImage", secondaryBasic: "protectiveSleeve", secondaryRefined: "repairRecord" }, {
      born_dreamer: { trigger: "she opens a Dream Space", effect: { openLess: 40, apMul: 0.5, drainLess: 10 }, bound: "the dream itself is unchanged; the bar is still its clock", counter: "Make her spend the bar (Call of Faith) or deny the turn she needs." },
      he_is_coming: { trigger: "a battle that seats her without Rama", effect: { heralds: "rama", chance: 0.75, delay: 1 }, bound: "once, at the start; Rama arrives at round 2 if he comes", counter: "Win before round 2, or meet him." },
    }, "sita"),
    // The Hypnotist (Hotbuilds wave 1): Focus + Imagination, crew arcane. Ultimate + merges arrive W1b/W1c.
    hypnotist: B(["focus", "deepFocus", "pictureTheArrival", "holdTheImage"], { primaryBasic: "focus", primaryRefined: "deepFocus", secondaryBasic: "pictureTheArrival", secondaryRefined: "holdTheImage" }, {
      entrainer: { trigger: "he fixes a foe", effect: { subject: "focus mark" }, bound: "one subject at a time", counter: "Break line of sight and the hold slips." },
      gentle_hand: { trigger: "the first lethal blow he lands on a foe", effect: { sparedAt: 1 }, bound: "once per foe per battle; the win stays non-lethal", counter: "Hit the spared foe again: the hand stays itself only once." },
    }, "hypnotist", "brief"),
    // Lakshmana (Mala, 2026-10-24; docs/lakshmana-build.md): Boundary + Interposition, crew ayodhya. The line, the guard, and the
    // brother who is felled but not slain. Rule 6: every technique works on anyone, stronger on Sita (the line) and Rama (the guard).
    lakshmana: B(["boundaryLine", "lakshmanaRekhaDraw", "brothersGuard", "coveringShot", "lineNotCrossed"], { primaryBasic: "boundaryLine", primaryRefined: "lakshmanaRekhaDraw", secondaryBasic: "brothersGuard", secondaryRefined: "coveringShot" }, {
      felled_not_slain: { trigger: "the first blow that would kill him", effect: { states: "lakshmanaUnfallen -> lakshmanaFelled" }, bound: "once a battle; felled 2 turns at 1 LF, x0.25 taken", counter: "Hit him again after he rises; drop him before Hanuman arrives." },
      at_his_side: { trigger: "Brother's Guard on Rama", effect: { uses: 2, turns: 2 }, bound: "Rama only gets the second hit (rule 6)", counter: "Hit Rama from range Lakshmana cannot cover." },
    }, "lakshmana"),
    // Rama (Mala, 2026-10-24; docs/rama-build.md): Strategic Commitment + Focus, crew ayodhya. A word given once a battle (a vow
    // on the "word" target, chosen from a short list), the bow, and the Brahmastra that lands true on a weakness he has learned.
    rama: B(["publicPromise", "credibleGuarantee", "kodanda", "deepFocus", "brahmastra"], { primaryBasic: "publicPromise", primaryRefined: "credibleGuarantee", secondaryBasic: "kodanda", secondaryRefined: "deepFocus" }, {
      ramas_word: { trigger: "once a battle, he gives his word (a free vow: one boon, paid with restrictions)", effect: { vow: "word" }, bound: "once a battle; it holds until broken; forced to break it he loses the boon, 25 AP and all ultimate charge", counter: "Force the breach: shove a Rooted Rama, or make Open Guard hurt." },
      true_aim: { trigger: "the Brahmastra", effect: { known: 24, unknown: 12 }, bound: "once a battle; full only on a weakness his side has learned", counter: "Hide your weakness: deny the Observe." },
    }, "rama"),
    // Jambavan (Mala, 2026-10-24; docs/jambavan-build.md): Indexing + Delegation, crew ayodhya. The elder who remembers what
    // everyone is: he reads foes, and he tells allies what they can do. His reminder of Hanuman is State Kit data.
    jambavan: B(["indexEntry", "crossReference", "assignTheTask", "rememberWhatYouAre", "counselOfAges"], { primaryBasic: "indexEntry", primaryRefined: "crossReference", secondaryBasic: "assignTheTask", secondaryRefined: "rememberWhatYouAre" }, {
      elder_of_the_bears: { trigger: "he stands on Hanuman's side", effect: { states: "hanumanForgotten breaks (present)" }, bound: "once: the curse ends and does not return", counter: "Keep him off the field, or fight Hanuman where Jambavan is not." },
      the_errand: { trigger: "Hanuman is in the battle (either side) and an ally or reinforcement is rolled", effect: { allyFavor: "jambavan" }, bound: "the rolls only; never more units than the roll brings", counter: "None: it is who comes to help." },
    }, "jambavan"),
    kickboxer: B(["readTheOpening", "recoveryCut", "findTheBase", "turnTheWeight", "eightCount"], { primaryBasic: "readTheOpening", primaryRefined: "recoveryCut", secondaryBasic: "findTheBase", secondaryRefined: "turnTheWeight" }, {
      clinch_work: { trigger: "you Grapple, or Strike a held enemy", effect: { grappleAp: 20, freeStrikeAp: 25 }, bound: "one free Strike per own turn, up to 25 action points", counter: "Stay out of contact; guard against the hold." },
      long_reach: { trigger: "you Strike", effect: { strikeRange: 2 }, bound: "Strike only; Grapple needs contact", counter: "Fight from three tiles or more, or close to contact where reach is no advantage." },
      corner_man: { trigger: "your turn starts at or below 40% LF", effect: { summon: "fighting_coach", turns: 4 }, bound: "once per battle", counter: "Finish her from above 40%, or drop the Coach." },
    }, "kickboxer"),
    detective: B(["compareExplanations", "independentCheck", "isolateTheVariable", "authenticateIdentity", "establishTheFacts"], {}, {
      provenance_ledger: { trigger: "you observe or witness a unit", effect: { recordsSource: true }, bound: "one source per kind of evidence per target", counter: "Block lines; repeat the same tell." },
      testable_suspicion: { trigger: "a read is confirmed", effect: { confirmedHitMul: 1.25 }, bound: "one round", counter: "Deny the second source." },
    }, "detective"),
    maid: B(["sort", "protectTheEssential", "clearTheObstruction", "controlledRemoval", "emptyTheRoom", "restoreTheWorkingOrder"], {}, {
      maintenance_eye: { trigger: "an obstruction is visible", effect: { revealsObstruction: true }, bound: "reveals the object or effect, not its hidden cause", counter: "Conceal the source or break sight." },
      prepared_workspace: { trigger: "Maid starts an eligible operation on a tile she maintained", effect: { actionCostDelta: -10 }, bound: "Sort, Clear the Obstruction, or Controlled Removal; ends when the interference returns", counter: "Move or restore the interference." },
    }, "maid"),
    general: B(["assignTheTask", "delegateTheDecision", "readTheOpening", "recoveryCut", "decisiveConvergence"], { secondaryBasic: "readTheOpening", secondaryRefined: "recoveryCut" }, {
      mission_orders: { trigger: "an ally holds your standing order", effect: { orderSurvivesCommsCut: true, hitsOnObjectiveMul: 1.25, hitsElsewhereMul: 0.9 }, bound: "one order per ally; two of the ally's turns; no updates, only replacement", counter: "Fall the objective, or make the ally fight someone else." },
      combined_roles: { trigger: "a Decisive Convergence", effect: { contributorsMax: 4, perContributorAp: 50 }, bound: "up to three allies who can see the target; each loses 50 AP next turn", counter: "Break their sight line, or stun a contributor." },
    }, "general"),
    bastet: B(["focus", "deepFocus", "snapShot", "reelingShot", "pounceFromStillness"], { primaryBasic: "focus", primaryRefined: "deepFocus", secondaryBasic: "snapShot", secondaryRefined: "reelingShot" }, {
      cat_nap:{trigger:"she chooses Stall while injured",effect:{apPerLF:5,maxHeal:8},bound:"only bankable AP; 5 AP per LF, up to 8 LF; remaining AP banks normally",counter:"Keep pressure on her so she has no AP left to rest."},
      immortal_cat: { trigger: "her Life Force reaches 0", effect: { knockedOutNotKilled: true }, bound: "she is down, not dead (the immortal rule)", counter: "Can't be killed; win by other means (parley, escape, an objective)." },
      always_watching: { trigger: "she holds Focus on a target", effect: { pounceUnlocked: true, perTileLeapBonus: 4, cap: 16 }, bound: "needs a free tile beside the target; Focus is spent on the leap", counter: "Break her Focus (Feint, resonance pulse) or crowd every tile beside you." },
    }, "bastet"),
    // The Director (Mala, 2026-10-14/15; docs/director.md): shared Boundary/Delegation craft, one filming merge.
    director: B(["boundaryLine", "fenceLine", "assignTheTask", "delegateTheDecision", "setTheScene"], { primaryBasic: "boundaryLine", primaryRefined: "fenceLine", secondaryBasic: "assignTheTask", secondaryRefined: "delegateTheDecision" }, {
      knows_people: { trigger: "a turn starts with no live cameo", effect: { proc: 0.35, clock: 4, teleportsIntoFilm: true }, bound: "max one Actor; the clock suspends inside a film", counter: "Kill the Actor before the cameras roll." },
      attention_to_detail: { trigger: "he places, builds or summons (walls, barriers, summons, cast)", effect: { hpMul: 1.25 }, bound: "+25% HP or protection; those actions cost +5 AP", counter: "There is none: care is its own price." },
      directors_vision: { trigger: "he studies anything", effect: { visualPoints: 2, apCut: 5 }, bound: "+2 visual points, −5 AP per study (min 5 AP)", counter: "There is none: he reads marks for a living." },
    }, "director"),
    // Jiang Qing (Glamour + Legitimacy, Deception in the wheel house; Mala 2026-10-19): the actress who became the Party's
    // attack dog. Real person: original lines only. Shimmer/Allure are Glamour's, Sworn In/Executive Direction Legitimacy's.
    jiang_qing: B(["shimmer", "allure", "swornIn", "executiveDirection", "modelOpera"], { primaryBasic: "shimmer", primaryRefined: "allure", secondaryBasic: "swornIn", secondaryRefined: "executiveDirection" }, {
      model_performance: { trigger: "she casts Shimmer", effect: { shimmerTurnsAdd: 1 }, bound: "the veil holds one turn longer (2); one seeming at a time; area acts still ignore it", counter: "Area attacks, or wait it out." },
      attack_dog: { trigger: "the first enemy she damages each round", effect: { denounceMul: 1.15 }, bound: "one Denounced target a round, until the next round ends; her allies' hits only (not her own)", counter: "Spread the damage she can mark; finish her before she picks a target." },
    }, "jiang-qing"),
    // Aviator Hero (Aeronautics + Inertia, Pathway in the wheel house; Mala 2026-10-18). Anchor and Immovable are Inertia's own.
    aviator_hero: B(["fourForces", "propulsion", "anchor", "immovable", "fullThrottle"], { secondaryBasic: "anchor", secondaryRefined: "immovable" }, {
      aerodynamic: { trigger: "he moves in a straight line", effect: { moveAdd: 2, turnAp: 5 }, bound: "the +2 only on a route that never turns; each change of heading costs 5 AP", counter: "Make him turn: walls, corners, cluttered ground." },
      adrenaline_junkie: { trigger: "his turn starts below half LF", effect: { ap: [10, 20], pf: [2, 4] }, bound: "+10 AP and +2 ΦF below half; +20 and +4 below a quarter; never above his ΦF maximum", counter: "Finish him in one burst, or keep him just above half." },
    }, "aviator-hero"),
    // Starfarer (Settlement + Sightline, Barrier in the wheel house; Mala 2026-10-19): the intergalactic pioneer.
    // Her founding kit is Settlement's, reskinned high-tech; her merge burns a line and lands the Citadel on its end.
    starfarer: B(["deployAegisPylons", "printFabricator", "blasterShot", "spiralOrb", "orbitalDrop"], { primaryBasic: "deployAegisPylons", primaryRefined: "printFabricator", secondaryBasic: "blasterShot", secondaryRefined: "spiralOrb" }, {
      light_frame: { trigger: "always", effect: { maxLfAdd: -10, moveAdd: 1 }, bound: "−10 max LF applied once, at her first turn start; +1 movement every turn", counter: "She is fast and fragile: trade hits and finish her before the Citadel lands." },
      ships_engineer: { trigger: "an ally Strikes near her works", effect: { strikeAdd: 3 }, bound: "her Fabricator and Citadel arm Strikes +3 instead of +2; other founders' works are unchanged", counter: "Break her works: the bonus dies with the walls." },
    }, "starfarer"),
    // Pioneer (Sightline + Boundary, Settlement in the wheel house; Mala 2026-10-19): the musketeer.
    // Holds the line with musket and fence; the Pale Stampede rides the line and churns it underhoof.
    pioneer: B(["clearShot", "surveyShot", "boundaryLine", "fenceLine", "paleStampede"], { primaryBasic: "clearShot", primaryRefined: "surveyShot", secondaryBasic: "boundaryLine", secondaryRefined: "fenceLine" }, {
      homestead: { trigger: "she ends adjacent to a friendly structure", effect: { damageTakenMul: 0.8 }, bound: "damage ×0.8 while adjacent to a standing friendly structure; nothing once the walls fall", counter: "Draw her off the homestead, or knock the walls down first." },
      marked_ground: { trigger: "she raises a Boundary barrier", effect: { durationAdd: 1 }, bound: "+1 owner turn on her Boundary Line and Fence Line; other raisers unchanged", counter: "Break the line early: it still falls to focused demolition." },
    }, "pioneer"),
    // Ascending Martial Artist (Bird Mountain + Adaptation, 2026-10-22): battle-lust made playable; first Bird Mountain holder.
    martial_artist: B(["lonelyWave", "ulaula", "adaptiveBrace", "mimicry", "beyondLimits"], { primaryBasic: "lonelyWave", primaryRefined: "ulaula", secondaryBasic: "adaptiveBrace", secondaryRefined: "mimicry" }, {
      fight_growth: { trigger: "she deals damage (once per own turn) or takes damage (once per round)", effect: { fightAdd: 1 }, bound: "+1 fight per trigger window; feeds ascend chance and the merge", counter: "End her fast; starve her of targets." },
      witness_to_power: { trigger: "a 15+ potency technique resolves in her sightline", effect: { inspirationAdd: 1 }, bound: "once per round, either form", counter: "Small techniques; break sight." },
      piercing_read: { trigger: "her first damaging action each turn", effect: { ignoreCover: true, ignoreConcealment: true }, bound: "first damaging action per own turn only", counter: "Dodge it — precision is not homing." },
    }, "martial-artist"),
    // Mangaka (Collage + Innovation, 2026-10-18; Muse's MANGAKA.md, built by Lantern): clip the field, prototype the battle,
    // compose the final page. Clip/Juxtapose/Prototype/Recombine/Photomontage are the concepts' own; Final Chapter is the merge.
    mangaka: B(["clip", "juxtapose", "prototype", "recombine", "photomontage", "finalChapter"], { primaryBasic: "clip", primaryRefined: "juxtapose", secondaryBasic: "prototype", secondaryRefined: "recombine" }, {
      tankoubon: { trigger: "she pastes a fragment (Juxtapose)", effect: { pasteTurnsAdd: 1 }, bound: "pastes last 3 of her turns instead of 2; still loose to Resonance", counter: "Shake them loose (Resonance) or clip them back." },
      ink_reserve: { trigger: "one of her pasted fragments runs its full course", effect: { pfRefund: 1 }, bound: "+1 ΦF each time, at most 3 a battle", counter: "Take the fragment early: a clipped or shaken fragment refunds nothing." },
    }, "mangaka"),
    // Esker (Interposition + Berm, 2026-10-18; classes/esker.js): the ridge between two plains. Earth Berm is shared with Daedalus.
    esker: B(["between", "shoulderBoth", "earthBerm", "ridgeRemembers", "theDivide"], { secondaryBasic: "earthBerm" }, {
      ridge_keeps_accounts: { trigger: "the first unit each round to strike across Esker or at one of its wards", effect: { mark: "oathbreaker", damageMul: 1.2, ridgeMul: 1.5 }, bound: "one mark at a time; it fades after the next round", counter: "Don't strike first: let the other side break the peace." },
      carried_weight: { trigger: "Shoulder Both takes a ward's debuff", effect: { damagePerStack: 0.1, movePerStack: -1, immovableAt: 3 }, bound: "max 3 burden; one sheds at each of Esker's turns", counter: "Kite it: at full burden it is slow; or wait the burden off." },
    }, "esker"),
    // Barbarian (Threshold + Elasticity, 2026-10-17): rage, stored hits, and an unchained round-end release.
    barbarian: B(["warCry", "berserk", "takeIt", "giveItBack", "unchained"], {}, {
      rage: { trigger: "you drop below half LF (or cross deliberately with Berserk or Unchained)", effect: { damageMul: 1.25, reactionDelta: -1 }, bound: "ends after a full round without taking damage", counter: "Kite it while enraged; burst it down before it releases." },
      absorb_and_return: { trigger: "you take a hit", effect: { storeFraction: 0.2, storeCap: 30 }, bound: "cap 30; spent by Give It Back or Unchained", counter: "Status effects that don't deal damage store nothing; finish it before it releases." },
    }, "barbarian"),
    // Clockwork (Pipeline + Timing, 2026-10-17): scheduled operations with a visible schedule; chains of bounded length.
    clockwork: B(["gearTrain", "escapement", "tick", "rewind", "grandComplication"], {}, {
      wound_spring: { trigger: "you resolve a clockwork technique while wound-spring uses remain", effect: { phiRefund: "full cost" }, bound: "first three clockwork techniques per battle; refunded after resolution", counter: "Force it to spend the three on small operations; dispels have nothing to take." },
      precision: { trigger: "you deal damage with a scheduled operation, or a Feint targets you", effect: { ignoreDecoy: true, feintNegated: true }, bound: "scheduled operations ignore manufactured decoys; Feints deal nothing to it", counter: "Real guards and real moves: precision only answers lies." },
    }, "clockwork"),
    // Rogue (Pruning + Extraction, 2026-10-18): cut what the mark carries, pocket it, fence it.
    // Cyber Punk Rogue (Longtermism + Stealth, 2026-10-21): steal present life, invest it in one later ally.
    hooded_cyber_rogue: B(["stealPresent", "investFuture", "vanish", "smokeVeil", "farContract"], { secondaryBasic: "vanish", secondaryRefined: "smokeVeil" }, {
      one_body: { trigger: "a second successful call while a traveler lives", effect: { bodies: 1, refresh: true }, bound: "one living traveler; a random member answers each call", counter: "Defeat that body before the next call." },
      short_stay: { trigger: "the traveler's own turns", effect: { turns: 3, ultimateTurns: 5 }, bound: "leaves when the clock ends", counter: "Outlast the clock. A refresh resets it; it does not stack a second body." },
      principal: { trigger: "Steal the Present or Far Contract", effect: { fundCap: 24, investCap: 24, notOwnLife: true }, bound: "24 stolen Life Force; the future holds at most 24 extra", counter: "Guard the mark, leave them at 1 Life Force, or defeat the thief before they invest." },
    }, "hooded-cyber-rogue"),
    // Memorialist (Preservation + Longtermism, 2026-10-24): ward the living, bank the fallen, read the Roll.
    memorialist: B(["protectiveSleeve", "repairRecord", "stealPresent", "investFuture", "rollOfHonor"], { secondaryBasic: "stealPresent", secondaryRefined: "investFuture" }, {
      ledger_of_the_fallen: { trigger: "an ally falls", effect: { principalCap: 3 }, bound: "3 names; her own fall banks nothing", counter: "Keep her allies standing." },
      steady_hands: { trigger: "she gives a ward", effect: { durationAdd: 1 }, bound: "Roll wards last 3 owner turns", counter: "Strip wards, don't wait them out." },
      eulogy: { trigger: "Roll of Honor, once a battle", effect: { selfHeal: 6 }, bound: "mends its reader once", counter: "None: grief keeps its own counsel." },
    }, "memorialist"),
    // Hot Pot Berserker (Antifragility + Hospitality, 2026-10-25): hit the pot, food spills; feed the table; boil over.
    hot_pot_berserker: B(["smallDoses", "hormesis", "serveMapoTofu", "familyStyle", "boilOver"], { secondaryBasic: "serveMapoTofu", secondaryRefined: "familyStyle" }, {
      spilled_pot: { trigger: "a landed blow on him", effect: { spill: 1 }, bound: "2 a round, 6 a battle; needs a free tile beside him", counter: "Grab the spills yourself; hit him once, hard." },
      head_chef: { trigger: "the Cook action", effect: { fullRecipes: true }, bound: "ingredients and AP as anyone", counter: "Take his ingredients." },
      antifragile_bank: { trigger: "a Strike", effect: { strikeAddPerBank: 2 }, bound: "3 banked (+6)", counter: "One repeated kind of hit banks nothing." },
    }, "hot-pot-berserker"),
    // Chef (Mise en Place + Hospitality, 2026-10-30; docs/chef.md): set the station first. Slice 1: the Mise side is live; Welcome,
    // Guest Right and Chef's Table are staged (no castable Hospitality yet), so his castable kit is Rack and Label, Parallel Prep and Everything in Its Place.
    chef: Object.assign(B(["rackAndLabel", "parallelPrep", "welcome", "guestRight", "chefsTable"], { primaryBasic: "rackAndLabel", primaryRefined: "parallelPrep" }, {
      early_service: { trigger: "a station he lays in round 1 or 2", effect: { graceRounds: 1 }, bound: "once per station, fixed when laid; a renewal clears it; Everything in Its Place never gets it", counter: "Walk onto or prune the station; hit him before it pays." },
      stocked_line: { trigger: "a Strike while his stations stand fresh", effect: { strikeAddPerFreshStation: 2 }, bound: "max +6 (three stations); only stations at full strength count; Strike only", counter: "Walk onto, prune or outwait the stations: they are public." },
      line_cook: { trigger: "the Cook action", effect: { fullRecipes: true }, bound: "35 AP full / 20 AP field; ingredients and AP as anyone's", counter: "Take his ingredients." },
    }, "chef"), { staged: ["welcome", "guestRight", "chefsTable"] }),   // slice 1: these three are authored (kits-data staged) but not castable yet: tests that cast a kit skip build.staged
    // Seedkeeper (Longtermism + Succession, 2026-10-24): bury now, the future digs up.
    seedkeeper: B(["buryCache", "timedBloom", "pioneerPatch", "nurseLog", "theFutureArrives"], { secondaryBasic: "pioneerPatch", secondaryRefined: "nurseLog" }, {
      cache_minded: { trigger: "burying", effect: { cacheCap: 4 }, bound: "4 caches; blooms stay 2", counter: "Dig nothing." },
      hardy: { trigger: "field or terrain damage", effect: { reduction: 10 }, bound: "min 0", counter: "Hit her directly." },
      posterity: { trigger: "first bury each battle", effect: { discountPhi: 1 }, bound: "cache or bloom, once", counter: "None: hope is cheap." },
    }, "seedkeeper"),
    // Ferryman (Pathway + Reciprocal Obligation, 2026-10-24): trade places, pay the toll.
    ferryman: B(["ferry", "convergingRoutes", "bindingTerm", "sanctuaryVow", "lastCrossing"], { secondaryBasic: "bindingTerm", secondaryRefined: "sanctuaryVow" }, {
      strong_back: { trigger: "ferrying or shoved", effect: { rangeAdd: 1, resistFirst: true }, bound: "range 5; first displacement held", counter: "Shove twice." },
      tollkeeper: { trigger: "a passenger owes", effect: { tollAp: 12 }, bound: "12 instead of 10", counter: "Cross once: the first is free." },
      the_fare: { trigger: "first Ferry each battle", effect: { tollAp: 0 }, bound: "once", counter: "None: the river gives one." },
    }, "ferryman"),
    // Pearl Diver (Swale + Stealth, 2026-10-24): shape the water, strike from it, burst it.
    pearl_diver: B(["checkDam", "bioswale", "descent", "undertow", "drown"], { primaryBasic: "checkDam", primaryRefined: "bioswale" }, {
      breath_holder: { trigger: "concealed by descent, or shoved", effect: { concealAdd: 1, resistFirst: true }, bound: "quiet +1 turn; first displacement held", counter: "Shove twice; wait out the quiet." },
      tide_reader: { trigger: "placing a swale effect", effect: { rangeAdd: 1 }, bound: "placed swale effects only", counter: "None: she reads far water." },
      the_deep: { trigger: "drowning", effect: { discountPhiPerBasin: 2 }, bound: "2 per basin beyond the first, never below 0", counter: "Break basins before the bar fills." },
    }, "pearl_diver"),
    // Posterity suit warriors (Mala, 2026-11-04: Manavu cuts; magic woven into the suit as technology).
    orgonite_trooper: B(["stealPresent", "investFuture", "deployWorkstation", "calibrateTool", "orgoniteLance"], { primaryBasic: "stealPresent", primaryRefined: "investFuture", secondaryBasic: "deployWorkstation", secondaryRefined: "calibrateTool" }, {
      woven_suit: { trigger: "turn start while Hardware is equipped", effect: { workstation: true, hp: 18, follows: true }, bound: "one 18 HP site; Deploy Workstation replaces it with a 3-turn tool", counter: "Destroy the woven site, then stay off adjacent tiles." },
      first_weave: { trigger: "first classEffect setup each battle", effect: { refundAp: true, refundPhi: true, inspiration: 1 }, bound: "once; Steal the Present or Deploy Workstation", counter: "None: the first charge is cheap. Engine-wide freeFirst is not built." },
      suit_brace: { trigger: "a ranged shot from 2+ tiles, once a round, while a reaction remains", effect: { damageMul: 0.65 }, bound: "one reaction a round; needs the woven site", counter: "Spend their reaction first, or fight in contact." },
    }, "manavu-anti-gravity-soldier"),
    leviathan_suit: B(["stealPresent", "investFuture", "readLivingCircuit", "correctivePulse", "dreamCircuit"], { primaryBasic: "stealPresent", primaryRefined: "investFuture", secondaryBasic: "readLivingCircuit", secondaryRefined: "correctivePulse" }, {
      woven_loop: { trigger: "Read the Living Circuit while a plant is in reach", effect: { selfAsMember: true }, bound: "the wearer is the only member when no other circuit stands", counter: "Kill the plant before the pulse." },
      first_weave: { trigger: "first classEffect setup each battle", effect: { refundAp: true, refundPhi: true, inspiration: 1 }, bound: "once; Steal the Present or Read the Living Circuit", counter: "None: the first charge is cheap." },
      suit_brace: { trigger: "a ranged shot from 2+ tiles, once a round, while a reaction remains", effect: { damageMul: 0.65 }, bound: "one reaction a round", counter: "Spend their reaction first, or fight in contact." },
    }, "manavu-anti-gravity-blue"),
    scale_firmware: B(["pictureTheArrival", "holdTheImage", "deployWorkstation", "calibrateTool", "dreamForge"], { primaryBasic: "pictureTheArrival", primaryRefined: "holdTheImage", secondaryBasic: "deployWorkstation", secondaryRefined: "calibrateTool" }, {
      woven_suit: { trigger: "turn start while Hardware is equipped", effect: { workstation: true, hp: 18, follows: true }, bound: "one 18 HP site", counter: "Destroy the woven site, then close to contact." },
      first_weave: { trigger: "first classEffect setup each battle", effect: { refundAp: true, refundPhi: true, inspiration: 1 }, bound: "once; Deploy Workstation", counter: "None: the first charge is cheap." },
      suit_brace: { trigger: "a ranged shot from 2+ tiles, once a round, while a reaction remains", effect: { damageMul: 0.65 }, bound: "one reaction a round; needs the woven site", counter: "Spend their reaction first, or fight in contact." },
    }, "manavu-future-warrior-crimson-reptilian"),
    white_jacket_gunner: B(["rasterPass", "layerMask", "stealPresent", "investFuture", "posterityRaster"], { primaryBasic: "rasterPass", primaryRefined: "layerMask", secondaryBasic: "stealPresent", secondaryRefined: "investFuture" }, {
      printed_future: { trigger: "Posterity Raster", effect: { withBuffer: 18, without: 12 }, bound: "a held raster spends; without one the merge still fires at 12", counter: "Outlast the buffer, or take a non-albedo hit." },
      first_weave: { trigger: "first classEffect setup each battle", effect: { refundAp: true, refundPhi: true, inspiration: 1 }, bound: "once; Raster Pass or Steal the Present", counter: "None: the first charge is cheap." },
      suit_brace: { trigger: "a ranged shot from 2+ tiles, once a round, while a reaction remains", effect: { damageMul: 0.65 }, bound: "one reaction a round", counter: "Spend their reaction first, or fight in contact." },
    }, "manavu-future-warrior-white-jacket-gunner"),
    bronze_admin: B(["assignTheTask", "delegateTheDecision", "stealPresent", "investFuture", "farOrder"], { primaryBasic: "assignTheTask", primaryRefined: "delegateTheDecision", secondaryBasic: "stealPresent", secondaryRefined: "investFuture" }, {
      filed_future: { trigger: "Far Order", effect: { orderMul: 1.25, until: 3 }, bound: "nearest ally carries it; a later traveler can inherit if they arrive", counter: "Defeat the carrier before they act; isolate so nobody carries." },
      first_weave: { trigger: "first classEffect setup each battle", effect: { refundAp: true, refundPhi: true, inspiration: 1 }, bound: "once; Assign the Task or Steal the Present", counter: "None: the first charge is cheap." },
      suit_brace: { trigger: "a ranged shot from 2+ tiles, once a round, while a reaction remains", effect: { damageMul: 0.65 }, bound: "one reaction a round", counter: "Spend their reaction first, or fight in contact." },
    }, "manavu-space-admin-bronze-hooded"),
    horned_suit: B(["pictureTheArrival", "holdTheImage", "assignTheTask", "delegateTheDecision", "summonedMandate"], { primaryBasic: "pictureTheArrival", primaryRefined: "holdTheImage", secondaryBasic: "assignTheTask", secondaryRefined: "delegateTheDecision" }, {
      pictured_order: { trigger: "Summoned Mandate", effect: { orderMul: 1.25, ward: 8 }, bound: "needs a living ally to carry; no Longtermism traveler", counter: "Isolate them, or strip the ward." },
      first_weave: { trigger: "first classEffect setup each battle", effect: { refundAp: true, refundPhi: true, inspiration: 1 }, bound: "once; Assign the Task", counter: "None: the first charge is cheap." },
      suit_brace: { trigger: "a ranged shot from 2+ tiles, once a round, while a reaction remains", effect: { damageMul: 0.65 }, bound: "one reaction a round", counter: "Spend their reaction first, or fight in contact." },
    }, "manavu-space-admin-crimson-horned"),
    rogue: B(["cutPurse", "disarm", "pocket", "fenceIt", "heist"], {}, {
      light_fingers: { trigger: "your turn starts beside a mark you haven't cased", effect: { revealCarried: 1 }, bound: "one reveal per mark per battle", counter: "Travel light: there is nothing to case." },
      clean_cut: { trigger: "a pruning cut removes something", effect: { victimUnawareTurns: 1, takeUnnamed: true }, bound: "1 round; pocketing names the take", counter: "Holds keep the Rogue off; what was never carried can't be cut." },
    }, "rogue"),
    // Medusa (Sightline + Constraint, 2026-10-17): the gaze marks, holds by sight alone, and turns long-held flesh to stone.
    medusa: B(["glare", "fixInPlace", "set", "petrify", "stoneGarden"], {}, {
      stone_gaze: { trigger: "her turn starts with a unit in her line of sight", effect: { slowMoves: 1 }, bound: "−1 move; ends the moment the line breaks", counter: "Break the sight line (berm, wall, smoke); cross water over it to reflect the gaze." },
      no_reflection: { trigger: "her gaze line crosses open water", effect: { selfSlowMoves: 1 }, bound: "−1 move for a turn, herself", counter: "There is none: still water is her own weakness." },
    }, "medusa"),
    // Cleric (Reciprocal Obligation + Complementarity, 2026-10-17): blessings bound to recipient-held vows.
    cleric: B(["blessing", "sanctuaryVow", "layingOnOfHands", "chorusOfTwo", "covenantOfTheFaithful"], {}, {
      covenant: { trigger: "a blessed ally starts its turn with its vow unbroken", effect: { blessingExtendTurns: 1 }, bound: "the ×1.2 effect only, one turn per kept turn; the ward never extends and a retreat ends everything", counter: "Force a vow break: shove the holder into a retreat or taunt a sanctuary holder into striking." },
      congregation: { trigger: "a Blessing of yours leaves blessings from you on 2 or more allies at once", effect: { phiRefund: 1 }, bound: "Blessing only; the refund never exceeds the price paid", counter: "Break a blessing so fewer than two remain." },
    }, "cleric"),
    // Steam Walker (Inertia + Threshold, 2026-10-18): a boiler that must vent, on legs too heavy to shove.
    steam_walker: B(["piston", "advance", "valve", "blowOff", "fullHeadOfSteam"], {}, {
      boiler: { trigger: "your turn starts (or a Piston lands)", effect: { pressurePerTurn: 1, pressureCap: 5, impactPerPressure: 0.05, ventThreshold: 5, overheat: 15 }, bound: "max 5 pressure; overpressure blocks boiler abilities until vented; 15 overheat per round unpaid", counter: "Fight it on wet ground (cooling vent); force the vent early with Valve timing; stay 2+ tiles out when the gauge climbs." },
      heavy_frame: { trigger: "a shove of under 3 tiles would move it", effect: { minDisplacementTiles: 3 }, bound: "3+ tile displacements still move it; lever-anchored knocks (Leverage) bypass the frame", counter: "Move it with Leverage (Off-Balance ignores the frame) or displacements of 3+ tiles." },
    }, "steam_walker"),
    // Ornithopter (Section + Adjacency, 2026-10-17): survey in section, perch high, swoop, overfly. Six entries:
    // primary refined is the shared pool Plan View (an ultimate), so Take Off fills the fourth non-ultimate slot.
    ornithopter: B(["surveyPass", "planView", "perch", "swoop", "takeOff", "overflight"], { primaryRefined: "planView" }, {
      aloft: { trigger: "you move or trace a sight line while airborne", effect: { moveBudgetAdd: 3, moveCostMul: 0.5, ignoreTerrain: true, sightHeightAdd: 2 }, bound: "lost while grounded; Take Off or a dry turn-start restores flight", counter: "Ground it (a 15+ hit, water, holds) and it walks like anyone else." },
      light_frame: { trigger: "you take an impact (nigredo) hit; you take a single hit of 15 or more", effect: { impactTakenMul: 1.3, groundedTurns: 1 }, bound: "one turn grounded; Take Off ends it early", counter: "Other channels skip the ×1.3; hits under 15 never ground it." },
    }, "ornithopter"),
    // Engineer (Grading & Drainage + Load Distribution, 2026-10-17): grade the ground, share the load.
    engineer: B(["regrade", "drainagePlan", "shareTheSpan", "shoreUp", "loadPath"], {}, {
      as_built: { trigger: "you grade a tile (Regrade)", effect: { resistsNextForcedChange: true }, bound: "one resist per tile; the next grade effect on it is negated and the mark is spent", counter: "Re-cut the tile twice: the first cut spends the mark." },
      factor_of_safety: { trigger: "a structure you stand beside is struck", effect: { damageMul: 0.8 }, bound: "once per round per structure", counter: "Draw the Engineer away from the structure; area blasts are not strikes." },
    }, "engineer"),
    // Origamist Track B interim (Adjacency + Tension, 2026-10-18; class-builds/ORIGAMIST.md): six entries on the
    // ornithopter precedent — four shared techniques, one merge technique (the folded panel), one merge ult.
    // Valley Fold is Linked Step reskinned (paper visual only); Track A (true Folding) stays the destination.
    // crisp_crease waits on Ma (Phase 2, unlanded): specified, not implemented.
    origamist: B(["linkedStep", "remoteDoor", "tether", "suspendedRoute", "mountainFoldInterim", "paperRoute"], {}, {
      first_fold: { trigger: "your first Linked Step (Valley Fold) each battle", effect: { phiCost: 0 }, bound: "the first Linked Step only; later steps cost full ΦF", counter: "Occupy or seal her visited endpoints so the free fold has nowhere to go." },
      crisp_crease: { trigger: "you place a fold while in Still Stance", effect: { durationAdd: 1 }, bound: "Still Stance only; needs Ma landing (Phase 2)", counter: "Break the stance before she folds." },
    }, "origamist"),
  };

  return { builds };
});
