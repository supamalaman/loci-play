/* Walk engine — a shared "walkable explainer" figure (a mini memory palace).
 *
 * Any explainer can include this and add a `walk` block to its explainer-data.js:
 *
 *   walk: {
 *     theme: "alpine",                 // palette (see THEMES)
 *     legend: { "#": "rock", ".": "ground", ... },   // optional, merged over DEFAULT_LEGEND
 *     map: ["#####", "#...#", ...],    // rows of tile characters; every row same length
 *     start: { x, y, facing },
 *     stations: [ { id, x, y, object, title, cue, pages: [text...], section } ]
 *   }
 *
 * Stations are the loci: numbered in array order (the route), solid on the map, and
 * read by facing them and pressing Enter. `section` names a data.sections key; the last
 * page offers "Read more", which scrolls to that prose. `cue` is the recall prompt.
 *
 * Controls: WASD / arrows move (Shift = faster), Enter / Space interact, Esc menu,
 * R toggles Recall mode. All art (tiles, objects, the Tourist sprite) is original,
 * drawn from primitives. Progress lives in localStorage per explainer.
 *
 * Mount:  WalkEngine.mount(document.getElementById("walk"), ExplainerShell.data)
 * Options (all optional; defaults are the explainer-page behaviour):
 *   storageKey  — progress namespace (default "walk:" + location.pathname); hosts showing
 *                 several walks on one page (the Loci app) pass one per walk
 *   onReadMore(sectionKey) — handle "Read more" yourself instead of scrolling the page
 *   fit         — "width" (default) or "contain": also fit the canvas to the stage height
 *   extraMenu   — [[label, fn], ...] appended to the Esc route menu (e.g. "Leave walk")
 */
