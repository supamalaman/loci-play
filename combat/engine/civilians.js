"use strict";
// Civilians (Mala, 2026-10-12; docs/civilians.md): shoppers who want to be left alone, the officers who answer a call,
// and the thief who draws one. A part of the Concept Combat engine, moved verbatim out of engine.js on 2026-11-25 to give
// the core room under its 132000-character cap (claude-engine-room-spec ER1, R-20261125-09). Installed right after charge;
// every other part reads H.Civilian at call time, and the core's placeCivilian calls H.Civilian.present.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).civilians = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  const { C, log, actorAt, tileAt, clone, pickupRules } = H;
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
      if (!src || !tgt || src.id === tgt.id || !s.actors[src.id] || src.side === tgt.side || src.side === "civilian" || tgt.side !== "civilian" || s.preview || src.mirrorOf || tgt.mirrorOf || H.astralRegionOf?.(s, tgt.x, tgt.y) !== "land") return;   // mirrors and pockets (astral, deep): no civilian law there (Mala, 2026-10-26; Sunken BD1, hand-merged into ER1's part at the 1.3.578 stage)
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
      H.wheelhouseSettle?.(s, a, ch);
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
  return { Civilian, isCop, isThief };
});
