"use strict";
// Deterministic story-campaign data and transitions. This module is intentionally
// independent of the UI and battle engine so saves/branches can be replay-tested.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatVignettes = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SCHEMA = 1, CAMPAIGN = "phase-one-vignettes";
  const SCENES = ["quietHouse", "courtyard", "lastVerdict"];
  const STANCES = {
    quietHouse: ["accuseMaid", "accuseRobot", "standWithOfficer", "devilsAdvocate"],
    courtyard: ["readWithScientist", "accuseScientist", "standWithRecord", "challengeOffice", "devilsAdvocate"],
    lastVerdict: [],
  };
  const INTERVALS = ["long", "short", "rush"];
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const fail = (error) => ({ ok: false, error });

  function randomBuild(configs, concepts, random = Math.random) {
    const fits = (configs || []).filter(fit => fit && typeof fit.primary === "string" && fit.primary
      && (fit.secondary == null || (typeof fit.secondary === "string" && fit.secondary && fit.secondary !== fit.primary)));
    if (fits.length) {
      const fit = fits[Math.min(fits.length - 1, Math.floor(Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * fits.length))];
      return { primary: fit.primary, secondary: fit.secondary || null };
    }
    const pool = [...new Set((concepts || []).filter(id => typeof id === "string" && id))];
    if (!pool.length) return null;
    const take = (items) => items.splice(Math.min(items.length - 1, Math.floor(Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * items.length)), 1)[0];
    const primary = take([...pool]), secondaryPool = pool.filter(id => id !== primary);
    return { primary, secondary: secondaryPool.length ? take(secondaryPool) : null };
  }

  function create(seed = 1) {
    return { schemaVersion: SCHEMA, campaign: CAMPAIGN, seed: seed >>> 0, status: "active", sceneIndex: 0,
      playerCharacter: null, playerLoadout: null, playerLF: 100, recognition: "unresolved", houseCase: null, hearingCase: null,
      current: { scene: SCENES[0], stance: null, interval: null, baseLF: 100, setup: null, completed: false }, records: [] };
  }
  function validState(s) {
    return !!s && s.schemaVersion === SCHEMA && s.campaign === CAMPAIGN && SCENES[s.sceneIndex] === s.current?.scene
      && ["active", "won", "lost"].includes(s.status) && Array.isArray(s.records) && Number.isFinite(s.playerLF)
      && s.playerLF >= 0 && s.playerLF <= 100 && (s.playerCharacter == null || typeof s.playerCharacter === "string")
      && (s.playerLoadout == null || (typeof s.playerLoadout.primary === "string" && s.playerLoadout.primary.length > 0
        && (s.playerLoadout.secondary == null || typeof s.playerLoadout.secondary === "string") && s.playerLoadout.secondary !== s.playerLoadout.primary));
  }
  function serialize(s) {
    if (!validState(s)) throw new Error("Invalid vignette campaign state.");
    return JSON.stringify(s);
  }
  // The Paladin re-spec (2026-10-31): a campaign loadout that still names the old Paladin pair is re-slotted on load (account.js migratePaladinPair).
  function deserialize(raw) {
    try { const s = JSON.parse(raw); if (validState(s)) { if (!Object.hasOwn(s, "playerCharacter")) s.playerCharacter = "warden"; if (!Object.hasOwn(s, "playerLoadout")) s.playerLoadout = null; if (s.playerLoadout?.primary === "interposition" && s.playerLoadout?.secondary === "strategic_commitment") s.playerLoadout = { ...s.playerLoadout, primary: "solfeggio" }; return { ok: true, state: s }; } return fail("Unsupported or invalid campaign save."); }
    catch { return fail("Campaign save is not valid JSON."); }
  }
  function setPlayerCharacter(state, character) {
    if (!validState(state) || state.status !== "active") return fail("No active campaign.");
    if (typeof character !== "string" || !character.trim()) return fail("Choose a player character.");
    if (state.records.length && character !== (state.playerCharacter || "warden")) return fail("Your character is fixed once the campaign begins.");
    const s = clone(state); s.playerCharacter = character; return { ok: true, state: s };
  }
  function setPlayerLoadout(state, loadout) {
    if (!validState(state) || state.status !== "active") return fail("No active campaign.");
    if (!state.playerCharacter) return fail("Choose your character before setting concepts.");
    const primary = loadout?.primary, secondary = loadout?.secondary || null;
    if (typeof primary !== "string" || !primary.trim() || (secondary !== null && typeof secondary !== "string") || secondary === primary)
      return fail("Choose a primary concept and a different secondary concept.");
    const s = clone(state); s.playerLoadout = { primary, secondary }; return { ok: true, state: s };
  }
  function setStance(state, stance) {
    if (!validState(state) || state.status !== "active") return fail("No active campaign.");
    if (!STANCES[state.current.scene].includes(stance)) return fail(`Unknown stance for ${state.current.scene}.`);
    const s = clone(state); s.current.stance = stance; return { ok: true, state: s };
  }
  function setInterval(state, interval) {
    if (!validState(state) || state.status !== "active" || !INTERVALS.includes(interval)) return fail("Choose a valid interval in an active campaign.");
    if (state.current.interval === interval && state.current.setup) return { ok: true, state: clone(state), setup: clone(state.current.setup) };
    const s = clone(state);
    const baseLF = s.current.baseLF ?? s.playerLF;
    const heal = interval === "long" ? 100 : interval === "short" ? Math.min(100, baseLF + 25) : baseLF;
    const enemyOpeningAP = interval === "long" ? 125 : interval === "short" ? 100 : 75;
    s.current.interval = interval;
    s.current.setup = { playerLF: heal, enemyOpeningAP, subsequentAP: 100,
      gearWear: true, gearRepair: false, scientistArrivesEarly: interval === "rush", preparedHearing: interval === "long" };
    s.playerLF = heal;
    return { ok: true, state: s, setup: clone(s.current.setup) };
  }
  function normalizeEvidence(evidence = {}) {
    const allowed = new Set(["intact", "broken", "unvisited"]);
    const out = { receptacle: evidence.receptacle || "unvisited", robotLog: evidence.robotLog || "unvisited" };
    if (!Object.values(out).every(v => allowed.has(v))) throw new Error("Evidence state must be intact, broken or unvisited.");
    return out;
  }
  function finishScene(state, result) {
    if (!validState(state) || state.status !== "active") return fail("No active campaign.");
    if ((state.current.scene !== "lastVerdict" && !state.current.stance) || !state.current.interval) return fail("Choose a stance where offered and an interval before recording the scene.");
    if (!result || !Number.isFinite(result.playerLF) || result.playerLF < 0 || result.playerLF > 100) return fail("Scene result needs player LF from 0 to 100.");
    const scene = state.current.scene, s = clone(state), stopped = [...new Set(result.stopped || [])];
    const evidence = scene === "quietHouse" ? normalizeEvidence(result.evidence) : null;
    const playerStopped = result.playerStopped ?? result.playerLF <= 0;
    const record = { scene, stance: s.current.stance, interval: s.current.interval, playerCharacter: s.playerCharacter, playerLoadout: s.playerLoadout ? clone(s.playerLoadout) : null, playerLF: result.playerLF,
      playerStopped: !!playerStopped, stopped, allyStopped: result.allyStopped || null, evidence,
      recognition: result.recognition || s.recognition, reward: result.reward || null, result: result.result || (playerStopped ? "loss" : "progress") };
    s.records.push(record); s.current.completed = true; s.playerLF = result.playerLF;
    if (scene === "quietHouse") {
      const maidClaim = s.current.stance === "accuseMaid" && evidence.receptacle === "intact";
      const robotClaim = s.current.stance === "accuseRobot" && evidence.robotLog === "intact";
      const officerFiled = s.current.stance === "standWithOfficer" && !playerStopped && !record.allyStopped && (evidence.receptacle === "intact" || evidence.robotLog === "intact");
      const heldProof = s.current.stance === "devilsAdvocate" && !playerStopped && (evidence.receptacle === "intact" || evidence.robotLog === "intact");
      s.houseCase = { maidClaim, robotClaim, officerFiled, heldProof, officerPresent: s.current.stance === "standWithOfficer" && !playerStopped && !record.allyStopped,
        maidStopped: stopped.includes("maid"), robotStopped: stopped.includes("agi"), evidence: clone(evidence) };
      s.recognition = officerFiled ? "recognized" : heldProof ? "unrecognized" : "unresolved";
    } else if (scene === "courtyard") {
      s.hearingCase = { stance: record.stance, presidentStopped: stopped.includes("president"), scientistStopped: stopped.includes("scientist"),
        soldierStopped: stopped.includes("soldier"), recognition: record.recognition, allyStopped: record.allyStopped || null };
      if (playerStopped) s.recognition = "unrecognized";
      else if (s.hearingCase.presidentStopped) s.recognition = "revoked";
      else if (record.stance === "devilsAdvocate" && !playerStopped) s.recognition = "unrecognized";
    }
    if (scene === "lastVerdict") { const lost = result.result === "enemy" || (playerStopped && result.result !== "player"); s.status = lost ? "lost" : "won"; s.current.result = lost ? "loss" : "win"; record.result = lost ? "loss" : "win"; return { ok: true, state: s, next: null, record }; }
    s.sceneIndex += 1; s.current = { scene: SCENES[s.sceneIndex], stance: null, interval: null, baseLF: s.playerLF, setup: null, completed: false };
    return { ok: true, state: s, next: s.current.scene, record };
  }
  function verdictFor(state) {
    if (!validState(state) || !state.hearingCase) return null;
    if (state.hearingCase.scientistStopped || (state.records.some(r => r.scene === "courtyard" && r.interval === "rush" && !state.hearingCase.scientistStopped))) return "insectKaiju";
    if (state.hearingCase.presidentStopped) return "dragon";
    return "redOni";
  }

  const HEARING_TRANSFER = {
    id: "tr-courtyard-soldier-tile",
    question: "The Soldier took the tile in front of the President. Which deliveries did that tile change, and which could still arrive from another side?",
    choices: [
      { id: "line-and-route", text: "A line crossing the Soldier can be intercepted; a routed delivery may go around if another path is open.", correct: true,
        feedback: "Right. Interception depends on the delivery path. A blocked tile stops a crossing line, while an alternate open route can still carry a routed technique." },
      { id: "all-blocked", text: "Every delivery to the President is blocked until the Soldier moves.", correct: false,
        feedback: "The Soldier does not seal every route. Check whether the delivery must cross that tile or can follow another open path." },
      { id: "target-only", text: "The Soldier only changes attacks that target him; the President's tile is unaffected.", correct: false,
        feedback: "Position can change delivery even when the Soldier is not the named target. A line or route may encounter an intervening unit." },
    ],
    rubric: { correctness: "Distinguishes an intercepted crossing line from a routed delivery with an alternate path", boundary: "Recognizes that an open route around the Soldier can still reach the President" },
  };

  function courtyardOutcome(state, result = {}) {
    if (!validState(state) || state.current.scene !== "courtyard") throw new Error("Courtyard outcome needs an active Hearing state.");
    const stance = state.current.stance, interval = state.current.interval;
    if (!stance || !interval) throw new Error("Choose the Hearing stance and interval before resolving its outcome.");
    const stopped = new Set(result.stopped || []), lost = !!result.playerStopped;
    const presidentStopped = stopped.has("president"), scientistStopped = stopped.has("scientist");
    const proofIntact = !!result.benchIntact, ownsNotebook = !!result.ownsFieldNotebook;
    let text = "The courtyard closes. The house's record, its witness, and the people still willing to speak travel with you.";
    let reward = null, recognition = null;
    if (lost) {
      if (interval === "rush" && stance === "readWithScientist") text = "The reading never finishes. The Scientist leaves. You lost the meeting a rest would have missed.";
      else if (interval === "rush" && stance === "accuseScientist") text = "The Scientist's name is clear. You lost the early reading, and the hearing will open without it.";
      else if (interval === "rush" && stance === "devilsAdvocate") text = "The Soldier comes out to a courtyard that has already decided. You lost the Scientist, and you lost any claim to the bench.";
      else if (stance === "standWithRecord") text = "The hearing accepts the other account. You lost the house's record.";
      else if (stance === "challengeOffice") text = "The President stays in office. You lost the challenge. Their permissions stand.";
      else text = "No one from the courtyard will speak for you. You lost its recognition.";
      if (interval === "long") text += " They had already set the room.";
      text += " The hearing's version stands; you are unrecognized from here on.";
      recognition = "unrecognized";
    } else if (stance === "devilsAdvocate") {
      text = "You won the courtyard, and no one in it will speak for you. You lost its voice.";
      recognition = "unrecognized";
    } else if (presidentStopped && proofIntact && interval !== "rush") {
      text = "The President is stopped before the evidence bench. The office's claim fails in public; its permissions are revoked.";
      reward = "surveyFlag"; recognition = "revoked";
    } else if (stance === "standWithRecord" && result.recognized && !presidentStopped) {
      text = "The record is recognized, and the accord holds for the next scene.";
      reward = ownsNotebook ? null : "fieldNotebook"; recognition = "recognized";
    } else if (presidentStopped) {
      text = proofIntact ? "The President is stopped, and the surviving bench makes the office answer for the record." : "The President is stopped, but the evidence bench is broken. The office loses the room; the evidence cannot support a public claim.";
      recognition = proofIntact ? "revoked" : "unrecognized";
    } else if (result.recognized) {
      text = "The hearing accepts the surviving record. Its recognition carries into the final verdict.";
      recognition = "recognized";
    }
    return { text, reward, recognition, transfer: clone(HEARING_TRANSFER), proofIntact, presidentStopped, scientistStopped, lost };
  }

  // House board follows the story's 13×9 annotated layout. Story props are
  // tagged so the scene adapter can persist damage as case evidence.
  function quietHouseArena(stance, playerCharacter = "warden") {
    if (!STANCES.quietHouse.includes(stance)) throw new Error("Choose a Quiet House stance.");
    let roomMap = ["#############", "#.....#.....#", "#.....#.....#", "#.....#.....#", "###.#####.###", "#.....#.....#", "#...........#", "#...........#", "#####...#####"];
    const height = ["0000000000000", "0000000000000", "0000000000000", "0000000000000", "0000000000000", "0000000000000", "0000000000000", "0000000000000", "0000000000000"];
    const objects = [
      { id: "house-receptacle", type: "bench", x: 9, y: 6, name: "Service receptacle", role: "evidence:receptacle", hp: 10, maxHp: 10, evidenceId: "receptacle", blocksMove: true, cover: 0.5, material: "wood", stored: [] },
      { id: "house-robot-log", type: "log", x: stance === "accuseRobot" ? 4 : 9, y: stance === "accuseRobot" ? 1 : 1, name: "Robot log", role: "evidence:robotLog", hp: 10, maxHp: 10, evidenceId: "robotLog", blocksMove: true, cover: 0.5, material: "wood" },
      { id: "house-window", type: "fence", x: 1, y: 3, name: "Window", blocksMove: true, sightHeight: 0, cover: 0 },
    ].filter(o => !(stance === "accuseMaid" && o.evidenceId === "robotLog") && !(stance === "accuseRobot" && o.evidenceId === "receptacle") && !(stance === "accuseMaid" && o.id === "house-window"));
    let positions = { player: [6, 8], maid: [9, 5], agi: [3, 2], policeOfficer: [3, 7] };
    if (stance === "accuseMaid") { positions = { ...positions, player: [8, 6] }; roomMap = roomMap.map((row,y) => Array.from(row, (tile,x) => (x >= 7 && x <= 11 && y >= 4 && y <= 7) ? (tile === "#" ? "#" : ".") : "#").join("")); }
    if (stance === "accuseRobot") { positions = { ...positions, player: [4, 3] }; roomMap = roomMap.map((row,y) => Array.from(row, (tile,x) => (x >= 1 && x <= 5 && y >= 1 && y <= 3) ? (tile === "#" ? "#" : ".") : "#").join("")); }
    const roster = stance === "accuseMaid" ? ["player", "maid"] : stance === "accuseRobot" ? ["player", "agi"]
      : stance === "standWithOfficer" ? ["player", "policeOfficer", "maid", "agi"] : ["player", "policeOfficer", "maid", "agi"];
    const participants = roster.map(id => ({ id, character: id === "player" ? playerCharacter : id, side: id === "player" || (stance === "standWithOfficer" && id === "policeOfficer") ? "player" : "enemy", at: positions[id] }));
    return { arenaData: { name: "The Quiet House", map: roomMap, height, objects }, participants,
      restrictTo: stance === "accuseMaid" ? "maidRoom" : stance === "accuseRobot" ? "study" : "wholeHouse",
      unavailableEvidence: stance === "accuseMaid" ? ["robotLog"] : stance === "accuseRobot" ? ["receptacle"] : [] };
  }

  // Courtyard cast and board are resolved from the saved house record.
  function courtyardArena(state, stance) {
    if (!validState(state) || state.current.scene !== "courtyard" || !state.current.interval)
      throw new Error("Choose the Courtyard interval before building its arena.");
    if (!STANCES.courtyard.includes(stance)) throw new Error("Choose a Courtyard stance.");
    const interval = state.current.interval, rush = interval === "rush", house = state.houseCase || {};
    const robotStopped = !!house.robotStopped, maidStopped = !!house.maidStopped;
    const officerAvailable = !!house.officerPresent && !rush;
    const witness = !robotStopped ? "agi" : !maidStopped ? "maid" : null;
    const proof = house.robotClaim && house.evidence?.robotLog === "intact" ? "Robot log"
      : house.maidClaim && house.evidence?.receptacle === "intact" ? "Service record"
        : house.officerFiled ? "Field notebook" : null;
    const recognized = !!proof && state.recognition !== "unrecognized";
    const map = ["...........", "...........", "...........", "...........", "...........", "...........", "..........."];
    const height = ["00000000000", "00000100000", "00000100000", "00000000000", "00000000000", "00000000000", "00000000000"];
    const objects = [
      ...[3, 4, 5, 6, 7].map(x => ({ id: `courtyard-fence-${x}`, type: "fence", x, y: 0, name: "Courtyard fence", blocksMove: true, sightHeight: 0, cover: 0 })),
      { id: "courtyard-bollard-west", type: "bollard", x: 1, y: 1, name: "Stone bollard", blocksMove: true, hp: 20, maxHp: 20, cover: 0.25 },
      { id: "courtyard-bollard-east", type: "bollard", x: 9, y: 1, name: "Stone bollard", blocksMove: true, hp: 20, maxHp: 20, cover: 0.25 },
      { id: "courtyard-monument", type: "monument", x: 5, y: 1, name: "Hearing dais", blocksMove: false, hp: 30, maxHp: 30, cover: 0 },
      { id: "courtyard-evidence", type: "bench", x: 5, y: 4, name: proof ? `Evidence bench · ${proof}` : "Evidence bench · empty", role: "evidence:hearing", hp: 12, maxHp: 12, evidence: proof, recognized, blocksMove: true, cover: 0.5, material: "wood" },
    ];
    const initialBarriers = interval === "long" ? [{ id: "courtyard-prepared-shield-wall", owner: "president", x: 5, y: 5,
      protection: 20, duration: 2, expiresAt: 3, concept: "barrier" }] : [];
    const positions = { player: [5, 6], president: [5, 1], soldier: [5, 2], policeOfficer: [3, 5], agi: [4, 4], maid: [6, 4], scientist: [5, 4] };
    const specs = new Map();
    const add = (id, character, side, at = positions[id], extra = {}) => specs.set(id, { id, character, side, at, ...extra });
    add("player", state.playerCharacter || "warden", "player");

    if (rush) {
      if (stance === "readWithScientist") {
        add("scientist", "scientist", "player");
        if (!robotStopped) add("agi", "agi", "enemy");
        else add("soldier", "soldier", "enemy");
      } else if (stance === "accuseScientist") add("scientist", "scientist", "enemy");
      else {
        add("scientist", "scientist", "enemy");
        add("soldier", "soldier", "enemy", [5, 5], { arrivesRound: 2 });
      }
    } else {
      if (stance === "standWithRecord") {
        add("president", "president", "player");
        if (officerAvailable) add("policeOfficer", "policeOfficer", "player");
        add(witness || "soldier", witness || "soldier", "enemy");
      } else if (stance === "challengeOffice") {
        add("president", "president", "enemy"); add("soldier", "soldier", "enemy");
        if (officerAvailable) add("policeOfficer", "policeOfficer", "player");
      } else {
        add("president", "president", "enemy"); add("soldier", "soldier", "enemy");
        if (witness) add(witness, witness, "enemy");
        if (officerAvailable) add("policeOfficer", "policeOfficer", "enemy");
      }
    }
    const participants = [...specs.values()];
    const openingTempo = {};
    const firstEnemyTempo = rush ? 75 : interval === "long" ? 125 : 100;
    for (const p of participants) if (p.side === "enemy") openingTempo[p.id] = firstEnemyTempo;
    const arenaData = { name: "The Courtyard Hearing", map, height, objects, initialBarriers };
    return { arenaData, participants, openingTempo, proof, recognized, calledWitness: witness,
      transfer: clone(HEARING_TRANSFER), transferQuestion: HEARING_TRANSFER.question };
  }

  return { SCHEMA, CAMPAIGN, SCENES, STANCES, INTERVALS, HEARING_TRANSFER, create, validState, serialize, deserialize, randomBuild, setPlayerCharacter, setPlayerLoadout, setStance, setInterval, finishScene, verdictFor, courtyardOutcome, quietHouseArena, courtyardArena };
});
