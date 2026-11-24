"use strict";
// Courtroom battle driver (W1.3 build): Deadly Sentencing, live. The trial
// pauses the battle (violence = contempt), argues counts over rounds, and
// applies verdicts. Either side may convene through The Bench. The player
// can queue legal plays for their own side through Talk ▸ Trial.
//   RULES                                    → tunables (rite price, evidence floor, counts cap)
//   canInvoke(s, H, invokerId, accusedId)    → refusal reason or null
//   invoke(s, H, invokerId, accusedId)       → { ok } (opens s.trial, spends the rite step)
//   queuePlay(s, move)                       → queues the player's prosecution play
//   advance(s, H)                            → round hook: argues one exchange per side, verdicts when spent
//   applyVerdicts(s, H)                      → seals/sword/mercy/minor/cuffs + resume + ledger
//   violenceGate(s, H, a)                    → refusal string or null (contempt + favor against the brawler)
//   vouchersFor(s, accusedId)                → Bonds B6: who may vouch for the player (s.bondVouches; [] for anyone else)
//   stageHearing(s, H, spec)                 → Bonds B6 teaching: a scenario opens court on the player at battle start
// Invoke costs 1 banked rite step + presented evidence (2+ observations on
// the accused) + real counts (live lawEvidence/testimony, cap 3). One trial
// per battle; retrials (≤2, new evidence only) reopen inside it. The rite is
// driven-only. Convene has a normal dodge response. Sword dodge = 1 free
// reaction + a severed limb (maimed: maxLF ×0.75, battle-long).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./trial.js"));
  else root.ConceptCombatCourtroom = factory(root.ConceptCombatTrial);
})(typeof self !== "undefined" ? self : this, function (TR) {
  const RULES = { riteCost: 1, evidenceNeeded: 2, maxCounts: 3, invokeTempo: 25, playTempo: 10, conveneTempo: 20, conveneReach: 5 };
  const seed01 = (seed, tag) => { let h = 2166136261; for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const revealedOn = (s, who, accused) => (s.insight?.knowledge?.[who]?.[accused]?.revealed || []).length;
  const foundIds = (s, accused) => Object.values(s.cls?.lawEvidence?.[accused] || {}).flat().filter((e) => e.grade === "found").map((e) => e.id);
  function fixtures(s) {
    return Object.values(s.actors || {}).filter((u) => !u.defeated).map((u) => ({ id: u.id, name: u.name, side: u.side === "player" ? "ally" : u.side,
      honest: !!u.traits?.some?.((t) => (t?.id || t) === "honest"), lf: u.lf, maxLF: u.maxLF, alive: true, arrivalRound: u.arrivalRound ?? 0,
      character: u.character || null }));   // Bonds B6: the vouch asks whether its character was on the field when the act happened
  }
  // Bonds B6 (claude-bonds-spec 1.9): only the player has bonds, so only the player's defense gets a vouch. s.bondVouches is
  // carried from the account (spirit/orders.js carryOpts, engine/ledgers.js carryOrder) or lent by a teaching scenario.
  const vouchersFor = (s, accusedId) => (accusedId === "player" && Array.isArray(s.bondVouches) ? s.bondVouches.map((v) => ({ ...v })) : []);
  function countsFor(s, accusedId) {
    const ev = Object.values(s.cls?.lawEvidence?.[accusedId] || {}).flat();
    const test = (s.cls?.testimony || []).filter((w) => w.target === accusedId || w.subject === accusedId);
    const counts = TR.countsFromEvidence(ev, test).slice(0, RULES.maxCounts);
    const prior = accusedId === "player" && s.courtPrior;
    if (prior && counts.length < RULES.maxCounts) counts.push({
      grade: prior.grade, severity: prior.severity, actRound: 0, ledgerAct: prior.real,
      label: `prior: ${prior.kind.replace(/[A-Z]/g, (letter) => " " + letter.toLowerCase())}`,
      courtKey: `prior:${prior.id}`, victimId: null,
    });
    return counts;
  }
  const hasTrait = (u, id) => !!u?.traits?.some((trait) => (trait?.id || trait) === id);
  const hasBench = (u, H) => (H?.hasTrait || hasTrait)(u, "bench");
  function inCourtReach(s, H, a, x, y) {
    return H.dist(s, a.x, a.y, x, y) <= RULES.conveneReach && H.hasSight(s, a.x, a.y, x, y);
  }
  const conveneCost = (s, H, actor) => Math.round(RULES.conveneTempo * (H.heldCostMul?.(s, actor) ?? 1));
  function canConvene(s, H, invokerId, accusedId, paid = false) {
    const a = s.actors[invokerId], t = s.actors[accusedId];
    const standing = (u) => u && !u.defeated && !u.notArrived && !u.fled && !(H.Instinct?.lying(u) ?? u.status?.playingDead);
    if (!standing(a) || !hasBench(a, H)) return "Convene the Court requires The Bench.";
    if (!standing(t) || t.side === a.side || ["bystander", "civilian"].includes(t.side) || H.Tourist?.is(t)) return "Only a standing opponent can be tried.";
    if (s.trial && !s.trial.over) return "Court is already in session.";
    if (s.trialDone) return "One trial per battle: the docket is spent.";
    if (!inCourtReach(s, H, a, t.x, t.y)) return "The accused must be in sight within 5 tiles.";
    if (H.dreamSame && !H.dreamSame(s, a.x, a.y, t.x, t.y)) return "The accused is outside this dream.";
    if (!countsFor(s, accusedId).length) return "No counts to try: no evidence, testimony, or prior names them.";
    if (!paid && a.tempo < conveneCost(s, H, a)) return `Convene the Court needs ${conveneCost(s, H, a)} AP.`;
    return null;
  }
  function aiConvene(s, H, a, accusedId) {
    if (canConvene(s, H, a.id, accusedId)) return false;
    const accused = s.actors[accusedId];
    const carries = (id) => (H.hasTrait || hasTrait)(a, id);
    if (carries("honorable") && accused.lf * 2 < accused.maxLF) return false;
    const counts = countsFor(s, accusedId);
    return (carries("dutiful") && counts.some((c) => c.courtKey?.startsWith("prior:") || c.grade === "proven" || TR.GRADES[c.grade] >= TR.GRADES.witnessed)) ||
      (carries("truthSeeker") && counts.some((c) => ["witnessed", "sworn"].includes(c.grade)));
  }
  function convene(s, H, invokerId, accusedId) {
    const no = canConvene(s, H, invokerId, accusedId, true);
    if (no) return { ok: false, error: no };
    const counts = countsFor(s, accusedId);
    const magistrate = !!H.ClassRuntime?.law?.isMagistrate(s.actors[invokerId]) && counts.some((c) => c.severity >= TR.SEV.serious);
    const t = TR.openTrial({ form: "courtroom", accusedId, prosecutorId: invokerId, seed: s.seed,
      units: fixtures(s), counts, magistrate, vouchers: vouchersFor(s, accusedId) });
    s.trial = { t, invokerId, accusedId, queued: null, queuedDefense: null, contempt: [], over: false,
      foundAtOpen: foundIds(s, accusedId), convened: true };
    H.log(s, { kind: "trial", actor: invokerId, target: accusedId,
      text: `The battle holds while the court hears ${s.actors[accusedId].name} on ${counts.map((c) => c.label).join(", ")}. ${magistrate ? "The Magistrate presides." : "A local judge presides."}` });
    return { ok: true };
  }
  function canInvoke(s, H, invokerId, accusedId) {
    const a = s.actors[invokerId], t = s.actors[accusedId];
    if (!a || a.id !== "player") return "Only the player invokes (driven-only: the AI never starts a trial).";
    if (!t || t.defeated || t.side === "player") return "Only a standing enemy can be tried.";
    if (s.trial && !s.trial.over) return "Court is already in session.";
    if (s.trialDone) return "One trial per battle: the docket is spent.";
    if ((a.rite?.steps || []).length < RULES.riteCost) return "Mock-trial rite needs 1 banked rite step.";
    if (revealedOn(s, invokerId, accusedId) < RULES.evidenceNeeded) return `Present evidence: observe ${t.name} first (${RULES.evidenceNeeded}+ findings).`;
    if (!countsFor(s, accusedId).length) return "No counts to try: no ledger evidence or testimony names them.";
    return null;
  }
  function invoke(s, H, invokerId, accusedId) {
    const no = canInvoke(s, H, invokerId, accusedId);
    if (no) return { ok: false, error: no };
    const a = s.actors[invokerId];
    if (H.Rites) H.Rites.spendSteps(a, RULES.riteCost);
    else a.rite.steps.splice(0, RULES.riteCost);   // standalone court fixtures have no engine ledger
    const t = TR.openTrial({ form: "courtroom", accusedId, prosecutorId: invokerId, seed: s.seed,
      units: fixtures(s), counts: countsFor(s, accusedId) });
    s.trial = { t, invokerId, accusedId, queued: null, contempt: [], over: false, foundAtOpen: foundIds(s, accusedId) };
    H.log(s, { kind: "trial", actor: invokerId, target: accusedId, text: `${a.name} invokes a mock-trial rite: the battle HOLDS. ${t.counts.length} counts against ${s.actors[accusedId].name}. Violence now is contempt.` });
    return { ok: true };
  }
  function queuePlay(s, move) {
    if (!s.trial || s.trial.over) return "No trial in session.";
    if (!TR.legalPlays(s.trial.t, "prosecution").includes(move)) return `Not a legal prosecution play: ${move}.`;
    s.trial.queued = move;
    return null;
  }
  function queueDefense(s, move) {
    if (!s.trial || s.trial.over) return "No trial in session.";
    if (!TR.legalPlays(s.trial.t, "defense").includes(move)) return `Not a legal defense play: ${move}.`;
    s.trial.queuedDefense = move;
    return null;
  }
  function prosecutionPolicy(s) {
    const t = s.trial.t, c = t.counts.find((k) => k.status === "open");
    if (!c) return "end";
    if (c.grade === "unproven") {
      const pool = TR.witnessPool(t, "prosecution", c);
      if (pool.length) return { kind: "evidence", witnessId: pool[0].id };
    }
    return "press";
  }
  function advance(s, H) {
    const tr = s.trial;
    if (!tr || tr.over) return;
    const openC = () => tr.t.counts.find((k) => k.status === "open");
    const withWitness = (side, q) => {   // queued evidence calls the best witness on that side (no picker yet)
      if (q !== "evidence" || !openC()) return q;
      const pool = TR.witnessPool(tr.t, side, openC());
      return pool.length ? { kind: "evidence", witnessId: pool[0].id } : q;
    };
    const pros = withWitness("prosecution", tr.queued || prosecutionPolicy(s)); tr.queued = null;
    TR.play(tr.t, "prosecution", pros);
    if (!tr.t.over) {
      const def = withWitness("defense", tr.queuedDefense || "argue"); tr.queuedDefense = null;
      TR.play(tr.t, "defense", def);   // defense policy: always argue (strikes thin, shifts firm)
    }
    if (tr.t.over) maybeRetrial(s, H);
    if (tr.t.over) applyVerdicts(s, H);
  }
  function maybeRetrial(s, H) {
    const tr = s.trial, guilty = (tr.t.verdicts?.counts || []).filter((v) => v.verdict === "guilty");
    if (!guilty.length || (tr.t.retrialsUsed || 0) >= 2) return;
    // I4c (INVESTIGATE.md 11.3): only newly-found evidence re-opens — a bare reveal is not new evidence. The reveal count still gates the invoke (the evidence floor).
    const fresh = foundIds(s, tr.accusedId).filter((id) => !(tr.foundAtOpen || []).includes(id));
    if (!fresh.length) return;   // genuinely new evidence only
    if (seed01(s.seed, `retrial:${tr.t.retrialsUsed}:${s.round}`) >= 0.5) return;
    if (TR.retry(tr.t, guilty[0].count, `found-${fresh.sort()[0]}`).ok) tr.foundAtOpen.push(...fresh);   // consumed: the same find never re-opens twice (the retry key dedupes too)
  }
  function sealPick(s, H, accused) {
    const ids = H.abilitiesOf ? H.abilitiesOf(accused) : [];
    const counts = s.trial.t.counts;
    const named = counts.map((c) => (c.label || "").split(" ")[0]).find((d) => ids.includes(d));
    const damaging = ids.find((id) => { try { return H.ab?.(id)?.effect === "damage"; } catch { return false; } });
    return named || damaging || ids[0] || null;
  }
  function applyVerdicts(s, H) {
    const tr = s.trial, accused = s.actors[tr.accusedId], invoker = s.actors[tr.invokerId];
    for (const e of tr.t.log) H.log(s, { kind: "trial", text: e.text, why: e.why });
    const sentences = tr.t.verdicts?.sentences || [];
    const applied = new Map();
    let swordDispelled = false;
    for (const v of tr.t.verdicts?.counts || []) {
      if (v.verdict === "innocent") H.log(s, { kind: "trial", actor: tr.accusedId, text: `${v.count}: INNOCENT (${v.how}).` });
      else H.log(s, { kind: "trial", actor: tr.accusedId, text: `${v.count}: GUILTY (${v.how}).` });
    }
    for (const sn of sentences) {
      if (sn.kind === "confiscate" && accused && !accused.defeated) {
        const tech = sealPick(s, H, accused);
        if (tech) { applied.set(sn.count, sn.kind); accused.sealedTechs = [...(accused.sealedTechs || []), tech]; H.log(s, { kind: "trial", actor: tr.accusedId, text: `CONFISCATED: ${tech} is sealed — cast nothing sealed.` }); }
      } else if (sn.kind === "sword" && accused && !accused.defeated) {
        if (H.Bonds?.maxFriends?.(invoker, accused)) {   // the lawyer's heart: bonds dispel the sword
          swordDispelled = true;
          H.log(s, { kind: "trial", actor: tr.invokerId, text: `${invoker.name} DISPELS the Sword: ${accused.name} is spared. Mercy has standing here.` });
          H.submitFoe(s, invoker, accused, "spared by dispel");
        } else if ((accused.reaction ?? 0) > 0) {
          applied.set(sn.count, sn.kind);
          accused.reaction -= 1;
          accused.maxLF = Math.max(1, Math.floor((accused.maxLF || 10) * 0.75)); accused.lf = Math.min(accused.lf, accused.maxLF);
          accused.status.maimed = true;
          H.log(s, { kind: "trial", actor: tr.accusedId, text: `${accused.name} dodges the Sword with a free reaction — and a severed limb (maimed: maxLF now ${accused.maxLF}).` });
        } else {
          applied.set(sn.count, sn.kind);
          accused.lf = 0; accused.defeated = true; accused.defeatedBy = "sword";
          (s.corpses ||= []).push({ id: `corpse-${accused.id}`, of: accused.id, name: accused.name, x: accused.x, y: accused.y, side: accused.side, boss: !!accused.boss, named: !!(H.C?.characters?.[accused.character] && !accused.beast && !accused.monster), round: s.round, killer: "sword", killerName: "The Sword", sacrifice: false }); (s.corpseMade ||= {})[accused.id] = true;   // the full record corpseSweep would make (1.3.456 audit)   // recorded: corpseSweep must not add a second (1.3.455 audit)
          H.log(s, { kind: "trial", actor: tr.accusedId, text: `THE SWORD takes ${accused.name}: no reaction left, no limb to give.` });
        }
      } else if (sn.kind === "minor" && accused) { applied.set(null, sn.kind); accused.tempo = Math.max(0, (accused.tempo || 0) - 25); H.log(s, { kind: "trial", actor: tr.accusedId, text: "Minor sentence: −25 tempo, now." });
      } else if ((sn.kind === "guilty-trait" || sn.kind === "harsh") && accused) { accused.traits = [...(accused.traits || []), "guilty"]; H.log(s, { kind: "trial", actor: tr.accusedId, text: "GUILTY trait (battle-long): future sentences bite harder." });
      } else if (sn.kind === "incarceration" && accused && !accused.defeated) { const called = H.Dispatch?.trigger(s, H, accused.id, { reason: "verdict", by: invoker?.id });   // the police come for the standing sentenced (dispatch.js); loop 1a17c856419
        if (called?.ok) H.log(s, { kind: "trial", actor: tr.accusedId, text: "INCARCERATION: the verdict asks for cuffs, and the call goes out." });
        else { H.log(s, { kind: "trial", actor: tr.accusedId, text: "INCARCERATION: cuffed and led out." }); H.submitFoe(s, invoker, accused, "incarcerated"); }
      } else H.log(s, { kind: "trial", text: sn.text });
    }
    if (tr.arrestTrial) {
      delete accused?.claimTrial;
      const guilty = tr.t.verdicts?.counts?.filter((v) => v.verdict === "guilty") || [];
      if (!guilty.length && accused && !accused.defeated) {   // acquitted: the cuffs come off, the cell door opens
        accused.status.detained = null; delete accused.status.cuffed; accused.acquitted = true;   // the police may not re-arrest them this battle
        H.log(s, { kind: "trial", actor: tr.accusedId, text: `${accused.name} is ACQUITTED: the arrest is voided, the cuffs come off. Free to go.` });
      }
    }
    const recordCounts = (tr.t.verdicts?.counts || []).map((verdict) => {
      const count = tr.t.counts?.find((entry) => entry.id === verdict.count);
      return { source: count?.courtKey, real: count?.ledgerAct !== false, grade: count?.grade || "unproven",
        severity: count?.severity ?? verdict.severity ?? 1, verdict: verdict.verdict,
        sentence: swordDispelled ? null : applied.get(verdict.count) || applied.get(null) || null };
    });
    (s.trialLedger ||= []).push({ accused: tr.accusedId, by: tr.invokerId,
      verdicts: tr.t.verdicts?.counts?.map((v) => `${v.count}:${v.verdict}`) || [], round: s.round, recordCounts, swordDispelled,
      ...(tr.t.vouch ? { vouch: { ...tr.t.vouch } } : {}) });   // Bonds B6: who was asked to vouch and what they said (account.js settleCourt remembers it)
    tr.over = true; s.trialDone = true;
    H.log(s, { kind: "trial", text: "Court adjourns: the battle resumes." });
  }
  // Bonds B6 teaching ("The Friend Who Testified", R-20261123-07): the scenario names one count and court opens on the player
  // before the first round, prosecuted by the first standing foe of the named class (spec.by), with the scenario's lent vouch (engine/factions.js).
  function stageHearing(s, H, spec) {
    if (!spec || typeof spec !== "object" || s.trial || s.trialDone || !s.actors.player) return null;
    const by = Object.values(s.actors).find((u) => u.side !== "player" && !u.defeated && !u.notArrived && !["civilian", "bystander", "neutral", "visitors"].includes(u.side) && (!spec.by || u.character === spec.by));
    if (!by) return null;
    const c = spec.count || {};
    const counts = [{ grade: c.grade || "witnessed", severity: c.severity ?? 1, actRound: 0, ledgerAct: c.real === true, courtKey: `staged:${s.seed}`, label: c.label || "the staged charge" }];
    const t = TR.openTrial({ form: "courtroom", accusedId: "player", prosecutorId: by.id, seed: s.seed, units: fixtures(s), counts, vouchers: vouchersFor(s, "player") });
    s.trial = { t, invokerId: by.id, accusedId: "player", queued: null, queuedDefense: null, contempt: [], over: false, foundAtOpen: [], convened: true, staged: true };
    H.log(s, { kind: "trial", actor: by.id, target: "player", text: `${by.name} calls the court to order before a blow is struck: ${s.actors.player.name} answers ${counts[0].label}.` });
    return s.trial;
  }
  function violenceGate(s, H, a) {
    const tr = s.trial;
    if (!tr || tr.over) return null;
    tr.contempt.push({ who: a.id, round: s.round });
    s.keepRefusal = true;   // the action is refused, but the contempt stands: apply() keeps this state

    tr.t.favor = Math.max(-12, Math.min(12, tr.t.favor + (a.side === s.actors[tr.invokerId]?.side ? 2 : -2)));   // contempt backfires on the brawler's side
    H.log(s, { kind: "trial", actor: a.id, text: `${a.name} brawls during trial: CONTEMPT. The room turns against their side (favor ${tr.t.favor >= 0 ? "+" : ""}${tr.t.favor}). No double-jeopardy shield; hunters will remember.` });
    return `${a.name} cannot fight during trial: contempt of court.`;
  }
  return { RULES, canInvoke, canConvene, convene, aiConvene, conveneCost, inCourtReach, hasBench, countsFor, fixtures, invoke, queuePlay, queueDefense, advance, applyVerdicts, violenceGate, foundIds, vouchersFor, stageHearing };
});
