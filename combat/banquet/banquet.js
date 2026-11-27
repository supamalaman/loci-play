"use strict";
// The Chef's banquet room (Chef spec, ready-to-review/claude-chef-hotbuild-spec/specs/CHEF.md sections 2, 3, 3b; slice W1a).
// A banquet is a variant of the Director's film state: s.film = { kind: "banquet", ... }. Every site that already reads
// "a pocket is sealed, the outside battle holds" from s.film (no flee, no astral, no weather, no round-end environment,
// no outcome check, no Survival Instincts auto-end) holds for the banquet too. The Director's own readers (Call CUT,
// resolveCheck, filmWrap, collapse) step aside when the kind is "banquet" (director/director.js), and the turn loop asks
// this module instead (engine/turns.js roundTail, engine/true-forms.js advance).
//
// State: s.film = { kind: "banquet", no, owner (= host id), hostId, guests: [id], seated: [id], seatPos: { id: [x, y] },
//   phase: "choice" | "meal", choice: { guestId: null | "reject" }, stocked: { hostId: n }, round, saved }.
// The room: 3x3, the table on the centre tile (the pillar tile "#", the spec's no-art fallback), the host west of the table,
// the guest beside him at the table's north-west corner (side by side, so they can reach each other and the table never
// stands between them), summons on the free ring tiles.
// One full round: the choice phase (the guest chooses; nobody else acts), then one pass of [host, his summons, guest,
// her summons]: the host plays out the rest of the turn he opened the room in, every other seated unit takes one turn,
// and the room collapses when the pass wraps. s.round does not advance inside.
// W1a built the room, the choice, the seal and Reject. W1b adds Accept: the pairwise truce (section 5d: Parley.blocks,
// areaRecipients, knock, and the bleed and infection ticks held), the meal (+15% max LF and +6 ΦF each, capped), the fed
// ledger (a guest is fed once per battle; the host at most twice) and the accepted guest's skipped turn.
// W3 adds Accept's studies and warmth: two free studies each way through H.observeFree ("the meal teaches", 0 AP,
// R-20261125-19) and ordered directional s.valenceBonus writes (section 3e, R-20261103-07: guest>host +3, guest>seated
// host allies +2, host and seated host allies>guest +1; plain JSON, not stashed so warmth persists after collapse).
// Welcome is still staged: nothing in play opens a room yet (slice W2 casts it); tests open it with open().
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatBanquet = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const G = () => (typeof self !== "undefined" ? self : globalThis);
  const Pocket = () => (typeof module === "object" && module.exports ? require("../director/pocket.js") : G().ConceptCombatPocket);
  const Mise = () => (typeof module === "object" && module.exports ? require("../mise/mise.js") : G().ConceptCombatMise) || null;
  const RULES = {
    size: 3, rejectRounds: 2,
    heal: 0.15, phi: 6, hostFedCap: 2,   // section 3b: the meal; the host is fed at most twice a battle
    mealStudies: 2, mealStudyInvest: 20,   // section 3b (W3): two free standard studies each way
    valence: { guestToHost: 3, guestToAlly: 2, hostToGuest: 1, allyToGuest: 1 },   // section 3e (W3; R-20261103-07)
    summonReach: 3, summonsPerOwner: 2,
    hostFreshTurn: false,   // the sim lever (section 3): true would give the host a fresh 100 AP turn inside; ships false
  };
  const HOST_SEAT = [0, 1], GUEST_SEAT = [0, 0], TABLE = [1, 1];
  const RING = [[1, 0], [2, 0], [2, 1], [0, 2], [1, 2], [2, 2]];   // the ring tiles left after the two chairs
  const CHOICES = ["accept", "reject"];
  // Acts nobody takes at the table (section 3 "Leaving", "Stations and Mise while stashed", "Early collapse").
  const CALLS = new Set(["summon", "callPact", "callPack", "callBeast", "callDream", "monsterSummon", "attend", "treeant", "bead",
    "wakeDream", "focusDream", "dreamSpace", "nameDream", "tameBeast"]);
  const TALKS = new Set(["parley", "terms", "mediate", "blessing"]);
  const STATIONS = new Set(["rackAndLabel", "parallelPrep", "everythingInItsPlace"]);
  // Top-level keys that hold outside tiles (section 2's audit): stashed so nothing outside reads against the 3x3 room, and
  // restored untouched. Corpses and graves stay where they are, as in a Director film: a death inside writes its corpse there.
  const STASHED = { mise: null, trueFormFields: [], traps: [], fish: [], treeBraces: [] };

  const sealed = (s) => s?.film?.kind === "banquet";
  const live = (u) => !!u && !u.defeated && !u.escaped && !u.notArrived;
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const rejected = (s, a) => !!a?.status?.hospitalityRejected && s.round <= a.status.hospitalityRejected.until;
  const ownerOf = (u) => u?.summon?.owner || u?.summoner || null;
  // A unit's principal: itself, or the owner its summon chain leads to (summon.owner, then summoner; at most 3 links).
  function principal(s, u) {
    let cur = u;
    for (let i = 0; i < 3 && cur; i++) { const o = ownerOf(cur); if (!o) break; cur = s.actors[o] || s.film?.saved?.actors?.[o] || { id: o }; }
    return cur?.id || null;
  }
  const ledger = (s, hostId) => ((s.chef ||= {})[hostId] ||= { fed: {}, hostFed: 0 });
  const fedAlready = (s, host, guest) => !!s.chef?.[host.id]?.fed?.[guest.id];

  function roomArena() {
    const map = Array.from({ length: RULES.size }, (_, y) => Array.from({ length: RULES.size }, (_, x) => (x === TABLE[0] && y === TABLE[1] ? "#" : ".")).join(""));
    const arena = { name: "The Chef's Table", w: RULES.size, h: RULES.size, map,
      height: Array.from({ length: RULES.size }, () => Array(RULES.size).fill(0)), objects: [], structures: [], banquet: true };
    return arena;
  }

  function canOpen(s, host, guest) {
    if (s.film) return "A room or a film is already open.";
    if (!live(host)) return "The host cannot set a table.";
    if (rejected(s, host)) return "The table is shut: a guest rejected his hospitality.";
    if (!live(guest)) return "Choose a guest.";
    if (guest.side === host.side) return "A guest sits across the table, not on your side of it.";
    if (fedAlready(s, host, guest)) return `${guest.name} has already broken bread at this table.`;
    return null;
  }

  // Up to two of an owner's summons within reach come in, nearest first.
  function summonsOf(s, owner) {
    return Object.values(s.actors).filter((u) => u.id !== owner.id && live(u) && ownerOf(u) === owner.id && cheb(u, owner) <= RULES.summonReach)
      .sort((p, q) => cheb(p, owner) - cheb(q, owner) || (p.id < q.id ? -1 : 1)).slice(0, RULES.summonsPerOwner);
  }

  function open(s, host, guest, H) {
    const why = canOpen(s, host, guest);
    if (why) return { ok: false, reason: why };
    const no = (s.banquetSeq || 0) + 1; s.banquetSeq = no;
    const hostSummons = summonsOf(s, host), guestSummons = summonsOf(s, guest);
    const seatedUnits = [host, ...hostSummons, guest, ...guestSummons];
    const seatPos = {}; for (const u of seatedUnits) seatPos[u.id] = [u.x, u.y];
    const M = Mise(), stocked = { [host.id]: M?.strikeBonus ? M.strikeBonus(s, host) : 0 };   // stocked_line inside counts the stations as they stand now
    const saved = Pocket().stash(s, seatedUnits.map((u) => u.id), roomArena(), STASHED);
    host.x = HOST_SEAT[0]; host.y = HOST_SEAT[1]; guest.x = GUEST_SEAT[0]; guest.y = GUEST_SEAT[1];
    const free = RING.slice();
    for (const [owner, list] of [[host, hostSummons], [guest, guestSummons]]) for (const u of list) {
      free.sort((p, q) => Math.max(Math.abs(p[0] - owner.x), Math.abs(p[1] - owner.y)) - Math.max(Math.abs(q[0] - owner.x), Math.abs(q[1] - owner.y)));
      const at = free.shift(); u.x = at[0]; u.y = at[1];
    }
    s.order = seatedUnits.map((u) => u.id);
    s.turnIndex = 0;   // the host's turn goes on: he plays out the rest of it on the AP he has left
    s.film = { kind: "banquet", no, owner: host.id, hostId: host.id, guests: [guest.id], seated: s.order.slice(), seatPos,
      phase: "choice", choice: { [guest.id]: null }, stocked, round: s.round, saved };
    H.log(s, { kind: "banquet", actor: host.id, target: guest.id, text: `${host.name} sets a table for ${guest.name}. The battle holds its breath.` });
    H.log(s, { kind: "banquet", actor: host.id, target: guest.id, text: "Nobody inside can guard, ward, dodge or react, and nobody leaves before the meal is done." });
    H.log(s, { kind: "banquet", actor: guest.id, text: `${guest.name} must choose: accept the meal or reject hospitality.` });
    return { ok: true };
  }

  // The decider during the choice phase: the first guest whose choice is still open.
  const chooser = (s) => (sealed(s) && s.film.phase === "choice" ? s.film.guests.find((id) => s.film.choice[id] == null && live(s.actors[id])) || null : null);

  function choose(s, a, action, H) {
    const f = s.film;
    if (!sealed(s) || f.phase !== "choice") return "There is no meal to choose.";
    if (!f.guests.includes(a.id)) return "Only a guest chooses.";
    if (f.choice[a.id] != null) return "That choice is made.";
    if (chooser(s) !== a.id) return `${s.actors[chooser(s)]?.name || "Another guest"} chooses first.`;
    if (!CHOICES.includes(action.choice)) return "Choose: accept the meal or reject hospitality.";
    f.choice[a.id] = action.choice;
    if (action.choice === "accept") serve(s, a, H);
    else H.log(s, { kind: "banquet", actor: a.id, target: f.hostId, choice: "reject", text: `${a.name} rejects hospitality.` });
    if (!chooser(s)) {
      f.phase = "meal";
      const anyReject = f.guests.some((id) => f.choice[id] === "reject");
      H.log(s, { kind: "banquet", actor: f.hostId, text: anyReject ? "The table turns hostile: the host's side and the guest may strike each other."
        : "The meal holds: neither side of the table can strike, catch in an area, move or root the other this round, and their wounds wait (a zero-potency effect or a throw can still reach across)." });
    }
    return null;
  }
  // Accept: both are fed (+15% of max LF and +6 ΦF, each capped); the guest goes on the ledger; the host is fed once per meal
  // that fed a guest, at most twice a battle; each side studies the other twice for free ("the meal teaches") and ordered
  // directional meal warmth is recorded in s.valenceBonus (plain JSON, not stashed so it persists after collapse); the accepted
  // guest has nothing left to do, so her turn in the pass is skipped.
  function feed(s, u, H, why) {
    const lf0 = u.lf, pf0 = u.pf || 0;
    u.lf = Math.min(u.maxLF, u.lf + Math.round(u.maxLF * RULES.heal));
    if (u.maxPF != null) u.pf = Math.min(u.maxPF, pf0 + RULES.phi);
    H.log(s, { kind: "banquet", actor: u.id, text: `${u.name} eats ${why}: +${u.lf - lf0} LF, +${(u.pf || 0) - pf0} ΦF.` });
  }
  function study(s, host, guest, H) {
    if (!host || !guest || typeof H?.observeFree !== "function") return;
    for (let i = 0; i < RULES.mealStudies; i++) H.observeFree(s, host, guest, RULES.mealStudyInvest, { reason: "the meal teaches" });
    for (let i = 0; i < RULES.mealStudies; i++) H.observeFree(s, guest, host, RULES.mealStudyInvest, { reason: "the meal teaches" });
  }
  function warm(s, host, guest, H) {
    if (!host || !guest || guest.side === host.side) return;
    const f = s.film, V = RULES.valence, B = (s.valenceBonus ||= {});
    const add = (a, b, n) => { const k = `${a.id}>${b.id}`; B[k] = (B[k] || 0) + n; };
    add(guest, host, V.guestToHost);
    add(host, guest, V.hostToGuest);
    for (const id of f.seated) {
      if (id === host.id || id === guest.id || f.guests.includes(id)) continue;
      const ally = s.actors[id];
      if (!live(ally) || ally.side !== host.side || ownerOf(ally)) continue;
      add(guest, ally, V.guestToAlly);
      add(ally, guest, V.allyToGuest);
    }
    H.log(s, { kind: "banquet", actor: guest.id, target: host.id, text: `The meal warms ${guest.name} towards the host: valence +${V.guestToHost}.` });
  }
  function serve(s, guest, H) {
    const f = s.film, host = s.actors[f.hostId], book = ledger(s, f.hostId);
    const first = !book.fed[guest.id];
    H.log(s, { kind: "banquet", actor: guest.id, target: f.hostId, choice: "accept", text: `${guest.name} accepts the meal.` });
    book.fed[guest.id] = true;
    feed(s, guest, H, "at the Chef's table");
    if (host && !f.hostFedHere && book.hostFed < RULES.hostFedCap) { book.hostFed += 1; f.hostFedHere = true; feed(s, host, H, "with the guest"); }
    else if (host && !f.hostFedHere) H.log(s, { kind: "banquet", actor: host.id, text: `${host.name} has eaten twice this battle: he serves, but does not eat.` });
    if (first) {
      study(s, host, guest, H);
      warm(s, host, guest, H);
    }
    const at = s.order.indexOf(guest.id);
    if (at > s.turnIndex) s.order.splice(at, 1);   // fed, with nothing left to do: no turn in the pass
  }
  // The truce of an accepted meal (section 5d): an accepted guest and the host's side, either way, through summons.
  function pairHolds(s, a, t) {
    if (!sealed(s) || !a || !t) return false;
    const f = s.film, pa = principal(s, a), pt = principal(s, t);
    const accepted = (id) => f.guests.includes(id) && f.choice[id] === "accept";
    const hostSide = (id) => id === f.hostId || s.actors[id]?.side === s.actors[f.hostId]?.side;
    return (accepted(pa) && hostSide(pt) && !accepted(pt)) || (accepted(pt) && hostSide(pa) && !accepted(pa));
  }
  function pairBlocks(s, a, t) {
    return pairHolds(s, a, t) ? `The meal holds: nobody at the Chef's table can harm ${t.name} this round.` : null;
  }
  // The bleed and infection ticks (section 2): a unit seated in an accepted pair does not burn down while the meal holds.
  function truceHolds(s, a) {
    if (!sealed(s) || !a) return false;
    return s.film.seated.some((id) => id !== a.id && pairHolds(s, a, s.actors[id]));
  }

  // The AI guest's choice. The trait-and-need rule (section 3c, with its weights) comes with Welcome in W2; until then an AI
  // guest accepts when hurt (below half LF) and rejects when whole, so both branches are reachable in an all-AI room.
  function aiChoice(s, a) { return a && a.lf < a.maxLF / 2 ? "accept" : "reject"; }

  // Refusals inside the room (engine/actions.js apply). The choice phase is gated there; this covers the meal.
  function refuses(s, a, action, C) {
    if (!sealed(s)) return null;
    const t = action.type, ab = t === "ability" ? action.ability : null, def = ab && C?.abilities?.[ab];
    if (CALLS.has(t) || (def && ["summon", "dreamSpace"].includes(def.effect))) return "Nobody calls a summon or opens a dream at the table.";
    if (ab && STATIONS.has(ab)) return "The meal is being served: no station is laid at the table.";
    if (TALKS.has(t)) return "The table is not a place to talk terms: the guest has already answered.";
    return null;
  }

  // After every turn inside (engine/turns.js roundTail): the host down ends the room; so does every guest down.
  function resolveCheck(s) {
    if (!sealed(s)) return null;
    const f = s.film, host = s.actors[f.hostId];
    if (!host || host.defeated) return "hostDown";
    if (f.guests.every((id) => !live(s.actors[id]))) return "guestsDown";
    return null;
  }
  // The pass wrapped (engine/true-forms.js advance): the meal is one round, so the room collapses instead of a second pass.
  function wrap(s, H) { if (sealed(s)) collapse(s, H, "done"); }

  function collapse(s, H, kind) {
    if (!sealed(s)) return;
    const f = s.film;
    for (const id of f.seated) { const u = s.actors[id], at = f.seatPos[id]; if (u && at) { u.x = at[0]; u.y = at[1]; } }
    Pocket().restore(s, f.saved);   // the outside battle comes back; advance() moves to the next outside actor
    const host = s.actors[f.hostId];
    if (host) host.tempo = 0;   // his turn ended at the table; what is banked waits for his next turn
    s.film = null;
    const rejecters = f.guests.filter((id) => f.choice[id] === "reject");
    if (host && !host.defeated && rejecters.length) {
      host.status ||= {};
      host.status.hospitalityRejected = { until: s.round + RULES.rejectRounds, by: rejecters[0] };   // a new rejection refreshes it; it never stacks
      H.log(s, { kind: "banquet", actor: host.id, target: rejecters[0], text: `Hospitality rejected: for ${RULES.rejectRounds} rounds ${host.name}'s stations sharpen nothing, his free preparation is off and he cannot set a table.` });
    }
    const end = kind === "hostDown" ? "The host has fallen: the table is cleared." : kind === "guestsDown" ? "No guest is left at the table: it is cleared." : "The meal is over.";
    H.log(s, { kind: "banquet", actor: f.hostId, text: `${end} The battle resumes.` });
  }

  // Each turn start (classes/class-runtime.js turnStart): an expired Hospitality rejected is cleared.
  function turnStart(s, a) {
    const r = a?.status?.hospitalityRejected;
    if (r && s.round > r.until) delete a.status.hospitalityRejected;
  }

  return { RULES, sealed, rejected, principal, pairHolds, pairBlocks, truceHolds, fedAlready, roomArena, canOpen, open, chooser, choose, aiChoice, refuses, resolveCheck, wrap, collapse, turnStart };
});
