"use strict";
// Themed battles in Randomize (Mala, 2026-10-18: "sometimes there are battles like Knights of the Round Table where you
// fight a group of knights who have relevant cutscenes"; one roll in five). A themed roll keeps everything the random
// encounter rolled for the player's side (hero, allies, terrain, weather, phase of day) and replaces the opponents with
// a themed lineup. Arantxa narrates the theme at the open, once mid-fight, and at the result (dialogue/narrator.js).
// Classes can repeat (two Knights is fine); a lineup entry's `name` tells same-class fighters apart.
//
//   roll(seed)                     → theme id or null (seeded, CHANCE of the time)
//   apply(base, themeId, seed)     → E.create options: base with the theme's opponents, title and `theme`
//   midDue(theme, state)           → true when the theme's mid-fight beat should play (the UI shows it once)
// Pure functions; no engine state.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../terrain/terrain-data.js"));
  else root.ConceptCombatThemedBattles = factory(root.ConceptCombatTerrain);
})(typeof self !== "undefined" ? self : this, function (TD) {
  const CHANCE = 0.2;
  const KEEP_EVENTS = new Set(["weather", "ally"]);   // events that do not bring in other opponents
  const F = (character, name, side) => ({ character, ...(name ? { name } : {}), ...(side ? { side } : {}) });

  // lineup: in arrival order. As many fight as the random roll brought opponents, at least `min` (2): at 2 the player wins as
  // often as in an ordinary random battle (4 of 12 AI-played either way, 2026-10-18); a floor of 3 dropped it to 2 of 12.
  // mid.when: { firstFall } | { round } | { below: [lineupIndex, fraction] } | { arrival } (the first arrival is on the field).
  // arrivals: a third side (or more of the enemy) entering at the start of a round. mode: "melee" for a free-for-all.
  const THEMES = {
    roundTable: { title: "Knights of the Round Table", min: 2,
      lineup: [F("knight", "Sir Gawain"), F("paladin", "Sir Galahad"), F("knight", "Sir Kay"), F("black_armor", "The Black Knight"), F("wizard", "The King's Counsel")],
      open: "A round table stands in the open air, every seat taken. The knights swear their oath to each other before they draw. They will not tell you which of them sits there by right.",
      mid: { when: { firstFall: true }, text: "A seat at the table stands empty. The others look at it, and then at you." },
      result: { player: "The table is broken up. Somebody will make a longer story of it than it was.", enemy: "The knights sheathe their swords and sit down again. One more name goes into the story, and it is not yours." } },
    heist: { title: "The Heist", min: 2,
      lineup: [F("thief"), F("rogue"), F("hacker"), F("ninja")],
      open: "An alarm is going off somewhere behind the crew. They have the take, and you are standing in the only way out.",
      arrivals: [{ character: "detective", side: "police", round: 3 }, { character: "policeOfficer", side: "police", round: 3 }],
      mid: { when: { arrival: true }, text: "Sirens, then boots. The police are here, and they do not care who started it." },
      result: { player: "The take is on the ground. The crew scatters without it.", enemy: "The crew is gone with the take. The alarm keeps ringing for nobody." } },
    jackpot: { title: "Jackpot", min: 2,   // W5.3: the gamblers' table — escalating meter, rivals all evening
      lineup: [F("thief", "Grinder"), F("rogue", "Hustler"), F("hacker", "Chancer")],
      arrivals: [{ character: "ninja", name: "Bakura", round: 3 }],
      open: "A table in the open air, and every seat taken by someone who counts cards for a living. The pot in the middle keeps growing while you stand there. They invite you to take it from them.",
      mid: { when: { arrival: true }, text: "Bakura takes the empty seat. The pot doubles, and so does the interest." },
      result: { player: "The table is yours. You count the pot twice, the way they taught you.", enemy: "The house always wins. They stack your Seeds with the rest and deal another hand." } },
    takeover: { title: "Hostile Takeover", min: 2,
      lineup: [F("tech_billionaire"), F("oil_billionaire"), F("agi"), F("agent_swarm")],
      open: "The offer was made once, politely. It has expired. The people who made it have come to collect.",
      mid: { when: { below: [2, 0.5] }, text: "The machine stops answering its owners. It has started running its own numbers." },
      result: { player: "The deal falls through. Nobody signs anything today.", enemy: "The papers are signed for you. The field belongs to them now." } },
    wineDark: { title: "The Wine-Dark Sea", min: 2,
      lineup: [F("odysseus"), F("sailor"), F("deepsea_warrior"), F("medusa")],
      open: "A storm has put a ship on this shore. Its captain has been trying to get home for a long time, and you are between him and the road.",
      mid: { when: { below: [0, 0.5] }, text: "The captain looks past you, toward home, and fights as if it were there." },
      result: { player: "The ship goes back to sea without its captain's homecoming.", enemy: "The crew walks on past you. One more island behind them." } },
    pharaohCourt: { title: "Court of the Pharaoh", min: 2,
      lineup: [F("pharaoh"), F("bastet"), F("ritual_chanter"), F("celestial_priestess")],
      open: "The court has set out its scales. Your heart goes on one side. The court will not say what is on the other.",
      mid: { when: { firstFall: true }, text: "The scales tip. Nobody in the court says which way." },
      result: { player: "The court finds you worthy, though it says so through its teeth.", enemy: "The court finds you wanting. The scales are put away." } },
    hedgeMidnight: { title: "The Hedge at Midnight", min: 2,
      lineup: [F("hedge_witch"), F("shaman"), F("mycologist"), F("forest_spirit"), F("devouring_mother")],
      open: "The moon is full over the hedge. Something has been invited to dinner, and the guests are deciding whether you are on the menu.",
      mid: { when: { firstFall: true }, text: "A voice from the dark of the hedge: \"Who hurt my child?\"" },
      result: { player: "The hedge goes quiet. The invitation is withdrawn.", enemy: "Dinner is served. The hedge keeps what it is given." } },
    exhibition: { title: "The Great Exhibition", min: 2, crowd: true,   // W6.5: the crowd pays for theater
      lineup: [F("steam_walker"), F("clockwork"), F("ornithopter"), F("engineer"), F("robot_mechanic")],
      open: "The demonstration was going beautifully until it pointed itself at the crowd. The inventors insist this is still the demonstration.",
      mid: { when: { round: 4 }, text: "A boiler somewhere is singing a note it should not be able to reach." },
      result: { player: "The exhibition closes early. The inventors are already arguing about the prize.", enemy: "The crowd applauds. They think you were part of the show." } },
    encore: { title: "Encore", min: 2, crowd: true,   // W6.5: the crowd pays for theater
      lineup: [F("neon_dj"), F("neon_idol"), F("jpop_idol"), F("rapper")],
      open: "The house lights go down. The crowd is already screaming, and the stage has decided you are tonight's opening act.",
      mid: { when: { below: [1, 0.5] }, text: "The crowd starts chanting for an encore. Someone on stage is going to give them one." },
      result: { player: "The lights come up on an empty stage. The crowd goes home humming your part.", enemy: "Curtain call. You are not on the bill." } },
    dojo: { title: "The Dojo Sign", min: 2,
      lineup: [F("samurai"), F("ninja"), F("jujutsu_sorcerer"), F("oni_yokozuna")],
      open: "You have taken down the dojo's sign. Its students bow to you, all of them at once, which is not how a challenge is supposed to go.",
      mid: { when: { firstFall: true }, text: "The fallen student bows from the floor. The others bow lower." },
      result: { player: "The sign is yours to keep. The students bow you out of the door.", enemy: "The sign goes back on the wall, and they put it up straighter than before." } },
    siteWalk: { title: "Site Walk Gone Wrong", min: 2,
      lineup: [F("arborist"), F("surveyor"), F("gardener"), F("ecologist"), F("rainkeeper")],
      open: "It was a pre-job briefing. Then somebody disagreed about the tree, and now it is a dispute about the whole site.",
      mid: { when: { round: 3 }, text: "Somebody unrolls the site plan in the middle of the fight. Nobody agrees on what it shows." },
      result: { player: "The crew packs up. The tree stays where it is, and so does the argument.", enemy: "The crew signs off the plan without you. The tree comes down on Tuesday." } },
    federal: { title: "Federal Case", min: 2,
      lineup: [F("fbi_agent"), F("tactical_operative"), F("detective"), F("policeOfficer")],
      open: "There is a warrant with your name on it, or a name close enough. The people serving it are not interested in the difference.",
      arrivals: [{ character: "visitor_grey", name: "Agent Grey", side: "enemy", round: 4 }],
      mid: { when: { arrival: true }, text: "One more agent steps out of nowhere. He is not on the warrant, and he is not from any agency on this planet." },
      result: { player: "The warrant is set aside for now. Somebody will be writing a report about you tonight.", enemy: "The case is closed with your name on it." } },
    powers: { title: "Powers That Be", min: 2, mode: "melee",   // three sides: you, the heroes, the villains; last crew standing
      lineup: [F("super_villain", null, "villains"), F("super_hero", null, "heroes"), F("defective_machine", null, "villains"), F("super_heroine", null, "heroes")],
      open: "The heroes came to stop the villain. The villain came to stop the heroes. Everyone here has decided you are in the way.",
      mid: { when: { firstFall: true }, text: "One side is a fighter short. The other two look at each other, and then at you." },
      result: { player: "You are the last one standing. Both sides will tell it as their own win.", enemy: "Somebody won this fight. It was not you." } },
  };

  function hash(seed, tag) {
    let h = 2166136261 ^ (seed >>> 0);
    for (const c of String(tag)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const ids = () => Object.keys(THEMES);
  function roll(seed, { chance = CHANCE } = {}) {
    if (hash(seed, "theme:roll") >= chance) return null;
    const list = ids(); return list[Math.floor(hash(seed, "theme:pick") * list.length)];
  }

  // Open ground on the arena for the opponents: their side of the field, nearest the rows the random foes used.
  function spots(arena, taken, preferred, n) {
    const map = arena?.map || [], h = map.length, w = (map[0] || "").length;
    const open = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !(TD?.terrain?.[map[y][x]]?.blocksMove) && !taken.has(x + "," + y)
      && !(arena.objects || []).some((o) => o.x === x && o.y === y && o.blocksMove);
    const out = [];
    for (const [x, y] of preferred) if (out.length < n && open(x, y)) { out.push([x, y]); taken.add(x + "," + y); }
    for (let col = w - 1; col >= Math.floor(w / 2) && out.length < n; col--)
      for (const y of [3, 1, 5, 2, 4, 0, 6].filter((r) => r < h)) if (out.length < n && open(col, y)) { out.push([col, y]); taken.add(col + "," + y); }
    return out;
  }

  function apply(base, themeId, seed) {
    const T = THEMES[themeId]; if (!T || !base) return base;
    const foes = (base.participants || []).filter((p) => /^random-foe-/.test(p.id));
    const dropped = new Set((base.randomEventSchedule || []).filter((e) => !KEEP_EVENTS.has(e.type)).flatMap((e) => e.actorIds || []));
    const kept = (base.participants || []).filter((p) => !/^random-foe-/.test(p.id) && !dropped.has(p.id));
    const n = Math.min(T.lineup.length, Math.max(T.min, foes.length));
    const taken = new Set(kept.map((p) => (p.at || []).join(",")));
    const at = spots(base.arenaData, taken, foes.map((p) => p.at), n);
    const lineup = T.lineup.slice(0, at.length).map((f, i) => ({ id: `theme-foe-${i + 1}`, character: f.character, side: f.side || "enemy", at: at[i], ...(f.name ? { name: f.name } : {}) }));
    // Arrivals enter at the start of their round on the top or bottom edge, away from where the fight starts.
    const h = base.arenaData?.map?.length || 7, w = (base.arenaData?.map?.[0] || "").length || 11, mid = Math.floor(w / 2);
    const edge = [0, h - 1].flatMap((y) => [mid, mid - 1, mid + 1, mid - 2, mid + 2].map((x) => [x, y]));
    const arriveAt = spots(base.arenaData, taken, edge, (T.arrivals || []).length);
    const arrivals = (T.arrivals || []).slice(0, arriveAt.length).map((f, i) => ({ id: `theme-arrival-${i + 1}`, character: f.character, side: f.side || "enemy", at: arriveAt[i], arrivesRound: f.round, ...(f.name ? { name: f.name } : {}) }));
    return { ...base, title: T.title, themedBattle: themeId, ...(T.mode ? { mode: T.mode } : {}),
      theme: { id: `theme-${themeId}`, title: T.title, text: T.open, mid: T.mid.text, result: { ...T.result } },
      participants: [...kept, ...lineup, ...arrivals],
      randomEventSchedule: (base.randomEventSchedule || []).filter((e) => KEEP_EVENTS.has(e.type)) };
  }

  function midDue(theme, state) {
    const T = theme && THEMES[String(theme.id || "").replace(/^theme-/, "")]; if (!T || !state || state.outcome) return false;
    const foes = Object.values(state.actors || {}).filter((u) => /^theme-foe-/.test(u.id));
    const W = T.mid.when;
    if (W.firstFall) return foes.some((u) => u.defeated);
    if (W.arrival) return Object.values(state.actors || {}).some((u) => /^theme-arrival-/.test(u.id) && !u.notArrived);
    if (W.round) return (state.round || 0) >= W.round;
    if (W.below) { const u = state.actors?.[`theme-foe-${W.below[0] + 1}`]; return !!u && !u.defeated && u.lf <= u.maxLF * W.below[1]; }
    return false;
  }

  return { CHANCE, THEMES, ids, roll, apply, midDue };
});
