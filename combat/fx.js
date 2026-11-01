"use strict";
// Concept Combat effect player. Staged for Codex to wire into Loci.
// The stroke follows the tiles it is given. A stop coordinate clips that
// stroke only when the coordinate is already one of those tiles. A route
// around a wall stays that route.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ConceptCombatFX = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DURATIONS = { pose: 200, travel: 420, impact: 220, float: 640, wait: 280, slide: 200, announce: 240 };
  const SHAPES = ["line", "routed", "field", "placed", "self", "delayed", "contact", "release"];
  const MATERIALS = {
    nigredo: { id: "nigredo", gesture: "stamp", width: 7, core: "#c45a3a" },
    albedo: { id: "albedo", gesture: "cut", width: 2, core: "#e8f4ff" },
    citrinitas: { id: "citrinitas", gesture: "stain", width: 5, core: "#e2b34a" },
    rubedo: { id: "rubedo", gesture: "pulse", width: 4, core: "#e07090" },
  };
  // Channel placeholders for a technique with no concept look. Trail is presentation.
  const DEFAULTS = {
    nigredo: Object.assign({ name: "Impact", trail: "heavy" }, MATERIALS.nigredo),
    albedo: Object.assign({ name: "Piercing", trail: "needle" }, MATERIALS.albedo),
    citrinitas: Object.assign({ name: "Propagation", trail: "beads" }, MATERIALS.citrinitas),
    rubedo: Object.assign({ name: "Resonance", trail: "wave" }, MATERIALS.rubedo),
  };
  // Presentation only. Channels mirror conceptDamageTypes. Collage has no combat channel;
  // citrinitas here is the fallback look when the cue omits a damage type.
  const CONCEPTS = {
    barrier: { id: "barrier", name: "Barrier", color: "#e9c46a", channel: "nigredo", glyph: "wall", trail: "bar" },
    elasticity: { id: "elasticity", name: "Elasticity", color: "#7cc6a4", channel: "nigredo", glyph: "snap", trail: "snap" },
    selectivity: { id: "selectivity", name: "Selectivity", color: "#8fb3ff", channel: "albedo", glyph: "slit", trail: "needle" },
    pathway: { id: "pathway", name: "Alternate Pathway", color: "#d98bd0", channel: "citrinitas", glyph: "corner", trail: "beads" },
    berm: { id: "berm", name: "Berm", color: "#b89463", channel: "nigredo", glyph: "shelf", trail: "heavy" },
    sightline: { id: "sightline", name: "Sightline", color: "#c6e6dd", channel: "albedo", glyph: "ray", trail: "ray" },
    swale: { id: "swale", name: "Swale", color: "#78b89b", channel: "rubedo", glyph: "bowl", trail: "wave" },
    inertia: { id: "inertia", name: "Inertia", color: "#e5b86b", channel: "nigredo", glyph: "weight", trail: "heavy" },
    resonance: { id: "resonance", name: "Resonance", color: "#d6a6ff", channel: "rubedo", glyph: "rings", trail: "wave" },
    adaptation: { id: "adaptation", name: "Adaptation", color: "#78c9d0", channel: "albedo", glyph: "retint", trail: "needle" },
    deception: { id: "deception", name: "Deception", color: "#e486a2", channel: "albedo", glyph: "twin", trail: "twin" },
    boundary: { id: "boundary", name: "Boundary", color: "#e6a26b", channel: "citrinitas", glyph: "sever", trail: "bar" },
    threshold: { id: "threshold", name: "Threshold", color: "#f08c83", channel: "albedo", glyph: "trip", trail: "needle" },
    diffusion: { id: "diffusion", name: "Diffusion", color: "#81c7e8", channel: "citrinitas", glyph: "spread", trail: "beads" },
    pruning: { id: "pruning", name: "Pruning", color: "#9ab56d", channel: "albedo", glyph: "snip", trail: "needle" },
    focus: { id: "focus", name: "Focus", color: "#d3b66f", channel: "albedo", glyph: "thread", trail: "ray" },
    succession: { id: "succession", name: "Succession", color: "#85b66a", channel: "rubedo", glyph: "stages", trail: "beads" },
    section: { id: "section", name: "Section / Projection", color: "#80b8da", channel: "albedo", glyph: "slice", trail: "ray" },
    collage: { id: "collage", name: "Collage", color: "#d9a1c5", channel: "citrinitas", glyph: "scraps", trail: "beads" },
  };
  // Presentation only. A match here changes the picture of one ultimate.
  // It does not add a rule, a resource, or a tile the engine did not already name.
  const ULTIMATES = {
    recoilCascade: {
      id: "recoilCascade",
      name: "Recoil Cascade",
      sequence: ["drawback", "hold", "snap"],
      flinch: "block",
      announce: "line",
      cap: 1800,
    },
    longView: {
      id: "longView",
      name: "Long View",
      sequence: ["ray", "exposed"],
      announce: "line",
      width: 2.5,
      cap: 1200,
    },
    sieveVerdict: {
      id: "sieveVerdict",
      name: "Sieve Verdict",
      sequence: ["bolt", "pass"],
      announce: "line",
      width: 6,
      cap: 1200,
    },
    undividedAttention: {
      id: "undividedAttention",
      name: "Undivided Attention",
      sequence: ["thread", "dim", "along"],
      announce: "line",
      width: 3.5,
      cap: 1200,
    },
  };
  const HEAL = "#7cc6a4";
  const MINUS = "\u2212";

  // UI helpers retained from the previous Loci effect module.
  function actionLabel(action, ability, events, itemName) {
    if (!action) return null;
    const type = action.type;
    if (["move", "jump", "climb", "end"].includes(type)) return null;
    if (type === "ability") return ability && ability.name || action.ability || "Technique";
    if (type === "respond") {
      if (action.response === "reposition") return (events || []).some((e) => e.kind === "respond" && e.actor === action.actor && e.safe) ? "Dodged" : null;
      if (action.response === "guard") return "Guard";
      if (action.response === "lookAway") return "Looked Away";
      return null;
    }
    const labels = { strike: "Strike", guard: "Guard", stall: "Stall", recover: "Recover", observe: "Observe",
      summon: "Summon", swap: "Loadout", useItem: itemName || "Use Item", insight: "Insight", lens: "Lens", dreamSpace: "Dream Space" };
    return labels[type] || String(type || "Action").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  }

  function facingRight(from, to, current = true) {
    if (!Array.isArray(from) || !Array.isArray(to)) return current;
    const dx = Number(to[0]) - Number(from[0]);
    return dx === 0 ? current : dx > 0;
  }

  function hexToRgb(hex) {
    if (typeof hex !== "string") return null;
    let h = hex.trim().replace(/^#/, "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHex(r, g, b) {
    const c = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
    return "#" + c(r) + c(g) + c(b);
  }
  function material(damageType) {
    return MATERIALS[damageType] || MATERIALS.nigredo;
  }
  // Move the concept color 45% of the way toward the channel core.
  function tint(color, damageType) {
    const core = material(damageType).core;
    const from = hexToRgb(color);
    const to = hexToRgb(core);
    if (!from || !to) return core;
    const t = 0.45;
    return rgbToHex(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t);
  }
  // A known concept replaces the impact glyph and the trail. An unknown id, or no
  // concept, keeps the channel placeholder. An explicit damageType still picks the channel.
  function look(cue) {
    const c = cue || {};
    const concept = typeof c.concept === "string" && CONCEPTS[c.concept] ? CONCEPTS[c.concept] : null;
    const channel = DEFAULTS[c.damageType] || (concept && DEFAULTS[concept.channel]) || DEFAULTS.nigredo;
    if (concept) {
      return {
        source: "concept",
        id: concept.id,
        name: concept.name,
        color: c.color || concept.color,
        channel: channel.id,
        glyph: concept.glyph,
        trail: concept.trail || channel.trail,
        width: channel.width,
        core: channel.core,
        gesture: channel.gesture,
      };
    }
    return {
      source: "channel",
      id: channel.id,
      name: channel.name,
      color: c.color || null,
      channel: channel.id,
      glyph: null,
      trail: channel.trail,
      width: channel.width,
      core: channel.core,
      gesture: channel.gesture,
    };
  }

  function xy(p) {
    if (Array.isArray(p) && p.length >= 2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1])) return [+p[0], +p[1]];
    if (p && typeof p === "object" && Number.isFinite(p.x) && Number.isFinite(p.y)) return [p.x, p.y];
    return null;
  }
  function normalizeTiles(tiles) {
    const out = [];
    if (!tiles) return out;
    for (const t of tiles) {
      const p = xy(t);
      if (p) out.push(p);
    }
    return out;
  }
  function same(a, b) {
    return !!a && !!b && a[0] === b[0] && a[1] === b[1];
  }
  function manhattan(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  }
  // Same Bresenham as Loci's E.geometry.line: endpoints included.
  function lineTiles(x0, y0, x1, y1) {
    const out = [];
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0 | 0, y = y0 | 0;
    const X = x1 | 0, Y = y1 | 0;
    for (;;) {
      out.push([x, y]);
      if (x === X && y === Y) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return out;
  }

  function poseFor(src) {
    if (src.pose) return src.pose;
    // poses.js owns routing (Cast Off / Cast Def / Dodge / Ultimate, and Strike ⇒ punch); the lines below are the
    // fallback for a page that loads fx.js without it.
    const P = (typeof self !== "undefined" ? self : globalThis).ConceptCombatPoses || (typeof require === "function" ? (() => { try { return require("./poses.js"); } catch { return null; } })() : null);
    if (P && (src.type || src.response || src.def)) return P.route(src);
    if (src.type === "guard" || src.effect === "guard" || src.response === "guard") return "block";
    if (src.type === "move" || src.effect === "move" || src.response === "reposition") return "walk";
    if (src.type === "strike" || src.effect === "strike" || src.delivery === "contact" || /^strike$/i.test(src.name || "")) return "punch";
    return "cast";
  }

  function normalizeLayers(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const item of list) {
      const id = typeof item === "string" ? item : (item && typeof item.id === "string" ? item.id : "");
      if (!id || out.some((layer) => layer.id === id)) continue;
      out.push({ id });
    }
    return out;
  }

  function cueFromAbility(ability, extra) {
    const a = ability || {};
    const x = extra || {};
    const delivery = x.delivery || a.delivery || "contact";
    const effect = x.effect != null ? x.effect : (a.effect != null ? a.effect : null);
    const type = x.type || a.type || null;
    const name = x.name || a.name || "";
    const concept = x.concept || (Array.isArray(a.concepts) ? a.concepts[0] : null) || a.concept || null;
    const known = CONCEPTS[concept] || null;
    return {
      actor: x.actor || a.actor || null,
      name,
      ability: x.ability || a.ability || a.id || null,
      concept,
      delivery,
      timing: x.timing || a.timing || null,
      effect,
      type,
      damageType: x.damageType || a.damageType || (known && known.channel) || "nigredo",
      color: x.color || a.color || (known && known.color) || null,
      origin: xy(x.origin != null ? x.origin : a.origin),
      aim: xy(x.aim != null ? x.aim : (a.aim != null ? a.aim : null)),
      tiles: normalizeTiles(x.tiles || a.tiles || []),
      cover: normalizeTiles(x.cover || a.cover || []),
      others: normalizeTiles(x.others || a.others || []),
      layers: normalizeLayers(x.layers || a.layers || []),
      aimed: typeof (x.aimed != null ? x.aimed : a.aimed) === "string" && (x.aimed != null ? x.aimed : a.aimed)
        ? (x.aimed != null ? x.aimed : a.aimed)
        : null,
      positions: x.positions || a.positions || null,
      pose: poseFor({ pose: x.pose || a.pose || null, type, effect, delivery, response: x.response || a.response || null, name, ability: x.ability || a.ability || a.id || null, def: a }),
      phase: x.phase || a.phase || null,
      stopAt: xy(x.stopAt != null ? x.stopAt : a.stopAt),
    };
  }

  function stopFromEvents(events) {
    for (const e of events || []) {
      if (!e || e.kind !== "negate" || typeof e.text !== "string") continue;
      const m = e.text.match(/\((\d+),\s*(\d+)\)/);
      if (m) return [Number(m[1]), Number(m[2])];
    }
    return null;
  }

  // Clip only when the stop is already a point on the path. Never grow the
  // path out to a wall the route walked around.
  function applyStop(points, stopAt) {
    if (!stopAt || !points.length) return points.slice();
    const idx = points.findIndex((p) => same(p, stopAt));
    if (idx < 0) return points.slice();
    return points.slice(0, idx + 1);
  }

  function fieldRadius(origin, tiles) {
    if (!origin) return 0;
    let r = 0;
    for (const t of tiles || []) r = Math.max(r, manhattan(origin, t));
    return r;
  }

  function isCommit(cue, events) {
    if (!cue) return false;
    if (cue.phase === "resolve") return false;
    if (cue.phase === "commit") return true;
    const delayed = cue.timing === "delayed" || cue.delivery === "delayed";
    if (!delayed) return false;
    if ((events || []).some((e) => e && (e.kind === "damage" || e.kind === "delayed" || e.kind === "resolve"))) return false;
    return true;
  }

  function pointOf(cue, event, path) {
    if (event) {
      const direct = xy(event.at) || xy(event.tile) || (event.tiles && event.tiles.length ? xy(event.tiles[0]) : null);
      if (direct) return direct;
      if (cue && cue.positions && event.target && cue.positions[event.target]) {
        const p = xy(cue.positions[event.target]);
        if (p) return p;
      }
    }
    if (path && path.length) return path[path.length - 1];
    if (cue && cue.aim) return cue.aim;
    if (cue && cue.tiles && cue.tiles.length) return cue.tiles[cue.tiles.length - 1];
    if (cue && cue.origin) return cue.origin;
    return [0, 0];
  }

  function healAmount(event) {
    if (!event || event.kind === "damage") return null;
    const text = typeof event.text === "string" ? event.text : "";
    const m = text.match(/restores (\d+) LF/) || text.match(/recovers (\d+) LF/);
    if (m) return Number(m[1]);
    if ((event.kind === "posture" || event.kind === "heal" || event.kind === "item") && typeof event.amount === "number") return event.amount;
    return null;
  }

  function pushFloat(beats, text, color, at, event, withIndex) {
    beats.push({
      kind: "float", dur: "float", blocks: false, text, color, at,
      actor: event && event.actor || null,
      target: event && event.target || null,
      withIndex: withIndex == null ? null : withIndex,
    });
  }

  function travelBeat(cue, stop) {
    const seen = look(cue);
    const color = tint(seen.color, cue.damageType);
    const width = seen.width;
    const trail = seen.trail || null;
    const glyph = seen.glyph || null;
    if (cue.effect === "architectDesign" || cue.effect === "architectRemoveDesign") {
      const points = cue.tiles.slice();
      if (cue.origin && (!points.length || !same(points[0], cue.origin))) points.unshift(cue.origin);
      return { kind: "travel", dur: "travel", blocks: true, shape: "design", points, color: "#7fe4d3", width: 2.5, design: true };
    }
    if (cue.delivery === "line" || cue.delivery === "routed") {
      let points = cue.tiles.slice();
      if (cue.origin && (!points.length || !same(points[0], cue.origin))) points = [cue.origin, ...points];
      points = applyStop(points, stop);
      return { kind: "travel", dur: "travel", blocks: true, shape: cue.delivery, points, color, width, damageType: cue.damageType, trail, glyph };
    }
    if (cue.delivery === "field") {
      const origin = cue.origin || [0, 0];
      return { kind: "travel", dur: "travel", blocks: true, shape: "ring", origin, radius: fieldRadius(origin, cue.tiles), tiles: cue.tiles.slice(), color, width, damageType: cue.damageType, trail, glyph };
    }
    if (cue.delivery === "placed") {
      const tiles = cue.tiles.length ? cue.tiles.slice() : (cue.aim ? [cue.aim] : []);
      return { kind: "travel", dur: "travel", blocks: true, shape: "rise", tiles, color, width, damageType: cue.damageType, trail, glyph };
    }
    if (cue.delivery === "self") {
      return { kind: "travel", dur: "travel", blocks: true, shape: "aura", origin: cue.origin || cue.aim || [0, 0], color, width, damageType: cue.damageType, trail, glyph };
    }
    return null;
  }

  function addEvent(beats, cue, event, path) {
    if (!event || !event.kind) return;
    if (event.kind === "damage") {
      const at = pointOf(cue, event, path);
      const damageType = event.damageType || (cue && cue.damageType) || "nigredo";
      const seen = look({ concept: cue && cue.concept, color: cue && cue.color, damageType });
      const color = tint(seen.color, damageType);
      const impact = { kind: "impact", dur: "impact", blocks: true, at, damageType, color, width: seen.width, glyph: seen.glyph, actor: event.actor || null, target: event.target || null };
      if (seen.glyph === "thread" && cue && cue.origin) impact.from = cue.origin.slice();
      if (event.target && (event.amount || 0) > 0) impact.flinch = "knockback";   // nothing got through (a ward took it all): no flinch   // a landed hit knocks back (poses.js falls back to block)
      if (ultimateId(cue) === "recoilCascade" && event.target) {
        impact.flinch = ULTIMATES.recoilCascade.flinch;
        if (path && path.length > 1) impact.line = path.map((p) => p.slice());
      }
      if (ultimateId(cue) === "longView" && path && path.length > 1) {
        impact.line = path.map((p) => p.slice());
        impact.lineTrail = "ray";
        impact.hairline = true;
        impact.width = ULTIMATES.longView.width;
        impact.cover = (cue.cover || []).map((p) => p.slice());
      }
      if (ultimateId(cue) === "sieveVerdict") {
        const placed = placeLayers(cue, at);
        impact.heavy = true;
        impact.width = ULTIMATES.sieveVerdict.width;
        impact.lineTrail = "needle";
        impact.scale = 1.55;
        impact.layers = placed;
        impact.aimed = resolveAimed(cue, placed);
        if (path && path.length > 1) impact.line = path.map((p) => p.slice());
      }
      beats.push(impact);
      if (typeof event.amount === "number" && Number.isFinite(event.amount)) pushFloat(beats, MINUS + event.amount, color, at, event, beats.length - 1);
      return;
    }
    if (event.kind === "stun") {
      pushFloat(beats, "tempo", "#f08c83", pointOf(cue, event, path), event);
      return;
    }
    if (event.kind === "negate") {
      const at = path && path.length ? path[path.length - 1] : pointOf(cue, event, path);
      pushFloat(beats, "stopped", tint(cue && cue.color, cue && cue.damageType), at, event);
      return;
    }
    if (event.kind === "parry") {
      const at = (cue && cue.positions && event.actor && xy(cue.positions[event.actor])) || pointOf(cue, event, path);
      beats.push({ kind: "coil", dur: "impact", blocks: true, at, color: "#f4a261", actor: event.actor || null, target: event.target || null });
      pushFloat(beats, "caught", "#f4a261", at, event, beats.length - 1);
      return;
    }
    if (event.kind === "miss") {
      pushFloat(beats, "miss", "#9aa3ad", pointOf(cue, event, path), event);
      return;
    }
    if (event.kind === "move" && event.forced && event.path && event.path.length) {
      beats.push({ kind: "slide", dur: "slide", blocks: true, points: normalizeTiles(event.path), actor: event.actor || null, color: "#e8eef7" });
      return;
    }
    const heal = healAmount(event);
    if (heal != null) pushFloat(beats, "+" + heal, HEAL, pointOf(cue, event, path), event);
  }

  function layout(beats, opts) {
    const o = opts || {};
    const scale = o.scale == null ? 1 : Number(o.scale);
    const cap = o.cap == null ? 720 : o.cap;
    const over = o.ms || {};
    for (const b of beats) {
      const base = over[b.dur] != null ? over[b.dur] : DURATIONS[b.dur];
      b.ms = scale === 0 ? 0 : base * scale;
    }
    if (scale !== 0 && cap >= 0) {
      const blocking = beats.filter((b) => b.blocks !== false && b.ms > 0);
      const sum = blocking.reduce((n, b) => n + b.ms, 0);
      if (sum > cap && blocking.length) {
        const factor = cap / sum;
        let used = 0;
        blocking.forEach((b, i) => {
          if (i === blocking.length - 1) {
            const remain = cap - used;
            b.ms = remain >= 40 ? remain : Math.max(40, Math.round(b.ms * factor));
          } else {
            b.ms = Math.max(40, Math.round(b.ms * factor));
            used += b.ms;
          }
        });
      } else {
        for (const b of beats) if (b.ms > 0) b.ms = Math.round(b.ms);
      }
    }
    let clock = 0;
    let tail = beats.length ? 0 : -1;
    for (const b of beats) {
      b.start = clock;
      b.end = clock + b.ms;
      if (b.blocks !== false) clock = b.end;
      if (b.end > tail) tail = b.end;
    }
    for (const b of beats) {
      if (typeof b.withIndex === "number") {
        b.start = beats[b.withIndex].start;
        b.end = b.start + b.ms;
        if (b.end > tail) tail = b.end;
        delete b.withIndex;
      }
    }
    return { blockingMs: clock, tail };
  }

  function marks(actor) {
    const a = actor || {};
    const st = a.status || {};
    const out = [];
    if (st.guard) out.push({ kind: "brace", badge: "G", color: "#9ad1ff", where: "body" });
    if (st.ward) {
      const n = st.ward.protection != null ? st.ward.protection : st.ward;
      out.push({ kind: "shell", badge: String(n), color: "#e9c46a", thick: true, where: "body" });
    }
    if (st.stun) out.push({ kind: "ring", badge: "S", color: "#f08c83", where: "body" });
    if (st.parry) out.push({ kind: "coil", badge: "R", color: "#f4a261", where: "body" });
    if (st.membrane) out.push({ kind: "shell", badge: "M", color: "#8fb3ff", thin: true, where: "body" });
    if (st.anchor) out.push({ kind: "root", color: "#e5b86b", where: "body" });
    if (a.focus && a.focus.target) out.push({ kind: "thread", target: a.focus.target, color: "#d3b66f" });
    if (st.attention && st.attention.target) out.push({ kind: "thread", target: st.attention.target, color: "#d3b66f", source: "attention" });
    if (st.tippingPoint) out.push({ kind: "hatch", color: "#f08c83", where: "body" });
    if (st.entangled) out.push({ kind: "tangle", color: "#81c7e8", where: "body" });
    if (st.stagger) out.push({ kind: "stamp", color: "#c45a3a", where: "body", small: true });
    if (st.exposed) out.push({ kind: "nick", color: "#e8f4ff", where: "body" });
    if (st.immovable) out.push({ kind: "root", color: "#c45a3a", where: "body" });
    if (st.tauntProtection) out.push({ kind: "brace", color: "#e486a2", where: "body" });
    return out;
  }

  function progress(beat, t) {
    if (t < beat.start) return null;
    if (beat.ms <= 0) return 1;
    if (t > beat.end) return null;
    return (t - beat.start) / beat.ms;
  }

  function polylineUntil(points, p) {
    if (!points || !points.length) return [];
    if (points.length === 1 || p >= 1) return points.map((pt) => pt.slice());
    if (p <= 0) return [points[0].slice()];
    const lens = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      lens.push(len);
      total += len;
    }
    if (total <= 0) return [points[0].slice()];
    let remain = total * p;
    const out = [points[0].slice()];
    for (let i = 0; i < lens.length; i++) {
      if (remain >= lens[i] - 1e-9) {
        out.push(points[i + 1].slice());
        remain -= lens[i];
      } else {
        const f = lens[i] === 0 ? 0 : remain / lens[i];
        out.push([
          points[i][0] + (points[i + 1][0] - points[i][0]) * f,
          points[i][1] + (points[i + 1][1] - points[i][1]) * f,
        ]);
        break;
      }
    }
    return out;
  }

  function frame(beat, t) {
    const p = progress(beat, t);
    if (p == null || !beat) return [];
    if (beat.kind === "pose") return [];
    if (beat.kind === "hold") {
      return [{ op: "polyline", points: (beat.points || []).map((pt) => pt.slice()), color: beat.color, width: beat.width, p: 1, head: false, shape: beat.shape || "line", trail: beat.trail || null }];
    }
    if (beat.shape === "hatch" || (beat.kind === "wait" && beat.shape === "hatch")) {
      return [{ op: "hatch", tiles: beat.tiles || [], color: beat.color, p }];
    }
    if (beat.kind === "travel" && (beat.shape === "line" || beat.shape === "routed")) {
      const line = { op: "polyline", points: polylineUntil(beat.points, p), color: beat.color, width: beat.width, p, head: true, shape: beat.shape, trail: beat.trail || null, hairline: beat.hairline || false };
      if (beat.heavy) line.heavy = true;
      return [line].concat(pipOps(beat.cover, beat.color, p), layerOps(beat, p));
    }
    if (beat.kind === "travel" && beat.shape === "design") {
      const points = polylineUntil(beat.points, p);
      return [
        { op: "polyline", points, color: "#7fe4d3", width: 2.5, p, head: false, dash: true },
        { op: "polyline", points: offsetPath(points, 0.06), color: "#d9fff7", width: 1, p, head: false, dash: true },
      ];
    }
    if (beat.kind === "travel" && beat.shape === "ring") {
      const ops = [{ op: "ring", origin: beat.origin, radius: beat.radius, color: beat.color, width: beat.width, p, dash: false }];
      if (beat.damageType === "citrinitas") ops.push({ op: "stain", tiles: beat.tiles || [], color: beat.color, p });
      if (beat.glyph) ops.push({ op: "stamp", at: beat.origin, material: beat.damageType, color: beat.color, width: beat.width, p, glyph: beat.glyph });
      return ops;
    }
    if (beat.kind === "travel" && beat.shape === "rise") return [{ op: "rise", tiles: beat.tiles || [], color: beat.color, p }];
    if (beat.kind === "travel" && beat.shape === "aura") return [{ op: "aura", origin: beat.origin, color: beat.color, p }];
    if (beat.kind === "impact") {
      const ops = [];
      if (beat.line && beat.line.length > 1) {
        const line = { op: "polyline", points: beat.line.map((pt) => pt.slice()), color: beat.color, width: beat.width, p: 1, head: false, shape: "line", trail: beat.lineTrail || "snap", hairline: beat.hairline || false };
        if (beat.heavy) line.heavy = true;
        ops.push(line);
      }
      const stamp = { op: "stamp", at: beat.at, from: beat.from || null, material: beat.damageType, color: beat.color, width: beat.width, p, glyph: beat.glyph || null };
      if (beat.scale) stamp.scale = beat.scale;
      ops.push(stamp);
      return ops.concat(pipOps(beat.cover, beat.color, p), layerOps(beat, p));
    }
    if (beat.kind === "float") return [{ op: "float", at: beat.at, text: beat.text, color: beat.color, p, actor: beat.actor, target: beat.target, hold: beat.ms <= 0 }];
    if (beat.kind === "slide") return [{ op: "slide", points: polylineUntil(beat.points, p), color: beat.color, p, actor: beat.actor }];
    if (beat.kind === "coil") return [{ op: "coil", at: beat.at, color: beat.color, p }];
    if (beat.kind === "pass") {
      const line = { op: "polyline", points: (beat.points || []).map((pt) => pt.slice()), color: beat.color, width: beat.width, p: 1, head: true, shape: "line", trail: "needle", heavy: true };
      return [line].concat(layerOps(beat, p));
    }
    if (beat.kind === "dim" || beat.kind === "along") {
      const held = { op: "polyline", points: (beat.points || []).map((pt) => pt.slice()), color: beat.color, width: beat.width, p: 1, head: true, shape: "line", trail: "thread", hold: true };
      const ops = [held];
      if (beat.kind === "along") {
        ops.push({ op: "polyline", points: polylineUntil(beat.points, p), color: beat.color, width: (beat.width || 3.5) + 1.25, p, head: true, shape: "line", trail: "thread", bright: true });
      }
      return ops.concat(dimOps(beat.others, beat.kind === "dim" ? p : 1));
    }
    if (beat.kind === "announce" && beat.shape === "line") {
      const line = { op: "polyline", points: (beat.points || []).map((pt) => pt.slice()), color: beat.color, width: beat.width || 3, p, head: false, shape: "line", dash: true, trail: null, hairline: beat.hairline || false };
      if (beat.heavy) line.heavy = true;
      return [line].concat(pipOps(beat.cover, beat.color, p), layerOps(beat, p));
    }
    if (beat.kind === "exposed") return [{ op: "aura", origin: beat.origin, color: beat.color, p, bright: true }];
    if (beat.kind === "announce") return [{ op: "envelope", tiles: beat.tiles || [], origin: beat.origin, radius: beat.radius, color: beat.color, dash: true, p }];
    return [];
  }

  function pxAt(toPx, tile, x, y) {
    if (typeof toPx === "function") {
      const p = toPx(x, y);
      if (Array.isArray(p)) return p;
      if (p && Number.isFinite(p.x)) return [p.x, p.y];
    }
    const s = tile || 48;
    return [(x + 0.5) * s, (y + 0.5) * s];
  }

  function paint(ctx, ops, toPx, tile) {
    if (!ctx || !ops) return;
    const size = tile || 48;
    for (const op of ops) {
      ctx.save();
      if (op.op === "polyline" || op.op === "slide") strokePath(ctx, op, toPx, size);
      else if (op.op === "ring" || op.op === "aura" || op.op === "envelope") strokeRing(ctx, op, toPx, size);
      else if (op.op === "stain") fillStain(ctx, op, toPx, size);
      else if (op.op === "rise") fillRise(ctx, op, toPx, size);
      else if (op.op === "hatch") fillHatch(ctx, op, toPx, size);
      else if (op.op === "stamp") fillStamp(ctx, op, toPx, size);
      else if (op.op === "coil") fillCoil(ctx, op, toPx, size);
      else if (op.op === "float") fillFloat(ctx, op, toPx, size);
      else if (op.op === "pip") strokePip(ctx, op, toPx, size);
      else if (op.op === "layer") paintLayer(ctx, op, toPx, size);
      else if (op.op === "dim") paintDim(ctx, op, toPx, size);
      ctx.restore();
    }
  }

  function offsetPath(pts, dist) {
    if (!pts || pts.length < 2) return (pts || []).map((p) => p.slice());
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      return [p[0] + (-dy / len) * dist, p[1] + (dx / len) * dist];
    });
  }
  function snapTick(pts) {
    if (!pts || pts.length < 2) return null;
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return null;
    const back = Math.min(0.48, len * 0.7);
    return [b[0] - (dx / len) * back, b[1] - (dy / len) * back];
  }
  function perpBar(pts, half) {
    const b = pts[pts.length - 1];
    let dx = 1, dy = 0;
    if (pts.length >= 2) {
      const a = pts[pts.length - 2];
      dx = b[0] - a[0];
      dy = b[1] - a[1];
    }
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    return [[b[0] - nx * half, b[1] - ny * half], [b[0] + nx * half, b[1] + ny * half]];
  }
  function strokePolyline(ctx, pts, toPx, size) {
    if (!pts || pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((pt, i) => {
      const [x, y] = pxAt(toPx, size, pt[0], pt[1]);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  function fillHead(ctx, pt, toPx, size, radius, dy) {
    const [hx, hy] = pxAt(toPx, size, pt[0], pt[1]);
    ctx.beginPath();
    ctx.arc(hx, hy + (dy || 0), radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Trail style is drawn on the points it is given. It does not insert tiles.
  function strokeTrail(ctx, op, pts, toPx, size) {
    const last = pts[pts.length - 1];
    const width = op.width || 3;
    ctx.strokeStyle = op.color || "#fff";
    ctx.fillStyle = op.color || "#fff";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.95;
    if (op.trail === "heavy") {
      ctx.lineCap = "round";
      ctx.lineWidth = width * 1.25;
      strokePolyline(ctx, pts, toPx, size);
      fillHead(ctx, last, toPx, size, Math.max(3, width * 0.4), size * 0.08);
      return;
    }
    if (op.trail === "needle") {
      ctx.lineCap = "round";
      ctx.lineWidth = op.heavy ? (op.width || 6) : Math.min(width, 2);
      strokePolyline(ctx, pts, toPx, size);
      fillHead(ctx, last, toPx, size, op.heavy ? Math.max(4.5, (op.width || 6) * 0.55) : 2.5, 0);
      return;
    }
    if (op.trail === "thread") {
      ctx.lineCap = "round";
      ctx.lineWidth = op.bright ? (op.width || 3.5) : (op.width || 3.5);
      ctx.globalAlpha = op.bright ? 1 : (op.hold ? 0.55 : 0.95);
      strokePolyline(ctx, pts, toPx, size);
      fillHead(ctx, last, toPx, size, op.bright ? Math.max(6, size * 0.16) : Math.max(5, size * 0.12), 0);
      return;
    }
    if (op.trail === "beads") {
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(2, width * 0.45);
      ctx.setLineDash([2, 8]);
      strokePolyline(ctx, pts, toPx, size);
      ctx.setLineDash([]);
      fillHead(ctx, last, toPx, size, Math.max(2.5, width * 0.35), 0);
      return;
    }
    if (op.trail === "wave") {
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(2, width * 0.55);
      strokePolyline(ctx, offsetPath(pts, 0.07), toPx, size);
      strokePolyline(ctx, offsetPath(pts, -0.07), toPx, size);
      fillHead(ctx, last, toPx, size, Math.max(2.5, width * 0.35), 0);
      return;
    }
    if (op.trail === "bar") {
      ctx.lineCap = "square";
      ctx.lineWidth = Math.max(3, width * 0.7);
      strokePolyline(ctx, pts, toPx, size);
      const bar = perpBar(pts, 0.22);
      const [ax, ay] = pxAt(toPx, size, bar[0][0], bar[0][1]);
      const [bx, by] = pxAt(toPx, size, bar[1][0], bar[1][1]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      return;
    }
    if (op.trail === "snap") {
      ctx.lineCap = "round";
      ctx.lineWidth = width;
      strokePolyline(ctx, pts, toPx, size);
      const tick = snapTick(pts);
      if (tick) {
        const [hx, hy] = pxAt(toPx, size, last[0], last[1]);
        const [tx, ty] = pxAt(toPx, size, tick[0], tick[1]);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      fillHead(ctx, last, toPx, size, Math.max(2.5, width * 0.35), 0);
      return;
    }
    if (op.trail === "ray") {
      ctx.lineCap = "round";
      ctx.lineWidth = op.hairline ? (op.width || 2.5) : 1.25;
      strokePolyline(ctx, pts, toPx, size);
      const [hx, hy] = pxAt(toPx, size, last[0], last[1]);
      ctx.beginPath();
      ctx.arc(hx, hy, op.hairline ? Math.max(5, size * 0.1) : Math.max(3, size * 0.07), 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (op.trail === "twin") {
      ctx.lineCap = "round";
      ctx.lineWidth = Math.min(width, 2.5);
      strokePolyline(ctx, pts, toPx, size);
      fillHead(ctx, last, toPx, size, Math.max(2.5, width * 0.4), 0);
      const twin = offsetPath(polylineUntil(pts, 0.72), 0.15);
      if (twin.length > 1) {
        ctx.globalAlpha = 0.7;
        ctx.setLineDash([5, 4]);
        strokePolyline(ctx, twin, toPx, size);
        ctx.setLineDash([]);
      }
      return;
    }
    ctx.lineCap = "round";
    ctx.lineWidth = width;
    strokePolyline(ctx, pts, toPx, size);
    fillHead(ctx, last, toPx, size, Math.max(3, width * 0.55), 0);
  }
  function strokePath(ctx, op, toPx, size) {
    const pts = op.points || [];
    if (!pts.length) return;
    if (op.trail) {
      strokeTrail(ctx, op, pts, toPx, size);
      return;
    }
    ctx.strokeStyle = op.color || "#fff";
    ctx.fillStyle = op.color || "#fff";
    ctx.lineWidth = op.width || 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.95;
    if (op.dash) ctx.setLineDash([6, 5]);
    ctx.beginPath();
    pts.forEach((pt, i) => {
      const [x, y] = pxAt(toPx, size, pt[0], pt[1]);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    if (pts.length > 1) ctx.stroke();
    if (op.dash) ctx.setLineDash([]);
    if (op.head !== false) {
      const last = pts[pts.length - 1];
      const [hx, hy] = pxAt(toPx, size, last[0], last[1]);
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(3, (op.width || 3) * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function strokeRing(ctx, op, toPx, size) {
    const origin = op.origin || [0, 0];
    const [x, y] = pxAt(toPx, size, origin[0], origin[1]);
    const radiusTiles = op.op === "aura" ? 0.35 + 0.55 * (op.p || 0) : Math.max(0.2, (op.radius || 0) * (op.p == null ? 1 : Math.max(op.p, 0.04)));
    const radius = op.op === "envelope" ? Math.max(size * 0.45, (op.radius || 0) * size) : radiusTiles * size;
    ctx.strokeStyle = op.color || "#fff";
    ctx.lineWidth = op.width || (op.op === "aura" ? 3 : 2);
    if (op.dash) ctx.setLineDash([6, 5]);
    if (op.bright) ctx.lineWidth = 4;
    ctx.globalAlpha = op.bright ? 0.78 : (op.op === "aura" ? 0.35 + 0.5 * (op.p || 0) : 0.9);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(4, radius), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function strokePip(ctx, op, toPx, size) {
    const at = op.at || [0, 0];
    const [x, y] = pxAt(toPx, size, at[0], at[1]);
    const r = Math.max(4, size * 0.12);
    ctx.strokeStyle = op.color || "#9aa3ad";
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.7);
    ctx.lineTo(x + r * 0.7, y - r * 0.7);
    ctx.stroke();
  }

  function pipOps(cover, color, p) {
    return (cover || []).map((at) => ({ op: "pip", at: at.slice(), color, p }));
  }

  function dimOps(others, p) {
    return (others || []).map((at) => ({ op: "dim", at: at.slice(), p }));
  }

  function paintDim(ctx, op, toPx, size) {
    const at = op.at || [0, 0];
    const [x, y] = pxAt(toPx, size, at[0], at[1]);
    const p = op.p == null ? 1 : op.p;
    ctx.fillStyle = "#07080c";
    ctx.globalAlpha = 0.72 * Math.max(0, Math.min(1, p));
    ctx.beginPath();
    ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  function layerOpen(beat, layer, p) {
    if (!beat || !layer || layer.id !== beat.aimed) return 0;
    if (beat.kind === "pass") return p;
    if (beat.kind === "impact") return 1;
    return 0;
  }

  function layerOps(beat, p) {
    return (beat.layers || []).map((layer) => ({
      op: "layer",
      at: layer.at.slice(),
      dir: (layer.dir || [1, 0]).slice(),
      kind: layer.id,
      open: layerOpen(beat, layer, p),
      marked: layer.id === beat.aimed,
      color: beat.color,
      p,
    }));
  }

  function layerInk(kind) {
    if (kind === "guard") return "#d5deea";
    if (kind === "membrane") return "#8fb3ff";
    if (kind === "cover") return "#3f8f55";
    return "#9aa3ad";
  }

  // A plate in front of one body. Opening splits that plate. It is not a tile.
  function paintLayer(ctx, op, toPx, size) {
    const at = op.at || [0, 0];
    const [x, y] = pxAt(toPx, size, at[0], at[1]);
    const dir = op.dir || [1, 0];
    const len = Math.hypot(dir[0], dir[1]) || 1;
    const dx = dir[0] / len;
    const dy = dir[1] / len;
    const px = -dy;
    const py = dx;
    const open = Math.max(0, Math.min(1, op.open || 0));
    const half = size * (op.kind === "cover" ? 0.24 : op.kind === "membrane" ? 0.34 : 0.3);
    const gap = open * half * 0.62;
    const along = op.kind === "membrane" ? 5 : op.kind === "cover" ? 6.5 : 7.5;
    ctx.fillStyle = layerInk(op.kind);
    ctx.strokeStyle = op.marked ? (op.color || "#e8f4ff") : layerInk(op.kind);
    ctx.lineWidth = op.marked ? 2 : 1;
    ctx.lineJoin = "round";
    ctx.globalAlpha = op.marked ? 0.96 : 0.78;
    const span = (from, to) => {
      ctx.beginPath();
      ctx.moveTo(x + px * from - dx * along, y + py * from - dy * along);
      ctx.lineTo(x + px * to - dx * along, y + py * to - dy * along);
      ctx.lineTo(x + px * to + dx * along, y + py * to + dy * along);
      ctx.lineTo(x + px * from + dx * along, y + py * from + dy * along);
      ctx.closePath();
      ctx.fill();
      if (op.marked) ctx.stroke();
    };
    if (open > 0.04) {
      span(gap, half);
      span(-half, -gap);
    } else {
      span(-half, half);
    }
    if (op.kind === "guard") {
      ctx.strokeStyle = "#2a3340";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - px * half * 0.55, y - py * half * 0.55);
      ctx.lineTo(x - dx * along, y - dy * along);
      ctx.lineTo(x + px * half * 0.55, y + py * half * 0.55);
      ctx.stroke();
    }
    if (op.kind === "cover") {
      ctx.fillStyle = "#1e4a2c";
      ctx.beginPath();
      ctx.arc(x - px * (half - 5), y - py * (half - 5), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function fillStain(ctx, op, toPx, size) {
    ctx.fillStyle = op.color || "#e2b34a";
    ctx.globalAlpha = 0.28 * (op.p || 1);
    for (const t of op.tiles || []) {
      const [x, y] = pxAt(toPx, size, t[0], t[1]);
      ctx.beginPath();
      ctx.arc(x, y, size * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function fillRise(ctx, op, toPx, size) {
    const p = op.p || 0;
    ctx.fillStyle = op.color || "#fff";
    ctx.globalAlpha = 0.85;
    for (const t of op.tiles || []) {
      const [x, y] = pxAt(toPx, size, t[0], t[1]);
      const h = size * 0.55 * p;
      ctx.fillRect(x - size * 0.12, y + size * 0.2 - h, size * 0.24, Math.max(2, h));
    }
  }

  function fillHatch(ctx, op, toPx, size) {
    ctx.strokeStyle = op.color || "#f08c83";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.setLineDash([4, 3]);
    for (const t of op.tiles || []) {
      const [x, y] = pxAt(toPx, size, t[0], t[1]);
      const s = size * 0.32;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x - s + i * 8, y + s);
        ctx.lineTo(x + s + i * 8, y - s);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  function paintGlyph(ctx, op, x, y, size, toPx) {
    const g = op.glyph;
    if (!g) return false;
    const p = op.p == null ? 1 : op.p;
    const s = size * (op.scale || 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, s * 0.045);
    ctx.globalAlpha = 0.95;
    if (g === "wall") {
      ctx.lineWidth = Math.max(4, s * 0.09);
      ctx.lineCap = "square";
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.28);
      ctx.lineTo(x, y + s * 0.28);
      ctx.stroke();
      return true;
    }
    if (g === "snap") {
      ctx.lineWidth = Math.max(2.5, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.18, y - s * 0.16);
      ctx.lineTo(x - s * 0.1, y);
      ctx.lineTo(x + s * 0.18, y + s * 0.16);
      ctx.stroke();
      return true;
    }
    if (g === "slit") {
      ctx.lineWidth = Math.max(2.5, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.1, y - s * 0.2);
      ctx.lineTo(x - s * 0.1, y + s * 0.2);
      ctx.moveTo(x + s * 0.1, y - s * 0.2);
      ctx.lineTo(x + s * 0.1, y + s * 0.2);
      ctx.stroke();
      return true;
    }
    if (g === "corner") {
      ctx.lineWidth = Math.max(2.5, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.24, y + s * 0.12);
      ctx.lineTo(x + s * 0.04, y + s * 0.12);
      ctx.lineTo(x + s * 0.04, y - s * 0.24);
      ctx.stroke();
      return true;
    }
    if (g === "shelf") {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.36, y + s * 0.24);
      ctx.lineTo(x - s * 0.16, y - s * 0.02);
      ctx.lineTo(x + s * 0.16, y - s * 0.02);
      ctx.lineTo(x + s * 0.36, y + s * 0.24);
      ctx.closePath();
      ctx.fill();
      return true;
    }
    if (g === "ray") {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(4, s * 0.12), 0, Math.PI * 2);
      ctx.stroke();
      return true;
    }
    if (g === "bowl") {
      ctx.lineWidth = Math.max(2.5, s * 0.06);
      ctx.beginPath();
      ctx.arc(x, y - s * 0.1, s * 0.34, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();
      return true;
    }
    if (g === "weight") {
      ctx.fillRect(x - s * 0.22, y - s * 0.22, s * 0.44, s * 0.44);
      return true;
    }
    if (g === "rings") {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.1 * (0.85 + 0.15 * p), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, s * 0.2 * (0.85 + 0.15 * p), 0, Math.PI * 2);
      ctx.stroke();
      return true;
    }
    if (g === "retint") {
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.26);
      ctx.lineTo(x + s * 0.2, y - s * 0.08);
      ctx.lineTo(x + s * 0.14, y + s * 0.16);
      ctx.lineTo(x, y + s * 0.26);
      ctx.lineTo(x - s * 0.14, y + s * 0.16);
      ctx.lineTo(x - s * 0.2, y - s * 0.08);
      ctx.closePath();
      ctx.fill();
      return true;
    }
    if (g === "twin") {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y - s * 0.06);
      ctx.lineTo(x + s * 0.16, y - s * 0.06);
      ctx.stroke();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.08, y + s * 0.08);
      ctx.lineTo(x + s * 0.12, y + s * 0.08);
      ctx.stroke();
      ctx.setLineDash([]);
      return true;
    }
    if (g === "sever") {
      ctx.lineWidth = Math.max(2, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.32, y + s * 0.18);
      ctx.lineTo(x + s * 0.32, y - s * 0.18);
      ctx.stroke();
      return true;
    }
    if (g === "trip") {
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y + s * 0.18);
      ctx.lineTo(x - s * 0.02, y - s * 0.2);
      ctx.moveTo(x - s * 0.02, y + s * 0.18);
      ctx.lineTo(x + s * 0.16, y - s * 0.2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(2.5, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.12, y - s * 0.02);
      ctx.lineTo(x, y + s * 0.16);
      ctx.lineTo(x + s * 0.12, y - s * 0.02);
      ctx.stroke();
      return true;
    }
    if (g === "spread") {
      const dots = [[0, 0, 0.07], [0.16, 0.04, 0.045], [-0.14, 0.08, 0.04], [0.05, -0.16, 0.035], [-0.02, 0.18, 0.03]];
      dots.forEach((d, i) => {
        ctx.globalAlpha = (0.95 - i * 0.16) * (0.7 + 0.3 * p);
        ctx.beginPath();
        ctx.arc(x + d[0] * s, y + d[1] * s, Math.max(2, d[2] * s), 0, Math.PI * 2);
        ctx.fill();
      });
      return true;
    }
    if (g === "snip") {
      ctx.lineWidth = Math.max(2.5, s * 0.055);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.22, y + s * 0.14);
      ctx.lineTo(x + s * 0.02, y - s * 0.08);
      ctx.stroke();
      ctx.fillRect(x + s * 0.1, y - s * 0.24, s * 0.16, s * 0.12);
      return true;
    }
    if (g === "thread") {
      ctx.lineWidth = 1.5;
      if (op.from) {
        const [fx, fy] = pxAt(toPx, size, op.from[0], op.from[1]);
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, Math.max(4, s * 0.09), 0, Math.PI * 2);
      ctx.fill();
      return true;
    }
    if (g === "stages") {
      [0.16, 0, -0.16].forEach((dy, i) => {
        ctx.globalAlpha = 0.35 + i * 0.3;
        ctx.beginPath();
        ctx.arc(x, y + dy * s, Math.max(2, s * 0.045), 0, Math.PI * 2);
        ctx.fill();
      });
      return true;
    }
    if (g === "slice") {
      ctx.lineWidth = Math.max(3, s * 0.08);
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.34);
      ctx.lineTo(x, y + s * 0.34);
      ctx.stroke();
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.14, y);
      ctx.lineTo(x + s * 0.14, y);
      ctx.stroke();
      return true;
    }
    if (g === "scraps") {
      ctx.globalAlpha = 0.92;
      ctx.fillRect(x - s * 0.18, y - s * 0.04, s * 0.2, s * 0.14);
      ctx.globalAlpha = 0.62;
      ctx.fillRect(x - s * 0.02, y - s * 0.16, s * 0.2, s * 0.14);
      return true;
    }
    return false;
  }
  function fillStamp(ctx, op, toPx, size) {
    const at = op.at || [0, 0];
    const [x, y] = pxAt(toPx, size, at[0], at[1]);
    const p = op.p == null ? 1 : op.p;
    ctx.fillStyle = op.color || "#fff";
    ctx.strokeStyle = op.color || "#fff";
    if (paintGlyph(ctx, op, x, y, size, toPx)) return;
    const kind = op.material || "nigredo";
    if (kind === "albedo") {
      ctx.lineWidth = op.width || 2;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.22, y + size * 0.16);
      ctx.lineTo(x + size * 0.22, y - size * 0.16);
      ctx.stroke();
      return;
    }
    if (kind === "citrinitas") {
      ctx.globalAlpha = 0.9;
      const dots = [[-0.16, 0.08], [0.02, -0.14], [0.16, 0.1], [-0.02, 0.16]];
      for (const [dx, dy] of dots) {
        ctx.beginPath();
        ctx.arc(x + dx * size, y + dy * size, Math.max(2, size * 0.06 * (0.6 + 0.4 * p)), 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (kind === "rubedo") {
      ctx.lineWidth = op.width || 3;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.2 * (0.7 + 0.3 * p), Math.PI * 0.15, Math.PI * 1.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, size * 0.32 * (0.7 + 0.3 * p), Math.PI * 1.15, Math.PI * 2.15);
      ctx.stroke();
      return;
    }
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.arc(x, y + size * 0.16, size * 0.2 * (0.65 + 0.35 * p), 0, Math.PI * 2);
    ctx.fill();
  }

  function fillCoil(ctx, op, toPx, size) {
    const at = op.at || [0, 0];
    const [x, y] = pxAt(toPx, size, at[0], at[1]);
    ctx.strokeStyle = op.color || "#f4a261";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.22, 0.4, Math.PI * 1.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.34, Math.PI * 0.9, Math.PI * 2.2);
    ctx.stroke();
  }

  function fillFloat(ctx, op, toPx, size) {
    const at = op.at || [0, 0];
    const [x, y] = pxAt(toPx, size, at[0], at[1]);
    const p = op.p == null ? 1 : op.p;
    let alpha = 1;
    if (!op.hold) {
      if (p < 0.12) alpha = p / 0.12;
      else if (p > 0.78) alpha = Math.max(0, (1 - p) / 0.22);
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = op.color || "#fff";
    ctx.font = `800 ${Math.round(size * 0.28)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(op.text == null ? "" : String(op.text), x, y - size * 0.7 - p * size * 0.55);
  }

  function sampleScript(scr, local) {
    if (!scr || local > scr.tail) return { pose: null, ops: [], done: true, actor: null, flinches: {} };
    const ops = [];
    const flinches = {};
    for (const beat of scr.beats) {
      const drawn = frame(beat, local);
      for (const op of drawn) ops.push(op);
      if (beat.flinch && beat.target && progress(beat, local) != null) flinches[beat.target] = beat.flinch;
    }
    const pose = local <= scr.blockingMs ? scr.pose : null;
    return { pose, ops, done: false, actor: scr.actor || null, flinches };
  }

  function createPlayer() {
    let items = [];
    return {
      push(scr, now) {
        if (!scr) return;
        items.push({ script: scr, t0: now || 0 });
      },
      skip() { items = []; },
      blocking(now) {
        const t = now || 0;
        let wait = 0;
        for (const item of items) wait = Math.max(wait, item.t0 + item.script.blockingMs - t);
        return Math.max(0, wait);
      },
      idle(now) { return this.sample(now).done; },
      sample(now) {
        const t = now || 0;
        const ops = [];
        const groups = [];   // per script: its cue's identity and the ops it drew (fx-sprites.js)
        const poses = {};
        let pose = null;
        let actor = null;
        const keep = [];
        for (const item of items) {
          const local = t - item.t0;
          if (local > item.script.tail) continue;
          keep.push(item);
          if (local < 0) continue;
          const drawn = sampleScript(item.script, local);
          for (const op of drawn.ops) ops.push(op);
          const cue = item.script.cue;
          if (drawn.ops.length) groups.push({ cue: cue ? { concept: cue.concept, effect: cue.effect, type: cue.type, damageType: cue.damageType } : null, ops: drawn.ops });
          if (drawn.pose) {
            pose = drawn.pose;
            actor = drawn.actor;
            if (drawn.actor) poses[drawn.actor] = drawn.pose;
          }
          if (drawn.flinches) {
            for (const id of Object.keys(drawn.flinches)) poses[id] = drawn.flinches[id];
          }
        }
        items = keep;
        return { pose, poses, actor, ops, groups, done: keep.length === 0 };
      },
    };
  }

  function ultimateId(cue) {
    if (!cue) return null;
    if (cue.ability === "recoilCascade" || cue.name === "Recoil Cascade") return "recoilCascade";
    if (cue.ability === "longView" || cue.name === "Long View") return "longView";
    if (cue.ability === "sieveVerdict" || cue.name === "Sieve Verdict") return "sieveVerdict";
    if (cue.ability === "undividedAttention" || cue.name === "Undivided Attention") return "undividedAttention";
    return null;
  }

  function round4(n) {
    return Math.round(n * 10000) / 10000;
  }

  function resolveAimed(built, layers) {
    const ids = (layers || []).map((layer) => layer.id);
    if (built && typeof built.aimed === "string" && ids.includes(built.aimed)) return built.aimed;
    return ids.length ? ids[0] : null;
  }

  function verdictTarget(built) {
    if (built && built.aim) return built.aim.slice();
    if (built && built.tiles && built.tiles.length) return built.tiles[built.tiles.length - 1].slice();
    if (built && built.origin) return built.origin.slice();
    return [0, 0];
  }

  // Plates sit in front of the named body. The aimed plate is on the line.
  // The others stand beside it. None of these coordinates are path tiles.
  function placeLayers(built, target) {
    const layers = (built && built.layers) || [];
    if (!target || !layers.length) return [];
    const origin = (built && built.origin) || [target[0] - 1, target[1]];
    let dx = target[0] - origin[0];
    let dy = target[1] - origin[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const aimed = resolveAimed(built, layers);
    const others = layers.filter((layer) => layer.id !== aimed);
    return layers.map((layer) => {
      const on = layer.id === aimed;
      const sideIndex = others.findIndex((item) => item.id === layer.id);
      const mag = on ? 0 : 0.62 + Math.floor(sideIndex / 2) * 0.36;
      const sign = on ? 0 : (sideIndex % 2 === 0 ? -1 : 1);
      const back = on ? 1.15 : 1.38;
      return {
        id: layer.id,
        at: [round4(target[0] - dx * back + (-dy) * mag * sign), round4(target[1] - dy * back + dx * mag * sign)],
        dir: [round4(dx), round4(dy)],
      };
    });
  }

  function declaredLine(built, tiles, stop) {
    let points = (tiles || []).map((p) => p.slice());
    if (built && built.origin && (!points.length || !same(points[0], built.origin))) points = [built.origin.slice(), ...points];
    return applyStop(points, stop);
  }

  function dressLongView(travel, built) {
    travel.phase = "ray";
    travel.hairline = true;
    travel.width = ULTIMATES.longView.width;
    travel.trail = "ray";
    travel.cover = (built.cover || []).map((p) => p.slice());
  }

  function dressAttention(travel) {
    travel.phase = "thread";
    travel.trail = "thread";
    travel.width = ULTIMATES.undividedAttention.width;
  }

  function attentionLands(built, path, evs) {
    if (!path || path.length < 2) return false;
    const target = verdictTarget(built);
    const end = path[path.length - 1];
    if ((evs || []).some((e) => e && e.kind === "negate") && !same(end, target)) return false;
    return true;
  }

  function attentionMark(built, path, travel) {
    return {
      points: (path || []).map((p) => p.slice()),
      color: (travel && travel.color) || (built && built.color) || "#d3b66f",
      width: ULTIMATES.undividedAttention.width,
      others: ((built && built.others) || []).map((p) => p.slice()),
      at: verdictTarget(built),
    };
  }

  function dressSieve(travel, built) {
    const placed = placeLayers(built, verdictTarget(built));
    travel.phase = "bolt";
    travel.heavy = true;
    travel.width = ULTIMATES.sieveVerdict.width;
    travel.trail = "needle";
    travel.layers = placed;
    travel.aimed = resolveAimed(built, placed);
  }

  // Clipped points, reversed so the stroke grows from the far end back to the
  // caster, then the same points held taut, then the same points forward.
  function recoilBeats(forward) {
    const points = forward.points.map((p) => p.slice());
    const back = points.map((p) => p.slice()).reverse();
    return [
      Object.assign({}, forward, { points: back, phase: "drawback" }),
      {
        kind: "hold", dur: "wait", blocks: true, shape: "line", phase: "hold",
        points: points.map((p) => p.slice()),
        color: forward.color, width: forward.width, trail: forward.trail || "snap",
        damageType: forward.damageType, glyph: forward.glyph,
      },
      Object.assign({}, forward, { points: points.map((p) => p.slice()), phase: "snap" }),
    ];
  }

  function indexOn(path, point) {
    if (!point) return 1e9;
    const i = (path || []).findIndex((p) => same(p, point));
    return i < 0 ? 1e9 : i;
  }

  function orderRecoilEvents(evs, cue, path) {
    const damages = [];
    const others = [];
    for (const e of evs) {
      if (e.kind === "damage") damages.push(e);
      else others.push(e);
    }
    damages.sort((a, b) => indexOn(path, pointOf(cue, a, path)) - indexOn(path, pointOf(cue, b, path)));
    return others.concat(damages);
  }

  function script(cue, events, opts) {
    const evs = Array.isArray(events) ? events.filter(Boolean) : [];
    const built = cue
      ? (cue.pose && cue.delivery && Array.isArray(cue.tiles) ? cue : cueFromAbility(cue, cue))
      : null;
    const stop = built ? (built.stopAt || stopFromEvents(evs)) : null;
    const commit = isCommit(built, evs);
    const announceOnly = evs.some((e) => e.kind === "announce") && !evs.some((e) => e.kind === "damage");
    const ult = ultimateId(built);
    const beats = [];
    let path = [];
    if (built) {
      beats.push({ kind: "pose", dur: "pose", blocks: true, pose: built.pose, actor: built.actor });
      if (commit) {
        const scheduled = evs.find((e) => e.kind === "schedule" && e.tiles);
        const tiles = built.tiles.length ? built.tiles.slice() : normalizeTiles(scheduled && scheduled.tiles);
        beats.push({ kind: "wait", dur: "wait", blocks: true, shape: "hatch", tiles: tiles.length ? tiles : (built.origin ? [built.origin] : []), color: built.color || "#f08c83" });
      } else if (!announceOnly) {
        const travel = travelBeat(built, stop);
        if (travel) {
          if (travel.points) path = travel.points;
          if (ult === "recoilCascade" && travel.shape === "line" && travel.points && travel.points.length) {
            for (const beat of recoilBeats(travel)) beats.push(beat);
          } else {
            if (ult === "longView" && travel.shape === "line") dressLongView(travel, built);
            if (ult === "sieveVerdict" && travel.shape === "line") dressSieve(travel, built);
            if (ult === "undividedAttention" && travel.shape === "line") dressAttention(travel);
            beats.push(travel);
          }
        }
      }
    }
    if (!commit) {
      if (ult === "sieveVerdict" && built && !announceOnly && evs.some((e) => e && e.kind === "damage")) {
        const travel = beats.find((b) => b.kind === "travel");
        const placed = travel && travel.layers
          ? travel.layers.map((layer) => ({ id: layer.id, at: layer.at.slice(), dir: (layer.dir || [1, 0]).slice() }))
          : placeLayers(built, verdictTarget(built));
        beats.push({
          kind: "pass", dur: "wait", blocks: true, phase: "pass",
          points: (path || []).map((p) => p.slice()),
          color: (travel && travel.color) || built.color,
          width: ULTIMATES.sieveVerdict.width,
          heavy: true,
          layers: placed,
          aimed: travel && travel.aimed != null ? travel.aimed : resolveAimed(built, placed),
          at: verdictTarget(built),
        });
      }
      const list = ult === "recoilCascade" && !announceOnly ? orderRecoilEvents(evs, built, path) : evs;
      for (const e of list) {
        if (announceOnly && e.kind === "announce") continue;
        addEvent(beats, built, e, path);
      }
    }
    if (ult === "undividedAttention" && built && !announceOnly && !commit && attentionLands(built, path, evs)) {
      const travel = beats.find((b) => b.kind === "travel");
      const mark = attentionMark(built, path, travel);
      beats.push(Object.assign({ kind: "dim", dur: "wait", blocks: true, phase: "dim" }, mark));
      beats.push(Object.assign({ kind: "along", dur: "wait", blocks: true, phase: "along" }, mark, {
        points: mark.points.map((p) => p.slice()),
        others: mark.others.map((p) => p.slice()),
      }));
    }
    if (ult === "longView" && built && !announceOnly && !commit) {
      beats.push({
        kind: "exposed", dur: "wait", blocks: true, shape: "aura", phase: "exposed",
        origin: (built.origin || [0, 0]).slice(),
        color: built.color || "#c6e6dd",
        actor: built.actor,
      });
    }
    if (announceOnly) {
      const ann = evs.find((e) => e.kind === "announce");
      const tiles = normalizeTiles(ann && ann.tiles);
      const use = tiles.length ? tiles : (built && built.tiles.length ? built.tiles.slice() : []);
      const origin = (built && built.origin) || use[0] || [0, 0];
      const color = (built && built.color) || "#ff5d5d";
      if (ult === "recoilCascade" || ult === "longView" || ult === "sieveVerdict" || ult === "undividedAttention") {
        const points = declaredLine(built, use, stop);
        const beat = {
          kind: "announce", dur: "announce", blocks: true, shape: "line",
          points, tiles: use, origin, color, dash: true,
        };
        if (ult === "longView") {
          beat.width = ULTIMATES.longView.width;
          beat.hairline = true;
          beat.cover = (built.cover || []).map((p) => p.slice());
        }
        if (ult === "sieveVerdict") {
          const placed = placeLayers(built, verdictTarget(built));
          beat.width = ULTIMATES.sieveVerdict.width;
          beat.heavy = true;
          beat.layers = placed;
          beat.aimed = resolveAimed(built, placed);
        }
        if (ult === "undividedAttention") beat.width = ULTIMATES.undividedAttention.width;
        beats.push(beat);
      } else {
        beats.push({
          kind: "announce", dur: "announce", blocks: true, shape: "envelope",
          tiles: use, origin, radius: fieldRadius(origin, use),
          color, dash: true,
        });
      }
    }
    const raised = ult && ULTIMATES[ult] && ULTIMATES[ult].cap != null && (opts == null || opts.cap == null);
    const layoutOpts = raised ? Object.assign({ cap: ULTIMATES[ult].cap }, opts) : opts;
    const timed = layout(beats, layoutOpts);
    return { pose: built ? built.pose : null, actor: built ? built.actor : null, beats, blockingMs: timed.blockingMs, tail: timed.tail, path, cue: built };
  }

  return {
    DURATIONS, MATERIALS, DEFAULTS, CONCEPTS, SHAPES, ULTIMATES, tint, look, cueFromAbility, actionLabel, facingRight, stopFromEvents, lineTiles,
    ultimateId, script, marks, frame, createPlayer, paint,
  };
});
