"use strict";
// Concept Combat engine: a deterministic, rendering-free state machine (spec §10).
//
//   const E = ConceptCombat.engine(ConceptCombatContent);
//   let s = E.create({ encounter: "gapCourt" });
//   const r = E.apply(s, { type: "ability", actor: "player", ability: "snapShot", target: [6, 2] });
//   if (r.ok) s = r.state;              // illegal actions return ok:false and the old state untouched
//
// State is plain JSON. apply() never mutates its input. No randomness, no clocks, so
// replay(opts, actions) reproduces the same state and log. The UI and the AI only read
// state and submit actions; nothing in here touches the DOM.
(function (root, factory) {
  const Observation = typeof module === "object" && module.exports ? require("./insight/observation.js") : root.ConceptCombatObservation;
  const Tourist = typeof module === "object" && module.exports ? require("./bystanders/tourist.js") : root.ConceptCombatTourist;
  const Sight = typeof module === "object" && module.exports ? require("./terrain/sight.js") : root.ConceptCombatSight;
  const Belief = typeof module === "object" && module.exports ? require("./insight/belief-conversion.js") : root.ConceptCombatBeliefConversion;
  // Live graph (graph/live.js): graph-data relationships applied at hit time. Optional: absent, nothing changes.
  const GraphLive = typeof module === "object" && module.exports ? require("./graph/live.js") : root.ConceptCombatGraphLive;
  // Class runtime (classes/class-runtime.js): the 15 original class-pack classes. Optional: absent, nothing changes.
  const ClassRuntime = typeof module === "object" && module.exports ? require("./classes/class-runtime.js") : root.ConceptCombatClassRuntime;
  const Director = typeof module === "object" && module.exports ? require("./director/director.js") : root.ConceptCombatDirector;
  const MaidSystems = typeof module === "object" && module.exports ? require("./maid-systems.js") : root.ConceptCombatMaidSystems;
  const RandomEvents = typeof module === "object" && module.exports ? require("./random-events.js") : root.ConceptCombatRandomEvents;
  const Climate = typeof module === "object" && module.exports ? require("./climate/climate.js") : root.ConceptCombatClimate;
  const Auras = typeof module === "object" && module.exports ? require("./auras/auras.js") : root.ConceptCombatAuras;
  const Parley = typeof module === "object" && module.exports ? require("./insight/parley.js") : root.ConceptCombatParley;
  const MindDuel = typeof module === "object" && module.exports ? require("./insight/mind-duel.js") : root.ConceptCombatMindDuel; const Conversion = typeof module === "object" && module.exports ? require("./insight/conversion.js") : root.ConceptCombatConversion; const Courtroom = typeof module === "object" && module.exports ? require("./law/courtroom.js") : root.ConceptCombatCourtroom; const Dispatch = typeof module === "object" && module.exports ? require("./law/dispatch.js") : root.ConceptCombatDispatch; const Presence = typeof module === "object" && module.exports ? require("./vows/presence.js") : root.ConceptCombatPresence; const Debt = typeof module === "object" && module.exports ? require("./vows/debt.js") : root.ConceptCombatDebt; const Sealing = typeof module === "object" && module.exports ? require("./vows/sealing.js") : root.ConceptCombatSealing;   // W1.3d + W2.1 (folded: engine cap)
  const Bonds = typeof module === "object" && module.exports ? require("./bonds/bonds.js") : root.ConceptCombatBonds;
  // Plant communion (terrain/communion.js): observe a plant, answer, gain it as an ally.
  const Communion = typeof module === "object" && module.exports ? require("./terrain/communion.js") : root.ConceptCombatCommunion;
  // Tsukumogami (terrain/tsukumogami.js): observe a structure, answer, wake it as an ally.
  const Tsukumogami = typeof module === "object" && module.exports ? require("./terrain/tsukumogami.js") : root.ConceptCombatTsukumogami;
  const Traps = typeof module === "object" && module.exports ? require("./terrain/traps.js") : root.ConceptCombatTraps;
  const EmergentIdeas = typeof module === "object" && module.exports ? require("./emergent-ideas.js") : root.ConceptCombatEmergentIdeas;
  const EnemySummons = typeof module === "object" && module.exports ? require("./enemy-summons.js") : root.ConceptCombatEnemySummons;
  const Imitation = typeof module === "object" && module.exports ? require("./account/imitation.js") : root.ConceptCombatImitation;
  const Vows = typeof module === "object" && module.exports ? require("./vows/vows.js") : root.ConceptCombatVows;
  const Workflow = typeof module === "object" && module.exports ? require("./ai/workflow.js") : root.ConceptCombatWorkflow;
  const UtilityAI = typeof module === "object" && module.exports ? require("./ai/utility.js") : root.ConceptCombatUtilityAI;
  const Visitors = typeof module === "object" && module.exports ? require("./visitors/visitors.js") : root.ConceptCombatVisitors;
  if (typeof module === "object" && module.exports) module.exports = factory(Observation, Tourist, require("./emergent/postures.js"), require("./classes/president.js"), Sight, Belief, GraphLive, ClassRuntime, Director, RandomEvents, Climate, Auras, Parley, Bonds, Vows, MaidSystems, Workflow, UtilityAI, Communion, Traps, Tsukumogami, Imitation, EmergentIdeas, EnemySummons, MindDuel, Conversion, Courtroom, Dispatch, Presence, Debt, Sealing, Visitors, (() => { try { return require("fs").readFileSync(require("path").join(__dirname, "../../VERSION"), "utf8").trim(); } catch { return "dev"; } })());
  else root.ConceptCombat = factory(Observation, Tourist, root.ConceptCombatPostures, root.ConceptCombatPresident, Sight, Belief, GraphLive, ClassRuntime, root.ConceptCombatDirector, RandomEvents, Climate, Auras, Parley, Bonds, Vows, MaidSystems, Workflow, UtilityAI, Communion, Traps, Tsukumogami, Imitation, EmergentIdeas, EnemySummons, MindDuel, root.ConceptCombatConversion, root.ConceptCombatCourtroom, root.ConceptCombatDispatch, root.ConceptCombatPresence, root.ConceptCombatDebt, root.ConceptCombatSealing, root.ConceptCombatVisitors, (root.ConceptCombatBuild && root.ConceptCombatBuild.version) || "dev");
})(typeof self !== "undefined" ? self : this, function (Observation = null, Tourist = null, Postures = null, President = null, Sight = null, Belief = null, GraphLive = null, ClassRuntime = null, Director = null, RandomEvents = null, Climate = null, Auras = null, Parley = null, Bonds = null, Vows = null, MaidSystems = null, Workflow = null, UtilityAI = null, Communion = null, Traps = null, Tsukumogami = null, Imitation = null, EmergentIdeas = null, EnemySummons = null, MindDuel = null, Conversion = null, Courtroom = null, Dispatch = null, Presence = null, Debt = null, Sealing = null, Visitors = null, BUILD = "dev") {
  // The engine's parts, in install order (web/combat/engine/). Node requires them; the pages load them as scripts first.
  const ENGINE_PARTS = ["ledgers","conditions","turns","true-forms","damage","targeting","actions","resolve","window","queries","ai","focus-plans","kaiba","land","houses","tamer","tally","hires","factions","longtermism","living-map","contracts","astral","states","ante","mystery","hyper","fruit","anime-orbit","instinct","injury","cards"].map((name) => typeof module === "object" && module.exports
    ? require("./engine/" + name + ".js") : globalThis.ConceptCombatEngineParts[name.replace(/-([a-z])/g, (_m, ch) => ch.toUpperCase())]), Affinity = typeof module === "object" && module.exports ? require("./vows/affinity.js") : globalThis.ConceptCombatAffinity, VK = typeof module === "object" && module.exports ? require("./vows/vowkit.js") : globalThis.CombatVowKit;   // W4.5-6: vow-drive audit + declaration kit


  const clone = (o) => JSON.parse(JSON.stringify(o));
  const key = (x, y) => x + "," + y;
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  function engine(content, terrainData = null, mapgen = null, vegetation = null, structures = null, wildRules = null, pickupRules = null, modeRules = null, summonRules = null, summonQuestions = null, dreamSpaceRules = null, accountItems = null, insightRules = null, mirrorRules = null, bossRules = null, presidentRules = President) {
    const C = content;
    const observationH = () => ({ insightRules, Communion, Tsukumogami, Climate, paths, moveOptions:(...args)=>H.moveOptions(...args), hasSight, dreamSame, dist, actorAt, tileAt, moduleArena:(...args)=>H.moduleArena(...args), communeDiscount:(...args)=>H.communeDiscount(...args), log });
    const touristH = () => ({ paths, tileAt, actorAt, barrierAt, hasSight, dreamSame, log, plantInfo: o => ({name:vegetation?.label?.(o)||o.type,thumbnail:vegetation?.data?.species?.[o.type]?.sheet ? `combat/sprites/plants/${o.type}-3.png` : `combat/sprites/objects/${o.form||"groundcover"}.png`}), moveOptions: (...args) => H.moveOptions(...args) });
    const kaibaH = () => ({ tileAt, actorAt, barrierAt, log, seededChance: H.seededChance });
    const Performers = ClassRuntime?.performers;
    const Stealth = ClassRuntime?.stealth;
    const borrowedPools=new WeakMap();
    // Adapt authored boss sheets to the normal typed ability pipeline so their
    // attacks use the same preview, targeting, response and damage resolution.
    const bossAbilityIds = {};
    if (bossRules?.data?.bosses) for (const [bossId, bossDef] of Object.entries(bossRules.data.bosses)) {
      const ids = [], baseIds = [];
      for (const [key, source] of Object.entries({ ...bossDef.abilities, ...bossDef.enragedUnlocks })) {
        const id = `boss_${bossId}_${key}`, concept = bossDef.concepts[0], self = source.target === "self" || source.delivery === "self";
        const area = source.area?.shape ? { ...source.area, ...(source.area.shape === "cone" ? { shape: "line" } : {}) } : { shape: "single" };
        C.abilities[id] = { name: source.name, concepts: [concept], tier: source.announce ? "ultimate" : "refined", announce: source.announce || null,
          delivery: self ? "self" : source.delivery === "line" ? "line" : source.delivery === "routed" ? "routed" : "field",
          target: self ? "self" : "enemy", effect: source.effect?.startsWith("damage") && source.potency > 0 ? "damage" : self || ["territory", "lineImmune", "illusions", "swap", "hover", "heal+speed"].includes(source.effect) ? "guard" : "damage",
          area, range: area.radius || area.length || source.range || 7, routeBudget: source.routeBudget || 0,
          potency: source.potency || 0, cost: 0, tempoCost: source.tempoCost || (source.potency >= 20 ? 45 : 30),
          damageType: source.channel || "nigredo", knockback: source.knockback || 0, duration: source.duration || null,
          description: source.mechanism || source.counter || "Authored boss technique." };
        ids.push(id); if (Object.hasOwn(bossDef.abilities, key)) baseIds.push(id);
      }
      bossAbilityIds[bossId] = ids;
      C.characters[`boss-${bossId}`] = { name: bossDef.name, side: "enemy", primary: bossDef.concepts[0], secondary: bossDef.concepts[1] || bossDef.concepts[0],
        reserve: [], level: 1, ultimateCharge: 100, sprite: bossId, ai: "boss", color: "#ce7b70", bossAbilityIds: baseIds };
    }
    for (const [ch, t] of Object.entries(terrainData?.terrain || {})) C.tiles[ch] = { ...(C.tiles[ch] || {}), ...t, blocksMove: !!t.blocksMove, blocksSightAtHeight: t.sightHeight || 0, ramp: (t.tags || []).includes("ramp") };
    const ab = (id) => C.abilities[id];
    const conceptName = (id) => (C.concepts[id] ? C.concepts[id].name : id || "universal");
    const presidentEffects = new Set(["presidentOffice", "presidentDirection", "presidentLaw", "presidentPromise", "presidentGuarantee", "presidentCommitment", "presidentAccord"]);
    // The living, plus anyone a standing promise names: a promise to defeat someone is kept by their defeat, so the
    // fallen target has to be on the list (at 0 LF) or the promise could never be seen as kept.
    const promised = (s) => new Set(Object.values(s.actors).map(u => !u.defeated && u.promise?.kind === "defeat" && u.promise.target).filter(Boolean));
    const fallenUnit = (u) => ({ id:u.id, side:u.side, x:u.x, y:u.y, lf:0, maxLF:u.maxLF, phi:0, abilities:[], passives:[], willing:false });
    const presidentUnits = (s, named = promised(s)) => Object.values(s.actors).filter(u => !u.defeated || named.has(u.id)).map(u => u.defeated ? fallenUnit(u) : ({ id:u.id, side:u.side, x:u.x, y:u.y, lf:u.lf, maxLF:u.maxLF, phi:u.pf,
      abilities:abilitiesOf(u), passives:u.character==="president"?["mandate","coalition"]:[], willing:u.willing!==false, ...(u.office?{office:u.office}:{}), ...(u.promise?{promise:u.promise}:{}),
      ...(u.mandate?{mandate:true}:{}), ...(u.debt?{debt:true}:{}), ...(u.outlaw?{outlaw:true}:{}), ...(u.committed?{committed:u.committed}:{}), ...(u.exposedFalseClaim?{exposedFalseClaim:true}:{}),
      ...(u.revealedFalseTell?{revealedFalseTell:true}:{}), ...(u.law?{law:u.law}:{}), ...(u.accord?{accord:u.accord}:{}) }));
    const presidentContext = (s) => ({ round:s.round, opaque:(x,y)=>!hasSight(s,x.x,x.y,y.x,y.y),
      domains:(s.terrainEffects||[]).filter(e=>e.kind==="closedDomain").map(e=>({owner:s.actors[e.owner]?.side||"",tiles:(e.tiles||[]).map(([x,y])=>key(x,y))})),
      grid:{w:s.arena.w,h:s.arena.h,blocked:Array.from({length:s.arena.h},(_,y)=>Array.from({length:s.arena.w},(_,x)=>tileAt(s,x,y).blocksMove?key(x,y):null)).flat().filter(Boolean)} });
    function syncPresidentUnit(s, u) { const a=s.actors[u.id]; if(!a)return; for(const k of ["office","promise","mandate","debt","law","outlaw","committed","accord","order"]) if(Object.hasOwn(u,k)) a[k]=u[k]; a.pf=u.phi; if (u.kept) keptWord(s, a);
      // Someone who has promised to defeat a named opponent goes after that opponent until the promise resolves.
      if (a.promise?.kind === "defeat" && a.promise.target && a.forceTarget !== a.promise.target && s.actors[a.promise.target] && !s.actors[a.promise.target].defeated) { a.forceTarget = a.promise.target; a.forceTargetUntil = a.promise.by; } }
    // rules.commitments.keptCharge: a kept promise feeds the ultimate.
    function keptWord(s, a) {
      const gain = s.rules.commitments?.keptCharge || 0, max = s.rules.ultimateChargeMax, before = a.ultimateCharge || 0; if (!gain || a.defeated) return;
      a.ultimateCharge = Math.min(max, before + gain);
      if (a.ultimateCharge > before) log(s, { kind: "promise", actor: a.id, kept: true, text: `${a.name} kept their word: +${a.ultimateCharge - before} ultimate charge.`, why: ["A promise that was open when it was made, and was kept."] });
    }
    // ClassRuntime helpers: the engine primitives the class runtime is allowed to use.
    const relayH = () => ({ ...classH(), strikeRange: (s, a) => H.strikeRange(s, a), manifest: (s, a, id) => manifest(s, a, id), target: (...p) => H.target(...p) });
    const classH = () => ({ States: H.States, Observation: H.Observation, Hires: H.Hires, spreadIdea: (...x) => H.spreadIdea(...x), Traps, insightRules, Longtermism: H.Longtermism, Dispatch, Courtroom, vesselOf: (s, a) => H.vesselOf?.(s, a), summonPack: (s, a) => H.summonPack?.(s, a), itemName: (id) => pickupRules?.sources?.[id]?.name || accountItems?.consumables?.[id]?.name || id, exposure: H.Exposure, abilitiesOf: (a) => abilitiesOf(a), inspire: (s, a, n, why) => H.Inspiration.gain(s, a, n, why), inspireWitnesses: (s, at, key, except) => H.Inspiration.witness(s, at, key, except), rollSession: (s, a, n) => H.Inspiration.rollSession(s, a, n), spendInspiration: (s, a, n) => H.Inspiration.spend(s, a, n), line, log, hit, knock, dist, actorAt, inside, tileAt, barrierAt, heightAt, addStun, waterAt: H.waterAt, surfaceAt, C, seededChance, dreamSame, hasSight: (s, ...p) => hasSight(s, ...p), actor: (s, id) => s.actors[id], startTurn: (s) => H.startTurn(s), freshBody: (b, s) => H.freshBody(b, s),
      ability:id=>ab(id), conceptChannel:id=>C.conceptDamageTypes[id], accountItems,
      releaseSong:(s,a,radius)=>{for(const u of Performers.units(s))if(dist(s,a.x,a.y,u.x,u.y)<=radius&&dreamSame(s,a.x,a.y,u.x,u.y)&&s.actors[u.status?.held?.by]?.side!==u.side)delete u.status?.held;
        s.terrainEffects=(s.terrainEffects||[]).filter(e=>!(e.kind==="pastedFragment"&&e.side!==a.side&&e.tiles.some(([x,y])=>dist(s,a.x,a.y,x,y)<=radius&&dreamSame(s,a.x,a.y,x,y))));},
      shareTell:(s,a,tell)=>{if(s.knowledge[a.id]?.[tell.actor]){s.knowledge[a.id][tell.actor].abilities||={};s.knowledge[a.id][tell.actor].abilities[tell.ability]=true;}},
      canReach:(s,a,u)=>dreamCanReach(s,a,{ability:"consonance",concept:"harmony",effect:"classEffect"},u.x,u.y),
      canHear:(s,a,u)=>{
        if(!dreamCanReach(s,a,{ability:"lullaby",concept:"harmony",effect:"classEffect"},u.x,u.y)||u.status?.membrane)return false;
        const steps=Math.max(Math.abs(u.x-a.x),Math.abs(u.y-a.y));
        for(let i=1;i<steps;i++){const x=Math.round(a.x+(u.x-a.x)*i/steps),y=Math.round(a.y+(u.y-a.y)*i/steps);if(s.arena.map[y]?.[x]==="#"||barrierAt(s,x,y))return false;}return true;
      },
      borrowPool:(s,a,refined)=>{
        let cached=borrowedPools.get(s);if(!cached){cached=new Map();borrowedPools.set(s,cached);}const k=a.id+":"+refined;
        if(cached.has(k))return cached.get(k).slice();
        const ids=Performers.pool(a,C,refined).filter(id=>{const m=manifest(s,a,id);
          if(m.target==="self")return target(s,a,m,a.x,a.y).ok;
          if(["enemy","ally","unit"].includes(m.target))return [...Object.values(s.actors),...(s.wild||[]).filter(u=>u.form==="unit")].some(u=>!u.defeated&&target(s,a,m,u.x,u.y).ok);
          for(let y=0;y<s.arena.h;y++)for(let x=0;x<s.arena.w;x++)if(target(s,a,m,x,y).ok)return true;return false;});cached.set(k,ids);return ids.slice();
      },
      borrowPerform:(s,a,id,x,y,mul,channel)=>{if(ab(id)?.contract&&a.contractPermit?.id!==id)return false;const m=manifest(s,a,id);if(Vows?.refuses(s,a,"ability",ab(id))||Performers.beforeAbility(s,a,m))return false;const t=target(s,a,m,x,y);if(!t.ok)return false;resolveAbility(s,a,{...m,...t,damageType:channel||m.damageType,owner:a.id,origin:[a.x,a.y],sourceHeight:heightAt(s,a.x,a.y),aim:[x,y],performanceEcho:true,mult:(m.mult||1)*mul});return true;},
      cyphBars:(s,a,x,y)=>Object.entries(C.abilities).filter(([id,d])=>d.tier==="basic"&&!d.merge&&!d.pairs&&(!d.timing||d.timing==="immediate")&&!d.announce&&d.effect==="damage"&&d.target==="enemy"&&d.area?.shape==="single"&&!d.concepts.some(c=>[a.primary,a.secondary].includes(c))).map(([id,d])=>({id,name:d.name,potency:d.potency,m:manifest(s,a,id)})).filter(b=>target(s,a,b.m,x,y).ok),
      cyphPerform:(s,a,id,x,y,mul)=>{const m=manifest(s,a,id),t=target(s,a,m,x,y);if(t.ok)resolveAbility(s,a,{...m,...t,aim:[x,y],mult:(m.mult||1)*mul});}
    });
    // holder is undefined when the would-be director is already down (presidentUnits lists the standing only), which a
    // previewed turn can reach; nobody recognizes an office nobody holds (sim seed 9904 threw here).
    function presidentCanRecognize(s, holder, ally) { return (holder && presidentRules?.recognizers(holder,presidentUnits(s),presidentContext(s)).includes(ally.id)) || false; }
    const hasDeception = (a) => a.primary === "deception" || a.secondary === "deception";
    const declaredRange = (m) => m.area.shape === "radius" ? m.area.radius : m.delivery === "routed" ? m.routeBudget : m.range;
    function rangeEnvelope(s, a, range) {
      const tiles = [];
      for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++)
        if ((x !== a.x || y !== a.y) && dist(s, a.x, a.y, x, y) <= range) tiles.push([x, y]);
      return tiles;
    }

    function randomEncounterOptions(seed, playerLoadout = {}, terrainChoice = "random", eventContext = {}) {
      let state = (seed >>> 0) || 0x6d2b79f5;
      const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
      const roster = Object.entries(C.characters).filter(([id, ch]) => id !== "warden" && id !== "police_officer" && id !== eventContext.mainCharacter && !ch.permanentAlly && !ch.randomEventOnly && Array.isArray(ch.configs)).map(([id]) => id);   // police never spawn in randomized raids: they respond to harm done
      for (let i = roster.length - 1; i > 0; i--) { const j = next() % (i + 1); [roster[i], roster[j]] = [roster[j], roster[i]]; } H.Factions?.feudSafe(C.rules, roster);   // feuding crews never share the enemy side (docs/ramayana-faction.md §2a)
      // Mala, 2026-10-09: the Random Encounter button "randomizes everything about the scenario": objective, terrain,
      // opponent count (1–4), a starting ally, weather and who moves first, on a separate roll stream so the plain
      // seeded encounter stays identical.
      const everything = !!eventContext.everything;
      let st2 = ((seed ^ 0x51ed2701) >>> 0) || 1;
      const roll = (n) => { st2 = (Math.imul(st2, 1664525) + 1013904223) >>> 0; return (st2 >>> 8) % n; };
      if (everything && terrainData) {
        const designed = Object.keys(terrainData.arenas || {}).filter((id) => id !== "warfareField" && !terrainData.arenas[id].interior && !terrainData.arenas[id].setPiece);   // interiors (the ship) and set pieces (Heart Court) are reached by mission, never rolled
        const pick = roll(designed.length + 3);
        terrainChoice = pick < 3 ? "random" : designed[pick - 3];   // generated maps weighted ×3
      }
      const count = everything ? 1 + roll(4) : 1 + ((Math.imul(((seed ^ 0x2c1b3c6d) >>> 0) || 1, 1664525) + 1013904223) >>> 8) % 3;   // own hash: the shuffle's stream length grows with the roster, and at some lengths every seed rolled the same count (Ravana, 2026-10-24)
      const maxLF = count === 1 ? 100 : count === 2 ? 55 : count === 3 ? 38 : 30;
      const spots = count === 1 ? [[7, 2]] : count === 2 ? [[7, 1], [7, 3]] : count === 3 ? [[7, 0], [7, 2], [7, 4]] : [[7, 0], [7, 2], [7, 4], [6, 1]];
      const participants = [{ id: "player", character: "warden", side: "player", at: [1, 2] }];
      for (let i = 0; i < count; i++) participants.push(count === 1 && i === 0 && ((seed ^ 0x7a11e9) >>> 0) % 6 === 0 && bossRules?.data?.bosses?.tallyman ? { id: "random-foe-1", character: "boss-tallyman", boss: "tallyman", side: "enemy", at: spots[0], size: { ...bossRules.data.bosses.tallyman.size }, maxLF: bossRules.data.bosses.tallyman.lf, startingLF: bossRules.data.bosses.tallyman.lf } : { id: `random-foe-${i + 1}`, character: roster[i], side: "enemy", at: spots[i], maxLF });   // the Tallyman walks the roads (Mala, 2026-10-19): rare 1v1, independent hash, no stream moves
      let arenaData = null;
      if (mapgen && terrainData) {
        if (terrainChoice === "random" || terrainChoice === "generated" || !terrainChoice) arenaData = mapgen.generate({ seed: (seed + 0x9e3779b9) >>> 0 });
        else if (terrainData.arenas[terrainChoice]) arenaData = mapgen.designed(terrainChoice);
        if (arenaData && vegetation) arenaData = vegetation.populate(arenaData, { seed: (seed ^ 0xa5a5a5a5) >>> 0 });
        const ps = arenaData?.spawns?.player || [], es = arenaData?.spawns?.enemy || [];
        if (ps.length) participants[0].at = ps[0];
        participants.slice(1).forEach((p, i) => { if (es[i]) p.at = es[i]; });
      }
      const startingAllies=["arantxa","archivist",...roster.slice(count)].filter(id=>id!==eventContext.mainCharacter&&(!H.Factions||H.Factions.fits(C.rules,id,[eventContext.mainCharacter])));
      const scenario = everything ? {
        // Escape and Assassinate are archived (modes.js); the six-way roll is kept so seeds still spread the same way.
        objective: ["classic", "classic", "survive", "totalVictory", "escape", "assassinate"].map((id) => modeRules?.modes?.[id]?.archived ? "classic" : id)[roll(6)],
        ally: RandomEvents?.favoredAlly ? RandomEvents.favoredAlly(C, eventContext.mainCharacter, startingAllies, participants, roll) : roll(100) < 35 ? startingAllies[roll(startingAllies.length)] : null,   // The Errand: random-events.js
        theyOpen: roll(100) < 35,
        terrain: terrainChoice === "random" ? `${String(arenaData?.name || arenaData?.archetype || "Open").split(" · ")[0]} (generated)` : (terrainData?.arenas?.[terrainChoice]?.name || terrainChoice),
      } : null;
      if (scenario?.ally) {   // a companion from the start, beside the player
        const [px, py] = participants[0].at, ps = arenaData?.spawns?.player || [];
        // No second player spawn: stand beside the player, on the map (below first, as before; an arena whose player
        // spawn is on its last row used to put the ally one row off the bottom).
        const rows = arenaData?.map, onMap = ([x, y]) => !rows || (y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && !C.tiles[rows[y][x]]?.blocksMove && !participants.some((q) => q.at && q.at[0] === x && q.at[1] === y));
        const beside = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => [px + dx, py + dy]).find(onMap) || [px, Math.max(0, py - 1)];
        participants.push({ id: "random-ally-1", character: scenario.ally, side: "player", at: ps[1] || beside });
      }
      const allyPool = (eventContext.foughtBeside || ["arantxa"]).filter((id) => C.characters[id]);   // defense in depth: old accounts may hold plant-* or boss ids (undefined-ally fix)
      const reinforcements = roster.filter((id) => !participants.slice(1).some((p) => p.character === id) && (!H.Factions || H.Factions.fits(C.rules, id, participants.filter((p) => p.side === "enemy").map((p) => p.character))));   // feud: never beside a feuding crew
      const [favored, foeFavored] = RandomEvents?.favorsBySide?.(C, eventContext.mainCharacter, participants) || [[], []], eventSchedule = RandomEvents?.create(seed, { allies: [...allyPool, ...favored.filter((id) => !allyPool.includes(id))].filter((id) => !H.Factions || H.Factions.fits(C.rules, id, [eventContext.mainCharacter, ...participants.filter((p) => p.side === "player").map((p) => p.character)])), favored, foeFavored, opponents: participants.slice(1).map(p => p.character), fits: (id, side) => !H.Factions || H.Factions.fits(C.rules, id, side), roster: reinforcements, archivistStart: eventContext.mainCharacter === "archivist" || participants.some(p => p.character === "archivist" && p.side === "player") })?.filter(e=>e.type!=="ally"||e.character!==eventContext.mainCharacter) || [];   // The Errand (random-events.js)
      participants.push(...eventParticipantsFor(eventSchedule, participants, arenaData));
      const startPhase = roll(100) < 50 ? "night" : "day";   // rules.time: a random encounter rolls where the clock starts
      const out = { encounter: "randomEncounter", startPhase, ...(C.characters[eventContext.mainCharacter] ? {mainCharacter:eventContext.mainCharacter} : {}), seed: seed >>> 0, randomizeNPCs: true, randomEventSchedule: eventSchedule,
        startingActor: "player", participants, arenaData, loadouts: { player: clone(playerLoadout) } };
      if (scenario) {
        const objName = { classic: "Classic", survive: "Survive", totalVictory: "Total victory", escape: "Escape", assassinate: "Assassinate" }[scenario.objective];
        Object.assign(out, { mode: scenario.objective, rollWeather: true, scenario,
          startingActor: scenario.theyOpen ? participants[1].id : "player",
          title: `Random scenario: ${objName} · ${scenario.terrain} · ${count} opponent${count === 1 ? "" : "s"}${scenario.ally ? ` · with ${C.characters[scenario.ally]?.name || scenario.ally}` : ""} · ${scenario.theyOpen ? "they move first" : "you move first"}` });
      }
      return out;
    }
    // The units a schedule's events will bring, each given an edge tile now and a round to arrive in. Fills each
    // event's actorIds. Used by random encounters and by Warfare.
    function eventParticipantsFor(eventSchedule, participants, arenaData) {
      const occupied = new Set(participants.map(p => key(...p.at)));
      const edgeSpawn = () => {
        const map = arenaData?.map || C.arenas.gapCourt.map, H = map.length, W = map[0].length;
        const candidates = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (!(x === 0 || y === 0 || x === W - 1 || y === H - 1) || occupied.has(key(x, y))) continue;
          const ch = map[y][x], tile = terrainData?.terrain?.[ch];
          if (ch === "#" || ch === "~" || tile?.blocksMove || (arenaData?.objects || []).some(o => o.x === x && o.y === y && o.blocksMove)) continue;
          candidates.push([x, y]);
        }
        candidates.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
        const at = candidates[0] || [Math.min(1, W - 1), Math.min(1, H - 1)]; occupied.add(key(...at)); return at;
      };
      const eventParticipants = [];
      for (const event of eventSchedule) {
        let specs = [];
        if (event.type === "ally") specs = [{ character: event.character, side: "player", role: "ally" }];
        if (event.type === "visitors" && Visitors) specs = Visitors.specs(event);
        if (event.type === "reinforcements") specs = event.characters.map(character => ({ character, side: "enemy", role: "reinforcement" }));
        if (event.type === "supervillain") specs = [
          { character: "super_villain", displayName: "Super Villain", sprite: "super-villain", loadout: { primary: "deception", secondary: "pathway" }, traits: ["genius"], side: "villain", role: "supervillain", arrivesRound: event.round },   // shared villain faction (was a singleton side per event)
          ...event.heroes.map((hero, i) => ({ character: hero === "superHeroine" ? "super_heroine" : "super_hero", displayName: hero === "superHeroine" ? "Super Heroine" : "Super Hero", sprite: hero === "superHeroine" ? "super-heroine" : "super-hero", loadout: hero === "superHeroine" ? { primary: "elasticity", secondary: "resonance" } : { primary: "barrier", secondary: "adaptation" }, side: "hero", role: "superhero", arrivesRound: event.heroRound })),   // shared hero faction (hero + heroine are allies now)
        ];
        event.actorIds = specs.map((spec, i) => {
          const id = `event-${spec.role}-${event.id}-${i + 1}`;
          eventParticipants.push({ id, character: spec.character, name: spec.displayName, sprite: spec.sprite, eventLoadout: spec.loadout, traits: spec.traits,
            side: spec.side, at: edgeSpawn(), arrivesRound: spec.arrivesRound || event.round, eventActor: true, eventRole: spec.role,
            ...(spec.role === "superhero" ? { arrivesFor: `event-supervillain-${event.id}-1` } : {}),   // heroes come for the villain; a beaten villain means they never arrive
            ...(event.aggressive && spec.role === "reinforcement" ? { aggressive: true } : {}) });
          return id;
        });
      }
      return eventParticipants;
    }
    // Warfare (Mala, 2026-10-11): the fixed three-faction encounter with the scaled-up event schedule
    // (random-events.js profiles.warfare) and its arrivals. Spread the result into create()'s options.
    function warfareEventOptions(seed, eventContext = {}) {
      const base = clone(C.encounters.warfare.actors), arenaData = terrainData?.arenas?.[C.encounters.warfare.arena] || C.arenas?.[C.encounters.warfare.arena] || null;
      const taken = new Set(base.map(p => p.character));
      const roster = Object.entries(C.characters).filter(([id, ch]) => id !== "warden" && id !== eventContext.mainCharacter && !ch.permanentAlly && !ch.randomEventOnly && Array.isArray(ch.configs) && ch.configs.length && !taken.has(id)).map(([id]) => id);
      const schedule = RandomEvents?.create(seed, { mode: "warfare", allies: (eventContext.foughtBeside || ["arantxa"]).filter((id) => C.characters[id]).filter((id) => !H.Factions || H.Factions.fits(C.rules, id, base.filter(p => p.side === "player").map(p => p.character))), opponents: base.filter(p => p.side === "enemy").map(p => p.character), fits: (id, side) => !H.Factions || H.Factions.fits(C.rules, id, side), roster,
        archivistStart: eventContext.mainCharacter === "archivist" })?.filter(e => e.type !== "ally" || (e.character !== eventContext.mainCharacter && !taken.has(e.character))) || [];
      return { randomEventSchedule: schedule, participants: [...base, ...eventParticipantsFor(schedule, base, arenaData)] };
    }

    // ── creation ────────────────────────────────────────────────────────────
    // A character with several looks (Arantxa's gowns) wears a seeded-random one when she fights beside the player.
    // (The Actor's alternating costumes live in queries.js actorLook: the core is on a line budget.)
    function allyLook(a, ch, seed) {
      if (!ch.variants?.length || a.id === "player" || (a.side || ch.side) !== "player") return null;
      let h = 2166136261;
      for (const char of `${seed ?? 0}:${a.id}:look`) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0;
      h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13;
      return ch.variants[(h >>> 0) % ch.variants.length];
    }
    function archivistTestOptions() {
      return {...focusedDreamTestOptions(),summonTrueFormTest:false,archivistTest:true,title:"The Archivist · ally test",initialSummons:[],participants:[{id:"player",character:"warden",at:[4,3]},{id:"archivist",character:"archivist",side:"player",at:[3,3]},{id:"student",character:"student",side:"enemy",at:[6,3]}]};
    }
    function summonTrueFormTestOptions(key="mitsuko") {
      const options=focusedDreamTestOptions();
      return {...options,summonTrueFormTest:true,title:`${key} Reveal Effect · playable test 3`,initialSummons:[{key,owner:"player",at:[3,3]}]};
    }
    function summonProfile(s, id) {
      const actor = s.actors[id], base = { apCost: summonRules?.data.rules.actionCost ?? 80, phiCost: summonRules?.data.rules.phiCost ?? 8 };
      const field = dreamSpaceRules?.contains(s.dreamSpace, actor?.x, actor?.y) ? s.dreamSpace : null;
      const cost = dreamSpaceRules ? dreamSpaceRules.summonCost(field, base) : base;
      const profile = EmergentIdeas ? EmergentIdeas.summonProfile(actor, cost, summonRules?.data.rules.maxActive ?? 1) : { ...cost, maxActive: summonRules?.data.rules.maxActive ?? 1, wardProtection: 0 };
      if (field && actor?.widenedPalace) profile.maxActive += 1;   // Widened Palace dream slot
      return { ...profile, active: Object.values(s.actors).filter(u => EmergentIdeas?.summonerOf(u) === id && EmergentIdeas.summonPresent(u)).map(u => u.id) };
    }
    function summonQuestionHints(s, id) {
      const a = s.actors[id];
      return (a?.passives?.questionHint || 0) + (s.summonHintCount || 0) + (EmergentIdeas?.rehearsalHints(a) || 0);
    }
    function summonReadiness(s, id, summon, unlocked = s.unlockedSummons || []) {
      const actor = s.actors[id];
      if (!actor || actor.defeated || actor.lf <= 0) return { ok: false, reason: "Choose a living summoner." };
      if (actor.form?.golden) return { ok: false, reason: "The Integrated Self has no need to summon." };
      if (!summonRules || !summonQuestions) return { ok: false, reason: "Summoning is unavailable." };
      if (!summonRules.callsPalace(actor)) return { ok: false, reason: "Only the Warden calls the palace." };
      return summonRules.canSummon({ ...summonProfile(s, id), used: s.summonUsed, ap: actor.tempo, pf: actor.pf }, summon, { unlocked });
    }
    function proficientSummonerTestOptions() {
      return { encounter: "firstWall", focusedDreamTest: true, proficientSummonerTest: true, title: "Proficient Summoner · emergent idea test", seed: 43, startingActor: "player", initialSummons: [],
        arenaData: { name: "Emergent Ideas test", map: Array(7).fill("..........."), objects: [] },
        participants: [{ id: "player", character: "warden", side: "player", at: [3,3] }, { id: "student", character: "student", side: "enemy", at: [9,3] }],
        loadouts: { player: { primary: "barrier", secondary: "imagination", reserve: ["elasticity"], traits: ["fullBeliever"] } } };
    }
    // A practice battle for Contains Multitudes: full Inspiration and a ledger with a few classes already in it, so it
    // can be tried without earning either. Practice: nothing is saved, and nothing is written to the real ledger.
    function multitudesTestOptions() {
      const beaten = ["ranger", "soldier", "hypebeast", "tech_billionaire", "samurai"].filter((id) => C.characters[id]);
      return { encounter: "firstWall", focusedDreamTest: true, multitudesTest: true, title: "Contains Multitudes · test", seed: 47, startingActor: "player", initialSummons: [],
        arenaData: { name: "Multitudes test", map: Array(7).fill("..........."), objects: [] }, inspiration: C.rules.inspiration?.cap ?? 3,
        victories: Object.fromEntries(beaten.map((id) => [id, { name: C.characters[id].name, count: 1, config: null, primary: C.characters[id].primary || null, secondary: C.characters[id].secondary || null }])),
        participants: [{ id: "player", character: "warden", side: "player", at: [3, 3] }, { id: "student", character: "student", side: "enemy", at: [8, 3] }, { id: "soldier", character: "soldier", side: "enemy", at: [9, 5] }] };
    }
    function liveSummon(s,owner,raw) {
      const summon = {...owner,...raw,side:owner.side,sprite:raw.character,form:null,formCooldownUntil:0,traits:[],ai:"summon",controller:"ai",pf:s.rules.maxPF,maxPF:s.rules.maxPF,
        ultimateCharge:0,level:owner.level,xp:0,proficiency:owner.proficiency,reserve:[],reserveSlots:0,pendingSwap:null,lens:{},reaction:s.rules.reactionsPerRound,
        moved:false,acted:false,tempo:0,tempoCapacity:0,bankedTempo:0,tempoDebt:0,tempoSpent:0,actionsThisTurn:0,guardUsedThisTurn:false,
        ownerTurns:0,lastRecoverTurn:-99,status:{guard:null,ward:null,parry:null,membrane:null,anchor:null,stun:null,entangled:null},inventory:[],inventoryCapacity:0,
        passives:{},lanyardUsed:false,bristleconeUsed:false,lastDamageType:null,rite:null,ritual:null,riteAugment:null,beads:null,learned:[],defeated:false};   // fresh hands: rites, rituals, augments, beads and learned techniques stay with the summoner (the Genghis bead-theft; the Mitsuko audition)
      // A summon's own chance traits (summons-data.js chanceTraits; the Inner Child is usually Imaginative). One seeded roll each.
      summonRules?.freshen?.(summon); { const own = summonRules?.data?.summons?.[raw.character]?.chanceTraits;
        if (own) summon.traits = [...new Set([...(summon.traits || []), ...own.filter(([t, p]) => H.seededChance(`${s.seed}:summon:${raw.character}:${t}`) < p).map(([t]) => t)])]; }
      EmergentIdeas?.refreshSummonWard(s, summon);
      return summon;
    }
    // Death's door (summons-data.js rules.deathDoor): the summoner goes down with action points unspent, and a summon
    // may arrive unbidden. The summoner stays down; the loss waits for the summon to leave or fall.
    const WX = { sunbakedInHeat: -3, shelterInWind: 1, shadeInSun: 0.5, perMultiplier: 6, perRange: 0.5, ...(C.rules.weatherAiWeights || {}) };   // C13
    const weatherTileValue = (state, m) => !state || !m ? 0 : (state.id === "heat" && m.sunbaked ? WX.sunbakedInHeat : 0) + (["windy", "squall"].includes(state.id) && m.sheltered ? WX.shelterInWind : 0) + (["sunny", "heat"].includes(state.id) && m.shade ? WX.shadeInSun : 0);
    // C15 (Muse batches 13-15): Meditate turns action points into ultimate charge; Contemplative does it well and
    // often, Restless badly and rarely, and Restless dodges cheaply instead. Numbers: content.js rules.meditate.
    const MED = { ap: 40, gain: 25, contemplativeGain: 35, restlessGain: 15, aiBelowScore: 3, aiGate: 0.5, contemplativeGate: 0.8, restlessGate: 0.2, idleGate: 0.6, restlessDodgeOff: 20, ...(C.rules.meditate || {}) };
    const dodgeCostFor = (s, u, attackerId = null) => Math.max(0, (s.rules.reactionDodgeApCost ?? 50) - (hasTrait(u, "restless") ? MED.restlessDodgeOff : 0) - (s.rules.cybernetic && hasTrait(u, s.rules.cybernetic.trait) ? s.rules.cybernetic.dodgeOff : 0) - (u && u.primary === "stealth" && u.secondary === "deception" ? 10 : 0)) * (hasTrait(u, "insaneReflexes") ? 0.5 : 1) * (ClassRuntime?.actor && attackerId ? ClassRuntime.actor.reactionTax(s, u, attackerId) : 1);   // Cybernetic: −15; the Thief's getaway: −10; GDP taxes dodges off the star's attacks
    let H_hasTrait = () => false;   // bound once the parts are installed (hasTrait lives in conditions.js)
    // Craftsman's Mindset (content.js concepts.craftsmanship.craft.mindset): the rule if this unit holds the trait.
    const mindset = (a) => { const K = C.concepts.craftsmanship?.craft?.mindset; return K && a && H_hasTrait(a, K.trait) ? K : null; };
    const craftMax = (a) => { const K = C.concepts.craftsmanship?.craft; return K ? K.maxStacks + (K.mindset && H_hasTrait(a, K.mindset.trait) ? K.mindset.stackAdd : 0) : 0; };
    const CRAFT = C.concepts.craftsmanship?.craft || null, CRAFT_OWN = new Set(["measureTwice", "honedEdge", "masterwork"]);
    // C17 shade rest and C18 capture ritual + beads (Muse sandbox batches 17, 19a, 19b). Muse's numbers.
    const SHADE = { ap: 10, weather: ["heat", "sunny"], ...(C.rules.shadeRest || {}) };
    const RITUAL = { ap: 30, range: 4, turns: 2, weakBelow: 0.4, beadAp: 20, beadLfMul: 0.5, beadTurns: 3, aiStart: 0.6, aiRelease: 0.4, ...(C.rules.ritual || {}) };
    const REVEAL = { demonstratedAt: 2, observeBonus: 1, ...(C.rules.reveal || {}) };   // C10
    const INTERDICT = { holdWithin: 2, trapWithin: 3, ...(C.rules.interdict || {}) };   // C12 escape interdict
    // ── Traps (terrain/traps.js; Muse batches 8 and 12, C9 and C14; C26: triggers are positional).
    // Stepping on a live trap always springs it, aware or not, either side; knowledge only shapes
    // movement (the AI walks round known traps, and the map shows the player what they know).
    // Called from applyEntryEffects, so walking, charging and being thrown onto a tile all go through here.
    function springTraps(s, source, unit, x, y) {
      if (!Traps || unit.defeated) return;
      for (const tp of Traps.live(s.traps, x, y)) {
        const helpless = (source && source.id !== unit.id) || !!unit.routed;   // thrown in, or running blind
        const aware = Traps.known(unit, tp);
        if (s.preview) continue;
        tp.spent = true; tp.trips = (tp.trips || 0) + 1;
        const before = unit.lf; unit.lf = Math.max(0, unit.lf - tp.potency);
        unit.pain = { v: Math.min(1, (unit.pain?.v || 0) + (before - unit.lf) / (unit.maxLF || 30)), round: s.round };
        (s.trapLog ||= []).push({ victim: unit.id, x, y, aware, dmg: before - unit.lf, helpless });
        const verb = helpless ? (unit.routed ? "runs straight into a hidden trap" : "is thrown onto a hidden trap") : aware ? "walks into a known trap" : "triggers a hidden trap";
        log(s, { kind: "trap", actor: unit.id, target: tp.owner, tiles: [[x, y]], amount: before - unit.lf, sprung: true,
          text: `${unit.name} ${verb} at (${x},${y}): ${before - unit.lf} LF.`,
          why: [`Set by ${s.actors[tp.owner]?.name || "someone"}. ${aware && !helpless ? "Knowing does not save you; only staying off does." : `It was ${Math.round(tp.hidden * 100)}% hidden.`}`] });
        H.concentrationCheck?.(s, unit, before - unit.lf); if (unit.lf <= 0 && !unit.defeated) { unit.defeated = true; log(s, { kind: "defeat", target: unit.id, text: `${unit.name} is defeated by a hidden trap.` }); H.pactLeave(s, unit); { const Spirit = (typeof module === "object" && module.exports ? require("./spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null; Spirit?.onDeath?.(s, unit, tp.owner ?? null, H); } { const OD = typeof module === "object" && module.exports ? require("./spirit/orders.js") : globalThis.ConceptCombatOrders; OD?.onDeath?.(s, unit, H); } checkOutcome(s); }
      }
      // C26 spotting: from beside a hidden trap you may notice it; spotted traps are shown and known.
      for (const tp of (s.traps || []).filter(t => !t.spent && (t.x !== x || t.y !== y) && Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) <= 1)) {
        if (Traps.known(unit, tp)) continue;
        if (Traps.notices(unit, tp, s.seed, false) && !(unit.trapSeen && unit.trapSeen[Traps.tkey(tp)])) {
          (unit.trapSeen ||= {})[Traps.tkey(tp)] = true; tp.hidden = 0;   // once pointed out, everyone can see it
          (s.trapLog ||= []).push({ victim: unit.id, x: tp.x, y: tp.y, aware: true, dmg: 0 });
          log(s, { kind: "trap", actor: unit.id, tiles: [[tp.x, tp.y]], spotted: true, text: `${unit.name} spots a hidden trap at (${tp.x},${tp.y}).` });
        }
      }
    }
    // ── C8 fear and rout (Muse sandbox batch 7; rout movement added on port, 2026-10-10). A clean hit on a unit whose ego
    // is already under 0.3 rolls a seeded fear check. Allies within 3 tiles steady it; the last one standing panics.
    // A unit that fails is ROUTED: it stops fighting and runs for the nearest map edge, where it leaves the battle
    // ("fled in fear"). It can be hit, and can run into things, on the way. Numbers: content.js rules.fear.
    const FEAR = { heroDown: 0.35, loyalResist: 0.15, egoBelow: 0.3, base: 0.5, steadyPerAlly: 0.15, steadyMax: 0.6, steadyRadius: 3, timidMul: 1.5, lastStandingMul: 1.5, lfPow: 1.5, ...(C.rules.fear || {}) };
    // Classic dream monsters (dream/enemy-monsters.js); a monster is an actor with `monster`.
    const EM = dreamSpaceRules?.enemyMonsters || null;
    function create(opts = {}) {
      const enc = C.encounters[opts.encounter || "gapCourt"];
      const rules = { ...C.rules, ...(opts.rules || {}) };
      const arena = opts.arenaData || C.arenas[opts.arena || enc.arena];
      const rawHeight = opts.height || arena.height || arena.map.map((row) => Array(row.length).fill(0));
      const height = rawHeight.map((row) => typeof row === "string" ? Array.from(row, Number) : row);
      if (height.length !== arena.map.length || height.some((row, y) => row.length !== arena.map[y].length || row.some((h) => !Number.isInteger(h) || h < 0 || h > 3)))
        throw new Error("Arena height must match the map and use integer levels 0–3.");
      opts = H.withHunter(opts, enc, arena);   // OP1 §6: a posted head draws a hunter (engine/fruit.js)
      const s = {
        v: 1, build: BUILD, receiptId: opts.receiptId || null, encounter: opts.encounter || "gapCourt", mode: opts.mode || "classic", modeSetup: null, themedBattle: opts.themedBattle || null, sealedFight: opts.sealedFight, vignette: opts.vignette ? { ...clone(opts.vignette), objectiveProgress: opts.vignette.objectiveProgress || 0, lastObjectiveRound: 0 } : null, rules, seed: opts.seed ?? 0, seeds: opts.seeds || 0,   // W5.3 jackpot
        time: { phase: opts.startPhase === "night" ? "night" : "day", startPhase: opts.startPhase === "night" ? "night" : "day" }, nightWildIds: [],
        randomEventSchedule: clone(opts.randomEventSchedule || []), randomEventWildIds: [], randomDreamRift: null, randomTerrainChanges: [],
        weatherState: opts.weatherState || ((opts.randomEventSchedule?.length || opts.rollWeather) && Climate ? Climate.rollWeather(arena, { seed: opts.seed ?? 0, archetype: arena.archetype }) : null),
        placeObservation: null,
        arena: { ...clone(arena), name: arena.name, w: arena.map[0].length, h: arena.map.length, map: arena.map.slice(), height: height.map((row) => row.slice()), objects: clone(arena.objects || []), structures: clone(arena.structures || []) },
        actors: {}, order: (opts.participants || enc.actors).map((a) => a.id), turnIndex: 0, round: 0, phase: "action",
        barriers: clone(opts.initialBarriers || arena.initialBarriers || []), scheduled: [], pending: null, disclosures: {}, knowledge: {}, observedAbilities: {}, turnDamageCounts: {}, growthMarks: [], pruneBraces: [], terrainEffects: [], successionPatches: [],
        summonUsed: [], unlockedSummons: Array.isArray(opts.unlockedSummons) ? opts.unlockedSummons.slice() : [], deathDoorUsed: false, communion: { familiarity: {}, closed: {}, communed: 0 }, tsukumogami: { familiarity: {}, warned: false, awakened: 0 }, summonQuestionBoost: 0, summonCorrectAnswers: 0, fragments: [], dreamSpace: null, roundEnvironmentProcessed: false, pactCodes: [], pactActive: null, pactBook: clone(opts.contracts || null),
        victories: clone(opts.victories || {}),   // the account's victory ledger, for Contains Multitudes
        emissaryMemory: clone(opts.emissaryMemory || {}),   // what the Emissary remembers of this account (account.js recordEmissary)
        insight: { decks: {}, knowledge: {}, cognitive: opts.cognitive || insightRules?.emptyCognitive?.() || { subjects: {}, kinds: {} } },
        imitation: { carried: (opts.imitatedTraits || []).slice() },
        self: clone(opts.self || insightRules?.createSelf?.({ seed: opts.selfSeed ?? opts.seed ?? 0, catalogAdditions: mirrorRules?.data?.catalogAdditions || [] }) || { version: 1, traits: [] }),
        mirror: { resolvable: [], dreamsBefriended: [...new Set(opts.mirror?.dreamsBefriended || [])], resolvedThisBattle: [], channelsUsed: [], lfLostByRound2: 0, initialInventory: (opts.startingInventory || []).length },
        wild: clone(opts.initialWild || []), wildWet: {}, wildTreated: [], wildBait: [], wildRecent: {}, wildSpawnCounts: {}, wildTelegraphs: [], dreamRecent: {},
        openingTempo: clone(opts.openingTempo || {}), openingTempoUsed: {},
        earthworksMoved: 0, gaiaWarned: false, gaiaAwakeningPending: false, gaiaInvoked: false,
        seq: 0, log: [], outcome: null, learning: [], stats: { edges: {}, abilityUses: {}, multiHits: 0 },
      };
      if (pickupRules) {
        // Scripted vignette arenas can omit map-generator spawn metadata. Pickups
        // still need occupied spawn tiles excluded, so derive it from the authored
        // participant positions before placing any items.
        const participants = opts.participants || enc.actors;
        const positionsFor = (side) => {
          const authored = s.arena.spawns?.[side];
          if (Array.isArray(authored) && authored.length) return authored;
          return participants.filter((p) => (p.side || C.characters[p.character]?.side) === side)
            .map((p) => (opts.positions || {})[p.id] || p.at).filter((at) => Array.isArray(at));
        };
        s.arena.spawns = { ...(s.arena.spawns || {}), player: positionsFor("player"), enemy: positionsFor("enemy") };
        s.arena = pickupRules.placePickups(s.arena, { seed: s.seed });
      }
      // This opt-in practice uses a battle-local belief profile. Saved self traits
      // remain untouched, and contradictory faith/skeptic rolls cannot obscure its rule.
      if (opts.proficientSummonerTest) s.self.traits = [...(s.self.traits || []).filter(t => !(insightRules?.data?.beliefTraits || []).includes(typeof t === "string" ? t : t?.id)), "fullBeliever"];
      { const clash = H.Factions.feudOnOneSide(s.rules, (opts.participants || enc.actors).map((o) => (o.id === "player" && C.characters[opts.mainCharacter] && !opts.keepPlayerCharacter ? { character: opts.mainCharacter, side: "player" } : { character: o.character, side: o.side || C.characters[o.character]?.side }))); if (clash) throw new Error(`${clash[0]} and ${clash[1]} are in feuding crews (rules.factions.feuds) and cannot share a side.`); }   // the backstop: builders never get here (Factions.fits)
      for (const original of (opts.participants || enc.actors)) {
        const a = original.id === "player" && C.characters[opts.mainCharacter] && !opts.keepPlayerCharacter ? {...original,character:opts.mainCharacter,side:"player"} : {...original};
        let ch = { ...C.characters[a.character], ...((opts.loadouts || {})[a.id] || {}) };
        if (opts.keepPlayerCharacter && original.id === "player") { const { primary, secondary, reserve, lens, ...carried } = (opts.loadouts || {})[a.id] || {}; ch = { ...C.characters[a.character], ...carried }; }   // themed battles: you fight AS the listed class, in its kit
        let selectedConfig = null;
        // Reinforcements skip random configuration rolls, but still need their default playable kit.
        if (!ch.primary && ch.configs?.length) { selectedConfig = ch.configs[0]; ch = { ...ch, ...clone(selectedConfig) }; }

        if (opts.randomizeNPCs && a.id !== "player" && !a.eventActor && ch.side !== "player" && ch.configs?.length) {
          let h = 2166136261;
          for (const char of `${opts.seed ?? 0}:${a.id}`) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0;
          selectedConfig = ch.configs[h % ch.configs.length];
          ch = { ...ch, ...selectedConfig, name: ch.name, sprite: ch.sprite, ai: ch.ai, side: a.side || ch.side };
        }
        if (a.eventLoadout) ch = { ...ch, ...a.eventLoadout, name: a.name || ch.name, sprite: a.sprite || ch.sprite, side: a.side || ch.side };
        if(ch.permanentAlly)a.side="player";
        const at = (opts.positions || {})[a.id] || a.at;
        const level = ch.level || 1;
        const basePassives = a.id === "player" && !opts.storyKit ? clone(ch.passives || {}) : H.relicPassives(a.id === "player" ? clone(ch.passives || {}) : {}, a.character, a.id === "player" ? opts.equippedGear : null);
        // The player's belief is their own (the account's self traits), so a belief rolled for their class is dropped.
        const authoredTraits = (insightRules?.profileTraitIds?.(a.character, s.seed) || []).filter(t => a.id !== "player" || !(insightRules.data?.beliefTraits || []).includes(t));
        const characterTraits = a.id === "player" ? s.self.traits : authoredTraits;
        const runtimeTraits = [...new Set([...(ch.traits || []), ...(a.traits || []), ...authoredTraits, ...(a.id === "player" ? (opts.imitatedTraits || []).filter(t => insightRules?.imitable?.(t)) : []),   // C11: copies carried in from the account
          ...(a.id === "player" ? (s.self.traits || []).map(t => typeof t === "string" ? t : t?.id).filter(Boolean) : [])])];
        const traitMods = insightRules?.combatModsForTraits?.(characterTraits, { seed: s.seed, characterKey: a.character }) || { abilityDamageMul: 1, ultimateChargeMul: 1 };
        const passives = { ...basePassives };
        if (traitMods.abilityDamageMul !== 1 || basePassives.abilityDamageMul != null)
          passives.abilityDamageMul = (basePassives.abilityDamageMul || 1) * traitMods.abilityDamageMul;
        if (traitMods.ultimateChargeMul !== 1 || basePassives.ultimateChargeMul != null)
          passives.ultimateChargeMul = (basePassives.ultimateChargeMul || 1) * traitMods.ultimateChargeMul;
        if (traitMods.summonDamageDealtMul && traitMods.summonDamageDealtMul !== 1) passives.summonDamageDealtMul = traitMods.summonDamageDealtMul;
        if (traitMods.summonDamageTakenMul && traitMods.summonDamageTakenMul !== 1) passives.summonDamageTakenMul = traitMods.summonDamageTakenMul;
        if (traitMods.rareMonsterSummon) passives.rareMonsterSummon = true;
        if (traitMods.extra) for (const [k, v] of Object.entries(traitMods.extra)) {   // trait-carried passives (Supers: powers + critical weakness)
          if (k === "channelDamageMul") { passives.channelDamageMul = { ...(passives.channelDamageMul || {}) }; for (const [c, m] of Object.entries(v)) passives.channelDamageMul[c] = (passives.channelDamageMul[c] || 1) * m; }
          else passives[k] = typeof v === "number" && typeof passives[k] === "number" ? (/Mul$/.test(k) ? passives[k] * v : passives[k] + v) : v;   // feats stack with gear (a mule in a seed pouch carries both); multipliers multiply
        }
        const maxLF = (a.maxLF || rules.maxLF) + (passives.maxLFAdd || 0) + (a.id === "player" ? opts.perkMods?.maxLFAdd || 0 : 0);   // W3.6: vitality rides the account in
        const soulMax = H.soulMaxFor(rules, ch.soulKind, a.character, runtimeTraits);
        s.actors[a.id] = {
          id: a.id, character: a.character, permanentAlly:!!ch.permanentAlly, name: a.name || ch.name, side: a.side || ch.side, sprite: a.sprite || ((a.side || ch.side) === "player" && typeof opts.spritePackages?.[a.character] === "string" && (ch.variants || [ch.sprite]).includes(opts.spritePackages[a.character]) ? opts.spritePackages[a.character] : null) || H.actorLook(s, a, ch, opts.seed) || allyLook(a, ch, opts.seed) || ch.sprite, ai: ch.ai || null,
          posture: ch.posture || Workflow?.postureFor(runtimeTraits) || "aggressive", selectedConfig, traits: runtimeTraits,
          boss: a.boss || null, size: a.size || null, massive: !!a.boss, conditions: a.boss ? {} : undefined, titles: (a.titles || ch.titles || []).slice(), ...(a.orbit ? { orbit: a.orbit } : {}),   // W9.5: authored holders carry their titles in
          abilities: a.boss ? Object.keys(bossRules?.data?.bosses?.[a.boss]?.abilities || {}) : [],
          bossAbilityIds: a.boss ? (ch.bossAbilityIds || []).slice() : [],   // base kit only; enraged unlocks land via afterDamage
          aiAbilities: a.aiAbilities || ch.aiAbilities || null,
          maxLF, maxPF: (a.maxPF || rules.maxPF) + (passives.maxPFAdd || 0) + (a.id === "player" ? opts.perkMods?.maxPFAdd || 0 : 0),   // W3.6: focus rides the account in; anime batch: Deep Wells widens the well
          lf: Math.min(maxLF, Math.max(0, a.startingLF ?? ch.startingLF ?? maxLF)), pf: (a.maxPF || rules.maxPF) + (passives.maxPFAdd || 0) + (a.id === "player" ? opts.perkMods?.maxPFAdd || 0 : 0),
          ultimateCharge: Math.min(rules.ultimateChargeMax, (ch.ultimateCharge ?? 0) + (passives.startingUltimateCharge || 0)), lastChargeConcept: null, quickenedSpent: {},
          inspiration: a.id === "player" ? Math.min(rules.inspiration?.cap ?? 3, Math.max(0, Math.floor(opts.inspiration || 0)) + (passives.nobleGift || 0)) : 0, inspiredBy: {},   // + J5 noble gifts
          x: at[0], y: at[1], level, xp: ch.xp || 0, proficiency: proficiencyFor(level), lastTechniqueConcept: null, focus: null,
          primary: ch.primary, secondary: ch.secondary, summonGroup: a.summonGroup ?? ch.summonGroup ?? null, reserve: (ch.reserve || []).slice(),
          reserveSlots: reserveSlotsFor(level), pendingSwap: null,
          lens: { ...(ch.lens || {}) }, reaction: rules.reactionsPerRound,
          moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false,
          ownerTurns: 0, lastRecoverTurn: -99, perkApAdd: a.id === "player" ? opts.perkMods?.maxAPAdd || 0 : 0, widenedPalace: a.id === "player" ? opts.perkMods?.widenedPalace || 0 : 0, perkMods: a.id === "player" ? opts.perkMods || null : null, waterContact: H.waterAt(s,at[0],at[1]) ? key(...at) : null,   // W3.6: vigor pays out at turn start
          status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null, immovable: null, exposed: null, attention: null, rangeBuff: null, tippingPoint: null, ambush: null, catharsis: null, drowning: null }, inventory: a.id === "player" ? (opts.startingInventory || []).slice() : [],
          inventoryCapacity: (pickupRules?.rules?.slots || 2) + (passives.battleSlotsAdd || 0), passives, earthStock: ch.earthStock || 0, lanyardUsed: false,
          bristleconeUsed: false, beliefSummonUsed: false, beliefStrength: traitMods.beliefStrength || 0, lastDamageType: null, heldFragments: [], defeated: false, soul: soulMax, maxSoul: soulMax, soulKind: ch.soulKind || rules.soul?.byCharacter?.[a.character] || null, husk: false,
          persuaded: !!a.persuaded, standDownUntil: a.standDownUntil || null,
          arrivesRound: a.arrivesRound || null, notArrived: Number.isInteger(a.arrivesRound) && a.arrivesRound > 1, arrivesFor: a.arrivesFor || null,
          eventActor: !!a.eventActor, eventRole: a.eventRole || null, aggressive: !!a.aggressive, hunter: !!a.hunter, ...(Array.isArray(ch.learned) ? { learned: [...ch.learned] } : {}), ...(a.character === "actor" ? { learned: ["audition", "genreDefiningPerformance"], willpower: 14, maxWillpower: 14 } : {}),   // Actor: kit rides learned (a role never locks it out); 14 will
        };
        if (s.actors[a.id].notArrived) s.actors[a.id].defeated = true;
        s.observedAbilities[a.id] = [];
        s.disclosures[a.id] = {};
        if (insightRules) { const deck = insightRules.buildDeck({ key: a.character, kind: "character" }, { seed: s.seed }); s.insight.decks[a.id] = deck; s.insight.knowledge[a.id] = insightRules.spawnKnowledge(deck); }
      }
      if (Climate && s.weatherState && insightRules) {
        const deck = Climate.placeDeck(moduleArena(s.arena), s.weatherState, { seed: s.seed });
        const know = insightRules.spawnKnowledge(deck);
        s.insight.decks[deck.subject.key] = deck;
        (s.insight.knowledge.player ||= {})[deck.subject.key] = know;
        s.placeObservation = { key: deck.subject.key, grants: Climate.grantsFrom(deck, know), familiarity: Climate.weatherFamiliarity(deck, know) };
      }
      s.mirror.enemyCount = Object.values(s.actors).filter(a => a.side === "enemy" && !a.summon).length + s.wild.length;
      s.mirror.initialLF = s.actors.player?.lf || 100;
      if (opts.participants) s.order = opts.participants.map((a) => a.id);
      else s.order = enc.initiative.slice();
      for(const spec of opts.initialSummons || []) {
        if(!summonRules || !s.actors[spec.owner]) throw new Error("Initial summon needs its owner and summon rules.");
        const raw=summonRules.makeSummonActor(spec.key,{owner:spec.owner,at:spec.at});
        const summon=liveSummon(s,s.actors[spec.owner],raw);s.actors[summon.id]=summon;s.order.splice(1,0,summon.id);
        s.disclosures[summon.id]={};s.summonUsed.push(spec.key);s.observedAbilities[summon.id]=[];
        if(insightRules) {const deck=insightRules.buildDeck({key:"summon:*",kind:"summon"},{seed:s.seed});s.insight.decks[summon.id]=deck;s.insight.knowledge[summon.id]=insightRules.spawnKnowledge(deck);}
      }
      s.summonTrueFormTest=!!opts.summonTrueFormTest;
      // What each side has learned about the other (hidden information, spec §11).
      for (const id of s.order) {
        s.knowledge[id] = {};
        for (const o of s.order) if (s.actors[o].side !== s.actors[id].side) s.knowledge[id][o] = { secondary: false, lens: false, abilities: {} };
      }
      // The Emissary arrives wearing someone else: a random class kit (seeded by battle, battle-long),
      // plus its own visage (biology). The mirror of Contains Multitudes: the Warden earns his dead by
      // defeating them, the Emissary simply wakes up as someone. New classes join the pool on their own.
      for (const u of Object.values(s.actors)) {
        if (u.boss !== "emissary" || u.embodied) continue;
        const pool = Object.keys(ClassRuntime?.CLASS_PAIRS || {});
        if (pool.length) {
          // It learns from you: kits that beat this account come back (class-runtime.js emissaryKit; docs/emissary.md).
          const memory = s.emissaryMemory || {}, known = pool.filter((id) => memory[id]?.met > 0);
          const classId = ClassRuntime.emissaryKit(pool, memory, (k) => H.seededChance(`${s.seed}:emissary:${u.id}${k}`)), recalled = memory[classId];
          const [primary, secondary] = ClassRuntime.CLASS_PAIRS[classId];
          const ch = C.characters[classId] || {};
          const had = new Set((u.traits || []).map((t) => (typeof t === "string" ? t : t?.id)));
          const traits = (insightRules?.data?.profiles?.[classId]?.traits || []).filter((t) => !had.has(t));
          u.traits = [...(u.traits || []), ...traits];
          u.embodied = { classId, name: ch.name || classId, primary, secondary, traits, until: 999999, round: s.round };
          log(s, { kind: "multitudes", actor: u.id, embodied: classId,
            text: `${u.name} arrives wearing the ${u.embodied.name} (${C.concepts[primary].name} + ${C.concepts[secondary].name}).`,
            why: [known.length ? (recalled?.met ? `It remembers you: wearing the ${u.embodied.name} it has won ${recalled.won} of ${recalled.met}.` : `It remembers ${known.length} kit${known.length > 1 ? "s" : ""} it has worn against you, and tries one it has not.`)
              : "A random class kit, rolled per battle; its own orb, mandate and visage stay.", ...(traits.length ? [`It takes on: ${traits.join(", ")}.`] : [])] });
        }
        if (!(u.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === "visage")) u.traits.push("visage");
        // A small healing factor (Mala): the existing super-healing passive, under its own name. Set
        // directly — post-build trait grants don't recompute combat mods, so the trait alone would be display-only.
        if (!(u.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === "superHealing")) u.traits.push("superHealing");
        u.passives.healPerTurn = 6; u.passives.healPerTurnName = "void flesh";
      }
      // Fixed alternating initiative; the opener is selectable for testing, and a round starts with them.
      const opener = s.order.indexOf(opts.startingActor || rules.startingActor);
      if (opener > 0) s.order = s.order.slice(opener).concat(s.order.slice(0, opener));
      if (modeRules && s.mode !== "classic") {
        const enemies = Object.values(s.actors).filter((a) => a.side === "enemy" && !a.notArrived);   // reinforcements still to arrive can't be the mark
        const modeArena = moduleArena(s.arena);
        modeArena.spawns = { ...(modeArena.spawns || {}), player: [[s.actors.player.x, s.actors.player.y]], enemy: enemies.map((e) => [e.x, e.y]) };
        s.modeSetup = modeRules.setupMode(s.mode, { arena: modeArena, hero: "player", enemies, seed: s.seed });
      }
      if(opts.focusedDreamTest) { s.focusedDreamTest=true; s.actors.player.ultimateCharge=100; }
      log(s, { kind: "phase", text: `${opts.title || enc.name}. ${s.order.map((id) => s.actors[id].name).join(" → ")} (fixed initiative).` });
      H.hunterEntrance(s);
      for (const actor of Object.values(s.actors)) if (actor.selectedConfig) log(s, { kind: "loadout", actor: actor.id, text: `${actor.name} draws configuration ${actor.selectedConfig.label} (${actor.selectedConfig.id}) from their concept pool.` });
      if (s.randomEventSchedule.length) {
        log(s, { kind: "eventForecast", text: RandomEvents?.forecast(s.randomEventSchedule) || "Random mission events may occur at the opening, midpoint, and countdown." });
        if (s.weatherState) log(s, { kind: "weather", weather: s.weatherState.id, text: `Starting weather: ${Climate.data.weather[s.weatherState.id].name}.` });
      }
      applyGaiaBoons(s, opts.gaiaBoons);
      // Beads carried in from the account (C18; Mala 2026-10-11: a bead is a consumable you can keep as long as you like).
      // The DEV playground (Mala, 2026-10-13) carries one of every orb whatever the account holds, and opens the Gold Form.
      if (opts.devPlayground) s.devPlayground = true;
      if (opts.bossRush) s.bossRush = true;
      if (opts.houses !== false) H.spawnHouse(s);   // a contested house near the center, on a roll (engine/houses.js)
      for (const u of Object.values(s.actors)) if (u.boss === "gaia") { H.setGaiaForm(s, u, bossRules?.data?.bosses?.gaia?.startForm || "restored"); H.landState(s).gaia = u.id; }   // she starts as the Living Accord   // the boss rush (docs/boss-rush.md): read by the data center's turn-one roll
      const carriedOrbs = opts.devPlayground ? bossRules?.publicOrbs?.() : opts.orbs; H.carryLearnedForms?.(s, opts); H.nameRandomFoes?.(s); H.assignEnemyLoci?.(s); H.carryLegacy?.(s, opts); H.carryBeasts?.(s, opts); H.carryFruit?.(s, opts); H.carryOrder?.(s, opts); H.fishRound?.(s, true); if (Array.isArray(opts.wildFriends) && opts.wildFriends.length) s.wildFriends = opts.wildFriends.slice();   // learned forms (docs/learned-forms.md)
      if (Array.isArray(carriedOrbs) && carriedOrbs.length) { const hero = s.actors[s.modeSetup?.hero || "player"]; if (hero) hero.orbs = carriedOrbs.filter((id) => bossRules?.data?.orbs?.[id]); } s.vessels = opts.vessels ? { ...opts.vessels } : null;   // orbs kept on the account (docs/brain-chip.md)   // vessel economy: the packed pouch rides in (null → apprentice shard via pouch())
      if (Array.isArray(opts.beads) && opts.beads.length) { const hero = s.actors[s.modeSetup?.hero || "player"]; if (hero) hero.beads = opts.beads.filter(b => b && (wildRules?.data?.monsters?.[b.kind] || (b.kind === "dream" && typeof b.mind?.key === "string" && b.mind.key && b.name))).map(b => b.kind === "dream"
        ? { kind: "dream", name: b.name, maxLF: b.maxLF || 40, mind: { ...b.mind, dream: { ...(b.mind.dream || {}), key: b.mind.key } } }   // a tamed monster of the mind, kept between battles (2026-10-14)
        : { kind: b.kind, name: b.name || wildRules.data.monsters[b.kind].name, maxLF: b.maxLF || wildRules.data.monsters[b.kind].lf }); }
      if (opts.tourist || (opts.randomizeNPCs && opts.tourist !== false && (s.seed % 5 === 0))) Tourist?.spawn(s,touristH(),typeof opts.tourist === "object" ? opts.tourist : {});
      if (opts.kaiba || (opts.randomizeNPCs && opts.kaiba !== false && H.seededChance(`${s.seed}:kaiba:arrives`) < 0.15)) H.Kaiba.spawn(s,kaibaH(),typeof opts.kaiba === "object" ? opts.kaiba : {}); H.Cards?.init(s,opts);
      H.States?.battleStart(s); H.openCourt?.(s, opts); beginRound(s);   // States: startStates + presence breakers
      startTurn(s);
      return s;
    }

    function proficiencyFor(level) {
      let p = 1; for (const m of C.progression.lensProficiencyByLevel) if (level >= m.level) p = m.proficiency; return p;
    }
    function reserveSlotsFor(level) {
      let n = 1; for (const m of C.progression.reserveSlotsByLevel) if (level >= m.level) n = m.slots; return n;
    }
    function spendTempo(s, a, points, actionName, overclock = false) {
      if (!Number.isFinite(points) || points < 0) return `${actionName} has an invalid action-point cost.`;
      const heldMul = H.heldCostMul ? H.heldCostMul(s, a) : 1;   // Contact Reading: a unit in an MMA Fighter's hold pays double for everything
      if (heldMul !== 1 && points > 0) { points = Math.round(points * heldMul); actionName = `${actionName} (×${heldMul} in the hold)`; }
      const shortfall = Math.max(0, points - a.tempo);
      if (shortfall && a.awakened) return `${a.name} has spent its turn (${actionName} needs ${points} action points, has ${a.tempo}).`;   // Tsukumogami: one action means one — no overclock debt buys a second
      if (shortfall && overclock && mindset(a)?.noOverclock) return `Craftsman's Mindset: ${a.name} will not borrow against a future turn (${actionName} needs ${points} action points, have ${a.tempo}).`;
      if (shortfall && (!overclock || (a.tempoDebt || 0) + shortfall > s.rules.maxTempoDebt)) return `Needs ${points} action points (have ${a.tempo}); overclock debt limit is ${s.rules.maxTempoDebt} AP.`;
      a.tempo = Math.max(0, a.tempo - points); a.tempoDebt = (a.tempoDebt || 0) + shortfall; a.tempoSpent += points; a.actionsThisTurn += 1; a.acted = true;
      if (a.awakened && actionName !== "Move") a.tempo = 0;   // Tsukumogami: one action after moving — any paid non-move action ends the turn
      log(s, { kind: "tempo", actor: a.id, text: `${a.name} spends ${points} action points on ${actionName}${shortfall ? `, creating ${shortfall} AP tempo debt` : ""} (${a.tempo} remain).` });
      return null;
    }
    // ── Day and night (content.js rules.time) ──
    // Which phase a round falls in, counting from the battle's starting phase.
    function phaseAt(s, round = s.round) {
      const T = s.rules.time, start = s.time?.startPhase || "day", first = start === "day" ? T.dayLength : T.nightLength, cycle = T.dayLength + T.nightLength;
      const into = ((Math.max(1, round) - 1) % cycle + cycle) % cycle;
      return into < first ? start : (start === "day" ? "night" : "day");
    }
    const isNight = (s) => !!s.rules.time && s.time?.phase === "night";
    // What opening a Dream Space costs right now: the action points, and the engine rules to check the charge against.
    function dreamOpening(s, openLess = 0) {
      const T = s.rules.time, night = isNight(s), base = dreamSpaceRules?.rules?.apCost || 50, cut = openLess + (night ? T.dreamChargeCut : 0);
      return { night, ap: night ? Math.round(base * T.dreamApMul) : base, rules: cut ? { ...s.rules, ultimateChargeMax: s.rules.ultimateChargeMax - cut } : s.rules };
    }
    // Called as each round begins (turns.js). Sets the phase, says so when it changes, brings the night's creatures in
    // at nightfall (and at the start of a battle that begins by night) and sends the survivors away at dawn.
    function advanceTime(s) {
      const T = s.rules.time; if (!T || !s.time) return;
      const before = s.round <= 1 ? null : s.time.phase, now = phaseAt(s);
      s.time.phase = now;
      if (s.round <= 1) log(s, { kind: "time", phase: now, text: now === "night" ? "The battle begins by night." : "The battle begins by day." });
      else if (before !== now) log(s, { kind: "time", phase: now, flip: true, text: now === "night" ? `Night falls (round ${s.round}).` : `Dawn breaks (round ${s.round}).` });
      const nightfall = now === "night" && (s.round <= 1 || before !== now), dawn = now === "day" && before === "night";
      if (dawn && wildRules) {
        const leaving = (s.wild || []).filter((m) => s.nightWildIds.includes(m.id));
        for (const m of leaving) log(s, { kind: "wildFlee", actor: m.id, tiles: m.x != null ? [[m.x, m.y]] : [], text: `${m.name} slips away at dawn.` });
        if (leaving.length) s.wild = s.wild.filter((m) => !s.nightWildIds.includes(m.id));
        s.nightWildIds = [];
      }
      if (nightfall && wildRules?.randomEventWave && s.arena?.map) {
        const result = wildRules.randomEventWave(wildSnapshot(s), T.spawnCount, `${s.seed}:night`);
        if (result) { saveWildWorld(s, result.world); for (const ev of result.events) {
          const m = s.wild.find((w) => w.id === ev.id); if (m) { m.night = true; s.nightWildIds.push(m.id); }
          log(s, { kind: "wildAppear", actor: ev.id, tiles: ev.at ? [ev.at] : [], night: true, text: `${ev.text} It came with the dark and is hostile to all sides.` });
        } }
      }
    }
    function addStun(s, source, target, points) {
      if (!points || target.defeated) return; if (H.eatShock(s, target, "stun")) return; if (H.hasTrait(target, "perfectConcentration")) points = Math.ceil(points * (s.rules.concentration?.perfect?.stunMul ?? 1));   // shakes it off
      if (isMonster(target) && EM.resists(target, "stun")) { log(s, { kind: "resist", actor: source?.id || null, target: target.id, text: `${target.name} cannot be stunned.`, why: ["Preserved: kept exactly as it was."] }); return; }
      if (target.boss && bossRules?.statusImmune(target,"stun")) { log(s,{kind:"resist",actor:source?.id||null,target:target.id,text:`${target.name} shrugs off Stun while enraged.`,why:["The boss's authored enraged condition is immune to Stun."]}); return; }
      if (target.form?.golden) { log(s, { kind: "resist", actor: source?.id || null, target: target.id, text: `${target.name} is beyond Stun while golden.`, why: ["The Integrated Self is immune to control effects."] }); return; } if (target.stillwater && !target.stillwaterUsed) { target.stillwaterUsed = true; log(s, { kind: "resist", actor: source?.id || null, target: target.id, text: `${target.name} breathes through the Stillwater Draught: the stagger finds no purchase (once per battle).` }); return; } if (target.status.stagger?.expiresAt > target.ownerTurns) points += target.status.stun?.points || 0;   // W9.4 stillwater + interactions (Muse-2): Stun on a staggered fighter stacks onto the queued disruption instead of refreshing it
      if (currentId(s) === target.id && s.phase === "action") {
        const lost = Math.min(target.tempo, points); target.tempo -= lost;
        log(s, { kind: "stun", actor: source?.id || null, target: target.id, at:[target.x,target.y], text: `${target.name} is stunned: loses ${lost} action points now (${target.tempo} remain).`, why: [`${source?.name || "The effect"} disrupted ${points} tempo; Stun reduces the active turn instead of skipping it.`] });
      } else {
        target.status.stun = { label: "Stun", owner: target.id, points: Math.max(target.status.stun?.points || 0, points) };
        log(s, { kind: "stun", actor: source?.id || null, target: target.id, at:[target.x,target.y], text: `${target.name} is stunned: −${target.status.stun.points} action points at their next turn start.`, why: ["The disruption is queued for the target's next action budget; it does not erase the whole turn."] });
      }
    }

    function recordMirrorEvent(s, event) {
      if (!mirrorRules || !s.self) return;
      for (const match of mirrorRules.checkTrauma(s.self, event)) {
        if (!s.mirror.resolvable.includes(match.trait)) s.mirror.resolvable.push(match.trait);
      }
    }
    function recordBattleMirrorOutcome(s) {
      if(s.outcome) Tourist?.settle(s,touristH());
      if (!mirrorRules || !s.self || !s.outcome) return;
      recordMirrorEvent(s, { kind: "battleEnd", won: s.outcome.winner === "player", mode: s.mode,
        correctAnswers: s.summonCorrectAnswers || 0, lfLostByRound2: s.mirror.lfLostByRound2 || 0,
        carriedItems: s.mirror.initialInventory || 0, enemies: s.mirror.enemyCount || 0, channelsUsed: (s.mirror.channelsUsed || []).length });
    }

    // ── geometry ────────────────────────────────────────────────────────────
    const inside = (s, x, y) => x >= 0 && y >= 0 && x < s.arena.w && y < s.arena.h;
    const activeTerrainEffect = (s, kind, x, y) => (s.terrainEffects || []).find(e => e.kind === kind && (e.tiles || []).some(t => t[0] === x && t[1] === y) && s.actors[e.owner]?.ownerTurns < e.expiresAt);
    const planViewActive = (s) => (s.terrainEffects || []).some(e => e.kind === "planView" && s.actors[e.owner]?.ownerTurns < e.expiresAt);
    function surfaceAt(s, x, y) {
      const projection = activeTerrainEffect(s, "projection", x, y);
      if (projection?.property === "surface") return projection.value;
      const pasted = activeTerrainEffect(s, "pastedFragment", x, y);
      if (pasted?.fragment?.kind === "water") return pasted.fragment.value?.surface || "~";
      if (pasted?.fragment?.kind === "mulch") return "m";
      if (pasted?.fragment?.kind === "thorns") return "*";
      const removed = activeTerrainEffect(s, "removedFragment", x, y);
      if (removed?.fragment?.kind === "water") return s.arena.map[y][x] === "~" ? "." : ",";
      if (removed?.fragment?.kind === "thorns") return ",";
      return (!s.arena.map[y] || x < 0 || x >= s.arena.map[y].length) ? (s.log && log(s, { kind: "system", text: `(${x},${y}) is past the map edge: treated as pillar.` }), "#") : s.arena.map[y][x];   // past the world is wall, never a crash (Mala hit the raw read 3×, 2026-10-16)
    }
    const heightAt = (s, x, y) => {
      if (planViewActive(s)) return 0;
      const projection = activeTerrainEffect(s, "projection", x, y);
      if (projection?.property === "height") return projection.value;
      const base = s.arena.height?.[y]?.[x] || 0;
      const modifier = s.barriers?.find((b) => b.x === x && b.y === y)?.heightDelta || 0;
      return Math.max(0, Math.min(3, base + modifier));
    };
    function tileAt(s, x, y) {
      const base = C.tiles[surfaceAt(s, x, y)] || C.tiles["."];
      const growth = patchAt(s, x, y);
      const garden=(s.terrainEffects||[]).some(e=>e.kind==="rainGarden"&&e.tiles.includes(key(x,y))&&s.actors[e.owner]?.ownerTurns<e.expiresAt);
      const dam=(s.terrainEffects||[]).some(e=>e.kind==="checkDam"&&e.x===x&&e.y===y&&s.actors[e.owner]?.ownerTurns<e.expiresAt);
      if (base.tpz) return { ...base, height: heightAt(s, x, y) };
      const inTpz = DIRS.some(([dx, dy]) => inside(s, x + dx, y + dy) && C.tiles[surfaceAt(s, x + dx, y + dy)]?.tpz);
      if (inTpz) return { ...base, name: "Mulch · tree protection zone", moveCost: Math.max(2, base.moveCost || 1), tpz: true, tags: [...new Set([...(base.tags || []), "soil", "tpz"])] };
      const ground = s.barriers?.find((b) => b.passiveGround && b.x === x && b.y === y);
      if (ground) return { ...base, name: "Mulch", moveCost: Math.max(2, base.moveCost || 1), tags: [...new Set([...(base.tags || []), "soil", "plant"])] };
      const obj = s.arena.objects?.find((o) => o.x === x && o.y === y);
      const pasted = activeTerrainEffect(s, "pastedFragment", x, y), removed = activeTerrainEffect(s, "removedFragment", x, y);
      let cover = growth ? Math.max(base.cover || 0, growth.stage >= 2 ? 0.4 : 0.25) : (obj?.crownSuppressed ? 0 : obj?.cover ?? base.cover ?? 0);
      let hazard = H.foldAt?.(s, x, y) ? 0 : (base.hazard || 0);   // Folding: paper muffles the tile
      if (removed?.fragment?.kind === "cover") cover = 0;
      if (pasted?.fragment?.kind === "cover") cover = Math.max(cover, pasted.fragment.value?.cover || 0.25);
      if (removed?.fragment?.kind === "thorns") hazard = 0;
      if (pasted?.fragment?.kind === "thorns") hazard = Math.max(hazard, pasted.fragment.value?.hazard || 3);
      const trash = trueFormFieldAt(s, x, y, "trash");                          // true forms: the Little King's Royal Refuse
      if (trash) return { ...base, height: heightAt(s, x, y), moveCost: obj?.moveCost ?? base.moveCost ?? 1, blocksMove: obj?.blocksMove ?? base.blocksMove,
        name: "Trash", blocksSightAtHeight: obj?.crownSuppressed ? 0 : obj?.sightHeight ?? base.blocksSightAtHeight, hazard: Math.max(hazard, trash.hazard), cover,
        tags: [...new Set([...(base.tags || []), "trash"])] };
      return { ...base, height: heightAt(s, x, y), moveCost: H.foldAt?.(s, x, y) ? 1 : (garden ? Math.max(2, obj?.moveCost ?? base.moveCost ?? 1) : obj?.moveCost ?? base.moveCost ?? 1), blocksMove: obj?.blocksMove ?? base.blocksMove,
        name: growth ? `Succession · stage ${growth.stage}` : garden ? "Rain Garden" : dam ? "Check Dam" : obj?.type || base.name, blocksSightAtHeight: obj?.crownSuppressed ? 0 : obj?.sightHeight ?? base.blocksSightAtHeight,
        hazard, cover,
        tags: [...new Set([...(base.tags || []), ...(growth ? ["succession", `growth-stage-${growth.stage}`] : [])])] };
    }
    const barrierAt = (s, x, y) => s.barriers.find((b) => b.x === x && b.y === y && !b.passiveGround) || null;
    const footprint = (a) => { const size = a?.size || { w: 1, h: 1 }, out = []; for (let dy=0;dy<size.h;dy++) for (let dx=0;dx<size.w;dx++) out.push([a.x+dx,a.y+dy]); return out; };
    const coversTile = (a, x, y) => a.x <= x && x < a.x + (a.size?.w || 1) && a.y <= y && y < a.y + (a.size?.h || 1);
    const actorAt = (s, x, y) => Object.values(s.actors).find((a) => !a.defeated && coversTile(a,x,y)) || null;
    const traitKey = (trait) => String(typeof trait === "string" ? trait : trait?.id || trait?.name || "").toLowerCase().replace(/[^a-z]/g, "");
    const cannotSwim = (a) => !!(a?.passives?.cantSwim || a?.passives?.cannotSwim || (a?.traits || []).some(t => ["cantswim", "cannotswim"].includes(traitKey(t))));
    const refreshDrowning = (...args) => H.refreshWaterDrowning(...args);
    function gradeableSoil(s, x, y) {
      if (!inside(s, x, y) || ![",", "m"].includes(surfaceAt(s, x, y))) return false;
      if (tileAt(s, x, y).blocksMove || barrierAt(s, x, y) || actorAt(s, x, y)) return false;
      if ((s.arena.objects || []).some(o => o.x === x && o.y === y)) return false;
      if ((s.wild || []).some(m => m.form === "unit" && m.x === x && m.y === y)) return false;
      return true;
    }
    // Earth moved feeds the land's wounds (engine/land.js): 5 a soil unit, so six units still reach the old
    // awakening point of 30. Gaia's warning and arrival are the land part's now, not a count of earthworks.
    function recordEarthMoved(s, a, units, tiles) {
      if (!(units > 0)) return;
      s.earthworksMoved = (s.earthworksMoved || 0) + units;
      H.landWound(s, a, "earthUnit", units, tiles);
    }
    function auraH() { return { log, hit, dist, myUlts: (s, id) => (H.availableAbilities(s, id) || []).filter((x) => x.m.tier === "ultimate" && x.m.effect === "damage").map((x) => x.m.range || x.m.routeBudget || 0).filter((r) => r > 0) }; }   // Auras: helper bundle for auras/auras.js (myUlts: Fix 1c ult reservation ranges)
    function dist(s, ax, ay, bx, by) {
      const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
      return s.rules.rangeMetric === "chebyshev" ? Math.max(dx, dy) : dx + dy;
    }
    const dreamSame = (s,x,y,tx,ty) => !dreamSpaceRules || dreamSpaceRules.sameRegion(s.dreamSpace,x,y,tx,ty);
    function dreamCanReach(s,a,m,x,y) {
      if (dreamSame(s,a.x,a.y,x,y)) return true;
      // Existing passOver admits Diffusion fields from outside; routeAround and ignoreParry are not penetration.
      return m?.delivery === "field" && !dreamSpaceRules.contains(s.dreamSpace,a.x,a.y)
        && !!GraphLive?.edges.some(e=>e.source===m.concept && e.target==="boundary" && e.type==="bypasses" && e.op.kind==="passOver");
    }
    function keepDreamPositions(s, before, exempt=[]) {
      if (!s.dreamSpace?.region) return;
      for (const old of [...Object.values(before.actors), ...(before.wild || [])]) {
        const unit = s.actors[old.id] || s.wild.find(u=>u.id===old.id);
        if (unit && !exempt.includes(unit.id) && !dreamSame(s,old.x,old.y,unit.x,unit.y)) {
          unit.x=old.x; unit.y=old.y;
          log(s,{kind:"dreamSpace",actor:unit.id,text:`The dream boundary holds ${unit.name} on its original side.`});
        }
      }
    }

    // Bresenham through tile centres, endpoints included.
    function line(x0, y0, x1, y1) {
      const out = []; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, x = x0, y = y0;
      for (;;) { out.push([x, y]); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } }
      return out;
    }
    // Sight ignores barriers (they negate on resolution instead; that's the lesson) and units (configurable).
    function hasSight(s, x0, y0, x1, y1) {
      const observer = actorAt(s, x0, y0);
      if (observer && s.cls?.signs?.[observer.id] && ClassRuntime?.signed(s, observer, actorAt(s, x1, y1))) return true;   // Read Sign (rules.ranger)
      const pts = line(x0, y0, x1, y1), aloft = (u) => (u && ClassRuntime?.sightHeightBonus ? ClassRuntime.sightHeightBonus(u) : 0);   // ClassRuntime: Aloft counts as height +2
      const cutSight = observer && (s.terrainEffects || []).some(e => e.kind === "sectionCut" && e.side === observer.side && s.actors[e.owner]?.ownerTurns < e.expiresAt
        && (e.axis === "row" ? y0 === e.index && y1 === e.index : x0 === e.index && x1 === e.index));
      for (let i = 1; i < pts.length - 1; i++) {
        const [x, y] = pts[i];
        const obstacle = tileAt(s, x, y);
        if (obstacle.blocksSight && obstacle.blocksSightAtHeight == null) return false;
        const sightHeight = obstacle.blocksSightAtHeight;
        // Low obstacles that explicitly provide partial cover obscure the silhouette but
        // still allow a line delivery; their cover fraction is applied at impact. Full-cover
        // terrain (trees, pillars, boulders) remains opaque until the shot can pass over it.
        if (sightHeight != null && sightHeight > Math.max(heightAt(s, x0, y0) + aloft(observer), heightAt(s, x1, y1) + aloft(actorAt(s, x1, y1)))
          && (obstacle.cover ?? 0) >= 1) return false;
        const obstruction = barrierAt(s, x, y);
        if (obstruction && obstruction.blocksSight && !cutSight) return false;
        if (s.rules.unitsBlockSight && actorAt(s, x, y)) return false;
        const glass = (s.arena.objects || []).find((o) => o.window && o.x === x && o.y === y);
        if (glass && Sight && !Sight.windowAllows(glass, x0, y0, x1, y1, s.rules.windowSight ?? 4)) return false;
      }
      return true;
    }
    const plantUnderfoot = (s, x, y) => (s.arena.objects || []).some(o => o.kind === "plant" && o.x === x && o.y === y && o.hp > 0 && !o.blocksMove);
    function settleHomeward(s, a) {
      const p = a.pathwayPromise; if (!p || a.defeated) return;
      if (a.x === p.x && a.y === p.y) {
        const inst = { name: "Another Way Home", ability: "anotherWayHome", concept: "pathway", delivery: "field", damageType: p.damageType || "citrinitas" };
        const K = s.rules.commitments || {}, reach = K.homecomingRadius ?? 2;
        const targets = Object.values(s.actors).filter(t => !t.defeated && t.side !== a.side && dist(s, t.x, t.y, p.x, p.y) <= reach);
        for (const t of targets) hit(s, a, t, inst, p.potency + (K.homecomingAdd || 0), [`${t.name} is within ${reach} tiles of the declared destination.`], { label: "Homecoming", damageType: p.damageType || "citrinitas" });
        keptWord(s, a);
        log(s, { kind: "promise", actor: a.id, tiles: [[p.x, p.y]], text: `${a.name} reaches the declared destination; the homecoming resolves.` });
        a.pathwayPromise = null; return;
      }
      const route = paths(s, a.x, a.y, 99, "route-open").pathTo(p.x, p.y);
      if (!route || s.round > p.expiresRound) {
        log(s, { kind: "promise", actor: a.id, tiles: [[p.x, p.y]], text: `${a.name}'s route home closes; Another Way Home is broken.` });
        a.pathwayPromise = null;
      }
    }
    const flowFull = (s, a) => s.rules.flowState?.enabled !== false && (a.ultimateCharge ?? 0) >= (s.rules.ultimateChargeMax || 100);   // Flow state reads the bar live: the buffs fall off the moment it is spent
    const moveBudgetFor = (s, a) => { if (a.awakened) return ((Tsukumogami?.data?.rules?.moveBySize || [])[a.awakened.size] ?? 3) + (H_hasTrait(a, "light") ? 1 : 0) - (H_hasTrait(a, "rigid") ? 1 : 0); const base = Math.max(H.moveFloor(a), Math.floor(s.rules.moveBudget/(a.status.slowStart&&a.status.slowStart.expiresAt>a.ownerTurns?2:1)) - (a.status.stagger ? 1 : 0) - H.tangleCut(a) + (a.status.moveAdd?.expiresAt>a.ownerTurns ? a.status.moveAdd.amount : 0) + (a.pathwayPromise ? 2 : 0) + H.Instinct.move(a) + (ClassRuntime ? ClassRuntime.moveMods(a).budgetAdd : 0) + (a.passives?.moveBudgetAdd || 0) + (s.rules.cybernetic && H_hasTrait(a, s.rules.cybernetic.trait) ? s.rules.cybernetic.move : 0) + (s.rules.ascended && H_hasTrait(a, s.rules.ascended.trait) ? s.rules.ascended.move : 0) + (Auras ? Auras.moveBudgetAdd(s, a, auraH()) : 0) + (Bonds ? Bonds.moveBudgetAdd(s, a) : 0) + (flowFull(s, a) ? s.rules.flowState?.moveAdd || 0 : 0)); const frac = H.soulFrac?.(a) ?? 1; return base === 0 || frac >= 1 ? base : Math.max(1, Math.round(base * frac)); };   // Bonds: Blessing of Malnote   // + Super Speed   // ClassRuntime: Flight   // Flow: +move on a full bar   // a thinning soul shortens the budget
    // Stable Dijkstra for weighted movement; route topology stays unit-cost BFS-shaped.
    function paths(s, fromX, fromY, budget, kind, goal) {
      const prev = new Map([[key(fromX, fromY), null]]); const d = new Map([[key(fromX, fromY), 0]]);
      const q = [{ at: [fromX, fromY], cost: 0 }];
      const flyer = kind === "move" && ClassRuntime && ClassRuntime.flies(actorAt(s, fromX, fromY)) ? actorAt(s, fromX, fromY) : null;   // ClassRuntime: Flight
      const mover = actorAt(s, fromX, fromY);   // hoisted: the swim check, self-exclusion and big-body pathing share it
      const big = mover?.awakened && ((mover.size?.w || 1) > 1 || (mover.size?.h || 1) > 1);
      while (q.length) {
        q.sort((a, b) => a.cost - b.cost); const { at: [x, y], cost: dd } = q.shift();
        if (dd !== d.get(key(x, y)) || dd >= budget) continue;
        for (const [ex, ey] of DIRS) {
          const nx = x + ex, ny = y + ey, k = key(nx, ny);
          if (!inside(s, nx, ny) || !dreamSame(s,x,y,nx,ny)) continue;
          const t = tileAt(s, nx, ny);
          if (kind === "move") {
            const waterTile = H.waterAt(s, nx, ny), currentWater = H.waterAt(s, x, y);
            const canSwim = !cannotSwim(mover), escapingWater = currentWater && !waterTile;
            if (t.blocksMove && !(waterTile && (canSwim || flyer)) && !escapingWater) continue;
          } else if (t.blocksRoute) continue;   // "route-open" = route ignoring barriers
          if (kind !== "move" && Math.abs(heightAt(s, nx, ny) - heightAt(s, x, y)) >= 2 && !H.usableRamp(s, x, y, nx, ny)) continue;
          const obstacle = barrierAt(s, nx, ny);
          if (kind !== "route-open" && obstacle && !obstacle.passable) continue;
          const occ = unitAt(s, nx, ny);
          if (occ && occ.id !== mover?.id && !(goal && goal[0] === nx && goal[1] === ny)) continue;
          if (big && !H.footOpen(s, mover, nx, ny, kind, goal)) continue;   // a big awakened body fits its whole footprint through
          const garden=(s.terrainEffects||[]).some(e=>e.kind==="rainGarden"&&e.tiles.includes(k)&&s.actors[e.owner]?.ownerTurns<e.expiresAt);
          const dam=(s.terrainEffects||[]).some(e=>e.kind==="checkDam"&&e.x===nx&&e.y===ny&&s.actors[e.owner]?.ownerTurns<e.expiresAt);
          const thornTax=kind==="route"&&(s.terrainEffects||[]).some(e=>e.kind==="thorn"&&e.tiles?.some(([tx,ty])=>tx===nx&&ty===ny)&&s.actors[e.owner]?.ownerTurns<e.expiresAt&&s.actors[e.owner]?.side!==actorAt(s,fromX,fromY)?.side);
          const cost = kind === "move" ? H.stepCost(s, x, y, nx, ny, flyer || (mover?.awakened ? mover : null)) : 1 + (kind === "route" ? (garden ? 1 : 0) + (dam ? 2 : 0) + (thornTax ? 1 : 0) : 0);   // the mover reaches stepCost only when awakened: everyone else's pathing is untouched
          if (!Number.isFinite(cost) || dd + cost > budget || (d.has(k) && d.get(k) <= dd + cost)) continue;
          d.set(k, dd + cost); prev.set(k, [x, y]); q.push({ at: [nx, ny], cost: dd + cost });
        }
      }
      return { dist: d, prev, pathTo(x, y) {
        if (!d.has(key(x, y))) return null; const out = []; let cur = [x, y];
        while (cur) { out.unshift(cur); cur = prev.get(key(cur[0], cur[1])); } return out;
      } };
    }

    // ── loadout, abilities, lens ───────────────────────────────────────────
    function abilitiesOf(a) {
      const out = [];
      if (a.boss) {
        const ids = (a.bossAbilityIds || []).filter(id => !!ab(id));
        const M = a.embodied && !a.defeated ? a.embodied : null;   // the Emissary's borrowed kit rides alongside its own
        if (M) {
          const add = [];
          for (const id of C.concepts[M.primary]?.abilities || []) add.push(id);
          for (const id of C.concepts[M.secondary]?.abilities || []) if (ab(id)?.tier !== "ultimate") add.push(id);
          const holds = (p, sec) => M.primary === p && M.secondary === sec;
          for (const [id, def] of Object.entries(C.abilities)) if (def.pairs?.some(([p, sec]) => holds(p, sec)) && !add.includes(id)) add.push(id);
          if (!holds("legitimacy", "strategic_commitment")) { const i = add.indexOf("theAccordHolds"); if (i >= 0) add.splice(i, 1); }
          if (!holds("strategic_commitment", "pathway")) { const i = add.indexOf("anotherWayHome"); if (i >= 0) add.splice(i, 1); }
          for (const id of [...new Set(add)]) if (!ids.includes(id) && ab(id) && ((a.learned || []).includes(id) || !ClassRuntime || ClassRuntime.available(a, ab(id), id))) ids.push(id);
        }
        return ids;
      }
      const M = a.embodied && !a.defeated ? a.embodied : null;   // Contains Multitudes: his own secondary is set aside, the embodied kit comes in
      const pairs = M ? [[M.primary, M.secondary]] : [[a.primary, a.secondary]], holds = (p, sec) => pairs.some(([x, y]) => x === p && y === sec);
      if (a.primary) for (const id of C.concepts[a.primary].abilities) out.push(id);
      if (a.secondary && !M) for (const id of C.concepts[a.secondary].abilities) if (ab(id).tier !== "ultimate") out.push(id);
      if (M) { for (const id of C.concepts[M.primary]?.abilities || []) out.push(id); for (const id of C.concepts[M.secondary]?.abilities || []) if (ab(id).tier !== "ultimate") out.push(id); }
      // A pair-gated technique belongs to the exact equipped pair, whichever concept it is authored on and whatever
      // its tier (ultimates first; all tiers since the Ranger's Hunter's Mark, 2026-10-12).
      for (const [id, def] of Object.entries(C.abilities)) if (def.pairs?.some(([p, sec]) => holds(p, sec)) && !out.includes(id)) out.push(id);
      if (!holds("legitimacy", "strategic_commitment")) { const i=out.indexOf("theAccordHolds"); if(i>=0)out.splice(i,1); }
      if (!holds("strategic_commitment", "pathway")) { const i=out.indexOf("anotherWayHome"); if(i>=0)out.splice(i,1); }
      for (const id of [...(a.learned || []), ...(a.stateOffers || []), ...(a.passives?.soulArtIds || [])]) if (!out.includes(id) && ab(id)) out.push(id);   // genius; Remind; J6 soul arts
      const formKit = [...(a.form?.techniques || []), ...(H.fruitKitOf?.(a) || [])].filter((id) => ab(id));   // orb form + Sinkerfruit techniques
      for (const id of formKit) if (!out.includes(id)) out.push(id);
      if(a.status?.verse?.id && a.status.verse.until>=a.ownerTurns && ab(a.status.verse.id))out.push(a.status.verse.id);
      if (ClassRuntime) return [...new Set(out)].filter((id) => (a.learned || []).includes(id) || (a.stateOffers || []).includes(id) || (a.passives?.soulArtIds || []).includes(id) || formKit.includes(id) || ClassRuntime.available(a, ab(id), id));   // ClassRuntime: pair-gated class abilities
      return out;
    }
    function compositionEdge(a) {
      return C.composition.find((e) => e.source === a.primary && e.target === a.secondary && e.status === "known") || null;
    }
    function lensOf(a, concept) {
      const L = C.concepts[concept].lens; const id = a.lens[concept] || L.default;
      return { id, ...L.profiles[id] };
    }
    // Ability → lens-adjusted, composition-adjusted manifestation (snapshotted at commit, spec §5/§7).
    function manifest(s, a, abilityId, options = {}) {
      const d = ab(abilityId); const concept = d.concepts[0]; const lens = lensOf(a, concept);
      const m = {
        observedChannel: a.lastDamageType || null, scribedEffects: d.scribedEffects ? clone(d.scribedEffects) : null, ability: abilityId, name: d.name, tier: d.tier, announce: d.announce || null, announced: !!options.announce, revelation: options.announce ? Math.max(1, Math.min(3, Math.round(+options.revelation || 1))) : 0, concept, timing:d.timing||null, effectCategory: d.effectCategory || "uncategorized", delivery: d.delivery, target: d.target, effect: d.effect,
        damageType: d.damageType || C.conceptDamageTypes[concept] || "nigredo",
        area: clone(d.area || { shape: "single" }), cost: d.cost, lfPrice: d.lfPrice || 0, potency: d.potency, range: d.range,
        tempoCost: d.tempoCost ?? s.rules.actionCosts.ability[d.tier] ?? s.rules.actionCosts.ability.basic,
        stunTempo: d.stunTempo || 0, piercing: !!d.piercing, holy: !!d.holy, destructive: !!d.destructive || d.concepts.includes("anti_urbanism"),   // piercing ignores ward; destructive ×2 vs structures, every Anti-Urbanism technique (Mala, 2026-10-18)
        guardMultiplier: lens.guardMultiplier,
        duration: typeof d.duration === "number" ? d.duration : null,
        protection: typeof d.protection === "number" ? d.protection : null,
        counterFraction: lens.counterFraction || 0, returnFraction: lens.returnFraction || 0,
        impactPotency: lens.impactPotency || 0, counterforce: lens.counterforce || 0, buildingHpAdd: lens.buildingHpAdd || 0,
        routeBudget: d.routeBudget || 0, knockback: d.knockback || 0, pull: d.pull || 0, seedLodge: d.seedLodge || null, seedThorn: d.seedThorn || null, bypassGuard: !!d.bypassGuard, oncePerTurn: !!d.oncePerTurn, oncePerBattle: !!d.oncePerBattle, everyOtherTurn: !!d.everyOtherTurn, noCharge: !!d.noCharge, displacementType: d.displacementType || d.damageType || C.conceptDamageTypes[concept] || "nigredo", lens: lens.id, lensName: lens.name, lensTrade: lens.trade, notes: [],
      };
      if (concept === "barrier") {
        m.range = d.range === "lens" ? lens.range : m.range;
        if (d.protection === "lens") m.protection = lens.protection;
        if (d.duration === "lens") m.duration = lens.duration;
        if (lens.potencyMul != null) m.potency *= lens.potencyMul;
      } else {
        if (lens.potencyMul != null) m.potency = m.potency * lens.potencyMul;
        if (lens.rangeAdd) {
          if (m.delivery === "routed") m.routeBudget = Math.max(1, m.routeBudget + lens.rangeAdd);
          else if (m.range > 0) m.range = Math.max(1, m.range + lens.rangeAdd);
        }
        if (lens.radiusAdd && m.area.shape === "radius") m.area.radius += lens.radiusAdd;
      }
      if (lens.durationAdd && m.duration != null) m.duration = Math.max(1, m.duration + lens.durationAdd); if (lens.costAdd) m.cost += lens.costAdd;   // Boomtown: stouter works cost more ΦF (Mala, 2026-10-19)
      if (m.delivery === "line" && m.range > 0 && a.passives?.lineRangeAdd) {
        m.range += a.passives.lineRangeAdd;
        m.notes.push(`Line reach +${a.passives.lineRangeAdd}.`);
      }
      if (lens.id !== C.concepts[concept].lens.default) m.notes.push(`${lens.name} lens: ${lens.trade}`); if (a.passives?.potencyAdd && m.potency > 0) { m.potency += a.passives.potencyAdd; m.notes.push(`Soul-fuel +${a.passives.potencyAdd}.`); }   // anime batch: Red Sliver (flat, after lenses)
      if (a.boss && a.conditions?.enraged && m.potency > 0) {
        const mul=bossRules?.data?.conditions?.enraged?.mods?.potencyMul || 1;
        if(mul!==1){m.potency*=mul;m.notes.push(`${a.name} is Enraged: technique potency ×${mul}.`);}
      }
      if(abilityId==="cyphPocketVerse" && a.status?.cyphPocket?.until>=a.ownerTurns) {m.cost=0;m.notes.push("The pocket verse was already paid for; this performance only spends AP.");} if(abilityId==="feint"&&options.announce){m.tempoCost=5;m.cost=1;m.potency=1;m.notes.push("Announced Feint: 5 AP + 1 \u03a6F, 1 potency, no \u00d71.4; bait, not a blow.");} if(abilityId==="borrowedBlow"){m.cost=0;m.notes.push("Borrowed: the listed 3 ΦF is owed, not paid (+25 AP of tempo debt, due next turn).");}
      ClassRuntime?.prepared(s, a, m, abilityId, options.target, MaidSystems);
      const comp = compositionEdge(a);
      if (comp?.op.kind === "enableEdge" && comp.op.edge === "projectFragment" && m.effect === "project") {
        m.projectFragment = true; m.compositionApplied = true;
        m.notes.push("Section + Collage: Orthographic Projection carries a held fragment along the axis.");
      }
      if (comp?.id === "comp-collage-section" && m.effect === "clip") {
        m.clipAlongCut = true; m.compositionApplied = true;
        m.notes.push("Collage + Section: Clip can reach any tile on your active section cut.");
      }
      if (comp?.id === "comp-collage-deception" && m.effect === "paste") {
        m.decoyFragment = true; m.compositionApplied = true;
        m.notes.push("Collage + Deception: Juxtapose may paste a decoy that resembles a real fragment.");
      }
      if (comp?.id === "comp-deception-collage") {
        m.falseTellRangeAdd = 1; m.compositionApplied = true;
        m.notes.push("Deception + Collage: the borrowed shape understates the announced range by one more tile.");
      }
      if (comp?.id === "comp-berm-section" && m.effect === "contourBerm") {
        m.contourStep = true; m.compositionApplied = true;
        m.notes.push("Berm + Section: Keyline Terrace may step across one height change.");
      }
      if (m.effect === "montage") {
        const parts = options.montageParts || [];
        const seen = s.observedAbilities?.[a.id] || [];
        const defs = parts.map(id => ab(id));
        const legal = parts.length === 3 && new Set(parts).size === 3 && defs.every((x, i) => x && seen.includes(parts[i])) && defs.filter((x) => x.tier === "ultimate").length <= (d.montageUlts || 0)
          && ["line", "placed", "routed", "field"].includes(defs[0]?.delivery)
          && ["single", "line", "plus", "radius"].includes(defs[1]?.area?.shape)
          && defs[2]?.effect === "damage" && Number.isFinite(defs[2]?.potency);
        if (legal) {
          const [deliveryDef, areaDef, effectDef] = defs;
          m.montageParts = parts.slice(); m.delivery = deliveryDef.delivery; m.area = clone(areaDef.area);
          m.target = deliveryDef.delivery === "field" ? "self" : "enemy";
          m.effect = "damage"; m.damageType = effectDef.damageType || C.conceptDamageTypes[effectDef.concepts?.[0]] || "nigredo";
          m.potency = Math.round((defs.reduce((sum, x) => sum + x.potency, 0) / defs.length) * 1.15 * (d.montageMul ?? 1));   // Final Chapter: montageUlts 1, montageMul 0.7
          m.range = deliveryDef.range || (deliveryDef.delivery === "routed" ? 0 : 4);
          m.routeBudget = deliveryDef.routeBudget || 0;
          m.notes.push(`${d.name} uses ${parts.join(" + ")}: delivery, area, then effect/channel; mean potency ×1.15${d.montageMul ? ` ×${d.montageMul}` : ""}.`);
        } else { m.montageInvalid = true; }
      } H.innovationManifest(s, a, m, options, lens);   // Innovation copies/fusions/shapeshift live in queries.js (core budget)
      if (comp && comp.op.kind === "routeBudget" && m.delivery === "routed") {
        m.routeBudget = Math.max(1, m.routeBudget + comp.op.add);
        m.compositionApplied = true;
        m.notes.push(`${conceptName(a.primary)} + ${conceptName(a.secondary)} (${comp.type}): route length ${comp.op.add > 0 ? "+" : ""}${comp.op.add}.`);
      }
      if (comp && comp.op.kind === "growthStageAdd" && m.effect === "successionPatch") {
        m.growthStageAdd = comp.op.add; m.compositionApplied = true;
        m.notes.push("Succession + Swale: a Rain Garden target advances the new patch one stage.");
      }
      if (comp && comp.op.kind === "nursePatch" && m.effect === "rainGarden") {
        m.nursePatch = true; m.compositionApplied = true;
        m.notes.push("Swale + Succession: the Rain Garden seeds a Pioneer Patch.");
      }
      if (a.form?.golden) { m.cost = Math.max(0, m.cost - 1); m.potency *= 1.25; m.notes.push("Integrated Self: techniques cost 1 less ΦF and gain ×1.25 potency."); }
      if (a.character === "odysseus" && abilityId === "detour" && presidentRules && a.walked?.length) {
        // Menus show the best currently legal cost; committing an aimed action revalidates that exact route.
        const aims = options.target ? [options.target] : Object.values(s.actors).filter(t => !t.defeated && !t.notArrived && t.side !== a.side).map(t => [t.x,t.y]);
        const eligible = aims.some(([x,y]) => {
          const route = paths(s,a.x,a.y,m.routeBudget,"route",[x,y]).pathTo(x,y);
          return route && presidentRules.preparedReturnCost({walked:a.walked},route.map(([rx,ry])=>key(rx,ry)),m.cost,presidentContext(s).grid) < m.cost;
        });
        if (eligible) { m.cost = Math.max(0,m.cost-1); m.notes.push("Prepared Return: a revalidated walked route costs 1 less ΦF; unwalked routes pay the normal cost."); }
      }
      if (abilityId === "readSign" && ClassRuntime?.openingRead(s, a)) { m.cost = 0; m.tempoCost = 0; m.notes.push("The Long Hunt: this first-turn Read Sign costs nothing."); }
      // Craftsmanship: care on the next technique, practice on the honed one, and Masterwork's size.
      { const bars = H.talksToAttack ? H.talksToAttack(a) : null;   // Speed-Talker on a Rapper: every technique is talk, at half the action points
        if (bars && m.tempoCost > 0) { m.tempoCost = Math.max(1, Math.round(m.tempoCost * bars.apMul)); m.notes.push(`Speed-Talker: half the action points, lands ${Math.round(bars.effectMul * 100)}% as often.`); } }
      { const MS = mindset(a);   // done properly: every technique's potency and protection
        if (MS?.baseMul && ((m.potency > 0) || typeof m.protection === "number")) { if (m.potency > 0) m.potency *= MS.baseMul; if (typeof m.protection === "number") m.protection = Math.round(m.protection * MS.baseMul); m.notes.push(`Craftsman's Mindset: ×${MS.baseMul}, and no overclock.`); } }
      if (CRAFT) {
        const stacks = a.practice?.stacks || 0;
        if (abilityId === "masterwork") { m.potency = CRAFT.masterBase + CRAFT.masterPerStack * stacks; m.notes.push(`Masterwork: ${CRAFT.masterBase} + ${CRAFT.masterPerStack} × ${stacks} practice.`); }
        else if (a.practice?.ability === abilityId && stacks > 0 && m.potency > 0) { m.potency *= 1 + CRAFT.perStack * stacks; m.notes.push(`Honed Edge: ${stacks} practice, ×${(1 + CRAFT.perStack * stacks).toFixed(2)} potency.`); }
        if (a.primary === "craftsmanship" && a.secondary === "timing" && a.practice?.ability === abilityId && stacks >= craftMax(a)) { m.tempoCost = Math.max(0, m.tempoCost - CRAFT.practisedApOff); m.notes.push(`A practised hand: ${CRAFT.practisedApOff} fewer action points at full practice [comp-craftsmanship-timing].`); }
        if (abilityId === "shieldWall" && a.primary === "barrier" && a.secondary === "craftsmanship") { m.tempoCost += CRAFT.dressed.apAdd; if (typeof m.protection === "number") m.protection = Math.round(m.protection * CRAFT.dressed.mul); m.notes.push(`Dressed work: +${CRAFT.dressed.apAdd} action points, ×${CRAFT.dressed.mul} protection [comp-barrier-craftsmanship].`); }
        if (a.status?.care?.turn === a.ownerTurns && !CRAFT_OWN.has(abilityId)) { m.tempoCost += CRAFT.careAp; if (m.potency > 0) m.potency *= CRAFT.careMul; m.notes.push(`Measure Twice: +${CRAFT.careAp} action points, ×${CRAFT.careMul} potency.`); }
      }
      if(a.status?.verse?.id===abilityId && a.status.verse.until>=a.ownerTurns){m.cost=0;m.verse=true;if(a.status.verse.freeAp)m.tempoCost=0;m.notes.push("Borrowed verse: original prerequisites and counters; ΦF already paid.");}
      if (a.exposure?.longCut && abilityId === s.rules.exposure?.cut?.ability) { m.range += s.rules.exposure.cut.reach; m.notes.push(`The long cut: reach +${s.rules.exposure.cut.reach}. It leaves you open until your next turn.`); }   // Exposure, sample 9
      if (abilityId === "focus" && H.FocusPlans?.free(s,a)) { m.cost=0; m.tempoCost=0; m.freeFocus=true; m.notes.push("Free Fix Attention: eliminate this opponent to renew the allowance."); } H.adhdPrice?.(s, a, abilityId, m); ClassRuntime?.price?.(s, a, abilityId, m); H.legacyPrice?.(s, a, abilityId, m);
      { const ra = m.revelation > 1 ? s.rules.revelation?.apAdd?.[m.revelation] || 0 : 0; if (ra) { m.tempoCost += ra; m.notes.push(`${s.rules.revelation.names[m.revelation]}: +${ra} AP to give that much away (Revelation).`); } } H.Contracts?.decorate(s,a,m);return m;   // Revelation AP (Mala, 2026-10-26: depth costs AP until readers exist)
    }
    const ownerOfConcept = (a, concept) => concept === a.primary ? "primary" : concept === a.secondary ? "secondary" : null;

    // ── logging ─────────────────────────────────────────────────────────────
    function log(s, e) {
      const entry = { i: s.log.length, round: s.round, turn: currentId(s), ...e };
      s.log.push(entry);
      if (!Belief || !s.actors) return;
      const witnessEvent = (event, atOverride = null) => {
        if (!Belief.isSupernaturalEvent(event)) return;
        const sourceActor = s.actors[event.actor] || s.actors[event.target];
        const at = atOverride || event.tiles?.[0] || event.at || (sourceActor ? [sourceActor.x, sourceActor.y] : null);
        if (!at) return;
        for (const observer of Object.values(s.actors)) {
          if (!(Belief.isSkeptic(observer) || ((event.heard || observer.beliefEvidencePoints > 0) && Belief.isNeutral?.(observer))) || observer.defeated) continue;   // a sermon opens a neutral's eyes
        const witnessed = Array.isArray(event.witnesses || event.visibleTo)
          ? (event.witnesses || event.visibleTo).includes(observer.id)
          : hasSight(s, observer.x, observer.y, at[0], at[1]);
        if (!witnessed) continue;
        const site = event.tiles?.[0] || event.at || at;
        const incident = `${event.round ?? s.round}:${event.kind}:${event.actor || ""}:${event.target || event.monster || event.boss || ""}:${site.join(",")}`;
        const result = Belief.witness(observer, { ...event, evidenceId: incident }, { seed: `${s.seed}:${observer.id}`, spiritOdds: insightRules?.data?.spiritOdds?.fullBeliever || 0 });
        if (!result.converted) {
          if (result.actor !== observer) s.actors[observer.id] = result.actor;
          if (result.rationalized) {
            if (s.insight?.decks?.[observer.id] && insightRules) {
              const deck = s.insight.decks[observer.id], trait = insightRules.data?.traits?.unexplainedEvent;
              if (trait && !deck.cards.some(card => card.trait === "unexplainedEvent")) deck.cards.push({
                id: `${observer.character}:trait:unexplainedEvent`, kind: "trait", trait: "unexplainedEvent",
                text: `${trait.name}: ${trait.text}`, open: true, difficulty: 0, unlocks: [], key: "trait:unexplainedEvent"
              });
            }
            s.log.push({ i: s.log.length, round: s.round, turn: currentId(s), kind: "beliefReassessment", actor: observer.id,
              tiles: [[observer.x, observer.y]], text: result.text,
              why: [`They have witnessed ${result.progress} weighted evidence points. They remain a Non-believer for now; two more points can force another reassessment.`] });
          }
          continue;
        }
        s.actors[observer.id] = result.actor;
        if (s.insight?.decks?.[observer.id] && insightRules) {
          const deck = s.insight.decks[observer.id];
          deck.cards = deck.cards.filter(card => card.id !== `${observer.character}:trait:nonBeliever` && card.id !== `${observer.character}:trait:unexplainedEvent`);
          const trait = insightRules.data?.traits?.[result.traitId];
          if (trait && !deck.cards.some(card => card.trait === result.traitId)) deck.cards.push({
            id: `${observer.character}:trait:${result.traitId}`, kind: "trait", trait: result.traitId,
            text: `${trait.name}: ${trait.text}`, open: true, difficulty: 0, unlocks: [], key: `trait:${result.traitId}`
          });
        }
        s.log.push({ i: s.log.length, round: s.round, turn: currentId(s), kind: "beliefConversion", actor: observer.id,
          tiles: [[observer.x, observer.y]], text: result.text,
          why: [`Outcome: ${result.outcome}; belief strength ${result.beliefStrength}/3. Their power and summon tier rise to match.`, "Their summoned creatures remain wild and may attack their caller or anyone else."] });
      }
      };
      witnessEvent(entry);
      // Mythic opponents are evidence as soon as they enter the scene, even if their
      // abilities have not fired yet (for example a visible Dragon boss).
      if (entry.kind === "phase" && entry.round === 0 && /Concept Combat/.test(entry.text || "")) for (const mythic of Object.values(s.actors)) {
        if (!Belief.isMythicEntity(mythic)) continue;
        witnessEvent({ kind: "mythicReveal", round: entry.round, actor: mythic.id, name: mythic.name,
          boss: mythic.boss, monster: mythic.character, text: `${mythic.name || mythic.character || "A mythical being"} is present on the battlefield.`,
          evidenceId: `mythicReveal:${mythic.id}` }, [mythic.x, mythic.y]);
      }
    }
    const currentId = (s) => s.order[s.turnIndex];
    function wildSnapshot(s) {
      return { seed: s.seed, round: s.round, arena: moduleArena(s.arena),
        units: Object.values(s.actors).map((a) => ({ id: a.id, side: a.side, x: a.x, y: a.y, lf: a.lf, maxLF: a.maxLF, defeated: a.defeated, status: clone(a.status), ...(a.communed ? { plant: true } : {}), ...(a.boss === "gaia" ? { gaia: true } : {}), ...(a.awakened ? { awakened: true, size: { w: a.size?.w || 1, h: a.size?.h || 1 } } : {}) })),
        dams: (s.terrainEffects||[]).filter(e=>e.kind==="checkDam"&&s.actors[e.owner]?.ownerTurns<e.expiresAt).map(e=>key(e.x,e.y)),
        gardens: (s.terrainEffects||[]).filter(e=>e.kind==="rainGarden"&&s.actors[e.owner]?.ownerTurns<e.expiresAt).flatMap(e=>e.tiles), drains: (s.terrainEffects||[]).filter(e=>(e.kind==="drainage"||e.kind==="loadPath")&&s.actors[e.owner]?.ownerTurns<e.expiresAt).flatMap(e=>(e.tiles||[]).map(([x,y])=>key(x,y))),   // drains share the line: engine.js stays under its 1500-line budget (engine-parts.test.mjs)
        wild: clone(s.wild), wet: clone(s.wildWet), treated: s.wildTreated.slice(), bait: clone(s.wildBait), recent: clone(s.wildRecent), spawnCounts: clone(s.wildSpawnCounts),
        gaiaInvoked: !!s.gaiaInvoked, gaiaAwakeningPending: !!s.gaiaAwakeningPending, gaiaProvokedBy: s.gaiaProvokedBy || null };
    }
    function saveWildWorld(s, w) {
      s.arena = engineArena(w.arena); s.wild = clone(w.wild); s.wildWet = clone(w.wet); s.wildTreated = w.treated.slice(); s.wildBait = clone(w.bait); s.wildRecent = clone(w.recent); s.wildSpawnCounts = clone(w.spawnCounts || {});
      s.gaiaInvoked = !!w.gaiaInvoked; s.gaiaAwakeningPending = !!w.gaiaAwakeningPending;
      for (const u of w.units) { const a = s.actors[u.id]; if (a) { a.x = u.x; a.y = u.y; if (typeof u.status?.entangled === "number") a.status.entangled = { lostMove: u.status.entangled, expiresAt: a.ownerTurns + 1 }; refreshDrowning(s, a, "is swept into water"); } }
    }
    function restoreRandomTerrain(s) {
      for (const change of [...s.randomTerrainChanges]) {
        if (change.untilRound > s.round) continue;
        if (change.kind === "tile" && s.arena.map[change.y]?.[change.x] === change.to)
          s.arena.map[change.y] = s.arena.map[change.y].slice(0, change.x) + change.from + s.arena.map[change.y].slice(change.x + 1);
        if (change.kind === "object") s.arena.objects = s.arena.objects.filter(o => o.id !== change.id);
        log(s, { kind: "terrain", tiles: [[change.x, change.y]], text: `The temporary ${change.label} at (${change.x},${change.y}) passes.` });
        s.randomTerrainChanges = s.randomTerrainChanges.filter(x => x !== change);
      }
    }
    function addRandomTerrain(s, event) {
      const candidates = [];
      for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) {
        if ((event.effect !== "shallow-flood" && actorAt(s, x, y)) || (s.arena.objects || []).some(o => o.x === x && o.y === y && o.blocksMove)) continue;
        const ch = s.arena.map[y][x]; if ([".", ",", "m"].includes(ch)) candidates.push([x, y, ch]);
      }
      const seed = RandomEvents?.hash(s.seed, `terrain-event:${event.id}`) || 0;
      candidates.sort((a, b) => ((a[0] * 31 + a[1] * 17 + Math.floor(seed * 997)) % 97) - ((b[0] * 31 + b[1] * 17 + Math.floor(seed * 997)) % 97));
      const n = event.effect === "shallow-flood" ? 3 : 2;
      for (const [x, y, from] of candidates.slice(0, n)) {
        if (event.effect === "fallen-cover") {
          const id = `event-cover-${event.id}-${x}-${y}`;
          s.arena.objects.push({ id, type: "log", name: "Fallen limb", x, y, hp: 12, maxHp: 12, cover: 0.35, sightHeight: 0, blocksMove: false, material: "wood" });
          s.randomTerrainChanges.push({ kind: "object", id, x, y, label: "fallen cover", untilRound: s.round + 3 });
        } else {
          const to = event.effect === "shallow-flood" ? "w" : "^";
          s.arena.map[y] = s.arena.map[y].slice(0, x) + to + s.arena.map[y].slice(x + 1);
          s.randomTerrainChanges.push({ kind: "tile", x, y, from, to, label: event.effect === "shallow-flood" ? "shallow flood" : "dream growth", untilRound: s.round + 3 });
        }
      }
      for (const actor of Object.values(s.actors)) refreshDrowning(s, actor, "is caught by the changing ground");
      log(s, { kind: "terrain", tiles: s.randomTerrainChanges.filter(c => c.untilRound === s.round + 3).map(c => [c.x, c.y]),
        text: event.effect === "shallow-flood" ? "The ground dips; shallow water cuts across the field for two rounds." : event.effect === "fallen-cover" ? "Branches crash down, making temporary partial cover." : "Dream growth breaks through the ground as thorn mats." });
    }
    function processRandomEvents(s) {
      restoreRandomTerrain(s); H.advanceWater(s);
      if (s.round > 1 && Climate && s.weatherState) {
        const shifted = Climate.advance(s.weatherState, moduleArena(s.arena), { seed: s.seed, round: s.round, dreamOpen: !!s.dreamSpace });
        s.weatherState = shifted.state;
        for (const ev of shifted.events) log(s, ev);
      }
      for (const event of s.randomEventSchedule || []) {
        if (event.resolved || event.round !== s.round) continue;
        event.resolved = true;
        if (event.type === "ally") {
          const ally = s.actors[event.actorIds?.[0]];
          const name = ally?.name || C.characters[event.character]?.name || event.character;
          log(s, { kind: "randomEvent", actor: ally?.id, text: `${name} is coming to help.` });
          if (event.character === "arantxa") log(s, { kind: "dialogue", actor: ally?.id, text: `Arantxa: “I’m here. Tell me where you need me.”` });
        } else if (event.type === "reinforcements") {
          log(s, { kind: "randomEvent", text: `${event.aggressive ? "Aggressive enemy" : "Enemy"} reinforcements arrive${event.characters?.length ? `: ${event.characters.map(id => C.characters[id]?.name || id).join(" and ")}` : ""}.${event.archivistRaisedOdds ? " Word of the Archivist's records has reached them." : ""}` });
        } else if (event.type === "supervillain") {
          const delay = event.heroRound - event.round;
          log(s, { kind: "randomEvent", text: `The Super Villain arrives and attacks everyone. A ${event.heroes.length > 1 ? "Super Hero and Super Heroine" : "Super Hero"} will arrive in ${delay} round${delay === 1 ? "" : "s"} to challenge the villain.` });
        } else if (event.type === "monsters") {
          const result = wildRules?.randomEventWave?.(wildSnapshot(s), event.monsters, s.seed);
          if (result) { saveWildWorld(s, result.world); for (const ev of result.events) {
            const monster = s.wild.find(m => m.id === ev.id); if (monster) s.randomEventWildIds.push(monster.id);
            log(s, { kind: "randomEvent", actor: ev.id, tiles: [ev.at], text: `${ev.text} It is hostile to all sides.` });
          } }
        } else if (event.type === "weather" && Climate) {
          const ids = Object.keys(Climate.data.weather), current = s.weatherState?.id;
          const choices = ids.filter(id => id !== current);
          const id = (event.weatherId && ids.includes(event.weatherId) && event.weatherId) || choices[Math.floor(event.weatherRoll * choices.length)] || current;   // weatherId: an authored scenario names the sky
          if (s.weatherState) {
            const wind = Climate.rollWeather(moduleArena(s.arena), { seed: s.seed ^ Math.floor(event.weatherRoll * 0xffffffff), archetype: s.arena.archetype });
            s.weatherState = { ...wind, id, since: s.round, forecast: null, rainRounds: 0 };
          }
          log(s, { kind: "randomEvent", weather: id, text: `Weather turns: ${Climate.data.weather[id]?.name || id}. ${Climate.data.weather[id]?.text || ""}` });
        } else if (event.type === "terrain") {
          addRandomTerrain(s, event);
        } else if (event.type === "dream") {
          s.randomDreamRift = { openedRound: s.round, duration: event.duration, turnsRemaining: event.duration, countPerWave: event.monsters, wavesDone: 0 };
          log(s, { kind: "dreamRift", text: `A Dream Rift opens over the field. Dream monsters will pour through at the end of each of the next ${event.duration} rounds.` });
        } else if (event.type === "visitors" && Visitors) Visitors.arrive(s, event, { C, log });
      }
    }
    function syncPickup(s, unit) {
      if (!pickupRules || !unit || unit.defeated) return;
      const got = pickupRules.collect(s.arena, unit, unit.inventory || [], unit.inventoryCapacity);
      s.arena = got.arena; unit.inventory = got.inventory;
      if (got.event) log(s, { kind: got.event.kind, actor: unit.id, tiles: [[unit.x, unit.y]], text: got.event.text });
    }
    function updateWildTelegraphs(s) {
      if (!wildRules) return;
      const w = wildSnapshot(s); s.wildTelegraphs = wildRules.telegraph(w);
      for (const t of s.wildTelegraphs) log(s, { kind: "telegraph", actor: t.id, tiles: t.tiles, text: t.text });
    }
    function runWildEnvironment(s) {
      if (!wildRules || s.outcome) return;
      for(const u of s.wild||[])if(u.status?.soothed?.wildUntil<s.round)delete u.status.soothed;
      for (const m of s.wild || []) if (m.suspended && !chanted(s, m.id)) delete m.suspended;   // C18: a chant with no living channeler holds nothing
      const w = wildSnapshot(s);
      if (modeRules && s.modeSetup) w.allowAppearances = modeRules.appearancesAllowed(s.modeSetup, { round: s.round, units: w.units, wild: w.wild });
      const result = wildRules.environmentPhase(w); saveWildWorld(s, result.world);
      for (const ev of result.events) {
        if (ev.kind === "wildHit") {
          const wid = ev.id || ev.actor;   // wild/monsters.js damageUnit names the monster as `actor`; reading only `id` logged its hits with no attacker
          const singer=s.wild.find(u=>u.id===wid)?.status?.soothed;
          if(singer&&singer.wildUntil>=s.round){log(s,{kind:"performance",actor:wid,text:"The soothed creature holds its attack."});continue;}
          const target = s.actors[ev.target];
          if (target && !target.defeated) {
            const wildSource = s.wild.find(m => m.id === wid);
            hit(s, { id: wid || null, name: ev.monster || "A wild force", side: "wild", summoned: !!wildSource?.summoned }, target, null, ev.damage, [ev.text], { label: ev.monster || "Wild effect", damageType: ev.channel || "nigredo" });
            if (ev.sourceKind && !ev.ranged && wildRules.data.monsters[ev.sourceKind]?.poison && !target.defeated) applyPoison(s, target, wildRules.data.monsters[ev.sourceKind], ev.id, "stung");   // nettle spines
            const floodImmune = target.passives?.floodShoveImmune && (ev.sourceKind === "flashFlood" || /flash.?flood|flood surges/i.test(`${ev.monster || ""} ${ev.text || ""}`));
            const lanyardStops = ev.push && !floodImmune && target.passives?.knockbackResist && !target.lanyardUsed;
            if (ev.push && !target.defeated && !floodImmune && !lanyardStops) { target.x = ev.push[0]; target.y = ev.push[1]; }
            else if (ev.push && floodImmune) log(s, { kind: "resist", actor: target.id, target: target.id, text: `${target.name}'s rain jacket holds against the flash flood.`, why: ["Flood displacement is prevented; the hit's damage still resolves."] });
            else if (lanyardStops) { target.lanyardUsed = true; log(s, { kind: "resist", actor: target.id, target: target.id, text: `${target.name}'s climbing lanyard catches the shove; no displacement this battle.`, why: ["The tool prevents the first forced movement; later shoves resolve normally."] }); }
          }
        } else if (ev.kind === "entangle") {
          const target = s.actors[ev.target]; if (target) { H.entangle(target, 1); log(s, { kind: "effect", actor: ev.id, target: target.id, tiles: ev.at ? [ev.at] : undefined, text: ev.text }); }
        } else if (ev.kind === "wildHurt") {
          log(s, { kind: ev.kind, actor: ev.id, text: ev.text });
        } else {
          log(s, { kind: ev.kind.startsWith("wild") || ev.kind.startsWith("fire") || ev.kind.startsWith("creeper") ? ev.kind : "terrain", actor: ev.id || null, tiles: ev.at ? [ev.at] : ev.tiles, text: ev.text || ev.kind });
          if (["crush", "slide", "bridgeFall", "carried"].includes(ev.kind)) applyTerrainEvents(s, { id: ev.id || "wild", name: ev.monster || "Wild force" }, [ev]);
        }
        if ((ev.kind === "destroyed" || ev.kind === "shaken") && pickupRules) {
          const dropped = pickupRules.dropsFrom(s.arena, [ev], { seed: s.seed }); s.arena = dropped.arena;
          for (const d of dropped.events) log(s, { kind: "drop", actor: ev.id || null, tiles: [d.at], text: d.text });
        }
      }
      // A total-victory battle can end only after the board effects have had their final chance to resolve.
      checkOutcome(s);
    }
    function unitAt(s, x, y) { return actorAt(s, x, y) || s.wild.find((m) => m.form === "unit" && m.x === x && m.y === y) || null; }
    const unitOccupied = (s, x, y) => !!unitAt(s, x, y);
    function edgeUsed(s, id) { s.stats.edges[id] = (s.stats.edges[id] || 0) + 1; }
    function chargeUltimate(s, a, concept, reason, bonus = 0, utilityMultiplier = 1, classAuraRecharge = false, borrowedOk = false) {
      if (!concept || (concept !== a.primary && concept !== a.secondary && !borrowedOk)) return;
      if (dreamSpaceRules && !dreamSpaceRules.chargeGainAllowed(a, s.dreamSpace)) return;
      if (Auras && Auras.chargeFrozen(a) && !classAuraRecharge) return;   // Auras: class modifiers may explicitly permit a bounded gain
      const base = s.rules.ultimateChargePerConcept;
      const pair = concept !== a.lastChargeConcept && a.lastChargeConcept != null ? s.rules.ultimateChargePairBonus : 0;
      const before = a.ultimateCharge;
      const chargeMul = (a.passives?.ultimateChargeMul || 1) * ((a.traits || []).some((t) => (t?.id || t) === "sampler") ? 0.5 : 1);   // Sampler halves every ultimate charge (Mala, 2026-10-18)
      const gain = Math.round((base + pair + bonus) * utilityMultiplier * chargeMul * (Auras?.chargeMul?.(a) ?? 1));
      a.ultimateCharge = Math.min(s.rules.ultimateChargeMax, before + gain);
      a.lastChargeConcept = concept;
      if (a.ultimateCharge > before) log(s, { kind: "charge", actor: a.id,
        text: `${a.name} builds ${a.ultimateCharge - before} ultimate charge (${a.ultimateCharge}/${s.rules.ultimateChargeMax}).`,
        why: [reason, pair ? `Alternating ${conceptName(concept)} with the other equipped concept adds ${pair}.` : "Charge comes from concept use, not damage.", bonus ? `Resolved composition effect adds ${bonus}.` : "", utilityMultiplier !== 1 ? `Successful utility action charge ×${utilityMultiplier}.` : "", classAuraRecharge ? "Maid's Service Cycle converts cleaned residue into charge while her Selectivity aura is active." : "", chargeMul !== 1 ? `Character traits adjust charge gained ×${chargeMul} (${gain} total).` : ""] });
    }

    // ── replay, learning, progression, report ──────────────────────────────
    function replay(opts, actions) {
      let s = create(opts);
      for (const act of actions) { const r = apply(s, act); if (!r.ok) throw new Error(`replay diverged at ${JSON.stringify(act)}: ${r.error}`); s = r.state; }
      return s;
    }
    // Learning is recorded beside, never inside, the tactical outcome (spec §9).
    function answerTransfer(state, choiceId, transferOverride = null) {
      const s = clone(state); const tr = transferOverride || C.encounters[s.encounter]?.transfer; if (!tr) return { ok: false, error: "This battle has no transfer check.", state };
      const ch = tr.choices.find((c) => c.id === choiceId); if (!ch) return { ok: false, error: "Unknown choice.", state };
      const rec = { promptId: tr.id, response: choiceId, correct: ch.correct, feedback: ch.feedback, rubric: tr.rubric, tacticalOutcome: s.outcome ? s.outcome.winner : null };
      s.learning.push(rec);
      return { ok: true, state: s, record: rec };
    }
    function progress(profile, xpGain) {
      const xp = (profile.xp || 0) + xpGain;
      const level = 1 + Math.floor(xp / C.progression.xpPerLevel);
      const out = { ...profile, xp, level, reserveSlots: reserveSlotsFor(level), proficiency: proficiencyFor(level), equippedSlots: { primary: 1, secondary: 1 } };
      out.milestones = [];
      if (out.reserveSlots > reserveSlotsFor(profile.level || 1)) out.milestones.push(`Reserve storage ${reserveSlotsFor(profile.level || 1)} → ${out.reserveSlots} (equipped slots stay 1 primary + 1 secondary; reserves give no passives).`);
      if (out.proficiency > proficiencyFor(profile.level || 1)) out.milestones.push(`Lens proficiency ${proficiencyFor(profile.level || 1)} → ${out.proficiency}: unlocks lenses like Elasticity “Wide Ring”.`);
      return out;
    }
    function report(s) {
      const edges = Object.entries(s.stats.edges).sort((p, q) => q[1] - p[1]);
      const all = C.opposition.concat(C.composition);
      const decisive = edges.length ? all.find((e) => e.id === edges[0][0]) : null;
      const kills = s.log.filter((e) => e.kind === "defeat").length;
      const missed = [];
      const pDis = Object.keys(s.disclosures.player || {}).length;
      if (!pDis) missed.push("You never revealed a technique: each reveal is ×1.15 for the rest of the encounter, at the cost of telling the opponents how it works.");
      if (s.encounter === "firstWall" && !s.stats.edges["opp-barrier-negates-line"]) missed.push("Try placing Shield Wall directly across the Student's straight-line Filter Bolt to see the barrier interaction.");
      if (s.encounter !== "firstWall" && !s.stats.abilityUses.shockwave && !s.stats.abilityUses.bastionCollapse && !s.stats.abilityUses.recoilCascade) missed.push("You never used a multi-target ability; two opponents standing together are worth one Shockwave.");
      if (s.stats.edges["opp-selectivity-negates-line"]) missed.push("A Membrane filtered your line attack. Field deliveries are *enhanced* by it instead (opp-selectivity-enhances-field).");
      if (s.encounter !== "firstWall" && !s.stats.edges["opp-barrier-negates-line"] && !s.stats.edges["opp-pathway-bypasses-barrier"]) missed.push("Your barriers never came into play. A wall on the gap stops the Sieve's bolts but not the Pathfinder's routes.");
      const xpGain = s.outcome && s.outcome.winner === "player" ? C.progression.victoryXp + kills * C.progression.xpPerDefeat : kills * C.progression.xpPerDefeat;
      return { outcome: s.outcome, rounds: s.round, decisive, edgeCounts: edges, missed, xpGain, learning: s.learning };
    }

    // ── parts ───────────────────────────────────────────────────────────────
    // Most of the engine lives in web/combat/engine/*.js. Each part is installed here with H, the host object: every
    // name this closure has in scope. A part takes what it uses from H and returns its functions, which are added to
    // H for the parts after it and unpacked below so the rest of this file can call them by name.
    // Post-Humanity, Inspiration and Contains Multitudes live in engine/ledgers.js (a part, reached as H.PostHuman,
    // H.Inspiration, H.Multitudes).
    // ── Civilians (Mala, 2026-10-12; docs/civilians.md): shoppers who want to be left alone. They never start a
    // fight; a hit makes them hostile to that side only, and until then their attacks do nothing. Never hold the battle open.
    const isCop = (u) => !!u && u.character === "police_officer";
    const isThief = (u) => !!u && (u.character === "thief" || (u.primary === "stealth" && u.secondary === "deception"));
    const Civilian = {
      side: "civilian", name: "Civilians",
      is: (u) => !!u && u.side === "civilian",
      hostileTo: (s, side) => !!s.civilians?.hostileTo.includes(side),
      sideName: (side) => (side === "player" ? "the player's side" : side === "enemy" ? "the opposing side" : `the ${side} side`),
      atWar(s, a, t) {
        if (!a || !t) return true;
        if (isCop(a)) return t.side !== "civilian" && (this.hostileTo(s, t.side) || isThief(t) || t.id === a.hunting);
        if (isCop(t) && (isThief(a) || t.hunting === a.id)) return true;   // the quarry fights back
        if (a.side === "civilian") return t.side !== "civilian" && this.hostileTo(s, t.side);
        if (t.side === "civilian") return this.hostileTo(s, a.side);
        return true;
      },
      blocked(s, src, tgt) {
        if (src && tgt && isCop(src) && (isThief(tgt) || tgt.id === src.hunting)) return false;
        return !!src && !!tgt && src.side === "civilian" && tgt.side !== "civilian" && src.id !== tgt.id && !this.hostileTo(s, tgt.side);
      },
      attacked(s, src, tgt) {
        if (!src || !tgt || src.id === tgt.id || !s.actors[src.id] || src.side === tgt.side || src.side === "civilian" || tgt.side !== "civilian" || s.preview || src.mirrorOf || tgt.mirrorOf || H.astralRegionOf?.(s, tgt.x, tgt.y) === "pocket") return;   // mirrors and the astral pocket: no civilian law there (Mala, 2026-10-26)
        const book = (s.civilians ||= { hostileTo: [], members: [] });
        if (!book.members.includes(tgt.id)) book.members.push(tgt.id);
        if (!book.hostileTo.includes(src.side)) {
          book.hostileTo.push(src.side);
          log(s, { kind: "faction", actor: tgt.id, target: src.id, text: `${src.name} attacks ${tgt.name}: the civilians are now hostile to ${this.sideName(src.side)}.`, why: ["Civilians shove back only at a side that has hit one of them, and they still do not hold the battle open."] });
        }
        Civilian.respond(s, src, tgt);
      },
      // The muscle: a standing officer without a case takes it; otherwise one backup roll per round.
      respond(s, src, tgt) {
        const free = Object.values(s.actors).find((u) => !u.defeated && !u.notArrived && isCop(u) && !u.hunting);
        const didHarm = isCop(tgt) ? "attacked an officer" : "harmed a civilian";   // officers wear civilian colors; the charge names the victim truly
        const forHarm = isCop(tgt) ? "attacking an officer" : "harming a civilian";
        if (free) {
          free.hunting = src.id; free.forceTarget = src.id; free.forceTargetUntil = 999;
          log(s, { kind: "faction", actor: free.id, target: src.id, text: `${free.name} takes the case: ${src.name} ${didHarm}.`, why: ["The officer stays hostile until the offender is subdued."] });
          return;
        }
        if (s.copRolledRound === s.round) return;   // one backup roll per round; failed rolls burn no badge numbers (Wetland 4099738187 went Officer 3 → Officer 6)
        s.copRolledRound = s.round;
        if (H.seededChance(`${s.seed}:coprespond:${(s.copN || 0) + 1}`) >= 0.5) return;
        s.copN = (s.copN || 0) + 1;
        const open = (x, y) => x >= 0 && y >= 0 && x < s.arena.w && y < s.arena.h && !tileAt(s, x, y).blocksMove && !actorAt(s, x, y);
        const edge = [];
        for (let x = 0; x < s.arena.w; x++) for (const y of [0, s.arena.h - 1]) if (open(x, y)) edge.push([x, y]);
        for (let y = 1; y < s.arena.h - 1; y++) for (const x of [0, s.arena.w - 1]) if (open(x, y)) edge.push([x, y]);
        edge.sort((a, b) => (Math.abs(a[0] - tgt.x) + Math.abs(a[1] - tgt.y)) - (Math.abs(b[0] - tgt.x) + Math.abs(b[1] - tgt.y)));
        if (!edge.length) { log(s, { kind: "faction", text: "The call goes out, but no unit can reach the scene." }); return; }
        const ch = C.characters.police_officer, id = `officer-${s.copN}`, at = edge[0];
        const base = s.actors.player || Object.values(s.actors)[0];
        const a = H.freshBody(base, s);
        Object.assign(a, {
          id, character: "police_officer", name: `Officer ${s.copN}`, category: "civilian", side: "civilian", sprite: ch.sprite,
          ai: "police_officer", controller: "ai", posture: "aggressive", permanentAlly: false, selectedConfig: null,
          x: at[0], y: at[1], maxLF: 80, lf: 80, pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0,
          primary: ch.primary, secondary: ch.secondary, reserve: [], reserveSlots: 0, lens: clone(ch.lens || {}), level: 1, xp: 0, proficiency: 1,
          traits: [...(ch.traits || [])], passives: {}, abilities: [], aiAbilities: null, learned: [],
          inventory: [], inventoryCapacity: pickupRules?.rules?.slots || 2, reaction: 0, ownerTurns: 0, boss: null, size: null, massive: false,
          tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0,
          moved: false, acted: false, guardUsedThisTurn: false, defeated: false, notArrived: false, arrivesRound: null,
          eventActor: false, eventRole: null, aggressive: true, persuaded: false, standDownUntil: null, willpower: 10, maxWillpower: 10, soul: H.soulMaxFor(s.rules, ch.soulKind, "police_officer", ch.traits), maxSoul: H.soulMaxFor(s.rules, ch.soulKind, "police_officer", ch.traits), soulKind: ch.soulKind || null, husk: false,
          hunting: src.id, forceTarget: src.id, forceTargetUntil: 999,
          vows: [], rite: null, riteAugment: null, inspiration: 0, role: null, audition: null, typecast: null, bond: null,   // fresh badge (Officer 6 fought under Warden's Far Shot)
        });
        a.status = { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null, immovable: null, exposed: null, attention: null, rangeBuff: null, tippingPoint: null, ambush: null, catharsis: null, drowning: null };
        s.actors[id] = a;
        if (!s.order.includes(id)) s.order.push(id);
        s.disclosures[id] = {}; s.knowledge[id] = {}; s.observedAbilities[id] = [];
        for (const other of Object.keys(s.actors)) {
          (s.knowledge[other] ||= {})[id] ||= { secondary: true, lens: true, abilities: {} };
          if (other !== id) s.knowledge[id][other] = { secondary: true, lens: true, abilities: {} };
        }
        const members = (s.civilians ||= { hostileTo: [], members: [] });
        if (!members.members.includes(id)) members.members.push(id);
        log(s, { kind: "faction", actor: id, target: src.id, tiles: [at], text: `${a.name} responds: ${src.name} is wanted for ${forHarm}.`, why: ["The officer stays hostile until the offender is subdued."] });
      },
      // Places the first member, a customer with the grocery-bag sprite. Not a concept class.
      present(s, spec = {}) {
        const id = spec.id || "customer";
        if (s.actors[id]) return s.actors[id];
        const open = (x, y) => x >= 0 && y >= 0 && x < s.arena.w && y < s.arena.h && !tileAt(s, x, y).blocksMove && !actorAt(s, x, y);
        let spot = spec.at || null;
        if (!spot) {
          const px = s.actors.player?.x ?? 1, py = s.actors.player?.y ?? 3, found = [];
          for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) if (open(x, y) && Math.abs(x - px) + Math.abs(y - py) >= 2) found.push([x, y]);
          found.sort((a, b) => (Math.abs(a[0] - px) + Math.abs(a[1] - py)) - (Math.abs(b[0] - px) + Math.abs(b[1] - py)) || a[0] - b[0] || a[1] - b[1]);
          spot = found[0] || null;
        }
        if (!spot || !open(spot[0], spot[1])) return null;
        const base = s.actors.player || Object.values(s.actors)[0];
        const a = H.freshBody(base, s);
        const name = spec.name || "Customer";
        Object.assign(a, {
          id, character: "customer", name, category: "civilian", side: "civilian", sprite: spec.sprite || "customer",
          ai: null, controller: "ai", posture: "protective", permanentAlly: false, selectedConfig: null,
          x: spot[0], y: spot[1], maxLF: 40, lf: 40, pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0,
          primary: null, secondary: null, reserve: [], reserveSlots: 0, lens: {}, level: 1, xp: 0, proficiency: 1,
          traits: ["pacifist"], passives: {}, abilities: [], aiAbilities: [], learned: [],
          inventory: [], inventoryCapacity: 0, reaction: 0, ownerTurns: 0, boss: null, size: null, massive: false,
          tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0,
          moved: false, acted: false, guardUsedThisTurn: false, defeated: false, notArrived: false, arrivesRound: null,
          eventActor: false, eventRole: null, aggressive: false, persuaded: false, standDownUntil: null, willpower: 10, maxWillpower: 10, soul: H.soulMaxFor(s.rules, null, "customer", ["pacifist"]), maxSoul: H.soulMaxFor(s.rules, null, "customer", ["pacifist"]), soulKind: null, husk: false,
        });
        a.status = { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null, immovable: null, exposed: null, attention: null, rangeBuff: null, tippingPoint: null, ambush: null, catharsis: null, drowning: null };
        s.actors[id] = a;
        if (!s.order.includes(id)) s.order.push(id);
        s.disclosures[id] = {}; s.knowledge[id] = {}; s.observedAbilities[id] = [];
        for (const other of Object.keys(s.actors)) {
          (s.knowledge[other] ||= {})[id] ||= { secondary: true, lens: true, abilities: {} };
          if (other !== id) s.knowledge[id][other] = { secondary: true, lens: true, abilities: {} };
        }
        const book = (s.civilians ||= { hostileTo: [], members: [] });
        if (!book.members.includes(id)) book.members.push(id);
        log(s, { kind: "faction", actor: id, tiles: [spot], text: `${name} is here with the groceries, and wants to be left alone.`, why: ["Civilians do not start fights, and they do not have to fall for the battle to end."] });
        return a;
      },
    };
    const H = {
      Civilian, Observation, observationH, Tourist, touristH, Auras, Belief, Bonds, C, CRAFT, CRAFT_OWN, ClassRuntime, Climate, Communion, DIRS, EM, EmergentIdeas, EnemySummons, FEAR, GraphLive, INTERDICT, Imitation, MED, MaidSystems,
      Parley, Conversion, Courtroom, Dispatch, Presence, Debt, Sealing, Performers, Postures, President, REVEAL, RITUAL, RandomEvents, SHADE, Sight, Stealth, Traps, Tsukumogami, UtilityAI, Visitors, Vows, Affinity, VK, WX, Workflow, ab, abilitiesOf, Director, MindDuel,
      accountItems, activeTerrainEffect, actorAt, addRandomTerrain, addStun, allyLook, answerTransfer, archivistTestOptions, auraH, barrierAt,
      borrowedPools, bossAbilityIds, bossRules, cannotSwim, chargeUltimate, classH, clone, compositionEdge, conceptName, content, coversTile, create,
      currentId, declaredRange, dist, dodgeCostFor, dreamCanReach, dreamSame, dreamSpaceRules, edgeUsed, footprint, gradeableSoil, hasDeception,
      hasSight, heightAt, inside, insightRules, keepDreamPositions, key, lensOf, line, liveSummon, log, manifest, mapgen, mirrorRules, modeRules,
      moveBudgetFor, ownerOfConcept, paths, pickupRules, planViewActive, plantUnderfoot, presidentCanRecognize, presidentContext,
      presidentEffects, presidentRules, presidentUnits, processRandomEvents, proficiencyFor, progress, randomEncounterOptions, rangeEnvelope,
      recordBattleMirrorOutcome, recordEarthMoved, recordMirrorEvent, refreshDrowning, replay, report, reserveSlotsFor, restoreRandomTerrain,
      runWildEnvironment, saveWildWorld, settleHomeward, spendTempo, summonProfile, summonReadiness, summonQuestionHints, springTraps, structures, summonQuestions, summonRules,
      summonTrueFormTestOptions, surfaceAt, syncPickup, syncPresidentUnit, terrainData, tileAt, traitKey, unitAt, unitOccupied, updateWildTelegraphs,
      vegetation, weatherTileValue, wildRules, wildSnapshot
    };
    for (const part of ENGINE_PARTS) Object.assign(H, part(H));
    H.relayH = relayH; H_hasTrait = H.hasTrait; H.craftMax = craftMax; H.mindset = mindset; H.advanceTime = advanceTime; H.dreamOpening = dreamOpening; H.isNight = isNight;
    // Horticulture leash (true-forms.js leashAction): every AI decision for a communed plant passes through it. Wrapped here,
    // on the host, so the look-ahead in actions.js and the public aiAction both get the corrected action.
    { const decide = H.aiAction; H.aiAction = (s) => { const before = decide(s), after = H.leashAction(s, before); if (before !== after) H.traceAiEvent("postprocess", { reason: "plant-leash", before, after }); return after; }; }
    // Contact Reading doubles a held unit's costs inside spendTempo, after the AI has already judged what it can afford.
    // So for a unit paying a multiplier, check the chosen action against the real price and fall back to something it
    // can pay for: break the hold, else guard, else bank the turn.
    { const decide = H.aiAction; H.aiAction = (s) => {
        const act = decide(s), a = act && s.actors[act.actor];
        if (!a || H.heldCostMul(s, a) === 1 || ["end", "stall", "respond"].includes(act.type) || H.apply(s, act, { preview: true }).ok) return act;
        for (const alt of [{ type: "breakGrapple", actor: a.id }, { type: "guard", actor: a.id }]) if (H.apply(s, alt, { preview: true }).ok) { H.traceAiEvent("postprocess", { reason: "held-affordability", before: act, after: alt }); return alt; }
        const fallback = { type: a.tempo > 0 ? "stall" : "end", actor: a.id };
        H.traceAiEvent("postprocess", { reason: "held-affordability", before: act, after: fallback }); return fallback;
      }; }
    const {
      knownEnemyTraps, chanted, endRitual, ritualTick, beadBeast, beastTick, applyPoison, poisonTick, fearless, fearCheck, heroFell, onEdge,
      edgeDistance, fleeBattle, isMonster, monsterCtx, monsterApply, hasTrait, deathDoorOdds, communeDiscount, tryDeathDoor, performerTestOptions,
      focusedDreamTestOptions, devPlaygroundOptions, themedBattleOptions, meleeTestOptions, beginRound, patchAt, createSuccessionPatch, setPatchStage, advanceSuccessionRound, disturbSuccession, startTurn,
      continueTurnStart, summonSnapshot, applySummonUltimateEffects, expire, endTurn, revealDreamSummons, applyRevealEffect, trueFormFieldAt,
      syncTrueFormFields, applyTrueFormReveal, runTrueFormTechnique, applyTrueFormEffects, eatMushroom, fullCourtPressOptions, closeDreamSummons,
      checkDreamCollapse, resolveDreamRound, registerDreamActor, resolveRandomDreamRift, resolveDreamAppearances, advance, communeAlly, applyGaiaBoons, rootFallenPlants,
      checkOutcome, roundFn, findOpp, hit, applyFall, applyEntryEffects, lineStop, negateAtBarrier, targetInteractions, strikeTarget, schedule,
      resolveScheduled, resolveDelayed, opponentsOn, unitsOn, terrainDamagingArea, areaRecipients, areaTiles, rawAreaTiles, effectiveRange, target,
      aiFailure, aiSnapshot, aiLearnResult, apply, stallPreview, handlers, resolvePrune, resolveAbility, resolveDreamAbility, moduleArena, engineArena,
      applyTerrainEvents, applyTerrainDamage, knock, responseOptions, openResponseWindow, skipUnable, respond, closeResponseWindow, decider,
      moveOptions, jumpOptions, climbOptions, targeting, preview, availableAbilities, seededChance, beliefSummonCandidate, aiLastWorkflow, shownTrait,
      aiAction, demonstratedTraits, recordShown, aiDecide, candidates, score, approach, retreat, lessonsOf, lessonMul, cannotDodge
    } = H;
    return { cards: H.Cards, warfareEventOptions, eventParticipantsFor, create, apply, preview, targeting, moveOptions, jumpOptions, climbOptions, movementBudget: (s, id) => moveBudgetFor(s, s.actors[id]), movementStepCost: (...a) => H.stepCost(...a), availableAbilities, randomEncounterOptions, manifest: (s, id, abId) => manifest(s, s.actors[id], abId),
      waterState: (s,x,y) => H.waterState(s,x,y), updateWater: s => H.updateWater(s), recoverWater: (s,id) => H.waterRecovery(s,s.actors[id]),
      abilitiesOf: (s, id) => abilitiesOf(s.actors[id]), riteDraws: (def) => H.riteDraws(def), decider, aiAction, inspectAiAction: (s, options) => H.withAiTrace(() => aiAction(s), options), replay, answerTransfer, progress, report, mysteryFoeView: (s, side) => ({ count: (s.mystery?.[side] || []).length }), mysteryOwnView: (s, side) => (s.mystery?.[side] || []).map((c) => ({ ...c })),
      // For tests and sims: land a hit or a stun through the real pipeline, and read the monster context.
      testEntry: (s, srcId, unitId, x, y) => { const u = s.actors[unitId]; u.x = x; u.y = y; applyEntryEffects(s, s.actors[srcId], u, x, y, "is forced into"); },
      weatherTileValue, demonstratedTraits,
      // The land's wounds (engine/land.js), for tests and sims.
      land: { wound: (s, id, kind, n) => H.landWound(s, s.actors[id], kind, n), control: (s, id) => H.groundControl(s, s.actors[id]), round: (s) => H.landRound(s),
        terrainDamage: (s, srcId, inst) => H.applyTerrainDamage(s, s.actors[srcId], inst), form: (s, id, f) => H.setGaiaForm(s, s.actors[id], f), cost: (s, id, cand) => H.landCost(s, s.actors[id], cand) },
      findingNoteOptions: (s,id) => H.Observation.findingNoteOptions(s,s.actors[id]),
      journalOptions: (s, id) => s?.actors?.[id] ? H.journalOptions(s, s.actors[id]) : [], corpseBeside: (s, id) => s?.actors?.[id] ? H.corpseBeside(s, s.actors[id]) : null, burialAp: (s, id) => s?.actors?.[id] ? H.burialAp(s, s.actors[id]) : 0, tamer: { chance: (s, id, m) => H.tameChance(s, s.actors[id], m), state: (s, id) => H.stateTraits(s, s.actors[id]) },   // engine/tamer.js, for tests
      houses: { round: (s) => H.houseRound(s), fell: (s, src) => H.houseFell(s, src, {}), rebuild: (s) => H.houseRebuild(s), dividend: (s, o) => H.houseDividend(s, o), options: (s, id) => H.houseOptions(s, s.actors[id]) },
      wildRules, wildSnapshot, saveWild: (s, w) => saveWildWorld(s, w), testPoison: (s, unitId, kind, srcId) => applyPoison(s, s.actors[unitId], wildRules.data.monsters[kind], srcId || null, "stung"),
      dodgeCost: (s, id, attackerId = null) => H.Injury.dodgeCost(s, s.actors[id], dodgeCostFor(s, s.actors[id], attackerId)), dodgeReach: (s, id) => H.Injury.dodgeReach(s, s.actors[id]), communeDiscount: (s, id, kind = "plant") => H.communeDiscount(s.actors[id], kind), auditionOptions: (s, id) => ClassRuntime?.actor ? ClassRuntime.actor.options(s, s.actors[id], { C, seededChance: H.seededChance }) : [], auditionLabel: (roleId) => ClassRuntime?.actor ? ClassRuntime.actor.pairLabel({ C }, roleId) : roleId,
      knownEnemyTraps: (s, id) => knownEnemyTraps(s, s.actors[id]).map(t => ({ x: t.x, y: t.y, potency: t.potency })),
      fearCheck: (s, tgtId, srcId) => fearCheck(s, s.actors[tgtId], s.actors[srcId]),
      aiCandidates: (s, id) => H.candidates(s, id), dispatchArrive: (s) => { const r = Dispatch.arrive(s, H); H.checkOutcome(s); return r; }, dispatchTrigger: (s, id, opts) => Dispatch.trigger(s, H, id, opts),
      heldCostMul: (s, id) => H.heldCostMul(s, s.actors[id]), breakCost: (s, id) => H.breakCost(s, s.actors[id]), strongGrip: (s, id) => H.strongGrip(s, s.actors[id]), climbCost: (s, id) => H.climbCost(s, s.actors[id]), jumpCost: (s, id) => H.jumpCost(s, s.actors[id]), reportCheck: (s, id) => H.reportCheck(s, s.actors[id]), roundsToFlip: (s) => { let n = 1; while (n < 99 && phaseAt(s, s.round + n) === phaseAt(s, s.round)) n++; return n; }, phaseAt: (s, round) => phaseAt(s, round), isNight, dreamOpening: (s, openLess) => dreamOpening(s, openLess), testAdvanceTime: (s) => { advanceTime(s); return s; }, talkCost: (s, id, action, base) => H.talkCost(s.actors[id], action, base), mindset: (s, id) => mindset(s.actors[id]), craftMax: (s, id) => craftMax(s.actors[id]),
      testTurnStart: (s, id) => { const a = s.actors[id]; H.cornerAdvice(s, a); const ally = H.callCompanion(s, a); H.squeeze(s, a); return ally; },
      strikeRange: (s, id) => H.strikeRange(s, s.actors[id]), grappleCost: (s, id) => H.grappleCost(s, s.actors[id]),
      freeStrike: (s, id, targetId, effort) => H.freeStrike(s, s.actors[id], s.actors[targetId], effort),
      grappleOdds: (s, id) => H.grappleChance(s, s.actors[id]), testResponseOptions: (s, id, srcId) => H.responseOptions(s, s.actors[id], { owner: srcId, tiles: [[s.actors[id].x, s.actors[id].y]] }),
      // Test hook: put one unit down through the ordinary defeat path (bonds, risesOnDeath, outcome). Returns a new state.
      testDefeat: (s, id) => { const t = clone(s), a = t.actors[id]; a.status.guard = a.status.ward = null; a.lf = 1; H.hit(t, { id: "test", name: "A test blow", side: "wild" }, a, null, 99, ["test"], { label: "Test blow", damageType: "nigredo" }); return t; },
      testStartTurn: (s, id) => H.tendPlants(s, s.actors[id]), testLeash: (s, act) => H.leashAction(s, act),
      exposure: H.Exposure, testHit: (s, srcId, tgtId, inst, potency) => { const m = s.wild?.find(w => w.id === tgtId); return hit(s, s.actors[srcId], s.actors[tgtId] || (m && { ...m, wild: true }), inst, potency, ["test"], {}); },
      testStun: (s, srcId, tgtId, points) => addStun(s, s.actors[srcId], s.actors[tgtId], points),
      testRegisterDreamActor: (s, raw, at) => H.registerDreamActor(s, raw, at, "dreamAppear", null),   // stage a dream creature without a Dream Space
      monsterCtx, concentrationProfile: (s, id, lost, opts) => H.concentrationProfile(s, s.actors[id], lost, opts), concentrationValue: (s, id, cand) => H.concentrationValue(s, s.actors[id], cand),
      aiScore: (s, id, cand) => score(s, id, cand),   // read-only: what the AI thinks a candidate action is worth (tests, sims)
      aiLessons: (s, id) => lessonsOf(s, s.actors[id]), aiLessonMul: (s, id, cand) => lessonMul(s, s.actors[id], cand, lessonsOf(s, s.actors[id])),   // read-only: what this unit has learned this battle
      approach: (s, id) => approach(s, s.actors[id]), retreat: (s, id) => retreat(s, s.actors[id]),   // fallback moves (tests, sims)
      responseOptions: (s) => s.pending ? responseOptions(s, s.actors[decider(s).actor], s.pending.inst) : [],
      parleyOptions: (s, id) => (Parley ? Parley.options(s, id) : { terms: [], offers: [] }), tallyStatus: (s, id) => (H.Tally ? H.Tally.status(s, id) : null), anteLeader: (s) => H.anteLeader(s), anteCarry: (s) => H.anteCarry(s), antePreBlood: (s) => H.antePreBlood(s), gamblerHeat: (s, id) => H.heatOf(s, id), myolOffer: (s) => s.lastRoll, hyperRules: () => H.hyperRules, jackpotMeter: (s) => H.jackpotMeter(s),   // Parley menu entries; the ledger boss (engine/tally.js): owed, held, open terms; ante (W1.5): leader, carry, pre-blood gate; hyper (W5.3): heat, last roll, rules, meter
      talkChance: (s, id, targetId) => (Parley && s.actors[targetId] ? (Parley.cannotTalk(s, s.actors[id], s.actors[targetId]) ? 0 : Parley.talkChance(s, s.actors[id], s.actors[targetId])) : null),
      mindIntel: (s, viewerId) => (MindDuel ? MindDuel.intel(s, viewerId) : null),   // Mind duel: window data for the UI
      placeCivilian: (s, spec) => Civilian.present(s, spec),
      touristTestOptions: () => ({ encounter:"firstWall",title:"The Tourist · postcard test",seed:5,tourist:{at:[2,3]},startingActor:"player",arenaData:{name:"Camera Garden",map:Array(8).fill("............"),objects:[{id:"fern",kind:"plant",type:"Fern",form:"groundcover",material:"plant",x:5,y:1,hp:12,blocksMove:false}]},participants:[{id:"player",character:"warden",side:"player",at:[5,3]},{id:"student",character:"student",side:"enemy",at:[10,6]}] }),
      multitudes: (s, id) => H.Multitudes.view(s, s.actors[id]), multitudesTestOptions, embodiedConceptsTestOptions: () => ({ encounter: "firstWall", focusedDreamTest: true, title: "Embodied Concepts · test", seed: 53, startingActor: "player", initialSummons: [], rules: { embodiedConcepts: { ...C.rules.embodiedConcepts, enabled: true } }, arenaData: { name: "Embodiment test", map: Array(7).fill("..........."), objects: [] }, participants: [{ id: "player", character: "warden", side: "player", at: [3, 3] }, { id: "student", character: "student", side: "enemy", at: [8, 3] }] }),   // reachability: the opt-in rides opts.rules (folded here: engine.js stays under its cap)
      aiFailure, aiSnapshot, stallPreview, deathDoorOdds, proficientSummonerTestOptions, summonProfile, summonReadiness, summonQuestionHints, emergentIdeas: (s, id) => EmergentIdeas?.active(s.actors[id]) || [], performerTestOptions, focusedDreamTestOptions, devPlaygroundOptions, themedBattleOptions, meleeTestOptions, summonTrueFormTestOptions, archivistTestOptions, fullCourtPressOptions,
      geometry: { line, hasSight: (s, ...p) => hasSight(s, ...p), paths: (s, ...p) => paths(s, ...p), dist: (s, ...p) => dist(s, ...p), tileAt: (s, x, y) => tileAt(s, x, y), surfaceAt: (s, x, y) => surfaceAt(s, x, y), barrierAt: (s, x, y) => barrierAt(s, x, y), actorAt: (s, x, y) => actorAt(s, x, y), heightAt: (s, x, y) => heightAt(s, x, y), observedAbilities: (s, id) => (s.observedAbilities?.[id] || []).filter(aid => ab(aid)?.tier !== "ultimate").map(aid => ({ id: aid, name: ab(aid).name, concepts: ab(aid).concepts })) },
      lensOf: (s, id, c) => lensOf(s.actors[id], c), compositionEdge: (s, id) => compositionEdge(s.actors[id]), content: C, stance: (s, v, t) => H.stanceFor(s, s.actors[v], s.actors[t]), hostileSides: (s, t) => H.hostileSidesFor(s, s.actors[t]),
      astral: { regionOf: (s, x, y) => H.astralRegionOf(s, x, y), sameRegion: (s, ax, ay, bx, by) => H.astralSameRegion(s, ax, ay, bx, by) }, applyRevealEffect: (s, id) => applyRevealEffect(s, s.actors[id]) };   // astral pocket queries + reveal effects, for tests
  }

  return { engine };
});
