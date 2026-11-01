"use strict";
// Sealed fight rules. The picker shows only the public label. Payment lives here:
// the boss adapter writes cost 0, so a sheet price is not a charge until this module spends it.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSealedNext = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const PRICE = { cut: 4, pull: 4, slack: 6, close: 15, tide: 16 };
  const OPEN_AP = 30;
  const GATE_LF = 12;
  const LABEL = "Secret Warrior";
  const TIDE_LINE = "The moon is close tonight";
  const BEACH_LINE = "The moon is close, but the sluices are gone";

  const isFlood = (r) => r >= 3 && r % 3 === 0;
  const isEbb = (r) => r >= 4 && (r - 1) % 3 === 0;
  const isMark = (r) => (r + 1) % 3 === 0 && r >= 2;

  function comingFlood(round) {
    let n = Math.max(0, round) + 1;
    while (n < 3 || n % 3 !== 0) n += 1;
    return n;
  }

  function intactGates(f) {
    return Object.values(f.gates).filter((g) => !g.destroyed);
  }

  function beachedNow(f) {
    return intactGates(f).length === 0;
  }

  function strikeTiles(f) {
    const tiles = [];
    for (const id of Object.keys(f.regions)) tiles.push(...regionTiles(f, id));
    for (const line of f.lines) if (!line.filled) tiles.push(...line.tiles);
    return [...new Set(tiles)];
  }

  function cancelRegion(f, region) {
    for (const p of f.pending) for (const part of p.parts) if (part.region === region) part.cancelled = true;
  }

  function create(opts = {}) {
    const regions = opts.regions || {
      a: ["0,1", "1,1", "2,1"],
      b: ["4,1", "5,1", "6,1"],
      c: ["8,1", "9,1", "10,1"],
    };
    const gates = opts.gates || {
      g0: { id: "g0", region: "a", tile: "1,2", lf: GATE_LF, open: false, destroyed: false, drainedFlood: null },
      g1: { id: "g1", region: "b", tile: "5,2", lf: GATE_LF, open: false, destroyed: false, drainedFlood: null },
      g2: { id: "g2", region: "c", tile: "9,2", lf: GATE_LF, open: false, destroyed: false, drainedFlood: null },
    };
    return {
      label: LABEL,
      phi: opts.phi ?? 40,
      ap: opts.ap ?? 100,
      lf: opts.lf ?? 320,
      recloseLeft: opts.recloseLeft ?? 2,
      gates, regions,
      natural: [...(opts.natural || [])],
      naturalTouched: false,
      units: (opts.units || [{ id: "foe", tile: "5,1", region: "b" }]).map((u) => ({ ...u })),
      pending: [],
      seq: 0,
      marks: [],
      lines: [],
      bossWater: {},
      rises: [],
      spent: [],
      round: 0,
      appliedRound: null,
      beached: false,
      stranded: false,
      takenMul: 1,
      slowTiles: 0,
      strandedUntil: null,
      slackFrom: null,
      slackUntil: null,
      aiBuyTide: true,
      ownerAlive: opts.ownerAlive !== false,
      introduced: false,
      log: [],
      lastOrder: [],
    };
  }

  function pay(f, amount, kind, external) {
    if (!external) {
      if (f.phi < amount) return false;
      f.phi -= amount;
    }
    f.spent.push({ kind, amount });
    return true;
  }

  function unchanged(f, extra = {}) {
    return { ok: false, phi: f.phi, ap: f.ap, pending: f.pending.length, lines: f.lines.length, ...extra };
  }

  function openGate(f, id, alreadyPaid) {
    const g = f.gates[id];
    if (!g || g.destroyed || g.open || (!alreadyPaid && f.ap < OPEN_AP)) return unchanged(f);
    if (!alreadyPaid) f.ap -= OPEN_AP;
    g.open = true;
    g.drainedFlood = comingFlood(f.round);
    cancelRegion(f, g.region);
    writeMarks(f);
    f.log.push(`open ${g.region}`);
    return { ok: true, phi: f.phi, ap: f.ap, region: g.region };
  }

  function destroyGate(f, id, dealt = GATE_LF) {
    const g = f.gates[id];
    if (!g || g.destroyed || dealt <= 0) return unchanged(f);
    g.lf = Math.max(0, g.lf - dealt);
    if (g.lf > 0) return { ok: true, destroyed: false, phi: f.phi, lf: g.lf };
    g.destroyed = true;
    g.open = false;
    cancelRegion(f, g.region);
    if (beachedNow(f)) {
      f.beached = true;
      f.aiBuyTide = false;
      for (const p of f.pending) for (const part of p.parts) part.cancelled = true;
    }
    return { ok: true, destroyed: true, beached: f.beached, phi: f.phi };
  }

  function closeSluice(f, id, external) {
    const g = f.gates[id];
    if (!g || g.destroyed || !g.open || f.recloseLeft <= 0 || (!external && f.phi < PRICE.close)) return unchanged(f);
    pay(f, PRICE.close, "close", external);
    f.recloseLeft -= 1;
    g.open = false;
    return { ok: true, phi: f.phi, recloseLeft: f.recloseLeft };
  }

  function kingTide(f, external) {
    if (f.beached || beachedNow(f)) {
      f.beached = true;
      f.aiBuyTide = false;
      f.log.push(BEACH_LINE);
      return { ok: false, phi: f.phi, announce: BEACH_LINE, pending: f.pending.length };
    }
    if (!external && f.phi < PRICE.tide) return unchanged(f);
    pay(f, PRICE.tide, "tide", external);
    const id = `p${++f.seq}`;
    const parts = intactGates(f).map((g) => ({
      id: `${id}:${g.region}`, region: g.region, cancelled: !!g.open, bonus: 1,
    }));
    f.pending.push({ id, kind: "tide", paid: PRICE.tide, parts });
    f.log.push(TIDE_LINE);
    return { ok: true, id, phi: f.phi, announce: TIDE_LINE, parts: parts.length };
  }

  function pull(f, region, external) {
    const g = Object.values(f.gates).find((x) => x.region === region);
    if (!g || g.destroyed || (!external && f.phi < PRICE.pull)) return unchanged(f);
    pay(f, PRICE.pull, "pull", external);
    const id = `p${++f.seq}`;
    f.pending.push({
      id, kind: "pull", paid: PRICE.pull,
      parts: [{ id: `${id}:${region}`, region, cancelled: !!g.open, pull: true }],
    });
    return { ok: true, id, phi: f.phi };
  }

  function cut(f, tiles, regionId, external) {
    if (!Array.isArray(tiles) || tiles.length !== 4 || (!external && f.phi < PRICE.cut)) return unchanged(f);
    const intact = intactGates(f);
    const chosen = intact.find((g) => g.region === regionId) || intact[0] || null;
    pay(f, PRICE.cut, "cut", external);
    const line = {
      id: `l${++f.seq}`, tiles: tiles.slice(), region: chosen ? chosen.region : null,
      dry: !chosen, filled: false,
    };
    f.lines.push(line);
    return { ok: true, line, phi: f.phi };
  }

  function fill(f, lineId) {
    const line = f.lines.find((l) => l.id === lineId);
    if (!line || line.filled) return unchanged(f);
    line.filled = true;
    return { ok: true, phi: f.phi };
  }

  function canStrike(f, tile) {
    return strikeTiles(f).includes(tile);
  }

  function slack(f, namesRound, external) {
    if (!external && f.phi < PRICE.slack) return unchanged(f);
    const tide = namesRound ?? comingFlood(f.round);
    pay(f, PRICE.slack, "slack", external);
    f.slackFrom = tide;
    f.slackUntil = tide + 1;
    return { ok: true, phi: f.phi, from: tide, until: tide + 1 };
  }

  function ownerDown(f) {
    f.ownerAlive = false;
    for (const p of f.pending) for (const part of p.parts) part.cancelled = true;
    return { ok: true, pending: f.pending.length };
  }

  function slackActive(f) {
    return f.slackFrom != null && f.round >= f.slackFrom && f.round < f.slackUntil;
  }

  function forecast(f) {
    const floods = [], ebbs = [];
    for (let n = f.round + 1; n < f.round + 24 && (floods.length < 4 || ebbs.length < 4); n += 1) {
      if (isFlood(n)) floods.push(n);
      if (isEbb(n)) ebbs.push(n);
    }
    const rise = !f.beached;
    return { floods: (rise ? floods : []).slice(0, 4), publishedFloods: floods.slice(0, 4), ebbs: ebbs.slice(0, 4), rise };
  }

  function observe(f) {
    const table = forecast(f);
    const rise = table.rise ? `The next rises are ${table.floods.join(", ")}.` : "The next rounds do not rise.";
    const printed = table.publishedFloods.length ? ` (${table.publishedFloods.join(", ")})` : "";
    return `${LABEL} strikes only from a shared line, and that ground is the same for both sides. A new line costs ${PRICE.cut}. A line already in reach is used before a new one is paid for. After the gates are gone, a paid line is still shared ground and it adds no water. Opening a gate costs ${OPEN_AP} and cancels only that region's share. Re-closing costs ${PRICE.close} and does not bring a cancelled share back. ${rise} The printed rounds do not move${printed}.`;
  }

  function ended(f) {
    return f.lf <= 0;
  }

  function writeMarks(f) {
    f.marks = [];
    if (!f || f.beached || !isMark(f.round)) return f.marks;
    for (const g of intactGates(f)) {
      if (g.open || g.destroyed || g.drainedFlood === comingFlood(f.round)) continue;
      f.marks.push(...regionTiles(f, g.region));
    }
    return f.marks;
  }

  function comingDriver(f) {
    const round = comingFlood(f.round);
    const pockets = [];
    if (!f.beached) for (const g of intactGates(f)) {
      if (g.open || g.drainedFlood === round) continue;
      const tiles = regionTiles(f, g.region);
      if (!tiles.length) continue;
      const [x, y] = tiles[0].split(",").map(Number);
      pockets.push({ level: 1, sources: [[x, y]], bounds: tiles, flow: 1 });
    }
    return { level: 1, sources: [], pockets };
  }

  function regionTiles(f, region) {
    const tiles = [...(f.regions[region] || [])];
    for (const line of f.lines) if (!line.filled && !line.dry && line.region === region) tiles.push(...line.tiles);
    return tiles.filter((t) => !f.natural.includes(t));
  }

  function applyRound(f, round) {
    if (f.appliedRound === round) return f;
    f.round = round;
    f.appliedRound = round;
    const order = [];
    if (!f.beached && f.strandedUntil != null && round >= f.strandedUntil) {
      f.stranded = false; f.takenMul = 1; f.slowTiles = 0; f.strandedUntil = null;
    }
    if (f.slackUntil != null && round >= f.slackUntil) { f.slackFrom = null; f.slackUntil = null; }
    if (f.beached) {
      f.stranded = true; f.takenMul = 1.25; f.slowTiles = 1; f.aiBuyTide = false;
      order.push("strand");
    }
    if (isFlood(round)) {
      order.push("resolve");
      const bonus = {};
      if (!f.ownerAlive) for (const p of f.pending) for (const part of p.parts) part.cancelled = true;
      for (const p of f.pending) for (const part of p.parts) {
        if (part.cancelled) { order.push(`drop:${part.id}`); continue; }
        if (part.bonus) bonus[part.region] = (bonus[part.region] || 0) + part.bonus;
        if (part.pull) {
          for (const u of f.units) if (u.region === part.region) {
            const [x, y] = u.tile.split(",").map(Number);
            u.tile = `${x + 2},${y}`;
            order.push(`pull:${u.id}:${u.tile}`);
          }
        }
      }
      f.pending = [];
      order.push("rise");
      f.bossWater = {};
      if (!f.beached) for (const g of intactGates(f)) {
        if (g.open || g.drainedFlood === round) continue;
        const level = 1 + (bonus[g.region] || 0);
        for (const tile of regionTiles(f, g.region)) {
          if (f.natural.includes(tile)) { f.naturalTouched = true; continue; }
          f.bossWater[tile] = { level, region: g.region };
        }
        if (Object.values(f.bossWater).some((w) => w.region === g.region)) f.rises.push({ round, region: g.region, level });
        order.push(`rise:${g.region}:${level}`);
      }
      order.push(slackActive(f) ? "refresh:protected" : "refresh");
      f.marks = [];
    } else if (isEbb(round)) {
      order.push("drain");
      f.bossWater = {};
      if (!f.beached) {
        f.stranded = true; f.takenMul = 1.25; f.slowTiles = 1; f.strandedUntil = round + 1;
        order.push("strand");
      }
      if (slackActive(f)) order.push("slack");
    }
    if (isMark(round)) {
      order.push("mark");
      writeMarks(f);
    }
    f.lastOrder = order;
    f.log.push(order.join(" "));
    return f;
  }

  function beginRound(f) {
    return applyRound(f, (f.round || 0) + 1);
  }

  function driverFor(f) {
    if (f.beached || isEbb(f.round)) return { level: 0, sources: [], pockets: [] };
    if (!isFlood(f.round)) return null;
    const byRegion = {};
    for (const [k, v] of Object.entries(f.bossWater)) (byRegion[v.region] ||= []).push(k);
    const pockets = Object.entries(byRegion).map(([, tiles]) => {
      const [x, y] = tiles[0].split(",").map(Number);
      return { level: f.bossWater[tiles[0]].level, sources: [[x, y]], bounds: tiles, flow: 1 };
    });
    return { level: 1, sources: [], pockets };
  }

  function onRound(s, H) {
    const f = s?.sealedFight;
    if (!f) return null;
    if (!f.introduced && Array.isArray(s.log)) {
      f.introduced = true;
      s.log.push({ i: s.log.length, round: s.round, kind: "observe", text: observe(f) });
    }
    applyRound(f, s.round);
    syncMarks(s, H);
    for (const u of f.units) {
      const a = s.actors?.[u.id];
      if (!a || a.defeated) continue;
      const [x, y] = String(u.tile).split(",").map(Number);
      if (H?.inside && !H.inside(s, x, y)) continue;
      a.x = x; a.y = y;
    }
    const driver = driverFor(f);
    if (driver) s.waterLevel = driver;
    return driver;
  }

  function placeGates(s) {
    const f = s?.sealedFight;
    if (!f || !s.arena) return;
    s.arena.objects ||= [];
    for (const g of Object.values(f.gates)) {
      const live = s.arena.objects.find((p) => p.sealedGate === g.id);
      if (g.destroyed) {
        if (live) s.arena.objects = s.arena.objects.filter((p) => p.sealedGate !== g.id);
        continue;
      }
      const [x, y] = g.tile.split(",").map(Number);
      if (!live) s.arena.objects.push({ id: `sealed-gate-${g.id}`, sealedGate: g.id, type: "sluice", name: "Sluice", x, y, hp: g.lf, maxHp: GATE_LF, blocksMove: false, material: "stone" });
      else { live.x = x; live.y = y; live.hp = g.lf; live.open = !!g.open; }
    }
  }

  function syncGates(s) {
    const f = s?.sealedFight;
    if (!f) return;
    for (const g of Object.values(f.gates)) {
      if (g.destroyed) continue;
      const o = (s.arena?.objects || []).find((p) => p.sealedGate === g.id);
      if (!o || o.hp <= 0) destroyGate(f, g.id, g.lf);
      else if (o.hp < g.lf) destroyGate(f, g.id, g.lf - o.hp);
    }
    placeGates(s);
  }

  function applyField(s) {
    const f = s?.sealedFight;
    const boss = f && Object.values(s.actors || {}).find((a) => a.boss === "sealednext" && !a.defeated);
    if (!boss) return;
    f.lf = boss.lf;
    const next = -(f.slowTiles || 0);
    const prev = boss._sealedSlow || 0;
    boss.passives = boss.passives || {};
    boss.passives.moveBudgetAdd = (boss.passives.moveBudgetAdd || 0) - prev + next;
    boss._sealedSlow = next;
  }

  const CAST = {
    boss_sealednext_cutLine: "cut", boss_sealednext_pullShare: "pull", boss_sealednext_slackWater: "slack",
    boss_sealednext_closeSluice: "close", boss_sealednext_kingTide: "tide",
    boss_sealednext_lowWater: "noop", boss_sealednext_longEbb: "noop",
  };

  function priceOf(abilityId) {
    const kind = CAST[abilityId];
    if (!kind) return null;
    return kind === "noop" ? 0 : PRICE[kind];
  }

  function castBlock(s, a, abilityId) {
    const f = s?.sealedFight;
    const kind = CAST[abilityId];
    if (!f || !kind || a?.boss !== "sealednext") return "That technique is not in this fight.";
    if ((a.pf || 0) < priceOf(abilityId)) return "The pool is short.";
    if (kind === "tide" && (f.beached || beachedNow(f))) return "The cast does not take.";
    if (kind === "close") {
      if (!Object.values(f.gates).some((g) => g.open && !g.destroyed)) return "No gate is open.";
      if (f.recloseLeft <= 0) return "The gate does not close.";
    }
    if (kind === "pull" && !intactGates(f).length) return "No region remains.";
    return null;
  }

  function castFromActor(s, a, abilityId) {
    const f = s.sealedFight;
    const kind = CAST[abilityId];
    const block = castBlock(s, a, abilityId);
    if (block) {
      if (kind === "tide" && f && (f.beached || beachedNow(f))) {
        f.beached = true; f.aiBuyTide = false; f.log.push(BEACH_LINE);
      }
      return block;
    }
    const cost = priceOf(abilityId);
    a.pf -= cost;
    const refund = () => { a.pf += cost; };
    if (kind === "noop") return null;
    if (kind === "slack") return slack(f, comingFlood(f.round), true).ok ? null : (refund(), "The hold does not take.");
    if (kind === "tide") return kingTide(f, true).ok ? null : (refund(), "The cast does not take.");
    if (kind === "close") {
      const g = Object.values(f.gates).find((x) => x.open && !x.destroyed);
      return g && closeSluice(f, g.id, true).ok ? null : (refund(), "The gate does not close.");
    }
    if (kind === "pull") {
      const region = intactGates(f).find((g) => (f.regions[g.region] || []).some((t) => Object.values(s.actors).some((u) => !u.defeated && u.id !== a.id && `${u.x},${u.y}` === t)))?.region || intactGates(f)[0]?.region;
      if (!region) return (refund(), "No region remains.");
      const foe = Object.values(s.actors).find((u) => !u.defeated && u.id !== a.id && (f.regions[region] || []).includes(`${u.x},${u.y}`));
      if (foe) f.units = [{ id: foe.id, tile: `${foe.x},${foe.y}`, region }];
      const r = pull(f, region, true);
      if (!r.ok) return (refund(), "The pull does not take.");
      return null;
    }
    const tiles = [0, 1, 2, 3].map((n) => `${a.x + n},${a.y}`);
    const r = cut(f, tiles, null, true);
    if (!r.ok) return (refund(), "The line does not take.");
    return null;
  }

  function gateOf(s, x, y) {
    const f = s?.sealedFight;
    if (!f) return null;
    const k = `${x},${y}`;
    return Object.values(f.gates).find((g) => !g.destroyed && g.tile === k) || null;
  }

  function regionOf(s, x, y) {
    const f = s?.sealedFight;
    if (!f) return null;
    const k = `${x},${y}`;
    for (const [id, tiles] of Object.entries(f.regions)) if ((tiles || []).includes(k)) return id;
    for (const line of f.lines) if (!line.filled && line.tiles.includes(k)) return line.region;
    return null;
  }

  function syncMarks(s, H) {
    const f = s?.sealedFight;
    if (!f || f.beached || !isMark(f.round)) return f?.marks || [];
    if (H?.previewFlood) f.marks = H.previewFlood(s, comingDriver(f));
    else writeMarks(f);
    return f.marks;
  }

  return {
    publicOrbs(data) {
      const orbs = data?.orbs || {};
      return Object.keys(orbs).filter((id) => !data.bosses?.[orbs[id]?.boss]?.sealed);
    },
    LABEL, PRICE, OPEN_AP, TIDE_LINE, BEACH_LINE,
    create, openGate, destroyGate, closeSluice, kingTide, pull, cut, fill, canStrike,
    slack, ownerDown, forecast, observe, ended, beginRound, applyRound, driverFor, onRound,
    isFlood, isEbb, isMark, intactGates,
    placeGates, syncGates, applyField, priceOf, castBlock, castFromActor, gateOf, regionOf, syncMarks,
  };
});
