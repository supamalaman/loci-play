"use strict";
// The Pond dive's rules, slices R1 + R2 + R3 (claude-sunken-ruins-spec, specs/SUNKEN_RUINS.md 4.1, 4.3, 4.4; R-20261124-02). Pure: no DOM.
//
//   normalize(raw)                   the saved record, account.dive (old saves: { read: {}, taken: {}, dives: 0, band: 1, opened: [1] })
//   breathMax(account, passives)     100, x1.5 for a Swimmer, +20 per turn of water breathing (`breathTurnsAdd` in Loot.passives)
//   begin(account, passives, band, seed)  a new dive: { account (dives + 1), session }; the session is not saved
//   move(session, pos)               breath spent per whole tile crossed; at 0 the session is over (blackout)
//   bell(session, id)                an air bell refills breath to the full bar, once per dive each
//   questionFor(site, diveSeed)      deterministic question for a site within a dive, filtered on `for.kind` (Communion pattern)
//   isRead(account, siteId)          whether this site has been read before
//   answer(account, session, siteId, choiceIndex)  right: marks read + +1 discovery once, carries a find if offered; wrong: -5 breath + clue, retryable
//   findStatus(account, session, siteId)  offered find, picked-clean remaining, already carried this dive
//   collect(account, session, siteId)  carry an offered find (already-read sites after a blackout or a regrow)
//   diveLog(account, diveSeed)       read sites with their cards, ordered by band
//   surface(account, session)        back up the rope: banks carried finds on surface only; blackout drops them (Decision 2)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dive-data.js"));
  else root.ConceptCombatDive = factory(root.ConceptCombatDiveData);
})(typeof self !== "undefined" ? self : this, function (D) {
  const R = D.RULES;
  const nat = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

  function normalize(raw) {
    const r = obj(raw), opened = Array.isArray(r.opened) ? r.opened.filter((b) => D.BANDS[b]) : [];
    if (!opened.includes(1)) opened.unshift(1);
    const read = {}, taken = {};
    for (const [k, v] of Object.entries(obj(r.read))) if (v === true) read[k] = true;
    for (const [k, v] of Object.entries(obj(r.taken))) if (Number.isFinite(v)) taken[k] = v;
    return { read, taken, dives: nat(r.dives), band: opened.includes(r.band) ? r.band : 1, opened };
  }

  // The Warden swims when his own card holds Swimmer (account.self.traits, the list Loot.traitBonus reads) or he carries a
  // copy of it from imitation, temporary or permanent (account/imitation.js carried). Swimmer is psychology since
  // R-20261124-05, so it can be learned from anyone who has it (a Sailor holds it outright).
  const Imitation = () => (typeof module === "object" && module.exports ? require("../account/imitation.js") : (typeof self !== "undefined" ? self.ConceptCombatImitation : null)) || null;
  const swims = (account) => ((account && account.self && account.self.traits) || []).some((t) => (typeof t === "string" ? t : t && t.id) === "swimmer")
    || ((Imitation() && Imitation().carried(account)) || []).includes("swimmer");

  function breathMax(account, passives) {
    const turns = nat(obj(passives).breathTurnsAdd);
    return Math.floor(R.breathMax * (swims(account) ? R.swimmerMul : 1)) + turns * R.perBreathTurn;
  }

  function begin(account, passives, band = 1, seed) {
    const L = D.band(band) || D.band(1), max = breathMax(account, passives);
    const dive = normalize(account && account.dive);
    const dives = dive.dives + 1;
    const next = { ...(account || {}), dive: { ...dive, dives } };
    const diveSeed = Number.isFinite(seed) ? Math.floor(seed) : ((dives * 2654435761) >>> 0);
    const session = { band: L.id, breath: max, max, at: L.start.at.slice(), walked: 0, spent: 0, bellsUsed: {}, carriedThisDive: [], seed: diveSeed, over: null };
    return { account: next, session };
  }

  // Breath is counted per whole tile crossed (4.1): standing still costs nothing, and a part tile waits for the next.
  function move(session, pos) {
    if (!session || session.over) return session;
    const d = Math.hypot(pos[0] - session.at[0], pos[1] - session.at[1]);
    session.at = pos.slice(); session.walked += d;
    const tiles = Math.floor(session.walked + 1e-9), cost = R.walkCost[session.band] || 1;
    if (tiles > session.spent) {
      session.breath = Math.max(0, session.breath - (tiles - session.spent) * cost); session.spent = tiles;
      if (session.breath <= 0) session.over = "blackout";
    }
    return session;
  }

  function bell(session, id) {
    if (!session || session.over) return { ok: false, text: "" };
    if (session.bellsUsed[id]) return { ok: false, text: "The bell is empty. Its air is spent for this dive." };
    session.bellsUsed[id] = true; session.breath = session.max;
    return { ok: true, text: "You breathe the trapped air. Your breath is full." };
  }

  // Deterministic hash (Communion pattern, 4.3): same site + diveSeed always picks the same question within a dive.
  function hashKey(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  function questionFor(site, diveSeed = 0) {
    if (!site || typeof site !== "object") return null;
    const all = D.QUESTIONS || [];
    if (!all.length) return null;
    const byKind = all.filter((q) => q.for && q.for.kind === site.kind);
    const pool = byKind.length ? byKind : all.filter((q) => !q.for);
    const list = pool.length ? pool : all;
    return list[hashKey(`${site.id || site.kind || ""}:${diveSeed}`) % list.length];
  }

  const isRead = (account, siteId) => !!(account && account.dive && account.dive.read && account.dive.read[siteId] === true);

  function findOf(site) {
    const f = site && site.find;
    if (!f || typeof f !== "object") return null;
    if (f.pay === "parts" && (f.tier === "common" || f.tier === "uncommon" || f.tier === "rare")) return { pay: "parts", tier: f.tier };
    if (f.pay === "vessels" && (f.kind === "shard" || f.kind === "bead" || f.kind === "orb")) return { pay: "vessels", kind: f.kind };
    return null;
  }

  function pickedCleanLeft(account, siteId) {
    const dive = normalize(account && account.dive);
    if (!Number.isFinite(dive.taken[siteId])) return 0;
    const left = (nat(R.regrowDives) || 3) + 1 - (dive.dives - dive.taken[siteId]);
    return left > 0 ? left : 0;
  }

  function findStatus(account, session, siteId) {
    const site = D.siteById(siteId);
    const find = findOf(site);
    const k = site ? pickedCleanLeft(account, siteId) : 0;
    const carried = !!(session && (session.carriedThisDive || []).some((c) => c.siteId === siteId));
    const offered = find && site && k === 0 && !carried ? find : null;
    return { site, find, offered, pickedClean: k > 0, k, carried };
  }

  function collect(account, session, siteId) {
    const empty = { ok: false, account, session, text: "", offered: null, pickedClean: false, k: 0 };
    if (!session || session.over) return empty;
    const st = findStatus(account, session, siteId);
    if (st.pickedClean) {
      const text = (D.TEXTS && D.TEXTS.pickedClean) ? D.TEXTS.pickedClean(st.k) : `Picked clean: it drifts back in ${st.k} dives`;
      return { ok: true, account, session, text, offered: null, pickedClean: true, k: st.k };
    }
    if (!st.offered) return empty;
    session.carriedThisDive = [...(session.carriedThisDive || []), { siteId, ...st.offered }];
    return { ok: true, account, session, text: "", offered: st.offered, pickedClean: false, k: 0 };
  }

  function answer(account, session, siteId, choiceIndex) {
    if (!session || session.over) return { ok: false, right: false, alreadyRead: false, discovered: false, account, session, text: "", find: null };
    const site = D.siteById(siteId);
    if (!site) return { ok: false, right: false, alreadyRead: false, discovered: false, account, session, text: "Nothing here to read.", find: null };
    const q = questionFor(site, session.seed);
    if (isRead(account, siteId)) {
      return { ok: true, right: true, alreadyRead: true, discovered: false, account, session, site, question: q, text: q ? q.explain : "Already read.", find: null };
    }
    if (!q) return { ok: false, right: false, alreadyRead: false, discovered: false, account, session, site, text: "", find: null };
    if (choiceIndex === q.answer) {
      const dive = normalize(account && account.dive);
      const nextRead = { ...dive.read, [siteId]: true };
      const discoveries = nat(account && account.discoveries) + (nat(R.readPays) || 1);
      const next = { ...(account || {}), discoveries, dive: { ...dive, read: nextRead } };
      const took = collect(next, session, siteId);
      return { ok: true, right: true, alreadyRead: false, discovered: true, account: next, session, site, question: q, text: q.explain, find: took.offered || null };
    }
    const pen = nat(R.wrongPenalty) || 5;
    session.breath = Math.max(0, session.breath - pen);
    if (session.breath <= 0) session.over = "blackout";
    return { ok: true, right: false, alreadyRead: false, discovered: false, account, session, site, question: q, clue: q.clue, text: q.clue, find: null };
  }

  function diveLog(account, diveSeed = 0) {
    const read = normalize(account && account.dive).read;
    const entries = [];
    for (const bandId of Object.keys(D.BANDS).map(Number).sort((a, b) => a - b)) {
      for (const s of D.sites(bandId)) {
        if (!read[s.id]) continue;
        const q = questionFor(s, diveSeed);
        entries.push({ band: bandId, id: s.id, name: s.name, kind: s.kind, explain: q ? q.explain : "" });
      }
    }
    return entries;
  }

  // Surface or blackout. Reads and discoveries stay on account on both; finds bank on surface only (4.4, Decision 2).
  function surface(account, session) {
    const how = session && session.over === "blackout" ? "blackout" : "surface";
    if (session && !session.over) session.over = "surface";
    const dive = normalize(account && account.dive);
    const T = D.TEXTS || {};
    if (how === "blackout") {
      if (session) session.carriedThisDive = [];
      const text = T.blackout || "You black out and are hauled up the rope. Everything you read stays read; what you carried is back where you found it.";
      return { account: { ...(account || {}), dive }, how, banked: 0, text };
    }
    const carried = (session && session.carriedThisDive) || [];
    if (!carried.length) {
      return { account: { ...(account || {}), dive }, how, banked: 0, text: T.surfaced || "Surfaced" };
    }
    const parts = { common: 0, uncommon: 0, rare: 0, ...obj(account && account.parts) };
    const vessels = { shard: 0, bead: 0, orb: 0, ...obj(account && account.vessels) };
    const taken = { ...dive.taken };
    let n = 0;
    for (const item of carried) {
      if (!item || !item.siteId) continue;
      if (item.pay === "parts" && (item.tier === "common" || item.tier === "uncommon" || item.tier === "rare")) {
        parts[item.tier] = nat(parts[item.tier]) + 1;
      } else if (item.pay === "vessels" && (item.kind === "shard" || item.kind === "bead" || item.kind === "orb")) {
        vessels[item.kind] = nat(vessels[item.kind]) + 1;
      } else continue;
      taken[item.siteId] = dive.dives;
      n++;
    }
    if (session) session.carriedThisDive = [];
    const text = n ? ((T.banked && T.banked(n)) || `Surfaced: banked ${n} finds`) : (T.surfaced || "Surfaced");
    return { account: { ...(account || {}), parts, vessels, dive: { ...dive, taken } }, how, banked: n, text };
  }

  return { normalize, breathMax, begin, move, bell, questionFor, isRead, answer, findStatus, collect, diveLog, surface, swims };
});
