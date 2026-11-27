"use strict";
// Astral pocket: projection onto a sealed pocket region east of the material map (Mala, 2026-10-24).
// A part of the Concept Combat engine: engine.js installs it with the host object H and it hands back the
// functions it defines. Last in ENGINE_PARTS, so it may destructure every other part; earlier parts call it
// back through H at runtime.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).astral = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const spiritGone = (s, u) => { const Spirit = (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null; Spirit?.onExit?.(s, u, H); };   // SP-05: every exit refreshes the roster
    const { C, log, key, inside, tileAt, actorAt, barrierAt, hasTrait, seededChance, soulMaxFor, insightRules } = H;
    const RESIDENTS = ["moonflower", "archivist_elf", "bard_elf", "astral_security", "celestial_astral"];

    // Generalised pocket (Sunken Ruins BD1, specs/SUNKEN_RUINS.md 6.2): appends `gap` void columns and a `w`-wide
    // open-ground pocket east of whatever the arena is now. `s.arena.landW` is recorded once by whichever pocket opens
    // first. `s.astral` stays as the alias for `s.pockets.astral`.
    function openPocket(s, kind, opts = {}) {
      s.pockets ||= {};
      if (kind === "astral" && s.astral?.ready) return s.astral;
      if (s.pockets[kind]?.ready) return s.pockets[kind];
      const R = kind === "deep" ? s.rules.dive : s.rules.astral;
      if (!R) return null;
      const curW = s.arena.w, h = s.arena.h, gap = opts.gapW ?? R.gapW ?? 64, pw = opts.w ?? R.pocketW ?? 9;
      if (s.arena.landW == null) s.arena.landW = curW;
      const landW = s.arena.landW;
      const x0 = curW + gap;
      s.arena.map = s.arena.map.map((row) => row + "#".repeat(gap) + ".".repeat(pw));
      const hh = s.arena.height?.length === h ? s.arena.height : Array.from({ length: h }, () => Array(curW).fill(0));
      s.arena.height = hh.map((row) => [...row, ...Array(gap).fill(0), ...Array(pw).fill(0)]);
      s.arena.w = x0 + pw;
      if (kind === "astral") {
        const portal = [x0 + Math.floor(pw / 2), Math.floor(h / 2)];
        const rec = { kind: "astral", ready: true, x0, w: pw, landW, portal, entries: {}, genN: 0 };
        s.pockets.astral = rec;
        s.astral = rec;
        log(s, { kind: "astral", tiles: [portal], text: `The astral plane opens east of the world: a sealed pocket ${pw} tiles wide behind ${gap} of void.`, why: ["One astral pocket per battle. Distance and void seal it: no range, line, field, route, aura, or move budget crosses."] });
        return rec;
      }
      const rope = [x0 + Math.floor(pw / 2), 0];
      const prevN = s.pockets.deep?.n || 0;
      const seenBy = { player: false, enemy: false };
      if (opts.openerSide === "player" || opts.openerSide === "enemy") seenBy[opts.openerSide] = true;
      const rec = { kind: "deep", ready: true, x0, w: pw, landW, rope, opener: opts.opener || null, seenBy, n: prevN + 1 };
      s.pockets.deep = rec;
      return rec;
    }
    const ensureAstralPocket = (s) => openPocket(s, "astral");
    const astralRegionOf = (s, x, y) => {
      const A = s.pockets?.astral || s.astral;
      const D = s.pockets?.deep;
      if (A?.ready && x >= A.x0 && x < A.x0 + A.w) return "pocket";
      if (D?.ready && x >= D.x0 && x < D.x0 + D.w) return "deep";
      const landW = s.arena.landW ?? A?.landW ?? D?.landW;
      if (landW != null && x >= landW) return "void";
      return "land";
    };
    const astralSameRegion = (s, ax, ay, bx, by) => astralRegionOf(s, ax, ay) === astralRegionOf(s, bx, by);
    const astralPocketActive = (s) => !!(s.astral?.ready && Object.values(s.actors).some((a) => a.soulOf && !a.defeated));

    function openPocketTileFor(s, P, near, exclude) {
      const h = s.arena.h;
      const taken = new Set((exclude || []).map(([x, y]) => key(x, y)));
      for (let r = 0; r < Math.max(P.w, h); r++)
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = near[0] + dx, y = near[1] + dy;
          if (x < P.x0 || x >= P.x0 + P.w || y < 0 || y >= h || taken.has(key(x, y))) continue;
          if (tileAt(s, x, y).blocksMove || actorAt(s, x, y) || barrierAt(s, x, y)) continue;
          if ((s.wild || []).some((m) => m.form === "unit" && m.x === x && m.y === y)) continue;
          return [x, y];
        }
      return null;
    }
    const openPocketTile = (s, near, exclude) => openPocketTileFor(s, s.astral, near, exclude);
    function openLandTile(s, near, exclude) {
      const landW = s.arena.landW ?? s.arena.w, h = s.arena.h;
      const taken = new Set((exclude || []).map(([x, y]) => key(x, y)));
      const sx = Math.max(0, Math.min(landW - 1, near?.[0] ?? 0));
      const sy = Math.max(0, Math.min(h - 1, near?.[1] ?? 0));
      for (let r = 0; r < Math.max(landW, h); r++)
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = sx + dx, y = sy + dy;
          if (x < 0 || x >= landW || y < 0 || y >= h || taken.has(key(x, y))) continue;
          if (tileAt(s, x, y).blocksMove || actorAt(s, x, y) || (barrierAt(s, x, y) && !barrierAt(s, x, y).passable)) continue;
          if ((s.wild || []).some((m) => m.form === "unit" && !m.defeated && m.x === x && m.y === y)) continue;
          return [x, y];
        }
      return null;
    }
    function destroyPocket(s, kind = "deep") {
      if (kind !== "deep") return false;
      const D = s.pockets?.deep;
      if (!D?.ready) return false;
      const inDeep = (u) => u && u.x >= D.x0 && u.x < D.x0 + D.w;
      const actorsBelow = Object.values(s.actors).filter(inDeep);
      const wildBelow = (s.wild || []).filter((m) => m.form === "unit" && inDeep(m));
      const opener = D.opener ? s.actors[D.opener] : null;
      const openerWas = opener && inDeep(opener) ? [opener.x, opener.y] : D.rope;
      const placed = [];
      const placeUp = (u, fallback) => {
        const at = openLandTile(s, u.dive?.from || fallback, placed) || openLandTile(s, fallback, placed) || [D.x0 - 1, 0];
        u.x = at[0]; u.y = at[1];
        if (at[0] < (s.arena.landW ?? s.arena.w)) placed.push(at);
        u.dive = null;
        if (u.status?.drowning) u.status.drowning = null;
        return at;
      };
      let openerLand = opener?.dive?.from || [0, 0];
      if (opener && inDeep(opener)) openerLand = placeUp(opener, openerLand);
      else if (opener) { opener.dive = null; if (opener.status?.drowning) opener.status.drowning = null; }
      const others = [...actorsBelow.filter((u) => !opener || u.id !== opener.id), ...wildBelow];
      others.sort((u, v) => Math.max(Math.abs(u.x - openerWas[0]), Math.abs(u.y - openerWas[1])) - Math.max(Math.abs(v.x - openerWas[0]), Math.abs(v.y - openerWas[1])));
      for (const u of others) placeUp(u, openerLand);
      s.arena.map = s.arena.map.map((row) => row.slice(0, D.x0) + "#".repeat(D.w) + row.slice(D.x0 + D.w));
      D.ready = false;
      log(s, { kind: "dive", text: "The water closes over the drowned coast: everyone below comes up." });
      return true;
    }
    function deepBreathFor(s, a) {
      const R = s.rules.dive || {};
      const base = hasTrait(a, "swimmer") ? (R.breathSwimmer ?? 5) : (R.breathBase ?? 3);
      const sources = (a.passives?.breathTurnsAdd || 0) + (hasTrait(a, "breathHolder") ? 1 : 0);
      return Math.min(R.breathMax ?? 9, base + sources * (R.breathPerSource ?? 2));
    }
    function diveValidate(s, a) {
      const R = s.rules.dive;
      if (!R) return "Diving is unavailable.";
      if (!a || a.defeated) return "The dead do not dive.";
      if (a.soulOf) return "A projected soul cannot dive.";
      if (a.soulless) return "The body lies soulless while its soul is out.";
      if (a.dive?.below || astralRegionOf(s, a.x, a.y) === "deep") return "Already below the surface.";
      if (astralRegionOf(s, a.x, a.y) !== "land") return "Dive starts from the material world.";
      if (s.film) return "The set is enclosed: there is nowhere to dive.";
      if (H.cannotSwim?.(a)) return "You would sink.";
      const ch = s.arena.map[a.y]?.[a.x];
      if (ch !== "w" && ch !== "~") return "Stand on a water tile to dive.";
      if (!s.pockets?.deep?.ready) {
        if (a.side !== "player" && !hasTrait(a, "theDeep")) return "Only the player's side or a fighter with The Deep can open an underwater map.";
        if ((a.diveOpens || 0) >= (R.opensPerBattle ?? 2)) return "You cannot open another underwater map this battle.";
      }
      return null;
    }
    function diveEnter(s, a) {
      const alreadyOpen = !!s.pockets?.deep?.ready;
      const D = alreadyOpen ? s.pockets.deep : openPocket(s, "deep", { opener: a.id, openerSide: a.side });
      if (!alreadyOpen) { a.diveOpens = (a.diveOpens || 0) + 1; placeRuins(s); }
      else if (a.side === "player" || a.side === "enemy") D.seenBy[a.side] = true;
      const from = [a.x, a.y];
      const at = openPocketTileFor(s, D, D.rope) || D.rope;
      const breath = deepBreathFor(s, a);
      a.x = at[0]; a.y = at[1];
      a.dive = { from, opener: D.opener, breath, maxBreath: breath, below: true };
      a.status.drowning = null;
      if (!D.seenBy.player) log(s, { kind: "dive", actor: a.id, hidden: true, text: `${a.name} dives out of sight.` });
      else log(s, { kind: "dive", actor: a.id, tiles: [from, at], text: `${a.name} dives below to (${at[0]},${at[1]}) (${breath} turns of breath).` });
      return D;
    }
    // Sunken Ruins BD3 (R-20261124-02, 6.6): ruins below. Two band sites are
    // placed on a fresh deep map; reads and carried finds ride s.ruins until
    // the battle-award path settles them (finishBattle via result.ruins).
    // The engine never touches the account: s.ruinsAcct is a read-only
    // snapshot of account.dive ({ read, taken, dives }) taken at battle
    // setup, and every account write happens in loot.js finishBattle.
    const DiveData = () => (typeof module === "object" && module.exports ? require("../dive/dive-data.js") : (typeof self !== "undefined" ? self.ConceptCombatDiveData : null)) || null;
    const Dive = () => (typeof module === "object" && module.exports ? require("../dive/dive.js") : (typeof self !== "undefined" ? self.ConceptCombatDive : null)) || null;
    function ruinsAcct(s) {
      const d = s.ruinsAcct;
      return d && typeof d === "object" ? { read: d.read || {}, taken: d.taken || {}, dives: d.dives || 0 } : { read: {}, taken: {}, dives: 0 };
    }
    function placeRuins(s) {
      const DD = DiveData(); if (!DD) return null;
      const D = s.pockets?.deep; if (!D?.ready) return null;
      const sites = (DD.sites ? DD.sites(1) : []).filter((b) => b && b.id);
      if (!sites.length) return null;
      const acct = ruinsAcct(s);
      const ordered = [...sites.filter((b) => !acct.read[b.id]), ...sites.filter((b) => acct.read[b.id])].slice(0, 2);
      const h = s.arena.map?.length || 1;
      const offs = [[-2, 3], [2, 5]];
      const keepRead = (s.ruins && Array.isArray(s.ruins.read)) ? s.ruins.read : [];
      const keepTaken = (s.ruins && s.ruins.taken) ? s.ruins.taken : {};
      s.ruins = {
        band: 1,
        sites: ordered.map((b, i) => ({
          siteId: b.id,
          x: Math.min(Math.max(D.x0, D.rope[0] + offs[i][0]), D.x0 + D.w - 1),
          y: Math.min(Math.max(0, D.rope[1] + offs[i][1]), h - 1),
        })),
        read: keepRead,
        taken: keepTaken,
      };
      return s.ruins;
    }
    function ruinsSite(s, siteId) {
      const R = s.ruins;
      const at = R && R.sites.find((t) => t.siteId === siteId);
      if (!at) return null;
      const DD = DiveData(); if (!DD) return null;
      const site = DD.siteById ? DD.siteById(siteId) : null;
      if (!site) return null;
      return { ...at, site };
    }
    function ruinsReadValidate(s, a, siteId) {
      const R = s.rules.dive;
      if (!R) return "Reading is unavailable.";
      if (!a || a.defeated) return "The dead do not read.";
      if (astralRegionOf(s, a.x, a.y) !== "deep") return "Read the ruins below the surface.";
      if (a.side !== "player") return "Only the player's side reads the ruins.";
      const hit = ruinsSite(s, siteId);
      if (!hit || Math.max(Math.abs(a.x - hit.x), Math.abs(a.y - hit.y)) > 1) return "Stand beside a ruin to read it.";
      if (ruinsAcct(s).read[siteId] || (s.ruins.read || []).includes(siteId)) return "Already read.";
      const D = Dive(); if (!D) return "Reading is unavailable.";
      const q = D.questionFor(hit.site, s.seed || 0);
      if (!q) return "Nothing here to read.";
      return null;
    }
    function ruinsReadApply(s, a, siteId, choice) {
      const hit = ruinsSite(s, siteId);
      const D = Dive(); const q = D && hit ? D.questionFor(hit.site, s.seed || 0) : null;
      if (!q || !Array.isArray(q.choices) || !Number.isInteger(choice) || choice < 0 || choice >= q.choices.length) return "That is not one of its answers.";
      if (choice === q.answer) {
        if (!(s.ruins.read || []).includes(siteId)) s.ruins.read.push(siteId);
        log(s, { kind: "dive", actor: a.id, tiles: [[hit.x, hit.y]], text: `${a.name} reads ${hit.site.name}: ${q.explain}`, why: ["The discovery pays at battle end, win or lose."] });
        return null;
      }
      log(s, { kind: "dive", actor: a.id, tiles: [[hit.x, hit.y]], text: `${a.name} puzzles over ${hit.site.name}: ${q.clue}`, why: ["A wrong answer: read again to try the question once more."] });
      return null;
    }
    function ruinsFindStatus(s, siteId) {
      const D = Dive(); if (!D) return null;
      const facade = { dive: ruinsAcct(s) };
      const carried = Object.entries((s.ruins && s.ruins.taken) || {}).map(([id]) => ({ siteId: id }));
      return D.findStatus(facade, { over: false, carriedThisDive: carried }, siteId);
    }
    function ruinsTakeValidate(s, a, siteId) {
      const R = s.rules.dive;
      if (!R) return "Taking is unavailable.";
      if (!a || a.defeated) return "The dead do not carry.";
      if (astralRegionOf(s, a.x, a.y) !== "deep") return "Take finds below the surface.";
      const hit = ruinsSite(s, siteId);
      if (!hit || Math.max(Math.abs(a.x - hit.x), Math.abs(a.y - hit.y)) > 1) return "Stand beside a ruin to take its find.";
      const st = ruinsFindStatus(s, siteId);
      if (!st || !st.offered) return st && st.pickedClean ? `Picked clean: it drifts back in ${st.k} dives.` : "No find to carry here.";
      return null;
    }
    function ruinsTakeApply(s, a, siteId) {
      const st = ruinsFindStatus(s, siteId);
      if (!st || !st.offered) return "No find to carry here.";
      s.ruins.taken[siteId] = { unit: a.id, find: st.offered };
      a.carryFind = { siteId, ...st.offered };
      log(s, { kind: "dive", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} takes ${a.carryFind.pay === "parts" ? `a ${a.carryFind.tier} part` : `a ${a.carryFind.kind} vessel`} from the ruins.` });
      return null;
    }
    // Drawer rows (BD3 Read rides one row per answer choice; Take one row per
    // offered find). Plain data for the rituals drawer in ui.js and the
    // engine cards below; the question text comes from Dive.questionFor.
    function ruinsReadRows(s, a) {
      const R = s.rules.dive; if (!R || !a || a.defeated) return [];
      if (astralRegionOf(s, a.x, a.y) !== "deep" || a.side !== "player") return [];
      const D = Dive(); const DD = DiveData(); if (!D || !DD) return [];
      const rows = [];
      for (const t of (s.ruins?.sites || [])) {
        if (Math.max(Math.abs(a.x - t.x), Math.abs(a.y - t.y)) > 1) continue;
        if (ruinsReadValidate(s, a, t.siteId)) continue;
        const site = DD.siteById(t.siteId);
        const q = site && D.questionFor(site, s.seed || 0);
        if (!q || !Array.isArray(q.choices)) continue;
        rows.push({ siteId: t.siteId, name: site.name, ap: R.readAp ?? 20, question: q.q, choices: q.choices.map((c, i) => ({ index: i, text: c })) });
      }
      return rows;
    }
    function ruinsTakeRows(s, a) {
      const R = s.rules.dive; if (!R || !a || a.defeated) return [];
      if (astralRegionOf(s, a.x, a.y) !== "deep") return [];
      const rows = [];
      for (const t of (s.ruins?.sites || [])) {
        if (Math.max(Math.abs(a.x - t.x), Math.abs(a.y - t.y)) > 1) continue;
        if (ruinsTakeValidate(s, a, t.siteId)) continue;
        const hit = ruinsSite(s, t.siteId);
        const st = ruinsFindStatus(s, t.siteId);
        const f = st && st.offered;
        rows.push({ siteId: t.siteId, name: hit ? hit.site.name : t.siteId, ap: R.takeAp ?? 10, findText: f ? (f.pay === "parts" ? `a ${f.tier} part` : `a ${f.kind} vessel`) : "a find" });
      }
      return rows;
    }
    // Battle-end ledger for the award path: reads pay win or lose; finds pay
    // on a win only, from carriers still standing (a lost carrier's find
    // drops back to the seabed: taken is never written for it).
    function ruinsResult(s) {
      const R = s.ruins; if (!R) return null;
      const read = [...new Set(R.read || [])];
      const finds = Object.entries(R.taken || {}).filter(([siteId, t]) => {
        const u = t && s.actors[t.unit];
        return u && !u.defeated && !u.fled && !u.banished && !u.returned && u.carryFind && u.carryFind.siteId === siteId;
      }).map(([siteId, t]) => ({ siteId, find: t.find }));
      if (!read.length && !finds.length) return null;
      return { read, finds };
    }
    function surfaceActor(s, a) {
      const D = s.pockets?.deep;
      if (!D?.ready || astralRegionOf(s, a.x, a.y) !== "deep") return "You are not below the surface.";
      if (a.x !== D.rope[0] || a.y !== D.rope[1]) return "The way up is at the rope.";
      if (D.opener === a.id) { destroyPocket(s, "deep"); return null; }
      const at = openLandTile(s, a.dive?.from || [0, 0]) || [D.x0 - 1, 0];
      a.x = at[0]; a.y = at[1]; a.dive = null;
      if (a.status?.drowning) a.status.drowning = null;
      log(s, { kind: "dive", actor: a.id, tiles: [at], text: `${a.name} climbs the rope and surfaces at (${at[0]},${at[1]}).` });
      return null;
    }
    function deepBreathTick(s, a) {
      if (!a || a.defeated || !a.dive?.below || astralRegionOf(s, a.x, a.y) !== "deep") return;
      a.dive.breath = Math.max(0, (a.dive.breath || 0) - 1);
      if (a.dive.breath <= 0 && !a.status.drowning) {
        a.status.drowning = { label: "Drowning", nextTickAtOwnerTurn: a.ownerTurns, deep: 1 };
        log(s, { kind: "drowning", actor: a.id, target: a.id, tiles: [[a.x, a.y]], text: `${a.name} is out of breath below the surface and begins to drown.` });
      }
    }
    function deepDeathCheck(s, force = false) {
      const D = s.pockets?.deep;
      if (!D?.ready) return false;
      const opener = D.opener ? s.actors[D.opener] : null;
      if (force || !opener || opener.defeated || opener.fled || opener.banished || opener.returned || astralRegionOf(s, opener.x, opener.y) !== "deep") {
        return destroyPocket(s, "deep");
      }
      return false;
    }
    function registerAstralActor(s, actor) {
      s.actors[actor.id] = actor;
      s.disclosures[actor.id] = {};
      s.knowledge[actor.id] = {};
      if (s.observedAbilities) s.observedAbilities[actor.id] = [];
      if (insightRules) { const deck = insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[actor.id] = deck; s.insight.knowledge[actor.id] = insightRules.spawnKnowledge(deck); }
      for (const other of Object.values(s.actors)) {
        if (other.id === actor.id || other.side === actor.side) continue;
        (s.knowledge[other.id] ||= {})[actor.id] = { secondary: false, lens: false, abilities: {} };
        s.knowledge[actor.id][other.id] = { secondary: false, lens: false, abilities: {} };
      }
    }
    const baseFighter = (s, o) => ({
      pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, level: o.level || 1, xp: 0, proficiency: o.proficiency || 1,
      reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
      reaction: s.rules.reactionsPerRound, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0,
      tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false, ownerTurns: 0, lastRecoverTurn: -99,
      status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null },
      inventory: [], inventoryCapacity: 0, passives: {}, lanyardUsed: false, bristleconeUsed: false,
      lastDamageType: null, defeated: false,
    });

    // Entry validation (no mutation): the handler spends tempo, then projectSoul mutates.
    function astralProjectValidate(s, a) {
      const R = s.rules.astral;
      if (!R) return "Astral projection is unavailable.";
      if (!a || a.defeated) return "The dead do not project.";
      if (a.soulOf) return "A soul cannot project again.";
      if (a.soulId) return "You are already out of your body.";
      if (a.mirrorOf) return "A mirror cannot project.";
      if (astralRegionOf(s, a.x, a.y) !== "land") return "Projection starts from the material world.";
      if (s.film) return "The set is enclosed: there is no plane to project to.";
      const upkeep = R.upkeepPf ?? 0;
      if (a.pf < upkeep) return `Astral projection needs ${upkeep} ΦF to hold (have ${a.pf}).`;
      return null;
    }
    function projectSoul(s, a) {
      const R = s.rules.astral, A = ensureAstralPocket(s);
      const upkeep = R.upkeepPf ?? 0;
      a.pf -= upkeep;
      const id = `soul-${a.id}`;
      const at = openPocketTile(s, A.portal, [A.portal]) || A.portal;
      const sf = soulMaxFor(s.rules, a.soulKind, a.character, a.traits);
      let soul = s.actors[id];
      if (soul?.returned) {
        Object.assign(soul, { x: at[0], y: at[1], lf: sf, maxLF: sf, pf: a.pf, ultimateCharge: 0, tempo: 0, tempoDebt: 0, ownerTurns: 0, defeated: false, returned: false, stranded: false, deathLinked: false, primary: a.primary, secondary: a.secondary, traits: [...(a.traits || [])], side: a.side, status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null } });
      } else {
        soul = { id, name: `${a.name} (soul)`, side: a.side, controller: a.controller, ai: a.ai, character: a.character, sprite: a.sprite,
          primary: a.primary, secondary: a.secondary, traits: [...(a.traits || [])], soulKind: a.soulKind || null,
          maxLF: sf, lf: sf, soul: sf, maxSoul: sf, x: at[0], y: at[1], soulOf: a.id, projected: true, ...baseFighter(s, a) };
        soul.pf = Math.min(soul.maxPF, a.pf);
        registerAstralActor(s, soul);
        if (!s.order.includes(id)) s.order.splice(s.turnIndex + 1, 0, id);
      }
      a.husk = true; a.soulless = true; a.soulId = id; a.tempo = 0;
      A.entries[a.id] = { real: [a.x, a.y] };
      log(s, { kind: "astral", actor: a.id, tiles: [[a.x, a.y], at], text: `${a.name} projects onto the astral plane at (${at[0]},${at[1]}): the soul fights on ${sf} soul force, the body lies soulless at (${a.x},${a.y}).`, why: [`${upkeep} ΦF now, ${upkeep} ΦF at each soul turn start. The only way back by choice is the portal; damage may snap the soul home. If the soul falls, it snaps back into the body soul-shaken: 25 AP off the next turn and ΦF recovery −1 for the rest of the battle.`] });
      generateMirrors(s, a, soul);
      return soul;
    }

    // One mirror per enemy and creature on the material map: a fixed resident kit, randomly assigned —
    // unless the source has astral presence, in which case its own kit mirrors over (godly agility included).
    function generateMirrors(s, projector, soul) {
      const A = s.astral;
      A.genN += 1;
      const sources = [];
      for (const u of Object.values(s.actors)) {
        if (u.defeated || u.notArrived || u.husk || u.mirrorOf || u.returned) continue;
        if (u.side === projector.side) continue;
        if (astralRegionOf(s, u.x, u.y) !== "land" && !u.soulOf) continue;
        sources.push({ id: u.id, name: u.name, side: u.side, character: u.character, sprite: u.sprite, primary: u.primary, secondary: u.secondary, traits: u.traits || [], soulKind: u.soulKind || null, presence: hasTrait(u, "astralPresence"), wild: false });
      }
      for (const m of s.wild || []) {
        if (m.form !== "unit" || m.defeated) continue;
        sources.push({ id: m.id, name: m.name || "Wild thing", side: "wild", presence: false, wild: true, wildKind: m.kind });
      }
      const placed = [];
      for (const src of sources) {
        const id = `mirror-${src.id}`;
        if (s.actors[id] && !s.actors[id].defeated) continue;
        const at = openPocketTile(s, A.portal, [A.portal, ...placed]) || openPocketTile(s, [A.x0, 0], [A.portal, ...placed]);
        if (!at) { log(s, { kind: "astral", text: `No room on the plane for ${src.name}'s mirror.` }); continue; }
        placed.push(at);
        const pick = (salt, n) => Math.floor(seededChance(`${s.seed}:mirror:${A.genN}:${src.id}:${salt}`) * n);
        const residentKey = RESIDENTS[pick("resident", RESIDENTS.length)];
        const resident = C.characters[residentKey];
        const config = resident.configs[pick("config", resident.configs.length)];
        const sf = src.wild ? soulMaxFor(s.rules, null, src.wildKind, []) : soulMaxFor(s.rules, src.soulKind, src.character, src.traits);
        const kit = src.presence
          ? { character: src.character, sprite: src.sprite, primary: src.primary, secondary: src.secondary, traits: [...src.traits] }
          : { character: residentKey, sprite: resident.sprite, primary: config.primary, secondary: config.secondary, traits: [] };
        const old = s.actors[id];
        if (old) {
          Object.assign(old, { ...kit, name: `${src.name} (mirror)`, side: src.side, x: at[0], y: at[1], lf: sf, maxLF: sf, soul: sf, maxSoul: sf, pf: s.rules.maxPF, ultimateCharge: 0, tempo: 0, tempoDebt: 0, ownerTurns: 0, defeated: false, banished: false, residentKit: src.presence ? null : residentKey, status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null } });
        } else {
          const mirror = { id, name: `${src.name} (mirror)`, side: src.side, controller: "ai", ai: null, ...kit,
            maxLF: sf, lf: sf, soul: sf, maxSoul: sf, x: at[0], y: at[1], mirrorOf: src.id, residentKit: src.presence ? null : residentKey, ...baseFighter(s, {}) };
          registerAstralActor(s, mirror);
          s.order.push(id);
        }
        log(s, { kind: "astral", tiles: [at], text: src.presence
          ? `${src.name} manifests on the plane in true form at (${at[0]},${at[1]}): ${sf} soul force, own kit intact.`
          : `${src.name}'s mirror coalesces at (${at[0]},${at[1]}): a ${resident.name} wearing ${config.label}, ${sf} soul force.`,
          why: src.presence ? ["Astral presence: the powerful keep their form. Nothing about them can be bypassed by fighting them here."] : ["Five fixed resident kits, randomly assigned. Banish a mirror and its source on the map is soul-shaken: 25 AP off its next turn and ΦF recovery −1 for the rest of the battle."] });
      }
    }

    // The one exit path: portal return, snap-back, upkeep failure, corpse return, and soul flight all land here.
    // Returns an error string, or null on success.
    function returnSoul(s, soul, reason = "portal") {
      const A = s.astral;
      if (!soul || soul.defeated) return "No soul to return.";
      if (!soul.soulOf) return "That fighter is not a projected soul.";
      const body = s.actors[soul.soulOf];
      if (reason === "portal" && (soul.x !== A?.portal?.[0] || soul.y !== A?.portal?.[1])) return "The way back is through the portal.";
      soul.returned = true; soul.defeated = true; soul.tempo = 0; spiritGone(s, soul);
      if (body && !body.defeated) {
        body.husk = false; body.soulless = false; body.soulId = null;
        const line = reason === "portal" ? `${soul.name} steps through the portal and wakes in the body.`
          : reason === "snap" ? `The blow breaks concentration: ${soul.name} snaps back into the body.`
          : reason === "upkeep" ? `${soul.name} cannot pay the ΦF to stay out and falls back into the body.`
          : `${soul.name} flees the plane and wakes in the body.`;
        log(s, { kind: "astral", actor: soul.id, tiles: [[body.x, body.y]], text: line });
      } else {
        log(s, { kind: "astral", actor: soul.id, text: `${soul.name} returns to a corpse and dies with it.` });
      }
      if (A?.entries) delete A.entries[soul.soulOf];
      collapsePocketIfEmpty(s);
      return null;
    }
    // The witness rule: with no soul left on the plane, the mirrors have nothing to reflect and fade.
    function collapsePocketIfEmpty(s) {
      const A = s.astral;
      if (!A?.ready) return;
      if (Object.values(s.actors).some((a) => a.soulOf && !a.defeated)) return;
      let faded = 0;
      for (const m of Object.values(s.actors)) {
        if (!m.mirrorOf || m.defeated) continue;
        m.defeated = true; m.banished = true; m.tempo = 0; faded += 1; spiritGone(s, m);
      }
      if (faded) log(s, { kind: "astral", text: `No soul remains on the plane: ${faded === 1 ? "the mirror fades" : `all ${faded} mirrors fade`} back into the dark.` });
    }
    // Soul-shaken (Mala, 2026-10-26: "Soul-shaken", "their phi recovery should be permanently reduced", "losing the fight in
    // the astral plane does the same thing to you"). Whoever loses on the plane is shaken, never killed: a mirror beaten there
    // (not one that fades when the pocket empties) shakes the real one, and a soul that falls there snaps back into its body
    // shaken. Shaken: rules.astral.mirrorShake.ap off the next turn as tempo debt, and ΦF regeneration −.regen for the rest of
    // the battle (stacking; regen never goes below 0). Once per mirror or fall.
    function shake(s, u, byId, text) {
      const R = s.rules.astral?.mirrorShake; if (!R || !u || u.defeated) return;
      const debt = Math.min(R.ap, Math.max(0, (s.rules.maxTempoDebt ?? 100) - (u.tempoDebt || 0)));
      u.tempoDebt = (u.tempoDebt || 0) + debt; u.mirrorScar = (u.mirrorScar || 0) + R.regen;
      log(s, { kind: "astral", actor: byId || null, target: u.id, tiles: [[u.x, u.y]], text: `${text}: ${u.name} is soul-shaken (${debt} AP off the next turn, ΦF recovery −${u.mirrorScar} for the rest of the battle).`,
        why: ["What the plane breaks, the body feels. Losing there stings; it never kills."] });
    }
    function astralMirrorShake(s) {
      for (const m of Object.values(s.actors)) {
        if (!m.mirrorOf || !m.defeated || m.banished || m.shook) continue;
        m.shook = true; const src = s.actors[m.mirrorOf];
        if (src) shake(s, src, m.defeatedBy, `${src.name}'s mirror is banished`);
      }
    }
    // Runs first in checkOutcome, before the outcome is read. A soul that falls on the plane snaps back into its living body,
    // shaken (it used to take the body with it). A body killed while its soul is out strands the soul instead.
    function astralDeathLink(s) {
      astralMirrorShake(s);
      for (const soul of Object.values(s.actors)) {
        if (!soul.soulOf || !soul.defeated || soul.returned || soul.deathLinked) continue;
        soul.deathLinked = true; soul.returned = true;
        const body = s.actors[soul.soulOf];
        if (body && !body.defeated) {
          body.husk = false; body.soulless = false; body.soulId = null;
          shake(s, body, soul.defeatedBy, `${soul.name} falls on the plane and snaps back into the body`);
        }
        if (s.astral?.entries) delete s.astral.entries[soul.soulOf];
      }
      for (const body of Object.values(s.actors)) {
        if (!body.soulId || !body.defeated) continue;
        const soul = s.actors[body.soulId];
        if (soul && !soul.defeated && !soul.stranded) {
          soul.stranded = true;
          log(s, { kind: "astral", actor: soul.id, text: `${body.name}'s body is dead: ${soul.name} is stranded on the plane. It can still fight — but there is nothing left to wake in.`, why: ["Returning to a corpse fails closed: the soul dies with it."] });
        }
      }
      collapsePocketIfEmpty(s);
    }
    // Soul upkeep at the soul's turn start (turns.js): ΦF or snap back.
    function astralUpkeep(s, soul) {
      const cost = s.rules.astral?.upkeepPf ?? 0;
      if (soul.pf < cost) { returnSoul(s, soul, "upkeep"); return false; }
      soul.pf -= cost;
      log(s, { kind: "astral", actor: soul.id, tiles: [[soul.x, soul.y]], text: `${soul.name} spends ${cost} ΦF to stay projected (${soul.pf}/${soul.maxPF}).` });
      return true;
    }

    return { astralMirrorShake, openPocket, destroyPocket, ensureAstralPocket, astralRegionOf, astralSameRegion, astralPocketActive, astralProjectValidate, projectSoul, generateMirrors, returnSoul, collapsePocketIfEmpty, astralDeathLink, astralUpkeep, deepBreathFor, diveValidate, diveEnter, surfaceActor, deepBreathTick, deepDeathCheck, placeRuins, ruinsReadValidate, ruinsReadApply, ruinsTakeValidate, ruinsTakeApply, ruinsReadRows, ruinsTakeRows, ruinsResult };
  })();
});
