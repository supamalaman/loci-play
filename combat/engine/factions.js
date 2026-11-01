"use strict";
// Hero/villain factions (Mala, 2026-10-21; muse/factions/SPEC.md).
// Heroes only fight villains; villains fight everyone but hate heroes more
// (hate scores targets, it doesn't gate them).
// A part of the Concept Combat engine: engine.js installs it with the host object H
// and merges what it hands back. New file, not split out: the faction attitudes.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).factions = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { log } = H;
    const Bonds = typeof module === "object" && module.exports ? require("../bonds/bonds.js") : (typeof self !== "undefined" ? self : this).ConceptCombatBonds;
    const Factions = {
      isHero: (u) => !!u && u.side === "hero",
      isVillain: (u) => !!u && u.side === "villain",
      hostileTo(s) { return s.factionHostile?.heroTo || []; },
      // Crew feuds (docs/ramayana-faction.md, Mala 2026-10-23): units whose crews are paired in rules.factions.feuds are always at war,
      // whatever side either stands on, and each prefers the other house as a target. A crew is the character's `subfaction`.
      crewOf: (u) => H.C.characters?.[u?.character]?.subfaction || null,
      feudBetween(rules, crewA, crewB) { return !!crewA && !!crewB && (rules?.factions?.feuds || []).some(([x, y]) => (x === crewA && y === crewB) || (x === crewB && y === crewA)); },
      feud(s, a, t) { return !!a && !!t && Factions.feudBetween(s.rules, Factions.crewOf(a), Factions.crewOf(t)); },
      // Builders (Muse's review, docs/ramayana-faction.md §2a): every builder asks the same question before seating someone.
      // fits(rules, character, sideCharacters): may this character stand on a side with these characters?
      crewOfChar: (id) => H.C.characters?.[id]?.subfaction || null,
      fits(rules, id, side) { return !(side || []).some((o) => Factions.feudBetween(rules, Factions.crewOfChar(id), Factions.crewOfChar(o))); },
      // The random roster's first `n` become one side: reorder it so they can stand together. A character who cannot is moved
      // later, in order, so nothing else moves; with no feuding crews in the roster the order is untouched.
      feudSafe(rules, roster, n = 4) {
        const head = [], rest = [];
        for (const id of roster) (head.length < n && Factions.fits(rules, id, head) ? head : rest).push(id);
        roster.splice(0, roster.length, ...head, ...rest);
        return roster;
      },
      // A battle cannot seat two feuding crews on one side. Returns the first offending pair of characters, or null.
      feudOnOneSide(rules, members) {
        for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
          const a = members[i], b = members[j];
          if (a.side === b.side && Factions.feudBetween(rules, H.C.characters?.[a.character]?.subfaction, H.C.characters?.[b.character]?.subfaction)) return [a.character, b.character];
        }
        return null;
      },
      atWar(s, a, t) {
        if (!a || !t) return true;
        if (Factions.feud(s, a, t)) return true;
        if (a.side === "hero") return t.side === "villain" || Factions.hostileTo(s).includes(t.side);
        return true;
      },
      blocked(s, src, tgt) {
        if (Factions.feud(s, src, tgt)) return false;
        return !!src && !!tgt && src.id !== tgt.id && src.side === "hero" && tgt.side !== "villain" && !Factions.hostileTo(s).includes(tgt.side);
      },
      hate(s, a, t) {
        const base = Factions.feud(s, a, t) ? s.rules.factions?.feudHate ?? s.rules.factions?.villainHate ?? 2   // its own number (Muse F5), defaulting to the villains' weight
          : a?.side === "villain" && t?.side === "hero" ? s.rules.factions?.villainHate ?? 2 : 1;
        return base * Factions.rivalry(s, a, t);
      },
      // Rivalrous (Mala, 2026-10-24): a character may name rivals (`rivals: [characterId]`); a rivalrous unit's hostility toward a
      // named rival on the field is multiplied by rules.factions.rivalHate. Surpanakha's rival is Sita.
      rivalOf: (a, t) => !!t && (H.C.characters?.[a?.character]?.rivals || []).includes(t.character),
      // Valence (Mala, 2026-10-20 "attachment and grief", muse/ritual-burial/SPEC.md; first used by counsel, 2026-10-24): how
      // strongly a unit is attached to another, toward (+) or against (-). Only the strength, never a relationship label. Shared
      // by everyone; the Love concept will do more with it. Sources: a max-friendship bond +3, authored `attachments`
      // ({ characterId: n } on the character), the same crew +1, each shared trait +1, each trait pair that synergizes +1 or
      // counters -1 (insight traitDynamics), a feud -2, a named rival -2. Clamped to [-5, 5].
      valence(s, a, b) {
        if (!a || !b || a.id === b.id) return 0;
        const ids = (u) => [...new Set((u.traits || []).map((x) => x?.id ?? x))], ta = ids(a), tb = ids(b);
        let v = (Bonds?.maxFriends?.(a, b) ? 3 : 0) + (H.C.characters?.[a.character]?.attachments?.[b.character] || 0);
        if (Factions.crewOf(a) && Factions.crewOf(a) === Factions.crewOf(b)) v += 1;
        v += ta.filter((t) => tb.includes(t)).length;
        for (const t of ta) { const d = H.insightRules?.dynamicsOf?.(t); if (d) for (const u of tb) v += (d.synergies.includes(u) ? 1 : 0) - (d.counters.includes(u) ? 1 : 0); }
        if (Factions.feud(s, a, b)) v -= 2;
        if (Factions.rivalOf(a, b)) v -= 2;
        return Math.max(-5, Math.min(5, v));
      },
      // Rivals meet (Mala, 2026-10-24: "thats a cool idea build it"): the first time a rivalrous unit and its named rival both stand
      // on the field, one log line. Checked at battle start and every turn start (a late arrival counts); a concealed unit on either
      // side waits until it shows, so the line never gives a hidden unit away.
      rivalsMeet(s) {
        const shown = (u) => u && !u.defeated && !u.notArrived && !H.Stealth?.concealed?.(u), seen = (s.rivalsSeen ||= []);
        for (const a of Object.values(s.actors)) {
          if (!shown(a) || !(a.traits || []).some((x) => (x?.id ?? x) === "rivalrous")) continue;
          for (const t of Object.values(s.actors)) {
            if (!shown(t) || !Factions.rivalOf(a, t) || seen.includes(`${a.id}>${t.id}`)) continue;
            const mutual = (t.traits || []).some((x) => (x?.id ?? x) === "rivalrous") && Factions.rivalOf(t, a);   // one line for a mutual pair
            seen.push(`${a.id}>${t.id}`); if (mutual) seen.push(`${t.id}>${a.id}`);
            log(s, { kind: "rival", actor: a.id, target: t.id, tiles: [[a.x, a.y], [t.x, t.y]],
              text: mutual ? `${a.name} and ${t.name} meet as rivals.` : `${a.name} has found a rival: ${t.name}.`,
              why: ["Rivalrous: while both are on the field, the rival draws double hostility."] });
          }
        }
      },
      rivalry(s, a, t) {
        return Factions.rivalOf(a, t) && !t.defeated && (a.traits || []).some((x) => (x?.id ?? x) === "rivalrous") ? s.rules.factions?.rivalHate ?? 2 : 1;
      },
      // Mala, 2026-10-21: attack any faction and it turns hostile to you — heroes included.
      // Villains need no book (they already fight everyone); same-side and hero-on-hero never record.
      attacked(s, src, tgt) {
        if (!src || !tgt || src.id === tgt.id || !s.actors[src.id] || src.side === tgt.side || src.side === "hero" || src.side === "villain" || tgt.side !== "hero" || s.preview) return;
        const book = (s.factionHostile ||= { heroTo: [] });
        if (!book.heroTo.includes(src.side)) {
          book.heroTo.push(src.side);
          log(s, { kind: "faction", actor: tgt.id, target: src.id, text: `${src.name} attacks ${tgt.name}: the heroes are now hostile to the ${src.side} side.`, why: ["Attack any faction and it turns hostile to you — heroes included. They still never hold the battle open."] });
        }
      },
    };
    // Faction stance (Mala, 2026-10-24): what the rings and labels show. Same side is allied;
    // otherwise the subject is the viewer's enemy iff it is at war with them — the same four-gate
    // chain the AI and damage use (PostHuman, Civilian, Visitors, Factions). Tourists are never
    // anyone's enemy. Truces and parley are temporary states, not stance, so they do not move the ring.
    function stanceFor(s, viewer, subject) {
      if (!viewer || !subject) return "neutral";
      if (viewer.id === subject.id || subject.side === viewer.side) return "ally";
      if (H.Tourist?.is(subject) || H.Tourist?.is(viewer)) return "neutral";
      const war = (H.PostHuman?.atWar(s, subject, viewer) ?? true) && H.Civilian.atWar(s, subject, viewer)
        && (H.Visitors?.atWar(s, subject, viewer) ?? true) && Factions.atWar(s, subject, viewer);
      return war ? "enemy" : "neutral";
    }
    function hostileSidesFor(s, subject) {
      if (!subject) return [];
      const sides = new Set();
      for (const u of Object.values(s.actors)) if (!u.defeated && u.side !== subject.side) sides.add(u.side);
      return [...sides].filter((side) => {
        const v = Object.values(s.actors).find((u) => !u.defeated && u.side === side);
        return v && stanceFor(s, v, subject) === "enemy";
      });
    }
    return { Factions, stanceFor, hostileSidesFor };
  })();
});
