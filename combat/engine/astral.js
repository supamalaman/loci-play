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

    // The pocket is appended once per battle: GAP_W blocking void columns, then POCKET_W pocket columns on
    // every row. Same arena, same helpers, same turn order. Idempotent; the second projector reuses the pocket.
    function ensureAstralPocket(s) {
      const R = s.rules.astral;
      if (!R) return null;
      if (s.astral?.ready) return s.astral;
      const landW = s.arena.w, h = s.arena.h, gap = R.gapW ?? 64, pw = R.pocketW ?? 9;
      const x0 = landW + gap;
      s.arena.map = s.arena.map.map((row) => row + "#".repeat(gap) + ".".repeat(pw));
      const hh = s.arena.height?.length === h ? s.arena.height : Array.from({ length: h }, () => Array(landW).fill(0));
      s.arena.height = hh.map((row) => [...row, ...Array(gap).fill(0), ...Array(pw).fill(0)]);
      s.arena.landW = landW;
      s.arena.w = x0 + pw;
      const portal = [x0 + Math.floor(pw / 2), Math.floor(h / 2)];
      s.astral = { ready: true, x0, w: pw, landW, portal, entries: {}, genN: 0 };
      log(s, { kind: "astral", tiles: [portal], text: `The astral plane opens east of the world: a sealed pocket ${pw} tiles wide behind ${gap} of void.`, why: ["One pocket per battle. Distance and void seal it: no range, line, field, route, aura, or move budget crosses."] });
      return s.astral;
    }
    const astralRegionOf = (s, x, y) => {
      const A = s.astral;
      if (!A?.ready) return "land";
      if (x >= A.x0) return "pocket";
      if (x >= A.landW) return "void";
      return "land";
    };
    const astralSameRegion = (s, ax, ay, bx, by) => astralRegionOf(s, ax, ay) === astralRegionOf(s, bx, by);
    const astralPocketActive = (s) => !!(s.astral?.ready && Object.values(s.actors).some((a) => a.soulOf && !a.defeated));

    function openPocketTile(s, near, exclude) {
      const A = s.astral, h = s.arena.h;
      const taken = new Set((exclude || []).map(([x, y]) => key(x, y)));
      for (let r = 0; r < Math.max(A.w, h); r++)
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = near[0] + dx, y = near[1] + dy;
          if (x < A.x0 || x >= A.x0 + A.w || y < 0 || y >= h || taken.has(key(x, y))) continue;
          if (tileAt(s, x, y).blocksMove || actorAt(s, x, y) || barrierAt(s, x, y)) continue;
          if ((s.wild || []).some((m) => m.form === "unit" && m.x === x && m.y === y)) continue;
          return [x, y];
        }
      return null;
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

    return { astralMirrorShake, ensureAstralPocket, astralRegionOf, astralSameRegion, astralPocketActive, astralProjectValidate, projectSoul, generateMirrors, returnSoul, collapsePocketIfEmpty, astralDeathLink, astralUpkeep };
  })();
});
