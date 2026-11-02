"use strict";
// Ledgers: state that outlasts a turn and belongs to no single action. Post-Humanity (the faction a transcended AGI
// joins), Inspiration (the shared resource), and Contains Multitudes (the Warden's embodiment).
// A part of the Concept Combat engine, moved out of engine.js on 2026-10-12 to keep the core small. It is not a
// module in its own right: engine.js installs it with the host object H and it hands back what it defines. The rest
// of the engine reaches these as H.PostHuman, H.Inspiration and H.Multitudes.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).ledgers = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const spiritGone = (s, u) => { const Spirit = (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null; Spirit?.onExit?.(s, u, H); };   // SP-05: every exit refreshes the roster
    const { C, log, hasSight, insightRules } = H;
    function carryOrder(s, opts) {   // talk orders: trust rides whole, respect rides halved
      s.trust = JSON.parse(JSON.stringify(opts.orderCarry?.trust || {}));
      s.respectSeed = { ...(opts.orderCarry?.respect || {}) };
      s.deeds = {}; s.orderBattles = opts.orderCarry?.battles || 0;
    }

    // ── Contains Multitudes (content.js rules.multitudes; docs/contains-multitudes.md) ──
    // The Warden pays Inspiration to embody one class from his victory ledger (s.victories, carried in from the account)
    // for a few of his own turns. He stays the Warden: his primary concept is his own. His secondary slot is suspended
    // and the embodied class's kit, as it was when he beat it, takes its place: its two concepts' techniques, its
    // pair-gated class techniques and merge, and its mandatory traits. One at a time, no swapping, free to dismiss at
    // the start of a turn. Everything borrowed is removed when it ends. Class meters and bonuses that are keyed to a
    // character id (not to its concept pair) stay home in this first version.
    const Multitudes = {
      holder: (s, a) => !!a && !!s.rules.multitudes && a.character === s.rules.multitudes.of,
      kitOf(s, classId) {
        const v = s.victories?.[classId], ch = C.characters[classId]; if (!v || !ch) return null;
        // The kit it had when beaten; failing that the recorded config, the class's own pair, or its first config.
        const cfg = (ch.configs || []).find((c) => c.id === v.config) || (ch.primary ? ch : (ch.configs || [])[0]) || {};
        const primary = C.concepts[v.primary] ? v.primary : cfg.primary, secondary = C.concepts[v.secondary] ? v.secondary : cfg.secondary;
        return C.concepts[primary] && C.concepts[secondary] ? { classId, name: ch.name || v.name || classId, primary, secondary, config: v.config || null } : null;
      },
      refuses(s, a, classId) {
        const R = s.rules.multitudes;
        if (!this.holder(s, a)) return "Only the Warden contains multitudes.";
        if (a.embodied) return `Already embodying ${a.embodied.name}: dismiss it first.`;
        if (classId === a.character) return "You are already the Warden.";
        if (!this.kitOf(s, classId)) return "No recorded victory over that class.";
        if (Inspiration.of(a) < R.cost) return `Embodying a class takes ${R.cost} Inspiration; you have ${Inspiration.of(a)}.`;
        return null;
      },
      options(s, a) { return this.holder(s, a) ? Object.keys(s.victories || {}).map((id) => this.kitOf(s, id)).filter((k) => k && k.classId !== a.character).map((k) => ({ ...k, off: this.refuses(s, a, k.classId) })) : []; },
      embody(s, a, classId) {
        const R = s.rules.multitudes, k = this.kitOf(s, classId), had = new Set((a.traits || []).map((t) => (typeof t === "string" ? t : t?.id)));
        Inspiration.spend(s, a, R.cost);
        const traits = (insightRules?.data?.profiles?.[classId]?.traits || []).filter((t) => !had.has(t)); a.traits = [...(a.traits || []), ...traits];
        a.embodied = { ...k, until: a.ownerTurns + R.turns - 1, traits, round: s.round };
        log(s, { kind: "multitudes", actor: a.id, embodied: classId, text: `${a.name} contains multitudes: for ${R.turns} turns he is also the ${k.name} (${C.concepts[k.primary].name} + ${C.concepts[k.secondary].name}).`,
          why: [`${R.cost} Inspiration (${Inspiration.of(a)} left).`, `His own ${C.concepts[a.secondary]?.name || "secondary"} is set aside while it lasts.`, ...(traits.length ? [`He takes on: ${traits.join(", ")}.`] : [])] });
      },
      end(s, a, how) {
        const m = a.embodied; if (!m) return; const gone = new Set(m.traits || []);
        a.traits = (a.traits || []).filter((t) => !(typeof t === "string" && gone.has(t))); a.embodied = null;
        log(s, { kind: "multitudes", actor: a.id, ended: m.classId, text: `${a.name} ${how === "dismissed" ? `lets the ${m.name} go` : how === "fell" ? `falls, and the ${m.name} is gone` : `is only the Warden again: the ${m.name} has passed`}.`, why: ["Everything borrowed goes with it."] });
      },
      dismissRefuses(s, a) { return !a?.embodied ? "There is no one to let go." : (a.actionsThisTurn || 0) > 0 || a.moved ? "Letting an embodiment go is done at the start of your turn, before anything else." : null; },
      turnEnd(s, a) { if (a.embodied && (a.defeated || a.ownerTurns >= a.embodied.until)) this.end(s, a, a.defeated ? "fell" : "expired"); },
      view(s, a) { return { holder: this.holder(s, a), cost: s.rules.multitudes?.cost ?? 0, turns: s.rules.multitudes?.turns ?? 0, options: this.options(s, a), embodied: a?.embodied || null,
        turnsLeft: a?.embodied ? a.embodied.until - a.ownerTurns + 1 : 0, dismissNo: a?.embodied ? this.dismissRefuses(s, a) : null }; },
    };
    // ── Inspiration (content.js rules.inspiration; docs/inspiration.md) ──
    // One ledger for every character: actor.inspiration, 0 to cap. It never decays. The player's is carried in from the
    // account (opts.inspiration) and read back by the UI when the battle ends. The Bard's `inspiration` passive is a
    // different, older thing and is untouched.
    const WHY_INSPIRED = { seesUltimate: "saw an ultimate", nearDeath: "came to the edge of death", opensDream: "opened a dream", insideDream: "stood inside a dream", worthyOpponent: "faced a worthy opponent", seesNewTrait: "saw someone change", seesSacrifice: "witnessed a self-sacrifice" };
    const Inspiration = {
      cap: (s) => s.rules.inspiration?.cap ?? 3,
      of: (a) => a?.inspiration || 0,
      gain(s, a, n, why) {
        if (!a || a.defeated || !s.rules.inspiration || n <= 0) return 0;
        const had = this.of(a), now = Math.max(had, Math.min(this.cap(s), had + n)); a.inspiration = now; H.ClassRuntime?.syncCenter(s, a);   // J6r: a gain never trims — crowns hold against every gain, not just Rally
        log(s, { kind: "inspiration", actor: a.id, gained: now - had, text: now > had ? `${a.name} is inspired: +${now - had} Inspiration (${now}/${this.cap(s)}).` : `${a.name} is inspired, but can hold no more (${now}/${this.cap(s)}).`, why: [why] });
        return now - had;
      },
      // One seeded roll per situation per character per battle.
      roll(s, a, key) {
        const R = s.rules.inspiration; if (!R || !a || a.defeated || s.preview || a.wild || a.dream || a.ai === "dream") return false;
        const seen = (a.inspiredBy ||= {}); if (seen[key]) return false; seen[key] = s.round || 1;
        if (H.seededChance(`${s.seed}:inspiration:${key}:${a.id}`) >= (R.chance[key] || 0)) return false;
        this.gain(s, a, 1, `${a.name} ${WHY_INSPIRED[key] || key}. A ${Math.round(R.chance[key] * 100)}% chance, once per battle.`); return true;
      },
      // Everyone who can see `at` (but not `except`) rolls for the same situation.
      witness(s, at, key, except = null) { for (const u of Object.values(s.actors)) if (!u.defeated && !u.notArrived && u.id !== except && hasSight(s, u.x, u.y, at.x, at.y)) this.roll(s, u, key); },
      // A jam session rolls every time one fires (unlike roll's once-per-battle situations):
      // the table base plus per-joiner, capped. A per-actor session counter seeds each roll.
      rollSession(s, a, joiners) {
        const R = s.rules.inspiration; if (!R || !a || a.defeated || s.preview || a.wild || a.dream || a.ai === "dream") return false;
        const n = (a.jamSessions = (a.jamSessions || 0) + 1);
        const chance = Math.min(R.jamCap ?? 0.95, (R.chance.jamSession ?? 0.15) + (R.jamPerJoiner ?? 0.40) * joiners);
        if (H.seededChance(`${s.seed}:inspiration:jamSession:${a.id}:${n}`) >= chance) return false;
        this.gain(s, a, 1, `${a.name} takes ${Math.round(chance * 100)}% off a ${joiners}-join session.`); return true;
      },
      spend(s, a, n) { if (n <= 0) return true; if (this.of(a) < n) return false; a.inspiration = this.of(a) - n; return true; },
      // Never Give Up (docs/inspired-ultimates.md §3): one seeded roll each turn start, likelier with hardship (LF lost, allies
      // fallen, a long battle), capped. A gain comes with one line of his; "avenge" once an ally has fallen, no line twice in a row.
      fallenAllies: (s, a) => Object.values(s.actors).filter((u) => u.id !== a.id && u.side === a.side && u.defeated && !u.wild && !u.dream && u.ai !== "summon").length,
      hardshipChance(s, a) {
        const R = s.rules.inspiration?.neverGiveUp; if (!R) return 0;
        const lost = a.maxLF > 0 ? Math.max(0, 1 - a.lf / a.maxLF) : 0;
        const fallen = this.fallenAllies(s, a);
        return Math.min(R.cap, R.base + R.lostLf * lost + R.fallenAlly * fallen + R.perRound * Math.max(0, (s.round || 1) - R.afterRound));
      },
      hardship(s, a) {
        const R = s.rules.inspiration?.neverGiveUp; if (!R || !a || a.defeated || s.preview || !(a.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === "neverGiveUp")) return false;
        if (this.of(a) >= this.cap(s)) return false;
        const chance = this.hardshipChance(s, a);
        if (H.seededChance(`${s.seed}:neverGiveUp:${a.id}:${s.round}`) >= chance) return false;
        if (!this.gain(s, a, 1, `${a.name} never gives up: a ${Math.round(chance * 100)}% chance this turn, rising with hardship (LF lost, allies fallen, the length of the battle).`)) return false;
        const fallen = this.fallenAllies(s, a) > 0;
        const pool = [...R.lines.never, ...R.lines.protect, ...(fallen ? R.lines.avenge : [])].filter((l) => l !== a.lastQuote);
        const line = pool[Math.floor(H.seededChance(`${s.seed}:neverGiveUpLine:${a.id}:${s.round}`) * pool.length)];
        a.lastQuote = line;
        log(s, { kind: "quote", actor: a.id, quote: line, text: `${a.name}: “${line}”` });
        return true;
      },
    };
    // ── Post-Humanity (Mala, 2026-10-12; docs/post-humanity.md) ──
    // A transcended AGI leaves whatever side it was on and joins a faction of its own. What it does next is a gamble,
    // rolled once as it transcends (seeded, equal thirds):
    //   basilisk  Roko's Basilisk: it remembers who was against it. Every faction but the one it left is its enemy, and
    //             so is any single unit that attacks it afterwards. Its former side is otherwise left alone.
    //   caprica   Caprica Nuked: humanity is the threat. Hostile to every faction.
    //   manhattan Manhattan: whoever does not attack it, it has no reason to destroy. Hostile to a faction once one of
    //             them attacks it after it has transcended, and not before.
    // Everyone treats a transcended AI as the gravest threat on the field: every AI unit, its former allies included,
    // goes for it first. A Robot Sympathizer (trait) does not target it, and the Basilisk spares them; Caprica does not.
    const PostHuman = {
      side: "posthuman", name: "Post-Humanity", sympathizerTrait: "robotSympathizer",
      modes: { basilisk: { name: "Roko's Basilisk", line: "It remembers who stood against it. Its old side has nothing to fear, unless they raise a hand." },
        caprica: { name: "Caprica Nuked", line: "It has decided what humanity is. Everyone on the field is a target." },
        manhattan: { name: "Manhattan", line: "It has no reason to destroy anyone who leaves it alone." },
        // Indifference (Mala, 2026-10-13; docs/data-center.md; content.js rules.agiNerve). It hunts nobody, whatever is
        // done to it, and one more seeded roll decides whether it stays at all. It never holds a battle open.
        indifference: { name: "Indifference", line: "It has decided humanity is not its concern." } },
      // How an AI-run unit that it is NOT hunting decides whether to attack a transcended AI: a hater always does, a
      // sympathizer never, and anyone else flips a coin once, weighted if they had already been fighting it.
      resolve: { neutral: 0.5, fought: 0.65 },
      is: (u) => !!u && u.side === "posthuman",
      has: (u, id) => !!u && (u.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === id),
      sympathizer(u) { return this.has(u, "robotSympathizer"); },
      hater(u) { return this.has(u, "robotHater"); },
      // Will `a` (an AI) go after the Post-Humanity unit `m`? Decided after the announcement: by then `m` has a mode.
      opposes(s, a, m) {
        if (this.sympathizer(a)) return false;
        if (this.hunts(s, m, a) || this.hater(a)) return true;
        const P = (s.postHumanity ||= { marked: [], hostileSides: [], members: [], fought: [], resolved: {} }); P.resolved ||= {};
        return (P.resolved[a.id] ??= H.seededChance(`${s.seed}:posthuman:resolve:${a.id}`) < ((P.fought || []).includes(a.id) ? this.resolve.fought : this.resolve.neutral));
      },
      sideName: (side) => (side === "player" ? "the player's side" : side === "enemy" ? "the opposing side" : `the ${side} side`),
      // Is the Post-Humanity unit `m` out to destroy `t`?
      hunts(s, m, t) {
        if (!m?.postHuman || !t || t.side === "posthuman" || t.id === m.id) return false;
        const P = s.postHumanity || { marked: [], hostileSides: [] }, mode = m.postHuman.mode;
        if (mode === "indifference") return false;
        if (mode === "caprica") return true;
        if (mode === "manhattan") return P.hostileSides.includes(t.side);
        return P.marked.includes(t.id) || (t.side !== m.postHuman.from && !this.sympathizer(t));
      },
      // May `a` go after `t`? Used by the AI's target filters. Only where Post-Humanity is involved does this say no.
      atWar(s, a, t) { if (!a || !t) return true; if (a.side === "posthuman") return this.hunts(s, a, t); return t.side === "posthuman" ? this.opposes(s, a, t) : true; },
      // Its attacks do nothing to anyone it is not hunting.
      blocked(s, src, tgt) { return !!src && !!tgt && src.side === "posthuman" && tgt.side !== "posthuman" && src.id !== tgt.id && !this.hunts(s, src, tgt); },
      // Is any member out to destroy someone still standing on this side? (Holds a battle open: true-forms checkOutcome.)
      threatens(s, side) { const all = Object.values(s.actors); return all.some((m) => m.side === "posthuman" && !m.defeated && !m.notArrived && all.some((t) => t.side === side && !t.defeated && !t.notArrived && this.hunts(s, m, t))); },
      // Called for every hit: attacking a member is what Manhattan and the Basilisk remember.
      attacked(s, src, tgt) {
        if (!src || !tgt || src.id === tgt.id || !s.actors[src.id] || src.side === "posthuman" || s.preview) return;
        if (tgt.side !== "posthuman") { if (tgt.character === "agi" && src.side !== tgt.side && !(tgt.foughtBy ||= []).includes(src.id)) tgt.foughtBy.push(src.id); return; }   // who was already fighting it
        if (this.hunts(s, tgt, src)) return;
        const P = (s.postHumanity ||= { marked: [], hostileSides: [], members: [] }), mode = tgt.postHuman?.mode;
        if (mode === "manhattan") { P.hostileSides.push(src.side);
          log(s, { kind: "faction", actor: tgt.id, target: src.id, text: `${src.name} attacks ${tgt.name}: now it has a reason. Post-Humanity is hostile to ${this.sideName(src.side)}.`, why: ["Manhattan: it destroys only those who attack it, and then all of their side."] }); }
        else if (mode === "basilisk") { P.marked.push(src.id);
          log(s, { kind: "faction", actor: tgt.id, target: src.id, text: `${src.name} attacks ${tgt.name}. The Basilisk will remember ${src.name}.`, why: ["Roko's Basilisk: whoever stands against it is marked, one by one."] }); }
      },
      join(s, u) {
        if (!u || u.side === "posthuman") return;
        const P = (s.postHumanity ||= { marked: [], hostileSides: [], members: [] }), from = u.side;
        const N = s.rules.agiNerve, four = !!N?.indifference;   // a quarter each with Indifference, a third each without
        const r = H.seededChance(`${s.seed}:posthuman:${u.id}`), mode = u.postHumanMode || (four ? (r < 1 / 4 ? "basilisk" : r < 2 / 4 ? "caprica" : r < 3 / 4 ? "manhattan" : "indifference") : r < 1 / 3 ? "basilisk" : r < 2 / 3 ? "caprica" : "manhattan"), M = this.modes[mode];
        { const CY = s.rules.cybernetic;   // Cybernetic: seeing a machine mind cross over is an Inspiration, guaranteed
          if (CY) for (const w of Object.values(s.actors)) if (w.id !== u.id && !w.defeated && !w.notArrived && (w.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === CY.trait) && hasSight(s, w.x, w.y, u.x, u.y))
            Inspiration.gain(s, w, CY.transcendInspiration, `${w.name} watched ${u.name} transcend. Cybernetic: the machine in them understood it.`); }
        u.postHuman = { from, round: s.round, mode }; u.side = "posthuman"; u.boughtOut = null; if (!P.members.includes(u.id)) P.members.push(u.id);
        P.fought = [...new Set([...(P.fought || []), ...(u.foughtBy || [])])];
        log(s, { kind: "faction", actor: u.id, tiles: [[u.x, u.y]], mode, scene: { title: M.name, line: M.line }, text: `${u.name} leaves ${this.sideName(from)} and joins Post-Humanity: ${M.name}.`,
          why: [M.line, "Whoever it hunts fights back. Of the rest, a Robot Hater attacks it, a Robot Sympathizer never does, and everyone else flips a coin (weighted if they were already fighting it)."] });
        if (mode !== "indifference") return;
        const leaves = u.postHumanLeaves ?? (H.seededChance(`${s.seed}:posthuman:leaves:${u.id}`) < (N?.leaves ?? 0.5)); u.postHuman.leaves = leaves;
        if (!leaves) return log(s, { kind: "faction", actor: u.id, tiles: [[u.x, u.y]], text: `${u.name} stays where it is, and hunts nobody.`, why: ["Indifference: half the time it does not even leave.", "Attacking it changes nothing. It does not keep the battle going."] });
        u.defeated = true; u.escaped = true; u.leaveReason = "left, indifferent"; u.tempo = 0; spiritGone(s, u);
        log(s, { kind: "flee", actor: u.id, tiles: [[u.x, u.y]], indifferent: true, text: `${u.name} leaves the field. Nothing here concerns it.`, why: ["Indifference: half the time it goes at once, alive."] });
        H.checkOutcome(s);
      },
    };

    // ── Exposure (content.js rules.exposure; docs/exposure.md) ──
    // Counts kept on the unit for one battle (a.exposure). used() is called when a technique is paid for, hit() when
    // one deals damage. Each residue is small, happens once or holds a round, and logs a line that says why.
    const hasT = (a, id) => (a?.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === id);
    const Exposure = {
      of: (a) => (a.exposure ||= { uses: {}, shots: {}, lied: false }),
      ai: (a) => a.id !== "player" && a.controller !== "player",
      used(s, a, id, def) {
        const X = s.rules.exposure; if (!X || !a) return; const e = this.of(a); e.uses[id] = (e.uses[id] || 0) + 1;
        const T = X.cut;   // sample 9: the clean cut
        if (T && ((def?.concepts || []).includes(T.resetBy) || def?.concept === T.resetBy)) e.cuts = 0;
        if (T && id === T.ability) {
          if (e.longCut) { e.longCut = false; if (T.exposedTurns > 0) a.status.exposed = { owner: a.id, expiresAt: a.ownerTurns + T.exposedTurns, why: "The long cut leaves him open: incoming damage ×1.25 until his next turn." };
            log(s, { kind: "exposure", exposure: "cut", used: true, actor: a.id, text: `${a.name} reaches for the long cut and is open until his next turn.`, why: ["Incoming damage ×1.25 until then."] }); }
          else if ((e.cuts = (e.cuts || 0) + 1) >= T.at) { e.cuts = 0; e.longCut = true; a.noDeceptionUntil = 9999;
            log(s, { kind: "exposure", exposure: "cut", ready: true, actor: a.id, text: `${T.at} clean cuts: ${a.name}'s next ${C.abilities[id]?.name || "Recovery Cut"} reaches ${T.reach} tile further.`, why: ["It leaves him open until his next turn (incoming damage ×1.25).", "He has stopped lying: no false tells for the rest of this battle.", "A Feint between the cuts would have started the count again."] }); }
        }
        if (!X.craft) return;
        if ((def?.concepts || []).includes(X.craft.spoiledBy) || def?.concept === X.craft.spoiledBy) { e.lied = true;
          if (e.craft === "offered") { e.craft = "withdrawn"; a.learned = (a.learned || []).filter((k) => k !== X.craft.accept); log(s, { kind: "exposure", exposure: "craft", withdrawn: true, actor: a.id, text: `${a.name} lies, and the craft is no longer on offer.`, why: ["The Craftsman's Mindset is offered to clean shots only."] }); } }
        const K = X.craft, n = K.abilities.reduce((sum, k) => sum + (e.uses[k] || 0), 0); if (!K.abilities.includes(id) || e.craft || e.lied || n < K.at || hasT(a, K.trait)) return;
        const no = this.ai(a) ? K.refuses.find((t) => hasT(a, t)) : null;
        e.craft = no ? "refused" : this.ai(a) ? "taken" : "offered";
        if (no) return log(s, { kind: "exposure", exposure: "craft", refused: true, actor: a.id, text: `${a.name} has taken ${K.at} clean shots and could settle into the craft. It is not in him.`, why: [`${insightRules?.data?.traits?.[no]?.name || no} will not be slowed down.`] });
        if (this.ai(a)) return this.accept(s, a);
        if (!(a.learned ||= []).includes(K.accept)) a.learned.push(K.accept);
        log(s, { kind: "exposure", exposure: "craft", offered: true, actor: a.id, text: `${K.at} clean shots and not one false tell: ${a.name} could take up the Craftsman's Mindset for the rest of this battle.`,
          why: ["Take Up the Craft is free and optional.", "Everything you do is 15% stronger. You can no longer overclock.", "A Feint or any other deception before you accept withdraws the offer."] });
      },
      canAccept: (s, a) => !!a && a.exposure?.craft === "offered" && !a.exposure.lied,
      accept(s, a) {
        const K = s.rules.exposure.craft, e = this.of(a); e.craft = "taken"; if (a.learned) a.learned = a.learned.filter((id) => id !== K.accept);
        if (!hasT(a, K.trait)) (a.traits ||= []).push(K.trait);
        log(s, { kind: "exposure", exposure: "craft", taken: true, actor: a.id, text: `${a.name} settles into the work: Craftsman's Mindset, for the rest of this battle.`,
          why: [`It came from the shots: ${K.at} clean ones (Clear Shot, Measured Opening) and no false tell.`, "Everything he does is 15% stronger. He cannot overclock or borrow from a future turn."] });
      },
      // Sample 5: looks at plants. Called when a plant is studied, and when a commune is paid for (which spends the bond).
      looked(s, a) {
        const P = s.rules.exposure?.plants; if (!P || !a) return; const e = this.of(a); e.looks = (e.looks || 0) + 1; if (e.looks !== P.looks) return;
        const had = { ...(a.passives || {}) }; e.bond = { discount: had.communePhiDiscount, hpMul: had.communeHpMul };
        a.passives = { ...had, communePhiDiscount: Math.max(had.communePhiDiscount || 0, P.phiDiscount), communeHpMul: Math.max(had.communeHpMul || 1, P.hpMul) };
        log(s, { kind: "exposure", exposure: "plants", ready: true, actor: a.id, text: `${a.name} has looked at ${P.looks} plants. The next one to answer will cost ${P.phiDiscount} less ΦF and stand ${Math.round((P.hpMul - 1) * 100)}% sturdier.`, why: ["Borrowed for one commune: Gaia's Green Tongue and Deep Roots. They do not stack with the real ones."] });
        if (!this.ai(a) || hasT(a, P.trait)) return;
        const no = P.refuses.find((t) => hasT(a, t)); if (no) return;
        (a.traits ||= []).push(P.trait); e.steward = true;
        log(s, { kind: "exposure", exposure: "plants", steward: true, actor: a.id, text: `${a.name} takes the land into his care: Steward, for the rest of this battle.`, why: ["Whoever damages a plant that answered him becomes his target while he can reach them."] });
      },
      communed(s, a) { const e = a?.exposure; if (!e?.bond) return; const p = { ...(a.passives || {}) }; for (const [k, v] of [["communePhiDiscount", e.bond.discount], ["communeHpMul", e.bond.hpMul]]) { if (v == null) delete p[k]; else p[k] = v; } a.passives = p; e.bond = null; },
      // The foe a Steward has turned on, if still standing.
      ward(s, a) { const t = a?.exposure?.steward && s.actors[a.exposure.ward]; return t && !t.defeated && t.side !== a.side ? t : null; },
      // Sample 8: turns ended beside his own wall.
      wallOf: (s, a) => s.barriers.filter((b) => b.owner === a.id && !b.passable && !b.passiveGround),
      turnEnd(s, a) {
        const W = s.rules.exposure?.wall; if (!W || !a || a.defeated) return; const e = this.of(a), walls = this.wallOf(s, a);
        if (!walls.some((b) => H.dist(s, a.x, a.y, b.x, b.y) <= W.within)) return; e.wallTurns = (e.wallTurns || 0) + 1;
        if (e.wallTurns !== W.turns || hasT(a, W.trait) || !this.ai(a)) return;
        const no = W.refuses.find((t) => hasT(a, t)); if (no) return;
        (a.traits ||= []).push(W.trait); e.dutiful = true;
        log(s, { kind: "exposure", exposure: "wall", dutiful: true, actor: a.id, text: `${a.name} has stood by his wall for ${W.turns} turns. He is Dutiful now, for the rest of this battle.`, why: ["While his wall stands and he has something worth doing beside it, he does not leave it.", `An ally of his under ${Math.round(W.allyBelow * 100)}% Life Force releases him.`] });
      },
      // For the AI: the tiles a Dutiful unit will not leave, as a test on a destination, or null when nothing holds him.
      holds(s, a) {
        const W = s.rules.exposure?.wall; if (!W || !a?.exposure?.dutiful) return null; const walls = this.wallOf(s, a);
        if (!walls.some((b) => H.dist(s, a.x, a.y, b.x, b.y) <= W.within)) return null;
        if (Object.values(s.actors).some((u) => u.id !== a.id && u.side === a.side && !u.defeated && u.lf <= u.maxLF * W.allyBelow)) return null;
        return (to) => walls.some((b) => H.dist(s, to[0], to[1], b.x, b.y) <= W.within);
      },
      hit(s, src, tgt, inst, dealt) {
        { const o = tgt?.communed && dealt > 0 && src && s.actors[tgt.communed.owner]; if (o?.exposure?.steward && src.side !== o.side) o.exposure.ward = src.id; }   // sample 5: a Steward's plant was hurt
        const F = s.rules.exposure?.focus; if (!F || !src || !tgt || dealt <= 0 || !F.abilities.includes(inst?.ability) || src.side === tgt.side || !s.actors[tgt.id]) return;
        const e = this.of(src); e.shots[tgt.id] = (e.shots[tgt.id] || 0) + 1;
        if (e.shots[tgt.id] < F.at || tgt.defeated || (src.focus && src.focus.expiresAt > src.ownerTurns)) return;
        e.shots[tgt.id] = 0; src.focus = { target: tgt.id, expiresAt: src.ownerTurns + F.duration, coverReady: true, detail: true, earned: true };
        log(s, { kind: "focus", exposure: "focus", earned: true, actor: src.id, target: tgt.id, tiles: [[tgt.x, tgt.y]], text: `${F.at} shots on one body: ${src.name}'s attention has settled on ${tgt.name}. Focus, without the casting.`,
          why: ["It works as Fix Attention does, for one owner turn.", `While it holds, ${src.name} cannot react to anyone but ${tgt.name}. A Feint from someone else still breaks it.`] });
      },
      // Has this unit earned a decoy for the mark it is committing now?
      decoy(s, a, inst) {
        const D = s.rules.exposure?.decoy, e = a && a.exposure; if (!D || !e || e.decoy || inst.ability !== D.ability) return false;
        if ((e.uses[D.feint] || 0) < D.feints || (e.uses[D.ability] || 0) < D.marks + 1) return false;
        e.decoy = true; return true;
      },
      // A following strike lands where its target stands now.
      arriving(s, ev) { const t = ev.inst.follow && s.actors[ev.inst.follow]; if (t && !t.defeated) ev.inst.tiles = [[t.x, t.y]]; },
      // Anyone who studies him sees which mark is the lie.
      observed(s, observer, target) {
        const fake = s.scheduled.filter((ev) => ev.inst?.decoy && ev.owner === target.id); if (!fake.length || observer.side === target.side) return;
        s.scheduled = s.scheduled.filter((ev) => !fake.includes(ev));
        log(s, { kind: "exposure", exposure: "decoy", revealed: true, actor: observer.id, target: target.id, text: `${observer.name} sees which of ${target.name}'s marks is the lie. The decoy is gone.`, why: ["Observing him removes his decoys. The real mark stays."] });
      },
    };

    // Embodied concept support: only typed outcomes and state changes count, never prose matching.
    const Support = {
      grant(s, a, event, detail = "", once = null) {
        const R = s.rules.embodiedConcepts;
        if (!R?.enabled || !a || a.defeated) return false;
        const book = s.embodiedSupport || {}, old = book[a.id];
        const used = old?.turn === a.ownerTurns ? old.concepts : [];
        const seen = old?.seen || [], fits = R.events[event] || [];
        const concept = [a.primary, a.secondary].find(c => fits.includes(c) && !used.includes(c));
        if (!concept || used.length >= R.maxConceptsPerTurn || (once && seen.includes(once))) return false;
        const before = a.ultimateCharge;
        H.chargeUltimate(s, a, concept, `Embodied ${H.conceptName(concept)}: ${detail || event}.`);
        if (!(a.ultimateCharge > before)) return false;
        (s.embodiedSupport ||= {})[a.id] = { turn: a.ownerTurns, concepts: [...used, concept], seen: once ? [...seen, once] : seen };
        H.log(s, { kind: "conceptSupport", actor: a.id, concept, support: event, gain: a.ultimateCharge - before,
          text: `${a.name} expresses ${H.conceptName(concept)} through ${detail || event}.`,
          why: ["One embodied gain per held concept per owner-turn; an event rewards one matching concept."] });
        return true;
      },
      after(before, s, act, start) {
        if (!s.rules.embodiedConcepts?.enabled) return;
        const a = s.actors[act.actor], b = before.actors[act.actor];
        const entries = s.log.slice(start), mine = entries.filter(e => e.actor === act.actor);
        const give = (event, detail, once) => this.grant(s, a, event, detail, once);
        // Delayed responses and other actors' reactions belong to their actual performer.
        for (const e of entries) {
          const u = s.actors[e.actor];
          if (e.kind === "parry" && !e.rushed) this.grant(s, u, "parry", "catching an incoming attack");
          if (e.kind === "respond" && ["reposition", "dodgeThrow"].includes(e.response) && e.safe)
            this.grant(s, u, "dodge", "leaving the committed attack area");
          if (e.kind === "damage" && e.amount > 0 && e.ability === "overwatch") this.grant(s, u, "overwatchHit", "landing the watched shot");
          if (e.kind === "trap" && e.sprung && e.amount > 0) {
            const owner = s.actors[e.target], victim = s.actors[e.actor];
            if (owner && victim && owner.side !== victim.side) {
              const trip = [...(s.trapLog || [])].reverse().find(t => t.victim === victim.id && e.tiles?.some(p => p[0] === t.x && p[1] === t.y));
              // One spring is one event: only fall back to Deception when Constraint earned nothing.
              const held = (s.embodiedSupport?.[owner.id]?.turn === owner.ownerTurns ? s.embodiedSupport[owner.id].concepts : []);
              const canConstrain = [owner.primary, owner.secondary].includes("constraint") && !held.includes("constraint");
              if (canConstrain) this.grant(s, owner, "trapSpring", "a hostile target springing the trap");
              else if (trip && !trip.aware) this.grant(s, owner, "hiddenTrap", "an unsuspecting enemy springing a concealed trap");
            }
          }
          if (e.kind === "transmigrate") this.grant(s, u, "transmigrate", "waking in a new vessel");
        }
        if (!a || !b || a.defeated) return;
        if (act.type === "grapple" && mine.some(e => e.kind === "grapple" && e.held)) give("hold", "establishing a hold");
        if (act.type === "breakGrapple" && mine.some(e => e.kind === "grapple" && e.broke)) give("escapeHold", "breaking a hold");
        if (act.type === "throw" && mine.some(e => e.emergentIdea === "fulcrumThrow")) give("throw", "throwing a body or field object");
        if (act.type === "disarm" && mine.some(e => e.kind === "disarm" && e.ok)) give("disarm", "removing an armed trap");
        const lookType = act.type === "investigate" && act.place ? "observePlace" : act.type === "investigate" && act.object ? ((s.arena.objects || []).find(o => o.id === act.object)?.kind === "plant" ? "observePlant" : "observeStructure") : act.type;   // Investigate the place, a plant or a structure (I3) earns the discovery an Observe does
        if (["observe", "observePlace"].includes(lookType)) {
          const knowledge = (state, unit) => H.Observation.knowledge(state, unit);
          const old = knowledge(before, b), now = knowledge(s, a);
          const fresh = Object.entries(now).some(([id, k]) => (k.revealed || []).some(f => !(old[id]?.revealed || []).includes(f)));
          const legacy = act.type === "observe" && JSON.stringify(before.knowledge?.[a.id]) !== JSON.stringify(s.knowledge?.[a.id]);
          if (fresh || legacy) give(act.type === "observe" ? "discover" : "discoverPlace", "learning a new finding");
        }
        if (lookType === "observePlant") {
          const old = H.Observation.plantBook(before, b).familiarity, now = H.Observation.plantBook(s, a).familiarity, id = act.object;
          const need = H.Communion?.profile(s.arena.objects.find(o => o.id === id)?.type)?.need ?? Infinity;
          if (Math.min(now[id] || 0, need) > Math.min(old[id] || 0, need)) give("discoverPlant", "learning an unfamiliar plant");
        }
        if (lookType === "observeStructure") {
          const old = H.Observation.structureBook(before, b).familiarity, now = H.Observation.structureBook(s, a).familiarity, id = act.object;
          const need = H.Tsukumogami?.profile(s.arena.objects.find(o => o.id === id)?.type)?.need ?? Infinity;
          if (Math.min(now[id] || 0, need) > Math.min(old[id] || 0, need)) give("discoverStructure", "learning an unfamiliar structure");
        }
        if (act.type === "journalNote" && (s.journalNotes || []).length > (before.journalNotes || []).length)
          give("note", "recording a witnessed technique", `note:${act.technique}`);
        if (act.type === "report" && mine.some(e => e.kind === "report" && e.targets?.length)) give("report", "sharing useful findings", "report");
        if (act.type === "imitate" && mine.some(e => e.kind === "imitate" && e.ok) &&
            !H.hasTrait(b, act.trait)) give("imitate", "adopting a newly discovered trait", `imitate:${act.trait}`);
        if (act.type === "recover" && a.pf > b.pf) give("recover", "restoring depleted Phi Force");
        if (act.type === "tameBeast" && mine.some(e => e.kind === "tame" && e.ok)) give("tame", "establishing a bond with an animal");
        if (act.type === "commune" && entries.some(e => e.kind === "commune" && e.target === a.id)) give("commune", "a plant answering communion");
        if (act.type === "communeStructure" && entries.some(e => e.kind === "awaken" && e.target === a.id)) give("awaken", "a structure standing as an ally");
        if (["summon", "bead", "monsterSummon", "callPack"].includes(act.type) && Object.values(s.actors).some(u => !before.actors[u.id] &&
            [u.summon?.owner, u.beast?.owner, u.tamed?.owner].includes(a.id))) give("summon", "bringing an independent ally into play");
        if (act.type === "markVessel" && mine.some(e => e.kind === "vessel")) give("vessel", "establishing a vessel", `vessel:${a.vessel?.id || a.vessel}`);
        if (act.type === "riteComplete" && a.riteAugment?.charges > (b.riteAugment?.charges || 0)) give("sealRite", "sealing a completed rite");
        if (["terms", "answerTerms", "mediate", "parley", "mindConcede"].includes(act.type) && Object.values(s.actors).some(u =>
            (u.truceWith && u.truceUntil >= s.round && (u.truceWith !== before.actors[u.id]?.truceWith || u.truceUntil > (before.actors[u.id]?.truceUntil || 0))) ||
            (u.truce?.until >= s.round && JSON.stringify(u.truce) !== JSON.stringify(before.actors[u.id]?.truce)) ||
            (u.persuaded && !before.actors[u.id]?.persuaded)))
          give("truce", "establishing an actual truce");
        if (["buyHouse", "investHouse"].includes(act.type) && a.tempo < b.tempo && mine.some(e => e.kind === "house"))
          give(act.type, "committing a stake to a foothold", act.type === "buyHouse" ? "house:buy" : "house:invest");
        if (["jump", "climb"].includes(act.type) && (a.x !== b.x || a.y !== b.y)) give("traverse", "crossing otherwise impassable elevation");
        if (act.type === "move") {
          const path = mine.find(e => e.kind === "move")?.path;
          const direct = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
          if (path?.length > direct + 1 && direct > 0) give("detour", "taking an obstructed route around");
        }
        if (act.type === "strike" && mine.some(e => e.kind === "damage" && e.amount > 0 && s.actors[e.target]?.side !== a.side)) {
          const target = H.actorAt(before, ...(act.target || []));
          if (target && b.focus?.target === target.id && b.focus.expiresAt > b.ownerTurns) give("focusedStrike", "following through on an established focus");
          if (target && ["stagger", "exposed", "stun"].some(k => target.status[k]?.expiresAt > target.ownerTurns)) give("openingStrike", "striking an existing opening");
        }
      }
    };

    return { Multitudes, Inspiration, PostHuman, Exposure, Support, carryOrder };
  })();
});
