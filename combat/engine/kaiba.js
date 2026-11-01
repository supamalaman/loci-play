"use strict";
// Kaiba, the cat (Mala, 2026-10-14; docs/kaiba.md): a civilian-faction random spawn.
// Pet him for small boons; three pets and he sleeps or wanders off. He cannot be
// harmed (damage.js fizzles on him) but the attempt still angers the civilians.
// A part of the Concept Combat engine: engine.js installs it with the host object H.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).kaiba = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const spiritGone = (s, u) => { const Spirit = (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null; Spirit?.onExit?.(s, u, H); };   // SP-05: every exit refreshes the roster
    const { clone } = H;   // everything else arrives as h (call-time helpers, like the Tourist module)
    const Kaiba = {
      is: (u) => !!u && u.character === "kaiba",
      active: (k) => !!k && !k.defeated && !k.escaped,
      spawn(s, h, { at = null, id = "kaiba" } = {}) {
        if (s.actors[id] || Object.values(s.actors).some((u) => this.is(u))) return null;
        const open = (x, y) => x >= 0 && y >= 0 && x < s.arena.w && y < s.arena.h && !h.tileAt(s, x, y).blocksMove && !h.actorAt(s, x, y) && !h.barrierAt(s, x, y);
        let spot = null;
        if (at && open(at[0], at[1])) spot = at;
        else {
          const cx = (s.arena.w - 1) / 2, cy = (s.arena.h - 1) / 2, cands = [];
          for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) if (open(x, y)) cands.push([x, y]);
          if (!cands.length) return null;
          cands.sort((a, b) => (Math.abs(a[0] - cx) + Math.abs(a[1] - cy)) - (Math.abs(b[0] - cx) + Math.abs(b[1] - cy)));
          spot = cands[Math.floor(h.seededChance(`${s.seed}:kaiba:at`) * Math.min(cands.length, 12))];
        }
        const base = s.actors.player || Object.values(s.actors)[0];
        const a = H.freshBody(base, s);
        Object.assign(a, {
          id, character: "kaiba", name: "Kaiba", category: "civilian", side: "civilian", sprite: "kaiba",
          ai: null, controller: "ai", posture: "protective", permanentAlly: false, selectedConfig: null,
          x: spot[0], y: spot[1], maxLF: 40, lf: 40, pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0,
          primary: null, secondary: null, reserve: [], reserveSlots: 0, lens: {}, level: 1, xp: 0, proficiency: 1,
          traits: ["pacifist", "curious"], passives: {}, abilities: [], aiAbilities: [], learned: [],
          inventory: [], inventoryCapacity: 0, reaction: 0, ownerTurns: 0, boss: null, size: null, massive: false,
          tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0,
          moved: false, acted: false, guardUsedThisTurn: false, defeated: false, notArrived: false, arrivesRound: null,
          eventActor: false, eventRole: null, aggressive: false, persuaded: false, standDownUntil: null, willpower: 10, maxWillpower: 10,
          kaiba: { pets: 0, pettedOnce: false, asleep: false },
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
        h.log(s, { kind: "faction", actor: id, tiles: [spot], text: "Kaiba wanders onto the battlefield, unbothered.", why: ["A civilian. Pet him if you can reach him; hit him and the precinct hears about it."] });
        return a;
      },
      pet(s, a, act, h) {
        const k = s.actors[act.target];
        if (!k || !this.is(k)) return "There is no cat there.";
        if (!this.active(k)) return "Kaiba is gone.";
        if (k.kaiba.asleep) return "Kaiba is asleep. Let him rest.";
        if (a.defeated) return "The dead pet no cats.";
        if (k.kaiba.shunned?.[a.id]) return "Kaiba won't let you near him after that: no petting for the rest of this battle.";
        if (h.dist(s, a.x, a.y, k.x, k.y) > 1) return "Get next to Kaiba to pet him.";
        if (a.lastPetTurn === a.ownerTurns) return "One pet a turn — he'll still be here.";
        const spend = h.spendTempo(s, a, 10, "Pet");
        if (spend) return spend;
        a.actionsThisTurn++;
        a.tempo += 20; a.tempoCapacity += 20;
        const heal = Math.min(5, a.maxLF - a.lf); a.lf += heal;
        let first = false;
        a.lastPetTurn = a.ownerTurns;
        if (!k.kaiba.pettedOnce) { k.kaiba.pettedOnce = true; first = true; h.Inspiration.gain(s, a, 1, "petted the cat"); }
        k.kaiba.pets++;
        h.log(s, { kind: "kaiba", actor: a.id, target: k.id, text: `${a.name} pets Kaiba (+20 AP, +${heal} LF${first ? ", +1 Inspiration" : ""}).`, why: [`Pet ${k.kaiba.pets} of 3 before he sleeps or wanders off.`] });
        if (k.kaiba.pets >= 3) {
          if (h.seededChance(`${s.seed}:kaiba:mood`) < 0.5) {
            k.kaiba.asleep = true;
            k.status = { ...(k.status || {}), asleep: true };   // marker rail + unit card read status (Z icon)
            h.log(s, { kind: "kaiba", actor: k.id, text: "Kaiba curls up and falls asleep.", why: ["Three pets is plenty. He stays, unbothered and unpettetable."] });
          } else {
            k.escaped = true; k.defeated = true; k.leaveReason = "got bored and wandered off"; k.tempo = 0; spiritGone(s, k);
            s.civilians.members = (s.civilians.members || []).filter((id) => id !== k.id);
            h.log(s, { kind: "kaiba", actor: k.id, text: "Kaiba gets bored and wanders off.", why: ["Three pets is plenty."] });
          }
        }
      },
      // The cat's own brain: go up to units looking for pets. Beside someone (or asleep,
      // or out of AP, or alone) he simply waits — the petting is their action, not his.
      decide(s, a, h) {
        if (s.phase === "response") return { type: "respond", actor: a.id, response: "none" };
        if (!this.active(a) || a.kaiba.asleep || a.tempo <= 0) return { type: "end", actor: a.id };
        const others = Object.values(s.actors).filter((u) => u.id !== a.id && !u.defeated && !u.notArrived && !u.escaped);
        if (!others.length) return { type: "end", actor: a.id };
        if (others.some((u) => h.dist(s, a.x, a.y, u.x, u.y) <= 1)) return { type: "end", actor: a.id };
        const near = (at) => Math.min(...others.map((u) => Math.abs(u.x - at[0]) + Math.abs(u.y - at[1])));
        const step = h.moveOptions(s, a.id).filter((o) => near(o.to) < near([a.x, a.y])).sort((p, q) => near(p.to) - near(q.to) || p.tempoCost - q.tempoCost);
        for (const o of step.slice(0, 4)) if (h.apply(s, { type: "move", actor: a.id, to: o.to }, { preview: true }).ok) return { type: "move", actor: a.id, to: o.to };
        return { type: "end", actor: a.id };
      },
    };
    return { Kaiba };
  })();
});
