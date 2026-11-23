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
// T4 (muse-tandem-spirit-spec §5A and §8.4): need-triggered molts (ACTs, max 3 forms). Molts are one-way; Form 3 is final.
// Conditions menu: cornered, witness, refusal, mastery.
// Pure functions; the engine passes its own distance (`dist(s, x1, y1, x2, y2)`) and log.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTandem = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const LETTERS = ["A", "B", "C", "D", "E"];
  const HEXAGON = [["power", "Power"], ["speed", "Speed"], ["leash", "Leash"], ["stamina", "Stamina"], ["precision", "Precision"], ["growth", "Growth"]];
  const TRADEOFF = ["power", "speed", "leash"], ABOVE_C = ["A", "B"];
  const MOLT_CONDITIONS = ["cornered", "witness", "refusal", "mastery"];
  const MOLT_WORDS = { cornered: "it molts when its user falls below a quarter of their LF", witness: "it molts when an ally falls while it is out",
    refusal: "it molts when its user breaks its rule", mastery: "it molts after three won battles in which it never strains" };

  const writeLog = (s, ev, log) => {
    if (typeof log === "function") log(s, ev);
    else if (Array.isArray(s?.log)) s.log.push(ev);
  };

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

  // Molts (T4; SPEC section 5A; R-20261121-27). A tandem with `forms` (2 or 3) is in one of them at a time; the block's leash,
  // rule, price, hexagon, stretch, reflect, carapace, bonusPotency, fragments and moltCondition are that form's, and the actor
  // carries its name and `winged` (class-runtime.js isFlyer reads it: a winged unit flies). applyForm is the one writer, used
  // by the call (summons.js makeSummonActor) and by molt here, so the two cannot disagree. Molts go forward only; Form 3 is final.
  const FORM_KEYS = ["leash", "rule", "price", "hexagon", "stretch", "reflect", "carapace", "bonusPotency", "fragments", "moltCondition"];
  function applyForm(t, n, a = null) {
    const f = t.forms[n - 1];
    t.currentForm = n;
    for (const k of FORM_KEYS) {
      const v = f[k];
      if (v == null) delete t[k];
      else t[k] = Array.isArray(v) ? [...v] : typeof v === "object" ? { ...v } : v;
    }
    if (a) { a.name = f.name; if (f.winged) a.winged = true; else delete a.winged; if (f.sprite) a.sprite = f.sprite; }   // T5a: a form with its own sheet draws from it
    return { name: f.name, winged: !!f.winged, ...(f.sprite ? { sprite: f.sprite } : {}) };
  }
  const currentForm = (a) => { const t = of(a); return t && Array.isArray(t.forms) ? t.currentForm || 1 : null; };
  const canMolt = (a) => { const n = currentForm(a); return n != null && n < Math.min(3, of(a).forms.length) && !!of(a).moltCondition; };
  // Form II's carapace sheds this much from each hit it takes (engine/damage.js); Form III's bonus is added to its hits on a wounded foe.
  const damageReduction = (tgt) => { const t = of(tgt); return t && typeof t.carapace === "number" ? t.carapace : 0; };
  const bonusPotency = (src, tgt) => { const t = of(src); return t && typeof t.bonusPotency === "number" && tgt && tgt.lf < tgt.maxLF ? t.bonusPotency : 0; };
  // What this battle did to each tandem, for the account at its end (tandem-trial.js settle): the form it reached and whether it
  // strained. Written when it is called (engine/actions-summons.js), when it strains and when it molts.
  // Tandem T6, the technique ladder (R-20261122-15, R-20261122-66). An owned tandem with a `ladder` block arrives at the rung its
  // account record names (s.tandemRungs, written by tandem-trial.js battleStart): practiced, clean or perfect. Clean carries
  // ladder.cleanLendMax lent tiles; perfect also arrives with ladder.perfectStartTiles tiles already lent (marked "rung", so they
  // name no foe). The rung is on its card and in the arrival line, so the foe can read it. A lent tandem has no rung.
  const RUNGS = ["practiced", "clean", "perfect"];
  const RUNG_WORDS = { practiced: "", clean: "it carries {max} lent tiles", perfect: "it carries {max} lent tiles and arrives with {start} already lent" };
  // What its rung gives, in words ("" at practiced).
  function rungWords(t) {
    const L = t && t.ladder, r = t && t.rung; if (!L || !RUNGS.includes(r)) return "";
    return RUNG_WORDS[r].replace("{max}", L.cleanLendMax).replace("{start}", L.perfectStartTiles);
  }
  function applyRung(s, a, log) {
    const t = of(a), key = a && a.summon && a.summon.key, owned = !!(a && a.summon && a.summon.owner === "player" && ((s && s.unlockedSummons) || []).includes(key));
    const rung = (s && s.tandemRungs && s.tandemRungs[key]) || (owned ? "practiced" : null);   // practiced from the Trial pass: on the account's list, no rung named
    if (!t || !t.ladder || !RUNGS.includes(rung)) return;
    t.rung = rung;
    if (rung !== "practiced" && t.lend) t.lend.max = t.ladder.cleanLendMax;
    if (rung === "perfect") a.tandemTiles = Array.from({ length: t.ladder.perfectStartTiles }, () => "rung");
    writeLog(s, { kind: "tandem", actor: a.id, rung, text: `${a.name} arrives at the ${rung} rung${rungWords(t) ? `: ${rungWords(t)}` : ""}.`, why: ["A tandem's rung is earned in battle and shown to every side."] }, log);
  }
  // The different foes it has wounded this battle (its lent tiles, leaving out a perfect rung's own).
  const foesWounded = (a) => (a.tandemTiles || []).filter((id) => id !== "rung").length;
  function noteGrowth(s, a, patch) {
    const key = a && a.summon && a.summon.key; if (!s || !key) return;
    watch(s, a);   // T5a: from its arrival, the allies already down are not falls it witnessed
    const g = ((s.tandemGrowth ||= {})[key] ||= { form: currentForm(a) || 1, strained: false });
    Object.assign(g, patch);
  }
  // One step forward. Refused when it is not a molting tandem, when it is in its last form, or when `to` is not the next form.
  function molt(s, a, to, reason, log = null) {
    const t = of(a), cur = currentForm(a);
    if (cur == null) return { ok: false, error: "Not a molting tandem." };
    if (cur >= Math.min(3, t.forms.length)) return { ok: false, error: `Form ${cur} is final.` };
    if (to !== cur + 1) return { ok: false, error: to <= cur ? `Molts are one-way: Form ${cur} cannot go back to Form ${to}.` : `A molt goes one form at a time: Form ${cur} to Form ${cur + 1}.` };
    const oldName = a.name;
    applyForm(t, to, a);
    noteGrowth(s, a, { form: to });
    const event = { kind: "tandemMolt", actor: a.id, fromForm: cur, toForm: to, trigger: reason,
      text: `${oldName} molts into Form ${to}, ${a.name}: ${reason}.`,
      why: ["A molt answers a need, not a meter, and it is one-way: it never goes back, and Form 3 is final (Tandem T4)."] };
    writeLog(s, event, log);
    return { ok: true, form: to, event };
  }
  // After every hit (afterHit): a tandem whose molt condition is "cornered" molts when its user is below a quarter of their LF;
  // one whose condition is "witness" molts when the unit just hit was an ally of its side (not itself) and fell. "refusal" is in
  // strain; "mastery" is counted between battles (tandem-trial.js growth), never inside one.
  // T5a: witness counts every fall of an ally while it is out, not only one to a hit: a bleed-out, heat, an echo or a rout runs no
  // hit that takes LF. Each molting tandem keeps the ids of its side's units that are down (tandemSeen, set when it arrives:
  // noteGrowth); a unit down now that was not down then is a fall it saw. checkMoltTriggers runs after every hit (afterHit) and in
  // the engine's outcome check (engine/true-forms.js checkOutcome), which nearly every defeat path ends in.
  const fallenAllies = (s, a) => Object.values((s && s.actors) || {}).filter((u) => u && u.id !== a.id && u.side === a.side && u.category !== "bystander" && !u.escaped && !u.notArrived && (u.defeated || u.lf <= 0));   // a unit that left (went home, escaped, was taken) did not fall
  function watch(s, a) { if (Array.isArray(a.summon?.tandem?.forms) && !Array.isArray(a.tandemSeen)) a.tandemSeen = fallenAllies(s, a).map((u) => u.id); }
  function checkMoltTriggers(s, { hitTarget, log } = {}) {
    const out = [];
    for (const a of Object.values((s && s.actors) || {})) {
      if (!a || a.defeated || !canMolt(a)) continue;
      const t = of(a), cond = t.moltCondition, u = userOf(s, a);
      if (!u) continue;   // an unbound tandem (a Trial's foe) has no user and never molts
      const down = fallenAllies(s, a), seen = Array.isArray(a.tandemSeen) ? a.tandemSeen : (hitTarget ? down.filter((x) => x.id !== hitTarget.id) : down).map((x) => x.id);
      const fell = down.find((x) => !seen.includes(x.id));
      a.tandemSeen = down.map((x) => x.id);
      let reason = null;
      if (cond === "cornered" && u && !u.defeated && u.lf > 0 && u.lf < u.maxLF / 4) reason = `cornered: ${u.name} is below a quarter of their LF`;
      else if (cond === "witness" && fell) reason = `witness: ${fell.name} fell while it was out`;
      if (reason) { const r = molt(s, a, currentForm(a) + 1, reason, log); if (r.ok) out.push(r); }
    }
    return out;
  }

  // Strain for one turn: `now` is its current turn (at its own turn start), otherwise its next one.
  function strain(s, a, why, log, { now = false } = {}) {
    a.status = a.status || {};
    a.status.tandemStrain = { label: "Strained", until: (a.ownerTurns || 0) + (now ? 0 : 1), why };
    writeLog(s, { kind: "tandem", actor: a.id, strain: true, text: `${a.name} strains against its leash: ${why} For a turn it can only move and guard.`,
      why: [`${leashText(s, a)} (its tandem rule). Outside it, an order fails and the tandem strains (R-20261114-33).`] }, log);
    shed(s, a, log);
    noteGrowth(s, a, { strained: true });   // a strained battle is not a clean one (mastery: tandem-trial.js growth)
    if (canMolt(a) && of(a).moltCondition === "refusal") molt(s, a, currentForm(a) + 1, "refusal: its user broke its rule", log);   // the molt answers the betrayal
  }
  // Strain sheds every lent tile (T2b: the boundary of "made of what it strikes").
  function shed(s, a, log) {
    const n = (a.tandemTiles || []).length; if (!n) return 0;
    a.tandemTiles = [];
    writeLog(s, { kind: "tandem", actor: a.id, shed: n, text: `${a.name} loses its pattern under the strain: ${n === 1 ? "its one lent tile falls" : `all ${n} lent tiles fall`} away.`,
      why: ["Strain sheds every tile a tandem was lent (its boundary)."] }, log);
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
      // Tandem T6: only an owned tandem has a rung (applyRung), so a lent, unbound or enemy one records no climb.
      if (src.summon.tandem.ladder && src.summon.tandem.rung) { const TA = typeof module === "object" && module.exports ? require("./tandem-answer.js") : globalThis.ConceptCombatTandemAnswer, u = userOf(s, src), n = foesWounded(src);   // Tandem T6: what the ladder reads at the end
        noteGrowth(s, src, { foes: Math.max(n, (s.tandemGrowth && s.tandemGrowth[src.summon.key] && s.tandemGrowth[src.summon.key].foes) || 0), ...(n >= src.summon.tandem.ladder.foes && u && TA && TA.matters(s, u, ["boss", "trial"]) ? { mattered: true } : {}) }); }
      writeLog(s, { kind: "tandem", actor: src.id, target: tgt.id, lend: src.tandemTiles.length, text: `${tgt.name} lends ${src.name} a tile: ${src.tandemTiles.length} of ${ls.max}, +${lentPotency(src)} potency on its later hits.`,
        why: ["Made of what it strikes: each different foe it wounds lends it a tile."] }, log);
    }
    const t = of(tgt), rf = t && t.reflect, u = rf && userOf(s, tgt);
    if (u && t.leash <= 2) {
      const echo = Math.min(rf.max, Math.floor(lost * rf.share));
      if (echo > 0) {
        const before = u.lf; u.lf = Math.max((typeof module === "object" && module.exports ? (() => { try { return require("../animated-body/animated-body.js"); } catch { return null; } })() : globalThis.ConceptCombatAnimatedBody)?.bleedFloor?.(s, u) || 0, u.lf - echo);   // Animated Body: an echo never finishes a cartoon
        writeLog(s, { kind: "tandem", actor: tgt.id, target: u.id, echo: before - u.lf, text: `The blow echoes back to ${u.name}: ${before - u.lf} LF (${u.lf}/${u.maxLF}).`,
          why: [`A close tandem shares its wounds: half of what it loses, rounded down, at most ${rf.max} a hit. An echo never echoes.`] }, log);
        if (u.lf <= 0 && finish) finish(u, src);
      }
    }
    checkMoltTriggers(s, { hitTarget: tgt, log });   // Tandem T4: cornered and witness molts
  }
  // The user's stretch (T2b, its price): `user` pays stretch.lf LF and the tandem acts within stretch.leash tiles through its
  // next turn. Returns a refusal string, or the event to log.
  // Why `user` cannot pay the stretch for `a` now, or null when it can (T2c: the engine action, the menu button and the card all ask this).
  function stretchRefusal(user, a) {
    const t = of(a), st = t && t.stretch;
    if (!st) return "That is not a tandem with a leash to stretch.";
    if (a.defeated || !user || a.summon.owner !== user.id) return "Choose your own tandem on the field.";
    if (stretched(a)) return `${a.name}'s leash is already stretched.`;
    if (user.lf <= st.lf) return `Stretching the leash costs ${st.lf} LF, and you need more than ${st.lf} to pay it (you have ${user.lf}).`;
    return null;
  }
  function stretch(s, user, a) {
    const t = of(a), st = t && t.stretch, no = stretchRefusal(user, a);
    if (no) return { error: no };
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
    writeLog(s, { kind: "observe", actor: observer.id, target: a.id, fragment: n + 1, text: observer.id === "player" ? `${a.name}, fragment ${n + 1} of ${f.length}: ${f[n]}` : `${observer.name} reads fragment ${n + 1} of ${a.name}.` }, log);   // a foe's find stays its own, as other AI looks do
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
    if (t.programs != null) {
      if (!Array.isArray(t.programs) || t.programs.length < 1 || t.programs.length > 3) out.push(`${id}: tandem.programs is 1 to 3 declared instructions`);
      for (const p of (Array.isArray(t.programs) ? t.programs : [])) {
        if (!p || typeof p.id !== "string" || !p.id.trim() || typeof p.name !== "string" || !p.name.trim() || typeof p.text !== "string" || !p.text.trim()) {
          out.push(`${id}: program requires id, name and text`);
          break;
        }
      }
    } else if (t.leash > 2 && !t.forms) {
      out.push(`${id}: far tandem (leash > 2) must declare 1 to 3 programs`);
    }
    if (t.forms != null) {
      if (!Array.isArray(t.forms) || t.forms.length < 2 || t.forms.length > 3) out.push(`${id}: tandem.forms is 2 to 3 forms (max 3 forms, SPEC §5A)`);
      const forms = Array.isArray(t.forms) ? t.forms : [];
      for (let i = 0; i < forms.length; i++) {
        const f = forms[i];
        if (f.form !== i + 1) out.push(`${id}: form ${i + 1} has form index ${i + 1}`);
        if (!f.name || typeof f.name !== "string" || !f.name.trim()) out.push(`${id}: form ${i + 1} names the form`);
        if (!Number.isInteger(f.leash) || f.leash < 1) out.push(`${id}: form ${i + 1} leash is at least 1 tile`);
        for (const k of ["rule", "price"]) if (!f[k] || typeof f[k] !== "string" || !f[k].trim()) out.push(`${id}: form ${i + 1} ${k} is stated in words`);
        for (const [k] of HEXAGON) if (!LETTERS.includes(f.hexagon?.[k])) out.push(`${id}: form ${i + 1} hexagon.${k} is a letter A to E`);
        const topF = TRADEOFF.filter((k) => ABOVE_C.includes(f.hexagon?.[k]));
        if (topF.length > 2) out.push(`${id}: form ${i + 1} above C in all of Power, Speed and Leash (the tradeoff law: it must pay somewhere)`);
        if (i + 1 < forms.length) {
          if (!MOLT_CONDITIONS.includes(f.moltCondition)) out.push(`${id}: form ${i + 1} moltCondition must be one of ${MOLT_CONDITIONS.join(", ")}`);
        }
        if (i + 1 === 3) {
          if (f.hexagon?.growth !== "E") out.push(`${id}: form 3 hexagon.growth must be E (growth complete; Form 3 is final)`);
        }
      }
    }
    return out;
  }
  // The hexagon as rows for a card: [{ key, label, letter }].
  const hexagon = (t) => HEXAGON.map(([key, label]) => ({ key, label, letter: (t && t.hexagon && t.hexagon[key]) || "?" }));
  // The card block: the six letters, the leash in tiles, the rule and the price. `esc` is the page's HTML escaper.
  // `now` (T2c, optional; without it the output is T1's, byte for byte): { unbound } for a Trial's tandem, or { pay, ok, leash } for
  // one on the field with a user: `pay` is the line about the price right now, `leash` the leash it acts within this turn.
  function cardHtml(t, esc, now = null) {
    if (!t) return "";
    const cells = hexagon(t).map((r) => `<span class="cc-tandem-cell" data-hex="${r.key}"><b>${esc(r.letter)}</b> ${esc(r.label)}</span>`).join("");
    if (now && now.unbound) return `<div class="cc-tandem" data-tandem data-unbound><div class="cc-tandem-hex">${cells}</div><p class="cc-tandem-leash">Unbound: no user, so no leash and no strain · ${esc(t.rule)}</p><p class="cc-tandem-price">It cannot be killed: a blow that would finish it leaves it at 1 LF.</p></div>`;
    const leash = now && now.leash != null ? now.leash : t.leash;
    const progHtml = now && now.program ? `<p class="cc-tandem-prog" data-program="${esc(now.program.id)}">Program: <b>${esc(now.program.name)}</b> — ${esc(now.program.text)}</p>` : "";
    const formHtml = Array.isArray(t.forms) ? `<p class="cc-tandem-form" data-form="${t.currentForm || 1}">Form ${t.currentForm || 1} of ${t.forms.length}${t.moltCondition ? ` · ${MOLT_WORDS[t.moltCondition]}` : " · its final form"}</p>` : "";
    return `<div class="cc-tandem" data-tandem>${formHtml}<div class="cc-tandem-hex">${cells}</div>${t.answer ? `<p class="cc-tandem-answer" data-answer>${esc(answerLine(t.answer))}</p>` : ""}${t.rung ? `<p class="cc-tandem-rung" data-rung="${esc(t.rung)}">Rung: ${esc(t.rung)}${rungWords(t) ? ` · ${esc(rungWords(t))}` : ""}</p>` : ""}<p class="cc-tandem-leash">Leash ${leash} tile${leash === 1 ? "" : "s"}${leash !== t.leash ? " (stretched)" : ""} · ${esc(t.rule)}</p><p class="cc-tandem-price">Price: ${esc(t.price)}</p>${progHtml}${now && now.pay ? `<p class="cc-tandem-pay" data-can-pay="${now.ok ? "yes" : "no"}">${esc(now.pay)}</p>` : ""}</div>`;
  }
  // Tandem T5b: the card names when its Answer comes and the two needs it answers (summons/tandem-answer.js cardLine).
  const answerLine = (block) => { const TA = typeof module === "object" && module.exports ? require("./tandem-answer.js") : globalThis.ConceptCombatTandemAnswer; return TA ? TA.cardLine(block) : ""; };

  // Declared programs (T3, muse-tandem-spirit-spec sections 4 and 8; R-20261115-03):
  // An automatic/far tandem carries 1–3 declared programs set at call time (defaulting to the first).
  // The active program is visible on its card and guides its AI. Its user may rewrite it only on the
  // user's own turn start, max once per user turn; foes observe and play around it.
  const programsOf = (a) => (of(a)?.programs || []);
  const activeProgramId = (a) => a?.summon?.tandem?.activeProgram || of(a)?.activeProgram || of(a)?.programs?.[0]?.id || null;
  const activeProgram = (a) => {
    const id = activeProgramId(a);
    return (programsOf(a) || []).find((p) => p.id === id) || null;
  };

  // Why `user` cannot rewrite `a`'s declared program to `newProgramId` now, or null.
  function rewriteRefusal(s, user, a, newProgramId) {
    const t = of(a);
    if (!t) return "Choose your tandem on the field.";
    if (a.defeated) return "Choose your living tandem on the field.";
    const progs = t.programs;
    if (!Array.isArray(progs) || !progs.length) return `${a.name} has no declared programs to rewrite.`;
    if (!user || a.summon.owner !== user.id) return "Only the tandem's user can rewrite its program.";
    const current = s?.currentId || (s?.order && s.order[s.turnIndex]);
    if (current && current !== user.id) return "A declared program can only be rewritten on your own turn.";
    if (a.summon?.tandem?.rewrittenTurn === (user.ownerTurns || 0)) return `${a.name}'s program has already been rewritten this turn.`;
    // Turn start only (spec section 4, "only rewrite at their next turn start"): before the user moves or spends AP this turn.
    // turns.js clears moved at every turn and beat and actionsThisTurn at every turn; spendTempo counts each paid action.
    if (user.moved || (user.actionsThisTurn || 0) > 0) return "A declared program can only be rewritten at the start of your turn, before you move or act.";
    const targetProg = progs.find((p) => p.id === newProgramId);
    if (!targetProg) return `Invalid program: choose from ${progs.map((p) => p.name).join(", ")}.`;
    if (activeProgramId(a) === newProgramId) return `${a.name} is already executing ${targetProg.name}.`;
    return null;
  }

  function rewriteProgram(s, user, a, newProgramId, log) {
    const no = rewriteRefusal(s, user, a, newProgramId);
    if (no) return { error: no };
    a.summon.tandem.activeProgram = newProgramId;
    a.summon.tandem.rewrittenTurn = (user.ownerTurns || 0);
    const targetProg = of(a).programs.find((p) => p.id === newProgramId);
    const event = { kind: "tandem", actor: user.id, target: a.id, program: newProgramId,
      text: `${user.name} rewrites ${a.name}'s declared program to ${targetProg.name}: "${targetProg.text}".`,
      why: ["Declared programs: public to foes, rewritable at user's turn start."] };
    writeLog(s, event, log);
    return { event };
  }

  // AI scoring term for candidate actions under declared programs (ai.js score).
  const geometryOf = (dist) => dist || ((st, x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2));
  const foesOf = (s, a) => Object.values(s.actors).filter((u) => !u.defeated && !u.notArrived && u.side !== a.side && u.category !== "bystander");
  const isCaster = (u) => !!(u && (u.status?.channeling || u.status?.chanting || (u.aura && !u.defeated) || (u.pf || 0) >= 10));
  // The foes tandem `t`'s active program aims at right now: one rule for its own AI (Case 1) and for the foes who read it (Case 2).
  // harryWeakest: the lowest LF (nearer to the tandem, then id, breaks a tie); distractCaster: the prime caster (chanting,
  // channelling, an aura or 10+ ΦF first, then the most ΦF, then nearer); guardUser: every foe within 2 tiles of its user.
  function marked(s, t, dist) {
    const g = geometryOf(dist), foes = foesOf(s, t), progId = activeProgramId(t);
    if (!foes.length) return [];
    if (progId === "harryWeakest") return [[...foes].sort((x, y) => x.lf - y.lf || g(s, t.x, t.y, x.x, x.y) - g(s, t.x, t.y, y.x, y.y) || (x.id < y.id ? -1 : 1))[0]];
    if (progId === "distractCaster") return [[...foes].sort((x, y) => (isCaster(y) ? 1 : 0) - (isCaster(x) ? 1 : 0) || (y.pf || 0) - (x.pf || 0) || g(s, t.x, t.y, x.x, x.y) - g(s, t.x, t.y, y.x, y.y) || (x.id < y.id ? -1 : 1))[0]];
    if (progId === "guardUser") { const u = userOf(s, t); return u ? foes.filter((f) => g(s, u.x, u.y, f.x, f.y) <= 2) : []; }
    return [];
  }
  function programScore(s, a, cand, { actorAt, dist } = {}) {
    if (!s || !a || a.defeated || !cand) return 0;
    const geometryDist = geometryOf(dist);
    const findActor = actorAt || ((st, x, y) => Object.values(st.actors).find((u) => !u.defeated && u.x === x && u.y === y));

    // Case 1: `a` is a tandem executing its declared program
    const progId = activeProgramId(a);
    if (progId && of(a)) {
      const livingFoes = foesOf(s, a);
      if (!livingFoes.length) return 0;
      const targetUnitId = typeof cand.target === "string" ? cand.target : (Array.isArray(cand.target) ? findActor(s, cand.target[0], cand.target[1])?.id : null);
      const aimed = marked(s, a, dist), isFoe = !!targetUnitId && livingFoes.some((f) => f.id === targetUnitId);

      if (progId === "harryWeakest") {
        if (targetUnitId === aimed[0].id) return 12;
        if (isFoe) return -8;
        return 0;
      }
      if (progId === "guardUser") {
        const u = userOf(s, a);
        if (!u) return 0;
        if (targetUnitId && aimed.some((f) => f.id === targetUnitId)) return 12;
        if (isFoe && aimed.length > 0) return -8;
        if (cand.type === "guard" && geometryDist(s, u.x, u.y, a.x, a.y) <= 2) return 6;
        return 0;
      }
      if (progId === "distractCaster") {
        const prime = aimed[0];
        if (targetUnitId === prime.id) return 12;
        if (targetUnitId && isCaster(prime) && !isCaster(s.actors[targetUnitId])) return -8;
        return 0;
      }
    }

    // Case 2: `a` is playing around an opponent's declared program. The program is public (spec section 4), so a foe it aims at
    // (the weakest under Harry the Weakest, the prime caster under Distract Caster, anyone within 2 of the user under Guard User)
    // values Guard or Recover +5. Rev 1 (Jackstay BD): rev 0 read Harry the Weakest only (Keelson AD batch 1, note 2).
    const hostileTandems = Object.values(s.actors).filter((u) => !u.defeated && u.side !== a.side && of(u) && activeProgramId(u));
    for (const ht of hostileTandems)
      if (marked(s, ht, dist).some((f) => f.id === a.id) && (cand.type === "guard" || cand.type === "recover")) return 5;
    return 0;
  }

  // AI positioning pull under declared programs (ai.js moveValue).
  function moveValue(s, a, to, { dist } = {}) {
    if (!s || !a || !to || !of(a)) return 0;
    const geometryDist = dist || ((st, x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2));
    const progId = activeProgramId(a);
    if (!progId) return 0;
    const livingFoes = Object.values(s.actors).filter((u) => !u.defeated && !u.notArrived && u.side !== a.side && u.category !== "bystander");
    if (!livingFoes.length) return 0;

    if (progId === "guardUser") {
      const u = userOf(s, a);
      if (!u) return 0;
      const dTo = geometryDist(s, to[0], to[1], u.x, u.y);
      if (dTo <= 2) return 5;
      return -5 * (dTo - 2);
    }
    const aim = marked(s, a, dist)[0];   // harryWeakest, distractCaster: walk toward the same foe programScore strikes (one rule, marked)
    if (!aim) return 0;
    return (geometryDist(s, a.x, a.y, aim.x, aim.y) - geometryDist(s, to[0], to[1], aim.x, aim.y)) * 3;
  }

  // T2c (R-20261115-42). Unbound: the tandem a Trial sets against the player (summons/tandem-trial.js place). It has no user, so
  // userOf is null and the leash, the strain and the echo never apply; engine/damage.js hit keeps it at 1 LF.
  const unbound = (a) => !!(of(a) && a.summon.unbound);
  // The command-menu rows for `p`'s own tandems on the field: one "stretch the leash" row each (ui.js rootItems; the row sends the
  // engine action stretchLeash). Off, with the engine's own refusal as the reason, while `p` cannot pay.
  function menuItems(s, p) {
    if (!p || !s) return [];
    const out = [];
    for (const a of Object.values(s.actors)) {
      if (a.defeated || !of(a) || a.summon.owner !== p.id) continue;
      const t = of(a);
      if (t.stretch) {
        const st = t.stretch, no = stretchRefusal(p, a);
        out.push({ id: "stretchLeash", summonId: a.id, label: `Stretch ${a.name}'s leash to ${st.leash} tiles · ${st.lf} LF`, off: !!no,
          why: no || `Pay ${st.lf} LF (you have ${p.lf}): ${a.name} acts within ${st.leash} tiles of you through its next turn. No AP.` });
      }
      if (Array.isArray(t.programs) && t.programs.length) {
        const cur = activeProgramId(a);
        for (const pr of t.programs) {
          const no = rewriteRefusal(s, p, a, pr.id);
          out.push({ id: `rewriteProgram:${pr.id}`, summonId: a.id, programId: pr.id,
            label: `Program ${a.name}: ${pr.name}${cur === pr.id ? " (active)" : ""}`,
            off: !!no,
            why: no || `Rewrite declared program to ${pr.name}: "${pr.text}". Free; only at the start of your turn, once.` });
        }
      }
    }
    return out;
  }
  // The card for a tandem on the field (ui.js renderDetail): the T1 card, plus one line that agrees with the engine about the price
  // right now (its user can pay it, or why not), or, for an unbound tandem, that the leash and the price do not apply.
  function cardFor(s, a, esc) {
    const t = of(a); if (!t) return "";
    if (unbound(a)) return cardHtml(t, esc, { unbound: true });
    const u = s && a.summon ? s.actors[a.summon.owner] : null, st = t.stretch;
    const prog = activeProgram(a);
    if (!st || !u) return cardHtml(t, esc, { leash: leashOf(a), program: prog });
    const no = stretchRefusal(u, a);
    return cardHtml(t, esc, { pay: no ? `${u.name} cannot pay it now: ${no}` : `${u.name} can pay it now (${u.lf} LF; the stretch takes ${st.lf}).`, ok: !no, leash: leashOf(a), program: prog });
  }

  return { RUNGS, rungWords, applyRung, foesWounded, unbound, stretchRefusal, menuItems, cardFor, LETTERS, HEXAGON, of, userOf, reach, outside, stretched, leashOf, shed, lentPotency, afterHit, stretch, observed, moveAllowed, strained, strain, turnStart, aimRefusal, moveRefusal, actionRefusal, responseRefusal, admission, hexagon, cardHtml, programsOf, activeProgramId, activeProgram, rewriteRefusal, rewriteProgram, programScore, moveValue, MOLT_CONDITIONS, applyForm, currentForm, damageReduction, bonusPotency, noteGrowth, molt, checkMoltTriggers };
});
