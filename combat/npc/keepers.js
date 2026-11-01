"use strict";
// NPC keepers: the registry (plain data). Spec: ~/loci-orbit/ready-to-review/claude-npc-faces-spec/specs/NPC_FACES.md sections 1 to 3,
// 7 and 13. Mala, 2026-10-30: "all of the windows need NPC faces and dialogue" (decision doc D1 to D12 approved at the recommendations).
//
// Slice S0 (this file's first landing): the whole registry and the WINDOWS table exist as data, but only Rama at the Town Hall is
// wired (`wired: true`). A later slice sets `wired`, gives the keeper a `lines` key into keeper-lines.js and mounts the window.
// Art rules (spec section 13): a keeper whose faces are not on disk says so here (`status: "staged"` or `"missing"`) and no PNG path
// is built for it; sprite-manifest.js is generated and never hand-edited.
//
//   KEEPERS[id]      name, role, windows[], art { status, folder, pattern, map, fallback }, voice, lines, hook, perk, wired, slice
//   WINDOWS[id]      keeper (id | "contextual" | "served" | null), exempt (false | reason), fns[] (the ui.js/app.js functions that
//                    open it; tests/npc-windows.test.mjs fails when a new `show*` function is in none of these), at, slice
//   artPath(id, face) → "combat/sprites/<folder>/<file>" for a live face, else null (never another unit's face)
//   idlePath(id)      → the keeper's own idle.png (square crop fallback), else null
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatKeepers = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const FACES = ["neutral", "happy", "angry", "sad", "surprised"];
  const same = Object.fromEntries(FACES.map((f) => [f, f]));
  const std = (folder, pattern = "face-{x}.png", map = same) => ({ status: "live", folder, pattern, map, fallback: "idle" });
  // KEEPER_PERKS: Seeds perks P1 to P4 (spec section 7.2). OFF (decision D4); nothing reads it in S0 and no perk code exists yet.
  const KEEPER_PERKS = false;
  const STREAK_WINS = 3;     // a run of wins that earns the `streak` line (a code constant: the count is never in a line)
  const BIG_SPEND = 150;     // Seeds spent on the previous visit that earn the `big` line (builder's pick; nothing spends at the Town Hall)
  const IDLE_MS = 25000;     // one idle line, once per entry, after this long without input

  const KEEPERS = {
    arantxa: { name: "Arantxa", role: "Narrator", windows: ["homeHero", "practiceYard", "quietHouse", "classicMenu", "battleOver", "narratorWindow"], art: { status: "missing", folder: "arantxa", pattern: null, map: {}, fallback: "idle" }, voice: "dry, warm, watchful", lines: null, hook: "H01", perk: null, wired: false, slice: "S4" },
    rama: { name: "Rama", role: "Town Hall", windows: ["townHall"], art: std("rama"), voice: "calm, formal, fair", lines: "rama", hook: "H02", perk: null, wired: true, slice: "S0",
      rematch: ["firstWall", "gapCourt", "rosterScrimmage", "warfare", "bossRush"] },   // the public Town Hall encounters a loss is remembered for (the secret ones never are)
    sita: { name: "Sita", role: "Home", windows: ["home"], art: std("sita"), voice: "gentle, practical", lines: null, hook: "H03", perk: null, wired: false, slice: "S1" },
    jatayu: { name: "Jatayu", role: "The Archive", windows: ["archive", "bestiary", "traitWeb", "studioRoster", "studioSheet", "crewWall", "artLibrary"], art: std("jatayu"), voice: "old, exact, patient", lines: null, hook: "H04", perk: null, wired: false, slice: "S1" },
    tallyman: { name: "The Tallyman", role: "Ledger House", windows: ["ledgerHouse"], art: std("neo-warden-tallyman", "portrait-{x}.png"), voice: "courteous, exact, a little grim", lines: null, hook: "H05", perk: null, wired: false, slice: "S1", counters: { shop: "pioneer", gear: "smith", kiln: "talisman", stall: "kaikeyi" } },
    pioneer: { name: "Pioneer", role: "Field shop", windows: ["ledgerHouse"], art: std("pioneer"), voice: "cheerful, practical", lines: null, hook: "H06", perk: "P1", wired: false, slice: "S3" },
    smith: { name: "The Smith", role: "Gear and repair", windows: ["ledgerHouse"], art: { status: "staged", folder: null, stagedFolder: "blacksmith-review", pattern: null, map: {}, fallback: null }, voice: "terse, proud of the work", lines: null, hook: "H07", perk: "P2", wired: false, slice: "S5" },   // placeholder name (D6); staged art, landed by the Cutter
    talisman: { name: "The Talisman", role: "Kiln", windows: ["ledgerHouse"], art: std("talisman", "portrait-{x}.png"), voice: "patient, exact", lines: null, hook: "H08", perk: null, wired: false, slice: "S3" },
    kaikeyi: { name: "Kaikeyi", role: "The Stall", windows: ["ledgerHouse"], art: std("kaikeyi", "portrait-{x}.png"), voice: "shrewd, cordial", lines: null, hook: "H09", perk: null, wired: false, slice: "S3" },
    ravana: { name: "Ravana", role: "Threat leaderboard", windows: ["threatBoard"], art: std("ravana"), voice: "boastful, never cruel", lines: null, hook: "H11", perk: null, wired: false, slice: "S2" },
    hermes: { name: "Hermes", role: "Contract Board", windows: ["contractBoard"], art: std("hermes", "portrait-{x}.png"), voice: "quick, wry", lines: null, hook: "H10", perk: null, wired: false, slice: "S2" },
    jambavan: { name: "Jambavan", role: "Hiring Hall", windows: ["hiringHall"], art: std("jambavan"), voice: "gruff, fatherly", lines: null, hook: "H12", perk: "P3", wired: false, slice: "S1" },
    magistrate: { name: "The Magistrate", role: "The Codex", windows: ["codex"], art: { status: "live", folder: "magistrate", pattern: "heads/{x}.png", map: { neutral: "neutral", happy: "smile", angry: "angry", sad: "hurt", surprised: "focused", tired: "tired" }, fallback: "idle" }, voice: "formal, dry", lines: null, hook: "H13", perk: null, wired: false, slice: "S4" },   // six non-standard heads, mapped (D7); a true surprised head is art request A3
    freemason: { name: "The Freemason", role: "Scribing desk", windows: ["scribingDesk"], art: { status: "live", folder: "freemason", pattern: "face-{x}.png", map: { neutral: "neutral", happy: "amused", angry: "angry", sad: "tired", surprised: "thinking", speaking: "speaking" }, fallback: "idle" }, voice: "measured, craftsmanlike", lines: null, hook: "H14", perk: null, wired: false, slice: "S4" },   // seven non-standard faces, mapped (D7); a true surprised face is art request A4
    madScientist: { name: "The Mad Scientist", role: "The Lab", windows: ["lab", "townWalk"], art: { status: "staged", folder: null, stagedFolder: "mad-scientist-review", pattern: null, map: {}, fallback: null }, voice: "delighted, cross, exact", lines: null, hook: "H15", perk: "P4", wired: false, slice: "S5" },
    starfarer: { name: "The Starfarer", role: "Workshop", windows: ["workshop"], art: std("starfarer"), voice: "far-seeing, unhurried", lines: null, hook: "H16", perk: null, wired: false, slice: "S4" },
    lakshmana: { name: "Lakshmana", role: "School", windows: ["school"], art: std("lakshmana"), voice: "earnest, strict, fair", lines: null, hook: "H17", perk: null, wired: false, slice: "S2" },
    gambler: { name: "The Gambler", role: "Town square", windows: ["square", "proposeStakes", "sweatIt"], art: std("gambler", "portrait-{x}.png"), voice: "easy, risky, friendly", lines: null, hook: "H18", perk: null, wired: false, slice: "S2" },
  };

  const w = (keeper, at, fns, slice, exempt = false) => ({ keeper, exempt, fns, at, slice });
  // All 40 rows of spec section 1. `served`: a face and dialogue already stand there (windows 28, 37, 38 via Arantxa's narrator, 40).
  const WINDOWS = {
    homeHero: w("arantxa", "app.js:96", ["renderDuels"], "S4"), practiceYard: w("arantxa", "app.js:126", ["renderDuels"], "S4"),
    walkLibrary: w(null, "app.js:57", ["renderLibrary"], null, "Explainer Library content, not the Loci game"),
    quietHouse: w("arantxa", "app.js:262", ["campaignBoard"], "S4"),
    townWalk: w("madScientist", "ui.js:1074", ["showTown"], "S5"),
    townHall: w("rama", "ui.js:1181", ["showSetup"], "S0"),
    home: w("sita", "ui.js:1236", ["showSetup"], "S1"), archive: w("jatayu", "ui.js:1255", ["showSetup"], "S1"),
    bestiary: w("jatayu", "ui.js:1374", ["showBestiary"], "S1"), traitWeb: w("jatayu", "ui.js:1573", ["showTraitWeb"], "S1"),
    studioRoster: w("jatayu", "ui.js:1903", ["showStudio"], "S1"), studioSheet: w("jatayu", "ui.js:1938", ["showStudio"], "S1"),
    crewWall: w("jatayu", "ui.js:1854", ["showStudio"], "S1"), artLibrary: w("jatayu", "ui.js:1801", ["showStudio"], "S1"),
    ledgerHouse: w("tallyman", "ui.js:1681", ["showAccount"], "S1"),
    threatBoard: w("ravana", "ui.js:1234", ["showSetup"], "S2"), contractBoard: w("hermes", "ui.js:1083", ["showBoard"], "S2"),
    hiringHall: w("jambavan", "ui.js:1100", ["showHall"], "S1"), codex: w("magistrate", "ui.js:1119", ["showCodex"], "S4"),
    scribingDesk: w("freemason", "ui.js:1128", [], "S4"), lab: w("madScientist", "ui.js:1157", ["showLab"], "S5"),
    workshop: w("starfarer", "ui.js:1386", ["showWorkshop", "showWorkshopHub"], "S4"), school: w("lakshmana", "ui.js:1514", ["showSchool"], "S2"),
    square: w("gambler", "ui.js:1551", ["showBusk"], "S2"), classicMenu: w("arantxa", "ui.js:1181", ["showSetup"], "S4"),
    battleSidePanel: w(null, "ui.js:673", [], null, "control surface: owns the Dialogue toggle, no keeper"),
    teachCard: w("contextual", "ui.js:2653", ["showTeachCard"], "S6"), mindDuel: w("served", "ui.js:4450", [], null, "already served: portraitMarkup"),
    multitudes: w("contextual", "ui.js:4692", ["showMultitudesCard"], "S6"), audition: w("contextual", "ui.js:4703", ["showAuditionCard"], "S6"),
    proposeStakes: w("gambler", "ui.js:4760", ["showStakesCard"], "S6"), sweatIt: w("gambler", "ui.js:4800", ["showStakeCard"], "S6"),
    vowCard: w("contextual", "ui.js:4819", ["showVowCard"], "S6"),
    communeQuestion: w("contextual", "ui.js:4895", ["showCommuneQuestion", "showAwakenQuestion"], "S6"), summonQuestion: w("contextual", "ui.js:4948", ["showSummonQuestion"], "S6"),
    battleOver: w("arantxa", "ui.js:5339", [], "S4"), cutscenePopups: w("served", "ui.js:327", [], null, "already served: faceFile"),
    narratorWindow: w("arantxa", "ui.js:2056", [], "S4"), dispatch: w("chief", "law/dispatch.js:45", [], null, "radio voice only (decision D9)"),
    enemyBubbles: w("served", "ui.js:3883", ["showDialogueFrom"], null, "already served: speakers.js heads"),
  };

  const art = (id) => KEEPERS[id]?.art || null;
  // A live keeper's face file for an expression, or null (staged, missing, or an expression the sheet lacks). Never a guess.
  function artPath(id, face) {
    const a = art(id);
    if (!a || a.status !== "live" || !a.folder || !a.pattern) return null;
    const file = a.map[face];
    return file ? `combat/sprites/${a.folder}/${a.pattern.replace("{x}", file)}` : null;
  }
  const idlePath = (id) => { const a = art(id); return a && a.folder && a.fallback === "idle" ? `combat/sprites/${a.folder}/idle.png` : null; };
  const keeperFor = (windowId) => { const row = WINDOWS[windowId], k = row && KEEPERS[row.keeper]; return k ? { id: row.keeper, ...k } : null; };

  return { FACES, KEEPERS, WINDOWS, KEEPER_PERKS, STREAK_WINS, BIG_SPEND, IDLE_MS, artPath, idlePath, keeperFor };
});
