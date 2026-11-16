"use strict";
// Tandem Spirits, slice T1 (~/loci-orbit/ready-to-review/muse-tandem-spirit-spec SPEC.md sections 4 and 8; R-20261114-10,
// R-20261114-33). A tandem is a summon with a user: the summon row carries a `tandem` block, and the palace `bond`
// (0/1/2, summons.js) is left as it is.
//
//   tandem: { user, leash, rule, price, hexagon: { power, speed, leash, stamina, precision, growth } }
//     user     who it answers to ("any" until a Trial binds it, T2)        leash   tiles from the user it acts within
//     rule     its one governing rule, in words                            price   what its user pays, in words
//     hexagon  six ratings A (best) to E; Growth E means complete
//
// The leash (section 4): a tandem moves and aims only within `leash` tiles of its user. A move that brings it back
// toward its user is always allowed, so a tandem left outside can walk home. A tandem that starts its turn outside its
// leash, or whose ultimate is ordered at a tile outside it, strains: for one turn it may move and guard, nothing else
// (R-20261114-33).
// T2b (R-20261115-03, R-20261115-15), each read from optional fields of the block, so a T1 block without them is unchanged:
//   stretch  { lf, leash }    its user pays `lf` LF to set the leash to `leash` tiles through the tandem's next turn (stretchLeash)
//   lend     { max, potency } each different foe it wounds lends it a tile: +`potency` on its later hits, `max` tiles at most
//   strain sheds every lent tile. reflect { share, max }: damage to a close tandem (base leash 2 or less) echoes to its user
//   at `share` of the LF it lost, rounded down, at most `max`; the echo is LF taken, never a hit, so it cannot echo again (the
//   step that finishes a user it drops to 0 is a zero-potency hit, which takes no LF and so echoes nothing).
//   fragments [three lines]  Observe on the tandem reveals the next one, in order, once per look, per observing side.
// Admission (section 4): no tandem rates above C (A or B) in all three of Power, Speed and Leash: the tradeoff law.
// Pure functions; the engine passes its own distance (`dist(s, x1, y1, x2, y2)`) and log.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTandem = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const LETTERS = ["A", "B", "C", "D", "E"];
  const HEXAGON = [["power", "Power"], ["speed", "Speed"], ["leash", "Leash"], ["stamina", "Stamina"], ["precision", "Precision"], ["growth", "Growth"]];
  const TRADEOFF = ["power", "speed", "leash"], ABOVE_C = ["A", "B"];

  // The tandem block an actor carries (makeSummonActor copies it from the row), or null for every other unit.
  const of = (a) => (a && a.summon && a.summon.tandem) || null;
  // The living unit it answers to: the summon's owner. No living owner, no leash to measure.
  const userOf = (s, a) => { const u = a && a.summon && s.actors[a.summon.owner]; return u && !u.defeated ? u : null; };
  // How far a tile is from the user; null when there is no leash (not a tandem, or no living user).
  function reach(s, a, x, y, dist) {
    const t = of(a), u = t && userOf(s, a);
    return u ? dist(s, u.x, u.y, x, y) : null;
  }
  // The leash it acts within now: its own, or the stretched one through the turn its user paid for (T2b).
  const stretched = (a) => !!(of(a) && a.status && a.status.leashStretch && a.status.leashStretch.until >= (a.ownerTurns || 0));
  const leashOf = (a) => (stretched(a) ? a.status.leashStretch.leash : of(a).leash);
  const outside = (s, a, x, y, dist) => { const d = reach(s, a, x, y, dist); return d != null && d > leashOf(a); };
  // A move may end inside the leash, or anywhere closer to the user than the tandem stands now (walking home).
  function moveAllowed(s, a, to, dist) {
    if (!outside(s, a, to[0], to[1], dist)) return true;
    return reach(s, a, to[0], to[1], dist) < reach(s, a, a.x, a.y, dist);
  }
  const strained = (a) => !!(a && a.status && a.status.tandemStrain && a.status.tandemStrain.until >= (a.ownerTurns || 0));
  const leashText = (s, a) => `${a.name} acts within ${leashOf(a)} tile${leashOf(a) === 1 ? "" : "s"} of ${userOf(s, a)?.name || "its user"}`;

  // Strain for one turn: `now` is its current turn (at its own turn start), otherwise its next one.
  function strain(s, a, why, log, { now = false } = {}) {
    a.status = a.status || {};
    a.status.tandemStrain = { label: "Strained", until: (a.ownerTurns || 0) + (now ? 0 : 1), why };
    if (log) log(s, { kind: "tandem", actor: a.id, strain: true, text: `${a.name} strains against its leash: ${why} For a turn it can only move and guard.`,
      why: [`${leashText(s, a)} (its tandem rule). Outside it, an order fails and the tandem strains (R-20261114-33).`] });
    shed(s, a, log);
  }
  // Strain sheds every lent tile (T2b: the boundary of "made of what it strikes").
  function shed(s, a, log) {
    const n = (a.tandemTiles || []).length; if (!n) return 0;
    a.tandemTiles = [];
    if (log) log(s, { kind: "tandem", actor: a.id, shed: n, text: `${a.name} loses its pattern under the strain: ${n === 1 ? "its one lent tile falls" : `all ${n} lent tiles fall`} away.`,
      why: ["Strain sheds every tile a tandem was lent (its boundary)."] });
    return n;
  }
  // The potency its lent tiles add to its own hits (0 for every other unit).
  const lentPotency = (a) => { const l = of(a)?.lend; return l ? Math.min(l.max, (a.tandemTiles || []).length) * l.potency : 0; };
  // After any hit the engine resolves (engine/damage.js hit, last step): a tandem that wounded a foe it had not yet wounded is
  // lent a tile; a close tandem that lost LF echoes part of it to its user. `lost` is the LF the target lost; `opts` the hit's;
  // `finish(user, src)` runs the engine's defeat path for a user the echo dropped to 0 (a zero-potency bleed-out hit).
  function afterHit(s, src, tgt, lost, opts, log, finish) {
    if (!(lost > 0) || !tgt) return;
    const ls = of(src) && src.summon.tandem.lend;
    if (ls && !src.defeated && tgt.side !== src.side && tgt.category !== "bystander" && tgt.id !== src.id && !(src.tandemTiles || []).includes(tgt.id) && (src.tandemTiles || []).length < ls.max) {
      src.tandemTiles = [...(src.tandemTiles || []), tgt.id];
      if (log) log(s, { kind: "tandem", actor: src.id, target: tgt.id, lend: src.tandemTiles.length, text: `${tgt.name} lends ${src.name} a tile: ${src.tandemTiles.length} of ${ls.max}, +${lentPotency(src)} potency on its later hits.`,
        why: ["Made of what it strikes: each different foe it wounds lends it a tile."] });
    }
    const t = of(tgt), rf = t && t.reflect, u = rf && userOf(s, tgt);
    if (!u || t.leash > 2) return;
    const echo = Math.min(rf.max, Math.floor(lost * rf.share)); if (echo <= 0) return;
    const before = u.lf; u.lf = Math.max(0, u.lf - echo);
    if (log) log(s, { kind: "tandem", actor: tgt.id, target: u.id, echo: before - u.lf, text: `The blow echoes back to ${u.name}: ${before - u.lf} LF (${u.lf}/${u.maxLF}).`,
      why: [`A close tandem shares its wounds: half of what it loses, rounded down, at most ${rf.max} a hit. An echo never echoes.`] });
    if (u.lf <= 0 && finish) finish(u, src);
  }
  // The user's stretch (T2b, its price): `user` pays stretch.lf LF and the tandem acts within stretch.leash tiles through its
  // next turn. Returns a refusal string, or the event to log.
  function stretch(s, user, a) {
    const t = of(a), st = t && t.stretch;
    if (!st) return { error: "That is not a tandem with a leash to stretch." };
    if (a.defeated || a.summon.owner !== user.id) return { error: "Choose your own tandem on the field." };
    if (stretched(a)) return { error: `${a.name}'s leash is already stretched.` };
    if (user.lf <= st.lf) return { error: `Stretching the leash costs ${st.lf} LF, and you need more than ${st.lf} to pay it (you have ${user.lf}).` };
    user.lf -= st.lf;
    a.status = a.status || {};
    a.status.leashStretch = { label: "Leash stretched", leash: st.leash, until: (a.ownerTurns || 0) + 1 };
    return { event: { kind: "tandem", actor: user.id, target: a.id, stretch: st.leash, text: `${user.name} pays ${st.lf} LF to stretch ${a.name}'s leash to ${st.leash} tiles through its next turn.`,
      why: [`The tandem's price: ${t.price}`] } };
  }
  // Observe on a tandem (engine/actions-observe.js observe; a summon has no insight deck): the next of its fragments, in order,
  // once per look, per observing side. nextFragment only reads; observed records it and logs it.
  function nextFragment(s, observer, a) {
    const f = of(a) && of(a).fragments; if (!Array.isArray(f) || !f.length || !observer) return null;
    const n = ((s.tandemFragments || {})[observer.side] || {})[a.summon.key] || 0;
    return n < f.length ? { n, text: f[n], of: f.length } : null;
  }
  function observed(s, observer, a, log) {
    const next = nextFragment(s, observer, a); if (!next) return null;
    const f = of(a).fragments, n = next.n;
    ((s.tandemFragments ||= {})[observer.side] ||= {})[a.summon.key] = n + 1;
    if (log) log(s, { kind: "observe", actor: observer.id, target: a.id, fragment: n + 1, text: observer.id === "player" ? `${a.name}, fragment ${n + 1} of ${f.length}: ${f[n]}` : `${observer.name} reads fragment ${n + 1} of ${a.name}.` });   // a foe's find stays its own, as other AI looks do
    return f[n];
  }
  // At its own turn start: outside the leash means strain for this turn.
  function turnStart(s, a, dist, log) {
    if (!of(a) || a.defeated || !outside(s, a, a.x, a.y, dist)) return false;
    strain(s, a, `it starts its turn ${reach(s, a, a.x, a.y, dist)} tiles from ${userOf(s, a).name}.`, log, { now: true });
    return true;
  }
  // Why a tandem may not aim at (x, y) now, or null. Techniques and Strikes both answer to it.
  function aimRefusal(s, a, x, y, dist) {
    if (!of(a)) return null;
    if (strained(a)) return `${a.name} is strained: this turn it can only move and guard.`;
    if (x != null && outside(s, a, x, y, dist)) return `Beyond the leash: ${leashText(s, a)}.`;
    return null;
  }
  const moveRefusal = (s, a, to, dist) => (of(a) && to && !moveAllowed(s, a, to, dist) ? `Beyond the leash: ${leashText(s, a)}.` : null);
  // The one gate every action passes (engine/actions.js, before the handler): strained, a tandem may only move, jump, climb,
  // guard, end its turn, or answer without a technique; any action that names a destination answers to the leash.
  const STRAINED_MAY = ["move", "jump", "climb", "guard", "end", "respond"];
  function actionRefusal(s, a, action, dist) {
    if (!of(a) || !action) return null;
    if (strained(a) && (!STRAINED_MAY.includes(action.type) || (action.type === "respond" && action.response === "technique"))) return `${a.name} is strained: this turn it can only move and guard.`;
    if (Array.isArray(action.to)) return moveRefusal(s, a, action.to, dist);
    return null;
  }
  // A response-window option the gate would refuse (so the AI and the menu are never offered it).
  function responseRefusal(s, a, opt, dist) {
    if (!of(a) || !opt) return null;
    if (opt.kind === "technique") return aimRefusal(s, a, ...(opt.target || [null, null]), dist);
    if (Array.isArray(opt.to)) return moveRefusal(s, a, opt.to, dist);
    return null;
  }

  // Admission for one summon row: the problems, or [] when it is a fit tandem (or not a tandem at all).
  function admission(id, row) {
    const t = row && row.tandem; if (!t) return [];
    const out = [], hex = t.hexagon || {};
    if (!(typeof t.user === "string" && t.user)) out.push(`${id}: tandem.user names who it answers to`);
    if (!(Number.isInteger(t.leash) && t.leash >= 1)) out.push(`${id}: tandem.leash is a whole number of tiles, at least 1`);
    for (const k of ["rule", "price"]) if (!(typeof t[k] === "string" && t[k].trim())) out.push(`${id}: tandem.${k} is stated in words`);
    for (const [k] of HEXAGON) if (!LETTERS.includes(hex[k])) out.push(`${id}: hexagon.${k} is a letter A to E`);
    const top = TRADEOFF.filter((k) => ABOVE_C.includes(hex[k]));
    if (top.length > 2) out.push(`${id}: above C in all of Power, Speed and Leash (the tradeoff law: it must pay somewhere)`);
    if ("bond" in t) out.push(`${id}: tandem.bond is not a field (palace bond stays on the summon; R-20261114-10)`);
    return out;
  }
  // The hexagon as rows for a card: [{ key, label, letter }].
  const hexagon = (t) => HEXAGON.map(([key, label]) => ({ key, label, letter: (t && t.hexagon && t.hexagon[key]) || "?" }));
  // The card block: the six letters, the leash in tiles, the rule and the price. `esc` is the page's HTML escaper.
  function cardHtml(t, esc) {
    if (!t) return "";
    const cells = hexagon(t).map((r) => `<span class="cc-tandem-cell" data-hex="${r.key}"><b>${esc(r.letter)}</b> ${esc(r.label)}</span>`).join("");
    return `<div class="cc-tandem" data-tandem><div class="cc-tandem-hex">${cells}</div><p class="cc-tandem-leash">Leash ${t.leash} tile${t.leash === 1 ? "" : "s"} · ${esc(t.rule)}</p><p class="cc-tandem-price">Price: ${esc(t.price)}</p></div>`;
  }

  return { LETTERS, HEXAGON, of, userOf, reach, outside, stretched, leashOf, shed, lentPotency, afterHit, stretch, observed, moveAllowed, strained, strain, turnStart, aimRefusal, moveRefusal, actionRefusal, responseRefusal, admission, hexagon, cardHtml };
});
