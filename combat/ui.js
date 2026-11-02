"use strict";
// Concept Combat UI: renders engine state and turns clicks/keys into engine actions.
// Holds no rules of its own: legality, previews and outcomes all come from the engine.
//
//   const ui = ConceptCombatUI.mount(hostEl, { onExit, params });   ui.destroy();
(function (root) {
  const C = root.ConceptCombatContent;
  const FX = root.ConceptCombatFX;
  const FXS = root.ConceptCombatFXSprites;
  const TEACH = root.ConceptCombatTeach;   // Teach mode: Wisdom and Inquiry cards (teach/teach.js)
  const SG = root.ConceptCombatSage;   // Hatsu Sage casting (castings/sage.js; AP-01 wired: demo bout + declarations)
  const CM = root.ConceptCombatCommunion, PF = root.ConceptCombatPlantFacts, TRP = root.ConceptCombatTraps, IM = root.ConceptCombatImitation, TK = root.ConceptCombatTsukumogami;
  const GB = root.ConceptCombatGaiaBond;
  const D = root.ConceptCombatTerrain, G = root.ConceptCombatMapgen, V = root.ConceptCombatVegetationRules, S = root.ConceptCombatStructures;
  const W = root.ConceptCombatWild, PK = root.ConceptCombatPickups, MD = root.ConceptCombatModes;
  const RO = root.ConceptCombatRoles;   // classes/roles.js: attack, support / defense or specialist, read off a loadout's abilities
  const A = root.ConceptCombatAccount, Loot = root.ConceptCombatLoot, Cook = root.ConceptCombatCooking, CS = root.ConceptCombatCommandSearch; const Board = root.ConceptCombatBoard; const Tracks = root.ConceptCombatTracks; const Ceremony = root.ConceptCombatCeremony; const JStates = root.ConceptCombatJinkiStates;
  const CardsUI = root.ConceptCombatCardsUI, Cardbook = root.ConceptCombatCardbook;   // Battle Cards: the Field Kit "Battle deck" group (C0) and the battle Cards drawer (C1)
  const AN = root.ConceptCombatAnte || null;   // W1.5: ante stakes math (account/ante.js)
  const PR = root.ConceptCombatPresence || null;   // W2.1: the zero-blow path (vows/presence.js)
  const DB = root.ConceptCombatDebt || null;   // W2.2: borrow from the future (vows/debt.js)
  const SL = root.ConceptCombatSealing || null;   // W2.3: bind foes into vessels; inheritances last the battle (vows/sealing.js)
  const KR = root.ConceptCombatCrafting || null;   // vessel economy: kiln crafting (account/crafting.js)
  const MK = root.ConceptCombatMarket || null;   // vessel economy: stall marketing (account/market.js)
  const PY = root.ConceptCombatParley || null;   // haggle chance rides persuasion (ruling 3)
  const WS = root.ConceptCombatWorkshopTraversal || null, GD = root.ConceptCombatGraphData || null;   // W6.1: Workshop tree
  const SCR = root.ConceptCombatWorkshopScreen || null;   // W7.1: rings + readings
  const VV = root.ConceptCombatWorkshopValence || null;   // W6.4: distance prices
  const SCH = root.ConceptCombatWorkshopSchools || null;   // W8.1/8.4/8.5: schools, doors, gates (workshop/schools.js)
  const WH = root.ConceptCombatWorkshopHints || null;   // Workshop clarity: the words of the tree and the landing (workshop/hints.js)
  const PA = root.ConceptCombatWorkshopPairing || null;   // W6.3: the algebra of blends
  const VB = root.ConceptCombatWorkshopVerbs || null;   // verb table (verbs.js) — mint parents
  const VT = root.ConceptCombatVerbTech || null;   // verb techniques, batch 1 (workshop/verbtech.js)
  const TU = root.ConceptCombatWorkshopTutor || null;   // W6.6: paid drills
  const BK = root.ConceptCombatWorkshopBusking || null;   // W6.5: the hat in the square
  const RW = root.ConceptCombatWorkshopRewrite || null;   // W6.2: self-authorship
  const SM = root.ConceptCombatSummons, SQ = root.ConceptCombatSummonQuestions, DS = root.ConceptCombatDreamSpace, AU = root.ConceptCombatAuras;
  const PC = root.ConceptCombatSummonContracts || null;   // summon pacts (summons/contracts.js): the contract book + quizless calls
  const GF = root.ConceptCombatGaiaField;
  const ISO = root.ConceptCombatIsoView || null;   // terrain/iso-view.js: the isometric board, where an arena has a sculpted scene
  const MAPD = root.ConceptCombatMapDressing || null;   // terrain/map-dressing.js: default ground tiles, edge dressing, astral floors (Mala, 2026-10-26)
  const GROUND = root.ConceptCombatGround || null;   // terrain/ground-paint.js: one continuous ground on a flat board whose arena asks for it (ground: "continuous")
  const INS = root.ConceptCombatInsight;
  const MIR = root.ConceptCombatMirror;
  const LLM = root.ConceptCombatLLMDecision;
  const BOSS = root.ConceptCombatBosses;
  const BR = root.ConceptCombatBossRush || null;   // modes/boss-rush.js: the Omega list, each fight's setup, the record
  const TOWN = root.ConceptCombatTown || null;   // town/town.js: the walkable town that opens the menu screens (docs/town-hub.md)
  const SW = root.ConceptCombatSecretWarrior || null;   // modes/secret-warrior.js: the Tallyman's own fight (revealed 2026-10-20)
  const SN = root.ConceptCombatSecretWarriorNext || null;
  const SNL = root.ConceptCombatSealedNext || null;
  const THB = root.ConceptCombatThemedBattles || null;   // modes/themed-battles.js: one Randomize roll in five is a themed lineup
  const SCN = root.ConceptCombatScenarios || null;   // modes/scenarios.js: the Random Encounter chooser (theme, scenario or plain) and the scenario overlay
  const TB = root.ConceptCombatThreatBoard || null;
  const LB = root.ConceptCombatLegacyBattle || null;   // legacy/legacy-battle.js: traditions, the journal, memory, scribing (the Magistrate's Codex)   // threat-board.js: rated table for the leaderboard
  const Crews = root.ConceptCombatSubfactions || null;   // subfaction-index.js: the Index crew wall
  const RE = root.ConceptCombatRandomEvents;
  const Climate = root.ConceptCombatClimate;
  const createInspectorEngine = content => root.ConceptCombat.engine(content, D, G, V, S, W, PK, MD, SM, SQ, DS, Loot?.data, INS, MIR, BOSS, root.ConceptCombatPresident);
  const E = createInspectorEngine(C);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // A revealed summon's true-form traits and unlocked technique, for its status card.
  // Menu entries (Mala, 2026-10-11): the row shows name, cost and ONE line; the full rules live in the rollover, and the
  // rollover is left empty when it would only repeat the row.
  const MENU_BRIEF_MAX = 90;
  function menuBrief(it) {
    const text = String(it.brief || it.why || "").trim(); if (!text) return "";
    const first = it.brief ? text : (text.match(/^.*?[.!?](?=\s|$)/) || [text])[0];
    return first.length > MENU_BRIEF_MAX ? first.slice(0, MENU_BRIEF_MAX - 1).replace(/[\s,;:]+\S*$/, "") + "…" : first;
  }
  // Contact Reading (an MMA Fighter's hold): every action costs the held unit a multiple of its price. Rewrite the
  // prices on that unit's menu to what will really be charged, and say why. "bank N AP" and debt figures are not prices.
  function heldPrices(items, mul) {
    if (!mul || mul === 1) return items;
    const price = (label) => String(label).replace(/(bank (?:up to )?)?(\d+) AP(?! debt)/g, (all, bank, n) => bank ? all : `${Math.round(n * mul)} AP`);
    return items.map((it) => { const label = price(it.label); return label === it.label ? it : { ...it, label, why: `${it.why ? `${it.why} ` : ""}Held: costs ×${mul}.`, heldMul: mul }; });
  }
  // AP where you act (Mala's slice, 2026-10-31): a row that carries a base price in `ap` (or a technique row, whose price is
  // x.m.tempoCost) is greyed with "Needs N AP" when what the engine will charge, price × the Contact Reading hold, is more
  // than the unit's AP now. Only rows with a real cost field are gated; a row whose price is only in its label keeps its own
  // off/why. Damage and field techniques are never gated here: the engine lets them overclock into tempo debt
  // (queries.js `affordable`). Free rows (ap 0 or none), End turn and rows that are already off keep what they have.
  // An opener (opensIfShort) that is off only for want of AP is dimmed instead, and stays openable so the costs inside can be read.
  function apGate(items, tempo, mul = 1) {
    const m = mul || 1;
    return items.map((it) => {
      if (!it || it.fold || it.id === "stall" || it.id === "end") return it;
      const tech = it.x?.m && !["damage", "field"].includes(it.x.m.effect);
      const base = Number.isFinite(it.ap) ? it.ap : tech ? it.x.m.tempoCost : null;
      if (it.opensIfShort && it.off) return { ...it, off: false, dim: true };
      if (it.off || !(base > 0)) return it;
      const price = Math.round(base * m);
      if (price <= tempo) return it;
      const why = `Needs ${price} AP; you have ${tempo}.${m !== 1 ? ` Held: costs ×${m}.` : ""}`;
      return { ...it, off: !it.opensIfShort, dim: !!it.opensIfShort, apShort: price, why, help: `${why} ${it.help || ""}`.trim() };
    });
  }
  // The command panel's own AP readout, beside the commands (the status strip keeps its chip). Pips only when they apply.
  function apHead(p, mul) {
    if (!p) return "";
    return `<span class="cc-ap-head" title="Action points you have now, out of this turn's bar">AP <strong>${p.tempo}</strong> / ${p.tempoCapacity}</span>${mul && mul !== 1 ? `<span class="cc-pip" title="Contact Reading: every action costs this multiple of its AP while you are held.">costs ×${mul}</span>` : ""}${p.tempoDebt ? `<span class="cc-warn">Debt ${p.tempoDebt} AP</span>` : ""}`;
  }
  // Survival Instincts: while the controlled unit lies still, every row but Stand up and End turn is off, with the engine's reason.
  function lyingGate(items, p) {
    if (!p?.status?.playingDead) return items;
    return items.map((it) => it.id === "stall" ? { ...it, label: "End turn · lying still", why: "Ends your turn. A lying unit banks nothing." } : ["standUp", "stall", "end"].includes(it.id) || String(it.id).startsWith("drawer:") ? it : { ...it, off: true, why: "Stand up first (10 AP)." });
  }
  function menuRollover(it) { const full = String(it.help || it.why || "").trim(); return full && full !== menuBrief(it) ? full : ""; }
  // Command bar (Mala, 2026-10-12; docs/command-bar.md): a row shows its name and one figure; every explanation is on
  // hover (the tooltip and the detail panel). menuHelp is the whole text, since nothing is printed under the row now.
  function menuHelp(it) { return String(it.help || it.why || "").trim(); }
  // Drawers: related root rows fold into one "▸" row that opens the existing submenu view. A drawer shows only when
  // something in it applies, and a drawer that would hold a single row shows that row in its place. A drawer is never
  // greyed out, even when every row in it is: opening it is how you read why.
  // The setup screen's test battles, in menu order. Each is a fixed practice lineup built by the engine; nothing in
  // them is saved. The ids are kept from the buttons they replaced (tests start battles by id).
  const TEST_BATTLES = [
    { id: "ccFocusedDreamTest", label: "Tourist", title: "Protect the Tourist: he photographs the garden and sends a postcard if he gets out alive", options: () => E.touristTestOptions() },
    { id: "ccCompressDreamTest", label: "Focused Dream", title: "Full ULT. Open Dream Space, compress it to radius 2 and fight across the sealed edge", options: () => E.focusedDreamTestOptions() },
    { id: "ccEmergentIdeaTest", label: "Summoner", title: "Practice Imagination + Full Believer: two summons, cheaper calls, renewing wards", options: () => E.proficientSummonerTestOptions() },
    { id: "ccMultitudesTest", label: "Contains Multitudes", title: "Full Inspiration and five classes already beaten", options: () => E.multitudesTestOptions() },
    { id: "ccEmbodiedTest", label: "Embodied Concepts", title: "Opt-in: Guard, Dodge, Jump and Observe charge your held concepts' ultimates", options: () => E.embodiedConceptsTestOptions() },
    { id: "ccPerformerTest", label: "Performers", title: "You are the Musician, with a Rapper ally and the Bard nearby", options: () => E.performerTestOptions() },
    { id: "ccArchivistTest", label: "Archivist ally", title: "The Warden with the Archivist beside him, against a Student", options: () => E.archivistTestOptions() },
    { id: "ccTrueFormTest", label: "Mitsuko's true form", title: "Mitsuko starts beside you; open Dream Space to reveal her armored true form", options: () => E.summonTrueFormTestOptions() },
    { id: "ccDevPlayground", label: "DEV playground", title: "Max ULT, 1000 AP, one of every orb and the Gold Form in Gear, and a live punching bag that never fights back", options: () => E.devPlaygroundOptions() },
    { id: "ccStreetBrawl", label: "Street Brawl", title: "Themed battle: street crew against street crew", options: () => E.themedBattleOptions("street", "mma_fighter", "kickboxer", "rapper", "hypebeast", "Street Brawl · themed battle") },
    { id: "ccStageShowdown", label: "Stage Showdown", title: "Themed battle: stage crew against stage crew", options: () => E.themedBattleOptions("stage", "musician", "bard", "actor", "supermodel", "Stage Showdown · themed battle") },
    { id: "ccLabLockdown", label: "Lab Lockdown", title: "Themed battle: lab crew against lab crew", options: () => E.themedBattleOptions("lab", "scientist", "robot_mechanic", "hacker", "defective_machine", "Lab Lockdown · themed battle") },
    { id: "ccWildsClash", label: "Wilds Clash", title: "Themed battle: wilds crew against wilds crew", options: () => E.themedBattleOptions("wilds", "ranger", "animalTamer", "mutant_boar", "boarman", "Wilds Clash · themed battle") },
    { id: "ccMelee", label: "Sub-faction Melee", title: "Four crews, last standing wins: street vs stage vs lab vs wilds", options: () => E.meleeTestOptions() },
    { id: "ccSageDemo", label: "Sage demonstration", title: "Teach mode: the Sage declares turn 0 and demonstrates vow-bound play", teachOnly: true, options: () => SG.demoOptions() },
  ];
  const MENU_DRAWERS = [
    { id: "drawer:move", label: "Move ▸", title: "Move", has: (id) => ["move", "jump", "climb", "disengage", "breakGrapple"].includes(id) || id === "scramble" || id.startsWith("press:") },
    // Rituals (Mala, 2026-10-20): dreams, Palace summons, capture ritual, communes, rites, Contains Multitudes and
    // Become the Integrated Self all ride one tab; the old Dream drawer folded into it.
    { id: "drawer:rituals", label: "Rituals ▸", title: "Rituals", has: (id) => ["dreamSpace", "aura", "wakeDream", "summons", "orderSummonUltimate", "multitudes", "dismissEmbodiment", "becomeGolden", "commune", "communeStructure", "ritual", "ritualHold", "bead", "riteWords", "riteSigils", "riteBlood", "riteDeep", "riteBurial", "riteComplete", "riteAbandon", "riteNote", "tameBeast", "markVessel", "callPack", "palingenesis", "palingenesisBurn", "astralProject", "astralReturn"].includes(id) || id === "mockTrial" || id === "declarePresence" || id.startsWith("declareWard:") || id.startsWith("focusDream:") || id.startsWith("treeant") || id.startsWith("maxChannel") || id.startsWith("riteTog:") },
    { id: "drawer:talk", label: "Talk ▸", title: "Talk", has: (id) => id === "insight" || id === "trial" || id === "stakes" || id.startsWith("accept:") || id.startsWith("decline:") || id.startsWith("terms:") || id.startsWith("convert") || id.startsWith("display:") || id.startsWith("borrow:") || id.startsWith("order:") || id === "repayDebt" || id === "settleVisit" || id === "declareBankruptcy" },
    // Observe is its own tab now; studying a plant stays here, but the commune selection moved to Rituals.
    { id: "drawer:observe", label: "Observe ▸", title: "Observe", has: (id) => ["observe", "investigate", "observeSelf"].includes(id) || id?.startsWith("journal:") || id?.startsWith("finding:") },
    { id: "drawer:scout", label: "Scout ▸", title: "Scout", has: (id) => ["placeTrap", "disarm", "overwatch"].includes(id) || id?.startsWith("catchFish:") },
    { id: "drawer:hand", label: "Hand-To-Hand ▸", title: "Hand-To-Hand", has: (id) => ["guard", "strike"].includes(id) },
    { id: "drawer:rest", label: "Rest ▸", title: "Rest", has: (id) => ["meditate", "recover", "recoverWater", "takeKnee", "playDead", "standUp"].includes(id) },
    { id: "drawer:cards", label: "Cards ▸", title: "Cards", has: (id) => id === "cards" || String(id).startsWith("card:") },   // Battle Cards (C1): shown only while the deck is non-empty (the rows exist only then)
    { id: "drawer:gear", label: "Gear ▸", title: "Gear", has: (id) => id === "releaseForm" || id?.startsWith("enterForm:") || id?.startsWith("vowForm:") || ["items", "cook", "drop", "swap", "resolveTrauma", "breakOrb", "takeFromCart"].includes(id) || id.startsWith("worn:") },
  ];
  const drawerOf = (it) => MENU_DRAWERS.find((d) => d.has(String(it?.id || ""))) || null;
  function foldDrawers(flat) {
    const out = [], seen = new Set();
    for (const it of flat) {
      const d = drawerOf(it); if (!d) { out.push(it); continue; }
      if (seen.has(d.id)) continue; seen.add(d.id);
      const kids = flat.filter((x) => drawerOf(x) === d);
      out.push(kids.length === 1 ? kids[0] : { id: d.id, drawer: true, label: d.label, off: false, help: kids.map((k) => k.label).join(" · ") });   // always opens: a row that cannot be used says why once you can see it
    }
    return out;
  }
  function defensiveResponsePrices(s, defender, options = []) {
    return { guard: 0, take: 0, reach: E.dodgeReach(s, defender.id), dodge: E.dodgeCost(s, defender.id, s.pending?.attacker || null),
      reaction: defender.freeReactionVs === s.pending?.attacker ? "free reaction" : "1 reaction",
      debt: s.order[s.turnIndex] !== defender.id, dodgeAvailable: options.some(o => o.kind === "reposition") };
  }
  function trueFormSummary(a) {
    const form = root.ConceptCombatSummons?.activeForm(a); if (!form) return "";
    const T = form.technique, state = a.summon.technique;
    const traits = (form.traits || []).map(t => `<span title="${esc(t.text)}">${esc(t.name)}</span>`).join(" · ");
    const tech = T ? `<div class="cc-muted" title="${esc(T.text)}">Technique: ${esc(T.name)} · ${state?.cooldown > 0 ? `ready in ${state.cooldown} turn${state.cooldown === 1 ? "" : "s"}` : "ready at its next turn"}</div>` : "";
    return `${traits ? `<div class="cc-muted">Traits: ${traits}</div>` : ""}${tech}`;
  }
  const k = (p) => p[0] + "," + p[1];
  const advertisedReach = (m) => m.area.shape === "radius" ? m.area.radius : m.delivery === "routed" ? m.routeBudget : m.range;
  const PROFILE_KEY = "loci:combat:profile", LAST_KEY = "loci:combat:last", CHAR_KEY = "loci:combat:character";
  const ACCOUNT_KEY = "loci:combat:account:v1";
  const store = {
    get(key, d) { try { return JSON.parse(localStorage.getItem(key)) ?? d; } catch { return d; } },
    set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
  };
  const SPRITE = { warden: "#e9c46a", pathfinder: "#d98bd0", sieve: "#8fb3ff", student: "#8fb3ff",
    earthkeeper: "#b29a70", ranger: "#8db4d4", rain: "#66b7c7", mason: "#c58a69", ecology: "#86c88c",
    planner: "#bc9be8", gardener: "#a8cc75", arantxa: "#e392be", last_span: "#d6c4a0",
    actor: "#e392be", supermodel: "#f2b8cc", agi: "#82d7df", scientist: "#94bde8", "animal-tamer": "#a8cc75", "police-officer": "#84a7e8", magistrate: "#3b5ba9", architect: "#d8b277", soldier: "#d48b72", "yoga-instructor": "#bea0ea", president: "#d8dff0",
    cyph: "#7dc695", maid: "#c9ad8b", general: "#6f7c4a", bastet: "#d8b45a", the_king: "#d9b66a", mitsuko: "#d58b9e", "mitsuko-true-form":"#c09aff", inner_child: "#ecd18b", perimeter_guardian: "#87b9a5", napoleon: "#c99344", kobe: "#5bb0a0", aristotle: "#d4ca9e", genghis_khan: "#b97359", zherm: "#8acb7b", little_king: "#e6ba64", director: "#c9a0dc",
    "visitor-grey": "#b9c6c9", "visitor-ship": "#4f7fd6", "visitor-scientist": "#9fb6d6", "warden-symbiote": "#3fae6a", "kaiju-form": "#6f8a3a", "oni-form": "#c0392b", "neo-warden-dragon": "#3fd36b", "neo-warden-cyberpunk": "#c9a24a", "neo-warden-purple-neon": "#a95df0",
    "hooded-cyber-rogue": "#8f7ae8", "child-of-the-future": "#f2d38a", "futuristic-armored-ninja": "#7fb2d9" };
  const TRUE_FORM_SPRITES = ["genghis-khan-true-form", "kobe-true-form", "perimeter-guardian-true-form", "aristotle-true-form", "little-king-true-form", "inner-child-true-form", "zherm-true-form", "napoleon-true-form", "the-king-true-form"];
  for (const key of TRUE_FORM_SPRITES) SPRITE[key] = "#d8b45a";
  const MAX_SPRITES = ["cyber-napoleon"];   // MAX forms (beyond true form; permanent for the stay)
  for (const key of MAX_SPRITES) SPRITE[key] = "#d9ccff";
  const PLAYER_POSES = ["idle", "walk", "cast", "block", "punch", "knocked-out"];
  const SPRITE_DIR = { tourist:"tourist", kaiba:"kaiba", "neo-warden":"neo-warden", "paladin-crusader":"paladin-crusader", archivist:"archivist", "archivist-kaiba":"archivist-kaiba", warden: "player", pathfinder: "pathfinder", sieve: "sieve", student: "student", "student-journeyman": "student-journeyman", "student-master": "student-master",
    earthkeeper: "earthkeeper", ranger: "ranger", rain: "rain", mason: "mason", ecology: "ecology", "animal-tamer": "animal-tamer", "police-officer": "police-officer", magistrate: "magistrate",
    planner: "planner", gardener: "gardener", arantxa: "arantxa", last_span: "last-span",
    actor: "actor", "actor-m": "actor-m", "actor-f": "actor-f", supermodel: "supermodel", agi: "agi", scientist: "scientist", architect: "architect", soldier: "soldier", "yoga-instructor": "yoga-instructor", president: "president", "knight": "knight", "paladin": "paladin", "pharaoh": "pharaoh", "daedalus": "daedalus", "samurai": "samurai", "gemini": "gemini", "wizard": "wizard", "jujutsu-sorcerer": "jujutsu-sorcerer", "super-hero": "super-hero", "super-heroine": "super-heroine", "super-villain": "super-villain", "defective-machine": "defective-machine", "teleporter": "teleporter", "mutant-boar": "mutant-boar", "boarman": "boarman", "anime-protagonist": "anime-protagonist", "mma-fighter": "mma-fighter", kickboxer: "kickboxer", fighting_coach: "fighting-coach", "fighting-coach": "fighting-coach", freemason: "freemason", "detective": "detective",
    rapper:"rapper", musician:"musician", bard:"bard", "jazz-musician":"jazz-musician", ninja: "ninja", "agent-swarm":"agent-swarm", thief: "thief", dream_hound: "hound", dream_witness: "witness", dream_amber: "amber-host", dream_salt: "salt-heir", dream_customer: "unfinished-customer", customer: "customer", "police-officer": "police-officer",
    "dream-vampire": "dream-vampire", "dream-mummy": "dream-mummy", "dream-skeleton": "dream-skeleton",
    "dream-frankenstein": "dream-frankenstein", "dream-zombie": "dream-zombie", "dream-werewolf": "dream-werewolf", "dream-ghost": "dream-ghost", "gold-form": "gold-form",
    dragon: "dragon-boss", oni: "oni-boss", kaiju: "kaiju-boss", "gaia-wounded": "gaia-wounded", "gaia-accord": "gaia-accord", gaia: "gaia-accord", emissary: "emissary-boss", tallyman: "tallyman", sealednext: "sealednext", sasquatch: "sasquatch",   // Gaia as the boss rush fields her (modes/boss-rush.js); accord = restored ally form (land.js setGaiaForm)
    esker: "esker", "modern-artist": "modern-artist", "field-botanist": "field-botanist", cyph: "cyph", hypebeast: "hypebeast", "tech-billionaire": "tech-billionaire", "oil-billionaire": "oil-billionaire", doctor: "doctor", odysseus: "odysseus", maid: "maid", general: "general", bastet: "bastet", the_king: "the_king", mitsuko: "mitsuko", "mitsuko-true-form":"mitsuko-true-form", inner_child: "inner_child", perimeter_guardian: "perimeter_guardian",
    napoleon: "napoleon", kobe: "kobe", aristotle: "aristotle", genghis_khan: "genghis_khan", zherm: "zherm", little_king: "little_king", "monkey-king": "monkey-king", director: "director", barbarian: "barbarian", clockwork: "clockwork", rogue: "rogue", medusa: "medusa", cleric: "cleric", steam_walker: "steam_walker", ornithopter: "ornithopter", engineer: "engineer",
    mycologist: "mycologist", hacker: "hacker", sailor: "sailor", astronaut: "astronaut", "ritual-chanter": "ritual-chanter", mangaka: "mangaka", "aviator-hero": "aviator-hero", "jiang-qing": "jiang-qing", "android-maker": "android-maker", origamist: "origamist", starfarer: "starfarer", pioneer: "pioneer",
    celestial_priestess: "celestial_priestess", cyanotype_artist: "cyanotype_artist", new_oni: "new_oni", artemesia: "artemesia", fbi_agent: "fbi_agent", telekinetic_hero: "telekinetic_hero", deepsea_warrior: "deepsea_warrior", black_armor: "black_armor", oni_yokozuna: "oni_yokozuna", black_swan_warrior: "black_swan_warrior", forest_spirit: "forest_spirit", neon_dj: "neon_dj", cloaked_drifter: "cloaked_drifter", neon_idol: "neon_idol", jpop_idol: "jpop_idol", mao_zedong: "mao_zedong", ember_judge: "ember_judge", devouring_mother: "devouring_mother", tactical_operative: "tactical_operative", celest_crystal: "celest-crystal", "celest-crystal": "celest-crystal", cuban_rooster: "cuban-rooster", "cuban-rooster": "cuban-rooster",
    frogan: "frogan", shaman: "shaman", hedge_witch: "hedge_witch", robot_mechanic: "robot_mechanic",
    "visitor-grey": "visitor-grey", "visitor-ship": "visitor-ship", "visitor-scientist": "visitor-scientist", "warden-symbiote": "warden-symbiote", "kaiju-form": "kaiju-form", "oni-form": "oni-form", "neo-warden-dragon": "neo-warden-dragon", "neo-warden-cyberpunk": "neo-warden-cyberpunk", "neo-warden-purple-neon": "neo-warden-purple-neon",   // learned forms (2026-10-17): both face left (the default)
    "hooded-cyber-rogue": "hooded-cyber-rogue", "child-of-the-future": "child-of-the-future", "futuristic-armored-ninja": "futuristic-armored-ninja",   // Longtermism (2026-10-22): the rogue faces right; the Child faces right; the ninja reads left (default)
    "martial-artist": "martial-artist", "martial-artist-ascended": "martial-artist-ascended",   // Martial Artist (2026-10-22): base + gold ascended form
    "goethe": "goethe", "goethe-true-form": "goethe-true-form", "goethe-ascended": "goethe-ascended",   // Goethe hot-build (2026-10-27): Young palace summon + True-Form Dream manifestation + Ascended Scholar max form (art only; no engine wiring yet)
    storm_mage: "storm_mage", tree_spirit: "tree_spirit", disheveled_politician: "disheveled_politician", astral_security: "astral_security", mesoamerican_priestess: "mesoamerican_priestess",
    celestial_astral: "celestial_astral", moonflower: "moonflower", archivist_elf: "archivist_elf", bard_elf: "bard_elf", lying_lawyer: "lying_lawyer",   // hot builds wave 4 (2026-10-23)
    "hot-pot-berserker": "hot-pot-berserker", chef: "chef", seedkeeper: "seedkeeper", memorialist: "memorialist", pearl_diver: "pearl_diver", ferryman: "ferryman",   // hot builds wave 5 (2026-10-24): Posterity + Wake 3v3 buildup
    hanuman: "hanuman", "hanuman-chibi": "hanuman-chibi", "hanuman-giant": "hanuman-giant", jambavan: "jambavan", rama: "rama", lakshmana: "lakshmana", sita: "sita", ravana: "ravana", kumbhakarna: "kumbhakarna", "shadow-archer": "shadow-archer", mandodari: "mandodari", surpanakha: "surpanakha", jatayu: "jatayu",   // Hanuman (2026-10-24): base, monkey and giant forms (State Kit body.sprite)
    bard_artificer: "bard-artificer", big_game_hunter: "big-game-hunter", burlesque_dancer: "burlesque-dancer", clown: "clown", mma_fighter_alternate: "mma-fighter-alternate", hermes: "hermes", kaikeyi: "kaikeyi",
    cactusguard: "cactusguard", cactuswar: "cactuswar", pixel_treant: "pixel-treant",   // warrior hot-builds wave 6 (Muse Berry BD, 2026-10-29): facing unreviewed, default left
    "bard-artificer": "bard-artificer", "big-game-hunter": "big-game-hunter", "burlesque-dancer": "burlesque-dancer", "mma-fighter-alternate": "mma-fighter-alternate", chef: "chef" };   // fighter hot-builds wave 6 (Muse Berry BD, 2026-10-29): facing unreviewed, default left; kebab keys added RETURN-2 T-1 (renderer queries unit.sprite, the kebab art id — fighting_coach precedent); chef cut-in (Berry CU, 2026-10-30)
  for (const key of TRUE_FORM_SPRITES) SPRITE_DIR[key] = key;
  for (const key of MAX_SPRITES) SPRITE_DIR[key] = key;
  const TREEANT_SPRITES = ["treeant-banyan", "treeant-bristlecone"];   // per-type Treeant art (keys match their folders)
  for (const key of TREEANT_SPRITES) SPRITE_DIR[key] = key;
  SPRITE_DIR.control = "control";   // benchmark instrument (docs/control.md); faces left like its sheet, so the default FACES_RIGHT false stands
  const SUMMON_SPRITES = ["the_king", "mitsuko", "inner_child", "perimeter_guardian", "napoleon", "kobe", "aristotle", "genghis_khan", "zherm", "little_king"];
  SPRITE.archivist="#ddad58";SPRITE["archivist-kaiba"]="#ddad58";
  SPRITE["modern-artist"]="#df93d4"; SPRITE["field-botanist"]="#8fbf6a"; SPRITE.kickboxer="#d9a441"; SPRITE.fighting_coach="#c7584a"; SPRITE["fighting-coach"]="#c7584a";
  SPRITE.dream_customer="#c5a8de";
  SPRITE.customer="#d7b07a";
  SPRITE.kaiba="#dd9a4a";
  SPRITE["neo-warden"]=SPRITE.warden; SPRITE["student-journeyman"]=SPRITE["student-master"]=SPRITE.student;
  const BIG_UNIT_SCALE = 3.05;   // the 2x2 bosses (dragon, oni, kaiju) are drawn at this scale
  const SPRITE_SCALE = { inner_child: 0.72, "inner-child-true-form": 0.72, "nettle-caterpillar": 0.72,   // the caterpillar art is wide: at full height it spanned more than its tile (Mala, 2026-10-27: "it doesnt take much for a caterpillar to be giant")
    dragon: 3.05, oni: 3.05, kaiju: 3.05,
    hanuman: 1.2, "hanuman-chibi": 0.85, "hanuman-giant": 1.6, kumbhakarna: 1.8,   // Kumbhakarna: boss scale (Mala, 2026-10-23), on one tile   // Mala's map-scale rulings: heroic a bit larger, giant larger; the monkey reads small
    "commune-monkeypod": 3, "commune-koa": 3, "commune-ohia": 3, "commune-wiliwili": 3, "commune-rainbowShower": 3, "commune-ulu": 3, "commune-loulu": 3,
    "commune-passionflower": 1.8, "commune-puya": 1.8,
    "commune-banyan": 3, "commune-bristlecone": 3, "commune-kukui": 3,
    "commune-bamboo": 2.2, "commune-birdOfParadise": 2.2,
    "commune-hibiscus": 1.8, "commune-plumbago": 1.8, "commune-mockOrange": 1.8, "commune-indianHawthorn": 1.8, "commune-naupaka": 1.8, "commune-ti": 1.8, "commune-ohelo": 1.8, "commune-ukiuki": 1.8, "commune-pitcherPlant": 1.8,
    "commune-monstera": 1.4, "commune-cobraLily": 1.4, "commune-venusFlytrap": 1.4,
    "commune-akulikuli": 1.1, "commune-sundew": 1.1, "commune-nativeFern": 1.1 };
  for (const look of C?.characters?.arantxa?.variants || []) { SPRITE_DIR[look] ||= look; SPRITE[look] ||= SPRITE.arantxa; }   // Arantxa's gowns (seeded per battle in the engine)
  const SPRITE_POSES = Object.fromEntries([...new Set(Object.values(SPRITE_DIR))].map((folder) => [folder, PLAYER_POSES]));
  for (const folder of ["dragon-boss", "oni-boss", "kaiju-boss", "sealednext"]) SPRITE_POSES[folder] = ["idle", "walk", "cast", "block", "punch", "enraged", "knocked-out"];
  SPRITE_POSES["gold-form"] = ["idle", "walk", "cast", "block", "punch", "knocked-out", "knee", "hurt", "infatuated", "aura"];   // knight condition poses
  const invTax = (s, u) => (root.ConceptCombatInjury?.gradeOf(u, "head") || 0) === 1 ? (s.rules.injury?.headWoundedObserveAp ?? 10) : 0;   // Investigate pays the Observe head-wound tax (Mala, 2026-10-31)
  const SPRITE_FACES_RIGHT = Object.fromEntries(Object.keys(SPRITE_DIR).map((sprite) => [sprite, sprite === "warden" || sprite === "agi"]));
  for (const sprite of [...SUMMON_SPRITES,...TRUE_FORM_SPRITES,...MAX_SPRITES,"mitsuko-true-form"]) SPRITE_FACES_RIGHT[sprite] = true;
  SPRITE_FACES_RIGHT["modern-artist"]=true; SPRITE_FACES_RIGHT["field-botanist"]=true; SPRITE_FACES_RIGHT["chef"]=true;   // chef directionals face right (Berry CU facing call, 2026-10-30)
  SPRITE_FACES_RIGHT.fighting_coach=true; SPRITE_FACES_RIGHT.hypebeast=true;
  SPRITE_FACES_RIGHT.archivist=true;SPRITE_FACES_RIGHT["archivist-kaiba"]=true;
  SPRITE_FACES_RIGHT["neo-warden"]=true;
  SPRITE_FACES_RIGHT["neo-warden-dragon"]=true; SPRITE_FACES_RIGHT["neo-warden-cyberpunk"]=true; SPRITE_FACES_RIGHT["neo-warden-purple-neon"]=true;   // learned forms: the Warden's Dragon-blooded and Founder Mode sheets (2026-10-17); purple-neon alt (2026-10-23, walk mirrored at import)
  SPRITE_FACES_RIGHT["hooded-cyber-rogue"]=true; SPRITE_FACES_RIGHT["child-of-the-future"]=true;   // Longtermism (2026-10-22): cutter-verified right; the ninja reads left (default)
  SPRITE_DIR["neo-warden-cyborg"]="neo-warden-cyborg"; SPRITE["neo-warden-cyborg"]=SPRITE.warden; SPRITE_FACES_RIGHT["neo-warden-cyborg"]=true; SPRITE_FACES_RIGHT["gaia-form"]=true;   // the Brain Chip's form (docs/brain-chip.md) and One With Nature: new Cybernetic and Nature-Tech art (Muse cuts, 2026-10-26) aims right in every attack pose
  SPRITE_FACES_RIGHT.dream_customer = true;
  SPRITE_FACES_RIGHT.customer = true;
  for(const key of ["rapper","musician","bard"]) {SPRITE_FACES_RIGHT[key]=true;SPRITE[key]="#cf9ddd";}
  SPRITE_FACES_RIGHT.president = true;
  SPRITE_FACES_RIGHT.mycologist = true;   // magenta-keyed sheet faces right (Muse-2, 2026-10-14)
  SPRITE_FACES_RIGHT.explorer = true;   // navy-keyed sheet strides right (Muse-2, 2026-10-14)
  SPRITE_FACES_RIGHT.tallyman = true;   // final art (staged-art/tallyman-review, Lantern 2026-10-18): walk, punch, enraged face right (cast mirrored to match), the rest face front
  SPRITE_FACES_RIGHT.sealednext = true;
  SPRITE_FACES_RIGHT.esker = true;   // gray-keyed sheet faces right, verified pose by pose (muse, 2026-10-14)
  SPRITE_FACES_RIGHT.odysseus = true;
  for (const key of ["goethe", "goethe-true-form", "goethe-ascended"]) SPRITE_FACES_RIGHT[key] = true;   // Goethe hot-build: cutter-verified right-facing (Muse-2, 2026-10-27); sprite review by Pantry, landed 1.3.468
  SPRITE_FACES_RIGHT.dragon = true;
  SPRITE_FACES_RIGHT.kaiju = true;
  SPRITE_FACES_RIGHT.arantxa = true;
  for (const look of C?.characters?.arantxa?.variants || []) SPRITE_FACES_RIGHT[look] = true;
  // Class-pack sheets are drawn facing right, the same contract as the Warden. (The defective machine was kept left-facing here; its punch reaches right, so it is registered below.)
  for (const sprite of ["knight", "pharaoh", "daedalus", "samurai", "gemini", "wizard", "jujutsu-sorcerer", "super-hero", "super-heroine", "super-villain", "teleporter", "mutant-boar", "boarman", "anime-protagonist", "mma-fighter", "kickboxer", "fighting-coach", "detective", "maid"]) SPRITE_FACES_RIGHT[sprite] = true;
  for (const sprite of ["general", "bastet", "cyph", "barbarian", "paladin", "clockwork", "rogue", "medusa", "cleric", "steam_walker", "ornithopter", "engineer"]) SPRITE_FACES_RIGHT[sprite] = true;   // Grok sheets: face right
  SPRITE.paladin = "#e3d5a8";   // oath-gold silhouette until the sheet loads
  // The Paladin's default art is the Crusader cut (Mala, 2026-11-01: "the paladin sprite default is the newer one"); the October art stays as the Oathbound outfit.
  SPRITE["paladin-crusader"] = SPRITE.paladin; SPRITE_FACES_RIGHT["paladin-crusader"] = true;
  SPRITE.clockwork = "#c9a86a";   // brass silhouette until the sheet loads
  SPRITE.rogue = "#7d8c5c";   // cutpurse-moss silhouette until the sheet loads
  SPRITE.medusa = "#6fbf7a";   // roster-art tint: serpent-green silhouette until the sheet loads
  SPRITE.cleric = "#dfe8f5";   // sanctuary-lamp white-blue silhouette until the sheet loads
  SPRITE.steam_walker = "#d4783a";   // boiler-orange silhouette until the sheet loads (roster-art tint)
  SPRITE.ornithopter = "#93b8d4";   // blueprint-blue silhouette until the sheet loads
  SPRITE.engineer = "#d08c3a";   // safety-orange silhouette until the sheet loads
  SPRITE.origamist = "#9fb8d8";   // folded-paper blue silhouette until the sheet loads
  SPRITE_FACES_RIGHT["actor-m"] = true;   // megastar sheet strides right; regal (actor-f) keeps the left default
  SPRITE["actor-m"] = SPRITE["actor-f"] = SPRITE.actor;
  for (const sprite of ["mycologist", "hacker", "sailor", "astronaut", "ritual-chanter", "mangaka", "aviator-hero", "jiang-qing", "android-maker", "origamist", "starfarer", "pioneer"]) SPRITE_FACES_RIGHT[sprite] = true;   // class-sprint sheets face right (SHEETS rows)
  Object.assign(SPRITE, { mycologist: "#b48ac9", hacker: "#7de08a", sailor: "#5aa7d6", astronaut: "#b9c8e8", "ritual-chanter": "#d6b25a", mangaka: "#8a8f9a", "android-maker": "#e08ab0", origamist: "#f2d38a" });
  for (const sprite of ["celestial_priestess", "cyanotype_artist"]) SPRITE_FACES_RIGHT[sprite] = true;   // hot-build wave-1 sheets strike right
  for (const sprite of ["artemesia", "new_oni"]) SPRITE_FACES_RIGHT[sprite] = false;
  SPRITE_FACES_RIGHT.black_swan_warrior = false;   // hot builds wave 3 (2026-10-17): her walk and casts face left; the rest face right (verify per pose at flesh-out)
  Object.assign(SPRITE, { fbi_agent: "#9be15a", telekinetic_hero: "#5a8ee6", deepsea_warrior: "#3c6fd6", black_armor: "#2e3138", oni_yokozuna: "#c7473a", black_swan_warrior: "#1f1d24", forest_spirit: "#6fae4a", neon_dj: "#e05ad0", cloaked_drifter: "#7d8a86", neon_idol: "#b45ae6", jpop_idol: "#e88ab6", mao_zedong: "#7b8796", ember_judge: "#d9732e", devouring_mother: "#e8c9d6", tactical_operative: "#5b5a3e" });   // walk/strike art faces left (idles face front; verify per-pose at flesh-out)
  Object.assign(SPRITE, { celestial_priestess: "#cfd8ff", cyanotype_artist: "#5a86d6", new_oni: "#c7584a", artemesia: "#d6a94f", celest_crystal: "#9fd8e8", cuban_rooster: "#d67a4f" });
  for (const sprite of ["shaman", "hedge_witch", "robot_mechanic"]) SPRITE_FACES_RIGHT[sprite] = true;   // wave-2 sheets strike right
  SPRITE_FACES_RIGHT.frogan = false;   // the manticore's blade sweeps left
  Object.assign(SPRITE, { frogan: "#6ab86a", shaman: "#7a6fd0", hedge_witch: "#4f8f4f", robot_mechanic: "#d08a3e" });
  for (const sprite of ["storm_mage", "tree_spirit", "disheveled_politician", "astral_security", "mesoamerican_priestess", "celestial_astral", "moonflower", "archivist_elf", "bard_elf", "lying_lawyer"]) SPRITE_FACES_RIGHT[sprite] = true;   // hot builds wave 4 (2026-10-23): all strike right; left-facing idles/walks/dodges mirrored at import
  for (const sprite of ["hanuman", "hanuman-chibi", "hanuman-giant", "jambavan", "rama", "lakshmana", "sita", "ravana", "kumbhakarna", "shadow-archer", "mandodari", "surpanakha", "jatayu"]) SPRITE_FACES_RIGHT[sprite] = true;   // Kumbhakarna: the attack faces right at full size (qa/repeats.md #18)   // Jambavan: checked at full size, all strike right   // Hanuman: all three cuts strike right (Codex's cut notes)
  Object.assign(SPRITE, { hanuman: "#e0a23a", "hanuman-chibi": "#e0a23a", "hanuman-giant": "#e0a23a", jambavan: "#8a5a3a", rama: "#3e6fb0", lakshmana: "#c08a2e", sita: "#d4607a", ravana: "#7a2e3a", kumbhakarna: "#5a3a2a", "shadow-archer": "#5a2a6a", mandodari: "#7a4ab0", surpanakha: "#b04a6a", jatayu: "#a8743a" });
  Object.assign(SPRITE, { storm_mage: "#8a7ae0", tree_spirit: "#5d8a48", disheveled_politician: "#5a6e8a", astral_security: "#8676f2", mesoamerican_priestess: "#c9753a", celestial_astral: "#b9a7e8", moonflower: "#e8e4f0", archivist_elf: "#6a5a9e", bard_elf: "#9d7bd8", lying_lawyer: "#3e5a8a" });
  Object.assign(SPRITE, { bard_artificer: "#c9a227", big_game_hunter: "#6b7f4e", burlesque_dancer: "#d44d7a", clown: "#e05a3a", mma_fighter_alternate: "#4a4a52", hermes: "#7ab8e0", kaikeyi: "#8e3b5c",
    "bard-artificer": "#c9a227", "big-game-hunter": "#6b7f4e", "burlesque-dancer": "#d44d7a", "mma-fighter-alternate": "#4a4a52" });   // fighter hot-builds wave 6 (Muse Berry BD, 2026-10-29); kebab keys RETURN-2 T-1
  SPRITE_FACES_RIGHT["big-game-hunter"] = SPRITE_FACES_RIGHT.big_game_hunter = true;   // wave 6: eye-checked right 2026-10-29 (idle frontal, punch + cast strike right; qa-evidence/hunter-facing.txt) + tools/check-sprite-facing.mjs VERIFIED; the rest default left until reviewed
  Object.assign(SPRITE, { cactusguard: "#4e7f3a", cactuswar: "#6a3a6e", pixel_treant: "#3a6e4e" });   // warrior hot-builds wave 6 (Muse Berry BD, 2026-10-29)
  for (const sprite of ["seedkeeper", "memorialist", "pearl_diver", "ferryman"]) SPRITE_FACES_RIGHT[sprite] = true;   // hot builds wave 5 (2026-10-24): eye-checked right on live files, zero mirrors; politician punch re-mirrored (wave 4 shipped it left)
  SPRITE_FACES_RIGHT["hot-pot-berserker"] = SPRITE_FACES_RIGHT.hot_pot_berserker = true;   // cut 2026-10-25 (staged-art/hot-pot-berserker-review): every pose faces right
  Object.assign(SPRITE, { "hot-pot-berserker": "#b5482f", chef: "#e4ded2", seedkeeper: "#d98a3a", memorialist: "#5a7a5a", pearl_diver: "#bfe3dd", ferryman: "#c9a959" });
  // Dream monsters render under their full-path sprite key ("combat/sprites/dream-<key>"), which never hit the registry, so the ?? true default drew the left-facing art unflipped. Verified pose by pose; cast x7 + skeleton/vampire punch flipped left to match (Mala's screenshot via Muse-2, 2026-10-15).
  for (const m of ["frankenstein", "ghost", "mummy", "skeleton", "vampire", "werewolf", "zombie"]) SPRITE_FACES_RIGHT[`combat/sprites/dream-${m}`] = false;
  // Right-facing art that fell through to the left-facing default (Mala, 2026-10-17: Special Agent Grey shot away from
  // Genghis Khan). Found by tools/check-sprite-facing.mjs and checked by eye on contact sheets.
  for (const sprite of ["visitor-grey", "visitor-scientist", "warden-symbiote", "black_armor", "cloaked_drifter", "fbi_agent", "forest_spirit",
    "ember_judge", "defective-machine", "director", "doctor", "gaia", "gaia-accord", "gaia-wounded", "kaiba", "oil-billionaire", "tech-billionaire",
    "oni", "emissary", "tallyman", "dream_hound", "dream_salt", "dream_witness"]) SPRITE_FACES_RIGHT[sprite] = true;
  SPRITE_FACES_RIGHT.deepsea_warrior = true;   // art strikes right in all 10 poses (muse eye-check 2026-10-19, contact sheet); registry default false drew it unflipped, facing away in battle.
  function shouldFlipSprite(sprite, targetIsRight) {
    return (SPRITE_FACES_RIGHT[sprite] ?? true) !== targetIsRight;
  }
  const TIER = { basic: "B", refined: "R", ultimate: "U" };
  const lfLabel = (m) => (m && m.lfPrice ? ` · ${m.lfPrice} LF` : "");
  const PICKUP_STYLE = {
    waterCan: { name: "Watering can", short: "CAN", color: "#67d8ed", mark: "drop" },
    bait: { name: "Fallen fruit", short: "FRUIT", color: "#f38c70", mark: "fruit" },
    flare: { name: "Road flare", short: "FLARE", color: "#ffae54", mark: "spark" },
    rainStick: { name: "Rain stick", short: "RAIN", color: "#8fb3ff", mark: "rain" },
    borate: { name: "Borate treatment", short: "BOR", color: "#b0df8a", mark: "bottle" },
    noisemaker: { name: "Noisemaker", short: "SOUND", color: "#d6a6ff", mark: "sound" },
    fish: { name: "Raw salema", short: "FISH", color: "#7fd4c1", mark: "fish" },
  };
  function pickupPresentation(item) { return PICKUP_STYLE[item] || { name: PK?.sources?.[item]?.name || Loot.data.consumables[item]?.name || item, short: Cook?.isFood(item) || PK?.sources?.[item]?.edible ? "FOOD" : "ITEM", color: "#f3d58a", mark: "box" }; }
  // An account item used on yourself (food, drink, a heal): no tile to choose. Wild map items and placed things still target.
  const selfItem = (id) => { const d = Loot.data.consumables[id]; if (!d || d.effect?.wild || d.effect?.hire) return false; const e = d.effect || {}; return !(e.placeBarrier || e.blockSightTiles || e.observe); };
  const itemIcon = (id, alt, cls = "cc-item-icon") => `<img class="${cls}" src="combat/sprites/items/${encodeURIComponent(id)}.png" alt="${esc(alt)}" loading="lazy" onerror="this.style.display='none'">`;
  // Every committed engine action leaves the targeting/response subview. Set
  // this before render(): a closed response has no pending record to render.
  function modeAfterEngineAction(s) {
    if (s.phase === "mind") return "mind";
    if (s.phase === "response") return "response";
    return s.outcome ? "over" : "menu";
  }
  const EDGE_COLOR = { negates: "#ef6f6c", enhances: "#7cc6a4", deflects: "#e9c46a", bypasses: "#d98bd0", disrupts: "#f4a261",
    none: "#8a8294", unknown: "#5a5466", augment: "#7cc6a4", constrain: "#f4a261", transform: "#e9c46a", enable: "#8fb3ff", interfere: "#ef6f6c" };

  function graphLayout(concepts) {
    const ids = Object.keys(concepts).filter((id) => !concepts[id].sealed), cols = 4, rows = Math.ceil(ids.length / cols);
    const nodes = Object.fromEntries(ids.map((id, i) => [id, [100 + (i % cols) * 140, 46 + Math.floor(i / cols) * 92]]));
    const height = Math.max(180, 46 + (rows - 1) * 92 + 46);
    nodes["*"] = [38, height / 2];
    return { nodes, width: 640, height };
  }

  // Which slot the attacker shows in a duel scene. A Strike's damage events carry ability: "strike", so the action type
  // alone can't decide it (that made punch unreachable); poses.js routes it, and splits techniques into Cast Off / Def.
  function scenePose(action, event = {}) {
    const P = root.ConceptCombatPoses, ability = event.ability || action.ability || null;
    if (ability === "overwatch") return "punch";
    if (!P) return action.type === "strike" || ability === "strike" ? "punch" : "cast";
    return P.route({ type: action.type === "strike" || ability === "strike" ? "strike" : "ability", ability, def: C.abilities[ability] });
  }

  // A dodge is a scene too (Mala's spec via Muse, 2026-10-10). The order is the point: the dodger VACATES the attacked
  // square, is in transit, the attack lands on the empty square, and only then does the dodger land on the new one.
  // Times are ms into the 1600 ms scene; updateAttackPopup plays them and tests assert the order.
  // Scene lengths (Mala, 2026-10-11: scenes were closing faster than they could be read). An attack, dodge or boon scene
  // lasts SCENE_MS (it was 1600); a scene that carries a sentence lasts TEXT_SCENE_MS. A scene may set its own `ms`.
  // The beats inside a scene are unchanged; the extra time is all at the end, with the result on screen.
  const SCENE_MS = 2200, TEXT_SCENE_MS = 3800, SCENE_LEAVE_MS = 200, REPORT_GUARD_MS = 900;   // REPORT_GUARD_MS: reportGuarded()
  // Pace (Mala, 2026-10-31: "The text is going way too fast to understand"): Slow doubles every scene through this ONE multiplier,
  // and an AI action waits long enough to be read (readingGapMs). Presentation only: no engine state or RNG is touched.
  let paceMul = 1;
  const PACE_SLOW = 2, READ_CPS = 18, READ_FLOOR_MS = 1200, READ_CEIL_MS = 6000;
  const setPace = (pace) => { paceMul = pace === "slow" ? PACE_SLOW : 1; return paceMul; };
  const readingGapMs = (chars) => Math.max(READ_FLOOR_MS, Math.min(READ_CEIL_MS, Math.round(chars / READ_CPS * 1000)));
  const sceneMs = (scene) => (scene?.ms || SCENE_MS) * paceMul;
  // Unit follow (Mala, 2026-10-31: "a Unit follow mode that locks the camera on a close up of the unit who is currently acting").
  // The pure part: where the camera should look. The eased move lives in the board code (camGoto).
  const FOLLOW = { zoom: 2, plan: 1.5, easeMs: 350, holdMs: 900, margin: 0.72, trackMsPerTile: 90 };
  const followable = (u) => !!u && !u.defeated && !u.notArrived && Number.isFinite(u.x) && Number.isFinite(u.y);   // an unplaced or arriving unit is never looked at
  const followTarget = (unit, mine) => (followable(unit) ? { x: unit.x, y: unit.y, z: mine ? FOLLOW.plan : FOLLOW.zoom } : null);
  function framePair(a, b, view) {   // an actor and its target: their midpoint, at the largest zoom (up to the close-up) that keeps both inside the margin
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y), fit = view.fit || 1;
    const zx = FOLLOW.margin * view.W / ((dx + 2) * fit), zy = FOLLOW.margin * view.H / ((dy + 2) * fit * 0.6);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: Math.max(0.5, Math.min(FOLLOW.zoom, zx, zy)) };
  }
  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const camAt = (from, to, k) => { const e = easeInOut(Math.max(0, Math.min(1, k))); return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z: from.z + (to.z - from.z) * e }; };   // k is clamped: a frame stamped before the move began never overshoots
  const camAlong = (from, via, to, k) => {   // the camera walks the unit's own path: eased over the whole walk, at an even pace between tiles, zoom eased alongside
    const pts = [{ x: from.x, y: from.y }, ...via.map((p) => ({ x: p.x, y: p.y })), { x: to.x, y: to.y }], e = easeInOut(Math.max(0, Math.min(1, k)));
    const seg = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y)), total = seg.reduce((n, l) => n + l, 0);
    let at = e * total, i = 0; while (i < seg.length - 1 && at > seg[i]) { at -= seg[i]; i++; }
    const f = seg[i] > 0 ? Math.min(1, at / seg[i]) : 1;
    return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f, z: from.z + (to.z - from.z) * e };
  };
  const DODGE_TIMELINE = { vacate: 250, attack: 450, miss: 900, land: 1150, results: 1150, leave: SCENE_MS - SCENE_LEAVE_MS };
  function dodgeScene(before, after, action) {
    if (action?.type !== "respond" || action.response !== "reposition") return null;
    const pending = before?.pending, dodger = before?.actors?.[action.actor], landed = after?.actors?.[action.actor], source = before?.actors?.[pending?.attacker];
    if (!pending?.inst || !dodger || !landed || !source) return null;
    if (dodger.x === landed.x && dodger.y === landed.y) return null;               // didn't actually move
    const tiles = pending.announcedTiles || pending.inst.announcedTiles || pending.inst.tiles || [];   // the engine's own order
    // Still standing inside the attack after moving is not a dodge: the hit scene will show what happened.
    if (tiles.some(([x, y]) => x === landed.x && y === landed.y)) return null;
    const ability = pending.inst.ability || null;
    return { kind: "dodge", source: { ...source }, ability, name: pending.inst.name || C.abilities[ability]?.name || "Attack",
      pose: scenePose({ type: ability === "strike" || /^strike$/i.test(pending.inst.name || "") ? "strike" : "ability", ability }),
      dodger: { before: { ...dodger }, after: { ...landed } }, from: [dodger.x, dodger.y], to: [landed.x, landed.y], targets: [],
      melee: Math.abs(source.x - dodger.x) + Math.abs(source.y - dodger.y) <= 1, timeline: DODGE_TIMELINE,
      steps: [{ at: DODGE_TIMELINE.vacate, step: "vacate", tile: [dodger.x, dodger.y] }, { at: DODGE_TIMELINE.attack, step: "attack" },
        { at: DODGE_TIMELINE.miss, step: "miss", tile: [dodger.x, dodger.y] }, { at: DODGE_TIMELINE.land, step: "land", tile: [landed.x, landed.y] }] };
  }

  // Presentation snapshots only; damage and responses have already resolved in the engine.
  // A belief update is a scene of its own (Mala, 2026-10-10): the witness alone on the stage. "shaken" = a
  // non-believer rationalises what they saw (an unexplained event); "converted" = they come to believe.
  // Built from the battle log so the wording is the engine's; one scene per witness per action (a conversion wins).
  const BELIEF_TIMELINE = { doubt: 300, turn: 850, leave: TEXT_SCENE_MS - SCENE_LEAVE_MS };
  function beliefScenes(after, entries = []) {
    const byActor = new Map();
    for (const e of entries) {
      if (e.kind !== "beliefReassessment" && e.kind !== "beliefConversion") continue;
      const unit = after?.actors?.[e.actor]; if (!unit) continue;
      const converted = e.kind === "beliefConversion";
      if (byActor.get(e.actor)?.outcome === "converted" && !converted) continue;
      const strength = Number(/belief strength (\d)/.exec((e.why || []).join(" "))?.[1]) || 0;
      byActor.set(e.actor, { kind: "belief", outcome: converted ? "converted" : "shaken", unit: { ...unit }, text: e.text || "", strength,
        name: converted ? `${unit.name} believes` : `${unit.name}'s certainty cracks`, pose: converted ? "cast-def" : "knockback", timeline: BELIEF_TIMELINE, ms: TEXT_SCENE_MS });
    }
    return [...byActor.values()];
  }

  // A boon is a scene too (Mala via Muse, 2026-10-10): heals, wards and buffs get the caster and whoever received
  // them, with the amounts. Built from the state before and after the action, so it needs no special event from the
  // engine: any technique that leaves an ally (or the caster) with more LF, more ward, or a new named status shows.
  const BOON_SKIP = new Set(["guard", "stun", "entangled", "verse", "poison"]);
  function boonScenes(before, after, action = {}) {
    if (!["ability", "useItem", "aura"].includes(action.type)) return [];
    const caster = before?.actors?.[action.actor], now = after?.actors || {}; if (!caster) return [];
    const targets = [];
    for (const u of Object.values(now)) {
      const was = before.actors[u.id]; if (!was || u.defeated || u.side !== (now[caster.id]?.side ?? caster.side)) continue;
      const lf = Math.round((u.lf || 0) - (was.lf || 0)), ward = Math.round((u.status?.ward?.protection || 0) - (was.status?.ward?.protection || 0));
      const gained = Object.keys(u.status || {}).filter((k) => !BOON_SKIP.has(k) && k !== "ward" && u.status[k] && !was.status?.[k]).map((k) => u.status[k].label || k).filter((l) => typeof l === "string");
      if (lf > 0 || ward > 0 || gained.length) targets.push({ before: { ...was }, after: { ...u }, lf: Math.max(0, lf), ward: Math.max(0, ward), gained: [...new Set(gained)].slice(0, 3) });
    }
    if (!targets.length) return [];
    const selfOnly = targets.length === 1 && targets[0].before.id === caster.id;
    return [{ kind: "boon", source: { ...caster }, ability: action.ability || null, name: C.abilities[action.ability]?.name || (action.type === "aura" ? "Aura" : action.type === "useItem" ? "Item" : "Support"),
      pose: "cast-def", selfOnly, targets: targets.sort((a, b) => (a.before.id === caster.id) - (b.before.id === caster.id)).slice(0, 3) }];
  }
  // A companion's pep talk is a boon scene too (Muse's comeback v2): the Fighting Coach casts, the Kickboxer receives.
  // It is not an action anyone chose (he arrives as her turn starts), so it is built from the engine's log line.
  function pepTalkScenes(before, after, entries = []) {
    return entries.filter((e) => e.kind === "companion" && e.pepTalk).map((e) => {
      const coach = after?.actors?.[e.actor], her = after?.actors?.[e.target], was = before?.actors?.[e.target]; if (!coach || !her) return null;
      return { kind: "boon", source: { ...coach }, ability: null, name: "Pep talk", pose: "cast-def", selfOnly: false,
        targets: [{ before: { ...(was || her) }, after: { ...her }, lf: 0, ward: 0, gained: [e.pepTalk.ready ? "Ultimate ready" : "", e.pepTalk.pf ? `+${e.pepTalk.pf} ΦF` : ""].filter(Boolean) }] };
    }).filter(Boolean);
  }
  // A missed companion call is a farewell scene (Mala, 2026-10-11): the would-be companion
  // speaks once from off the field and never arrives. Built from the engine's miss log line.
  function missedCallScenes(before, after, entries = []) {
    return entries.filter((e) => e.kind === "companion" && e.missed && e.line).map((e) => {
      const owner = after?.actors?.[e.target]; if (!owner) return null;
      const unit = { id: `farewell-${e.speaker}`, name: e.speakerName || "A brother", sprite: e.sprite, x: owner.x, y: owner.y, side: owner.side, lf: 1, maxLF: 1 };
      return { kind: "farewell", unit, name: `${unit.name} answers`, line: e.line, pose: "idle", timeline: { doubt: 300, turn: 850 }, ms: TEXT_SCENE_MS };
    }).filter(Boolean);
  }
  // A companion whose def carries an arrivalScene gets a text scene as it arrives (Mala, 2026-10-12: the Tech
  // Billionaire's AGI, "it escaped containment"). Same text-scene layout as a missed call, with the arrival on screen.
  const ASCENSION = { dir: "combat/sprites/auras/ascension", count: 9 };   // the Student's graduation (art: Codex, 2026-10-13)
  function arrivalScenes(before, after, entries = []) {
    return entries.filter((e) => ((e.kind === "companion" && e.arrived) || e.kind === "faction" || e.kind === "graduation") && e.scene?.line).map((e) => {   // "faction": a transcending AI names its ending (engine.js PostHuman)
      const unit = after?.actors?.[e.actor]; if (!unit) return null;
      if (e.scene.ascension) return { kind: "farewell", unit: { ...unit }, name: e.scene.title, line: e.scene.line, pose: "ultimate", frames: ASCENSION, timeline: { doubt: 200, turn: 1400 }, ms: TEXT_SCENE_MS };   // a graduation: the ascension frames play, then he stands in his new form
      return { kind: "farewell", unit: { ...unit }, name: e.scene.title || `${unit.name} arrives`, line: e.scene.line, pose: "idle", timeline: { doubt: 300, turn: 850 }, ms: TEXT_SCENE_MS };
    }).filter(Boolean);
  }
  // One commune log entry to its card, or null (an enemy-side commune, a structure, a species with no bank). The fact is picked from
  // what the log already carries (the ally's plant object, the battle seed) and the account's heard list, so the engine, its log and
  // its replay records are untouched. The caller marks the fact heard when the card opens.
  function fieldNoteCard(after, e, unit, ctx) {
    const timeline = { doubt: 900, turn: 1200 };
    if (e.kind === "commune") {
      if (unit.side !== "player" || !unit.communed) return null;
      const type = unit.communed.type, objId = unit.communed.object?.id || unit.id, pr = CM.profile(type);
      const pick = pr && PF.pick(type, { seed: after.seed, objId, heard: ctx.heard?.seen?.[type] || [], last: ctx.heard?.last?.[type] || null });
      if (!pick) return null;
      return { kind: "farewell", unit: { ...unit }, name: `${pr.common} ${e.gift ? "wakes" : "speaks"}`, label: "FIELD NOTE", opener: pick.opener, line: pick.fact.text, pose: "idle", timeline,
        ms: PF.sceneMs(pick.opener, pick.fact.text), fieldNote: true, factId: pick.fact.id, plantType: type };
    }
    if (unit.side !== "player") return null;
    const at = e.tiles?.[0], obj = at && (after.arena?.objects || []).find((o) => o.x === at[0] && o.y === at[1] && CM.profile(o.type));
    const pr = obj && CM.profile(obj.type), s = pr && PF.sulk(obj.type, { seed: after.seed, objId: obj.id });
    if (!s) return null;
    return { kind: "farewell", unit: { id: `commune-${obj.id}`, name: pr.common, sprite: `commune-${obj.type}`, x: obj.x, y: obj.y, side: "neutral" }, name: `${pr.common} turns away`, label: "FIELD NOTE", line: s.line, pose: "idle", timeline, ms: PF.sceneMs("", s.line), fieldNote: true };
  }
  // Event cards (Mala, 2026-10-16): the log moves too fast to read in a fast fight, so arrivals,
  // Gaia, ritual turns and the dream closing get cutscene cards with the unit's sprite. UI-only:
  // sims never see them. Reuses the farewell renderer (title + sprite + line).
  // ctx = { heard } (S1, Communion cutscenes): when given, a commune on a human-side ally plays a FIELD NOTE card (an opener and one
  // true fact about the plant) and a wrong answer plays a one-beat sulk. Without ctx the function returns exactly what it did before.
  function eventScenes(after, entries = [], ctx = null) {
    const out = [];
    for (const e of entries) {
      const unit = after?.actors?.[e.actor]; if (!unit) continue;
      const card = (name, line) => ({ kind: "farewell", unit: { ...unit }, name, line, pose: "idle", timeline: { doubt: 300, turn: 850 }, ms: TEXT_SCENE_MS });
      if (ctx && PF && CM && (e.kind === "commune" || e.kind === "communeFail")) { const fc = fieldNoteCard(after, e, unit, ctx); if (fc) out.push(fc); continue; }
      if (e.kind === "arrival") out.push(card(`${unit.name} arrives`, unit.side === "player" ? "I'm here to help!" : unit.side === "enemy" ? "Another enemy takes the field." : "A neutral party walks in."));
      else if (e.kind === "gaiaSummon") out.push(card("Gaia Will Have Her Revenge", e.text));
      else if (e.kind === "ritual" && e.started) { const m = after?.wild?.find((w) => w.id === e.target) || after?.actors?.[e.target];
        out.push(card(`${unit.name} binds ${m ? (m.name || m.kind) : "the beast"}`, (e.why || [])[0] || e.text)); }
      else if (e.kind === "ritual" && e.ended) out.push(card(e.ended === "broken" || e.ended === "moved" ? "Ritual Broken" : "Ritual Fizzles", e.text));
      else if (e.kind === "ritual" && e.captured) out.push(card("Bead Made", `${e.text} ${(e.why || [])[0] || ""}`.trim()));
      else if (e.kind === "fieldClose" && e.field === "dreamSpace") out.push(card("The Dream Closes", e.text));
      else if (e.kind === "stateScene") out.push(card(e.title, e.line));   // States: a { scene } effect (Hanuman remembers)
    }
    return out;
  }
  // Face portraits for whoever is speaking (sprites/<folder>/face-<expression>.png; docs/conversational-cast.md).
  // faceFile falls back from the asked expression to neutral, then to null: the caller shows the battle sprite instead,
  // never someone else's face.
  const FACE_ART = { "paladin-crusader":["neutral","happy","angry","sad","surprised"], raven:["neutral","happy","angry","sad","surprised"], chef:["neutral","happy","angry","sad","surprised"], control:["neutral","happy","angry","sad","surprised"], hanuman:["neutral","happy","angry","sad","surprised"], "hanuman-chibi":["neutral","happy","angry","sad","surprised"], "hanuman-giant":["neutral","happy","angry","sad","surprised"], jambavan:["neutral","happy","angry","sad","surprised"], rama:["neutral","happy","angry","sad","surprised"], lakshmana:["neutral","happy","angry","sad","surprised"], sita:["neutral","happy","angry","sad","surprised"], ravana:["neutral","happy","angry","sad","surprised"], kumbhakarna:["neutral","happy","angry","sad","surprised"], "shadow-archer":["neutral","happy","angry","sad","surprised"], mandodari:["neutral","happy","angry","sad","surprised"], surpanakha:["neutral","happy","angry","sad","surprised"], jatayu:["neutral","happy","angry","sad","surprised"], pioneer:["neutral","happy","angry","sad","surprised"], starfarer:["neutral","happy","angry","sad","surprised"], freemason: ["neutral", "speaking", "thinking", "amused", "angry", "tired", "determined"], salmacis: ["neutral", "happy", "determined", "sad", "surprised"] };
  const faceFile = (sprite, expression = "neutral") => {
    if (sprite && sprite.startsWith("tsukumogami")) {   // Tsukumogami: every type shares the house mecha's five faces
      const has = ["neutral", "happy", "angry", "sad", "surprised"];
      const pick = has.includes(expression) ? expression : "neutral";
      return `combat/sprites/tsukumogami-faces/${pick}.png`;
    }
    const has = FACE_ART[sprite]; if (!has) return null;
    const pick = has.includes(expression) ? expression : has.includes("neutral") ? "neutral" : null; return pick ? `combat/sprites/${sprite}/face-${pick}.png` : null; };
  // One portrait contract for arguments and conversations: never borrow another unit's face.
  function portraitSource(unit, expression="speaking") {
    const key=unit?.form?.golden?"gold-form":unit?.form?.formId==="one_with_nature"?"gaia-form":unit?.sprite || W?.data?.monsters?.[unit?.kind]?.sprite;
    const folder=SPRITE_DIR[key] || (key==="gaia-form"?key:null) || W?.data?.monsters?.[unit?.kind]?.sprite;
    const idle=folder?`combat/sprites/${folder}/idle.png`:null, face=faceFile(folder || key,expression);
    return {src:face || idle,idle,isFace:!!face,key};
  }
  function portraitMarkup(unit, expression="speaking", facesRight=true) {
    const p=portraitSource(unit,expression),name=unit?.name || "Speaker";
    return `<div class="cc-conversation-portrait ${p.isFace?"is-face":"is-idle"}">${p.src?`<img data-portrait data-portrait-idle="${esc(p.idle || "")}" data-portrait-flip="${shouldFlipSprite(p.key,facesRight)?-1:1}" style="transform:scaleX(${p.isFace?1:shouldFlipSprite(p.key,facesRight)?-1:1})" src="${esc(p.src)}" alt="${esc(name)}">`:""}<span class="cc-portrait-placeholder" role="img" aria-label="${esc(name)}" ${p.src?"hidden":""}>${esc(name.slice(0,1))}</span></div>`;
  }
  function bindPortraitFallbacks(container) {
    container.querySelectorAll("img[data-portrait]").forEach(img=>{
      const failed=()=>{const fallback=img.dataset.portraitIdle;delete img.dataset.portraitIdle;
        if(fallback && img.getAttribute("src")!==fallback){img.closest(".cc-conversation-portrait").className="cc-conversation-portrait is-idle";img.style.transform=`scaleX(${img.dataset.portraitFlip || 1})`;img.src=fallback;}
        else {img.hidden=true;img.nextElementSibling.hidden=false;}};
      img.onerror=failed;if(img.complete && !img.naturalWidth)failed();
    });
  }
  const conversationUnit=(s,id)=>s?.actors?.[id] || s?.wild?.find(u=>u.id===id);
  function conversationScenes(before,after,entries=[]) {
    return entries.filter(e=>e.conversation).flatMap(e=>{
      const info=e.conversation,unit=conversationUnit(after,info.actor)||conversationUnit(before,info.actor);
      if(!unit)return [];
      const target=conversationUnit(after,info.target)||conversationUnit(before,info.target);
      return [{kind:"conversation",unit:{...unit},target:target?{...target}:null,name:info.title,line:e.text,action:info.action,ms:TEXT_SCENE_MS}];
    });
  }
  function learningScenes(before,after,entries=[]) {
    const seen=new Set();
    return entries.filter(e=>e.learnedTechnique).flatMap(e=>{
      const learned=e.learnedTechnique,unit=conversationUnit(after,e.actor)||conversationUnit(before,e.actor),key=`${e.actor}:${learned.ability}`;
      if(!unit || seen.has(key))return [];seen.add(key);
      const source=conversationUnit(after,learned.source)||conversationUnit(before,learned.source);
      return [{kind:"learning",unit:{...unit},target:source?{...source}:null,name:"Technique understood",technique:C.abilities[learned.ability]?.name || learned.ability,line:e.text,ms:TEXT_SCENE_MS}];
    });
  }
  function conversationMarkup(scene) {
    const unit=scene.unit,target=scene.target,learning=scene.kind==="learning";
    return `<section class="cc-duel cc-conversation ${learning?"is-learning":""}"><header><div><small>${learning?"GENIUS · LEARNING":"CONVERSATION"}</small><h2>${esc(scene.name)}</h2></div><button type="button" id="ccAttackSkip" title="Continue (Enter or Escape)">Continue ›</button></header>
      <div class="cc-conversation-cast"><figure>${portraitMarkup(unit,learning?"thinking":"speaking")}<figcaption>${esc(unit.name)}<small>${learning?"Understands the pattern":"Speaking"}</small></figcaption></figure>
      ${target?`<span class="cc-conversation-link" aria-hidden="true">${learning?"✦":"···"}</span><figure class="is-listener">${portraitMarkup(target,"thinking",false)}<figcaption>${esc(target.name)}<small>${learning?"Witnessed technique":"Listening"}</small></figcaption></figure>`:""}</div>
      ${learning?`<div class="cc-learned-technique"><small>NEW TECHNIQUE · THIS BATTLE</small><strong>${esc(scene.technique)}</strong></div>`:""}<p class="cc-conversation-line" aria-live="polite">${esc(scene.line)}</p></section>`;
  }
  function mindDuelMarkup(ix,actors) {
    const bar=p=>{const pct=Math.max(0,Math.min(100,Math.round(100*p.willpower/Math.max(1,p.maxWillpower))));return `<div class="cc-mind-meter" role="progressbar" aria-label="${esc(p.name)} willpower" aria-valuemin="0" aria-valuemax="${p.maxWillpower}" aria-valuenow="${p.willpower}"><span style="width:${pct}%"></span></div>`;};
    const panel=p=>`<section class="cc-mind-opponent ${p.isYou?"is-you":"is-other"}"><div class="cc-mind-person">${portraitMarkup(actors[p.id] || {name:p.name},"thinking",p.id===ix.a.id)}<div><small>${p.isYou?"YOU":"OPPONENT"}</small><h3>${esc(p.name)}</h3><div class="cc-mind-will"><span>Willpower</span><b>${p.willpower}<em> / ${p.maxWillpower}</em></b></div>${bar(p)}</div></div>
      ${p.vow?`<p class="cc-mind-status">Vowed: ${p.vow==="gentle"?"The gentle tongue":"The unyielding mind"}</p>`:""}${p.stagger?`<p class="cc-mind-status">Stammering opener · −2</p>`:""}
      <details class="cc-mind-reads" data-mind-fold="reads:${esc(p.id)}"><summary>${p.traits.length} known read${p.traits.length===1?"":"s"}${p.unknown?` · ${p.unknown} unknown`:""}</summary><div>${p.traits.map(t=>`<article><b>${esc(INS?.data?.traits?.[t.id]?.name || t.id.replace(/([A-Z])/g," $1"))}</b><span>Weak to ${esc(t.weak)} · immune to ${esc(t.strong)}</span><p>${esc(t.why)}</p></article>`).join("") || `<p>No read yet. A hidden immunity can rebound.</p>`}</div></details></section>`;
    const me=ix.a.isYou?ix.a:ix.b;
    let choices;
    if(!ix.a.isYou && !ix.b.isYou)choices=`<p class="cc-mind-wait" role="status">They are exchanging arguments…</p>`;
    else if(ix.concede)choices=`<div class="cc-mind-prompt"><h3>Choose a concession</h3><p>Your will breaks · ${esc(ix.concede.severity)}</p></div><div class="cc-mind-choices">${ix.concede.options.map(o=>`<button type="button" data-concede="${esc(o.id)}" ${o.off?"disabled":""}><strong>${esc(o.label)}</strong><span>${esc(o.note)}</span></button>`).join("")}</div>`;
    else if(me.picked)choices=`<p class="cc-mind-wait" role="status">Argument chosen. Waiting for the reply…</p>`;
    else choices=`<div class="cc-mind-prompt"><h3>Make your argument</h3><p>Both choose together. The stronger argument deals the margin.</p></div><div class="cc-mind-choices">${Object.entries(ix.moves).map(([id,m],i)=>`<button type="button" data-move="${esc(id)}"><small>0${i+1}</small><strong>${esc(m.name)}</strong><span>${esc(m.text)}</span></button>`).join("")}</div>${ix.vowOffer?`<details class="cc-mind-vows" data-mind-fold="vows"><summary>Swear a vow <span>optional · free this battle</span></summary><div><button type="button" data-vow="gentle"><b>The gentle tongue</b><span>Never insult · empathy +1</span></button><button type="button" data-vow="unyielding"><b>The unyielding mind</b><span>Never concede · debate +1</span></button></div></details>`:""}`;
    return `<section class="cc-card cc-mind-dialog" role="dialog" aria-modal="true" aria-labelledby="ccMindTitle" tabindex="-1"><header class="cc-mind-header"><div><small>A CONTEST OF WILL</small><h2 id="ccMindTitle">Battle of minds</h2></div><div class="cc-mind-round" aria-label="Round ${ix.round} of ${ix.maxRounds}"><span>Round ${ix.round} / ${ix.maxRounds}</span><div aria-hidden="true">${Array.from({length:ix.maxRounds},(_,i)=>`<i class="${i+1<ix.round?"is-done":i+1===ix.round?"is-current":""}"></i>`).join("")}</div></div></header>
      <div class="cc-mind-versus">${panel(ix.a)}<span class="cc-mind-vs" aria-hidden="true">VS</span>${panel(ix.b)}</div>${choices}
      ${ix.log.length?`<details class="cc-mind-history" data-mind-fold="history"><summary>Last exchange</summary><div aria-live="polite">${ix.log.slice(-4).map(l=>`<p>${esc(l)}</p>`).join("")}</div></details>`:""}</section>`;
  }
  // Art for the wild's field hazards (sprites/<folder>/idle.png, idle-2.png, ...). `ms` per frame animates; without
  // it each tile keeps one frame picked by its position.
  const HAZARD_ART = {
    brushfire: { folder: "brushfire", frames: 5, ms: 150, width: 0.95, tint: "#d75b3255" },
    creeper: { folder: "creeper", frames: 6, ms: 0, width: 0.98, tint: "#3f7a3a40" },
    flashFlood: { folder: "flash-flood", frames: 6, ms: 180, width: 1.25, tint: "#43b6c555" },
  };
  // Weather drawn over the map (sprites/weather/, cut from "Rain Effecs Sprites.png"). Each entry tiles one translucent
  // sheet across the field and slides it along `drift` (tiles of its own size per second). Only weather listed here is drawn.
  const WEATHER_ART = {
    rain:   { folder: "weather", frame: "rain-3", widthTiles: 3, alpha: 0.45, drift: [0, 1.1] },
    squall: { folder: "weather", frame: "rain-slant-3", widthTiles: 3, alpha: 0.6, drift: [-1.3, 1.3] },
  };
  // Where the copies of a w × h sheet go to cover a W × H field at time `seconds`: whole coverage, sliding without a jump.
  function weatherTiles(art, w, h, W, H, seconds) {
    const wrap = (v, m) => ((v % m) + m) % m, ox = wrap(seconds * art.drift[0] * w, w), oy = wrap(seconds * art.drift[1] * h, h), out = [];
    for (let y = oy - h; y < H; y += h) for (let x = ox - w; x < W; x += w) out.push([x, y]);
    return out;
  }
  // The small markers above a unit on the map. `icon` names a picture in sprites/fx/status/ (the status set that was
  // imported and unused until 2026-10-11); a marker without one, or whose picture has not loaded, is a lettered disc.
  // Sprite-drawn units used to show no marker for poison at all, and nothing showed burning, soothing, lodged seeds,
  // infection or drink.
  function statusMarks(a, options = {}) {
    return root.ConceptCombatStatus?.marks(a, options) || [];
  }
  // Landscape Lexicon terms that have a five-panel teaching strip (web/combat/lexicon/<slug>.webp). Keyed by the
  // term's slug in landscape-catalog.js.
  const LEXICON_ART = ["borrowed-scenery", "compression-and-release", "desire-line", "edge-effect", "negative-space-ma", "mystery", "succession"];
  // Illustrated terms first while nothing is being searched for, otherwise the catalog's own order.
  const lexiconOrder = (terms, query) => query ? terms : [...terms.filter((t) => LEXICON_ART.includes(t.slug)), ...terms.filter((t) => !LEXICON_ART.includes(t.slug))];
  // Which sky is behind the arena. `dim` is how much dark is laid over the picture; `unlit` is what is drawn while the
  // picture has not loaded (nothing for day, so a slow load never darkens a daytime field).
  const SKY = { storm: { image: "storm", dim: 0.3, unlit: 0.6 }, night: { image: "night", dim: 0.35, unlit: 0.9 }, day: { image: "day", dim: 0.25, unlit: 0 }, astral: { image: "astral", dim: 0.35, unlit: 0.9 } };
  const STORM_WEATHER = ["rain", "squall"];
  function skyFor(s) {
    if (!s) return null;
    if (s.astral?.ready && Object.values(s.actors || {}).some((a) => a.soulOf && !a.defeated && !a.returned)) return SKY.astral;   // a soul out on the plane re-skins the scene; once the plane collapses the world's own sky returns
    if (s.weatherState && STORM_WEATHER.includes(s.weatherState.id) && !s.dreamSpace) return SKY.storm;
    return s.time ? SKY[s.time.phase] || null : null;
  }
  const hazardFrame = (art, spot, now) => { const i = (art.ms ? Math.floor(now / art.ms) + spot : spot) % art.frames; return i ? `idle-${i + 1}` : "idle"; };
  const boonLine = (t) => [t.lf ? `+${t.lf} LF` : "", t.ward ? `Ward +${t.ward}` : "", ...t.gained].filter(Boolean).join(" · ");

  // A duel scene lasts 1.6 s, which is too short to read a sentence: each belief scene is followed by a held copy of
  // itself (everything already shown, no replayed motion), giving it 3.2 s. Skip still closes it at once.
  const heldBeliefScenes = (scenes) => scenes;   // kept for callers: belief scenes are now simply long enough to read (ms: TEXT_SCENE_MS)

  // Opening a Dream Space is a scene (Muse's task, 2026-10-11): the opener alone, in the dream-open pose, with what the
  // space gives them. It plays FIRST, before anything the action went on to do. Triggers:
  //   - any unit opens a Dream Space (the dreamSpace action), player or enemy;
  //   - a believer's dream lets creatures through (the monsterSummon action with dream creatures).
  const DREAM_TIMELINE = { open: 300, flare: 900, leave: TEXT_SCENE_MS - SCENE_LEAVE_MS };
  function dreamScenes(after, action = {}, entries = []) {
    const unit = after?.actors?.[action.actor]; if (!unit) return [];
    if (action.type === "dreamSpace") {
      const lines = entries.filter((e) => (e.kind === "dreamSpace" || e.kind === "dream_opened") && (!e.actor || e.actor === unit.id) && e.text).map((e) => e.text).slice(0, 2);
      if (!lines.length) return [];
      return [{ kind: "dream", cause: "opened", unit: { ...unit }, name: `${unit.name} opens the Dream Space`, lines, pose: "dream-open", timeline: DREAM_TIMELINE, ms: TEXT_SCENE_MS }];
    }
    if (action.type === "monsterSummon") {
      const came = entries.filter((e) => e.kind === "dreamAppear" && e.target === unit.id);
      if (!came.length) return [];
      return [{ kind: "dream", cause: "called", unit: { ...unit }, name: `${unit.name}'s dream opens`, lines: came.map((e) => e.text).slice(0, 2), pose: "dream-open", timeline: DREAM_TIMELINE, ms: TEXT_SCENE_MS }];
    }
    return [];
  }

  function closeupScenes(before, after, action, events = []) {
    const unit = (state,id) => state?.actors?.[id] || state?.wild?.find(u=>u.id===id);
    const dodge = dodgeScene(before, after, action);
    const groups = new Map();
    for (const event of events) {
      if (event.kind !== "damage" || !event.actor || !event.target || event.actor===event.target) continue;
      const source=unit(before,event.actor),target=unit(before,event.target)||unit(after,event.target);
      if(!source||!target)continue;
      const key=event.actor+":"+(event.ability||action.ability||action.type);
      const ability=event.ability||action.ability;
      const name=ability==="overwatch"?"Overwatch Triggered":ability==="opportunity"?"Opportunity attack":C.abilities[ability]?.name || (action.type==="strike"?"Strike":"Attack");
      if(!groups.has(key))groups.set(key,{source:{...source},ability,name,targets:[],pose:scenePose(action,event)});
      const scene=groups.get(key),existing=scene.targets.find(t=>t.before.id===target.id);
      if(existing){existing.amount+=event.amount||0;existing.warded+=event.warded||0;existing.wardBroke||=!!event.wardBroke;}
      else scene.targets.push({before:{...target},after:{...(unit(after,event.target)||target)},amount:event.amount||0,warded:event.warded||0,wardBroke:!!event.wardBroke});
    }
    const hits = [...groups.values()].map(scene=>({...scene,melee:Math.max(...scene.targets.map(t=>Math.abs(scene.source.x-t.before.x)+Math.abs(scene.source.y-t.before.y)))<=1}));
    return dodge ? [dodge, ...hits] : hits;                                        // the dodge plays first, then whoever was still hit
  }

  function mount(host, opts = {}) {
    const params = opts.params || {};
    const fxTiming = { scale: params.fast ? 0 : 1.18, cap: params.fast ? 0 : 880 };
    const U = { s: null, actions: [], setupOpts: null, mode: "setup", sel: null, hover: null, cursor: [1, 2], fx: [], poseUntil: {}, actionCues: {}, facing: {}, transformAnimations: {},
      timer: null, raf: 0, fxPlayer: FX?.createPlayer?.() || null, fxFrame: null, menu: "root", menuIndex: 0, graph: { kind: "opposition", unknown: true, edge: null }, reveal: false, announce: true,
      llmEnabled: !!opts.llmBridge && !!params.socket, llmConnection: null, llmFailed: false, llmReady: true, llmSeq: 0, llmAbort: null, llmPaused: false, llmError: "", llmEpoch: 0, llmActorId: null, agentSessionUsed: false, llmBattleId: `loci-${Date.now().toString(36)}`, destroyed: false,
      report: null, reward: null, answered: null, deception: false, overclock: 0, quickened: "", prunePart: "foliage", gap: "north", sectionAxis:"row", projectionProperty:"height", projectionAxis:"east", fragmentKind:"cover", fragmentId:null, montageParts:["","",""], prototypeSource:"", recombineParts:["","",""], whatIfAs:"", observeInvest: 20, insightTarget: null, bubbles: [], packSelection: [], potSelection: [], pendingSummon: null, dialogueOn: store.get("loci:combat:dialogue", true), profile: store.get(PROFILE_KEY, { xp: 0, level: 1 }) };
    const testBattle = () => !!(params.autoplay || params.steps || U.setupOpts?.testMenu || U.setupOpts?.devPlayground || /\btest\b|playground/i.test(U.setupOpts?.title || ""));   // test menu, playground and autoplay battles save nothing
    U.llmSettings = store.get("loci:llm:settings", { provider: "fake", baseURL: "http://127.0.0.1:1234/v1", model: "" });
    try {
      const raw = store.get(ACCOUNT_KEY, null);
      U.account = Loot.withBags(raw ? A.deserialize(raw) : A.fromLegacyProfile(U.profile, { name: "Warden" }));
    } catch (error) {
      console.warn("Loci account save could not be read; starting from the compatible XP profile.", error); recordDiagnostic("Account load failed; using compatible XP profile",error);
      U.account = Loot.withBags(A.fromLegacyProfile(U.profile, { name: "Warden" }));
    }
    U.profile = { ...U.profile, xp: U.account.xp, level: U.account.level };
    U.account.cognitive ||= INS?.emptyCognitive?.() || { subjects: {}, kinds: {} };
    U.account.self ||= INS?.createSelf?.({ seed: U.account.created || U.account.name || 0, catalogAdditions: MIR?.data?.catalogAdditions || [] }) || { version: 1, traits: [] };
    U.account.mirror ||= { dreamsBefriended: [] };
    function recordDiagnostic(context,error,actor=null,action=null) {
      const message=error?.message||String(error||"Unknown error");
      const entry={at:new Date().toISOString(),round:U.s?.round||0,kind:"system",actor,context,error:message,action,stack:error?.stack||null,build:U.s?.build||root.ConceptCombatVersion||"dev",text:`${context}: ${message}`};
      if(U.s)U.s.log.push(entry);
      const saved=store.get("loci:combat:diagnostics:v1",[]);const entries=Array.isArray(saved)?saved:[];entries.push(entry);store.set("loci:combat:diagnostics:v1",entries.slice(-50));
      return message;
    }
    // A test battle saves nothing (Mala, 2026-10-27): its start snapshots the account, saves wait, and the result restores it.
    const factCtx = () => (PF ? { heard: U.account?.plantFacts || {} } : null);
    const saveAccount = () => { if (U.testSnapshot) return; store.set(ACCOUNT_KEY, A.serialize(U.account)); };
    // Restores the account a test battle began with (its end, or leaving it for town, setup or the account screen).
    const endTestBattle = () => {
      if (!U.testSnapshot) return;
      U.account = A.deserialize(U.testSnapshot); U.testSnapshot = null; U.profile = { xp: U.account.xp, level: U.account.level };
      store.set(ACCOUNT_KEY, A.serialize(U.account)); store.set(PROFILE_KEY, U.profile);   // and the stored copy, undoing any write that slipped in (the pack step saves before the battle is known to be a test)
    };
    { const savedChar = store.get(CHAR_KEY, null), fixed = savedChar && A.migratePaladinPair(savedChar); U.character = fixed || { primary: C.characters.warden.primary, secondary: C.characters.warden.secondary, lens: {} }; if (savedChar && fixed !== savedChar) store.set(CHAR_KEY, fixed); }   // a saved Paladin keeps the class: the old pair is re-slotted (account.js migratePaladinPair)
    const NEON_WARDEN="neo-warden-purple-neon", neonUnlocked=()=>(U.account?.level||0)>=(C.progression?.neonWardenLevel||200);
    U.spritePackages=store.get("loci:combat:sprite-packages",{});
    // Mala, 2026-10-27: "I hit level 200, but I didn't get the new warden outfit." A saved Warden outfit equal to the default
    // look (saved before the reward existed) outranked the level look. Once, when the reward is earned, that default is cleared
    // so the reward shows; the flag is set on the first unlocked load either way, so any outfit picked after it is respected.
    if (neonUnlocked() && !store.get("loci:combat:neon-warden-offered", false)) {
      if (U.spritePackages?.warden === C.characters.warden?.sprite) { delete U.spritePackages.warden; store.set("loci:combat:sprite-packages", U.spritePackages); }
      store.set("loci:combat:neon-warden-offered", true);
    }
    U.teachMode = !!store.get("loci:combat:teach-mode", false);   // setup screen toggle; cards come from teach/teach.js
    U.teach = { last: null, seen: [], asked: 0, right: 0, wisdom: 0 }; U.teachCard = null;
    U.character.classId ||= "warden";
    { const stored = store.get("loci:combat:saved-characters", []), list = Array.isArray(stored) ? stored : []; U.savedCharacters = list.map(A.migratePaladinPair); if (U.savedCharacters.some((c, i) => c !== list[i])) store.set("loci:combat:saved-characters", U.savedCharacters); }
    U.setupPanels={scenarios:false,character:false,index:false,threat:false};
    // The town is the home screen in the app (app.js passes town: true) and in the harness with ?town; tests and
    // autostarted battles keep the classic menu. menuView is "town" or "classic"; a door sets "classic" with its panel open.
    U.townOn = !!(TOWN && (opts.town || params.town) && !params.autostart); U.menuView = U.townOn ? "town" : "classic"; U.town = null;
    U.setupLenses = U.character.lens || {};
    const voice = root.ConceptCombatVoice && root.EnemyDialogue && root.ConceptCombatBaseGrammar && root.ConceptCombatSpeakers
      ? root.ConceptCombatVoice.create({ tracery: root.EnemyDialogue, grammar: root.ConceptCombatBaseGrammar,
        speakers: root.ConceptCombatSpeakers, characters: C.characters,
        summonVoices: root.ConceptCombatSummonVoices, dreamVoices: root.ConceptCombatDreamVoices }) : null;
    U.sheet = "warden"; U.setupEncounter = null;
    U.fullAnimation = store.get("loci:combat:full-animation", !matchMedia("(prefers-reduced-motion: reduce)").matches); U.closeup=null;
    U.pace = store.get("loci:combat:pace", "normal") === "slow" ? "slow" : "normal"; setPace(U.pace); U.reading = null; U.logCap = null;
    host.innerHTML = `
      <div class="cc">
        <div class="cc-main">
          <div class="cc-banner" id="ccBanner"></div>
          <section id="ccAgentControls" class="cc-agent-controls" aria-label="Live agent connection" hidden>
            <div class="cc-agent-row"><strong id="ccAgentStatus" role="status"></strong><button type="button" id="ccAgentReconnect">Reconnect agent</button><button type="button" id="ccAgentBuiltin">Use built-in AI</button></div>
            <details id="ccAgentConnection"><summary>Connect your agent</summary><p>Copy this command into your active agent chat. Keep that chat working while you play.</p><div class="cc-agent-row"><input id="ccAgentCommand" aria-label="Agent connection command" readonly><button type="button" id="ccAgentCopy">Copy agent command</button></div></details>
          </section>
          <div class="cc-arena"><canvas id="ccCanvas"></canvas><div class="cc-board-tabs" id="ccBoardTabs" role="tablist" hidden><button type="button" data-board="land" title="The material map">World</button><button type="button" data-board="pocket" title="The astral pocket, where the souls fight">Astral plane</button></div><div class="cc-view" id="ccView" hidden><button type="button" id="ccIso" title="Switch this arena between the flat board and the isometric view. Rules are the same in both.">View: Flat</button><button type="button" id="ccIsoCut" title="Hide the parapet, rails and canopy so nothing stands in front of the fighters">Cutaway Off</button></div><div class="cc-zoom" id="ccZoom" hidden><button type="button" id="ccFollowPaused" title="You moved the camera, so Follow is paused until the next unit acts. Click to follow again." hidden>Follow paused</button><button type="button" id="ccFollow" title="Follow: the camera eases to a close-up of the unit that is acting, walks with it as it moves, and frames both units when it acts on another (after the attack close-up closes, if one plays). Off: the camera is yours; turning it off returns the board to your saved zoom, centred.">Follow: Off</button><button type="button" id="ccCenter" title="Centre the camera on your character (C)">Center</button><button type="button" id="ccZoomOut" title="Zoom out (−)">−</button><button type="button" id="ccZoomPct" title="Reset zoom (0)">100%</button><button type="button" id="ccZoomIn" title="Zoom in (+)">+</button></div><div class="cc-tip" id="ccTip" hidden></div><aside class="cc-unitinfo" id="ccUnitInfo" aria-label="What you know about this unit" aria-live="polite" hidden></aside></div>
          <div class="cc-windows">
            <div class="cc-win cc-cmd" id="ccCmd"></div>
            <div class="cc-win cc-detail" id="ccDetail"></div>
            <div class="cc-win cc-party" id="ccParty"></div>
          </div>
        </div>
        <aside class="cc-side">
          <div class="cc-side-head"><b>Battle log</b><span class="cc-spacer"></span><button type="button" id="ccBestiaryBattle" title="Open monster bestiary">Bestiary</button>
            <button type="button" id="ccCopy" title="Copy the battle log as text">Copy log</button>
            <button type="button" id="ccAnimation" title="Full: enlarged attack pop-up. Fast: current map effects only.">Animation: Full</button>
            <button type="button" id="ccPace" title="Normal: current speed. Slow: scenes last twice as long and each enemy action waits long enough to read. Space or a click on the log skips a wait.">Pace: Normal</button>
            <button type="button" id="ccDialogue" title="Toggle enemy dialogue bubbles">Dialogue On</button>
            <button type="button" id="ccGraphBtn" title="Concept relationship map (G)">Concept map</button></div>
          <ol class="cc-log" id="ccLog"></ol>
        </aside>
        <div class="cc-attack-popup" id="ccAttackPopup" role="dialog" aria-modal="true" aria-label="Attack close-up" hidden></div>
        <div class="cc-graph" id="ccGraph" hidden></div>
        <div class="cc-overlay" id="ccOverlay" hidden></div>
      </div>`;
    const $ = (id) => host.querySelector("#" + id);
    // Explicit developer opt-in; normal games allocate no inspector or trace history.
    let decisionInspector = null, decisionInspectorPanel = null, decisionInspectorButton = null, pendingInspectedDecision = null;
    function openDecisionInspector() {
      if (decisionInspector || !root.ConceptCombatDecisionInspector) return;
      const panel = document.createElement("div"); panel.className = "emissary-drawer"; panel.hidden = true; host.querySelector(".cc").appendChild(panel);
      decisionInspectorPanel = panel;
      decisionInspector = root.ConceptCombatDecisionInspector.mount(panel);
      const close = document.createElement("button"); close.type = "button"; close.textContent = "Close inspector"; panel.prepend(close);
      const button = document.createElement("button"); button.type = "button"; button.textContent = "AI inspector"; button.id = "ccDecisionInspector";
      decisionInspectorButton = button; $("ccCopy").parentElement.appendChild(button);
      const hide = () => { panel.hidden = true; button.focus(); };
      close.onclick = hide;
      button.onclick = () => { panel.hidden = false; panel.querySelector("details").open = true; close.focus(); };
    }
    if (params.emissary === true || params.emissary === "1") openDecisionInspector();
    const cv = $("ccCanvas"), g = cv.getContext("2d");
    const worldImages = new Map();
    let spritesDrawn = [];   // the plant and object art the last frame drew, for checks (board.sprites)
    const spriteLog = (group, id, o) => { spritesDrawn.push({ group, id, object: o.id, x: o.x, y: o.y, dead: !!o.dead }); };
    // Wall art for upright barriers (Muse's cut of ~/Downloads/Walls & Barriers.png, 2026-10-14; installed 2026-10-15).
    // A Shield Wall looks like the owner's other concept; flat ground effects (berm, swale, mulch, smoke) keep their drawing.
    const WALL_ART = { pair: { elasticity: "bamboo-5", interposition: "gate-royal-blue", inertia: "stone-boulder-wall", boundary: "hedge-wall",
      pruning: "spikes-wood-wide", swale: "water-curtain-block", berm: "sandstone-block" }, barrier: "stone-brick-round", boundary: "roots-wall", fence: "spikes-wood-low", architect: "brick-gray" };
    function wallArt(s, b) {
      if (["berm", "swale", "mulch", "smoke"].includes(b.concept) || b.passiveGround) return null;
      if (b.architectDesign) return WALL_ART.architect;
      if (b.concept === "boundary" || b.concept === "fence") return WALL_ART[b.concept];
      const own = s.actors[b.owner], other = own && (own.primary === "barrier" ? own.secondary : own.secondary === "barrier" ? own.primary : null);
      return WALL_ART.pair[other] || WALL_ART.barrier;
    }
    // Ground tile sets for the isometric board (Mala, 2026-10-19: Tileset 2 is ground tiles). An arena opts in with
    // visual.groundTiles; each cell draws one block from the family its terrain belongs to, the variant picked from the cell's
    // position so the same map always looks the same. Ramps, bridges and walls keep the sculpted drawing.
    const groundOf = (paving) => (ch) => ch === "." || ch === "=" ? paving : ch === "," || ch === "h" || ch === "T" ? "grass" : ch === "m" || ch === "*" || ch === "^" ? "dirt" : ch === "w" || ch === "~" ? "water" : null;
    const GROUND_TILES = { ts2: { folder: "ground-ts2", families: { concrete: 34, grass: 22, dirt: 23, water: 22 }, of: groundOf("concrete") },
      ...(MAPD ? { ts1: { ...MAPD.TILESETS.ts1, of: groundOf("stone") } } : {}) };   // the Tile Set (sprites/objects/tiles): stone for quarries and rims
    // Surfaces the isometric view lays on the world plane (Mala, 2026-10-27: "texture everything", "actual terrain instead of
    // grey blob"; textures from her anime grass and concrete atlas, sprites/objects/textures/). Tops: clean concrete, one panel a
    // tile; steel and water keep their own colour, soil and turf take the terrain. The apron outside the board: grass on green
    // maps, weathered concrete on courts and stone maps, three tiles to one image so it reads as open land, not a grid.
    const topTextureKeys = new Set();   // only these loads rebake the iso scene
    if (ISO) ISO.surface = (kind, f) => {
      if (!U.s) return null;
      const set = GROUND_TILES[MAPD ? MAPD.groundSet(U.s.arena) : U.s.arena?.visual?.groundTiles];
      const pal = { soil: "#8c785b", bulkhead: "#8f97a3", turf: "#87966b", water: "#75a6a2", ramp: "#b94936", ...(U.s.arena.visual?.palette || {}) };
      const tex = (name, tiles) => { const id = `textures/${name}`; topTextureKeys.add(`objects/${id}`); const img = worldSprite("objects", id); return img ? { img, tiles } : null; };
      const green = !!set?.families?.grass && !/court|plaza|quarry|rim/i.test(U.s.arena?.archetype || U.s.arena?.id || "");
      if (kind === "apron") return green ? tex("grass-anime", 3) : tex("concrete-weathered", 6);   // concrete images are 2x2 mirrored (seamless), two panels across: 6 tiles keeps a panel at 3
      const col = String(f.color || "").toLowerCase(), is = (k) => pal[k] && col === String(pal[k]).toLowerCase();
      if (is("bulkhead") || is("water") || is("ramp")) return null;
      if (is("turf")) return tex("grass-anime", 3);
      if (is("soil")) return null;   // soil blocks keep their earth colour until a dirt texture lands
      return tex("concrete-clean", 2);   // 2x2 mirrored image: one panel a tile
    };
    function groundTiles(s, set) {
      for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) {
        const fam = set.of(E.geometry.surfaceAt(s, x, y)); if (!fam) continue;
        const n = set.families[fam], k = ((x * 73856093) ^ (y * 19349663) ^ (s.arena.visual?.seed || 0)) >>> 0, id = Array.isArray(n) ? `${set.folder}/${n[k % n.length]}` : `${set.folder}/${fam}-${String(1 + (k % n)).padStart(2, "0")}`;   // a count (numbered files) or a list of names
        onGround(x, y, (px, py) => { const img = worldSprite("objects", id); if (!img) return; groundDrawn++; const w = geo.tw, h = w * img.naturalHeight / img.naturalWidth; g.drawImage(img, px, py, w, h); }, false);
      }
    }
    function worldSprite(group, id) {
      if (!id || !["objects", "items", "plants", "walls"].includes(group)) return null;
      const key = `${group}/${id}`;
      if (!worldImages.has(key)) {
        const img = new Image(); img.src = new URL(`combat/sprites/${key}.png`, document.baseURI).href;
        img.onload = () => { if (ISO && topTextureKeys.has(key)) ISO.textureEpoch++; if (U.s) draw(); }; img.onerror = () => worldImages.delete(key); worldImages.set(key, img);   // a loaded texture rebakes the iso scene
      }
      const img = worldImages.get(key); return img.complete && img.naturalWidth ? img : null;
    }
    const poseSprites = Object.fromEntries(Object.entries({ ...SPRITE_DIR, "gaia-form": "gaia-form" }).map(([character, folder]) => [character,
      Object.fromEntries((SPRITE_POSES[folder] || PLAYER_POSES).map((pose) => {
        const img = new Image(); img.src = new URL(`combat/sprites/${folder}/${pose}.png`, document.baseURI).href;
        img.onload = () => { if (U.s) draw(); };
        return [pose, img];
      }))]));
    // A package outside the fixed list (a communed plant's form), loaded the first time it is needed. A folder that
    // does not exist leaves the unit on its token: the six images simply never complete.
    // Packages loaded at play time (communed forms) never had a facing registered, so all were drawn as right-facing.
    // Nearly all are; the Indian hawthorn's art faces left, so it attacked facing away from its target (Mala's screenshot
    // via Muse, 2026-10-14). Muse's fix made every dynamic package left-facing, which would have turned the other 18
    // around; the left-facing ones are listed instead (checked pose by pose on a contact sheet).
    const LEFT_FACING_PACKAGES = new Set(["commune-bamboo", "commune-indianHawthorn", "commune-monkeypod", "commune-nativeFern"]);
    function loadSpritePackage(folder) {
      SPRITE_DIR[folder] = folder;
      SPRITE_FACES_RIGHT[folder] = !LEFT_FACING_PACKAGES.has(folder);
      poseSprites[folder] = Object.fromEntries(PLAYER_POSES.map((pose) => {
        const img = new Image(); img.src = new URL(`combat/sprites/${folder}/${pose}.png`, document.baseURI).href;
        img.onload = () => { if (U.s) draw(); };
        // Communed fallback (Mala, 2026-10-20): a commune-* package that never landed (no A'ali'i yet)
        // borrows the Forest Spirit's pose instead of collapsing to token primitives. Per-pose, so a
        // partial package keeps its own art and only the missing drawings stand in.
        if (folder.startsWith("commune-")) img.onerror = () => {
          const standIn = poseSprites.forest_spirit?.[pose];
          if (standIn) { poseSprites[folder][pose] = standIn; SPRITE_FACES_RIGHT[folder] = !!SPRITE_FACES_RIGHT.forest_spirit; if (U.s) draw(); }
        };
        // Tsukumogami (Muse Berry BD): a tsukumogami-<type> package that never landed borrows the generic
        // house mecha's pose per missing drawing. Per-pose, so a partial package keeps its own art.
        if (folder.startsWith("tsukumogami-") && folder !== "tsukumogami-faces") img.onerror = () => {
          const standIn = poseSprites.tsukumogami?.[pose];
          if (standIn && standIn !== img) { poseSprites[folder][pose] = standIn; SPRITE_FACES_RIGHT[folder] = !!SPRITE_FACES_RIGHT.tsukumogami; if (U.s) draw(); }
        };
        return [pose, img];
      }));
    }
    // Optional pose slots (poses.js: cast-off, cast-def, dodge, ultimate). They are tried lazily: a package that lacks
    // the file falls down the slot's chain, and while an optional file is still loading the fallback art is shown.
    const POSES = root.ConceptCombatPoses;
    const SPRITE_EXTRAS = root.ConceptCombatSpriteManifest?.extras || {};
    // A communed plant is drawn as commune-<species>; every species with a communion profile ships art except A'ali'i
    // (communable, shrub form, but no commune-aalii folder), which has no commune- or treeant- folder and falls back to
    // the shared treant art (RETURN-2 T-1).
    const SPRITE_FOLDERS = new Set(root.ConceptCombatSpriteManifest?.folders || []);
    const communeArt = (key) => !key || !key.startsWith("commune-") || !SPRITE_FOLDERS.size || SPRITE_FOLDERS.has(key) ? key
      : SPRITE_FOLDERS.has("treeant-" + key.slice(8)) ? "treeant-" + key.slice(8) : "treant";
    // Tsukumogami: a type with no package of its own shows the generic house mecha.
    const tsukumogamiArt = (key) => !key || !key.startsWith("tsukumogami-") || key === "tsukumogami-faces" || !SPRITE_FOLDERS.size || SPRITE_FOLDERS.has(key) ? key : "tsukumogami";
    const folderOf = (spriteKey) => SPRITE_DIR[spriteKey] || (spriteKey === "gaia-form" ? spriteKey : null);
    const optionalPose = new Map();                                   // "folder/pose" → Image | false (missing)
    function poseFile(spriteKey, pose) {
      const set = poseSprites[spriteKey]; if (set?.[pose]) return set[pose];
      const folder = SPRITE_DIR[spriteKey] || (spriteKey === "gaia-form" ? spriteKey : null);
      const listed = SPRITE_EXTRAS[folder];                           // sprite-manifest.js: what the package really has
      if (!folder || (listed ? !listed.includes(pose) : !POSES?.OPTIONAL.includes(pose))) return null;
      const key = `${folder}/${pose}`;
      if (!optionalPose.has(key)) {
        const img = new Image(); img.src = new URL(`combat/sprites/${key}.png`, document.baseURI).href;
        img.onload = () => { if (U.s) draw(); }; img.onerror = () => optionalPose.set(key, false); optionalPose.set(key, img);
      }
      return optionalPose.get(key) || null;
    }
    // The pose name and image a unit actually shows for a slot, after fallbacks.
    // variantKey picks between alternates (block.png / block-2.png): the same key always shows the same drawing.
    function resolvePose(spriteKey, slot, variantKey = "") {
      const extras = SPRITE_EXTRAS[folderOf(spriteKey)] || [];
      for (const pose of (POSES ? POSES.chain(slot) : [slot, "idle"])) {
        const img = poseFile(spriteKey, pose);
        if (!(img && img.complete && img.naturalWidth)) continue;
        const alt = POSES ? POSES.variant(pose, POSES.variantCount(pose, extras), variantKey) : pose;
        if (alt !== pose) { const altImg = poseFile(spriteKey, alt); if (altImg && altImg.complete && altImg.naturalWidth) return { pose: alt, img: altImg }; }
        return { pose, img };
      }
      return { pose: "idle", img: poseSprites[spriteKey]?.idle || null };
    }
    const transformImages = new Map();
    function transformImage(folder, frame) {
      const key = `${folder}/${frame}`;
      if (!transformImages.has(key)) {
        const img = new Image(); img.src = new URL(`combat/sprites/${key}.png`, document.baseURI).href;
        img.onload = () => { if (U.s) draw(); }; img.onerror = () => transformImages.delete(key); transformImages.set(key, img);
      }
      const img = transformImages.get(key); return img.complete && img.naturalWidth ? img : null;
    }
    const headImages = new Map();
    function headImage(speaker, face) {
      if (!speaker || !face) return null;
      const key = `${speaker}/heads/${face}`;
      if (!headImages.has(key)) {
        const img = new Image(); img.src = new URL(`combat/sprites/${key}.png`, document.baseURI).href;
        img.onload = () => { if (U.s) draw(); }; img.onerror = () => headImages.delete(key); headImages.set(key, img);
      }
      const img = headImages.get(key); return img.complete && img.naturalWidth ? img : null;
    }
    const wildPoseImages = new Map();
    function wildSprite(kind, pose) {
      const folder = kind === "feralPig" ? "feral-pig" : kind === "termites" ? "termites" : kind === "gaia" ? "gaia-wounded" : kind === "nettleCaterpillar" ? "nettle-caterpillar" : kind === "wolf" ? "wolf" : kind === "ducks" ? "ducks" : kind === "sasquatch" ? "sasquatch" : kind === "moa" ? "moa" : kind === "porgy" ? "porgy" : null;
      if (!folder) return null;
      const key = `${folder}/${pose}`;
      if (!wildPoseImages.has(key)) {
        const img = new Image(); img.src = new URL(`combat/sprites/${key}.png`, document.baseURI).href;
        img.onload = () => { if (U.s) draw(); }; img.onerror = () => wildPoseImages.delete(key); wildPoseImages.set(key, img);
      }
      const img = wildPoseImages.get(key); return img.complete && img.naturalWidth ? img : null;
    }
    let geo = { T: 64, tw: 64, th: 40, lip: 8, ox: 0, oy: 0 };

    // ── setup ───────────────────────────────────────────────────────────────
    const LOADOUTS = {
      be: { primary: "barrier", secondary: "elasticity", label: "Barrier primary + Elasticity secondary",
        note: "Your walls are springy: an opposing line stopped at your wall rebounds 50% to its shooter now. Ultimate: Bastion Collapse (radius 3)." },
      eb: { primary: "elasticity", secondary: "barrier", label: "Elasticity primary + Barrier secondary",
        note: "Same two concepts, reversed: your walls store a stopped line and release 60% at the shooter's next turn start. Ultimate: Recoil Cascade (piercing line)." },
    };
    const npcRoster = Object.entries(C.characters).filter(([id, ch]) => id !== "warden" && !ch.randomEventOnly && ch.configs).map(([id, ch]) => ({ id, ...ch }));
    U.setupFoe ||= npcRoster[0]?.id || "student"; U.setupAlly ||= npcRoster.find(n=>n.id!==U.setupFoe)?.id || "pathfinder"; U.selectionRole ||= "foe";
    const classBlurbs = { fieldBotanist: "Knows every plant on the field by name: grows them, cuts them, and reads what they say about the ground.", actor: "A staged signal can pull attention away from the real action.", supermodel: "Owns the sightline; anyone stepping into the pose breaks the line.", agi: "Adapts by comparing the current state with a target, one response at a time.", scientist: "Waits for a declared condition, then acts on what the evidence supports.", animalTamer: "Turns a resonance pulse into a delayed rhythm in plant life.", policeOfficer: "Uses boundaries and thresholds to shape access and timing.", architect: "Makes a boundary with one declared opening that other routes can still bypass.", soldier: "Holds position and protects the ally directly behind.", yogaInstructor: "Stores resisted motion and returns it through elasticity.", gardener: "Uses swales to slow and store runoff, turning a nearby soil tile into mulch.", arborist: "Uses tree protection and structural barriers to control one shared edge.", rainkeeper: "Reads grade and water paths, redirecting runoff through a swale.", mason: "Builds raised berms and barriers; a tower trades movement for cover.", surveyor: "Reads the open or blocked sightline before committing a shot.", director: "Traps one opponent on a pocket set with a random co-star; the premiere pays out at CUT." };
    const primaryOf = n => n.primary || n.configs?.[0]?.primary;
    const blurbFor = (n) => classBlurbs[n.id] || `${C.concepts[primaryOf(n)]?.name || "Landscape"} specialist: ${C.concepts[primaryOf(n)]?.mechanism || "Uses the terrain to shape a tactical choice."}`;
    const spriteImg = (key, alt, cls="") => SPRITE_DIR[key] ? `<img class="${cls}" src="combat/sprites/${SPRITE_DIR[key]}/idle.png" alt="${esc(alt)}">` : `<span class="${cls} cc-generated-sprite" role="img" aria-label="${esc(alt)}"><svg viewBox="0 0 64 92" aria-hidden="true"><path d="M14 33 8 63h10l7-18-2 22h18l-2-22 7 18h10l-6-30-9-7H23z" fill="${SPRITE[key]||"#9ad1ff"}" stroke="#111a34" stroke-width="4"/><circle cx="32" cy="17" r="12" fill="#e7c6a4" stroke="#111a34" stroke-width="4"/><path d="M19 18Q20 3 32 4q13 0 14 14" fill="${SPRITE[key]||"#9ad1ff"}" stroke="#111a34" stroke-width="4"/><rect x="26" y="39" width="12" height="25" rx="2" fill="#26314d"/></svg></span>`;
    const wildCards = Object.entries(W?.data?.monsters || {}).map(([id,m]) => ({id:`wild:${id}`,name:m.name,kind:"Landscape",concept:C.concepts[m.concept]?.name || m.concept,blurb:m.teaches || m.basis,sprite:null,art:null,wildSprite:id === "feralPig" ? "feral-pig" : id === "termites" ? "termites" : id === "gaia" ? "gaia-wounded" : m.sprite || null}));
    // What a wild creature does, written from its own numbers (wild/monsters-data.js) so the Bestiary cannot drift from play.
    const plantName = (id) => (root.ConceptCombatVegetation?.species?.[id]?.common || id.replace(/([A-Z])/g, " $1")).toLowerCase();
    function wildBehaviour(m) {
      const out = [];
      if (m.form === "unit" && m.lf) out.push(`${m.lf} LF, moves ${m.move}.`);
      if (m.hosts?.length) out.push(`A leaf-eater, not a hunter: it heads for ${m.hosts.map(plantName).join(", ")} and strips ${m.eat} HP a round from the plant it reaches.`);
      if (m.hostileRounds) out.push(`Docile until hurt. Keep away and it leaves you alone; whatever ends up beside it is stung for ${m.sting}.`);
      if (m.hostileRounds && m.spit) out.push(`Hurt it and it turns on whoever did it for ${m.hostileRounds} rounds (each new hit renews that): it stops feeding and spits for ${m.spit} from up to ${m.spitRange} tiles. The spit is not contact, so it carries no poison.`);
      if (m.poison) out.push(`Touching it poisons: a Strike or a contact technique against it, or its sting, leaves ${m.poison.label} for ${m.poison.minTurns} to ${m.poison.maxTurns} turns, costing ${m.poison.lf} LF and ${m.poison.apLoss} action points each turn. Poison never takes the last point of LF.`);
      if (m.curlBelow) out.push(`At ${Math.round(m.curlBelow * 100)}% LF or less it curls up: it stops moving, takes ${Math.round(m.curledDamageMul * 100)}% damage and stings everything beside it each round.`);
      if (m.ends?.length) out.push(`Ends: ${m.ends.join("; ")}.`);
      if (m.form === "unit" || m.form === "field") out.push("Wild: it never has to be cleared to win a battle.");
      return out;
    }
    const dreamCards = Object.entries(root.ConceptCombatDreamData?.monsters || {}).map(([id,m]) => ({id:`dream:${id}`,name:m.name,kind:"Dream",concept:m.configs.map(c=>`${C.concepts[c.primary]?.name||c.primary} + ${C.concepts[c.secondary]?.name||c.secondary}`).join(" / "),blurb:m.teaches,sprite:null,art:({last_span:"last_span",many_mouths:"dream_hound",witness_vessel:"dream_witness",amber_host:"dream_amber",salt_heir:"dream_salt",unfinished_customer:"dream_customer"})[id]||null}));
    const classicDreamCards = Object.entries(root.ConceptCombatEnemyDreams?.monsters || {}).map(([id,m]) => ({
      id:`enemyDream:${id}`, name:m.name, kind:m.broodOnly ? "The Insect Kaiju's brood" : `Dream Space · Tier ${m.beliefTier || 1}`, concept:m.concept,
      blurb:m.passive?.text || m.ability?.text || `A Dream Space creature drawn by belief. ${m.name} manifests through an enemy's conviction.`,
      sprite:m.broodOnly ? "brood-mite" : `dream-${id}`, art:m.broodOnly ? "brood-mite" : `dream-${id}`
    }));
    const bestiaryEntries = [...wildCards, ...dreamCards, ...classicDreamCards];
    function mainClass() { return C.characters[U.character.classId] ? U.character.classId : "warden"; }
    function mainDescription() {
      const id=mainClass(),ch=C.characters[id],data=root.ConceptCombatInsightData;
      const known=[...(INS?.publicProfileTraits?.(id)||[]),...(ch.traits||[]).filter(key=>data?.traits?.[key]?.open),...(U.account.self?.traits||[]).filter(t=>t.known).map(t=>t.id)];
      const traits=[...new Set(known)].map(key=>{const t=data?.traits?.[key] || (U.account.self?.traits||[]).find(t=>t.id===key);return `${t?.name||key}: ${t?.text||"Known class trait"}`;});
      const build=root.ConceptCombatClassBuilds?.builds?.[id];
      const skills=(build?.kit||[...new Set([U.character.primary,U.character.secondary].filter(Boolean).flatMap(key=>C.concepts[key]?.abilities||[]))]).map(key=>C.abilities[key]).filter(Boolean).map(a=>`${a.name}: ${a.announce||a.description||a.effect||"Class technique"}`);
      const talents=Object.entries(build?.passives||{}).map(([key,v])=>`${key.replaceAll("_"," ")}: ${v.trigger}. ${v.bound}.`);
      if(id==="arantxa") { const b=root.ConceptCombatBonds?.BONDS?.arantxa;skills.push(...[b?.blessing,b?.shared].filter(Boolean).map(v=>`${v.name}: ${v.text}`)); }
      if(id==="archivist") talents.push("Permanent ally: always fights on your side.");
      return [`${ch.name}`,`Known traits: ${traits.join("; ")||"None discovered yet"}`,`Unique skills: ${skills.join("; ")||"Uses the selected concept techniques"}`,`Innate talents: ${talents.join("; ")||"No separate innate talent recorded"}`].join("\n\n");
    }
    function naturalAllies() {
      const id=mainClass(),B=root.ConceptCombatBonds,items=[];
      for(const [key,b] of Object.entries(B?.BONDS||{})) if(b.partner==="player"&&key!==id) items.push({id:key,name:C.characters[key]?.name||key,sprite:C.characters[key]?.sprite,reason:`Maximum friendship with the main character. ${b.blessing.text} ${b.shared.text}`});
      for(const pair of B?.PAIRS||[]) if(pair.pair.includes(id)) { const key=pair.pair.find(k=>k!==id);items.push({id:key,name:C.characters[key]?.name||key[0].toUpperCase()+key.slice(1),sprite:C.characters[key]?.sprite||(root.ConceptCombatDreamData?.monsters?.[key] ? `dream-${key}` : key),reason:`Natural class pair: maximum friendship. ${pair.shared.name}: ${pair.shared.text}`}); }
      if(id!=="archivist")items.push({id:"archivist",name:"The Archivist",sprite:chosenSprite("archivist"),reason:"Permanent ally: she always joins your side and cannot become your enemy."});
      if(id!=="cyph")items.push({id:"cyph",name:"Cyph",sprite:chosenSprite("cyph"),reason:"Rapper and legal dispensary worker: brings curated verses and limited, willing-ally protection."});
      if(id!=="modern_artist")items.push({id:"modern_artist",name:"Modern Artist",sprite:chosenSprite("modern_artist"),reason:"Digital artist ally: combines finite workstations and rendering programs through Hardware + Software."});
      return items;
    }
    function selectMain(id) {
      const ch=C.characters[id];if(!ch)return;
      const config=ch.configs?.[0]||ch;
      U.character={classId:id,primary:ch.primary||config.primary,secondary:ch.secondary??config.secondary??"",lens:{...(ch.lens||config.lens||{})}};
      U.setupLenses=U.character.lens;store.set(CHAR_KEY,U.character);showSetup();
    }
    function setupPack() {
      const slots=Loot.battleSlots(U.account),names=U.packSelection.map(id=>Loot.data.consumables[id]?.name||id);
      const items=Object.entries(U.account.stash).filter(([id,n])=>n>0&&Loot.data.consumables[id]&&!Loot.data.consumables[id].outsideBattle);
      return `<details class="cc-item-pack" ${U.setupPanels.pack?"open":""}><summary>▣ Item pack <small>${U.packSelection.length}/${slots}</small></summary><div class="cc-pack-body"><p class="cc-muted">${names.map(esc).join(" · ")||"Nothing packed yet"}</p>${items.map(([id,n])=>{const item=Loot.data.consumables[id],planned=U.packSelection.filter(x=>x===id).length;return `<div class="cc-pack-item">${itemIcon(id,item.name)}<div><b title="${esc(item.text)}">${esc(item.name)}</b><small>Stash ${n} · packed ${planned}</small></div><button type="button" data-setup-pack="${id}" ${planned>=n||U.packSelection.length>=slots?"disabled":""} aria-label="Pack ${esc(item.name)}">＋</button><button type="button" data-setup-unpack="${id}" ${!planned?"disabled":""} aria-label="Unpack ${esc(item.name)}">−</button></div>`;}).join("")||`<p class="cc-muted">No battle items in your stash. The field shop and battle rewards supply items.</p>`}<div class="cc-row"><button type="button" id="ccSetupPackClear" ${!names.length?"disabled":""}>Clear pack</button><button type="button" id="ccAccount">Gear &amp; field shop ↗</button></div></div></details>`;
    }
    const GEAR_SLOT_LABEL = { head: "Head", body: "Body", feet: "Feet", tool: "Tool", charm: "Charm" };
    // ── Kit board (Mala, 2026-10-25: "change the inventory system to be drag and drop"). Drag items between the stash, the
    // battle pack and the camp kitchen's pot; drag gear onto its slot to wear it and off to store it. A click does the obvious
    // move too (stash → pack, pack or pot → stash, gear on ↔ off), and a double-click sends a stash food to the pot.
    function kitFree(id) { return (U.account.stash[id] || 0) - U.packSelection.filter((x) => x === id).length - U.potSelection.filter((x) => x === id).length; }
    function kitTile(kind, id, from, extra = "") {
      const it = kind === "gear" ? Loot.data.equipment[id] : Loot.data.consumables[id]; if (!it) return "";
      const prep = kind === "item" && Cook?.prepOf(id), tags = kind === "item" ? (Cook?.tagsOf(id) || []) : [];
      const tip = `${it.name}. ${it.text}${prep ? ` · ${prep === "raw" ? "raw" : prep === "dish" ? "a dish" : "ready to eat"}, ${Cook.rules.eatAp[prep]} AP to eat` : ""}${tags.length ? ` · ${tags.join(", ")}` : ""}`;
      return `<div class="cc-kit-tile${prep ? ` is-${prep}` : ""}" draggable="true" data-kit-kind="${kind}" data-kit-id="${esc(id)}" data-kit-from="${esc(from)}" title="${esc(tip)}" tabindex="0">${itemIcon(id, it.name)}${extra}</div>`;
    }
    function kitBoard() {
      U.potSelection = U.potSelection.filter((id, i, all) => all.slice(0, i + 1).filter((x) => x === id).length + U.packSelection.filter((x) => x === id).length <= (U.account.stash[id] || 0));
      const slots = Loot.battleSlots(U.account), stash = Object.entries(U.account.stash).filter(([id, n]) => n > 0 && Loot.data.consumables[id]);
      const stashTotal = stash.reduce((n, [, k]) => n + k, 0);
      const pack = Array.from({ length: slots }, (_, i) => U.packSelection[i] ? kitTile("item", U.packSelection[i], `pack:${i}`) : `<div class="cc-kit-empty">pack</div>`).join("");
      const pot = Array.from({ length: 3 }, (_, i) => U.potSelection[i] ? kitTile("item", U.potSelection[i], `pot:${i}`) : `<div class="cc-kit-empty">pot</div>`).join("");
      const gear = Loot.data.slots.map((slot) => { const id = U.account.gear.equipped[slot]; return `<div class="cc-kit-slot" data-kit-slot="${slot}"><small>${GEAR_SLOT_LABEL[slot]}</small>${id ? kitTile("gear", id, `gear:${slot}`) : `<div class="cc-kit-empty">·</div>`}</div>`; }).join("");
      const bag = U.account.gear.owned.filter((id) => !Object.values(U.account.gear.equipped).includes(id)).map((id) => kitTile("gear", id, "gearbag")).join("") || `<p class="cc-muted">No stored gear.</p>`;
      const can = Cook ? Cook.available(U.potSelection) : [];
      const book = Cook ? Object.entries(Cook.recipes).map(([rid, r]) => `<li class="${can.includes(rid) ? "is-ready" : ""}"><b>${esc(r.name)}</b> <small>${(r.from || r.needs).map((n) => esc(r.from ? Loot.data.consumables[n]?.name || n : n.replace("|", " or "))).join(" + ")} → ${esc(Loot.data.consumables[r.out]?.name || r.out)}${r.field ? " · field recipe" : " · full recipe"}</small></li>`).join("") : "";
      return `<section class="cc-kit"><div class="cc-kit-col"><h3>Stash · ${stashTotal}/${Loot.stashLimit(U.account)}</h3><div class="cc-kit-grid" data-kit-zone="stash">${stash.map(([id]) => { const n = kitFree(id); return kitTile("item", id, "stash", `<b class="cc-kit-n">${n}</b>`).replace('class="cc-kit-tile', `class="cc-kit-tile${n ? "" : " is-spent"}`); }).join("") || `<p class="cc-muted">Empty. Battles and the field shop fill it.</p>`}</div>
        <h3>Stored gear</h3><div class="cc-kit-grid" data-kit-zone="gearbag">${bag}</div></div>
        <div class="cc-kit-col"><h3>Battle pack · ${U.packSelection.length}/${slots}</h3><div class="cc-kit-slots" data-kit-zone="pack">${pack}</div>
        <h3>Worn gear</h3><div class="cc-kit-slots cc-kit-gear" data-kit-zone="gear">${gear}</div>
        <h3>Camp kitchen</h3><div class="cc-kit-slots" data-kit-zone="pot">${pot}</div>
        <div class="cc-kit-cook">${can.length ? can.map((rid) => `<button type="button" data-kit-cook="${rid}">Cook ${esc(Cook.recipes[rid].name)}</button>`).join("") : `<span class="cc-muted">${U.potSelection.length ? "No recipe uses these together." : "Drag ingredients into the pot."}</span>`}${U.potSelection.length ? `<button type="button" data-kit-empty-pot>Empty pot</button>` : ""}</div>
        <details class="cc-kit-book"><summary>Recipes</summary><ul>${book}</ul><p class="cc-muted">Anything cooks here between battles. In battle anyone can make a field recipe; cooks (Hedge Witch, Shaman, Hot Pot Berserker, herbal and traditional medicine) make them all. Eating costs AP by preparation: raw ${Cook?.rules.eatAp.raw}, ready ${Cook?.rules.eatAp.ready}, a dish ${Cook?.rules.eatAp.dish}.</p></details></div></section>`;
    }
    // One move on the board. from: stash | pack:i | pot:i | gear:slot | gearbag. to: stash | pack | pot | gear | gearbag.
    function kitMove(kind, id, from, to) {
      const [src, idx] = from.split(":"), item = Loot.data.consumables[id];
      const take = () => { if (src === "pack") U.packSelection.splice(+idx, 1); if (src === "pot") U.potSelection.splice(+idx, 1); };
      if (kind === "gear") {
        if (to === "gear" && src === "gearbag") { const r = Loot.equip(U.account, id); if (!r.ok) return flashTip(r.reason); U.account = r.account; saveAccount(); }
        else if ((to === "gearbag" || to === "stash") && src === "gear") { const r = Loot.unequip(U.account, idx); U.account = r.account; saveAccount(); }
        else return;
        return showAccount();
      }
      if (src === to) return;
      if (to === "stash") take();
      else if (to === "pack") {
        if (item?.outsideBattle) return flashTip(`${item.name} is used between battles, not carried.`);
        if (U.packSelection.length >= Loot.battleSlots(U.account) && src !== "pack") return flashTip("Your battle pack is full.");
        if (src === "stash" && kitFree(id) <= 0) return flashTip(`No more ${item?.name || id} in the stash.`);
        take(); U.packSelection.push(id);
      } else if (to === "pot") {
        if (!Cook?.isFood(id)) return flashTip(`${item?.name || id} isn't an ingredient.`);
        if (U.potSelection.length >= 3 && src !== "pot") return flashTip("The pot holds three ingredients.");
        if (src === "stash" && kitFree(id) <= 0) return flashTip(`No more ${item?.name || id} in the stash.`);
        take(); U.potSelection.push(id);
      } else return;
      showAccount();
    }
    function wireKit(ov) {
      ov.querySelectorAll(".cc-kit-tile").forEach((t) => {
        const d = t.dataset;
        t.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ kind: d.kitKind, id: d.kitId, from: d.kitFrom })); e.dataTransfer.effectAllowed = "move"; t.classList.add("is-dragging"); });
        t.addEventListener("dragend", () => t.classList.remove("is-dragging"));
        t.addEventListener("click", () => {
          const f = d.kitFrom.split(":")[0];
          if (d.kitKind === "gear") return kitMove("gear", d.kitId, d.kitFrom, f === "gear" ? "gearbag" : "gear");
          kitMove("item", d.kitId, d.kitFrom, f === "stash" ? "pack" : "stash");
        });
        t.addEventListener("dblclick", (e) => { if (d.kitFrom === "stash") { e.preventDefault(); const i = U.packSelection.lastIndexOf(d.kitId); if (i >= 0) U.packSelection.splice(i, 1); kitMove("item", d.kitId, "stash", "pot"); } });
      });
      ov.querySelectorAll("[data-kit-zone]").forEach((z) => {
        z.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; z.classList.add("is-over"); });
        z.addEventListener("dragleave", () => z.classList.remove("is-over"));
        z.addEventListener("drop", (e) => { e.preventDefault(); z.classList.remove("is-over"); let m; try { m = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (_) { return; } if (m?.id) kitMove(m.kind, m.id, m.from, z.dataset.kitZone); });
      });
      ov.querySelectorAll("[data-kit-cook]").forEach((b) => b.onclick = () => {
        const r = Cook.cookAtCamp(U.account, U.potSelection.slice(), b.dataset.kitCook); if (!r.ok) return flashTip(r.reason);
        U.account = r.account; const left = U.potSelection.slice(); for (const id of r.used) left.splice(left.indexOf(id), 1); U.potSelection = left;
        saveAccount(); showAccount(); flashTip(`Cooked ${Loot.data.consumables[r.out]?.name || r.out}.`);
      });
      ov.querySelector("[data-kit-empty-pot]")?.addEventListener("click", () => { U.potSelection = []; showAccount(); });
    }
    function gearSellValue(id) {
      const it = Loot.data.equipment[id];
      if (!it) return 0;
      const base = Loot.data.rarities[it.rarity].sell;   // the born rarity: risen and awakened gear is sentimental (Mala, 2026-10-27)
      const now = U.account.gear.durability[id] ?? Loot.maxDurability(id, U.account);
      return now <= 0 ? Math.round(base * Loot.data.rules.durability.brokenSellShare) : base;
    }
    function gearRow(id, it, equipped) {
      const max = Loot.maxDurability(id, U.account), now = U.account.gear.durability[id] ?? max;
      const repairs = Object.entries(U.account.stash).filter(([kit, n]) => n > 0 && Loot.data.consumables[kit]?.effect?.repair);
      const status = equipped ? (now ? "active" : "worn out · inactive") : "stored";
      const repairBtns = now < max ? repairs.map(([kit, n]) => `<button type="button" data-repair="${id}" data-kit="${kit}">Repair · ${esc(Loot.data.consumables[kit].name)} (${n})</button>`).join("") : "";
      // Item care (Jinki care JC1/JC2): one Tend picks the cheapest way; Cherish is the love path (+1, once between battles).
      const care = Loot.careOf ? Loot.careOf(U.account, id) : null, cherished = (U.account.gear.cherished || []).includes(id);
      const careBtns = Loot.tend ? `${now < max ? `<button type="button" data-tend="${id}">Tend</button>` : ""}${now > 0 && now < max && !cherished ? `<button type="button" data-cherish="${id}">Cherish</button>` : ""}` : "";
      const careLine = care ? `<p class="cc-care-line"><b>Care ${care.score}</b>${care.title ? ` · ${esc(care.title)}` : ""}${care.next ? ` · next: ${esc(care.next.name)} at ${care.next.at}` : ""} · ${esc(care.line)}</p>` : "";
      const action = equipped
        ? `<button type="button" data-unequip="${esc(it.slot)}">Remove</button>`
        : `<button type="button" data-equip="${id}">Equip</button><button type="button" data-sell="${id}">Sell · ${gearSellValue(id)} Seeds${(Loot.careOf && (Loot.careOf(U.account, id).awakened || Loot.careOf(U.account, id).rarity !== it.rarity)) ? " (sentimental: sells as born)" : ""}</button>`;
      const svcCost = Math.max(5, Math.round(Loot.data.rarities[(care && care.rarity) || it.rarity].price / 2));
      const svcBtn = now < max ? `<button type="button" data-service="${id}">Mend · ${svcCost}</button>` : "";
      const wornMix = (U.account.trackMixes || {})[id];
      const mixBtns = Tracks ? ["lofi", "stripped"].map((m) => wornMix === m
        ? `<button type="button" data-mixplay="${id}:${m}">▶ ${m}</button>`
        : `<button type="button" data-mixbuy="${id}:${m}" ${U.account.seeds < 40 ? "disabled" : ""}>${m} · 40</button>`).join("") : "";
      const warnAt = Loot.data.rules.durability.warnAt;
      const icon = JStates ? JStates.iconHTML(id, it.name, now, max, care ? care.score : 0, it, warnAt, care ? care.kind : null) : itemIcon(id, it.name);
      const stateBit = JStates ? ` · ${esc(JStates.stateName(now, max, care ? care.score : 0, it, warnAt))}` : "";
      const empLines = care?.awakened && it.empower && now > 0 && Loot.empowerLines ? Loot.empowerLines(id, { soiled: now <= warnAt }) : null;   // EP-01: the effective awakened bonus, not just the base text
      const empBit = care?.awakened && it.empower ? ` <small>Empowered · ${esc(it.empower.name)}</small>` : "";   // EM1: the Jinki menu names awakened power
      return `<article class="cc-account-row cc-gear-row"><div class="cc-item-with-icon">${icon}<div><b>${esc(it.name)}</b> <small>${status} · ${now}/${max} battles${stateBit}</small>${empBit}<p>${esc(it.text)}</p>${empLines ? `<p class="cc-emp-line">Awakened (care 10+, while worn): ${esc(empLines.join("; "))}.</p>` : ""}${careLine}</div></div><div class="cc-row-actions">${action}${svcBtn}${mixBtns}${careBtns}${repairBtns}</div><div class="cc-durability"><i style="width:${Math.max(0, 100 * now / max)}%"></i></div></article>`;
    }
    function gearBoard() {
      const owned = Object.entries(Loot.data.equipment).filter(([id]) => U.account.gear.owned.includes(id));
      if (!owned.length) return `<p class="cc-muted">No gear yet. Battle rewards and the field shop can drop equipment.</p>`;
      return Loot.data.slots.map((slot) => {
        const wornId = U.account.gear.equipped[slot];
        const worn = wornId && Loot.data.equipment[wornId] && U.account.gear.owned.includes(wornId);
        const stored = owned.filter(([id, it]) => it.slot === slot && id !== wornId);
        return `<section class="cc-gear-slot"><h4>${GEAR_SLOT_LABEL[slot] || slot}</h4>${worn ? gearRow(wornId, Loot.data.equipment[wornId], true) : `<p class="cc-muted">Empty</p>`}${stored.map(([id, it]) => gearRow(id, it, false)).join("")}</section>`;
      }).join("");
    }
    function wearingCard() {
      const rows = Loot.data.slots.map((slot) => {
        const id = U.account.gear.equipped[slot];
        const it = id && Loot.data.equipment[id];
        if (!it || !U.account.gear.owned.includes(id)) return `<li><b>${GEAR_SLOT_LABEL[slot] || slot}</b> <span class="cc-muted">empty</span></li>`;
        const now = U.account.gear.durability[id] ?? Loot.maxDurability(id, U.account);
        const dead = now <= 0;
        return `<li><b>${GEAR_SLOT_LABEL[slot] || slot}</b> · ${esc(it.name)}${dead ? " · worn out" : ""}<small>${dead ? "Inactive until repaired. " : ""}${esc(it.text)}</small></li>`;
      }).join("");
      return `<section class="cc-wearing" aria-label="Equipped gear"><h4>Wearing</h4><ul>${rows}</ul><p class="cc-muted">These bonuses are on in the next battle. Remove or repair a piece in the Ledger House.</p></section>`;
    }
    function leaveTown() { if (U.town) { U.townPos = U.town.state.pos.slice(); U.townFacing = { ...U.town.state.facing }; U.town.destroy(); U.town = null; } $("ccOverlay").classList.remove("cc-town-host"); }   // keeps where he stood
    // The town (Mala, 2026-10-17; docs/town-hub.md). Each door or side-menu entry opens a screen the classic menu already
    // had; the classic menu's panels open one at a time from here, with a way back to the town.
    const TOWN_NAV = [{ id: "scenarios", label: "▦ Town Hall · battles" }, { id: "character", label: "♙ Home · character" }, { id: "index", label: "▤ The Archive" },
      { id: "account", label: "⚖ Ledger House · account" }, { id: "hall", label: "✉ Hiring Hall · mercs, mediators" }, { id: "board", label: "▤ Notice board · missions" }, { id: "threat", label: "☰ Threat leaderboard" }, { id: "lab", label: "⚗ The Lab" }, { id: "codex", label: "§ The Magistrate's Codex" }, { id: "workshop", label: "✦ Workshop · three benches" }, { id: "school", label: "✎ School · drills" }, { id: "square", label: "🎩 Town square · busk" }, { id: "classic", label: "☷ Classic menu" }];
    function openFromTown(id) {
      leaveTown();
      if (id === "account") { U.mode = "setup"; return showAccount(); }
      if (id === "workshop") return showWorkshopHub("town");
      if (id === "school") return showSchool("town");
      if (id === "square") return showBusk("town");
      if (id === "lab") return showLab();
      if (id === "hall") return showHall();
      if (id === "board") return showBoard();
      if (id === "codex") return showCodex();
      U.menuView = "classic";
      U.setupPanels = { deck: U.setupPanels.deck, scenarios: id === "scenarios", character: id === "character", index: id === "index", threat: id === "threat" };
      U.focusPanel = ["scenarios", "character", "index", "threat"].includes(id) ? id : null;   // a town door opens its own room (Mala, 2026-10-27: "all three of these open the same window")
      showSetup();
    }
    // NPC keepers (npc/keeper-ui.js; spec claude-npc-faces-spec): a window calls mountKeeper at the END of its render. It greets once per entry
    // (a re-render only redraws), so walking back into town starts the next entry.
    // The facts a keeper's hook chip reads, gathered from the same state the window shows (perk points, free pack slots, worn gear, Seeds owed).
    const keeperFacts = () => { const A = U.account, g = A.gear || {}, wornOut = Object.values(g.equipped || {}).filter((id) => id && (g.durability?.[id] ?? 1) <= 0).map((id) => Loot.data?.equipment?.[id]?.name || id);
      const slots = Loot.battleSlots(A); return { perkPoints: A.perkPoints || 0, packSlots: slots, packFree: Math.max(0, slots - (U.packSelection || []).length), worn: wornOut, owed: Math.max(0, A.debt || 0) }; };
    const mountKeeper = (ov, windowId, more = {}) => root.ConceptCombatKeeperUI?.mount(ov, windowId, { account: U.account, store, dialogueOn: U.dialogueOn, facts: { ...keeperFacts(), ...more },
      onAccount: (a) => { U.account = a; saveAccount(); },
      onDialogue: (on) => { U.dialogueOn = on; store.set("loci:combat:dialogue", on); if (!on) U.bubbles = []; const b = $("ccDialogue"); if (b) b.textContent = `Dialogue ${on ? "On" : "Off"}`; } });
    function showTown() {
      root.ConceptCombatKeeperUI?.reset();
      endTestBattle();   // leaving a test battle unfinished keeps nothing too
      U.focusPanel = null;   // back in town: the next door decides what the setup screen shows
      U.mode = "town"; stopAi(); host.classList.add("cc-setting-up");
      const ov = $("ccOverlay"); ov.hidden = false; ov.classList.add("cc-town-host");
      leaveTown(); ov.classList.add("cc-town-host");
      U.town = TOWN.create(ov, { nav: TOWN_NAV, onOpen: openFromTown, startAt: U.townPos, startFacing: U.townFacing });
    }
    // The Contract Board (W4.2): three postings, one job at a time, proof at finish.
    function showBoard(note = "") {
      U.mode = "setup"; const ov = $("ccOverlay"); ov.hidden = false;
      if (!Board) { ov.innerHTML = `<div class="cc-card"><p>The board is bare.</p><button type="button" id="ccBoardBack">Back</button></div>`; $("ccBoardBack").onclick = () => showSetup(); return; }
      if (!(U.account.board?.postings || []).length) { U.account = Board.refresh(U.account, { seed: U.account.battles || 0, roster: Object.entries(C.characters).filter(([id, ch]) => id !== "warden" && id !== "police_officer" && !ch.permanentAlly && !ch.randomEventOnly && Array.isArray(ch.configs)).map(([id]) => id) }); saveAccount(); }
      const b = U.account.board, left = (m) => Math.max(0, m.expiresAt - (U.account.battles || 0));
      ov.innerHTML = `<div class="cc-card cc-town-hall"><h2>The Contract Board</h2><p class="cc-muted">${b.done || 0} jobs done. One at a time — finish or abandon before the next. Stale postings rot. Coming contracts: ${Board.STUBS.join(", ")}.</p>
        ${b.postings.map((m) => `<section class="cc-hall-offer"><div><b>${esc(Board.describe(m))}</b> <small>rots in ${left(m)} battles</small></div>
          ${b.accepted === m.id ? `<span><b>ACCEPTED</b> <button type="button" data-board-abandon>Abandon (clean)</button></span>` : `<button type="button" data-board-accept="${esc(m.id)}" ${b.accepted ? "disabled" : ""}>Accept</button>`}</section>`).join("")}
        ${note ? `<p class="cc-hall-note" role="status">${esc(note)}</p>` : ""}
        <div class="cc-row"><button type="button" id="ccBoardBack">Back</button></div></div>`;
      ov.querySelectorAll("[data-board-accept]").forEach((x) => x.onclick = () => { const r = Board.accept(U.account, x.dataset.boardAccept); if (r.ok) saveAccount(); showBoard(r.ok ? "Job accepted: fight THEIR fight." : r.error); });
      const ab = ov.querySelector("[data-board-abandon]");
      if (ab) ab.onclick = () => { U.account = Board.abandon(U.account); saveAccount(); showBoard("Walked away clean: no penalty, no pay."); };
      $("ccBoardBack").onclick = () => showSetup(); $("ccBoardBack").focus();
      const job = b.accepted && b.postings.find((m) => m.id === b.accepted);   // Hermes (S2): the chip reads the same posting the board shows
      mountKeeper(ov, "contractBoard", { accepted: job ? { text: Board.describe(job), left: left(job) } : null });
      if (note) { const kd = root.ConceptCombatKeeperUI; if (note.startsWith("Job accepted")) kd?.say("buy"); }
    }
    // The Hiring Hall (Mala, 2026-10-18; docs/mercs-and-mediators.md): merc contracts and letters of safe conduct at a fixed
    // price. Bought ones go to the stash; pack them like any item (Home or the Ledger House) to bring them into a battle.
    function showHall(note = "") {
      U.mode = "setup"; const ov = $("ccOverlay"); ov.hidden = false;
      const stock = Loot.hallStock ? Loot.hallStock(U.account) : [];
      ov.innerHTML = `<div class="cc-card cc-town-hall"><h2>The Hiring Hall</h2><p class="cc-muted">${U.account.seeds} Seeds · help you have to prepare for: buy here, pack it before the fight, use it in battle. It arrives the next round.</p>
        ${stock.map(o => `<section class="cc-hall-offer"><div><b>${esc(o.name)}</b> <small>${o.price} Seeds · ${o.owned} in your stash</small><p>${esc(o.text)}</p></div>
          <button type="button" data-hall-buy="${esc(o.id)}" ${U.account.seeds < o.price ? "disabled" : ""}>Buy · ${o.price}</button></section>`).join("")}
        ${note ? `<p class="cc-hall-note" role="status">${esc(note)}</p>` : ""}
        <div class="cc-row"><button type="button" id="ccHallPack">Pack for battle (Ledger House)</button><button type="button" class="cc-primary" id="ccHallBack">← Back to town</button></div></div>`;
      ov.querySelectorAll("[data-hall-buy]").forEach(b => b.onclick = () => { const offer = stock.find(o => o.id === b.dataset.hallBuy); const r = Loot.buy(U.account, offer);
        if (r.ok) { U.account = r.account; saveAccount(); } showHall(r.ok ? `Bought: ${offer.name}.` : r.reason); });
      $("ccHallPack").onclick = () => showAccount();
      mountKeeper(ov, "hiringHall");   // Jambavan (S1)
      $("ccHallBack").onclick = () => showSetup(); $("ccHallBack").focus();
    }
    // The Magistrate's Codex (Mala, 2026-10-20; legacy/legacy.js + legacy-battle.js): your traditions, your journal, the
    // Magistrate's books, the techniques you hold in memory, and the scribing table where held techniques are taken apart
    // into parts and built back into your own. Boss arts scribe only with a legendary tradition (strength 6+).
    const CODEX_KEY = "loci:combat:codex-open:v1";
    function codexOpenMap() { const raw = store.get(CODEX_KEY, {}); return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}; }
    function setCodexOpen(id, on) { const m = codexOpenMap(); if (on) m[id] = true; else delete m[id]; store.set(CODEX_KEY, m); }
    function showCodex(note = "") {
      U.mode = "setup"; const ov = $("ccOverlay"); ov.hidden = false;
      if (!LB) { ov.innerHTML = `<div class="cc-card"><p>The Codex is closed.</p><button type="button" id="ccCodexBack">← Back</button></div>`; $("ccCodexBack").onclick = () => showSetup(); return; }
      const lg = LB.fresh(U.account.legacy), led = lg.ledger, nameOf = (id) => C.abilities[id]?.name || LB.partsOf(id, C)?.sourceName || lg.scribed.find((d) => d.id === id)?.name || id;
      const takeInfo=id=>{const p=LB.partsOf(id,C),count=lg.parts.filter(x=>x.source===id).length;return count?`Unspent parts already owned ×${count}`:p?.effects?.length?`Recover: ${p.effects.map(e=>e.label).join(", ")}`:"Effect adapters not available yet; concept/delivery extraction only.";};
      const books = LB.shop(lg, U.account.battles || 0), save = (l, msg) => { U.account.legacy = l; saveAccount(); showCodex(msg); };
      const pat = (t) => t.pattern?.technique ? nameOf(t.pattern.technique) : t.pattern?.sequence ? t.pattern.sequence.split(">").map(nameOf).join(" → ") : `the line of ${t.pattern?.lineOf}`;
      const studies = Object.values(lg.journal.studies);
      // Collapsible sections (Mala, 2026-10-30: "the Magistrate's codex is cluttered and needs drop down menus"): each section is a header (chevron, name, count, "N ready") that opens or closes its body in place. Closed by default; the choice, and the section you last acted in, are kept (CODEX_KEY).
      const cxOpen = codexOpenMap(), cx = (id, title, count, body) => `<section class="cc-cx ${cxOpen[id] ? "open" : ""}" data-cx="${id}"><h3><button type="button" class="cc-cx-head" data-cx-toggle="${id}" aria-expanded="${!!cxOpen[id]}" aria-controls="ccCx-${id}"><span class="cc-chev" aria-hidden="true">${cxOpen[id] ? "▾" : "▸"}</span>${title}<span class="cc-cx-n">${count}</span><span class="cc-cx-ready" hidden></span></button></h3><div class="cc-cx-body" id="ccCx-${id}" ${cxOpen[id] ? "" : "hidden"}>${body}</div></section>`;
      ov.innerHTML = `<div class="cc-card cc-town-hall cc-codex"><div class="cc-codex-head"><!-- slot: a keeper's face goes here --><h2>The Magistrate's Codex</h2></div><p class="cc-muted">${U.account.inspiration || 0} Inspiration · ${U.account.seeds} Seeds · favor ${led.favor || 0}. What your battles founded, what you've studied, what you hold, and what you can build.</p>
        ${note ? `<p class="cc-hall-note" role="status">${esc(note)}</p>` : ""}
        ${cx("traditions", "Traditions", led.traditions.length, `${led.traditions.length ? led.traditions.map((t) => { const b = root.ConceptCombatLegacy.traditionBonus(t), dead = !LB.alive(t);
          return `<div class="cc-hall-offer"><div><b>${esc(t.name)}</b> <small>${dead ? "faded" : `${b.tier} · strength ${t.strength}`}</small><p>${esc(pat(t))}${dead ? "" : ` · its techniques cost ${Math.round(b.control * 100)}% fewer AP and ${Math.round(b.chargeDiscount * 100)}% less ΦF`}.</p></div>${dead ? `<button type="button" data-revive="${esc(t.id)}">Revive</button>` : ""}</div>`; }).join("") : `<p class="cc-muted">None yet. Land the same technique three times in one battle (or the same two-technique turn twice) with an ally watching, then found it on the battle's report for 1 Inspiration.</p>`}`)}
        ${cx("journal", "Journal", studies.length, `${studies.length ? studies.map((st) => { const boss = !!LB.partsOf(st.technique, C)?.boss, canMem = LB.memorizable(st.technique, C), pr = lg.practice[st.technique] || 0;
          return `<div class="cc-hall-offer"><div><b>${esc(nameOf(st.technique))}</b> <small>${st.complete ? `study complete · practice ${pr}/${LB.MEMORIZE_AT}${pr < LB.MEMORIZE_AT ? " · +1 from its book or another study in battle" : ""}` : `${st.notes}/3 notes`}${boss ? " · boss art" : ""}</small></div>
            ${st.complete && !st.donated ? `<button type="button" data-donate="${esc(st.technique)}">Donate (+1 favor)</button>` : ""}${st.complete && canMem && !lg.memory.held.includes(st.technique) ? `<button type="button" data-memorize="${esc(st.technique)}" ${pr < LB.MEMORIZE_AT ? "disabled" : ""}>Memorize</button>` : ""}${st.complete && !canMem ? `<small class="cc-muted">can't be held: ${esc(LB.unmemorizableWhy(st.technique, C) || "sealed")}</small>` : ""}${st.complete && boss ? `<button type="button" data-take="${esc(st.technique)}" ${LB.legendary(lg) && !lg.parts.some(p=>p.source===st.technique) ? "" : "disabled"}>Take apart${LB.legendary(lg) ? "" : " (needs a legendary tradition)"}</button>` : ""}</div>`; }).join("") : `<p class="cc-muted">Empty. In battle, Observe ▸ Take notes on a technique a foe used: it spends your reaction. Three notes finish a study.</p>`}`)}
        ${cx("notebook", "Field notebook", lg.findingNotebook.length, `${lg.findingNotebook.length ? lg.findingNotebook.map(f=>`<p>${esc(f.text)} <small>· ${esc(f.method)} · via ${esc(f.viaName||f.originName||f.via||f.origin)}</small></p>`).join("") : `<p class="cc-muted">Record a learned or verified finding during battle to preserve it here.</p>`}`)}
        ${cx("books", "The Magistrate's books", books.length, `${books.length ? books.map((b) => `<div class="cc-hall-offer"><div><b>${esc(nameOf(b.technique))}</b> <small>${esc(b.tier)} · ${b.price} Seeds</small><p>Practice +1 toward memorizing it.</p></div><button type="button" data-book="${esc(b.id)}" ${U.account.seeds < b.price ? "disabled" : ""}>Buy · ${b.price}</button></div>`).join("") : `<p class="cc-muted">The shelves stock what the codex holds: found a tradition or donate a study.</p>`}`)}
        ${cx("memory", "Memory", `${lg.memory.held.length}/${lg.memory.slots}`, `<p class="cc-muted">Held techniques come into every battle with you. A fourth pushes out the oldest; relearning it takes half the practice.</p>${lg.memory.held.map((id) => `<div class="cc-hall-offer"><div><b>${esc(nameOf(id))}</b><small>${esc(takeInfo(id))}</small></div>${LB.partsOf(id, C) ? `<button type="button" data-take="${esc(id)}" ${lg.parts.some(p=>p.source===id)?"disabled":""}>Take apart</button>` : `<small class="cc-muted">resists analysis</small>`}</div>`).join("") || `<p class="cc-muted">Nothing held.</p>`}`)}
        ${cx("scribing", "Scribing desk", `${lg.parts.length} parts`, `<button type="button" class="cc-primary" id="ccOpenWorkshop">Open scribing desk ↗</button>${lg.parts.length >= 1 ? `<p class="cc-muted">Shape recovered parts into a technique at the desk: draft, test, inscribe, equip.</p>` : `<p class="cc-muted">Take apart a held technique to get its parts (the notebook copy is used up).</p>`}
          ${lg.scribed.length ? `<p class="cc-muted">Scribed: ${lg.scribed.map((d) => `${esc(d.name)} (${d.ap} AP, ${d.cost} ΦF${lg.memory.held.includes(d.id) ? ", held" : ""})`).join(" · ")}</p>` : ""}`)}
        <div class="cc-row"><button type="button" class="cc-primary" id="ccCodexBack">← Back to town</button></div></div>`;
      ov.querySelectorAll(".cc-cx").forEach((sec) => { const n = [...sec.querySelectorAll("button[data-revive],button[data-donate],button[data-memorize],button[data-take],button[data-book]")].filter((b) => !b.disabled).length, tag = sec.querySelector(".cc-cx-ready"); if (n) { tag.textContent = `${n} ready`; tag.hidden = false; } });
      ov.querySelectorAll("[data-cx-toggle]").forEach((h) => h.onclick = () => { const now = Date.now(); if (h.dataset.cxAt && now - h.dataset.cxAt < 450) return; h.dataset.cxAt = now;   // a double click toggles once
        const sec = h.closest(".cc-cx"), on = h.getAttribute("aria-expanded") !== "true"; setCodexOpen(h.dataset.cxToggle, on); h.setAttribute("aria-expanded", on); sec.classList.toggle("open", on); sec.querySelector(".cc-cx-body").hidden = !on; h.firstElementChild.textContent = on ? "▾" : "▸"; });
      ov.querySelectorAll(".cc-cx-body button").forEach((b) => b.addEventListener("click", () => setCodexOpen(b.closest(".cc-cx").dataset.cx, true)));   // the section you act in stays open after the screen redraws
      ov.querySelectorAll("[data-revive]").forEach((b) => b.onclick = () => { const r = LB.revive(U.account.legacy, b.dataset.revive); r.ok ? save(r.legacy, `${r.tradition.name} is practised again.`) : showCodex(r.error); });
      ov.querySelectorAll("[data-donate]").forEach((b) => b.onclick = () => { const r = LB.donate(U.account.legacy, b.dataset.donate); r.ok ? save(r.legacy, `Donated. Favor ${r.favor}: the Magistrate's shelves fill.`) : showCodex(r.error); });
      ov.querySelectorAll("[data-memorize]").forEach((b) => b.onclick = () => { const r = LB.memorizeStudy(U.account.legacy, b.dataset.memorize, C); r.ok ? save(r.legacy, `Memorized${r.evicted ? `; ${nameOf(r.evicted)} slips from memory` : ""}.`) : showCodex(r.error); });
      ov.querySelectorAll("[data-book]").forEach((b) => b.onclick = () => { const book = books.find((x) => x.id === b.dataset.book); if (!book || U.account.seeds < book.price) return;
        const r = LB.buyBook(U.account.legacy, book); U.account.seeds -= r.price; save(r.legacy, `Bought the book: ${nameOf(book.technique)} (practice +1).`); });
      ov.querySelectorAll("[data-take]").forEach((b) => b.onclick = () => { const r = LB.disassemble(U.account.legacy, b.dataset.take, C); r.ok ? save(r.legacy, `Taken apart: ${nameOf(b.dataset.take)}. Its parts are on the table.`) : showCodex(r.error); });
      $("ccOpenWorkshop").onclick = () => root.ConceptCombatWorkshopUI.mount(ov, { getAccount: () => U.account, save: account => { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(A.serialize(account))); U.account = account; }, C, E, back: () => showCodex() });
      $("ccCodexBack").onclick = () => showSetup(); $("ccCodexBack").focus();
    }
    // The trait laboratory (Mala, 2026-10-17/18; account/surgery.js, docs/trait-lab.md): graft biology traits for Seeds into
    // three surgery slots, remove traits at a steep price, and wake up Woozy for the next battle.
    function showLab(note = "") {
      U.mode = "setup"; const ov = $("ccOverlay"); ov.hidden = false;
      const SG = root.ConceptCombatSurgery, a = U.account;
      if (!SG) { ov.innerHTML = `<div class="cc-card cc-town-lab"><h2>The Mad Scientist's Lab</h2><p>The lab is closed.</p><button type="button" id="ccLabBack">← Back to town</button></div>`; $("ccLabBack").onclick = () => showSetup(); return; }
      const sl = SG.slots(a), offers = SG.stock(a), grafted = (a.self?.traits || []).filter((t) => t.grafted);
      const bio = (a.self?.traits || []).filter((t) => SG.isBiology(t.id));
      const tierTag = (t) => `<span class="cc-lab-tier cc-lab-tier-${t}">${esc(SG.TIERS[t].name)}</span>`;
      ov.innerHTML = `<div class="cc-card cc-town-lab cc-lab"><header class="cc-lab-head"><img src="combat/sprites/town/mad-scientist.png" alt="The Mad Scientist" class="cc-town-lab-art">
          <div><h2>The Mad Scientist's Lab</h2><p class="cc-muted">${a.seeds || 0} Seeds · surgery slots ${sl.used}/${sl.max}${a.woozy ? " · <b>Woozy</b> for your next battle" : ""}</p>
          <p>"Bodies are drafts. Pick a part. Mind, the good ones cost what they're worth, and you'll wake up woozy."</p></div></header>
        <section><h3>On the table today <small class="cc-muted">changes after every battle</small></h3>${offers.map((o) => o.sold ? `<div class="cc-lab-offer cc-lab-sold"><div><b>Sold</b><p class="cc-muted">This slot restocks after your next battle.</p></div></div>` : `<div class="cc-lab-offer"><div><b>${esc(o.name)}</b> ${tierTag(o.tier)} <small>${o.price} Seeds</small><p>${esc(o.text)}</p></div>
            ${sl.used >= sl.max ? `<label>Take out <select data-lab-replace="${esc(o.id)}">${grafted.map((g) => `<option value="${esc(g.id)}">${esc(g.name)} (+${SG.removalPrice(g.id)})</option>`).join("")}</select></label>` : ""}
            <button type="button" data-lab-graft="${esc(o.id)}">Graft</button></div>`).join("") || `<p class="cc-muted">Nothing left she can add.</p>`}</section>
        <section><h3>Your body <small class="cc-muted">biology traits</small></h3>${bio.map((t) => `<div class="cc-lab-offer"><div><b>${esc(t.name || t.id)}</b> ${t.grafted ? `<small>grafted${SG.tierOf(t.id) ? ` · ${esc(SG.TIERS[SG.tierOf(t.id)].name)}` : ""}</small>` : `<small>born with it</small>`}<p>${esc(t.text || "")}</p></div>
            <button type="button" data-lab-remove="${esc(t.id)}">Remove · ${SG.removalPrice(t.id)}</button></div>`).join("") || `<p class="cc-muted">No biology traits yet.</p>`}</section>
        ${note ? `<p class="cc-hall-note" role="status">${esc(note)}</p>` : ""}
        <p class="cc-muted">Woozy: ${SG.rules.woozy.apLoss} fewer AP on your first ${SG.rules.woozy.turns} turns and ${Math.round((1 - SG.rules.woozy.damageMul) * 100)}% less ability damage while it lasts.</p>
        <div class="cc-row"><button type="button" class="cc-primary" id="ccLabBack">← Back to town</button></div></div>`;
      const done = (r, what) => { if (r.ok) { U.account = r.account; saveAccount(); } showLab(r.ok ? what : r.reason); };
      ov.querySelectorAll("[data-lab-graft]").forEach((b) => b.onclick = () => { const id = b.dataset.labGraft, rep = ov.querySelector(`[data-lab-replace="${id}"]`)?.value || null;
        done(SG.graft(U.account, id, { replace: rep }), `Grafted: ${offers.find((o) => o.id === id)?.name || id}. You'll be woozy next battle.`); });
      ov.querySelectorAll("[data-lab-remove]").forEach((b) => b.onclick = () => done(SG.remove(U.account, b.dataset.labRemove), "Removed. You'll be woozy next battle."));
      $("ccLabBack").onclick = () => showSetup(); $("ccLabBack").focus();
    }
    function showSetup() {
      endTestBattle();   // leaving a test battle unfinished keeps nothing too
      if (U.s && U.llmEnabled) { ++U.llmEpoch; Promise.resolve(opts.llmBridge?.stop?.()).catch(() => {}); U.llmConnection = null; U.llmPaused = false; U.llmReady = true; }
      if (U.townOn && U.menuView === "town") return showTown();
      leaveTown();
      if(U.mode==="setup") { U.setupScenario ||= {};for(const id of ["ccGameMode","ccTerrain"]) { const control=$(id);if(control)U.setupScenario[id]=control.value; } }
      U.mode = "setup"; stopAi(); host.classList.add("cc-setting-up");
      U.character ||= { primary: C.characters.warden.primary, secondary: C.characters.warden.secondary, lens: {} };
      U.character.lens ||= {};
      const priorEncounter = U.setupEncounter || params.encounter || U.setupOpts?.encounter || "firstWall";
      const encounter = priorEncounter === "randomEncounter" ? "firstWall" : priorEncounter;
      U.setupEncounter = encounter;
      const narrationPref = params.narration || store.get("loci:combat:narration", "");
      const prof = E.progress({ xp: 0, level: 1 }, U.profile.xp || 0);
      const lensSel = (concept) => {
        const L = C.concepts[concept].lens;
        return `<label>${esc(C.concepts[concept].name)} lens <select data-lens="${concept}">${Object.entries(L.profiles).map(([id, p]) =>
          `<option value="${id}" ${id === (U.setupLenses[concept] || L.default) ? "selected" : ""} ${p.proficiency > prof.proficiency ? "disabled" : ""}>${esc(p.name)}${p.proficiency > prof.proficiency ? " (proficiency " + p.proficiency + ")" : ""} · ${esc(p.trade)}</option>`).join("")}</select></label>`;
      };
      const ov = $("ccOverlay"); ov.hidden = false;
      const testBattles = TEST_BATTLES.filter((t) => !t.teachOnly || U.teachMode);   // the Sage demo shows behind the Teach toggle
      ov.innerHTML = `<div class="cc-card cc-setup">
        <h2>Concept Combat</h2>
        <details class="cc-menu-section" id="ccScenariosPanel" ${U.setupPanels.scenarios?"open":""}><summary><span aria-hidden="true">▦</span> Scenarios <small>${esc({firstWall:"First Wall",gapCourt:"The Gap Court",rosterScrimmage:"Build a scenario",warfare:"Warfare",bossRush:"Boss Rush"}[encounter]||encounter)}</small></summary><div class="cc-menu-body">
        <label>Encounter <select id="ccEncounter">
          <option value="firstWall" ${encounter === "firstWall" ? "selected" : ""}>First Wall · practice · 1 vs 1</option>
          <option value="gapCourt" ${encounter === "gapCourt" ? "selected" : ""}>The Gap Court · challenge · 1 vs 2</option>
          <option value="rosterScrimmage" ${encounter === "rosterScrimmage" ? "selected" : ""}>Build a scenario · choose fighters</option>
          <option value="warfare" ${encounter === "warfare" ? "selected" : ""}>Warfare · three factions · large map</option>
          ${BR ? `<option value="bossRush" ${encounter === "bossRush" ? "selected" : ""}>Boss Rush · every Omega threat in a row${BR.bestBadge(U.account) ? ` · best ${esc(BR.bestBadge(U.account))}` : ""}</option>` : ""}
          ${SW ? `<option value="secretWarrior" ${encounter === "secretWarrior" ? "selected" : ""}>${esc(SW.label)}</option>` : ""}
          ${SN ? `<option value="secretWarriorNext" ${encounter === "secretWarriorNext" ? "selected" : ""}>${esc(SN.label)}</option>` : ""}
        </select></label>
        ${BR ? `<label id="ccRushAllyRow" ${encounter === "bossRush" || encounter === "secretWarrior" ? "" : "hidden"}>Bring an ally <select id="ccRushAlly"><option value="">No ally · alone</option>${BR.allies().map(a => `<option value="${esc(a.id)}" ${U.rushAlly === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>` : ""}
        <label>Battle objective <select id="ccGameMode" ${encounter === "warfare" || encounter === "bossRush" || encounter === "secretWarrior" || encounter === "secretWarriorNext" ? "disabled" : ""}><option value="classic">Classic · defeat the other side</option>${Object.entries(MD?.modes || {}).filter(([id, m])=>id!=="warfare" && !m.archived).map(([id, m]) => `<option value="${id}">${esc(m.name)}</option>`).join("")}</select></label>
        ${opts.llmBridge ? `<section class="cc-socket-settings"><label class="cc-inline"><input id="ccSocketOpponent" type="checkbox" ${U.llmEnabled ? "checked" : ""}> Use socket opponent</label>
          <div id="ccSocketSettings" ${U.llmEnabled ? "" : "hidden"}><label>Provider <select id="ccSocketProvider"><option value="agent" ${U.llmSettings.provider === "agent" ? "selected" : ""}>Live agent · this chat</option><option value="fake" ${U.llmSettings.provider === "fake" ? "selected" : ""}>Deterministic test</option><option value="openai" ${U.llmSettings.provider === "openai" ? "selected" : ""}>Local model · OpenAI-compatible</option></select></label>
            <div id="ccLocalModelSettings" ${U.llmSettings.provider === "openai" ? "" : "hidden"}><label>Local endpoint <input id="ccSocketEndpoint" type="url" value="${esc(U.llmSettings.baseURL)}" placeholder="http://127.0.0.1:1234/v1"></label>
              <label>Model <input id="ccSocketModel" list="ccSocketModels" value="${esc(U.llmSettings.model)}" placeholder="Choose or enter a loaded model"><datalist id="ccSocketModels"></datalist></label>
              <button type="button" id="ccDiscoverModels">Discover models</button><small id="ccModelStatus">Supports LM Studio or Ollama's OpenAI-compatible API.</small></div>
          </div><small class="cc-muted">Live agent pauses if a reply is missed; you choose when built-in AI takes over. Local model and test providers use automatic fallback.</small></section>` : ""}
        <label>Terrain <select id="ccTerrain"><option value="random">Random · generated from the full terrain set</option>${Object.entries(D?.arenas || {}).map(([id, a]) => `<option value="${esc(id)}">${esc(a.name)}</option>`).join("")}</select></label>
        <p class="cc-muted" id="ccEncounterNote">${encounter === "secretWarriorNext" && SN ? esc(SN.note) : encounter === "secretWarrior" && SW ? esc(SW.note) : encounter === "bossRush" ? `Every Omega threat, one after another on the Warfare Field: ${BR ? BR.list().map(e => e.name).join(", ") : "the bosses"}. Bring one ally for the whole run. Win to continue; a loss ends the run. Clear the list for a Boss Rush badge.` : encounter === "warfare" ? "Three factions collide on the 15×9 Warfare Field: you and a companion, two seeded-config opponents, and wild animals. No alliances between factions; only one can remain." : encounter === "firstWall"
          ? "Practice one idea at a time: place a Shield Wall across the Student’s straight-line Filter Bolt."
          : encounter === "rosterScrimmage" ? "Choose one NPC opponent and optionally bring an NPC companion. Each NPC draws a seeded configuration from their personal concept pool."
          : "Two opponents combine routed and selective attacks. Keep moving, read each delivery, and use the concept map when needed."}</p>
        <label>Narration <select id="ccNarration" title="Arantxa speaks when the people in the fight will not">
          <option value="" ${narrationPref === "" ? "selected" : ""}>Arantxa speaks when this fight will not</option>
          <option value="off" ${narrationPref === "off" ? "selected" : ""}>Stay quiet</option>
          <option value="quiet-house" ${narrationPref === "quiet-house" ? "selected" : ""}>The Quiet House</option>
          <option value="courtyard" ${narrationPref === "courtyard" ? "selected" : ""}>The Courtyard Hearing</option>
          <option value="verdict-dragon" ${narrationPref === "verdict-dragon" ? "selected" : ""}>Last Verdict · the cattle decree</option>
          <option value="verdict-oni" ${narrationPref === "verdict-oni" ? "selected" : ""}>Last Verdict · the soul trade</option>
          <option value="verdict-kaiju" ${narrationPref === "verdict-kaiju" ? "selected" : ""}>Last Verdict · the laboratory</option>
        </select></label>
        <section class="cc-roster-setup" id="ccRosterSetup" ${encounter === "rosterScrimmage" ? "" : "hidden"}>
          <header><div><h3>Choose your fighters</h3><p class="cc-muted">Select a role, then choose from the roster. Hover or focus a fighter to inspect their concepts.</p></div><button type="button" id="ccBestiary">Bestiary</button></header>
          <div class="cc-select-controls"><button type="button" data-role="foe" class="${U.selectionRole === "foe" ? "on" : ""}">Opponent</button><button type="button" data-role="ally" class="${U.selectionRole === "ally" ? "on" : ""}">Companion</button><label class="cc-check"><input id="ccWithAlly" type="checkbox" ${U.bringAlly ? "checked" : ""}> Bring a companion</label></div>
          <div class="cc-fighter-grid">${npcRoster.map(n => `<button type="button" class="cc-fighter ${n.id===U.setupFoe?"foe-selected":""} ${U.bringAlly&&n.id===U.setupAlly?"ally-selected":""}" data-fighter="${n.id}" aria-label="${esc(n.name)}. ${esc(C.concepts[primaryOf(n)]?.name||primaryOf(n))} primary. ${esc(blurbFor(n))}">
            ${spriteImg(n.sprite,n.name,"cc-fighter-sprite")}<b>${esc(n.name)}</b><small>${esc(C.concepts[primaryOf(n)]?.name||primaryOf(n))}</small><span class="cc-fighter-badge">${n.id===U.setupFoe?"OPPONENT":U.bringAlly&&n.id===U.setupAlly?"ALLY":""}</span>
          </button>`).join("")}</div>
          <div class="cc-fighter-inspect" id="ccFighterInspect" aria-live="polite"></div>
          <p class="cc-muted">Each fighter draws a seeded configuration from their own concept pool at battle start.</p>
        </section>
        <p class="cc-muted">Arena size depends on the scenario; Warfare uses a 15×9 tile field.
          Each turn starts with ${C.rules.actionPointsPerTurn} action points. Actions spend a share; you can move repeatedly while tempo remains, and Stall banks unused points. One reaction per round.
</p>
        <div class="cc-opponents" ${encounter !== "gapCourt" ? "hidden" : ""}>
          <div><b style="color:${SPRITE.pathfinder}">Pathfinder</b>: Alternate Pathway. Routed attacks travel around walls.</div>
          <div><b style="color:${SPRITE.sieve}">Sieve</b>: Selectivity. Line bolts that pick parries apart; Membranes on allies.</div>
        </div>
        <fieldset id="ccOpener" ${encounter === "firstWall" ? "hidden" : ""}><legend>Who opens</legend>
          <label class="cc-inline"><input type="radio" name="ccOpen" value="player" checked> ${esc(C.characters[mainClass()].name)}</label>
          <label class="cc-inline"><input type="radio" name="ccOpen" value="pathfinder"> Pathfinder</label></fieldset>
        ${TEACH ? `<label class="cc-inline" title="Enemies sometimes stop to share a quote from your Readwise library (Wisdom) or to ask you a question (Inquiry). It changes nothing about who wins."><input id="ccTeachMode" type="checkbox" ${U.teachMode ? "checked" : ""}> Teach mode · Wisdom and Inquiries during battle</label>` : ""}
        <div class="cc-row"><button type="button" class="cc-primary" id="ccStart">Play scenario ▶ <kbd>Enter</kbd></button></div>
        </div></details>
        ${TB ? `<details class="cc-menu-section" id="ccThreatPanel" ${U.setupPanels.threat ? "open" : ""}><summary><span aria-hidden="true">☰</span> Threat leaderboard <small>Top ${TB.top(15).length} · rated by sim</small></summary><div class="cc-menu-body"><p class="cc-muted">Everyone against the same benchmark, Control: 32 duels and 32 three-a-side battles on the same seeds (docs/threat-ratings.md). Challenge opens a 1v1 on the Gap Court (a boss opens its own fight). Unrated fighters don't appear until they're rated.</p><ol class="cc-threat-board">${TB.top(15).map(r => { const ch = r.kind && r.kind !== "main" ? { name: r.name, sprite: r.sprite } : C.characters[r.id]; if (!ch) return ""; const btn = r.kind === "boss" ? `<button type="button" data-challenge-encounter="${esc(r.encounter)}">Challenge</button>` : r.kind === "wild" ? `<small class="cc-muted">In the wild</small>` : r.kind === "main" ? `<small class="cc-muted">You</small>` : `<button type="button" data-challenge="${r.id}">Challenge</button>`; return `<li title="${esc(r.note || `${r.wins}/${r.battles} battles`)}"><span class="cc-threat-rank">#${r.rank}</span>${spriteImg(ch.sprite, ch.name, "cc-threat-sprite")}<b>${esc(ch.name)}</b><small>${esc(r.tier)} · ${r.wins}/${r.battles}</small>${btn}</li>`; }).join("")}</ol></div></details>` : ""}
        <div class="cc-menu-character-row">
        <details class="cc-menu-section" id="ccCharacterPanel" ${U.setupPanels.character?"open":""}><summary><span aria-hidden="true">♙</span> Character <span class="cc-main-identity" tabindex="0" title="${esc(mainDescription())}">${spriteImg(chosenSprite(mainClass()),C.characters[mainClass()].name,"cc-main-icon")}<b>${esc(C.characters[mainClass()].name)}</b></span></summary><div class="cc-menu-body">
        <label>Main Character <select id="ccMainCharacter">${Object.entries(C.characters).filter(([id,ch])=>id==="warden"||(!ch.randomEventOnly&&ch.configs)).map(([id,ch])=>`<option value="${id}" ${id===mainClass()?"selected":""}>${esc(ch.name)}</option>`).join("")}</select></label>
        <label>Load saved character <select id="ccSavedCharacter"><option value="">Choose a saved build…</option>${U.savedCharacters.map((ch,i)=>`<option value="${i}">${esc(ch.name)}</option>`).join("")}</select></label>
        <section class="cc-loadout-card" aria-label="Character loadout and lenses">
          ${packageControls(mainClass())}
          <div class="cc-loadout-pair">
            <label>Primary concept <select id="ccSetupPrimary">${Object.keys(C.concepts).filter(id => !C.concepts[id].sealed).map(id => `<option value="${id}" ${U.character.primary === id ? "selected" : ""}>${esc(C.concepts[id].name)}</option>`).join("")}</select></label>
            <span class="cc-pair-arrow" aria-hidden="true">＋</span>
            <label>Secondary concept <select id="ccSetupSecondary"><option value="">None</option>${Object.keys(C.concepts).filter(id => !C.concepts[id].sealed && id !== U.character.primary).map(id => `<option value="${id}" ${U.character.secondary === id ? "selected" : ""}>${esc(C.concepts[id].name)}</option>`).join("")}</select></label>
          </div>
          <div class="cc-setup-lenses"><h4>Lens profiles <small>free before battle</small></h4><div id="ccSetupLensGrid">${[U.character.primary, U.character.secondary].filter(Boolean).map(lensSel).join("")}</div></div>
          <div class="cc-save-build"><label>Build name <input id="ccCharacterName" placeholder="${esc(C.characters[mainClass()].name)} build"></label><button type="button" id="ccSaveBuild">Save character</button></div>
        </section>
        <div class="cc-prof cc-muted">Level ${prof.level} · ${prof.xp} XP · reserve storage ${prof.reserveSlots} · lens proficiency ${prof.proficiency}</div>
        ${wearingCard()}
        ${setupPack()}
        </div></details>
        <aside class="cc-natural-allies" aria-label="Natural allies"><h3>Natural allies</h3>${naturalAllies().map(a=>`<span class="cc-ally-icon" tabindex="0" title="${esc(a.reason)}">${spriteImg(a.sprite,a.name,"cc-ally-sprite")}<span>${esc(a.name)}</span></span>`).join("")||`<small>No natural allies recorded</small>`}</aside>
        </div>
        <details class="cc-menu-section" id="ccIndexPanel" ${U.setupPanels.index?"open":""}><summary><span aria-hidden="true">▤</span> The Index</summary><div class="cc-menu-body cc-index-links"><button type="button" id="ccStudioMenu">♙ Character library</button><button type="button" id="ccCrewsMenu">◈ Crews</button><button type="button" id="ccAssetsMenu">▧ Art library</button><button type="button" id="ccBestiaryMenu">♧ Bestiary</button><button type="button" id="ccGraphMenu">◇ Concept map</button><button type="button" id="ccTraitWebMenu">◎ Trait relationships</button><button type="button" id="ccWorkshopMenu">✦ Workshop · three benches</button></div></details>
        <div class="cc-menu-actions"><label class="cc-test-battles" title="Practice and test battles. Nothing in them is saved."><span class="cc-sr">Test battles</span><select id="ccTestBattle" aria-label="Test battles"><option value="">⚗ Test battles…</option>${testBattles.map(t=>`<option id="${t.id}" value="${t.id}" title="${esc(t.title)}">${esc(t.label)}</option>`).join("")}</select></label><button type="button" class="cc-primary" id="ccRandomEncounter" title="Roll scenario, terrain, opponents and events with your selected main character">⚔ Random Encounter</button><button type="button" id="ccCustomGame" title="Build a scenario: pick your opponent and companion, then play">✎ Custom Game</button><button type="button" id="ccBossRush" title="Every Omega threat in a row on the Warfare Field">☠ Boss Rush</button></div>
        <button type="button" id="ccExit" hidden>← Library</button>
        ${U.townOn ? `<button type="button" id="ccBackToTown">← Town</button>` : ""}
      </div>`;
      for(const [key,id] of [["scenarios","ccScenariosPanel"],["character","ccCharacterPanel"],["index","ccIndexPanel"],["threat","ccThreatPanel"]]) { const el = $(id); if (el) el.ontoggle = () => { U.setupPanels[key] = el.open; }; }
      if (U.focusPanel) {   // from a town door: that panel alone, open, under the door's own title; the classic menu still shows them all
        const PANEL = { scenarios: "ccScenariosPanel", character: "ccCharacterPanel", index: "ccIndexPanel", threat: "ccThreatPanel" }, TITLE = { scenarios: "Town Hall", character: "Home", index: "The Archive", threat: "Threat leaderboard" };
        ov.querySelectorAll("details.cc-menu-section").forEach((d) => { const mine = d.id === PANEL[U.focusPanel]; d.hidden = !mine; if (mine) d.open = true; });
        const h = ov.querySelector("h2"); if (h) h.textContent = TITLE[U.focusPanel];
        const KEEPER_DOOR = { scenarios: "townHall", character: "home", index: "archive", threat: "threatBoard" }[U.focusPanel];   // Rama (S0), Sita and Jatayu (S1), Ravana (S2)
        if (KEEPER_DOOR) mountKeeper(ov, KEEPER_DOOR, KEEPER_DOOR === "threatBoard" ? { threatRank: TB ? ((TB.top(15).find((r) => r.kind === "main") || {}).rank || 0) : 0 } : {});
      }
      ov.querySelectorAll("[data-challenge-encounter]").forEach((b) => { b.onclick = () => { const sel = $("ccEncounter"); if (sel) { sel.value = b.dataset.challengeEncounter; sel.onchange?.({ target: sel }); } startSafely({ encounter: b.dataset.challengeEncounter, opener: "player" }); }; });   // a boss row opens its own fight
      ov.querySelectorAll("[data-challenge]").forEach((b) => { b.onclick = () => { U.setupFoe = b.dataset.challenge; U.setupAlly = npcRoster.find(n => n.id !== U.setupFoe)?.id; U.bringAlly = false; const ally = ov.querySelector("#ccWithAlly"); if (ally) ally.checked = false; const sel = $("ccEncounter"); if (sel) { sel.value = "rosterScrimmage"; sel.onchange?.({ target: sel }); } startSafely({ encounter: "rosterScrimmage", opener: "player" }); }; });
      ov.querySelector(".cc-item-pack").ontoggle=ev=>{U.setupPanels.pack=ev.currentTarget.open;};
      $("ccMainCharacter").onchange=ev=>selectMain(ev.target.value);
      $("ccSavedCharacter").onchange=ev=>{const saved=U.savedCharacters[Number(ev.target.value)];if(ev.target.value===""||!saved||!C.characters[saved.classId])return;U.character={...saved,lens:{...saved.lens}};U.setupLenses=U.character.lens;if(saved.sprite)U.spritePackages[saved.classId]=saved.sprite;store.set("loci:combat:sprite-packages",U.spritePackages);store.set(CHAR_KEY,U.character);showSetup();};
      $("ccSaveBuild").onclick=()=>{const name=$("ccCharacterName").value.trim()||`${C.characters[mainClass()].name} build`;const saved={...U.character,classId:mainClass(),name,lens:{...U.setupLenses},sprite:chosenSprite(mainClass())};const i=U.savedCharacters.findIndex(c=>c.name===name);if(i<0)U.savedCharacters.push(saved);else U.savedCharacters[i]=saved;store.set("loci:combat:saved-characters",U.savedCharacters);showSetup();flashTip("Character saved.");};
      $("ccStart").onclick = () => startSafely();
      $("ccTeachMode")?.addEventListener("change", (ev) => { U.teachMode = ev.target.checked; store.set("loci:combat:teach-mode", U.teachMode); });
      $("ccNarration").onchange = (ev) => store.set("loci:combat:narration", ev.target.value);
      // Every test battle is one choice in one dropdown (Mala, 2026-10-13). Choosing one starts it.
      $("ccTestBattle").onchange = (ev) => { const t = TEST_BATTLES.find((x) => x.id === ev.target.value); ev.target.value = ""; if (t) startSafely({ encounter: "firstWall", opener: "player", narration: "off", setupOpts: { ...t.options(), testMenu: true } }); };   // testMenu: everything started here is a test battle (1.3.457 audit: themed tests had no "test" in their titles)
      $("ccRandomEncounter").onclick = () => startSafely({ randomEncounter: true, everything: true, opener: "player" });   // Mala, 2026-10-09: randomize everything
      $("ccCustomGame").onclick = () => { const sel = $("ccEncounter"); if (sel) { sel.value = "rosterScrimmage"; sel.onchange?.({ target: sel }); } const p = $("ccScenariosPanel"); if (p) { p.open = true; U.setupPanels.scenarios = true; } flashTip("Custom Game: pick your fighters, then Play scenario."); };
      if ($("ccBossRush")) $("ccBossRush").onclick = () => startSafely({ encounter: "bossRush", opener: "player" });
      $("ccSocketOpponent")?.addEventListener("change", ev => { U.llmEnabled = ev.target.checked; $("ccSocketSettings").hidden = !ev.target.checked; });
      $("ccSocketProvider")?.addEventListener("change", ev => { U.llmSettings.provider = ev.target.value; $("ccLocalModelSettings").hidden = ev.target.value !== "openai"; store.set("loci:llm:settings", U.llmSettings); });
      $("ccSocketEndpoint")?.addEventListener("change", ev => { U.llmSettings.baseURL = ev.target.value.trim(); store.set("loci:llm:settings", U.llmSettings); });
      $("ccSocketModel")?.addEventListener("change", ev => { U.llmSettings.model = ev.target.value.trim(); store.set("loci:llm:settings", U.llmSettings); });
      $("ccDiscoverModels")?.addEventListener("click", async ev => {
        const button = ev.currentTarget, status = $("ccModelStatus"); U.llmSettings.baseURL = $("ccSocketEndpoint").value.trim();
        store.set("loci:llm:settings", U.llmSettings); button.disabled = true; status.textContent = "Checking local model server…";
        try {
          const result = await opts.llmBridge.models(U.llmSettings.baseURL);
          if (result?.error) throw new Error(result.error);
          const list = $("ccSocketModels"); list.replaceChildren(...(result.models || []).map(name => { const option = document.createElement("option"); option.value = name; return option; }));
          status.textContent = list.children.length ? `Found ${list.children.length} model${list.children.length === 1 ? "" : "s"}. Enter or choose one above.` : "Server is reachable but returned no models.";
        } catch (error) { status.textContent = error?.message || "Could not reach local model server."; }
        finally { button.disabled = false; }
      });
      $("ccSetupPrimary").onchange = (ev) => {
        U.character.primary = ev.target.value;
        if (U.character.secondary === U.character.primary) U.character.secondary = "";
        U.character.lens = U.setupLenses; store.set(CHAR_KEY, U.character); showSetup();
      };
      wirePackageControls(ov,showSetup);
      $("ccSetupSecondary").onchange = (ev) => { U.character.secondary = ev.target.value; U.character.lens = U.setupLenses; store.set(CHAR_KEY, U.character); showSetup(); };
      ov.querySelectorAll("select[data-lens]").forEach(sel => sel.onchange = () => { U.setupLenses[sel.dataset.lens] = sel.value; U.character.lens = U.setupLenses; store.set(CHAR_KEY, U.character); });
      $("ccGraphMenu").onclick = () => {openGraph();$("ccGClose").focus();};
      $("ccWorkshopMenu").onclick = () => showWorkshopHub("setup");
      $("ccSetupPackClear").onclick=()=>{U.packSelection=[];showSetup();};
      ov.querySelectorAll("[data-setup-pack]").forEach(b=>b.onclick=()=>{const id=b.dataset.setupPack;if(U.packSelection.length<Loot.battleSlots(U.account)&&U.packSelection.filter(x=>x===id).length<(U.account.stash[id]||0))U.packSelection.push(id);showSetup();});
      ov.querySelectorAll("[data-setup-unpack]").forEach(b=>b.onclick=()=>{const i=U.packSelection.lastIndexOf(b.dataset.setupUnpack);if(i>=0)U.packSelection.splice(i,1);showSetup();});
      $("ccAccount").onclick = showAccount;
      $("ccBestiaryMenu").onclick = () => showBestiary("setup");
      $("ccTraitWebMenu").onclick = () => showTraitWeb("setup");
      $("ccStudioMenu").onclick = () => showStudio("roster");
      $("ccCrewsMenu").onclick = () => showStudio("crews");
      $("ccAssetsMenu").onclick = () => showStudio("library");
      $("ccBestiaryBattle").onclick = () => showBestiary(U.mode);
      $("ccBestiary")?.addEventListener("click", () => showBestiary("setup"));
      $("ccExit").onclick = () => opts.onExit && opts.onExit();
      if ($("ccBackToTown")) $("ccBackToTown").onclick = () => { U.menuView = "town"; showSetup(); };
      $("ccEncounter").onchange = (ev) => {
        U.setupEncounter = ev.target.value;
        $("ccScenariosPanel").querySelector("summary small").textContent={firstWall:"First Wall",gapCourt:"The Gap Court",rosterScrimmage:"Build a scenario",warfare:"Warfare",bossRush:"Boss Rush",secretWarrior:"Secret Warrior",secretWarriorNext:"Secret Warrior"}[ev.target.value];
        const advanced = ev.target.value === "gapCourt";
        if (opts.onEncounterChange) opts.onEncounterChange(ev.target.value);
        $("ccOpener").hidden = !advanced;
        $("ccRosterSetup").hidden = ev.target.value !== "rosterScrimmage";
        $("ccGameMode").disabled = ev.target.value === "warfare" || ev.target.value === "bossRush" || ev.target.value === "secretWarrior" || ev.target.value === "secretWarriorNext";
        if ($("ccRushAllyRow")) $("ccRushAllyRow").hidden = ev.target.value !== "bossRush" && ev.target.value !== "secretWarrior";
        $("ccEncounterNote").textContent = ev.target.value === "secretWarriorNext" && SN ? SN.note : ev.target.value === "secretWarrior" && SW ? SW.note : ev.target.value === "bossRush" ? `Every Omega threat, one after another on the Warfare Field: ${BR ? BR.list().map(e => e.name).join(", ") : "the bosses"}. Bring one ally for the whole run. Win to continue; a loss ends the run. Clear the list for a Boss Rush badge.`
          : ev.target.value === "warfare"
          ? "Three factions collide on the 15×9 Warfare Field: you and a companion, two seeded-config opponents, and wild animals. Only one faction can remain."
          : advanced
          ? "Two opponents combine routed and selective attacks. Keep moving, read each delivery, and use the concept map when needed."
          : ev.target.value === "rosterScrimmage" ? "Choose one NPC opponent and optionally bring an NPC companion. Each NPC draws a seeded configuration from their personal concept pool."
          : "Practice one idea at a time: place a Shield Wall across the Student’s straight-line Filter Bolt.";
        ov.querySelector(".cc-opponents").hidden = ev.target.value !== "gapCourt";
      };
      ov.querySelectorAll("[data-role]").forEach(b => b.onclick = () => { U.selectionRole = b.dataset.role; showSetup(); });
      ov.querySelectorAll("[data-fighter]").forEach(b => {
        const n = npcRoster.find(x=>x.id===b.dataset.fighter);
        const inspect = () => { const panel=$("ccFighterInspect"); if(panel) panel.innerHTML=`<b>${esc(n.name)}</b> · ${n.configs.map(c=>esc(c.label)).join(" / ")}<p>${esc(blurbFor(n))}</p>`; };
        b.onmouseenter = inspect; b.onfocus = inspect;
        b.onclick = () => { if(U.selectionRole==="ally"){ if(n.id===U.setupFoe){U.setupFoe=U.setupAlly;U.setupAlly=n.id;}else U.setupAlly=n.id; U.bringAlly=true; $("ccWithAlly").checked=true; }
          else { if(n.id===U.setupAlly) U.setupAlly=U.setupFoe; U.setupFoe=n.id; }
          showSetup(); const active=ov.querySelector(`[data-fighter="${n.id}"]`); active?.focus(); };
      });
      $("ccWithAlly")?.addEventListener("change", ev=>{ U.bringAlly=ev.target.checked; if(ev.target.checked && U.setupFoe===U.setupAlly) U.setupAlly=npcRoster.find(n=>n.id!==U.setupFoe)?.id; });
      const initial=npcRoster.find(n=>n.id===U.setupFoe); if(initial){const panel=$("ccFighterInspect"); if(panel) panel.innerHTML=`<b>${esc(initial.name)}</b> · ${initial.configs.map(c=>esc(c.label)).join(" / ")}<p>${esc(blurbFor(initial))}</p>`;}
      for(const [id,value] of Object.entries(U.setupScenario||{})) if($(id)&&Array.from($(id).options).some(o=>o.value===value)) $(id).value=value;
      if(!U.setupPanels.scenarios&&!U.setupPanels.character) $("ccRandomEncounter").focus();
    }
    function showBestiary(returnMode = U.mode) {
      stopAi(); U.mode = "bestiary";
      const ov = $("ccOverlay"); ov.hidden = false;
      const cards = bestiaryEntries.map(m => {
        const detail = m.id.startsWith("enemyDream:") ? root.ConceptCombatEnemyDreams.monsters[m.id.slice(11)] : m.id.startsWith("dream:") ? root.ConceptCombatDreamData.monsters[m.id.slice(6)] : W.data.monsters[m.id.slice(5)];
        const portrait = m.art ? spriteImg(m.art,m.name,"cc-bestiary-sprite") : m.wildSprite ? `<img class="cc-bestiary-sprite" src="combat/sprites/${m.wildSprite}/idle.png" alt="${esc(m.name)}">` : `<span class="cc-bestiary-mark" aria-hidden="true">${m.kind==="Dream"?"☾":"♧"}</span>`;
        const appearance = (detail.appear||[]).map(a=>a.when.replaceAll(/([A-Z])/g," $1")).join(" · ") || "Unrecorded";
        return `<article class="cc-bestiary-entry"><div class="cc-bestiary-art">${portrait}</div><div><small>${esc(m.kind.toUpperCase())}</small><h3>${esc(m.name)}</h3><b>${esc(m.concept)}</b><p>${esc(m.blurb||detail.basis||"A landscape process whose behavior can be studied and managed.")}</p><details><summary>Field notes</summary><p>${esc(detail.basis||detail.teaches||"")}</p>${m.id.startsWith("wild:") && wildBehaviour(detail).length ? `<ul class="cc-bestiary-behaviour">${wildBehaviour(detail).map(line => `<li>${esc(line)}</li>`).join("")}</ul>` : ""}<p><b>Appears:</b> ${esc(appearance)}${detail.sci?` · ${esc(detail.sci)}`:""}</p><p><b>Management concepts:</b> ${esc((detail.counters||[]).map(id=>C.concepts[id]?.name||id).join(", ")||m.concept)}</p></details></div></article>`;
      }).join("");
      ov.innerHTML = `<div class="cc-card cc-bestiary"><header><div><h2>Bestiary <small>${bestiaryEntries.length} field and dream threats</small></h2><p class="cc-muted">Study what each creature represents, what it teaches, and the concepts that can answer it.</p></div><button type="button" id="ccBestiaryClose">Back</button></header><div class="cc-bestiary-grid">${cards}</div></div>`;
      $("ccBestiaryClose").onclick = () => { ov.hidden=true; if(returnMode==="setup") showSetup(); else { U.mode=returnMode; render(); pump(); } };
      mountKeeper(ov, "bestiary");   // Jatayu (S1)
    }
    // The Workshop (Mala, 2026-10-30: "The Workshop is kind of confusing"; docs in the spec claude-workshop-clarity-spec): an umbrella
    // landing with three benches (the Concept Tree, the Scribing desk, the Kiln). The Kiln stays in Ledger House; the landing links to it.
    // Folded groups on the tree use the Codex pattern: a native button header, closed by default, kept in WSX_KEY, one toggle per
    // double click, and a corrupt stored value reads as nothing open.
    const WSX_KEY = "loci:combat:workshop-open:v1", HINTS_KEY = "loci:combat:hints:v1";
    const objectOf = (key) => { const raw = store.get(key, {}); return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}; };
    const wsxMap = () => objectOf(WSX_KEY);
    function setWsx(id, on) { const m = wsxMap(); if (on) m[id] = true; else delete m[id]; store.set(WSX_KEY, m); }
    const hintsHidden = () => objectOf(HINTS_KEY).hidden === true;
    const wsxHtml = (id, title, state, body) => { const open = !!wsxMap()[id];
      return `<section class="cc-wsx ${open ? "open" : ""}" data-wsx="${id}"><h3><button type="button" class="cc-wsx-head" data-wsx-toggle="${id}" aria-expanded="${open}" aria-controls="ccWsx-${id}"><span class="cc-chev" aria-hidden="true">${open ? "▾" : "▸"}</span>${esc(title)}<span class="cc-wsx-n">${esc(state)}</span></button></h3><div class="cc-wsx-body" id="ccWsx-${id}" ${open ? "" : "hidden"}>${body}</div></section>`; };
    function wireWsx(ov) {
      ov.querySelectorAll("[data-wsx-toggle]").forEach((h) => h.onclick = () => { const now = Date.now(); if (h.dataset.wsxAt && now - h.dataset.wsxAt < 450) return; h.dataset.wsxAt = now;   // a double click toggles once
        const sec = h.closest(".cc-wsx"), on = h.getAttribute("aria-expanded") !== "true"; setWsx(h.dataset.wsxToggle, on); h.setAttribute("aria-expanded", on); sec.classList.toggle("open", on); sec.querySelector(".cc-wsx-body").hidden = !on; h.firstElementChild.textContent = on ? "▾" : "▸"; });
      ov.querySelectorAll(".cc-wsx-body").forEach((body) => { const keep = () => setWsx(body.closest(".cc-wsx").dataset.wsx, true); body.addEventListener("click", keep); body.addEventListener("change", keep); });   // the group you act in stays open after the screen redraws
    }
    function showWorkshopHub(returnMode = U.mode) {
      if (!WS || !GD || !WH) { flashTip("The Workshop is closed."); return; }
      stopAi(); U.mode = "workshop";
      const ov = $("ccOverlay"); ov.hidden = false; ov.classList.remove("cc-work-host");
      const lg = LB ? LB.fresh(U.account.legacy) : null, p = U.account.parts || {}, owned = U.account.ownedNodes || [];
      const deskOpen = !!(LB && root.ConceptCombatWorkshopUI), kilnOpen = !!KR;
      const KEEPERS = { desk: "freemason", kiln: "talisman" };   // named slots for the keepers (Mala's 2026-10-27 casting); the keeper helper is another build
      const bench = (id, title, purpose, state, open, why) => `<article class="cc-ws-bench" data-bench="${id}">${KEEPERS[id] ? `<div class="cc-keeper-slot" data-keeper-slot="${KEEPERS[id]}" hidden></div>` : ""}<h3>${esc(title)}</h3><p>${esc(purpose)}</p><p class="cc-ws-benchstate" id="ccWsBench-${id}-state">${esc(state)}</p><button type="button" class="cc-primary" id="ccWsBench-${id}" ${open ? "" : `disabled aria-describedby="ccWsBench-${id}-state"`}>Open</button>${open ? "" : `<small class="cc-muted">${esc(why)}</small>`}</article>`;
      ov.innerHTML = `<div class="cc-card cc-workshop cc-ws-hub" role="dialog" aria-label="Workshop"><header><div><div class="cc-keeper-slot" data-keeper-slot="starfarer" hidden></div><h2>Workshop</h2><p class="cc-muted">Three benches: read and own concepts, write techniques of your own, fire vessels.</p></div><button type="button" id="ccWsClose">Back</button></header>
        <div class="cc-ws-benches">${bench("tree", "Concept Tree", "Read every concept; spend discoveries to own one.", WH.treeCard({ wallet: U.account.discoveries || 0, owned: owned.length }), true)}
        ${bench("desk", "Scribing desk", "Turn parts into a technique of your own.", WH.deskCard({ parts: lg ? lg.parts.length : 0, held: lg ? lg.memory.held.length : 0, slots: lg ? lg.memory.slots : 0 }), deskOpen, "The desk is closed.")}
        ${bench("kiln", "Kiln", "Fire parts and Seeds into vessels.", WH.kilnCard({ common: p.common || 0, uncommon: p.uncommon || 0, rare: p.rare || 0 }), kilnOpen, "The kiln is closed.")}</div>
        <p class="cc-muted">The Kiln lives in Ledger House; its bench opens it there.</p></div>`;
      $("ccWsClose").onclick = () => { if (returnMode === "setup") showSetup(); else if (returnMode === "town") showTown(); else if (returnMode === "account") showAccount(); else { ov.hidden = true; U.mode = returnMode; render(); pump(); } };
      $("ccWsBench-tree").onclick = () => showWorkshop(returnMode);
      const deskBtn = $("ccWsBench-desk"); if (deskBtn && deskOpen) deskBtn.onclick = () => root.ConceptCombatWorkshopUI.mount(ov, { getAccount: () => U.account, save: (account) => { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(A.serialize(account))); U.account = account; }, C, E, back: () => showWorkshopHub(returnMode), backLabel: "← Workshop", crumb: "THE WORKSHOP" });
      const kilnBtn = $("ccWsBench-kiln"); if (kilnBtn && kilnOpen) kilnBtn.onclick = () => { U.mode = "setup"; showAccount(); ov.querySelector(".cc-kiln")?.scrollIntoView?.({ block: "center" }); };
      $("ccWsBench-tree").focus();
    }
    function showWorkshop(returnMode = U.mode) {   // W6.1: the Concept Tree (named the Workshop until 1.3.489) — walk anywhere free, own a path
      if (!WS || !GD || !WH) { flashTip("The Workshop is closed."); return; }
      stopAi(); U.mode = "workshop";
      const ov = $("ccOverlay"); ov.hidden = false;
      const home = new Set([C.characters[mainClass()]?.primary, C.characters[mainClass()]?.secondary].filter(Boolean));
      const homeSchool = SCH ? SCH.doorOf(C.characters[mainClass()]?.primary) : null;   // W8.5: your primary concept's school is your door, pre-keyed
      let mintA = null, mintB = null;   // W6.3: mint picks persist across tree redraws
      let wsRings = false;   // W7.1: rings view persists across redraws
      const solemnize = (id, ctx) => {   // W7.3: every rite beats twice and sounds its sting
        if (!Ceremony || !Tracks) return null;
        const r = Ceremony.RITES.includes(id) ? Ceremony.rite(id, ctx) : null;
        if (!r) return null;
        for (const c of r.cues) Tracks.cue(c.slot, c.opts || {});
        return r.beats.join(" ");
      };
      let rwOpen = false, rwCascade = null;   // W6.2: rewrite panel state
      const rwHtml = (sel, c) => {   // W6.2: rewrite form, free cascade preview, mandatory confirm
        if (!rwOpen) return `<div><button type="button" id="ccWsRewrite">Rewrite…</button> <small class="cc-muted">${esc(WH.COPY.rewriteClosed)}</small></div>`;
        const cur = (U.account.nodeStyles || {})[sel] || {};
        const profiles = Object.keys(c.lens?.profiles || {});
        const lensOpts = profiles.map((p) => `<option value="${p}"${(cur.dials?.lens || c.lens?.default) === p ? " selected" : ""}>${esc(c.lens.profiles[p].name || p)}</option>`).join("");
        let cascade = "";
        if (rwCascade) {
          const rows = rwCascade.rips.map((r) => `<li>${esc(r.name)}${r.named ? "" : " (blend)"} · ledger no. ${r.oldEq} → <b>${r.newEq}</b></li>`).join("") || "<li>No downstream artifacts — a quiet edit.</li>";   // the numbers sit in a closed details: developers need them, players do not
          const poor = (U.account.discoveries || 0) < 1;
          cascade = `<details class="cc-ws-cascade-fold"><summary>What shifts in your ledger (${rwCascade.rips.length})</summary><ul class="cc-ws-cascade">${rows}</ul></details><p><b>${esc(RW.warning(cur.name || c.name, rwCascade.rips))}</b></p>
            <button type="button" class="cc-primary" id="ccWsRwGo" ${poor ? `disabled aria-describedby="ccWsRwWhy"` : ""}>Confirm rewrite · 1 discovery</button>${poor ? ` <small class="cc-muted" id="ccWsRwWhy">Needs 1 discovery (you have ${U.account.discoveries || 0}).</small>` : ""}`;
        }
        return `<div class="cc-ws-rewrite"><div class="cc-row"><label>Name <input id="ccRwName" maxlength="40" value="${esc(cur.name || c.name)}"></label>
          <label>Tint <input type="color" id="ccRwTint" value="${esc(cur.tint || c.color || "#e9c46a")}"></label>
          <label>Default lens <select id="ccRwLens">${lensOpts}</select></label></div>
          <div class="cc-row"><button type="button" id="ccWsRwPreview">Preview what shifts</button><button type="button" id="ccWsRwCancel">Cancel</button></div>${cascade}</div>`;
      };
      const draw = (sel = null, chit = false) => {
        const wallet = U.account.discoveries || 0, owned = U.account.ownedNodes || [], chits = U.account.affinityChits || 0;
        const stateOf = (id) => WS.nodeState(U.account, GD, id, C);
        const bonded = owned.some((o) => WS.neighbors(GD, o).some((n) => C.concepts[n] && !owned.includes(n)));   // a ◐ node exists
        const step = WH.nextStep({ wallet, owned: owned.length, bonded, ledger: (U.account.mergeLedger || []).length }), hintsOn = !hintsHidden();
        const keys = SCH ? SCH.keysOf(U.account, homeSchool) : new Set();
        const dot = (st) => st === "owned" ? "●" : st === "bonded" ? "◐" : "○";
        const fams = Object.entries(GD.families || {}).map(([fid, f]) => {
          const ids = (f.concepts || []).filter((id) => C.concepts[id]);
          if (!ids.length) return "";
          const chips = ids.map((id) => { const st = (U.account.nodeStyles || {})[id] || {}; const label = st.name || C.concepts[id].name; const locked = SCH && SCH.claimBlock(U.account, homeSchool, id); return `<button type="button" class="cc-ws-node cc-ws-${stateOf(id)}${home.has(id) ? " cc-ws-home" : ""}${hintsOn && step?.id === "claim-home" && home.has(id) ? " cc-ws-pulse" : ""}${locked ? " cc-ws-locked" : ""}" data-ws="${id}"${st.tint ? ` style="border-color:${esc(st.tint)}"` : ""} title="${esc(label)}${st.name ? ` (was ${esc(C.concepts[id].name)})` : ""} · ${stateOf(id)}${home.has(id) ? " · home" : ""}">${dot(stateOf(id))} ${esc(label)}</button>`; }).join("");
          return `<section class="cc-ws-fam"><h4>${esc(f.name)}</h4><div class="cc-ws-nodes">${chips}</div></section>`;
        }).join("");
        const exam = SCH ? SCH.examStatus(U.account) : null;   // W8.4: the Still Water's three seals (told inside the Schools group)
        let detail = `<p class="cc-muted">Click any concept to read it.</p>`;
        if (sel && C.concepts[sel]) {
          const c = C.concepts[sel], st = stateOf(sel);
          const nbs = WS.neighbors(GD, sel).filter((id) => C.concepts[id]);
          const qp = VV ? VV.claimPrice(GD, owned, sel, { table: VV.BLESSED, chit: chit && chits > 0 }) : { cost: WS.claimCost(0), dist: 0, bridged: false };   // W6.4: distance prices the claim
          const sung = VV && owned.some((o) => VV.blessed(o, sel, VV.BLESSED));
          const school = SCH && SCH.schoolOf(sel), lockMsg = SCH && st !== "owned" ? SCH.claimBlock(U.account, homeSchool, sel) : null;
          detail = `<div class="cc-ws-detail"><h3>${esc(c.name)}${home.has(sel) ? " ⌂" : ""}${sung ? " ♪" : ""}</h3>${SCR && SCR.readings(C, sel)?.math ? `<details><summary>${esc(WH.COPY.readings)}</summary><p><b>Mechanism:</b> ${esc(SCR.readings(C, sel).mechanism || "—")}</p><p><b>Math:</b> ${esc(SCR.readings(C, sel).math)}</p><p><b>Lesson:</b> ${esc(SCR.readings(C, sel).lesson || "—")}</p><p><b>Scope:</b> ${esc(SCR.readings(C, sel).scope || "—")}</p><p><b>Limits:</b> ${esc(SCR.readings(C, sel).limits || "—")}</p></details>` : ""}${school ? `<p class="cc-muted">${esc(school)} Water (a school of concepts): ${esc(SCH.WATERS[school])}${school === homeSchool ? " · your home Water" : ""}${SCH.OPPOSED.some((q) => q.includes(school) && q.includes(homeSchool) && school !== homeSchool) ? " · the water opposite yours: blends here scream unless blessed" : ""}</p>` : ""}<p>${esc(c.mechanism || "")}</p>${lockMsg ? `<p class="cc-ws-lock" id="ccWsLockWhy">🔒 ${esc(lockMsg)}</p>` : ""}
            <p class="cc-muted">${esc(WH.stateLine({ state: st, ownedCount: owned.length, dist: qp.dist, nbs: nbs.length, sung, bridged: qp.bridged }))}</p>
            ${st === "owned" ? "" : `${chits > 0 && qp.dist > 1 && !qp.bridged ? `<label><input type="checkbox" id="ccWsChit"> Bridge with a chit (${chits} held)</label> ` : ""}<button type="button" class="cc-primary" id="ccWsClaim" ${wallet < qp.cost || lockMsg ? `disabled aria-describedby="${[lockMsg ? "ccWsLockWhy" : "", wallet < qp.cost ? "ccWsClaimWhy" : ""].filter(Boolean).join(" ")}"` : ""}>Claim · ${qp.cost} ${qp.cost === 1 ? "discovery" : "discoveries"}</button>${wallet < qp.cost ? ` <small class="cc-muted" id="ccWsClaimWhy">${esc(WH.claimWhy({ wallet, cost: qp.cost }))}</small>` : ""}`}${st === "owned" && RW ? rwHtml(sel, c) : ""}</div>`;
        }
        const ringHtml = (SCR && wsRings) ? (() => {
          const homeIds = [...home].filter((id) => C.concepts[id]);
          const rs = SCR.rings(GD, C, homeIds.length ? homeIds : [Object.keys(C.concepts)[0]]);
          return rs.map(({ ring, ids }) => `<section class="cc-ws-fam"><h4>${ring === 0 ? "⌂ Home" : `Ring ${ring} · ${ring} ${ring === 1 ? "step" : "steps"} from home`}</h4><div class="cc-ws-nodes">${ids.map((id) => { const st = (U.account.nodeStyles || {})[id] || {}; const label = st.name || C.concepts[id].name; const dotSt = stateOf(id); return `<button type="button" data-ws="${id}" title="${esc(C.concepts[id].name)}">${dot(dotSt)} ${esc(label)}</button>`; }).join("")}</div></section>`).join("");
        })() : "";
        const DetailWrap = (d) => `<div class="cc-ws-detail-wrap">${d}</div>`;
        let mintHtml = "", mintPv = null;   // W6.3: free preview, priced blend, first-minter names
        if (PA) {
          const kindOf = (v) => /^verb:/.test(v || "") ? "verb" : "node";
          const nodeOpts = (v) => owned.filter((id) => C.concepts[id]).map((id) => `<option value="${id}"${id === v ? " selected" : ""}>${esc(C.concepts[id].name)}</option>`).join("");
          const verbOpts = (v) => VB ? VB.SCHOOLS.map((sn, si) => `<optgroup label="Verbs · ${esc(sn)} Water">` + Object.entries(VB.VERBS).filter(([, w]) => w.school === si).map(([n, w]) => `<option value="verb:${n}"${`verb:${n}` === v ? " selected" : ""}>${esc(w.name)}${VT && VT.BODIED.has(+n) ? " ◆" : ""}</option>`).join("") + `</optgroup>`).join("") : "";
          const opts = (v, kind) => `<option value="">—</option>` + (kind !== "verb" ? nodeOpts(v) : "") + (kind !== "node" ? verbOpts(v) : "");
          const mixedMint = mintA && mintB && (/^verb:/.test(mintA) !== /^verb:/.test(mintB));   // pairs of a kind: a node and a verb have no road; refused here, not only by the picker filter
          mintPv = !mixedMint && mintA && mintB ? PA.preview(GD, C, U.account, [mintA, mintB]) : null;
          const poor = mintPv && !mintPv.unowned.length && wallet < mintPv.price;
          const pvLine = mixedMint ? `<span class="cc-muted">Pairs of a kind — two nodes or two verbs.</span>` : !mintPv ? "" : mintPv.unowned.length ? `<span class="cc-muted">Both nodes must be ones you own.</span>`
            : `<span>${esc(WH.blendLine(mintPv))}</span> <button type="button" id="ccWsMint" ${poor ? `disabled aria-describedby="ccWsMintWhy"` : ""}>Blend · ${mintPv.price} ${mintPv.price === 1 ? "discovery" : "discoveries"}</button>${poor ? ` <small class="cc-muted" id="ccWsMintWhy">Needs ${mintPv.price} ${mintPv.price === 1 ? "discovery" : "discoveries"} (you have ${wallet}).</small>` : ""}
              <details class="cc-ws-eq"><summary>${esc(WH.COPY.ledgerNoLabel)}</summary><p>Ledger no. ${mintPv.eq}</p></details>`;
          const nameRow = mintPv && !mintPv.named && !mintPv.unowned.length && (U.account.mergeLedger || []).some((e) => e.eq === mintPv.eq) ? ` <label>${esc(WH.COPY.blendNameLabel)} <input id="ccWsName" maxlength="60" placeholder="A name for this blend"></label> <button type="button" id="ccWsNameGo">Name</button>` : "";
          const verbId = (p) => { const m = /^verb:(\d+)$/.exec(p || ""); return m ? +m[1] : 0; };
          const bodyless = VT && mintPv && !mintPv.unowned.length && [verbId(mintA), verbId(mintB)].some((n) => n && !VT.BODIED.has(n));   // only verbs 9, 10, 14 execute
          const bOff = !mintA;
          mintHtml = wsxHtml("blend", WH.COPY.blendTitle, WH.blendState({ wallet, owned: owned.length }), `<section class="cc-ws-mint"><p class="cc-muted">${esc(WH.COPY.blendHelp)}</p><p class="cc-muted">${esc(WH.COPY.verbLegend)}</p><div class="cc-row"><label>First <select id="ccWsA">${opts(mintA)}</select></label><label>Second <select id="ccWsB" ${bOff ? `disabled aria-describedby="ccWsBWhy"` : ""}>${opts(mintB, kindOf(mintA))}</select></label></div>${bOff ? `<p class="cc-muted" id="ccWsBWhy">${esc(WH.COPY.blendFirstFirst)}</p>` : ""}<div>${pvLine}${nameRow}${bodyless ? ` <span class="cc-muted">${esc(WH.COPY.bodyless)}</span>` : ""}</div></section>`);
        }
        const schoolsHtml = SCH ? wsxHtml("schools", WH.COPY.watersTitle, `${SCH.RING.filter((w) => keys.has(w)).length} of ${SCH.RING.length} Waters open${exam && exam.seals.depth === null ? " · exam not open yet" : ""}`,
          `<p>${esc(WH.COPY.waterOnce)}</p><ul class="cc-ws-waters">${SCH.RING.map((w) => { const g = SCH.GATES[w]; const status = w === homeSchool ? "open: your home Water" : !keys.has(w) ? "closed" : g?.pending && !(U.account.schoolKeys || []).includes(w) ? "open for now: its proof is not built yet" : "open";
            return `<li><b>${esc(w)}</b> (${esc(SCH.WATERS[w])}) · ${status}<br><small class="cc-muted">Proof: ${esc(g?.proof || "")}</small></li>`; }).join("")}<li><b>${esc(SCH.CENTER)}</b> (${esc(SCH.WATERS[SCH.CENTER])}) · by the exam below</li></ul>
          <p>${esc(WH.examLine(exam, SCH.RULES, (U.account.mergeLedger || []).length))}</p><p class="cc-muted">${esc(WH.COPY.tendedNote)}</p>`) : "";
        const wsHead = `<p class="cc-muted">${esc(WH.COPY.purpose)}</p><p class="cc-ws-wallet">${esc(WH.walletLine(wallet, owned.length, chits))} · ${esc(WH.COPY.sealNote)}</p>`;
        const legend = `<p class="cc-ws-legend" id="ccWsLegend">${esc(WH.COPY.legendSymbols)}</p><details class="cc-ws-legend2"><summary>${esc(WH.COPY.legendGroupsTitle)}</summary><ul>${WH.COPY.legendGroups.map(([n, t]) => `<li><b>${esc(n)}</b>: ${esc(t)}</li>`).join("")}</ul></details>`;
        const nextRow = `<div class="cc-ws-nextrow">${hintsOn && step ? `<p class="cc-ws-next" id="ccWsNext" role="status">${esc(step.text)}</p>` : ""}<details class="cc-ws-earn"><summary>${esc(WH.COPY.earnTitle)}</summary><p>${esc(WH.COPY.earn)}</p></details> <button type="button" class="cc-ws-link" id="ccWsHintToggle">${esc(hintsOn ? WH.COPY.hideHints : WH.COPY.showHints)}</button></div>`;
        const foot = `<p class="cc-muted cc-ws-foot">${esc(WH.COPY.soundNote)}${Tracks ? ` <button type="button" class="cc-ws-link" id="ccWsSound">Sound: ${Tracks.enabled() ? "on" : "off"}</button>` : ""}</p>`;
        ov.innerHTML = `<div class="cc-card cc-workshop cc-tree" role="dialog" aria-label="Concept Tree"><header><div><div class="cc-keeper-slot" data-keeper-slot="starfarer" hidden></div><h2>Concept Tree</h2>${wsHead}${SCR ? `<button type="button" id="ccWsView">${wsRings ? WH.COPY.groupFamily : WH.COPY.groupRing}</button>` : ""}</div><button type="button" id="ccWsTreeBack">← Workshop</button></header>${nextRow}${legend}${DetailWrap(detail)}<div class="cc-ws-tree">${wsRings && ringHtml ? ringHtml : fams}</div>${mintHtml}${schoolsHtml}${foot}</div>`;
        wireWsx(ov);
        const ht = $("ccWsHintToggle"); if (ht) ht.onclick = () => { store.set(HINTS_KEY, { hidden: hintsOn }); draw(sel, chit); };
        const sd = $("ccWsSound"); if (sd) sd.onclick = () => { Tracks.setEnabled(!Tracks.enabled()); draw(sel, chit); };
        ov.querySelectorAll("[data-ws]").forEach((b) => b.onclick = () => { rwOpen = false; rwCascade = null; draw(b.dataset.ws); });
        const vw = $("ccWsView"); if (vw) vw.onclick = () => { wsRings = !wsRings; draw(sel, chit); };
        const rw = $("ccWsRewrite");
        if (rw) rw.onclick = () => { rwOpen = true; rwCascade = null; draw(sel, chit); };
        const rwC = $("ccWsRwCancel");
        if (rwC) rwC.onclick = () => { rwOpen = false; rwCascade = null; draw(sel, chit); };
        const rwP = $("ccWsRwPreview");
        if (rwP) rwP.onclick = () => {
          const patch = { name: $("ccRwName").value.trim().slice(0, 40) || C.concepts[sel].name, tint: $("ccRwTint").value, dials: { lens: $("ccRwLens").value } };
          rwCascade = { patch, rips: RW.ripples(PA, VV, GD, C, U.account, sel, patch, PA.TABLE) };
          draw(sel, chit);
        };
        const rwG = $("ccWsRwGo");
        if (rwG && rwCascade) rwG.onclick = () => {
          const r = RW.apply(U.account, sel, rwCascade.patch, PA, VV, GD, C, PA.TABLE);
          if (!r.ok) { flashTip(r.error); return; }
          const rwDepth = (rwCascade?.rips || []).length;
          U.account = r.account; saveAccount(); rwOpen = false; rwCascade = null;
          const rwRite = solemnize("rewrite", { depth: rwDepth });
          flashTip(rwRite || r.lines[0]); draw(sel, chit);
        };
        const cx = $("ccWsChit"); if (cx) cx.onchange = () => draw(sel, cx.checked);
        const cl = $("ccWsClaim"); if (cl) cl.onclick = () => {
          const q = VV ? VV.claimPrice(GD, U.account.ownedNodes || [], sel, { table: VV.BLESSED, chit: chit && (U.account.affinityChits || 0) > 0 }) : { cost: WS.claimCost(0), bridged: false };
          const block = SCH && SCH.claimBlock(U.account, homeSchool, sel); if (block) { flashTip(block); return; }   // W8.4: a gated school is visible, not claimable
          const r = WS.claim(U.account, sel, C, GD, q.cost); if (!r.ok) { flashTip(r.error); return; }
          U.account = q.bridged ? { ...r.account, affinityChits: (r.account.affinityChits || 0) - 1 } : r.account;
          saveAccount();
          flashTip(solemnize("claim", { name: C.concepts[sel].name }) || `Claimed ${C.concepts[sel].name}${q.bridged ? " (chit bridged it)" : ""}.`); draw(sel);
        };
        const sA = $("ccWsA"), sB = $("ccWsB");
        if (sA) sA.onchange = () => { mintA = sA.value || null; if (!mintA || (mintB && /^verb:/.test(mintB) !== /^verb:/.test(mintA))) mintB = null; draw(sel, chit); };   // the second pick matches the first kind
        if (sB) sB.onchange = () => { mintB = sB.value || null; draw(sel, chit); };
        const mm = $("ccWsMint");
        if (mm && mintPv) mm.onclick = () => {
          const pv = PA.preview(GD, C, U.account, [mintA, mintB]);
          if (pv.unowned.length || (U.account.discoveries || 0) < pv.price) { flashTip("A blend needs its price in discoveries."); return; }
          U.account = { ...U.account, discoveries: U.account.discoveries - pv.price,
            mergeLedger: [...(U.account.mergeLedger || []), { eq: pv.eq, parents: pv.parents, drift: pv.drift, dist: pv.dist, name: pv.named ? pv.name : null, minter: U.account.name || "Warden" }] };
          saveAccount();
          flashTip(solemnize("mint", {}) || (pv.named ? `Blended ${pv.name}.` : "Blended something unnamed — give it a name."));   // the beat names no raw ledger number
          draw(sel, chit);
        };
        const ng = $("ccWsNameGo");
        if (ng && mintPv) ng.onclick = () => {
          const r = PA.nameMerge(U.account, mintPv.eq, $("ccWsName").value);
          if (!r.ok) { flashTip(r.error); return; }
          U.account = { ...r.account, mergeLedger: (r.account.mergeLedger || []).map((e) => e.eq === mintPv.eq ? { ...e, name: $("ccWsName").value.trim().slice(0, 60) } : e) };
          saveAccount();
          flashTip(solemnize("naming", { name: $("ccWsName").value.trim().slice(0, 60) }) || "The lore is earned."); draw(sel, chit);
        };
        $("ccWsTreeBack").onclick = () => showWorkshopHub(returnMode);   // one return path: the tree goes back to the landing, the landing goes back to where it was opened
      };
      draw();
    }
    function showSchool(returnMode = U.mode) {   // W6.6: paid drills on the Teach bank
      if (!TU || !TEACH) { flashTip("The School is closed."); return; }
      stopAi(); U.mode = "school";
      const ov = $("ccOverlay"); ov.hidden = false;
      const rate = Loot.data.seedRules.perCorrectAnswer;
      const back = () => { if (returnMode === "setup") showSetup(); else if (returnMode === "town") showTown(); else { ov.hidden = true; U.mode = returnMode; render(); pump(); } };
      const drawHome = () => {
        const tc = TU.cycleOf(U.account), no = TU.canDrill(U.account);
        ov.innerHTML = `<div class="cc-card cc-school"><header><div><h2>School</h2><p class="cc-muted">5 questions · ${rate} Seeds a correct answer · perfect 5/5 +${TU.RULES.perfectBonus} · ${tc.drills}/${TU.RULES.drillsPerCycle} drills · ${tc.paid}/${TU.RULES.capTotal} Seeds this cycle</p></div><button type="button" id="ccSchoolClose">Back</button></header>
          ${no ? `<p class="cc-muted">${esc(no)}</p>` : `<button type="button" class="cc-primary" id="ccDrillGo">Start drill</button>`}</div>`;
        $("ccSchoolClose").onclick = back;
        const go = $("ccDrillGo"); if (go) go.onclick = () => runDrill({ seen: [], right: 0, i: 0 });
        mountKeeper(ov, "school", { drillsLeft: Math.max(0, TU.RULES.drillsPerCycle - tc.drills) });   // Lakshmana (S2): the same cycle count the header shows
      };
      const runDrill = (st) => {
        const tc = TU.cycleOf(U.account);
        const card = TEACH.inquiryCard({ seed: tc.cycle * 100 + tc.drills, round: st.i, actor: { id: "school", name: "School", sprite: null }, seen: st.seen });
        if (!card) { finishDrill(st); return; }
        ov.innerHTML = `<div class="cc-card cc-school"><h2>Drill · ${st.i + 1}/5</h2><p class="cc-muted">${esc(card.topic)} · ${esc(card.lead || "")}</p><p>${esc(card.prompt)}</p>
          <div class="cc-row">${card.choices.map((c, i) => `<button type="button" data-drill="${i}">${esc(c)}</button>`).join("")}</div></div>`;
        ov.querySelectorAll("[data-drill]").forEach((b) => b.onclick = () => {
          const r = TEACH.answer(card, +b.dataset.drill), hit = r.correct;
          const next = { seen: [...st.seen, card.id], right: st.right + (hit ? 1 : 0), i: st.i + 1 };
          ov.innerHTML = `<div class="cc-card cc-school"><h2>${hit ? "Correct." : "Missed — lesson kept."}</h2>
            ${hit ? "" : `<p>Right answer: <b>${esc(r.right || "")}</b></p>`}<p class="cc-muted">${esc(r.explain || "")}</p>
            <button type="button" class="cc-primary" id="ccDrillNext">${next.i >= TU.RULES.questions ? "Finish drill" : "Next"}</button></div>`;
          $("ccDrillNext").onclick = () => (next.i >= TU.RULES.questions ? finishDrill(next) : runDrill(next));
        });
      };
      const finishDrill = (st) => {
        const r = TU.settleDrill(U.account, st.right, rate);
        if (!r.ok) { flashTip(r.error); drawHome(); return; }
        U.account = r.account; saveAccount();
        ov.innerHTML = `<div class="cc-card cc-school"><h2>Drill done · ${st.right}/5</h2><p>${esc(r.lines[0])}</p><button type="button" class="cc-primary" id="ccSchoolClose2">Back</button></div>`;
        $("ccSchoolClose2").onclick = back;
      };
      drawHome();
    }
    function showBusk(returnMode = U.mode) {   // W6.5: the hat on the ground
      if (!BK) { flashTip("The square is empty."); return; }
      stopAi(); U.mode = "busk";
      const ov = $("ccOverlay"); ov.hidden = false;
      const back = () => { if (returnMode === "setup") showSetup(); else if (returnMode === "town") showTown(); else { ov.hidden = true; U.mode = returnMode; render(); pump(); } };
      const gearCount = Object.values(U.account.gear?.equipped || {}).filter(Boolean).length;
      const glamour = BK.glamourOf({ primary: U.character?.primary, secondary: U.character?.secondary }, gearCount, 0);
      const fame = Math.min(BK.RULES.fameMax, U.account.fame || 0);
      const bc = U.account.buskCycle, spent = bc && bc.cycle === (U.account.battles || 0) && bc.busked >= BK.RULES.perCycle;
      const diff = BK.crowdDiff(U.account.battles || 0, fame);
      ov.innerHTML = `<div class="cc-card cc-school"><header><div><h2>Town square</h2><p class="cc-muted">Glamour ${glamour} · fame ${fame} · room difficulty ${diff} · once a cycle · pays to ${BK.RULES.capTotal}</p></div><button type="button" id="ccBuskClose">Back</button></header>
        ${spent ? `<p class="cc-muted">The hat is full this cycle. Battle on.</p>` : `<button type="button" class="cc-primary" id="ccBuskGo">Busk</button> <span class="cc-muted">Tiers ${[2, 4, 6, 8].map((t) => `${t}→${BK.tiers(t)}`).join(" · ")}</span>`}<div id="ccBuskOut"></div></div>`;
      $("ccBuskClose").onclick = back;
      const go = $("ccBuskGo"), power = glamour + fame, losing = power < diff;   // the comparison busking.js makes: below the room is a tomatoed busk
      mountKeeper(ov, "square", { busk: { power, diff } });   // the Gambler (S2)
      if (spent) root.ConceptCombatKeeperUI?.say("refuse");
      let asked = false;
      if (go) go.onclick = () => {
        if (losing && !asked) { asked = true; go.textContent = "Busk anyway (tomatoes)"; flashTip("A hard room: busking now is tomatoes and the ledger remembers. Press again to busk anyway."); return; }   // one confirm step before a losing busk (H18)
        const r = BK.busk(U.account, glamour);
        if (!r.ok) { flashTip(r.error); return; }
        U.account = r.account; saveAccount();
        $("ccBuskOut").innerHTML = `<p>${esc(r.lines[0])}</p>`;
        go.disabled = true;
        root.ConceptCombatKeeperUI?.say(r.mark === "tomatoed" ? "loss" : "win");
      };
    }
    function showTraitWeb(returnMode = U.mode) {
      stopAi(); U.mode = "traitWeb";
      const ov = $("ccOverlay"); ov.hidden = false;
      const main = C.characters[mainClass()];
      const people = [{ id: "player", name: main.name, sprite: (returnMode !== "setup" && U.s?.actors?.player?.sprite) || chosenSprite(mainClass()) }, ...npcRoster.map(person => ({ ...person, sprite: C.characters[person.id] ? chosenSprite(person.id) : person.sprite }))];
      const traitCatalog = new Map([...(INS?.data?.self?.catalog || []), ...Object.entries(INS?.data?.traits || {}).map(([id, t]) => ({ id, ...t }))].map(t => [t.id, t]));
      const edges = (INS?.data?.self?.relationships || []).filter(e => ["genius", "fool", "collaborative", "rivalrous", "believer", "devoutBeliever", "fullBeliever", "convertedDevout", "convertedBeliever", "unexplainedEvent", "nonBeliever"].includes(e.from));
      const label = id => traitCatalog.get(id)?.name || id;
      const relationCards = edges.map(e => `<article class="cc-trait-edge ${e.weight < 0 ? "negative" : "positive"}"><b>${esc(label(e.from))}</b><span aria-label="${e.weight < 0 ? "reduces" : "raises"} likelihood">${e.weight < 0 ? "−→" : "+→"}</span><b>${esc(label(e.to))}</b><small>${e.weight < 0 ? "makes less likely" : "makes more likely"} · ${esc(e.clue)}</small></article>`).join("");
      const drawTraitWeb = (selectedId = $("ccTraitPerson")?.value || "player") => {
        const selected = people.find(p => p.id === selectedId) || people[0];
        const warden = selected.id === "player";
        const allSelf = U.account.self?.traits || [];
        const visibleIds = warden ? allSelf.filter(t => t.apparent).map(t => t.id) : INS?.publicProfileTraits?.(selected.id) || [];
        const hiddenCount = warden ? allSelf.length - visibleIds.length : Math.max(0, (INS?.profileTraitIds?.(selected.id) || []).length - visibleIds.length);
        const comparisons = warden ? [] : people.filter(p => p.id !== selected.id).map(p => ({ person: p, ...INS.relationshipBetweenCharacters(selected.id, p.id) }))
          .filter(r => r.shared.length || r.tension.length).sort((a, b) => (b.shared.length + b.tension.length) - (a.shared.length + a.tension.length));
        const portrait = spriteImg(selected.sprite, `${selected.name} sprite`, "cc-trait-person-sprite");
        const traitBadges = visibleIds.length ? visibleIds.map(id => `<span title="${esc(traitCatalog.get(id)?.text || "")}">${esc(label(id))}</span>`).join("") : `<span class="cc-muted">No public trait signals yet</span>`;
        const relationRows = comparisons.length ? comparisons.map(r => `<li><b>${esc(r.person.name)}</b> · ${[...r.shared.map(id => `common ground: ${label(id)}`), ...r.tension.map(e => `possible tension: ${label(e.from)} / ${label(e.to)}`)].map(esc).join("; ")}</li>`).join("") : `<li class="cc-muted">No strong public-trait relationship recorded.</li>`;
        ov.innerHTML = `<div class="cc-card cc-trait-web"><header><div><h2>Trait Relationships</h2><p class="cc-muted">Edges change generation odds; they are tendencies, not rules or guarantees. Hover a trait for its description.</p></div><button type="button" id="ccTraitWebClose">Back</button></header>
          <div class="cc-trait-key"><span class="plus">+ raises the next-trait odds</span><span class="minus">− lowers the next-trait odds</span></div><div class="cc-trait-web-grid">${relationCards}</div>
          <section class="cc-trait-person"><label>Character <select id="ccTraitPerson">${people.map(p => `<option value="${p.id}" ${p.id===selected.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label>
            <div class="cc-trait-person-card">${portrait}<div><h3>${esc(selected.name)}</h3><p>${warden ? "Your character's apparent traits are shown; unknown traits stay private." : "Only traits openly observable at encounter start are shown here."}</p><div class="cc-trait-badges">${traitBadges}</div><small>${hiddenCount} less-visible trait${hiddenCount===1?"":"s"} · ${esc((warden ? [U.character?.primary, U.character?.secondary].filter(Boolean) : selected.conceptPool || [selected.primary,selected.secondary].filter(Boolean)).map(id=>C.concepts[id]?.name||id).join(" + ") || "character roster")}</small></div></div>
            ${!warden?`<h4>Connections to the cast</h4><ul>${relationRows}</ul>`:""}</section>
          <p class="cc-muted">Genius: +5% ability damage and +20% ultimate charge. Fool: −5% and −20%. Collaborative: −2% ability damage and +10% charge. Rivalrous: +4% ability damage and −10% charge. Multipliers stack and are bounded.</p></div>`;
        $("ccTraitPerson").onchange = e => drawTraitWeb(e.target.value);
        $("ccTraitWebClose").onclick = () => { if(returnMode==="setup") showSetup(); else { ov.hidden=true; U.mode=returnMode; pump(); } };
        mountKeeper(ov, "traitWeb");   // Jatayu (S1): every redraw (the character picker rebuilds the overlay) mounts again; the greeting still plays once
      };
      drawTraitWeb();
    }
    // Beads and the swallow tracker (account/beads.js; Mala, 2026-10-26: "should be a tracker that says how many beads of the
    // creature youve swallowed"). Each bead can be released in battle or swallowed here; swallowing enough of one creature
    // learns it as a beast summon.
    function beadBoard() {
      const beads = U.account.beads || [], BS = root.ConceptCombatBeadSwallow;
      const rows = BS ? BS.tracker(U.account) : [];
      const pips = (r) => `<span class="cc-pips" aria-hidden="true">${Array.from({ length: r.need }, (_, i) => `<i class="${i < r.swallowed ? "on" : ""}"></i>`).join("")}</span>`;
      const tracker = rows.length ? `<h4>Swallowed</h4><ul class="cc-swallow-tracker">${rows.map((r) => `<li data-track="${esc(r.key)}"><b>${esc(BS.trackerLine(r))}</b> ${r.learned ? `<span class="cc-good">in your summon list</span>` : pips(r)}</li>`).join("")}</ul>` : "";
      const list = beads.length ? `<ul>${beads.map((b, i) => { const r = rows.find((x) => x.key === BS?.keyOf(b)), left = r ? r.need - r.swallowed : 0;
        if (BS?.carriable && !BS.carriable(b, W?.data?.monsters)) return `<li><b>${esc(b.name || b.kind)}</b>: a keepsake. It holds no creature to release or learn, but it can be staked.</li>`;
        return `<li><b>${esc(b.name || b.kind)}</b>: releases a beast with ${Math.max(1, Math.ceil((b.maxLF || 20) * 0.5))} LF ${b.kind === "dream" && b.mind ? "that stays with you" : "for three turns"}.${BS ? (r?.learned ? ` <span class="cc-muted">Learned already.</span>` : ` <button type="button" class="cc-item" data-swallow="${i}">Swallow · ${left} more to learn it</button>`) : ""}</li>`; }).join("")}</ul><p class="cc-muted">A bead is spent when you release it or swallow it. Unused, it keeps.</p>` : `<p class="cc-muted">None. Weaken a wild monster below 40% and hold a capture ritual over it to make one.</p>`;
      return `<section class="cc-gaia-regard cc-beads"><h3>Beads · ${beads.length}</h3>${list}${tracker}</section>`;
    }
    function pactBoard() {   // the contract book: sign once (free), pay per call from the Summons menu
      if (!PC || !SM) return "";
      const store = U.account.contracts || (U.account.contracts = PC.createStore());
      const lines = Object.keys(SM.data.summons).filter((id) => SM.data.summons[id].pact);
      const rows = lines.map((id) => {
        const def = SM.data.summons[id], t = def.pact, pacted = !!store.pacts[id], ban = store.blacklist[id];
        const st = store.standing[id] || { clean: 0 }, rate = PC.rateFor(st.clean || 0);
        const due = Math.ceil(t.call.seeds * PC.PACT.apologyMul);
        const status = pacted ? `pacted · ${st.clean || 0} clean calls${rate ? ` · −${Math.round(rate * 100)}% rate` : ""}` : ban ? `blacklisted (${ban.kind})` : "unpacted · first sign free";
        const btn = pacted ? (store.active?.line === id ? `<span class="cc-muted">answering now</span>` : `<button type="button" data-pact-release="${id}">Release</button>`)
          : ban ? `<button type="button" data-pact-apologize="${id}" ${(U.account.seeds || 0) < due ? "disabled" : ""}>Apologize · ${due}S</button>`
          : `<button type="button" data-pact-sign="${id}" ${Object.keys(store.pacts).length >= PC.PACT.cap ? "disabled" : ""}>Sign · free</button>`;
        return `<article class="cc-account-row"><div><b>${esc(def.name)}</b> <small>${t.call.pf}ΦF + ${t.call.seeds}S/call · ${t.duration + (SM.data.rules.bondBonusDuration || 0)} rounds (+ item bonuses) · ${status}</small></div>${btn}</article>`;
      }).join("");
      return `<section class="cc-gaia-regard cc-pacts"><h3>Summon pacts · ${Object.keys(store.pacts).length}/${PC.PACT.cap}</h3>${rows}<p class="cc-muted">Sign once, call mid-battle from the Summons menu — no question, full bond. Dismiss cleanly to build standing (every 5 clean calls: 10% off, max 30%). Catch your own summon in an area attack that damages terrain and the pact breaks: blacklisted, marked, re-sign at double Seeds.</p></section>`;
    }
    function kilnBoard() {
      if (!KR) return "";
      const p = U.account.parts || {}, v = U.account.vessels || {};
      if (!(U.account.orgonite > 0)) U.kilnFlux = false;   // no pucks, no flux: the toggle never re-arms silently
      const rows = ["shard", "bead", "orb"].map((t) => { const r = KR.RECIPES[t], got = KR.craftable(U.account, t, { flux: !!U.kilnFlux });
        const cost = [...Object.entries(r.parts).map(([k, n]) => `${n} ${k}`), `${r.fee} Seeds`].join(" + ");
        return `<li><b>${esc(SL ? SL.VESSEL_NAME[t] : t)}</b> <small>${esc(cost)} · stash ${v[t] || 0}</small> <button type="button" class="cc-item" data-kiln="${t}:1" ${got.max < 1 ? "disabled" : ""}>Fire ×1</button> <button type="button" class="cc-item" data-kiln="${t}:5" ${got.max < 2 ? "disabled" : ""}>Fire ×${Math.min(5, got.max)}</button>${got.max < 1 ? ` <span class="cc-muted">short: ${esc(got.short)}</span>` : ""}</li>`; }).join("");
      // Orgonite (codex-orgonite slice 1): cast 5 common + 10 Seeds into a puck; with Flux on, each puck waives one firing's fee.
      const og = U.account.orgonite || 0, gotO = KR.refinable ? KR.refinable(U.account) : { max: 0, short: "seeds" }, flux = !!U.kilnFlux && og > 0;
      const orgRow = KR.ORGONITE ? `<li><b>Orgonite</b> <small>${KR.ORGONITE.parts.common} common + ${KR.ORGONITE.fee} Seeds · stash ${og}</small> <button type="button" class="cc-item" data-kiln-cast="1" ${gotO.max < 1 ? "disabled" : ""}>Cast orgonite ×1</button> <button type="button" class="cc-item" data-kiln-cast="5" ${gotO.max < 2 ? "disabled" : ""}>Cast ×${Math.min(5, gotO.max)}</button>${gotO.max < 1 ? ` <span class="cc-muted">short: ${esc(gotO.short)}</span>` : ""} <button type="button" class="cc-item" data-kiln-flux ${og < 1 ? "disabled" : ""} aria-pressed="${flux}">Flux: ${flux ? "on" : "off"}</button></li>` : "";
      return `<section class="cc-gaia-regard cc-kiln"><h3>Kiln · parts ${p.common || 0}c/${p.uncommon || 0}u/${p.rare || 0}r</h3><ul>${rows}${orgRow}</ul>${flux ? `<p class="cc-muted">Flux on: each firing spends 1 orgonite instead of its Seeds fee (${og} left).</p>` : ""}<p class="cc-muted">Parts come from battlefield salvage and the field shop. Firing is exact — no luck, just ledger.</p></section>`;
    }
    function stallBoard() {
      if (!MK || !SL) return "";
      const m = MK.marketOf(U.account), v = U.account.vessels || {}, pens = U.account.pens || [];
      const driftLine = ["shard", "bead", "orb"].map((t) => `${t} ${Math.round(MK.driftFor(m.day, t) * 100)}%`).join(" · ");
      const standLine = Object.keys(MK.VENDORS).map((id) => `${MK.VENDORS[id].name.split(" ").pop()} ${m.standing[id] || 0}`).join(" · ");
      const px = (base, kind, vendor, c = null) => { const camp = c && m.campaign && m.campaign.kind === MK.catchTier(c) ? { ...m.campaign, kind } : m.campaign; return MK.vendorPrice(base, vendor, c, { day: m.day, kind, floods: m.floods, campaign: camp, standing: m.standing[vendor] }); };
      const vesselRows = ["shard", "bead", "orb"].map((t) => `<li><b>${esc(SL.VESSEL_NAME[t])}</b> <small>stash ${v[t] || 0}</small> ${Object.keys(MK.VENDORS).map((id) => `<button type="button" class="cc-item" data-stall-vessel="${id}:${t}" ${(v[t] || 0) < 1 ? "disabled" : ""} title="${esc(MK.VENDORS[id].quirk)}">Sell ▸ ${esc(MK.VENDORS[id].name)} · ~${px(MK.RULES.resale[t], t, id)}</button>`).join(" ")}</li>`).join("");
      const penRows = pens.length ? pens.map((c, i) => { const tier = MK.catchTier(c), base = MK.catchBase(c);
        if (c.free) return `<li><b>${esc(c.name)}</b> <small>${tier}-catch · ${c.maxLF} LF · apprentice shard: practice, not for sale</small> <button type="button" class="cc-item" data-stall-keep="${i}">Keep · bead progress</button></li>`;   // Mala, 2026-10-27
        return `<li><b>${esc(c.name)}</b> <small>${tier}-catch · ${c.maxLF} LF</small> <button type="button" class="cc-item" data-stall-keep="${i}">Keep · bead progress</button> ${Object.keys(MK.VENDORS).filter((id) => id !== "bank").map((id) => `<button type="button" class="cc-item" data-stall-pen="${id}:${i}" title="${esc(MK.VENDORS[id].quirk)}">Sell ▸ ${esc(MK.VENDORS[id].name)} · ~${px(base, c.key, id, c)}</button>`).join(" ")}</li>`; }).join("") : `<li class="cc-muted">Empty pens. Seal foes in battle and they wait here.</li>`;
      const camp = m.campaign ? `<p>Campaign: ${esc(m.campaign.kind)} goods ×${MK.RULES.campaignMul} for ${m.campaign.battles} more battle${m.campaign.battles === 1 ? "" : "s"}.</p>` : ["shard", "bead", "orb"].map((t) => `<button type="button" class="cc-item" data-stall-campaign="${t}" ${(U.account.seeds || 0) < MK.RULES.campaignCost ? "disabled" : ""}>Advertise ${t} · ${MK.RULES.campaignCost} Seeds</button>`).join(" ");
      const orderRows = m.orders.length ? m.orders.map((o, i) => { if (o.filled) return `<li class="cc-muted">Order ${esc(o.kind)} — filled.</li>`;
        const tierOrder = o.kind.startsWith("tier:") ? o.kind.slice(5) : null;
        const fills = o.vendor === "bank" ? "" : pens.map((c, j) => ({ c, j })).filter(({ c }) => !c.free && (c.key === o.kind || (tierOrder && MK.catchTier(c) === tierOrder))).map(({ c, j }) => `<button type="button" class="cc-item" data-stall-order-p="${i}:${j}">Fill with ${esc(c.name)} · +${Math.max(1, Math.round(MK.catchBase(c) * MK.RULES.orderMul))}</button>`).join(" ");   // ruling 6: the Bank fills from vessels only
        const vfill = tierOrder && (v[tierOrder] || 0) > 0 ? `<button type="button" class="cc-item" data-stall-order-v="${i}:${tierOrder}">Fill with ${tierOrder} · +${Math.max(1, Math.round(MK.RULES.resale[tierOrder] * MK.RULES.orderMul))}</button>` : "";
        return `<li><b>Order: ${esc(o.kind)}</b> <small>${esc(MK.VENDORS[o.vendor]?.name || o.vendor)} · ×${MK.RULES.orderMul}</small> ${fills}${vfill}${!fills && !vfill ? `<span class="cc-muted">nothing fits — catch or craft it</span>` : ""}</li>`; }).join("") : `<li class="cc-muted">No orders today.</li>`;
      const og = U.account.orgonite || 0, orgRows = MK.sellOrgonite ? `<li><b>Orgonite</b> <small>stash ${og} · the Orcish fence only</small> <button type="button" class="cc-item" data-stall-orgonite="orcish" ${og < 1 ? "disabled" : ""} title="Orgonite sells to the fence only, never above ${MK.RULES.orgoniteMax} Seeds">Sell ▸ ${esc(MK.VENDORS.orcish.name)} · ~${Math.min(MK.RULES.orgoniteMax, px(MK.RULES.orgoniteBase, "orgonite", "orcish"))}</button></li>` : "";
      const FR = root.ConceptCombatFruit, held = FR ? FR.stashOf(U.account) : [];
      const fruitRows = held.length ? held.map((id) => `<li><b>${esc(FR.FRUITS[id].name)}</b> <small>${esc(FR.FRUITS[id].line)}</small> <button type="button" class="cc-item" data-fruit-sell="${id}">Sell by the tide · 400 Seeds (50 a battle)</button></li>`).join("") : `<li class="cc-muted">No fruit in the stash. Won battles sometimes wash one up.</li>`;
      return `<section class="cc-gaia-regard cc-stall"><h3>Stall · market day ${m.day}</h3><p class="cc-muted">Drift ${esc(driftLine)} · standing ${esc(standLine)} · haggle ${Math.round(MK.haggleChance(0) * 100)}%+ (free with every sale)</p><h4>Vessels</h4><ul>${vesselRows}${orgRows}</ul><h4>Pens · ${pens.length}</h4><ul>${penRows}</ul><h4>Strange fruit</h4><ul>${fruitRows}</ul><h4>Advertise</h4><p>${camp}</p><h4>Buy orders</h4><ul>${orderRows}</ul></section>`;
    }
    // Sinkerfruit (OP1; account/fruit.js): fruits in the stash, the one you ate, and Eat as a two-click confirm, because it
    // can't be undone. A second fruit is refused (Mala, 2026-10-27: "refuse the second fruit").
    function fruitCard() {
      const FR = root.ConceptCombatFruit; if (!FR) return "";
      const held = FR.stashOf(U.account), mine = FR.eaten(U.account);
      // Mala, 2026-10-27: "you can use our bittermelon sprite as the sinkerfruit". One sprite, tinted per fruit.
      const icon = (id) => `<img class="cc-fruit-icon cc-fruit-${id}" src="combat/sprites/items/bitterMelon.png" alt="${esc(FR.FRUITS[id].name)}">`;
      if (!held.length && !mine) return "";
      const me = mine ? `<p>${icon(mine.id)} <b>You ate ${esc(FR.FRUITS[mine.id].name)}.</b> ${esc(FR.FRUITS[mine.id].line)} You can never swim; water, soaking and cuffs damp the power.${FR.ripe(U.account) ? " It has ripened." : ""}</p>` : "";
      const want = FR.posted?.(U.account), sale = Object.entries(U.account.fruitSales || {}).find(([, v]) => v.owed > 0);   // FR-01: a settled sale lingers (owed 0) only as the return timer
      const wantLine = want ? `<p><b>Wanted: ${want.amount} Seeds on your head.</b> Hunters come, ${FR.RULES.respec ? `more often and tougher as your head climbs (${FR.tierOf(want.amount) === 0 ? "about one battle in eight" : FR.tierOf(want.amount) === 1 ? "about one in six" : "about one in five"} now)` : "about one battle in eight"}.</p>` : "";
      const saleLine = sale ? `<p class="cc-muted">Sold ${esc(FR.FRUITS[sale[0]].name)} by the tide: ${sale[1].owed} Seeds still owed, 50 a battle.</p>` : "";
      const rows = held.map((id) => `<li>${icon(id)} <button type="button" class="cc-item" data-fruit-pick="${id}" ${mine ? "disabled" : ""}>Eat ${esc(FR.FRUITS[id].name)}</button> <small>${esc(mine ? "Your body has one sea in it already: a second fruit is refused." : FR.FRUITS[id].line)}</small></li>`).join("");
      const pick = !mine && held.includes(U.fruitPick) ? U.fruitPick : null;
      const confirm = pick ? `<div class="cc-fruit-confirm"><p><b>Eat ${esc(FR.FRUITS[pick].name)}?</b> ${esc(FR.FRUITS[pick].line)} You will never swim again, and water will damp the power. This can't be undone.</p>
        <p><button type="button" class="cc-item badc" id="ccFruitConfirm">Eat it</button> <button type="button" class="cc-item good" id="ccFruitCancel">Put it away</button></p></div>` : "";
      return `<section class="cc-gaia-regard cc-fruit"><h3>Strange fruit</h3>${me}${wantLine}${saleLine}${rows ? `<ul>${rows}</ul>` : ""}${confirm}</section>`;
    }
    // The saga close button (W9.6 wiring, loop 1a17c4b14f2; spec ~/loci-orbit/landed/muse-wave9/specs/SAGAS.md: "CLOSE is
    // declared — a button + a beat"). sagas.view says each ending's gate and price; a close is two clicks, because it
    // can't be undone. GateLess also names a star (an equation from the ledger) and an heirloom (an owned item).
    function sagaCard() {
      const SAG = root.CombatSagas;
      if (!SAG) return "";
      const v = SAG.view(U.account), pick = v.open ? v.endings.find((e) => e.id === U.sagaPick && e.ok) : null;
      const past = v.past.length ? `<details><summary>Past sagas · ${v.past.length}</summary>${v.past.map((r) => `<p class="cc-muted">${esc(r.summary || r.id)}</p>`).join("")}</details>` : "";
      if (!v.open) return `<section class="cc-gaia-regard cc-saga"><h3>Saga</h3><p class="cc-muted">${esc(v.how)}</p>${past}</section>`;
      const head = `<p class="cc-muted">${v.battles} battle${v.battles === 1 ? "" : "s"} · since it opened: ${v.since.graduations} graduation${v.since.graduations === 1 ? "" : "s"}, ${v.since.deaths} death${v.since.deaths === 1 ? "" : "s"} weighed, ${v.since.equations} equation${v.since.equations === 1 ? "" : "s"} ledgered.</p>`;
      const rows = v.endings.map((e) => `<li><button type="button" class="cc-item" data-saga-pick="${e.id}" ${e.ok ? "" : "disabled"}>${esc(e.name)}</button> <small>${esc(e.ok ? e.price : e.why)}</small></li>`).join("");
      let confirm = "";
      if (pick) {
        const ledger = (U.account.mergeLedger || []).map((x) => x.name || x.eq).filter(Boolean);
        const owned = (U.account.gear?.owned || []).filter((id) => Loot.data.equipment[id]);
        const extra = pick.id === "GATELESS" ? `<label>Star <select id="ccSagaStar">${ledger.length ? ledger.map((x) => `<option>${esc(x)}</option>`).join("") : `<option value="">(unnamed equation)</option>`}</select></label>
          <label>Heirloom <select id="ccSagaHeirloom"><option value="">(nothing carried forward)</option>${owned.map((id) => `<option>${esc(Loot.data.equipment[id].name)}</option>`).join("")}</select></label>` : "";
        confirm = `<div class="cc-saga-confirm"><p><b>Close ${esc(v.id)}: ${esc(pick.name)}?</b> ${esc(pick.price)} ${esc(v.after)} This can't be undone.</p>${extra}
          <p><button type="button" class="cc-item badc" id="ccSagaConfirm">Close the saga</button> <button type="button" class="cc-item good" id="ccSagaCancel">Keep walking</button></p></div>`;
      }
      const gate = v.unlocked ? `<p>Endings unlocked: ${esc(v.reasons.join(", "))}.</p>` : "";
      return `<section class="cc-gaia-regard cc-saga"><h3>Saga · ${esc(v.id)}</h3>${head}${gate}<ul>${rows}</ul>${confirm || `<p class="cc-muted">${esc(v.after)}</p>`}${past}</section>`;
    }
    const deckCtx = () => { const classId = U.character.classId || "warden"; return { account: () => U.account, classId, className: C.characters[classId]?.name || classId,
      setAccount: (next) => { U.account = next; saveAccount(); }, rerender: showAccount, flash: flashTip, open: !!U.setupPanels.deck, onToggle: (open) => { U.setupPanels.deck = open; } }; };
    function showAccount() {
      const returnMode = U.mode === "account" ? (U.accountReturnMode || "setup") : U.mode;
      U.accountReturnMode = returnMode;
      stopAi();
      const ov = $("ccOverlay"), again = U.mode === "account";
      // Re-drawn after a kit move or a purchase: keep the reader where they were (Mala, 2026-10-26: selecting an item
      // jumped the window back to the top).
      const scrolled = again ? [ov.scrollTop, ov.querySelector(".cc-account")?.scrollTop || 0] : null;
      U.mode = "account";
      ov.hidden = false;
      const stock = Loot.shopStock(U.account, { seed: U.account.battles + 41, biome: null });
      const closeLabel = returnMode === "setup" ? "Back to setup" : returnMode === "over" ? "Back to results" : "Return to quest";
      ov.innerHTML = `<div class="cc-card cc-account"><header><div><h2>Field Kit & Account</h2><p class="cc-muted">Level ${U.account.level} · ${U.account.xp} XP · ${U.account.wins}/${U.account.battles} wins · ${U.account.seeds} Seeds · ${U.account.unlocked.length} summons unlocked${A.titlesOf(U.account).length ? ` · ${A.titlesOf(U.account).map(esc).join(", ")}` : ""}</p></div><button type="button" id="ccAccountClose">${closeLabel}</button>${Tracks ? `<button type="button" id="ccSoundToggle">Sound: ${Tracks.enabled() ? "on" : "off"}</button>` : ""}</header>${GB ? (() => { const g = GB.of(U.account), t = GB.tierOf(g.standing), mine = GB.boonsFor(g.standing), face = GB.portrait(g.standing); return `<section class="cc-gaia-regard"><h3>Gaia's regard · ${esc(t.name)} · ${g.standing}/${GB.rules.max}</h3><figure class="cc-gaia-portrait is-${face.form}"><img src="combat/sprites/${face.sprite}/idle.png" alt="${esc(face.name)}"><figcaption>${esc(face.name)}</figcaption></figure><div class="cc-gaia-bar"><i style="width:${g.standing}%"></i></div><p class="cc-muted">${esc(t.line)}${t.next ? ` ${t.toNext} more to ${esc(t.next)}.` : ""} Communing with plants raises it; driving Gaia to anger lowers it.</p>${mine.length ? `<ul>${mine.map((b) => `<li><b>${esc(b.name)}</b>: ${esc(b.text)}</li>`).join("")}</ul>` : `<p class="cc-muted">No boons yet.</p>`}</section>`; })() : ""}${beadBoard()}${pactBoard()}${kilnBoard()}${stallBoard()}${IM && INS ? (() => { const i = IM.of(U.account), name = (t) => esc(INS.data.traits[t]?.name || t), text = (t) => esc(INS.data.traits[t]?.text || ""), temp = Object.keys(i.temp); return `<section class="cc-gaia-regard cc-imitation"><h3>Imitated traits</h3>${i.permanent.length || temp.length ? `<ul>${i.permanent.map((t) => `<li><b title="${text(t)}">${name(t)}</b>: yours</li>`).join("")}${temp.map((t) => `<li><b title="${text(t)}">${name(t)}</b>: ${i.temp[t]} battle${i.temp[t] === 1 ? "" : "s"} left · practice ${i.progress[t] || 0}/${IM.needed(INS.data.imitateDifficulty(t) || 1)}</li>`).join("")}</ul>` : `<p class="cc-muted">None yet. Find a trait in someone with Observe, then Imitate it from the same menu.</p>`}</section>`; })() : ""}
        <section class="cc-gaia-regard"><h3>Perks · ${U.account.perkPoints || 0} points</h3>${Object.entries(A.rules.perkMenu).map(([id, m]) => { const have = U.account.perks?.[id] || 0, capped = have >= m.cap, broke = (U.account.perkPoints || 0) < (m.cost || 1), locked = m.requiresLevel && (U.account.level || 1) < m.requiresLevel, held = A.unlocksUpTo(U.account, U.account.level || 1), full = held.length >= U.account.order.length, gate = !capped && A.deedGate ? A.deedGate(U.account, id) : null; let picker = ""; if (m.choice === "summon" && !locked && !capped && !broke && !full && !gate) { const open = U.account.order.filter((x) => !held.includes(x)); picker = ` <select data-seat-pick>${open.map((x) => `<option value="${esc(x)}">${esc(x)} · Lv ${A.rules.unlockLevels[U.account.order.indexOf(x)]}</option>`).join("")}</select>`; } const off = capped || broke || locked || gate || (m.choice === "summon" && full); return `<article class="cc-account-row"><div><b>${esc(m.name)}</b> <small>${esc(m.text)}${locked && !have ? ` Unlocks at ${m.requiresLevel}.` : ""}${m.choice === "summon" && full && !capped ? " Every summon is already yours." : ""} ${have}/${m.cap}${m.cost > 1 ? ` · ${m.cost} pts` : ""}</small>${picker}${gate ? ` <small class="cc-muted">needs ${gate.need} ${esc(gate.text)} (you have ${gate.have})</small>` : ""}</div><button type="button" data-perk="${id}" ${off ? "disabled" : ""}>${m.choice === "summon" ? "Name" : "+1"}</button></article>`; }).join("")}<p class="cc-muted">One point per level; priced lines say so. Perks ride into battle on the Warden.</p></section>
        <section class="cc-gaia-regard"><h3>Stakes · ${(U.account.stakesLedger || []).length} wagered</h3>${(U.account.stakesLedger || []).slice(-5).map((e) => `<p class="cc-muted">${esc(e.pairKey || "unknown")} · ${esc(e.winner)} · you staked ${AN?.lotValue(e.playerLot) ?? "?"} vs their ${AN?.lotValue(e.foeLot) ?? "?"}</p>`).join("") || `<p class="cc-muted">No wagers yet. Talk ▸ Propose stakes, round 1.</p>`}</section>
        <section class="cc-gaia-regard"><h3>Victories · ${A.victoriesOf(U.account).length} classes beaten</h3>${A.victoriesOf(U.account).length ? `<p>${A.victoriesOf(U.account).map(v => `${esc(v.name)}${v.count > 1 ? ` ×${v.count}` : ""}`).join(" · ")}</p>` : `<p class="cc-muted">None yet. Each class you beat in a real battle is recorded here.</p>`}</section>
        ${fruitCard()}
        ${sagaCard()}
        ${BOSS && A.orbsOf(U.account).length ? `<section class="cc-gaia-regard"><h3>Orbs · ${A.orbsOf(U.account).length}</h3><p>${[...new Set(A.orbsOf(U.account))].map(id => `${id === "brainChip" ? `<img src="combat/sprites/items/brainChip.png" alt="" style="height:28px;vertical-align:middle;image-rendering:pixelated"> ` : ""}${esc(BOSS.data.orbs[id]?.name || id)}${A.orbsOf(U.account).filter(x => x === id).length > 1 ? ` ×${A.orbsOf(U.account).filter(x => x === id).length}` : ""}`).join(" · ")}</p><p class="cc-muted">Carried into every real battle. Break one from Gear: ${BOSS.data.formBalance.activationAp} AP, a form for ${BOSS.data.formBalance.duration} of your turns and a full ultimate bar. The Brain Chip answers the Warden.</p></section>` : ""}
        ${BR ? `<section class="cc-gaia-regard"><h3>Boss rush${BR.bestBadge(U.account) ? ` · ${esc(BR.bestBadge(U.account))}` : ""}</h3>${BR.recordOf(U.account).runs.length ? BR.recordOf(U.account).runs.slice().reverse().map(r => `<details><summary>${r.cleared ? `<b>${esc(r.badge)}</b>` : `Lost at ${r.fell.length + 1} of ${r.n}: ${esc(r.names[r.ids.indexOf(r.stoppedBy)] || r.stoppedBy || "?")}`}${r.ally ? ` · with ${esc(r.ally.name)}` : " · alone"} · ${esc(new Date(r.at).toLocaleDateString())}</summary><p>${r.names.map((n, i) => `${i < r.fell.length ? "✓" : r.ids[i] === r.stoppedBy ? "✗" : "·"} ${esc(n)}`).join(" · ")}</p></details>`).join("") : `<p class="cc-muted">No runs yet. Pick Boss Rush in Scenarios: every Omega threat in a row. Each boss you beat there leaves its orb here.</p>`}</section>` : ""}
        <section class="cc-gaia-regard"><h3>Tourist postcards · ${(U.account.postcards||[]).length}</h3>${(U.account.postcards||[]).map(p=>`<details><summary>${esc(p.location)} · ${esc(p.quality)} · ${p.photoCount} photos</summary><p>${esc(p.message)}</p><p>${p.photos.map(q=>esc(q.name)).join(" · ")}</p></details>`).join("")}</section>${kitBoard()}${CardsUI ? CardsUI.group(deckCtx()) : ""}<div class="cc-account-grid"><section><h3>Gear: sell, repair and tend</h3><p class="cc-muted"><button type="button" id="ccTendAll">Tend all</button> Kits first, then the smith (Seeds), then a cherish. Every tend is remembered on the item.</p>${gearBoard()}</section>
        <section><h3>Field shop</h3>${stock.map(o=>`<article class="cc-account-row"><div class="cc-item-with-icon">${itemIcon(o.id,o.name)}<div><b>${esc(o.kind === "vessel" && SL ? SL.VESSEL_NAME[o.id] : o.name)}</b> <small>${esc(o.rarity)} · ${o.price} Seeds${o.drift && Math.abs(o.drift - 1) > 0.005 ? ` (${Math.round(o.drift * 100)}%)` : ""}</small><p>${esc(o.kind === "vessel" ? "An empty vessel. Packs into battle for sealing." : o.kind === "part" ? "Kiln stock: fires into vessels." : Loot.data[o.kind === "equipment" ? "equipment" : "consumables"][o.id].text)}</p></div></div><button type="button" data-buy="${o.kind}:${o.id}" ${U.account.seeds < o.price ? "disabled" : ""}>Buy</button></article>`).join("")}</section></div>
        <p class="cc-muted">Equipped gear loses 1 durability after each battle. Repair kits restore half; field workshops restore it fully. Worn gear is inactive.</p></div>`;
      if ($("ccSoundToggle")) $("ccSoundToggle").onclick = () => { Tracks.setEnabled(!Tracks.enabled()); showAccount(); };
      $("ccAccountClose").onclick = () => {
        const resume = U.accountReturnMode || "setup";
        U.accountReturnMode = null;
        if (resume === "setup") return showSetup();
        ov.hidden = true; U.mode = resume; render();
        if (resume === "wait" && !U.s?.outcome) pump();
      };
      ov.querySelectorAll("[data-swallow]").forEach(b => b.onclick = () => { const BS = root.ConceptCombatBeadSwallow; const r = BS ? BS.swallow(U.account, +b.dataset.swallow, W?.data?.monsters) : { ok: false, error: "Swallowing is unavailable." }; if (r.ok) { U.account = r.account; saveAccount(); flashTip(r.line); showAccount(); } else flashTip(r.error); });   // swallow a bead (account/beads.js)
      ov.querySelectorAll("[data-perk]").forEach(b => b.onclick = () => { const pick = b.closest("article")?.querySelector("[data-seat-pick]"); const r = pick ? A.spendPerk(U.account, b.dataset.perk, null, pick.value) : A.spendPerk(U.account, b.dataset.perk); if (r.account) { U.account = r.account; saveAccount(); showAccount(); } else flashTip(r.error); });
      ov.querySelectorAll("[data-pact-sign]").forEach(b => b.onclick = () => { const id = b.dataset.pactSign, r = PC.sign(U.account.contracts, { line: id, terms: SM.data.summons[id].pact }); r.ok ? (saveAccount(), showAccount()) : flashTip(r.error); });
      ov.querySelectorAll("[data-pact-apologize]").forEach(b => b.onclick = () => { const id = b.dataset.pactApologize, terms = SM.data.summons[id].pact, due = PC.scale(terms.call, PC.PACT.apologyMul); if ((U.account.seeds || 0) < due.seeds) return flashTip(`The apology needs ${due.seeds} Seeds.`); const r = PC.sign(U.account.contracts, { line: id, terms, apology: true }); if (!r.ok) return flashTip(r.error); U.account.seeds -= due.seeds; saveAccount(); showAccount(); flashTip(`${SM.data.summons[id].name} accepts the apology.`); });
      ov.querySelectorAll("[data-pact-release]").forEach(b => b.onclick = () => { const r = PC.release(U.account.contracts, { line: b.dataset.pactRelease }); r.ok ? (saveAccount(), showAccount()) : flashTip(r.error); });
      ov.querySelectorAll("[data-equip]").forEach(b => b.onclick = () => { const r = Loot.equip(U.account, b.dataset.equip); if (r.ok) { U.account = r.account; saveAccount(); showAccount(); } else flashTip(r.reason); });
      ov.querySelectorAll("[data-unequip]").forEach(b => b.onclick = () => { const r = Loot.unequip(U.account, b.dataset.unequip); if (r.ok) { U.account = r.account; saveAccount(); showAccount(); } });
      ov.querySelectorAll("[data-sell]").forEach(b => b.onclick = () => { const r = Loot.sell(U.account, "equipment", b.dataset.sell); if (r.ok) { U.account = r.account; saveAccount(); showAccount(); flashTip(`Sold for ${r.value} Seeds.`); } else flashTip(r.reason); });
      // Item care: Tend (cheapest path), Cherish (+1 and +1 care), Tend All, Repair (kits), Mend (the smith). Care can open the Tended Water (schools.js accountProofs).
      const cared = (r) => { if (!r.ok) return flashTip(r.reason || "Nothing needs tending."); U.account = r.account;
        if (SCH) { const k = SCH.earnKeys(U.account, SCH.accountProofs(U.account)); U.account = k.account; r.reached = [...(r.reached || []), ...k.lines]; }
        saveAccount(); showAccount(); const said = [...(r.lines || [r.line]), ...(r.reached || [])].filter(Boolean).join(" ").trim(); if (said) flashTip(said);
        if (Tracks) for (const c of (r.cues || [])) Tracks.cue(c.slot, c.opts || {}); };
      ov.querySelectorAll("[data-repair]").forEach(b => b.onclick = () => cared(Loot.repair(U.account, b.dataset.repair, b.dataset.kit)));   // JK-02: kit mends celebrate like tends
      ov.querySelectorAll("[data-tend]").forEach(b => b.onclick = () => cared(Loot.tend(U.account, b.dataset.tend)));
      ov.querySelectorAll("[data-cherish]").forEach(b => b.onclick = () => cared(Loot.cherish(U.account, b.dataset.cherish)));
      ov.querySelector("#ccTendAll")?.addEventListener("click", () => cared(Loot.tendAll(U.account)));
      ov.querySelectorAll("[data-service]").forEach(b => b.onclick = () => cared(Loot.repairService(U.account, b.dataset.service)));   // JK-03: the smith's mend celebrates like a tend
      ov.querySelectorAll("[data-mixbuy]").forEach(b => b.onclick = () => { const [id, mix] = b.dataset.mixbuy.split(":"); const r = Loot.buyMix(U.account, id, mix); if (r.ok) { U.account = r.account; saveAccount(); showAccount(); } else flashTip(r.reason); });
      ov.querySelectorAll("[data-mixplay]").forEach(b => b.onclick = () => { const [, mix] = b.dataset.mixplay.split(":"); Tracks.cue("claim-chime", { mix }); });
      ov.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => { const [kind,id] = b.dataset.buy.split(":"); const offer = stock.find(x=>x.kind===kind&&x.id===id); const r = Loot.buy(U.account, offer); if (r.ok) { U.account = r.account; saveAccount(); showAccount(); } else flashTip(r.reason); });
      const redo = (r) => { if (r.ok) { U.account = r.account; saveAccount(); flashTip((r.lines || []).join(" ")); showAccount(); } else flashTip(r.reason || r.short); };   // vessel economy: every kiln/stall move re-renders the kit
      ov.querySelectorAll("[data-kiln]").forEach(b => b.onclick = () => { const [t, n] = b.dataset.kiln.split(":"); const r = KR.craft(U.account, t, +n, { flux: !!U.kilnFlux }); redo(r.ok ? { ...r, lines: [`Fired ${n} × ${SL.VESSEL_NAME[t]}${r.fluxed ? ` (${r.fluxed} fluxed, fee waived)` : ""}.`] } : r); });
      ov.querySelectorAll("[data-kiln-cast]").forEach(b => b.onclick = () => { const r = KR.refine(U.account, +b.dataset.kilnCast); redo(r.ok ? { ...r, lines: [`Cast ${r.n} × orgonite.`] } : r); });
      ov.querySelectorAll("[data-kiln-flux]").forEach(b => b.onclick = () => { U.kilnFlux = !U.kilnFlux; showAccount(); });
      ov.querySelectorAll("[data-stall-orgonite]").forEach(b => b.onclick = () => redo(MK.sellOrgonite(U.account, b.dataset.stallOrgonite, Math.random(), PY ? PY.persuasion(U.account.self) : null)));
      ov.querySelectorAll("[data-stall-vessel]").forEach(b => b.onclick = () => { const [id, t] = b.dataset.stallVessel.split(":"); redo(MK.sellVessel(U.account, id, t, Math.random(), PY ? PY.persuasion(U.account.self) : null)); });
      ov.querySelectorAll("[data-stall-pen]").forEach(b => b.onclick = () => { const [id, i] = b.dataset.stallPen.split(":"); redo(MK.sellCatch(U.account, id, +i, Math.random(), PY ? PY.persuasion(U.account.self) : null)); });
      ov.querySelectorAll("[data-stall-keep]").forEach(b => b.onclick = () => redo(MK.swallowPen(U.account, +b.dataset.stallKeep)));
      ov.querySelectorAll("[data-stall-campaign]").forEach(b => b.onclick = () => redo(MK.advertise(U.account, b.dataset.stallCampaign)));
      ov.querySelectorAll("[data-stall-order-p]").forEach(b => b.onclick = () => { const [o, j] = b.dataset.stallOrderP.split(":"); redo(MK.fillOrder(U.account, +o, { pen: +j })); });
      ov.querySelectorAll("[data-stall-order-v]").forEach(b => b.onclick = () => { const [o, t] = b.dataset.stallOrderV.split(":"); redo(MK.fillOrder(U.account, +o, { vessel: t })); });
      ov.querySelectorAll("[data-fruit-pick]").forEach(b => b.onclick = () => { U.fruitPick = b.dataset.fruitPick; showAccount(); });
      ov.querySelectorAll("[data-fruit-sell]").forEach(b => b.onclick = () => { const r = root.ConceptCombatFruit.sellFruit(U.account, b.dataset.fruitSell); redo(r.ok ? { ...r, lines: [r.line] } : { ok: false, reason: r.error }); });
      ov.querySelector("#ccFruitCancel")?.addEventListener("click", () => { U.fruitPick = null; showAccount(); });
      ov.querySelector("#ccFruitConfirm")?.addEventListener("click", () => {
        const r = root.ConceptCombatFruit.eat(U.account, U.fruitPick); U.fruitPick = null;
        if (!r.ok) { flashTip(r.error); return showAccount(); }
        U.account = r.account; saveAccount(); showAccount(); flashTip(r.line);
      });
      ov.querySelectorAll("[data-saga-pick]").forEach(b => b.onclick = () => { U.sagaPick = b.dataset.sagaPick; showAccount(); });
      ov.querySelector("#ccSagaCancel")?.addEventListener("click", () => { U.sagaPick = null; showAccount(); });
      ov.querySelector("#ccSagaConfirm")?.addEventListener("click", () => {
        const SAG = root.CombatSagas, ending = U.sagaPick, v = SAG.view(U.account);
        if (!v.open || !v.endings.some((e) => e.id === ending && e.ok)) { U.sagaPick = null; flashTip("That ending is not open."); return showAccount(); }
        const r = SAG.close(U.account, ending, { star: $("ccSagaStar")?.value || "", heirloom: $("ccSagaHeirloom")?.value || null, seed: U.account.battles });
        let acct = r.account;   // GateLess confers its title (W9.5 titles.js; GATELESS can't be challenged)
        if (r.directives?.conferTitle && root.CombatTitles) acct = root.CombatTitles.confer(acct, r.directives.conferTitle);
        U.account = acct; U.sagaPick = null; saveAccount(); showAccount(); flashTip(r.lines.join(" "));
      });
      wireKit(ov);
      if (CardsUI) CardsUI.wire(ov, deckCtx());
      mountKeeper(ov, "ledgerHouse");   // the Tallyman frames the Field Kit (S1; the counter keepers are S3)
      if (scrolled) { ov.scrollTop = scrolled[0]; const card = ov.querySelector(".cc-account"); if (card) card.scrollTop = scrolled[1]; }
    }
    // The level-200 Warden look (Mala, 2026-10-23; content.js progression.neonWardenLevel). It is offered in the outfit list once
    // earned; choosing it (or leaving the choice empty) lets the engine's level look draw it (engine/queries.js actorLook).
    function spritePackages(id) {
      const ch=C.characters[id],base=ch?.variants?.length ? ch.variants : ch?.sprite ? [ch.sprite] : [];
      return id==="warden"&&neonUnlocked()&&!base.includes(NEON_WARDEN) ? [NEON_WARDEN,...base] : base;
    }
    function chosenSprite(id) {
      const ch=C.characters[id],picked=U.spritePackages?.[id];return spritePackages(id).includes(picked) ? picked : defaultSprite(id) || id;
    }
    function defaultSprite(id) { return id==="warden"&&neonUnlocked() ? NEON_WARDEN : C.characters[id]?.sprite; }   // what the battle draws with no saved pick
    function packageName(id,sprite) {
      return C.characters[id]?.spritePackageNames?.[sprite] || (sprite===NEON_WARDEN ? "Purple Neon (level 200)" : sprite==="archivist" ? "Without Kaiba" : sprite==="archivist-kaiba" ? "With Kaiba" : sprite.split("-").map(w=>w[0].toUpperCase()+w.slice(1)).join(" "));
    }
    function packageControls(id) {
      const packages=spritePackages(id);if(packages.length<2)return "";
      const picked=U.spritePackages?.[id] || (id==="warden" ? defaultSprite(id) : "");
      return `<div class="cc-row" aria-label="${esc(C.characters[id].name)} sprite package"><button type="button" data-package-step="${id}" data-step="-1" aria-label="Previous ${esc(C.characters[id].name)} outfit">‹</button><label>${esc(C.characters[id].name)} outfit <select data-sprite-package="${id}">${id!=="warden" ? `<option value="" ${!picked?"selected":""}>Random each battle</option>` : ""}${packages.map(s=>`<option value="${s}" ${picked===s?"selected":""}>${esc(packageName(id,s))}</option>`).join("")}</select></label><button type="button" data-package-step="${id}" data-step="1" aria-label="Next ${esc(C.characters[id].name)} outfit">›</button><img src="combat/sprites/${SPRITE_DIR[chosenSprite(id)]}/idle.png" alt="${esc(packageName(id,chosenSprite(id)))} preview" style="height:72px;image-rendering:pixelated"></div>`;
    }
    function wirePackageControls(scope,refresh) {
      const save=(id,value)=>{U.spritePackages ||= {};U.spritePackages[id]=value;store.set("loci:combat:sprite-packages",U.spritePackages);refresh();};
      scope.querySelectorAll("select[data-sprite-package]").forEach(el=>el.onchange=()=>save(el.dataset.spritePackage,el.value));
      scope.querySelectorAll("button[data-package-step]").forEach(el=>el.onclick=()=>{const id=el.dataset.packageStep,select=scope.querySelector(`select[data-sprite-package="${id}"]`),values=Array.from(select.options).map(o=>o.value);save(id,values[(select.selectedIndex+Number(el.dataset.step)+values.length)%values.length]);});
    }

    // ── Character Studio (redesigned 2026-10-08 after Grok's Sixfold codex): a roster grid, then a pose sheet.
    // Keys. Roster: arrows move, Enter opens, Esc back to setup. Sheet: ← → character, ↑ ↓ pose, Space play, Esc roster.
    // The six required poses plus the optional slots (poses.js). A package without a slot's own art shows its fallback.
    const STUDIO_BASE_POSES = POSES ? POSES.ALL : ["idle", "walk", "cast", "block", "punch", "knocked-out"];
    let STUDIO_POSES = STUDIO_BASE_POSES;                             // plus the open package's alternates (block-2 ...)
    let STUDIO_HIDDEN = new Set();                                    // slots that only show a fallback: hidden, and Play/arrows skip them
    const studioShown = () => STUDIO_POSES.filter((p) => !STUDIO_HIDDEN.has(p));
    const studioPosesFor = (folder) => STUDIO_BASE_POSES.flatMap((p) => [p, ...(SPRITE_EXTRAS[folder] || []).filter((f) => new RegExp(`^${p}-\\d+$`).test(f))]);
    const STUDIO_POSE_LABEL = new Proxy(POSES ? POSES.LABEL : { idle: "Idle", walk: "Walk", cast: "Cast", block: "Block", punch: "Punch", "knocked-out": "Knocked out" },
      { get: (labels, p) => labels[p] || (typeof p === "string" && /-\d+$/.test(p) ? `${labels[p.replace(/-\d+$/, "")] || p} ${p.match(/\d+$/)[0]}` : undefined) });
    // Point an <img> at a slot's art, stepping down the fallback chain on a missing file. done(pose) reports what loaded.
    function slotSrc(img, folder, slot, done) {
      const chain = POSES ? POSES.chain(slot) : [slot, "idle"]; let i = 0;
      const tryNext = () => { img.onerror = () => { i += 1; if (i < chain.length) tryNext(); }; img.src = `combat/sprites/${folder}/${chain[i]}.png`; };
      img.addEventListener("load", function loaded() { img.removeEventListener("load", loaded); done?.(chain[i]); });
      tryNext();
    }
    function studioEntries() {
      const pair = (p, s) => [p, s].filter(Boolean).map((id) => C.concepts[id]?.name || id).join(" + ");
      const summons = Object.entries(SM?.data?.summons || {});
      return [
        { id: "warden", name: "Warden", group: "You", sub: pair(U.character.primary, U.character.secondary) || "Choose concepts" },
        ...npcRoster.map((ch) => ({ id: ch.id, name: ch.name, group: "Cast", sub: ch.configs?.[0]?.label || pair(ch.primary, ch.secondary) })),
        ...summons.map(([id, s]) => ({ id, name: s.name, group: "Summons", sub: `${pair(s.standIn.primary, s.standIn.secondary)} · stand-in` })),
      ].map((e) => ({ ...e, folder: SPRITE_DIR[chosenSprite(e.id)] || null }));
    }
    function studioSheet(id) {
      const summonDef = SM?.data?.summons?.[id];
      if (C.characters[id]) return { sheet: C.characters[id], summonDef: null };
      if (summonDef) return { summonDef, sheet: { ...summonDef, sprite: id, primary: summonDef.standIn.primary, secondary: summonDef.standIn.secondary,
        conceptPool: [summonDef.standIn.primary, summonDef.standIn.secondary], configs: [{ label: `${C.concepts[summonDef.standIn.primary]?.name} + ${C.concepts[summonDef.standIn.secondary]?.name} · battle stand-in` }] } };
      return { sheet: C.characters.warden, summonDef: null };
    }
    function stopStudioTimers() { clearInterval(U.studio?.playTimer); clearInterval(U.studio?.walkTimer); if (U.studio) U.studio.playTimer = U.studio.walkTimer = null; }
    // The Character library's two tabs: the roster, and the art the game does not use yet (asset-library.js, generated
    // by tools/build-asset-library.py).
    const ASSET_USAGE = root.ConceptCombatAssetUsage;
    const ASSETS = ASSET_USAGE.catalog(root.ConceptCombatAssetLibrary || { groups: [] });
    const assetCount = () => ASSETS.groups.reduce((n, g) => n + g.items.length, 0);
    function studioTabs(active, characters) {
      return `<nav class="st-tabs" role="tablist" aria-label="Library"><button type="button" role="tab" class="st-btn${active === "roster" ? " on" : ""}" aria-selected="${active === "roster"}" data-studio-tab="roster">Characters · ${characters}</button><button type="button" role="tab" class="st-btn${active === "library" ? " on" : ""}" aria-selected="${active === "library"}" data-studio-tab="library">Art library · ${assetCount()}</button></nav>`;
    }
    const wireStudioTabs = (ov) => ov.querySelectorAll("[data-studio-tab]").forEach((b) => b.onclick = () => showStudio(b.dataset.studioTab));
    function renderAssetLibrary(ov, characters) {
      U.studio.assetGroup = ASSETS.groups.some((g) => g.id === U.studio.assetGroup) ? U.studio.assetGroup : "all";
      U.studio.assetBg ||= "dark";
      U.studio.assetState ||= "all";
      const shown = ASSET_USAGE.filter(ASSETS, { group: U.studio.assetGroup, state: U.studio.assetState });
      const flat = shown.flatMap((g) => g.items);
      ov.innerHTML = `<div class="cc-card cc-studio2 st-library st-bg-${U.studio.assetBg}" role="dialog" aria-label="Art library">
        <header class="st-head"><div><p class="st-kicker">Side-view codex</p><h2 class="st-title">Art library</h2></div>
          <div class="st-head-right"><p>${assetCount()} catalogued pieces · current use shown on each card</p><button type="button" class="st-btn" id="ccStudioClose">Back to setup</button></div></header>
        ${studioTabs("library", characters)}
        <p class="st-lede">Browse current uses, unused art and alternate appearances. Click a piece for details and suggested future uses.</p>
        <div class="st-filters"><div class="st-chips" role="group" aria-label="Kind">${[{ id: "all", name: "All", items: ASSETS.groups.flatMap((g) => g.items) }, ...ASSETS.groups].map((g) => `<button type="button" class="st-btn${U.studio.assetGroup === g.id ? " on" : ""}" data-asset-group="${g.id}">${esc(g.name)} · ${g.items.length}</button>`).join("")}</div>
          <div class="st-chips" role="group" aria-label="Background">${["dark", "light", "checker"].map((b) => `<button type="button" class="st-btn${U.studio.assetBg === b ? " on" : ""}" data-asset-bg="${b}">${b}</button>`).join("")}</div></div>
        <div class="st-chips st-state-filters" role="group" aria-label="Current use">${[["all", "All uses"], ...Object.entries(ASSET_USAGE.labels)].map(([id,label]) => `<button type="button" class="st-btn${U.studio.assetState === id ? " on" : ""}" aria-pressed="${U.studio.assetState === id}" data-asset-state="${id}">${esc(label)} · ${ASSETS.groups.flatMap(g => g.items).filter(it => id === "all" || it.state === id).length}</button>`).join("")}</div>
        ${ASSETS.groups.length ? "" : `<p class="st-lede">The asset library was not bundled with this build.</p>`}
        ${ASSETS.groups.length && !flat.length ? `<p class="st-lede" role="status">No art matches these filters. Choose another kind or current use.</p>` : ""}
        ${shown.map((g) => `<h3 class="st-group">${esc(g.name)}</h3><p class="st-group-blurb">${esc(g.blurb)}</p><div class="st-grid st-asset-grid">${g.items.map((it) => `
          <button type="button" class="st-card st-asset" data-asset="${flat.indexOf(it)}" title="${esc(it.what)}">
            <span class="st-card-stage"><img class="${it.imported ? "st-px" : ""}" alt="" src="${esc(it.src)}" loading="lazy"></span>
            <span class="st-card-name">${esc(it.title)}</span><span class="st-asset-state is-${it.state}">${esc(it.stateLabel)}</span><span class="st-card-sub">${esc(it.currentUse)}</span></button>`).join("")}</div>`).join("")}
        <p class="st-keys"><kbd>Esc</kbd> back · in the viewer <kbd>←</kbd><kbd>→</kbd> previous and next</p>
        <div class="st-viewer" id="ccAssetViewer" hidden></div></div>`;
      wireStudioTabs(ov);
      $("ccStudioClose").onclick = () => { stopStudioTimers(); showSetup(); };
      ov.querySelectorAll("[data-asset-group]").forEach((b) => b.onclick = () => { U.studio.assetGroup = b.dataset.assetGroup; showStudio("library"); });
      ov.querySelectorAll("[data-asset-state]").forEach((b) => b.onclick = () => { U.studio.assetState = b.dataset.assetState; showStudio("library"); });
      ov.querySelectorAll("[data-asset-bg]").forEach((b) => b.onclick = () => { U.studio.assetBg = b.dataset.assetBg; showStudio("library"); });
      const viewer = $("ccAssetViewer");
      const open = (i) => {
        const it = flat[(i + flat.length) % flat.length]; if (!it) return;
        U.studio.assetOpen = flat.indexOf(it);
        viewer.hidden = false;
        viewer.innerHTML = `<div class="st-viewer-bar"><div><b>${esc(it.title)}</b><small>${it.w} × ${it.h}${it.imported ? " · already in the game folder" : it.source ? ` · ${esc(it.source)}` : ""}</small></div>
            <div class="st-chips"><button type="button" class="st-btn" id="ccAssetPrev" aria-label="Previous">‹</button><button type="button" class="st-btn" id="ccAssetNext" aria-label="Next">›</button><button type="button" class="st-btn" id="ccAssetShut">Close</button></div></div>
          <div class="st-viewer-stage"><img class="${it.imported ? "st-px" : ""}" alt="${esc(it.title)}" src="${esc(it.src)}"></div>
          <p class="st-viewer-note"><span class="st-asset-state is-${it.state}">${esc(it.stateLabel)}</span><b>Current use.</b> ${esc(it.currentUse)}</p><p class="st-viewer-note"><b>What it is.</b> ${esc(it.what)}${it.proposal ? ` <b>Possible next use.</b> ${esc(it.proposal)}` : ""}</p>`;
        $("ccAssetPrev").onclick = () => open(U.studio.assetOpen - 1); $("ccAssetNext").onclick = () => open(U.studio.assetOpen + 1);
        $("ccAssetShut").onclick = shut; $("ccAssetShut").focus();
      };
      const shut = () => { viewer.hidden = true; viewer.innerHTML = ""; U.studio.assetOpen = null; };
      U.studio.assetNav = { open, shut };
      ov.querySelectorAll("[data-asset]").forEach((b) => b.onclick = () => open(Number(b.dataset.asset)));
      U.studio.assetOpen = null;
      mountKeeper(ov, "artLibrary");   // Jatayu (S1)
      ov.querySelector(".cc-studio2").tabIndex = -1; ov.querySelector(".cc-studio2").focus();
    }
    // Prev/next on a sheet opened from the crew wall stays inside that crew, including the
    // visitors the Character library hides.
    function crewNavEntries() {
      if (!U.studio?.fromCrew || !Crews) return null;
      const crew = Crews.wall(C.characters, C.subfactions).find((c) => c.members.some((m) => m.id === U.sheet));
      if (!crew) return null;
      return crew.members.map((m) => ({ id: m.id, name: m.name, group: crew.name, sub: m.sub || "", folder: SPRITE_DIR[m.sprite] || null }));
    }
    function renderCrewWall(ov) {
      const wall = Crews ? Crews.wall(C.characters, C.subfactions) : [];
      const count = wall.reduce((n, c) => n + c.members.length, 0);
      const card = (m) => {
        const folder = SPRITE_DIR[m.sprite];
        const art = folder ? `<img class="st-px" alt="" src="combat/sprites/${folder}/idle.png" loading="lazy">` : `<span class="st-glyph" style="--sprite:${SPRITE[m.sprite] || "#9ad1ff"}">${esc(m.name.slice(0, 1))}</span>`;
        return `<button type="button" class="st-card${m.id === U.sheet ? " on" : ""}" data-sheet="${m.id}"><span class="st-card-stage">${art}</span><span class="st-card-name">${esc(m.name)}</span><span class="st-card-sub">${esc(m.sub || "")}</span></button>`;
      };
      ov.innerHTML = `<div class="cc-card cc-studio2" role="dialog" aria-label="Crews">
        <header class="st-head"><div><p class="st-kicker">The Index</p><h2 class="st-title">Crews</h2></div>
          <div class="st-head-right"><p>${count} people · ${wall.length} crews</p><button type="button" class="st-btn" id="ccStudioClose">Back to setup</button></div></header>
        <p class="st-lede">Who stands with whom. The line under each crew is the test a new character has to pass.</p>
        ${wall.map((c) => `<h3 class="st-group">${esc(c.name)} · ${c.members.length}</h3><p class="st-group-blurb">${esc(c.blurb)}</p><div class="st-grid">${c.members.map(card).join("")}</div>`).join("")}
        ${wall.length ? "" : `<p class="st-lede">The crew list did not load.</p>`}
        <p class="st-keys"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> open sheet · <kbd>Esc</kbd> back to setup</p></div>`;
      $("ccStudioClose").onclick = () => { stopStudioTimers(); showSetup(); };
      ov.querySelectorAll("[data-sheet]").forEach((b) => {
        b.onclick = () => { U.sheet = b.dataset.sheet; U.studio.pose = "idle"; U.studio.fromCrew = true; showStudio("sheet"); };
        b.onfocus = () => { U.sheet = b.dataset.sheet; ov.querySelectorAll(".st-card.on").forEach((x) => x.classList.remove("on")); b.classList.add("on"); };
      });
      mountKeeper(ov, "crewWall");   // Jatayu (S1): before the focus and scroll below, so the strip cannot push the focused card out of view
      const cur = ov.querySelector(`[data-sheet="${U.sheet}"]`);
      cur?.focus({ preventScroll: true }); cur?.scrollIntoView({ block: "nearest" });
      ov.querySelector(".cc-studio2").tabIndex = -1;
      if (!cur) ov.querySelector(".cc-studio2").focus();
    }
    function showStudio(view) {
      U.character ||= { primary: "barrier", secondary: "elasticity" };
      U.studio ||= { view: "roster", pose: "idle", playing: false };
      if (view) U.studio.view = view;
      if (view === "roster" || view === "library") U.studio.fromCrew = false;
      stopStudioTimers(); U.studio.playing = false;
      U.mode = "studio";
      const ov = $("ccOverlay"); ov.hidden = false;
      const entries = studioEntries();
      if (!entries.some((e) => e.id === U.sheet) && !C.characters[U.sheet]) U.sheet = "warden";
      const sheetEntries = crewNavEntries() || entries;
      if (U.studio.view === "sheet") return renderStudioSheet(ov, sheetEntries);
      if (U.studio.view === "library") return renderAssetLibrary(ov, entries.length);
      if (U.studio.view === "crews") return renderCrewWall(ov);
      const groups = [...new Set(entries.map((e) => e.group))];
      const catalog = root.LandscapeConceptCatalog, playable = Object.keys(C.concepts).filter(id => !C.concepts[id].sealed);
      ov.innerHTML = `<div class="cc-card cc-studio2" role="dialog" aria-label="Character Studio">
        <header class="st-head"><div><p class="st-kicker">Side-view codex</p><h2 class="st-title">Character Studio</h2></div>
          <div class="st-head-right"><p>${entries.length} characters</p><button type="button" class="st-btn" id="ccStudioClose">Back to setup</button></div></header>
        ${studioTabs("roster", entries.length)}
        <p class="st-lede">Every fighter, summon and you, each with the same six beats: idle, walk, cast, block, punch, knocked out.</p>
        ${groups.map((g) => `<h3 class="st-group">${esc(g)}</h3><div class="st-grid">${entries.filter((e) => e.group === g).map((e) => `
          <button type="button" class="st-card${e.id === U.sheet ? " on" : ""}" data-sheet="${e.id}">
            <span class="st-card-stage">${e.folder ? `<img class="st-px" alt="" src="combat/sprites/${e.folder}/idle.png" loading="lazy">` : `<span class="st-glyph" style="--sprite:${SPRITE[C.characters[e.id]?.sprite] || "#9ad1ff"}">${esc(e.name.slice(0, 1))}</span>`}</span>
            <span class="st-card-name">${esc(e.name)}</span><span class="st-card-sub">${esc(e.sub || "")}</span></button>`).join("")}</div>`).join("")}
        <p class="st-keys"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> open sheet · <kbd>Esc</kbd> back to setup</p>
        <details class="cc-lexicon st-lexicon"><summary>Landscape Lexicon <small>${catalog?.concepts?.length || 0} terms · read-only reference</small></summary><input id="ccLexSearch" type="search" placeholder="Search terms, definitions, or registers" aria-label="Search the Landscape Lexicon"><div class="cc-lex-list" id="ccLexList"></div><p class="cc-muted">Playable concepts are marked. Lexicon relations remain references until an explicit, tested combat rule is authored.</p></details></div>`;
      const renderLex = (query = "") => {
        const list = $("ccLexList"); if (!list) return;
        const q = query.toLowerCase();
        list.innerHTML = lexiconOrder(catalog?.concepts || [], q).filter(t => `${t.term} ${t.slug} ${(t.aliases || []).join(" ")} ${t.shortDefinition || ""} ${t.register}`.toLowerCase().includes(q)).slice(0, 100).map(t => `<article><b>${esc(t.term)}</b> <small>${esc(t.register)} · ${playable.some(id => id === t.slug || C.concepts[id].lexiconSlug === t.slug) ? "playable" : "reference"}</small><p>${esc(t.shortDefinition || "")}</p>${LEXICON_ART.includes(t.slug) ? `<img class="cc-lex-art" loading="lazy" alt="Teaching strip: ${esc(t.term)}" src="combat/lexicon/${t.slug}.webp">` : ""}</article>`).join("") || `<p class="cc-muted">No matching terms.</p>`;
      };
      renderLex();
      $("ccLexSearch").oninput = e => renderLex(e.target.value);
      wireStudioTabs(ov);
      $("ccStudioClose").onclick = () => { stopStudioTimers(); showSetup(); };
      ov.querySelectorAll("[data-sheet]").forEach(b => {
        b.onclick = () => { U.sheet = b.dataset.sheet; U.studio.pose = "idle"; showStudio("sheet"); };
        b.onfocus = () => { U.sheet = b.dataset.sheet; ov.querySelectorAll(".st-card.on").forEach(x => x.classList.remove("on")); b.classList.add("on"); };
      });
      const cur = ov.querySelector(`[data-sheet="${U.sheet}"]`);
      mountKeeper(ov, "studioRoster");   // Jatayu (S1)
      cur?.focus({ preventScroll: true }); cur?.scrollIntoView({ block: "nearest" });
    }
    // Arrow movement on the card grid: left/right step through the list; up/down jump to the nearest card in the next row.
    function studioGridMove(dir) {
      const cards = [...$("ccOverlay").querySelectorAll(".st-card")];
      const i = Math.max(0, cards.findIndex((c) => c.dataset.sheet === U.sheet));
      let next = cards[i];
      if (dir === "left" || dir === "right") next = cards[Math.max(0, Math.min(cards.length - 1, i + (dir === "right" ? 1 : -1)))];
      else {
        const r = cards[i].getBoundingClientRect(), cx = r.left + r.width / 2, down = dir === "down";
        const rows = cards.map((c) => [c, c.getBoundingClientRect()]).filter(([, b]) => down ? b.top > r.top + 4 : b.top < r.top - 4);
        if (rows.length) {
          const rowTop = down ? Math.min(...rows.map(([, b]) => b.top)) : Math.max(...rows.map(([, b]) => b.top));
          next = rows.filter(([, b]) => Math.abs(b.top - rowTop) < 4).sort(([, a], [, b]) => Math.abs(a.left + a.width / 2 - cx) - Math.abs(b.left + b.width / 2 - cx))[0][0];
        }
      }
      next.focus(); next.scrollIntoView({ block: "nearest" });
    }
    function renderStudioSheet(ov, entries) {
      const entry = entries.find((e) => e.id === U.sheet), idx = entries.indexOf(entry);
      const { sheet, summonDef } = studioSheet(U.sheet), isPlayer = U.sheet === "warden", spriteFolder = entry.folder, folder = SPRITE_POSES[spriteFolder] ? spriteFolder : null;
      STUDIO_POSES = studioPosesFor(folder); STUDIO_HIDDEN = new Set();
      const playable = Object.keys(C.concepts).filter(id => !C.concepts[id].sealed), configs = sheet.configs || [];
      const prev = entries[(idx - 1 + entries.length) % entries.length], next = entries[(idx + 1) % entries.length];
      const pool = isPlayer ? [U.character.primary, U.character.secondary].filter(Boolean) : sheet.conceptPool || [sheet.primary, sheet.secondary].filter(Boolean);
      const role = isPlayer ? "You · choose your primary and secondary concepts" : summonDef ? (summonDef.identity || "Summon ally from the memory palace") : `${configs.length} seeded configuration${configs.length === 1 ? "" : "s"}`;
      const roleName = (r) => r?.role ? RO.rules.roles[r.role].name : "";
      const sheetRole = RO ? (isPlayer ? { role: RO.roleFor([U.character.primary, U.character.secondary]) } : RO.roleOf(U.sheet)) : null;
      const configRole = (c) => RO && c.primary ? roleName({ role: RO.roleFor([c.primary, c.secondary]) }) : "";
      const controls = isPlayer ? `<div class="st-controls">
        <label>Primary <select id="ccPrimary">${playable.map(id => `<option value="${id}" ${U.character.primary === id ? "selected" : ""}>${esc(C.concepts[id].name)}</option>`).join("")}</select></label>
        <label>Secondary <select id="ccSecondary"><option value="">None</option>${playable.filter(id => id !== U.character.primary).map(id => `<option value="${id}" ${U.character.secondary === id ? "selected" : ""}>${esc(C.concepts[id].name)}</option>`).join("")}</select></label>
        <button id="ccSaveCharacter" type="button" class="st-btn st-accent">Save character</button></div>` : "";
      const backLabel = U.studio.fromCrew ? "Crews" : "Roster";
      ov.innerHTML = `<div class="cc-card cc-studio2" tabindex="-1" role="dialog" aria-label="Character Studio · ${esc(sheet.name)}">
        <header class="st-head"><div><p class="st-kicker">${esc(entry.group)} · ${idx + 1} of ${entries.length}${sheetRole?.role ? ` · <span class="st-role" title="${esc(RO.rules.roles[sheetRole.role].text)}">${esc(roleName(sheetRole))}</span>` : ""}</p><h2 class="st-title">${esc(sheet.name)}</h2><p class="st-lede">${esc(role)}</p></div>
          <div class="st-head-right"><button type="button" class="st-btn" id="ccStudioRoster">${backLabel}</button><button type="button" class="st-btn" id="ccStudioClose">Back to setup</button></div></header>
        ${packageControls(U.sheet)}
        <div class="st-sheet">
          <div class="st-stage-row">
            <button type="button" class="st-btn st-step" id="ccStudioPrev" aria-label="Previous: ${esc(prev.name)}">‹<small>${esc(prev.name)}</small></button>
            <div class="st-stage"><div class="st-ground"></div>${folder ? `<img id="ccStudioStage" class="st-px st-bob" alt="${esc(sheet.name)} idle" src="combat/sprites/${folder}/idle.png">` : `<span class="st-glyph big" style="--sprite:${SPRITE[sheet.sprite] || "#9ad1ff"}">${esc(sheet.name.slice(0, 1))}</span>`}</div>
            <button type="button" class="st-btn st-step" id="ccStudioNext" aria-label="Next: ${esc(next.name)}">›<small>${esc(next.name)}</small></button>
          </div>
          ${folder ? `<div class="st-poses">${STUDIO_POSES.map(p => `<button type="button" class="st-btn" data-pose="${p}">${STUDIO_POSE_LABEL[p]}</button>`).join("")}</div>
          <button type="button" class="st-btn" id="ccStudioPlay">Play sheet</button>
          <div class="st-strip">${STUDIO_POSES.map(p => `<button type="button" data-pose="${p}"><img class="st-px" alt="${esc(sheet.name)} ${STUDIO_POSE_LABEL[p]}" data-slot="${p}"><span>${STUDIO_POSE_LABEL[p]}</span></button>`).join("")}</div>`
            : `<p class="st-lede">Battle glyph only: dedicated pose art isn't assigned yet.</p>`}
          <div class="st-info">
            <section><h4>Concepts</h4><p>${pool.map(id => `<span class="st-chip" style="--c:${C.concepts[id]?.color || "#aaa"}">${esc(C.concepts[id]?.name || id)}</span>`).join("")}</p>${controls}</section>
            <section><h4>Configurations</h4><ul>${(configs.length ? configs : [{ label: `${C.concepts[U.character.primary]?.name} + ${C.concepts[U.character.secondary]?.name || "none"}` }]).map(c => `<li>${esc(c.label)}${configRole(c) ? ` <small class="st-role">${esc(configRole(c))}</small>` : ""}</li>`).join("")}</ul><p class="st-stats">LF ${C.rules.maxLF} · ΦF ${C.rules.maxPF} · move ${C.rules.moveBudget}</p></section>
          </div>
        </div>
        <p class="st-keys"><kbd>←</kbd><kbd>→</kbd> character · <kbd>↑</kbd><kbd>↓</kbd> pose · <kbd>Space</kbd> play · <kbd>Esc</kbd> ${backLabel.toLowerCase()}</p></div>`;
      wirePackageControls(ov,()=>showStudio("sheet"));
      $("ccStudioRoster").onclick = () => showStudio(U.studio.fromCrew ? "crews" : "roster");
      $("ccStudioClose").onclick = () => { stopStudioTimers(); showSetup(); };
      $("ccStudioPrev").onclick = () => studioStep(-1);
      $("ccStudioNext").onclick = () => studioStep(1);
      if (folder) {
        // Scale every pose by the idle frame's height so poses keep their relative size (knocked-out stays low and wide).
        const scaleTo = (img, px) => { const base = new Image(); base.onload = () => { const set = () => { img.style.height = `${Math.max(10, Math.round(img.naturalHeight * px / base.naturalHeight))}px`; }; img.complete ? set() : (img.onload = set); }; base.src = `combat/sprites/${folder}/idle.png`; };
        ov.querySelectorAll(".st-strip img").forEach(img => {
          slotSrc(img, folder, img.dataset.slot, (shown) => {
            scaleTo(img, 84);
            const own = shown === img.dataset.slot || img.dataset.slot === "idle";
            // A slot with no art of its own (it only shows a fallback) is not shown at all (Mala, 2026-10-27).
            if (!own && img.isConnected) {   // a late load from a sheet already closed hides nothing
              STUDIO_HIDDEN.add(img.dataset.slot);
              ov.querySelectorAll(`[data-pose="${img.dataset.slot}"]`).forEach((b) => { b.hidden = true; b.classList.add("st-fallback"); });
              if (U.studio.pose === img.dataset.slot) studioPose("idle");
            }
          });
        });
        ov.querySelectorAll("[data-pose]").forEach(b => b.onclick = () => { studioPlay(false); studioPose(b.dataset.pose); });
        $("ccStudioPlay").onclick = () => studioPlay(!U.studio.playing);
        studioPose(U.studio.pose || "idle");
      }
      if (isPlayer) {
        $("ccPrimary").onchange = e => { U.character.primary = e.target.value; if (U.character.secondary === e.target.value) U.character.secondary = ""; showStudio("sheet"); };
        $("ccSecondary").onchange = e => { U.character.secondary = e.target.value; };
        $("ccSaveCharacter").onclick = () => { store.set(CHAR_KEY, U.character); flashTip("Character sheet saved."); };
      }
      mountKeeper(ov, "studioSheet");   // Jatayu (S1)
      ov.querySelector(".cc-studio2").focus?.();
    }
    function studioPose(pose) {
      U.studio.pose = pose;
      const img = $("ccStudioStage"), folder = img?.src.match(/sprites\/([^/]+)\//)?.[1];
      if (!img || !folder) return;
      const base = new Image();
      base.onload = () => {
        const fit = () => { img.style.height = `${Math.max(12, Math.round(img.naturalHeight * 210 / base.naturalHeight))}px`; };
        img.alt = `${pose} pose`; slotSrc(img, folder, pose, fit);
      };
      base.src = `combat/sprites/${folder}/idle.png`;
      img.classList.toggle("st-bob", pose === "idle" || pose === "walk");
      $("ccOverlay").querySelectorAll("[data-pose]").forEach(b => b.classList.toggle("on", b.dataset.pose === pose));
      clearInterval(U.studio.walkTimer); U.studio.walkTimer = null;
      if (pose === "walk" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        let flip = false;   // a two-frame walk: alternate walk and idle
        U.studio.walkTimer = setInterval(() => { if (U.mode !== "studio" || !img.isConnected) return stopStudioTimers(); flip = !flip; img.src = `combat/sprites/${folder}/${flip ? "idle" : "walk"}.png`; }, 160);
      }
    }
    function studioPlay(on) {
      U.studio.playing = on; clearInterval(U.studio.playTimer); U.studio.playTimer = null;
      const btn = $("ccStudioPlay"); if (btn) { btn.textContent = on ? "Pause sheet" : "Play sheet"; btn.classList.toggle("on", on); }
      if (on && !matchMedia("(prefers-reduced-motion: reduce)").matches)
        U.studio.playTimer = setInterval(() => { if (U.mode !== "studio" || !$("ccStudioStage")) return stopStudioTimers(); { const L = studioShown(); studioPose(L[(L.indexOf(U.studio.pose) + 1) % L.length]); } }, 900);
    }
    function studioStep(d) {
      const entries = crewNavEntries() || studioEntries(), i = Math.max(0, entries.findIndex((e) => e.id === U.sheet));
      U.sheet = entries[(i + d + entries.length) % entries.length].id; showStudio("sheet");
    }
    function studioKey(e) {
      const K = e.key, view = U.studio?.view;
      if (view === "library") {
        const nav = U.studio.assetNav, openNow = U.studio.assetOpen != null;
        if (openNow && (K === "ArrowLeft" || K === "ArrowRight")) { e.preventDefault(); nav.open(U.studio.assetOpen + (K === "ArrowRight" ? 1 : -1)); }
        else if (K === "Escape") { e.preventDefault(); if (openNow) nav.shut(); else showStudio("roster"); }
        return;
      }
      if (view === "sheet") {
        if (K === "ArrowLeft" || K === "ArrowRight") { e.preventDefault(); studioStep(K === "ArrowRight" ? 1 : -1); }
        else if ((K === "ArrowUp" || K === "ArrowDown") && $("ccStudioStage")) { e.preventDefault(); studioPlay(false); { const L = studioShown(); studioPose(L[(L.indexOf(U.studio.pose) + (K === "ArrowDown" ? 1 : -1) + L.length) % L.length]); }; }
        else if (K === " " && $("ccStudioPlay")) { e.preventDefault(); studioPlay(!U.studio.playing); }
        else if (K === "Escape" || K === "Backspace") { e.preventDefault(); showStudio(U.studio.fromCrew ? "crews" : "roster"); }
        return;
      }
      const dirs = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
      if (dirs[K]) { e.preventDefault(); studioGridMove(dirs[K]); }
      else if (K === "Enter" && !e.target.closest("button")) { e.preventDefault(); U.studio.pose = "idle"; if (view === "crews") U.studio.fromCrew = true; showStudio("sheet"); }
      else if (K === "Escape") { e.preventDefault(); stopStudioTimers(); showSetup(); }
    }
    // Arantxa's window. Fighter bubbles stay short. She speaks only when those
    // lines do not already carry the scene, and the battle waits until Continue.
    function openNarration(phase, resume) {
      const N = root.ConceptCombatNarrator;
      const page = N && U.narrationScene !== "off" ? N.pageFor(phase, {
        state: U.s, report: U.report, spoken: (U.bubbles || []).map((b) => b.text), scene: U.narrationScene, theme: U.theme || null,
      }) : null;
      if (!page) { resume(); return; }
      U.narrationHold = true;
      const prior = U.mode;
      U.mode = "narration";
      stopAi();
      try {
        N.open(page, {
          host: host.querySelector(".cc"),
          onContinue: () => {
            U.narrationHold = false;
            if (phase === "open") {
              const now = performance.now();
              for (const b of U.bubbles) b.until = now + 2500;
            }
            if (U.mode === "narration") U.mode = prior;
            resume();
          },
        });
      } catch (error) {
        console.error("Narrator window failed", error); recordDiagnostic("Narrator window failed",error);
        U.narrationHold = false;
        if (U.mode === "narration") U.mode = prior;
        resume();
      }
    }
    function playDispatch(resume) {
      const N = root.ConceptCombatNarrator, beats = (U.s.law && U.s.law.dispatch && U.s.law.dispatch.beats) || [];
      if (!N || !beats.length) { resume(); return; }
      U.narrationHold = true;
      const prior = U.mode;
      U.mode = "narration";
      stopAi();
      let i = 0;
      const next = () => {
        if (i >= beats.length) {
          U.narrationHold = false;
          if (U.mode === "narration") U.mode = prior;
          try { E.dispatchArrive(U.s); } catch (error) { console.error("Dispatch arrival failed", error); recordDiagnostic("Dispatch arrival failed", error); }
          render(); resume(); return;
        }
        const b = beats[i++];
        const portrait = b.voice === "policeChief" && typeof document !== "undefined"
          ? new URL("combat/sprites/police-officer/idle.png", document.baseURI).href : undefined;
        try {
          N.open({ id: b.id, name: b.name || "Arantxa", role: b.role || "Narrator", title: b.title, text: b.text },
            { host: host.querySelector(".cc"), portrait, onContinue: next });
        } catch (error) {
          console.error("Dispatch cutscene failed", error); recordDiagnostic("Dispatch cutscene failed", error);
          U.narrationHold = false;
          if (U.mode === "narration") U.mode = prior;
          resume();
        }
      };
      next();
    }
    // A new battle starts the camera clean: no stale ease target, pause, hold or deferred frame from the last battle on this mount.
    function resetFollow() { cancelAnimationFrame(U.camRaf); U.camRaf = null; clearTimeout(U.followHoldT); U.followHoldT = null; U.cam = null; U.followPaused = false; U.followForce = false; U.followAfter = null; U.followStamp = null; syncFollowBar(); }
    function start(o) {
      const ov = $("ccOverlay");
      const load = o && o.loadout ? o.loadout : "be";
      const opener = o && o.opener ? o.opener : (ov.querySelector("input[name=ccOpen]:checked") || {}).value || "player";
      const lens = Object.fromEntries(Object.entries(C.concepts).map(([id, c]) => [id, c.lens.default]));
      Object.assign(lens, U.setupLenses);
      ov.querySelectorAll("select[data-lens]").forEach((sel) => { lens[sel.dataset.lens] = sel.value; });
      const prof = E.progress({ xp: 0, level: 1 }, U.profile.xp || 0);
      const encounter = (o && o.encounter) || (o && o.randomEncounter ? "randomEncounter" : null) || (ov.querySelector("#ccEncounter") || {}).value || "firstWall";
      const escape = encounter === "escapeShip";
      const gameMode = encounter === "warfare" ? "warfare" : encounter === "bossRush" || encounter === "secretWarrior" || encounter === "secretWarriorNext" ? "classic" : escape ? "escape" : ov.querySelector("#ccGameMode")?.value || "classic";
      if (opts.onEncounterChange) opts.onEncounterChange(encounter);
      const preset = o && typeof o.loadout === "string" ? LOADOUTS[o.loadout] : null;
      const created = preset ? { ...U.character, ...preset } : U.character;
      const rosterMode = encounter === "rosterScrimmage";
      const foeId = rosterMode ? (U.setupFoe || npcRoster[0].id) : null;
      const allyId = rosterMode && ov.querySelector("#ccWithAlly")?.checked ? (U.setupAlly || npcRoster[1]?.id) : null;
      const participants = rosterMode ? [
        { id: "player", character: "warden", at: [1, 2] },
        ...(allyId ? [{ id: "companion", character: allyId, side: "player", at: [1, 3] }] : []),
        { id: "opponent", character: foeId, side: "enemy", at: [7, 2] },
      ] : null;
      // Battle Cards (C1): the saved deck rides in the loadout, with the account's cap and ownership so the engine keeps the longest legal prefix.
      const cardsLoadout = () => { if (!Cardbook || !CardsUI) return {}; const deck = Cardbook.deckFor(U.account, U.character.classId || "warden"); return deck.length ? { cards: { deck, cap: Cardbook.cap(U.account), owned: Cardbook.normalize(U.account).cardbook.owned } } : {}; };
      const playerLoadout = { primary: created.primary || C.characters.warden.primary, secondary: created.secondary ?? null,
        reserve: Object.keys(C.concepts).filter(c => !C.concepts[c].sealed && c !== (created.primary || LOADOUTS[load].primary) && c !== (created.secondary ?? LOADOUTS[load].secondary)).slice(0, prof.reserveSlots), lens, level: prof.level, xp: prof.xp,
        passives: Loot?.passives(U.account) || {}, ...cardsLoadout() };
      const rush = encounter === "bossRush" && BR;
      const sealed = encounter === "secretWarrior" && SW ? SW.battleOptions({ seed: (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0, ally: ov.querySelector("#ccRushAlly")?.value || null }) : encounter === "secretWarriorNext" && SN ? SN.battleOptions({ seed: (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 }) : null;   // the sealed fight
      // Boss rush: Continue fighting carries the run on; anything else starts a new one with a fresh seed.
      if (rush && !o?.rushContinue) U.rushAlly = ov.querySelector("#ccRushAlly")?.value ?? U.rushAlly ?? "";   // the ally is chosen once per run
      if (rush) { U.rush = o?.rushContinue && U.rush && U.rush.index < U.rush.ids.length ? U.rush : BR.begin((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0, { ally: U.rushAlly || null }); U.rushOutcome = null; }
      const seed = sealed ? sealed.seed : rush ? BR.battleOptions(U.rush).seed : rosterMode || encounter === "warfare" || escape || (o && o.randomEncounter) ? ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) : 0;
      const terrainChoice = (ov.querySelector("#ccTerrain") || {}).value || "random";
      const practice = !!o?.setupOpts?.focusedDreamTest;
      const preBattle = A.serialize(U.account);   // a test battle restores this (it is only known to be one once its options are set below)
      const packed = practice ? {ok:true,account:U.account,carried:[]} : Loot.packForBattle(U.account, U.packSelection);
      if (!packed.ok) throw new Error(packed.reason);
      if(!practice) { U.account = packed.account; U.packSelection = []; }   // saved below, once the battle is known not to be a test
      const arenaData = escape && G ? G.designed("shipInterior") : (encounter === "warfare" || rush || sealed) && G ? G.designed(sealed ? (encounter === "secretWarriorNext" ? SN.ARENA : SW.ARENA) : rush ? BR.ARENA : "warfareField") : !(o && o.randomEncounter) && D && G ? (terrainChoice === "random" ? G.generate({ seed: (seed + 0x9e3779b9) >>> 0 }) : G.designed(terrainChoice)) : null;
      const resolvedArena = escape ? arenaData : arenaData && V ? V.populate(arenaData, { seed }) : arenaData;   // the ship grows nothing
      const warfareWild = encounter === "warfare" ? [["feralPig", [7, 3]], ["termites", [7, 5]]].map(([kind, at], i) => {
        const def = W.data.monsters[kind]; return { id: `warfare-wild-${i+1}`, kind, form: def.form, name: def.name, reason: "the three-faction clash", born: 1, x: at[0], y: at[1], lf: def.lf, maxLF: def.lf, status: {} };
      }) : undefined;
      const presetParticipants = encounter === "warfare" ? C.encounters.warfare.actors : escape ? C.encounters.escapeShip.actors : sealed ? sealed.participants : rush ? BR.battleOptions(U.rush).participants : participants;
      const scnCtx = () => ({ wins: U.account.wins || 0, recent: SCN ? SCN.recentTags(U.account.history) : [], lastArena: (U.account.history || []).slice(-1)[0]?.arena || null, G, V, Climate, rules: C.rules, characters: C.characters, mainCharacter: mainClass(), RandomEvents: root.ConceptCombatRandomEvents, eventParticipantsFor: E.eventParticipantsFor, W });
      const chosen = o && o.randomEncounter ? (SCN ? SCN.choose(seed, scnCtx()) : { kind: THB?.roll(seed) ? "theme" : "plain", id: THB?.roll(seed) || null }) : null;   // one draw per battle: theme (one in five, unchanged), scenario, or plain
      const themeRoll = chosen?.kind === "theme" ? chosen.id : null;   // themed battles: the roll keeps the hero side, terrain and weather
      U.theme = null; U.themeMidShown = false; U.dispatchPlayed = false;
      const rolled = () => { const b = E.randomEncounterOptions(seed, playerLoadout, terrainChoice, { foughtBeside: U.account.foughtBeside || [], everything: !!o.everything, mainCharacter:mainClass() }); return SCN ? SCN.prepare(b, seed, scnCtx()) : b; };   // prepare: the map used last battle is skipped once
      U.setupOpts = o && o.randomEncounter ? (themeRoll ? THB.apply(rolled(), themeRoll, seed) : chosen?.kind === "scenario" ? SCN.apply(rolled(), chosen.id, seed, { ...scnCtx(), tier: chosen.tier }) : rolled())
        : { encounter, startingActor: opener, seed, randomizeNPCs: rosterMode || encounter === "warfare", participants: presetParticipants || undefined, loadouts: { player: playerLoadout }, ...(warfareWild ? { initialWild: warfareWild } : {}), ...(resolvedArena ? { arenaData: resolvedArena } : {}) };
      if (encounter === "warfare" && !(o && o.randomEncounter)) Object.assign(U.setupOpts, E.warfareEventOptions(seed, { foughtBeside: U.account.foughtBeside || [], mainCharacter: mainClass() }));   // scaled-up events, aggressive reinforcements
      U.setupOpts.mode = (o && o.randomEncounter && U.setupOpts.mode) || gameMode;
      U.theme = U.setupOpts.theme || null;   // themed battle: Arantxa narrates its open, mid-fight and result beats
      if (rush) { const r = BR.battleOptions(U.rush); Object.assign(U.setupOpts, { bossRush: true, title: r.title, startingActor: r.startingActor }); }
      if (sealed) Object.assign(U.setupOpts, { title: sealed.title, startingActor: sealed.startingActor, ...(sealed.sealedFight ? { sealedFight: sealed.sealedFight } : {}) });   // a fully random scenario rolls its own objective
      // A test or playground brings its own loadout; what he has equipped still goes in with him (it was being dropped).
      const wearing = (L) => L ? { ...L, player: { ...(L.player || {}), passives: { ...playerLoadout.passives, ...(L.player?.passives || {}) }, ...(playerLoadout.cards && !L.player?.cards ? { cards: playerLoadout.cards } : {}) } } : null;
      if (o?.setupOpts) U.setupOpts = { ...U.setupOpts, ...o.setupOpts, loadouts: wearing(o.setupOpts.loadouts) || U.setupOpts.loadouts };
      if (U.setupOpts.devPlayground) openDecisionInspector();
      decisionInspector?.reset(encounter === "secretWarrior" || encounter === "secretWarriorNext" || encounter === "bossRush");
      U.llmEnabled = !!opts.llmBridge && !!ov.querySelector("#ccSocketOpponent")?.checked;
      U.llmConnection = null; U.llmFailed = false; U.llmPaused = false; U.llmError = ""; U.llmReady = !U.llmEnabled; U.llmSeq = 0; U.agentSessionUsed = false; U.llmActorId = null;
      U.setupOpts.mainCharacter=mainClass();
      U.setupOpts.spritePackages={...U.spritePackages};
      U.setupOpts.startingInventory = packed.carried;
      U.setupOpts.equippedGear = Object.values(U.account.gear?.equipped || {}).filter(Boolean);   // relics the player wears are not doubled by the story carry (engine relicPassives)
      U.wasTestBattle = testBattle(); U.testSnapshot = U.wasTestBattle ? preBattle : null;   // taken before the pack step, the first change a battle makes to the account
      if (!practice && !U.testSnapshot) saveAccount();   // a real battle saves its packed pouch; a test battle never writes it, even if abandoned mid-fight
      { const esc = U.account.stakeEscrow || U.stakeHeld; if (esc && AN) { const left = !esc.outcome, st = { ...(esc.stakes || {}), state: "agreed", held: { vessels: esc.vessels || [], levels: esc.levels || 0 } }; const r = AN.applyResolution({ ...U.account, stakeEscrow: null }, st, esc.outcome || "enemy", A.stripLevels); U.account = { ...r.account, stakeEscrow: null }; saveAccount(); flashTip(`${left ? "You left a staked fight: your lot is forfeit. " : ""}${r.lines.join(" ")}`.trim()); } U.stakeHeld = null; }   // a stake left unsettled (exit, reload) settles here: by its recorded outcome, else as a loss (Mala 2026-10-27: "by staking im commiting to finishing")
      U.practiceBattle = practice; U.setupOpts.wildFriends = practice ? [] : A.friendsOf(U.account); U.setupOpts.legacy = practice || !LB ? null : LB.carry(U.account.legacy, { battle: `b${Date.now().toString(36)}` }); U.setupOpts.orbs = practice ? [] : [...A.orbsOf(U.account), ...(A.formsOf(U.account).includes("symbiote") ? ["symbiote"] : [])]; U.setupOpts.learnedFormsMap = U.account.learnedForms || {};   // learned forms, per character: kept even in practice (they're known, not spent)   // orbs kept on the account; a practice battle carries none, so it cannot spend one; an unlocked Symbiote rides along free
      U.setupOpts.beads = (U.account.beads || []).map((b) => ({ ...b })); U.setupOpts.beastSummons = (U.account.beastSummons || []).map((b) => ({ ...b })); U.setupOpts.fruit = root.ConceptCombatFruit?.battleOpts(U.account) || null;   // beads kept from earlier battles; fixed at the start so a resumed battle replays the same
      { const enc = !practice && root.ConceptCombatFruit ? root.ConceptCombatFruit.encounterFor(U.account, { seed }) : { hunter: null, rival: null }; U.setupOpts.hunter = enc.hunter; if (enc.rival && o && o.randomEncounter && !testBattle()) U.setupOpts.rival = enc.rival; else delete U.setupOpts.rival; }   // a rival eater only in a real random battle (not story, practice, test or autoplay)   // OP1 §6: a posted head draws a hunter, ~1 real battle in 8 (practice draws none)
      U.setupOpts.orderCarry = root.ConceptCombatOrders && !practice ? root.ConceptCombatOrders.carryOpts(U.account) : null;   // talk orders: trust rides whole, respect rides halved
      if (!o?.setupOpts?.vessels && !U.setupOpts.vessels) { U.setupOpts.vessels = practice ? { shard: 3, bead: 2, orb: 1, free: 0 } : SL ? SL.takePack(U.account.vessels || (U.account.vessels = { shard: 0, bead: 0, orb: 0 })) : null; U.packedVessels = !practice && !!SL; if (U.packedVessels) saveAccount(); } else U.packedVessels = false;   // vessel economy: pack the pouch from the stash (practice/playground pouches come from thin air and never return)
      U.teach = { last: null, seen: [], asked: 0, right: 0, wisdom: 0 }; U.teachCard = null;   // Teach mode starts fresh each battle
      if (PC && U.account.contracts?.active) { PC.endCall(U.account.contracts, { how: "abandoned" }); saveAccount(); }   // a call left open by an abandoned battle ends here, with no standing, before the book is snapshotted: the new battle's calls must not trip on it
      resetFollow();
      U.s = E.create({ ...U.setupOpts, receiptId: `tourist-${Date.now()}-${seed}`, cognitive: U.account.cognitive, seeds: U.account.seeds, inspiration: U.setupOpts?.inspiration ?? (U.account.inspiration || 0), victories: U.setupOpts?.victories ?? (U.account.victories || {}), emissaryMemory: U.setupOpts?.emissaryMemory ?? (U.account.emissary || {}), self: U.account.self, mirror: U.account.mirror, unlockedSummons: U.account.unlocked, contracts: U.account.contracts, imitatedTraits: IM ? IM.carried(U.account) : [], gaiaBoons: GB && !U.setupOpts?.focusedDreamTest ? GB.battleOptions(GB.of(U.account).standing) : [], perkMods: A.perkMods(U.account) }); U.actions = []; U.report = null; U.answered = null; U.fxPlayer?.skip(); U.fxFrame = null; U.bubbles = []; U.actionCues = {}; U.facing = {};
      if (!practice && root.ConceptCombatInjury) { const kept = U.setupOpts?.injuries ?? U.account.injuries ?? {}; for (const a of Object.values(U.s.actors)) if (a.side === "player" && kept[a.character]) a.injuries = root.ConceptCombatInjury.begin(a, a, { injuries: kept }); }   // wounds cross battles (practice bodies arrive clean)
      U.stakeHeld = null; U.stakeSeen = 0; U.pactSeen = 0;   // W1.5+W5.3: no held vessels, no settled wagers at battle start   // pacts: no drained codes either
      if (typeof CombatTitles !== "undefined" && U.s && !U.s.titlesAnnounced) {   // W9.5: titles are worn into battle — announced, with Heat before a crowd (no stats: honor, not armor)
        U.s.titlesAnnounced = true;
        const crowd = !!(BK && THB && BK.crowdBattle(U.s.themedBattle, THB.THEMES));
        U.s.crowdHeat = { player: 0, enemy: 0 };
        const heralds = [];
        const mine = CombatTitles.worn(U.account);
        if (mine && U.s.actors.player && !U.s.actors.player.defeated) heralds.push({ id: "player", side: "player" });
        for (const a of Object.values(U.s.actors)) if (a.side !== "player" && !a.defeated && (a.titles || []).length) heralds.push({ id: a.id, side: "enemy" });
        for (const h of heralds) {
          const a = U.s.actors[h.id], title = h.side === "player" ? mine : a.titles[0];
          U.s.crowdHeat[h.side === "player" ? "player" : "enemy"] += CombatTitles.announceBonus(crowd);
          U.s.log.push({ round: U.s.round, kind: "announce", actor: h.id, text: `${a.name} is announced: ${title}.${crowd ? " The crowd answers (+1 Heat)." : ""}` });
        }
      }
      if (U.setupOpts?.dose && U.s.actors.player) {   // W9.4: the dose rides in (set by the pre-battle dose choice — unbuilt UI; tested via setupOpts)
        const P = U.s.actors.player, D = U.setupOpts.dose;
        if (D.substance === "redInk") { P.redInk = true; U.s.log.push({ round: U.s.round, kind: "announce", actor: "player", text: `${P.name} dosed Red Ink: the blood burns hotter (+2 potency per hit).` }); }
        if (D.substance === "stillwater") { P.stillwater = true; U.s.log.push({ round: U.s.round, kind: "announce", actor: "player", text: `${P.name} dosed Stillwater Draught: borrowed calm, good for one disruption.` }); }
        if (D.substance === "chorusSalt") { U.s.crowdHeat = U.s.crowdHeat || { player: 0, enemy: 0 }; U.s.crowdHeat.player = 8; U.s.log.push({ round: U.s.round, kind: "announce", actor: "player", text: `${P.name} dosed Chorus Salt: the crowd already roars (Heat 8).` }); }
        U.s.doseRec = D;
        if (typeof CombatDoping !== "undefined") { const d = CombatDoping.dose(U.account, D.substance, { masked: !!D.masked, depth: D.depth || 0, saga: U.account.sagas?.active?.id || "saga-0" }); U.account = d.account; if (P.inspiration != null && U.account.inspiration != null) P.inspiration = Math.min(P.inspiration, U.account.inspiration); for (const t of d.lines) U.s.log.push({ round: U.s.round, kind: "announce", actor: "player", text: t }); saveAccount(); }   // act() copies the battle's Inspiration back to the account, so the debt is taken in the battle too   // the price is unavoidable: charged when the dose rides in (merge fix: the shelved build gave the effect without the price)
      }
      if (U.account.burn > 0 && U.s.actors.player && !U.setupOpts?.dose) {   // Red Ink's burn lands on the next bout (LF does not carry between battles, so "burn after" is paid here)
        const P = U.s.actors.player, paid = Math.min(U.account.burn, Math.max(0, P.lf - 1)); P.lf -= paid;
        U.s.log.push({ round: U.s.round, kind: "announce", actor: "player", text: `${P.name} still burns from the Red Ink: −${paid} LF.` });
        U.account = { ...U.account, burn: 0 }; saveAccount();
      }
      if (U.account.woozy && !practice && U.s.actors.player) { const W = root.ConceptCombatSurgery?.rules?.woozy || { turns: 2, apLoss: 25, damageMul: 0.9 };   // the Lab's anaesthetic (account/surgery.js)
        const opens = U.s.order[U.s.turnIndex] === "player", P = U.s.actors.player;   // the opening turn has already started: it pays now
        P.status.woozy = { left: opens ? W.turns - 1 : W.turns, apLoss: W.apLoss, damageMul: W.damageMul }; if (opens) P.tempo = Math.max(0, P.tempo - W.apLoss); U.s.log.push({ round: U.s.round, kind: "status", actor: "player", text: `${U.s.actors.player.name} is still woozy from surgery: ${W.apLoss} fewer AP for ${W.turns} turns, ${Math.round((1 - W.damageMul) * 100)}% less ability damage.` });
        U.account = { ...U.account, woozy: false }; saveAccount(); }
      U.llmSettings = { ...U.llmSettings, baseURL: ov.querySelector("#ccSocketEndpoint")?.value.trim() || U.llmSettings.baseURL,
        model: ov.querySelector("#ccSocketModel")?.value.trim() || U.llmSettings.model,
        provider: ov.querySelector("#ccSocketProvider")?.value || U.llmSettings.provider };
      store.set("loci:llm:settings", U.llmSettings);
      if (U.llmEnabled) connectSocketOpponent();
      showDialogueFrom(0);
      host.classList.remove("cc-setting-up"); ov.hidden = true; U.mode = "menu"; U.menu = "root"; U.menuIndex = 0; U.sel = null;
      U.narrationResultDone = false;
      U.narrationScene = (o && Object.prototype.hasOwnProperty.call(o, "narration"))
        ? o.narration
        : ((ov.querySelector("#ccNarration") || {}).value || params.narration || "");
      render();
      openNarration("open", () => pump());
    }
    function startSafely(o) {
      const before = U.account;
      try { start(o); }
      catch (error) {
        const wasTest = !!U.testSnapshot; endTestBattle();   // a test start that failed restores (and writes) what it began with
        if (!wasTest) { U.account = before; saveAccount(); }   // `before` can share objects the failed start already changed (takePack)
        console.error("Concept Combat failed to start", error); recordDiagnostic("Combat failed to start",error);
        const message = error?.message || String(error);
        const card = $("ccOverlay").querySelector(".cc-setup");
        let alert = card.querySelector("[data-setup-error]");
        if (!alert) { alert = document.createElement("p"); alert.dataset.setupError = "true"; alert.className = "cc-bad"; const row = card.querySelector(".cc-row"); row?.parentNode ? row.parentNode.insertBefore(alert, row) : card.prepend(alert); }   // the start row sits inside a panel, not on the card
        alert.textContent = `Battle setup failed: ${message}`; root.ConceptCombatKeeperUI?.say("err");   // the Town Hall keeper says nothing was spent
        try { flashTip(`Battle setup failed: ${message}`); } catch {}   // the red line hides in a collapsed panel; the toast never does
      }
    }

    function popupSprite(unit,pose) {
      const key=communeArt(unit.form?.golden?"gold-form":unit.form?.formId==="one_with_nature"?"gaia-form":unit.sprite), tkey=tsukumogamiArt(key);
      if((unit.communed||unit.awakened)&&tkey&&!SPRITE_DIR[tkey]&&SPRITE_FOLDERS.has(tkey))loadSpritePackage(tkey);
      const folder=SPRITE_DIR[tkey] || (tkey==="gaia-form"?tkey:null) || W?.data?.monsters?.[unit.kind]?.sprite;
      if(!folder)return spriteImg(tkey,unit.name,"cc-duel-art");
      const big=(unit.size?.w||1)>1||(unit.size?.h||1)>1;   // a multi-tile unit stands taller in the scene too (Mala, 2026-10-27, wounded Gaia)
      return `<img class="cc-duel-art${big?" cc-duel-big":""}" data-key="${esc(tkey||"")}" src="combat/sprites/${folder}/${resolvePose(tkey,pose).pose}.png" alt="${esc(unit.name)}">`;
    }
    function openAttackPopup(scenes) {
      if(!scenes.length)return;
      const now=performance.now();let end=0;const ends=scenes.map(sc=>(end+=sceneMs(sc)));U.closeup={scenes,ends,index:0,started:now,until:now+end,focus:document.activeElement};
      host.querySelector(".cc-main").inert=true;host.querySelector(".cc-side").inert=true;$("ccOverlay").inert=true;
      $("ccAttackPopup").onkeydown=e=>{if(e.key==="Tab"){e.preventDefault();$("ccAttackSkip").focus();}};
      drawAttackPopup();$("ccAttackSkip").focus();
    }
    // The Tourist's photos, on his postcard and again on the battle-over report (Mala, 2026-10-26: they flashed by too fast to see).
    function postcardPhotos(card) {
      return `<div class="cc-postcard-photos">${card.photos.map(p=>`<figure>${p.thumbnail?`<img class="cc-postcard-thumb" alt="${esc(p.name)}" src="${esc(p.thumbnail)}">`:p.sprite&&SPRITE_DIR[p.sprite]?spriteImg(p.sprite,p.name,"cc-postcard-thumb"):`<span aria-hidden="true">${p.kind==="plant"?"❧":p.kind==="animal"?"♧":"♙"}</span>`}<figcaption>${esc(p.name)}</figcaption></figure>`).join("")}</div>`;
    }
    // The postcard ignores a skip for its first moment: a skip pressed for the battle's last scene must not carry over and
    // close it unseen (Mala, 2026-10-26).
    function reportGuarded() {
      const c=U.closeup,sc=c?.scenes[c.index];
      return sc?.kind==="postcard"&&performance.now()-(c.shownAt||0)<REPORT_GUARD_MS;
    }
    function drawAttackPopup() {
      const scene=U.closeup.scenes[U.closeup.index],popup=$("ccAttackPopup");popup.hidden=false;
      popup.setAttribute("aria-label",scene.kind==="conversation"?`Conversation: ${scene.name}`:scene.kind==="learning"?"Genius learns a technique":"Attack close-up");
      const tile=u=>E.geometry.tileAt(U.s,u.x,u.y);
      const fighter=(u,side,pose="idle")=>{const terrain=tile(u);return `<div class="cc-duel-fighter ${side}" style="--tile-color:${esc(terrain?.color||"#345447")}"><div class="cc-duel-name">${esc(u.name)}</div><div class="cc-duel-figure">${popupSprite(u,pose)}</div><div class="cc-duel-tile"></div><small>(${u.x}, ${u.y}) · ${esc(terrain?.name||"terrain")}</small></div>`;};
      const actorPose=scene.pose||"idle";
      if(scene.kind==="conversation" || scene.kind==="learning"){
        popup.classList.remove("is-leaving","is-cast","is-hit","is-vacated","is-miss","is-landed");
        popup.innerHTML=conversationMarkup(scene);bindPortraitFallbacks(popup);$("ccAttackSkip").onclick=closeAttackPopup;return;
      }
      if(scene.kind==="postcard"){
        const card=scene.card;
        popup.innerHTML=`<section class="cc-duel is-postcard"><header><div><small>POSTCARD · ${esc(card.quality)}</small><h2>Greetings from ${esc(card.location)}</h2></div><button type="button" id="ccAttackSkip">Continue ›</button></header><div class="cc-postcard-body"><div class="cc-postcard-tourist">${popupSprite(scene.unit,"cast")}</div><div><p class="cc-belief-line">${esc(card.message)}</p><b>${card.photoCount} distinct photos</b>${postcardPhotos(card)}</div></div></section>`;
        U.closeup.shownAt=performance.now();$("ccAttackSkip").onclick=()=>{if(!reportGuarded())closeAttackPopup();};return;
      }
      if(scene.kind==="dream"){
        const u=scene.unit,terrain=tile(u),hasArt=(SPRITE_EXTRAS[SPRITE_DIR[u.sprite]]||[]).includes("dream-open");
        popup.innerHTML=`<section class="cc-duel is-dream${hasArt?" has-art":""}"><header><div><small>DREAM SPACE</small><h2>${esc(scene.name)}</h2></div><button type="button" id="ccAttackSkip" title="Skip this scene (Escape)">Skip ›</button></header><div class="cc-duel-stage"><div class="cc-duel-fighter opener" style="--tile-color:${esc(terrain?.color||"#345447")}"><div class="cc-duel-name">${esc(u.name)}</div><div class="cc-duel-figure"><span class="cc-dream-ring" aria-hidden="true"></span>${popupSprite(u,"idle")}</div><div class="cc-duel-tile"></div><small>(${u.x}, ${u.y}) · ${esc(terrain?.name||"terrain")}</small></div></div>${scene.lines.map(l=>`<p class="cc-belief-line cc-dream-line">${esc(l)}</p>`).join("")}</section>`;
        $("ccAttackSkip").onclick=closeAttackPopup;
        popup.querySelectorAll(".cc-duel-art[data-key]").forEach(img=>{img.style.transform=`scaleX(${shouldFlipSprite(img.dataset.key,true)?-1:1})`;});
        return;
      }
      if(scene.kind==="boon"){
        const others=scene.targets.filter(t=>t.before.id!==scene.source.id),selfT=scene.targets.find(t=>t.before.id===scene.source.id);
        popup.innerHTML=`<section class="cc-duel is-boon${scene.selfOnly?" is-self":""}"><header><div><small>${scene.selfOnly?"SELF":"SUPPORT"}</small><h2>${esc(scene.name)}</h2></div><button type="button" id="ccAttackSkip" title="Skip this scene (Escape)">Skip ›</button></header><div class="cc-duel-stage">${fighter(scene.source,"attacker caster"+(selfT?" receives":""),actorPose)}${others.length?`<div class="cc-duel-flight" aria-hidden="true"><span>✚</span></div><div class="cc-duel-targets">${others.map(t=>fighter(t.before,"defender ally receives")).join("")}</div>`:""}</div><div class="cc-duel-results cc-boon-results" aria-live="polite">${scene.targets.map(t=>`<span>${esc(t.before.name)} <b>${esc(boonLine(t))}</b>${t.lf?` · ${Math.round(t.before.lf)} → ${Math.round(t.after.lf)}`:""}</span>`).join("")}</div></section>`;
        $("ccAttackSkip").onclick=closeAttackPopup;
        popup.querySelectorAll(".cc-duel-art[data-key]").forEach(img=>{const isCaster=!!img.closest(".caster");img.style.transform=`scaleX(${shouldFlipSprite(img.dataset.key,isCaster)?-1:1})`;});
        return;
      }
      if(scene.kind==="belief"){
        const u=scene.unit,terrain=tile(u),converted=scene.outcome==="converted";
        popup.innerHTML=`<section class="cc-duel is-belief ${converted?"is-converted":"is-shaken"}${scene.hold?" is-held":""}"><header><div><small>${converted?"BELIEF · CONVERTED":"BELIEF · SHAKEN"}</small><h2>${esc(scene.name)}</h2></div><button type="button" id="ccAttackSkip" title="Skip this scene (Escape)">Skip ›</button></header><div class="cc-duel-stage"><div class="cc-duel-fighter witness" style="--tile-color:${esc(terrain?.color||"#345447")}"><div class="cc-duel-name">${esc(u.name)}</div><div class="cc-duel-figure"><img class="cc-belief-aura" alt="" src="combat/sprites/auras/${converted?"power-ascend":"mystery"}/frame-1.png">${popupSprite(u,"idle")}<span class="cc-belief-mark" aria-hidden="true">${converted?"✦":"?"}</span></div><div class="cc-duel-tile"></div><small>(${u.x}, ${u.y}) · ${esc(terrain?.name||"terrain")}</small></div></div><p class="cc-belief-line">${esc(scene.text)}</p>${converted&&scene.strength?`<p class="cc-belief-tier" aria-label="Belief strength ${scene.strength} of 3">${[1,2,3].map(n=>`<span class="${n<=scene.strength?"on":""}"></span>`).join("")}<small>belief strength ${scene.strength}/3</small></p>`:""}</section>`;
        $("ccAttackSkip").onclick=closeAttackPopup;
        popup.querySelectorAll(".cc-duel-art[data-key]").forEach(img=>{img.style.transform=`scaleX(${shouldFlipSprite(img.dataset.key,true)?-1:1})`;});
        return;
      }
      if(scene.kind==="farewell"){
        const u=scene.unit,terrain=tile(u);
        popup.innerHTML=`<section class="cc-duel is-farewell"><header><div><small>${esc(scene.label||"WORD FROM THE LODGE")}</small><h2>${esc(scene.name)}</h2></div><button type="button" id="ccAttackSkip" title="Skip this scene (Escape)">Skip ›</button></header><div class="cc-duel-stage"><div class="cc-duel-fighter witness" style="--tile-color:${esc(terrain?.color||"#345447")}"><div class="cc-duel-name">${esc(u.name)}</div><div class="cc-duel-figure">${popupSprite(u,"idle")}</div><div class="cc-duel-tile"></div><small>(${u.x}, ${u.y}) · ${esc(terrain?.name||"terrain")}</small></div></div>${scene.opener?`<p class="cc-scene-opener">${esc(scene.opener)}</p>`:""}<p class="cc-belief-line">${faceFile(u.sprite,"speaking")?`<img class="cc-speaker-face" src="${faceFile(u.sprite,"speaking")}" alt="">`:""}“${esc(scene.line)}”</p></section>`;
        $("ccAttackSkip").onclick=closeAttackPopup;
        popup.querySelectorAll(".cc-duel-art[data-key]").forEach(img=>{img.style.transform=`scaleX(${shouldFlipSprite(img.dataset.key,true)?-1:1})`;});
        return;
      }
      if(scene.kind==="dodge"){
        const d=scene.dodger,from=tile(d.before),to=tile(d.after);
        popup.innerHTML=`<section class="cc-duel is-dodge ${scene.melee?"melee":"ranged"}"><header><div><small>DODGE</small><h2>${esc(d.before.name)} avoids ${esc(scene.name)}</h2></div><button type="button" id="ccAttackSkip" title="Skip this animation (Escape)">Skip ›</button></header><div class="cc-duel-stage">${fighter(scene.source,"attacker",actorPose)}<div class="cc-duel-flight" aria-hidden="true"><span>✦</span></div><div class="cc-duel-targets"><div class="cc-duel-fighter defender dodger" style="--tile-color:${esc(from?.color||"#345447")}"><div class="cc-duel-name">${esc(d.before.name)}</div><div class="cc-duel-figure">${popupSprite(d.before,"idle")}</div><div class="cc-duel-tile"></div><div class="cc-duel-miss" aria-hidden="true">MISS</div><small>(${d.before.x}, ${d.before.y}) · attacked</small></div><div class="cc-duel-fighter cc-duel-landing" style="--tile-color:${esc(to?.color||"#345447")}"><div class="cc-duel-name">&nbsp;</div><div class="cc-duel-figure"></div><div class="cc-duel-tile"></div><small>(${d.after.x}, ${d.after.y}) · ${esc(to?.name||"terrain")}</small></div></div></div><div class="cc-duel-results" aria-live="polite"><span>${esc(d.before.name)} leaves (${d.before.x}, ${d.before.y}) before ${esc(scene.name)} lands, and comes down at (${d.after.x}, ${d.after.y}). <b>No damage.</b></span></div></section>`;
        $("ccAttackSkip").onclick=closeAttackPopup;
        popup.querySelectorAll(".cc-duel-art[data-key]").forEach(img=>{const isAttacker=!!img.closest(".attacker");img.style.transform=`scaleX(${shouldFlipSprite(img.dataset.key,isAttacker)?-1:1})`;});
        return;
      }
      popup.innerHTML=`<section class="cc-duel ${scene.melee?"melee":"ranged"}"><header><div><small>${scene.melee?"MELEE":"RANGED"}</small><h2>${esc(scene.name)}</h2></div><button type="button" id="ccAttackSkip" title="Skip this attack animation (Escape)">Skip ›</button></header><div class="cc-duel-stage">${fighter(scene.source,"attacker",actorPose)}<div class="cc-duel-flight" aria-hidden="true"><span>✦</span></div><div class="cc-duel-targets">${scene.targets.slice(0,3).map(t=>fighter(t.before,"defender")).join("")}</div></div><div class="cc-duel-results" aria-live="polite">${scene.targets.map(t=>`<span${t.warded?' class="is-warded"':""}>${esc(t.before.name)} ${t.warded?`<b class="cc-ward-took">WARD −${Math.round(t.warded)}</b> · `:""}<b>${t.amount>0?`−${Math.round(t.amount)} LF`:"No damage"}</b> · ${Math.round(t.before.lf)} → ${Math.round(t.after.lf)}${t.wardBroke?" · Ward broken":""}${t.after.defeated?" · Down":""}</span>`).join("")}</div></section>`;
      $("ccAttackSkip").onclick=closeAttackPopup;
      popup.querySelectorAll(".cc-duel-art[data-key]").forEach(img=>{const isAttacker=!!img.closest(".attacker");img.style.transform=`scaleX(${shouldFlipSprite(img.dataset.key,isAttacker)?-1:1})`;});
    }
    function updateAttackPopup() {
      const c=U.closeup;if(!c)return;
      const elapsed=performance.now()-c.started;let index=c.ends.findIndex(end=>elapsed<end);
      if(index<0){closeAttackPopup();return;}
      if(index!==c.index){c.index=index;drawAttackPopup();$("ccAttackSkip").focus();}
      const phase=elapsed-(index?c.ends[index-1]:0),scene=c.scenes[index],popup=$("ccAttackPopup"),leaveAt=sceneMs(scene)-SCENE_LEAVE_MS;
      if(scene.kind==="dream"){   // the hands come together, the space opens, the scene leaves
        const T=scene.timeline;popup.classList.toggle("is-cast",phase>=T.open);popup.classList.toggle("is-hit",phase>=T.flare);popup.classList.toggle("is-leaving",phase>=leaveAt);
        const img=popup.querySelector(".opener img.cc-duel-art"),key=scene.unit.sprite,folder=SPRITE_DIR[key];
        if(img&&folder){const url=`combat/sprites/${folder}/${resolvePose(key,phase>=T.open?scene.pose:"idle",`${c.started}:dream:${scene.unit.id}`).pose}.png`;if(img.getAttribute("src")!==url)img.setAttribute("src",url);
          const idle=poseSprites[key]?.idle;if(idle?.naturalHeight&&img.naturalHeight)img.style.height=`${Math.max(1,img.closest(".cc-duel-figure").clientHeight-5)*img.naturalHeight/idle.naturalHeight}px`;}
        return;
      }
      const dodging=scene.kind==="dodge",T=scene.timeline||{};
      if(scene.kind==="boon"){   // the caster casts, the gift arrives, the scene leaves; nobody flinches
        popup.classList.toggle("is-cast",phase>=300);popup.classList.toggle("is-hit",phase>=850);popup.classList.toggle("is-leaving",phase>=leaveAt);
        const img=popup.querySelector(".caster img.cc-duel-art"),key=scene.source.sprite,folder=SPRITE_DIR[key];
        if(img&&folder){const url=`combat/sprites/${folder}/${resolvePose(key,phase>=300?scene.pose:"idle",`${c.started}:boon:${scene.source.id}`).pose}.png`;if(img.getAttribute("src")!==url)img.setAttribute("src",url);}
        popup.querySelectorAll("img.cc-duel-art").forEach(i=>{const idle=poseSprites[i.dataset.key]?.idle;if(idle?.naturalHeight&&i.naturalHeight)i.style.height=`${Math.max(1,i.closest(".cc-duel-figure").clientHeight-5)*i.naturalHeight/idle.naturalHeight}px`;});
        return;
      }
      if(["postcard","conversation","learning"].includes(scene.kind))return;
      if(scene.kind==="belief"||scene.kind==="farewell"){   // doubt gathers, belief turns, the scene leaves; a farewell shares the staging
        popup.classList.toggle("is-cast",scene.hold||phase>=T.doubt);popup.classList.toggle("is-hit",scene.hold||phase>=T.turn);popup.classList.toggle("is-leaving",phase>=leaveAt);
        const img=popup.querySelector(".witness img.cc-duel-art"),key=scene.unit.sprite,folder=SPRITE_DIR[key];
        const F=scene.frames,rising=F&&!scene.hold&&phase>=T.doubt&&phase<T.turn;
        if(img&&folder){const url=rising?`${F.dir}/frame-${Math.min(F.count,1+Math.floor((phase-T.doubt)/(T.turn-T.doubt)*F.count))}.png`:`combat/sprites/${folder}/${resolvePose(key,scene.hold||phase>=T.turn?scene.pose:"idle",`${c.started}:belief:${scene.unit.id}`).pose}.png`;if(img.getAttribute("src")!==url)img.setAttribute("src",url);
          const idle=poseSprites[key]?.idle;if(idle?.naturalHeight&&img.naturalHeight)img.style.height=`${Math.max(1,img.closest(".cc-duel-figure").clientHeight-5)*img.naturalHeight/idle.naturalHeight}px`;}
        return;
      }
      popup.classList.toggle("is-cast",phase>=(dodging?T.attack:300));popup.classList.toggle("is-hit",!dodging&&phase>=850);popup.classList.toggle("is-leaving",phase>=leaveAt);
      // Dodge order: vacated (in transit) → the attack misses the empty square → landed.
      popup.classList.toggle("is-vacated",dodging&&phase>=T.vacate);popup.classList.toggle("is-miss",dodging&&phase>=T.miss);popup.classList.toggle("is-landed",dodging&&phase>=T.land);
      const setPose=(element,unit,pose)=>{const key=unit.form?.golden?"gold-form":unit.form?.formId==="one_with_nature"?"gaia-form":unit.sprite;const folder=SPRITE_DIR[key]||(key==="gaia-form"?key:null);if(element&&folder){const url=`combat/sprites/${folder}/${resolvePose(key,pose,`${c.started}:${index}:${unit.id}`).pose}.png`;if(element.getAttribute("src")!==url)element.setAttribute("src",url);}};
      setPose(popup.querySelector(".attacker img"),scene.source,phase>=(dodging?T.attack:300)?scene.pose:"idle");
      if(dodging){setPose(popup.querySelector(".dodger img"),scene.dodger.before,phase>=T.land?"idle":phase>=T.vacate?"dodge":"idle");}
      else popup.querySelectorAll(".defender img").forEach((img,i)=>{const t=scene.targets[i];setPose(img,t.before,phase>=850?(POSES?POSES.hitPose({defeated:t.after.defeated,status:t.before.status,warded:t.warded,amount:t.amount}):t.after.defeated?"knocked-out":"block"):"idle");});
      // Every pose shares idle's pixel scale; horizontal knockout art must stay low.
      popup.querySelectorAll("img.cc-duel-art").forEach(img=>{
        const idle=poseSprites[img.dataset.key]?.idle;
        if(idle?.naturalHeight && img.naturalHeight) img.style.height=`${Math.max(1,img.closest(".cc-duel-figure").clientHeight-5)*img.naturalHeight/idle.naturalHeight}px`;
      });
    }
    function closeAttackPopup() {
      const c=U.closeup;if(!c)return;
      const pendingReports=c.scenes.slice(c.index+1).filter(sc=>["postcard","conversation","learning"].includes(sc.kind));
      if(pendingReports.length){openAttackPopup(pendingReports);U.closeup.focus=c.focus;return;}
      U.closeup=null;$("ccAttackPopup").hidden=true;
      host.querySelector(".cc-main").inert=false;host.querySelector(".cc-side").inert=false;$("ccOverlay").inert=false;
      if(c.focus?.isConnected)c.focus.focus();
      const later = U.followAfter; U.followAfter = null; if (later) followAction(later.a, later.before, later.logFrom);   // Follow: frame the action now that the close-up is gone
      syncCenter(); U.fxPlayer?.skip();pump();
    }

    // ── driving the engine ─────────────────────────────────────────────────
    function act(a) {
      if (a.actor === "player" && U.s) a = { ...a, actor: controlledId(U.s) };   // every human order goes to the controlled fighter: the soul while it is out
      const afterMenu = U.afterActMenu; U.afterActMenu = null;   // a drawer pick returns here after a direct act (Mala 2026-10-22: ritual steps must not bounce to Command)
      const actFromPick = !["move", "press", "jump", "climb", "target", "response"].includes(U.mode);   // targeting/move commits still land on the root
      if(U.closeup) return false;
      const logFrom = U.s.log.length;
      const fxBefore = U.s, fxActor = fxBefore.actors[a.actor], fxOrigin = fxActor ? [fxActor.x,fxActor.y] : null;
      const fxPositions = Object.fromEntries(Object.values(fxBefore.actors).map(v=>[v.id,[v.x,v.y]]));
      const fxPending = a.type==="respond"&&fxBefore.pending?.inst ? fxBefore.pending.inst : null;
      let fxManifest = null, fxAim = Array.isArray(a.target) ? a.target.slice() : null, fxTiles = null;
      if(a.type==="ability"&&a.ability&&fxActor){try{const tg=E.targeting(fxBefore,a.actor,a.ability,a);fxManifest=tg.m;const hit=fxAim&&tg.legal.find(q=>q.at[0]===fxAim[0]&&q.at[1]===fxAim[1]);if(hit?.route)fxTiles=hit.route.slice();else if(tg.m.delivery==="line"&&fxAim&&fxOrigin)fxTiles=E.geometry.line(fxOrigin[0],fxOrigin[1],fxAim[0],fxAim[1]);else if(hit)fxTiles=hit.tiles.slice();else if(tg.selfCast&&tg.legal[0])fxTiles=tg.legal[0].tiles.slice();if(!fxAim&&fxActor)fxAim=fxOrigin;}catch(error){console.debug("FX targeting snapshot skipped",error);}}
      if(a.type==="strike"){fxAim=fxAim||null;fxTiles=fxAim?[fxAim]:[];fxManifest={name:"Strike",concept:null,delivery:"contact",effect:"damage",damageType:"nigredo",tier:"basic"};}
      if(a.type==="move"||a.type==="jump"||a.type==="climb")fxTiles=fxAim?[fxOrigin,fxAim]:[];
      const r = E.apply(U.s, a);
      if (pendingInspectedDecision != null) {
        try { decisionInspector?.observe(pendingInspectedDecision, r); } catch (error) { console.warn("Emissary observation failed", error); }
        pendingInspectedDecision = null;
      }
      if (!r.ok) { if (r.kept) { U.s = r.state; draw(); } recordDiagnostic("Engine action rejected",r.error,a.actor,a); flashTip(r.error); return false; }   // kept: refused, but the state changed (contempt of court)
      U.s = r.state; U.mode = modeAfterEngineAction(U.s); U.actions.push(a);
      if (U.s.outcome && U.account?.stakeEscrow && !U.account.stakeEscrow.outcome) { U.account = { ...U.account, stakeEscrow: { ...U.account.stakeEscrow, outcome: U.s.outcome.winner || "none" } }; saveAccount(); }   // decided: record it before anything below can throw
      drainStakes();   // W5.3: settled wagers return to the purse after every act
      drainPacts();   // summon pacts: the relationship ledger updates after every act
      // Only the unit acting now keeps the way its action pointed; everyone else turns back to the nearest foe (aggroIsRight).
      // Mala, 2026-10-25: an enemy Memorialist faced away from her after healing an ally behind him; the old facing never reset.
      for (const id of Object.keys(U.facing)) if (id !== a.actor && U.s.actors[id]) delete U.facing[id];
      const moved = ["move", "jump", "climb"].includes(a.type) || (a.type === "respond" && a.response === "reposition");
      if (moved && fxOrigin && U.s.actors[a.actor]) {
        const dx = across([U.s.actors[a.actor].x, U.s.actors[a.actor].y])[0] - across(fxOrigin)[0];
        if (dx) U.facing[a.actor] = dx > 0;   // a straight up/down step keeps the current facing (or the nearest foe), never the art's own direction
      } else {
        const point = facingPoint(fxBefore, a.target) || (a.type === "ability" && fxAim && (fxAim[0] !== fxOrigin?.[0] || fxAim[1] !== fxOrigin?.[1]) ? fxAim : null);
        if (point && fxOrigin && across(point)[0] !== across(fxOrigin)[0]) U.facing[a.actor] = FX?.facingRight?.(across(fxOrigin), across(point), U.facing[a.actor] ?? true) ?? (across(point)[0] > across(fxOrigin)[0]);
      }
      for (const event of r.events || []) {
        if (["transform", "formBroken"].includes(event.kind) && event.sequence?.length) {
          U.transformAnimations[event.actor] = { sequence: event.sequence, started: performance.now(), sprites: event.sprites,
            sourceSprite: fxBefore.actors[event.actor]?.sprite || "warden" };
        }
        if (event.kind === "wildMove" && event.from && event.to) {
          U.facing[event.id] = FX?.facingRight?.(across(event.from), across(event.to), U.facing[event.id] ?? true) ?? (across(event.to)[0] > across(event.from)[0]);
          U.poseUntil[event.id] = { pose: "walk", until: performance.now() + 600 }; setTimeout(() => { if (U.s) draw(); }, 650);   // wild animals show their own walk, not a sliding idle
        } else if (event.kind === "wildHit" && event.actor && event.target) {
          const target = U.s.actors[event.target] || fxBefore.actors[event.target];
          const from = event.from || U.s.wild?.find((m) => m.id === event.actor);
          U.poseUntil[event.actor] = { pose: "punch", until: performance.now() + 800 }; setTimeout(() => { if (U.s) draw(); }, 850);   // Mala, 2026-10-26: the feral pig's ram showed its idle; it has its own attack art
          if (target && from) U.facing[event.actor] = FX?.facingRight?.(across([from.x ?? from[0], from.y ?? from[1]]), across([target.x, target.y]), U.facing[event.actor] ?? true) ?? (across([target.x, target.y])[0] > across([from.x ?? from[0], from.y ?? from[1]])[0]);
        } else if (event.kind === "awaken" && event.actor) {
          U.poseUntil[event.actor] = { pose: "ultimate", until: performance.now() + 1200 }; setTimeout(() => { if (U.s) draw(); }, 1250);   // Tsukumogami: waking plays ultimate once
        } else if (event.kind === "settle" && event.actor) {
          (U.settledFlash ||= {})[event.actor] = performance.now(); setTimeout(() => { if (U.s) draw(); }, 1250);   // settling plays knocked-out once, then the object returns as map art
        } else if (event.kind === "collapse" && event.actor) {
          (U.collapsedFlash ||= {})[event.actor] = performance.now(); setTimeout(() => { if (U.s) draw(); }, 850);   // collapsing plays hurt once, then scatters to rubble
        }
      }
      if (!U.s.focusedDreamTest) {
      if (U.s.seeds != null) U.account.seeds = U.s.seeds;
      if (U.s.actors?.player && U.s.actors.player.inspiration != null && U.account.inspiration !== U.s.actors.player.inspiration) { U.account.inspiration = U.s.actors.player.inspiration; saveAccount(); }   // Inspiration is kept between battles
      if (U.s.insight?.cognitive) { U.account.cognitive = U.s.insight.cognitive; saveAccount(); }
      if (U.s.self) U.account.self = U.s.self;
      if (U.s.mirror) U.account.mirror = { dreamsBefriended: U.s.mirror.dreamsBefriended };
      for (const id of U.s.summonUnlocks || []) if (!(U.account.unlocked || []).includes(id)) { U.account.unlocked = [...(U.account.unlocked || []), id]; flashTip(`${SM?.data?.summons?.[id]?.name || "A new summon"} will answer your summons from now on.`); }   // Gaia bound by the ritual (engine/conditions.js bindGaia): hers the moment the chant ends
      // Beads are yours the moment you bind them and gone the moment you release one, whatever happens to the battle.
      { const held = (U.s.actors.player?.beads || []).map((b) => ({ kind: b.kind, name: b.name, maxLF: b.maxLF, ...(b.mind ? { mind: b.mind } : {}) }));; const BSb = root.ConceptCombatBeadSwallow, kept = BSb ? BSb.withoutEscrow([...BSb.benched(U.setupOpts?.beads, W?.data?.monsters), ...held], U.stakeHeld) : held; if (JSON.stringify(kept) !== JSON.stringify(U.account.beads || [])) U.account.beads = kept; }   // beads the battle could not carry stay on the account (audit 1.3.449)   // a tamed mind keeps what it was
      saveAccount();
      if (a.type === "useItem") { U.account = Loot.useCarried(U.account, a.item); saveAccount(); }
      }
      showDialogueFrom(logFrom);
      const actionName = FX?.actionLabel?.(a, fxManifest || C.abilities[a.ability], r.events, PK?.sources?.[a.item]?.name || SM?.data?.summons?.[a.summon]?.name);
      if (actionName) U.actionCues[a.actor] = { text: actionName, until: performance.now() + 1250 };
      const pose = ["move", "jump", "climb", "ability", "strike", "grapple", "throw", "guard", "dreamSpace"].includes(a.type) || (a.type === "respond" && ["reposition", "guard"].includes(a.response))
        ? (POSES ? POSES.route({ type: a.type, response: a.response, ability: a.ability, def: C.abilities[a.ability] }) : null) : null;
      if (pose) U.poseUntil[a.actor] = { pose, until: performance.now() + 800 };
      store.set(LAST_KEY, { setup: U.setupOpts, actions: U.actions });
      const animated=new Set(["ability","strike","move","jump","climb","guard","respond"]);
      if(FX&&U.fxPlayer&&fxPending){
        const now=performance.now(),responseCue=FX.cueFromAbility({name:a.response==="guard"?"Guard":"Reposition",type:"respond",delivery:"contact"},{actor:a.actor,origin:fxOrigin,aim:a.to||fxOrigin,tiles:[],positions:fxPositions,response:a.response});
        U.fxPlayer.push(FX.script(responseCue,[],fxTiming),now);
        const caster=fxBefore.actors[fxPending.owner],origin=fxPending.origin|| (caster?[caster.x,caster.y]:null),aim=fxPending.aim||null,tiles=fxPending.route||fxPending.tiles||[];
        const attackCue=FX.cueFromAbility(fxPending,{actor:fxPending.owner,origin,aim,tiles,positions:fxPositions,color:C.concepts[fxPending.concept]?.color,damageType:fxPending.damageType||C.conceptDamageTypes[fxPending.concept],...fxDetails(fxBefore,fxPending.ability,fxPending.owner,aim,tiles,r.events)});
        U.fxPlayer.push(FX.script(attackCue,r.events||[],fxTiming),now);
      }else if(FX&&U.fxPlayer&&animated.has(a.type)){
        const fxEvents=r.events||[],cue=FX.cueFromAbility(fxManifest||{name:a.type,type:a.type,delivery:a.type==="strike"?"contact":undefined},{actor:a.actor,origin:fxOrigin,aim:fxAim,tiles:fxTiles||[],positions:fxPositions,response:a.response,type:a.type,color:fxManifest?.concept?C.concepts[fxManifest.concept]?.color:null,damageType:fxManifest?.damageType||(fxManifest?.concept?C.conceptDamageTypes[fxManifest.concept]:null),...fxDetails(fxBefore,a.ability,a.actor,fxAim,fxTiles||[],fxEvents)});
        U.fxPlayer.push(FX.script(cue,fxEvents,fxTiming),performance.now());
      }else if(FX&&U.fxPlayer&&(r.events||[]).some(e=>e.kind==="damage")){
        const now=performance.now(),used=new Set();
        for(const e of r.events.filter(q=>q.kind==="damage")){const sched=fxBefore.scheduled?.find((q,i)=>!used.has(i)&&q.inst?.ability===e.ability);let cue;
          if(sched){const i=fxBefore.scheduled.indexOf(sched);used.add(i);const m=sched.inst,source=fxBefore.actors[m.owner],origin=m.origin||(source?[source.x,source.y]:null);cue=FX.cueFromAbility(m,{actor:m.owner,origin,aim:m.aim,tiles:m.route||m.tiles||[],positions:fxPositions,color:C.concepts[m.concept]?.color,damageType:m.damageType||C.conceptDamageTypes[m.concept]});}
          else {const def=C.abilities[e.ability]||{};cue=FX.cueFromAbility(def,{actor:e.actor,origin:fxPositions[e.actor]||e.at,aim:e.at,tiles:e.at?[e.at]:[],positions:fxPositions,damageType:e.damageType});}
          U.fxPlayer.push(FX.script(cue,[e],fxTiming),now);
        }
      }
      U.sel = null; U.hover = null; U.menu = (actFromPick && afterMenu) || "root"; U.menuIndex = 0;
      queueTeachCard(U.s.log.slice(logFrom));
      const reports=U.s.log.slice(logFrom).filter(e=>e.kind==="postcard").map(e=>({kind:"postcard",card:e.postcard,unit:U.s.actors[e.actor],ms:Infinity}));
      if(reports.length){ U.account.postcards ||= [];for(const sc of reports)if(!U.account.postcards.some(p=>p.id===sc.card.id))U.account.postcards.push(sc.card);saveAccount(); }
      const full=U.fullAnimation && !params.fast;
      const scenes=closeupScenes(fxBefore,U.s,a,r.events);
      const watched=scenes.filter((sc) => sc.ability === "overwatch");
      const words=[...conversationScenes(fxBefore,U.s,U.s.log.slice(logFrom)),...learningScenes(fxBefore,U.s,U.s.log.slice(logFrom))];
      const eventsOf=eventScenes(U.s,U.s.log.slice(logFrom),factCtx());
      for(const sc of eventsOf)if(sc.factId&&!U.testSnapshot){U.account.plantFacts=PF.markHeard(U.account.plantFacts,sc.plantType,sc.factId);saveAccount();}   // heard when its card opens (a skip counts); a test battle writes nothing
      if(full) openAttackPopup([...dreamScenes(U.s,a,U.s.log.slice(logFrom)),...scenes,...boonScenes(fxBefore,U.s,a),...pepTalkScenes(fxBefore,U.s,U.s.log.slice(logFrom)),...missedCallScenes(fxBefore,U.s,U.s.log.slice(logFrom)),...arrivalScenes(fxBefore,U.s,U.s.log.slice(logFrom)),...eventsOf,...words,...heldBeliefScenes(beliefScenes(U.s,U.s.log.slice(logFrom)))]);
      else openAttackPopup([...watched,...words.map(sc=>({...sc,ms:1600})),...eventsOf.filter(sc=>sc.fieldNote).map(sc=>({...sc,ms:Infinity}))]);   // reduced motion: a teaching card, held until dismissed
      if(reports.length)openAttackPopup([...(U.closeup?.scenes||[]),...reports]);
      if (paceMul > 1 && isAi(a.actor)) {   // Slow: this AI action's lines appear one at a time once its scenes and effects have played (pump starts the wait)
        const lines = U.s.log.slice(logFrom).map((e, i) => ({ upto: logFrom + i + 1, len: String(e.text || "").length })).filter((l) => l.len > 0);
        if (lines.length) { U.reading = { from: logFrom, lines, i: 0, total: lines.reduce((n, l) => n + l.len, 0) }; U.logCap = logFrom; }
      }
      followAction(a, fxBefore, logFrom);
      render(); animate(); pump();
      return true;
    }
    // The controlled fighter: the player, or their projected soul while it is out on the plane.
    const controlledId = (s) => { const soul = s && Object.values(s.actors).find((a) => a.soulOf === "player" && !a.defeated); return soul ? soul.id : "player"; };
    const controlledFighter = (s) => (s ? s.actors[controlledId(s)] : null) || (s ? s.actors.player : null);
    const isAi = (id) => id !== controlledId(U.s) || params.autoplay;
    // The camera follows the active unit when a new decision starts off-screen (also the plane-switch:
    // a soul's turn pans east to the pocket, the body's turn pans home). Never yanks mid-decision.
    function followDecider(d) {
      try {
        if (U.closeup) U.followForce = false;   // a forced call under the pop-up is dropped, so the next decision does not skip its hold check
        if (!d || !U.s || U.closeup) return;
        const stamp = d.actor + ":" + U.s.round + ":" + (U.s.phase || "");
        if (U.follow) {   // Follow on: the camera goes to whoever decides; a new decision ends a manual pause
          if (U.followHoldT && !U.followForce) return;   // an action framed two units: the hold plays out, then the camera goes on to whoever decides
          if (U.followStamp !== stamp) { U.followStamp = stamp; U.followPaused = false; syncFollowBar(); }
          else if (!U.followForce) return;
          U.followForce = false;
          if (!U.followPaused) followActor(d);
          return;
        }
        if (U.followStamp === stamp) return;
        U.followStamp = stamp;
        const u = U.s.actors[d.actor];
        if (!u || typeof centre !== "function" || typeof geo === "undefined" || !geo.W) return;
        const [px, py] = centre(u.x, u.y);
        if (px >= 0 && py >= 0 && px <= geo.W && py <= geo.H) return;
        if (typeof isoOn === "function" && isoOn()) return;   // flat-board follow only; isometric keeps its own frame
        U.panX = geo.W / 2 - u.x * geo.tw - geo.oxC; U.panY = geo.H / 2 - u.y * geo.th - geo.oyC;
      } catch { /* the camera never breaks combat */ }
    }
    // ---- Unit follow camera (flat and isometric: both take zoom and pan, so one routine places either) ----
    const camOk = (x, y) => Number.isFinite(x) && Number.isFinite(y) && !!viewXY(Math.floor(x), Math.floor(y));   // never an empty tile or the far astral region
    const pointXY = (x, y) => { if (isoCam) return isoCam.at(x, y); const ix = Math.floor(x), iy = Math.floor(y), [cx, cy] = centre(ix, iy); return [cx + (x - ix) * geo.tw, cy + (y - iy) * geo.th]; };
    function camPlace(x, y, z) {   // put the tile point (x, y) at the middle of the board at zoom z
      U.zoom = clampZoom(z); layout();
      const [sx, sy] = pointXY(x, y); U.panX += geo.W / 2 - sx; U.panY += geo.H / 2 - sy; layout();
      syncZoomBar();
    }
    function camNow() {   // the tile point at the middle of the board now, or null when it cannot be read
      if (!geo.W) return null;
      if (isoCam) { const t = isoCam.pick(geo.W / 2, geo.H / 2); return t && Number.isFinite(t[0]) && Number.isFinite(t[1]) ? { x: t[0], y: t[1], z: U.zoom } : null; }   // pick returns [x, y] or null (an empty middle: the move jumps)
      return { x: (geo.W / 2 - geo.ox) / geo.tw - 0.5, y: (geo.H / 2 - geo.oy) / geo.th - 0.5, z: U.zoom };
    }
    function camGoto(x, y, z, ms, opts = {}) {   // opts.via: tiles to walk through; opts.free: a move the player asked for (Center), which runs with Follow off or paused   // ease the view there (cinematic, never a jump); no motion at all when animation is off
      try {
        if (!U.s || !geo.W || !camOk(x, y)) return;
        cancelAnimationFrame(U.camRaf); U.camRaf = null;
        const from = opts.free ? camNow() : (U.cam || camNow()), to = { x, y, z: clampZoom(z) }, dur = U.fullAnimation && !params.fast ? ms * paceMul : 0;
        if (!from || dur <= 0) { U.cam = to; camPlace(to.x, to.y, to.z); draw(); return; }
        let t0 = performance.now();
        const tick = (now) => {
          if (U.destroyed || (!opts.free && (!U.follow || U.followPaused))) { U.camRaf = null; return; }
          if (U.closeup) { t0 += 16; U.camRaf = requestAnimationFrame(tick); return; }   // the attack close-up holds the camera still
          const k = Math.max(0, Math.min(1, (performance.now() - t0) / dur));
          U.cam = opts.via?.length ? camAlong(from, opts.via, to, k) : camAt(from, to, k);
          camPlace(U.cam.x, U.cam.y, U.cam.z); draw();
          U.camRaf = k < 1 ? requestAnimationFrame(tick) : null;
        };
        U.camRaf = requestAnimationFrame(tick);
      } catch { /* the camera never breaks combat */ }
    }
    function followActor(d) {
      const u = U.s?.actors?.[d.actor], to = followTarget(u, d.actor === controlledId(U.s) && !params.autoplay);
      if (to) camGoto(to.x, to.y, to.z, FOLLOW.easeMs);
    }
    // After an action: movement is tracked along its path; an action on another unit frames both, holds, then returns to the actor.
    function followAction(a, before, logFrom = 0) {
      try {
        if (!U.follow || U.followPaused || !U.s) return;
        if (U.closeup) { clearTimeout(U.followHoldT); U.followHoldT = null; U.followAfter = { a, before, logFrom }; return; }   // an armed hold must not fire under the pop-up   // the attack close-up holds the camera still; the framing happens when it closes
        U.followAfter = null;
        const was = before.actors[a.actor], now = U.s.actors[a.actor];
        if (["move", "jump", "climb"].includes(a.type) && followable(was) && followable(now)) {
          const len = Math.abs(now.x - was.x) + Math.abs(now.y - was.y), ms = Math.max(FOLLOW.easeMs, Math.min(900, len * FOLLOW.trackMsPerTile));
          const ev = U.s.log.slice(logFrom).reverse().find((e) => e.actor === a.actor && ["move", "jump", "climb"].includes(e.kind) && Array.isArray(e.path)), via = (ev?.path || []).map(([x, y]) => ({ x, y })).filter((q) => camOk(q.x, q.y));
          camGoto(now.x, now.y, followTarget(now, a.actor === controlledId(U.s)).z, ms, { via }); U.followHoldT = null; return;
        }
        const tgt = typeof a.target === "string" ? U.s.actors[a.target] : Array.isArray(a.target) && a.target.length >= 2 ? { x: +a.target[0], y: +a.target[1], tile: true } : null;   // a unit, or the tile an attack was aimed at
        if (!tgt || tgt.id === a.actor || (tgt.tile && tgt.x === now?.x && tgt.y === now?.y) || !followable(now) || !followable(tgt) || !camOk(tgt.x, tgt.y)) return;
        const fr = framePair(now, tgt, { W: geo.W, H: geo.H, fit: geo.fit });
        camGoto(fr.x, fr.y, fr.z, FOLLOW.easeMs);
        clearTimeout(U.followHoldT); U.followHoldT = null;
        if (!(U.fullAnimation && !params.fast)) return;   // no animation: the camera jumps to the frame and the next decision moves it on at once; no hold to wait out
        U.followHoldT = setTimeout(() => { U.followHoldT = null; if (U.destroyed || !U.follow || U.followPaused || !U.s) return; const d = E.decider(U.s); if (d) { U.followForce = true; followDecider(d); } }, FOLLOW.holdMs * paceMul);
      } catch { /* the camera never breaks combat */ }
    }
    function manualCam() {   // the player took the camera: follow pauses until the next decision starts
      cancelAnimationFrame(U.camRaf); U.camRaf = null; U.followAfter = null;   // a Center ease in flight stops too
      if (!U.follow || U.followPaused) return;
      U.followPaused = true; cancelAnimationFrame(U.camRaf); U.camRaf = null; clearTimeout(U.followHoldT); U.followHoldT = null; U.cam = null; syncFollowBar();
    }
    function syncFollowBar() {
      const b = $("ccFollow"), c = $("ccFollowPaused"); if (!b || !c) return;
      b.textContent = `Follow: ${U.follow ? "On" : "Off"}`; b.setAttribute("aria-pressed", String(!!U.follow)); c.hidden = !(U.follow && U.followPaused);
    }
    function setFollow(on) {
      U.follow = !!on; store.set("loci:combat:follow", U.follow); U.followPaused = false; U.cam = null; U.followAfter = null;
      cancelAnimationFrame(U.camRaf); U.camRaf = null; clearTimeout(U.followHoldT); U.followHoldT = null;
      if (U.s && geo.W) {
        if (U.follow) { const d = E.decider(U.s); if (d) { U.followForce = true; followDecider(d); } }
        else { U.zoom = clampZoom(+store.get("loci:combat:zoom", 1) || 1); U.panX = 0; U.panY = 0; layout(); syncZoomBar(); draw(); }   // off: the board is as the zoom buttons left it
      }
      syncFollowBar();
    }
    // ---- Center: the camera back to your character (Mala, 2026-10-31) ----
    const centreUnit = () => { if (!U.s || params.autoplay) return null; const u = controlledFighter(U.s); return u && followable(u) ? u : null; };
    function syncCenter() {
      const b = $("ccCenter"); if (!b) return;
      const why = !U.s ? "" : params.autoplay ? "Nobody is playing: there is no character of yours to centre on." : !centreUnit() ? "Your character is not on the board, so there is nothing to centre on." : U.closeup ? "Wait for the attack close-up to close." : "";
      b.disabled = !!why; b.title = why || "Centre the camera on your character (C)";
    }
    function centreCam() {
      const u = centreUnit(); if (!u || U.closeup || !geo.W) return;
      if (U.follow && U.s.order?.[U.s.turnIndex] === controlledId(U.s)) { U.followPaused = false; syncFollowBar(); followActor({ actor: u.id }); return; }   // Follow on, your turn: the planning close-up again, and a pause from moving the camera ends
      if (U.follow && U.followPaused) {   // Follow on, paused by moving the camera by hand: Center ends the pause and puts the camera on you; the next decision moves it on
        cancelAnimationFrame(U.camRaf); U.camRaf = null; U.followPaused = false; syncFollowBar();
        camGoto(u.x, u.y, U.zoom, FOLLOW.easeMs, { free: true }); return;
      }
      manualCam();   // Follow on and running: Center is a manual camera move, so Follow pauses with its chip. Follow OFF (toggled by the player): Follow stays off, nothing resumes
      camGoto(u.x, u.y, U.zoom, FOLLOW.easeMs, { free: true });
    }
    function facingPoint(state, target) {
      if (Array.isArray(target) && target.length >= 2 && Number.isFinite(+target[0]) && Number.isFinite(+target[1])) return [+target[0], +target[1]];
      const actor = typeof target === "string" ? state?.actors?.[target] || state?.wild?.find((m) => m.id === target) : target;
      return actor && Number.isFinite(+actor.x) && Number.isFinite(+actor.y) ? [+actor.x, +actor.y] : null;
    }
    function fxDetails(state, ability, actorId, aim, tiles, events = []) {
      const details = {};
      const line = Array.isArray(tiles) ? tiles : [];
      const covers = line.slice(1, -1).filter(([x, y]) => {
        const tile = E.geometry.tileAt(state, x, y), barrier = E.geometry.barrierAt(state, x, y);
        const object = state.arena.objects?.find(o => o.x === x && o.y === y);
        return Math.max(tile?.cover || 0, barrier?.coverFraction || 0, object?.cover || 0) > 0;
      }).filter(p => aim && Math.abs(p[0] - aim[0]) + Math.abs(p[1] - aim[1]) === 1);
      if (ability === "longView") details.cover = covers;
      if (ability === "sieveVerdict") {
        const targetId = Object.values(state.actors).find(a => !a.defeated && aim && a.x === aim[0] && a.y === aim[1])?.id;
        const target = targetId && state.actors[targetId];
        const layers = [];
        if (target?.status?.guard) layers.push("guard");
        if (target?.status?.membrane) layers.push("membrane");
        if (covers.length) layers.push("cover");
        if (layers.length) {
          details.layers = layers;
          const why = (events || []).flatMap(e => e.why || []).join(" ").toLowerCase();
          details.aimed = layers.find(id => why.includes(id)) || layers[0];
        }
      }
      if (ability === "undividedAttention") {
        const targetId = Object.values(state.actors).find(a => !a.defeated && aim && a.x === aim[0] && a.y === aim[1])?.id;
        details.others = [
          ...Object.values(state.actors).filter(a => !a.defeated && a.id !== actorId && a.id !== targetId).map(a => [a.x, a.y]),
          ...(state.wild || []).filter(a => !a.defeated).map(a => [a.x, a.y]),
        ];
      }
      return details;
    }
    function liveAgentMode() { return U.llmSettings.provider === "agent" || U.llmConnection?.fallback === "pause"; }
    function renderAgentControls() {
      const panel = $("ccAgentControls");
      panel.hidden = !U.agentSessionUsed || !U.s || !!U.s.outcome || U.mode === "setup";
      if (panel.hidden) return;
      if (!U.agentStatusTimer) U.agentStatusTimer = setInterval(() => { if (!U.destroyed) renderAgentControls(); }, 1000);
      const name = U.s.actors[U.llmActorId]?.name || "opponent";
      $("ccAgentStatus").textContent = U.llmPaused ? `Agent paused · ${U.llmError}` : !U.llmEnabled
        ? "Built-in AI has control" : !U.llmReady ? "Connecting live agent…" : U.llmAbort
        ? `Waiting for agent · ${name} · ${Math.max(0, Math.ceil((U.llmDeadline - Date.now()) / 1000))}s`
        : `Live agent controls ${name}`;
      $("ccAgentReconnect").hidden = U.llmEnabled && !U.llmPaused;
      $("ccAgentBuiltin").disabled = !U.llmEnabled;
      const command = U.llmConnection?.command || "";
      $("ccAgentConnection").hidden = !command;
      if ($("ccAgentCommand").value !== command) $("ccAgentCommand").value = command;
      $("ccAgentCopy").disabled = !command;
    }
    function pauseAgent(error) {
      U.llmPaused = true; U.llmFailed = true; U.llmAbort = null;
      U.llmError = /timed out/i.test(error?.message || "") ? "No reply arrived in time" : error?.message || "Connection unavailable";
      recordDiagnostic("Live agent paused; waiting for your choice", error, U.llmActorId);
      U.mode = "wait"; render();
    }
    function connectSocketOpponent() {
      stopAi();
      const epoch = ++U.llmEpoch, settings = { ...U.llmSettings };
      U.llmEnabled = true; U.llmReady = false; U.llmPaused = false; U.llmFailed = false; U.llmError = ""; U.llmConnection = null;
      U.agentSessionUsed ||= settings.provider === "agent";
      if (settings.provider === "agent" && !U.llmActorId) U.llmActorId = U.s.order.find(id => U.s.actors[id]?.side === "enemy") || null;
      U.llmStartPromise = Promise.resolve().then(() => {
        if (epoch !== U.llmEpoch || U.destroyed || !U.llmEnabled) return null;
        return opts.llmBridge.start(settings);
      }).then(result => {
        if (epoch !== U.llmEpoch || U.destroyed || !U.llmEnabled) return;
        if (!result?.url || !result?.token) throw new Error(result?.error || "Local socket bridge did not start.");
        U.llmConnection = result;
        if (settings.provider === "agent") {
          if (!U.llmActorId) throw new Error("This battle has no enemy for the live agent.");
          U.llmConnection = { ...result, actorId: U.llmActorId, fallback: "pause" };
          $("ccAgentConnection").open = true;
        }
      }).catch(error => {
        if (epoch !== U.llmEpoch || U.destroyed || !U.llmEnabled) return;
        if (settings.provider === "agent") pauseAgent(error);
        else { U.llmFailed = true; recordDiagnostic("Socket opponent unavailable; using built-in AI", error); flashTip("Socket opponent unavailable · built-in AI taking over"); }
      }).finally(() => {
        if (epoch !== U.llmEpoch || U.destroyed) return;
        U.llmReady = true; renderAgentControls();
      });
      renderAgentControls();
      return U.llmStartPromise;
    }
    function useBuiltinAI() {
      ++U.llmEpoch; stopAi(); U.llmEnabled = false; U.llmPaused = false; U.llmConnection = null; U.llmReady = true;
      Promise.resolve(opts.llmBridge?.stop?.()).catch(() => {});
      renderAgentControls();
      if (U.s && !U.s.outcome) pump();
    }
    $("ccAgentReconnect").onclick = () => { if (!U.s || U.s.outcome || U.destroyed) return; connectSocketOpponent(); pump(); };
    $("ccAgentBuiltin").onclick = useBuiltinAI;
    $("ccAgentCopy").onclick = async () => {
      try {
        if (opts.llmBridge?.copyCommand) { const result = await opts.llmBridge.copyCommand(); if (result?.error) throw new Error(result.error); }
        else await navigator.clipboard.writeText(U.llmConnection.command);
        flashTip("Agent command copied · paste it into your agent chat");
      } catch (_) { $("ccAgentCommand").select(); flashTip("Select the command and press ⌘C to copy"); }
    };
    const isSocketAI = (id) => U.llmEnabled && !U.llmFailed && !!U.llmConnection && U.s?.actors?.[id]?.side === "enemy" && (!U.llmConnection.actorId || U.llmConnection.actorId === id);
    // Teach mode. A card is queued when a speaking unit's turn starts (never more than one, never in the opening round, with a
    // gap between cards: teach.js rules) and shown by pump() once the action's own cutscenes and effects have played.
    function queueTeachCard(entries) {
      if (!TEACH || !U.teachMode || U.teachCard || !U.s || U.s.outcome || U.s.vignette) return;
      for (const e of entries) {
        if (e.kind !== "turn") continue;
        // Anyone who speaks may (Mala): enemies, allies, summons, bystanders. Not the player's own character, and not
        // the things with no voice: communed plants and dream creatures.
        const a = U.s.actors[e.actor]; if (!a || a.defeated || a.id === (U.s.modeSetup?.hero || "player") || a.dream || a.communed) continue;
        if (!TEACH.due({ seed: U.s.seed, round: U.s.round, actorId: a.id, last: U.teach.last })) continue;
        U.teachCard = TEACH.next({ seed: U.s.seed, round: U.s.round, actor: { id: a.id, name: a.name, sprite: a.sprite }, seen: U.teach.seen });
        if (U.teachCard) { U.teach.last = U.s.round; U.teach.seen.push(U.teachCard.id); }
        return;
      }
    }
    function showTeachCard() {
      const card = U.teachCard; if (!card) return false;
      stopAi(); const back = U.mode; U.mode = "teach";
      const ov = $("ccOverlay"); ov.hidden = false;
      const face = faceFile(card.sprite, card.kind === "inquiry" ? "thinking" : "speaking");
      const portrait = face ? `<img class="cc-teach-portrait" src="${face}" alt="${esc(card.speakerName || "")}">` : card.sprite ? spriteImg(card.sprite, card.speakerName, "cc-teach-portrait") : "";
      const done = () => { ov.hidden = true; ov.innerHTML = ""; U.teachCard = null; U.mode = back === "teach" ? "wait" : back; render(); pump(); };
      const shell = (kicker, body) => `<div class="cc-card cc-teach is-${card.kind}" role="dialog" aria-label="${kicker}" tabindex="-1"><header><small>${kicker}</small><span class="cc-spacer"></span><small class="cc-muted">Teach mode</small></header>
        <div class="cc-teach-row">${portrait}<div class="cc-teach-body">${body}</div></div></div>`;
      if (card.kind === "wisdom") {
        U.teach.wisdom++;
        ov.innerHTML = shell("WISDOM", `<p class="cc-teach-lead">${esc(card.lead)}</p><blockquote>${esc(card.text)}</blockquote><p class="cc-teach-by">${esc(card.author)}${card.source ? ` · <i>${esc(card.source)}</i>` : ""}</p>
          <div class="cc-row"><button type="button" class="cc-primary" id="ccTeachGo">Fight on ▶ <kbd>Enter</kbd></button></div>`);
        $("ccTeachGo").onclick = done; $("ccTeachGo").focus();
      } else {
        ov.innerHTML = shell("INQUIRY", `<p class="cc-teach-lead">${esc(card.lead)}</p><p class="cc-teach-q">${esc(card.prompt)}</p>
          <div class="cc-teach-choices">${card.choices.map((c, i) => `<button type="button" class="cc-item" data-teach="${i}">${esc(c)}</button>`).join("")}</div>
          <div id="ccTeachAfter" hidden></div><p class="cc-muted">${esc(card.topic)} · answering changes nothing in the fight.</p>`);
        ov.querySelectorAll("[data-teach]").forEach((b) => b.onclick = () => {
          const r = TEACH.answer(card, +b.dataset.teach); U.teach.asked++; if (r.correct) U.teach.right++;
          ov.querySelectorAll("[data-teach]").forEach((x) => { x.disabled = true; x.classList.toggle("is-right", +x.dataset.teach === card.answer); x.classList.toggle("is-wrong", x === b && !r.correct); });
          const after = $("ccTeachAfter"); after.hidden = false;
          after.innerHTML = `<p class="cc-teach-verdict ${r.correct ? "ok" : "no"}">${r.correct ? `${esc(card.speakerName)} nods. Correct.` : `${esc(card.speakerName)} shakes their head. It was ${esc(r.right)}.`}</p><p>${esc(r.explain)}</p>
            ${card.art ? `<img class="cc-lex-art" alt="Teaching strip" src="${card.art}">` : ""}<div class="cc-row"><button type="button" class="cc-primary" id="ccTeachGo">Fight on ▶ <kbd>Enter</kbd></button></div>`;
          $("ccTeachGo").onclick = done; $("ccTeachGo").focus();
        });
        ov.querySelector("[data-teach]")?.focus();
      }
      return true;
    }
    // Only a paid summon order is watched. Player decisions, defensive responses and reading
    // overlays remain explicit pauses. A lost timer must not strand the summon on its turn.
    function watchOrderedSummon() {
      if (U.destroyed) return;
      U.ultWatchTimer = setTimeout(watchOrderedSummon, 1000);
      const s = U.s, a = s?.actors?.[s.order[s.turnIndex]];
      if (!s || s.outcome || s.phase !== "action" || !a?.summon?.order || a.summon.ultimateUsed || a.defeated
        || U.narrationHold || U.closeup || U.teachCard || U.mode === "teach" || U.llmAbort || U.llmPaused
        || (U.fxPlayer?.blocking(performance.now()) || 0) > 0) return;
      if (performance.now() - (U.lastPumpAt || 0) < 4000) return;
      recordDiagnostic("Resuming a stalled ordered summon turn", "The paid order still awaits its turn-start resolution.", a.id);
      try { pump(); } catch (error) { recordDiagnostic("Ordered summon turn recovery failed", error, a.id); }
    }
    U.ultWatchTimer = setTimeout(watchOrderedSummon, 1000);
    function pump() {
      if (U.s?.outcome && U.account?.stakeEscrow && !U.account.stakeEscrow.outcome) { U.account = { ...U.account, stakeEscrow: { ...U.account.stakeEscrow, outcome: U.s.outcome.winner || "none" } }; saveAccount(); }   // decided: a quick exit before the results screen still settles by this
      U.lastPumpAt = performance.now();
      if (U.narrationHold) return;
      stopAi();
      if(U.closeup && !Number.isFinite(U.closeup.until)){const elapsed=performance.now()-U.closeup.started,end=U.closeup.ends.find(t=>t>elapsed);U.mode="wait";if(Number.isFinite(end))U.timer=setTimeout(()=>{U.timer=null;pump();},Math.max(16,end-elapsed+16));return;}
      if(U.closeup) { if(performance.now()>=U.closeup.until){closeAttackPopup();return;} U.mode="wait"; U.timer=setTimeout(()=>{U.timer=null;pump();},Math.max(16,U.closeup.until-performance.now()));return; }
      const fxWait=U.fxPlayer?.blocking(performance.now())||0;
      if(fxWait>0){
        // Presentation is allowed to pause combat briefly, never indefinitely.
        // A malformed effect duration used to be able to keep an AI turn parked.
        if (!Number.isFinite(fxWait) || fxWait > 2200 * paceMul) {
          console.warn("Combat presentation exceeded its turn-wait limit; skipping queued effects.", fxWait);
          U.fxPlayer?.skip?.();
        } else {
          U.mode="wait";
          try { render(); } catch (error) { console.error("Combat redraw failed during effect wait.", error); recordDiagnostic("Combat redraw failed during effect wait",error); }
          U.timer=setTimeout(()=>{U.timer=null;pump();},fxWait);
          return;
        }
      }
      if (U.reading) { if (!U.readTimer) startReading(); return; }   // a pump from elsewhere never advances a wait already running
      if (U.s.outcome) return finish();
      if (U.theme && !U.themeMidShown && (THB?.midDue(U.theme, U.s) || SCN?.midDue(U.theme, U.s))) { U.themeMidShown = true; return openNarration("mid", () => pump()); }   // themed battle: its one mid-fight beat
      if (U.s.law && U.s.law.dispatch && (U.s.law.dispatch.pending || U.s.law.dispatch.autoArrived) && !U.dispatchPlayed) { U.dispatchPlayed = true; return playDispatch(() => pump()); }   // dispatch cutscene: three beats, then boots on the ground
      if (U.teachCard && showTeachCard()) return;   // Teach mode: the fight waits for the card
      const d = E.decider(U.s);
      followDecider(d);
      if (isAi(d.actor)) {
        if (U.llmPaused && (!U.llmActorId || U.llmActorId === d.actor)) { U.mode = "wait"; render(); return; }
        if (U.llmEnabled && !U.llmReady) {
          U.mode = "wait"; render();
          U.llmStartPromise?.then(() => { if (!U.destroyed && !U.s.outcome) pump(); });
          return;
        }
        U.mode = "wait"; render();
        U.timer = setTimeout(() => {
          U.timer = null;
          if (U.s.outcome) return pump();
          const current = E.decider(U.s);
          if (!current || !isAi(current.actor)) return pump();
          const decision = LLM?.requestFor && isSocketAI(current.actor)
            ? LLM.requestFor(E, U.s, { battleId: U.llmBattleId, seq: ++U.llmSeq }) : null;
          if (decision) {
            const controller = new AbortController(); U.llmAbort = controller;
            U.llmDeadline = Date.now() + (U.llmConnection.timeoutMs || 12000); renderAgentControls();
            Promise.resolve(U.llmStartPromise).then(() => ConceptCombatLLMSocket.requestAction({
              url: U.llmConnection.url, token: U.llmConnection.token, request: decision, signal: controller.signal,
              timeoutMs: U.llmConnection.timeoutMs || 12000,
              currentDecisionId: () => { const d = E.decider(U.s); return d && d.actor === current.actor ? LLM.buildStateView(E, U.s, current.actor, { battleId: U.llmBattleId }).decisionId : "stale"; }
            })).then((choice) => {
              if (controller.signal.aborted || U.s.outcome || E.decider(U.s)?.actor !== current.actor) return;
              U.llmAbort = null;
              if (!act(choice)) { if (liveAgentMode()) pauseAgent(new Error("The selected action is no longer legal.")); else runBuiltinAI(current.actor); }
            }).catch((error) => {
              if (controller.signal.aborted) return;
              if (liveAgentMode()) { pauseAgent(error); return; }
              console.warn("Socket test opponent failed validation/transport; using built-in AI.", error); recordDiagnostic("Socket opponent failed validation/transport",error,current.actor);
              U.llmFailed = true; U.llmConnection = null; U.llmAbort = null;
              Promise.resolve(opts.llmBridge.stop?.()).catch(() => {});
              flashTip("Socket opponent disconnected · built-in AI taking over");
              runBuiltinAI(current.actor);
            });
            return;
          }
          if (isSocketAI(current.actor) && liveAgentMode()) { pauseAgent(new Error("No supported legal decision is available.")); return; }
          runBuiltinAI(current.actor);
        }, params.fast ? 0 : 650);
      } else {
        U.mode = d.kind === "mind" ? "mind" : d.kind === "response" ? "response" : (U.mode === "move" || U.mode === "target" ? U.mode : "menu");
        render();
      }
    }
    function runBuiltinAI(actor) {
      if (U.s.outcome || E.decider(U.s)?.actor !== actor) return pump();
      const beforeActions = U.actions.length;
      let action = null;
      try {
        if (decisionInspector?.recording) {
          const draft = decisionInspector.prepare(U.s, C);
          const inspected = E.inspectAiAction(U.s);
          action = inspected.action;
          try { pendingInspectedDecision = decisionInspector.add(inspected, {round: U.s.round, actor}, draft, U.s); }
          catch (error) { console.warn("Emissary display failed; continuing the selected action.", error); }
        } else action = E.aiAction(U.s);
        if (action && act(action)) return;
      } catch (error) {
        console.error("NPC action failed; keeping the battle scheduler alive.", actor, error); recordDiagnostic("NPC action failed; recovering decision",error,actor,action);
        // act() may have applied the engine action before a presentation hook
        // failed. In that case keep the new state and resume from its decider.
        if (U.actions.length > beforeActions) {
          U.mode = "menu";
          try { render(); } catch (renderError) { console.error("Battle redraw failed after NPC action.", renderError); recordDiagnostic("Battle redraw failed after NPC action.",renderError,actor); }
          return pump();
        }
        U.s.log.push({ round: U.s.round, kind: "system", text: `${U.s.actors[actor]?.name || "An NPC"}'s action hit an error; passing its turn so combat can continue.` });
      }
      pendingInspectedDecision = null;
      if(action?.type==="ability") U.s=E.aiFailure(U.s,action);
      console.warn("AI action unavailable or rejected; safely closing its decision window.", actor, action); recordDiagnostic("AI action unavailable or rejected",action ? `Rejected ${action.type}${action.ability ? ": "+action.ability : ""}` : "AI produced no action",actor,action);
      const decision = E.decider(U.s);
      if (!decision || decision.actor !== actor) {
        U.mode = "menu";
        try { render(); } catch (error) { console.error("Battle redraw failed after NPC turn changed.", error); recordDiagnostic("Battle redraw failed after NPC turn changed.",error,actor); }
        return pump();
      }
      // A failed reaction must still close with a legal response; ordinary NPC
      // turns pass cleanly. This fallback prevents an unusable AI turn from
      // leaving all player controls disabled forever.
      const fallback = decision.kind === "response"
        ? { type: "respond", actor, response: "none" }
        : { type: "end", actor };
      try { if (act(fallback)) return; }
      catch (error) {
        console.error("NPC fallback presentation failed; applying its engine action directly.", actor, error); recordDiagnostic("NPC fallback presentation failed",error,actor,fallback);
        if (U.actions.length > beforeActions || E.decider(U.s)?.actor !== actor) {
          try { render(); } catch (renderError) { console.error("Battle redraw failed after NPC fallback.", renderError); recordDiagnostic("Battle redraw failed after NPC fallback.",renderError,actor); }
          return pump();
        }
      }
      // Keep a pure-engine escape hatch: an animation, save, or cue failure in
      // act() must not strand a legal pass/reaction response behind dead UI.
      try {
        const recovered = E.apply(U.s, fallback);
        if (recovered.ok) {
          U.s = recovered.state; U.actions.push(fallback); U.mode = modeAfterEngineAction(U.s);
          store.set(LAST_KEY, { setup: U.setupOpts, actions: U.actions });
          try { render(); } catch (renderError) { console.error("Battle redraw failed after direct NPC recovery.", renderError); recordDiagnostic("Battle redraw failed after direct NPC recovery.",renderError,actor); }
          return pump();
        }
        recordDiagnostic("Direct NPC recovery rejected",recovered.error,actor,fallback);
      } catch (error) { console.error("Direct NPC recovery failed.", actor, error); recordDiagnostic("Direct NPC recovery failed",error,actor,fallback); }
      U.s.log.push({ round: U.s.round, kind: "system", text: `${U.s.actors[actor]?.name || "An NPC"}'s turn could not advance automatically. The battle remains available for recovery.` });
      U.mode = decision.kind === "response" ? "response" : "menu";
      try { render(); } catch (error) { console.error("Battle redraw failed after NPC fallback.", error); recordDiagnostic("Battle redraw failed after NPC fallback.",error,actor); }
    }
    // Slow pace: reveal an AI action's log lines one by one across a reading gap sized to its text (18 characters a second, 1.2 to 6 s
    // for the whole action), then let the turn go on. skipReading advances the line on screen at once; the last skip ends the wait.
    function startReading() {
      const r = U.reading; if (!r) return pump();
      U.mode = "wait";
      if (r.i >= r.lines.length) { U.reading = null; U.logCap = null; U.readTimer = null; renderLog(); return pump(); }
      const line = r.lines[r.i++]; U.logCap = line.upto; renderLog();
      const gap = readingGapMs(r.total) * line.len / r.total;
      clearTimeout(U.readTimer); U.readTimer = setTimeout(() => { U.readTimer = null; startReading(); }, gap);
    }
    function skipReading(all) {
      const r = U.reading; if (!r) return;
      clearTimeout(U.readTimer); U.readTimer = null;
      if (all) r.i = r.lines.length;
      startReading();
    }
    function stopAi() { if (U.timer) clearTimeout(U.timer); U.timer = null; U.llmAbort?.abort(); U.llmAbort = null; }

    function showDialogueFrom(from) {
      if (!voice || !U.dialogueOn || !U.s) return;
      const now = performance.now();
      U.bubbles = U.bubbles.filter((b) => b.until > now);
      for (const line of voice.lines(U.s, { from, to: U.s.log.length }))
        U.bubbles.push({ ...line, until: now + 2500 });
      if (U.bubbles.length) animate();
    }

    // ── isometric board (terrain/iso-view.js) ─────────────────────────────
    // An opt-in second camera for an arena that has a sculpted scene. Presentation only: the engine is never asked
    // anything different. The flat board draws each thing as it comes; an isometric one has to sort, so ground
    // drawings join the scene's depth order and upright ones (fighters, plants, walls, pickups) are drawn back to
    // front with whatever stands before them put back on top. onGround and upright are the two doors into that: on
    // the flat board they simply draw. tileDraw draws now, laid onto the tile.
    let isoCam = null, isoQueue = null, dressingDrawn = 0, groundDrawn = 0, astralFloorsDrawn = 0, shelfTexture = null;   // draw counters for checks (duelUI.board)
    // Edge dressing (map-dressing.js): buildings, trees and ruins on the far ring outside the play area, drawn after the
    // sky and before the board, so the board paints over any overlap and no piece can hide a fighter. Scenery only.
    const dressingCache = new Map();
    const shelfPatterns = new WeakMap();   // one canvas pattern per texture image, not one a frame
    const dressingFor = (arena) => { const key = `${arena.id || arena.name}|${arena.visual?.seed ?? ""}`; if (!dressingCache.has(key)) dressingCache.set(key, MAPD ? MAPD.dressing(arena) : []); return dressingCache.get(key); };
    function drawDressing(cam) {
      const items = dressingFor(U.s.arena); if (!items.length) return;
      // A ground shelf behind the board's far edges, so the pieces stand on land instead of hanging in the sky.
      const A = U.s.arena, W = A.landW ?? A.w, H = A.h, pal = A.visual?.palette || {}, z = -0.3;
      const turf = pal.turf || "#719a4c", soil = pal.soil || "#7a5638";
      // One solid L-shaped shelf (Mala, 2026-10-27: "the ground could be more contiguous underneath the buildings"): no fade
      // to the sky, reaching past every slot (slots sit within 1.5 tiles of the far edges; pieces span up to ~2.5), with a
      // slab edge on the two open ends so it reads as one piece of land like the board's own sides.
      const O = -3.4, EW = W + 2.4, EH = H + 2.4, P = (x, y, zz = z) => cam.project([x, y, zz]), drop = z - 0.55;
      const poly = (pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); };
      g.save();
      poly([P(O, O), P(EW, O), P(EW, 0), P(0, 0), P(0, EH), P(O, EH)], turf);   // the shelf top
      // ...textured like the apron (Mala, 2026-10-27: "i thought you fixed the graphics for the L-piece with the grass and
      // concrete I gave you"): her grass on green maps, weathered concrete on courts and stone maps, laid on the ground plane
      // (the projection is affine at a fixed height) and dimmed a little, as land you cannot walk on.
      const shelf = ISO?.surface?.("apron", {});
      if (shelf?.img?.naturalWidth) {
        const o = P(0, 0), ex = P(1, 0), ey = P(0, 1), k = shelf.tiles / shelf.img.naturalWidth;
        g.save(); g.beginPath(); [P(O, O), P(EW, O), P(EW, 0), P(0, 0), P(0, EH), P(O, EH)].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
        g.transform(ex[0] - o[0], ex[1] - o[1], ey[0] - o[0], ey[1] - o[1], o[0], o[1]);   // world tile units from here on
        g.scale(k, k); if (!shelfPatterns.has(shelf.img)) shelfPatterns.set(shelf.img, g.createPattern(shelf.img, "repeat")); g.fillStyle = shelfPatterns.get(shelf.img); g.fillRect(O / k, O / k, (EW - O) / k, (EH - O) / k);
        g.restore();
        poly([P(O, O), P(EW, O), P(EW, 0), P(0, 0), P(0, EH), P(O, EH)], "rgba(13,18,8,0.3)");   // the apron's dimming
        shelfTexture = shelf.img.src.split("/").pop();
      }
      poly([P(0, -0.45), P(EW, -0.45), P(EW, 0), P(0, 0)], soil); poly([P(-0.45, 0), P(0, 0), P(0, EH), P(-0.45, EH)], soil);   // a soil verge along the board, like a walk
      poly([P(EW, O), P(EW, 0), P(EW, 0, drop), P(EW, O, drop)], "#3e3526");   // slab edge, north arm's open end
      poly([P(O, EH), P(0, EH), P(0, EH, drop), P(O, EH, drop)], "#4a3f2d");   // slab edge, west arm's open end
      g.restore();
      for (const d of items.slice().sort((a, b) => cam.near(a.x, a.y) - cam.near(b.x, b.y))) {
        const img = worldSprite(d.group, d.id); if (!img) continue;
        const [fx, fy] = cam.project([d.x + 0.5, d.y + 0.5, z]), w = d.size * cam.tw * 0.85, h = w * img.naturalHeight / img.naturalWidth;
        if (fy - h * 0.9 < -h * 0.35) continue;   // mostly off the top of the canvas: leave it out rather than cut it
        g.drawImage(img, fx - w / 2, fy - h * 0.9, w, h); dressingDrawn++;
      }
    }
    // The astral pocket on the flat board: astral architecture in the sky above it and beside it, behind the tiles.
    function drawAstralDressing() {
      const A = U.s.astral, last = A.x0 + A.w - 1, items = MAPD ? MAPD.astralDressing(A.w, U.s.arena.h, U.s.seed || 0) : []; if (!items.length) return;
      const [lx, ty] = tileXY(A.x0, 0), [rx] = tileXY(last, 0), [, by] = tileXY(last, U.s.arena.h - 1), tw = geo.tw;
      for (const d of items) {
        const img = worldSprite(d.group, d.id); if (!img) continue;
        const w = Math.min(d.size * tw * 0.8, Math.max(tw * 0.6, ty * 1.3)), h = w * img.naturalHeight / img.naturalWidth;
        if (d.slot === "top") g.drawImage(img, lx + (rx + tw - lx) * d.t - w / 2, ty + geo.th * 0.4 - h, w, h);
        else g.drawImage(img, rx + tw + 4, ty + (by - ty) * d.t, Math.min(w, geo.W - rx - tw - 8), h * Math.min(w, geo.W - rx - tw - 8) / w);
        dressingDrawn++;
      }
    }
    U.isoView = !!(params.iso ?? store.get("loci:combat:iso-view", false)); U.isoCutaway = !!store.get("loci:combat:iso-cutaway", false);
    const isoOn = () => !!(ISO && U.isoView && U.s && ISO.supports(U.s.arena));
    function isoSync() {
      if (!isoOn()) return (isoCam = null);
      const snap = ISO.snapshot(U.s.arena, { surfaceAt: (x, y) => E.geometry.surfaceAt(U.s, x, y), heightAt: (x, y) => E.geometry.heightAt(U.s, x, y) });   // the terrain as it stands now
      const viewOpts = () => ({ width: geo.W, height: geo.H, lighting: U.s.time?.phase === "night" ? "night" : "day", cutaway: U.isoCutaway, zoom: U.zoom, panX: U.panX, panY: U.panY });
      isoCam = ISO.view(snap, viewOpts());
      // Keep the framed scene reachable: its centre stays within a margin of the canvas.
      const [fcx, fcy] = isoCam.frameC, cx = Math.max(-100 - fcx, Math.min(geo.W + 100 - fcx, U.panX)), cy = Math.max(-100 - fcy, Math.min(geo.H + 100 - fcy, U.panY));
      if (cx !== U.panX || cy !== U.panY) { U.panX = cx; U.panY = cy; isoCam = ISO.view(snap, viewOpts()); }
      return isoCam;
    }
    const tileDraw = (x, y, fn) => { const [px, py] = tileXY(x, y); return isoCam ? isoCam.tile(g, x, y, [px, py, geo.tw, geo.th], fn) : fn(px, py); };
    const onGround = (x, y, fn, flat = true) => { if (!isoQueue) return fn(...tileXY(x, y)); isoQueue.ground.push({ x, y, draw: () => flat ? tileDraw(x, y, fn) : fn(...tileXY(x, y)) }); };
    const across = (p) => isoCam && p ? [p[0] - p[1], p[1]] : p;   // which way is right on screen: x on the flat board, x minus y on this diagonal
    const upright = (x, y, fn, reach) => { if (!isoQueue) return fn(); isoQueue.bills.push({ x, y, fn, w: 0.8, up: 1.3, ...reach }); };
    function isoFlush(cam, last) {
      const queue = isoQueue; isoQueue = null;                                    // from here on everything draws at once
      cam.paint(g, queue.ground);
      const flatGeo = geo; geo = { ...geo, tw: cam.ring[0], th: cam.ring[1] }; drawAuras(U.s, unseen); geo = flatGeo;   // a ring of tiles is this ellipse on the ground
      const ghosts = [];
      for (const b of queue.bills.map((b, i) => ({ ...b, i, near: cam.near(b.x, b.y) })).sort((p, q) => p.near - q.near || p.i - q.i)) {
        const [cx, cy] = centre(...(b.at || [b.x, b.y])), box = [cx - geo.tw * b.w, cy - geo.tw * b.up, cx + geo.tw * b.w, cy + geo.th * 0.6];
        const drawn = b.fn(), hidden = cam.occlude(g, box, [b.x, b.y]);
        // A plant or object sprite in front of a fighter covers it the way a wall does: [x0, y0, x1, y1] of the art just drawn.
        if (b.cover && drawn) for (const f of ghosts) if (drawn[0] < f.body[2] && drawn[2] > f.body[0] && drawn[1] < f.body[3] && drawn[3] > f.body[1]) f.hidden.push([[drawn[0], drawn[1]], [drawn[2], drawn[1]], [drawn[2], drawn[3]], [drawn[0], drawn[3]]]);
        if (b.ghost) ghosts.push({ b, box, hidden, body: [cx - geo.tw * .3 * b.w / .8, cy - geo.tw * .75 * b.w / .8, cx + geo.tw * .3 * b.w / .8, cy + geo.th * .2] });
      }
      // Silhouette: a fighter behind a wall, a parapet or a crown shows through it as scanlines and keeps its bars.
      for (const { b, box, hidden } of ghosts) {
        if (!hidden.length) continue;
        g.save(); g.beginPath(); for (const pts of hidden) { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); } g.clip();
        g.beginPath(); for (let y = Math.floor(box[1]); y < box[3]; y += 3) g.rect(box[0], y, box[2] - box[0], 1.5); g.clip();
        b.fn(); g.restore(); b.ghost();
      }
      last();
    }
    function syncViewBar() {
      const can = !!(ISO && U.s && ISO.supports(U.s.arena));
      $("ccView").hidden = !can; $("ccIso").textContent = `View: ${U.isoView ? "Isometric" : "Flat"}`; $("ccIso").setAttribute("aria-pressed", String(!!U.isoView));
      $("ccIsoCut").hidden = !U.isoView; $("ccIsoCut").textContent = `Cutaway ${U.isoCutaway ? "On" : "Off"}`; $("ccIsoCut").setAttribute("aria-pressed", String(!!U.isoCutaway));
    }

    // ── geometry + drawing ────────────────────────────────────────────────
    // Battle-map zoom (Mala, 2026-10-22): wheel, drag-pan, buttons, +/−/0 keys, flat and isometric.
    // Everything draws and picks through geo (flat) or the iso camera (iso-view.js takes the same zoom
    // and pan), so zoom composes with targeting for free in both views.
    U.zoom = Math.max(0.5, Math.min(3, +store.get("loci:combat:zoom", 1) || 1));
    U.panX = 0; U.panY = 0; U.panArena = null;
    const clampZoom = (z) => Math.max(0.5, Math.min(3, z));
    // The astral pocket in its own tab (Mala, 2026-10-26: "is it possible to open up a tab in the astral plane? This same map
    // thing just seems like an aesthetic nightmare"). The engine keeps the pocket east behind the 64-column void (that
    // distance is the seal); the flat board shows one region at a time, World or Astral plane, and never draws the void.
    // The tab follows the turn (whoever acts, their region); a clicked tab holds until the next turn.
    const soulsOut = () => !!U.s?.astral?.ready && Object.values(U.s.actors).some((a) => a.soulOf && !a.defeated && !a.returned);
    const astralShown = () => (soulsOut() && !isoOn() ? U.s.astral : null);
    const turnKey = () => `${U.s.round}:${U.s.turnIndex}:${U.s.phase}`;
    function boardRegion() {
      const A = astralShown(); if (!A) return "land";
      if (U.boardTab && U.boardTabTurn === turnKey()) return U.boardTab;
      const who = U.s.actors[E.decider(U.s)?.actor];
      return who && who.x >= A.x0 ? "pocket" : "land";
    }
    function viewXY(x, y) {
      const A = astralShown();
      if (!A) return U.s?.astral?.ready && x >= U.s.astral.landW ? null : [x, y];   // the plane has collapsed (Mala, 2026-10-26): only the map is left
      if (boardRegion() === "pocket") return x >= A.x0 ? [x - A.x0, y] : null;
      return x < A.landW ? [x, y] : null;   // the void and the far region: not drawn, never picked
    }
    function syncBoardTabs() {
      const bar = $("ccBoardTabs"); if (!bar) return;
      const A = astralShown(); bar.hidden = !A; if (!A) return;
      const here = boardRegion();
      for (const b of bar.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.board === here));
    }
    function layout() {
      const box = cv.parentElement.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      const A = astralShown(), pocket = A && boardRegion() === "pocket";
      if (U.s && (pocket ? "pocket" : "land") !== U.lastRegion) { U.panX = 0; U.panY = 0; U.lastRegion = pocket ? "pocket" : "land"; }   // a tab switch starts centred
      const W = U.s ? (A ? (pocket ? A.w : A.landW) : U.s.astral?.ready ? U.s.astral.landW : U.s.arena.w) : 9, H = U.s ? U.s.arena.h : 5;
      if (U.s && U.s.arena.id !== U.panArena) { U.panX = 0; U.panY = 0; U.panArena = U.s.arena.id; }   // a new board starts centred
      const maxHeight = U.s ? Math.max(0, ...U.s.arena.height.flat(), ...U.s.barriers.map(b => E.geometry.heightAt(U.s, b.x, b.y))) : 0;
      const fit = Math.min((box.width - 24) / W, (box.height - 60) / (H * 0.66 + maxHeight * 0.22 + 0.4));
      const tw = Math.max(8, Math.floor(fit * U.zoom));
      const th = Math.round(tw * 0.6), lip = Math.round(tw * 0.1);
      cv.width = Math.round(box.width * dpr); cv.height = Math.round(box.height * dpr);
      cv.style.width = box.width + "px"; cv.style.height = box.height + "px";
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = false;
      const riseY = Math.round(tw * 0.22), boardH = th * H + maxHeight * riseY;
      const oxC = (box.width - tw * W) / 2, oyC = (box.height - boardH - lip) / 2 + maxHeight * riseY + tw * 0.25;
      // Keep at least a tile of board on screen: the pan can never lose the fight. (Iso clamps its own pan in isoSync.)
      if (!isoOn()) {
        U.panX = Math.max(tw - tw * W - oxC, Math.min(box.width - tw - oxC, U.panX));
        U.panY = Math.max(th - boardH - oyC, Math.min(box.height - th - oyC, U.panY));
      }
      geo = { fit, tw, th, lip, riseY, maxHeight, ox: Math.round(oxC + U.panX), oy: Math.round(oyC + U.panY), oxC, oyC, W: box.width, H: box.height };
      // The isometric board keeps tw as the sprite unit, so every upright drawing is sized the way it is on the flat one.
      isoCam = null;
      if (isoOn()) { const cam = isoSync(); geo = { ...geo, tw: cam.tw, th: cam.th, lip: 0, riseY: 0, iso: true }; }
    }
    const tileXY = (x, y) => { if (isoCam) { const [cx, cy] = isoCam.at(x, y); return [cx - geo.tw / 2, cy - geo.th / 2]; }
      const v = viewXY(x, y); if (!v) return [-1e6, -1e6];
      return [geo.ox + v[0] * geo.tw, geo.oy + v[1] * geo.th - (U.s ? E.geometry.heightAt(U.s, x, y) * geo.riseY : 0)]; };
    const centre = (x, y) => { const [px, py] = tileXY(x, y); return [px + geo.tw / 2, py + geo.th / 2]; };
    function zoomAt(mx, my, z) {
      if (!U.s) return;
      z = clampZoom(z); if (z === U.zoom) return;
      if (isoCam) {   // the isometric projection is linear in its origin, so the same anchor math holds in projection units
        const ax = (mx - isoCam.ox) / isoCam.scale, ay = (my - isoCam.oy) / isoCam.scale;
        U.zoom = z; store.set("loci:combat:zoom", z);
        layout();
        U.panX = mx - ax * isoCam.scale - isoCam.oxC; U.panY = my - ay * isoCam.scale - isoCam.oyC;
        layout(); syncZoomBar(); draw(); return;
      }
      const ax = (mx - geo.ox) / geo.tw, ay = (my - geo.oy) / geo.th;   // the board point under the cursor, in tiles
      U.zoom = z; store.set("loci:combat:zoom", z);
      layout();
      U.panX = mx - ax * geo.tw - geo.oxC; U.panY = my - ay * geo.th - geo.oyC;   // that point stays under the cursor
      layout(); syncZoomBar(); draw();
    }
    const zoomStep = (dir) => { if (!U.s || !geo.W) return; manualCam(); zoomAt(geo.W / 2, geo.H / 2, U.zoom * (dir > 0 ? 1.2 : 1 / 1.2)); };
    const zoomReset = () => { if (!U.s) return; manualCam(); U.panX = 0; U.panY = 0; U.zoom = 1; store.set("loci:combat:zoom", 1); layout(); syncZoomBar(); draw(); };
    function syncZoomBar() {
      const bar = $("ccZoom"); if (!bar) return;
      bar.hidden = !U.s;
      if (!U.s) return;
      $("ccZoomPct").textContent = `${Math.round(U.zoom * 100)}%`; syncCenter();
    }
    const artBoxes = new WeakMap();
    function artBox(img) {   // the non-transparent bounds of an image, measured once
      if (artBoxes.has(img)) return artBoxes.get(img);
      let box = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
      try {
        const c = document.createElement("canvas"); c.width = box.w; c.height = box.h;
        const cx2 = c.getContext("2d", { willReadFrequently: true }); cx2.drawImage(img, 0, 0);
        const d = cx2.getImageData(0, 0, box.w, box.h).data; let x0 = box.w, y0 = box.h, x1 = -1, y1 = -1;
        for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) if (d[(y * box.w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 >= x0) box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
      } catch (_) {}
      artBoxes.set(img, box); return box;
    }
    function drawPickupMarker(p, cx, cy, tw, th) {
      const style = pickupPresentation(p.item), r = Math.max(10, tw * 0.22);
      const art = worldSprite("items", p.item);
      if (art) {
        g.save(); g.shadowColor = style.color; g.shadowBlur = Math.max(5, tw * .13); g.fillStyle = `${style.color}33`;
        g.beginPath(); g.ellipse(cx, cy + th * .05, tw * .27, th * .22, 0, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
        // Item icons come padded (432px frames, art ~60%) or tightly cropped (~95%): scale the visible art, not the frame.
        const b = artBox(art), k = (tw * .6) / Math.max(b.w, b.h), dw = b.w * k, dh = b.h * k;
        g.imageSmoothingEnabled = false; g.drawImage(art, b.x, b.y, b.w, b.h, cx-dw/2, cy-dh+th*.12, dw, dh); g.restore();
        return;   // no name tag (Mala, 2026-10-25: "i dont think items need their names on them"); hovering the tile names it
      }
      g.save(); g.translate(cx, cy - th * 0.04);
      g.shadowColor = style.color; g.shadowBlur = Math.max(5, tw * 0.13);
      g.fillStyle = "#151822"; g.strokeStyle = style.color; g.lineWidth = Math.max(1.5, tw * 0.035);
      g.beginPath(); g.roundRect(-r, -r, r * 2, r * 2, Math.max(4, r * 0.38)); g.fill(); g.stroke(); g.shadowBlur = 0;
      g.strokeStyle = style.color; g.fillStyle = style.color; g.lineWidth = Math.max(1.5, tw * 0.035); g.lineCap = "round"; g.lineJoin = "round";
      if (style.mark === "drop") { g.beginPath(); g.moveTo(0,-r*.53); g.bezierCurveTo(r*.05,-r*.22,r*.48,r*.14,r*.4,r*.37); g.arc(0,r*.28,r*.4,0.2,Math.PI-.2); g.bezierCurveTo(-r*.47,r*.06,-r*.05,-r*.22,0,-r*.53); g.fill(); }
      else if (style.mark === "fruit") { g.beginPath(); g.arc(-r*.12,r*.12,r*.28,0,Math.PI*2); g.arc(r*.18,r*.12,r*.28,0,Math.PI*2); g.fill(); g.beginPath(); g.ellipse(r*.1,-r*.35,r*.23,r*.1,-.55,0,Math.PI*2); g.fill(); }
      else if (style.mark === "spark") { g.beginPath(); for(let i=0;i<8;i++){const a=-Math.PI/2+i*Math.PI/4,rr=i%2?r*.23:r*.55;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);} g.closePath(); g.fill(); }
      else if (style.mark === "rain") { g.beginPath(); g.moveTo(-r*.35,-r*.48); g.lineTo(r*.3,r*.48); g.stroke(); for(let i=0;i<2;i++){g.beginPath();g.arc(-r*.15+i*r*.35,0,r*.25,-.85,.85);g.stroke();} }
      else if (style.mark === "bottle") { g.beginPath(); g.roundRect(-r*.22,-r*.38,r*.44,r*.8,r*.08); g.fill(); g.fillRect(-r*.12,-r*.56,r*.24,r*.18); }
      else if (style.mark === "sound") { g.beginPath(); g.moveTo(-r*.45,-r*.18); g.lineTo(-r*.2,-r*.18); g.lineTo(r*.05,-r*.38); g.lineTo(r*.05,r*.38); g.lineTo(-r*.2,r*.18); g.lineTo(-r*.45,r*.18); g.closePath(); g.fill(); for(let i=0;i<2;i++){g.beginPath();g.arc(r*.05,0,r*(.28+i*.19),-.8,.8);g.stroke();} }
      g.restore();
    }
    function overlays() {
      const o = { fill: new Map(), ring: new Set(), path: null, line: null, marks: [] };
      const s = U.s; if (!s) return o;
      // committed delayed effects + announced areas are always visible
      for (const ev of s.scheduled) if (ev.inst.tiles) for (const t of ev.inst.tiles) o.marks.push({ at: t, kind: "delayed", who: s.actors[ev.trigger.actor].name });
      for (const c of s.corpses || []) o.marks.push({ at: [c.x, c.y], kind: "corpse" });   // ritual burial
      for (const t of miseView()) o.marks.push({ at: [t.x, t.y], kind: "mise", label: `${(s.actors[t.beneficiary]?.name || "?").slice(0, 7)}: ${(t.technique === "strike" ? "Strike" : C.abilities[t.technique]?.name || t.technique).slice(0, 10)} ${t.lock?.length ? "…" : `${t.fresh}%`}` });   // Mise en Place: public stations
      if (miseOn() && U.mise?.ability === U.sel.ability) for (const sl of U.mise.slots) if (sl.at) o.fill.set(k(sl.at), "rgba(201,162,74,.38)");
      for (const mark of s.growthMarks || []) if (s.actors.player && mark.side === s.actors.player.side) o.marks.push({ at: [mark.x, mark.y], kind: "growth" });
      if (s.astral?.ready) { o.marks.push({ at: s.astral.portal, kind: "portal" }); for (const e of Object.values(s.astral.entries || {})) o.marks.push({ at: e.real, kind: "portal" }); }
      for(const e of s.terrainEffects||[])if(s.actors[e.owner]?.ownerTurns<e.expiresAt&&["sectionCut","projection","planView","pastedFragment","statute","exileGate"].includes(e.kind))for(const at of e.tiles||[])o.marks.push({at,kind:e.kind});
      const attended=controlledFighter(s)?.focus && s.actors[controlledFighter(s).focus.target];
      if(attended&&!attended.defeated)o.marks.push({at:[attended.x,attended.y],kind:"focus"});
      if (s.pending) for (const t of s.pending.announcedTiles || s.pending.inst?.announcedTiles || s.pending.inst?.tiles || []) o.fill.set(k(t), "rgba(255,80,80,.38)");   // same order as the response panel (line ~304): some pending attacks carry no tiles
      if (s.pending?.inst.deception) {
        o.fill.clear();
        for (const t of s.pending.announcedTiles) o.fill.set(k(t), "rgba(255,190,90,.28)");
      }
      if (U.mode === "response" && s.pending) for (const r of E.responseOptions(s)) { if (r.kind === "reposition" && !U.throwArmed) o.fill.set(k(r.to), r.safe ? "rgba(110,220,150,.45)" : "rgba(255,190,90,.35)");
        else if (r.kind === "dodgeThrow" && U.throwArmed) o.fill.set(k(r.to), r.safe ? "rgba(255,110,110,.5)" : "rgba(255,150,90,.4)");   // armed throw: red tiles
        else if (r.kind === "technique" && r.ability === "shieldWall") o.fill.set(k(r.target), "rgba(233,196,106,.45)"); }   // reactive wall tiles on the incoming line
      if(U.mode==="press")for(const option of E.fullCourtPressOptions(s,U.pressUnit))o.fill.set(k(option.to),"rgba(110,220,150,.45)");
      // The menu row under the pointer or keyboard names a plant, an object or a tile: light that tile on the board
      // (Mala, 2026-10-14: when communing, "I'm not sure which plant I'm talking to").
      if (U.mode === "menu") { const sel = (() => { try { return menuList()[U.menuIndex]; } catch { return null; } })();
        const obj = sel?.object && (s.arena.objects || []).find((x) => x.id === sel.object), at = obj ? [obj.x, obj.y] : Array.isArray(sel?.at) ? sel.at : null;
        if (at) { o.fill.set(k(at), "rgba(150,235,140,.42)"); o.ring.add(k(at)); } }
      if (U.mode === "move") {
        const mv = E.moveOptions(s, controlledId(s));
        for (const m of mv) o.fill.set(k(m.to), "rgba(90,170,255,.35)");
        const h = U.hover && mv.find((m) => k(m.to) === k(U.hover)); if (h) o.path = h.path;
      }
      if (U.mode === "jump") for (const j of E.jumpOptions(s, controlledId(s))) o.fill.set(k(j.to), "rgba(244,162,97,.42)");
      if (U.mode === "climb") for (const c of E.climbOptions(s, controlledId(s))) o.fill.set(k(c.to), "rgba(214,166,255,.42)");
      if (U.mode === "target" && U.sel) {
        const tg = U.sel.tg;
        for (const t of tg.range || []) o.fill.set(k(t), "rgba(250,200,80,.40)");
        for (const l of tg.legal) o.ring.add(k(l.at));
        const h = U.sel.self ? tg.legal[0] : U.hover && tg.legal.find((l) => k(l.at) === k(U.hover));
        if (h) {
          for (const t of h.tiles || []) o.fill.set(k(t), "rgba(255,90,90,.42)");
          if (h.route) o.path = h.route;
          if (U.sel.m && U.sel.m.delivery === "line" && !U.sel.self) o.line = [[controlledFighter(s).x, controlledFighter(s).y], h.at];
        }
      }
      return o;
    }
    // Show the complete battlefield for readability. Combat targeting, Observe,
    // placement and attack resolution still use engine.hasSight independently.
    // This is only a presentation choice; it does not grant line of sight.
    const unseen = () => false;
    function draw() {
      if (!U.s) return;
      let cam = isoSync(); if (!!cam !== !!geo.iso) { layout(); cam = isoCam; syncZoomBar(); }
      isoQueue = cam ? { ground: [], bills: [] } : null; spritesDrawn = [];
      const groundSet = MAPD ? MAPD.groundSet(U.s.arena) : U.s.arena?.visual?.groundTiles;   // every isometric map draws a tile set now (map-dressing.js; Mala, 2026-10-26)
      if (isoQueue && GROUND_TILES[groundSet]) groundTiles(U.s, GROUND_TILES[groundSet]);
      const s = U.s, { tw, th, lip } = geo; g.clearRect(0, 0, geo.W, geo.H);
      // The sky behind the arena (sprites/sky/, Mala's backdrops): storm when it is raining or squalling, otherwise night
      // or day by the clock. It covers the canvas and is dimmed so the tiles and the text still read.
      { const which = skyFor(s), sky = which && transformImage("sky", which.image);
        if (which) { g.save();
          if (sky) { const k = Math.max(geo.W / sky.naturalWidth, geo.H / sky.naturalHeight), w = sky.naturalWidth * k, h = sky.naturalHeight * k; g.drawImage(sky, (geo.W - w) / 2, (geo.H - h) / 2, w, h); }
          g.fillStyle = `rgba(6, 10, 28, ${sky ? which.dim : which.unlit})`; g.fillRect(0, 0, geo.W, geo.H); g.restore(); } }
      dressingDrawn = 0; groundDrawn = 0; astralFloorsDrawn = 0; shelfTexture = null; if (cam) drawDressing(cam); else if (astralShown() && boardRegion() === "pocket") drawAstralDressing();
      U.seen = null;
      U.fxFrame = U.fxPlayer?.sample(performance.now()) || null;
      const o = overlays();
      // Ground is drawn from the real tile layer, not one generic board fill. Keep every
      // pattern deterministic so visual changes never depend on frame timing or RNG.
      const shade = V?.shadeTiles ? V.shadeTiles(s.arena) : new Set();
      const groundStyle = (ch) => ({
        ".": { top: "#77766f", side: "#484953", ink: "#c4baa0" },
        ",": { top: "#64805c", side: "#3e5145", ink: "#a5b982" },
        m: { top: "#80664e", side: "#514234", ink: "#c09b6d" },
        w: { top: "#477e83", side: "#294f61", ink: "#9ddbd0" },
        "~": { top: "#225676", side: "#16394f", ink: "#88cae0" },
        h: { top: "#47714d", side: "#334f3b", ink: "#a8c779" },
        T: { top: "#675b46", side: "#403a34", ink: "#b8a979" },
        "#": { top: "#777477", side: "#49464f", ink: "#c4bdb0" },
        "/": { top: "#8e8168", side: "#5b5148", ink: "#e0c991" },
        "=": { top: "#777477", side: "#49464f", ink: "#c4bdb0" },
        b: { top: "#80664d", side: "#514234", ink: "#d1a56e" },
        "*": { top: "#725d4d", side: "#493b38", ink: "#d69a7b" },
      })[ch] || { top: "#596278", side: "#34394a", ink: "#aeb7c5" };
      // panels (the isometric board paints its own ground; only the range fills and target rings are drawn here)
      if (cam) for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) {
        const f = o.fill.get(k([x, y])), ring = o.ring.has(k([x, y])); if (!f && !ring) continue;
        onGround(x, y, (px, py) => { if (f) { g.fillStyle = f; g.fillRect(px + 1, py + 1, tw - 2, th - 2); } if (ring) { g.strokeStyle = "#ffe08a"; g.lineWidth = 2.5; roundRect(px + 4, py + 4, tw - 8, th - 8, 4); g.stroke(); } });
      }
      // (an `else` to the isometric branch above: the flat board draws below only when there is no camera)
      // Continuous ground (Garden Court): neighbouring tiles of one material and height share a surface; the per-tile
      // panels below then draw only what lies on the ground. Painted from the terrain as it stands, not the authored map.
      const continuous = !cam && GROUND && s.arena.ground === "continuous";
      if (continuous) { const rows = [], hts = [];
        for (let y = 0; y < s.arena.h; y++) { let r = "", hr = ""; for (let x = 0; x < s.arena.w; x++) { r += E.geometry.surfaceAt(s, x, y); hr += E.geometry.heightAt(s, x, y); } rows.push(r); hts.push(hr); }
        GROUND.paint(g, { map: rows, height: hts }, { tw, th, riseY: geo.riseY, ox: geo.ox, oy: geo.oy }); }
      if (!cam) for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) {
        const [px, py] = tileXY(x, y);
        if (unseen(x, y)) { g.fillStyle = "#100e16"; g.fillRect(px, py, tw, th); continue; }
        const ch = E.geometry.surfaceAt(s,x,y); const t = E.geometry.tileAt(s, x, y);
        const astralTile = s.astral?.ready && x >= s.astral.x0;   // the pocket's floor: its own stone, not the land's paving (Mala, 2026-10-26: "grey and lifeless")
        const palette = astralTile ? { top: "#3b2f6b", side: "#231c45", ink: "#cbb8ff" } : groundStyle(ch), pool = ch === "~", pillar = ch === "#";
        const height = E.geometry.heightAt(s, x, y);
        if (!continuous) {
        if (height > 0) {
          const floorY = py + height * geo.riseY;
          g.fillStyle = palette.side; g.beginPath(); g.moveTo(px + 2, py + th - 2); g.lineTo(px + tw - 2, py + th - 2); g.lineTo(px + tw - 2, floorY + th - 2); g.lineTo(px + 2, floorY + th - 2); g.closePath(); g.fill();
          g.strokeStyle = `${palette.ink}66`; g.lineWidth = 1; g.stroke();
          // Stratified retaining faces make a terrace read as built grade, not floating tiles.
          for (let level = 1; level < height; level++) { const yy = py + th - level * geo.riseY; g.strokeStyle = `${palette.ink}32`; g.beginPath(); g.moveTo(px + 4, yy); g.lineTo(px + tw - 4, yy); g.stroke(); }
        }
        g.fillStyle = palette.side; g.fillRect(px + 2, py + 2 + lip, tw - 4, th - 4);
        const tone = ((x * 13 + y * 7) % 5 - 2) * 3;
        const rgb = palette.top.match(/[0-9a-f]{2}/gi).map(v => Math.max(0, Math.min(255, parseInt(v, 16) + tone)));
        g.fillStyle = `rgb(${rgb.join(",")})`;
        roundRect(px + 2, py + 2, tw - 4, th - 4, 5); g.fill();
        g.save(); roundRect(px + 2, py + 2, tw - 4, th - 4, 5); g.clip();
        if (astralTile && MAPD) { const tex = worldSprite("objects", MAPD.astralFloor(x, y, s.seed || 0)); if (tex) { astralFloorsDrawn++; g.globalAlpha = 0.7; g.drawImage(tex, px + 2, py + 2, tw - 4, th - 4); g.globalAlpha = 1; } }   // cosmic floor (staged-art/cosmic-tiles-review)
        g.strokeStyle = `${palette.ink}66`; g.fillStyle = `${palette.ink}88`; g.lineWidth = 1;
        if (astralTile) { for (let i = 0; i < 3; i++) { const sx = px + 6 + ((x * 17 + y * 11 + i * 23) % Math.max(10, tw - 12)), sy = py + 5 + ((x * 7 + y * 13 + i * 11) % Math.max(8, th - 10)); g.globalAlpha = .35 + .45 * Math.abs(Math.sin(performance.now() / 900 + x * 1.7 + y * 2.3 + i)); g.fillRect(sx, sy, i ? 1.5 : 2.5, i ? 1.5 : 2.5); } g.globalAlpha = 1; }   // faint star glints
        else if (ch === ".") { g.strokeRect(px + tw * .48, py + 2, 1, th - 4); g.strokeRect(px + 2, py + th * .52, tw - 4, 1); }
        else if (ch === "," || ch === "m") { for (let i = 0; i < 4; i++) { const sx = px + 7 + ((x * 11 + y * 5 + i * 13) % Math.max(12, tw - 14)); const sy = py + 6 + ((i * 7 + x * 3) % Math.max(8, th - 12)); g.beginPath(); g.ellipse(sx, sy, ch === "m" ? 2.5 : 1.2, 1.3, i, 0, Math.PI * 2); g.fill(); } }
        else if (ch === "w" || pool) { g.lineWidth = 1.2; for (let i = 0; i < 3; i++) { const yy = py + th * (.3 + i * .2); g.beginPath(); g.moveTo(px + tw * (.12 + (i % 2) * .12), yy); g.quadraticCurveTo(px + tw * .45, yy - 3, px + tw * .8, yy); g.stroke(); } }
        else if (ch === "/") { for (let i = 0; i < 4; i++) { const yy = py + th * (.28 + i * .16); g.beginPath(); g.moveTo(px + 5, yy); g.lineTo(px + tw - 5, yy); g.stroke(); } }
        else if (ch === "*") { for (let i = 0; i < 5; i++) { const sx = px + 6 + ((i * 17 + y * 3) % Math.max(12, tw - 12)), sy = py + th * (.25 + (i % 3) * .2); g.beginPath(); g.moveTo(sx - 2, sy + 2); g.lineTo(sx, sy - 3); g.lineTo(sx + 2, sy + 2); g.fill(); } }
        else if (ch === "b") { for (let i = 0; i < 4; i++) { const xx = px + tw * (.18 + i * .2); g.beginPath(); g.moveTo(xx, py + 4); g.lineTo(xx, py + th - 4); g.stroke(); } }
        g.restore();
        }
        if (shade.has(`${x},${y}`)) { g.fillStyle = "rgba(16,35,25,.2)"; roundRect(px + 3, py + 3, tw - 6, th - 6, 5); g.fill(); }
        if (height) { g.fillStyle = "#fff8"; g.font = `700 ${Math.round(tw * .14)}px ui-monospace, Menlo, monospace`; g.textAlign = "left"; g.fillText(`▲${height}`, px + 5, py + th * .28); }
        if (ch === "=") { g.strokeStyle = "#c7bca966"; g.lineWidth = 2; g.beginPath(); g.moveTo(px + 3, py + th * .75); g.lineTo(px + tw - 3, py + th * .75); g.stroke(); }
        const f = o.fill.get(k([x, y])); if (f) { g.fillStyle = f; roundRect(px + 2, py + 2, tw - 4, th - 4, 5); g.fill(); }
        if (o.ring.has(k([x, y]))) { g.strokeStyle = "#ffe08a"; g.lineWidth = 2.5; roundRect(px + 4, py + 4, tw - 8, th - 8, 4); g.stroke(); }
        if (pillar) drawPillar(px, py, tw, th, palette);
        if (ch === "T") drawTree(px, py, tw, th, 0);
        if (ch === "h") drawHedge(px, py, tw, th, 0);
      }
      for (const patch of s.successionPatches || []) onGround(patch.x, patch.y, () => {
        const [cx, cy] = centre(patch.x, patch.y), r = Math.max(3, tw * 0.1);
        g.save(); g.globalAlpha = 0.88;
        g.fillStyle = patch.stage === 3 ? "#c8e895" : patch.stage === 2 ? "#91cb78" : "#648f58";
        for (let i = 0; i < patch.stage + 1; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / Math.max(2, patch.stage), ax = cx + Math.cos(angle) * r * 1.1, ay = cy + Math.sin(angle) * r * 0.65;
          g.beginPath(); g.ellipse(ax, ay, r * 0.58, r * 0.32, angle, 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = patch.stage === 3 ? "#efffc0" : "#d4e3a8"; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r * 1.6, 0, Math.PI * 2); g.stroke();
        g.fillStyle = "#f4f1d7"; g.font = `700 ${Math.max(9, Math.round(tw * .14))}px ui-monospace, Menlo, monospace`; g.textAlign = "right"; g.textBaseline = "top"; g.fillText(String(patch.stage), cx + tw * .42, cy - th * .42);
        g.restore();
      }, false);
      if (s.dreamSpace) drawDreamTerrain();
      else if (GF) {
        const look = GF.veil(s);
        if (look) GF.paintTerrain(g, look, s.arena, tileXY, geo, performance.now(), cam ? onGround : null);
      }
      for (const object of (s.arena.objects || []).slice().sort((a, b) => a.y - b.y || a.x - b.x)) {
        if (unseen(object.x, object.y)) continue;
        // The same species, stage and object art on both boards: the isometric scene models ground and architecture only.
        upright(object.x, object.y, () => { const [px, py] = tileXY(object.x, object.y), ch = s.arena.map[object.y][object.x], palette = groundStyle(ch);
          return drawMapObject(object, px, py, tw, th, palette); }, { w: 1, up: 2.2, cover: true });
      }
      drawTraps(tw, th);
      for (const p of (s.arena.pickups || [])) {
        if (unseen(p.x, p.y)) continue;
        upright(p.x, p.y, () => { const [px, py] = centre(p.x, p.y); drawPickupMarker(p, px, py, tw, th); }, { w: 0.6, up: 0.8 });
      }
      const pinned = U.unitInfo && s.actors[U.unitInfo];                 // unit window: ring the unit it describes
      if (pinned && !pinned.notArrived && !unseen(pinned.x, pinned.y)) {
        onGround(pinned.x, pinned.y, () => { const [rx, ry] = centre(pinned.x, pinned.y);
        g.save(); g.strokeStyle = "#e9c46a"; g.lineWidth = 2; g.setLineDash([5, 4]);
        g.beginPath(); g.ellipse(rx, ry + th * .18, tw * .42, th * .3, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }, false);
      }
      for (const f of (s.trueFormFields || [])) {                       // true forms: Trash (Little King), mushrooms (Zherm)
        if (f.expiresRound <= s.round || unseen(f.x, f.y)) continue;
        onGround(f.x, f.y, (px, py) => { const cx = px + tw / 2, cy = py + th / 2, u = Math.min(tw, th);
        if (f.kind === "trash") {
          g.fillStyle = "#5b4a2f66"; g.fillRect(px + 2, py + 2, tw - 4, th - 4);
          g.fillStyle = "#2b2418"; for (const [dx, dy, r] of [[-.22, -.12, .09], [.16, -.2, .07], [.05, .14, .1], [-.18, .2, .06], [.24, .12, .07]]) { g.beginPath(); g.arc(cx + dx * u, cy + dy * u, r * u, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = "#c9b458"; g.fillRect(cx - .06 * u, cy - .04 * u, .1 * u, .05 * u);
        } else if (f.kind === "mushroom") {
          g.fillStyle = "#efe6d0"; g.fillRect(cx - .05 * u, cy - .02 * u, .1 * u, .2 * u);
          g.fillStyle = "#b5533c"; g.beginPath(); g.arc(cx, cy - .02 * u, .2 * u, Math.PI, 0); g.fill();
          g.fillStyle = "#f6efe0"; for (const [dx, dy] of [[-.09, -.1], [.07, -.13], [0, -.06]]) { g.beginPath(); g.arc(cx + dx * u, cy + dy * u, .028 * u, 0, Math.PI * 2); g.fill(); }
        }
        }, f.kind === "trash");
      }
      // Field hazards (HAZARD_ART): fire flickers through its frames, a flood front rolls through its own, and each
      // creeper tile keeps one drawing chosen by where it is. The old tint stays underneath as the fallback and so the
      // tile still reads at a glance. Creeper was not drawn at all before 2026-10-11.
      for (const m of s.wild || []) {
        const art = HAZARD_ART[m.kind]; if (!art) continue;
        const cells = m.tiles ? Object.keys(m.tiles).map(k => k.split(",").map(Number)) : [[m.x, m.y]];
        for (const at of cells) {
          const spot = at[0] * 7 + at[1] * 13;
          onGround(at[0], at[1], (px, py) => { g.fillStyle = art.tint; g.fillRect(px + 3, py + 3, tw - 6, th - 6); });
          const img = transformImage(art.folder, hazardFrame(art, spot, performance.now()));
          if (!img) continue;
          const w = tw * art.width, h = w * img.naturalHeight / img.naturalWidth;
          upright(at[0], at[1], () => { const [px, py] = tileXY(...at); g.save(); g.imageSmoothingEnabled = false; g.drawImage(img, px + (tw - w) / 2, py + th - 2 - h, w, h); g.restore(); }, { w: art.width / 2 + .1, up: h / tw + .2 });
        }
      }
      // Capture chant feedback (RITUAL_FEEDBACK.md): a gold tether from the channeler to what it holds, pulsing toward the
      // held creature, and a pale stasis ring on the held tile. Map state, so it shows whatever the dialogue setting.
      for (const a of Object.values(s.actors)) {
        if (!a.ritual || a.defeated) continue;
        const held = (s.wild || []).find((w) => w.id === a.ritual.monsterId) || s.actors[a.ritual.monsterId]; if (!held || unseen(held.x, held.y)) continue;
        const [ax, ay] = centre(a.x, a.y), [hx, hy] = centre(held.x, held.y), t = (performance.now() / 900) % 1;
        g.save(); g.strokeStyle = "#e8c85acc"; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(hx, hy); g.stroke(); g.setLineDash([]);
        g.fillStyle = "#fff3c4"; g.beginPath(); g.arc(ax + (hx - ax) * t, ay + (hy - ay) * t, 3, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#dfe8f0"; g.lineWidth = 2; g.globalAlpha = 0.6 + 0.3 * Math.sin(performance.now() / 300); g.beginPath(); g.ellipse(hx, hy + th * .12, tw * .42, th * .3, 0, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1; g.fillStyle = "#dfe8f0"; g.font = `bold ${Math.max(9, Math.round(tw * .16))}px sans-serif`; g.textAlign = "center"; g.fillText("HELD", hx, hy - th * .55); g.restore();
      }
      for (const gv of s.graves || []) {   // ritual burial: a grave marker stands where the body was buried (sprites/graves/)
        if (unseen(gv.x, gv.y)) continue;
        upright(gv.x, gv.y, () => { const [cx, cy] = centre(gv.x, gv.y), img = transformImage("graves", gv.style || "headstone"); if (!img) return;
          const scale = Math.min(tw * .78 / img.naturalWidth, th * .95 / img.naturalHeight), dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
          g.save(); g.imageSmoothingEnabled = false; g.drawImage(img, cx - dw / 2, cy + th * .22 - dh, dw, dh); g.restore(); }, { w: .7, up: 1 });
      }
      for (const f of s.fish || []) {   // dream fish in the water (engine/conditions.js fishRound)
        if (unseen(f.x, f.y)) continue;
        onGround(f.x, f.y, (px, py) => { const cx = px + tw / 2, cy = py + th / 2, wob = Math.sin(performance.now() / 400 + f.x) * tw * .05;
          g.save(); g.strokeStyle = "rgba(220,240,255,.55)"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy + th * .1, tw * .28, th * .14, 0, 0, Math.PI * 2); g.stroke();
          g.font = `${Math.round(tw * .32)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("🐟", cx + wob, cy); g.restore(); });
      }
      for (const m of s.wild || []) {
        if (m.form !== "unit" || unseen(m.x, m.y)) continue;
        upright(m.x, m.y, () => { const [cx, cy] = centre(m.x, m.y), recent = U.poseUntil[m.id], pose = m.lf <= 0 || m.done ? "knocked-out" : recent && recent.until > performance.now() ? recent.pose : "idle", img = wildSprite(m.kind, pose) || wildSprite(m.kind, "idle");
        g.fillStyle = "#0008"; g.beginPath(); g.ellipse(cx, cy + th * .12, tw * .30, th * .2, 0, 0, Math.PI * 2); g.fill();
        if (m.lf > 0 && !m.done) { const glow = m.side === "player" ? "#5ee08a" : m.side === "enemy" ? "#ef6f6c" : "#e8c85a";
          g.save(); g.strokeStyle = glow; g.globalAlpha = .6; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, cy + th * .12, tw * .4, th * .28, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
        if (img) {
          const maxW = m.kind === "gaia" ? tw * 2.3 : m.kind === "feralPig" ? tw * 1.28 : tw * 1.02, maxH = m.kind === "gaia" ? th * 2.4 : th * 1.28;
          const kindScale = m.kind === "nettleCaterpillar" ? 0.72 : 1;   // Mala, 2026-10-27: "it doesnt take much for a caterpillar to be giant"
          const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight) * kindScale, dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
          g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = pose === "knocked-out" ? .76 : 1;
          if (shouldFlipSprite(m.kind, U.facing[m.id] ?? true)) { g.translate(cx, 0); g.scale(-1, 1); }
          g.drawImage(img, cx - dw / 2, cy + th * .08 - dh, dw, dh); g.restore();
        } else {
          const glyph = m.kind === "feralPig" ? "🐗" : m.kind === "porgy" ? "🐟" : "🐜";
          g.fillStyle = "#5e2529"; g.beginPath(); g.arc(cx, cy, tw * .25, 0, Math.PI * 2); g.fill();
          g.strokeStyle = "#ff9b76"; g.lineWidth = 2; g.stroke(); g.fillStyle = "#fff"; g.font = `800 ${Math.round(tw * .23)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(glyph, cx, cy);
        }
        }, { w: m.kind === "gaia" ? 1.3 : .8, up: m.kind === "gaia" ? 1.7 : 1, ghost: () => {} });
      }
      for (const t of s.wildTelegraphs || []) for (const at of t.tiles || []) onGround(at[0], at[1], (px, py) => { g.strokeStyle = "#ff775d99"; g.lineWidth = 2; g.setLineDash([4, 3]); g.strokeRect(px + 5, py + 5, tw - 10, th - 10); g.setLineDash([]); });
      for (const m of o.marks) {
        if (unseen(m.at[0], m.at[1])) continue;
        onGround(m.at[0], m.at[1], (px, py) => {
        g.save(); g.beginPath(); roundRect(px + 3, py + 3, tw - 6, th - 6, 5); g.clip();
        g.strokeStyle = m.kind === "focus" ? "rgba(211,182,111,.95)" : m.kind === "growth" ? "rgba(154,181,109,.9)" : m.kind === "sectionCut" ? "rgba(128,184,218,.9)" : m.kind === "projection" ? "rgba(217,161,197,.9)" : m.kind === "planView" ? "rgba(250,230,150,.8)" : m.kind === "pastedFragment" ? "rgba(217,161,197,.9)" : m.kind === "corpse" ? "rgba(140,120,110,.85)" : m.kind === "grave" ? "rgba(200,190,160,.95)" : m.kind === "statute" ? "rgba(59,91,169,.9)" : m.kind === "exileGate" ? "rgba(214,175,55,.95)" : m.kind === "portal" ? "rgba(190,140,255,.95)" : m.kind === "mise" ? "rgba(201,162,74,.95)" : "rgba(244,162,97,.75)"; g.lineWidth = 2;
        for (let i = -th; i < tw; i += 9) { g.beginPath(); g.moveTo(px + i, py + th); g.lineTo(px + i + th, py); g.stroke(); }
        g.restore();
        if (m.label) { g.fillStyle = "#f5e6b8"; g.font = `700 ${Math.round(tw * .13)}px ui-monospace, Menlo`; g.textAlign = "center"; g.fillText(m.label, px + tw / 2, py + th * .92); }
        });
      }
      for (const at of s.modeSetup?.exits || []) {
        onGround(at[0], at[1], (px, py) => { g.strokeStyle = "#85e6b1"; g.lineWidth = 3; roundRect(px + 4, py + 4, tw - 8, th - 8, 7); g.stroke();
        g.fillStyle = "#eafff2"; g.font = `800 ${Math.round(tw * .15)}px ui-monospace, Menlo`; g.textAlign = "center"; g.fillText("EXIT", px + tw / 2, py + th * .56); });
      }
      for (const id of s.modeSetup?.targets || []) { const a = s.actors[id]; if (a && !a.defeated) onGround(a.x, a.y, () => { const [cx, cy] = centre(a.x, a.y); g.strokeStyle = "#ffdf75"; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, tw * .34, 0, Math.PI * 2); g.stroke(); }, false); }
      // cursor and previews: over the ground on the flat board; last of all on the isometric one, so no wall hides them
      const guides = () => {
      if (U.cursor && (U.mode === "move" || U.mode === "press" || U.mode === "jump" || U.mode === "climb" || U.mode === "target" || U.mode === "response")) {
        tileDraw(...U.cursor, (px, py) => { g.strokeStyle = "#fff"; g.lineWidth = 2; g.setLineDash([4, 3]); roundRect(px + 1, py + 1, tw - 2, th - 2, 6); g.stroke(); g.setLineDash([]); });
      }
      // previews
      if (o.path) { g.strokeStyle = "#ffffffcc"; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); o.path.forEach((p, i) => { const [cx, cy] = centre(...p); i ? g.lineTo(cx, cy) : g.moveTo(cx, cy); }); g.stroke(); g.setLineDash([]); }
      if (U.mode === "move" && o.path?.length > 1) {
        let cost = 0; g.fillStyle = "#fff"; g.font = `800 ${Math.round(tw * .16)}px ui-monospace, Menlo`; g.textAlign = "center";
        for (let i = 1; i < o.path.length; i++) { cost += E.movementStepCost(s, ...o.path[i - 1], ...o.path[i]); const [cx, cy] = centre(...o.path[i]); g.fillText(String(cost), cx, cy); }
      }
      if (o.line) { const [a, b] = o.line.map((p) => centre(...p)); g.strokeStyle = "#ffe08acc"; g.lineWidth = 2; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
      };
      if (!cam) guides();
      // barriers
      for (const b of s.barriers) {
        if (unseen(b.x, b.y)) continue;
        upright(b.x, b.y, () => { const [px, py] = tileXY(b.x, b.y); const own = s.actors[b.owner];
        const berm = b.concept === "berm", swale = b.concept === "swale", foldC = b.concept === "foldCrossing", foldP = b.concept === "foldPanel";
        const wallImg = worldSprite("walls", wallArt(s, b));
        if (wallImg) {
          const dw = tw * .92, dh = dw * wallImg.naturalHeight / wallImg.naturalWidth;
          g.save(); g.imageSmoothingEnabled = false; g.drawImage(wallImg, px + (tw - dw) / 2, py + th * .78 - dh, dw, dh); g.restore();
        } else if (berm) {
          // Low, walkable earth shelf: draw a raised top and shallow front face.
          g.fillStyle = "rgba(108,79,48,.72)"; g.beginPath(); g.moveTo(px + tw * .12, py + th * .26); g.lineTo(px + tw * .5, py + th * .42); g.lineTo(px + tw * .88, py + th * .26); g.lineTo(px + tw * .5, py + th * .1); g.closePath(); g.fill();
          g.fillStyle = "rgba(184,148,99,.86)"; g.beginPath(); g.moveTo(px + tw * .12, py + th * .17); g.lineTo(px + tw * .5, py + th * .33); g.lineTo(px + tw * .88, py + th * .17); g.lineTo(px + tw * .5, py); g.closePath(); g.fill();
          g.strokeStyle = "#d0aa72"; g.lineWidth = 1.5; g.stroke();
        } else if (swale) {
          // Bioswale (Mala, 2026-10-26: "I think we have a better tile overlay"): a sunken basin in the map's own shallow-water
          // tile, ringed in mulch, with its ripples; flat on the ground, not a box standing over the unit.
          const wet = groundStyle("w"), rim = groundStyle("m"), inset = 5;
          g.save(); roundRect(px + 2, py + 2, tw - 4, th - 4, 5); g.fillStyle = rim.top; g.globalAlpha = .9; g.fill();
          roundRect(px + inset, py + inset, tw - inset * 2, th - inset * 2, 8); g.fillStyle = wet.top; g.globalAlpha = 1; g.fill(); g.clip();
          g.strokeStyle = `${wet.ink}99`; g.lineWidth = 1.2;
          for (let i = 0; i < 3; i++) { const yy = py + th * (.3 + i * .2); g.beginPath(); g.moveTo(px + tw * (.14 + (i % 2) * .12), yy); g.quadraticCurveTo(px + tw * .45, yy - 3, px + tw * .82, yy); g.stroke(); }
          g.restore();
        } else {
          g.fillStyle = "rgba(250,200,80,.40)"; g.fillRect(px + tw * .12, py - th * .5, tw * .76, th * 1.25);
          g.strokeStyle = "#e9c46a"; g.lineWidth = 2; g.strokeRect(px + tw * .12, py - th * .5, tw * .76, th * 1.25);
        }
        g.fillStyle = "#fff6d8"; g.font = `700 ${Math.round(tw * .2)}px ui-monospace, Menlo, monospace`; g.textAlign = "center";
        g.strokeStyle = "rgba(0,0,0,.75)"; g.lineWidth = 3; g.lineJoin = "round";   // legible over wall art
        const label = (text, ty) => { g.strokeText(text, px + tw / 2, ty); g.fillText(text, px + tw / 2, ty); };
        if (swale) { g.font = `700 ${Math.round(tw * .14)}px ui-monospace, Menlo, monospace`; g.textAlign = "right"; if (!b.permanent) { const t = `${b.expiresAt - own.ownerTurns}t`, tx = px + tw - 6, ty = py + th - 6; g.strokeText(t, tx, ty); g.fillText(t, tx, ty); } g.textAlign = "center"; }   // the basin: just its turns left, in the corner
        else {
          label(foldC ? "V" : foldP ? "M" : berm ? "B" : Math.round(b.protection), py + th * .15);
          g.font = `${Math.round(tw * .14)}px ui-monospace, Menlo, monospace`; if (!b.permanent) label(`${b.expiresAt - own.ownerTurns}t`, py + th * .55);
        }
        }, { w: .55, up: .8 });
      }
      // actors (back rows first). The fallen stay drawn (knocked-out, faded) while their corpse is
      // unburied; burial removes the corpse and the grave mark takes over. Escaped, dismissed and
      // never-arrived units leave no corpse, so they still vanish.
      const unburied = new Set((s.corpses || []).map((c) => c.of));
      const actors = Object.values(s.actors).filter((a) => !a.defeated || a.id === "player" || unburied.has(a.id)).sort((p, q) => p.y - q.y);
      const cur = E.decider(s);
      if (!cam) drawAuras(s, unseen);
      for(const a of actors.filter(a=>a.category==="bystander"&&a.tourist&&!a.escaped)){const [x,y]=a.tourist.exit;onGround(x,y,(px,py)=>{g.save();g.strokeStyle="#f0ca68";g.lineWidth=3;g.strokeRect(px+3,py+3,tw-6,th-6);g.fillStyle="#f0ca68";g.font="bold 11px sans-serif";g.fillText("EXIT",px+5,py+15);g.restore();});}
      for (const a of actors) if (!unseen(a.x, a.y)) {
        const fw = a.size?.w || 1, fh = a.size?.h || 1, big = Math.max(fw, fh), active = cur && cur.actor === a.id, mid = [a.x + (fw - 1) / 2, a.y + (fh - 1) / 2];
        upright(a.x + fw - 1, a.y + fh - 1, () => drawActor(a, active), { at: mid, w: .8 * big, up: 1.6 * big, ghost: () => { const [cx, cy] = centre(...mid); drawActorOverlays(a, active, cx, cy, tw * .62 * big, tw, th); } });
      }
      for (const a of actors) {   // ritual chains: a gold thread from the channeler to the suspended, with turn pips
        if (!a.ritual || a.defeated || unseen(a.x, a.y)) continue;
        const m = (s.wild || []).find((w) => w.id === a.ritual.monsterId) || s.actors[a.ritual.monsterId]; if (!m) continue;
        const [x1, y1] = centre(a.x, a.y), [x2, y2] = centre(m.x, m.y), n = a.ritual.turnsLeft || 0;
        g.save(); g.strokeStyle = "#f3cf6a"; g.lineWidth = 2.5; g.setLineDash([6, 4]); g.globalAlpha = .9;
        g.beginPath(); g.moveTo(x1, y1 - th * .3); g.lineTo(x2, y2 - th * .3); g.stroke(); g.setLineDash([]);
        for (let i = 0; i < n; i++) { const px = (x1 + x2) / 2 + (i - (n - 1) / 2) * 11, py = (y1 + y2) / 2 - th * .3 - 13;
          g.fillStyle = "#f3cf6a"; g.beginPath(); g.arc(px, py, 4.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#3a2c08"; g.lineWidth = 1; g.stroke(); }
        g.restore();
      }
      if (cam) isoFlush(cam, guides);
      if (s.dreamSpace) drawDreamFilter();
      else if (GF) {
        const look = GF.veil(s);
        if (look) GF.paintFilter(g, look, geo, performance.now());
      }
      const imbued = s.dreamSpace && Object.values(s.actors).find((a) => a.aura?.imbued && !a.defeated);   // Auras: the dream's edge carries the aura
      if (imbued) { g.save(); g.globalAlpha = .1 + (Math.sin(performance.now() / 500) + 1) * .03; g.fillStyle = C.concepts[imbued.aura.concept]?.color || "#c9b6ff"; if(s.dreamSpace.region && DS) { for(let y=0;y<s.arena.h;y++) for(let x=0;x<s.arena.w;x++) if(DS.contains(s.dreamSpace,x,y)) tileDraw(x,y,(px,py)=>g.fillRect(px,py,geo.tw,geo.th)); } else g.fillRect(0, 0, cv.width, cv.height); g.restore(); }
      { const sky = Climate && s.weatherState ? (Climate.effective ? Climate.effective(s.weatherState, s.dreamSpace) : s.weatherState) : null, art = sky && WEATHER_ART[sky.id];   // rain over the field
        const img = art && transformImage(art.folder, art.frame);
        if (img) { const w = tw * art.widthTiles, h = w * img.naturalHeight / img.naturalWidth; g.save(); g.globalAlpha = art.alpha; g.imageSmoothingEnabled = false;
          for (const [x, y] of weatherTiles(art, w, h, geo.W, geo.H, performance.now() / 1000)) g.drawImage(img, x, y, w, h); g.restore(); } }
      drawSpeechBubbles();
      // fx
      if(FX&&U.fxFrame)FX.paint(g,U.fxFrame.ops,(x,y)=>centre(x,y),geo.tw);
      if(FXS&&U.fxFrame?.groups){   // imported effect sprites over the drawn stroke (fx-sprites.js); additive, since the art is glow
        g.save(); g.globalCompositeOperation="lighter";
        for(const d of FXS.draws(U.fxFrame.groups)){
          const slash=d.src.lastIndexOf("/"),img=transformImage(d.src.slice(0,slash),d.src.slice(slash+1)); if(!img)continue;
          const c=centre(d.at[0],d.at[1]),k=geo.tw*d.size/Math.max(img.naturalWidth,img.naturalHeight),w=img.naturalWidth*k,h=img.naturalHeight*k;
          g.save(); g.globalAlpha=d.alpha; g.translate(c[0],c[1]); const flip=Math.abs(d.angle)>Math.PI/2; if(flip)g.scale(-1,1); g.rotate(flip?Math.PI-d.angle:d.angle); g.drawImage(img,-w/2,-h/2,w,h); g.restore();
        }
        g.restore();
      }
      drawActionCues();
      if (U.seen) {
        for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) {
          if (!unseen(x, y)) continue;
          const [px, py] = tileXY(x, y);
          const northHidden = y === 0 || unseen(x, y - 1);
          const top = northHidden ? py - Math.round(th * 0.55) : py;
          g.fillStyle = "#100e16";
          g.fillRect(px - 1, top, tw + 2, py + th - top + 1);
        }
      }
    }
    function drawActionCues() {
      const now = performance.now();
      for (const [id, cue] of Object.entries(U.actionCues)) {
        if (cue.until <= now) { delete U.actionCues[id]; continue; }
        const actor = U.s.actors[id]; if (!actor || unseen(actor.x, actor.y)) continue;
        const [cx, cy] = centre(actor.x, actor.y), font = Math.max(10, Math.min(15, geo.tw * .18));
        g.save(); g.globalAlpha = Math.min(1, (cue.until - now) / 220);
        g.font = `750 ${font}px -apple-system, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        const width = Math.min(210, Math.max(58, g.measureText(cue.text).width + 18)), height = font + 10;
        const x = Math.max(4, Math.min(geo.W - width - 4, cx - width / 2)), y = Math.max(4, cy - geo.tw * .72 - height / 2);
        g.fillStyle = "rgba(14,18,28,.92)"; g.strokeStyle = cue.text === "Dodged" ? "#82ddb4" : "#f0dca8"; g.lineWidth = 1.5;
        roundRect(x, y, width, height, 8); g.fill(); g.stroke(); g.fillStyle = cue.text === "Dodged" ? "#a8f0cf" : "#fff0c8";
        g.fillText(cue.text, x + width / 2, y + height / 2); g.restore();
      }
    }
    function drawDreamTerrain() {
      const phase = performance.now() / 1400;
      for (let y = 0; y < U.s.arena.h; y++) for (let x = 0; x < U.s.arena.w; x++) {
        if (DS && !DS.contains(U.s.dreamSpace,x,y)) continue;
        onGround(x, y, (px, py) => { const hue = (x * 13 + y * 7) % 2 ? "104, 83, 166" : "54, 130, 157";
        g.fillStyle = "rgba(" + hue + ",.13)"; roundRect(px + 3, py + 3, geo.tw - 6, geo.th - 6, 5); g.fill();
        if ((x * 17 + y * 29) % 7 === 0) {
          const drift = Math.sin(phase + x * .8 + y * .4);
          g.fillStyle = "rgba(231,205,255,.34)"; g.beginPath(); g.arc(px + geo.tw * (.68 + drift * .08), py + geo.th * (.28 + Math.cos(phase + y) * .07), Math.max(1.5, geo.tw * .025), 0, Math.PI * 2); g.fill();
        }
        });
      }
    }
    function drawDreamFilter() {
      const { W, H } = geo;
      if(U.s.dreamSpace?.region && DS) {
        g.save();
        for(let y=0;y<U.s.arena.h;y++) for(let x=0;x<U.s.arena.w;x++) {
          tileDraw(x,y,(px,py)=>{
          if(!DS.contains(U.s.dreamSpace,x,y)) { g.fillStyle="rgba(9,8,20,.28)";g.fillRect(px,py,geo.tw,geo.th);return; }
          g.strokeStyle="#e4bdff";g.lineWidth=3;
          for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) if(!DS.contains(U.s.dreamSpace,x+dx,y+dy)) {
            g.beginPath();if(dx) {const ex=px+(dx>0?geo.tw:0);g.moveTo(ex,py);g.lineTo(ex,py+geo.th);} else {const ey=py+(dy>0?geo.th:0);g.moveTo(px,ey);g.lineTo(px+geo.tw,ey);}g.stroke();
          }
          });
        }g.restore();return;
      }
      g.save();
      const vignette = g.createRadialGradient(W * .5, H * .48, Math.min(W, H) * .18, W * .5, H * .48, Math.max(W, H) * .72);
      vignette.addColorStop(0, "rgba(77,54,130,.025)"); vignette.addColorStop(1, `rgba(25,16,56,${.26 + (Math.sin(performance.now() / 1800) + 1) * .025})`);
      g.fillStyle = vignette; g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(195,157,255,.56)"; g.lineWidth = 2; g.strokeRect(4, 4, W - 8, H - 8);
      g.restore();
    }
    function aggroIsRight(actor) {
      const foes = Object.values(U.s.actors).filter((x) => x.side !== actor.side && !x.defeated && across([x.x, x.y])[0] !== across([actor.x, actor.y])[0]);
      if (!foes.length) return true;
      let best = foes[0], bestD = Math.abs(best.x - actor.x) + Math.abs(best.y - actor.y);
      for (const foe of foes) {
        const d = Math.abs(foe.x - actor.x) + Math.abs(foe.y - actor.y);
        if (d < bestD) { best = foe; bestD = d; }
      }
      return across([best.x, best.y])[0] > across([actor.x, actor.y])[0];
    }
    // Auras: the owner's concept extended as a ring (radius 2) that travels with the body. Ten concepts have aura
    // ring art (frame = stage, one per owner turn); the rest get a ring in the concept's colour.
    function drawAuras(s, unseen) {
      const auraPlacement = (art, img, cx, cy, rx, ry, th) => UI_auraPlacement(art, img.naturalWidth, img.naturalHeight, cx, cy, rx, ry, th);
      const { tw, th } = geo;
      for (const a of Object.values(s.actors)) {
        if (!a.aura || a.aura.imbued || a.defeated || unseen(a.x, a.y)) continue;   // an imbued aura is the dream itself
        const R = (AU?.rules.radius || 2) + (a.aura.radiusAdd || 0) + 0.3;   // Vows: Wider Ring
        const [cx, cy] = centre(a.x, a.y), rx = tw * R, ry = th * R;
        const img = a.aura.art ? transformImage(`auras/${a.aura.art}`, `frame-${a.aura.stage || 1}`) : null;
        g.save();
        if (img) {
          const place = auraPlacement(a.aura.art, img, cx, cy, rx, ry, th);
          g.imageSmoothingEnabled = false; g.globalAlpha = .78;
          g.drawImage(img, place.x, place.y, place.w, place.h);
        } else {
          const col = C.concepts[a.aura.concept]?.color || "#c9b6ff";
          g.globalAlpha = .42; g.strokeStyle = col; g.lineWidth = th * .38;
          g.beginPath(); g.ellipse(cx, cy, rx * .86, ry * .86, 0, 0, 7); g.stroke();
          g.globalAlpha = .8; g.lineWidth = 1.5; g.setLineDash([6, 4]);
          g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.stroke(); g.setLineDash([]);
        }
        g.restore();
      }
    }
    function drawActor(a, active) {
      const { tw, th } = geo, fw = a.size?.w || 1, fh = a.size?.h || 1; const [cx, cy] = centre(a.x + (fw - 1) / 2, a.y + (fh - 1) / 2);
      // Tsukumogami: a settled or collapsed body flashes once, then only the map art remains.
      if (a.awakened && a.defeated) {
        const since = performance.now() - ((a.settledBack ? U.settledFlash?.[a.id] : U.collapsedFlash?.[a.id]) || 0);
        if (since > (a.settledBack ? 1200 : 800)) return;
      }
      const col = SPRITE[a.sprite] || ({dragon:"#d77951",oni:"#ad5374",kaiju:"#b5a16c"}[a.boss] || "#ccc");
      if (a.boss) { g.save(); g.strokeStyle = "#f3d58a"; g.globalAlpha = .78; g.lineWidth = 2; g.setLineDash([5,3]); g.strokeRect(centre(a.x,a.y)[0]-tw*.47, centre(a.x,a.y)[1]-th*.47, tw*fw*.94, th*fh*.94); g.setLineDash([]); g.restore(); }
      if (active && !a.defeated) { g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy + th * .12, tw * .34, th * .26, 0, 0, 7); g.stroke(); }
      g.fillStyle = "#0008"; g.beginPath(); g.ellipse(cx, cy + th * .12, tw * .26 * fw, th * .18 * fh, 0, 0, 7); g.fill();
      if (!a.defeated) { const stance = U.s ? E.stance(U.s, controlledId(U.s), a.id) : "neutral", glow = stance === "ally" ? "#5ee08a" : stance === "enemy" ? "#ef6f6c" : "#e8c85a";
        g.save(); g.strokeStyle = glow; g.globalAlpha = .6; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, cy + th * .12, tw * .36 * fw, th * .26 * fh, 0, 0, 7); g.stroke(); g.restore(); }
      const h = tw * .62 * Math.max(fw,fh), bw = tw * .32 * Math.max(fw,fh);
      {
        const actorSprite = communeArt(a.form?.golden ? "gold-form" : a.form?.formId === "one_with_nature" ? "gaia-form" : a.sprite), actorKey = tsukumogamiArt(actorSprite);
        if ((a.communed || a.beast || a.awakened) && actorKey && !poseSprites[actorKey]) loadSpritePackage(actorKey);   // communed plants: loaded when one first appears
        const poses = poseSprites[actorKey];
        const now = performance.now(), recent = U.poseUntil[a.id];
        const pose = a.defeated || a.status?.playingDead ? (a.defeated && a.awakened && !a.settledBack ? "hurt" : "knocked-out") : a.status.guard ? "block"   // a collapse flashes hurt before the rubble; everything else falls as usual
          : U.fxFrame?.poses?.[a.id] || (recent && recent.until > now ? recent.pose : (a.boss && a.conditions?.enraged ? "enraged" : a.status?.kneeling ? "knee" : (POSES ? POSES.idleFor(a, U.s?.rules?.ultimateChargeMax) : "idle")));
        // Alternates hold for one action (or one round for a standing pose), so a guard does not flicker between drawings.
        let img = resolvePose(actorKey, pose, `${a.id}:${recent && recent.until > now ? recent.until : U.s.round}`).img || poses?.[pose], transformScale = 1;
        const animation = U.transformAnimations[a.id];
        if (animation) {
          let elapsed = now - animation.started, frame = null;
          for (const step of animation.sequence) { if (elapsed < step.ms) { frame = step; break; } elapsed -= step.ms; }
          if (!frame) delete U.transformAnimations[a.id];
          else if (frame.from === "character") img = poseSprites[animation.sourceSprite]?.[frame.frame] || img;
          else if (frame.from === "gold-form") img = poseSprites["gold-form"]?.[frame.frame] || img;
          else { const folder = String(animation.sprites || "combat/sprites/gold-transform").replace(/^combat\/sprites\//, ""); img = transformImage(folder, frame.frame) || img; transformScale = BOSS?.data?.integratedSelf?.transformation?.scale || 1; }
        }
        if (img && img.complete && img.naturalWidth) {
          const baseY = cy + th * .1;
          // Poses share idle's pixel scale (as in the duel scene), so a low pose like knockback stays low instead of being stretched to standing height.
          const idleArt = !animation && poses?.idle?.naturalHeight ? poses.idle : null;
          const poseRatio = idleArt && pose !== "idle" ? Math.min(1.5, Math.max(.35, img.naturalHeight / idleArt.naturalHeight)) : 1;
          const imageH = (pose === "knocked-out" && !a.boss ? tw * .23 : tw * .568 * poseRatio) * (SPRITE_SCALE[actorKey] || ((a.size?.w || 1) > 1 || (a.size?.h || 1) > 1 ? BIG_UNIT_SCALE : 1)) * transformScale;   // a multi-tile unit with no scale of its own is drawn at the boss scale (Mala, 2026-10-27: wounded Gaia "is supposed to be larger")
          const imageW = imageH * img.naturalWidth / img.naturalHeight;
          const targetIsRight = U.facing[a.id] ?? aggroIsRight(a);
          const bodyArt = FXS?.bodyAura(a, U.s.rules), bodyImg = bodyArt ? transformImage(`auras/${bodyArt}`, "frame-1") : null;   // fx-sprites.js: power / communing aura behind the unit
          if (bodyImg) { const ah = imageH * 1.55, aw = ah * bodyImg.naturalWidth / bodyImg.naturalHeight; g.save(); g.globalAlpha = .62 + Math.sin(now / 260) * .14; g.drawImage(bodyImg, cx - aw / 2, baseY + ah * .06 - ah, aw, ah); g.restore(); }
          g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = a.defeated ? .78 : 1;
          g.translate(cx, 0); if (shouldFlipSprite(actorKey, targetIsRight)) g.scale(-1, 1);
          g.drawImage(img, -imageW / 2, baseY - imageH, imageW, imageH); g.restore();
          drawActorOverlays(a, active, cx, cy, h, tw, th);
          drawFxMarks(a,cx,cy,tw,th);
          return;
        }
      }
      // body: cloak + head + concept glyph (original primitives)
      g.fillStyle = col; g.beginPath(); g.moveTo(cx - bw / 2, cy + th * .1); g.lineTo(cx + bw / 2, cy + th * .1); g.lineTo(cx + bw * .32, cy - h * .55); g.lineTo(cx - bw * .32, cy - h * .55); g.closePath(); g.fill();
      g.fillStyle = "#00000033"; g.fillRect(cx - bw / 2, cy - h * .05, bw, h * .07);
      g.fillStyle = "#f3e2c8"; g.beginPath(); g.arc(cx, cy - h * .7, tw * .12, 0, 7); g.fill();
      g.fillStyle = "#1c1a21"; const fx = a.side === "player" ? 1 : -1; g.fillRect(cx + fx * tw * .03, cy - h * .73, tw * .03, tw * .04);
      g.strokeStyle = "#1c1a21"; g.lineWidth = 2; glyph(a.primary, cx, cy - h * .3, tw * .11);
      // statuses (an unrevealed enemy-side parry would be hidden; the player's own is always shown)
      const icons = statusMarks(a, { showParry: a.side === "player" || !!U.s.disclosures[a.id].rebound, actors: U.s.actors });
      // A ward is drawn as what it is: a gold ring round the unit and a shield plate with the protection left.
      if (a.status.ward && !a.defeated) {
        const n = String(a.status.ward.protection), pulse = .72 + Math.sin(performance.now() / 320) * .18;
        g.save(); g.strokeStyle = "#f3cf6a"; g.globalAlpha = pulse; g.lineWidth = Math.max(2, tw * .035); g.setLineDash([tw * .09, tw * .05]);
        g.beginPath(); g.ellipse(cx, cy - h * .38, tw * .36, h * .62, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        const bx = cx + tw * .3, by = cy - h * .86, r = tw * .15;
        g.fillStyle = "#f3cf6a"; g.strokeStyle = "#3a2c08"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(bx - r, by - r * .8); g.lineTo(bx + r, by - r * .8); g.lineTo(bx + r, by + r * .2); g.quadraticCurveTo(bx + r * .9, by + r * .95, bx, by + r * 1.25); g.quadraticCurveTo(bx - r * .9, by + r * .95, bx - r, by + r * .2); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#231a05"; g.font = `800 ${Math.round(tw * .15)}px ui-monospace, Menlo`; g.textAlign = "center"; g.fillText(n, bx, by + r * .42); g.restore();
      }
      drawStatusMarks(icons, cx, cy - h * 1.02, tw);
      // mini LF bar
      const w = tw * .7, y0 = cy + th * .32; g.fillStyle = "#000a"; g.fillRect(cx - w / 2, y0, w, 5);
      g.fillStyle = a.lf / a.maxLF > .35 ? "#7cc6a4" : "#ef6f6c"; g.fillRect(cx - w / 2, y0, w * a.lf / a.maxLF, 5);
      drawFxMarks(a,cx,cy,tw,th);
    }
    function drawFxMarks(a,cx,cy,tw,th){
      if(!FX)return;
      const marks=FX.marks(a);let badge=0;
      for(const m of marks){g.save();g.strokeStyle=m.color||"#fff";g.fillStyle=m.color||"#fff";g.lineWidth=m.thin?1.5:2;g.globalAlpha=.9;
        if(m.kind==="thread"){const target=U.s.actors[m.target];if(target&&!target.defeated){const [tx,ty]=centre(target.x,target.y);g.setLineDash([4,4]);g.beginPath();g.moveTo(cx,cy-th*.35);g.lineTo(tx,ty-th*.2);g.stroke();g.setLineDash([]);}}
        else if(m.kind==="shell"){g.beginPath();g.ellipse(cx,cy-th*.32,tw*(m.thin?.31:.39),th*(m.thin?.42:.52),0,0,Math.PI*2);g.stroke();}
        else if(m.kind==="brace"){g.beginPath();g.arc(cx,cy-th*.2,tw*.34,Math.PI,Math.PI*2);g.stroke();}
        else if(m.kind==="root"){g.beginPath();g.moveTo(cx,cy+th*.12);g.lineTo(cx-tw*.2,cy+th*.36);g.moveTo(cx,cy+th*.12);g.lineTo(cx+tw*.2,cy+th*.36);g.stroke();}
        else if(m.kind==="coil"||m.kind==="ring"||m.kind==="hatch"||m.kind==="tangle"||m.kind==="stamp"||m.kind==="nick"){g.beginPath();g.arc(cx,cy-th*.24,tw*(.25+badge*.035),0,Math.PI*2);g.stroke();}
        if(m.badge){g.font=`800 ${Math.max(9,Math.round(tw*.11))}px ui-monospace,Menlo,monospace`;g.textAlign="center";g.fillText(m.badge,cx+(badge-1)*tw*.22,cy-th*.7);badge++;}
        g.restore();
      }
    }
    function drawStatusMarks(icons, cx, y, tw) {
      icons.forEach((m, i) => { const x = cx - (icons.length - 1) * tw * .12 + i * tw * .24, img = m.icon ? transformImage("fx/status", m.icon) : null;
        if (img) { const side = tw * .24; g.save(); g.imageSmoothingEnabled = false; g.drawImage(img, x - side / 2, y - side / 2, side, side * img.naturalHeight / img.naturalWidth); g.restore();
          if (m.count) { g.fillStyle = "#1c1a21"; g.beginPath(); g.arc(x + side * .38, y + side * .34, tw * .055, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = `800 ${Math.round(tw * .085)}px ui-monospace, Menlo`; g.textAlign = "center"; g.fillText(String(m.count), x + side * .38, y + side * .34 + tw * .03); }
          return; }
        g.fillStyle = m.color; g.beginPath(); g.arc(x, y, tw * .1, 0, 7); g.fill(); g.fillStyle = "#1c1a21"; g.font = `800 ${Math.round(tw * .12)}px ui-monospace, Menlo`; g.textAlign = "center"; g.fillText(m.text, x, y + tw * .045); });
    }
    function drawActorOverlays(a, active, cx, cy, h, tw, th) {
      const icons = statusMarks(a, { showParry: a.side === "player" || !!U.s.disclosures[a.id].rebound, wardAsNumber: true, actors: U.s.actors });
      drawStatusMarks(icons, cx, cy - h * 1.02, tw);
      if (a.defeated) return;
      const w = tw * .7, y0 = cy + th * .32; g.fillStyle = "#000a"; g.fillRect(cx - w / 2, y0, w, 5);
      g.fillStyle = a.lf / a.maxLF > .35 ? "#7cc6a4" : "#ef6f6c"; g.fillRect(cx - w / 2, y0, w * a.lf / a.maxLF, 5);
    }
    function glyph(concept, x, y, r) {
      g.beginPath();
      if (concept === "barrier") { g.rect(x - r, y - r * .8, r * 2, r * 1.6); g.moveTo(x - r, y); g.lineTo(x + r, y); }
      else if (concept === "elasticity") { g.moveTo(x - r, y); for (let i = 0; i <= 4; i++) g.lineTo(x - r + i * r / 2, y + (i % 2 ? -r * .7 : r * .7)); }
      else if (concept === "selectivity") { g.moveTo(x - r, y - r); g.lineTo(x + r, y - r); g.lineTo(x, y + r); g.closePath(); g.moveTo(x - r * .5, y - r * .4); g.lineTo(x + r * .5, y - r * .4); }
      else { g.moveTo(x - r, y + r); g.quadraticCurveTo(x - r, y - r, x, y - r * .2); g.quadraticCurveTo(x + r, y + r * .6, x + r, y - r); }
      g.stroke();
    }
    function roundRect(x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
    function drawPillar(x, y, tw, th, palette) {
      const w = tw * .54, h = th * .72, left = x + tw * .23, top = y - h * .35, skew = tw * .12;
      g.fillStyle = "#0007"; g.beginPath(); g.ellipse(x + tw / 2, y + th * .28, w * .72, th * .18, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#45434b"; g.beginPath(); g.moveTo(left, top + h * .18); g.lineTo(left + w, top + h * .18); g.lineTo(left + w, top + h); g.lineTo(left, top + h); g.closePath(); g.fill();
      g.fillStyle = "#5b5860"; g.beginPath(); g.moveTo(left + w, top + h * .18); g.lineTo(left + w + skew, top); g.lineTo(left + w + skew, top + h * .82); g.lineTo(left + w, top + h); g.closePath(); g.fill();
      g.fillStyle = palette.ink; g.beginPath(); g.moveTo(left, top + h * .18); g.lineTo(left + skew, top); g.lineTo(left + w + skew, top); g.lineTo(left + w, top + h * .18); g.closePath(); g.fill();
      g.strokeStyle = "#d0c8ba88"; g.lineWidth = 1; g.stroke();
    }
    function drawTree(x, y, tw, th, scale = 1) {
      const cx = x + tw * .5, base = y + th * .43, r = tw * (.29 + .07 * Math.min(2, scale));
      g.fillStyle = "#0006"; g.beginPath(); g.ellipse(cx, y + th * .38, tw * .31, th * .18, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#75543a"; g.fillRect(cx - tw * .055, base - th * .43, tw * .11, th * .43);
      for (const [dx, dy, rr, color] of [[-.48,.05,.72,"#315b3a"],[.42,.03,.78,"#3e7444"],[0,-.16,1,"#4f8a4d"],[-.16,-.26,.72,"#70a75b"],[.36,-.25,.66,"#5d984f"]]) {
        g.fillStyle = color; g.beginPath(); g.arc(cx + dx * r, base - th * .36 + dy * r, rr * r, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = "#c0cf79"; for (let i = 0; i < 4; i++) { const dx = ((i * 17 + Math.round(x)) % 13 - 6) * tw / 90; const dy = ((i * 11 + Math.round(y)) % 9 - 4) * th / 45; g.beginPath(); g.arc(cx + dx, base - th * .43 + dy, Math.max(1, tw * .018), 0, Math.PI * 2); g.fill(); }
    }
    function drawHedge(x, y, tw, th) {
      const left = x + tw * .15, top = y + th * .19, w = tw * .7, h = th * .55;
      g.fillStyle = "#0005"; g.beginPath(); g.ellipse(x + tw * .5, y + th * .55, w * .55, h * .24, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#31583c"; g.fillRect(left, top + h * .38, w, h * .58);
      g.fillStyle = "#48764a"; roundRect(left, top, w, h * .62, th * .12); g.fill();
      g.fillStyle = "#9aba68"; for (let i = 0; i < 5; i++) { const cx = left + (i + .5) * w / 5; g.beginPath(); g.arc(cx, top + h * (.2 + (i % 2) * .16), Math.max(1.2, tw * .035), 0, Math.PI * 2); g.fill(); }
    }
    // Species art (sprites/plants/<type>-1|2|3.png, small to large) for the plants that have it: vegetation-data.js
    // marks them with `sheet`. Size is cosmetic: a stable pick per plant (mostly large), one size smaller once the
    // plant is at half its HP or less. Heights are relative to the species' own large drawing, so the three sizes
    // keep their true proportions; a tree's large form stands a little over two tiles.
    const PLANT_LARGE_H = { tree: 2.25, shrub: 1.3, hedge: 1.3, groundcover: 1.0 }, PLANT_FALLBACK = [.5, .72, 1];
    function plantStage(o) {
      let h = 2166136261; for (const ch of `${o.id}|${o.type}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
      h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
      const roll = (h >>> 0) % 100, picked = o.form === "tree" ? (roll < 60 ? 3 : 2) : roll < 45 ? 3 : roll < 80 ? 2 : 1;   // a healthy tree is never a sapling
      return Math.max(1, picked - (o.maxHp > 0 && o.hp <= o.maxHp / 2 ? 1 : 0));
    }
    // On the flat board a sprite's foot is at the bottom of its tile; on the isometric one it is at the tile's centre, where fighters stand.
    const spriteFoot = (th) => geo.iso ? th * .25 : 0;
    function drawSpeciesPlant(o, x, y, tw, th) {
      if (!V?.data?.species?.[o.type]?.sheet) return false;
      y -= spriteFoot(th);
      const stage = o.dead ? 1 : plantStage(o), art = worldSprite("plants", `${o.type}-${stage}`), large = worldSprite("plants", `${o.type}-3`);
      if (!art) return false;
      const ratio = large ? art.naturalHeight / large.naturalHeight : PLANT_FALLBACK[stage - 1];
      let dh = th * (PLANT_LARGE_H[o.form] || 1.5) * ratio, dw = dh * art.naturalWidth / art.naturalHeight;
      const cap = tw * (o.form === "tree" ? 1.9 : 1.25); if (dw > cap) { dh *= cap / dw; dw = cap; }
      g.save(); g.imageSmoothingEnabled = false;
      g.fillStyle = "#0004"; g.beginPath(); g.ellipse(x + tw / 2, y + th * .84, dw * .34, th * .1, 0, 0, Math.PI * 2); g.fill();
      g.drawImage(art, x + tw / 2 - dw / 2, y + th * .9 - dh, dw, dh); g.restore(); spriteLog("plants", `${o.type}-${stage}`, o);
      return [x + tw / 2 - dw / 2, y + th * .9 - dh, x + tw / 2 + dw / 2, y + th * .9];
    }
    // Imitate (account/imitation.js): one entry per psychology or values trait you have found on this target.
    function imitateMenu(target, deck, know) {
      const s = U.s, p = controlledFighter(s); if (!IM || !INS?.imitable || !p) return [];
      const has = (u, id) => (u.traits || []).some((t) => (t.id || t) === id), shown = E.demonstratedTraits ? E.demonstratedTraits(s, target.id) : [];
      const found = deck.cards.filter((c) => c.kind === "trait" && (c.open || know.revealed.includes(c.id)) && INS.imitable(c.trait) && has(target, c.trait));
      return found.filter((c) => !has(p, c.trait) || p.tempTraits?.[c.trait] || (s.imitation?.carried || []).includes(c.trait)).map((c) => {
        const T = INS.data.traits[c.trait], dyn = INS.dynamicsOf(c.trait), difficulty = INS.data.imitateDifficulty(c.trait) || 1;
        const chance = IM.chance({ difficulty, counters: dyn.counters.filter((id) => has(p, id)).length, synergies: dyn.synergies.filter((id) => has(p, id)).length, demonstrated: shown.includes(c.trait) });
        const practice = has(p, c.trait), done = (s.imitated || []).some((e) => e.actor === "player" && e.trait === c.trait);
        return { id: "imitate", trait: c.trait, label: `${practice ? "Practise" : "Imitate"}: ${T.name} · ${Math.round(chance * 100)}% · ${IM.rules.ap} AP`, off: p.tempo < IM.rules.ap || done,
          help: `${T.text} ${practice ? "You carry a copy: practising it is how it becomes yours." : `Take it on for ${IM.rules.tempBattles} battles.`} ${shown.includes(c.trait) ? "You have watched them act on it, which helps and counts double as practice." : ""}${done ? " Already practised this battle." : ""}` };
      });
    }
    // Capture ritual and beads (engine.js C18). Offered only when there is something to do with them.
    // The Animal Tamer (engine/tamer.js): tame the wild animal beside you, mark one of yours as your vessel, call the pack.
    function tamerMenu() {
      const s = U.s, p = controlledFighter(s), T = s?.rules?.tamer; if (!p || !T || !(p.traits || []).some((t) => (t.id || t) === T.trait)) return [];
      const out = [], mine = Object.values(s.actors).filter((u) => u.beast?.owner === p.id && u.beast.tamed && !u.defeated);
      for (const m of s.wild || []) if (m.form === "unit" && m.lf > 0 && !T.never.includes(m.kind) && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) === 1)
        out.push({ id: "tameBeast", target: m.id, label: `Tame the ${(m.name || m.kind).toLowerCase()} · ${T.tameAp} AP`, off: p.tempo < T.tameAp || mine.length >= T.maxTamed, why: mine.length >= T.maxTamed ? `You keep ${T.maxTamed} at most.` : "", help: "Hurt animals answer more readily; one coming for you, less. It fights at your side for the rest of the battle." });
      const marked = p.vessel && s.actors[p.vessel] && !s.actors[p.vessel].defeated;
      if (!marked && p.secondary !== "transmigration" && p.primary !== "transmigration")   // with Transmigration it is a technique for (const b of mine) if (Math.max(Math.abs(b.x - p.x), Math.abs(b.y - p.y)) <= T.markRange)
        out.push({ id: "markVessel", target: b.id, label: `Mark the ${b.name.toLowerCase()} as your vessel · ${T.markAp} AP`, off: p.tempo < T.markAp, help: "If you fall while it lives, you wake in its body, wounds and all, with every technique." });
      if ((p.ultimateCharge || 0) >= s.rules.ultimateChargeMax && p.secondary !== "transmigration" && p.primary !== "transmigration") out.push({ id: "callPack", label: `Call the Pack · ${T.pack.ap} AP · full bar`, off: p.tempo < T.pack.ap, help: "Two wild animals answer, tamed and yours until they fall." });
      return out;
    }
    function ritualMenu() {
      const s = U.s, p = controlledFighter(s); if (!p) return [];
      const out = [], R = { ap: 30, range: 4, weakBelow: 0.4, beadAp: 20, ...(s.rules.ritual || {}) };
      if (p.ritual) { const m = (s.wild || []).find((w) => w.id === p.ritual.monsterId) || s.actors[p.ritual.monsterId]; out.push({ id: "ritualHold", label: `Chanting · ${p.ritual.turnsLeft} left`, off: true, why: "Hold still and take no damage. Moving or being hurt breaks it. Guard and Stall are safe." }); }
      // Every wild monster on the field is listed, greyed with the reason when it cannot be bound yet. It used to appear
      // only at the moment one was both weak enough and in reach, so the ritual looked as if it were not in the game.
      // Wild creatures, and monsters of the mind: an opposing dream creature can be tamed the same way (Mala, 2026-10-14).
      else for (const m of [...(s.wild || []).filter((w) => w.form === "unit" && !w.suspended && !w.defeated && !w.fleeing),
        ...Object.values(s.actors).filter((u) => u.dream && !u.defeated && !u.boss && !u.tamed && u.side !== p.side),
        // The Wounded Ground can be bound too (Mala, 2026-10-26; the engine's ritual takes her). She is a boss, so the dream
        // filter above left her out and the capture never showed (Mala, 2026-10-27: "I couldnt capture Gaia in her wounded form").
        ...Object.values(s.actors).filter((u) => u.boss === "gaia" && u.gaiaForm === "disturbed" && !u.defeated && u.side !== p.side)]) {
        // A big unit is in reach from its nearest tile; the ritual is aimed there (the engine finds her on any of her tiles).
        const tiles = Array.from({ length: (m.size?.w || 1) * (m.size?.h || 1) }, (_, i) => [m.x + (i % (m.size?.w || 1)), m.y + Math.floor(i / (m.size?.w || 1))]), at = tiles.reduce((b, t) => E.geometry.dist(s, p.x, p.y, t[0], t[1]) < E.geometry.dist(s, p.x, p.y, b[0], b[1]) ? t : b, tiles[0]);
        const pct = Math.round(100 * m.lf / Math.max(1, m.maxLF)), d = E.geometry.dist(s, p.x, p.y, at[0], at[1]), weak = m.lf < m.maxLF * R.weakBelow, near = d <= R.range;
        const chanting = Object.values(s.actors).some((u) => u.ritual?.monsterId === m.id);   // the engine refuses a second chant (actions.js ritual)
        const no = chanting ? "Someone is already chanting over it." : !weak ? `Weaken it below ${Math.round(R.weakBelow * 100)}% first (it is at ${pct}%).` : !near ? `Get within ${R.range} tiles (it is ${d} away).` : p.tempo < R.ap ? `Needs ${R.ap} action points.` : "";
        out.push({ id: "ritual", at, label: `Capture ritual: ${m.name} · ${R.ap} AP`, off: !!no, why: no || "It is weak enough to bind. It hangs suspended while you chant: nothing can hit it and it cannot act. Hold still and unhurt for two of your turns and it becomes a bead." });
      }
      (p.beads || []).forEach((b, index) => {
        const at = [[p.x + 1, p.y], [p.x - 1, p.y], [p.x, p.y + 1], [p.x, p.y - 1]].find(([x, y]) => x >= 0 && y >= 0 && x < s.arena.w && y < s.arena.h && !E.geometry.actorAt(s, x, y) && !E.geometry.tileAt(s, x, y).blocksMove && !(s.wild || []).some((w) => w.form === "unit" && w.x === x && w.y === y));
        out.push({ id: "bead", index, at, label: `Release bead: ${b.name} · ${R.beadAp} AP`, off: !at || p.tempo < R.beadAp, why: `It fights beside you with ${Math.max(1, Math.ceil(b.maxLF * 0.5))} LF ${b.kind === "dream" && b.mind ? "and stays with you" : "for three turns, then goes back to the wild"}.` });
      });
      if (SL) for (const u of Object.values(s.actors).filter((u) => u.side === p.side && u.id !== p.id && !u.defeated))   // Duy's rule: name the precious ward a death-priced seal protects
        out.push({ id: `declareWard:${u.id}`, label: `Declare ${u.name} precious · ${SL.RULES.declareAp} AP`, off: p.tempo < SL.RULES.declareAp, why: s.wards?.[p.id]?.ward === u.id ? `${u.name} is already named.` : "Duy's rule: a death-priced seal opens only to protect something precious. One live declaration; re-declaring replaces." });
      return out;
    }
    function riteMenu() {   // Rites (Muse-2 rituals prototype): bank steps, then seal them into a technique
      const s = U.s, p = controlledFighter(s); if (!p) return [];
      const R = s.rules.rite || {}, out = [], rite = p.rite;
      const stepped = rite?.stepTurn === p.ownerTurns || p.riteStepTurn === p.ownerTurns, maxed = (rite?.steps?.length || 0) >= (R.maxSteps ?? 3);
      const artist = C.characters?.[p.character]?.subfaction === "ink" || (p.traits || []).some((t) => (t?.id || t) === "artist");
      const hands = p.status.bloodyHands?.expiresAt > p.ownerTurns, own = !!p.status.bleed;
      if (p.ritual) { out.push({ id: "riteNote", label: "Rites wait while you chant a capture", off: true, why: "One channel at a time. Finish or break the capture first." }); return out; }
      if (rite?.steps?.length) out.push({ id: "riteNote", label: `Rite banked: ${rite.steps.map((x) => x.type).join(" · ")} (holds ${rite.hold})`, off: true, why: "Each step banks twice its row in hold turns. Seal it into a technique, keep building (3 steps max), or abandon it. Damage can break concentration." });
      const wAp = R.wordsAp ?? 10, gAp = R.sigilsAp ?? 25, bLf = R.bloodLf ?? 3, dLf = R.deepLf ?? 8;
      const dreamy = !!s.dreamSpace, dEase = dreamy ? (R.dreamBloodEase ?? 2) : 0;   // blood runs easier in dreams (the dream seam)
      const bShow = Math.max(0, bLf - dEase), dShow = Math.max(0, dLf - dEase);
      const stepNo = stepped ? "One rite step per turn." : maxed ? "Three steps banked: seal or abandon." : "";
      out.push({ id: "riteWords", label: `Magic words · ${wAp} AP`, off: !!stepNo || p.tempo < wAp, why: stepNo || `Cheapest, lightest: +${R.wordsPotency ?? 2} potency on the sealed technique.` });
      out.push({ id: "riteSigils", label: artist ? `Drawn sigils · ${gAp} AP · notebook` : `Drawn sigils · ${gAp} AP · no move`, off: !!stepNo || p.tempo < gAp, why: stepNo || (artist ? `+${R.sigilsRange ?? 1} range on the sealed technique. Artists sketch from paper and keep moving.` : `+${R.sigilsRange ?? 1} range on the sealed technique. Kneeling to draw ends movement for the turn.`) });
      const bloodWhy = stepNo || (!hands && !own && p.lf <= bShow ? `Needs more than ${bShow} LF to open a vein.` : "");
      out.push({ id: "riteBlood", label: hands ? "Blood rite · enemy blood" : own ? "Blood rite · open wound" : `Blood rite · ${bShow} LF`, off: !!bloodWhy, why: bloodWhy || "Seals piercing into the technique. Bloody hands (from wounding a foe) or your own bleed spends no LF." });
      { const body = E.corpseBeside?.(U.s, controlledId(U.s)), bAp = E.burialAp?.(U.s, controlledId(U.s)), B = R.burial;
        if (B) { const no = stepNo || (!body ? "Stand beside a body." : p.moved && !(B.fastTraits || []).some((t) => (p.traits || []).some((x) => (x?.id || x) === t)) ? "Last Rites takes the whole turn: begin beside the body, before you move." : p.tempo < bAp ? `Needs ${bAp} AP.` : "");
          out.push({ id: "riteBurial", label: `Last rites · ${bAp} AP${body ? ` · ${body.name}` : ""}`, off: !!no, why: no || `Bury the body: +${B.potency} potency banked, a tended grave (−${B.graveWard} to hits on your side beside it), land wounds eased; burying an ally charges every ally +${B.honorUlt} ULT.` }); } }
      out.push({ id: "riteDeep", label: `Deep cut · ${dShow} LF · +1 charge`, off: !!stepNo || p.lf <= dShow, why: stepNo || "The willing wound: piercing plus a bonus charge. Strongest step, steepest price." });
      if (rite?.steps?.length) {
        out.push({ id: "riteComplete", label: `Seal the rite${dreamy ? ` · dream +${R.dreamSealBonus ?? 1}` : ""}`, off: false, why: "Bank the steps into a shared augment pool, then check techniques to spend it." });
        out.push({ id: "riteAbandon", label: "Abandon rite", off: false, why: "Let the banked steps go." });
      }
      const g = p.riteAugment;
      if (g && g.charges > 0) {
        out.push({ id: "riteNote", label: `Rite-ink: ${g.charges} charge${g.charges === 1 ? "" : "s"}${g.potencyAdd ? ` +${g.potencyAdd} pot` : ""}${g.rangeAdd ? ` +${g.rangeAdd} rng` : ""}${g.piercing ? " pierce" : ""}${g.bleedRider ? ` ${g.bleedRider}bld` : ""}`, off: true, why: "Checked techniques draw from this pool when used. Each use spends one charge." });
        for (const x of E.availableAbilities(s, controlledId(s)).filter((x) => E.riteDraws(C.abilities[x.id]))) {
          const on = !!g.checked[x.id];
          out.push({ id: `riteTog:${x.id}`, label: `${on ? "☑" : "☐"} ${x.m.name}`, off: false, why: on ? "Drawing from the rite-ink. Tap to uncheck." : "Tap to let this technique draw from the rite-ink." });
        }
      }
      return out;
    }
    // Traps (terrain/traps.js). The menu offers what the engine will accept; the map shows only what the player knows:
    // their own side's traps, and enemy traps they have spotted.
    // Houses (engine/houses.js): beside the house, buy it, or invest (the larger stake owns it and is paid). Break it with a Strike.
    function houseMenu() {
      const s = U.s, p = controlledFighter(s), R = s?.rules?.houses; if (!p || !R) return [];
      const cost = s.rules.actionCosts.utility ?? 20;   // property rights: open claims can be sued from anywhere (engine/houses.js)
      const suits = (s.propertyClaims || []).filter((c) => c.status === "open" && c.side === p.side).map((c) => ({ id: "sueForRestitution", claim: c.id,
        label: `Sue ${c.name} for restitution · ${cost} AP (${c.amount} damage, ${c.grade})`, off: p.tempo < cost,
        help: c.grade === "witnessed" ? `Proven: ${c.amount} owed, no cap. The house is repaired and ${c.name} pays it off at half of each turn's action points.` : "Nobody on your side saw it: the case will be dismissed." }));
      const o = (s.arena.objects || []).find((q) => q.type === "house" && (q.hp ?? 0) > 0); if (!o || Math.max(Math.abs(o.x - p.x), Math.abs(o.y - p.y)) !== 1) return suits;
      const h = o.house, mine = h.stakes[p.side] || 0, theirs = h.stakes[p.side === "player" ? "enemy" : "player"] || 0, out = [];
      if (!h.side) return [...suits, { id: "buyHouse", label: `Buy the house · ${R.price} AP`, off: p.tempo < R.price, why: p.tempo < R.price ? `Needs ${R.price} AP.` : "", help: "Your side owns it: from next round it pays action points to your units standing beside it at round start. The other side can out-invest you or break it." }];
      const room = R.stakeCap - mine;
      if (h.side !== p.side) { const need = theirs - mine + 1;
        out.push({ id: "investHouse", amount: need, label: `Take the majority · invest ${need} AP (${mine} to ${theirs})`, off: p.tempo < need || need > room, why: p.tempo < need ? `Needs ${need} AP.` : need > room ? `Over the stake cap (${R.stakeCap}).` : "", help: "Put in more than they have: the house and its payout become your side's. Or Strike it down: every stake is lost." }); }
      const all = Math.min(p.tempo, room);
      out.push(...suits);
      if (all > 0) out.push({ id: "investHouse", amount: all, label: `Invest ${all} AP in the house (stakes ${mine} to ${theirs})`, off: false, help: `The larger stake owns the house. Every ${R.dividend.bankPer} of the owner's stake adds 1 to the payout.` });
      return out;
    }
    function cartMenu() {
      const s = U.s, p = controlledFighter(s), CR = root.ConceptCombatClassRuntime; if (!p || !CR?.cartOf) return [];
      const cost = s.rules.actionCosts.utility ?? 20, full = (p.inventory || []).length >= (p.inventoryCapacity || 0), out = [];
      for (const m of Object.values(s.actors)) {
        if (m.id === p.id || m.side !== p.side || m.defeated || Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) > 1) continue;
        for (const it of new Set((CR.cartOf(s, m)?.stored || []).filter((x) => x.kind === "item").map((x) => x.item)))
          out.push({ id: "takeFromCart", from: m.id, item: it, label: `Take ${Loot?.data?.consumables?.[it]?.name || it} from ${m.name}'s cart · ${cost} AP`, off: full || p.tempo < cost,
            why: full ? `Your hands are full (${p.inventoryCapacity || 0} slots).` : "She tidied it off the floor; it is yours to use now." });
      }
      return out;
    }
    function trapMenu() {
      const s = U.s, p = controlledFighter(s); if (!TRP || !p) return [];
      const R = TRP.rules, here = TRP.live(s.traps, p.x, p.y).length > 0, out = [];
      if (TRP.canSet(p)) out.push({ id: "placeTrap", label: `Set a trap here · ${R.placeAp} AP`, off: p.tempo < R.placeAp || here,
        why: here ? "There is already a trap on this tile." : "Hidden best where no enemy can see the tile (90%); in plain sight it is easy to spot (30%). Anyone who steps on it takes 8, aware or not — only staying off saves you." });
      for (const t of (s.traps || []).filter((t) => !t.spent && t.ownerSide !== p.side && TRP.known(p, t) && Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y)) <= 1))
        out.push({ id: "disarm", at: [t.x, t.y], label: `Disarm (${t.x},${t.y}) · ${R.disarm.costMin}+ AP`, off: p.tempo < R.disarm.minAp,
          why: `${Math.round((R.disarm.base + (p.traits || []).some((x) => (x.id || x) === R.disarm.trait) * R.disarm.tinkererAdd) * 100)}% to disarm. Needs ${R.disarm.minAp} action points in hand; what it costs beyond what you have becomes debt.` });
      return out;
    }
    function drawTraps(tw, th) {
      const s = U.s, p = controlledFighter(s); if (!TRP || !p) return;
      for (const t of (s.traps || []).filter((t) => !t.spent && (t.ownerSide === p.side || TRP.known(p, t)))) {
        onGround(t.x, t.y, () => { const [cx, cy] = centre(t.x, t.y), mine = t.ownerSide === p.side, r = tw * .13;
        g.save(); g.translate(cx, cy + th * .18); g.strokeStyle = mine ? "#9ad1ff" : "#ef6f6c"; g.fillStyle = mine ? "#12203acc" : "#3a1212cc"; g.lineWidth = 2;
        g.beginPath(); g.ellipse(0, 0, r * 1.5, r * .8, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(i * r * .5, -r * .1); g.lineTo(i * r * .5 + r * .22, -r * .75); g.lineTo(i * r * .5 + r * .44, -r * .1); } g.stroke();   // the teeth
        g.restore(); }, false);
      }
    }
    function drawMapObject(o, x, y, tw, th, palette) {
      // A dead communed plant: its fallen communal form (the defeated ally's knocked-out art) is the body. Only when
      // that species has no communal art is the plant itself drawn, withered.
      if (o.dead) {
        const fallen = o.corpseOf && U.s?.actors?.[o.corpseOf];
        if (fallen && poseSprites[communeArt(fallen.sprite)]?.["knocked-out"]?.naturalWidth) return;
        g.save(); g.filter = "grayscale(1) brightness(.55)"; const drawn = drawLivingObject(o, x, y, tw, th, palette); g.restore(); return drawn;
      }
      return drawLivingObject(o, x, y, tw, th, palette);
    }
    function drawLivingObject(o, x, y, tw, th, palette) {
      // Sprite art answers with the rectangle it filled, which is what the isometric board needs to know what it covers.
      const plant = o.kind === "plant" && drawSpeciesPlant(o, x, y, tw, th); if (plant) return plant;
      const spriteId = o.kind === "plant" ? (o.form === "tree" ? "tree" : o.form) : o.type === "house" ? o.sprite : o.type?.startsWith("parterre") ? `parterre/${o.type}` : o.type;   // parterre art lives in its own folder
      const art = worldSprite("objects", spriteId);
      if (art) {
        // Keep the art's own proportions (Mala, 2026-10-27: "size and distortion issues"): a fixed 1.5 x 1.5 box stretched tall
        // statues up to 3x and squashed hedges. Fit the visible art inside the old box's height (1.5 tile heights; trees 1.9) and a tile's width, keeping its shape.
        const tall = spriteId === "tree", b = artBox(art), maxW = tw * (tall ? 1.6 : 1.1), maxH = th * (tall ? 1.9 : 1.5), k = Math.min(maxW / b.w, maxH / b.h), dw = b.w * k, dh = b.h * k; y -= spriteFoot(th);
        g.save(); g.imageSmoothingEnabled = false; g.drawImage(art, b.x, b.y, b.w, b.h, x + tw/2 - dw/2, y + th*.88 - dh, dw, dh); g.restore(); spriteLog("objects", spriteId, o);
        return [x + tw/2 - dw/2, y + th*.88 - dh, x + tw/2 + dw/2, y + th*.88];
      }
      if (o.kind === "plant") {
        if (o.form === "tree") return drawTree(x, y, tw, th, o.canopy || 0);
        if (o.form === "hedge") return drawHedge(x, y, tw, th);
        const cx = x + tw * .5, cy = y + th * .43;
        g.fillStyle = o.form === "groundcover" ? "#7daa61" : "#4e804c";
        for (let i = 0; i < (o.form === "groundcover" ? 7 : 5); i++) { const dx = ((i * 13 + o.x * 7) % 15 - 7) * tw / 28, dy = ((i * 9 + o.y * 5) % 7 - 3) * th / 16; g.beginPath(); g.ellipse(cx + dx, cy + dy, tw * .09, th * .14, (i % 3) * .8, 0, Math.PI * 2); g.fill(); }
        return;
      }
      const cx = x + tw * .5, top = y + th * .16;
      g.fillStyle = "#0006"; g.beginPath(); g.ellipse(cx, y + th * .58, tw * .32, th * .14, 0, 0, Math.PI * 2); g.fill();
      if (o.type === "boulder") {
        g.fillStyle = "#6f716f"; g.beginPath(); g.moveTo(x+tw*.19,y+th*.5); g.lineTo(x+tw*.25,y+th*.25); g.lineTo(x+tw*.44,y+th*.12); g.lineTo(x+tw*.69,y+th*.18); g.lineTo(x+tw*.82,y+th*.42); g.lineTo(x+tw*.7,y+th*.55); g.closePath(); g.fill();
        g.fillStyle = "#aaaba2"; g.beginPath(); g.moveTo(x+tw*.25,y+th*.25); g.lineTo(x+tw*.44,y+th*.12); g.lineTo(x+tw*.69,y+th*.18); g.lineTo(x+tw*.53,y+th*.31); g.closePath(); g.fill(); return;
      }
      if (o.type === "bench") {
        g.fillStyle = "#6b4935"; g.fillRect(x+tw*.19,y+th*.28,tw*.62,th*.14); g.fillRect(x+tw*.22,y+th*.47,tw*.56,th*.1); g.fillStyle = "#4c3d35"; g.fillRect(x+tw*.28,y+th*.55,tw*.07,th*.16); g.fillRect(x+tw*.66,y+th*.55,tw*.07,th*.16); return;
      }
      if (o.type === "bollard") { g.fillStyle="#9b9b94"; g.fillRect(cx-tw*.09,y+th*.22,tw*.18,th*.34); g.fillStyle="#c5c1b7"; g.fillRect(cx-tw*.12,y+th*.18,tw*.24,th*.1); return; }
      if (o.type === "fence") { g.strokeStyle="#956744"; g.lineWidth=Math.max(2,tw*.045); for(let i=0;i<4;i++){const xx=x+tw*(.22+i*.18);g.beginPath();g.moveTo(xx,y+th*.19);g.lineTo(xx,y+th*.66);g.stroke();} g.lineWidth=Math.max(2,tw*.05); for(const yy of [.34,.52]){g.beginPath();g.moveTo(x+tw*.15,y+th*yy);g.lineTo(x+tw*.85,y+th*yy);g.stroke();} return; }
      if (o.type === "window") { g.fillStyle="#9ec4d4cc"; g.fillRect(x+tw*.18,y+th*.16,tw*.64,th*.5); g.strokeStyle="#e7f4f8"; g.lineWidth=Math.max(2,tw*.04); g.strokeRect(x+tw*.18,y+th*.16,tw*.64,th*.5); g.beginPath(); g.moveTo(x+tw*.5,y+th*.16); g.lineTo(x+tw*.5,y+th*.66); g.moveTo(x+tw*.18,y+th*.41); g.lineTo(x+tw*.82,y+th*.41); g.stroke(); return; }
      if (o.type === "cistern") { g.fillStyle="#4e6270"; g.beginPath(); g.ellipse(cx,y+th*.35,tw*.29,th*.23,0,0,Math.PI*2); g.fill(); g.fillStyle="#7f9aa0"; g.beginPath(); g.ellipse(cx,y+th*.29,tw*.29,th*.22,0,0,Math.PI*2); g.fill(); g.fillStyle="#304955"; g.beginPath(); g.ellipse(cx,y+th*.28,tw*.18,th*.12,0,0,Math.PI*2); g.fill(); return; }
      if (o.type === "planter") { g.fillStyle="#a77753"; g.beginPath(); g.moveTo(x+tw*.2,y+th*.22);g.lineTo(x+tw*.8,y+th*.22);g.lineTo(x+tw*.72,y+th*.62);g.lineTo(x+tw*.28,y+th*.62);g.closePath();g.fill();g.fillStyle="#493f32";g.fillRect(x+tw*.25,y+th*.24,tw*.5,th*.1);return; }
      if (o.type === "monument") { g.fillStyle="#888078";g.fillRect(x+tw*.28,y+th*.19,tw*.44,th*.44);g.fillStyle="#b5a995";g.beginPath();g.moveTo(x+tw*.24,y+th*.22);g.lineTo(cx,y+th*.08);g.lineTo(x+tw*.76,y+th*.22);g.closePath();g.fill();g.fillStyle="#bcae92";g.fillRect(x+tw*.2,y+th*.62,tw*.6,th*.08);return; }
      if (o.type === "stump") { g.fillStyle="#76533a";g.fillRect(cx-tw*.19,y+th*.35,tw*.38,th*.22);g.fillStyle="#c09666";g.beginPath();g.ellipse(cx,y+th*.35,tw*.19,th*.1,0,0,Math.PI*2);g.fill();g.strokeStyle="#77563e";g.beginPath();g.ellipse(cx,y+th*.35,tw*.09,th*.045,0,0,Math.PI*2);g.stroke();return; }
      if (o.type === "log" || o.type === "roots") { g.strokeStyle="#76543b";g.lineWidth=tw*.16;g.lineCap="round";g.beginPath();g.moveTo(x+tw*.23,y+th*.52);g.quadraticCurveTo(cx,y+th*.31,x+tw*.77,y+th*.47);g.stroke();g.lineWidth=1;g.strokeStyle="#c09767";g.beginPath();g.moveTo(x+tw*.25,y+th*.48);g.lineTo(x+tw*.73,y+th*.44);g.stroke();return; }
      if (o.type === "dataCenter") {   // fallback when objects/dataCenter.png hasn't loaded: a server rack with its lights on (docs/data-center.md)
        g.fillStyle="#232b36"; g.fillRect(x+tw*.24,y+th*.1,tw*.52,th*.52); g.fillStyle="#3a4757"; g.fillRect(x+tw*.24,y+th*.06,tw*.52,th*.06);
        for(let i=0;i<4;i++){ g.fillStyle="#141a22"; g.fillRect(x+tw*.29,y+th*(.16+i*.11),tw*.42,th*.07); g.fillStyle=o.hp<=o.maxHp/2&&i%2?"#d9793b":"#58e0a0"; g.fillRect(x+tw*.32,y+th*(.18+i*.11),tw*.05,th*.03); g.fillStyle="#5aa9ff"; g.fillRect(x+tw*.4,y+th*(.18+i*.11),tw*.05,th*.03); }
        return; }
      if (o.type === "workstation") {   // the Modern Artist's laptop: base + glowing screen, HP states like the dataCenter fallback
        const frac = o.maxHp ? o.hp / o.maxHp : 1, scr = frac > .5 ? "#5aa9ff" : frac > 0 ? "#d9793b" : "#3a3f4a";
        g.fillStyle = "#2b2f38"; g.fillRect(x+tw*.2, y+th*.52, tw*.6, th*.09);
        g.fillStyle = "#14161c"; g.fillRect(x+tw*.24, y+th*.14, tw*.52, th*.38);
        g.fillStyle = scr; g.fillRect(x+tw*.28, y+th*.18, tw*.44, th*.3);
        g.fillStyle = "#0e1420cc"; for (let i = 0; i < 3; i++) g.fillRect(x+tw*.32, y+th*(.23+i*.08), tw*(.36-i*.08), th*.028);
        return; }
      // Future object art still has a distinct, legible placeholder silhouette.
      g.fillStyle = palette.ink; g.fillRect(x + tw * .28, top + th * .12, tw * .44, th * .36);
    }
    function drawSpeechBubbles() {
      if (!U.dialogueOn || !U.bubbles.length) return;
      const now = performance.now(); U.bubbles = U.bubbles.filter((b) => b.until > now);
      for (const b of U.bubbles.slice(-2)) {
        const a = U.s.actors[b.actor]; if (!a || unseen(a.x, a.y) || (a.defeated && b.event !== "defeat")) continue;
        const [cx, cy] = centre(a.x, a.y), font = Math.max(10, Math.min(14, geo.tw * .16));
        g.font = `600 ${font}px -apple-system, sans-serif`; g.textAlign = "left"; g.textBaseline = "top";
        const head = headImage(b.heads || b.speaker, b.face), tx = head ? 54 : 9;
        const maxWidth = Math.min(head ? 234 : 190, geo.W - 24), words = b.text.split(/\s+/), lines = []; let line = "";
        for (const word of words) { const next = line ? `${line} ${word}` : word; if (g.measureText(next).width > maxWidth - tx - 9 && line) { lines.push(line); line = word; } else line = next; }
        if (line) lines.push(line);
        if (lines.length > 3) { lines.length = 3; let last = lines[2]; while (g.measureText(last + "…").width > maxWidth - tx - 9 && last.length > 4) last = last.slice(0, -1); lines[2] = last.trimEnd() + "…"; }
        const width = Math.min(maxWidth, Math.max(head ? 126 : 82, ...lines.map((v) => g.measureText(v).width + tx + 9))), height = lines.length * (font + 3) + 12;
        const left = Math.max(8, Math.min(geo.W - width - 8, cx - width / 2));
        const top = Math.max(8, cy - geo.th * 1.4 - height);
        g.globalAlpha = Math.min(1, (b.until - now) / 260);
        g.fillStyle = "#10131bed"; g.strokeStyle = "#e8a4bd"; g.lineWidth = 1.5;
        roundRect(left, top, width, height, 7); g.fill(); g.stroke();
        g.fillStyle = "#10131b"; g.beginPath(); g.moveTo(cx - 5, top + height - 1); g.lineTo(cx + 5, top + height - 1); g.lineTo(cx, top + height + 7); g.closePath(); g.fill();
        if (head) {
          const hw = 42, hh = height - 12, scale = Math.max(hw / head.naturalWidth, hh / head.naturalHeight);
          const sw = hw / scale, sh = hh / scale;
          g.drawImage(head, (head.naturalWidth - sw) / 2, (head.naturalHeight - sh) / 2, sw, sh, left + 6, top + 6, hw, hh);
        }
        g.fillStyle = "#fff3f5"; lines.forEach((text, i) => g.fillText(text, left + tx, top + 6 + i * (font + 3)));
        g.globalAlpha = 1;
      }
    }
    function animate() {
      cancelAnimationFrame(U.raf); clearTimeout(U.weatherTimer);
      const loop = () => {
        draw(); updateAttackPopup();
        const now = performance.now(), posing = Object.values(U.poseUntil).some((x) => x.until > now), actionCueActive = Object.values(U.actionCues).some((x) => x.until > now);
        const transforming = Object.values(U.transformAnimations).some(x => x && now - x.started < x.sequence.reduce((n, f) => n + f.ms, 0));
        const gaiaVeilActive = !!(U.s && GF?.veil(U.s));
        if (U.closeup || (U.fxFrame&&!U.fxFrame.done) || U.bubbles.some((b) => b.until > now) || (U.s && (U.s.pending || U.s.dreamSpace)) || gaiaVeilActive || posing || actionCueActive || transforming) U.raf = requestAnimationFrame(loop);
        // Weather with an overlay keeps moving, but at about 8 frames a second: a full redraw every frame for rain alone is waste.
        else if (U.s && !U.s.outcome && Climate && U.s.weatherState && WEATHER_ART[U.s.weatherState.id] && U.mode !== "setup") { clearTimeout(U.weatherTimer); U.weatherTimer = setTimeout(() => { U.raf = requestAnimationFrame(loop); }, 120); }
      };
      loop();
    }

    // ── windows ───────────────────────────────────────────────────────────
    function renderPanel(name, fn) {
      try { fn(); }
      catch (error) {
        console.error(`Combat ${name} rendering failed.`, error); recordDiagnostic(`Combat ${name} rendering failed`,error);
        const el = $("ccLog");
        if (el) {
          const warning = document.createElement("li"); warning.className = "cc-render-warning";
          warning.textContent = name === "log"
            ? "Battle log could not render; combat is continuing."
            : `Display recovery: ${name} panel failed to draw; combat log remains available.`;
          el.prepend(warning);
        }
      }
    }
    function render() {
      if (!U.s) return;
      // Paint the log first and isolate each view. An unrelated canvas, party,
      // or command-panel exception must never leave the primary event record blank.
      renderPanel("log", renderLog);
      renderPanel("arena", () => { syncViewBar(); syncBoardTabs(); syncZoomBar(); layout(); draw(); });
      renderPanel("banner", renderBanner);
      renderPanel("agent connection", renderAgentControls);
      renderPanel("commands", renderCommands);
      renderPanel("detail", renderDetail);
      renderPanel("party", renderParty);
      renderPanel("unit window", renderUnitInfo);
      renderPanel("mind duel", renderMindDuel);
      if (!$("ccGraph").hidden) renderPanel("concept map", renderGraph);
    }
    // Unit window (insight/hover.js windowHtml): click a unit to pin what the player knows about it. It re-renders with
    // every state change, so LF and newly noticed traits update in place. Unobserved traits never reach the page.
    // Equipment on the stat sheet (Mala, 2026-10-26: "the passives of your equipped items should be on display somewhere on
    // your character stat sheet"): each worn piece and what it does; worn-out pieces say they do nothing until repaired.
    function gearLine() {
      if (!Loot || !U.account) return "";
      const a = Loot.withBags(U.account), worn = Object.entries(a.gear.equipped).filter(([, id]) => Loot.data.equipment[id]);
      if (!worn.length) return `<div class="cc-muted cc-gear-line">Equipment: none worn (Field Kit &amp; Account)</div>`;
      return `<div class="cc-muted cc-gear-line"><b>Equipment</b> ${worn.map(([, id]) => { const it = Loot.data.equipment[id], spent = (a.gear.durability?.[id] ?? 1) <= 0;
        return `<span class="cc-gear-item${spent ? " is-worn" : ""}" title="${esc(it.text || "")}">${esc(it.name)}: ${spent ? "worn out, no effect until repaired" : esc(String(it.text || "").replace(/\.$/, ""))}</span>`; }).join("")}</div>`;
    }
    function renderUnitInfo() {
      const panel = $("ccUnitInfo"); if (!panel) return;
      const HC = root.ConceptCombatHover, t = U.unitInfo && (U.s?.actors?.[U.unitInfo] || (U.s?.wild || []).find((m) => m.id === U.unitInfo && m.lf > 0));
      const visible = t && !t.notArrived && HC?.windowHtml && !unseen(t.x, t.y);
      if (!visible) { panel.hidden = true; panel.innerHTML = ""; if (U.unitInfo && (!t || t.notArrived)) U.unitInfo = null; return; }
      root.ConceptCombatStatus.replace(panel, HC.windowHtml(HC.knownCard(U.s, t.id, { viewer: "player", content: C, insight: INS, monsters: root.ConceptCombatEnemyDreams, wild: W?.data?.monsters, stance: E.stance(U.s, "player", t.id), hostileSides: E.hostileSides(U.s, t.id) }), esc));
      if ((t.sprite || "").startsWith("tsukumogami")) { const face = faceFile(SPRITE_DIR[t.sprite] || t.sprite, "neutral"); if (face) panel.insertAdjacentHTML("afterbegin", `<img class="cc-unit-face" src="${face}" alt="">`); }   // the house looks back
      if (t.id === "player" && !t.soulOf) panel.insertAdjacentHTML("beforeend", gearLine());
      if (PR) panel.insertAdjacentHTML("beforeend", `<div class="cc-muted cc-gear-line"><b>Beauty</b> ${PR.beautyOf(t)} · <b>Will</b> ${t.willpower ?? 10}/${t.maxWillpower ?? 10}</div>`);
      if (DB && (DB.book(U.s, t.id).owed > 0 || U.s.debtVisits?.[t.id])) { const b = DB.book(U.s, t.id); panel.insertAdjacentHTML("beforeend", `<div class="cc-muted cc-gear-line"><b>Debt</b> ${b.owed}${b.lender ? ` (${(DB.LENDERS.find((l) => l.id === b.lender) || {}).name || b.lender})` : ""}${U.s.debtVisits?.[t.id] ? " · visit due" : ""}${U.s.round <= b.frozenUntil ? " · frozen" : ""}</div>`); }
      { const downs = E.mysteryOwnView(U.s, t.side).filter((c) => c.unitId === t.id);   // Mystery tray: own side sees all, foe sees the side count only
        const foeCount = t.side === "player" ? 0 : E.mysteryFoeView(U.s, t.side).count;
        if (downs.length || foeCount) panel.insertAdjacentHTML("beforeend", t.side === "player"
          ? `<div class="cc-muted cc-gear-line"><b>Face-down</b> ${downs.map((c) => `${esc(C.abilities[c.ability]?.name || c.ability)} (${esc(c.trigger)}, age ${c.age})`).join(" · ")} <button type="button" data-myst-reveal="${esc(t.id)}">Reveal</button></div>`
          : `<div class="cc-muted cc-gear-line"><b>Face-down</b> ${foeCount} set plan${foeCount === 1 ? "" : "s"} on their side</div>`);
        panel.querySelector("[data-myst-reveal]")?.addEventListener("click", () => { act({ type: "revealIntent", actor: t.id }); }); }
      panel.hidden = false;
      // Dock on the side away from the unit so the window never covers what it describes.
      panel.classList.toggle("cc-unitinfo-left", centre(t.x, t.y)[0] > cv.getBoundingClientRect().width / 2);
      panel.querySelector("[data-unitinfo-close]").onclick = () => openUnitInfo(null);
    }
    function openUnitInfo(id) {
      U.unitInfo = id && id !== U.unitInfo ? id : null;      // clicking the same unit again closes it
      renderUnitInfo(); draw();
    }
    function unitInfoAt(t) {
      if (!t || !U.s || unseen(t[0], t[1])) return false;
      const a = E.geometry.actorAt(U.s, ...t) || (U.s.wild || []).find((m) => m.form === "unit" && m.lf > 0 && m.x === t[0] && m.y === t[1]);   // a wild animal opens its card too
      if (!a) { if (U.unitInfo) openUnitInfo(null); return false; }
      openUnitInfo(a.id); return true;
    }
    function renderBanner() {
      const s = U.s, d = E.decider(s), a = d ? s.actors[d.actor] : null;
      const p = controlledFighter(s);
      if (s.film && !p) {   // the player is off-camera (stashed): the set is the whole banner
        const mine = s.film.owner === "player";
        $("ccBanner").innerHTML = `<span>Round ${s.round} · ${esc(s.arena.name)} (the battle holds its breath)</span><b>🎬 ON SET · Take ${s.film.turn}</b>` +
          (mine ? `<button id="ccCallCut" title="Wrap the shoot now. Counts as a dud (35 AP debt, no premiere, streak ends).">Call CUT · dud</button>` : "") +
          `<span class="cc-pip">Seeds ${U.account.seeds}</span>`;
        const cut = $("ccCallCut");
        if (cut) cut.onclick = () => { if (!act({ type: "callCut", actor: "player" })) flashTip("No film of yours is shooting."); };
        return;
      }
      const eventNow = s.randomEventSchedule?.find(e => e.round === s.round);
      const nextEvent = s.randomEventSchedule?.find(e => !e.resolved);
      $("ccBanner").innerHTML = s.outcome ? `<b>${s.outcome.winner === "player" ? "Victory" : s.outcome.winner === "enemy" ? "Defeat" : "Stopped"}</b><span class="cc-pip">Seeds ${U.account.seeds}</span>`
        : `<span>Round ${s.round} · ${esc(s.arena.name)}</span><b style="color:${SPRITE[a.sprite] || "#e5e7eb"}">${esc(a.name)}${d.kind === "response" ? " · responding" : d.kind === "mind" ? " · arguing" : "'s turn"}</b>` +
          `<span class="cc-pip" title="Persistent account currency">Seeds ${U.account.seeds}</span>` +
          (Board && U.account.board?.accepted ? `<span class="cc-pip" title="Contract: ${esc(Board.describe((U.account.board.postings || []).find((m) => m.id === U.account.board.accepted) || { condition: "gone", payout: 0 }))}">📋 Contract</span>` : "") +
          (s.themedBattle === "jackpot" && E.jackpotMeter ? `<span class="cc-pip" title="The table's pot: 10 a round, 25 a fallen rival. Winner takes it.">Jackpot ${E.jackpotMeter(s)}</span>` : "") +
          (E.gamblerHeat && E.gamblerHeat(s, controlledId(s)) > 0 ? `<span class="cc-pip" title="Rhythm of madness: +5% a stack on imitate and tame. Double down to cash it for charge.">Heat ${E.gamblerHeat(s, controlledId(s))}</span>` : "") +
          (s.randomEventSchedule?.length ? `<span class="cc-pip cc-event-pip" title="${esc(RE?.forecast(s.randomEventSchedule) || "Random events are scheduled for opening, midpoint and countdown.")}">Event · ${esc(eventNow ? `${eventNow.label}: ${RE?.labels[eventNow.type] || eventNow.type}` : nextEvent ? `Next ${nextEvent.label}: ${RE?.labels[nextEvent.type] || nextEvent.type}` : "All scheduled events resolved")}</span>` : "") +
          (s.time ? `<span class="cc-pip cc-time-${s.time.phase}" title="${s.time.phase === "night" ? "Night: creatures come in from the dark and leave at dawn; opening a Dream Space is easier" : "Day"} · ${E.roundsToFlip(s)} round${E.roundsToFlip(s) === 1 ? "" : "s"} until ${s.time.phase === "night" ? "dawn" : "nightfall"}">${s.time.phase === "night" ? "☾ Night" : "☀ Day"} · ${E.roundsToFlip(s)}</span>` : "") +
          (s.weatherState && Climate ? `<span class="cc-pip" title="Weather changes can alter propagation, sight and exposure">${esc(Climate.data.weather[s.weatherState.id]?.name || s.weatherState.id)}</span>` : "") +
          (s.randomDreamRift ? `<span class="cc-pip cc-dream-pip">Dream Rift · ${s.randomDreamRift.turnsRemaining} wave${s.randomDreamRift.turnsRemaining === 1 ? "" : "s"}</span>` : "") +
          (s.vignette ? `<span class="cc-pip" title="${esc(s.vignette.objective.kind)}">${esc(s.vignette.objective.label)} · ${s.vignette.objectiveProgress}/${s.vignette.objective.turns} · defeat ${esc(s.actors[`boss-${s.vignette.branch}`]?.name || s.vignette.branch)} or break objective</span>` : "") +
          (s.modeSetup && MD ? `<span class="cc-pip">${esc(MD.objectiveText(s.modeSetup, { round: s.round, units: Object.values(s.actors), wild: s.wild }))}</span>` : "") +
          (d.actor === controlledId(s) && d.kind === "turn" ? `<span class="cc-ap-status" title="Action points available for your current turn"><b>AP</b><strong>${p.tempo}</strong><small>/${p.tempoCapacity}</small></span>${p.bankedTempo ? `<span class="cc-pip">Banked ${p.bankedTempo} AP</span>` : ""}${E.heldCostMul(s, controlledId(s)) !== 1 ? `<span class="cc-pip" title="Contact Reading: while you are in this hold every action costs you this multiple of its action points, breaking out included.">Held · costs ×${E.heldCostMul(s, controlledId(s))}</span>` : ""}${p.tempoDebt ? `<span class="cc-warn">Debt ${p.tempoDebt} AP</span>` : ""}${(() => { const t = E.tallyStatus?.(s, controlledId(s)); return t && (t.owed || t.call) ? `<span class="cc-warn" title="What you owe him: tempo debt plus loans not yet due. At ${t.threshold} or more, your highest-cost technique is held as collateral.">Owed ${t.owed}/${t.threshold}${t.held ? ` · ${esc(t.heldName)} held` : ""}${t.call ? " · CALL DUE" : ""}</span>` : ""; })()}` : "") +
          (p.character==="cyph" ? `<span class="cc-pip">Service · ${p.status.cyphStock??3}/3</span><span class="cc-pip">Pocket · ${esc(p.status.cyphPocket?.until>=p.ownerTurns ? C.abilities[p.status.cyphPocket.id]?.name||"held bar" : "empty")}</span>` : "") +
          (p.inventory?.length ? `<span class="cc-pip cc-pack-status" title="Carried battle items">Pack · ${p.inventory.map(id => esc(Loot.data.consumables[id]?.name || W?.data.items[id]?.name || id)).join(", ")}</span>` : "") +
          ((p.primary === "gradingDrainage" || p.secondary === "gradingDrainage" || p.earthStock > 0) ? `<span class="cc-pip" title="Cut soil is conserved in this stock; fill spends it">Earth ${p.earthStock || 0}/12</span>` : "") +
          `<span class="cc-pip" title="Ultimate charge earned by using concept techniques">ULT ${p.ultimateCharge ?? 0}/${s.rules.ultimateChargeMax}</span>` +
          (p.embodied ? `<span class="cc-pip" title="Contains Multitudes: you are also this class, with its kit in place of your secondary concept.">Also the ${esc(p.embodied.name)} · ${E.multitudes(s, controlledId(s)).turnsLeft} turn${E.multitudes(s, controlledId(s)).turnsLeft === 1 ? "" : "s"}</span>` : "") +
          (s.rules.inspiration ? `<span class="cc-pip" title="Inspiration: earned by chance in rare moments, kept between battles. It can pay a vow's price in place of a restriction.">Inspiration ${p.inspiration || 0}/${s.rules.inspiration.cap}</span>` : "") +
          `<span class="cc-pip ${p.reaction ? "" : "used"}">Reaction ${p.reaction ? "●" : "○"}</span>` +
          (p.absorbedRound === s.round && !p.reaction ? `<span class="cc-pip used" title="You spent the turn on Investigate.">Absorbed: no reaction until next round.</span>` : "") +
          (s.dreamSpace ? `<span class="cc-pip cc-dream-pip">${s.dreamSpace.region ? `Focused Dream · radius ${s.dreamSpace.region.radius} · ${Math.round(s.dreamSpace.appearChance*100)}% intrusion` : "Dream Space"} · ${s.actors[s.dreamSpace.owner]?.ultimateCharge ?? 0}% clock</span>` : "") +
          (s.film ? `<span class="cc-pip cc-dream-pip" title="A pocket duel: the outside battle resumes when the scene ends.">🎬 ON SET · Take ${s.film.turn}</span>` : "") +
          (s.scheduled.length ? `<span class="cc-warn">⏱ ${s.scheduled.map((e) => `${esc(e.inst.name)} → ${esc(s.actors[e.trigger.actor].name)}'s turn start`).join(" · ")}</span>` : "") +
          (s.sealedFight && SNL ? (() => { const t = SNL.forecast(s.sealedFight); return `<span class="cc-pip" title="${esc(SNL.observe(s.sealedFight))}">Table · rise ${t.floods[0] || "none"} · ebb ${t.ebbs[0] || "—"}</span>`; })() : "");
    }
    const inDrawer = () => String(U.menu).startsWith("drawer:");
    // rootItems() is still every root row, flat; rootRows() is what the root menu shows once drawers are folded.
    const rootRows = () => foldDrawers(lyingGate(rootItems(), controlledFighter(U.s)));   // Survival Instincts: a lying unit's rows are off but Stand up and End turn
    const drawerItems = () => { const d = MENU_DRAWERS.find((x) => x.id === U.menu); if (!d) return []; const rows = lyingGate(rootItems(), controlledFighter(U.s)).filter((it) => drawerOf(it) === d); const grouped = d.id === "drawer:rituals" ? groupRitual(rows) : rows; return d.id === "drawer:gear" ? groupGear(grouped) : grouped; };
    const menuList = () => heldPrices(apGate(foldRows(U.menu === "root" ? rootRows() : inDrawer() ? drawerItems() : subItems()), controlledFighter(U.s)?.tempo ?? 0, E.heldCostMul(U.s, controlledId(U.s))), E.heldCostMul(U.s, controlledId(U.s)));   // real prices in a Contact Reading hold; rows greyed when the AP is short (1:1, indexes agree)
    function rootItems() {
      const s = U.s, p = controlledFighter(s);
      const siHolder = (u) => (u.traits || []).some((x) => (x?.id || x) === "survivalInstincts") && !(u.traits || []).some((x) => root.ConceptCombatInsightData?.traits?.[x?.id || x]?.neverFlees);   // Brave and Main Character Energy are never offered either escape
      // A drawn line with no legal target cannot be delivered: say so, and leave Discard (Muse, Mala hit it 2026-10-15).
      if(p.status?.verse?.freeAp){const vt=E.targeting(s,controlledId(s),p.status.verse.id),none=!vt.legal?.length;
        return [{id:"tech",label:`Deliver Freestyle: ${C.abilities[p.status.verse.id].name} ▸`,off:none,why:none?"No legal target: discard it.":"",help:"The draw paid its AP and ΦF. Choose the original technique's target now; you cannot move or bank this line."},{id:"discardVerse",label:p.character==="rapper"&&!p.status.wordplayUsed?"Wordplay: redraw once":"Discard this line",off:false}];}
      const selfTraits = s.self?.traits || [], knownSelf = selfTraits.filter(t => t?.known).length;
      const dreamKnowledge = { placeFamiliarity: s.placeObservation?.familiarity || 0, selfKnowledge: selfTraits.length ? knownSelf / selfTraits.length : 0 };
      const dreamOpening = E.dreamOpening(s), dreamCheck = DS?.canOpen(p, dreamOpening.rules, s.dreamSpace, dreamKnowledge);
      const moveBudget = (id) => root.ConceptCombatInjury?.moveBudget(s, s.actors[id], E.movementBudget(s, id), !!root.ConceptCombatClassRuntime?.flies?.(s.actors[id])) ?? E.movementBudget(s, id);
      return [
        ...Object.values(s.actors).filter(u=>u.side===p.side && u.fullCourtPress && !u.defeated).map(u=>({id:`press:${u.id}`,label:`Press ▸ ${u.name}`,off:!E.fullCourtPressOptions(s,u.id).length,help:"Relocate this ally once to any open map tile for 0 AP, including across the dream boundary. Movement vows and position locks still apply."})),
        ...(p.status?.grappled && p.status.grappled.untilRound >= U.s.round ? [{ id: "breakGrapple", label: `Break the hold · ${U.s.rules.grapple.break.ap} AP`, off: p.tempo < E.breakCost(U.s, controlledId(U.s)),
          why: `You are held: no moving or dodging until the hold lapses at the end of round ${p.status.grappled.untilRound}. Breaking it always works and frees you now; a hold also breaks when either of you is moved by anything but your own Move, Jump or Climb (a shove, pull, throw, dash, swap, teleport or dodge).${E.heldCostMul(U.s, controlledId(U.s)) !== 1 ? ` Contact Reading: everything costs you ×${E.heldCostMul(U.s, controlledId(U.s))} action points while you are held, this included.` : ""}` }] : []),
        { id: "move", label: `Move (≤${moveBudget(controlledId(U.s))})${root.ConceptCombatVows?.refuses(U.s, p, "move") ? " · Rooted" : ""}`, why: `Up to ${moveBudget(controlledId(U.s))} move points this turn. Terrain and slope change the cost, and water costs extra action points.`, off: p.tempo < U.s.rules.actionCosts.movePerPoint || !!root.ConceptCombatVows?.refuses(U.s, p, "move") },   // Vows: Rooted
        ...(E.jumpOptions(U.s, controlledId(U.s)).length ? [{ id: "jump", ap: E.jumpCost(U.s, controlledId(U.s)), label: `Jump down (${E.jumpCost(U.s, controlledId(U.s))} AP)`, why: "Drop to a lower tile. Fall damage is halved.", off: !!root.ConceptCombatVows?.refuses(U.s, p, "move") }] : []),
        ...(E.climbOptions(U.s, controlledId(U.s)).length ? [{ id: "climb", ap: E.climbCost(U.s, controlledId(U.s)), label: `Climb ledge (${E.climbCost(U.s, controlledId(U.s))} AP)`, off: !!root.ConceptCombatVows?.refuses(U.s, p, "move"),
          why: `Scale a ledge two or more levels up, which a plain step cannot reach. Costs ${E.climbCost(U.s, controlledId(U.s))} AP.` }] : []),
        // Disengage only when it could matter: a live opponent who holds a reaction threatens this tile, and this
        // turn's disengage is not already spent. Listed unconditionally it folded every opening menu into the Move
        // drawer and buried the first command (oculus-battle-ui caught it, 2026-10-22).
        ...(Object.values(s.actors).some((w) => w.side !== p.side && !w.defeated && (w.reaction ?? 0) > 0 && E.geometry.dist(s, p.x, p.y, w.x, w.y) <= E.strikeRange(s, w.id)) && p.disengageTurn !== p.ownerTurns ? [{ id: "disengage", label: `Disengage (${s.rules.opportunity?.disengageAp ?? 15} AP)`, off: p.tempo < (s.rules.opportunity?.disengageAp ?? 15), why: "The rest of this turn, leaving a reach draws no swing." }] : []),
        ...(siHolder(p) && !p.status?.playingDead ? (() => { const R = s.rules.survivalInstincts, left = R.scramble.uses - (p.instinct?.scrambles || 0), r = E.apply(s, { type: "scramble", actor: controlledId(s) }, { preview: true });   // Survival Instincts: listed when held and hurt, with the engine's own reason when it is off
          return p.lf < p.maxLF * R.woundedBelow ? [{ id: "scramble", label: `Scramble · ${R.scramble.ap} AP · ${left} left`, off: !r.ok, why: r.ok ? `Hurt and running: leaving a reach draws no swing and you move +${R.scramble.moveAdd} until your next turn.` : r.error }] : []; })() : []),
        ...(DS ? [{ id: "dreamSpace", label: U.s.dreamSpace ? `Dream Space · ${p.ultimateCharge} ULT clock` : `Open Dream · ${dreamOpening.ap} AP`, why: U.s.dreamSpace ? "" : `Needs ${dreamCheck?.required ?? U.s.rules.ultimateChargeMax}% ultimate charge.${dreamOpening.night ? " It is easier by night." : ""}`, off: (!!dreamCheck?.reason && !(root.ConceptCombatVows && !s.dreamSpace && DS.canOpen(p, { ...s.rules, ultimateChargeMax: s.rules.ultimateChargeMax - 25 }, s.dreamSpace, dreamKnowledge)?.ok)) || p.tempo < DS.rules.apCost }] : []),   // Vows: Early Dream can open it sooner
        ...(CardsUI && E.cards ? CardsUI.drawerRows(E.cards.options(s, controlledId(s)), E.cards.showOptions(s, controlledId(s))) : []),   // Battle Cards (C1): one row per deck card, greyed with the reason; Show your hand
        ...(p.inventory?.length ? [{ id: "items", label: `Use item ▸ (${p.inventory.length})`, off: p.tempo < Math.min(...p.inventory.map(itemCost)),
          why: `Use one of the ${p.inventory.length} item${p.inventory.length === 1 ? "" : "s"} you carry. Hover a row to see what it does and what it costs.${p.tempo < Math.min(...p.inventory.map(itemCost)) ? ` Not enough AP: your cheapest item costs ${Math.min(...p.inventory.map(itemCost))}.` : ""}` }] : []),
        ...(Cook && p.inventory?.length && Cook.available(p.inventory, { inBattle: true, cook: Cook.isCook(p) }).length ? [{ id: "cook", label: `Cook ▸ (${Cook.available(p.inventory, { inBattle: true, cook: Cook.isCook(p) }).length})`, why: Cook.isCook(p) ? "A cook: every recipe works mid-battle." : "Field recipes only mid-battle (roast, tea); cooks make full dishes." }] : []),
        ...(p.inventory?.length ? [{ id: "drop", label: `Drop item ▸ (${p.inventory.length})`, why: "Set a carried item down and leave it behind to free a pack slot. Costs no AP." }] : []),
        // What he has on (Mala, 2026-10-13: equipped items appeared nowhere in the command menu). Equipment is passive, so
        // these rows are read, not pressed: one for each equipped piece, saying what it does or that it is worn out.
        ...(Loot ? Object.entries(Loot.withBags(U.account).gear.equipped).filter(([, id]) => Loot.data.equipment[id]).map(([slot, id]) => { const it = Loot.data.equipment[id], spent = (Loot.withBags(U.account).gear.durability[id] ?? 1) <= 0;
          return { id: `worn:${id}`, label: `${slot[0].toUpperCase() + slot.slice(1)} · ${it.name}${spent ? " · worn out" : ""}`, off: true, why: spent ? `${it.text} Worn out: it does nothing until you repair it in the Field Kit.` : `${it.text} Equipped: always on, nothing to press.` }; }) : []),
        ...(() => { const t = E.tallyStatus ? E.tallyStatus(U.s, controlledId(U.s)) : null;   // the ledger boss (engine/tally.js): terms on the table, settling up
          if (!t) return [];
          return [...t.offers.flatMap(o => [{ id: `tally-accept:${o.from}`, label: `Accept ${o.name}'s terms · +${o.ap} AP next turn`, off: false, help: `${o.ap} AP banked for your next turn; ${o.debt} AP falls due the turn after. No AP cost. Owing ${t.threshold} AP or more puts your highest-cost technique up as collateral.` },
            { id: `tally-decline:${o.from}`, label: `Decline ${o.name}'s terms`, off: false, help: "Turn the offer down. No AP cost, no penalty." }]),
            ...(t.owed ? [{ id: "tallySettle", label: `Settle your account · ${Math.min(p.tempo, t.owed)} AP (owe ${t.owed})`, off: p.tempo <= 0, help: `Pay AP now against what you owe: loans not yet due first, then tempo debt.${t.call ? " The Margin Call lands at the start of his next turn." : ""}${t.held ? ` ${t.heldName} is held as collateral until you owe less than ${t.threshold}.` : ""}` }] : [])]; })(),
        ...(() => { const po = E.parleyOptions ? E.parleyOptions(U.s, controlledId(U.s)) : { terms: [], offers: [] };   // Parley
          return [...po.offers.flatMap(o => [{ id: `accept:${o.from}`, label: `Accept ${o.name}'s terms`, off: false, help: "Accept their peace offer. They leave the fight without being defeated; other opponents remain. No AP cost." }, { id: `decline:${o.from}`, label: `Decline ${o.name}'s terms`, off: false, help: "Reject their peace offer. Conversation with this person closes for the rest of this battle. No AP cost." }]),
            ...po.terms.map(o => ({ id: `terms:${o.target}`, label: `Terms with ${o.name} · ${o.cost} AP · ${Math.round(o.chance * 100)}%`, off: o.off, help: `${o.note ? `${o.note}. ` : ""}Negotiate a lasting peace with someone who has stood down. Success removes them from the fight; failure closes conversation with them for this battle. Standing down alone does not win the battle. Costs ${o.cost} AP; current success chance ${Math.round(o.chance * 100)}%.${o.note ? ` ${o.note}` : ""}` }))]; })(),
        ...(DS && s.dreamSpace?.owner === p.id ? [{ id: "wakeDream", label: `Wake from the dream · free · keeps ${p.ultimateCharge ?? 0} ULT`, off: !!p.aura?.burning, why: p.aura?.burning ? "The folded aura is already burning the dream out: it ends next turn." : "End your Dream Space now. Dreams fade and summons are let go, as when the clock runs out. The bar keeps what is left." }] : []),
        ...(() => { const k = Object.values(s.actors).find(u => u.character === "kaiba" && !u.defeated && !u.escaped && !u.kaiba?.asleep);   // Kaiba
          if (!k) return [];
          const near = E.geometry.dist(s, p.x, p.y, k.x, k.y) <= 1;
          return [{ id: "pet", target: k.id, label: `Pet Kaiba · 10 AP`, off: !near || p.tempo < 10 || !!k.kaiba?.shunned?.[p.id],
            why: near ? `A moment with the cat: +20 AP, +5 LF${k.kaiba?.pettedOnce ? "" : ", and the first pet inspires (+1 Inspiration)"}. Three pets and he sleeps or wanders off (pet ${k.kaiba?.pets || 0} of 3).` : "Get next to Kaiba first." }]; })(),
        ...(DS && s.dreamSpace?.owner === p.id ? [3,2].filter(radius=>!s.dreamSpace.region || radius<s.dreamSpace.region.radius).map(radius=>({id:`focusDream:${radius}`,label:`Compress Dream · radius ${radius} · 20 AP`,off:p.tempo<20 || !!s.dreamSpace.imbued,
          help:`Seal a fixed diamond around the dream's original centre (your current tile on first compression). Radius ${radius} gives ×${radius===2?1.5:1.25} efficacy to the dream bonus and imbued aura. Ordinary attacks, movement and summons cannot cross. Diffusion fields can enter from outside; Pathway needs an open route. Smaller usable area lowers ambient monster spawning. Compress before imbuing; the ULT clock stays unchanged.`})) : []),
        ...(AU ? [U.s.dreamSpace?.owner === p.id && !p.aura?.burning
          ? { id: "aura", label: `Imbue the Dream · ${AU.rules.imbueApCost} AP`, off: !!AU.canImbue(U.s, p), why: AU.canImbue(U.s,p) || "Your folded aura burns out: it fires at once, takes the rest of the bar, and inherits the dream's opening vows. Imbuing cannot add or change vows." }
          : { id: "aura", label: p.aura?.burning ? "Dream burning out · ends next turn" : p.aura?.imbued ? "Folded aura · the dream is gone" : p.aura ? `Let the aura fall · ${p.ultimateCharge} ULT left` : `Extend Aura · ${AU.rules.apCost} AP · ${AU.rules.flareCost} ULT, −${AU.knobsFor ? AU.knobsFor(U.s, p).drain : AU.rules.drainPerTurn}/turn`, off: !!p.aura?.burning || (!p.aura && !!AU.canActivate(U.s, p)), why: p.aura?.burning ? "The burning dream ends at your next turn." : p.aura?.imbued ? "The dream closed under your folded aura; letting it fall." : p.aura ? "Dismiss your active aura." : AU.canActivate(U.s,p) || `Ready · ${p.ultimateCharge} ULT available. Charge freezes while the aura is active.` }] : []),   // Auras
        ...(DS && CM && s.dreamSpace?.owner === p.id && p.aura?.imbued && !p.aura?.burning ? Object.values(s.actors).filter((u) => u.communed && u.communed.owner === p.id && !u.defeated && !u.treeant).map((u) => ({ id: `treeant:${u.id}`, label: `Raise ${u.name} · ${CM.rules.treeant.ap} AP`, off: p.tempo < CM.rules.treeant.ap, help: `Pour your folded dream-aura into ${u.name}: +${CM.rules.treeant.lfAdd} LF, Bark ward ${CM.rules.treeant.wardProtection}, treeant art. The dream's field loses your aura; when the dream closes it sinks back to plant form.` })) : []),   // Treeant
        ...(DS && SM && s.dreamSpace?.owner === p.id ? Object.values(s.actors).filter((u) => u.summon && u.summon.owner === p.id && !u.defeated && u.summon.trueForm && !u.summon.maxForm && SM.data.summons[u.summon.key]?.maxForm).map((u) => { const MC = SM.data.rules.maxChannel, MF = SM.data.summons[u.summon.key].maxForm; return { id: `maxChannel:${u.id}`, label: `Channel MAX: ${u.name} · ${MC.actionCost} AP + full ULT`, off: p.tempo < MC.actionCost || (p.ultimateCharge ?? 0) < (s.rules.ultimateChargeMax ?? 100), help: `Pour the dream and a full ultimate into ${u.name}: it becomes ${MF.name} permanently — double turns left, ${MF.technique.name}, a new ultimate. The dream is consumed and closes.` }; }) : []),   // MAX channel
        ...(p.status?.verse&&!p.status.verse.id?p.status.verse.choices.map(id=>({id:`verse:${id}`,label:`Pocket: ${C.abilities[id].name}`,off:false,help:`${C.abilities[id].mechanism||C.abilities[id].description||""} Keep this line; the other two are discarded. Its original prerequisites and counters still apply.`})):[]),
        ...(p.status?.verse?[{id:"discardVerse",label:p.character==="rapper"&&p.status.verse.freeAp&&!p.status.wordplayUsed?"Wordplay: redraw once":"Discard held verse",off:false,why:p.character==="rapper"&&p.status.verse.freeAp&&!p.status.wordplayUsed?"Replace the held line with a new draw, once. The new line must then be delivered.":p.status.verse.freeAp?"Put the held line away undelivered: half its ΦF returns and the action stays spent.":"Put the held verse away without delivering it."}]:[]),
        ...(p.birdMountain?.red?[{id:"dismissUlaula",label:"Let the red go out · free",off:!!p.birdMountain.vows?.neverQuench,why:p.birdMountain.vows?.neverQuench?"Sworn: Never-Quench cannot be dismissed.":"Dismiss ʻUlaʻula. Free, on your turn."}]:[]),
        { id: "tech", label: "Techniques ▸", opensIfShort: true, off: !E.availableAbilities(U.s, controlledId(U.s)).some(x => x.affordable||x.contract?.next?.kind==="invoke"||x.contract?.canPrepare),
          why: E.availableAbilities(U.s, controlledId(U.s)).some(x => x.affordable||x.contract?.next?.kind==="invoke"||x.contract?.canPrepare) ? "The techniques your concepts give you, grouped by concept. Each row shows its AP and ΦF cost." : "No technique is affordable right now: check each row's AP and ΦF cost." },
        ...(SM && (SM.callsPalace(p) || (p.beastSummons || []).length || Object.keys(U.account?.contracts?.pacts || {}).length) ? [{ id: "summons", label: `Summon ally ▸ (${(SM.callsPalace(p) ? summonUnlocks().length : 0) + (p.beastSummons || []).length} unlocked · ${E.summonProfile(s,p.id).apCost} AP)`, off: !summonUnlocks().some(id => E.summonReadiness(s,p.id,id,summonUnlocks()).ok) && !(p.beastSummons || []).some((b) => !s.beastCalled?.[`${p.id}:${b.key}`]) && !pactCallable(s, p) && !s.pactActive,
          why: `Call an unlocked ally: ${E.summonProfile(s,p.id).apCost} AP and ${E.summonProfile(s,p.id).phiCost} ΦF each, and you answer its question before it arrives.` }] : []),
        ...(SM ? Object.values(s.actors).filter(a => a.summon && a.summon.owner === p.id && !a.defeated).map(a => {
          const def = SM.data.summons[a.summon.key], ult = SM.activeUltimate(a), can = SM.canOrderUltimate(p, a, { ultimateChargeMax: s.rules.ultimateChargeMax });
          const blocked = s.dreamSpace?.owner === p.id || DS?.ultimatesBlocked(p, s.dreamSpace, s.rules);
          return { id: "orderSummonUltimate", summonId: a.id, label: `Order ${a.name}: ${ult.name} · 20 AP + full ULT`, off: !can.ok || !!blocked, why: blocked ? "Dream Space is using the ultimate charge." : can.reason };
        }) : []),
        { id: "strike", label: "Strike ▸", off: !!p.status?.soothed || p.tempo < U.s.rules.actionCosts.strikeMin,
          why: p.status?.soothed ? "You are soothed and cannot strike." : "Choose how much AP to commit, then a target. More AP means more potency; AP you do not have becomes tempo debt, repaid from your next turn's budget." },
        ...(() => { const M = E.multitudes(U.s, controlledId(U.s)); if (!M.holder) return [];   // Contains Multitudes (the Warden)
          return M.embodied
            ? [{ id: "dismissEmbodiment", label: `Let the ${M.embodied.name} go · ${M.turnsLeft} left`, off: !!M.dismissNo, why: M.dismissNo || "", help: "End the embodiment now. Free, and only at the start of your turn. Embodying again costs the full price." }]
            : [{ id: "multitudes", label: `Contains Multitudes · ${M.cost} Inspiration`, off: !M.options.some((o) => !o.off), why: M.options.length ? (M.options.find((o) => o.off)?.off || "") : "Beat a class in a real battle first: it is recorded in your victories.",
                help: `Be one class you have beaten as well as the Warden for ${M.turns} of your turns. Your own secondary concept is set aside while it lasts. ${M.options.length} class${M.options.length === 1 ? "" : "es"} beaten so far.` }]; })(),
        ...(p.status?.drowning ? [{id:"recoverWater",label:`${E.recoverWater(s,controlledId(s))?.label} (${E.recoverWater(s,controlledId(s))?.cost} AP)`,off:!E.recoverWater(s,controlledId(s))?.allowed || p.tempo<(E.recoverWater(s,controlledId(s))?.cost||20),why:"Drowning continues until you recover or leave water. This uses your turn's action points."}] : []),
        { id: "guard", ap: U.s.rules.actionCosts.guard, label: `Guard (${U.s.rules.actionCosts.guard} AP)${root.ConceptCombatVows?.refuses(U.s, p, "guard") ? " · sworn off" : ""}`, off: p.guardUsedThisTurn || p.tempo < U.s.rules.actionCosts.guard || !!root.ConceptCombatVows?.refuses(U.s, p, "guard"),
          why: `Cuts incoming LF damage by ${Math.round(U.s.rules.guardReduction.min * 100)}% to ${Math.round(U.s.rules.guardReduction.max * 100)}%, more the more AP you still hold when you set it, until your next turn starts.${p.guardUsedThisTurn ? " Already set this turn." : ""}` },   // Vows: Open Guard
        { id: "observe", label: `Observe ▸ (${U.observeInvest} AP)`, off: p.tempo < U.observeInvest,
          why: `Learn a visible character's traits and abilities, or read the place's weather. Each 10 AP of effort adds one insight point. (Investigate goes deeper.)${p.tempo < U.observeInvest ? ` Not enough AP: the effort is ${U.observeInvest}.` : ""}` },
        ...(INS?.data?.rules?.investigate ? [{ id: "investigate", label: `Investigate ▸ (all ${p.tempo} AP)`, off: p.tempo < INS.data.rules.investigate.minAP + invTax(s, p) || E.heldCostMul(s, controlledId(s)) !== 1,
          why: E.heldCostMul(s, controlledId(s)) !== 1 ? "You can't Investigate while held: every action costs more than the AP you have left." : p.tempo < INS.data.rules.investigate.minAP + invTax(s, p) ? `Needs at least ${INS.data.rules.investigate.minAP + invTax(s, p)} AP${invTax(s, p) ? ` (${invTax(s, p)} more with a wounded head)` : ""}. Investigate spends everything you have left.` : `Spend the rest of your turn studying one target. Finds the hardest things first (your focus kind first, if you chose one), +${INS.data.rules.investigate.depthBonus} points for the depth, carries up to ${INS.data.rules.investigate.carryCap}. Your turn ends and your reaction is spent until next round.` }] : []),
        ...(s.sealedFight && SNL ? Object.values(s.sealedFight.gates).filter((g) => !g.destroyed && !g.open).map((g) => {
          const [x, y] = g.tile.split(",").map(Number);
          const near = Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= 1;
          return { id: `openGate:${g.id}`, label: `Open a gate (${x},${y}) · ${SNL.OPEN_AP} AP`, off: !near || p.tempo < SNL.OPEN_AP,
            why: near ? "Opening drains that region's coming rise and cancels only its share." : "Stand next to a closed gate." };
        }) : []),
        ...((s.fish || []).filter((f) => Math.max(Math.abs(f.x - p.x), Math.abs(f.y - p.y)) <= 1).slice(0, 1).map((f) => ({ id: `catchFish:${f.x},${f.y}`, label: `Catch a dream fish · ${s.rules.fish?.catchAp ?? 20} AP`,
          off: p.tempo < (s.rules.fish?.catchAp ?? 20), why: `Into your pack (eat it from Gear for +${s.rules.fish?.ultCharge ?? 20} ultimate charge); eaten at once if the pack is full.` }))),
        ...(E.findingNoteOptions ? E.findingNoteOptions(s,controlledId(s)).map(o=>({id:`finding:${o.id}`,label:`Record finding: ${o.name} · reaction`,off:(p.reaction??0)<=0,why:"Preserve this fact and its source in your field notebook; no technique practice is granted."})) : []),
        ...(E.journalOptions ? E.journalOptions(U.s, controlledId(U.s)).map((o) => ({ id: `journal:${o.technique}`, label: `Take notes: ${o.name} · reaction`, off: (p.reaction ?? 0) <= 0,
          why: (p.reaction ?? 0) <= 0 ? "Your reaction is spent this round." : "Spend your reaction to note it in your journal: three notes finish a study (the Magistrate's Codex)." })) : []),
        { id: "overwatch", ap: s.rules.overwatch?.ap ?? 10, label: `Overwatch (${s.rules.overwatch?.ap ?? 10} AP)`, off: (p.reaction ?? 0) <= 0 || p.tempo < (s.rules.overwatch?.ap ?? 10) || (p.status?.overwatch?.expiresAt ?? -1) > p.ownerTurns,
          why: "Spend your reaction: the first foe in range eats a snapshot. No Guard or dodge while watching." },
        { id: "meditate", ap: 40, label: `Meditate · 40 AP · +${(p.traits || []).some((t) => (t.id || t) === "contemplative") ? 35 : (p.traits || []).some((t) => (t.id || t) === "restless") ? 15 : 25} ULT`, off: p.tempo < 40 || p.ultimateCharge >= s.rules.ultimateChargeMax || p.guardUsedThisTurn || p.lastMeditateTurn === p.ownerTurns,
          why: "Turn action points into ultimate charge. No Guard in the same turn." },
        ...(PR ? [{ id: "declarePresence", label: `Declare intent: Presence · ${PR.RULES.declareAp} AP`, off: p.tempo < PR.RULES.declareAp || !!(s.presence && !s.presence.shattered), why: "Zero blows. Break every enemy to willpower 0, then take a knee (Rest). Dealing LF shatters it." }] : []),
        ...(PR ? Object.values(s.actors).filter((u) => u.side === "enemy" && !u.defeated).map((u) => ({ id: `display:${u.id}`, label: `Display ▸ ${u.name} · ${PR.pressure(p, u)} WP`, off: p.tempo < PR.RULES.displayAp || (p.pf || 0) < PR.RULES.displayPf, why: `Willpower pressure, zero LF, +1 shine. Foe will: ${u.willpower ?? 10}/${u.maxWillpower ?? 10}.` })) : []),
        ...(PR ? [{ id: "takeKnee", label: "Take a knee · win by presence", off: !PR.objectiveMet(s), why: PR.objectiveMet(s) ? "Every enemy broken, zero blows: kneel and the fight is yours." : "Break every standing enemy to willpower 0 with 0 LF dealt first." }] : []),
        ...(DB ? DB.LENDERS.map((L) => { const b = DB.book(s, "player"); const noOrc = L.unit && !Object.values(s.actors).some((u) => u.side === "enemy" && !u.defeated); const off = s.round <= b.frozenUntil || b.borrowedRound === s.round || b.owed + DB.RULES.principal > L.cap || noOrc || (U.account?.debt || 0) > 0; return { id: `borrow:${L.id}`, label: `Borrow ▸ ${L.name} · ${Math.round(L.rate * 100)}% · cap ${L.cap}`, off, why: `+${DB.RULES.borrowTempo} tempo, +${DB.RULES.borrowPf} ΦF now; owes ${DB.RULES.principal} compounding. ${noOrc ? "Needs local muscle standing." : (U.account?.debt || 0) > 0 ? "Indebted: clear the ledger first." : "Once per turn."}` }; }) : []),
        ...(DB && DB.book(s, "player").owed > 0 ? [{ id: "repayDebt", label: `Repay the book · ${DB.repayCost(DB.book(s, "player"))} Seeds`, off: (s.seeds ?? 0) < DB.repayCost(DB.book(s, "player")), why: `Owes ${DB.book(s, "player").owed}; banks ask double.` }] : []),
        ...(DB && s.debtVisits?.player ? [{ id: "settleVisit", label: `Settle the visit · ${DB.RULES.visitCostInspiration} inspiration`, off: (p.inspiration || 0) < DB.RULES.visitCostInspiration, why: "Send the creditor home happy before the freeze." }] : []),
        ...(DB && DB.book(s, "player").owed > 0 ? [{ id: "declareBankruptcy", label: "Declare bankruptcy · seal + prison + service", off: false, why: `Shed ${DB.book(s, "player").owed}: techniques+ults sealed ${DB.RULES.sealRounds} rounds, a prison turn, then debt-free.` }] : []),
        ...(typeof trapMenu === "function" ? trapMenu() : []),
        ...(typeof cartMenu === "function" ? cartMenu() : []),
        ...(typeof houseMenu === "function" ? houseMenu() : []),   // beside an allied Maid: take an item from her cart (engine/actions.js takeFromCart)
        ...(typeof ritualMenu === "function" ? ritualMenu() : []),
        ...(() => { const R = s.rules.astral; if (!R) return [];
          if (p.soulOf) { const P = s.astral?.portal, home = P && p.x === P[0] && p.y === P[1];
            return [{ id: "astralReturn", label: "Step through the portal · free", off: !home, why: home ? "Wake in the body. The mirrors fade if no soul remains." : "The way back is through the portal: stand on it first." }]; }
          if (p.soulId) return [];
          const no = p.tempo < R.ap ? `Needs ${R.ap} AP.` : p.pf < R.upkeepPf ? `Needs ${R.upkeepPf} ΦF to hold.` : "";
          return [{ id: "astralProject", label: `Project · ${R.ap} AP · ${R.upkeepPf} ΦF`, off: !!no, why: no || `Leave the body and fight on the astral plane on your soul-force bar. ${R.upkeepPf} ΦF each soul turn to stay out. Only the portal brings you back by choice; if the soul falls, the body dies.` }]; })(),
        ...(() => { const R = s.rules.palingenesis; if (!R) return [];
          const burnNo = p.tempo < R.burnAp ? `Needs ${R.burnAp} AP.` : "";
          const callNo = p.tempo < R.restoreAp ? `Needs ${R.restoreAp} AP.` : "";
          const RR = s.rules.rite || {}, rite = p.rite;   // burn/call bank rite steps as a side effect (ash + bloom)
          const stepNo = p.ritual ? "chanting a capture" : (rite?.steps?.length || 0) >= (RR.maxSteps ?? 3) ? "three steps banked already" : rite?.stepTurn === p.ownerTurns || p.riteStepTurn === p.ownerTurns ? "one rite step per turn" : "";
          const banked = (what) => stepNo ? `No rite step banks (${stepNo}).` : what;
          return [
            { id: "palingenesisBurn", label: `Burn a plant · ${R.burnAp} AP`, off: !!burnNo, why: burnNo || `An adjacent living plant becomes ashes that remember its form. A tree leaves no stump. Creeper just burns away (no ashes). ${banked(`Banks a burn step (+${RR.burnPotency ?? 4} potency on the sealed rite).`)}` },
            { id: "palingenesis", label: `Call from ashes · ${R.restoreAp} AP`, off: !!callNo, why: callNo || `Call that same form back once, at half life. Scatter the ashes and there is nothing to call. ${banked(`Banks a call step (+${RR.callCharges ?? 1} charge on the sealed rite).`)}` },
          ]; })(),
        ...(typeof riteMenu === "function" ? riteMenu() : []),
        ...(typeof communeMenu === "function" ? communeMenu() : []),   // known plants answer from the Rituals tab
        ...(typeof awakenMenu === "function" ? awakenMenu() : []),   // known structures wake from the Rituals tab
        ...(typeof tamerMenu === "function" ? tamerMenu() : []),   // capture a weakened wild monster; release a bead   // set a trap; disarm one you have spotted (terrain/traps.js)
        ...(INS && s.self?.traits?.some(t => !t.known) ? [{ id: "observeSelf", label: `Observe Self · ${INS.observeSelfCost(s.self)} AP`, off: p.tempo < INS.observeSelfCost(s.self), why: `Study yourself to uncover traits you do not know you have. Costs ${INS.observeSelfCost(s.self)} AP.` }] : []),
        ...(s.mirror?.resolvable || []).map(trait => ({ id: "resolveTrauma", trait, label: `Work through: ${MIR?.data?.traumas?.[trait]?.becomes?.name || trait}`, off: false, why: "Face the trauma you met this battle: your ultimate bar fills and you gain its reward." })),
        ...(BOSS && MIR ? (() => {
          const missing = s.devPlayground ? [] : [...BOSS.integration(s.self, MIR.traumaStatus(s.self), s.mirror).missing];   // the DEV playground waives integration
          if (p.ultimateCharge < s.rules.ultimateChargeMax) missing.push(`Full ULT required (${p.ultimateCharge ?? 0}/${s.rules.ultimateChargeMax})`);
          if (p.form) missing.push("Let your current form end first");
          if (p.goldenUsed) missing.push("Already used this battle");
          return [{ id: "becomeGolden", label: "Become the Integrated Self", off: missing.length > 0, why: missing.join(" · ") || "Ready to transform." }];
        })() : []),
        ...(BOSS ? [...new Set(p.orbs || [])].map((orb) => { const O = BOSS.data.orbs[orb], ap = BOSS.data.formBalance.activationAp, n = p.orbs.filter((x) => x === orb).length;   // orbs carried from the account
          const why = O.only && !O.only.includes(p.character) ? O.onlyText : p.form ? "Let your current form end first" : p.tempo < ap ? `Needs ${ap} AP` : "";
          return { id: "breakOrb", orb, label: `Break the ${O.name}${n > 1 ? ` ×${n}` : ""} · ${ap} AP`, off: !!why, why: why || `${O.form} for ${BOSS.data.formBalance.duration} turns, and a full ultimate bar.` }; }) : []),
        ...(BOSS?.enterLearned ? (p.form?.learned ? [{ id: "releaseForm", label: `Let go of ${p.form.name}`, off: false, why: p.form.held ? `Holding costs ${BOSS.data.learnedForms.drain} ΦF a turn, then LF.` : `Borrowed: ${p.form.turnsLeft} turn${p.form.turnsLeft === 1 ? "" : "s"} left.` }] : p.form?.golden ? [{ id: "releaseForm", label: `Let go of ${p.form.name}`, off: false, why: p.form.held ? `Holding costs ${BOSS.data.learnedForms.drain} ΦF a turn, then its own gold.` : `Free turns: ${p.form.turnsLeft} left; holding after costs ${BOSS.data.learnedForms.drain} ΦF a turn.` }] : (p.learnedForms || []).flatMap((formId) => {   // learned forms
          const [, O] = BOSS.formFor(formId) || [], ap = BOSS.data.learnedForms.enterAp, holdWhy = BOSS.canEnterLearned(p, formId) || (p.tempo < ap ? `Needs ${ap} AP` : ""), vowWhy = BOSS.canEnterLearned(p, formId, { vow: true });
          return O ? [{ id: `enterForm:${formId}`, label: `Hold ${O.form} · ${ap} AP`, off: !!holdWhy, why: holdWhy || `Drains ${BOSS.data.learnedForms.drain} ΦF a turn, then LF, until you let go.` },
            { id: `vowForm:${formId}`, label: `Borrow ${O.form} (vow) · free`, off: !!vowWhy, why: vowWhy || `${BOSS.data.learnedForms.vowTurns} free turns; you can't hold it again this battle.` }] : []; })) : []),
        ...(U.insightTarget && U.s.actors[U.insightTarget] && !U.s.actors[U.insightTarget].defeated ? [{ id: "insight", label: `Insight ▸ ${U.s.actors[U.insightTarget].name}`, why: `The actions your observations of ${U.s.actors[U.insightTarget].name} unlock. Only observed traits and findings count.` }] : []),
        ...(root.ConceptCombatOrders && p.id === "player" ? Object.values(s.actors).filter((u) => u.side === p.side && u.id !== p.id && !u.defeated).flatMap((u) => ["strike", "screen", "scout", "admin"].map((r) => ({ id: `order:${u.id}:${r}`, label: `Order ▸ ${u.name} · ${r[0].toUpperCase() + r.slice(1)} · ${E.talkCost(s, p.id, "talk", s.rules.orders?.ap ?? 10)} AP`, off: p.tempo < E.talkCost(s, p.id, "talk", s.rules.orders?.ap ?? 10), why: `${u.name} weighs ${r[0].toUpperCase() + r.slice(1)} into their choices for 3 rounds. They may refuse or only half-comply.${E.talkCost(s, p.id, "talk", s.rules.orders?.ap ?? 10) !== (s.rules.orders?.ap ?? 10) ? " Speed-Talker: half price." : ""}` }))).concat(Object.values(s.actors).filter((u) => u.side === p.side && u.id !== p.id && !u.defeated).flatMap((u) => Object.values(s.actors).filter((f) => f.side !== p.side && !f.defeated).map((f) => ({ id: `order:${u.id}:focus:${f.id}`, label: `Order ▸ ${u.name} · Focus ${f.name} · ${E.talkCost(s, p.id, "talk", s.rules.orders?.ap ?? 10)} AP`, off: p.tempo < E.talkCost(s, p.id, "talk", s.rules.orders?.ap ?? 10), why: `${u.name} weighs hitting ${f.name} into their choices for 3 rounds. They may refuse or only half-comply.` })))) : []),
        ...(U.s.trial && !U.s.trial.over ? [{ id: "trial", label: `Trial ▸ argue the case (favor ${U.s.trial.t.favor >= 0 ? "+" : ""}${U.s.trial.t.favor})`, why: "Pick this round's move in the trial, 10 AP each. Favor moves with each one." }] : []),
        ...((p.rite?.steps || []).length >= 1 && !U.s.trial && !U.s.trialDone ? [{ id: "mockTrial", label: `Mock trial · 25 AP`, why: "Bring an enemy to trial: it needs 2 observed findings on them, at least one count, and 25 AP. Violence pauses while the court argues." }] : []),
        ...(typeof stakesMenu === "function" ? stakesMenu() : []), ...(typeof hyperMenu === "function" ? hyperMenu() : []),   // guards: command-status slices rootItems into a bare sandbox
        ...(siHolder(p) ? (() => { const R = s.rules.survivalInstincts;   // Survival Instincts: Play dead / Stand up
          if (p.status?.playingDead) return [{ id: "standUp", label: `Stand up · ${R.lie.standAp} AP`, off: p.tempo < R.lie.standAp, why: "Rise from the lie. Foes can target you again." }];
          const r = E.apply(s, { type: "playDead", actor: controlledId(s) }, { preview: true });
          return p.lf < p.maxLF * R.woundedBelow ? [{ id: "playDead", label: "Play dead · ends turn", off: !r.ok, why: r.ok ? "Your turn ends and unspent AP are lost. Foes look past you; you knit a little each turn." : r.error }] : []; })() : []),
        { id: "recover", ap: U.s.rules.actionCosts.utility, label: `Recover (+${U.s.rules.recover.amount} ΦF · ${U.s.rules.actionCosts.utility} AP)`, off: p.tempo < U.s.rules.actionCosts.utility || p.lastRecoverTurn >= p.ownerTurns - U.s.rules.recover.cooldownTurns || p.pf >= p.maxPF,
          why: `Restore ${U.s.rules.recover.amount} ΦF for ${U.s.rules.actionCosts.utility} AP. Not on two of your turns in a row.${p.pf >= p.maxPF ? " Your ΦF is already full." : ""}` },
        { id: "swap", ap: U.s.rules.actionCosts.swap, label: `Swap secondary ▸ (${U.s.rules.actionCosts.swap} AP)`, off: p.tempo < U.s.rules.actionCosts.swap || !!p.pendingSwap || !p.reserve.length,
          why: `Costs ${U.s.rules.actionCosts.swap} AP. Your secondary goes to reserve now; the one you pick works from your next turn start.${!p.reserve.length ? " Nothing is in reserve." : p.pendingSwap ? " A swap is already pending." : ""}` },
        ...(()=>{const nap=E.stallPreview(s,p.id);return [{id:"stall",label:nap.healed ? `Cat Nap · bank ${nap.banked} AP` : `End turn · bank ${nap.banked} AP`,off:false,why:p.traits?.includes("catNap") ? "Cat Nap spends 5 bankable AP per LF restored, up to 8 LF. Remaining AP carries into your next turn; at full LF, all bankable AP is saved." : "Ends your turn. Unspent action points carry into your next turn, up to the bank cap. Use concept techniques to build ULT." + (()=>{const odds=E.deathDoorOdds?.(s,p.id,nap.banked)||0;return odds?` The gamble: if you fall before then, ${Math.round(odds*100)}% that a summon answers at death's door.`:"";})()}];})(),
      ];
    }
    function summonUnlocks() {
      return U.setupOpts?.proficientSummonerTest ? ["mitsuko", "zherm", "inner_child"] : U.account.unlocked;
    }
    function pactCallable(s, p) {   // any pacted line callable right now (quizless: costs + tile + one-call only)
      if (!PC || !SM || s.pactActive) return false;
      const store = U.account?.contracts; if (!store) return false;
      return Object.keys(store.pacts || {}).some((id) => {
        const t = SM.data.summons[id]?.pact; if (!t) return false;
        if ((s.summonUsed || []).includes(id)) return false;
        const rate = PC.rateFor(store.standing[id]?.clean || 0);
        return p.tempo >= E.summonProfile(s, p.id).apCost && p.pf >= Math.ceil(t.call.pf * (1 - rate)) && (s.seeds || 0) >= Math.ceil(t.call.seeds * (1 - rate));
      });
    }
    function contractRows(s,p) {
      const rows=p.contractActive?[{id:"contractRelease",contractAction:"contractRelease",label:"Release maintained work",off:false}]:[];
      for(const x of E.availableAbilities(s,controlledId(s))) {
        if(x.contract?.next?.kind==="invoke"&&!x.contract.spent)rows.push({id:`speak:${x.id}`,contractAction:"contractSpeak",ability:x.id,words:x.contract.next.words,label:`Speak “${x.contract.next.words}” · 10 AP`,off:p.tempo<10});
        else if(x.contract?.canPrepare)rows.push({id:`prepare:${x.id}`,contractAction:"contractPrepare",ability:x.id,label:`Prepare ${x.m.name} · 20 AP`,off:p.tempo<20});
      }
      return rows;
    }
    // What the engine charges for an item: map items and hires always cost the utility action; the rest follow Cook.useCost
    // (engine/actions.js useItem). itemAp is the base price (the row label; heldPrices scales labels itself). itemCost is
    // the price the engine takes: in a Contact Reading hold every price is scaled, so greying, the "Not enough AP" reason
    // and the help text all read itemCost and agree with each other and with spendTempo.
    function itemAp(id) { const u = U.s.rules.actionCosts.utility, e = Loot.data.consumables[id]?.effect; return !Cook || !e || e.wild || e.hire ? u : Cook.useCost(id, u); }
    function itemHeldMul() { return E.heldCostMul(U.s, controlledId(U.s)) || 1; }
    function itemCost(id) { return Math.round(itemAp(id) * itemHeldMul()); }
    function itemHelpFor(id, tempo) {
      const m = itemHeldMul(), H = Loot.data.itemHelp(id, { ap: itemCost(id), tempo, wild: W?.data.items[id], ultMax: U.s.rules.ultimateChargeMax });
      return m === 1 ? H : { ...H, detail: `${H.detail} Held: costs ×${m}.`, text: `${H.text} Held: costs ×${m}.` };
    }
    function subItems() {
      const s = U.s, p = controlledFighter(s), tooFar = (u) => u.id !== p.id && Math.max(Math.abs(u.x - p.x), Math.abs(u.y - p.y)) > 1;   // MEND/TEND are contact care (verbtech.js beside)
      if (U.menu === "tech" && p.status?.verse?.freeAp) return E.availableAbilities(s, controlledId(s)).filter((x) => x.id === p.status.verse.id).map((x) => ({ id: x.id, x, label: x.m.name, off: false }));   // a drawn line: only it can be delivered
      if (U.menu === "tech") return groupTech(p, [...contractRows(s,p),...E.availableAbilities(s, controlledId(s)).sort((a,b)=>Number(!!b.contract)-Number(!!a.contract)).map((x) => ({ id: x.id, x, label: x.m.name + (x.contract ? ` · ${x.contract.reason}` : "") + (x.blocked ? " · the sea takes it" : ""), ...(x.blocked ? { why: x.blocked } : {}), off: !x.affordable || (x.id === "adaptiveBrace" && !p.lastDamageType) })),
        { id: "lens", ap: U.s.rules.actionCosts.utility, label: `Lens ▸ (${U.s.rules.actionCosts.utility} AP)`, off: p.tempo < U.s.rules.actionCosts.utility,
          why: `Pick a lens profile for each of your concepts. Costs ${U.s.rules.actionCosts.utility} AP; committed effects keep the lens they were cast with.` },   // Lens rides under Techniques (Mala, 2026-10-20)
        ...(PR ? Object.values(s.actors).filter((u) => u.side === "enemy" && !u.defeated).map((u) => ({ id: `deathVision:${u.id}`, label: `Death-vision ▸ ${u.name} · heavy WP + dread`, off: p.tempo < PR.RULES.deathVisionAp || (p.pf || 0) < PR.RULES.deathVisionPf, why: "Heavy willpower + dread; zero LF. The far stronger are immune." })) : []),
        ...(VT ? Object.values(s.actors).filter((u) => !u.defeated && u.side === p.side && ((u.lf ?? 0) < (u.maxLF ?? 0) || ["head", "arms", "legs"].some((z) => (u.injuries?.[z]?.g || 0) > 0))).flatMap((u) => {
          const zones = ["head", "arms", "legs"].filter((z) => (u.injuries?.[z]?.g || 0) > 0), hurt = (u.lf ?? 0) < (u.maxLF ?? 0);
          const base = { off: p.tempo < VT.RULES.mendAp || (p.pf || 0) < VT.RULES.mendPhi || tooFar(u), why: tooFar(u) ? `${u.name} is too far to reach: MEND is contact care, so stand beside them.` : `Contact care for the living (${VT.RULES.mendAp} tempo + ${VT.RULES.mendPhi} ΦF). Downgrades one injury.` };
          if (!zones.length) return [{ id: `mend:${u.id}`, label: `MEND ▸ ${u.name} · +${VT.RULES.mendHeal} LF`, ...base }];
          return zones.map((z) => ({ id: `mend:${u.id}:${z}`, label: `MEND ▸ ${u.name} · ${z} ${(u.injuries[z].g === 2 ? "maimed" : "wounded")}${hurt ? ` · +${VT.RULES.mendHeal} LF` : ""}`, ...base }));
        }) : []),
        ...(VT ? Object.values(s.actors).filter((u) => u.defeated && u.side === p.side && u.id !== p.id && !u.escaped && !u.notArrived && !u.knockedOut && !u.summon && !u.summonBinding && !u.clone && !u.dream && !u.companion && !u.communed && !(s.tendRaised || {})[u.id]).map((u) => ({ id: `tend:${u.id}`, label: `TEND ▸ ${u.name} · raise at 1 LF`, off: p.tempo < VT.RULES.tendAp || (p.pf || 0) < VT.RULES.tendPhi || tooFar(u), why: tooFar(u) ? `${u.name} is too far to reach: TEND is contact care, so stand beside them.` : `Raise a downed ally, once each (${VT.RULES.tendAp} tempo + ${VT.RULES.tendPhi} ΦF).` })) : []),
        ...(VT ? Object.values(s.actors).filter((u) => !u.defeated && u.side === p.side && u.id !== p.id && !(s.tendRaised || {})[u.id] && ["head", "arms", "legs"].some((z) => (u.injuries?.[z]?.g || 0) > 0 && !u.injuries[z].s)).map((u) => ({ id: `tend:${u.id}`, label: `TEND ▸ ${u.name} · steady the bleeding`, off: p.tempo < VT.RULES.tendAp || (p.pf || 0) < VT.RULES.tendPhi || tooFar(u), why: tooFar(u) ? `${u.name} is too far to reach: TEND is contact care, so stand beside them.` : `Stop all bleeding (the wounds stay), once each (${VT.RULES.tendAp} tempo + ${VT.RULES.tendPhi} ΦF).` })) : []),
        ...(VT ? (s.corpses || []).filter((c) => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) <= 1).map((c) => ({ id: `salv:${c.id}`, label: `SALVAGE ▸ ${c.name || "the fallen"} · +${VT.RULES.salvageSeeds} Seeds`, off: p.tempo < VT.RULES.salvageAp, why: `Strip an adjacent corpse (${VT.RULES.salvageAp} tempo). The body is spent; no burial after.` })) : []),
        ...(SL ? Object.values(s.actors).filter((u) => u.side === "enemy" && !u.defeated).map((u) => { const gate = SL.gateOf(s, u), need = SL.vesselFor(u), pouch = s.vessels || SL.RULES.vesselKit; return { id: `seal:${u.id}`, label: `Seal ▸ ${u.name} · ${gate || "no gate"} · ${SL.VESSEL_NAME[need]}`, off: !gate || p.tempo < SL.RULES.sealAp || (p.pf || 0) < SL.RULES.offeringPhi, why: gate ? `Pouch: ${SL.VESSELS.map((v) => `${pouch[v] || 0} ${v}`).join(" · ")} · ${Math.round(SL.catchChance(s, u) * 100)}% to hold · 10 ΦF offering · smallest fitting vessel` : "Gate first: hold them (grapple), break them (willpower 0), or persuade them willing." }; }) : []),
        ...(SL ? Object.values(s.actors).filter((u) => u.side === "enemy" && !u.defeated).map((u) => ({ id: `reaper:${u.id}`, label: `Reaper's Seal ▸ ${u.name} · you die`, off: !SL.gateOf(s, u) || !SL.declarationOf(s, p) || p.tempo < SL.RULES.reaperAp || (p.pf || 0) < SL.RULES.offeringPhi, why: (!SL.declarationOf(s, p) ? "Name a precious ward first (Rituals ▸ Declare): the Reaper opens only to protect something precious. " : "") + "The mutual seal: caught outright, no bind to drop. You die with the knot tied." })) : []),
        ...(SL ? Object.values(s.actors).filter((u) => u.side === p.side && u.id !== p.id && !u.defeated).flatMap((u) => E.availableAbilities(s, controlledId(s)).map((x) => ({ id: `grant:${u.id}:${x.id}`, label: `Grant ${x.m.name} → ${u.name} · this battle`, off: p.tempo < SL.RULES.grantAp || (u.learned || []).includes(x.id), why: "For this battle: the ally keeps the technique until the fight ends. No level is charged." }))) : []),
        ...(root.ConceptCombatVows ? [oathRow(s, p)] : [])]);   // technique stances ride here too (Muse-2, 2026-10-21)
      if (U.menu === "items") return (p.inventory || []).map((id, i) => { const ap = itemAp(id), cost = itemCost(id), self = selfItem(id), H = itemHelpFor(id, p.tempo);
        return { id: `${id}:${i}`, item: id, heading: H.name, help: H.text, helpEffect: H.effect, helpDetail: H.detail, label: `${Loot.data.consumables[id]?.name || W?.data.items[id]?.name || id} · ${ap} AP${Loot.data.consumables[id]?.effect?.observe ? " · then Observe" : self ? "" : " · choose a tile"}`, off: p.tempo < cost }; });
      if (U.menu === "cook") return Cook.available(p.inventory || [], { inBattle: true, cook: Cook.isCook(p) }).map((rid) => { const r = Cook.recipes[rid], ap = p.passives?.cookApOverride ?? Cook.rules.cookAp[r.field ? "field" : "full"];
        return { id: `cook:${rid}`, recipe: rid, label: `${r.name} → ${Loot.data.consumables[r.out]?.name || r.out} · ${ap} AP`, why: r.teach, off: p.tempo < ap }; });
      if (U.menu === "drop") return (p.inventory || []).map((id, i) => ({ id: `drop:${id}:${i}`, drop: id, label: `Drop ${Loot.data.consumables[id]?.name || W?.data.items[id]?.name || id}`, why: `Set ${Loot.data.consumables[id]?.name || W?.data.items[id]?.name || id} down and leave it behind. Costs no AP.` }));
      if (U.menu === "summons") return [...SM.available({ unlocked: summonUnlocks() }).filter(x => x.unlocked && SM.callsPalace(p)).map(x => {
        const cost = E.summonProfile(s, p.id), can = E.summonReadiness(s, p.id, x.id, summonUnlocks());
        const tax = (p.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === "attentionToDetail") ? 5 : 0;   // sturdier craft costs slightly (engine/actions.js summonTax)
        return { id: x.id, summon: x.id, label: `${x.name} · ${cost.apCost + tax} AP · ${cost.phiCost} ΦF · ${cost.active.length}/${cost.maxActive} active`,
          why: can.ok ? `${C.concepts[SM.data.summons[x.id].standIn.primary].name} + ${C.concepts[SM.data.summons[x.id].standIn.secondary].name}${cost.emergentIdea ? ` · Proficient Summoner: ${cost.wardProtection}-point ward refreshed each summon turn` : ""}` : can.reason, off: !can.ok };
      }), ...(p.beastSummons || []).map((b) => {   // creatures learned by swallowing their beads (account/beads.js): called like a released bead, once a battle
        const cost = E.summonProfile(s, p.id), used = !!s.beastCalled?.[`${p.id}:${b.key}`];
        const at = [[p.x + 1, p.y], [p.x - 1, p.y], [p.x, p.y + 1], [p.x, p.y - 1]].find(([x, y]) => x >= 0 && y >= 0 && x < s.arena.w && y < s.arena.h && !E.geometry.actorAt(s, x, y) && !E.geometry.tileAt(s, x, y).blocksMove && !(s.wild || []).some((w) => w.form === "unit" && w.x === x && w.y === y));
        const no = used ? "It has answered once this battle." : !at ? "No open tile beside you." : p.tempo < cost.apCost ? `Needs ${cost.apCost} action points.` : p.pf < cost.phiCost ? `Needs ${cost.phiCost} ΦF.` : "";
        return { id: `beast:${b.key}`, beastKey: b.key, at, label: `Beast: ${b.name} · ${cost.apCost} AP · ${cost.phiCost} ΦF`, why: no || `Learned from swallowed beads. It answers like a released bead (${Math.max(1, Math.ceil((b.maxLF || 20) * 0.5))} LF), once a battle.`, off: !!no };
      }),
        ...(PC && SM ? Object.keys((U.account.contracts || {}).pacts || {}).filter((id) => SM.data.summons[id]?.pact).map((id) => {
          const def = SM.data.summons[id], t = def.pact, st = U.account.contracts.standing[id] || { clean: 0 };
          const rate = PC.rateFor(st.clean || 0), cost = E.summonProfile(s, p.id);
          const tax = (p.traits || []).some((x) => (typeof x === "string" ? x : x?.id) === "attentionToDetail") ? 5 : 0;   // sturdier craft costs slightly (engine/actions.js summonTax)
          const pf = Math.ceil(t.call.pf * (1 - rate)), seeds = Math.ceil(t.call.seeds * (1 - rate));
          const at = [[p.x + 1, p.y], [p.x - 1, p.y], [p.x, p.y + 1], [p.x, p.y - 1]].find(([x, y]) => x >= 0 && y >= 0 && x < s.arena.w && y < s.arena.h && !E.geometry.actorAt(s, x, y) && !E.geometry.tileAt(s, x, y).blocksMove && !(s.wild || []).some((w) => w.form === "unit" && w.x === x && w.y === y));
          const no = s.pactActive ? `${SM.data.summons[s.pactActive.line]?.name || "A summon"} already answers.` : (s.summonUsed || []).includes(id) ? "It has answered once this battle." : !at ? "No open tile beside you." : p.tempo < cost.apCost + tax ? `Needs ${cost.apCost + tax} action points.` : p.pf < pf ? `Needs ${pf} ΦF.` : (s.seeds || 0) < seeds ? `Needs ${seeds} Seeds.` : "";
          return { id: `pact:${id}`, pactLine: id, at, label: `Call: ${def.name} · ${cost.apCost + tax} AP · ${pf} ΦF · ${seeds} S`, why: no || `Pacted: no question, full bond, ${t.duration + (SM.data.rules.bondBonusDuration || 0) + (p.passives?.summonDurationAdd || 0)} turns.${rate ? ` Standing rate −${Math.round(rate * 100)}%.` : ""}`, off: !!no };
        }) : []),
        ...(PC && SM && s.pactActive && !s.actors[s.pactActive.summonId]?.defeated ? [{ id: "dismissPact", label: `Dismiss ${SM.data.summons[s.pactActive.line]?.name || "summon"} · free`, off: controlledId(s) !== s.pactActive.owner, why: controlledId(s) !== s.pactActive.owner ? "Only the caller dismisses the call." : "Send them home cleanly: builds standing toward the rate. Free, and keeps your turn." }] : [])];
      if (U.menu === "strike") return [...["head", "arms", "legs"].map((z) => ({ id: `aim:${z}`, aim: z, label: `Aim ▸ ${z} (+${s.rules.injury.aimAp} AP, −${Math.round(s.rules.injury.aimMiss * 100)}%)${U.strikeAim === z ? " · SET" : ""}`, why: "A called shot: a landed blow wounds that zone whatever the damage. Pick an effort below to throw it." })),
        { id: "aim:none", aimClear: true, label: `Aim ▸ none${!U.strikeAim ? " · SET" : ""}`, why: "Strike without a called shot: no extra AP and no added miss chance." },
        ...[10, 25, 40, 50, 75, 100, 125, 150].filter(points => points <= (E.mindset(s, controlledId(s))?.noOverclock ? Math.min(p.tempo, s.rules.actionCosts.strikeMax) : Math.min(p.tempo + s.rules.maxTempoDebt, s.rules.actionCosts.strikeMax + s.rules.maxOverclockPerAction))).map(points => ({ id: String(points), effort: points, why: `A blow worth ${Math.round(s.rules.strike.potency * points / s.rules.actionCosts.strike)} potency for ${points} AP, no ΦF. You pick its target next. ${points > p.tempo ? `Tempo debt: ${points - p.tempo} AP, repaid from your next turn's budget.` : "No tempo debt."}`, label: `${points > s.rules.actionCosts.strikeMax ? "Overclocked strike" : points === 10 ? "Quick jab" : points === 50 ? "Committed strike" : points === 25 ? "Balanced strike" : "Heavy strike"} · ${points} AP · ${Math.max(0,points-p.tempo)} debt · ${Math.round(s.rules.strike.potency * points / s.rules.actionCosts.strike)} potency` })),
        ...(E.emergentIdeas(s, controlledId(s)).some((x) => x.id === "fulcrumThrow") ? (() => { const T = s.rules.emergentIdeas.fulcrumThrow, can = throwPickTargeting().legal.length > 0;
          return [{ id: "throw", throwPick: true, off: p.tempo < T.ap || !can, label: `Fulcrum Throw · ${T.ap} AP · lift, then throw up to ${T.range} tiles`,
            why: `Timing + Leverage. Lift a unit or a loose object beside you and throw it. A thrown opponent takes ${T.damage} (×${T.heldMul} out of a hold); whoever it lands on takes ${T.impact}, or ${T.objectDamage} from an object.${can ? "" : " Nothing beside you can be lifted."}` }]; })() : []),
        ...(s.rules.submission ? Object.values(s.actors).filter((t) => !t.defeated && t.side !== p.side && !t.status?.submission && t.status?.grappled && t.status.grappled.untilRound >= s.round && t.status.grappled.owner === controlledId(s)).flatMap((t) => {
          const R = s.rules.submission, canFinish = (p.ultimateCharge || 0) >= s.rules.ultimateChargeMax || (p.inspiration || 0) >= 1;   // Submission (docs/submission.md)
          return [{ id: `submit:${t.id}`, submitOn: t.id, off: p.tempo < R.pressAp, label: `Press the submission on ${t.name} · ${R.pressAp} AP`, why: `Start the struggle. Each round your grapple, plus how long you have held, against ${t.name}'s strength and grapple: reach +${R.meter} and they submit (spared, out of the fight); −${R.meter} and they break free. Your ultimate bar drains ${R.ultDrain} a round while it lasts, and ${R.maxRounds} rounds is the most anyone can hold on.` },
            ...(((p.ultimateCharge || 0) >= s.rules.ultimateChargeMax && (p.inspiration || 0) >= 1)   // both ways to pay: one row each (Mala, 2026-10-26: Inspiration may pay and keep the bar)
              ? [{ id: `finish:${t.id}`, submitOn: t.id, finish: true, pay: "ult", label: `Finish the submission on ${t.name} · full ULT`, why: `${t.name} gets one answer: break the hold (${R.finishBreakAp} AP owed and their reaction) or submit. Your full ultimate bar is spent either way.` },
                 { id: `finish-insp:${t.id}`, submitOn: t.id, finish: true, pay: "inspiration", label: `Finish the submission on ${t.name} · 1 Inspiration (keep your bar)`, why: `${t.name} gets one answer: break the hold (${R.finishBreakAp} AP owed and their reaction) or submit. 1 Inspiration is spent either way; your ultimate bar stays full.` }]
              : [{ id: `finish:${t.id}`, submitOn: t.id, finish: true, off: !canFinish, label: `Finish the submission on ${t.name} · full ULT or 1 Inspiration`, why: `${t.name} gets one answer: break the hold (${R.finishBreakAp} AP owed and their reaction) or submit. The bar or Inspiration is spent either way.${canFinish ? "" : " You need a full ultimate bar or 1 Inspiration."}` }])];
        }) : []),
        { id: "grapple", grapple: true, off: p.tempo < E.grappleCost(s, controlledId(s)), label: `Grapple · ${E.grappleCost(s, controlledId(s))} AP · ${E.strongGrip(s, controlledId(s)) ? "always holds (Strong Grip)" : `${Math.round(s.rules.grapple.base * 100)}% to hold`}`, why: `No damage. A held target cannot move or dodge for the rest of this round and the next, and loses ${s.rules.grapple.apCut} AP. Harder against a guard, easier on a stunned target. A hold breaks when either unit is moved by anything but its own Move, Jump or Climb (a shove, pull, throw, dash, swap, teleport or dodge).` }];
      if (U.menu === "investigate") return Object.values(s.actors).filter((a) => a.id !== "player" && !a.defeated).map((a) => { const sees = E.geometry.hasSight(s, p.x, p.y, a.x, a.y); return { id: a.id, label: `${a.name}${a.side === "player" ? " · ally" : ""}${sees ? "" : " · unseen"}`, off: !sees || p.tempo < INS.data.rules.investigate.minAP + invTax(s, p) || E.heldCostMul(s, controlledId(s)) !== 1, why: sees ? `Investigate ${a.name}: all ${p.tempo} AP, at least ${Math.floor((p.tempo - invTax(s, p)) / INS.data.rules.observe.apPerPoint) + INS.data.rules.investigate.depthBonus} points${invTax(s, p) ? ` (a wounded head costs ${invTax(s, p)} AP of the study)` : ""} (progress carried from earlier looks and some traits add more).` : `${a.name} is out of your line of sight, so you cannot investigate them.` }; });
      if (U.menu === "observe") return [
        ...((p.traits || []).some((t) => (t.id || t) === "scout") ? (() => { const c = E.reportCheck(s, controlledId(s)), d = INS.data.actions.report; return [{ id: "report", label: `Report · ${d.cost} AP`, off: !!c.error, why: c.error ? `${c.error} ${d.text}` : d.text }]; })() : []),
        ...(Climate && s.weatherState ? [{ id: "place", label: `Observe the place · ${U.observeInvest} AP`, off: p.tempo < U.observeInvest, why: "Read the weather, forecast and microclimate here. Place familiarity makes a Dream Space easier to open and hold." }] : []),
        ...(typeof plantMenu === "function" ? plantMenu() : []),   // plants: study here; known ones answer from the Rituals tab
        ...(typeof structureMenu === "function" ? structureMenu() : []),   // structures: study here; known ones wake from the Rituals tab
        ...Object.values(s.actors).filter((a) => a.id !== "player" && !a.defeated).map((a) => { const sees = E.geometry.hasSight(s, p.x, p.y, a.x, a.y); return { id: a.id, label: `${a.name}${a.side === "player" ? " · ally" : ""}${sees ? "" : " · unseen"}`, off: !sees, why: sees ? `Study ${a.name}: ${U.observeInvest} AP of effort, one insight point for each 10 AP.` : `${a.name} is out of your line of sight, so you cannot observe them.` }; }),
      ];
      if (U.menu === "insight") {
        const target = s.actors[U.insightTarget], deck = s.insight?.decks?.[U.insightTarget], know = s.insight?.knowledge?.player?.[U.insightTarget];
        if (!target || !deck || !know || !INS) return [];
        const snapshot = { round: s.round, units: Object.values(s.actors), wild: s.wild, playerSeeds: U.account.seeds || 0,
          alliesOf: Object.fromEntries(Object.values(s.actors).map(u => [u.id, Object.values(s.actors).filter(v => v.side === u.side && v.id !== u.id && !v.defeated)])),
          fire: s.arena.map.some(row => row.includes("f")) };
        return [...INS.actionsFor({ deck, know, subject: target, snapshot }).map(a => {
          const chance = a.id === "talk" ? null : a.chance;
          const talkClosed = a.id === "talk" && E.talkChance ? E.talkChance(s, controlledId(s), target.id) === 0 : false;   // Parley: language, grudges, closed talk
          const helpText = a.id === "talk"
            ? "Sit them down for a battle of minds: simultaneous arguments over up to 4 rounds, margin damage, willpower on the line. Win and they stand down (Come to terms opens) plus concede by severity; lose and you stand down and pick your own poison. Read their traits first — a hidden immune rebounds."
            : a.id === "befriend" ? "Try to make a friend: a 40% chance they stop attacking you for three rounds. They may still attack your summons. Failure spends the AP without creating a truce."
            : a.id === "readTell" ? "Use an observed warning sign to prepare for their next announced or delayed attack. That response does not spend your reaction; dodging still costs its usual AP."
            : a.id === "ask" ? "Ask what they intend to do next. Reveals their likely next action from the current board; later changes can change their plan."
            : a.text;
          const price = E.talkCost(s, controlledId(s), a.id, a.cost), fast = price !== a.cost;   // Speed-Talker: half price, lands 85% as often
          const blocked = p.tempo < price ? ` Needs ${price} AP; you have ${p.tempo}.` : talkClosed ? " Conversation is unavailable with this target." : "";
          return { id: a.id, label: `${a.name}${a.id === "talk" ? " · mind duel" : chance != null ? ` · ${Math.round(chance * 100)}%` : ""} · ${price} AP`, action: a.id,
            help: `${helpText} Costs ${price} AP.${fast ? " Speed-Talker: half the action points, and it lands 85% as often." : ""}${chance != null ? ` Current success chance: ${Math.round(chance * 100)}%.` : ""}${blocked}`,
            off: p.tempo < price || talkClosed };
        }), ...imitateMenu(target, deck, know)];
      }
      if (U.menu === "mockTrial") {   // W1.3: pick the accused — needs presented evidence + triable counts
        const TR = root.ConceptCombatTrial;
        return Object.values(s.actors).filter((u) => u.side !== "player" && !u.defeated).map((u) => {
          const revealed = s.insight?.knowledge?.player?.[u.id]?.revealed?.length || 0;
          const ev = Object.values(s.cls?.lawEvidence?.[u.id] || {}).flat();
          const counts = TR ? TR.countsFromEvidence(ev, (s.cls?.testimony || []).filter((w) => w.target === u.id || w.subject === u.id)) : [];
          const why = revealed < 2 ? `Observe first (${revealed}/2 findings)` : !counts.length ? "No counts name them" : p.tempo < 25 ? "Needs 25 AP" : "";
          return { id: `accuse:${u.id}`, label: `Accuse ${u.name} (${counts.length} counts)`, off: !!why, why: why || "1 rite step + presented evidence. Violence pauses; the court argues." };
        });
      }
      if (U.menu === "trial") {   // W1.3: prosecution moves — queue this round's press (10 AP each)
        const TR = root.ConceptCombatTrial;
        if (!s.trial || s.trial.over || !TR) return [];
        if (s.trial.accusedId === "player") {   // arrest-trial: the accused directs their own defense
          const dhelps = { argue: "Argue the count: unproven counts get struck, firm ones shift your way.", evidence: "Call the first willing witness for the defense.", appeal: "Appeal to the room: favor swings defense.", end: "Rest: let the count stand as graded.", confess: "Confess: end it, take the sentence.", finalPlea: "One plea from the heart, once per trial." };
          return TR.legalPlays(s.trial.t, "defense").map((m) => ({ id: `trialDefend:${m}`, move: m, label: `${m} · 10 AP`, off: p.tempo < 10, why: p.tempo < 10 ? "Needs 10 AP" : "", help: `${dhelps[m] || m} Favor ${s.trial.t.favor >= 0 ? "+" : ""}${s.trial.t.favor}; +2 acquits.` }));
        }
        const helps = { press: "Press the count: favor swings prosecution.", evidence: "Call the first willing witness: grades firm up, favor swings hard.", end: "Rest: let the count stand as graded." };
        return TR.legalPlays(s.trial.t, "prosecution").map((m) => ({ id: `trialMove:${m}`, move: m, label: `${m} · 10 AP`, off: p.tempo < 10, why: p.tempo < 10 ? "Needs 10 AP" : "", help: `${helps[m] || m} Favor ${s.trial.t.favor >= 0 ? "+" : ""}${s.trial.t.favor}; −2 calls the Sword.` }));
      }
      if (U.menu === "lens") {
        const out = [];
        for (const c of [p.primary, p.secondary].filter(Boolean)) for (const [id, pr] of Object.entries(C.concepts[c].lens.profiles))
          out.push({ id: c + ":" + id, label: `${C.concepts[c].name}: ${pr.name}`, off: p.lens[c] === id || pr.proficiency > p.proficiency, pr, cur: p.lens[c] === id, why: pr.proficiency > p.proficiency ? `${pr.trade} Needs lens proficiency ${pr.proficiency} (you have ${p.proficiency}).` : p.lens[c] === id ? `${pr.trade} This lens is already set.` : pr.trade });
        return out;
      }
      if (U.menu === "swap") return p.reserve.map((c) => ({ id: c, label: `Equip ${C.concepts[c].name}`, why: `Costs ${U.s.rules.actionCosts.swap} AP. ${C.concepts[c].name} replaces your secondary from your next turn start.` }));
      return [];
    }
    function renderCommands() {
      const s = U.s, el = $("ccCmd");
      if (s.outcome) {
        el.innerHTML = `<div class="cc-title">Battle over</div>${(s.mirror?.resolvable || []).map(trait => `<button type="button" class="cc-item" data-trauma="${esc(trait)}">Work through: ${esc(MIR?.data?.traumas?.[trait]?.becomes?.name || trait)}</button>`).join("")}${rushButtons(s) ?? abductionButtons(s) ?? `<button type="button" class="cc-item" data-cmd="again">Play again</button><button type="button" class="cc-item" data-cmd="exit">← Library</button>`}${abductionButtons(s) ? `<button type="button" class="cc-item" data-cmd="exit">← Library (stay taken)</button>` : ""}`;
        bindCmd(el); el.querySelectorAll("[data-trauma]").forEach(b => b.onclick = () => act({ type: "resolveTrauma", actor: "player", trait: b.dataset.trauma })); return;
      }
      if (U.mode === "wait") { el.innerHTML = `<div class="cc-title">Opponents act…</div><div class="cc-muted">Watch the log for what each edge did.</div>`; return; }
      if (U.mode === "mind") { el.innerHTML = `<div class="cc-title">Battle of minds</div><div class="cc-muted">Argue in the window. Turn order does not exist here — only reads matter.</div>`; return; }
      if (U.mode === "response") {
        const d = s.actors[E.decider(s).actor], ro = E.responseOptions(s), safe = ro.filter((r) => r.kind === "reposition" && r.safe).length;
        const throws = ro.filter((r) => r.kind === "dodgeThrow");   // Insane Reflexes: the engine offers throw tiles; the card arms them
        const price = defensiveResponsePrices(s, d, ro);
        if (s.pending.inst.submissionFinish) {   // Submission finish: break the hold, or tap out
          const R = s.rules.submission, can = ro.some((r) => r.kind === "breakHold");
          el.innerHTML = `<div class="cc-title cc-alarm">Submission!</div><div class="cc-muted">${esc(s.actors[s.pending.attacker].name)} goes for the finish. Break the hold now, or you submit: spared, but out of the fight.</div>
            ${can ? `<button type="button" class="cc-item" data-resp="breakHold">Break the hold · ${R.finishBreakAp} AP owed next turn · your reaction</button>` : ""}<button type="button" class="cc-item" data-resp="none">Tap out · submit</button>`;
          el.querySelectorAll("[data-resp]").forEach((b) => b.onclick = () => act({ type: "respond", actor: d.id, response: b.dataset.resp })); return;
        }
        if(s.pending.inst.audienceOnly){el.innerHTML=`<div class="cc-title cc-alarm">The Actor has an audience</div><div class="cc-muted">The named target receives the technique. Look away to avoid the 8 AP distraction.</div><button type="button" class="cc-item" data-resp="lookAway">Look away · 0 AP · 1 reaction</button><button type="button" class="cc-item" data-resp="none">Keep watching · 0 AP · keep reaction</button>`;el.querySelectorAll("[data-resp]").forEach(b=>b.onclick=()=>act({type:"respond",actor:d.id,response:b.dataset.resp}));return;}
        // Reactive defense (2026-10-15): techniques that can answer this attack, one button each (a wall: one per tile on the line).
        const techs = ro.filter((r) => r.kind === "technique"), techButtons = techs.map((r, i) => `<button type="button" class="cc-item" data-tech="${i}">${esc(r.name)}${r.ability === "shieldWall" ? ` at (${r.target.join(",")})` : ""}${r.answer ? ` · cancels it · full ULT · ${r.inspired ? "1 Inspiration" : `${r.pf} ΦF`}` : ` · ${r.pf} ΦF`} · ${r.apCost} AP · ${price.reaction}</button>`).join("");
        const bindTech = () => el.querySelectorAll("[data-tech]").forEach((b) => b.onclick = () => { const r = techs[+b.dataset.tech]; act({ type: "respond", actor: d.id, response: "technique", ability: r.ability, target: r.target }); });
        if (s.pending.reactive) {
          el.innerHTML = `<div class="cc-title cc-alarm">Incoming</div>
            <div class="cc-muted">You see ${esc(s.actors[s.pending.attacker].name)}'s ${esc(s.pending.inst.name)} coming. Answer it with a reactive technique (${price.reaction}; its action points ${price.debt ? "owed next turn" : "spent now"}), or take it and keep your reaction.</div>
            ${techButtons}<button type="button" class="cc-item" data-resp="none">Take it · keep reaction</button>`;
          el.querySelectorAll("[data-resp]").forEach((b) => b.onclick = () => act({ type: "respond", actor: d.id, response: b.dataset.resp })); bindTech();
          return;
        }
        el.innerHTML = `<div class="cc-title cc-alarm">Defensive window</div>
          <div class="cc-muted">${esc(s.actors[s.pending.attacker].name)} ${s.pending.resume ? "committed" : "announced"} ${esc(s.pending.inst.name)}${s.pending.resume ? " and it is landing now" : ""}${s.pending.inst.deception ? `, claiming a reach of ${s.pending.inst.claimedRange} tiles` : ""}. Spend ${esc(d.name)}'s reaction?</div>
          <button type="button" class="cc-item" data-resp="guard">Guard · ${price.guard} AP · ${price.reaction} (×${s.rules.guardMultiplier} damage)</button>
          ${s.pending.inst.ability === "arrest" && ro.some((r) => r.kind === "kneel") ? `<button type="button" class="cc-item" data-resp="kneel">Kneel · ${price.reaction} · claim trial (the court hears it; the cuffs stay on)</button>` : ""}
          <div class="cc-muted"><b>Dodge · ${price.dodge} AP · ${price.reaction}</b>${price.debt ? " · owed next turn" : " · spent now"}. ${price.dodgeAvailable ? `Click a highlighted tile (${safe} safe tile${safe === 1 ? "" : "s"} within ${price.reach}).` : "Unavailable: no legal dodge within your movement and AP/debt limits."}</div>
          ${throws.length ? `<button type="button" class="cc-item" data-throwarm>${U.throwArmed ? `Throw armed: click a red tile (land within 6 of the attacker)` : `Insane Reflexes: arm the dodge-throw · ${throws[0].apCost} AP`}</button>` : ""}
          ${techButtons}<button type="button" class="cc-item" data-resp="none">Take it · ${price.take} AP · keep reaction</button>`;
        el.querySelectorAll("[data-resp]").forEach((b) => b.onclick = () => { U.throwArmed = false; act({ type: "respond", actor: d.id, response: b.dataset.resp }); }); bindTech();
        el.querySelector("[data-throwarm]") && (el.querySelector("[data-throwarm]").onclick = () => { U.throwArmed = !U.throwArmed; render(); });
        return;
      }
      const items = menuList();
      U.menuIndex = Math.min(U.menuIndex, Math.max(0, items.length - 1));
      el.innerHTML = `<div class="cc-title">${U.menu === "root" ? "Command" : `<button type="button" class="cc-back" data-cmd="back">◂</button> ${{ tech: "Techniques", strike: "Strike · choose tempo", observe: "Observe", investigate: "Investigate", insight: "Insight", trial: "Trial", mockTrial: "Mock trial", lens: "Lens", swap: "Swap secondary", items: "Use item", drop: "Drop item", cook: "Cook", summons: "Summon an ally", ...Object.fromEntries(MENU_DRAWERS.map((d) => [d.id, d.title])) }[U.menu]}`}${U.menu === "root" && typeof apHead === "function" ? apHead(controlledFighter(s), E.heldCostMul(s, controlledId(s))) : ""}</div>` +
        (U.menu === "root" && U.mode === "menu" && CS ? `<div class="cc-search"><input id="ccSearch" type="search" placeholder="Search commands  /" autocomplete="off" spellcheck="false" aria-label="Search commands" value="${esc(U.search || "")}"></div>${quickBarMarkup()}<div id="ccSearchResults" ${U.search ? "" : "hidden"}>${U.search ? searchResultsMarkup() : ""}</div>` : "") +
        `<div id="ccMenuRows" ${U.menu === "root" && U.search ? "hidden" : ""}>` +
        items.map((it, i) => it.fold ? foldMarkup(it, i) : `${it.group && it.group !== items[i - 1]?.group ? `<div class="cc-group">${esc(it.group)}</div>` : ""}<div class="cc-command-row${it.inFold ? " cc-in-fold" : ""}" data-help-i="${i}"><button type="button" title="${esc(menuHelp(it))}" class="cc-item ${i === U.menuIndex ? "on" : ""} ${it.cur ? "cur" : ""}${it.dim ? " cc-dim" : ""}" data-i="${i}" ${it.off ? "disabled" : ""}${it.dim ? " aria-disabled=\"true\"" : ""}>
          ${it.x ? `<span class="cc-tier t-${it.x.m.tier}">${TIER[it.x.m.tier]}</span>` : ""}${esc(it.label)}${it.x ? `<span class="cc-cost">${it.x.m.tempoCost} AP · ${it.x.m.tier === "ultimate" && it.x.affordable && (controlledFighter(U.s)?.pf || 0) < it.x.m.cost ? "1 Inspiration for the ΦF" : `${it.x.m.cost} ΦF`}${lfLabel(it.x.m)}${it.x.m.tier === "ultimate" ? ` · ${U.s.rules.ultimateChargeMax} ULT` : ""}</span>` : ""}</button>${(() => { const key = U.mode === "menu" ? rowKey(it) : null; if (!key) return ""; const on = pins().includes(key); return `<button type="button" class="cc-pin ${on ? "on" : ""}" data-pin="${esc(key)}" title="${on ? "Unpin from" : "Pin to"} the quick bar" aria-label="${on ? "Unpin" : "Pin"} ${esc(cleanLabel(it.label))}">${on ? "★" : "☆"}</button>`; })()}</div>`).join("") + `</div>` +
        (["move", "press", "jump", "climb", "target"].includes(U.mode) ? `<div class="cc-muted cc-hint">${U.mode === "move" ? "Click a blue tile; terrain and slope change the move cost." : U.mode === "jump" ? "Choose an amber landing tile; fall damage is halved." : U.mode === "climb" ? "Choose a purple ledge; climbing uses the main action." : U.sel && U.sel.self ? "Enter / click yourself to commit." : "Click a ringed tile to commit."} Esc cancels.</div>` : "");
      el.querySelectorAll(".cc-item[data-i]").forEach((b) => {
        b.onfocus = () => { U.menuIndex = +b.dataset.i; if (U.mode === "menu") { renderDetail(); draw(); } };
        b.onclick = () => {   // a double click on a self-cast technique casts it at once (Mala, 2026-10-14)
          const it = items[+b.dataset.i];
          if (it?.fold) { const t = Date.now(); if (U.lastFold?.id === it.id && t - U.lastFold.t < 450) return; U.lastFold = { id: it.id, t }; return choose(it); }   // a double click on a header opens it once, not open-then-shut
          const now = Date.now(), again = U.lastPick?.id === it?.id && now - U.lastPick.t < 450;
          U.lastPick = { id: it?.id, t: now };
          if (again && U.mode === "target" && U.sel?.self && U.sel.ability === it.id) { U.lastPick = null; return commitAt([controlledFighter(U.s).x, controlledFighter(U.s).y]); }
          choose(it);
        };
      });
      el.querySelectorAll("[data-help-i]").forEach(row => {
        row.onmouseenter = () => { U.menuIndex = +row.dataset.helpI; if (U.mode === "menu") { renderDetail(); draw(); } };
      });
      bindRunPin(el);
      const sb = el.querySelector?.("#ccSearch");
      if (sb) {
        const results = el.querySelector("#ccSearchResults"), rows = el.querySelector("#ccMenuRows");
        const refresh = () => { results.hidden = !U.search; rows.hidden = !!U.search; results.innerHTML = U.search ? searchResultsMarkup() : ""; bindRunPin(results); };
        sb.oninput = () => { U.search = sb.value; U.searchIndex = 0; refresh(); };
        sb.onkeydown = (ev) => {   // the box keeps its own keys: ↑↓ through results, Enter runs, Esc clears then leaves
          const res = [...results.querySelectorAll("[data-run]")];
          if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); if (!res.length) return; U.searchIndex = (U.searchIndex + (ev.key === "ArrowDown" ? 1 : -1) + res.length) % res.length; refresh(); }
          else if (ev.key === "Enter") { ev.preventDefault(); const b = res[U.searchIndex || 0]; if (b) runCommand(b.dataset.run); }
          else if (ev.key === "Escape") { ev.preventDefault(); if (U.search) { U.search = ""; sb.value = ""; refresh(); } else sb.blur(); }
        };
        if (U.searchFocus) { sb.focus({ preventScroll: true }); sb.setSelectionRange(sb.value.length, sb.value.length); }
        sb.onfocus = () => { U.searchFocus = true; }; sb.onblur = () => { U.searchFocus = false; };
      }
      bindCmd(el);
    }
    // Search, quick bar and grouped Techniques (Mala, 2026-10-26; docs/command-menu.md; command-search.js ranks and pins).
    // Every command is a row in some menu state: root (drawers fold root rows), or one of the submenus below. A command's
    // key is "<state>|<row id>"; running it re-enters that state and chooses the row, so search and pins never duplicate
    // what a row does.
    const SUBMENUS = ["tech", "strike", "observe", "investigate", "lens", "swap", "items", "cook", "drop", "summons"];
    const cleanLabel = (t) => String(t || "").replace(/\s*▸.*$/, "").trim();
    function commandIndex() {
      const s = U.s; if (!s || s.outcome) return [];
      const saved = U.menu, gate = (rows) => apGate(rows, controlledFighter(s)?.tempo ?? 0, E.heldCostMul(s, controlledId(s))), flat = gate(rootItems()), out = [];
      const entry = (ctx, it, path, parentOff) => ({ key: `${ctx}|${it.id}`, ctx, id: it.id, label: it.label, path, help: menuHelp(it) || "", off: !!it.off || !!parentOff,
        why: it.why || "", cost: it.x ? `${it.x.m.tempoCost} AP · ${it.x.m.cost} ΦF${lfLabel(it.x.m)}` : "" });
      for (const it of flat) if (!it.drawer && !SUBMENUS.includes(it.id)) out.push(entry("root", it, drawerOf(it)?.title || ""));
      try {
        for (const sub of [...SUBMENUS, "insight", "trial", "mockTrial"]) {   // search covers every submenu, not just the drawer nine (Grok Keystone, 2026-10-27)
          const opener = flat.find((it) => it.id === sub); if (!opener) continue;
          U.menu = sub; let kids = []; try { kids = gate(subItems() || []); } catch { kids = []; }
          const path = [drawerOf(opener)?.title, cleanLabel(opener.label)].filter(Boolean).join(" ▸ ");
          for (const k of kids) if (!k.drawer && !SUBMENUS.includes(k.id) && !k.header) out.push(entry(sub, k, path, opener.off));
        }
      } finally { U.menu = saved; }
      return out;
    }
    const pinKey = () => `loci:combat:pins:${controlledFighter(U.s)?.character || "player"}`;
    const pins = () => (U.s ? store.get(pinKey(), []) : []);
    function runCommand(key) {
      const e = commandIndex().find((x) => x.key === key);
      if (!e) return flashTip("Not available right now.");
      if (e.off) return flashTip(e.why || `${cleanLabel(e.label)} can't be used right now.`);
      U.search = ""; U.searchFocus = false; U.menuFrom = null; U.menu = e.ctx; U.menuIndex = 0;   // a search jump starts fresh: ◂ goes home, not to a stale parent
      const it = (e.ctx === "root" ? rootItems() : subItems()).find((x) => x.id === e.id);
      if (!it) { U.menu = "root"; return flashTip("Not available right now."); }
      choose(it);
    }
    const runPin = (i) => { const k = pins()[i]; if (k) runCommand(k); };
    function togglePinKey(key) {
      const r = CS.togglePin(pins(), key); if (r.error) return flashTip(r.error);
      store.set(pinKey(), r.pins); renderCommands();
    }
    // The key a row in the current menu would pin under (none for drawers and submenu openers).
    const rowKey = (it) => (!it || it.drawer || it.fold || SUBMENUS.includes(it.id) || typeof CS === "undefined" || !CS) ? null : `${inDrawer() ? "root" : U.menu}|${it.id}`;
    function quickBarMarkup() {
      if (!CS) return "";
      const list = pins(), idx = list.length ? commandIndex() : [];
      if (!list.length) return `<div class="cc-quick cc-quick-empty" title="Pin commands with ☆ to keep them here · keys 1–${CS.PINS_MAX}"></div>`;   // empty bar stays slim and silent; the hint lives on hover (Grok Keystone, 2026-10-27)
      return `<div class="cc-quick" role="toolbar" aria-label="Quick bar">${list.map((k, i) => { const e = idx.find((x) => x.key === k), off = !e || e.off;
        return `<button type="button" class="cc-quick-slot" data-run="${esc(k)}" ${off ? "aria-disabled=\"true\"" : ""} title="${esc(e ? `${cleanLabel(e.label)}${e.path ? ` · ${e.path}` : ""}${off ? ` · ${e.why || "not usable right now"}` : ""}` : "Not available in this battle")}"><b>${i + 1}</b>${esc(cleanLabel(e ? e.label : k.split("|")[1]).split(" · ")[0])}</button>`; }).join("")}</div>`;
    }
    function searchResultsMarkup() {
      const res = CS.search(commandIndex(), U.search || ""); U.searchIndex = Math.min(U.searchIndex || 0, Math.max(0, res.length - 1));
      if (!res.length) return `<div class="cc-muted">Nothing matches “${esc(U.search)}”.</div>`;
      const pinned = new Set(pins());
      return res.map((e, i) => `<div class="cc-command-row"><button type="button" class="cc-item ${i === U.searchIndex ? "on" : ""}" data-run="${esc(e.key)}" ${e.off ? "aria-disabled=\"true\"" : ""} title="${esc(e.off ? e.why || "Not usable right now" : e.help)}"><span class="cc-hit"><span>${esc(cleanLabel(e.label))}</span><span class="cc-path">${esc([e.path || "Command", e.cost].filter(Boolean).join(" · "))}</span></span></button><button type="button" class="cc-pin ${pinned.has(e.key) ? "on" : ""}" data-pin="${esc(e.key)}" title="${pinned.has(e.key) ? "Unpin from" : "Pin to"} the quick bar" aria-label="${pinned.has(e.key) ? "Unpin" : "Pin"} ${esc(cleanLabel(e.label))}">${pinned.has(e.key) ? "★" : "☆"}</button></div>`).join("");
    }
    function bindRunPin(scope) {
      scope.querySelectorAll("[data-run]").forEach((b) => b.onclick = () => runCommand(b.dataset.run));
      scope.querySelectorAll("[data-pin]").forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); togglePinKey(b.dataset.pin); });
    }
    // Techniques, grouped under headers (contracts, primary, secondary, ultimates, stances) without changing the rows.
    function techGroup(it, p) {
      if (it.contractAction || it.x?.contract) return [0, "Contracts"];   // speak, prepare, release, and the contract techniques themselves
      if (!it.x) {   // non-ability rows file under their own system, never the old catch-all (Grok Keystone, 2026-10-27)
        if (/^(mend|tend|salv):/.test(it.id)) return [4, "Care"];
        if (/^(seal|reaper|grant):/.test(it.id)) return [5, "Seals"];
        if (it.id.startsWith("deathVision:")) return [6, "Presence"];
        if (it.id === "vow") return [7, "Stances"];
        if (it.id === "lens") return [8, "Lens"];
        return [7, "Stances"];
      }
      if (it.x.m.tier === "ultimate") return [3, "Ultimates"];
      const c = it.x.m.concept; return [c === p.primary ? 1 : c === p.secondary ? 2 : 2, C.concepts[c]?.name || "Techniques"];
    }
    // Stable sort by group: rows keep their order inside a group, and each row learns its header.
    const groupTech = (p, rows) => rows.map((it, i) => ({ it, i, g: techGroup(it, p) })).sort((a, b) => a.g[0] - b.g[0] || a.i - b.i).map(({ it, g }) => ({ ...it, group: g[1] }));
    function ritualGroup(it) {   // Rituals holds dreams through wards: headers keep it navigable (Grok Keystone, 2026-10-27)
      const id = String(it?.id || "");
      if (["dreamSpace", "wakeDream", "aura"].includes(id) || id.startsWith("focusDream:")) return [0, "Dreams"];
      if (["summons", "orderSummonUltimate", "bead"].includes(id)) return [1, "Summons"];
      if (["ritual", "ritualHold", "tameBeast", "markVessel", "callPack"].includes(id)) return [2, "Capture"];
      if (id === "commune" || id === "communeStructure" || id.startsWith("treeant") || id.startsWith("maxChannel")) return [3, "Communion"];
      if (id.startsWith("rite") || id === "mockTrial") return id === "mockTrial" ? [6, "Trials"] : [4, "Rites"];
      if (id === "declarePresence" || id.startsWith("declareWard:")) return [5, "Wards"];
      return [7, "Becoming"];
    }
    const groupRitual = (rows) => rows.map((it, i) => ({ it, i, g: ritualGroup(it) })).sort((a, b) => a.g[0] - b.g[0] || a.i - b.i).map(({ it, g }) => ({ ...it, group: g[1] }));
    function gearGroup(it) {   // Gear drawer: what you carry, what you wear, the forms you can take (Mala, 2026-10-30)
      const id = String(it?.id || "");
      if (["items", "cook", "drop", "takeFromCart"].includes(id)) return [0, "Pack"];
      if (id.startsWith("worn:")) return [1, "Worn"];
      if (id === "breakOrb" || id === "releaseForm" || id.startsWith("enterForm:") || id.startsWith("vowForm:")) return [2, "Forms"];
      if (id === "swap") return [3, "Loadout"];
      return [4, "Other"];
    }
    const groupGear = (rows) => rows.map((it, i) => ({ it, i, g: gearGroup(it) })).sort((a, b) => a.g[0] - b.g[0] || a.i - b.i).map(({ it, g }) => ({ ...it, group: g[1] }));
    // Collapsible groups (Mala, 2026-10-30): in the Techniques list and the Gear drawer a group of two or more rows is one
    // header you open or close. Closed by default; the choice is kept (localStorage) across turns and battles. A closed
    // group's rows leave the list, so arrows and Enter walk only what is shown; a one-row group stays a flat header.
    const FOLD_VIEWS = ["tech", "drawer:gear"], FOLD_KEY = "loci:combat:menu-open:v1";
    const foldId = (g) => `${U.menu}|${g}`;
    function foldRows(rows) {
      if (!FOLD_VIEWS.includes(U.menu)) return rows;
      const raw = store.get(FOLD_KEY, {}), open = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}, out = [];
      for (const [i, it] of rows.entries()) {
        const n = it.group ? rows.filter((x) => x.group === it.group).length : 0;
        if (n < 2) { out.push(it); continue; }
        const isOpen = !!open[foldId(it.group)];
        if (it.group !== rows[i - 1]?.group) out.push({ id: `fold:${foldId(it.group)}`, fold: true, group: it.group, count: n, open: isOpen, label: it.group, off: false,
          help: `${it.group}: ${n} ${n === 1 ? "row" : "rows"}. ${isOpen ? "Open: Enter closes it." : "Closed: Enter opens it."}` });
        if (isOpen) out.push({ ...it, group: undefined, inFold: true });
      }
      return out;
    }
    function toggleFold(it) { const raw = store.get(FOLD_KEY, {}), open = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}, k = foldId(it.group); if (open[k]) delete open[k]; else open[k] = true; store.set(FOLD_KEY, open); }
    const foldMarkup = (it, i) => `<div class="cc-command-row cc-fold-row" data-help-i="${i}"><button type="button" title="${esc(menuHelp(it))}" class="cc-item cc-fold ${i === U.menuIndex ? "on" : ""}" data-i="${i}" aria-expanded="${it.open}"><span class="cc-chev" aria-hidden="true">${it.open ? "▾" : "▸"}</span>${esc(it.group)}<span class="cc-fold-n">${it.count}</span></button></div>`;
    function bindCmd(el) {
      el.querySelectorAll("[data-cmd]").forEach((b) => b.onclick = () => {
        if (b.dataset.cmd === "back") return back();
        if (b.dataset.cmd === "again") return showSetup();
        if (b.dataset.cmd === "rushNext") return startSafely({ encounter: "bossRush", rushContinue: true });
        if (b.dataset.cmd === "escapeShip") return startSafely({ encounter: "escapeShip", opener: "player" });
        if (b.dataset.cmd === "exit") return opts.onExit && opts.onExit();
        if (b.dataset.cmd === "menu") return showSetup();
      });
    }
    // An in-battle card (Contains Multitudes, Audition, vows, stakes, commune, summon question) sits in #ccOverlay and ends in a
    // Cancel button. Every way out (◂, Escape, Backspace, ←, the app's ← Back) closes that card first and stays in the fight:
    // the app's ← used to run backOut() -> showSetup() with the card open and drop the player out of the battle (Mala, 2026-10-30).
    const openCardCancel = () => {
      const ov = $("ccOverlay");
      return !ov || ov.hidden || !U.s || ["setup", "town", "account", "studio", "over", "teach"].includes(U.mode) ? null : ov.querySelector(".cc-card > button[id$='Cancel']");
    };
    function closeCard() { const c = openCardCancel(); if (!c) return false; c.click(); return true; }
    function back() { if (closeCard()) return; U.mode = "menu"; U.sel = null; U.pendingSummon = null; U.audRole = null; U.audVow = null; U.strikeAim = null; if (U.menu !== "root") { U.menu = U.menuFrom || "root"; U.menuFrom = null; } U.menuIndex = 0; render(); }   // ◂ steps to the parent menu, not always the root (Grok Keystone, 2026-10-27)
    // Mind duel modal (battle of minds): two willpower panels, intel reads, four arguments, vows, concessions.
    function renderMindDuel() {
      const ov = $("ccOverlay"), ix = U.s.phase === "mind" && E.mindIntel ? E.mindIntel(U.s, controlledId(U.s)) : null;
      ov?.classList.toggle("cc-mind-host",!!ix);
      if (!ix) { if (U.mindOpen && ov) { ov.hidden = true; ov.innerHTML = ""; } U.mindOpen = false; return; }
      U.mindOpen = true; ov.hidden = false;
      const focused=document.activeElement, key=["move","vow","concede"].find(k=>focused?.dataset?.[k]);
      const keepFocus=key?{key,value:focused.dataset[key]}:null;
      const open=new Set([...ov.querySelectorAll("details[data-mind-fold][open]")].map(d=>d.dataset.mindFold));
      ov.innerHTML=mindDuelMarkup(ix,U.s.actors);bindPortraitFallbacks(ov);
      ov.querySelectorAll("details[data-mind-fold]").forEach(d=>{d.open=open.has(d.dataset.mindFold);});
      const dialog=ov.querySelector(".cc-mind-dialog");
      dialog.onkeydown=e=>{if(e.key!=="Tab")return;const stops=[...dialog.querySelectorAll("button:not(:disabled),summary")].filter(el=>el.offsetParent!==null && !el.closest("details:not([open]) > :not(summary)"));const first=stops[0],last=stops.at(-1);if(!first)return;
        if(document.activeElement===dialog){e.preventDefault();(e.shiftKey?last:first).focus();return;}
        if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}};
      const restore=keepFocus && [...ov.querySelectorAll(`[data-${keepFocus.key}]`)].find(b=>b.dataset[keepFocus.key]===keepFocus.value);
      if(!U.closeup)(restore || ov.querySelector("[data-move], [data-concede]:not(:disabled)") || dialog).focus({preventScroll:true});
      ov.querySelectorAll("[data-move]").forEach((b) => b.onclick = () => act({ type: "mindPick", actor: "player", move: b.dataset.move }));
      ov.querySelectorAll("[data-vow]").forEach((b) => b.onclick = () => act({ type: "mindVow", actor: "player", vow: b.dataset.vow }));
      ov.querySelectorAll("[data-concede]").forEach((b) => b.onclick = () => act({ type: "mindConcede", actor: "player", choice: b.dataset.concede }));
    }
    function choose(it) {
      if (!it || it.off) return;
      const s = U.s, p = controlledFighter(s);
      if (it.drawer) { U.menuFrom = U.menu; U.menu = it.id; U.menuIndex = 0; return render(); }
      if (it.fold) { toggleFold(it); render(); return $("ccCmd").querySelector(".cc-fold.on")?.focus({ preventScroll: true }); }   // a group header opens or closes; nothing is issued
      U.afterActMenu = inDrawer() ? U.menu : null; if (inDrawer()) U.menu = "root";
      if (U.menu === "root") {
        if(it.id?.startsWith("verse:"))return act({type:"chooseVerse",actor:"player",ability:it.id.slice(6)});
        if(it.id==="discardVerse")return act({type:"discardVerse",actor:"player"});
        if(it.id==="dismissUlaula")return act({type:"dismissUlaula",actor:"player"});
        if(it.id?.startsWith("press:")){U.pressUnit=it.id.slice(6);U.mode="press";U.cursor=E.fullCourtPressOptions(s,U.pressUnit)[0]?.to;return render();}
        if (it.id === "move") { U.mode = "move"; U.cursor = [p.x, p.y]; return render(); }
        if (it.id === "jump") { U.mode = "jump"; U.cursor = E.jumpOptions(s, controlledId(s))[0].to; return render(); }
        if (it.id === "climb") { U.mode = "climb"; U.cursor = E.climbOptions(s, controlledId(s))[0].to; return render(); }
        if (it.id === "disengage") return act({ type: "disengage", actor: "player" });
        if (it.id === "card:show") return act({ type: "showHand", actor: "player" });   // Battle Cards (C1): Show your hand
        if (it.id?.startsWith("card:")) {   // a card: a target card enters target mode on the ringed tiles; a self card plays at once
          const row = E.cards.options(s, controlledId(s))[it.card];
          if (!row?.needsTarget) return act({ type: "playCard", actor: "player", card: it.card, target: null });
          U.mode = "target"; U.menu = "root"; U.sel = { card: it.card, tg: { range: row.targets, legal: row.targets.map((at) => ({ at })) } }; U.cursor = row.targets[0]; return render();
        }
        if (it.id === "scramble" || it.id === "playDead" || it.id === "standUp") return act({ type: it.id, actor: "player" });
        if (["tech", "strike", "observe", "investigate", "lens", "swap", "items", "cook", "drop", "summons"].includes(it.id)) { U.menuFrom = U.afterActMenu || U.menu; U.menu = it.id; U.menuIndex = 0; return render(); }   // afterActMenu still holds the drawer: the reset above already flattened U.menu
        if (it.id === "insight") { U.menuFrom = U.afterActMenu || U.menu; U.menu = "insight"; U.menuIndex = 0; return render(); }
        if (it.id.startsWith("order:")) { const [, to, role, focus] = it.id.split(":"); U.afterActMenu = inDrawer() ? U.menu : null; if (inDrawer()) U.menu = "root"; act({ type: "order", actor: "player", target: to, role, focus: focus || null }); return render(); }
        if (it.id === "trial") { U.menuFrom = U.afterActMenu || U.menu; U.menu = "trial"; U.menuIndex = 0; return render(); }
        if (it.id === "mockTrial") { U.menuFrom = U.afterActMenu || U.menu; U.menu = "mockTrial"; U.menuIndex = 0; return render(); }
        if (U.menu === "mockTrial" && it.id.startsWith("accuse:")) { const ok = act({ type: "invokeTrial", actor: "player", target: it.id.slice(7) }); if (ok) U.menu = "root"; return; }
        if (U.menu === "trial") { const defending = (s.trial && s.trial.accusedId === "player"); const ok = defending ? act({ type: "trialDefend", actor: "player", move: it.move }) : act({ type: "trialPlay", actor: "player", move: it.move }); if (ok) U.menu = "root"; return; }
        if (it.id === "stakes") return showStakesCard();
        if (it.id === "myol") {
          U.afterActMenu = inDrawer() ? U.menu : null; if (inDrawer()) U.menu = "root";
          act({ type: "myol", actor: "player", seeds: U.account.seeds || 0 });
          return render();
        }
        if (it.id === "stakeSeeds") return showStakeCard();
        if (it.id === "doubleDown") return act({ type: "doubleDown", actor: "player" });
        if (it.id === "observeSelf") return act({ type: "observeSelf", actor: "player" });
        if (it.id.startsWith("finding:")) return act({type:"journalFinding",actor:"player",fact:it.id.slice(8)});
        if (it.id.startsWith("journal:")) return act({ type: "journalNote", actor: "player", technique: it.id.slice(8) });
        if (it.id.startsWith("catchFish:")) return act({ type: "catchFish", actor: "player", at: it.id.slice(10).split(",").map(Number) });
        if (it.id === "resolveTrauma") return act({ type: "resolveTrauma", actor: "player", trait: it.trait });
        if (it.id === "becomeGolden") return act({ type: "becomeGolden", actor: "player" });
        if (it.id === "breakOrb") { const done = act({ type: "breakOrb", actor: "player", orb: it.orb }); if (done !== false && U.s.actors.player?.form?.from === it.orb && !U.practiceBattle && !U.s.devPlayground) { U.account = A.spendOrb(U.account, it.orb); saveAccount(); } return done; }   // the orb is gone from the account too
        if (it.id?.startsWith("enterForm:") || it.id?.startsWith("vowForm:")) return act({ type: "enterForm", actor: "player", form: it.id.split(":")[1], vow: it.id.startsWith("vowForm:") });   // learned forms
        if (it.id === "releaseForm") return act({ type: "releaseForm", actor: "player" });
        if (it.id === "recoverWater") return act({type:"recoverWater",actor:"player"});
        if (it.id === "guard") return act({ type: "guard", actor: "player" });
        if (it.id === "overwatch") return act({ type: "overwatch", actor: "player" });
        if (it.id === "pet") return act({ type: "pet", actor: "player", target: it.target });
        if (it.id === "breakGrapple") return act({ type: "breakGrapple", actor: "player" });
        if (it.id === "wakeDream") return act({ type: "wakeDream", actor: "player" });
        if (it.id?.startsWith("focusDream:")) return act({type:"focusDream",actor:"player",radius:Number(it.id.split(":")[1])});
        if (it.id === "dreamSpace") return root.ConceptCombatVows && !s.dreamSpace ? showVowCard("dream") : act({ type: "dreamSpace", actor: "player" });   // Vows
        if (it.id === "aura") return root.ConceptCombatVows && !p.aura && s.dreamSpace?.owner !== p.id ? showVowCard("aura") : act({ type: "aura", actor: "player" });   // Vows
        if (it.id?.startsWith("treeant:")) return act({ type: "treeant", actor: "player", target: it.id.slice(8) });   // Treeant
        if (it.id?.startsWith("maxChannel:")) return act({ type: "maxChannel", actor: "player", target: it.id.slice(11) });   // MAX channel
        if (it.id?.startsWith("terms:")) return act({ type: "terms", actor: "player", target: it.id.slice(6) });   // Parley
        if (it.id?.startsWith("tally-accept:") || it.id?.startsWith("tally-decline:")) return act({ type: "tallyTerms", actor: "player", target: it.id.split(":")[1], accept: it.id.startsWith("tally-accept:") });   // engine/tally.js
        if (it.id === "tallySettle") return act({ type: "tallySettle", actor: "player" });
        if (it.id?.startsWith("accept:") || it.id?.startsWith("decline:")) return act({ type: "answerTerms", actor: "player", target: it.id.split(":")[1], accept: it.id.startsWith("accept:") });
        if (it.id === "orderSummonUltimate") {
          const summon = s.actors[it.summonId], play = SM.activeUltimate(summon).play;
          if (play.centre === "playerTarget" || play.status?.lockTarget) {
            const hostile = a => a.side !== p.side;
            const legal = Object.values(s.actors).filter(a => hostile(a) && !a.defeated).map(a => ({ at: [a.x,a.y], tiles: [[a.x,a.y]] }));
            for (const m of s.wild || []) if (m.form === "unit" && !m.fleeing && m.lf > 0) legal.push({ at: [m.x,m.y], tiles: [[m.x,m.y]] });
            if (!legal.length) return flashTip("There is no living opponent to target.");
            U.menu = "root"; U.mode = "target"; U.sel = { summonUltimateOrder: it.summonId, tg: { range: legal.map(x => x.at), legal } }; U.cursor = legal[0].at; return render();
          }
          return act({ type: "orderSummonUltimate", actor: "player", summon: it.summonId });
        }
        if (it.id === "multitudes") return showMultitudesCard();
        if (it.id === "dismissEmbodiment") return act({ type: "dismissEmbodiment", actor: "player" });
        if (it.id === "recover") return act({ type: "recover", actor: "player" });
        if (it.id === "end") return act({ type: "end", actor: "player" });
        if (it.id === "stall") return act({ type: "stall", actor: "player" });
        if (it.id === "meditate") return act({ type: "meditate", actor: "player" });
        if (it.id === "declarePresence") return act({ type: "declarePresence", actor: "player" });
        if (it.id.startsWith("display:")) return act({ type: "displayPresence", actor: "player", target: it.id.slice(8) });
        if (it.id === "takeKnee") return act({ type: "takeKneePresence", actor: "player" });
        if (it.id.startsWith("borrow:")) return act({ type: "borrowDebt", actor: "player", lender: it.id.slice(7) });
        if (it.id === "repayDebt") return act({ type: "repayDebt", actor: "player" });
        if (it.id === "settleVisit") return act({ type: "settleDebtVisit", actor: "player" });
        if (it.id === "declareBankruptcy") return act({ type: "declareBankruptcy", actor: "player" });
        if (it.id === "ritual") return act({ type: "ritual", actor: "player", at: it.at });
        if (it.id === "astralReturn") return act({ type: "astralReturn", actor: "player" });
        if (it.id === "astralProject") return act({ type: "astralProject", actor: "player" });
        if (it.id === "palingenesis" || it.id === "palingenesisBurn") {
          const burn = it.id === "palingenesisBurn", R = s.rules.palingenesis, legal = [];
          for (const o of s.arena.objects || []) {
            if (E.geometry.dist(s, p.x, p.y, o.x, o.y) > R.range) continue;
            if (burn ? !(o.kind === "plant" && o.hp > 0) : !(o.kind === "ashes" && o.residue)) continue;
            legal.push({ at: [o.x, o.y], tiles: [[o.x, o.y]] });
          }
          if (burn) for (const m of s.wild || []) if (m.kind === "creeper" && m.tiles) for (const k of Object.keys(m.tiles)) {   // creeper burns too (no ashes)
            const [x, y] = k.split(",").map(Number);
            if (E.geometry.dist(s, p.x, p.y, x, y) <= R.range && !legal.some((q) => q.at[0] === x && q.at[1] === y)) legal.push({ at: [x, y], tiles: [[x, y]] });
          }
          if (!legal.length) return flashTip(burn ? "No living plant or creeper in reach." : "No ashes in reach.");
          U.menu = "root"; U.mode = "target"; U.sel = { palingenesis: true, burn, tg: { range: legal.map((q) => q.at), legal } }; U.cursor = legal[0].at; return render();
        }
        if (it.id === "commune") return showCommuneQuestion(it.object);   // commune rows ride the Rituals tab now
        if (it.id === "communeStructure") return showAwakenQuestion(it.object);
        if (it.id === "bead") { const BSr = root.ConceptCombatBeadSwallow, hand = U.s.actors.player?.beads || []; if (BSr?.isStaked?.(hand, it.index, U.stakeHeld)) return flashTip(`${hand[it.index].name} is staked on this fight: it is on the table, not in your hand.`); return act({ type: "bead", actor: "player", at: it.at, index: it.index }); }   // a staked bead cannot be released (audit 1.3.449: release + win duplicated it)
        if (it.id === "riteWords") return act({ type: "riteStep", actor: "player", section: "words" });
        if (it.id === "riteSigils") return act({ type: "riteStep", actor: "player", section: "sigils" });
        if (it.id === "riteBlood") return act({ type: "riteStep", actor: "player", section: "blood" });
        if (it.id === "riteDeep") return act({ type: "riteStep", actor: "player", section: "deep" });
        if (it.id === "riteBurial") return act({ type: "riteStep", actor: "player", section: "burial" });
        if (it.id === "riteComplete") return act({ type: "riteComplete", actor: "player" });
        if (it.id === "riteAbandon") return act({ type: "riteAbandon", actor: "player" });
        if (it.id.startsWith("riteTog:")) return act({ type: "riteToggle", actor: "player", ability: it.id.slice(8) });
        if (it.id === "placeTrap") return act({ type: "placeTrap", actor: "player" });
        if (it.id === "takeFromCart") return act({ type: "takeFromCart", actor: "player", from: it.from, item: it.item });
        if (it.id === "tameBeast" || it.id === "markVessel") return act({ type: it.id, actor: "player", target: it.target });
        if (it.id.startsWith("declareWard:")) return act({ type: "declareWard", actor: "player", target: it.id.slice(12) });
        if (it.id === "callPack") return act({ type: "callPack", actor: "player" });
        if (it.id === "buyHouse" || it.id === "investHouse") return act({ type: it.id, actor: "player", ...(it.amount ? { amount: it.amount } : {}) });
        if (it.id === "sueForRestitution") return act({ type: it.id, actor: "player", claim: it.claim });
        if (it.id === "disarm") return act({ type: "disarm", actor: "player", at: it.at });
        if (it.id.startsWith("openGate:")) return act({ type: "openGate", actor: "player", gate: it.id.slice(9) });
      }
      if (U.menu === "strike" && it.throwPick) { U.menu = "root"; U.mode = "target"; U.sel = { strike: true, throwPick: true, tg: throwPickTargeting() }; U.cursor = [p.x, p.y]; return render(); }
      if (U.menu === "strike" && it.submitOn) { const t = U.s.actors[it.submitOn]; U.menu = "root"; return act({ type: "pressSubmission", actor: "player", target: [t.x, t.y], pay: it.pay === "inspiration" ? "inspiration" : null, commit: !!it.finish }); }
      if (U.menu === "strike" && it.grapple) { U.menu = "root"; U.mode = "target"; U.sel = { strike: true, grapple: true, tg: strikeTargeting(U.s.rules.grapple.range) }; U.cursor = [p.x, p.y]; return render(); }
      if (U.menu === "strike" && (it.aim || it.aimClear)) { U.strikeAim = it.aim || null; return render(); }
      if (U.menu === "strike") { U.strikeEffort = it.effort; U.overclock = 0; U.menu = "root"; U.mode = "target"; U.sel = { strike: true, effort: it.effort, tg: strikeTargeting() }; U.cursor = [p.x, p.y]; return render(); }
      if (U.menu === "items") {
        if (Loot.data.consumables[it.item]?.effect?.observe) {
          if (!act({ type: "useItem", actor: "player", item: it.item, target: [p.x, p.y] })) return;
          U.menuFrom = "items"; U.menu = "observe"; U.menuIndex = 0; render(); return;
        }
        if (selfItem(it.item)) { const ok = act({ type: "useItem", actor: "player", item: it.item, target: [p.x, p.y] }); if (ok) U.menu = "root"; return; }   // food and drink: no tile to pick
        const effect = Loot.data.consumables[it.item]?.effect || {}, range = effect.placeBarrier || effect.blockSightTiles || effect.observe ? 4 : (W?.data.items[it.item]?.range || 0), legal = [];
        for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) if (E.geometry.dist(s, p.x, p.y, x, y) <= range) legal.push({ at: [x, y] });
        U.mode = "target"; U.menu = "root"; U.sel = { item: it.item, tg: { range: legal.map(l => l.at), legal } }; U.cursor = [p.x, p.y]; return render();
      }
      if (U.menu === "drop") return act({ type: "dropItem", actor: "player", item: it.drop });
      if (U.menu === "cook") { const ok = act({ type: "cook", actor: "player", recipe: it.recipe }); if (ok) U.menu = "root"; return; }
      if (U.menu === "summons" && it.beastKey) return act({ type: "callBeast", actor: "player", key: it.beastKey, at: it.at });   // a learned beast: no summon question
      if (U.menu === "summons" && it.pactLine) return act({ type: "callPact", actor: "player", line: it.pactLine, at: it.at });   // a pacted line: no question either (the engine reads the sign + standing off its battle-start book, not the act)
      if (U.menu === "summons" && it.id === "dismissPact") return act({ type: "dismissPact", actor: "player" });
      if (U.menu === "summons") return showSummonQuestion(it.summon);
      if (U.menu === "investigate") { U.insightTarget = it.id; const ok = act({ type: "investigate", actor: "player", target: it.id, focus: U.investigateFocus || undefined }); if (ok) { U.menu = "root"; render(); } return; }
      if (U.menu === "observe") {
        if (it.id === "report") { act({ type: "insight", actor: "player", action: "report" }); return; }
        if (it.id === "place") { act({ type: "observePlace", actor: "player", invest: U.observeInvest }); return; }
        if (it.id === "observePlant") { act({ type: "observePlant", actor: "player", object: it.object, invest: it.invest }); return; }
        if (it.id === "observeStructure") { act({ type: "observeStructure", actor: "player", object: it.object, invest: it.invest }); return; }
        if (it.id === "commune") return showCommuneQuestion(it.object);
        if (it.id === "communeStructure") return showAwakenQuestion(it.object);
        U.insightTarget = it.id; const ok = act({ type: "observe", actor: "player", target: it.id, invest: U.observeInvest }); if (ok) { U.menu = "insight"; render(); } return;
      }
      if (U.menu === "insight" && it.id === "imitate") { const ok = act({ type: "imitate", actor: "player", target: U.insightTarget, trait: it.trait }); if (ok) U.menu = "root"; return; }
      if (U.menu === "insight") { const ok = act({ type: "insight", actor: "player", target: U.insightTarget, action: it.action }); if (ok) U.menu = "root"; return; }
      if (U.menu === "lens") { const [concept, profile] = it.id.split(":"); return act({ type: "lens", actor: "player", concept, profile }); }
      if (U.menu === "swap") return act({ type: "swap", actor: "player", concept: it.id });
      if (U.menu === "tech") {
        if(it.contractAction)return act({type:it.contractAction,actor:"player",ability:it.ability,words:it.words});
        if (it.id === "vow") return showVowCard("technique");   // technique stances
        if (it.id.startsWith("deathVision:")) { const ok = act({ type: "deathVision", actor: "player", target: it.id.slice(12) }); if (ok) U.menu = "root"; return; }
        if (it.id.startsWith("mend:")) { const [, target, zone] = it.id.split(":"); const ok = act({ type: "mendVerb", actor: "player", target, zone: zone || null }); if (ok) U.menu = "root"; return; }
        if (it.id.startsWith("tend:")) { const ok = act({ type: "tendVerb", actor: "player", target: it.id.slice(5) }); if (ok) U.menu = "root"; return; }
        if (it.id.startsWith("salv:")) { const ok = act({ type: "salvageVerb", actor: "player", target: it.id.slice(5) }); if (ok) U.menu = "root"; return; }
        if (it.id.startsWith("seal:")) { const ok = act({ type: "sealBeast", actor: "player", target: it.id.slice(5) }); if (ok) U.menu = "root"; return; }
        if (it.id.startsWith("reaper:")) { const ok = act({ type: "reaperSeal", actor: "player", target: it.id.slice(7) }); if (ok) U.menu = "root"; return; }
        if (it.id.startsWith("grant:")) { const [, ally, ability] = it.id.split(":"); const ok = act({ type: "grantTechnique", actor: "player", target: ally, ability }); if (ok) U.menu = "root"; return; }
        if (it.id === "lens") { U.menu = "lens"; U.menuFrom = "tech"; U.menuIndex = 0; return render(); }   // Lens rides under Techniques; ◂ returns here
        if (it.id === "audition" && !U.audRole && root.ConceptCombatVows) return showVowCard("role");   // role vows ride the audition
        if (it.id === "audition" && !U.audRole) return showAuditionCard(null);
        U.prototypeSource = ""; U.recombineParts = ["", "", ""]; U.whatIfAs = "";
        const opts = { sectionAxis:U.sectionAxis, projectionProperty:U.projectionProperty, projectionAxis:U.projectionAxis, fragment:U.fragmentKind, fragmentId:U.fragmentId, montageParts:U.montageParts.filter(Boolean), prototypeSource:U.prototypeSource, recombineParts:U.recombineParts.filter(Boolean), whatIfAs:U.whatIfAs };
        const tg = E.targeting(s, controlledId(s), it.id, opts);
        U.mode = "target"; U.sel = { ability: it.id, m: tg.m, tg, self: !!tg.selfCast }; U.cursor = [p.x, p.y];
        // Announce defaults on for an ultimate, but a choice the player made for this technique sticks this battle: picking
        // it again, or looking at another technique and coming back, used to re-check the box (Muse, Mala hit it, 2026-10-15).
        const choice = U.announceChoice?.[U.s.seed]?.[it.id];
        U.announce = choice ?? tg.m.tier === "ultimate"; U.revelation = 1; U.reveal = false; U.deception = false; U.overclock = 0; U.quickened = ""; U.gearPick = null; U.promiseSurrender = null; U.setDown = false; U.setTrigger = "manual";
        render();
      }
    }
    // Contains Multitudes: pick one class from the victory ledger to embody (engine.js Multitudes).
    function showMultitudesCard() {
      const M = E.multitudes(U.s, controlledId(U.s)), ov = $("ccOverlay"), from = U.afterActMenu || U.menu, fromUp = U.menuFrom;   /* choose() moved the drawer pick to root and kept the drawer in afterActMenu */ ov.hidden = false;
      ov.innerHTML = `<div class="cc-card cc-vow"><h2>Contains Multitudes</h2>
        <p class="cc-muted">Be one class you have beaten as well as the Warden for ${M.turns} of your turns. It costs ${M.cost} Inspiration (you have ${controlledFighter(U.s).inspiration || 0}). You keep your primary concept; your secondary is set aside, and the class comes with the kit it had when you last beat it. One at a time, and no swapping.</p>
        ${M.options.map((o) => `<button type="button" class="cc-item" data-embody="${esc(o.classId)}" ${o.off ? "disabled" : ""} title="${esc(o.off || "")}">${esc(o.name)} · ${esc(C.concepts[o.primary].name)} + ${esc(C.concepts[o.secondary].name)}${o.off ? ` · ${esc(o.off)}` : ""}</button>`).join("") || `<p>No class beaten yet.</p>`}
        <button type="button" id="ccMultCancel">Cancel</button></div>`;
      ov.querySelectorAll("[data-embody]").forEach((b) => b.onclick = () => { ov.hidden = true; act({ type: "embody", actor: "player", classId: b.dataset.embody }); });
      ov.querySelector("#ccMultCancel").onclick = () => { ov.hidden = true; U.mode = "menu"; U.menu = from || "root"; U.menuFrom = fromUp; U.afterActMenu = null; render(); };   // back to the Rituals drawer it opened from
    }
    // Vows (vows/vows.js): a boon bought with up to two restrictions, picked from dropdowns before Extend Aura,
    // Imbue the Dream, or Open Dream Space. "Without a vow" keeps the plain AP/ULT version.
    function showAuditionCard(vow) {
      const opts = E.auditionOptions(U.s, "player"), ov = $("ccOverlay"); ov.hidden = false;
      ov.innerHTML = `<div class="cc-card cc-vow"><h2>Audition</h2>
        <p class="cc-muted">Three villains answer. Play one: its pair techniques and mandatory class traits are yours over your own, for as many turns as its consecutive plays (cap 3). Repeats build Typecast (+15% a stack).</p>
        ${opts.map((c) => `<button type="button" class="cc-item" data-role="${esc(c)}">${esc(E.auditionLabel(c))}</button>`).join("") || `<p>No villain answers the call.</p>`}
        <button type="button" id="ccAudCancel">Cancel</button></div>`;
      ov.querySelectorAll("[data-role]").forEach((b) => b.onclick = () => { ov.hidden = true; U.audRole = b.dataset.role; U.menu = "tech"; choose({ id: "audition", x: null, label: "Audition", off: false }); });
      ov.querySelector("#ccAudCancel").onclick = () => { ov.hidden = true; U.audRole = null; U.mode = "menu"; U.menu = "root"; render(); };
      if (vow) U.audVow = vow;
    }
    function oathRow(s, p) {   // technique stances: the oath row at the foot of Techniques shows what binds you
      const V = root.ConceptCombatVows, live = V.live(s, p).filter((v) => v.on === "technique");
      const names = live.map((v) => V.BOONS[v.boon]?.name || v.boon).join(" + "), short = live.length > 2 ? `${live.length} live` : names;
      return { id: "vow", label: live.length ? `Oath: ${short} · another ▸` : "Swear an oath ▸ (free)", off: false,
        why: live.length ? "Bound until the end of your next turn. One soul, one promise: no new oath until this one ends." : "Swear a restriction and your techniques carry the boon until the end of your next turn. Free to swear; the restrictions are the price." };
    }
    function drainStakes() {   // W5.3: staking settles mid-battle in the engine; the purse updates here
      const evs = U.s.stakeEvents || [], seen = U.stakeSeen || 0;
      if (evs.length <= seen) return;
      U.stakeSeen = evs.length;
      let back = 0;
      for (const e of evs.slice(seen)) back += e.back || 0;
      if (back > 0) flashTip(`Stakes settle: +${back} Seeds.`);   // paid into U.s.seeds by the engine; act() copies it to the account
      else flashTip(`The stake burns.`);
    }
    function drainPacts() {   // summon pacts settle mid-battle in the engine; the relationship ledger updates here
      const evs = U.s.pactCodes || [], seen = U.pactSeen || 0;
      if (!PC) return;
      let changed = false;
      if (evs.length > seen) {
        U.pactSeen = evs.length; changed = true;
        const store = U.account.contracts || (U.account.contracts = PC.createStore());
        for (const e of evs.slice(seen)) {
          if (e.type === "pactCalled") { const r = PC.call(store, { line: e.line }); if (!r.ok) flashTip(r.error); }
          else if (e.type === "pactEnded") PC.endCall(store, { how: e.how });
          else if (e.type === "pactBreach") { const r = PC.breach(store, { line: e.line, kind: e.kind, battle: U.account.battles || 0 }); if (r.ok && r.mark) U.account.marks.push(r.mark); flashTip(`The ${SM?.data?.summons[e.line]?.name || e.line} pact is BROKEN (${e.kind}). Blacklisted, marked.`); }
        }
      }
      const live = U.account.contracts;
      if (U.s.outcome && live?.active) { PC.endCall(live, { how: PC.battleCloseHow(U.s) }); changed = true; }   // a battle that ends with a live call closes it here: a win with the summon still standing is clean (builds standing), a loss or a downed summon builds none (battleCloseHow, Mala 2026-10-31); the book must not carry it into the next battle
      if (changed) saveAccount();
    }
    function hyperMenu() {   // W5.3: MYOL / stake / double-down rows for the controlled fighter
      const s = U.s, pid = controlledId(s), p = s.actors[pid];
      if (!p || p.defeated) return [];
      const out = [], HR = E.hyperRules?.();
      const gambler = (p.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === "gambler") || (s.themedBattle === "jackpot" && p.side === "player");
      const offer = E.myolOffer?.(s);
      if (offer && offer.actor === pid && offer.round === s.round && HR) {
        const uses = s.myolUses?.[pid] || 0, cost = HR.myol.costs[Math.min(uses, HR.myol.costs.length - 1)];
        const over = uses >= HR.myol.uses, broke = (U.account.seeds || 0) < cost;
        const exhausted = (p.status?.exhausted?.until || 0) > s.round;
        out.push({ id: "myol", label: `Make your own luck · ${cost} Seeds`, off: broke || exhausted,
          why: exhausted ? "Exhausted." : broke ? `Needs ${cost} Seeds.` : "",
          help: `Replay the failed ${offer.kind} at +25 after seeing the roll.${over ? " Past the limit: this exhausts you (-25 AP, 3 rounds)." : ` ${HR.myol.uses - uses} bought lucks left before exhaustion.`}` });
      }
      if (!s.staked && (U.account.seeds || 0) >= 5 && HR && !(U.practiceBattle || s.focusedDreamTest || s.devPlayground || testBattle())) out.push({ id: "stakeSeeds", label: `Sweat it · stake Seeds`, off: false, why: "", help: `Post Seeds on your next imitate or tame: +1% each to +25%. Win: stake back plus half again (55 mint cap a battle). Lose: it burns.` });
      if (gambler && !s.doubledDown && HR) {
        const heat = E.gamblerHeat?.(s, pid) || 0;
        out.push({ id: "doubleDown", label: `DOUBLE DOWN · heat ${heat}`, off: heat < 2, why: heat < 2 ? "Build heat: end turns holding 40+ AP." : "", help: `Cash heat for +${HR.heat.doubleChargePer} charge a stack, once a battle. The heat spends.` });
      }
      return out;
    }
    function stakesMenu() {   // W1.5: one Talk row, round 1, pre-blood, once a battle
      if (!AN || !E.antePreBlood?.(U.s) || U.s.stakes) return [];
      if (U.practiceBattle || U.s.focusedDreamTest || U.s.devPlayground || U.setupOpts?.devPlayground || testBattle()) return [];   // test battles never settle a stake (audit 1.3.449: a lost stake came back free; the playground bag farmed beads)
      const leader = E.anteLeader?.(U.s);
      if (!leader) return [];
      const tender = (U.account.orbs?.length || 0) + (U.account.beads?.length || 0) + Math.max(0, (U.account.level || 1) - 1);
      if (!tender) return [];
      const cd = U.account.stakeCooldowns?.[leader.character || leader.id] || 0;
      if (cd > 0) return [{ id: "stakes", label: `Propose stakes`, off: true, why: `Rematch cooldown: ${cd} battles left vs ${leader.name}.` }];
      return [{ id: "stakes", label: `Propose stakes ▸ ${leader.name}`, off: false, why: "", help: `Stake vessels or levels against ${leader.name}'s bead. Winner takes both lots; refusal is free.` }];
    }
    function showStakesCard() {
      const ov = $("ccOverlay"); ov.hidden = false;
      const leader = E.anteLeader(U.s), carry = E.anteCarry(U.s);
      const orbs = U.account.orbs || [], beads = U.account.beads || [], maxLv = Math.max(0, (U.account.level || 1) - 1);
      const row = (kind, key, label, sub) => `<label><input type="checkbox" data-lot-kind="${kind}" data-lot-key="${key}"> ${esc(label)} <small>${esc(sub)}</small></label>`;
      ov.innerHTML = `<div class="cc-card cc-vow"><h2>Propose stakes ▸ ${esc(leader.name)}</h2>
        <p class="cc-muted">${esc(leader.name)} posts a bead (worth ${AN.lotValue(carry)}). Your lot, winner takes both; refusal is free and costs nothing. Round 1 only, before first blood. Leaving the fight before it ends forfeits your lot.</p>
        ${orbs.map((id, i) => row("orb", `${id}:${i}`, `Orb: ${id}`, `worth ${AN.RULES.values.orb}`)).join("")}
        ${beads.map((b, i) => row("bead", `${i}`, `Bead: ${b.name || b.kind || "bead"}`, `worth ${AN.RULES.values.bead}`)).join("")}
        ${maxLv ? `<label>Levels <select id="ccStakesLv">${Array.from({ length: maxLv + 1 }, (_, n) => `<option value="${n}">${n ? `${n} (worth ${n * AN.RULES.values.level})` : "None"}</option>`).join("")}</select></label>` : ""}
        <p id="ccStakesTotal" class="cc-muted"></p>
        <label><input type="checkbox" id="ccStakesConceal"> Conceal the lots (face-down till the duel ends)</label>
        <button type="button" class="cc-item" id="ccStakesGo">Propose the lot</button>
        <button type="button" id="ccStakesCancel">Cancel</button></div>`;
      const read = () => {
        const lot = [];
        ov.querySelectorAll("[data-lot-kind]").forEach((el) => {
          if (!el.checked) return;
          if (el.dataset.lotKind === "orb") { const [id] = el.dataset.lotKey.split(":"); const nth = lot.filter((x) => x.kind === "orb" && x.id === id).length; lot.push({ kind: "orb", id, nth }); }
          else lot.push({ kind: "bead", idx: +el.dataset.lotKey });
        });
        const n = +ov.querySelector("#ccStakesLv")?.value || 0;
        if (n > 0) lot.push({ kind: "levels", n });
        return lot;
      };
      const update = () => { const lot = read(); ov.querySelector("#ccStakesTotal").textContent = `Your lot: worth ${AN.lotValue(lot)} against their ${AN.lotValue(carry)}. ${AN.validateStake(U.account, lot, leader.character || leader.id) || "They answer when you propose."}`; };
      ov.querySelectorAll("input,select").forEach((el) => el.onchange = update); update();
      const close = () => { ov.hidden = true; U.mode = "menu"; U.menu = "root"; render(); };
      ov.querySelector("#ccStakesGo").onclick = () => {
        const lot = read(), no = AN.validateStake(U.account, lot, leader.character || leader.id);
        if (no) { flashTip(no); return; }
        ov.hidden = true;
        const e = AN.escrowOut(U.account, lot);   // escrow first: lot indices are positions in the account as the card read it
        U.account = { ...e.account, stakeEscrow: e.held }; U.stakeHeld = e.held;
        act({ type: "stakes", actor: "player", lot, conceal: !!ov.querySelector("#ccStakesConceal")?.checked });
        if (U.s.stakes?.state !== "agreed") { U.account = { ...AN.refund(U.account, U.stakeHeld), stakeEscrow: null }; U.stakeHeld = null; flashTip(`${leader.name} refused: unstaked.`); }
        else U.account = { ...U.account, stakeEscrow: { ...e.held, stakes: JSON.parse(JSON.stringify(U.s.stakes)) } };   // the table's record rides with the escrow
        saveAccount();
      };
      ov.querySelector("#ccStakesCancel").onclick = close;
    }
    function showStakeCard() {
      const ov = $("ccOverlay"); ov.hidden = false;
      const HR = E.hyperRules(), max = Math.min(U.account.seeds || 0, 50);
      const opts = [];
      for (let n = 5; n <= max; n += 5) opts.push(`<option value="${n}"${n === 25 && max >= 25 ? " selected" : ""}>${n} Seeds (+${Math.min(25, n)}%)</option>`);
      ov.innerHTML = `<div class="cc-card cc-vow"><h2>Sweat it</h2>
        <p class="cc-muted">Post Seeds on your next imitate or tame. Win: stake back plus half again (${HR.stake.mintCap} mint cap a battle). Lose: it burns. Leaving the fight before it ends burns it too.</p>
        <label>Stake <select id="ccStakeN">${opts.join("")}</select></label>
        <button type="button" class="cc-item" id="ccStakeGo">Post the stake</button>
        <button type="button" id="ccStakeCancel">Cancel</button></div>`;
      const close = () => { ov.hidden = true; U.mode = "menu"; U.menu = "root"; render(); };
      ov.querySelector("#ccStakeGo").onclick = () => {
        const seeds = +ov.querySelector("#ccStakeN").value || 0;
        if (!(seeds >= 5) || seeds > (U.account.seeds || 0)) { flashTip("Stake 5+ Seeds you hold."); return; }
        ov.hidden = true;
        act({ type: "stakeSeeds", actor: "player", seeds });   // the engine escrows from U.s.seeds
      };
      ov.querySelector("#ccStakeCancel").onclick = close;
    }
    function showVowCard(kind) {
      if (kind === "imbue") return act({type:"aura",actor:"player"});
      const V = root.ConceptCombatVows, o = V.options(kind), ov = $("ccOverlay"); ov.hidden = false;
      const type = kind === "dream" ? "dreamSpace" : kind === "technique" ? "vow" : "aura";
      const title = { aura: "Extend Aura", imbue: "Imbue the Dream", dream: "Open Dream Space", role: "Audition", technique: "Swear an Oath" }[kind];
      const me = controlledFighter(U.s), IR = U.s.rules.inspiration || null, have = me?.inspiration || 0;   // Inspiration can pay a vow's price
      const canWord = kind === "technique" && C.characters[me?.character]?.swearsWord && !me.wordGiven;   // Rama's word: once a battle
      const opt = (list, cost) => `<option value="">None</option>` + list.map((x) => `<option value="${x.id}">${esc(x.name)} · ${cost(x)}</option>`).join("");
      ov.innerHTML = `<div class="cc-card cc-vow"><h2>${title}: swear a vow?</h2>
        <p class="cc-muted">A vow buys one boon with up to two restrictions. The restrictions must be worth at least the boon's price. Restrictions hold while it lasts, and being forced to break one breaks the vow (the boon ends, −${V.BREACH_AP} AP).${IR ? ` Inspiration can pay instead: each point covers ${IR.vowPoint} of the price. You have ${have}.` : ""}${U.s.dreamSpace ? " Dreams ease oaths: every price drops 1, never below 1." : ""}</p>
        ${canWord ? `<label>Swear on <select id="ccVowOn"><option value="technique">A technique</option><option value="word">Rama's word (once a battle)</option></select></label>` : ""}
        <label>Boon <select id="ccVowBoon">${opt(o.boons, (b) => `price ${b.price}`)}</select></label>
        <label>Restriction <select id="ccVowR1">${opt(o.restrictions, (r) => `worth ${r.worth}`)}</select></label>
        <label>Restriction <select id="ccVowR2">${opt(o.restrictions, (r) => `worth ${r.worth}`)}</select></label>
        ${IR && have ? `<label>Inspiration <select id="ccVowInsp">${Array.from({ length: have + 1 }, (_, n) => `<option value="${n}">${n ? `Spend ${n} · pays ${n * IR.vowPoint}` : "None"}</option>`).join("")}</select></label>` : ""}
        <p id="ccVowText" class="cc-muted"></p><p id="ccVowBalance"></p>
        <button type="button" class="cc-item" id="ccVowSwear">${kind === "technique" ? "Swear the oath" : `Swear and ${title.toLowerCase()}`}</button>
        ${kind === "technique" ? "" : `<button type="button" class="cc-item" id="ccVowPlain">${title} without a vow</button>`}
        <button type="button" id="ccVowCancel">Cancel</button></div>`;
      const vowOn = () => ov.querySelector("#ccVowOn")?.value || kind;
      const read = () => ({ boon: ov.querySelector("#ccVowBoon").value || null, restrictions: [ov.querySelector("#ccVowR1").value, ov.querySelector("#ccVowR2").value].filter(Boolean), inspiration: Number(ov.querySelector("#ccVowInsp")?.value || 0) });
      const update = () => {
        const v = read(), b = v.boon && V.BOONS[v.boon], no = v.boon ? (vowOn() === "word" ? V.validate("word", v, me, IR, U.s) : V.validate(kind, v, me, IR, U.s)) : "Pick a boon to swear a vow.";
        ov.querySelector("#ccVowText").innerHTML = [b ? `<b>${esc(b.name)}</b>: ${esc(b.text)}` : "", ...v.restrictions.map((id) => `<b>${esc(V.RESTRICTIONS[id].name)}</b>: ${esc(V.RESTRICTIONS[id].text)}`)].filter(Boolean).join("<br>");
        ov.querySelector("#ccVowBalance").textContent = b ? `Price ${U.s.dreamSpace ? Math.max(1, b.price - 1) : b.price} · restrictions worth ${V.worth(v.restrictions)}${v.inspiration ? ` · Inspiration pays ${v.inspiration * IR.vowPoint}` : ""}${no ? ` · ${no}` : " · balanced"}` : "";
        ov.querySelector("#ccVowSwear").disabled = !!no;
      };
      ov.querySelectorAll("select").forEach((el) => el.onchange = update);
      ov.querySelector("#ccVowOn") && (ov.querySelector("#ccVowOn").onchange = () => {   // word boons differ: rebuild the list
        ov.querySelector("#ccVowBoon").innerHTML = opt(V.options(vowOn()).boons, (b) => `price ${b.price}`); update();
      });
      update();
      const close = () => { ov.hidden = true; U.mode = "menu"; U.menu = "root"; render(); };
      ov.querySelector("#ccVowSwear").onclick = () => { const v = read(); ov.hidden = true; if (kind === "role") return showAuditionCard(v);
        if (kind === "technique") {
          if (vowOn() === "word") return act({ type: "vow", target: "word", actor: "player", vow: v });
          return act({ type: "vow", target: "technique", actor: "player", vow: v });
        } act({ type, actor: "player", vow: v }); };
      ov.querySelector("#ccVowPlain") && (ov.querySelector("#ccVowPlain").onclick = () => { ov.hidden = true; if (kind === "role") return showAuditionCard(null); act({ type, actor: "player" }); });
      ov.querySelector("#ccVowCancel").onclick = close;
    }
    // Plant communion: the nearest plant still worth studying, and any adjacent plant ready to answer.
    // Plants under Observe (Mala, 2026-10-10: "observe → plants is the mechanism for communing"). Observing a plant
    // builds familiarity with the same action-point dial as observing a person; once a plant is known well enough
    // and you stand beside it, its entry becomes Commune. Hidden until communion is released (or ccCommune = "1").
    function nearbyPlants() {   // shared list for the Observe tab (study) and the Rituals tab (commune selection)
      const s = U.s, p = controlledFighter(s); if (!CM || !p || !s.communion) return null;
      let preview = false; try { preview = localStorage.getItem("ccCommune") === "1"; } catch {}
      if (!CM.rules.released && !preview) return null;
      const d = (o) => E.geometry.dist(s, p.x, p.y, o.x, o.y), fam = (o) => s.communion.familiarity[o.id] || 0;
      const spend = Math.max(CM.rules.observeStep, Math.min(CM.rules.observeMax, Math.floor((U.observeInvest || 0) / CM.rules.observeStep) * CM.rules.observeStep));
      const active = Object.values(s.actors).filter((x) => x.communed && x.communed.owner === "player" && !x.defeated).length;
      const list = (s.arena.objects || []).filter((o) => o.kind === "plant" && o.hp > 0 && !o.dead && !s.communion.closed[o.id] && CM.profile(o.type) && d(o) <= CM.rules.observeRange)
        .sort((a, b) => d(a) - d(b)).slice(0, 6);
      return { s, p, d, fam, spend, active, list };
    }
    function plantMenu() {
      const ctx = nearbyPlants(); if (!ctx) return [];
      const { s, p, d, fam, spend, list } = ctx;
      return list.filter((o) => fam(o) < CM.profile(o.type).need).map((o) => {
        const pr = CM.profile(o.type);
        const sees = d(o) <= 1 || E.geometry.hasSight(s, p.x, p.y, o.x, o.y);
        return { id: "observePlant", object: o.id, invest: spend, label: `${pr.common} · plant · ${fam(o)}/${pr.need} known · ${spend} AP${sees ? "" : " · unseen"}`, off: !sees || p.tempo < spend,
          why: `Know a plant well enough and it will answer you. As an ally: ${pr.name}, ${pr.hp} LF. If it dies fighting for you, Gaia will hold it against you.` };
      });
    }
    function communeMenu() {   // known plants, answered from the Rituals tab (Mala, 2026-10-20)
      const ctx = nearbyPlants(); if (!ctx) return [];
      const { p, d, fam, active, list } = ctx;
      return list.filter((o) => fam(o) >= CM.profile(o.type).need).map((o) => {
        const pr = CM.profile(o.type);
        const can = CM.canCommune({ obj: o, familiarity: fam(o), active, ap: p.tempo, pf: p.pf, dist: d(o) });
        return { id: "commune", object: o.id, label: `Commune with ${pr.common} ▸ ${CM.rules.communeAp} AP + ${Math.max(0, pr.phi - E.communeDiscount(U.s, p.id))} ΦF`, off: !can.ok,
          why: can.reason || `Answer its question and it fights beside you as ${pr.name} (${pr.hp} LF). It is not fodder: if it dies, its body stays and Gaia thinks less of you.` };
      });
    }
    function showCommuneQuestion(objectId) {
      const s = U.s, obj = s.arena.objects.find((o) => o.id === objectId), pr = obj && CM.profile(obj.type); if (!pr) return;
      const q = CM.questionFor(obj, s.seed); if (!q) return flashTip("That plant has nothing to ask.");   // Observe teaches: the pinned question
      const studied = !!(q.clue && s.communion?.clues?.[obj.id]);
      const ov = $("ccOverlay"); ov.hidden = false;
      ov.innerHTML = `<div class="cc-card"><h2>Commune with the ${esc(pr.common)}</h2>${studied ? `<p class="cc-study-note"><b>Your study note:</b> ${esc(q.clue)}</p>` : ""}<p>${esc(q.prompt)}</p>${q.choices.map((c, i) => `<button type="button" class="cc-item" data-answer="${i}">${esc(c)}</button>`).join("")}<p class="cc-muted">Right: it tells you something true about itself, then steps out as ${esc(pr.name)} (${pr.hp} LF) and fights until its life runs out. Wrong: the cost is spent and it closes to you for this battle.</p><button type="button" class="cc-item" id="ccCommuneCancel">Cancel</button></div>`;
      const close = () => { ov.hidden = true; U.mode = "menu"; U.menu = "root"; render(); };
      ov.querySelectorAll("[data-answer]").forEach((b) => b.onclick = () => { ov.hidden = true; if (act({ type: "commune", actor: "player", object: objectId, questionId: q.id, answer: +b.dataset.answer })) { U.mode = "menu"; U.menu = "root"; render(); pump(); } });
      ov.querySelector("#ccCommuneCancel").onclick = close;
    }
    // Tsukumogami: structures under Observe (study) and the Rituals tab (wake). The entries appear only
    // for an Animist; anyone else is told "not you" by the engine if they reach the action another way.
    function nearbyStructures() {
      const s = U.s, p = controlledFighter(s); if (!TK || !p || !s.tsukumogami) return null;
      if (!(p.traits || []).some((t) => (t.id || t) === "animist")) return null;
      let preview = false; try { preview = localStorage.getItem("ccTsukumogami") === "1"; } catch {}
      if (!TK.rules.released && !preview) return null;
      const d = (o) => E.geometry.dist(s, p.x, p.y, o.x, o.y), fam = (o) => s.tsukumogami.familiarity[o.id] || 0;
      const spend = Math.max(TK.rules.observeStep, Math.min(TK.rules.observeMax, Math.floor((U.observeInvest || 0) / TK.rules.observeStep) * TK.rules.observeStep));
      const active = Object.values(s.actors).filter((x) => x.awakened && x.awakened.owner === "player" && !x.defeated).length;
      const list = (s.arena.objects || []).filter((o) => o.kind === "object" && o.hp > 0 && TK.profile(o.type) && d(o) <= TK.rules.observeRange)
        .sort((a, b) => d(a) - d(b)).slice(0, 6);
      return { s, p, d, fam, spend, active, list };
    }
    function structureMenu() {
      const ctx = nearbyStructures(); if (!ctx) return [];
      const { s, p, d, fam, spend, list } = ctx;
      return list.filter((o) => fam(o) < TK.profile(o.type).need).map((o) => {
        const pr = TK.profile(o.type);
        const sees = d(o) <= 1 || E.geometry.hasSight(s, p.x, p.y, o.x, o.y);
        const matDef = INS?.data?.traits?.[TK.materialTrait(pr.material)] || null;
        return { id: "observeStructure", object: o.id, invest: spend, label: `${pr.common} · structure · ${fam(o)}/${pr.need} known · ${spend} AP${sees ? "" : " · unseen"}`, off: !sees || p.tempo < spend,
          why: `Know a structure well enough and it will answer you. As an ally: ${pr.name}, ${Math.max(1, o.hp * 2)} LF. It stands for 4 rounds, then settles back.${matDef ? ` Material: ${matDef.text}` : ""}` };
      });
    }
    function awakenMenu() {   // known structures, woken from the Rituals tab
      const ctx = nearbyStructures(); if (!ctx) return [];
      const { p, d, fam, active, list } = ctx;
      return list.filter((o) => fam(o) >= TK.profile(o.type).need).map((o) => {
        const pr = TK.profile(o.type);
        const can = TK.canCommune({ obj: o, familiarity: fam(o), active, ap: p.tempo, pf: p.pf, dist: d(o), animist: true });
        return { id: "communeStructure", object: o.id, label: `Wake the ${pr.common} ▸ ${TK.rules.communeAp} AP + ${pr.phi} ΦF`, off: !can.ok,
          why: can.reason || `Answer its question and it stands beside you as ${pr.name} (${Math.max(1, o.hp * 2)} LF) for 4 rounds.` };
      });
    }
    function showAwakenQuestion(objectId) {
      const s = U.s, obj = s.arena.objects.find((o) => o.id === objectId), pr = obj && TK.profile(obj.type); if (!pr) return;
      const q = TK.pickQuestion(obj.type, `${s.seed}:${s.round}:${obj.id}`); if (!q) return flashTip("That structure has nothing to ask.");
      const ov = $("ccOverlay"); ov.hidden = false;
      ov.innerHTML = `<div class="cc-card"><h2>Wake the ${esc(pr.common)}</h2><p>${esc(q.prompt)}</p>${q.choices.map((c, i) => `<button type="button" class="cc-item" data-answer="${i}">${esc(c)}</button>`).join("")}<p class="cc-muted">Right: it stands as ${esc(pr.name)} (${Math.max(1, obj.hp * 2)} LF) and fights for 4 rounds. Wrong: the cost is spent and it stays asleep.</p><button type="button" class="cc-item" id="ccCommuneCancel">Cancel</button></div>`;
      const close = () => { ov.hidden = true; U.mode = "menu"; U.menu = "root"; render(); };
      ov.querySelectorAll("[data-answer]").forEach((b) => b.onclick = () => { ov.hidden = true; if (act({ type: "communeStructure", actor: "player", object: objectId, questionId: q.id, answer: +b.dataset.answer })) { U.mode = "menu"; U.menu = "root"; render(); pump(); } });
      ov.querySelector("#ccCommuneCancel").onclick = close;
    }
    function showSummonQuestion(id) {
      const p = controlledFighter(U.s), seed = `${U.s.seed}:${U.s.round}:${p.id}:${id}`;
      const q = SQ.pickQuestion(id, seed, { hintCount: E.summonQuestionHints(U.s, p.id) });
      if (!q) return flashTip("No question is available for that summon.");
      U.pendingSummon = { id, q }; const ov = $("ccOverlay"); ov.hidden = false;
      const auto = U.s.summonQuestionBoost > 0;
      ov.innerHTML = `<div class="cc-card"><h2>Call ${esc(SM.data.summons[id].name)}</h2><p>${esc(q.prompt)}</p>${q.choices.map((c, i) => `<button type="button" class="cc-item" data-answer="${i}" ${auto && i !== q.answer ? "disabled" : ""}>${esc(c)}${auto && i === q.answer ? " · Field guide" : ""}</button>`).join("")}<p class="cc-muted">Correct: +1 turn and a stronger ultimate. Wrong or skipped: ally still arrives at base strength. Mnemonic Charm removes a wrong choice; Palace Key adds a turn.</p><button type="button" id="ccSummonSkip">Skip · call at base strength</button><button type="button" id="ccSummonCancel">Cancel</button></div>`;
      ov.querySelectorAll("[data-answer]").forEach(b => b.onclick = () => beginSummonPlacement(id, q, +b.dataset.answer));
      ov.querySelector("#ccSummonSkip").onclick = () => beginSummonPlacement(id, q, null);
      ov.querySelector("#ccSummonCancel").onclick = () => { U.pendingSummon = null; ov.hidden = true; U.mode = "menu"; U.menu = "root"; render(); };
    }
    function beginSummonPlacement(id, q, answer) {
      const p = controlledFighter(U.s), occupied = new Set(Object.values(U.s.actors).filter(a => !a.defeated).map(a => `${a.x},${a.y}`));
      const tiles = SM.placementTiles(U.s.arena, [p.x, p.y], occupied);
      if (!tiles.length) return flashTip("There is no open tile nearby for the summon.");
      U.pendingSummon = { id, q, answer };
      U.sel = { summon: id, tg: { range: tiles, legal: tiles.map(at => ({ at, tiles: [at] })) } };
      U.mode = "target"; U.menu = "root"; U.menuIndex = 0; U.hover = tiles[0]; U.cursor = tiles[0];
      $("ccOverlay").hidden = true; render();
    }
    function commitSummon(at) {
      const pending = U.pendingSummon; if (!pending) return;
      const ok = act({ type: "summon", actor: "player", summon: pending.id, unlocked: summonUnlocks(), questionId: pending.q.id, answer: pending.answer, at });
      if (ok) { U.pendingSummon = null; U.sel = null; U.mode = "menu"; U.menu = "root"; render(); pump(); }
    }
    // reach: how far this action lands. A Strike uses the striker's reach (the Reach trait: 2); a Grapple always needs contact.
    // Fulcrum Throw (emergent-ideas.js): first what to lift (a unit or a loose object beside you), then where it goes.
    function throwPickTargeting() {
      const s = U.s, p = controlledFighter(s), T = s.rules.emergentIdeas.fulcrumThrow;
      const range = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [p.x + dx, p.y + dy]);
      const liftable = ([x, y]) => Object.values(s.actors).some((a) => !a.defeated && a.id !== p.id && a.x === x && a.y === y && !a.massive && !a.boss) || (s.arena.objects || []).some((o) => o.x === x && o.y === y && T.liftable.includes(o.type));
      return { range, legal: range.filter(liftable).map((at) => ({ at, tiles: [at] })) };
    }
    function throwAtTargeting(pick) {
      const s = U.s, p = controlledFighter(s), R = s.rules.emergentIdeas.fulcrumThrow.range, range = [];
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const at = [p.x + dx, p.y + dy]; if ((dx || dy) && E.geometry.dist(s, p.x, p.y, at[0], at[1]) <= R && !(at[0] === pick[0] && at[1] === pick[1]) && at[0] >= 0 && at[1] >= 0 && at[0] < s.arena.w && at[1] < s.arena.h) range.push(at); }
      return { range, legal: range.map((at) => ({ at, tiles: [at] })) };
    }
    function strikeTargeting(reach = E.strikeRange(U.s, controlledId(U.s))) {
      const s = U.s, p = controlledFighter(s), ox = p.x, oy = p.y;
      const hostile = a => s.mode === "warfare" ? a.side !== p.side : a.side === "enemy";
      const legal = Object.values(s.actors).filter((a) => hostile(a) && !a.defeated && E.geometry.dist(s, ox, oy, a.x, a.y) <= reach).map((a) => ({ at: [a.x, a.y], tiles: [[a.x, a.y]] }));
      if (s.mode === "warfare") for (const m of s.wild || []) if (m.form === "unit" && !m.fleeing && E.geometry.dist(s, ox, oy, m.x, m.y) <= reach) legal.push({ at: [m.x, m.y], tiles: [[m.x, m.y]] });
      const range = []; for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) if ((dx || dy) && Math.abs(dx) + Math.abs(dy) <= reach) range.push([ox + dx, oy + dy]);
      // Creeper: any normal attack clears it, so a creeper tile in reach with nobody on it is a Strike target.
      for (const m of s.wild || []) if (m.kind === "creeper" && m.tiles) for (const [x, y] of range) if (`${x},${y}` in m.tiles && !legal.some((q) => q.at[0] === x && q.at[1] === y)) legal.push({ at: [x, y], tiles: [[x, y]] });
      // A data center that is not the player's side's: the one object a Strike can hit (docs/data-center.md).
      // Any object in reach can be struck (Mala, 2026-10-14), except a building your own side placed.
      for (const o of s.arena.objects || []) if (o.hp > 0 && !o.dead && !(s.actors[o.owner || o.tower?.owner]?.side === p.side) && range.some(([x, y]) => x === o.x && y === o.y) && !legal.some((q) => q.at[0] === o.x && q.at[1] === o.y)) legal.push({ at: [o.x, o.y], tiles: [[o.x, o.y]] });
      return { range, legal };
    }
    function commitAt(at) {
      const s = U.s;
      if (U.mode === "target" && U.sel?.summon) return commitSummon(at);
      if (U.mode === "target" && U.sel?.summonUltimateOrder) return act({ type: "orderSummonUltimate", actor: "player", summon: U.sel.summonUltimateOrder, target: at });
      if(U.mode==="press")return act({type:"fullCourtPress",actor:"player",unit:U.pressUnit,to:at});
      if (U.mode === "move") return act({ type: "move", actor: "player", to: at });
      if (U.mode === "jump") return act({ type: "jump", actor: "player", to: at });
      if (U.mode === "climb") return act({ type: "climb", actor: "player", to: at });
      if (U.mode === "response") {
        const kind = U.throwArmed ? "dodgeThrow" : "reposition";
        const r = E.responseOptions(s).find((o) => o.kind === kind && k(o.to) === k(at));
        if (r) { U.throwArmed = false; return act({ type: "respond", actor: E.decider(s).actor, response: kind, to: at }); }
        return flashTip(U.throwArmed ? "Not a reachable dodge-throw tile (land within 6 of the attacker)." : "Not a reachable reposition tile.");
      }
      if (U.mode === "target" && U.sel) {
        if (U.sel.throwPick) { U.sel = { strike: true, throwAt: true, pick: at, tg: throwAtTargeting(at) }; U.cursor = at; return render(); }   // Fulcrum Throw: what to lift, then where
        if (U.sel.throwAt) return act({ type: "throw", actor: "player", pick: U.sel.pick, at });
        if (U.sel.grapple) return act({ type: "grapple", actor: "player", target: at });

        if (U.sel.palingenesis) return act({ type: "palingenesis", actor: "player", at, burn: !!U.sel.burn });
        if (U.sel.strike) { const aim = U.strikeAim; U.strikeAim = null; return act({ type: "strike", actor: "player", target: at, effort: U.sel.effort, ...(aim ? { aim } : {}) }); }
        if (U.sel.item) return act({ type: "useItem", actor: "player", item: U.sel.item, target: at });
        if (U.sel.card != null) return act({ type: "playCard", actor: "player", card: U.sel.card, target: at });   // Battle Cards (C1)
        if (miseOn()) return miseTile(at);   // Mise en Place: a tile click sets a station's tile; Prepare commits the plan
        if (U.setDown && U.sel.ability) { const r = act({ type: "setIntent", actor: "player", ability: U.sel.ability, trigger: U.setTrigger || "manual", target: U.sel.self ? undefined : at }); U.setDown = false; return r; }   // Mystery: set instead of fire
        const a = abilityAction();
        if (!U.sel.self) a.target = at;
        U.audRole = null; U.audVow = null;
        return act(a);
      }
    }
    function previewFor(at) {
      if (U.mode !== "target" || !U.sel || U.sel.strike || U.sel.card != null || miseOn()) return null;
      const a = abilityAction();
      if (!U.sel.self) { if (!at) return null; a.target = at; }
      return E.preview(U.s, a);
    }
    // Mise en Place (docs/mise-en-place.md): a station plan is a beneficiary, a technique and a tile for each station. The panel
    // collects them; a click on a ringed tile sets the active slot's tile; Prepare sends act.stations.
    const MISE_SLOTS = { rackAndLabel: 1, parallelPrep: 2, everythingInItsPlace: 1 };
    const miseOn = () => !!U.sel?.ability && U.sel.ability in MISE_SLOTS;
    const miseView = () => (U.s?.mise?.stations?.length ? root.ConceptCombatMise?.view(U.s) || [] : []);   // freshness and current discount: the numbers the engine applies
    function miseStationsHtml(p) {   // every station in play, public; the caster's own get a Renew button while fading
      const rows = miseView().map((t) => { const ben = U.s.actors[t.beneficiary]?.name || "?", tech = t.technique === "strike" ? "Strike" : C.abilities[t.technique]?.name || t.technique, mine = t.caster === p.id;
        const state = t.lock.length ? "locked until every foe present has started a turn" : `${t.fresh}% fresh, ${t.now} AP off now${t.now ? "" : " (nothing left)"}, ${t.goneIn} round${t.goneIn === 1 ? "" : "s"} until it is gone`;
        return `<li class="cc-mise-station"><b>${esc(ben)}</b>: ${esc(tech)} at (${t.x},${t.y}) · ${esc(state)}${mine && t.renewable && !t.lock.length ? ` <button type="button" data-mise="renew" data-st="${esc(t.id)}">Renew · 5 AP</button>` : ""}</li>`; });
      return rows.length ? `<ul class="cc-mise-list">${rows.join("")}</ul>` : "";
    }
    const miseNew = (p) => ({ beneficiary: p.id, technique: "", at: null });
    function miseState(id, p) { if (U.mise?.ability !== id) U.mise = { ability: id, active: 0, slots: Array.from({ length: MISE_SLOTS[id] }, () => miseNew(p)) }; return U.mise; }
    const miseTechs = (uid) => [...E.abilitiesOf(U.s, uid).filter((t) => C.abilities[t] && ["basic", "refined"].includes(C.abilities[t].tier) && !(t in MISE_SLOTS)), ...(uid === "player" && root.ConceptCombatMise?.isChef(U.s.actors.player) ? ["strike"] : [])];   // a Chef's stations may name Strike (Mala, 2026-10-30)
    const miseTechName = (t) => (t === "strike" ? "Strike" : C.abilities[t].name);
    function miseBlock(id, p) {
      const M = miseState(id, p), allies = Object.values(U.s.actors).filter((u) => !u.defeated && u.side === p.side && !u.escaped && !u.notArrived);
      return `<div class="cc-edge-note">${miseStationsHtml(p)}<b>Plan the stations.</b> Name who, which technique and where; click a ringed tile for the active station. ${id === "everythingInItsPlace" ? "Up to three stations, one per ally; announced." : ""}
        ${M.slots.map((sl, i) => `<div class="cc-mise-slot ${M.active === i ? "cc-mise-active" : ""}"><b>${i + 1}</b>
          <select data-mise="ben" data-i="${i}">${allies.map((u) => `<option value="${esc(u.id)}" ${u.id === sl.beneficiary ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select>
          <select data-mise="tech" data-i="${i}"><option value="">Technique…</option>${miseTechs(sl.beneficiary).map((t) => `<option value="${esc(t)}" ${t === sl.technique ? "selected" : ""}>${esc(miseTechName(t))}</option>`).join("")}</select>
          <button type="button" data-mise="tile" data-i="${i}">${sl.at ? `Tile (${sl.at[0]},${sl.at[1]})` : "Pick tile"}</button>${id === "everythingInItsPlace" && M.slots.length > 1 ? `<button type="button" data-mise="drop" data-i="${i}">Remove</button>` : ""}</div>`).join("")}
        ${id === "parallelPrep" && (U.s.actors[p.id]?.secondary === "pipeline") ? `<label class="cc-check"><input type="checkbox" data-mise="order" data-i="0" ${M.second ? "checked" : ""}> Sequential Workstations: redeem station 2 first</label>` : ""}
        ${id === "everythingInItsPlace" && M.slots.length < 3 ? `<button type="button" data-mise="add" data-i="0">Add a station</button>` : ""}
        <button type="button" data-mise="go" data-i="0">Prepare</button></div>`;
    }
    function miseGo() {
      const M = U.mise; if (!M || M.ability !== U.sel?.ability) return;
      const bad = M.slots.findIndex((sl) => !sl.at || !sl.technique || !sl.beneficiary);
      if (bad >= 0) return flashTip(`Station ${bad + 1} needs a beneficiary, a technique and a tile.`);
      const a = { type: "ability", actor: "player", ability: M.ability, reveal: U.reveal, target: M.slots[0].at, stations: M.slots.map(({ at, beneficiary, technique }) => ({ at, beneficiary, technique })), order: M.second ? [1, 0] : [0, 1], announce: M.ability === "everythingInItsPlace" }; U.mise = null;   // order: Sequential Workstations (Pipeline secondary) redeems station 1 first unless the second is chosen
      return act(a);
    }
    function miseTile(at) { const M = U.mise; if (!M) return; M.slots[M.active].at = at; const next = M.slots.findIndex((sl) => !sl.at); if (next >= 0) M.active = next; render(); }
    function abilityAction(){return {type:"ability",actor:"player",ability:U.sel.ability,part:U.prunePart,gap:U.gap,sectionAxis:U.sectionAxis,projectionProperty:U.projectionProperty,projectionAxis:U.projectionAxis,fragment:U.fragmentKind,fragmentId:U.fragmentId,montageParts:U.montageParts.filter(Boolean),prototypeSource:U.prototypeSource,recombineParts:U.recombineParts.filter(Boolean),whatIfAs:U.whatIfAs,overclock:U.overclock,reveal:U.reveal,announce:!U.quickened&&(U.sel.m.tier==="ultimate"||U.sel.m.effect==="damage")&&U.announce,revelation:U.revelation||1,deception:!U.quickened&&U.sel.m.tier==="ultimate"&&U.announce&&U.deception,quickened:U.quickened||null,role:U.sel.ability==="audition"?U.audRole||null:null,vow:U.sel.ability==="audition"?U.audVow||null:null,gear:U.sel.ability==="ulaula"?U.gearPick||2:null,surrender:U.sel.ability==="publicPromise"?U.promiseSurrender||"retreat":null};}
    function renderDetail() {
      const s = U.s, el = $("ccDetail"), p = controlledFighter(s);
      if (s.outcome) { el.innerHTML = reportHtml(); bindReport(el); return; }
      if (s.film && !p) { const f = s.film, mark = s.actors[f.markId], star2 = s.actors[f.costarId];
        el.innerHTML = `<div class="cc-title">🎬 On set · Take ${f.turn}</div><p>${esc(mark?.name || "The star")} vs ${esc(star2?.name || "the co-star")}${f.cameoId && s.actors[f.cameoId] ? ` + ${esc(s.actors[f.cameoId].name)}` : ""}. The star falls: CUT and a premiere. The cast falls: ruin, a dud with no premiere.</p>${f.owner === "player" ? `<p class="cc-muted">Your film. Wrap it early from the banner above (counts as a dud).</p>` : `<p class="cc-muted">Someone else's film. The battle resumes when the scene ends.</p>`}`; return; }
      if (U.mode === "response" && s.pending) {
        const inst = s.pending.inst;
        el.innerHTML = `<div class="cc-title">${esc(inst.name)}${TIER[inst.tier] ? ` <span class="cc-tier t-${inst.tier}">${TIER[inst.tier]}</span>` : ""}</div>
          <p>${inst.deception ? `Claimed reach: ${inst.claimedRange} tiles. The committed target is hidden until resolution.` : s.pending.resume ? `A delayed effect committed last round lands at the start of ${esc(d0(s).name)}'s turn, before Guard and other effects expire.` : esc(C.abilities[inst.ability]?.announce || inst.announce || (inst.submissionFinish ? ((s.actors[s.pending.defenders?.[0]]?.reaction || 0) > 0 ? `The finishing hold: break it (${s.rules.submission?.finishBreakAp ?? 40} AP owed and your reaction) or submit.` : "The finishing hold: no reaction left to break it." ) : ""))}</p>
          <div class="cc-muted">${inst.deception ? "Amber tiles show the declared threat envelope; the actual committed area may extend farther. No announcement potency bonus applies." : `Committed tiles are red${inst.mult != null && inst.mult !== 1 ? `; damage ×${+(inst.mult).toFixed(2)} from disclosure` : ""}.`} Reposition up to ${E.dodgeReach(s, E.decider(s).actor)} tiles (green = outside the declared area), or Guard. Either spends your one reaction this round, so a Rebound can't fire after.</div>`;
        return;
      }
      if(U.mode==="press"){el.innerHTML=`<div class="cc-title">Full Court Press · ${esc(s.actors[U.pressUnit]?.name || "ally")}</div><p>Click a green tile to relocate this ally instantly for 0 AP. One use per ally; movement vows still apply. Esc cancels without spending the relocation.</p>`;return;}
      if (U.mode === "move") { el.innerHTML = `<div class="cc-title">Move</div><p class="cc-muted">Spend ${s.rules.actionCosts.movePerPoint} AP per terrain movement point, up to ${root.ConceptCombatInjury?.moveBudget(s, s.actors[controlledId(s)], E.movementBudget(s, controlledId(s)), !!root.ConceptCombatClassRuntime?.flies?.(s.actors[controlledId(s)])) ?? E.movementBudget(s, controlledId(s))} points on this move. Each step entering, leaving, or crossing water also costs ${s.rules.waterMoveApSurcharge ?? 20} AP; swimmers can cross deep water. You may move again while tempo remains. Slopes and mulch also affect movement. A 2+ level climb needs a ramp or Climb, and a 2+ level drop needs Jump. Remaining AP can fund other actions or be banked with Stall.</p>`; return; }
      let id = null, it = null;
      if (U.mode === "target" && U.sel && U.sel.ability) id = U.sel.ability;
      else if (U.menu === "tech") { it = foldRows(subItems())[U.menuIndex]; if (it?.fold) { el.innerHTML = `<div class="cc-title">${esc(it.group)}</div><p>${esc(menuHelp(it))}</p>`; return; } id = it && it.id; if (it && !it.x && !it.contractAction && menuHelp(it)) { el.innerHTML = `<div class="cc-title">${esc(it.label)}</div><p>${esc(menuHelp(it))}</p>`; return; } }
      if(it?.contractAction){el.innerHTML=`<div class="cc-title">${esc(it.label)}</div><p>${it.contractAction==="contractSpeak"?"Only the current ordered invocation counts. Speaking costs 10 AP; words spoken before their step do not count retroactively.":it.contractAction==="contractPrepare"?"Prepare for 20 AP and hold this tile until your next owner turn. Moving invalidates preparation.":"Release the maintained effect now. Its protection and future pulses end; paid costs are not refunded."}</p>`;return;}
      if (U.mode === "target" && U.sel && U.sel.strike) { const potency = s.rules.strike.potency * U.sel.effort / s.rules.actionCosts.strike; el.innerHTML = `<div class="cc-title">Strike · ${U.sel.effort} AP${U.strikeAim ? ` · aimed ${U.strikeAim}` : ""}</div><p class="cc-muted">Contact, adjacent only, ${Math.round(potency)} potency, no ΦF. Tempo debt: ${Math.max(0, U.sel.effort-p.tempo)} AP, repaid from your next turn's budget.${U.strikeAim ? ` Called shot: +${s.rules.injury.aimAp} AP, −${Math.round(s.rules.injury.aimMiss * 100)}% to land.` : ""}</p>`; return; }
      if (U.mode === "target" && U.sel?.summonUltimateOrder) { const summon = s.actors[U.sel.summonUltimateOrder], ult = SM.activeUltimate(summon); el.innerHTML = `<div class="cc-title">Commit target · ${esc(ult.name)}</div><p class="cc-muted">Choose the opponent who will be at the centre of ${esc(summon.name)}'s ultimate. The centre and area are locked now; the target can defend before it fires on ${esc(summon.name)}'s next turn. Ordering costs 20 AP and your full ULT bar.</p>`; return; }
      if (U.mode === "target" && U.sel?.summon) { el.innerHTML = `<div class="cc-title">Place ${esc(SM.data.summons[U.sel.summon]?.name || "summon")}</div><p class="cc-muted">Choose an open, walkable tile within ${SM.data.rules.appearsWithin} tiles of you. The ringed tiles are valid arrival points. Escape cancels placement.</p>`; return; }
      if (U.mode === "target" && U.sel?.card != null) { const row = E.cards.options(s, controlledId(s))[U.sel.card]; el.innerHTML = `<div class="cc-title">${esc(row?.name || "Card")}</div><p>${esc(row?.text || "")}</p><p class="cc-muted">Choose a ringed target. A card costs no AP and no ΦF; one card a turn, each card once a battle. Escape cancels.</p>`; return; }   // Battle Cards (C1)
      if (U.mode === "target" && U.sel?.item) { el.innerHTML = `<div class="cc-title">${esc(Loot.data.consumables[U.sel.item]?.name || W?.data.items[U.sel.item]?.name || U.sel.item)}</div><p>${esc(itemHelpFor(U.sel.item, p.tempo).effect)}</p><p class="cc-muted">${esc(itemHelpFor(U.sel.item, p.tempo).detail)}</p><p>Carrying: ${(p.inventory || []).length}/${p.inventoryCapacity || 2}</p>`; return; }
      if (!id) {
        if(U.setupOpts?.proficientSummonerTest && U.menu==="root") { const cost=E.summonProfile(s,p.id); el.innerHTML=`<div class="cc-title">Proficient Summoner · ${cost.emergentIdea ? "active" : "inactive"}</div><p>${cost.emergentIdea ? `Imagination + Full Believer. Each call costs ${cost.apCost} AP and ${cost.phiCost} ΦF; you can keep ${cost.maxActive} summons active. Each gets a ${cost.wardProtection}-point ward on arrival and at the start of its own turn. Protection replaces itself rather than stacking.` : `The synergy is inactive. Imagination must be equipped and Full Believer must be present on this character. Normal calls cost ${cost.apCost} AP and ${cost.phiCost} ΦF, with ${cost.maxActive} active summon and no renewing summoner ward.`}</p><p>${cost.emergentIdea ? "Open Summon ally and call two different creatures. Swap Imagination out to remove the synergy." : "Re-equip Imagination to restore the synergy; a pending secondary becomes usable at your next turn start."} These practice summons leave saved unlocks and progression unchanged.</p>`;return; }
        if(U.s.summonTrueFormTest && U.menu==="root" && !U.s.dreamSpace) { el.innerHTML=`<div class="cc-title">Mitsuko Dazzle · test 3</div><p>Mitsuko starts beside you in her ordinary form. Open Dream Space to reveal her armored true form: maximum LF 45 → 68, ×1.25 technique potency and +2 ΦF regeneration per turn (provisional).</p><p>On reveal, each enemy has a 40% chance of Dazzle: 25% less AP on their next turn. Check the battle log, then end your turn to see the AP loss. Her true form remains until she disappears. You can compress or imbue this dream too. This practice leaves saved progression unchanged.</p>`;return; }
        if(U.setupOpts?.performerTest && U.menu==="root") { el.innerHTML=`<div class="cc-title">Performers · test 1</div><p>You are the Musician, with a Rapper ally and the Bard nearby. Use Consonance to tune your allies, then end your turn and watch their next techniques. Lullaby is strongest on wild creatures; the Bard’s charm is strongest on dream creatures.</p><p>Written Verse gives three lines and a choice. Borrowed techniques keep their original targets and counters. This practice leaves saved progression unchanged.</p>`;return; }
        if(U.setupOpts?.trueFormSpriteTest && U.menu==="root") { el.innerHTML=`<div class="cc-title">Aristotle · true-form test</div><p>Open Dream Space to reveal Aristotle’s new form. End your turn to watch First Principles reveal an enemy trait and reduce its AP. His new appearance and Golden Mean resistance last until he disappears.</p><p>Attack close-ups enlarge the new sprites. This practice leaves saved progression unchanged.</p>`;return; }
        if(U.setupOpts?.attackCloseupTest && U.menu==="root") { el.innerHTML=`<div class="cc-title">Attack close-up · test</div><p>Strike the adjacent Student to see the melee pop-up. End your turn to watch ranged attacks from the Surveyor. Use Animation: Full / Fast above the battle log to compare; Escape skips a pop-up.</p><p class="cc-muted">Practice battle · saved progression unchanged.</p>`;return; }
        if(U.s.focusedDreamTest && U.menu==="root" && !U.s.dreamSpace) { el.innerHTML=`<div class="cc-title">Focused Dream · test 1</div><p>Full ULT is ready. Open Dream Space, then Compress Dream to radius 2. The Student stays inside; Sieve and Gardener remain outside. Try moving across the glowing edge, then cast Bastion Collapse at full ULT, or imbue your Barrier aura. Bastion still costs 50 AP: bank AP before opening, or use Overclock if you are short. Diffusion can still attack inward from outside; move near the lower edge to meet the Gardener's wave.</p><p class="cc-muted">The normal ULT clock still closes the dream. Play again resets this practice battle.</p>`;return; }
        if (["root", "insight", "items", "cook", "drop", "summons", "strike", "mockTrial", "trial"].includes(U.menu) || inDrawer()) {
          const selected = (menuList())[U.menuIndex], text = selected && (U.menu === "insight" ? selected.help : menuHelp(selected));
          // an item row splits its text: what it does, then cost / target / refusals
          if (text) { el.innerHTML = `<div class="cc-title">${esc(selected.heading || selected.label || selected.group)}</div><p>${esc(selected.helpEffect || text)}</p>${selected.helpDetail ? `<p class="cc-muted">${esc(selected.helpDetail)}</p>` : ""}`; return; }
        }
        if (U.menu === "root") { const selected = rootRows()[U.menuIndex]; if (selected?.id === "orderSummonUltimate") { const summon = s.actors[selected.summonId], ult = SM.activeUltimate(summon), can = SM.canOrderUltimate(p, summon, { ultimateChargeMax: s.rules.ultimateChargeMax }); el.innerHTML = `<div class="cc-title">${esc(ult.name)}</div><p class="cc-muted">Spend your full ${s.rules.ultimateChargeMax}-point ULT bar and 20 AP. ${esc(summon.name)} will fire this on its next turn${ult.play.type === "nova" ? "; the area is committed now and opponents can Guard or reposition." : "."}</p><p class="cc-muted">${esc(selected.why || (can.ok ? "Ready to order." : can.reason))}</p>`; return; } }
        if (U.menu === "investigate") {
          const V = INS.data.rules.investigate, kinds = ["", ...Object.keys(INS.data.kinds || {}), "trait"].filter((k, i, all) => all.indexOf(k) === i);
          el.innerHTML = `<div class="cc-title">Investigate · all ${p.tempo} AP</div><p class="cc-muted">Spend the rest of your turn studying one target. Finds the hardest things first (your focus kind first, if you chose one), +${V.depthBonus} points for the depth, carries up to ${V.carryCap}. Your turn ends and your reaction is spent until next round.</p><label>Focus <select id="ccInvestigateFocus">${kinds.map((k) => `<option value="${esc(k)}" ${k === (U.investigateFocus || "") ? "selected" : ""}>${k ? esc(k) : "any kind"}</option>`).join("")}</select></label>`;
          el.querySelector("#ccInvestigateFocus").onchange = (e) => { U.investigateFocus = e.target.value; render(); }; return;
        }
        if (U.menu === "observe") {
          el.innerHTML = `<div class="cc-title">Observe · ${U.observeInvest} AP</div><p class="cc-muted">Choose a visible character to learn traits and abilities, or Observe the place to read the weather, forecast, and microclimate. Each 10 AP adds one insight point; unused effort carries over. Place familiarity makes a Dream Space easier to open and hold.</p><label>Effort <select id="ccObserveEffort">${[10,20,30,40,50].map(n=>`<option value="${n}" ${n===U.observeInvest?"selected":""}>${n} AP · ${n/10} points</option>`).join("")}</select></label>`;
          const row = foldRows(subItems())[U.menuIndex], rowText = row && menuHelp(row);   // the row under the pointer: a plant or structure says what knowing it brings
          if (rowText) el.insertAdjacentHTML("beforeend", `<p class="cc-muted">${esc(row.label)}: ${esc(rowText)}</p>`);
          el.querySelector("#ccObserveEffort").onchange = e => { U.observeInvest = +e.target.value; render(); }; return;
        }
        if (U.menu === "insight") { el.innerHTML = `<div class="cc-title">Insight · ${esc(s.actors[U.insightTarget]?.name || "target")}</div><p class="cc-muted">Only observed traits and findings unlock actions. Frighten shows its chance before you spend AP.</p>`; return; }
        if (U.menu === "lens") { const l = subItems()[U.menuIndex]; el.innerHTML = l ? `<div class="cc-title">${esc(l.label)}</div><p>${esc(l.pr.trade)}</p><p class="cc-muted">${l.pr.proficiency > p.proficiency ? `Needs lens proficiency ${l.pr.proficiency} (you have ${p.proficiency}).` : `Costs ${s.rules.actionCosts.utility} AP. Committed effects keep the lens they were cast with.`}</p>` : ""; return; }
        if (U.menu === "swap") { el.innerHTML = `<div class="cc-title">Swap secondary</div><p class="cc-muted">Costs ${s.rules.actionCosts.swap} AP. Your current secondary goes to reserve now and its dependent effects end. The new one works from your next turn start, so you have no secondary until then.</p>`; return; }
        const lens = [p.primary, p.secondary].filter(Boolean).map((c) => { const l = E.lensOf(s, "player", c); return `${C.concepts[c].name}: <b>${esc(l.name)}</b> <span class="cc-muted">${esc(l.trade)}</span>`; }).join("<br>");
        const comp = E.compositionEdge(s, controlledId(s));
        el.innerHTML = `<div class="cc-title">${esc(p.name)}</div>
          <div>Primary <b style="color:${C.concepts[p.primary].color}">${C.concepts[p.primary].name}</b> · Secondary ${p.secondary ? `<b style="color:${C.concepts[p.secondary].color}">${C.concepts[p.secondary].name}</b>` : `<i>none until next turn${p.pendingSwap && C.concepts[p.pendingSwap] ? ` (${esc(C.concepts[p.pendingSwap].name)} pending)` : ""}</i>`}
          · Reserve ${p.reserve.map((c) => C.concepts[c].name).join(", ") || "empty"} <span class="cc-muted">(${p.reserve.length}/${p.reserveSlots}, no passives)</span></div>
          ${comp ? `<div class="cc-edge-note">${esc(comp.example)} <a href="#" data-edge="${comp.id}">${comp.id}</a></div>` : ""}
          <div class="cc-lens">${lens}</div>
          ${(p.primary === "gradingDrainage" || p.secondary === "gradingDrainage" || p.earthStock > 0) ? `<div class="cc-edge-note"><b>Earth stock ${p.earthStock || 0}/12.</b> Cut Slope banks one soil unit and permanently lowers open soil; Place Fill spends one unit. Six cumulative cut units call Gaia. Terrain changes alter movement, elevation and sightline rules.</div>` : ""}`;
        el.querySelectorAll("[data-edge]").forEach((a) => a.onclick = (e) => { e.preventDefault(); openGraph(a.dataset.edge); });
        return;
      }
      const x = E.availableAbilities(s, controlledId(s)).find((q) => q.id === id);
      if (!x) { el.innerHTML = `<div class="cc-title">${esc(it?.label || id)}</div>`; return; }   // a row that is no ability and carries no text of its own
      const m = x.m, d = C.abilities[id];
      const feintBait = id === "feint" && U.announce;   // Mala's Feint ruling: announced Feint discounts instead of buffing
      const category = C.effectCategories[m.effectCategory] || C.effectCategories.uncategorized;
      const area = m.area.shape === "radius" ? `radius ${m.area.radius} around you` : m.area.shape === "plus" ? "target + 4 neighbours" : m.area.shape === "line" ? "every tile on the line" : "single target";
      const reach = m.delivery === "routed" ? `route ≤ ${m.routeBudget}` : m.effect === "barrier" ? (m.range ? `place ≤ ${m.range}` : "self only") : m.range ? `range ${m.range}` : "self";
      const multi = ["radius", "plus", "line"].includes(m.area.shape);
      const pv = U.mode === "target" ? previewFor(U.sel.self ? null : U.hover) : null;
      const foes = Object.values(s.actors).filter((a) => (s.mode === "warfare" ? a.side !== p.side : a.side === "enemy") && !a.defeated);
      const responseFoes = pv?.ok && U.announce && m.timing !== "delayed" ? (pv.pending?.defenders || []).map(id => s.actors[id]).filter(Boolean) : foes;
      const techniqueKnown = Object.values(s.knowledge).some(k2 => k2[p.id]?.abilities[id]);
      const canDeceive = (p.primary === "deception" || p.secondary === "deception") && m.tier === "ultimate" && !d.timing && advertisedReach(m) > 1 && !x.revealed && !techniqueKnown;
      const claimedRange = Math.max(1, advertisedReach(m) - 1);
      const shownTempo = feintBait ? 5 : m.tempoCost;
      const maxOverclock = m.effect === "damage" ? Math.max(0, Math.min(s.rules.maxOverclockPerAction, p.tempo + s.rules.maxTempoDebt - shownTempo)) : 0;
      const observed = E.geometry.observedAbilities(s,"player"), abilities = E.availableAbilities(s,controlledId(s)).map(q=>q.id);
      const special = U.mode !== "target" ? "" : m.effect==="sectionCut" ? `<label>Cut axis <select data-special="sectionAxis"><option value="row" ${U.sectionAxis==="row"?"selected":""}>Row</option><option value="column" ${U.sectionAxis==="column"?"selected":""}>Column</option></select></label>` : m.effect==="project" ? `<label>Copy <select data-special="projectionProperty"><option value="height" ${U.projectionProperty==="height"?"selected":""}>Height</option><option value="surface" ${U.projectionProperty==="surface"?"selected":""}>Surface</option></select></label><label>Axis <select data-special="projectionAxis">${["north","east","south","west"].map(q=>`<option value="${q}" ${U.projectionAxis===q?"selected":""}>${q}</option>`).join("")}</select></label>${m.projectFragment?`<label>Held fragment <select data-special="fragmentId">${(p.heldFragments||[]).map(f=>`<option value="${esc(f.id)}" ${U.fragmentId===f.id?"selected":""}>${esc(f.kind)} · (${f.at?.join(",")||"held"})</option>`).join("")}</select></label>`:""}` : m.effect==="clip" ? `<label>Clip <select data-special="fragmentKind">${["cover","water","mulch","thorns","absorbOneLine","wallProtection10","membrane","growthStage"].map(q=>`<option value="${q}" ${U.fragmentKind===q?"selected":""}>${q}</option>`).join("")}</select></label>` : m.effect==="paste" ? `<label>Paste held <select data-special="fragmentId">${(p.heldFragments||[]).map(f=>`<option value="${esc(f.id)}" ${U.fragmentId===f.id?"selected":""}>${esc(f.kind)} · (${f.at?.join(",")||"held"})</option>`).join("")}</select></label>` : m.effect==="montage" ? `<div class="cc-edge-note">Photomontage records three techniques you have seen: delivery, area, and harm channel. Select each observed non-ultimate technique.</div>${[0,1,2].map(i=>`<label>Part ${i+1} <select data-montage="${i}"><option value="">Choose observed technique</option>${observed.map(q=>`<option value="${q.id}" ${U.montageParts[i]===q.id?"selected":""}>${esc(C.abilities[q.id].name)}</option>`).join("")}</select></label>`).join("")}` : "";
      const copyable = (bid) => { const dd = C.abilities[bid]; return dd && dd.tier === "basic" && (!dd.timing || dd.timing === "immediate") && !dd.announce && dd.effect === "damage" && dd.target === "enemy" && dd.area?.shape === "single" && Number.isFinite(dd.potency); };
      const innoSpecial = U.mode !== "target" ? "" : m.effect === "prototype" ? `<div class="cc-edge-note">Prototype copies one witnessed damaging basic at ×0.7, otherwise unmodified.</div><label>Copy <select data-inno="prototypeSource"><option value="">Choose witnessed basic</option>${observed.filter(q=>copyable(q.id)).map(q=>`<option value="${q.id}" ${U.prototypeSource===q.id?"selected":""}>${esc(C.abilities[q.id].name)}</option>`).join("")}</select></label>`
        : m.effect === "recombine" ? `<div class="cc-edge-note">Recombine fires readied damaging basics that share a delivery as one action, ×0.7 each. Two readies (three on Skunkworks).</div>${[0,1,2].map(i=>`<label>Part ${i+1} <select data-inno-recombine="${i}"><option value="">—</option>${abilities.filter(copyable).map(q=>`<option value="${q}" ${U.recombineParts[i]===q?"selected":""}>${esc(C.abilities[q].name)}</option>`).join("")}</select></label>`).join("")}`
        : (p.status?.whatIf?.untilRound >= s.round && d.tier === "basic") ? `<label>Play as <select data-inno="whatIfAs"><option value="">This technique, as written</option>${abilities.filter(q=>C.abilities[q]?.tier==="basic"&&q!==id).map(q=>`<option value="${q}" ${U.whatIfAs===q?"selected":""}>${esc(C.abilities[q].name)}</option>`).join("")}</select></label>`
        : "";
      const earthHint = m.effect === "gradeCut" ? `<p class="cc-edge-note">Cut one level from eligible open soil; gain 1 Earth. Three cut units warn Gaia; six summon her in the next wild phase. The height change is permanent for this battle.</p>` : m.effect === "gradeFill" ? `<p class="cc-edge-note">Spend 1 Earth to raise eligible open soil by one level. Current stock: ${p.earthStock || 0}/12. Grade changes affect movement and elevation immediately.</p>` : m.effect === "gradeTerrace" ? `<p class="cc-edge-note">Regrade the marked catchment while conserving its total height. Any net cut contributes to Gaia's attention. The new contour persists for this battle.</p>` : "";
      el.innerHTML = `<div class="cc-title"><span class="cc-tier t-${m.tier}">${TIER[m.tier]}</span>${esc(m.name)} <span class="cc-muted">${esc(C.concepts[m.concept].name)} · ${x.source}</span></div>
        ${earthHint}
        ${m.tier === "ultimate" && s.dreamSpace?.owner === p.id ? `<p class="cc-edge-note">${DS?.canFinishUltimate(p, s.dreamSpace, s.rules) ? "Dream finisher: full ULT is ready. The barrier and dream bonus hold through announcement and responses; this technique closes the dream after resolving. No extra aura pulse." : "Dream finisher needs a full ULT bar inside your own unburned dream."}${m.timing === "delayed" ? " This delayed move closes the dream when scheduled; its later trigger uses the ordinary field." : ""}</p>` : ""}
        ${special}
        ${innoSpecial}
        ${U.mode === "target" && m.effect === "damage" ? `<label>Quickened <select id="ccQuickened"><option value="" ${!U.quickened?"selected":""}>Normal · response window applies</option><option value="snap" ${U.quickened==="snap"?"selected":""}>Snap · no reaction · ×0.6 potency</option>${m.tier === "ultimate" ? `<option value="lastWord" ${U.quickened==="lastWord"?"selected":""} ${p.quickenedSpent?.[id]?"disabled":""}>Last Word · full power · spend ultimate for battle</option>` : ""}</select></label>` : ""}
        ${U.mode === "target" && m.effect === "damage" && !E.mindset(U.s, controlledId(U.s))?.noOverclock ? `<label>Overclock · extra AP <select id="ccOverclock"><option value="0">No overclock</option>${Array.from({length:Math.floor(maxOverclock/5)},(_,i)=>(i+1)*5).map(n=>`<option value="${n}" ${U.overclock===n?"selected":""}>+${n} AP · ×${((shownTempo+n)/shownTempo).toFixed(2)} potency${Math.max(0,shownTempo+n-p.tempo)?` · ${shownTempo+n-p.tempo} debt`:""}</option>`).join("")}</select></label>` : ""}
        ${U.mode === "target" && m.effect === "prune" ? `<label>Name a part <select id="ccPrunePart"><option value="foliage" ${U.prunePart==="foliage"?"selected":""}>Foliage / hedge</option><option value="hazard" ${U.prunePart==="hazard"?"selected":""}>Hazard</option><option value="limb" ${U.prunePart==="limb"?"selected":""}>Unstable limb</option></select></label><p class="cc-muted">Wrong part? The action and ΦF are still spent. Barriers block this operation.</p>` : ""}
        ${U.mode === "target" && m.effect === "bermRing" ? `<label>Open gap <select id="ccGap">${["north","east","south","west"].map(d=>`<option value="${d}" ${U.gap===d?"selected":""}>${d[0].toUpperCase()+d.slice(1)}</option>`).join("")}</select></label>` : ""}
        ${U.mode === "target" && id === "publicPromise" ? `<label>Surrender until it resolves <select id="ccSurrender"><option value="retreat" ${(U.promiseSurrender || "retreat") === "retreat" ? "selected" : ""}>Retreat · no moving away from enemies</option>${E.availableAbilities(U.s, controlledId(U.s)).map((x) => x.id).filter((a) => a !== "publicPromise" && C.abilities[a]).map((a) => `<option value="${a}" ${U.promiseSurrender === a ? "selected" : ""}>${esc(C.abilities[a].name)}${(C.abilities[a].cost ?? 0) > (p.pf ?? 0) ? " · cheap talk: you couldn't cast it now" : ""}</option>`).join("")}</select></label><p class="cc-muted">What you give up makes the promise credible. Surrender a technique you couldn't use and it is exposed as cheap talk.</p>` : ""}
        ${U.mode === "target" && id === "ulaula" ? `<label>ʻUlaʻula gear <select id="ccGear">${(p.birdMountain?.vows?.neverQuench ? [2, 3, 4, 5] : [2, 3, 4]).map(g=>`<option value="${g}" ${(U.gearPick || 2)===g?"selected":""}>×${g}${g === 5 ? " · Never Quench" : ""}</option>`).join("")}</select></label><p class="cc-muted">Higher gears burn hotter: more potency, more burn.</p>` : ""}
        ${U.mode === "target" && id in MISE_SLOTS ? miseBlock(id, p) : ""}
        <div class="cc-facts"><span>${feintBait ? 5 : m.tempoCost} AP</span><span>${feintBait ? 1 : m.cost} ΦF</span>${m.lfPrice ? `<span>${m.lfPrice} LF</span>` : ""}<span>${esc(m.delivery)}</span><span>${esc(reach)}</span><span class="${multi ? "cc-multi" : ""}">${esc(area)}</span><span>Math · ${esc(category.name)}</span>
          ${m.effect === "damage" ? `<span>${esc(C.damageTypes[m.damageType]?.name || m.damageType)}</span>` : ""}
          ${m.potency ? `<span>potency ${+m.potency.toFixed(2)}</span>` : ""}${m.protection ? `<span>protection ${m.protection} · ${m.duration} turns</span>` : ""}</div>
        ${FXS?.stripFor(d) ? `<img class="cc-tech-strip" alt="" src="combat/sprites/${FXS.stripFor(d)}.png">` : ""}
        <p>${esc(d.mechanism)}</p>
        ${d.price || d.counter || d.teaches ? `<div class="cc-edge-note"><b>Tradeoff:</b> ${esc(d.price||"")}<br><b>Counterplay:</b> ${esc(d.counter||"")}<br><b>Math idea:</b> ${esc(d.teaches||"")}</div>` : ""}
        <div class="cc-muted">Logical form: ${esc(category.form)}${category.counters.length ? `<br>Counter pattern: ${category.counters.map(esc).join(", ")} (rule category only; no automatic bonus)` : ""}</div>
        ${id === "adaptiveBrace" ? `<div class="cc-edge-note">${p.lastDamageType ? `Attunes to your last observed harm channel: ${esc(C.damageTypes[p.lastDamageType]?.name || p.lastDamageType)}. This resistance lasts until your next turn start; other channels are unaffected.` : "Receive an attack first. Adaptive Brace will attune to that attack's harm channel."}</div>` : ""}
        ${C.concepts[m.concept].mathIdea ? `<div class="cc-math-note"><b>Math connection · ${esc(C.concepts[m.concept].name)}</b><p>${esc(C.concepts[m.concept].mathIdea)}</p><span>${esc(C.concepts[m.concept].learningPrompt)}</span></div>` : ""}
        <div class="cc-muted">Lens ${esc(m.lensName)}: ${esc(m.lensTrade)}</div>
        ${m.notes.filter((n) => !n.includes("lens:")).map((n) => `<div class="cc-edge-note">${esc(n)}</div>`).join("")}
        <label class="cc-check"><input type="checkbox" id="ccReveal" ${U.reveal || x.revealed ? "checked" : ""} ${x.revealed ? "disabled" : ""}>
          ${x.revealed ? `Revealed: ×${s.rules.revealMultiplier} for this encounter (doesn't stack)` : `Reveal it (×${s.rules.revealMultiplier} for this encounter). Opponents learn: “${esc(d.reveal)}”`}</label>
        ${(m.tier === "ultimate" || m.effect === "damage") && !U.quickened ? `<label class="cc-check"><input type="checkbox" id="ccAnnounce" ${U.announce ? "checked" : ""}> ${id === "feint" ? "Announce (bait: 5 AP + 1 ΦF, no ×1.4)." : `Announce (×${s.rules.announceMultiplier}).`} Opponents in the area get a response:
          ${responseFoes.map((f) => `${esc(f.name)} ${f.reaction ? "has a reaction" : "<b>has no reaction left</b>"}`).join(", ") || "Nobody is in the committed area"}.</label>` : ""}
        ${U.announce && id !== "feint" && !U.quickened && (m.tier === "ultimate" || m.effect === "damage") && s.rules.revelation ? `<label class="cc-check" title="Revelation: the more you explain, the harder it hits, and the more a reader learns. The response window is the same at every tier.">Reveal <select id="ccRevelation">${[1, 2, 3].map((t) => `<option value="${t}" ${(U.revelation || 1) === t ? "selected" : ""}>${s.rules.revelation.names[t]} ×${s.rules.revelation.mults[t]}${s.rules.revelation.apAdd?.[t] ? ` · +${s.rules.revelation.apAdd[t]} AP` : ""}</option>`).join("")}</select></label>` : ""}
        ${canDeceive ? `<label class="cc-check"><input type="checkbox" id="ccDeception" ${U.deception ? "checked" : ""} ${U.announce ? "" : "disabled"}> Deceptive tell: claim ${claimedRange}-tile reach. No ×${s.rules.announceMultiplier} bonus; defenders only see and respond to this shorter threat envelope.</label>` : ""}
        ${U.mode === "target" && U.sel?.ability && (m.tier === "ultimate" || m.effect === "damage") ? `<label class="cc-check" title="Mystery: pay the cost now, fire later. Setting is count-only; the reveal announces at T1.${m.tier === "ultimate" ? " Setting spends the full ultimate bar." : ""}"><input type="checkbox" id="ccSetDown" ${U.setDown ? "checked" : ""}> Set face-down${U.setDown ? ` <select id="ccSetTrigger">${["manual", "on-attacked", "on-turn-start"].map((t) => `<option value="${t}" ${(U.setTrigger || "manual") === t ? "selected" : ""}>${t}</option>`).join("")}</select>` : ""}</label>` : ""}
        ${pv ? previewHtml(pv) : U.mode === "target" ? `<div class="cc-muted">${U.sel.tg.legal.length ? "Hover a ringed tile to preview the outcome." : "No legal target from here. Move, or change lens."}</div>` : ""}`;
      if(d.contract){const c=d.contract,st=x.contract,D=root.ConceptCombatContracts;el.insertAdjacentHTML("beforeend",`<section class="cc-contract-sheet"><h4>Written contract · ${esc(st?.reason||"Ready")}</h4><ol>${c.unlock.map((step,i)=>`<li>${i<(st?.index||0)?"✓ ":i===st?.index?"→ ":""}${esc(D.stepLabel(step,i===st?.index?st.count:0))}</li>`).join("")||"<li>No unlock prerequisites.</li>"}</ol><p>Cast: ${[c.cast.lf?c.cast.lf+" LF":"",c.cast.reaction?"reaction":"",c.cast.prepare?"20 AP preparation and one owner-turn wait":"",c.cast.ultimate?"full ultimate bar":"",c.cast.onlyType&&c.cast.onlyType!=="none"?"only "+D.specialties[c.cast.onlyType].name:""].filter(Boolean).map(esc).join(" · ")||"no additional sacrifices"}.</p><p>While active: ${[c.active.anchored?"remain on casting tile":"",c.active.concentration?"concentrate; another technique ends it":"",c.active.upkeep?c.active.upkeep+" extra ΦF upkeep":""].filter(Boolean).map(esc).join(" · ")||"no ongoing vow"}.</p><p>${c.reset==="once"?"Once per battle.":"After release, repeat the unlock chain."} Specialization: ${esc(D.specialties[c.specialization].name)}. Ongoing strength is earned after holding one owner turn.</p></section>`);}
      const rv = el.querySelector("#ccReveal"); if (rv && !rv.disabled) rv.onchange = () => { U.reveal = rv.checked; renderDetail(); };
      el.querySelectorAll("[data-special],[data-montage],[data-inno],[data-inno-recombine]").forEach(q=>q.onchange=()=>{if(q.dataset.special)U[q.dataset.special]=q.value;if(q.dataset.montage!=null)U.montageParts[+q.dataset.montage]=q.value;if(q.dataset.inno)U[q.dataset.inno]=q.value;if(q.dataset.innoRecombine!=null)U.recombineParts[+q.dataset.innoRecombine]=q.value;const opts={sectionAxis:U.sectionAxis,projectionProperty:U.projectionProperty,projectionAxis:U.projectionAxis,fragment:U.fragmentKind,fragmentId:U.fragmentId,montageParts:U.montageParts.filter(Boolean),prototypeSource:U.prototypeSource,recombineParts:U.recombineParts.filter(Boolean),whatIfAs:U.whatIfAs};U.sel.tg=E.targeting(s,"player",id,opts);U.sel.m=U.sel.tg.m;render();});
      const pp = el.querySelector("#ccPrunePart"); if(pp) pp.onchange=()=>{U.prunePart=pp.value;renderDetail();};
      const gp = el.querySelector("#ccGap"); if(gp) gp.onchange=()=>{U.gap=gp.value;renderDetail();};
      const qc = el.querySelector("#ccQuickened"); if (qc) qc.onchange = () => { U.quickened = qc.value; if (qc.value) { U.announce = false; U.deception = false; } renderDetail(); };
      const oc = el.querySelector("#ccOverclock"); if (oc) oc.onchange = () => { U.overclock = +oc.value; renderDetail(); };
      const gr = el.querySelector("#ccGear"); if (gr) gr.onchange = () => { U.gearPick = +gr.value; renderDetail(); };
      el.querySelectorAll("[data-mise]").forEach((q) => { const M = U.mise, i = +q.dataset.i, kind = q.dataset.mise; if (!M) return;
        if (kind === "order") q.onchange = () => { M.second = q.checked; renderDetail(); };
        else if (q.tagName === "SELECT") q.onchange = () => { const sl = M.slots[i]; if (kind === "ben") { sl.beneficiary = q.value; sl.technique = ""; } else sl.technique = q.value; renderDetail(); };
        else q.onclick = () => { if (kind === "tile") { M.active = i; renderDetail(); } else if (kind === "add") { M.slots.push(miseNew(p)); M.active = M.slots.length - 1; renderDetail(); } else if (kind === "drop") { M.slots.splice(i, 1); M.active = 0; render(); } else if (kind === "go") miseGo(); else if (kind === "renew") act({ type: "miseRenew", actor: "player", station: q.dataset.st }); }; });
      const sr = el.querySelector("#ccSurrender"); if (sr) sr.onchange = () => { U.promiseSurrender = sr.value; renderDetail(); };
      const revSel = el.querySelector("#ccRevelation"); if (revSel) revSel.onchange = () => { U.revelation = +revSel.value || 1; renderDetail(); };
      const an = el.querySelector("#ccAnnounce"); if (an) an.onchange = () => { U.announce = an.checked; if (U.sel?.ability) ((U.announceChoice ||= {})[U.s.seed] ||= {})[U.sel.ability] = an.checked; renderDetail(); };
      const dc = el.querySelector("#ccDeception"); if (dc) dc.onchange = () => { U.deception = dc.checked; renderDetail(); };
      const sd = el.querySelector("#ccSetDown"); if (sd) sd.onchange = () => { U.setDown = sd.checked; renderDetail(); };
      const st = el.querySelector("#ccSetTrigger"); if (st) st.onchange = () => { U.setTrigger = st.value; renderDetail(); };
    }
    const d0 = (s) => s.actors[E.decider(s).actor];
    function previewHtml(pv) {
      if (!pv.ok) return `<div class="cc-bad">${esc(pv.error)}</div>`;
      const lines = pv.events.filter((e) => ["damage", "negate", "parry", "schedule", "effect", "miss", "announce", "fall", "slam", "terrain", "move", "resist", "note"].includes(e.kind));
      return `<div class="cc-preview"><b>Preview${pv.announced ? " (if nobody responds)" : ""}</b>
        ${pv.deltas.filter((d) => d.lf).map((d) => `<div>${esc(d.name)}: <b>−${d.lf} LF</b></div>`).join("") || ""}
        ${lines.map((e) => `<div class="cc-muted">${esc(e.text)}${(e.why || []).filter((w) => /\[/.test(w)).map((w) => `<br><i>${esc(w)}</i>`).join("")}</div>`).join("")}</div>`;
    }
    function renderParty() {
      const s = U.s, kn = s.knowledge?.player || {};
      const markup = Object.values(s.actors).map((a) => {
        if(a.category==="bystander")return `<div class="cc-member ${a.defeated?"down":""}"><div class="cc-mname"><b>${esc(a.name)}</b><span class="cc-muted">Bystander · ${a.escaped?"escaped alive":a.defeated?"lost":a.tourist.fleeing?"heading for the exit":"taking photographs"}</span></div><div class="cc-bars"><span class="cc-lbl">LF</span><span class="cc-bar"><i class="lf" style="width:${100*a.lf/a.maxLF}%"></i></span><span class="cc-num">${a.lf}/${a.maxLF}</span></div><div class="cc-muted">${a.tourist.photos.length} photos · Exit (${a.tourist.exit.join(", ")})</div></div>`;
        const k2 = kn[a.id] || { secondary: false, lens: false, abilities: {} }; const enemy = a.side === "enemy";
        const sec = !enemy || k2.secondary ? (a.secondary ? C.concepts[a.secondary]?.name || a.secondary : "—") : "???";
        const known = enemy ? Object.keys(k2.abilities || {}).map((id) => C.abilities[id]?.name || id) : null;
        const lens = !enemy || k2.lens ? Object.entries(a.lens || {}).filter(([c]) => c === a.primary || c === a.secondary).map(([c, l]) => (C.concepts[c]?.lens?.profiles[l] || C.concepts[c]?.lens?.profiles[C.concepts[c]?.lens?.default])?.name || "default").join("/") : "?";
        return `<div class="cc-member ${a.defeated ? "down" : ""} ${E.decider(s) && E.decider(s).actor === a.id ? "active" : ""}">
          <div class="cc-mname"><b style="color:${SPRITE[a.sprite] || "#e5e7eb"}">${esc(a.name)}</b><span class="cc-muted">${esc(C.concepts[a.primary]?.name || (a.notArrived ? "Arriving" : "No concept"))} + ${esc(sec)} · lens ${esc(lens)}</span>
            <span class="cc-react" title="Reaction this round">${a.reaction ? "●" : "○"}</span></div>
          <div class="cc-bars"><span class="cc-lbl">LF</span><span class="cc-bar"><i class="lf" style="width:${100 * a.lf / a.maxLF}%"></i></span><span class="cc-num">${a.lf}/${a.maxLF}</span>
            <span class="cc-lbl">ΦF</span><span class="cc-bar"><i class="pf" style="width:${100 * a.pf / Math.max(1,a.maxPF)}%"></i></span><span class="cc-num">${a.pf}/${a.maxPF}</span>${a.summon ? "" : `<span class="cc-lbl">ULT</span><span class="cc-bar"><i class="ult" style="width:${100 * a.ultimateCharge / s.rules.ultimateChargeMax}%"></i></span><span class="cc-num">${a.ultimateCharge}/${s.rules.ultimateChargeMax}</span>`}</div>
          ${!enemy ? E.emergentIdeas(s,a.id).map(idea=>`<div class="cc-muted">Emergent idea · ${esc(idea.name)} · ${E.summonProfile(s,a.id).apCost} AP per call · ${idea.effects.maxActive} summons · ${idea.effects.wardProtection} ward/turn</div>`).join("") : ""}
          ${root.ConceptCombatStatus.html(root.ConceptCombatStatus.rows(a, { showParry: !enemy || !!s.disclosures?.[a.id]?.rebound, showAmbush: !enemy, actors: s.actors, content: C }), esc, a.id)}
          ${a.status.ward?.emergentIdea ? `<div class="cc-muted">${esc(a.status.ward.label)} · ${a.status.ward.protection} remaining</div>` : ""}
          ${a.notArrived ? `<div class="cc-muted">Arrives round ${a.arrivesRound}</div>` : ""}
          ${(() => { const line = CardsUI && E.cards ? CardsUI.unitLine(E.cards.viewFor(s, controlledId(s), a.id)) : ""; return line ? `<div class="cc-muted cc-cards-line">${esc(line)}</div>` : ""; })()}
          ${a.companion ? `<div class="cc-muted">In ${esc(s.actors[a.companion.owner]?.name || "their fighter")}'s corner · leaves in ${a.companion.turnsLeft} turn${a.companion.turnsLeft === 1 ? "" : "s"}</div>` : ""}
          ${a.summon ? `<div class="cc-muted">Ally · returns in ${a.summon.turnsLeft} turns${a.summon.trueForm ? ` · True Form: ×${a.summon.trueFormPotencyMul} technique potency · +${SM?.data.summons[a.summon.key]?.trueForm?.pfRegenAdd || 0} ΦF regen` : ""}</div>${a.summon.trueForm ? trueFormSummary(a) : ""}` : ""}
          ${a.id === "player" ? `<div class="cc-charge-help">ULT: +${s.rules.ultimateChargePerConcept} per ability · +${s.rules.ultimateChargePairBonus} when alternating primary/secondary · +${s.rules.ultimateChargePairBonus} when their composition changes the move. Damage adds none.</div><div class="cc-muted">Items ${a.inventory?.length || 0}/${a.inventoryCapacity || 2}: ${(a.inventory || []).map(id => esc(Loot.data.consumables[id]?.name || W?.data.items[id]?.name || id)).join(", ") || "none"}</div>${typeof gearLine === "function" ? gearLine() : ""}` : ""}
          ${enemy ? `<div class="cc-muted cc-known">Known: ${known.length ? esc(known.join(", ")) : "nothing yet (Observe, or wait for them to act)"}</div>` : ""}
        </div>`;
      }).join("") + (s.wild || []).map(m => `<div class="cc-member"><div class="cc-mname"><b style="color:#f08b65">${esc(m.name)}</b><span class="cc-muted">Wild · ${esc(W?.data.monsters[m.kind]?.concept || "landscape process")}</span></div>${m.form === "unit" ? `<div class="cc-bars"><span class="cc-lbl">LF</span><span class="cc-bar"><i class="lf" style="width:${100 * m.lf / m.maxLF}%"></i></span><span class="cc-num">${m.lf}/${m.maxLF}</span></div>` : `<div class="cc-muted">${m.form === "field" ? `${Object.keys(m.tiles || {}).length} active tiles` : "Moving terrain effect"}</div>`}</div>`).join("");
      root.ConceptCombatStatus.replace($("ccParty"), markup);
    }
    function renderLog() {
      const s = U.s, el = $("ccLog");
      const all = Array.isArray(s.log) ? s.log : [], entries = U.reading && Number.isFinite(U.logCap) ? all.slice(0, U.logCap) : all;   // Slow pace: an AI action's lines show one at a time
      el.innerHTML = entries.length ? entries.map((e) => {
        const why = Array.isArray(e.why) ? e.why : [];
        const priv = (e.kind === "cardPlay" || e.kind === "handShown" || e.kind === "cardDeck") && E.cards ? E.cards.logFor(s, e, controlledId(s)) : null;   // Battle Cards: the private line only for who may read it
        if (e.kind === "cardDeck" && !priv) return "";
        return `<li class="k-${esc(e.kind || "event")}">${esc(priv ? priv.text : (e.text || e.kind || "Combat event"))}${why.length ? `<div class="cc-why">${why.map((w) => esc(w).replace(/\[([a-z-]+)\]/g, (_, id) => `<a href="#" data-edge="${id}">${id}</a>`)).join("<br>")}</div>` : ""}</li>`;
      }).join("") : `<li class="cc-log-empty">Waiting for the first combat event…</li>`;
      el.querySelectorAll("[data-edge]").forEach((a) => a.onclick = (ev) => { ev.preventDefault(); openGraph(a.dataset.edge); });
      el.scrollTop = el.scrollHeight;
    }
    function logText() {
      const head = `Loci ${U.s.build || "dev"} · ${U.s.encounter || "?"} · seed ${U.s.seed ?? "?"} · ${U.s.arena?.name || "?"} · round ${U.s.round}${U.s.outcome ? ` · ${U.s.outcome.winner || U.s.outcome} wins` : ""}`;
      const keys = U.s.log.filter((e) => ["arrival", "gaiaSummon", "ritual", "fieldClose", "fieldOpen", "dreamRift"].includes(e.kind) || /reinforcements arrive/i.test(e.text || ""))
        .map((e) => `R${e.round} [${e.kind}] ${e.text}`);
      return [head, ...U.s.log.map((e) => `R${e.round} ${e.text}${(e.why || []).map((w) => "\n    " + w).join("")}${e.stack ? `\n    STACK:\n    ${String(e.stack).split("\n").slice(0, 8).join("\n    ")}` : ""}`), ...(keys.length ? ["Key events:", ...keys] : [])].join("\n");
    }

    // ── post-battle ───────────────────────────────────────────────────────
    function finish() {
      Promise.resolve(opts.llmBridge?.stop?.()).catch(() => {}); U.llmConnection = null;
      if (!U.report) {
        U.report = E.report(U.s);
        // AP-01 sage wiring: the demonstration settles win or lose, practice or not. The ladder persists on the account.
        let sageLines = [];
        if (SG && U.s.outcome) { const st = SG.settleDemo(U.s.actors, U.s.outcome, (U.s.vowsKept || []).map((k) => k.actor));
          if (st) { SG.recordBattle(U.s, st.won, st.byPV);
            U.account = SG.carryDream(U.account, U.s.sageDream); saveAccount();
            const rate = SG.dreamRate({ sageDream: U.account.sageDream }), n = U.account.sageDream.battles;
            sageLines = [`Sage demonstration: ${st.winner} takes it${st.byPV ? " — the vow held, the dream demonstrated" : ""}.`,
              `The journey, measured: dream rate ${rate.toFixed(2)} across ${n}.`, st.lesson]; } }
        if(U.s.focusedDreamTest) { U.reward={xp:0,lines:["Practice battle · saved progression unchanged", ...sageLines],drops:[]}; if (U.stakeHeld || U.account.stakeEscrow) { U.account = { ...AN.refund(U.account, U.account.stakeEscrow || U.stakeHeld), stakeEscrow: null }; U.stakeHeld = null; saveAccount(); } }   // no stake settles in practice: anything staked goes home
        else {
        if (root.ConceptCombatInjury) U.account.injuries = root.ConceptCombatInjury.settle(U.s, U.account.injuries);   // wounds rest and persist (practice never settles: see the branch above)
        const defeated = Object.values(U.s.actors).filter(a => a.side === "enemy" && a.defeated && !a.noXp && !a.settledBack);   // a settled structure was not killed
        const monstersDefeated = U.s.log.filter(e => e.kind === "wildEnd" && /defeat/i.test(e.text || "")).length;
        const foughtBeside = Object.values(U.s.actors).filter(a => a.id !== "player" && a.side === "player" && !a.summon && a.character && !a.notArrived && C.characters[a.character]).map(a => a.character);   // real characters only: communed plants (plant-*) and boss bodies are not valid ally-event draws
        // Kept vows (one list for every payout): swept-kept on the player's side, plus live unbroken vows of living fighters.
        // W6.1 pays 1 discovery for each, win or lose; W4.4 adds the stipend, XP and bonus credits on a win; broken vows mark the ledger.
        const onSide = (id) => U.s.actors[id]?.side === "player", AF = root.ConceptCombatAffinity, PVR = root.CombatPvRewards;
        const keptVows = [...(U.s.vowsKept || []).filter((k) => onSide(k.actor)),
          ...Object.values(U.s.actors).filter((a) => a.side === "player" && !a.defeated && !a.summon).flatMap((a) => (a.vows || []).filter((v) => !v.broken && !(v.restrictions?.includes("rooted") && v.at && (a.x !== v.at[0] || a.y !== v.at[1]))).map((v) => ({ actor: a.id, round: v.round, consent: v.consent })))];   // a Rooted vow forced off its spot after the holder's last turn start is broken, not kept (1.3.430 audit)
        const vowsKept = keptVows.length;
        const brokenHere = (U.s.vowsBroken || []).filter((k) => onSide(k.actor)).length + Object.values(U.s.actors).filter((a) => a.side === "player").reduce((n, a) => n + (a.vows || []).filter((v) => v.broken).length, 0);
        let pv = { seeds: 0, xp: 0, credits: 0, marks: [], lines: [] };
        if (PVR) {
          const coll = PVR.collective(U.s.declarations, U.s.actors, "player"), prone = (id) => !!AF && AF.band(AF.unit(C, U.s.actors[id])) === "prone";
          const completions = U.s.outcome.winner === "player" ? keptVows.map((k) => ({ declRound: k.round, turn0: PVR.turn0 ? PVR.turn0(k.round, k.consent) : false, prone: prone(k.actor), collective: coll.has(k.actor), name: U.s.actors[k.actor]?.name })) : [];
          pv = PVR.settle(completions, brokenHere);
          if (U.s.presenceWon) pv.marks.push(U.s.presenceWon.mark || "overawed");
          if (VT && !testBattle()) VT.settleHaul(U.s, pv);   // verbs: salvage haul pays at settle (verbtech.settleHaul; codex-loci-verbs-1); test battles mint nothing, like the pens   (before the debt claim, so a debtor's haul pays the debt; 1.3.455 audit)
          if (DB) { for (const o of DB.finishOwed(U.s)) { U.account.debt = (U.account.debt || 0) + o.seeds; pv.lines.push(`Debt carried home (${o.lender}): ${o.tempo} tempo → ${o.seeds} Seeds on the ledger.`); } const cl = DB.claimStipend(U.account, pv.seeds); pv.seeds = cl.remainder; if (cl.paid) pv.lines.push(`Stipend pays debts first: ${cl.paid} Seeds to the ledger.`); }
          if (SL && testBattle()) { for (const c of SL.finishCaught(U.s)) pv.lines.push(`Sealed ${c.name}: a test battle, so nothing is penned.`); }   // after-ship audit 1.3.453: test catches sold for Seeds
          else if (SL) { for (const c of SL.finishCaught(U.s)) { (U.account.pens || (U.account.pens = [])).push({ key: c.key, name: c.name, maxLF: c.maxLF || 0, dream: !!c.dream, boss: !!c.boss, ...(c.free ? { free: true } : {}) }); pv.lines.push(`Sealed ${c.name}: penned — keep it for bead progress or sell it at the stall.`); } const debt = SL.finishDebt(U.s); if (debt > 0) { U.account.level = Math.max(1, (U.account.level || 1) - debt); pv.lines.push(`Inheritances granted: −${debt} level${debt === 1 ? "" : "s"} (permanent).`); } }   // vessel economy: catches are penned (keep for bead progress or sell at the stall); grants cost nothing until they persist (loop 1a17ca7b95d)
        }
        const showboat = (BK && U.s.outcome.winner === "player" && BK.crowdBattle(U.s.themedBattle, THB?.THEMES)) ? BK.judgeShowboat(U.s, vowsKept).total : 0;   // W6.5: crowd battles pay style on a w
        let dopeVoid = 0, dopeLines = [];   // W9.4: winners test (title bouts always; ranked/promoter when venues land); positives void the purse and the title transfer
        if (typeof CombatDoping !== "undefined" && U.s.outcome.winner === "player") {
          const venue = U.s.titleBout ? "title" : U.setupOpts?.venue || "exhibition";
          const roll = (((U.s.seed || 1) * 2654435761) >>> 0) / 4294967296;
          const dt = CombatDoping.settleWin(U.account, { venue, dose: U.s.doseRec || null, roll01: roll, purse: showboat, seed: U.s.seed });
          U.account = dt.account; U.s.dopingPositive = dt.positive; dopeVoid = dt.voidPurse; dopeLines = dt.lines;
        }
        let titleTransfer = null;   // W9.5: title-bout settle (bouts are issued by headline challenges — unbuilt; the settle is stub-ready)
        if (typeof CombatTitles !== "undefined" && U.s.titleBout && U.s.outcome.winner !== "draw") {
          const bout = U.s.titleBout, sideOf = (id) => U.s.actors[id]?.side, nameOf = (id) => U.s.actors[id]?.name || id;
          const winner = sideOf(bout.holderId) === U.s.outcome.winner ? bout.holderId : sideOf(bout.challengerId) === U.s.outcome.winner ? bout.challengerId : null;
          if (winner) {
            const r = CombatTitles.resolveDefense({ title: bout.title, holder: bout.holderId, challenger: bout.challengerId, winner, doped: !!U.s.dopingPositive });
            const lines = r.voided ? [`The ${bout.title} defense is voided: a doped bout transfers nothing. Cheaters don't inherit honor.`]
              : r.transferred ? [`${nameOf(r.holder)} takes the ${bout.title} title from ${nameOf(bout.holderId)}! The ledger writes the transfer.`]
              : [`${nameOf(bout.holderId)} holds the ${bout.title} title.`];
            titleTransfer = { gain: r.holder === "player" && bout.holderId !== "player" ? { school: bout.school, name: bout.title } : null,
              lose: bout.holderId === "player" && r.holder !== "player" ? bout.title : null, lines };
          }
        }
        let weighing = null;   // W9.3: the fallen are weighed — marks read at death, tithe and appeal ledgered (bequest application waits on W8.2)
        if (typeof CombatSinDeaths !== "undefined" && U.s.outcome.winner !== "player" && U.s.actors.player?.defeated) {
          weighing = CombatSinDeaths.weigh(U.account.marks || [], { redemptive: !!U.s.redemptiveDeath });
          weighing.seed = U.s.seed; weighing.round = U.s.round;
        }
                const boardSides = Object.fromEntries(Object.values(U.s.actors).map((x) => [x.id, x.side]));
                const boardBeaten = A.beatenIn(U.s, C.characters).map((b) => b.classId);
                const boardRecord = { winner: U.s.outcome.winner, round: U.s.round, mode: U.s.mode, beaten: boardBeaten, vowsKept,
                foughtBeside: foughtBeside.map((x) => x.id),
                escaped: Object.values(U.s.actors).filter((x) => x.side === "player" && (x.escaped || x.fled || x.leaveReason)).map((x) => x.id),
                playerStanding: !U.s.actors.player?.defeated && !U.s.actors.player?.submitted,
                playerDamaged: U.s.log.some((e) => e.kind === "damage" && boardSides[e.target] === "player" && (e.amount || 0) > 0),
                playerUlts: U.s.log.filter((e) => e.kind === "act" && boardSides[e.actor] === "player" && C.abilities[e.ability]?.tier === "ultimate").length,
                ...(A.deedsFrom ? A.deedsFrom(U.s) : {}) };   // interaction perks S0: the deed fields (persuaded, sealed, weather, verbs, cook, commune, boss)
                const boardJob = Board && U.account.board?.accepted ? (U.account.board.postings || []).find((m) => m.id === U.account.board.accepted) : null;
                const boardSeeds = boardJob ? Board.settle(boardJob, boardRecord) : 0;
                const boardRoster = () => Object.entries(C.characters).filter(([id, ch]) => id !== "warden" && id !== "police_officer" && !ch.permanentAlly && !ch.randomEventOnly && Array.isArray(ch.configs)).map(([id]) => id);
                const preNodes = (U.account.ownedNodes || []).length;
                const result = Loot.finishBattle(U.account, { winner: U.s.outcome.winner, mode: U.s.mode, scenario: SCN?.tagOf(U.s) ?? null, random: !!SCN?.isRandomBattle(U.s), arena: SCN?.arenaOf(U.s) ?? null, jackpotSeeds: E.jackpotMeter ? E.jackpotMeter(U.s) : 0, vowsKept, showboat: dopeVoid > 0 ? 0 : showboat, enemiesDefeated: defeated.filter(a => !a.monster).length, foes: defeated.filter((a) => !a.mirrorOf && !a.soulOf && !a.clone && !a.summon).map((a) => a.character).filter(Boolean),   // copies drop no relics
          monstersDefeated, correctAnswers: (U.answered?.correct ? 1 : 0) + (U.s.summonCorrectAnswers || 0), round: U.s.round, foughtBeside, royalTribute: U.s.royalTribute || null,
          pvSeeds: pv.seeds, pvXp: pv.xp, pvCredits: pv.credits, pvMarks: pv.marks, pvLines: pv.lines, boardSeeds, titleTransfer, weighing, dopeLines, convertMarks: U.s.convertMarks || [], fragments: U.s.fragments || [] },
          { seed: U.s.seed, biome: U.s.arena?.biome || null, stakes: U.s.stakes?.state === "agreed" ? { ...U.s.stakes, held: U.stakeHeld } : null });
        U.account = { ...result.account, stakeEscrow: null }; U.reward = result; U.stakeHeld = null;   // the escrow is settled by finishBattle
        if (!testBattle()) U.account = root.ConceptCombatKeeperMemory?.noteBattle(U.account, { encounter: U.s.encounter, winner: U.s.outcome.winner }) || U.account;   // Rama remembers the Town Hall encounter you lost (npc/keepers.js rematch)
        if (U.packedVessels && SL && U.s.vessels) { SL.returnPouch(U.account.vessels || (U.account.vessels = { shard: 0, bead: 0, orb: 0 }), U.s.vessels); U.packedVessels = false; }   // vessel economy: unspent pouch vessels go home (packed battles only; thin-air pouches dissolve)
        if (root.ConceptCombatFruit && !testBattle() && !U.practiceBattle) { const hp = U.s.actors[U.s.modeSetup?.hero || "player"], ff = root.ConceptCombatFruit.settleFeats(U.account, { feats: U.s.fruitFeats || [], shapes: U.s.fruitShapes || [], won: U.s.outcome.winner === "player", shaped: !!(hp?.status?.hideShape && hp.status.hideShape.expiresAt > hp.ownerTurns), drained: !!U.s.fruitDrained, struck: !!U.s.fruitStruck }); U.account = ff.account; U.reward.lines.push(...ff.lines); }   // Sinkerfruit respec S1a: feats count in real battles only (off unless FR.RULES.respec)
        if (root.ConceptCombatFruit && !testBattle()) { const fs = root.ConceptCombatFruit.settleFruit(U.account, { hunterDown: !!(U.s.actors.hunter && U.s.actors.hunter.defeated), hunterName: U.s.actors.hunter?.name || "a hunter", lost: U.s.outcome.winner !== "player", submitted: !!U.s.actors.player?.submitted, bossesDown: !U.practiceBattle && U.s.outcome.winner === "player" ? Object.values(U.s.actors).filter((u) => u.boss && u.defeated && u.side !== "player").length : 0 }); U.account = fs.account; U.reward.lines.push(...fs.lines); }   // OP1 §6-8: installments share today's tally (stall first), then the purse, the claim, the raise
        if (MK && !testBattle()) { const mt = MK.tickMarket(U.account, { won: U.s.outcome.winner === "player" }); U.account = mt.account; U.reward.lines.push(...mt.lines); }   // vessel economy: the market-day turns on real battles (parts inflow, floods reset, campaign ticks, orders refresh)
        if (root.ConceptCombatFruit && U.s.actors.rival?.fruit && !testBattle() && !U.practiceBattle) { const rs = root.ConceptCombatFruit.settleRival(U.account, { fruit: U.s.actors.rival.fruit.id, defeated: root.ConceptCombatFruit.rivalBeaten(U.s.actors.rival, U.s.actors), won: U.s.outcome.winner === "player", seed: U.s.seed }); U.account = rs.account; U.reward.lines.push(...rs.lines); }   // Sinkerfruit respec S4b: beat the rival, maybe win its fruit (account/fruit.js)
        if (root.ConceptCombatFruit) { const fd = root.ConceptCombatFruit.afterBattle(U.account, { won: U.s.outcome.winner === "player", test: testBattle(), seed: U.s.seed, abroad: U.s.actors.rival?.fruit?.id || null }); if (fd.dropped) { U.account = fd.account; U.reward.lines.push(fd.line); } }   // Sinkerfruit: a won battle can surface a pooled fruit (account/fruit.js)
        if (root.ConceptCombatOrders && !testBattle() && !U.practiceBattle) { const so = root.ConceptCombatOrders.settleOrders(U.account, U.s); U.account = so.account; U.reward.lines.push(...so.lines); }   // talk orders: trust + respect write home (practice saves nothing)
        if (sageLines.length) U.reward.lines.push(...sageLines);
        if (U.account.burn) U.reward.lines.push(`Red Ink's blowback: ${U.account.burn} LF burns at the start of your next battle, win or lose.`);   // W9.4: paid at the next battle's start (see the battle-start hook)
        if (typeof CombatSagas !== "undefined") {   // W9.6: sagas read the account and write the spine (close is declared in the Field Kit: sagaCard)
          const pr = CombatSagas.progress(U.account, { keptVows: vowsKept, newNodes: Math.max(0, (U.account.ownedNodes || []).length - preNodes), seed: U.s.seed });
          U.account = pr.account; U.reward.lines.push(...pr.lines);
        }
        // Victory ledger (account.js): a real win records the classes beaten. Practice and test setups never reach here
        // (focusedDreamTest above); a battle the AI played for you, or a labelled test or playground, does not count either.
        if (!testBattle()) {   // one definition of a test battle (1.3.458 audit)
          const won = A.recordVictories(U.account, A.beatenIn(U.s, C.characters), { mode: U.s.mode, encounter: U.s.encounter, round: U.s.round, seed: U.s.seed });
          U.account = won.account; U.reward.lines.push(...won.lines);
          if (A.noteDeeds) { const dd = A.noteDeeds(U.account, boardRecord, { test: testBattle() }); U.account = dd.account; U.reward.lines.push(...dd.lines); }   // interaction perks S0: deeds, real battles only
          if (Board && boardJob) {
            const bv = Board.verify(boardJob, boardRecord);
            if (bv.ok) { U.account.board.accepted = null; U.account.board.done = (U.account.board.done || 0) + 1; if (A.noteDeeds) U.account = A.noteDeeds(U.account, { boardJobs: 1 }).account; }   // perks S0: a finished Board job is a deed
            U.reward.lines.push(bv.ok ? `Contract complete: ${Board.describe(boardJob)}.` : `Contract open: ${Board.describe(boardJob)} — ${bv.reason}`);
          }
          if (Board) U.account = Board.refresh(U.account, { seed: U.s.seed, roster: boardRoster() });
          if (LB && U.s.legacy) {   // cultural legacy: traditions performed grow, idle ones decay, notes fill the journal, new patterns may be founded
            const boss = U.s.outcome.winner === "player" ? Object.values(U.s.actors).find((u) => u.boss && u.defeated) : null;
            const st = LB.settle(U.account.legacy, U.s, { battle: U.s.legacy.battle, hero: "player", heroName: U.s.actors.player?.name || "you", successionClaim: boss ? boss.name : null, C });
            U.account.legacy = st.legacy; U.reward.lines.push(...st.lines); U.reward.legacyOffers = st.offers.map((o) => ({ ...o, done: false }));
          }
          const met = A.recordEmissary(U.account, A.emissaryMet(U.s)); U.account = met.account; U.reward.lines.push(...met.lines);
          if (U.s.encounter === "escapeShip" && U.s.outcome.winner === "player" && !A.formsOf(U.account).includes("symbiote")) { U.account = A.addForms(U.account, ["symbiote"]); U.reward.lines.push("Unlocked: the Symbiote. Break it from Gear in any later battle."); }   // Visitors P2: escape the ship, keep the hunger
          { const ch = U.s.actors.player?.character, taught = A.formsTaughtIn?.(U.s, BOSS?.data?.learnedForms?.teach, BOSS?.data?.orbs) || [];   // learned forms: forever, on this character
            const fresh = taught.filter((id) => !A.learnedFormsOf(U.account, ch).includes(id));
            if (ch && fresh.length) { U.account = A.learnForms(U.account, ch, fresh); U.reward.lines.push(`Learned: ${fresh.map((id) => BOSS.formFor(id)?.[1]?.form || id).join(", ")}. Hold it from Gear in any battle.`); } }
          { const made = A.addFriends(U.account, A.friendsMadeIn(U.s)); U.account = made.account;   // a tamed Sasquatch remembers you (engine/tamer.js friendRound)
            if (made.fresh.length) U.reward.lines.push("The Sasquatch remembers you. Some day, when you need it, it may come."); }
          const fell = A.orbsWonIn(U.s);   // the Brain Chip: one for each transcended AGI that fell, kept only on a win
          if (fell.length) { U.account = A.addOrbs(U.account, fell); U.reward.lines.push(`Kept: ${fell.length > 1 ? `${fell.length} Brain Chips` : "the Brain Chip"}. Break it from Gear in your next battle.`); }
          { const orb = SW?.orbWon?.(U.s) || SN?.orbWon?.(U.s); if (orb) { U.account = A.addOrbs(U.account, [orb]); if (SN?.orbWon?.(U.s)) U.account = A.addSecret(U.account, SN.ENCOUNTER); U.reward.lines.push(`Kept: ${BOSS?.data?.orbs?.[orb]?.name || orb}. Break it from Gear in your next battle.`); } }   // a Secret Warrior win keeps that fight's orb, as a boss rush win does
        }
        if (U.s.bossRush && BR && U.rush && !U.rushOutcome) {   // boss rush: the boss's orb, the next fight, or the record
          const out = BR.afterBattle(U.rush, U.s); U.rushOutcome = out; U.rush = out.run;
          if (out.orb && out.orb !== "brainChip") { U.account = A.addOrbs(U.account, [out.orb]); U.reward.lines.push(`Kept: ${BR.orbName(out.orb)}.`); }   // the Brain Chip was kept above
          if (out.result === "next") U.reward.lines.push(`Boss rush: ${out.run.index} of ${out.run.ids.length} down. Next: ${BR.current(out.run)?.name || "?"}.`);
          else {
            U.account = BR.record(U.account, out.run, out.result);
            U.reward.lines.push(out.result === "cleared" ? `${out.badge}: every Omega threat fell.` : `Boss rush over: ${out.run.fell.length} of ${out.run.ids.length} fell; ${BR.list().find(e => e.id === out.run.stoppedBy)?.name || "the next one"} stopped the run.`);
          }
        }
        { const BS = root.ConceptCombatBeadSwallow; if (BS) U.reward.lines.push(...BS.captureLines(U.setupOpts?.beads || [], U.account.beads || [], U.account)); }   // a captured bead says where its creature's tracker stands
        if (GB) { const regard = GB.settle(U.account, GB.eventsFrom(U.s)); U.account = regard.account; U.reward.lines.push(...regard.lines); }
        if (SCH) { const k = SCH.earnKeys(U.account, SCH.proofsFrom({ ...U.s, crowdBattle: !!(BK && BK.crowdBattle(U.s.themedBattle, THB?.THEMES)) }, U.account, C)); U.account = k.account; U.reward.lines.push(...k.lines); }   // W8.4: what this battle proved opens a school's gate, once
        if (IM && INS) { const im = IM.settle(U.account, (U.s.imitated || []).filter((e) => e.actor === "player"), (t) => INS.data.imitateDifficulty(t) || 1, (t) => INS.data.traits[t]?.name || t); U.account = im.account; U.reward.lines.push(...im.lines); }   // Imitate: copies age, practice accrues   // Gaia's regard (account/gaia-bond.js)
        saveAccount();
        const before = U.profile; U.progress = E.progress(before, result.xp);
        U.profile = { xp: U.account.xp, level: U.account.level }; if (!U.testSnapshot) store.set(PROFILE_KEY, U.profile);
        }
      }
      if (!U.s.focusedDreamTest && params.campaign && !U.campaignSaved) {
        U.campaignSaved = true;
        U.campaignResult = opts.onCampaignFinish?.({ state: U.s, report: U.report, account: U.account, reward: U.reward }) || null;
        if (U.campaignResult?.item) {
          const granted = Loot.grantCampaignItem(U.account, U.campaignResult.item);
          U.account = granted.account; U.campaignResult.itemGranted = granted.ok;
          if (!granted.ok) U.campaignResult.itemMessage = granted.message;
          else { U.reward.lines.push(`Campaign reward: ${granted.name}`); saveAccount(); }
        }
      }
      // Record the campaign result before opening the victory narration. The
      // narration's Continue callback renders the report directly; if campaign
      // completion were deferred until another finish() call, its next-scene
      // handoff would never be created and the report could only say “Return”.
      const cueSilent = !!U.testSnapshot || testBattle();   // test, autoplay, steps and playground battles stay silent (Jinki cues pre-screen)
      if (U.testSnapshot && U.report) {   // the settle has run: show what it would have paid, keep nothing
        endTestBattle();
        if (U.reward?.lines) U.reward.lines.unshift("Test battle: nothing was saved. Your account is as it was before the fight.");
      }
      const cueKey = `${U.s?.receiptId || "-"}:${U.s?.seed}:${U.s?.outcome?.round}`;   // once per result, even if finish() rebuilds U.reward
      const playRewardCues = () => { if (Tracks && U.reward && !cueSilent && U.cuedResult !== cueKey) { U.cuedResult = cueKey; for (const c of (U.reward.cues || [])) Tracks.cue(c.slot, c.opts || {}); } };   // Jinki cues sound once, when the result lands
      if (!U.narrationResultDone) {
        U.narrationResultDone = true;
        openNarration("result", () => { U.mode = "over"; render(); playRewardCues(); });
        return;
      }
      U.mode = "over";
      render();
      playRewardCues();
      if (U.rushOutcome?.result === "cleared" && !U.rushOutcome.scenePlayed) {   // the clear: a text scene in the arrival layout
        U.rushOutcome.scenePlayed = true; const me = U.s.actors.player;
        if (me) openAttackPopup([{ kind: "farewell", unit: { ...me }, name: "Boss rush", line: `${U.rushOutcome.badge}.`, pose: "idle", timeline: { doubt: 300, turn: 850 }, ms: TEXT_SCENE_MS }]);
      }
    }
    // The boss rush's battle-over buttons (docs/boss-rush.md): Continue fighting after a win with another threat left;
    // after a loss or the clear, only Back to the main menu. null outside the rush.
    function rushButtons(s) {
      if (!s.bossRush || !BR || !U.rush) return null;
      const out = U.rushOutcome || BR.afterBattle(U.rush, s);
      return out.result === "next" ? `<button type="button" class="cc-item" data-cmd="rushNext">Continue fighting · next: ${esc(BR.current(out.run)?.name || "")}</button>`
        : `<button type="button" class="cc-item" data-cmd="menu">Back to the main menu</button>`;   // Concept Combat's own menu, not the Loci home (Mala, 2026-10-26)
    }
    // The abduction chain (Visitors P2): a taken player wakes in the brig. Only the player's own
    // capture chains; anyone else's abduction is just a loss on the manifest.
    function abductionButtons(s) {
      if (!s.abduction || s.abduction.victim !== "player" || s.encounter === "escapeShip") return null;
      return `<button type="button" class="cc-item" data-cmd="escapeShip">Wake in the brig · escape the ship →</button>`;
    }
    function reportHtml() {
      const r = U.report, tr = U.campaignResult?.transfer || C.encounters[U.s.encounter]?.transfer || (U.s.encounter === SN?.ENCOUNTER ? SN.transfer : null); if (!r) return "";   // a mode-built battle (secretWarrior, bossRush) has no encounters entry
      const title = r.outcome.winner === "player" ? "Victory" : r.outcome.winner === "wild" ? "Wild victory" : r.outcome.winner === "enemy" ? "Enemy victory" : "Draw";
      const sealedEnd = U.s.encounter === SN?.ENCOUNTER ? SN.ending?.(U.s) : "";
      const nextSceneTitle = ({ courtyard: "The Hearing", lastVerdict: "The Last Verdict" })[U.campaignResult?.nextScene];
      const campaignContinueLabel = nextSceneTitle ? `Next Vignette: ${nextSceneTitle} →` : "Return to campaign";
      return `<div class="cc-title">${title} in ${r.rounds} rounds</div>
        ${r.decisive ? `<div><b>Decisive interaction:</b> ${esc(r.decisive.id)} (${esc(r.decisive.type)}). ${esc(r.decisive.example)}</div>` : ""}
        ${r.missed.length ? `<div><b>Missed opportunity:</b> ${esc(r.missed[0])}</div>` : ""}
        <div class="cc-muted">${U.reward ? U.reward.lines.map(esc).join(" · ") : `+${r.xpGain} XP`} · Level ${U.account.level}</div>
        ${U.reward?.drops?.length ? `<div class="cc-muted">Rewards: ${U.reward.drops.map(d => esc(Loot.data[d.kind === "equipment" ? "equipment" : "consumables"][d.id]?.name || d.id)).join(", ")}</div>` : ""}
        ${sealedEnd ? `<section class="cc-campaign-outcome"><b>What the table records</b><p>${esc(sealedEnd)}</p></section>` : ""}
        ${U.campaignResult?.text ? `<section class="cc-campaign-outcome"><b>What the hearing records</b><p>${esc(U.campaignResult.text)}</p>${U.campaignResult.itemMessage ? `<p class="cc-muted">${esc(U.campaignResult.itemMessage)}</p>` : ""}</section>` : ""}
        ${params.campaign ? `<section class="cc-campaign-outcome"><b>${nextSceneTitle ? `Next vignette: ${esc(nextSceneTitle)}` : "Campaign progress saved"}</b><p>${nextSceneTitle ? "Continue to its setup to choose your approach and preparation interval." : "Return to the campaign screen to review your result."}</p><button class="cc-primary" type="button" id="ccCampaignContinue">${esc(campaignContinueLabel)}</button></section>` : ""}
        ${U.reward?.legacyOffers?.length ? `<section class="cc-legacy-offers"><b>A pattern took shape</b> <span class="cc-muted">Found it as a tradition for 1 Inspiration (you have ${U.account.inspiration || 0}). Traditions grow each battle you perform them, and fade when you don't.</span>
          ${U.reward.legacyOffers.map((o, i) => `<button type="button" class="cc-item" data-found="${i}" ${o.done || (U.account.inspiration || 0) < 1 ? "disabled" : ""}>${o.done ? "Founded" : "Found"}: ${esc(o.name)}</button>`).join("")}</section>` : ""}
        ${(U.s.postcards || []).map((card) => `<section class="cc-report-postcard"><b>Postcard from the Tourist · ${esc(card.quality)}</b><p class="cc-muted">${esc(card.message)} ${card.photoCount} distinct photos.</p>${postcardPhotos(card)}</section>`).join("")}
        <button type="button" id="ccOpenAccount">Manage gear & stash</button>
        ${U.teachMode && (U.teach.asked || U.teach.wisdom) ? `<div class="cc-teach-tally"><b>Teach mode</b> Inquiries answered ${U.teach.right} of ${U.teach.asked} · Wisdom heard ${U.teach.wisdom}</div>` : ""}
        ${tr ? `<div class="cc-transfer"><b>Transfer check</b> <span class="cc-muted">(scored separately from who won)</span><p>${esc(tr.question)}</p>
        ${tr.choices.map((c) => `<button type="button" class="cc-item ${U.answered && U.answered.response === c.id ? (c.correct ? "good" : "badc") : ""}" data-ans="${c.id}" ${U.answered ? "disabled" : ""}>${esc(c.text)}</button>`).join("")}
        ${U.answered ? `<p class="${U.answered.correct ? "cc-good" : "cc-bad"}">${U.answered.correct ? "Correct" : "Not quite"}: ${esc(U.answered.feedback)}</p>
          <div class="cc-muted">Learning: ${U.answered.correct ? "correct" : "misconception"} · Tactics: ${esc(U.answered.tacticalOutcome)}. Rubric: ${esc(tr.rubric.correctness)}; ${esc(tr.rubric.boundary)}.</div>` : ""}</div>` : ""}`;
    }
    function bindReport(el) {
      el.querySelector("#ccOpenAccount")?.addEventListener("click", showAccount);
      el.querySelectorAll("[data-found]").forEach((b) => b.addEventListener("click", () => {   // found a tradition: 1 Inspiration
        const o = U.reward?.legacyOffers?.[+b.dataset.found]; if (!o || o.done || (U.account.inspiration || 0) < 1 || !LB) return;
        const r = LB.found(U.account.legacy, o, { heroName: U.s.actors.player?.name || "you", battle: U.s.legacy?.battle });
        if (!r.ok) return;
        U.account.legacy = r.legacy; U.account.inspiration = (U.account.inspiration || 0) - 1; o.done = true; saveAccount();
        b.textContent = `Founded: ${o.name}`; b.disabled = true;
        if ((U.account.inspiration || 0) < 1) el.querySelectorAll("[data-found]").forEach((x) => { x.disabled = true; });
      }));
      el.querySelector("#ccCampaignContinue")?.addEventListener("click", () => opts.onCampaignContinue?.());
      el.querySelectorAll("[data-ans]").forEach((b) => b.onclick = () => {
        const r = E.answerTransfer(U.s, b.dataset.ans, U.campaignResult?.transfer || null); if (!r.ok) return;
        U.s = r.state; U.answered = r.record;
        if (!U.s.focusedDreamTest && !U.wasTestBattle && r.record.correct && !U.reward?.learningPaid) {   // a test battle pays no learning either
          const learned = A.awardLearning(U.account, 1); U.account = learned.account;
          U.reward.learningPaid = true; U.reward.xp += learned.xp; U.reward.lines.push(...learned.lines); saveAccount();
          U.profile = { xp: U.account.xp, level: U.account.level }; if (!U.testSnapshot) store.set(PROFILE_KEY, U.profile);
        }
        renderDetail();
      });
    }

    // ── concept map (spec §4 diagram) ─────────────────────────────────────
    function openGraph(edgeId) {
      if (edgeId) { U.graph.edge = edgeId; U.graph.kind = C.composition.some((e) => e.id === edgeId) ? "composition" : "opposition"; }
      $("ccGraph").hidden = false; renderGraph();
    }
    function renderGraph() {
      const G = U.graph, el = $("ccGraph");
      const { nodes, width, height } = graphLayout(C.concepts);
      const edges = (G.kind === "opposition" ? C.opposition : C.composition).filter((e) => G.unknown || e.status !== "unknown");
      const pairCount = {};
      const paths = edges.map((e) => {
        const pk = [e.source, e.target].join(">"); const n = (pairCount[pk] = (pairCount[pk] || 0) + 1);
        if (!nodes[e.source] || !nodes[e.target]) return "";
        const [x1, y1] = nodes[e.source], [x2, y2] = nodes[e.target];
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
        const bend = 26 + (n - 1) * 30, cx = mx - dy / L * bend, cy = my + dx / L * bend;
        // shorten to node radius
        const t0 = 34 / L, t1 = 1 - 34 / L;
        const q = (t) => [(1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2, (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2];
        const [sx, sy] = q(t0), [ex, ey] = q(t1), [lx, ly] = q(0.5);
        const col = EDGE_COLOR[e.type] || "#aaa";
        return `<g class="cc-gedge ${G.edge === e.id ? "on" : ""}" data-edge="${e.id}">
          <path d="M${sx},${sy} Q${cx},${cy} ${ex},${ey}" stroke="${col}" ${e.status === "unknown" ? 'stroke-dasharray="5 5"' : e.status === "none" ? 'stroke-dasharray="2 4"' : ""} marker-end="url(#ah-${e.type})"/>
          <text x="${lx}" y="${ly}" fill="${col}">${e.type}</text></g>`;
      }).join("");
      const types = [...new Set(edges.map((e) => e.type))];
      const conceptPools = Object.entries(C.characters).filter(([id, ch]) => id !== "warden" && ch.configs?.length);
      const sel = edges.find((e) => e.id === G.edge) || null;
      el.innerHTML = `<div class="cc-ghead"><b>Concept map</b>
          <button type="button" data-kind="opposition" class="${G.kind === "opposition" ? "on" : ""}">Against each other</button>
          <button type="button" data-kind="composition" class="${G.kind === "composition" ? "on" : ""}">Beside each other</button>
          <label class="cc-check"><input type="checkbox" id="ccUnk" ${G.unknown ? "checked" : ""}> show unknown</label>
          <span class="cc-spacer"></span><button type="button" id="ccGClose">✕</button></div>
        <svg viewBox="0 0 ${width} ${height}" class="cc-svg" role="img" aria-label="${G.kind === "opposition" ? "Directed concept opposition map" : "Ordered concept composition map"}"><defs>${types.map((t) => `<marker id="ah-${t}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${EDGE_COLOR[t] || "#aaa"}"/></marker>`).join("")}</defs>
          ${paths}
          ${Object.entries(nodes).map(([id, [x, y]]) => id === "*" ? (G.kind === "opposition" ? `<g class="cc-gnode"><circle cx="${x}" cy="${y}" r="30" fill="#2a2733" stroke="#5a5466"/><text x="${x}" y="${y + 4}">any line</text></g>` : "")
            : `<g class="cc-gnode"><circle cx="${x}" cy="${y}" r="32" fill="#1c1a21" stroke="${C.concepts[id].color}" stroke-width="3"/><text x="${x}" y="${y + 4}">${C.concepts[id].name.replace("Alternate ", "Alt. ")}</text></g>`).join("")}
        </svg>
        <div class="cc-groster"><b>Character concept pools</b><div>${conceptPools.map(([id, ch]) => `<span title="${esc(ch.configs.map(x => x.label).join(" · "))}"><strong>${esc(ch.name)}</strong> · ${esc([...new Set(ch.configs.flatMap(x => [x.primary, x.secondary].filter(Boolean)))].map(c => C.concepts[c]?.name || c).join(", "))}</span>`).join("")}</div></div>
        <div class="cc-inspect">${sel ? `<b>${esc(sel.id)}</b> <span class="cc-muted">${esc(C.concepts[sel.source].name)} → ${esc(sel.target === "*" ? "any opposing line" : C.concepts[sel.target].name)} · ${esc(sel.type)} · ${esc(sel.status)}</span>
          <div><b>Conditions:</b> ${sel.conditions.length ? esc(sel.conditions.join("; ")) : "—"}</div>
          <div><b>Operation:</b> ${esc(JSON.stringify(sel.op))}</div>
          <div><b>Exceptions:</b> ${sel.exceptions.length ? esc(sel.exceptions.join(" ")) : "—"}</div>
          <div><b>Example:</b> ${esc(sel.example)}</div>
          ${sel.status === "unknown" ? `<div class="cc-muted">Unknown is not the same as "no interaction": nothing has been authored, so the engine invents no effect.</div>` : ""}`
          : `<span class="cc-muted">Arrows point from the acting concept to the one it acts on. Edges are directed: the reverse is never inferred. Click an arrow to inspect it. Dashed = unknown, dotted = known absence.</span>`}</div>`;
      el.querySelectorAll("[data-kind]").forEach((b) => b.onclick = () => { G.kind = b.dataset.kind; G.edge = null; renderGraph(); });
      el.querySelectorAll("[data-edge]").forEach((p) => p.onclick = () => { G.edge = p.dataset.edge; renderGraph(); });
      el.querySelector("#ccUnk").onchange = (e) => { G.unknown = e.target.checked; renderGraph(); };
      el.querySelector("#ccGClose").onclick = () => { el.hidden = true; };
    }

    // ── input ─────────────────────────────────────────────────────────────
    function tileFromEvent(ev) { const r = cv.getBoundingClientRect(); return tileFromPoint(ev.clientX - r.left, ev.clientY - r.top); }
    function tileFromPoint(mx, my) {
      if (!U.s) return null;
      if (isoCam) {
        // Isometric board: a fighter's body answers for its own tile (it stands over the tile behind it); otherwise
        // the frontmost ground under the pointer.
        let body = null;
        for (const a of [...Object.values(U.s.actors).filter((a) => !a.defeated && !a.notArrived), ...(U.s.wild || []).filter((m) => m.form === "unit")]) {
          const [cx, cy] = centre(a.x, a.y);
          if (Math.abs(mx - cx) <= geo.tw * .2 && my <= cy && my >= cy - geo.tw * .5 && (!body || isoCam.near(a.x, a.y) > isoCam.near(...body))) body = [a.x, a.y];
        }
        return body || isoCam.pick(mx, my);
      }
      let best = null, score = Infinity;
      for (let y = 0; y < U.s.arena.h; y++) for (let x = 0; x < U.s.arena.w; x++) {
        if (!viewXY(x, y)) continue;   // the void and the other tab's region are never picked
        const [cx, cy] = centre(x, y), dx = Math.abs(mx - cx), dy = Math.abs(my - cy);
        if (dx > geo.tw / 2 || dy > geo.th / 2) continue;
        const q = dx / geo.tw + dy / geo.th; if (q < score) { score = q; best = [x, y]; }
      }
      return best;
    }
    function tipFor(t) {
      const s = U.s; if (!t) return "";
      if (unseen(t[0], t[1])) return "Unseen";
      const a = E.geometry.actorAt(s, ...t), b = E.geometry.barrierAt(s, ...t), tile = E.geometry.tileAt(s, ...t);
      const parts = [`(${t[0]},${t[1]}) ${tile.name}${tile.blocksMove ? " · blocks movement" : ""}${tile.blocksSightAtHeight >= 3 && tile.cover >= 1 ? " · full line cover" : tile.blocksSightAtHeight ? ` · sight profile ${tile.blocksSightAtHeight}` : " · sight passes"}`];
      parts.push(`Height ${E.geometry.heightAt(s, ...t)} · move cost ${tile.moveCost}${tile.cover ? ` · ${Math.round(tile.cover * 100)}% cover` : ""}${tile.hazard ? ` · ${tile.hazard} LF entry hazard` : ""}${tile.tpz ? " · TPZ protected" : ""}`);
      if (Climate && s.weatherState) {
        const placeKey = s.placeObservation?.key, deck = placeKey && s.insight?.decks?.[placeKey], know = placeKey && s.insight?.knowledge?.player?.[placeKey];
        const grants = deck && know ? Climate.grantsFrom(deck, know) : {};
        const state = s.dreamSpace?.weather ? Climate.effective(s.weatherState, s.dreamSpace) : Climate.sky(s), local = Climate.microclimate(s.arena, state).at(t[0], t[1]);
        const visible = Climate.visibleMicro(local, grants), tags = Object.entries(visible || {}).filter(([name, value]) => name !== "x" && name !== "y" && value).map(([name]) => Climate.data.micro[name]?.name || name);
        if (tags.length) parts.push(`Environment: ${tags.join(" · ")}`);
      }
      const pickup = (s.arena.pickups || []).find(q => q.x === t[0] && q.y === t[1]);
      if (pickup) { const p = pickupPresentation(pickup.item), info = PK?.sources?.[pickup.item]; parts.push(`Field pickup: ${p.name} · ${info?.text || "Step here to collect it."}`); }
      if (controlledFighter(s)?.passives?.revealCliffIntegrity) {
        const cliff = S?.cliffInfo?.(s.arena, t[0], t[1]);
        if (cliff) parts.push(`Soil probe: cliff integrity ${Math.max(0, cliff.integrity - cliff.damage)}/${cliff.integrity} · fall ${cliff.drop} · direction ${cliff.dir.join(",")}`);
      }
      if (b?.coverFraction > 0) parts.push(`${s.actors[b.owner].name}'s Berm · partial cover (${Math.round(b.coverFraction * 100)}% line-damage reduction)`);
      else if (b) parts.push(`${s.actors[b.owner].name}'s Shield Wall · protection ${Math.round(b.protection)}`);
      // Hover card (insight/hover.js): public condition + everything you've seen or Observed about this unit.
      const HC = root.ConceptCombatHover;
      const wildHere = !a && (s.wild || []).find((m) => m.form === "unit" && m.lf > 0 && m.x === t[0] && m.y === t[1]);   // wild animals card too (Muse, 2026-10-15)
      const card = (a || wildHere) && HC ? HC.html(HC.knownCard(s, (a || wildHere).id, { viewer: "player", content: C, insight: INS, monsters: root.ConceptCombatEnemyDreams, wild: W?.data?.monsters, stance: a ? E.stance(s, "player", a.id) : null, hostileSides: a ? E.hostileSides(s, a.id) : null }), esc) : "";
      if (a && !card) parts.push(`${a.name} · LF ${a.lf}/${a.maxLF} · ΦF ${a.pf}`);
      if (AU) for (const o of Object.values(s.actors)) if (o.aura && !o.defeated && (o.aura.imbued || E.geometry.dist(s, o.x, o.y, ...t) <= AU.rules.radius + (o.aura.radiusAdd || 0))) {   // Auras: rings are visible, so public
        const pr = AU.profileFor(o.aura.concept); parts.push(`◌ Inside ${o.name}'s ${pr.name} (stage ${o.aura.stage}/4) · ${pr.text}`);
      }
      for (const ev of s.scheduled) if (ev.inst.tiles && ev.inst.tiles.some((q) => k(q) === k(t))) parts.push(`⏱ ${ev.inst.name} lands at ${s.actors[ev.trigger.actor].name}'s turn start`);
      return parts.map(esc).join("<br>") + card;
    }
    function setHover(t, ev) {
      U.hover = t; if (t) U.cursor = t;
      const tip = $("ccTip");
      if (t && ev) { tip.hidden = false; tip.innerHTML = tipFor(t); const r = cv.getBoundingClientRect(); tip.style.left = (ev.clientX - r.left + 14) + "px"; tip.style.top = (ev.clientY - r.top + 14) + "px"; }
      else tip.hidden = true;
      draw(); if (U.mode === "target") renderDetail();
    }
    cv.addEventListener("mousemove", (ev) => {
      if (pan.drag) {   // a drag pans the board; the click it ends with is swallowed below
        U.panX = pan.x0 + ev.clientX - pan.mx0; U.panY = pan.y0 + ev.clientY - pan.my0;
        if (Math.abs(ev.clientX - pan.mx0) + Math.abs(ev.clientY - pan.my0) > 4) { pan.moved = true; manualCam(); }
        if (!pan.queued) { pan.queued = true; requestAnimationFrame(() => { pan.queued = false; if (pan.drag || pan.moved) { layout(); draw(); } }); }   // one rebuild a frame: iso cameras cost
        return;
      }
      const t = tileFromEvent(ev); if (!U.hover || !t || k(t) !== k(U.hover)) setHover(t, ev); else { const tip = $("ccTip"); const r = cv.getBoundingClientRect(); tip.style.left = (ev.clientX - r.left + 14) + "px"; tip.style.top = (ev.clientY - r.top + 14) + "px"; } });
    cv.addEventListener("mouseleave", () => { pan.drag = false; setHover(null); });
    const pan = { drag: false, moved: false, mx0: 0, my0: 0, x0: 0, y0: 0 };
    cv.addEventListener("mousedown", (ev) => { if (ev.button === 0 && U.s) { pan.drag = true; pan.moved = false; pan.mx0 = ev.clientX; pan.my0 = ev.clientY; pan.x0 = U.panX; pan.y0 = U.panY; } });
    const endPan = () => { pan.drag = false; };
    document.addEventListener("mouseup", endPan);
    cv.addEventListener("wheel", (ev) => {
      if (!U.s) return;   // over the board, the wheel always zooms; anywhere else the page keeps it
      ev.preventDefault();
      const r = cv.getBoundingClientRect(); manualCam();
      zoomAt(ev.clientX - r.left, ev.clientY - r.top, U.zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12));
    }, { passive: false });
    cv.addEventListener("click", (ev) => {
      if (pan.moved) { pan.moved = false; return; }   // that click was a pan, not a tile choice
      if (U.narrationHold || U.closeup) return;
      const t = tileFromEvent(ev); if (!t || !U.s || U.s.outcome) return;
      // A self-cast: a click on yourself casts it. The sprite stands over the tile behind its feet, so a click within one
      // tile of you counts; the tile sent is always your own.
      if (U.mode === "target" && U.sel && U.sel.self) { const p = controlledFighter(U.s); if (Math.max(Math.abs(t[0] - p.x), Math.abs(t[1] - p.y)) <= 1) commitAt([p.x, p.y]); return; }
      if (["move", "press", "jump", "climb", "target", "response"].includes(U.mode)) commitAt(t);
      else unitInfoAt(t);                                    // not choosing a tile: a click opens the unit window
    });
    // While a click is choosing a tile, right-click still opens the unit window.
    cv.addEventListener("contextmenu", (ev) => {
      if (U.narrationHold || U.closeup || !U.s) return;
      const t = tileFromEvent(ev); if (!t) return;
      ev.preventDefault(); unitInfoAt(t);
    });
    function flashTip(msg) {
      const tip = $("ccTip"); tip.hidden = false; tip.innerHTML = `<b class="cc-bad">${esc(msg)}</b>`; tip.style.left = "16px"; tip.style.top = "12px";
      clearTimeout(flashTip.t); flashTip.t = setTimeout(() => { tip.hidden = true; }, 2200);
    }
    function onKey(e) {
      if (!host.isConnected || host.closest("[hidden]")) return;
      if (e.target.closest(".cc-agent-controls")) return;
      if (decisionInspectorPanel && !decisionInspectorPanel.hidden) {
        if (e.key === "Escape") { e.preventDefault(); decisionInspectorPanel.hidden = true; decisionInspectorButton?.focus(); }
        return;
      }
      if (e.target.closest(".emissary-inspector")) return;
      if (U.closeup) { if(e.key==="Escape"||e.key===" "||e.key==="Enter") {e.preventDefault();if(!(e.repeat&&U.closeup.scenes[U.closeup.index]?.kind==="postcard")&&!reportGuarded())closeAttackPopup();} return; }
      if (U.reading && e.key === " " && !e.target.closest("input,textarea,select,button")) { e.preventDefault(); skipReading(false); return; }   // Slow pace: Space skips the wait for the line on screen
      if (U.narrationHold) return;
      if (U.s?.phase === "mind") return;
      if (U.mode === "teach") return;
      if (U.mode === "town") return;   // town/town.js listens for its own keys   // a Teach mode card is open: its own buttons take the keys
      if (e.target.closest(".cc-status") && e.key !== "Escape") return; // native disclosure keys must not issue a battle command
      if (U.mode === "studio" && !e.metaKey && !e.ctrlKey && !e.target.closest("input,select,textarea,summary")) { studioKey(e); return; }
      if (U.mode === "setup" && !$("ccGraph").hidden) { if(e.key==="Escape") {e.preventDefault();$("ccGraph").hidden=true;$("ccGraphMenu")?.focus();} return; }
      if (U.mode === "setup" && e.key === "Enter" && !e.target.closest("button,summary,textarea,input[type=checkbox],input[type=radio]")) { e.preventDefault(); startSafely(); return; }   // Enter starts from selects/inputs (focus sits in Encounter after choosing); buttons/summary/checkboxes/textarea keep native keys
      if (U.mode === "setup" && e.target.closest("button,summary,input,select,textarea")) return;
      if (e.metaKey || e.ctrlKey || e.target.closest("input,select,textarea")) return;
      const K = e.key;
      if (U.mode === "setup") { if (K === "Enter") { e.preventDefault(); startSafely(); } return; }
      if (K.toLowerCase() === "g") { e.preventDefault(); const gr = $("ccGraph"); gr.hidden ? openGraph() : (gr.hidden = true); return; }
      if (K.toLowerCase() === "i" && U.s && U.mode !== "over") { e.preventDefault(); unitInfoAt(U.hover || U.cursor); return; }   // unit window for the tile under the cursor
      if (K === "Escape" && U.unitInfo && $("ccGraph").hidden) { e.preventDefault(); openUnitInfo(null); return; }
      if (K === "Escape") { e.preventDefault(); if (!$("ccGraph").hidden) { $("ccGraph").hidden = true; return; } if (U.mode !== "wait" && U.mode !== "response" && U.mode !== "over") back(); return; }
      const arrows = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      if (U.s && (K === "+" || K === "=")) { e.preventDefault(); zoomStep(1); return; }
      if (U.s && K === "-") { e.preventDefault(); zoomStep(-1); return; }
      if (U.s && K === "0") { e.preventDefault(); zoomReset(); return; }
      if (U.s && K.toLowerCase() === "c" && !e.altKey) { e.preventDefault(); centreCam(); return; }
      if (openCardCancel() && K !== "Backspace" && K !== "ArrowLeft") return;   // a card is open: Enter, the arrows, 1-9 and / belong to the card, not the hidden command menu (Escape and Back closed it above)
      if (U.mode === "menu" && U.menu === "root" && K === "/" && $("ccSearch")) { e.preventDefault(); $("ccSearch").focus(); return; }   // search (docs/command-menu.md)
      if (U.mode === "menu" && CS && /^[1-9]$/.test(K) && +K <= CS.PINS_MAX && U.s && !U.s.outcome) { e.preventDefault(); runPin(+K - 1); return; }   // the quick bar
      if (U.mode === "menu") {
        const items = menuList();
        if (K === "ArrowDown" || K === "ArrowUp") { e.preventDefault(); U.menuIndex = (U.menuIndex + (K === "ArrowDown" ? 1 : -1) + items.length) % items.length; renderCommands(); renderDetail(); draw(); }
        else if (K === "Enter" || K === "ArrowRight") { e.preventDefault(); choose(items[U.menuIndex]); }
        else if (K === "ArrowLeft" || K === "Backspace") { e.preventDefault(); back(); }
        return;
      }
      if (["move", "press", "jump", "climb", "target", "response"].includes(U.mode) && arrows[K]) {
        e.preventDefault(); const [dx, dy] = arrows[K];
        U.cursor = [Math.max(0, Math.min(U.s.arena.w - 1, U.cursor[0] + dx)), Math.max(0, Math.min(U.s.arena.h - 1, U.cursor[1] + dy))];
        U.hover = U.cursor; draw(); if (U.mode === "target") renderDetail(); return;
      }
      if (K === "Enter" && ["move", "press", "jump", "climb", "target", "response"].includes(U.mode)) { e.preventDefault(); commitAt(U.sel && U.sel.self ? [controlledFighter(U.s).x, controlledFighter(U.s).y] : U.cursor); }
    }
    document.addEventListener("keydown", onKey);
    $("ccGraphBtn").onclick = () => ($("ccGraph").hidden ? openGraph() : ($("ccGraph").hidden = true));
    $("ccAnimation").textContent = `Animation: ${U.fullAnimation?"Full":"Fast"}`;
    $("ccAnimation").onclick = () => { U.fullAnimation=!U.fullAnimation;store.set("loci:combat:full-animation",U.fullAnimation);$("ccAnimation").textContent=`Animation: ${U.fullAnimation?"Full":"Fast"}`;if(!U.fullAnimation&&U.closeup)closeAttackPopup(); };
    $("ccPace").textContent = `Pace: ${U.pace === "slow" ? "Slow" : "Normal"}`;
    $("ccPace").onclick = () => { U.pace = U.pace === "slow" ? "normal" : "slow"; setPace(U.pace); store.set("loci:combat:pace", U.pace); $("ccPace").textContent = `Pace: ${U.pace === "slow" ? "Slow" : "Normal"}`; if (U.pace !== "slow" && U.reading) skipReading(true); };
    $("ccLog").addEventListener("click", (ev) => { if (U.reading && !ev.target.closest("a")) skipReading(false); });   // a click on the log skips the wait for the line on screen
    $("ccDialogue").textContent = `Dialogue ${U.dialogueOn ? "On" : "Off"}`;
    $("ccDialogue").onclick = () => { U.dialogueOn = !U.dialogueOn; store.set("loci:combat:dialogue", U.dialogueOn); if (!U.dialogueOn) U.bubbles = []; $("ccDialogue").textContent = `Dialogue ${U.dialogueOn ? "On" : "Off"}`; draw(); if (U.dialogueOn) showDialogueFrom(U.s?.log.length || 0); };
    $("ccIso").onclick = () => { U.isoView = !U.isoView; store.set("loci:combat:iso-view", U.isoView); syncViewBar(); if (U.s) { layout(); draw(); } syncZoomBar(); };
    for (const b of $("ccBoardTabs").querySelectorAll("button")) b.onclick = () => { if (!U.s) return; U.boardTab = b.dataset.board; U.boardTabTurn = turnKey(); syncBoardTabs(); layout(); draw(); };
    $("ccIsoCut").onclick = () => { U.isoCutaway = !U.isoCutaway; store.set("loci:combat:iso-cutaway", U.isoCutaway); syncViewBar(); if (U.s) draw(); };
    // Follow defaults ON (Mala, 2026-10-31) unless the camera cannot ease: with reduced motion or Fast animation it starts OFF (Mala's ruling, 2026-10-31); a saved choice always wins.
    { const savedFollow = store.get("loci:combat:follow", null); U.follow = savedFollow === null ? !!(U.fullAnimation && !params.fast) : savedFollow !== false; }
    U.followPaused = false; U.cam = null; syncFollowBar();
    $("ccFollow").onclick = () => setFollow(!U.follow);
    $("ccCenter").onclick = () => centreCam();
    $("ccFollowPaused").onclick = () => { U.followPaused = false; syncFollowBar(); const d = U.s && E.decider(U.s); if (d) { U.followForce = true; followDecider(d); } };
    $("ccZoomIn").onclick = () => zoomStep(1);
    $("ccZoomOut").onclick = () => zoomStep(-1);
    $("ccZoomPct").onclick = () => zoomReset();
    $("ccCopy").onclick = async () => { if (!U.s) return; try { await navigator.clipboard.writeText(logText()); flashTip("Battle log copied."); } catch { flashTip("Couldn't reach the clipboard."); } };
    const ro = new ResizeObserver(() => { if (U.s) { layout(); draw(); } });
    ro.observe(cv.parentElement);

    // Scripted entry for smoke tests/screenshots: ?autostart&autoplay&steps=N&pick=snapShot&hover=6,1&graph=edge-id&terrain=oculusCourt&iso
    if (params.autostart) {
      if (params.terrain) U.setupScenario = { ...(U.setupScenario || {}), ccTerrain: params.terrain };   // &terrain=oculusCourt&iso picks the arena and the camera
      showSetup(); startSafely({ loadout: params.loadout || "be", opener: params.opener || "player", encounter: params.encounter || "firstWall", setupOpts: params.setupOpts });
      if (params.steps) { stopAi(); for (let i = 0; i < +params.steps && !U.s.outcome; i++) { const a = E.aiAction(U.s); const r = E.apply(U.s, a); if (!r.ok) break; U.s = r.state; U.actions.push(a); } U.mode = "menu"; if (U.s.outcome) finish(); else if (E.decider(U.s).actor === "player" && !params.autoplay) pump(); }
      if (params.pick) { const tg = E.targeting(U.s, "player", params.pick); U.mode = "target"; U.menu = "tech"; U.sel = { ability: params.pick, m: tg.m, tg, self: !!tg.selfCast }; U.announce = tg.m.tier === "ultimate"; }
      if (params.hover) U.hover = U.cursor = params.hover.split(",").map(Number);
      render();
      if (params.graph) openGraph(params.graph === "1" ? null : params.graph);
    } else showSetup();

    return {
      // The app's ← button (app.js): one step back inside Concept Combat before leaving it (Mala, 2026-10-26: "exiting out of
      // menus in Concept combat kicks you out to this page"). True when it stepped back; false at the main menu itself.
      quickBattle() { startSafely({ randomEncounter: true, everything: true, opener: "player" }); },   // the home page's Quick battle: the setup screen's Random Encounter
      openFieldKit() { showAccount(); },   // the home page's Field Kit
      fightSecretWarrior() { if (!SN) return false; startSafely({ encounter: "secretWarriorNext", opener: "player" }); return true; },   // the home page's Fight Secret Warrior (Mala, 2026-10-28)
      backOut() {
        if (U.mode === "town") return false;   // the town is Concept Combat's main menu: from here the app goes home
        if (closeCard()) return true;   // a battle card is open: close it, stay in the fight
        if (U.mode === "setup") { if (U.townOn && U.menuView !== "town") { U.menuView = "town"; showSetup(); return true; } return false; }
        showSetup(); return true;   // a battle, a result, the Field Kit, the studio or the bestiary: back to the menu it came from
      },
      // Play duel scenes directly (attack or dodge), for checking the cutscene without staging a battle around it.
      previewCloseup(scenes) { if (U.s && scenes?.length) { openAttackPopup(scenes); animate(); } return !!U.closeup; },
      destroy() { decisionInspector?.destroy(); U.destroyed = true; clearTimeout(U.readTimer); cancelAnimationFrame(U.camRaf); clearTimeout(U.followHoldT); U.reading = null; ++U.llmEpoch; clearInterval(U.agentStatusTimer); clearTimeout(U.ultWatchTimer); U.narrationHold = false; root.ConceptCombatNarrator?.close(); stopAi(); Promise.resolve(opts.llmBridge?.stop?.()).catch(() => {}); U.llmConnection = null; cancelAnimationFrame(U.raf); ro.disconnect(); document.removeEventListener("keydown", onKey); document.removeEventListener("mouseup", endPan); host.innerHTML = ""; },
      useSocketAI(connection) {
        if (!U.s || U.s.outcome || !connection?.url || !connection?.token ||
            (connection.actorId && U.s.actors[connection.actorId]?.side !== "enemy")) return false;
        ++U.llmEpoch; stopAi(); U.llmEnabled = true; U.llmPaused = false; U.llmFailed = false; U.llmReady = true; U.llmConnection = connection;
        U.llmActorId = connection.actorId || null; U.agentSessionUsed ||= connection.fallback === "pause";
        pump(); return true;
      },
      useBuiltinAI,
      get state() { return U.s; }, get actions() { return U.actions; }, get town() { return U.town; },   // the town (its state, interact, advance), for checks
      // The board as drawn, for checks: which camera is up, where a tile is on the canvas, and which tile a canvas point is.
      // sceneKinds: what the isometric scene models (ground and architecture; never the population). sprites: the art drawn for plants and objects.
      followAction: (a, before, logFrom) => followAction(a, before, logFrom),   // tests (tests/unit-follow.test.mjs): feeds a staged walk through the real Follow camera
      ritualRows: () => ritualMenu(),   // the Rituals rows as the player would see them (tests: tests/gaia-capture-browser.test.mjs)
      get board() { return { iso: !!isoCam, cam: U.cam ? { ...U.cam } : null, mode: U.mode, tile: geo.tw, zoom: U.zoom, pan: [U.panX, U.panY], centre: (x, y) => centre(x, y), tileAt: (mx, my) => tileFromPoint(mx, my), sprites: spritesDrawn.slice(), dressing: dressingDrawn, shelfTexture, groundTiles: groundDrawn, astralFloors: astralFloorsDrawn, groundSet: MAPD && U.s ? MAPD.groundSet(U.s.arena) : null, sceneKinds: isoCam ? [...new Set(isoCam.faces.map((f) => f.kind))] : [] }; },

    };
  }

  // Where an aura frame goes. Two kinds of sheet are in sprites/auras/. A ground ring is cropped tight and spans the
  // aura: its bottom edge sits just past the radius. A STANDING sheet (the older ones) is a padded, character-sized
  // frame, a small mound with growth rising around whoever stands on it: `at` is the mound's ground point as a
  // fraction of the frame, and it goes under the unit's feet, with the frame `size` aura-diameters wide. Mala,
  // 2026-10-13: the Doctor's floral aura was being placed as a ring, two tiles below her.
  const AURA_STANDING = { floral: { at: [.47, .93], size: .7 }, fungal: { at: [.47, .92], size: .7 }, "spikey-bubble": { at: [.46, .95], size: .7 }, "shadow-bubble": { at: [.55, .95], size: .7 } };
  function UI_auraPlacement(art, iw, ih, cx, cy, rx, ry, th) {
    const S = AURA_STANDING[art];
    if (!S) { const w = rx * 2, h = ih * w / iw; return { x: cx - w / 2, y: cy + ry * 1.05 - h, w, h }; }   // the ring sits at the bottom of its frame
    const w = rx * 2 * S.size, h = ih * w / iw;
    return { x: cx - w * S.at[0], y: cy + th * .12 - h * S.at[1], w, h };   // th * .12: where the unit's shadow is drawn
  }
  root.ConceptCombatUI = { FOLLOW, followTarget, framePair, followable, camAt, camAlong, easeInOut, sceneMs, setPace, readingGapMs, createInspectorEngine, portraitSource, portraitMarkup, mindDuelMarkup, conversationMarkup, conversationScenes, learningScenes, auraPlacement: UI_auraPlacement, AURA_STANDING, FACE_ART, faceFile, SKY, skyFor, LEXICON_ART, lexiconOrder, statusMarks, WEATHER_ART, weatherTiles, heldPrices, HAZARD_ART, hazardFrame, SCENE_MS, menuBrief, menuRollover, apGate, apHead, defensiveResponsePrices, TEXT_SCENE_MS, DREAM_TIMELINE, dreamScenes, closeupScenes, boonScenes, arrivalScenes, eventScenes, pepTalkScenes, missedCallScenes, beliefScenes, heldBeliefScenes, BELIEF_TIMELINE, dodgeScene, DODGE_TIMELINE, scenePose, mount, modeAfterEngineAction, graphLayout, pickupPresentation, shouldFlipSprite, SPRITE_DIR };   // SPRITE_DIR: tools/check-sprite-facing.mjs
})(typeof self !== "undefined" ? self : this);
