// FX3: a three.js effect painter beside the 2D one (claude-fx3-bastion-spec, R-20261114-27, R-20261114-29).
// Slice F1, the chain test: this classic script creates a transparent layer over the battle canvas (#ccCanvas) and
// loads three.js (web/combat/three.module.min.mjs, r170, MIT, web/combat/THIRD-PARTY.md) only when asked, never at
// page load. With the debug flag it draws one test quad and records what happened in FX3.state. Nothing else calls it
// yet: F3 asks it before FX.paint for Bastion Collapse. Off unless asked, so tests and players see no change.
// The debug flag: `?fx3test` on the page URL, or the native app's `--fx3-test` launch option (Loci.swift), which
// calls FX3.debugQuad() after the battle opens.
(function (root) {
  "use strict";
  const doc = typeof document !== "undefined" ? document : null;
  // The library sits beside this file; resolve it from this script's own URL so every page (web/, web/combat/) agrees.
  const SELF = (doc && doc.currentScript && doc.currentScript.src) || "";
  const LIB_FILE = "three.module.min.mjs";
  const LIB_VERSION = "170";        // the version the notice names; tests/fx3.test.mjs holds the library's first bytes to it
  const QUAD = [233, 196, 106];     // the test quad's colour (the game's gold, #e9c46a), read back to prove a real draw

  // status: "idle" (nothing asked), "loading", "ready" (library loaded), "drawn" (the test quad read back),
  // "cannot-draw" (no WebGL, or the library would not load; `reason` says which). The 2D painter never waits on it.
  const state = { status: "idle", reason: "", version: null, pixel: null, layer: null };
  let lib = null, loading = null, renderer = null;

  const libUrl = () => {
    try { return new URL(LIB_FILE, SELF || (root.location && root.location.href) || "").href; } catch (e) { return LIB_FILE; }
  };
  const debugFlag = () => {
    try { return new URLSearchParams(root.location.search).has("fx3test"); } catch (e) { return false; }
  };
  const cannot = (reason) => { state.status = "cannot-draw"; state.reason = reason; return false; };

  // WebGL is asked for only here, only when FX3 is asked to draw. A throwaway canvas: the answer, then the context is released.
  function webglAvailable() {
    if (!doc) return false;
    try {
      const c = doc.createElement("canvas"), gl = c.getContext("webgl2") || c.getContext("webgl");
      if (!gl) return false;
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  }

  // Loads three.js once per page. A dynamic import from a classic script: the native app and the test browser both
  // load it from a file URL (the F1 question; spec pre-mortem row 1). Resolves to the module, or null when it fails.
  function load() {
    if (lib) return Promise.resolve(lib);
    if (loading) return loading;
    state.status = "loading";
    loading = import(libUrl()).then((m) => {
      lib = m; state.version = m.REVISION || null; state.status = "ready"; return m;
    }, (e) => { loading = null; cannot("library: " + String(e && e.message || e).slice(0, 160)); return null; });
    return loading;
  }

  // The layer: a transparent canvas laid exactly over the battle canvas, in the same parent, never taking a click.
  // It copies the canvas's place, size and pixel ratio each time it is asked (a resize rebuilds it in F3).
  function layerFor(canvas) {
    if (!doc || !canvas || !canvas.parentNode) return null;
    let layer = canvas.parentNode.querySelector("canvas.cc-fx3-layer");
    if (!layer) {
      layer = doc.createElement("canvas");
      layer.className = "cc-fx3-layer";
      layer.setAttribute("aria-hidden", "true");
      canvas.parentNode.insertBefore(layer, canvas.nextSibling);
    }
    const dpr = root.devicePixelRatio || 1, w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    Object.assign(layer.style, { position: "absolute", left: canvas.offsetLeft + "px", top: canvas.offsetTop + "px",
      width: w + "px", height: h + "px", pointerEvents: "none", zIndex: "1" });
    layer.width = Math.max(1, Math.round(w * dpr)); layer.height = Math.max(1, Math.round(h * dpr));
    state.layer = { width: layer.width, height: layer.height, dpr };
    return layer;
  }

  // The chain test: layer, library, renderer, one quad, one pixel read back from the middle of the layer.
  async function debugQuad() {
    const canvas = doc && doc.getElementById("ccCanvas");
    if (!canvas) return cannot("no battle canvas");
    if (!webglAvailable()) return cannot("no WebGL");
    const T = await load();
    if (!T) return false;
    try {
      const layer = layerFor(canvas);
      if (!renderer) renderer = new T.WebGLRenderer({ canvas: layer, alpha: true, antialias: false, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(layer.width, layer.height, false); renderer.setClearColor(0x000000, 0);
      const scene = new T.Scene(), camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const quad = new T.Mesh(new T.PlaneGeometry(0.5, 0.5), new T.MeshBasicMaterial({ color: new T.Color(QUAD[0] / 255, QUAD[1] / 255, QUAD[2] / 255) }));
      scene.add(quad);
      T.ColorManagement.enabled = false; renderer.outputColorSpace = T.LinearSRGBColorSpace;    // the quad's bytes as written
      renderer.render(scene, camera);
      const gl = renderer.getContext(), px = new Uint8Array(4);
      gl.readPixels(Math.floor(layer.width / 2), Math.floor(layer.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      state.pixel = Array.from(px);
      const near = QUAD.every((v, i) => Math.abs(px[i] - v) <= 3) && px[3] > 200;
      if (!near) return cannot("quad not read back: " + state.pixel.join(","));
      state.status = "drawn"; state.reason = "";
      return true;
    } catch (e) { return cannot("render: " + String(e && e.message || e).slice(0, 160)); }
  }

  // With the page flag, run the chain test once the battle canvas exists (the battle opens a moment after load). It waits
  // on the page itself, not on a clock: a loaded machine can take longer than any fixed window (seen once in five runs).
  function autoDebug() {
    if (!debugFlag()) return;
    const run = () => debugQuad().catch((e) => cannot("chain test: " + String(e && e.message || e).slice(0, 160)));
    if (doc.getElementById("ccCanvas")) return run();
    const watch = new MutationObserver(() => { if (doc.getElementById("ccCanvas")) { watch.disconnect(); run(); } });
    watch.observe(doc.documentElement, { childList: true, subtree: true });
  }
  if (doc) { if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", autoDebug); else autoDebug(); }

  // F3: Bastion Collapse painter. The script owns time; this is a pure function of (script, folded, caster, t).
  // Off unless asked. Iso is not mine until F5. No WebGL means the 2D painter keeps the frame.
  const STORE_KEY = "loci:combat:fx3";
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const seg = (t, a, b) => clamp01((t - a) / Math.max(1e-6, b - a));
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  let held = new Set(), scene = null, camera = null, slabMeshes = [];

  function tileKey(x, y) { return x + "," + y; }
  function toCentre(centre, tile) {
    if (typeof centre === "function") return (x, y) => {
      const p = centre(x, y);
      if (Array.isArray(p)) return p;
      if (p && Number.isFinite(p.x)) return [p.x, p.y];
      return [(x + 0.5) * tile, (y + 0.5) * tile];
    };
    return (x, y) => [(x + 0.5) * tile, (y + 0.5) * tile];
  }

  function plan(script, folded) {
    const beats = (script && script.beats) || [];
    const poseB = beats.find((b) => b.kind === "pose");
    const travel = beats.find((b) => b.kind === "travel");
    const pose = { t0: poseB ? poseB.start : 0, t1: poseB ? poseB.end : 0 };
    const fold = travel ? { t0: travel.start, t1: travel.end } : { t0: pose.t1, t1: pose.t1 };
    const impacts = beats.filter((b) => b.kind === "impact").map((b) => ({
      t0: b.start, t1: b.end, x: (b.at && b.at[0]) || 0, y: (b.at && b.at[1]) || 0, target: b.target
    }));
    const left = (folded || []).map((w) => ({ x: w.x, y: w.y, kind: w.kind }));
    const n = left.length, m = impacts.length, slabs = [];
    const blockingMs = script && script.blockingMs || 0;
    if (!m) return { slabs, pose, fold, blockingMs };
    impacts.forEach((im, i) => {
      const quota = Math.floor(n / m) + (i >= m - n % m ? 1 : 0), k = (im.t1 - im.t0) / 220;
      left.sort((p, q) => (Math.abs(p.x - im.x) + Math.abs(p.y - im.y)) - (Math.abs(q.x - im.x) + Math.abs(q.y - im.y)));
      const mine = left.splice(0, quota);
      mine.sort((p, q) => p.x - q.x);
      const base = { im, i, tc: im.t0, holdMs: 110 * k, backMs: 96 * k, pose, fold, blockingMs };
      if (mine.length === 1) for (const sgn of [-1, 1]) slabs.push(Object.assign({}, base, { w: mine[0], sgn, twin: sgn }));
      else mine.slice(0, 2).forEach((w, j) => slabs.push(Object.assign({}, base, { w, sgn: j === 0 ? -1 : 1, twin: 0 })));
    });
    return { slabs, pose, fold, blockingMs };
  }

  function slabAt(sl, idx, t, caster, toPx, tile) {
    const blockingMs = sl.blockingMs, tt = Math.min(t, blockingMs);
    const [fx, fy] = toPx(sl.im.x, sl.im.y);
    const [ccx, ccy] = toPx(caster.x, caster.y);
    const [bx, by] = toPx(sl.w.x, sl.w.y);
    const b = { cx: bx, y: by - tile * 0.4, w: tile * 0.72, h: tile * 1.05 };
    const fd = sl.fold.t1 - sl.fold.t0;
    const throwMs = Math.max(120, fd * 0.5);
    const launch = Math.max(sl.fold.t0 + fd * 0.3, sl.tc - throwMs);
    const lift = easeOut(seg(tt, sl.pose.t0, sl.fold.t0));
    const ang = Math.atan2(fy - ccy, fx - ccx), cs = Math.cos(ang);
    const side = Math.abs(cs) > 0.5 ? (cs >= 0 ? 1 : -1) : sl.sgn;
    const A = [b.cx, b.y + b.h / 2 - lift * 12];
    const C = [ccx + side * (124 + (sl.sgn === side ? 34 : 0)), ccy - 24 + Math.sin(ang) * tile * 0.95 + (sl.sgn === side ? -10 : 14)];
    const D = [fx + sl.sgn * (4 + b.w / 2), fy - 14];
    const p1 = easeInOut(seg(tt, sl.fold.t0, launch)), q = seg(tt, launch, sl.tc), p2 = q * q;
    const hump = Math.sin(Math.PI * p1);
    const x = A[0] + (C[0] - A[0]) * p1 + (D[0] - C[0]) * p2;
    const y = A[1] + (C[1] - A[1]) * p1 + (D[1] - C[1]) * p2 - hump * 22;
    const rebuildEnd = sl.tc + sl.holdMs + sl.backMs;
    const gone = seg(tt, sl.tc + sl.holdMs, rebuildEnd);
    const hold = lift > 0.01 && tt < rebuildEnd && tt < blockingMs;
    const sinceContact = tt - sl.tc;
    const punch = sinceContact >= 0 && sinceContact <= 90 ? 1 + 0.1 * (1 - sinceContact / 90) : 1;
    return { w: sl.w, sgn: sl.sgn, twin: sl.twin, tc: sl.tc, holdMs: sl.holdMs, backMs: sl.backMs, rebuildEnd,
      hold, x, y, z: hump * 90, pw: b.w, ph: b.h, alpha: lift * (1 - gone), spin: p1 * 0.5 * (idx % 2 ? 1 : -1), punch };
  }

  function slabsAt(script, folded, caster, t, tile, centre) {
    const size = tile || 48, toPx = toCentre(centre, size), who = caster || { x: 0, y: 0 };
    const p = plan(script, folded);
    return p.slabs.map((sl, i) => slabAt(sl, i, t == null ? 0 : t, who, toPx, size));
  }

  // F4: each folded kind flies as its own pane. Walls and objects keep the F3 stone; barriers read as
  // pale blue, wards as gold (the ward ring), and the dream edge as violet. Opacity stays high so the
  // slab reads as carried stone, not glow (R-20261121-05 keeps the opaque look for F3/F4).
  function styleFor(kind) {
    if (kind === "barrier") return { color: 0x7fa8c9, opacity: 0.92 };
    if (kind === "ward") return { color: 0xe8c15a, opacity: 0.92 };
    if (kind === "dreamEdge") return { color: 0x9a86d6, opacity: 0.92 };
    return { color: 0x8d8678, opacity: 1 };
  }

  // F4: one impact window per foe hit: contact at tc, release when its slabs finish rebuilding.
  function windows(script, folded) {
    const p = plan(script, folded || []);
    return p.slabs.map((sl) => ({ x: sl.im.x, y: sl.im.y, target: sl.im.target, tc: sl.tc, rebuildEnd: sl.tc + sl.holdMs + sl.backMs }));
  }

  // F4: the foe squeezed between its slabs. Scale 1 outside [tc, rebuildEnd); down to 0.8 at contact,
  // easing back to 1 at release so the draw width is exact again after. Pure in (script, folded, actor, t).
  function squeezeFor(script, folded, actor, t) {
    const tt = t == null ? 0 : t;
    let sx = 1;
    for (const w of windows(script, folded)) {
      const hit = (actor && actor.id != null && w.target != null) ? actor.id === w.target
        : (actor && w.x === actor.x && w.y === actor.y);
      if (!hit) continue;
      if (!(tt >= w.tc && tt < w.rebuildEnd)) continue;
      const p = (tt - w.tc) / Math.max(1e-6, w.rebuildEnd - w.tc);
      const s = 1 - 0.2 * (1 - p);
      if (s < sx) sx = s;
    }
    return sx;
  }

  function clearLayer() {
    if (!renderer) return;
    try {
      while (slabMeshes.length) scene.remove(slabMeshes.pop());
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
    } catch (e) {}
  }
  function release() { held = new Set(); clearLayer(); }

  function sync(opts) {
    const o = opts || {};
    if (!o.playing || !o.script) { release(); return []; }
    const slabs = slabsAt(o.script, o.folded || [], o.caster || { x: 0, y: 0 }, o.t == null ? 0 : o.t, o.tile, o.centre);
    held = new Set();
    for (const sl of slabs) if (sl.hold) held.add(tileKey(sl.w.x, sl.w.y));
    return slabs;
  }

  function holds(x, y) { return held.has(tileKey(x, y)); }

  function mine(opts) {
    const o = opts || {};
    if (!o.on || !o.fullAnimation || o.iso) return false;
    if (!o.playing || !o.script) return false;
    const cue = o.script.cue || {};
    const FX = root.ConceptCombatFX;
    if (FX && typeof FX.ultimateId === "function") return FX.ultimateId(cue) === "bastionCollapse";
    return cue.ability === "bastionCollapse" || cue.name === "Bastion Collapse" || cue.id === "bastionCollapse";
  }

  function paint(opts) {
    const o = opts || {};
    if (!mine(o)) { release(); return false; }
    if (!doc || !webglAvailable()) { release(); return false; }
    if (!lib) { load(); return false; }
    const elapsed = o.elapsed == null ? 0 : o.elapsed;
    const slabs = sync({ script: o.script, folded: o.folded, caster: o.caster, t: elapsed, playing: true, tile: o.tile, centre: o.centre });
    if (!slabs.some((sl) => sl.hold || sl.alpha >= 0.02)) { clearLayer(); return false; }
    const canvas = o.canvas || (doc.getElementById && doc.getElementById("ccCanvas"));
    if (!canvas) return false;
    try {
      const layer = layerFor(canvas);
      if (!layer) return false;
      const T = lib;
      const cssW = canvas.clientWidth || canvas.width || 1, cssH = canvas.clientHeight || canvas.height || 1;
      if (!renderer) renderer = new T.WebGLRenderer({ canvas: layer, alpha: true, antialias: false, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(layer.width, layer.height, false); renderer.setClearColor(0x000000, 0);
      T.ColorManagement.enabled = false; renderer.outputColorSpace = T.LinearSRGBColorSpace;
      if (!scene) scene = new T.Scene();
      camera = new T.OrthographicCamera(0, cssW, 0, cssH, -1000, 1000);
      camera.position.set(0, 0, 10);
      while (slabMeshes.length) scene.remove(slabMeshes.pop());
      const geo = new T.PlaneGeometry(1, 1);
      for (const sl of slabs) {
        if (sl.alpha < 0.02) continue;
        const st = styleFor(sl.w.kind);
        const mat = new T.MeshBasicMaterial({ color: st.color, transparent: true, opacity: Math.max(0.35, Math.min(st.opacity, sl.alpha)), depthTest: false });
        const m = new T.Mesh(geo, mat);
        m.position.set(sl.x, sl.y, 0);
        m.scale.set(sl.pw * (sl.punch || 1), sl.ph * (sl.punch || 1), 1);
        m.rotation.z = sl.spin || 0;
        scene.add(m); slabMeshes.push(m);
      }
      renderer.render(scene, camera);
      return true;
    } catch (e) { cannot("paint: " + String(e && e.message || e).slice(0, 160)); return false; }
  }

  root.FX3 = { state, load, layerFor, debugQuad, libUrl, LIB_VERSION, QUAD, slabsAt, holds, mine, paint, release, sync, styleFor, windows, squeezeFor, STORE_KEY };
})(typeof window !== "undefined" ? window : globalThis);
