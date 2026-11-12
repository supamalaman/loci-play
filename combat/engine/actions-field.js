"use strict";
// Actions, the field family: touristPhoto, touristExit, touristDepart, callCut, placeTrap, disarm, plantOrgonite, mendVerb, tendVerb, salvageVerb, chooseVerse, discardVerse, dismissUlaula.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsField = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { Director, Performers, Traps, Vows, ab, actorAt, checkOutcome, classH, dist, hasSight, hasTrait, inside, log, spendTempo, tileAt } = H;
    const { OG, Orders, VerbTech, apply, targeting } = K;
    const family = {
      touristPhoto(s,a,act) { return H.Tourist.photo(s,a,act,H.touristH()); },
      touristExit(s,a,act) { return H.Tourist.exit(s,a,act,H.touristH()); },
      touristDepart(s,a) { return H.Tourist.depart(s,a); },
      callCut(s, a) { return Director ? Director.callCut(s, a, H) : "No camera." },   // the Director's early wrap: his own out-of-turn action, always a dud
      placeTrap(s, a, act) {   // C9: hide a trap on your own tile or an adjacent open one
        if (!Traps) return "Traps are unavailable.";
        if (!Traps.canSet(a)) return "Only a trapper sets traps: the Ninja, the Thief, the Ranger, the Surveyor, the Soldier, or anyone Tinkerer.";
        if (Vows) { const no = Vows.refuses(s, a, "placeTrap"); if (no) return no; }
        const [tx, ty] = act.at || [a.x, a.y];
        if (!inside(s, tx, ty) || dist(s, a.x, a.y, tx, ty) > 1) return "Set a trap on your own tile or one beside you.";
        if (tileAt(s, tx, ty).blocksMove) return "A trap needs ground someone can walk onto.";
        const there = actorAt(s, tx, ty); if (there && there.id !== a.id) return "Someone is standing there.";
        if (Traps.live(s.traps, tx, ty).length) return "A trap is already hidden there.";
        const spendError = spendTempo(s, a, Traps.rules.placeAp, "Set a trap"); if (spendError) return spendError;
        const seen = Object.values(s.actors).some(u => !u.defeated && u.side !== a.side && hasSight(s, u.x, u.y, tx, ty));
        const trap = Traps.make({ x: tx, y: ty, owner: a.id, ownerSide: a.side, seen });
        (s.traps ||= []).push(trap); (s.trapLog ||= []).push({ placer: a.id, x: tx, y: ty, hidden: trap.hidden });
        // Only those who could see it being set are told where it is.
        log(s, { kind: "trap", actor: a.id, tiles: seen ? [[tx, ty]] : [], placed: true, hidden: trap.hidden, text: seen ? `${a.name} sets a trap at (${tx},${ty}) in plain sight.` : `${a.name} sets a trap, unseen.`,
          why: [seen ? "An enemy could see the tile: the trap is only 30% hidden." : "No enemy could see the tile: the trap is 90% hidden."] });
      },
      disarm(s, a, act) {   // C14: 50-100 AP (overclock debt allowed), at least 50 in hand, adjacent, and spotted
        if (!Traps) return "Traps are unavailable.";
        const D = Traps.rules.disarm, [tx, ty] = act.at || [];
        if ((a.tempo ?? 0) < D.minAp) return `Disarming needs at least ${D.minAp} action points.`;
        const tp = Traps.live(s.traps, tx, ty).find(t => t.ownerSide !== a.side);
        if (!tp || !Traps.known(a, tp)) return "You have not spotted a trap there.";
        if (Math.max(Math.abs(a.x - tx), Math.abs(a.y - ty)) > 1) return "Get beside the trap to disarm it.";
        s.disarmN = (s.disarmN || 0) + 1;
        const tinkerer = hasTrait(a, D.trait), attempt = Traps.disarmAttempt(s.seed, a.id, s.disarmN, tinkerer), tempoBefore = a.tempo;
        const spendError = spendTempo(s, a, attempt.cost, "Disarm", true); if (spendError) { s.disarmN -= 1; return spendError; }
        (s.disarmLog ||= []).push({ actor: a.id, x: tx, y: ty, cost: attempt.cost, tempoBefore, debt: Math.max(0, attempt.cost - tempoBefore), tinkerer, ok: attempt.ok });
        if (attempt.ok) tp.spent = tp.disarmed = true;
        log(s, { kind: "disarm", actor: a.id, tiles: [[tx, ty]], ok: attempt.ok, text: attempt.ok ? `${a.name} disarms the trap at (${tx},${ty}).` : `${a.name} fails to disarm the trap at (${tx},${ty}); it stays armed.`,
          why: [`${Math.round(attempt.chance * 100)}% chance${tinkerer ? " (Tinkerer +30%)" : ""}; it took ${attempt.cost} action points.`] });
      },
      plantOrgonite(s, a, act) {
        const O = OG(); if (!O) return "Orgonite is unavailable.";
        const at = act.at || [];
        const no = O.plantError(s, a, at); if (no) return no;
        const spend = spendTempo(s, a, O.RULES.ap, O.COPY.plant); if (spend) return spend;
        s.orgonite = s.orgonite || { player: 0, enemy: 0 };
        s.orgonite[a.side] = Math.max(0, (s.orgonite[a.side] || 0) - 1);
        s.arena.objects.push(O.makeTower(s, a, at[0], at[1]));
        log(s, { kind: "build", actor: a.id, tiles: [at], text: `${a.name} plants an ${O.RULES.name} at (${at[0]},${at[1]}) (${O.RULES.hp} HP).`, why: [O.COPY.help] });
      },
      mendVerb(s, a, act) {   // verb 10 MEND: contact care for the living (+8 LF, downgrades one injury)
        const VT = VerbTech(); if (!VT) return "No verbs today.";
        const t = s.actors[act.target];
        if ((a.tempo || 0) < VT.RULES.mendAp || (a.pf || 0) < VT.RULES.mendPhi) return `MEND needs ${VT.RULES.mendAp} tempo + ${VT.RULES.mendPhi} ΦF.`;
        const zones = t && !t.defeated ? H.Injury?.woundedZones(t) || [] : [];
        if (act.zone && (!["head", "arms", "legs"].includes(act.zone) || !zones.includes(act.zone))) return "MEND that zone? It holds no wound.";
        a.tempo -= VT.RULES.mendAp; a.pf -= VT.RULES.mendPhi;
        const low = !!t && (t.lf ?? 0) < (t.maxLF || 100) * 0.25;
        const r = VT.mend(s, a, t, zones.length > 0);
        if (!r.ok) { a.tempo += VT.RULES.mendAp; a.pf += VT.RULES.mendPhi; return r.error; }
        log(s, { kind: "verb", verb: 10, actor: a.id, target: t.id, text: r.text });
        if (low && !s.preview) Orders()?.onSave(s, a.id, H);   // admiration: a save (MEND landing under 25%)
        if (zones.length) H.Injury?.downgrade(s, a, t, act.zone);
      },
      tendVerb(s, a, act) {   // verb 9 TEND: raise a downed ally at 1 LF, or steady a standing one's bleeding — once each
        const VT = VerbTech(); if (!VT) return "No verbs today.";
        const t = s.actors[act.target];
        if ((a.tempo || 0) < VT.RULES.tendAp || (a.pf || 0) < VT.RULES.tendPhi) return `TEND needs ${VT.RULES.tendAp} tempo + ${VT.RULES.tendPhi} ΦF.`;
        a.tempo -= VT.RULES.tendAp; a.pf -= VT.RULES.tendPhi;
        const fail = (error) => { a.tempo += VT.RULES.tendAp; a.pf += VT.RULES.tendPhi; return error; };
        const r = VT.tend(s, a, t);
        if (r.ok) { log(s, { kind: "verb", verb: 9, actor: a.id, target: t.id, text: r.text }); if (!s.preview) Orders()?.onSave(s, a.id, H); checkOutcome(s); return; }   // admiration: a raise is a save
        if (t && !t.defeated && t.side === a.side && t.id !== a.id) {   // stabilize-the-standing
          const zones = H.Injury?.woundedZones(t) || [];
          if (!zones.length) return fail(r.error);
          if ((s.tendRaised || {})[t.id]) return fail(`${t.name} has been tended once already this battle.`);
          if (Math.max(Math.abs(t.x - a.x), Math.abs(t.y - a.y)) > 1) return fail(`${t.name} is too far to reach.`);
          if (!zones.some((z) => !t.injuries[z].s)) return fail(`${t.name}'s wounds are already steady.`);
          H.Injury?.stabilize(s, a, t);
          return;
        }
        return fail(r.error);
      },
      salvageVerb(s, a, act) {   // verb 14 SALVAGE: strip an adjacent corpse (+6 Seeds; parts when the vessel economy lands — loop:1a17ce1c4d1)
        const VT = VerbTech(); if (!VT) return "No verbs today.";
        if ((a.tempo || 0) < VT.RULES.salvageAp) return `SALVAGE needs ${VT.RULES.salvageAp} tempo.`;
        a.tempo -= VT.RULES.salvageAp;
        const r = VT.salvage(s, a, act.target);
        if (!r.ok) { a.tempo += VT.RULES.salvageAp; return r.error; }
        log(s, { kind: "verb", verb: 14, actor: a.id, target: r.corpse, text: r.text });
      },
      chooseVerse(s,a,act){return Performers.choose(s,a,act.ability);},
      discardVerse(s,a,act){
        const v=a.status?.verse;if(!v)return "No verse is held.";
        if(v.kind==="freestyle"&&a.character==="rapper"&&!a.status.wordplayUsed){a.status.wordplayUsed=true;const ids=classH().borrowPool(s,a,false).filter(id=>id!==v.id);if(ids.length){v.id=Performers.draw(s,a,ids,1)[0];v.choices=[v.id];v.mustTake=true;log(s,{kind:"performance",actor:a.id,text:`Wordplay redraws ${ab(v.id).name}; the one redraw is spent.`});return;}}
        if(v.mustTake&&targeting(s,a.id,v.id).legal.some(q=>apply(s,{type:"ability",actor:a.id,ability:v.id,target:q.at},{preview:true}).ok))return "Wordplay's second draw must be delivered.";
        if(v.freeAp){a.pf=Math.min(a.maxPF,a.pf+ab("freestyle").cost*.5);log(s,{kind:"performance",actor:a.id,text:"The undelivered line returns half its ΦF; the action remains spent."});}
        delete a.status.verse;log(s,{kind:"performance",actor:a.id,text:"The held verse is discarded."});
      },
      dismissUlaula(s,a){   // R6 (Mala, 2026-10-22): the staged free dismiss. Free: no tempo spent.
        const bm = a.birdMountain;
        if (!bm?.red) return "ʻUlaʻula is not lit.";
        if (bm.vows?.neverQuench) return "Sworn: Never-Quench cannot be dismissed.";
        bm.red = null;
        log(s, { kind: "martial", actor: a.id, text: `${a.name} lets the red go out.` });
      },
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-field.js)`);
    Object.assign(K.handlers, family);
  })();
});
