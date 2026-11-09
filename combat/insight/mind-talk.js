"use strict";
// Parley as conversation (Mala, 2026-11-04: same game underneath, a conversational wrapper; words come
// from the mind-matrix `why` strings for now). Pure: turns one resolved mind round (du.rounds[i].res)
// into spoken lines. It never reads or writes duel state and never names a number or an unread trait:
// a topic phrase is built only from traits `ctx.known[speaker]` says the speaker has read.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(() => require("./mind-matrix.js"));
  else root.ConceptCombatMindTalk = factory(() => root.ConceptCombatMindMatrix);
})(typeof self !== "undefined" ? self : this, function (matrix = () => null) {
  function hash(seed, tag) {
    let h = 2166136261 ^ (seed >>> 0);
    for (const c of String(tag)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
    return h >>> 0;
  }
  const pick = (list, seed, tag) => list[hash(seed, tag) % list.length];
  // {n} speaker, {o} the one spoken to, {t} topic clause.
  const OPEN = {
    debate: ["{n} lays out the case: {t}.", "{n} argues it plainly: {t}.", "{n} marshals the facts: {t}."],
    empathize: ["{n} softens and speaks to the person: {t}.", "{n} reaches for common ground: {t}.", "{n} lowers their voice: {t}."],
    insult: ["{n} sneers: {t}.", "{n} cuts in, scornful: {t}.", "{n} goes for the throat: {t}."],
    concede: ["{n} lowers their guard and listens.", "{n} stops arguing and lets {o} speak.", "{n} gives ground, saying nothing."],
  };
  const GENERIC = {
    debate: ["{n} sets out the argument point by point.", "{n} makes the case as best they can read {o}.", "{n} argues from the facts at hand."],
    empathize: ["{n} tries to meet {o} where they stand.", "{n} speaks kindly, feeling for an opening.", "{n} offers a little understanding."],
    insult: ["{n} sneers at {o} and hopes it stings.", "{n} throws a barb across the table.", "{n} lets the scorn out."],
  };
  const THEN = {
    won: ["{o} has no good answer.", "The point lands squarely on {o}.", "{o} falters under it."],
    lost: ["{n} hardly makes a dent.", "{o} brushes it aside and presses harder.", "It is the weaker case, and the room knows it."],
    clash: ["Neither gives an inch.", "The two talk over each other, and it comes to nothing.", "Both sides hold; the air stays tight."],
    weak: ["It hits a sore spot: {o} flinches.", "{o} was braced for anything but that.", "That one gets under {o}'s skin."],
    immune: ["{o} does not even blink.", "It slides straight off {o}.", "{o} has heard that one before and is unmoved."],
    backfire: ["It rebounds on {n}: the scorn sounds small.", "{n} hears it come out wrong, and winces.", "{o} is unbothered, and {n} is the one stung."],
    heal: ["{n} steadies a little.", "{n} breathes, and finds some footing again.", "Saying it kindly steadies {n} as well."],
    yield: ["{o} presses the advantage while {n} listens.", "{n} lets it land and learns something in the quiet."],
    bothYield: ["Both stop. The silence is almost friendly.", "Each lets the other talk, and each learns a little."],
  };
  const END = {
    blowout: ["{l} has nothing left to say. It was over almost before it began.", "{l} stops mid-sentence. {w} has won the room outright."],
    decisive: ["{l}'s voice gives out; {w} carried it.", "{l} cannot answer any more. {w} has the better of the argument."],
    narrow: ["It was close. {w} edges it, and {l} knows.", "{l} is worn down by a hair; {w} carries it on points."],
    tie: ["Neither can move the other. The talk dies, and neither will reopen it.", "It ends level, and cold."],
  };
  const fill = (tpl, m) => tpl.replace(/\{(\w)\}/g, (_, k) => m[k] ?? "");
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // The speaker's topic clause, from traits the speaker has READ in the listener. Clause 0 of `why` is
  // the weak side, clause 1 the strong side. Null when nothing read bears on this move.
  function topicOf(move, listenerTraits, readIds) {
    const MX = matrix(); if (!MX) return null;
    const read = (readIds || []).filter((t) => MX.MATCHUPS[t] && listenerTraits.includes(t));
    for (const t of read) if (MX.MATCHUPS[t].weak === move) return MX.MATCHUPS[t].why.split(";")[0].trim();
    for (const t of read) if (MX.MATCHUPS[t].strong === move) return MX.MATCHUPS[t].why.split(";")[1]?.trim() || null;
    return null;
  }
  // ctx: { seed, name(id), traits(id) -> [trait ids], known: { <speaker id>: [trait ids read in the other] } }
  function talk(duel, index, ctx) {
    const r = duel.rounds[index], res = r?.res; if (!res) return [];
    const ids = { a: duel.a, b: duel.b }, out = [], seed = ctx.seed | 0;
    // A weak or immune result is voiced only when that side has READ a trait that explains it (Decision 5); otherwise the round reads as an ordinary exchange.
    const readHit = {}; for (const side of ["a", "b"]) readHit[side] = res[side].move !== "concede" && !!topicOf(res[side].move, ctx.traits(side === "a" ? duel.b : duel.a), ctx.known?.[ids[side]]);
    const weak = { a: res.weak.a && readHit.a, b: res.weak.b && readHit.b }, immune = { a: res.immune.a && readHit.a, b: res.immune.b && readHit.b };
    const notable = res.kind !== "win" || weak.a || weak.b || immune.a || immune.b || res.backfire.a || res.backfire.b || res.a.heal > 0 || res.b.heal > 0;
    for (const side of ["a", "b"]) {
      const other = side === "a" ? "b" : "a", move = res[side].move, id = ids[side], oid = ids[other];
      const m = { n: ctx.name(id), o: ctx.name(oid) };
      const t = move === "concede" ? null : topicOf(move, ctx.traits(oid), ctx.known?.[id]);
      const v = ctx.voice?.(id), vp = v && ((t && v.topic?.[move]?.length ? v.topic[move] : null) || (v.open?.[move]?.length ? v.open[move] : null));
      const base = vp || (move === "concede" ? OPEN.concede : t ? OPEN[move] : GENERIC[move]);
      out.push({ speaker: id, text: cap(fill(pick(base, seed, `open:${duel.round}:${r.round}:${id}`), { ...m, t: t || "" })) });
    }
    const reacts = [];
    const nm = (side) => ctx.name(ids[side]), flip = (side) => (side === "a" ? "b" : "a");
    // say(narration key, side, voice key, voice side): the voiced character's own line when it has one, else the shared narration.
    const say = (key, side, vkey = key, vside = side) => {
      const list = ctx.voice?.(ids[vside])?.[vkey];
      if (list?.length) return reacts.push({ voiceKey: vkey, speaker: ids[vside], text: cap(fill(pick(list, seed, `v:${vkey}:${r.round}:${vside}`), { n: nm(vside), o: nm(flip(vside)) })) });
      reacts.push({ speaker: ids[side], text: cap(fill(pick(THEN[key], seed, `${key}:${r.round}:${side}`), { n: nm(side), o: nm(flip(side)) })) });
    };
    const voiced = (side, vkey) => !!ctx.voice?.(ids[side])?.[vkey]?.length;
    if (res.kind === "bothYield") say("bothYield", "a", "bothYield", voiced("a", "bothYield") || !voiced("b", "bothYield") ? "a" : "b");
    else if (res.kind === "yield") { say("yield", res.yielder); if (voiced(flip(res.yielder), "listen")) say("yield", res.yielder, "listen", flip(res.yielder)); }
    else if (res.kind === "clash") say("clash", "a", "clash", voiced("a", "clash") || !voiced("b", "clash") ? "a" : "b");
    else { const w = res.winner, l = flip(w); say(weak[w] ? "weak" : "won", w, "win", w); if (res.margin >= 3 && !weak[w]) say("lost", l, "lose", l); else if (voiced(l, "lose")) say("lost", l, "lose", l); }
    for (const side of ["a", "b"]) {
      if (res.backfire[side]) say("backfire", side);
      else if (immune[side]) say("immune", side, "shrug", flip(side));
      if (res[side].move === "empathize" && res[side].heal) say("heal", side, "steady", side);
    }
    // plain rounds speak two lines; notable ones add up to two reactions
    const strip = (xs) => xs.map(({ speaker, text }) => ({ speaker, text }));
    if (notable) return out.concat(strip(reacts.slice(0, 2)));
    // a plain round speaks one reaction, plus a voiced loser's own line (a character who has a "lose" line should be heard)
    return out.concat(strip([...reacts.slice(0, 1), ...reacts.slice(1).filter((x) => x.voiceKey === "lose").slice(0, 1)]));
  }
  function closing(duel, result, ctx) {
    const seed = ctx.seed | 0, line = (id, list, tag, m) => ({ speaker: id, text: fill(pick(list, seed, tag), m) });
    if (result.tie) {
      const id = [duel.a, duel.b].find((x) => ctx.voice?.(x)?.end?.tie?.length);
      return [id ? line(id, ctx.voice(id).end.tie, "end:tie", {}) : line(duel.a, END.tie, "end:tie", {})];
    }
    const m = { w: ctx.name(result.winner), l: ctx.name(result.loser), n: ctx.name(result.winner), o: ctx.name(result.loser) };
    const wv = ctx.voice?.(result.winner)?.end?.won, lv = ctx.voice?.(result.loser)?.end?.lost, out = [];
    out.push(wv?.length ? line(result.winner, wv, `end:won:${result.severity}`, m) : line(result.winner, END[result.severity] || END.narrow, `end:${result.severity}`, m));
    if (lv?.length) out.push(line(result.loser, lv, "end:lost", { ...m, n: m.l, o: m.w }));
    return out;
  }
  // What you would say, before you commit (second person; same topic rule as talk()).
  const SAMPLE = {
    debate: ["You lay out the case: {t}.", "You set out the argument point by point."],
    empathize: ["You soften and speak to the person: {t}.", "You try to meet them where they stand."],
    insult: ["You sneer: {t}.", "You throw a barb and hope it stings."],
    concede: ["You lower your guard and let them speak.", "You give ground and listen."],
  };
  function preview(move, listenerTraits, readIds) {
    const t = move === "concede" ? null : topicOf(move, listenerTraits, readIds), list = SAMPLE[move]; if (!list) return "";
    return t ? fill(list[0], { t }) : list[list.length - 1];
  }
  // The face each side wears after a round: stung (sad), softened (happy), bristling (angry), surprised on a knockout.
  function mood(res, knockout = false) {
    const out = {};
    for (const side of ["a", "b"]) {
      const other = side === "a" ? "b" : "a";
      const stung = res.backfire[side] || (res.kind === "win" && res.winner === other) || (res.kind === "yield" && res.yielder === side);
      out[side] = res.kind === "bothYield" || (res[side].heal && !stung) ? "happy"
        : stung ? (knockout ? "surprised" : "sad") : res.kind === "clash" ? "angry" : "neutral";
    }
    return out;
  }
  return { talk, closing, topicOf, preview, mood };
});
