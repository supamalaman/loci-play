"use strict";
// Deterministic setup contract for the terminal vignette. Battle execution is
// intentionally separate so each objective can be tested independently.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatVerdict = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const maps = {
    dragon: ["..FFFFFFF..", ".B.......B.", "....DD.....", "....DD.....", "...........", "...........", "...........", "...........", "..........."],
    oni: ["..FFFFFFF..", "...........", "....OO.....", "....OO.....", ".....P.....", ".....S.....", "...........", "..........."],
    kaiju: ["###########", "#.........#", "#.KK......#", "#.KK.....S#", "#.....N...#", "###.###.###", "#......C..#", "#...Y.A...#", "#####.#####"],
  };
  const transfer = {
    dragon: { id: "tr-verdict-dragon-personhood", question: "The decree calls every person cattle. Which fact about a person does that word fail to change?", choices: [
      { id: "personhood", text: "A label can change how power treats someone; it does not change their personhood or consent.", correct: true, feedback: "Right. The decree changes a political category, not the human beings it describes." },
      { id: "decree-truth", text: "The label becomes biologically true once the office declares it.", correct: false, feedback: "A decree changes rules and treatment; it cannot change the people it labels into another species." },
    ], rubric: { correctness: "Separates an imposed category from a person's status", boundary: "Recognizes the decree's institutional force without treating it as biological transformation" } },
    oni: { id: "tr-verdict-soul-contract", question: "The contract takes a soul in exchange for the office. What does the office still owe if the signer is the only one who agreed?", choices: [
      { id: "consent", text: "It still owes duties to the citizens who never consented to the trade.", correct: true, feedback: "Right. One signer's authority does not create consent for every person affected by the contract." },
      { id: "binding", text: "Nothing; one signature automatically binds every citizen.", correct: false, feedback: "A signature records the signer's act. It does not prove that every citizen authorized the exchange." },
    ], rubric: { correctness: "Identifies obligations to people who did not consent", boundary: "Does not treat representation as universal consent" } },
    kaiju: { id: "tr-verdict-containment-scale", question: "The same insect at another size is a different problem. Which part of the lab's containment was built for the small one?", choices: [
      { id: "scale-boundary", text: "The doorway and barriers constrain the small form; they do not scale up with the organism.", correct: true, feedback: "Right. A boundary only contains bodies within its designed dimensions and strength." },
      { id: "same-containment", text: "The containment stays equally effective because the organism is the same species.", correct: false, feedback: "Species identity does not preserve a barrier's effectiveness when body scale changes." },
    ], rubric: { correctness: "Connects containment dimensions to organism scale", boundary: "Recognizes that a boundary's capacity is finite" } },
  };
  const all = (map, ids, starts, side) => ids.map((id, i) => ({ id, character: id, side, at: starts[i] }));
  const coords = {
    dragon: { player: [4,7], boss: [4,2], soldier: [5,8], actor: [1,7], animalTamer: [7,5], architect: [1,4], maid: [0,7], policeOfficer: [8,7] },
    oni: { player: [5,7], boss: [4,2], president: [5,4], soldier: [5,5], actor: [2,6], architect: [8,6], policeOfficer: [9,7], scientist: [0,5], yogaInstructor: [1,6], maid: [0,7], agi: [10,6] },
    kaiju: { player: [4,7], boss: [2,2], president: [7,7], soldier: [5,8], scientist: [9,3], animalTamer: [6,4], architect: [7,6], policeOfficer: [0,7], maid: [1,7], agi: [1,6] },
  };
  function make(state, interval, playerLF = 100) {
    if (!state?.hearingCase || !Array.isArray(state.records) || state.records.length < 2) throw new Error("Last Verdict needs saved Quiet House and Hearing records.");
    if (!["long", "short", "rush"].includes(interval)) throw new Error("Choose a Last Verdict interval.");
    const branch = state.hearingCase.scientistStopped || (state.records[1].interval === "rush" && !state.hearingCase.scientistStopped) ? "kaiju"
      : state.hearingCase.presidentStopped ? "dragon" : "oni";
    const house = state.houseCase || {}, hearing = state.hearingCase, hearingRecord = state.records[1];
    const refused = hearingRecord.stance === "devilsAdvocate" && hearingRecord.result === "player" && !hearingRecord.playerStopped;
    const maidStopped = !!house.maidStopped, robotStopped = !!house.robotStopped;
    const officerAvailable = !!house.officerPresent && interval !== "rush";
    const C = coords[branch], allies = [], enemies = [];
    const add = (id, side) => (side === "player" ? allies : enemies).push({ id, character: id, side, at: C[id] });
    if (branch === "dragon") {
      add("soldier", hearing.soldierStopped ? null : "enemy");
      add("actor", "enemy"); add("animalTamer", "player"); add("architect", "player");
      if (!maidStopped) add("maid", "player"); if (officerAvailable && !refused) add("policeOfficer", "player");
    } else if (branch === "oni") {
      add("president", "enemy"); add("soldier", hearing.soldierStopped ? null : "enemy"); add("actor", "enemy"); add("architect", "player");
      if (officerAvailable && !refused) add("policeOfficer", "player");
      if (!hearing.scientistStopped && !refused) add("scientist", "player"); else add("yogaInstructor", "player");
      if (!maidStopped) add("maid", "player");
      if (!robotStopped && house.evidence?.robotLog === "intact") add("agi", "player");
    } else {
      if (!hearing.presidentStopped) add("president", "enemy");
      if (!hearing.soldierStopped) add("soldier", hearing.presidentStopped ? (refused ? null : "player") : "enemy");
      if (!hearing.scientistStopped) add("scientist", "player");
      if (!robotStopped) add("agi", "player");
      add("architect", "player"); add("animalTamer", "player");
      if (!maidStopped) add("maid", "player"); if (officerAvailable && !refused) add("policeOfficer", "player");
    }
    const bossLF = { dragon: 400, oni: 330, kaiju: 360 }[branch];
    const start = [{ id: "player", character: state.playerCharacter || "warden", side: "player", at: C.player },
      { id: `boss-${branch}`, character: `boss-${branch}`, boss: branch, side: "enemy", at: C.boss, size: { w: 2, h: 2 }, maxLF: bossLF, startingLF: bossLF },
      ...allies.filter(p => p.side), ...enemies.filter(p => p.side)];
    const opening = interval === "long" ? 125 : interval === "rush" ? 75 : 100;
    const objects = branch === "kaiju" ? [{ id:"verdict-breach-hatch", type:"hatch", x:9, y:4, name:"Containment hatch", role:"vignette-objective", vignetteObjective:true, blocksMove:true, hp:18, maxHp:18, cover:0.5, material:"metal" }] : [
      ...[2,3,4,5,6,7,8].map(x => ({ id: `verdict-fence-${x}`, type: "fence", x, y: 0, name: "Courtyard fence", blocksMove: true, sightHeight: 0, cover: 0 })),
      ...(branch === "dragon" ? [1,9].map(x => ({ id: `verdict-bollard-${x}`, type: "bollard", x, y: 1, name: "Stone bollard", blocksMove: true, hp: 20, maxHp: 20 })) : []),
      { id: `verdict-${branch}-dais`, type: "monument", x: 4, y: 2, name: branch === "dragon" ? "Election dais" : "Contract dais", role:"vignette-objective", vignetteObjective:true, blocksMove: false, hp: 30, maxHp: 30, cover: 0 },
    ];
    const arenaData = { name: `The Last Verdict · ${branch}`, map: maps[branch].map(row => Array.from(row, c => c === "#" ? "#" : ".").join("")),
      height: maps[branch].map(row => Array.from(row, c => c === "D" || c === "O" ? 1 : 0)), objects };
    const branchData = {
      dragon: { name: "The Cattle Election", boss: "dragon", objective: { kind: "holdTerritory", label: "Decree takes hold", tile: [4,2], turns: 3 }, longStart: { territoryActive: true, decreeProgress: 1 }, playerWin: { kind: "defeatBoss" }, loss: "The decree is posted. The pen holds. You lost the word person.", win: "The election fails. The gate opens. They leave as people." },
      oni: { name: "The Soul Trade", boss: "oni", objective: { kind: "completeContract", label: "Soul contract is sealed", tile: [5,4], turns: 3 }, longStart: { contractMarked: true, contractProgress: 1 }, playerWin: { kind: "defeatBoss" }, loss: "The signature holds. The city is the price. You lost their souls.", win: "The contract fails. The office keeps no one it sold." },
      kaiju: { name: "The Open Laboratory", boss: "kaiju", objective: { kind: "escapeThrough", label: "Brood reaches the breach", tile: [9,4], turns: 4 }, longStart: { broodOnFloor: true, breachOpen: true }, playerWin: { kind: "defeatBoss" }, loss: "The wing is open. The brood is in the street. You lost the laboratory's door.", win: "The wing holds. The thing they made is stopped. The record of who made it stays." },
    }[branch];
    const preparation = interval === "long" ? { progress: 1, text: "You are whole. They have already started. You lost the hour it was still small." }
      : interval === "rush" ? { progress: 0, text: "You are still hurt. You arrive before the first move is finished. You lost the rest." }
        : { progress: 0, text: "You are partly mended. You arrive as the verdict left it. The clock took no one, and it brought no one." };
    return { branch, name: branchData.name, boss: branchData.boss, participants: start, arenaData, openingTempo: Object.fromEntries(start.filter(p => p.side === "enemy").map(p => [p.id, opening])),
      playerStartingLF: playerLF, preparation: { ...preparation, longStart: interval === "long" ? branchData.longStart : null }, enemyObjective: branchData.objective, playerObjective: branchData.playerWin,
      objective: branchData.objective, objectiveProgress: interval === "long" ? (branchData.longStart.decreeProgress || branchData.longStart.contractProgress || 1) : 0,
      outcomeText: { win: branchData.win, loss: branchData.loss }, transfer: transfer[branch], refused, proof: state.houseCase?.evidence || null };
  }
  return { make, maps, transfer };
});
