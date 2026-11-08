"use strict";
// Technique deconstruction: every technique's scribing components.
// Legacy curation retained; schema 2 decomposition resolves current definitions.
// Refresh the complete catalog with node tools/export-technique-parts.mjs.
// Legacy rider display + requirements; schema 2 preserves full mechanics.
// Channel/delivery/load resolve
// live from the technique entry so numbers never rot here.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTechniqueParts = factory();
})(typeof self !== "undefined" ? self : this, function () {

  var TECHNIQUE_IDS = ["acceptTerms","acquisition","adaptiveBrace","advance","againstTheChariot","allAccountsDue","allure","anchor","anotherWayHome","antiphonalStrike","architectDesignWall","arrest","arrivalGate","assignTheTask","audition","authenticateIdentity","authorizedEntry","balladOfTheBattle","bastionCollapse","batchRender","beatTheDrums","berserk","between","beyondLimits","bindingOath","bindingTerm","bioswale","blackout","blasterShot","blessing","blowOff","blueNote","boilOver","boundaryLine","brahmastra","bridge","broodBreach","broodSpray","brothersGuard","burnTheBoats","buryCache","buyOut","calibrateTool","callOfFaith","callThePack","carapaceSlam","carefulPrune","caseClosed","catchFall","chainOperations","chandrahasa","changeTheOrder","chargeWave","checkDam","chitinDrone","chokePoint","chorus","chorusOfTwo","clearShot","clearTheObstruction","clinch","clip","closedDomain","collapsePanel","compareExplanations","compileTheCanvas","compoundInterest","concentrationGradient","confirmTrail","consonance","continueTreatment","contractedDomain","controlledDescent","controlledRemoval","convergingRoutes","correctivePulse","counsel","counselOfAges","covenantOfTheFaithful","coveredAdvance","coveringShot","credibleGuarantee","criticalThreshold","crossReference","crownRaise","cryForVengeance","cuff","culturalMoment","curseMark","cutOut","cutPurse","cutSlope","cuttingContest","cyphCheckTheLabel","cyphCuratedCypher","cyphOffTheTop","cyphOpenMic","cyphPocketVerse","deadReckoning","decisiveConvergence","decoy","deepFocus","delegateTheDecision","departureClause","deployAegisPylons","deployWorkstation","deprecate","descent","designedPassage","detour","diagnose","diffuseWave","disarm","dissTrack","drainagePlan","drill","droneLance","droneStation","droneSwarm","droneVolley","drown","dueProcess","duet","earthBerm","earthenEmbrace","earthenRoom","effigy","eightCount","elsewhereOnCue","emberBreath","emptyMandate","emptyPockets","emptyTheRoom","enchantingAir","enchantingGuise","encore","escapement","escortScreen","establishTheFacts","eureka","everywhereAtOnce","evidence","executiveDirection","exilesGate","exitWasDesigned","faceOfTheVoid","failover","falseHorizon","familyStyle","feignedRetreat","feint","fenceIt","fenceLine","ferry","filterBolt","finalChapter","findTheBase","fireBreath","fixInPlace","flare","focus","foreclosure","formBase","formGiant","formMonkey","foundCity","fourForces","foxfireLure","freestyle","frontPropagation","fullChord","fullHeadOfSteam","fullRecovery","fullThrottle","gada","gaiasAccord","gearTrain","genjutsu","genreDefiningPerformance","giantsReach","giveItBack","glare","gracefulDegradation","grandComplication","grandFormula","grappleLine","greatLever","growingMomentum","gusher","hairClone","halt","harmonicRupture","headThemOff","headlineVerse","heavyFrame","heist","hexScreen","hoardWard","holdTheImage","holdTheLine","holdTone","hollowMandate","holographicSwarm","homeostaticNetwork","honedEdge","hormesis","hostileTakeover","hundredNightParade","huntersMark","hurlFeast","hymnOfTheOath","immovable","imuFeast","independentCheck","indexEntry","inferno","infernoRoar","inputFilter","isolateTheVariable","jazzSolo","jinguBang","jointControl","judgmentOfGods","juxtapose","keenSight","keepFaith","keylineTerrace","kitsuneFoxfire","kodanda","lakshmanaRekhaDraw","lastCrossing","lastStand","lawBindsItsMaker","layOnHands","layerMask","layingOnOfHands","leapingStrike","lineNotCrossed","lineRemains","linkedStep","livingArchive","livingResponse","livingSafetyNet","loadPath","loadResponse","lockIn","lonelyWave","longMigration","longView","lullaby","lure","makeRoomForPossibility","makeTheCase","manufacturedChoice","manyPaths","marginCall","markTheVessel","maskSwap","masquerade","masterwork","measureTwice","measuredOpening","membrane","merge","mimicry","modelOpera","molt","monkeyMischief","mountainFold","mountainFoldInterim","myAnswerHasChanged","nagapashaShot","neitherAlone","newConfiguration","nightParade","nikumbhila","nobodyBehindMe","nurseLog","oathOfTheShield","offBalance","oldGrowth","onboard","oneDeclaredMoment","openArchive","operationOrder","orbitalDrop","orthographicProjection","overdrive","overflight","pairedFunction","paleStampede","paperBurnout","paperRoute","passAClass","perch","perfectHeist","perfectMoment","petrify","photomontage","pickpocket","pictureTheArrival","pioneerPatch","piston","placeFill","planView","platformShift","pocket","pounceFromStillness","printFabricator","productiveFailure","propulsion","protectTheEssential","protectiveSleeve","prototype","provenFormula","prune","publicPromise","rainGarden","raiseDataCenter","raiseFoundry","raisePalisade","rasterPass","readLivingCircuit","readSign","readTheOmens","readTheOpening","rebound","reclamation","recoilCascade","recombine","recoveryCut","recoveryStrike","redundantSystems","reelingShot","regrade","rememberWhatYouAre","remind","remoteDoor","renderEngine","repairRecord","repossession","requiredInput","rescueCorridor","resonantPulse","resonantVerse","restoreTheWorkingOrder","rewind","ridgeRemembers","riff","rollOfHonor","royalException","runawayMass","sanctuaryVow","sanjeevani","secondContribution","secondNature","secondOpinion","sectionCut","seize","serveMapoTofu","set","setTheScene","shakti","shapeShift","shareTheLoad","shareTheSpan","sharedContract","shieldBash","shieldFace","shieldOfWings","shieldWall","shimmer","shockwave","shoreUp","shortChange","shortCount","shoulderBoth","shoulderTheWorld","sieveVerdict","skim","smallDoses","smite","smokeVeil","snapBack","snapShot","somersaultCloud","sonicBoom","sort","spareHair","spill","spiralOrb","spiritVeil","springLeverThrow","springRise","stabilize","staffSky","statute","stepBetween","stoneGarden","stormWings","submissionHold","supportNetwork","survey","surveyPass","surveyShot","suspendedRoute","swarmBreach","swear","swoop","swornIn","sympatheticChord","tailSweep","takeIt","takeOff","takeUpTheCraft","takeWing","takedown","tallyUp","talonDive","talons","tectonic","tether","theAbduction","theAccordHolds","theDivide","theHungryGiant","theLongSleep","theOffer","theQueensPlea","tick","timedBloom","tippingPoint","totalDependence","track","tradeTheOldAnswer","tripThreshold","turnTheWeight","typedChannel","ulaula","uluHurl","unbearableVisage","unchained","undertow","undividedAttention","unstoppable","valleyFold","valve","vanish","vanishingCut","vendorLock","vengefulRake","verdance","verify","voidFace","voidGlance","voidOrb","vowNeverQuench","vowOpenHand","vowSharedBowl","wait","warCry","warrant","watershed","watershedTerrace","whatIf","wholeness","wingDrone","worldSmallEnough","writtenVerse","yieldingGuard","youNeedWhatIHold"];

  // Full delivery ranking incl. signal + composite (prototype legacy.js
  // ranks only the six classic deliveries; scribe validation needs this).
  var DELIVERY_RANK = { self: 0, contact: 0, placed: 1, line: 1, signal: 1, routed: 2, field: 2, composite: 2 };

  var PARTS = {
    "acceptTerms": {
      "riders": [
        "class:platformAccept"
      ]
    },
    "acquisition": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "founder_mode"
      }
    },
    "adaptiveBrace": {
      "riders": [
        "guard"
      ]
    },
    "advance": {
      "riders": [
        "class:steamAdvance"
      ],
      "requires": {
        "pairs": [
          [
            "inertia",
            "threshold"
          ]
        ]
      }
    },
    "allAccountsDue": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "ledger_sworn"
      }
    },
    "allure": {
      "riders": [
        "class:allure"
      ]
    },
    "ancestralReconstruction": {
      "riders": [
        "class:homologyReconstruct"
      ]
    },
    "anchor": {
      "riders": [
        "anchor"
      ]
    },
    "annotate": {
      "riders": [
        "mark",
        "reveal"
      ]
    },
    "anotherWayHome": {
      "riders": [
        "anotherWayHome"
      ]
    },
    "antiphonalStrike": {
      "riders": []
    },
    "architectDesignWall": {
      "riders": [
        "architectDesign",
        "spread:line"
      ]
    },
    "arrest": {
      "riders": [
        "class:police"
      ]
    },
    "arrivalGate": {
      "riders": [
        "class:buff"
      ]
    },
    "assignTheTask": {
      "riders": [
        "class:assign"
      ]
    },
    "audition": {
      "riders": [
        "class:actor"
      ]
    },
    "authenticateIdentity": {
      "riders": [
        "class:authenticate"
      ]
    },
    "authorizedEntry": {
      "riders": [
        "class:exempt"
      ]
    },
    "balladOfTheBattle": {
      "riders": [
        "class:performance",
        "spread:board"
      ]
    },
    "banyanSnare": {
      "riders": [
        "snare-roots"
      ],
      "requires": {
        "signature": true
      }
    },
    "bastionCollapse": {
      "riders": []
    },
    "batchRender": {
      "riders": [
        "class:artistBatch",
        "spread:radius"
      ]
    },
    "berserk": {
      "riders": [
        "class:buff"
      ]
    },
    "between": {
      "riders": [
        "class:between"
      ]
    },
    "beyondLimits": {
      "riders": [
        "class:martial"
      ]
    },
    "bindingOath": {
      "riders": [
        "class:law",
        "lingering",
        "spread:radius"
      ]
    },
    "bindingTerm": {
      "riders": [
        "class:buff"
      ]
    },
    "bioswale": {
      "riders": [
        "swale",
        "lingering"
      ]
    },
    "blackout": {
      "riders": [
        "class:stealth",
        "spread:radius"
      ]
    },
    "blasterShot": {
      "riders": [],
      "requires": {
        "pairs": [
          [
            "settlement",
            "sightline"
          ]
        ]
      }
    },
    "blessing": {
      "riders": [
        "class:clericBless"
      ]
    },
    "blowOff": {
      "riders": [
        "class:blowOff"
      ],
      "requires": {
        "pairs": [
          [
            "inertia",
            "threshold"
          ]
        ]
      }
    },
    "blueNote": {
      "riders": [
        "class:performance"
      ]
    },
    "boundaryLine": {
      "riders": [
        "barrier",
        "ward",
        "lingering"
      ]
    },
    "bridge": {
      "riders": [
        "class:platformBridge"
      ],
      "requires": {
        "pairs": [
          [
            "adjacency",
            "dependency"
          ]
        ]
      }
    },
    "brierRing": {
      "riders": [
        "hazard",
        "slow"
      ]
    },
    "broodBreach": {
      "riders": [],
      "requires": {
        "form": "chitin_knight"
      }
    },
    "broodSpray": {
      "riders": [
        "damage+hazard",
        "spread:cone"
      ],
      "source": "boss:kaiju"
    },
    "burnTheBoats": {
      "riders": [
        "presidentCommitment",
        "spread:radius"
      ]
    },
    "buryCache": {
      "riders": [
        "class:seedCache",
        "lingering"
      ]
    },
    "buyOut": {
      "riders": [
        "class:oilBuyOut"
      ],
      "requires": {
        "pairs": [
          [
            "extraction",
            "diffusion"
          ]
        ]
      }
    },
    "calibrateTool": {
      "riders": [
        "class:artistCalibrate"
      ]
    },
    "callThePack": {
      "riders": [
        "class:tmPack"
      ]
    },
    "carapaceSlam": {
      "riders": [
        "knockback"
      ],
      "source": "boss:kaiju"
    },
    "carefulPrune": {
      "riders": [
        "prune"
      ]
    },
    "caseClosed": {
      "riders": [
        "class:caseClosed",
        "spread:radius"
      ]
    },
    "catchFall": {
      "riders": [
        "class:cushion",
        "limited",
        "spread:radius"
      ]
    },
    "chainOperations": {
      "riders": [
        "class:buff"
      ]
    },
    "changeTheOrder": {
      "riders": [
        "class:buff"
      ]
    },
    "chargeWave": {
      "riders": [
        "class:martial"
      ]
    },
    "chartStar": {
      "riders": [
        "placed",
        "ping"
      ]
    },
    "checkDam": {
      "riders": [
        "checkDam",
        "lingering"
      ]
    },
    "chitinDrone": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "chitin_knight"
      }
    },
    "chokePoint": {
      "riders": []
    },
    "chorus": {
      "riders": [
        "class:performance"
      ]
    },
    "chorusOfTwo": {
      "riders": [
        "class:clericChorus"
      ]
    },
    "clearShot": {
      "riders": []
    },
    "clearTheObstruction": {
      "riders": [
        "class:maidExtract"
      ]
    },
    "clinch": {
      "riders": [
        "class:hold",
        "lingering"
      ]
    },
    "clip": {
      "riders": [
        "clip"
      ]
    },
    "closedDomain": {
      "riders": [
        "domain",
        "lingering"
      ]
    },
    "collapsePanel": {
      "riders": [
        "class:unfold"
      ]
    },
    "commitToMemory": {
      "riders": [
        "fruit:locus"
      ]
    },
    "comparativeAnatomy": {
      "riders": [
        "class:homologyCompare"
      ]
    },
    "comparativeAnatomyFidelity": {
      "riders": [
        "class:homologyCompare"
      ]
    },
    "compareExplanations": {
      "riders": [
        "class:compare"
      ]
    },
    "compileTheCanvas": {
      "riders": [
        "class:artistCompile"
      ]
    },
    "compoundInterest": {
      "riders": [
        "interest",
        "mass-growth"
      ],
      "channelAdd": [
        "reciprocal_obligation"
      ],
      "source": "boss:tallyman:enraged"
    },
    "concentrationGradient": {
      "riders": []
    },
    "confirmTrail": {
      "riders": [
        "class:callOut"
      ],
      "requires": {
        "pairs": [
          [
            "pathway",
            "inference"
          ],
          [
            "inference",
            "selectivity"
          ]
        ]
      }
    },
    "conservedJoint": {
      "riders": [
        "class:homologyJoint"
      ]
    },
    "conservedJointSkeleton": {
      "riders": [
        "class:homologyJoint"
      ]
    },
    "consonance": {
      "riders": [
        "class:performance",
        "in-tune"
      ]
    },
    "continueTreatment": {
      "riders": [
        "class:docCourse"
      ],
      "requires": {
        "pairs": [
          [
            "succession",
            "inference"
          ]
        ]
      }
    },
    "contractedDomain": {
      "riders": [
        "class:law",
        "lingering"
      ]
    },
    "controlledDescent": {
      "riders": []
    },
    "controlledRemoval": {
      "riders": [
        "class:maidRemove"
      ]
    },
    "convergingRoutes": {
      "riders": [
        "triggered",
        "spread:plus"
      ]
    },
    "correctivePulse": {
      "riders": [
        "class:circuitPulse"
      ]
    },
    "covenantOfTheFaithful": {
      "riders": [
        "class:clericCovenant"
      ]
    },
    "coveredAdvance": {
      "riders": [
        "class:relocate"
      ]
    },
    "credibleGuarantee": {
      "riders": [
        "presidentGuarantee"
      ]
    },
    "criticalThreshold": {
      "riders": [
        "triggered",
        "spread:plus"
      ]
    },
    "crossReference": {
      "riders": [
        "archivistReference"
      ]
    },
    "crownRaise": {
      "riders": [
        "crownRaise",
        "lingering"
      ]
    },
    "cuff": {
      "riders": [
        "class:police"
      ]
    },
    "culturalMoment": {
      "riders": [
        "class:culturalMoment"
      ],
      "requires": {
        "pairs": [
          [
            "diffusion",
            "deception"
          ]
        ]
      }
    },
    "curseMark": {
      "riders": [
        "triggered"
      ],
      "source": "boss:oni"
    },
    "cutOut": {
      "riders": []
    },
    "cutPurse": {
      "riders": [
        "class:rogueCut"
      ]
    },
    "cutSlope": {
      "riders": [
        "gradeCut"
      ]
    },
    "cuttingContest": {
      "riders": [
        "class:performance"
      ]
    },
    "cyphCheckTheLabel": {
      "riders": [
        "class:cyphService"
      ]
    },
    "cyphCuratedCypher": {
      "riders": [
        "class:cyphCurated"
      ]
    },
    "cyphOffTheTop": {
      "riders": [
        "class:cyphBar"
      ]
    },
    "cyphOpenMic": {
      "riders": [
        "class:cyphFinal"
      ]
    },
    "cyphPocketVerse": {
      "riders": [
        "class:cyphPocket"
      ]
    },
    "deadReckoning": {
      "riders": [
        "class:deadReckoning",
        "trail"
      ],
      "requires": {
        "pairs": [
          [
            "pathway",
            "inference"
          ]
        ]
      }
    },
    "decisiveConvergence": {
      "riders": [
        "class:convergence"
      ]
    },
    "decoy": {
      "riders": [
        "class:stealth"
      ]
    },
    "deepFocus": {
      "riders": [
        "focus",
        "lingering"
      ]
    },
    "delegateTheDecision": {
      "riders": [
        "class:delegate"
      ]
    },
    "departureClause": {
      "riders": [
        "class:buff"
      ]
    },
    "deployAegisPylons": {
      "riders": [
        "raisePalisade"
      ],
      "requires": {
        "pairs": [
          [
            "settlement",
            "sightline"
          ]
        ]
      }
    },
    "deployWorkstation": {
      "riders": [
        "class:artistDeploy"
      ]
    },
    "deprecate": {
      "riders": [
        "class:platformDeprecate"
      ],
      "requires": {
        "pairs": [
          [
            "adjacency",
            "dependency"
          ]
        ]
      }
    },
    "descent": {
      "riders": [
        "class:diveDescend"
      ]
    },
    "designedPassage": {
      "riders": [
        "class:relocate"
      ]
    },
    "detour": {
      "riders": []
    },
    "diagnose": {
      "riders": [
        "class:docDiagnose"
      ],
      "requires": {
        "pairs": [
          [
            "succession",
            "inference"
          ]
        ]
      }
    },
    "diffuseWave": {
      "riders": [
        "knockback"
      ]
    },
    "disarm": {
      "riders": [
        "class:rogueDisarm"
      ]
    },
    "dissTrack": {
      "riders": [
        "class:performance",
        "spread:composite"
      ]
    },
    "drainagePlan": {
      "riders": [
        "class:drainage",
        "spread:plus"
      ]
    },
    "drill": {
      "riders": [
        "class:oilDrill"
      ],
      "requires": {
        "pairs": [
          [
            "extraction",
            "diffusion"
          ]
        ]
      }
    },
    "droneLance": {
      "riders": [],
      "requires": {
        "form": "cyborg"
      }
    },
    "droneStation": {
      "riders": [
        "class:droneStation"
      ]
    },
    "droneSwarm": {
      "riders": [],
      "requires": {
        "form": "cyborg"
      }
    },
    "droneVolley": {
      "riders": [
        "class:droneVolley"
      ]
    },
    "drown": {
      "riders": [
        "class:diveDrown",
        "spread:radius"
      ]
    },
    "dueProcess": {
      "riders": [
        "presidentLaw"
      ]
    },
    "duet": {
      "riders": []
    },
    "earthBerm": {
      "riders": [
        "berm",
        "lingering"
      ]
    },
    "earthenEmbrace": {
      "riders": [
        "damage+bermRing"
      ],
      "source": "boss:gaia"
    },
    "earthenRoom": {
      "riders": [
        "bermRing",
        "lingering",
        "spread:ring"
      ]
    },
    "effigy": {
      "riders": [
        "class:tmEffigy"
      ]
    },
    "eightCount": {
      "riders": []
    },
    "eightfoldClinch": {
      "riders": [
        "class:hold",
        "lingering"
      ]
    },
    "elsewhereOnCue": {
      "riders": [
        "class:departureFor"
      ]
    },
    "emberBreath": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "dragon_blooded"
      }
    },
    "emptyMandate": {
      "riders": [],
      "source": "boss:emissary"
    },
    "emptyPockets": {
      "riders": [
        "class:stealth",
        "spread:radius"
      ]
    },
    "emptyTheRoom": {
      "riders": [
        "class:maidSweep",
        "spread:radius"
      ]
    },
    "enchantingAir": {
      "riders": [
        "class:performance"
      ]
    },
    "encore": {
      "riders": [
        "class:performance"
      ]
    },
    "escapement": {
      "riders": [
        "triggered"
      ]
    },
    "escortScreen": {
      "riders": [
        "class:guardArea",
        "limited",
        "spread:line"
      ]
    },
    "establishTheFacts": {
      "riders": [
        "class:facts",
        "spread:arena"
      ]
    },
    "eureka": {
      "riders": [
        "eureka",
        "spread:radius"
      ]
    },
    "everythingInItsPlace": {
      "riders": [
        "class:miseStation",
        "station",
        "apDiscount"
      ]
    },
    "everywhereAtOnce": {
      "riders": []
    },
    "evidence": {
      "riders": [
        "class:police"
      ]
    },
    "executiveDirection": {
      "riders": [
        "presidentDirection"
      ]
    },
    "exilesGate": {
      "riders": [
        "class:lawgiver",
        "spread:line"
      ]
    },
    "exitWasDesigned": {
      "riders": [
        "class:earthworks",
        "spread:line"
      ]
    },
    "faceOfTheVoid": {
      "riders": [],
      "source": "boss:emissary:enraged"
    },
    "failover": {
      "riders": [
        "class:buff"
      ]
    },
    "falseHorizon": {
      "riders": []
    },
    "feignedRetreat": {
      "riders": [
        "ambush"
      ]
    },
    "feint": {
      "riders": [
        "once-per-turn"
      ]
    },
    "fenceIt": {
      "riders": [
        "class:rogueFence"
      ]
    },
    "fenceLine": {
      "riders": [
        "fence",
        "lingering",
        "spread:line"
      ]
    },
    "ferry": {
      "riders": [
        "class:ferrySwap"
      ]
    },
    "filterBolt": {
      "riders": []
    },
    "finalChapter": {
      "riders": [
        "montage",
        "spread:composite"
      ]
    },
    "findTheBase": {
      "riders": [
        "class:fulcrum"
      ]
    },
    "fireBreath": {
      "riders": [
        "damage+ignite",
        "spread:cone",
        "ignite-fuel"
      ],
      "channelAdd": [
        "diffusion"
      ],
      "source": "boss:dragon"
    },
    "fixedGaze": {
      "riders": [
        "barrier",
        "reactive",
        "ward"
      ]
    },
    "fixInPlace": {
      "riders": [
        "class:hold",
        "gaze",
        "lingering"
      ],
      "requires": {
        "pairs": [
          [
            "sightline",
            "constraint"
          ]
        ]
      }
    },
    "flare": {
      "riders": [
        "class:oilFlare",
        "spread:radius"
      ],
      "requires": {
        "pairs": [
          [
            "extraction",
            "diffusion"
          ]
        ]
      }
    },
    "focus": {
      "riders": [
        "focus"
      ]
    },
    "foreclosure": {
      "riders": [
        "collateral-bane"
      ],
      "channelAdd": [
        "reciprocal_obligation"
      ],
      "source": "boss:tallyman:enraged"
    },
    "foundCity": {
      "riders": [
        "foundCity"
      ]
    },
    "fourForces": {
      "riders": [
        "class:forces"
      ]
    },
    "foxfireLure": {
      "riders": [
        "damage+falseTell"
      ],
      "source": "boss:oni"
    },
    "freestyle": {
      "riders": [
        "class:performance"
      ]
    },
    "frontPropagation": {
      "riders": []
    },
    "fullChord": {
      "riders": [
        "chordSustain",
        "lingering"
      ]
    },
    "fullHeadOfSteam": {
      "riders": [
        "class:fullSteam"
      ],
      "requires": {
        "pairs": [
          [
            "inertia",
            "threshold"
          ]
        ]
      }
    },
    "fullRecovery": {
      "riders": [
        "class:docFull"
      ],
      "requires": {
        "pairs": [
          [
            "succession",
            "inference"
          ]
        ]
      }
    },
    "fullThrottle": {
      "riders": [
        "charge",
        "pass-over",
        "spread:line"
      ],
      "requires": {
        "pairs": [
          [
            "aeronautics",
            "inertia"
          ]
        ]
      }
    },
    "gaiasAccord": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "one_with_nature"
      }
    },
    "gearTrain": {
      "riders": []
    },
    "genjutsu": {
      "riders": [
        "class:stealth"
      ]
    },
    "genreDefiningPerformance": {
      "riders": [
        "class:actor"
      ]
    },
    "giveItBack": {
      "riders": [
        "bypass-guard"
      ]
    },
    "glare": {
      "riders": [],
      "requires": {
        "pairs": [
          [
            "sightline",
            "constraint"
          ]
        ]
      }
    },
    "gracefulDegradation": {
      "riders": [
        "class:buff"
      ]
    },
    "grandComplication": {
      "riders": [
        "class:clockComplication"
      ]
    },
    "grandConjunction": {
      "riders": [
        "detonate"
      ]
    },
    "grandFormula": {
      "riders": []
    },
    "grappleLine": {
      "riders": []
    },
    "greatLever": {
      "riders": []
    },
    "growingMomentum": {
      "riders": []
    },
    "gusher": {
      "riders": [
        "class:oilGusher"
      ],
      "requires": {
        "pairs": [
          [
            "extraction",
            "diffusion"
          ]
        ]
      }
    },
    "hairClone": {
      "riders": [
        "class:monkey"
      ]
    },
    "halt": {
      "riders": [
        "class:police"
      ]
    },
    "harmonicRupture": {
      "riders": []
    },
    "headThemOff": {
      "riders": [
        "class:interceptDash"
      ],
      "requires": {
        "pairs": [
          [
            "pathway",
            "inference"
          ],
          [
            "strategic_commitment",
            "pathway"
          ]
        ]
      }
    },
    "headlineVerse": {
      "riders": [
        "class:performance"
      ]
    },
    "heavyFrame": {
      "riders": [
        "class:buff"
      ]
    },
    "heist": {
      "riders": [
        "class:rogueHeist"
      ]
    },
    "hexScreen": {
      "riders": [
        "hexScreen",
        "ward"
      ],
      "requires": {
        "form": "cyborg"
      }
    },
    "hoardWard": {
      "riders": [
        "territory",
        "lingering"
      ],
      "channelAdd": [
        "boundary"
      ],
      "source": "boss:dragon"
    },
    "holdTheImage": {
      "riders": [
        "imaginedShelter"
      ]
    },
    "holdTheLine": {
      "riders": [
        "class:guardArea",
        "limited",
        "spread:line"
      ]
    },
    "holdTone": {
      "riders": [
        "holdTone",
        "lingering"
      ]
    },
    "hollowMandate": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "faceless"
      }
    },
    "holographicSwarm": {
      "riders": [
        "class:holoSwarm"
      ]
    },
    "homeostaticNetwork": {
      "riders": [
        "class:circuitNetwork"
      ]
    },
    "honedEdge": {
      "riders": [
        "craftHone"
      ]
    },
    "hostileTakeover": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "founder_mode"
      }
    },
    "hundredNightParade": {
      "riders": [
        "illusions"
      ],
      "source": "boss:oni:enraged"
    },
    "huntersMark": {
      "riders": [
        "class:huntersMark"
      ],
      "requires": {
        "pairs": [
          [
            "pathway",
            "inference"
          ]
        ]
      }
    },
    "hurlFeast": {
      "riders": [
        "class:martial"
      ]
    },
    "hymnOfTheOath": {
      "riders": [
        "class:hymn"
      ]
    },
    "immovable": {
      "riders": [
        "immovable"
      ]
    },
    "imuFeast": {
      "riders": [
        "class:martial"
      ]
    },
    "independentCheck": {
      "riders": [
        "class:check"
      ]
    },
    "indexEntry": {
      "riders": [
        "archivistIndex"
      ]
    },
    "inferno": {
      "riders": [
        "damage+igniteAll",
        "ignite-map"
      ],
      "channelAdd": [
        "diffusion"
      ],
      "source": "boss:dragon:enraged"
    },
    "infernoRoar": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "dragon_blooded"
      }
    },
    "inputFilter": {
      "riders": [
        "class:buff"
      ]
    },
    "isolateTheVariable": {
      "riders": [
        "class:buff"
      ]
    },
    "jazzSolo": {
      "riders": [
        "class:performance"
      ]
    },
    "formBase": { "riders": ["state:grant", "once-per-turn:hanumanForm"], "requires": { "signature": true } },
    "formMonkey": { "riders": ["state:grant", "once-per-turn:hanumanForm", "body:sprite+traits+move"], "requires": { "signature": true } },
    "formGiant": { "riders": ["state:grant", "once-per-turn:hanumanForm", "body:massive+move+lf"], "requires": { "signature": true } },
    "layOnHands": {
      "riders": [
        "class:layHands"
      ]
    },
    "parallelPrep": {
      "riders": [
        "class:miseStation",
        "station",
        "apDiscount"
      ]
    },
    "rackAndLabel": {
      "riders": [
        "class:miseStation",
        "station",
        "apDiscount"
      ]
    },
    "remind": { "riders": ["state:break", "offered-by-state"], "requires": { "signature": true } },
    "gada": { "riders": [] },
    "sanjeevani": { "riders": ["class:carryMountain", "heal-area", "revive-once"] },
    "rememberWhatYouAre": { "riders": ["class:rememberAlly", "ult-charge", "state:break"] },
    "counselOfAges": { "riders": ["reveal-observation", "ult-charge:allies"] },
    "kodanda": { "riders": [] },
    "brahmastra": { "riders": ["class:brahmastra", "known-weakness:full", "once-per-battle"] },
    "brothersGuard": { "riders": ["class:guard", "thematic:rama"] },
    "coveringShot": { "riders": [] },
    "kukuiTorchNuts": {
      "riders": [
        "lodge-oil",
        "shove"
      ],
      "requires": {
        "signature": true
      }
    },
    "lakshmanaRekhaDraw": { "riders": ["state:grant", "thematic:sita"] },
    "lineNotCrossed": { "riders": ["state:grant:allies", "thematic:sita"] },
    "callOfFaith": { "riders": ["class:callKin", "kin-call", "once-per-battle"] },
    "chandrahasa": { "riders": [] },
    "seize": { "riders": ["class:maidRemove"] },
    "theAbduction": { "riders": ["class:abduct", "stun", "thematic:sita"] },
    "giantsReach": { "riders": [] },
    "theLongSleep": { "riders": ["state:grant", "heal-next-turn", "skip-turn"] },
    "theHungryGiant": { "riders": ["shape:radius"] },
    "beatTheDrums": { "riders": ["state:break", "offered-by-state"], "requires": { "signature": true } },
    "nagapashaShot": { "riders": ["state:grant:target", "bind", "thematic:rama+lakshmana"] },
    "shakti": { "riders": ["class:shakti", "thematic:lakshmana"] },
    "nikumbhila": { "riders": ["state:grant", "channel-2-turns", "empower"], "requires": { "pairs": [["deception", "constraint"]] } },
    "readTheOmens": { "riders": ["reveal-observation"] },
    "counsel": { "riders": ["state:grant:target", "conditional-ward", "thematic:ravana"], "requires": { "pairs": [["inference", "harmony"]] } },
    "theQueensPlea": { "riders": ["state:grant:allies", "thematic:ravana"], "requires": { "pairs": [["inference", "harmony"]] } },
    "shieldOfWings": { "riders": ["intercept", "thematic:sita"], "requires": { "pairs": [["interposition", "timing"]] } },
    "keenSight": { "riders": ["reveal-observation"] },
    "talonDive": { "riders": [] },
    "againstTheChariot": { "riders": ["named-strike", "thematic:ravana"], "requires": { "pairs": [["interposition", "timing"]] } },
    "enchantingGuise": { "riders": ["state:grant", "ward-until-struck"], "requires": { "pairs": [["glamour", "plasticity"]] } },
    "lure": { "riders": ["state:grant:target", "no-guard", "thematic:rama+lakshmana"], "requires": { "pairs": [["glamour", "plasticity"]] } },
    "talons": { "riders": [] },
    "vengefulRake": { "riders": [] },
    "cryForVengeance": { "riders": ["state:grant:allies", "empower"], "requires": { "pairs": [["glamour", "plasticity"]] } },
    "jinguBang": {
      "riders": [
        "class:monkey"
      ]
    },
    "jointControl": {
      "riders": [
        "class:holdMore"
      ]
    },
    "judgmentOfGods": {
      "riders": [
        "class:lawgiver"
      ]
    },
    "juxtapose": {
      "riders": [
        "paste",
        "lingering"
      ]
    },
    "keepFaith": {
      "riders": [
        "class:faithWard"
      ]
    },
    "keylineTerrace": {
      "riders": [
        "berm",
        "lingering",
        "spread:line"
      ]
    },
    "kitsuneFoxfire": {
      "riders": [],
      "requires": {
        "form": "oni_blooded"
      }
    },
    "lash": {
      "riders": [
        "seed"
      ]
    },
    "lastCrossing": {
      "riders": [
        "class:ferryLast",
        "spread:radius"
      ]
    },
    "lastStand": {
      "riders": [
        "class:guardArea",
        "limited",
        "spread:radius"
      ]
    },
    "lawBindsItsMaker": {
      "riders": [
        "class:law",
        "lingering"
      ]
    },
    "layerMask": {
      "riders": [
        "class:artistMask"
      ]
    },
    "layingOnOfHands": {
      "riders": [
        "class:clericHands"
      ]
    },
    "leapingStrike": {
      "riders": [
        "knockback",
        "form-rider"
      ],
      "requires": {
        "form": "chitin_knight"
      }
    },
    "lineRemains": {
      "riders": [
        "class:guardArea",
        "limited",
        "lingering"
      ]
    },
    "linkedStep": {
      "riders": [
        "class:teleport"
      ]
    },
    "livingArchive": {
      "riders": [
        "archivistShelter"
      ]
    },
    "livingResponse": {
      "riders": [
        "knockback"
      ]
    },
    "livingSafetyNet": {
      "riders": [
        "class:cushionArea",
        "limited",
        "lingering"
      ]
    },
    "loadPath": {
      "riders": [
        "class:loadPath",
        "spread:radius"
      ]
    },
    "loadResponse": {
      "riders": [
        "class:buff"
      ]
    },
    "lockIn": {
      "riders": [
        "class:platformLock"
      ],
      "requires": {
        "pairs": [
          [
            "adjacency",
            "dependency"
          ]
        ]
      }
    },
    "lonelyWave": {
      "riders": [
        "class:martial"
      ]
    },
    "longMigration": {
      "riders": [
        "class:tmLong"
      ]
    },
    "longView": {
      "riders": [
        "lingering"
      ]
    },
    "lullaby": {
      "riders": [
        "class:performance"
      ]
    },
    "makeRoomForPossibility": {
      "riders": [
        "imaginedCompany"
      ]
    },
    "makeTheCase": {
      "riders": [
        "class:robotTalk"
      ]
    },
    "manufacturedChoice": {
      "riders": [
        "class:buff"
      ]
    },
    "manyPaths": {
      "riders": [
        "spread:plus"
      ]
    },
    "marginCall": {
      "riders": [
        "marginCall",
        "mass-due",
        "debt-damage"
      ],
      "channelAdd": [
        "reciprocal_obligation"
      ],
      "source": "boss:tallyman"
    },
    "markTheVessel": {
      "riders": [
        "class:tmMark"
      ]
    },
    "maskSwap": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "oni_blooded"
      }
    },
    "masquerade": {
      "riders": []
    },
    "masterwork": {
      "riders": []
    },
    "measureTwice": {
      "riders": [
        "craftCare"
      ]
    },
    "measuredOpening": {
      "riders": []
    },
    "membrane": {
      "riders": [
        "membrane",
        "reactive"
      ]
    },
    "memoryPalace": {
      "riders": [
        "fruit:locus"
      ]
    },
    "merge": {
      "riders": [
        "class:monkey"
      ]
    },
    "millenniumGrip": {
      "riders": [
        "drag-roots"
      ],
      "requires": {
        "signature": true
      }
    },
    "mimicry": {
      "riders": [
        "mimic"
      ]
    },
    "modelOpera": {
      "riders": [
        "class:law",
        "lingering",
        "spread:radius"
      ],
      "requires": {
        "pairs": [
          [
            "glamour",
            "legitimacy"
          ]
        ]
      }
    },
    "molt": {
      "riders": [
        "heal+speed"
      ],
      "source": "boss:kaiju:enraged"
    },
    "monkeyMischief": {
      "riders": [
        "class:monkey"
      ]
    },
    "mountainFold": {
      "riders": [
        "mountainFold",
        "lingering"
      ]
    },
    "mountainFoldInterim": {
      "riders": [
        "class:foldPanel"
      ]
    },
    "myAnswerHasChanged": {
      "riders": []
    },
    "neitherAlone": {
      "riders": []
    },
    "newConfiguration": {
      "riders": [
        "class:buff"
      ]
    },
    "nightParade": {
      "riders": [],
      "requires": {
        "form": "oni_blooded"
      }
    },
    "nobodyBehindMe": {
      "riders": [
        "class:guardArea",
        "limited",
        "lingering"
      ]
    },
    "nurseLog": {
      "riders": [
        "nurseLog",
        "lingering"
      ]
    },
    "oathOfTheShield": {
      "riders": [
        "class:oathGuard"
      ]
    },
    "offBalance": {
      "riders": []
    },
    "oldGrowth": {
      "riders": [
        "oldGrowth",
        "lingering"
      ]
    },
    "onboard": {
      "riders": [
        "class:platformLink"
      ],
      "requires": {
        "pairs": [
          [
            "adjacency",
            "dependency"
          ]
        ]
      }
    },
    "oneDeclaredMoment": {
      "riders": []
    },
    "openArchive": {
      "riders": [
        "archivistArchive"
      ]
    },
    "operationOrder": {
      "riders": [
        "class:operationOrder"
      ]
    },
    "orbitalDrop": {
      "riders": [
        "orbitalDrop"
      ],
      "requires": {
        "pairs": [
          [
            "settlement",
            "sightline"
          ]
        ]
      }
    },
    "orthographicProjection": {
      "riders": [
        "project",
        "lingering",
        "spread:line"
      ]
    },
    "overdrive": {
      "riders": [
        "class:buff"
      ]
    },
    "overflight": {
      "riders": [
        "class:overflight"
      ]
    },
    "overgrowth": {
      "riders": [
        "entangle",
        "seed"
      ]
    },
    "pairedFunction": {
      "riders": []
    },
    "paleStampede": {
      "riders": [
        "paleStampede"
      ],
      "requires": {
        "pairs": [
          [
            "sightline",
            "boundary"
          ]
        ]
      }
    },
    "paperBurnout": {
      "riders": [
        "class:paperBurnout"
      ]
    },
    "paperRoute": {
      "riders": [
        "class:paperRoute"
      ]
    },
    "passAClass": {
      "riders": [
        "class:studyPass"
      ]
    },
    "perch": {
      "riders": [
        "class:perch"
      ]
    },
    "perfectHeist": {
      "riders": [
        "class:stealth"
      ]
    },
    "perfectMoment": {
      "riders": []
    },
    "petrify": {
      "riders": [
        "class:petrify",
        "lingering"
      ],
      "requires": {
        "pairs": [
          [
            "sightline",
            "constraint"
          ]
        ]
      }
    },
    "photomontage": {
      "riders": [
        "montage",
        "spread:composite"
      ]
    },
    "pickpocket": {
      "riders": [
        "class:stealth"
      ]
    },
    "pictureTheArrival": {
      "riders": [
        "imaginedRehearsal"
      ]
    },
    "pioneerPatch": {
      "riders": [
        "successionPatch",
        "lingering"
      ]
    },
    "piston": {
      "riders": [],
      "requires": {
        "pairs": [
          [
            "inertia",
            "threshold"
          ]
        ]
      }
    },
    "placeFill": {
      "riders": [
        "gradeFill"
      ]
    },
    "plaintext": {
      "riders": [
        "reveal",
        "soul"
      ]
    },
    "planView": {
      "riders": [
        "planView",
        "lingering",
        "spread:arena"
      ]
    },
    "platformShift": {
      "riders": [
        "class:platformShift"
      ],
      "requires": {
        "pairs": [
          [
            "adjacency",
            "dependency"
          ]
        ]
      }
    },
    "pocket": {
      "riders": [
        "class:roguePocket"
      ]
    },
    "pounceFromStillness": {
      "riders": [
        "class:pounce"
      ]
    },
    "printFabricator": {
      "riders": [
        "raiseFoundry"
      ],
      "requires": {
        "pairs": [
          [
            "settlement",
            "sightline"
          ]
        ]
      }
    },
    "productiveFailure": {
      "riders": []
    },
    "propulsion": {
      "riders": [
        "charge",
        "stop-first",
        "spread:line"
      ]
    },
    "protectTheEssential": {
      "riders": [
        "class:maidProtect"
      ]
    },
    "protectiveSleeve": {
      "riders": [
        "archivistWard"
      ]
    },
    "prototype": {
      "riders": [
        "prototype",
        "spread:composite"
      ]
    },
    "provenFormula": {
      "riders": []
    },
    "prune": {
      "riders": [
        "prune"
      ]
    },
    "publicPromise": {
      "riders": [
        "presidentPromise"
      ]
    },
    "rainGarden": {
      "riders": [
        "rainGarden",
        "lingering",
        "spread:plus"
      ]
    },
    "raiseDataCenter": {
      "riders": [
        "class:platformDataCenter"
      ]
    },
    "raiseFoundry": {
      "riders": [
        "raiseFoundry"
      ]
    },
    "raisePalisade": {
      "riders": [
        "raisePalisade"
      ]
    },
    "rasterPass": {
      "riders": [
        "class:artistRaster"
      ]
    },
    "readLivingCircuit": {
      "riders": [
        "class:circuitRead"
      ]
    },
    "readSign": {
      "riders": [
        "class:readSign"
      ],
      "requires": {
        "pairs": [
          [
            "pathway",
            "inference"
          ],
          [
            "inference",
            "selectivity"
          ]
        ]
      }
    },
    "readTheOpening": {
      "riders": [
        "class:read"
      ]
    },
    "rebound": {
      "riders": [
        "parry",
        "reactive"
      ]
    },
    "reclamation": {
      "riders": [
        "entangleAll"
      ],
      "source": "boss:gaia:enraged"
    },
    "recoilCascade": {
      "riders": [
        "pierce"
      ]
    },
    "recombine": {
      "riders": [
        "recombine",
        "spread:composite"
      ]
    },
    "recoveryCut": {
      "riders": []
    },
    "recoveryStrike": {
      "riders": [
        "class:stealth"
      ]
    },
    "redact": {
      "riders": [
        "silence",
        "soul"
      ]
    },
    "redundantSystems": {
      "riders": [
        "class:buff"
      ]
    },
    "reelingShot": {
      "riders": [
        "pull"
      ]
    },
    "regrade": {
      "riders": [
        "class:regrade"
      ]
    },
    "remoteDoor": {
      "riders": [
        "class:teleport"
      ]
    },
    "renderEngine": {
      "riders": [
        "class:artistEngine"
      ]
    },
    "repairRecord": {
      "riders": [
        "archivistHeal"
      ]
    },
    "repossession": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "ledger_sworn"
      }
    },
    "requiredInput": {
      "riders": [
        "class:buff"
      ]
    },
    "rescueCorridor": {
      "riders": [
        "class:rescue"
      ]
    },
    "resonantPulse": {
      "riders": [
        "knockback"
      ]
    },
    "resonantVerse": {
      "riders": [
        "verseDamage"
      ]
    },
    "restoreTheWorkingOrder": {
      "riders": [
        "class:maidRestore"
      ]
    },
    "rewind": {
      "riders": [
        "class:clockRewind"
      ]
    },
    "ridgeRemembers": {
      "riders": []
    },
    "riff": {
      "riders": [
        "class:performance"
      ]
    },
    "riptide": {
      "riders": [
        "pull"
      ]
    },
    "smallDoses": {
      "riders": [
        "class:antifragileDose"
      ]
    },
    "hormesis": {
      "riders": [
        "class:antifragileBank",
        "heal"
      ]
    },
    "serveMapoTofu": {
      "riders": [
        "class:serveDish"
      ]
    },
    "familyStyle": {
      "riders": [
        "heal",
        "spread:radius"
      ]
    },
    "boilOver": {
      "riders": [
        "class:boilOver",
        "spread:radius",
        "heal"
      ]
    },
    "rollOfHonor": {
      "riders": [
        "class:memorialRoll",
        "spread:radius"
      ]
    },
    "royalException": {
      "riders": [
        "class:exempt"
      ]
    },
    "runawayMass": {
      "riders": [
        "knockback"
      ]
    },
    "sanctuaryVow": {
      "riders": [
        "class:clericSanctuary"
      ]
    },
    "secondContribution": {
      "riders": [
        "class:buff"
      ]
    },
    "secondGaze": {
      "riders": [
        "focus"
      ]
    },
    "secondNature": {
      "riders": [
        "class:buff"
      ]
    },
    "secondOpinion": {
      "riders": [
        "class:docConfirm"
      ],
      "requires": {
        "pairs": [
          [
            "succession",
            "inference"
          ]
        ]
      }
    },
    "sectionCut": {
      "riders": [
        "sectionCut",
        "spread:line"
      ]
    },
    "set": {
      "riders": [
        "class:holdMore"
      ],
      "requires": {
        "pairs": [
          [
            "sightline",
            "constraint"
          ]
        ]
      }
    },
    "setTheScene": {
      "riders": [
        "class:directorFilm"
      ],
      "requires": {
        "pairs": [
          [
            "boundary",
            "delegation"
          ]
        ]
      }
    },
    "shapeShift": {
      "riders": [
        "swap"
      ],
      "source": "boss:oni"
    },
    "shareTheLoad": {
      "riders": [
        "class:share",
        "spread:radius"
      ]
    },
    "shareTheSpan": {
      "riders": [
        "class:spanShare"
      ]
    },
    "sharedContract": {
      "riders": [
        "class:law",
        "lingering"
      ]
    },
    "shieldBash": {
      "riders": []
    },
    "shieldFace": {
      "riders": [
        "class:shieldFace"
      ]
    },
    "shieldWall": {
      "riders": [
        "barrier",
        "reactive",
        "ward"
      ]
    },
    "shimmer": {
      "riders": [
        "class:shimmer"
      ]
    },
    "shockwave": {
      "riders": [
        "knockback"
      ]
    },
    "shoreUp": {
      "riders": [
        "class:shore"
      ]
    },
    "shortChange": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "ledger_sworn"
      }
    },
    "shortCount": {
      "riders": [
        "force-loan"
      ],
      "channelAdd": [
        "reciprocal_obligation"
      ],
      "source": "boss:tallyman"
    },
    "shoulderBoth": {
      "riders": [
        "class:shoulder"
      ]
    },
    "shoulderTheWorld": {
      "riders": [
        "class:share",
        "lingering",
        "spread:radius"
      ]
    },
    "sieveVerdict": {
      "riders": []
    },
    "skim": {
      "riders": [
        "class:stealth"
      ]
    },
    "smite": {
      "riders": []
    },
    "smokeVeil": {
      "riders": [
        "class:stealth",
        "spread:radius"
      ]
    },
    "fogBank": {
      "riders": [
        "fruit:mist",
        "spread:square"
      ]
    },
    "takeTheShape": {
      "riders": [
        "fruit:hide"
      ]
    },
    "windTheSpring": {
      "riders": [
        "fruit:coil"
      ]
    },
    "mainspring": {
      "riders": [
        "fruit:coil"
      ]
    },
    "scent": {
      "riders": [
        "fruit:hide"
      ]
    },
    "vapourStep": {
      "riders": [
        "fruit:mist"
      ]
    },
    "fullShape": {
      "riders": [
        "fruit:hide"
      ]
    },
    "dropTheShape": {
      "riders": [
        "fruit:hide"
      ]
    },
    "weatherFront": {
      "riders": [
        "fruit:mist"
      ]
    },
    "snapBack": {
      "riders": []
    },
    "snapShot": {
      "riders": []
    },
    "somersaultCloud": {
      "riders": [
        "class:monkey"
      ]
    },
    "sonicBoom": {
      "riders": [
        "knockback"
      ]
    },
    "sort": {
      "riders": [
        "class:maidSort"
      ]
    },
    "spareHair": {
      "riders": [
        "class:monkey"
      ]
    },
    "spill": {
      "riders": [
        "class:oilSpill",
        "spread:radius"
      ],
      "requires": {
        "pairs": [
          [
            "extraction",
            "diffusion"
          ]
        ]
      }
    },
    "spiralOrb": {
      "riders": [],
      "requires": {
        "pairs": [
          [
            "settlement",
            "sightline"
          ]
        ]
      }
    },
    "spiritVeil": {
      "riders": [
        "lineImmune"
      ],
      "source": "boss:oni:enraged"
    },
    "springLeverThrow": {
      "riders": []
    },
    "springRise": {
      "riders": [
        "flood"
      ],
      "source": "boss:gaia"
    },
    "stabilize": {
      "riders": [
        "class:docStabilize"
      ],
      "requires": {
        "pairs": [
          [
            "succession",
            "inference"
          ]
        ]
      }
    },
    "staffSky": {
      "riders": [
        "class:monkey"
      ]
    },
    "starfall": {
      "riders": [
        "detonate",
        "chain"
      ]
    },
    "statute": {
      "riders": [
        "class:lawgiver"
      ]
    },
    "stepBetween": {
      "riders": [
        "class:guard",
        "limited"
      ]
    },
    "stoneGarden": {
      "riders": [
        "class:gazeGarden",
        "lingering",
        "spread:radius"
      ],
      "requires": {
        "pairs": [
          [
            "sightline",
            "constraint"
          ]
        ]
      }
    },
    "stormWings": {
      "riders": [
        "hover",
        "dive"
      ],
      "source": "boss:dragon:enraged"
    },
    "submissionHold": {
      "riders": [
        "class:hold",
        "stun",
        "lingering"
      ]
    },
    "supportNetwork": {
      "riders": [
        "class:share",
        "lingering",
        "spread:radius"
      ]
    },
    "survey": {
      "riders": [
        "survey"
      ]
    },
    "surveyPass": {
      "riders": [
        "sectionCut",
        "spread:line"
      ]
    },
    "surveyShot": {
      "riders": []
    },
    "suspendedRoute": {
      "riders": [
        "class:relocate",
        "spread:line"
      ]
    },
    "swarmBreach": {
      "riders": [
        "spread:line"
      ],
      "source": "boss:kaiju:enraged"
    },
    "swear": {
      "riders": [
        "class:oath"
      ]
    },
    "swoop": {
      "riders": [
        "class:swoop"
      ]
    },
    "swornIn": {
      "riders": [
        "presidentOffice",
        "lingering",
        "spread:radius"
      ]
    },
    "sympatheticChord": {
      "riders": []
    },
    "tailSweep": {
      "riders": [
        "knockback"
      ],
      "source": "boss:dragon"
    },
    "takeIt": {
      "riders": [
        "class:buff"
      ]
    },
    "takeOff": {
      "riders": [
        "class:takeoff"
      ]
    },
    "takeUpTheCraft": {
      "riders": [
        "class:craftAccept"
      ]
    },
    "takeWing": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "dragon_blooded"
      }
    },
    "takedown": {
      "riders": [
        "class:police"
      ]
    },
    "tallyUp": {
      "riders": [
        "debt-scaling"
      ],
      "channelAdd": [
        "reciprocal_obligation"
      ],
      "source": "boss:tallyman"
    },
    "tectonic": {
      "riders": [
        "quake",
        "spread:arena"
      ],
      "source": "boss:gaia:enraged"
    },
    "tether": {
      "riders": [
        "class:tether"
      ]
    },
    "theAccordHolds": {
      "riders": [
        "presidentAccord",
        "spread:radius"
      ]
    },
    "theDivide": {
      "riders": [
        "class:divide"
      ]
    },
    "theOffer": {
      "riders": [
        "offer",
        "mass-terms"
      ],
      "channelAdd": [
        "reciprocal_obligation"
      ],
      "source": "boss:tallyman"
    },
    "tick": {
      "riders": []
    },
    "timedBloom": {
      "riders": [
        "class:seedBloom",
        "lingering"
      ]
    },
    "tippingPoint": {
      "riders": [
        "tippingPoint",
        "triggered"
      ]
    },
    "totalDependence": {
      "riders": [
        "class:dependence",
        "lingering",
        "spread:radius"
      ]
    },
    "track": {
      "riders": [
        "class:trackMove"
      ],
      "requires": {
        "pairs": [
          [
            "pathway",
            "inference"
          ],
          [
            "strategic_commitment",
            "pathway"
          ]
        ]
      }
    },
    "tradeTheOldAnswer": {
      "riders": [
        "class:buff"
      ]
    },
    "tripThreshold": {
      "riders": [
        "triggered"
      ]
    },
    "turnTheWeight": {
      "riders": []
    },
    "typedChannel": {
      "riders": []
    },
    "ulaula": {
      "riders": [
        "class:martial"
      ]
    },
    "uluHurl": {
      "riders": [
        "lodge-seeds"
      ],
      "requires": {
        "signature": true
      }
    },
    "unbearableVisage": {
      "riders": [
        "visage"
      ],
      "source": "boss:emissary:enraged"
    },
    "unchained": {
      "riders": [
        "class:unchained"
      ]
    },
    "undertow": {
      "riders": [
        "class:diveUndertow"
      ]
    },
    "undividedAttention": {
      "riders": [
        "attention",
        "lingering"
      ]
    },
    "unstoppable": {
      "riders": [
        "charge",
        "spread:line"
      ]
    },
    "valleyFold": {
      "riders": [
        "valleyFold",
        "lingering"
      ]
    },
    "valve": {
      "riders": [
        "class:buff"
      ],
      "requires": {
        "pairs": [
          [
            "inertia",
            "threshold"
          ]
        ]
      }
    },
    "vanish": {
      "riders": [
        "class:stealth"
      ]
    },
    "vanishingCut": {
      "riders": [
        "class:stealth"
      ]
    },
    "vendorLock": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "founder_mode"
      }
    },
    "verdance": {
      "riders": [
        "grow"
      ],
      "source": "boss:gaia"
    },
    "verify": {
      "riders": [
        "verify"
      ]
    },
    "voidFace": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "faceless"
      }
    },
    "voidGlance": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "faceless"
      }
    },
    "voidOrb": {
      "riders": [],
      "source": "boss:emissary"
    },
    "vowNeverQuench": {
      "riders": [
        "class:martial"
      ]
    },
    "vowOpenHand": {
      "riders": [
        "class:martial"
      ]
    },
    "vowSharedBowl": {
      "riders": [
        "class:martial"
      ]
    },
    "wait": {
      "riders": [
        "class:stealth"
      ]
    },
    "walkTheRooms": {
      "riders": [
        "fruit:locus"
      ]
    },
    "warCry": {
      "riders": [
        "class:buff"
      ]
    },
    "warrant": {
      "riders": [
        "class:lawgiver"
      ]
    },
    "watershed": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "one_with_nature"
      }
    },
    "watershedTerrace": {
      "riders": [
        "gradeTerrace",
        "spread:plus"
      ]
    },
    "whatIf": {
      "riders": [
        "whatIf"
      ]
    },
    "wholeness": {
      "riders": [
        "form-rider"
      ],
      "requires": {
        "form": "integrated_self"
      }
    },
    "wingDrone": {
      "riders": [
        "damage+timing"
      ],
      "source": "boss:kaiju"
    },
    "worldSmallEnough": {
      "riders": [
        "worldSmallEnough",
        "lingering"
      ]
    },
    "writtenVerse": {
      "riders": [
        "class:performance"
      ]
    },
    "yieldingGuard": {
      "riders": [
        "class:buff"
      ]
    },
    "youNeedWhatIHold": {
      "riders": [
        "class:dependence",
        "lingering"
      ]
    }
  };

  // Newly shipped definitions missing from the original 1.3.369 curation.
  Object.assign(PARTS, {
    stealPresent: {riders:["class:ltSkim"]},
    investFuture: {riders:["class:ltInvest"]},
    theFutureArrives: {riders:["class:ltCall"]},
    farContract: {riders:["class:ltContract"]},
    orgoniteLance: {riders:["class:suitLance","announced"]},
    dreamCircuit: {riders:["class:suitCircuit","announced"]},
    dreamForge: {riders:["class:suitForge","announced"]},
    posterityRaster: {riders:["class:suitRaster","announced"]},
    farOrder: {riders:["class:suitOrder","announced"]},
    summonedMandate: {riders:["class:suitMandate","announced"]},
    courtCall: {riders:[],source:"boss:worldGoddess"},
    courtClose: {riders:[],source:"boss:worldGoddess"},
    theEarthSpeaks: {riders:[],source:"boss:worldGoddess"},
    floodClose: {riders:[],source:"boss:worldGoddess:enraged"},
    rootCall: {riders:[],source:"boss:worldGoddess:enraged"},
    designateDestiny: {riders:["class:teleDestiny"]},
    borrowedBlow: {riders:["class:teleBorrow"]},
    novaGuarantee: {riders:["class:teleNova"]},
    whatWasOwed: {riders:["class:retroOwed"]},
    echoReturn: {riders:["class:retroEcho"]},
    causalSnapback: {riders:["class:retroSnap"]},
    novikovGuarantee: {riders:["class:novikov"]},
    shortFlight: {riders:["fly","once-per-turn"]},
    soaringStrike: {riders:["charge","stop-first","once-per-battle"]},
    root: {riders:["immovable","once-per-turn"]},
    landslide: {riders:["charge","spread:line","once-per-battle"]},
    rally: {riders:["inspire","once-per-turn"]},
    coronation: {riders:["inspire","cap-break","once-per-battle"]},
    plotTwist: {riders:["swap","once-per-turn"]},
    refuseEnding: {riders:["ward:death","once-per-battle"]},
    cutLine: {riders:[],source:"boss:sealednext"},
    pullShare: {riders:[],source:"boss:sealednext"},
    slackWater: {riders:[],source:"boss:sealednext"},
    closeSluice: {riders:[],source:"boss:sealednext"},
    kingTide: {riders:[],source:"boss:sealednext"},
    lowWater: {riders:[],source:"boss:sealednext:enraged"},
    longEbb: {riders:[],source:"boss:sealednext:enraged"},
    namedInterval: {riders:["class:sealed"]},
    heldCadence: {riders:["class:sealed"]},
    standingAppointment: {riders:["class:sealed"]},
    offer: {riders:["class:offer","placed","field-mark"]},
    specify: {riders:["class:offer","specify-match"]},
    theWorldAnswers: {riders:["class:offer","announced","shape:radius"]},
    buffer: {riders:["class:absorb","absorb"]},
    regimeShift: {riders:["class:flip","once-per-battle"]},
    stillHere: {riders:["class:clamp","announced","once-per-battle"]},
    sealedNamed: {riders:["form-rider"],requires:{form:"appointment_sworn"}},
    sealedShare: {riders:["form-rider"],requires:{form:"appointment_sworn"}},
    sealedStanding: {riders:["form-rider"],requires:{form:"appointment_sworn"}},
    mon_lifeDrain: {riders:["heal-self"]},
    mon_bindingWraps: {riders:["root"]},
    mon_stripBare: {riders:["strip"]},
    mon_galvanicSlam: {riders:["knockback"]},
    mon_infectiousBite: {riders:["infect"]},
    mon_pounce: {riders:["leap"]},
    mon_chillingWail: {riders:["ap-loss"]},
    mon_broodBite: {riders:[]}
  });
  TECHNIQUE_IDS = Object.keys(PARTS).sort();
  const clone = x => x == null ? null : JSON.parse(JSON.stringify(x));
  // An authored requirement is NOT an optional vow and never earns power twice.
  // Text requirements remain text until a typed engine predicate is implemented.
  function decompose(technique, id) {
    const tag=PARTS[id]; if(!technique||!tag)return null;
    const t=technique, requirements={...(clone(tag.requires)||{})};
    for(const k of ["formOnly","signatureOnly","pairOnly","pairs","merge","classNeeds","prerequisites","dependencies","targetRule"])
      if(t[k]!=null)requirements[k]=clone(t[k]);
    const payload={effect:t.effect||null,handler:t.classKind||null};
    const envelope=new Set(["name","tier","concepts","channel","damageType","delivery","target","area","range","cost","tempoCost","actionCost","mechanism","reveal","prompt","teaches","price","counter","announce","effectCategory","effect","classKind"]);
    const parameters={}; for(const k of Object.keys(t).sort())if(!envelope.has(k))parameters[k]=clone(t[k]);
    payload.parameters=parameters;
    payload.definition=t.potencyDefinition||t.newEffect||t.mechanism||t.reveal||"Engine-owned behavior; requires an adapter.";
    const mechanicalTags=new Set(tag.riders);
    if(t.effect)mechanicalTags.add("effect:"+t.effect);
    if(t.classKind)mechanicalTags.add("handler:"+t.classKind);
    for(const k of ["knockback","pull","stun","stunTempo","pierce","bypassGuard","reactive","trigger","duration","uses","seedLodge","releaseStored","carryAlly","routeBudget"])
      if(t[k]!=null&&t[k]!==false)mechanicalTags.add(k);
    if(t.area?.shape)mechanicalTags.add("shape:"+t.area.shape);
    const isBoss=!!tag.source?.startsWith("boss:"), bound=isBoss||!!(tag.requires||t.formOnly||t.signatureOnly||t.pairOnly||t.pairs?.length||t.merge);
    const roles={channel:!!((t.concepts||[]).length||tag.channelAdd?.length),delivery:["contact","line","field"].includes(t.delivery),damageLoad:typeof t.potency==="number"&&t.potency>0,wardLoad:t.effect==="barrier",knockback:!!t.knockback||tag.riders.includes("knockback")};
    // Availability describes extracting a component, never a promise to recreate
    // its original handler, target rule, timing or lens behavior unchanged.
    const components=bound?[]:Object.keys(roles).filter(k=>roles[k]);
    return {version:2,id,name:t.name||id,source:tag.source||"content",
      concept:{concepts:clone(t.concepts)||[],medium:t.damageType||t.channel||null,additional:clone(tag.channelAdd)||[]},
      delivery:{kind:t.delivery||null,target:t.target||null,range:t.range??null,area:clone(t.area),targetRule:t.targetRule||null},
      reusableEffects:effectComponents(t,id),payload,costs:{phi:t.cost??0,tempoCost:t.tempoCost??null,authoredActionCost:t.actionCost??null,tier:t.tier||"basic",price:t.price||null},
      timing:{timing:t.timing||null,trigger:t.trigger||null,expiry:t.expiry||null,duration:t.duration??null,announce:t.announce||null},
      inherentRequirements:requirements,
      optionalContract:{unlock:[],cast:{},active:{}},
      // Never infer order from prose: the source may describe simultaneous gates.
      contractMapping:{unlock:"No ordered optional chain inferred",sourcePrerequisites:clone(t.prerequisites)||[],sourceDependencies:clone(t.dependencies)||[],credit:0,requiresTypedAdapter:!!(t.prerequisites?.length||t.dependencies?.length)},
      mechanics:[...mechanicalTags].sort(),
      compatibility:{state:bound?"identity-bound":components.length?"components-only":"adapter-required",components,faithfulReconstruction:false,
        reason:bound?"Retain boss/form/signature/merge/pair gates; optional vows cannot buy these away.":"Component extraction only. Preserve the original payload through a typed adapter before faithful reconstruction.",
        adapter: t.classKind?"class:"+t.classKind:t.effect?"effect:"+t.effect:"boss:"+id},
      counter:t.counter||t.reveal||null, original:clone(t)};
  }

  // Build full scribe parts for one live technique entry. Returns null
  // (resists-analysis) for ids with no curated entry.
  // Executable, independently extractable primitives. Signature wrappers are not copied.
  // Add adapters here, beside the existing authoritative decomposition, never in a second catalog.
  function effectComponents(t,id) {
    if(!t)return [];
    const out=[],add=(key,label,params,phi,ap,target="target",requires=[],recipients=null)=>out.push({key,label,params,phi,ap,target,requires,recipients:recipients||["self","ally","target"],status:"ready"});
    const bound=!!(PARTS[id]?.requires||t.formOnly||t.signatureOnly||t.merge||t.pairs?.length||t.classKind);
    if(!bound && t.effect==="damage" && typeof t.potency==="number" && t.potency>0)add("damage","Direct damage",{potency:t.potency},Math.max(2,Math.ceil(t.potency/5)),Math.ceil(t.potency/2));
    if(!bound && t.knockback>0)add("push","Push",{tiles:Math.min(3,t.knockback)},2,6);
    if(!bound && t.stunTempo>0)add("stagger","AP stagger",{ap:Math.min(30,t.stunTempo)},3,8);
    if(t.effect==="barrier"&&!bound)add("ward","Personal ward",{protection:typeof t.protection==="number"?t.protection:8,duration:1},3,8,"self");
    if(id==="adaptiveBrace")add("adaptResistance","Observed-channel resistance",{multiplier:.5,duration:1},4,10,"self",["observedIncomingChannel"]);
    // Constraint mechanics are transferable; police credentials/chain progression are NOT.
    if(id==="cuff"){
      add("reveal","Reveal concealment",{},2,5);
      add("root","Restrict movement",{duration:2},4,10);
      add("itemLock","Restrict items",{duration:2},3,8);
    }
    if(id==="halt")add("root","Restrict movement",{duration:1},3,8);
    return out;
  }

  function resolveParts(technique, id) {
    var tag = PARTS[id];
    if (!technique || !tag) return null;
    var channel = (technique.concepts || []).slice();
    if (tag.channelAdd) channel = channel.concat(tag.channelAdd);
    var medium = technique.damageType || technique.channel;
    if (medium) channel.push(medium);
    return {
      channel: channel,
      delivery: technique.delivery || null,
      load: {
        tier: technique.tier || "basic",
        cost: technique.cost == null ? 0 : technique.cost,
        range: technique.range == null ? 0 : technique.range,
        potency: technique.potency == null ? 0 : technique.potency,
        ap: technique.tempoCost == null ? null : technique.tempoCost,
      },
      riders: tag.riders.slice(),
      requires: tag.requires ? JSON.parse(JSON.stringify(tag.requires)) : null,
      decomposition: decompose(technique, id),
      effects: effectComponents(technique,id),
    };
  }

  return { TECHNIQUE_IDS: TECHNIQUE_IDS, DELIVERY_RANK: DELIVERY_RANK, PARTS: PARTS, resolveParts: resolveParts, decompose: decompose, SCHEMA_VERSION: 2, effectComponents: effectComponents };
});

