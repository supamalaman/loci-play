"use strict";
// Tandem Spirits, slice T5b: the Answer (~/loci-orbit/ready-to-review/muse-tandem-spirit-spec SPEC.md section 5B and slice 5;
// R-20261114-01, R-20261122-14, R-20261122-59). Once per tandem ever, when a hit would drop its user to 0 LF in a battle that
// matters, the shared survive-the-killing-blow base (survive.js) holds the user at 1 LF and the battle waits on the user's
// answer. The user names one of the two needs on the tandem's card, or lets the blow fall. A tandem that Answers is gone for good.
//
// The row's block:  tandem.answer: { matters: ["boss", "trial"], needs: [two of NEEDS] }
//   matters   which battles count: "boss" (a boss of another side is on the field) or "trial" (a Trial battle, s.tandemTrial)
//   needs     the two it offers, by theme (R-20261122-59): Mosaic Hold + End it, Homunculus Reach them + One more turn,
//             Instar Reach them + Hold
//
// Who may Answer: the tandem is out on the field and standing, it is its user's own (the player's account lists it in
// s.unlockedSummons; a lent tandem may not, unless the battle's scenario names it in opts.answerTeach), and it is not the Trial's
// own tandem. A preview never offers it, so an AI look-ahead reads the blow as lethal and nothing is spent.
//
// The engine side (damage.js hit, last in the save chain; never on a bleed-out step):
//   offer(s, user, src, log)        → true when the user is kept up and the battle now waits (s.answerOffer)
//   shielded(s, u)                  → true while u waits on its answer, or holds (Hold) this round: hit() takes nothing
//   keepUp(s, u)                    → a held user that a finishing step drops to 0 stays at 1 LF (true when it did)
//   options(s)                      → the offered needs with their legal targets, for the menu and the AI
//   choose(s, a, act, D)            → null, or the refusal. act: { need: id | "fall", target? }. D: { log, hit, spot, gone }
//   aiChoice(s, u)                  → the AI's action (it always answers: End it when a foe is low enough, else Hold, else the rest)
//   turn(s)                         → One more turn: "start" when the extra turn begins now (engine/true-forms.js advance)
// The account side: choose writes s.tandemCodes { type: "answered", id }; tandem-trial.js spendNow saves it at once (ui.js runs it
// after every act) and settle writes it at the end, so leaving the battle cannot bring the tandem back.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../survive.js"));
  else root.ConceptCombatTandemAnswer = factory(root.ConceptCombatSurvive);
})(typeof self !== "undefined" ? self : this, function (Survive) {
  const RULE = "tandemAnswer";
  const NEEDS = {
    moreTurn: { name: "One more turn", target: null, text: "When this turn ends, you take a full extra turn before the order moves on." },
    reach: { name: "Reach them", target: "unit", text: "You are carried to the free tile nearest the unit you name, past leash and ground." },
    hold: { name: "Hold", target: null, text: "You stay at 1 LF and take no damage for the rest of this round." },
    end: { name: "End it", target: "foe", text: "One blow downs a foe you name that is already below a quarter of its LF." }
  };
  const MATTERS = { boss: "a boss fight", trial: "a Trial" };

  const writeLog = (s, ev, log) => { if (typeof log === "function") log(s, ev); else if (Array.isArray(s?.log)) s.log.push(ev); };
  const blockOf = (t) => (t && t.summon && t.summon.tandem && t.summon.tandem.answer) || null;
  const standing = (u) => !!u && !u.defeated && !u.escaped && !u.notArrived;
  const foeOf = (u, t) => standing(t) && t.side !== u.side && t.category !== "bystander" && t.side !== "civilian";
  // A battle that matters (R-20261122-59): a Trial battle, or a boss of another side standing on the field.
  function matters(s, u, kinds) {
    return (kinds || []).some((k) => (k === "trial" ? !!(s && s.tandemTrial)
      : k === "boss" ? Object.values((s && s.actors) || {}).some((t) => t && t.boss && foeOf(u, t)) : false));
  }
  // The words for a card: "Its Answer comes in a boss fight or a Trial: Hold, or End it."
  function cardLine(block) {
    if (!block) return "";
    const where = (block.matters || []).map((k) => MATTERS[k]).filter(Boolean).join(" or ");
    const what = (block.needs || []).map((n) => NEEDS[n] && NEEDS[n].name).filter(Boolean).join(", or ");
    return `Once ever, while it is out in ${where}, when a blow would drop you to 0 LF, it can answer one need: ${what}. Then it is gone for good.`;
  }
  const owns = (s, u, t) => u.id !== "player" || (s.unlockedSummons || []).includes(t.summon.key) || s.answerTeach === t.summon.key;
  // The tandem that can answer for this user now, or null.
  function tandemFor(s, u) {
    if (!s || s.preview || s.answerOffer || !u) return null;
    return Object.values(s.actors || {}).find((t) => standing(t) && t.summon && t.summon.owner === u.id && blockOf(t)
      && !(s.tandemTrial && s.tandemTrial.unit === t.id) && owns(s, u, t) && matters(s, u, blockOf(t).matters)) || null;
  }
  function offer(s, u, src, log) {
    const t = tandemFor(s, u); if (!t) return false;
    if (!Survive.survive(s, u, { id: RULE, holds: () => true, then: () => {} })) return false;
    const needs = blockOf(t).needs.filter((n) => NEEDS[n]).slice(0, 2);
    s.answerOffer = { user: u.id, tandem: t.id, key: t.summon.key, needs, by: src && src.id !== u.id ? src.id : null, round: s.round };
    writeLog(s, { kind: "tandemAnswer", actor: t.id, target: u.id, offer: true, tiles: [[u.x, u.y]],
      text: `${u.name} should have fallen. ${t.name} holds them at 1 LF and waits: name the need, or let the blow fall.`,
      why: [`The Answer, once ever: ${needs.map((n) => NEEDS[n].name).join(" or ")}. Whichever need is named, ${t.name} is gone for good; asking nothing keeps it, and the blow falls.`] }, log);
    return true;
  }
  const holding = (s, u) => !!(u && u.status && u.status.answerHold && u.status.answerHold.round === s.round);
  const shielded = (s, u) => !!(u && s && ((s.answerOffer && s.answerOffer.user === u.id) || holding(s, u)));
  function keepUp(s, u) {
    if (!shielded(s, u) || !(u.lf <= 0)) return false;
    u.lf = 1; return true;
  }
  // The legal targets of one need for the waiting user.
  function targetsOf(s, u, need) {
    const n = NEEDS[need]; if (!n || !n.target) return [];
    const o = s.answerOffer, all = Object.values(s.actors || {});
    if (n.target === "foe") return all.filter((t) => foeOf(u, t) && t.lf < t.maxLF / 4).map((t) => t.id);
    return all.filter((t) => standing(t) && t.id !== u.id && t.id !== (o && o.tandem)).map((t) => t.id);
  }
  function options(s) {
    const o = s && s.answerOffer, u = o && s.actors[o.user]; if (!u) return [];
    return o.needs.map((need) => { const n = NEEDS[need], targets = targetsOf(s, u, need);
      return { need, name: n.name, text: n.text, target: n.target, targets, ok: !n.target || targets.length > 0 }; });
  }
  function choose(s, a, act, D) {
    const o = s.answerOffer; if (!o) return "There is no Answer to give.";
    const u = s.actors[o.user], t = s.actors[o.tandem];
    if (!a || a.id !== o.user) return `Waiting for ${u ? u.name : "the user"}'s answer.`;
    const need = act && act.need;
    if (need === "fall") {
      s.answerOffer = null; u.lf = 0;
      writeLog(s, { kind: "tandemAnswer", actor: t && t.id, target: u.id, declined: true, text: `${u.name} asks nothing of ${t ? t.name : "the tandem"}. The blow falls.` }, D.log);
      D.hit(s, o.by && s.actors[o.by] ? s.actors[o.by] : null, u, null, 0, ["The Answer was not asked for."], { label: "The blow", bleedOut: true });
      return null;
    }
    if (!o.needs.includes(need)) return `${t ? t.name : "It"} does not answer that need. Its card names ${o.needs.map((n) => NEEDS[n].name).join(" and ")}.`;
    const n = NEEDS[need], targets = targetsOf(s, u, need), tgt = n.target ? s.actors[act.target] : null;
    if (n.target && (!tgt || !targets.includes(tgt.id))) return need === "end" ? "Name a foe already below a quarter of its LF." : "Name a unit on the field.";
    let at = null;
    if (need === "reach") { at = D.spot(s, u, tgt); if (!at) return `There is no free tile near ${tgt.name}.`; }
    s.answerOffer = null;
    const why = [`The Answer, once ever: ${n.text}`];
    if (need === "hold") { (u.status ||= {}).answerHold = { round: s.round }; writeLog(s, { kind: "tandemAnswer", actor: t.id, target: u.id, need, text: `"Hold." ${t.name} answers: ${u.name} stands at 1 LF, and nothing harms them this round.`, why }, D.log); }
    else if (need === "moreTurn") { s.answerTurn = { actor: u.id, pending: true }; writeLog(s, { kind: "tandemAnswer", actor: t.id, target: u.id, need, text: `"One more turn." ${t.name} answers: when this turn ends, ${u.name} takes another.`, why }, D.log); }
    else if (need === "reach") { const from = [u.x, u.y]; u.x = at[0]; u.y = at[1]; writeLog(s, { kind: "tandemAnswer", actor: t.id, target: u.id, need, tiles: [from, at], text: `"Reach them." ${t.name} answers: it carries ${u.name} to ${tgt.name}.`, why }, D.log); }
    else if (need === "end") { writeLog(s, { kind: "tandemAnswer", actor: t.id, target: tgt.id, need, text: `"End it." ${t.name} answers: one blow for ${tgt.name}.`, why }, D.log);
      tgt.lf = 0; D.hit(s, t, tgt, null, 0, [`${t.name}'s Answer: one blow ends it.`], { label: "End it", bleedOut: true }); }
    if (t && standing(t)) { t.defeated = true; t.escaped = true; t.noXp = true; t.tempo = 0; t.leaveReason = "answered"; if (D.gone) D.gone(s, t); }
    (s.tandemCodes ||= []).push({ type: "answered", id: o.key, need, round: s.round, ...(s.answerTeach === o.key && u.id === "player" && (u.lentSummons || []).includes(o.key) ? { lent: true } : {}) });
    writeLog(s, { kind: "tandemAnswer", actor: o.tandem, target: u.id, gone: true, text: `${t ? t.name : "The tandem"} is gone. It will not come again.` }, D.log);
    return null;
  }
  function aiChoice(s, u) {
    const opts = options(s).filter((o) => o.ok), pick = (id) => opts.find((o) => o.need === id);
    const end = pick("end"), hold = pick("hold"), more = pick("moreTurn"), reach = pick("reach");
    const nearestFoe = (o) => o.targets.map((id) => s.actors[id]).filter((t) => foeOf(u, t)).sort((p, q) => (Math.abs(p.x - u.x) + Math.abs(p.y - u.y)) - (Math.abs(q.x - u.x) + Math.abs(q.y - u.y)) || (p.id < q.id ? -1 : 1))[0];
    if (end) return { type: "tandemAnswer", actor: u.id, need: "end", target: end.targets.slice().sort((p, q) => s.actors[p].lf - s.actors[q].lf || (p < q ? -1 : 1))[0] };
    if (hold) return { type: "tandemAnswer", actor: u.id, need: "hold" };
    if (more) return { type: "tandemAnswer", actor: u.id, need: "moreTurn" };
    if (reach && nearestFoe(reach)) return { type: "tandemAnswer", actor: u.id, need: "reach", target: nearestFoe(reach).id };
    return { type: "tandemAnswer", actor: u.id, need: "fall" };
  }
  // One more turn: when the turn the Answer came in ends, the user's id is put into the order right after it and their extra turn
  // begins; when the extra turn ends, that copy comes out again and the order moves on from where it was. Anything put into the
  // order during the extra turn goes after it (s.turnIndex + 1), so the copy is always at s.turnIndex when it is taken out.
  // Returns "start" (engine/true-forms.js advance starts the turn and stops) or null (advance goes on as usual).
  function turn(s) {
    const x = s.answerTurn; if (!x) return null;
    if (x.active) { if (s.order[s.turnIndex] === x.actor) { s.order.splice(s.turnIndex, 1); s.turnIndex -= 1; } delete s.answerTurn; return null; }
    const u = s.actors[x.actor];
    if (!standing(u) || s.outcome) { delete s.answerTurn; return null; }
    x.pending = false; x.active = true; s.order.splice(s.turnIndex + 1, 0, u.id); s.turnIndex += 1;
    writeLog(s, { kind: "tandemAnswer", actor: u.id, need: "moreTurn", text: `${u.name} takes the turn the Answer gave.` });
    return "start";
  }
  return { RULE, NEEDS, MATTERS, matters, cardLine, tandemFor, offer, shielded, keepUp, targetsOf, options, choose, aiChoice, turn };
});