(function () {
  "use strict";

  const T = 16;                       // tile size in art pixels
  const STEP_MS = 170, RUN_MS = 95;   // time per tile
  const SPRITE = new URL("sprites/tourist.png", document.currentScript.src).href;
  // Sheet order: 0 down, 1 up, 2 right, 3-4 walk down, 5-6 walk up, 7-8 walk right (left = mirrored).
  const FRAMES = { down: [3, 0, 4, 0], up: [5, 1, 6, 1], left: [7, 2, 8, 2], right: [7, 2, 8, 2] };
  const STAND = { down: 0, up: 1, left: 2, right: 2 };
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEYS = { w: "up", arrowup: "up", s: "down", arrowdown: "down", a: "left", arrowleft: "left", d: "right", arrowright: "right" };

  const DEFAULT_LEGEND = {
    "#": "rock", ".": "ground", ",": "grass", "=": "path", "~": "water", "T": "pine",
    "t": "shrub", "^": "scree", "*": "flowers", "o": "boulder", "_": "snow", "w": "wall", "f": "floor"
  };
  const SOLID = new Set(["rock", "water", "pine", "boulder", "wall", "shrub"]);

  const THEMES = {
    alpine: { ground: ["#cbb79a", "#bfa98a", "#d6c3a6"], grass: ["#8fa86a", "#7f9a5d", "#9cb577"], path: ["#e2d2b2", "#d8c6a3"],
              rock: ["#8c8790", "#77727c", "#a29ea6"], scree: ["#b3aca4", "#a39c94", "#c2bcb5"], water: ["#5d8fb8", "#4f7fa8"],
              pine: ["#3f6b4b", "#2f5639", "#5a8a5f"], trunk: "#6b4a34", snow: ["#eef2f6", "#dfe6ee"], flowers: ["#f2c14e", "#e86f7a", "#b48ae0"],
              shrub: ["#6f8f55", "#58773f"], wall: ["#7a6a5c", "#655648"], floor: ["#c9b08a", "#bda27a"], sky: "#e9e3d6", ink: "#2b2731" },
    garden: { ground: ["#b9a27c", "#ab946f", "#c6b08b"], grass: ["#6fae6a", "#5f9d5b", "#80bd78"], path: ["#e4d6b8", "#d8c8a6"],
              rock: ["#8a8f96", "#757a82", "#a0a5ab"], scree: ["#b8b2aa", "#a8a198", "#c6c0b8"], water: ["#4f9bc6", "#428ab4"],
              pine: ["#2f7a4b", "#22663b", "#3f935d"], trunk: "#6b4a34", snow: ["#f0f4f7", "#e2e8ee"], flowers: ["#ff8fab", "#ffd166", "#c59df2"],
              shrub: ["#5c9a55", "#4b8545"], wall: ["#8b7765", "#76624f"], floor: ["#d6bf98", "#c9b088"], sky: "#e6efe2", ink: "#23302a" },
  };

  // ── deterministic noise so pre-rendered tiles look varied but stable ──────
  const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const pick = (arr, x, y, s) => arr[Math.floor(hash(x, y, s) * arr.length) % arr.length];

  // ── tile painter (all primitives) ─────────────────────────────────────────
  function paintTile(g, kind, x, y, P, under) {
    const X = x * T, Y = y * T;
    const fill = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(X + a, Y + b, w, h); };
    const speckle = (cols, n, seed) => { for (let i = 0; i < n; i++) fill(pick(cols, x, y, seed + i), Math.floor(hash(x, y, seed + i * 7) * 15), Math.floor(hash(x, y, seed + i * 11) * 15), 1, 1); };
    // Objects sitting on terrain (pine, boulder, shrub, flowers) take the base of what's around them.
    const base = { pine: under || "ground", shrub: under || "grass", boulder: under || "ground", flowers: under || "grass", rock: "scree" }[kind] || kind;
    const baseCols = P[base] || P.ground;
    fill(baseCols[0], 0, 0, T, T);
    speckle(baseCols, 10, 1);
    switch (kind) {
      case "grass": for (let i = 0; i < 5; i++) { const a = Math.floor(hash(x, y, 40 + i) * 14), b = Math.floor(hash(x, y, 50 + i) * 12) + 2; fill(P.grass[1], a, b, 1, 2); fill(P.grass[2], a + 1, b - 1, 1, 2); } break;
      case "path": speckle(P.path, 6, 3); break;
      case "scree": for (let i = 0; i < 4; i++) fill(P.rock[1], Math.floor(hash(x, y, 60 + i) * 13), Math.floor(hash(x, y, 70 + i) * 13), 3, 2); break;
      case "snow": speckle(P.snow, 4, 9); break;
      case "water": { const t = (x + y) % 2; fill(P.water[1], 0, 0, T, T); fill("#ffffff40", 2 + t * 6, 5, 4, 1); fill("#ffffff30", 8 - t * 4, 11, 5, 1); break; }
      case "rock": fill(P.rock[1], 0, 2, T, 14); fill(P.rock[0], 1, 1, 14, 12); fill(P.rock[2], 3, 3, 6, 3); fill("#00000022", 0, 13, T, 3); break;
      case "boulder": g.fillStyle = "#00000025"; g.beginPath(); g.ellipse(X + 8, Y + 13, 7, 2.5, 0, 0, 7); g.fill();
        g.fillStyle = P.rock[1]; g.beginPath(); g.ellipse(X + 8, Y + 8, 7, 6, 0, 0, 7); g.fill();
        g.fillStyle = P.rock[2]; g.beginPath(); g.ellipse(X + 6, Y + 6, 3, 2, 0, 0, 7); g.fill(); break;
      case "pine": fill("#00000025", 3, 13, 10, 3); fill(P.trunk, 7, 11, 2, 4);
        g.fillStyle = P.pine[1]; g.beginPath(); g.moveTo(X + 8, Y + 1); g.lineTo(X + 14, Y + 12); g.lineTo(X + 2, Y + 12); g.fill();
        g.fillStyle = P.pine[0]; g.beginPath(); g.moveTo(X + 8, Y + 3); g.lineTo(X + 12, Y + 10); g.lineTo(X + 4, Y + 10); g.fill();
        fill(P.pine[2], 7, 4, 2, 2); break;
      case "shrub": g.fillStyle = P.shrub[1]; g.beginPath(); g.arc(X + 8, Y + 9, 6, 0, 7); g.fill(); g.fillStyle = P.shrub[0]; g.beginPath(); g.arc(X + 7, Y + 8, 4, 0, 7); g.fill(); break;
      case "flowers": for (let i = 0; i < 5; i++) fill(pick(P.flowers, x, y, 80 + i), Math.floor(hash(x, y, 90 + i) * 13) + 1, Math.floor(hash(x, y, 95 + i) * 13) + 1, 2, 2); break;
      case "wall": fill(P.wall[1], 0, 0, T, T); for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) fill(P.wall[0], c * 8 + (r % 2) * 4 - 2, r * 4 + 1, 7, 3); break;
      case "floor": fill(P.floor[0], 0, 0, T, T); fill(P.floor[1], 0, 7, T, 1); fill(P.floor[1], 7, 0, 1, 7); fill(P.floor[1], 3, 8, 1, 8); break;
    }
  }

  // ── station objects (all primitives, 16x16 unless noted) ───────────────────
  const OBJECTS = {
    sign(g, X, Y, P) { g.fillStyle = "#6b4a34"; g.fillRect(X + 7, Y + 7, 2, 9); g.fillStyle = "#a07850"; g.fillRect(X + 1, Y + 1, 14, 8);
      g.fillStyle = "#7b5a3c"; g.fillRect(X + 1, Y + 8, 14, 1); g.fillStyle = "#f3e7cf"; g.fillRect(X + 3, Y + 3, 10, 1); g.fillRect(X + 3, Y + 5, 7, 1); },
    cone(g, X, Y) { g.fillStyle = "#00000025"; g.fillRect(X + 3, Y + 13, 10, 2);
      for (let r = 0; r < 5; r++) { g.fillStyle = r % 2 ? "#7a4b2a" : "#9b6235"; g.fillRect(X + 5 - (r > 1 ? 1 : 0), Y + 3 + r * 2, 6 + (r > 1 ? 2 : 0), 2); }
      g.fillStyle = "#e9dfc8"; for (const [a, b] of [[4, 4], [12, 6], [3, 9], [13, 10]]) g.fillRect(X + a, Y + b, 1, 1); },
    needles(g, X, Y) { g.fillStyle = "#6b4a34"; g.fillRect(X + 2, Y + 11, 12, 2);
      g.strokeStyle = "#3d6b45"; g.lineWidth = 1; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(X + 5 + i * 1.5, Y + 11); g.lineTo(X + 2 + i * 3, Y + 2 + (i % 2)); g.stroke(); } },
    outcrop(g, X, Y) { g.fillStyle = "#e8e4dc"; g.beginPath(); g.moveTo(X + 1, Y + 15); g.lineTo(X + 5, Y + 3); g.lineTo(X + 10, Y + 6); g.lineTo(X + 15, Y + 15); g.fill();
      g.fillStyle = "#cfc9bf"; g.fillRect(X + 6, Y + 8, 5, 2); g.fillRect(X + 3, Y + 12, 4, 1); },
    stripbark(g, X, Y, P) { g.fillStyle = "#00000025"; g.fillRect(X + 2, Y + 13, 12, 3);
      g.fillStyle = "#d9cfbd"; g.fillRect(X + 4, Y + 2, 8, 12); g.fillStyle = "#b9ad97"; g.fillRect(X + 5, Y + 4, 1, 9); g.fillRect(X + 9, Y + 3, 1, 10);
      g.fillStyle = "#7a4a2c"; g.fillRect(X + 10, Y + 2, 2, 12);  /* the living strip */ g.fillStyle = P.pine[0]; g.fillRect(X + 9, Y, 5, 3); },
    drill(g, X, Y) { g.fillStyle = "#6b4a34"; g.fillRect(X + 2, Y + 6, 3, 10); g.fillStyle = "#8a8f96"; g.fillRect(X + 5, Y + 8, 10, 2); g.fillRect(X + 4, Y + 4, 2, 8);
      g.fillStyle = "#c9a26a"; g.fillRect(X + 8, Y + 12, 7, 2); g.fillStyle = "#7a4b2a"; for (let i = 0; i < 3; i++) g.fillRect(X + 9 + i * 2, Y + 12, 1, 2); },
    stump(g, X, Y) { g.fillStyle = "#00000025"; g.fillRect(X + 2, Y + 13, 12, 2); g.fillStyle = "#7a4a2c"; g.fillRect(X + 3, Y + 7, 10, 7);
      g.fillStyle = "#d8b98a"; g.beginPath(); g.ellipse(X + 8, Y + 7, 5, 2.5, 0, 0, 7); g.fill();
      g.strokeStyle = "#a07850"; g.beginPath(); g.ellipse(X + 8, Y + 7, 3, 1.4, 0, 0, 7); g.stroke(); },
    beetle(g, X, Y) { g.fillStyle = "#d9cfbd"; g.fillRect(X + 3, Y + 1, 10, 14); g.fillStyle = "#2a2230";
      g.beginPath(); g.ellipse(X + 8, Y + 9, 2.5, 3.5, 0, 0, 7); g.fill(); g.fillRect(X + 7, Y + 4, 2, 2);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.fillRect(X + 8 + s * 3, Y + 7 + i * 2, s * 2, 1);
      g.fillStyle = "#b9ad97"; for (let i = 0; i < 4; i++) g.fillRect(X + 4 + i * 2, Y + 2 + (i % 2) * 11, 1, 1); },
    nursery(g, X, Y) { g.fillStyle = "#8a5a3a"; g.fillRect(X + 1, Y + 9, 14, 2); g.fillRect(X + 2, Y + 11, 1, 4); g.fillRect(X + 13, Y + 11, 1, 4);
      for (const a of [3, 9]) { g.fillStyle = "#b5653d"; g.fillRect(X + a, Y + 6, 4, 3); g.fillStyle = "#3f6b4b"; g.beginPath(); g.moveTo(X + a + 2, Y + 1); g.lineTo(X + a + 4, Y + 6); g.lineTo(X + a, Y + 6); g.fill(); } },
    ancient(g, X, Y, P) {  /* 32x32 — the old tree occupies a 2x2 footprint, drawn from its top-left tile */
      g.fillStyle = "#00000028"; g.beginPath(); g.ellipse(X + 16, Y + 29, 13, 3, 0, 0, 7); g.fill();
      g.fillStyle = "#d9cfbd"; g.beginPath(); g.moveTo(X + 10, Y + 30); g.lineTo(X + 13, Y + 12); g.lineTo(X + 6, Y + 4); g.lineTo(X + 9, Y + 3); g.lineTo(X + 16, Y + 10);
      g.lineTo(X + 22, Y + 2); g.lineTo(X + 25, Y + 4); g.lineTo(X + 19, Y + 13); g.lineTo(X + 22, Y + 30); g.fill();
      g.fillStyle = "#7a4a2c"; g.fillRect(X + 18, Y + 12, 2, 18);
      g.fillStyle = P.pine[1]; g.beginPath(); g.ellipse(X + 23, Y + 6, 6, 4, -0.3, 0, 7); g.fill();
      g.fillStyle = P.pine[0]; g.beginPath(); g.ellipse(X + 24, Y + 5, 4, 2.5, -0.3, 0, 7); g.fill();
      g.fillStyle = "#b9ad97"; g.fillRect(X + 14, Y + 16, 1, 10); g.fillRect(X + 12, Y + 22, 1, 6); },
    book(g, X, Y) { g.fillStyle = "#00000025"; g.fillRect(X + 2, Y + 12, 12, 2); g.fillStyle = "#3e5c8a"; g.fillRect(X + 3, Y + 4, 10, 8);
      g.fillStyle = "#f3eee2"; g.fillRect(X + 4, Y + 5, 8, 6); g.fillStyle = "#3e5c8a"; g.fillRect(X + 8, Y + 4, 1, 8); },
  };
  const BIG = { ancient: 2 };   // footprint in tiles for oversized objects

  // ── engine ─────────────────────────────────────────────────────────────────
  function mount(host, data, opts = {}) {
    const W = data.walk;
    if (!W) throw new Error("walk engine: data.walk is missing");
    const P = THEMES[W.theme] || THEMES.alpine;
    const legend = { ...DEFAULT_LEGEND, ...(W.legend || {}) };
    const rows = W.map, MW = rows[0].length, MH = rows.length;
    const key = opts.storageKey || "walk:" + location.pathname;
    const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(key + ":" + k)) ?? d; } catch { return d; } },
                    set(k, v) { try { localStorage.setItem(key + ":" + k, JSON.stringify(v)); } catch {} } };

    // stations + occupancy
    const stations = W.stations.map((s, i) => ({ ...s, n: i + 1, w: BIG[s.object] || 1 }));
    const occ = new Map();
    for (const s of stations) for (let dx = 0; dx < s.w; dx++) for (let dy = 0; dy < s.w; dy++) occ.set(`${s.x + dx},${s.y + dy}`, s);
    const tileAt = (x, y) => (y < 0 || y >= MH || x < 0 || x >= MW) ? "rock" : (legend[rows[y][x]] || "ground");
    const blocked = (x, y) => SOLID.has(tileAt(x, y)) || occ.has(`${x},${y}`);

    // DOM
    host.classList.add("walk");
    host.innerHTML = `
      <div class="walk-stage" tabindex="0" aria-label="Walkable explainer. Use W A S D to move, Enter to read a station, Escape for the menu.">
        <canvas></canvas>
        <div class="walk-hud"><b class="walk-count"></b><span class="walk-mode"></span></div>
        <div class="walk-start"><button type="button">▶ Click to walk</button><span>WASD / arrows move · Enter reads · Esc menu</span></div>
        <div class="walk-box" hidden><div class="walk-box-title"></div><div class="walk-box-text"></div><ul class="walk-box-opts"></ul><div class="walk-box-more" hidden>▼</div></div>
      </div>
      <div class="walk-legend"></div>`;
    const stage = host.querySelector(".walk-stage"), cv = host.querySelector("canvas"), g = cv.getContext("2d");
    const box = host.querySelector(".walk-box");
    const VW = Math.min(MW, W.view?.w || 17), VH = Math.min(MH, W.view?.h || 11);
    let scale = 3;

    // pre-render the static map
    const bg = document.createElement("canvas"); bg.width = MW * T; bg.height = MH * T;
    const bgc = bg.getContext("2d");
    const TERRAIN = new Set(["ground", "grass", "path", "scree", "snow", "floor"]);
    const underAt = (x, y) => {           // most common terrain among the 8 neighbours
      const n = {};
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const k = tileAt(x + dx, y + dy); if ((dx || dy) && TERRAIN.has(k) && k !== "path") n[k] = (n[k] || 0) + 1;
      }
      return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
    };
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) paintTile(bgc, tileAt(x, y), x, y, P, underAt(x, y));

    const sprite = new Image(); sprite.src = SPRITE;
    const S = {
      x: W.start.x, y: W.start.y, facing: W.start.facing || "up",
      fx: W.start.x, fy: W.start.y, moving: null, held: [], run: false, step: 0,
      visited: new Set(store.get("visited", [])), recall: store.get("recall", false),
      score: store.get("score", {}), box: null, active: false, last: 0,
    };

    function resize() {
      const avail = stage.clientWidth || 800;
      let fitScale = avail / (VW * T);
      if (opts.fit === "contain" && stage.clientHeight) fitScale = Math.min(fitScale, (stage.clientHeight - 24) / (VH * T));
      scale = Math.max(2, Math.min(opts.fit === "contain" ? 6 : 4, Math.floor(fitScale)));
      cv.width = VW * T * scale; cv.height = VH * T * scale;
      cv.style.width = cv.width + "px"; cv.style.height = cv.height + "px";
      g.imageSmoothingEnabled = false;
    }
    const ro = new ResizeObserver(resize); ro.observe(stage);
    let alive = true;
    resize();

    // ── loop ────────────────────────────────────────────────────────────────
    function tick(now) {
      if (!alive) return;
      const dt = S.last ? now - S.last : 16; S.last = now;
      if (S.moving) {
        S.moving.t += dt / (S.run ? RUN_MS : STEP_MS);
        const t = Math.min(1, S.moving.t);
        S.fx = S.moving.x0 + (S.x - S.moving.x0) * t; S.fy = S.moving.y0 + (S.y - S.moving.y0) * t;
        S.step += dt / (S.run ? 90 : 140);
        if (t >= 1) { S.moving = null; S.fx = S.x; S.fy = S.y; }
      }
      if (!S.moving && !S.box && S.held.length) tryStep(S.held[S.held.length - 1]);
      if (!S.moving && !S.held.length) S.step = 0;
      draw();
      schedule();
    }
    // Background tabs pause requestAnimationFrame; fall back to a timer so state still advances.
    function schedule() { if (document.hidden) setTimeout(() => tick(performance.now()), 60); else requestAnimationFrame(tick); }

    function tryStep(dir) {
      S.facing = dir;
      const [dx, dy] = DIRS[dir], nx = S.x + dx, ny = S.y + dy;
      if (blocked(nx, ny)) return;
      S.moving = { x0: S.x, y0: S.y, t: 0 }; S.x = nx; S.y = ny;
    }

    const facingStation = () => { const [dx, dy] = DIRS[S.facing]; return occ.get(`${S.x + dx},${S.y + dy}`) || null; };

    function draw() {
      const cs = T * scale;
      let camX = S.fx - (VW - 1) / 2, camY = S.fy - (VH - 1) / 2;
      camX = Math.max(0, Math.min(MW - VW, camX)); camY = Math.max(0, Math.min(MH - VH, camY));
      g.fillStyle = P.sky; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(bg, camX * T, camY * T, VW * T, VH * T, 0, 0, VW * cs, VH * cs);
      g.save(); g.scale(scale, scale); g.translate(-camX * T, -camY * T);
      // route breadcrumbs between stations (memory-palace path), shown until all visited
      const near = facingStation();
      for (const s of stations) {
        if (s.y > S.fy + 0.01) continue;           // draw objects behind the player first
        drawStation(s, near);
      }
      drawPlayer();
      for (const s of stations) if (s.y > S.fy + 0.01) drawStation(s, near);
      g.restore();
    }

    function drawStation(s, near) {
      const X = s.x * T, Y = s.y * T;
      (OBJECTS[s.object] || OBJECTS.book)(g, X, Y, P);
      // number tag
      const done = S.visited.has(s.id);
      const tx = X + s.w * T - 6, ty = Y - 3;
      g.fillStyle = done ? "#3f8f5a" : "#2b2731"; g.fillRect(tx - 1, ty - 1, 9, 8);
      g.fillStyle = "#fff"; g.font = "bold 6px ui-monospace, Menlo, monospace"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(s.n), tx + 3.5, ty + 3);
      if (near === s && !S.box) {                    // "!" bubble when you're facing it
        const bx = X + (s.w * T) / 2, by = Y - 10 - Math.sin(performance.now() / 180);
        g.fillStyle = "#fff"; g.fillRect(bx - 4, by - 5, 8, 9); g.fillStyle = P.ink; g.fillRect(bx - 4, by - 5, 8, 1); g.fillRect(bx - 4, by + 3, 8, 1);
        g.fillRect(bx - 1, by - 3, 2, 4); g.fillRect(bx - 1, by + 2 - 1, 2, 1);
      }
    }

    function drawPlayer() {
      const moving = S.moving || S.step > 0;
      const frame = moving ? FRAMES[S.facing][Math.floor(S.step) % 4] : STAND[S.facing];
      const X = S.fx * T, Y = S.fy * T - 16;
      const cellWidth = sprite.naturalWidth / 9, cellHeight = sprite.naturalHeight;
      g.fillStyle = "#00000030"; g.beginPath(); g.ellipse(X + 8, Y + 30, 5, 2, 0, 0, 7); g.fill();
      if (!sprite.complete || !sprite.naturalWidth) { g.fillStyle = "#4a8054"; g.fillRect(X + 4, Y + 14, 8, 14); return; }
      if (S.facing === "left") { g.save(); g.translate(X + 16, Y); g.scale(-1, 1); g.drawImage(sprite, frame * cellWidth, 0, cellWidth, cellHeight, 0, 0, 16, 32); g.restore(); }
      else g.drawImage(sprite, frame * cellWidth, 0, cellWidth, cellHeight, X, Y, 16, 32);
    }

    // ── dialog box ──────────────────────────────────────────────────────────
    function openBox(title, pages, options, onDone) {
      S.held = [];
      S.box = { title, pages, page: 0, options, sel: 0, onDone };
      box.hidden = false;
      renderBox();
    }
    function renderBox() {
      const b = S.box;
      box.querySelector(".walk-box-title").textContent = b.title;
      box.querySelector(".walk-box-text").innerHTML = b.pages[b.page];
      const last = b.page === b.pages.length - 1;
      box.querySelector(".walk-box-more").hidden = last;
      const ul = box.querySelector(".walk-box-opts");
      ul.innerHTML = last ? b.options.map(([l], i) => `<li class="${i === b.sel ? "sel" : ""}" data-i="${i}">${l}</li>`).join("") : "";
      ul.querySelectorAll("li").forEach((li) => li.onclick = () => { b.sel = +li.dataset.i; advance(); });
    }
    function advance() {
      const b = S.box;
      if (b.page < b.pages.length - 1) { b.page++; return renderBox(); }
      const opt = b.options[b.sel];
      closeBox();
      if (opt && opt[1]) opt[1]();
    }
    function closeBox() { S.box = null; box.hidden = true; stage.focus({ preventScroll: true }); }

    const esc = (t) => String(t ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

    function readStation(s) {
      const more = s.section && data.sections?.[s.section] ? [["Read more ↓", () => readMore(s.section)]] : [];
      const tell = () => {
        markVisited(s);
        openBox(`${s.n} · ${s.title}`, s.pages.map(esc), [...more, ["Back", null]]);
      };
      if (S.recall && s.cue) {
        openBox(`${s.n} · ???`, [`<em>${esc(s.cue)}</em><br><span class="walk-dim">Say it out loud, then reveal.</span>`], [
          ["Reveal", () => openBox(`${s.n} · ${s.title}`, s.pages.map(esc), [
            ["I remembered", () => { S.score[s.id] = 1; store.set("score", S.score); markVisited(s); hud(); }],
            ["I forgot", () => { S.score[s.id] = 0; store.set("score", S.score); markVisited(s); hud(); }],
            ...more])],
          ["Back", null]]);
      } else tell();
    }

    function readMore(section) {
      if (opts.onReadMore) return opts.onReadMore(section);
      const el = document.querySelector(`[data-copy-section="${section}"]`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.add("walk-flash"); setTimeout(() => el.classList.remove("walk-flash"), 1600); }
    }

    function markVisited(s) {
      S.visited.add(s.id); store.set("visited", [...S.visited]); hud();
      if (S.visited.size === stations.length && !store.get("finished", false)) {
        store.set("finished", true);
        setTimeout(() => openBox("Palace complete", [
          `You've walked all ${stations.length} stations. Walk it again in <b>Recall mode</b> (press R): each station shows only a cue, and you test yourself before reading.`],
          [["Turn on Recall mode", () => setRecall(true)], ["Keep exploring", null]]), 300);
      }
    }

    function setRecall(on) { S.recall = on; store.set("recall", on); if (on) { S.score = {}; store.set("score", {}); } hud(); }

    function menu() {
      const route = stations.map((s) => [`${S.visited.has(s.id) ? "✓" : "·"} ${s.n}. ${esc(S.recall && !S.visited.has(s.id) ? "???" : s.title)}`, () => warpTo(s)]);
      openBox("Route", [`Walk the stations in order — the order is the memory. Pick one to jump beside it.`],
        [...route, [S.recall ? "Recall mode: on — turn off" : "Recall mode: off — turn on", () => setRecall(!S.recall)],
         ["Reset progress", () => { S.visited.clear(); store.set("visited", []); store.set("finished", false); setRecall(false); }],
         ...(opts.extraMenu || []),
         ["Close", null]]);
    }

    function warpTo(s) {
      // nearest open tile beside the station, then face it
      const cand = [];
      for (let dx = -1; dx <= s.w; dx++) for (let dy = -1; dy <= s.w; dy++) {
        const inside = dx >= 0 && dx < s.w && dy >= 0 && dy < s.w;
        const edge = (dx === -1 || dx === s.w) !== (dy === -1 || dy === s.w);
        if (!inside && edge && !blocked(s.x + dx, s.y + dy)) cand.push([s.x + dx, s.y + dy, dx === -1 ? "right" : dx === s.w ? "left" : dy === -1 ? "down" : "up"]);
      }
      // prefer standing beside it (left/right) so the object stays visible, then below it
      const rank = { right: 0, left: 0, up: 1, down: 2 };
      cand.sort((a, b) => rank[a[2]] - rank[b[2]]);
      const c = cand[0]; if (!c) return;
      S.x = S.fx = c[0]; S.y = S.fy = c[1]; S.facing = c[2]; S.moving = null;
    }

    function hud() {
      host.querySelector(".walk-count").textContent = `${S.visited.size}/${stations.length} stations`;
      const scored = Object.values(S.score);
      host.querySelector(".walk-mode").textContent = S.recall ? ` · Recall mode ${scored.length ? `· ${scored.filter(Boolean).length}/${scored.length} remembered` : ""}` : "";
      host.querySelector(".walk-legend").innerHTML = stations.map((s) =>
        `<button type="button" class="${S.visited.has(s.id) ? "done" : ""}" data-s="${s.id}">${s.n}. ${esc(S.recall ? (S.visited.has(s.id) ? s.title : "?") : s.title)}</button>`).join("");
      host.querySelectorAll(".walk-legend button").forEach((b) => b.onclick = () => { warpTo(stations.find((s) => s.id === b.dataset.s)); start(); });
    }

    // ── input ───────────────────────────────────────────────────────────────
    function start() { S.active = true; host.querySelector(".walk-start").hidden = true; stage.focus({ preventScroll: true }); }
    host.querySelector(".walk-start button").onclick = start;
    stage.addEventListener("focus", () => { S.active = true; host.querySelector(".walk-start").hidden = true; });
    stage.addEventListener("blur", () => { S.held = []; });
    stage.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      S.run = e.shiftKey;
      if (S.box) {
        const b = S.box, last = b.page === b.pages.length - 1;
        if ((k === "w" || k === "arrowup") && last) b.sel = (b.sel + b.options.length - 1) % b.options.length;
        else if ((k === "s" || k === "arrowdown") && last) b.sel = (b.sel + 1) % b.options.length;
        else if (k === "enter" || k === " ") advance();
        else if (k === "escape") closeBox();
        else return;
        e.preventDefault(); if (S.box === b) renderBox(); return;
      }
      if (KEYS[k]) { e.preventDefault(); if (!S.held.includes(KEYS[k])) S.held.push(KEYS[k]); }
      else if (k === "enter" || k === " ") { e.preventDefault(); const s = facingStation(); if (s) readStation(s); }
      else if (k === "escape") { e.preventDefault(); menu(); }
      else if (k === "r") { e.preventDefault(); setRecall(!S.recall); }
    });
    stage.addEventListener("keyup", (e) => { S.run = e.shiftKey; const d = KEYS[e.key.toLowerCase()]; if (d) S.held = S.held.filter((x) => x !== d); });

    hud();
    schedule();
    function destroy() { alive = false; ro.disconnect(); host.innerHTML = ""; host.classList.remove("walk"); }
    return { warpTo, stations, state: S, read: readStation, start, destroy };
  }

  window.WalkEngine = { mount, THEMES, OBJECTS: Object.keys(OBJECTS), DEFAULT_LEGEND };
})();
