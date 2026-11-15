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

  root.FX3 = { state, load, layerFor, debugQuad, libUrl, LIB_VERSION, QUAD };
})(typeof window !== "undefined" ? window : globalThis);
