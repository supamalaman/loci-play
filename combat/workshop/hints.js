"use strict";
// Hints (Workshop clarity build, S1 to S3; Mala, 2026-10-30: "The Workshop is kind of confusing"; spec
// ready-to-review/claude-workshop-clarity-spec/specs/WORKSHOP_CLARITY.md section 5): the words of the Concept Tree and the
// Workshop landing, as pure functions, so every line the screen shows is tied to a state the code can name, and a node
// test can read it. The screen draws what these return; it never writes a sentence of its own about a rule.
//
//   COPY                                    -> fixed lines (purpose, legend, how to earn, ...)
//   nextStep({wallet, owned, bonded, ledger}) -> { id, text } | null   (first matching rule wins)
//   walletLine(wallet, owned, chits)        -> "✦ 3 discoveries · 2 owned"
//   claimWhy({wallet, cost})                -> why Claim is off for want of discoveries, or ""
//   stateLine({state, dist, nbs, ...})      -> the one-line state of a selected node
//   blendState({wallet, owned})             -> the summary of the Blend group
//   blendLine(pv)                           -> the preview line of a blend (no raw number)
//   examLine(exam, ...)                     -> the Still Water exam status, honest about what cannot be taken
//   deskCard / kilnCard / treeCard          -> the live state line of each bench on the landing
//   DESK_STEPS, deskStep(...)               -> the four steps of the Scribing desk and which one is current
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatWorkshopHints = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const disc = (n) => plural(n, "discovery", "discoveries");

  const COPY = {
    title: "Concept Tree",
    purpose: "Every concept in the game on one map. Read any of it free; spend discoveries to make concepts yours.",
    sealNote: "reading is free; a claim is yours until you seal it in a GateLess ending",
    claimBeat: "Owned — yours, until a GateLess ending seals it.",   // the same words as the second beat in ceremony/ceremony.js
    earnTitle: "How do I earn discoveries?",
    earn: "A discovery is paid when a vow you swore is kept through a battle, win or lose. The results screen shows “+1 discovery”. Nothing else pays one yet.",
    legendSymbols: "○ not yours yet · ◐ next to something you own · ● yours · ⌂ your home concept",
    legendGroupsTitle: "What are Family, Ring and Water?",
    legendGroups: [
      ["Family", "the section headings: concepts that sit together on the map."],
      ["Ring", "distance from your home concepts, counted outward: Home, then Ring 1, Ring 2 and so on."],
      ["Water", "the school a concept belongs to (eight Waters ring a ninth, Still). It shows when you click a concept."],
    ],
    groupFamily: "Group by family", groupRing: "Group by distance from home",
    blendTitle: "Blend two",
    blendHelp: "Choose two things you own, or two verbs (verbs are open to everyone). The preview is free; making the blend costs the discoveries shown.",
    blendFirstFirst: "Choose the first one first.",
    blendKinds: "Two nodes or two verbs: the second list matches the first.",
    verbLegend: "◆ usable in battle: Techniques ▸ Care",
    bodyless: "This blend is recorded in your ledger. It cannot be used as a technique yet.",
    blendNameLabel: "Give this blend a name",
    ledgerNoLabel: "Show the equation",
    rewriteClosed: "Rewrite this concept (1 discovery): change its name, color or default lens. Its mechanism does not change.",
    ownedDetail: "Owned. It counts toward its Water and lets you blend and rewrite it.",
    readings: "Readings",
    watersTitle: "Schools (Waters) and the Still Water exam",
    waterOnce: "Each concept belongs to one of eight Waters (a school of concepts). A Water opens when you prove its thesis once; the list shows each proof. Your home Water is open from the start.",
    tendedNote: "Tended opens by tending one item four times (Ledger House ▸ Gear).",
    soundNote: "Sound for these rites is switched in Ledger House.",
    hideHints: "Hide hints", showHints: "Show hints",
  };

  function walletLine(wallet = 0, owned = 0, chits = 0) {
    return `✦ ${disc(wallet)} · ${owned} owned${chits ? ` · ${plural(chits, "chit", "chits")}` : ""}`;
  }

  // First matching rule wins. Each text is true by the code named beside it.
  function nextStep({ wallet = 0, owned = 0, bonded = false, ledger = 0 } = {}) {
    if (wallet < 1 && owned < 1)   // loot.js finishBattle: grantFor(a, "vow", kept) is the only faucet
      return { id: "first-vow", text: "You have no discoveries yet. Swear a vow in a battle and keep it: each kept vow pays one. Reading any concept is free." };
    if (owned < 1)   // valence.claimPrice: with nothing owned the first claim is priced at distance 0, which is 1
      return { id: "claim-home", text: "Claim a home concept (marked ⌂) to start your tree. Your first claim costs 1 discovery." };
    if (wallet < 1)
      return { id: "next-vow", text: "Keep a vow in a battle to earn your next discovery." };
    const parts = [];
    if (bonded) parts.push("claim a ◐ neighbor of something you own");
    if (owned >= 2) parts.push("blend two things you own");   // pairing.preview: a node parent must be owned
    if (!parts.length) return null;
    let text = `${parts.join(", or ").replace(/^./, (c) => c.toUpperCase())}.`;
    if (owned >= 2 && ledger < 1)   // sagas.js / ui.js saga confirm: the GateLess star is picked from the ledger
      text += " A blend records an equation in your ledger; a GateLess ending can name one as its star.";
    return { id: "grow", text };
  }

  const claimWhy = ({ wallet = 0, cost = 1 } = {}) => wallet < cost
    ? `You have ${wallet} of the ${cost} this costs. A discovery is paid when a vow you swore is kept.` : "";

  // dist is hops from the NEAREST concept you own (valence.claimPrice -> nearestOwned), not from home.
  function stateLine({ state, ownedCount = 0, dist = 0, nbs = 0, sung = false, bridged = false } = {}) {
    if (state === "owned") return COPY.ownedDetail;
    const word = state === "bonded" ? "next to something you own" : "not yours yet";
    const far = !ownedCount ? "your first claim, so nothing to measure from yet"
      : Number.isFinite(dist) ? `${plural(dist, "step", "steps")} from the nearest concept you own` : "off the map";
    return `${word} · ${far}${sung ? " · blessed: the lore says you sing" : ""}${bridged ? " · chit bridges it" : ""} · ${plural(nbs, "neighbor", "neighbors")}`;
  }

  function blendState({ wallet = 0, owned = 0 } = {}) {
    if (wallet < 1) return `needs 1 discovery (you have ${wallet})`;   // pairing.preview prices every blend at 1 or more
    return owned >= 2 ? `ready: you own ${owned} nodes, and verbs are open to everyone` : "ready: blend two verbs (nodes need two you own)";
  }

  // pv is pairing.preview(...). No raw equation number here: the screen puts it in a closed details.
  const blendLine = (pv) => `${pv.named ? `${pv.name} · named` : `${pv.name} · no name yet`} · distance ${pv.dist} · wildness ${pv.drift} · cost ${disc(pv.price)}`;

  // schools.examStatus: breadth 6 in one Water, lineage 3 equations, depth waits on a lock-in artifact (seal null).
  function examLine(exam, rules = { breadth: 6, lineage: 3 }, ledger = 0) {
    if (!exam) return "";
    const deepest = Math.max(0, ...Object.values(exam.bySchool || {}));
    const tally = `Breadth ${deepest} of ${rules.breadth} · Equations ${ledger} of ${rules.lineage}`;
    if (exam.seals && exam.seals.depth === null)
      return `The Still Water exam is not open yet: it needs a lock-in artifact, which the game cannot make yet. (${tally}.)`;
    return `Still Water exam: ${tally}.`;
  }

  const treeCard = ({ wallet = 0, owned = 0 } = {}) => `${disc(wallet)} · ${owned} owned`;
  const deskCard = ({ parts = 0, held = 0, slots = 0 } = {}) => parts
    ? `${plural(parts, "recovered part", "recovered parts")} · memory ${held}/${slots}`
    : "No parts yet: take a held technique apart in the Codex";
  const kilnCard = ({ common = 0, uncommon = 0, rare = 0 } = {}) => `parts ${common}c/${uncommon}u/${rare}r`;

  // The desk's four steps; the current one is whichever matches the draft (workshop-ui.js decides which).
  const DESK_STEPS = ["Write the sentence", "Try it", "Inscribe", "Equip"];
  // inscribed: this very draft (unchanged since) was just inscribed, so Equip is next. An unwritten sentence is always step 1.
  const deskStep = ({ ok = false, tried = false, inscribed = false } = {}) => inscribed ? 4 : !ok ? 1 : !tried ? 2 : 3;

  return { COPY, walletLine, nextStep, claimWhy, stateLine, blendState, blendLine, examLine, treeCard, deskCard, kilnCard, DESK_STEPS, deskStep };
});
