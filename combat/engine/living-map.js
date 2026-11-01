"use strict";
// Heart Court (prototype). The place is a third actor: a budget of tends, calls, closes and
// possessions, then the World Goddess if the heart breaks. She is not a roster concept and not
// a fighter until she ascends. Numbers marked PROVISIONAL were not set by Mala.
//
//   openCourt(s, opts)            → once, before the first round, when the arena is heartCourt
//   courtRound(s)                 → one telegraphed act at round start
//   courtTend(s, a)               → +2 LF on living ground while Tended, unless a Keep heals more
//   courtOutcome(s)               → true when a contract or the goddess owns the ending
//   courtCandidates / courtScore  → both sides can reach the heart; the contract tells them to
//   courtHeartHit(s, source)      → a heart blow rouses her; breaking it ascends her now
//   courtFoundation / Fell        → a blind building on living ground is a scar she can quiet
//   courtWitnessSacrifice(s, a)   → a For You death in sight of the heart steps the grade back once
//   courtVesselFell(s, tgt)       → a possessed body dies as themselves and drops no orb
//   castScroll / studyScroll      → the Destroy contract's one technique, or a Magistrate's note
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).livingMap = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const TEND_LF = 2, CLOSE_LF = 8, SCROLL_TEND = 8, SCROLL_CLOSE = 12, SCROLL_AP = 25, CLOCK = 4, MOVE_BIAS = 35;
    const ORDER = ["tended", "roused", "spoken", "ascended"];
    // Ready monsters only. Wolf and moa are not ready; no invented kits. PROVISIONAL life totals.
    const ANIMALS = [
      { kind: "feralPig", name: "Feral pig", lf: 30, sprite: "feral-pig", concept: "inertia" },
      { kind: "termites", name: "Termites", lf: 12, sprite: "termites", concept: "succession" },
      { kind: "nettleCaterpillar", name: "Nettle caterpillar", lf: 28, sprite: "nettle-caterpillar", concept: "pruning" },
    ];
    const blankStatus = () => ({ guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null, immovable: null, exposed: null, attention: null, rangeBuff: null, tippingPoint: null, ambush: null, catharsis: null, drowning: null, onePossession: null });

    function court(s) { return s?.heartCourt || null; }
    function active(s) { return !!court(s); }
    function goddess(s) {
      const c = court(s); if (!c?.goddess) return null;
      const g = s.actors[c.goddess];
      return g && !g.defeated ? g : null;
    }
    function gaiaAlive(s) { return Object.values(s.actors || {}).some((u) => u.boss === "gaia" && !u.defeated); }
    function warnAt(s) {
      const R = H.bossRules?.data?.land; if (!R) return 10;
      const T = R.temper || {}, rows = s.arena?.map || [];
      let living = 0, n = 0;
      for (const row of rows) for (const ch of row) { n++; if ((H.C?.tiles?.[ch]?.tags || []).includes("soil") || (H.C?.tiles?.[ch]?.tags || []).includes("plant")) living++; }
      const frac = n ? living / n : 1;
      return Math.max(T.minWarn || 8, Math.round(R.warnAt - frac * (T.greenMercy || 0)));
    }
    function natural(s) {
      const c = court(s);
      if (c.ascended) return "ascended";
      if (gaiaAlive(s)) return "spoken";
      if (c.roused || (s.land?.wounds || 0) >= warnAt(s)) return "roused";
      return "tended";
    }
    // heldGrade is the For You step-back. The next heart hit clears it. Ascended is not a ceiling.
    function grade(s) { const c = court(s); return (c.heldGrade || natural(s)); }
    function publish(s) { const c = court(s); if (c) c.grade = grade(s); return c?.grade; }

    function leaderUnit(s) {
      const st = s.land, entries = Object.entries(st?.ledger || {})
        .map(([id, w]) => ({ u: s.actors[id], w }))
        .filter((x) => x.u && !x.u.defeated && !x.u.notArrived && (x.u.side === "player" || x.u.side === "enemy"));
      const p = st?.sides?.player || 0, e = st?.sides?.enemy || 0;
      const side = p > e ? "player" : e > p ? "enemy" : null;
      const pool = side ? entries.filter((x) => x.u.side === side) : entries;
      pool.sort((a, b) => b.w - a.w || (a.u.id < b.u.id ? -1 : 1));
      if (pool[0]) return pool[0].u;
      const last = s.actors[court(s)?.lastStriker];
      return last && !last.defeated && (last.side === "player" || last.side === "enemy") ? last : null;
    }
    function bothScarred(s) { return (s.land?.sides?.player || 0) > 0 && (s.land?.sides?.enemy || 0) > 0; }
    function preyFor(s, selfId) {
      if (bothScarred(s)) return null;
      const lead = leaderUnit(s);
      if (lead && lead.id !== selfId) return lead.id;
      const side = lead?.side;
      const other = Object.values(s.actors).find((a) => !a.defeated && a.id !== selfId && side && a.side === side);
      return other?.id || null;
    }
    function livingSide(s, side) {
      return Object.values(s.actors).filter((a) => a.side === side && !a.defeated && !a.notArrived && !a.husk);
    }
    function heartUp(s) { return (court(s)?.heart?.hp ?? 0) > 0; }

    function openAt(s, x, y) {
      return H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove && !H.actorAt(s, x, y) && !(s.arena.objects || []).some((o) => o.x === x && o.y === y);
    }
    function nearestOpen(s, from) {
      const fx = from?.[0] ?? court(s)?.heart?.x ?? 0, fy = from?.[1] ?? court(s)?.heart?.y ?? 0;
      if (openAt(s, fx, fy)) return [fx, fy];
      for (let r = 1; r <= Math.max(s.arena.w, s.arena.h); r++) {
        const ring = [];
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && openAt(s, fx + dx, fy + dy)) ring.push([fx + dx, fy + dy]);
        ring.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
        if (ring.length) return ring[0];
      }
      return null;
    }
    function canReach(s, a, hx, hy) {
      if (!a || a.defeated) return false;
      const goal = (x, y) => Math.abs(x - hx) + Math.abs(y - hy) <= 1;
      if (goal(a.x, a.y)) return true;
      const seen = new Set([a.x + "," + a.y]), q = [[a.x, a.y]];
      while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = nx + "," + ny;
          if (seen.has(k) || !H.inside(s, nx, ny) || H.tileAt(s, nx, ny).blocksMove) continue;
          if ((s.arena.objects || []).some((o) => o.x === nx && o.y === ny && o.blocksMove)) continue;
          const occ = H.actorAt(s, nx, ny);
          if (occ && occ.id !== a.id) continue;
          seen.add(k);
          if (goal(nx, ny)) return true;
          q.push([nx, ny]);
        }
      }
      return false;
    }

    function know(s, id) {
      s.disclosures[id] = {}; s.knowledge[id] = {}; if (s.observedAbilities) s.observedAbilities[id] = [];
      for (const other of Object.keys(s.actors)) if (other !== id) {
        (s.knowledge[other] ||= {})[id] ||= { secondary: false, lens: false, abilities: {} };
        s.knowledge[id][other] = { secondary: true, lens: true, abilities: {} };
      }
    }
    function dropFromOrder(s, id) {
      const i = s.order.indexOf(id);
      if (i >= 0) { s.order.splice(i, 1); if (i < s.turnIndex) s.turnIndex -= 1; }
    }
    function insertActor(s, actor, at) {
      actor.x = at[0]; actor.y = at[1];
      s.actors[actor.id] = actor;
      if (!s.order.includes(actor.id)) s.order.splice(Math.min(s.order.length, s.turnIndex + 1), 0, actor.id);
      know(s, actor.id);
      return actor;
    }
    function baseUnit(s, id, spec, at) {
      const donor = s.actors.player || Object.values(s.actors)[0];
      const u = H.freshBody(donor, s);
      Object.assign(u, {
        id, name: spec.name, character: spec.character || id, side: spec.side, controller: "ai", ai: spec.ai || "aggressive",
        sprite: spec.sprite, primary: spec.concept || "inertia", secondary: null, boss: spec.boss || null,
        bossAbilityIds: spec.bossAbilityIds || null, abilities: spec.abilities || [],
        maxLF: spec.lf, lf: spec.lf, pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: spec.ultimateCharge || 0,
        level: 1, xp: 0, proficiency: 1, size: { w: 1, h: 1 }, massive: false, holdsField: !!spec.holdsField,
        conditions: {}, passives: {}, traits: [], learned: [], beads: [], orbs: [], bond: null, rite: null, ritual: null,
        heartScroll: null, heartNote: null, form: null, summon: null, communed: null, dream: null, reserve: [], reserveSlots: 0,
        pendingSwap: null, lens: {}, inventory: [], inventoryCapacity: 0, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0,
        tempoSpent: 0, actionsThisTurn: 0, reaction: s.rules.reactionsPerRound, ownerTurns: 0, lastRecoverTurn: -99,
        moved: false, acted: false, guardUsedThisTurn: false, defeated: false, notArrived: false, escaped: false, knockedOut: false,
        forceTarget: spec.forceTarget || null, forceTargetUntil: spec.forceTarget ? 999 : 0, courtAnimal: !!spec.courtAnimal,
        status: blankStatus(), lastDamageType: null, color: spec.color || null,
      });
      return insertActor(s, u, at);
    }
    function animalOf(kind) { return ANIMALS.find((a) => a.kind === kind) || ANIMALS[0]; }
    function pickKind(s) {
      const i = Math.floor(H.seededChance(`${s.seed}:court-animal:${s.round}:${court(s).seq}`) * ANIMALS.length);
      return ANIMALS[Math.min(ANIMALS.length - 1, i)].kind;
    }
    function summonAnimal(s, kind, at, spec) {
      const def = animalOf(kind);
      court(s).seq = (court(s).seq || 0) + 1;
      const id = spec.scroll ? `scroll-${kind}-${court(s).seq}` : `court-${kind}-${s.round}-${court(s).seq}`;
      const prey = spec.ally ? null : preyFor(s, id);
      return baseUnit(s, id, {
        name: def.name, sprite: def.sprite, concept: def.concept, lf: def.lf, side: spec.side || "wild",
        ai: spec.ally ? "ally" : "aggressive", courtAnimal: !spec.ally, forceTarget: prey, character: `court-${kind}`,
      }, at);
    }

    function syncHeart(s) {
      const c = court(s); if (!c?.heart) return;
      const o = (s.arena.objects || []).find((q) => q.id === c.heart.id);
      if (o) { c.heart.hp = o.hp; c.heart.maxHp = o.maxHp ?? c.heart.maxHp; c.heart.x = o.x; c.heart.y = o.y; }
      else c.heart.hp = 0;
    }
    function releaseOne(s, id) {
      const a = s.actors[id];
      if (!a?.possessedByCourt || a.defeated) return;
      if (a.priorName) a.name = a.priorName;
      if ("priorSprite" in a) a.sprite = a.priorSprite;
      if (a.priorSide) a.side = a.priorSide;
      a.possessedByCourt = false; a.forceTarget = null; a.forceTargetUntil = 0;
    }
    function releaseAll(s) { for (const id of Object.keys(s.actors)) releaseOne(s, id); }

    function ascend(s, source) {
      const c = court(s); if (!c || c.ascended) return;
      c.ascended = true; c.heldGrade = null; c.roused = true;
      if (!c.brokenBy) c.brokenBy = source?.side || "wild";
      for (const u of Object.values(s.actors)) if (u.boss === "gaia") { dropFromOrder(s, u.id); delete s.actors[u.id]; }
      if (s.land) s.land.gaia = null;
      const B = H.bossRules?.data?.bosses?.worldGoddess;
      const lf = B?.lf || 340;
      const at = openAt(s, c.heart.x, c.heart.y) ? [c.heart.x, c.heart.y] : (nearestOpen(s, [c.heart.x, c.heart.y]) || [c.heart.x, c.heart.y]);
      const baseIds = H.C.characters["boss-worldGoddess"]?.bossAbilityIds || [];
      const prey = preyFor(s, "world-goddess");
      const g = baseUnit(s, "world-goddess", {
        name: "World Goddess", character: "boss-worldGoddess", sprite: "world-goddess", boss: "worldGoddess",
        concept: B?.concepts?.[0] || "succession", lf, side: "wild", ai: "boss", holdsField: true,
        abilities: Object.keys(B?.abilities || {}), bossAbilityIds: baseIds.slice(), forceTarget: prey,
        ultimateCharge: 0, color: "#6e8f62",
      }, at);
      g.boss = "worldGoddess";
      c.goddess = g.id; c.goddessSeen = true;
      publish(s);
      H.log(s, { kind: "court", actor: g.id, tiles: [at], text: "The heart breaks. The World Goddess rises.",
        why: ["Destroying the heart is the ascension. She holds the field until she falls, or the player side does."] });
    }

    function eligible(s, u) {
      if (!u || u.defeated || u.notArrived || u.husk) return false;
      if (u.possessedByCourt || u.courtAnimal || u.boss === "worldGoddess" || u.boss === "gaia") return false;
      if (u.side === "wild") return false;
      if (u.side !== "player" && u.side !== "enemy") return false;
      return true;
    }
    function markTarget(s) {
      const c = court(s);
      const prefer = c.preferId && eligible(s, s.actors[c.preferId]) ? s.actors[c.preferId] : null;
      if (prefer) return prefer;
      const lead = leaderUnit(s);
      if (lead && eligible(s, lead)) return lead;
      const side = lead?.side || s.actors[c.lastStriker]?.side;
      const pool = Object.values(s.actors).filter((u) => eligible(s, u) && (!side || u.side === side));
      pool.sort((a, b) => (a.id < b.id ? -1 : 1));
      return pool[0] || null;
    }
    function raining(s) { return s.weatherState?.id === "rain" || s.weatherState?.id === "squall"; }

    function pickAct(s) {
      const c = court(s), g = publish(s);
      if (g === "tended" || g === "ascended") return { verb: "tend" };
      const target = markTarget(s);
      if (!target) return { verb: "tend" };
      const fiery = target.lastDamageType === "citrinitas";
      if (fiery && raining(s)) {
        H.log(s, { kind: "court", target: target.id, text: `Rain turns the court's call into a flood close against ${target.name}.` });
        return { verb: "close", targetId: target.id, flood: true };
      }
      if (fiery) return { verb: "call", targetId: target.id, fiery: true };
      if (c.preferId === target.id) {
        const verb = H.seededChance(`${s.seed}:court-prefer:${s.round}`) < 0.5 ? "close" : "take";
        if (verb === "take") H.log(s, { kind: "court", target: target.id, text: `The court marks ${target.name}.` });
        return { verb, targetId: target.id };
      }
      const roll = H.seededChance(`${s.seed}:court-act:${s.round}:${c.seq || 0}`);
      const verb = roll < 0.34 ? "call" : roll < 0.67 ? "close" : "take";
      if (verb === "take") H.log(s, { kind: "court", target: target.id, text: `The court marks ${target.name}.` });
      return { verb, targetId: target.id };
    }

    function possess(s, target) {
      if (!eligible(s, target)) return false;
      const priorName = target.name;
      target.priorName = priorName; target.priorSprite = target.sprite; target.priorSide = target.side;
      target.sprite = "gaia-possessed"; target.side = "wild"; target.possessedByCourt = true;
      target.name = `Gaia, in ${priorName}`;
      target.courtAnimal = false; target.boss = null; target.holdsField = false;
      const prey = preyFor(s, target.id);
      target.forceTarget = prey; target.forceTargetUntil = prey ? 999 : 0;
      (court(s).possessed ||= []).push({ id: target.id, priorSprite: target.priorSprite, priorSide: target.priorSide, priorName });
      H.log(s, { kind: "court", actor: target.id, target: target.id, tiles: [[target.x, target.y]], text: `Gaia, in ${priorName}.`,
        why: ["The body keeps its life, its tile and its kit, and fights for the wild. It does not hold the battle open."] });
      return true;
    }
    function execute(s, act) {
      const c = court(s); if (!act) return;
      if (act.verb === "tend") {
        H.log(s, { kind: "court", text: "The court tends the living ground." });
        return;
      }
      const target = s.actors[act.targetId] && !s.actors[act.targetId].defeated ? s.actors[act.targetId] : markTarget(s);
      if (act.verb === "close") {
        if (!target) return;
        H.log(s, { kind: "court", target: target.id, tiles: [[target.x, target.y]], text: `The ground closes on ${target.name}.` });
        H.hit(s, null, target, { name: act.flood ? "Flood close" : "The ground closes", ability: "courtClose", delivery: "field", effect: "damage", damageType: "nigredo", potency: CLOSE_LF }, CLOSE_LF, ["The court closes. The striker is the ground."]);
        return;
      }
      if (act.verb === "take") {
        if (target) possess(s, target);
        return;
      }
      if (act.verb === "call") {
        const at = nearestOpen(s, target ? [target.x, target.y] : [c.heart.x, c.heart.y]);
        const who = target?.name || "everyone";
        if (!at) { H.log(s, { kind: "court", target: target?.id, text: `The court calls and finds no open tile.` }); return; }
        const kind = pickKind(s), def = animalOf(kind);
        summonAnimal(s, kind, at, {});
        H.log(s, { kind: "court", target: target?.id, tiles: [at], text: `The court calls a ${def.name} against ${who}.` });
      }
    }

    function addPlaceCards(s) {
      const decks = s.insight?.decks; if (!decks) return;
      const key = Object.keys(decks).find((k) => k.startsWith("place:")); if (!key) return;
      const deck = decks[key]; if (!deck?.cards || deck.cards.some((c) => c.kind === "heart")) return;
      const c = court(s);
      const push = (card) => deck.cards.push({ grants: {}, unlocks: [], tie: 0, difficulty: card.open ? 0 : 2, kind: "heart", ...card });
      const contract = c.contract === "protect" ? "Protect the Heart." : c.contract === "destroy" ? "Destroy the Heart." : "The court is listening.";
      push({ id: `${key}:heart:contract`, open: true, text: contract });
      push({ id: `${key}:heart:hp`, open: true, text: `The heart stands at ${c.heart.hp}.` });
      push({ id: `${key}:heart:grade`, open: true, text: `The court's condition is ${c.grade}.` });
      push({ id: `${key}:heart:next`, open: false, text: "What the court will do next is not written on the ground." });
      push({ id: `${key}:heart:animal`, open: false, text: "Which animal the court would call is hidden." });
      push({ id: `${key}:heart:marked`, open: false, text: "Whom the court has marked is hidden." });
    }

    function openCourt(s, opts) {
      if (s.heartCourt) return;
      const contract = opts?.heartContract === "protect" || opts?.heartContract === "destroy" ? opts.heartContract : null;
      if (s.arena?.id !== "heartCourt" && !contract) return;
      const obj = (s.arena.objects || []).find((o) => o.kind === "heart" || o.type === "heart") || null;
      s.heartCourt = {
        contract, grade: "tended", roused: false, heldGrade: null, ascended: false, seq: 0,
        heart: obj ? { id: obj.id, x: obj.x, y: obj.y, hp: obj.hp, maxHp: obj.maxHp ?? obj.hp } : { id: "heart", x: 0, y: 0, hp: 0, maxHp: 0 },
        next: { verb: "tend" }, marked: null, possessed: [], goddess: null, goddessSeen: false,
        brokenBy: null, lastStriker: null, forYouWitnessed: false, foundations: [], unreachable: 0,
        beadPaid: false, scrollPaid: false, preferId: null,
      };
      publish(s);
      if (contract === "protect") H.log(s, { kind: "court", text: "Protect the Heart." });
      if (contract === "destroy") H.log(s, { kind: "court", text: "Destroy the Heart." });
      addPlaceCards(s);
    }

    function courtRound(s) {
      const c = court(s); if (!c || s.outcome) return;
      if (c.contract === "destroy" && !c.ascended && heartUp(s)) {
        const players = livingSide(s, "player");
        const open = players.some((a) => canReach(s, a, c.heart.x, c.heart.y));
        c.unreachable = open ? 0 : (c.unreachable || 0) + 1;
      } else c.unreachable = 0;
      if (goddess(s) || c.ascended) return;
      execute(s, c.next);
      if (s.outcome || c.ascended || goddess(s)) return;
      c.next = pickAct(s);
    }

    function courtTend(s, a) {
      const c = court(s); if (!c || !a || a.defeated || a.lf >= a.maxLF || grade(s) !== "tended") return;
      const lead = leaderUnit(s);
      if (lead && a.id === lead.id) return;
      const tile = H.tileAt(s, a.x, a.y);
      if (!tile?.tags?.includes("soil") && !tile?.tags?.includes("plant")) return;
      const keep = (s.arena.objects || []).find((o) => o.type === "keep" && (o.hp ?? 0) > 0 && o.side === a.side && Math.max(Math.abs(o.x - a.x), Math.abs(o.y - a.y)) === 1);
      if (keep && Math.min(4, a.maxLF - a.lf) >= TEND_LF) return;
      const healed = Math.min(TEND_LF, a.maxLF - a.lf); if (healed <= 0) return;
      a.lf += healed;
      H.log(s, { kind: "heal", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} is tended for ${healed} LF by the living ground.` });
    }

    function finish(s, winner, pay) {
      if (s.outcome) return true;
      const c = court(s);
      const draw = !!pay.draw;
      const o = { winner: draw ? null : winner, round: s.round, ...(draw ? { draw: true } : {}), ...(pay.reason ? { reason: pay.reason } : {}) };
      if (winner === "player" && !draw) {
        const hero = s.actors[s.modeSetup?.hero || "player"];
        if (pay.orb && c.goddessSeen && !goddess(s) && Object.values(s.actors).some((a) => a.boss === "worldGoddess" && a.defeated)) o.orbs = ["orbOfTheWorld"];
        if (pay.bead && hero && !c.beadPaid && heartUp(s)) {
          hero.beads = [...(hero.beads || []), { kind: "feralPig", name: "Feral pig", maxLF: 30 }];
          c.beadPaid = true;
        }
        if (pay.scroll && hero && !c.scrollPaid && c.brokenBy === "player") {
          hero.heartScroll = { verb: "call", name: "Court Scroll" };
          c.scrollPaid = true;
        }
      }
      s.outcome = o; s.phase = "over";
      const text = draw ? "The heart cannot be reached. The court ends in a draw."
        : winner === "player" ? "The court is settled." : "The court keeps its ground.";
      H.log(s, { kind: "outcome", text: pay.reason || text });
      return true;
    }
    function courtOutcome(s) {
      const c = court(s); if (!c) return false;
      if (s.outcome) return true;
      const playerUp = livingSide(s, "player").length > 0;
      const enemyUp = livingSide(s, "enemy").length > 0;
      const gUp = !!goddess(s);
      const hUp = heartUp(s);
      if (!c.contract) {
        if (!playerUp && gUp) return finish(s, "enemy", {});
        if (!playerUp) return false;
        if (gUp) return true;
        if (c.ascended && !enemyUp && playerUp) return finish(s, "player", { orb: c.goddessSeen });
        return false;
      }
      if (!playerUp) return finish(s, "enemy", {});
      if (c.contract === "protect") {
        if (hUp && !enemyUp) return finish(s, "player", { bead: true });
        if (!hUp && !gUp && !enemyUp) return finish(s, "player", { orb: c.goddessSeen });
        return true;
      }
      if (hUp && !gUp && !enemyUp && (c.unreachable || 0) >= CLOCK) return finish(s, null, { draw: true });
      if (!hUp && !gUp && !enemyUp) return finish(s, "player", { scroll: true, orb: c.goddessSeen });
      return true;
    }

    function courtHeartHit(s, source) {
      const c = court(s); if (!c) return;
      if (c.ascended) { syncHeart(s); return; }
      syncHeart(s);
      if (source?.id) c.lastStriker = source.id;
      if ((c.heart.hp ?? 0) <= 0) { ascend(s, source); return; }
      c.heldGrade = null; c.roused = true; publish(s);
      if ((c.next?.verb || "tend") === "tend" && grade(s) !== "tended") c.next = pickAct(s);
    }

    function courtFoundation(s, a, building) {
      const c = court(s); if (!c || !a || !building) return;
      if ((H.groundControl?.(s, a) || 0) >= 1) return;
      const w = H.landWound?.(s, a, "plantDestroyed", 1, [[building.x, building.y]]) || 0;
      if (w > 0) c.foundations.push({ id: building.id, owner: a.id, side: a.side, wound: w });
      if (eligible(s, a)) c.preferId = a.id;
    }
    function courtFoundationFell(s, id) {
      const c = court(s); if (!c || !id) return;
      const i = c.foundations.findIndex((f) => f.id === id); if (i < 0) return;
      const f = c.foundations.splice(i, 1)[0];
      const st = s.land; if (!st || !(f.wound > 0)) return;
      const sub = (n) => Math.max(0, Math.round(((n || 0) - f.wound) * 100) / 100);
      st.wounds = sub(st.wounds);
      if (f.owner) st.ledger[f.owner] = sub(st.ledger[f.owner]);
      if (f.side) st.sides[f.side] = sub(st.sides[f.side]);
      if (c.preferId === f.owner) c.preferId = null;
    }

    function courtWitnessSacrifice(s, a) {
      const c = court(s); if (!c || !a || c.forYouWitnessed || !c.heart) return;
      if (!H.hasSight(s, a.x, a.y, c.heart.x, c.heart.y)) return;
      c.forYouWitnessed = true;
      const now = grade(s);
      const next = ORDER[Math.max(0, ORDER.indexOf(now) - 1)] || "tended";
      c.heldGrade = next; publish(s);
      if (next === "tended") releaseAll(s);
      H.log(s, { kind: "court", actor: a.id, text: `A death for the Beloved steps the court back to ${next}.` });
    }
    function courtVesselFell(s, tgt) {
      if (!tgt?.possessedByCourt) return;
      if (tgt.priorName) tgt.name = tgt.priorName;
      if ("priorSprite" in tgt) tgt.sprite = tgt.priorSprite;
      if (tgt.priorSide) tgt.side = tgt.priorSide;
      tgt.possessedByCourt = false; tgt.forceTarget = null;
    }
    function courtGoddessFell(s) { if (court(s)) releaseAll(s); }

    function courtCandidates(s, a) {
      const c = court(s); if (!c || !a || a.defeated || a.status?.soothed) return [];
      const h = c.heart; if (!h || (h.hp ?? 0) <= 0 || H.actorAt(s, h.x, h.y)) return [];
      const range = H.strikeRange?.(s, a) ?? 1;
      if (H.dist(s, a.x, a.y, h.x, h.y) > range) return [];
      const costs = s.rules.actionCosts || {};
      if (a.tempo < (costs.strikeMin ?? 10)) return [];
      const efforts = new Set([Math.min(costs.strike ?? 25, costs.strikeMax ?? 50, a.tempo), Math.min(costs.strikeMax ?? 50, a.tempo)]);
      return [...efforts].filter((e) => e >= (costs.strikeMin ?? 10)).map((effort) => ({ type: "strike", actor: a.id, target: [h.x, h.y], effort }));
    }
    function courtScore(s, id, cand) {
      const c = court(s); if (!c || !cand) return 0;
      const a = s.actors[id]; if (!a) return 0;
      const destroyer = c.contract === "destroy" || (c.contract === "protect" && a.side !== "player");
      const protector = c.contract === "protect" && a.side === "player";
      let bonus = 0;
      if (cand.type === "strike" && Array.isArray(cand.target)) {
        const [x, y] = cand.target, h = c.heart;
        if (h && (h.hp ?? 0) > 0 && x === h.x && y === h.y && !H.actorAt(s, x, y)) {
          if (protector) bonus -= 100;
          else if (destroyer) bonus += 80;
        }
        const g = goddess(s);
        if (g && x === g.x && y === g.y) bonus += 60;
      }
      if (cand.type === "move" && Array.isArray(cand.to) && destroyer) {
        const g = goddess(s);
        const focus = g || ((c.heart?.hp ?? 0) > 0 ? c.heart : null);
        if (focus) {
          const d0 = Math.abs(a.x - focus.x) + Math.abs(a.y - focus.y);
          const d1 = Math.abs(cand.to[0] - focus.x) + Math.abs(cand.to[1] - focus.y);
          if (d1 === 0) bonus -= 25;
          else if (d1 < d0) bonus += MOVE_BIAS;
        }
      }
      return bonus;
    }

    function nearestFoe(s, a) {
      let best = null, bestD = Infinity;
      for (const u of Object.values(s.actors)) {
        if (u.defeated || u.side === a.side || u.id === a.id) continue;
        const d = H.dist(s, a.x, a.y, u.x, u.y);
        if (d < bestD) { best = u; bestD = d; }
      }
      return best;
    }
    function castScroll(s, a, act) {
      if (!a?.heartScroll) return "No court scroll.";
      const spend = H.spendTempo(s, a, SCROLL_AP, a.heartScroll.name || "Court Scroll"); if (spend) return spend;
      const verb = act?.verb || a.heartScroll.verb || "call";
      delete a.heartScroll;
      if (verb === "tend") {
        const healed = Math.min(SCROLL_TEND, Math.max(0, a.maxLF - a.lf)); a.lf += healed;
        H.log(s, { kind: "court", actor: a.id, text: `${a.name} reads the court scroll and mends ${healed} LF.` });
        return;
      }
      if (verb === "close") {
        const foe = nearestFoe(s, a); if (!foe) return;
        H.hit(s, a, foe, { name: "Court Scroll", ability: "courtScroll", delivery: "field", effect: "damage", damageType: "nigredo", potency: SCROLL_CLOSE }, SCROLL_CLOSE, ["A court scroll closes."]);
        return;
      }
      const at = nearestOpen(s, [a.x, a.y]);
      if (!at) { H.log(s, { kind: "court", actor: a.id, text: "The scroll finds no open tile." }); return; }
      const kind = pickKind(s);
      summonAnimal(s, kind, at, { side: a.side, ally: true, scroll: true });
      H.log(s, { kind: "court", actor: a.id, tiles: [at], text: `${a.name} reads the court scroll and calls a ${animalOf(kind).name}.` });
    }
    function studyScroll(s, a) {
      if (!a?.heartScroll) return "No court scroll.";
      const spend = H.spendTempo(s, a, SCROLL_AP, "Study the scroll"); if (spend) return spend;
      delete a.heartScroll;
      a.heartNote = { name: "Magistrate's note", text: "The court's call, kept for study. It pays less, and it lasts." };
      H.Inspiration?.gain(s, a, 1, "studied the court's scroll");
      H.log(s, { kind: "court", actor: a.id, text: `${a.name} gives the court scroll to study. A note remains.` });
    }

    return {
      openCourt, courtRound, courtTend, courtOutcome, courtCandidates, courtScore, courtHeartHit,
      courtFoundation, courtFoundationFell, courtWitnessSacrifice, courtVesselFell, courtGoddessFell, castScroll, studyScroll,
    };
  })();
});
