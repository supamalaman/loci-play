"use strict";
// The Redux loading screen (PLAN-redux-loading-screen.md; Mala, 2026-11-03: every Redux fight, the line "{Encounter Title} Loading...", one sheet now and a
// socket for more). Redux serves every sprite over the network, so a battle used to open while its art was still arriving. start(o) in ui.js shows this
// over the field, waits for the art the battle will draw (neededImages) with a floor and a ceiling (whenReady), then opens the narration and lets the AI act.
// Pure functions first, one small DOM part last. The Mac app reads its art from disk and never shows it (shouldShow reads the page protocol).
//
//   LOADING_ART                              the socket: { id, src, alt } entries; a later drop adds a line here (and the file under web/combat/ui-art/loading/)
//   RULES                                    { minMs, maxMs }: the overlay stays at least minMs (no flash) and gives up waiting after maxMs (a stuck load never holds the fight)
//   shouldShow(ctx)                          ctx { protocol, force, testBattle, practice, steps, autoplay, autostart } -> boolean
//   titleOf(ctx)                             "<Title> Loading..." from ctx { setupTitle, encounterName }; "the field" when neither exists
//   pickArt(seed)                            one LOADING_ART entry, the same one for the same seed
//   neededImages(state, deps)                the image paths the battle draws first (unit poses, ground tiles, ground textures, plants); deps supplies the ui.js resolvers
//   whenReady(urls, opts)                    Promise<{ total, loaded, failed, timedOut }>; opts { minMs, maxMs, onProgress(loaded, total), load(url) -> Promise<boolean> }
//   mountOverlay(doc, parent, opts)          builds #ccLoading (art, title line, a progress bar) and returns { progress(loaded, total), remove() }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatLoading = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const LOADING_ART = [
    { id: "warden-awakens", src: "combat/ui-art/loading/warden-awakens.webp", alt: "A golden cybernetic warden awakens in a night courtyard, a young scholar watching with a book of light." },
  ];
  const RULES = { minMs: 600, maxMs: 9000 };

  function shouldShow(ctx = {}) {
    if (ctx.force) return true;                                              // ?loading=1: preview and the browser test (a file:// page would otherwise skip)
    if (ctx.testBattle || ctx.practice || ctx.steps || ctx.autoplay || ctx.autostart) return false;   // local, scripted or instant starts have nothing to wait for
    return !!ctx.protocol && ctx.protocol !== "file:";                       // the Mac app loads a file URL; Redux and `--serve` load http(s)
  }

  const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  function titleOf(ctx = {}) {
    let t = clean(ctx.setupTitle) || clean(ctx.encounterName) || "the field";
    if (t.length > 64) t = t.slice(0, 61).trimEnd() + "…";   // a random scenario's setup title is a whole sentence
    return `${t} Loading...`;
  }

  function pickArt(seed = 0) {
    let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return LOADING_ART[(h >>> 0) % LOADING_ART.length];
  }

  // The first things a battle draws. Everything here has a fallback drawing (a token, the old tile), so anything NOT listed (optional poses, faces,
  // hazards, weather, auras, status icons, smoke, wild creatures, items, walls, decorations, the isometric view's ground when that view is off) still arrives lazily as it does today; listing the rest
  // would be a longer wait for art the player may never see in the first seconds.
  //   deps.folderOf(actor)       the sprite folder an actor is drawn from, or null
  //   deps.posesOf(folder)       the pose names that folder loads at boot
  //   deps.groundIds(state)      ids ("<set folder>/<name>") of the ground tiles the arena draws, as ui.js picks them
  //   deps.textureIds()          ids of the ground textures (apron, tops)
  //   deps.plantFiles(state)     "<type>-<stage>" names of the species plants on the field
  //   deps.objectIds(state)      ids of the object sprites the flat board draws for the field's props (trees, hedges, houses, parterres)
  function neededImages(state, deps = {}) {
    const urls = new Set(), add = (p) => { if (p) urls.add(p); };
    for (const a of Object.values(state?.actors || {})) {
      const folder = deps.folderOf?.(a); if (!folder) continue;
      for (const pose of deps.posesOf?.(folder) || []) add(`combat/sprites/${folder}/${pose}.png`);
    }
    for (const id of deps.groundIds?.(state) || []) add(`combat/sprites/objects/${id}.png`);
    for (const id of deps.textureIds?.(state) || []) add(`combat/sprites/objects/${id}.png`);
    for (const name of deps.plantFiles?.(state) || []) add(`combat/sprites/plants/${name}.png`);
    for (const id of deps.objectIds?.(state) || []) add(`combat/sprites/objects/${id}.png`);
    return [...urls];
  }

  const defaultLoad = (url) => new Promise((resolve) => {
    if (typeof Image === "undefined") { resolve(false); return; }
    const img = new Image();
    img.onload = () => resolve(true); img.onerror = () => resolve(false);
    img.src = typeof document !== "undefined" ? new URL(url, document.baseURI).href : url;   // the same URL the battle draws: the browser cache serves it
  });

  // Resolves when every image has loaded or failed, but never before minMs and never later than maxMs. A load that never answers cannot hold it.
  // Both bounds are timers (no clock reads), so they behave the same in a page and in a virtual-time test harness.
  function whenReady(urls, opts = {}) {
    const { minMs = RULES.minMs, maxMs = RULES.maxMs, onProgress = null, load = defaultLoad } = opts;
    const list = [...new Set(urls || [])], total = list.length;
    let loaded = 0, failed = 0, done = false, floorMet = minMs <= 0, allIn = total === 0;
    return new Promise((resolve) => {
      let ceiling = null, floor = null;
      const finish = (timedOut) => {
        if (done) return; done = true; clearTimeout(ceiling); clearTimeout(floor);
        if (onProgress) onProgress(timedOut ? loaded + failed : total, total);
        resolve({ total, loaded, failed, timedOut });
      };
      const tryFinish = () => { if (allIn && floorMet) finish(false); };
      ceiling = setTimeout(() => finish(true), maxMs);
      if (!floorMet) floor = setTimeout(() => { floorMet = true; tryFinish(); }, minMs);
      if (onProgress) onProgress(0, total);
      if (!total) { tryFinish(); return; }
      for (const url of list) {
        Promise.resolve().then(() => load(url)).then((ok) => ok, () => false).then((ok) => {
          if (done) return;
          if (ok) loaded++; else failed++;
          if (onProgress) onProgress(loaded + failed, total);
          if (loaded + failed >= total) { allIn = true; tryFinish(); }
        });
      }
    });
  }

  // The overlay is a sibling over the field (not inside #ccOverlay, which start() hides): art, a dark scrim, the title line and a thin bar.
  function mountOverlay(doc, parent, { title, art, total = 0, reduced = false } = {}) {
    const el = doc.createElement("div");
    el.id = "ccLoading"; el.className = "cc-loading" + (reduced ? " is-calm" : "");
    el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    const img = doc.createElement("img"); img.className = "cc-loading-art"; img.alt = art?.alt || ""; if (art?.src) img.src = art.src;
    const body = doc.createElement("div"); body.className = "cc-loading-body";
    const line = doc.createElement("p"); line.className = "cc-loading-title"; line.textContent = title || "Loading...";
    const bar = doc.createElement("div"); bar.className = "cc-loading-bar"; bar.setAttribute("role", "progressbar"); bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", String(total));
    const fill = doc.createElement("div"); fill.className = "cc-loading-fill"; bar.appendChild(fill);
    body.appendChild(line); body.appendChild(bar); el.appendChild(img); el.appendChild(body); parent.appendChild(el);
    return {
      el,
      progress(loaded, of) { const pct = of > 0 ? Math.max(0, Math.min(100, Math.round((loaded / of) * 100))) : 100; fill.style.width = pct + "%"; bar.setAttribute("aria-valuenow", String(loaded)); bar.setAttribute("aria-valuemax", String(of)); },
      remove() { if (el.parentNode) el.parentNode.removeChild(el); },
    };
  }

  return { LOADING_ART, RULES, shouldShow, titleOf, pickArt, neededImages, whenReady, mountOverlay };
});
