"use strict";
// Posterity suit warriors (Mala, 2026-11-04: hotbuilds for the six Manavu cuts; same crew as Child of the Future).
// Magic, to them, is technology woven into the suit: dreams, orgonite hardware, summons.
// They are not touchedByMagic (content.js: technology is not magic).
//
// Hooks from classes/class-runtime.js (afterHit unused; target, resolve, aiValue, turnStart, damageMods, noteSetup).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatPosteritySuits = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const PAIRS = {
    orgonite_trooper: ["longtermism", "hardware"],
    leviathan_suit: ["longtermism", "cybernetic_ecology"],
    scale_firmware: ["imagination", "hardware"],
    white_jacket_gunner: ["software", "longtermism"],
    bronze_admin: ["delegation", "longtermism"],
    horned_suit: ["imagination", "delegation"],
  };
  const IDS = ["orgoniteLance", "dreamCircuit", "dreamForge", "posterityRaster", "farOrder", "summonedMandate"];
  const SETUP = new Set(["stealPresent", "deployWorkstation", "assignTheTask", "rasterPass", "readLivingCircuit"]);
  const is = (a) => !!a && Object.values(PAIRS).some(([p, s]) => a.primary === p && a.secondary === s);
  const hardwareSuit = (a) => is(a) && (a.primary === "hardware" || a.secondary === "hardware");
  const live = (s) => Object.values(s.actors || {}).filter((u) => u && !u.defeated && !u.notArrived && !u.escaped);
  const near = (s, a, u, r, H) => H.dist(s, a.x, a.y, u.x, u.y) <= r;
  const st = (u) => (u.status ||= {});

  function suitTool(s, a) {
    return (s.arena.objects || []).find((o) => o.role === "artist-workstation" && o.owner === a.id && (o.hp || 0) > 0
      && (o.expiresAt == null || a.ownerTurns < o.expiresAt));
  }
  function ensureSuit(s, a, H) {
    if (!is(a) || a.defeated || s.preview) return null;
    let tool = suitTool(s, a);
    if (!tool) {
      s.arena.objects = s.arena.objects || [];
      tool = { id: `suit-tool-${a.id}`, type: "workstation", name: "Woven suit workstation", role: "artist-workstation",
        owner: a.id, x: a.x, y: a.y, hp: 18, maxHp: 18, cover: 0, sightHeight: 0, blocksMove: false, material: "metal",
        expiresAt: a.ownerTurns + 99, suit: true };
      s.arena.objects.push(tool);
      H.log(s, { kind: "effect", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name}'s suit is the workstation: the weave is already on.`,
        why: ["Woven Suit: one 18 HP site that follows them. Magic, to them, is this hardware. Break it."] });
    } else if (tool.suit) {
      tool.x = a.x; tool.y = a.y; tool.expiresAt = a.ownerTurns + 99;
    }
    return tool;
  }

  function turnStart(s, a, H) {
    if (is(a)) ensureSuit(s, a, H);
  }

  function damageMods(s, src, tgt, inst, damageType, H) {
    if (!is(tgt) || !src || src.side === tgt.side || s.preview) return { mult: 1, notes: [] };
    const d = H.dist(s, src.x, src.y, tgt.x, tgt.y);
    const ranged = d >= 2 && (inst?.delivery === "line" || inst?.delivery === "signal" || (inst?.range || 0) >= 2);
    if (!ranged || tgt.suitBraceRound === s.round) return { mult: 1, notes: [] };
    if ((tgt.reaction ?? s.rules?.reactionsPerRound ?? 1) <= 0) return { mult: 1, notes: [] };
    if (!suitTool(s, tgt)) return { mult: 1, notes: [] };
    tgt.reaction = Math.max(0, (tgt.reaction ?? 1) - 1);
    tgt.suitBraceRound = s.round;
    return { mult: 0.65, notes: ["Suit weave answers a ranged shot ×0.65 (one reaction a round)."] };
  }

  function noteSetup(s, a, inst, H) {
    if (s.preview || !is(a) || a.suitSetupUsed || !inst || !SETUP.has(inst.ability)) return;
    const def = H.C?.abilities?.[inst.ability] || {};
    const ap = def.actionCost || def.tempoCost || 25;
    const pf = def.cost || 0;
    a.suitSetupUsed = true;
    a.tempo = (a.tempo || 0) + ap;
    a.pf = Math.min(a.maxPF ?? 30, (a.pf || 0) + pf);
    H.inspire?.(s, a, 1, `${a.name}'s suit weaves the first setup: AP and ΦF return, and one Inspiration lights.`);
    H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s first setup is free: +${ap} AP, +${pf} ΦF, +1 Inspiration.`,
      why: ["Woven first charge (class-local). Engine-wide freeFirst is not built."] });
  }

  function spendInspired(s, a, H) {
    if ((a.inspiration || 0) < 1) return 0;
    H.spendInspiration?.(s, a, 1, "perform");
    H.log(s, { kind: "inspiration", actor: a.id, spent: 1, text: `${a.name} spends 1 Inspiration: the suit overclocks this weave (+8).`,
      why: ["Inspiration spend: one point bends the merge by +8 potency or +8 ward."] });
    return 8;
  }

  function target(s, a, w, tx, ty, H) {
    if (!w || !["suitLance", "suitCircuit", "suitForge", "suitRaster", "suitOrder", "suitMandate"].includes(w.kind)) return null;
    const fail = (error) => ({ ok: false, error });
    const occ = H.actorAt(s, tx, ty);
    if (w.kind === "suitCircuit") {
      if (tx !== a.x || ty !== a.y) return fail("Target yourself: the circuit is in the suit.");
      return { ok: true, tiles: [[a.x, a.y]], targets: [a.id], self: true };
    }
    if (!occ || occ.defeated || occ.side === a.side) return fail("Aim at a foe.");
    if (w.kind === "suitLance" || w.kind === "suitForge") {
      if (hardwareSuit(a) && !suitTool(s, a)) return fail("The woven workstation is gone. Deploy one.");
    }
    const range = w.range || 4;
    if (H.dist(s, a.x, a.y, occ.x, occ.y) > range) return fail(`Within ${range} tiles.`);
    return { ok: true, tiles: [[occ.x, occ.y]], targets: [occ.id] };
  }

  function resolve(s, a, inst, w, H) {
    if (!w || !["suitLance", "suitCircuit", "suitForge", "suitRaster", "suitOrder", "suitMandate"].includes(w.kind)) return false;
    if (!is(a)) return false;
    // Manifest stores only concepts[0]. Stamp the full pair so Longtermism.afterTechnique tags
    // Software/Delegation-primary merges (R.abilities is a closed list; do not add merge ids there).
    const def = H.C?.abilities?.[inst.ability];
    if (def?.concepts) inst.concepts = def.concepts;
    const say = (text, why = []) => H.log(s, { kind: "effect", actor: a.id, text, why });
    const tgt = inst.targets?.[0] ? H.actor(s, inst.targets[0]) : null;
    const boost = spendInspired(s, a, H);
    if (w.kind === "suitLance") {
      ensureSuit(s, a, H);
      if (tgt && !tgt.defeated && !tgt.status?.guard) {
        const cap = s.rules.longtermism?.fundCap ?? 24;
        const want = s.rules.longtermism?.skimLf ?? 6;
        const room = Math.max(0, cap - (a.longtermismFund || 0));
        const take = Math.min(want, Math.max(0, (tgt.lf || 0) - 1), room);
        if (take > 0) {
          tgt.lf -= take;
          a.longtermismFund = (a.longtermismFund || 0) + take;
          say(`${a.name} steals ${take} Life Force through the orgonite weave. The fund holds ${a.longtermismFund}.`,
            ["The lance reaches the present at range: adjacency is not required."]);
        }
      } else if (tgt?.status?.guard) say(`${tgt.name}'s guard covers the present. The lance still fires.`);
      H.Longtermism?.invest(s, a);
      const pot = 16 + boost;
      if (tgt && !tgt.defeated) H.hit(s, a, tgt, inst, pot, [`Orgonite Lance: ${pot} nigredo through the woven tool.`], { label: "Orgonite Lance", damageType: "nigredo" });
      say(`${a.name} fires the orgonite lance: present stolen, future paid, the suit is the barrel.`,
        ["Merge: Longtermism + Hardware. The traveler call is the ultimate's certain roll."]);
      return true;
    }
    if (w.kind === "suitCircuit") {
      const heal = 6 + (boost ? 8 : 0);
      const missing = Math.min(heal, Math.max(0, (a.maxLF || 0) - (a.lf || 0)));
      if (missing) { a.lf += missing; say(`${a.name}'s living circuit self-corrects: +${missing} LF.`); }
      say(`${a.name} closes the dream circuit in the suit: a Child of the Future is owed.`,
        ["Merge: Longtermism + Cybernetic Ecology. Ultimate call is certain."]);
      return true;
    }
    if (w.kind === "suitForge") {
      ensureSuit(s, a, H);
      const pot = 20 + boost;
      if (tgt && !tgt.defeated) H.hit(s, a, tgt, inst, pot, [`Dream Forge: ${pot} albedo, the image compiled through the suit.`], { label: "Dream Forge", damageType: "albedo" });
      st(a).ward = { label: "Held Image", owner: a.id, protection: 8 + boost, expiresAt: a.ownerTurns + 2 };
      say(`${a.name} forges the pictured arrival through the suit: the image hits, then holds as ward ${8 + boost}.`,
        ["Merge: Imagination + Hardware. No traveler call: this pair does not hold Longtermism."]);
      return true;
    }
    if (w.kind === "suitRaster") {
      const hasBuf = a.status?.artistBuffer && a.status.artistBuffer.until >= a.ownerTurns;
      const pot = (hasBuf ? 18 : 12) + boost;
      if (hasBuf) delete st(a).artistBuffer;
      if (tgt && !tgt.defeated) H.hit(s, a, tgt, inst, pot, [`Posterity Raster: ${pot} albedo${hasBuf ? " (program spent)" : " (no buffer, weaker)"}.`], { label: "Posterity Raster", damageType: "albedo" });
      say(`${a.name} prints the future through the gun: a Child of the Future is owed.`,
        ["Merge: Software + Longtermism. A held raster spends for 18; without one it still fires at 12."]);
      return true;
    }
    if (w.kind === "suitOrder") {
      if (tgt && !tgt.defeated) {
        const ally = live(s).filter((u) => u.side === a.side && u.id !== a.id)
          .sort((p, q) => H.dist(s, tgt.x, tgt.y, p.x, p.y) - H.dist(s, tgt.x, tgt.y, q.x, q.y))[0];
        if (ally) {
          st(ally).order = { from: a.id, target: tgt.id, mul: 1.25, offMul: 0.9, until: ally.ownerTurns + 3 };
          if (boost) st(ally).ward = { label: "Far Order", owner: a.id, protection: 8, expiresAt: ally.ownerTurns + 2 };
          say(`${a.name} files a far order on ${tgt.name}: ${ally.name} carries it${boost ? " under an 8 ward" : ""}.`, ["The traveler who steps through inherits the standing order if they arrive."]);
        }
      }
      say(`${a.name} signs the far order: the present pays, the future executes.`,
        ["Merge: Delegation + Longtermism. Ultimate call is certain."]);
      return true;
    }
    if (w.kind === "suitMandate") {
      if (tgt && !tgt.defeated) {
        const ally = live(s).filter((u) => u.side === a.side && u.id !== a.id)
          .sort((p, q) => H.dist(s, tgt.x, tgt.y, p.x, p.y) - H.dist(s, tgt.x, tgt.y, q.x, q.y))[0];
        if (ally) {
          st(ally).order = { from: a.id, target: tgt.id, mul: 1.25, offMul: 0.9, until: ally.ownerTurns + 3 };
          st(ally).ward = { label: "Summoned Mandate", owner: a.id, protection: 8 + boost, expiresAt: ally.ownerTurns + 2 };
          say(`${a.name} pictures ${ally.name} already holding the order on ${tgt.name}: ward ${8 + boost}.`,
            ["Merge: Imagination + Delegation. The image is the order; no Longtermism traveler."]);
        } else say(`${a.name} pictures the mandate, and nobody is here to carry it.`);
      }
      return true;
    }
    return false;
  }

  function aiValue(s, a, cand, w, H) {
    if (!w || !["suitLance", "suitCircuit", "suitForge", "suitRaster", "suitOrder", "suitMandate"].includes(w.kind) || !is(a)) return null;
    const foes = live(s).filter((u) => u.side !== a.side && u.side !== "bystander");
    const nearFoes = foes.filter((u) => near(s, a, u, 5, H)).length;
    if (w.kind === "suitCircuit") return 10 + Math.min(8, (a.maxLF || 0) - (a.lf || 0));
    if (nearFoes === 0) return 0;
    if (w.kind === "suitLance") return 14 + nearFoes * 2;
    if (w.kind === "suitForge") return 16 + nearFoes * 2;
    if (w.kind === "suitRaster") return 12 + (a.status?.artistBuffer ? 6 : 0);
    if (w.kind === "suitOrder" || w.kind === "suitMandate") return live(s).some((u) => u.side === a.side && u.id !== a.id) ? 14 : 0;
    return 0;
  }

  return { PAIRS, IDS, SETUP, is, hardwareSuit, suitTool, ensureSuit, turnStart, damageMods, noteSetup, target, resolve, aiValue };
});
