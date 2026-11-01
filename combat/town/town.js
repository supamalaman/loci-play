"use strict";
// The walkable town that replaces the main menu (Mala, 2026-10-17; docs/town-hub.md). The Warden walks an isometric
// grid with WASD or the arrow keys; E (or Enter, or Space) at a door or beside an NPC opens what is there. A side menu
// jumps straight to any door. The layout is town-data.js; what each door opens is ui.js (showTown).
//
// Movement is screen-relative: W walks up the screen, D to the right, and two keys walk the diagonals. The art has two
// walk cycles, both drawn facing right: toward the camera (front) and away from it (back). Moving up the screen shows
// the back cycle, down shows the front, and moving left mirrors either one. A purely sideways step keeps the last
// front/back choice.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./town-data.js"));
  else root.ConceptCombatTown = factory(root.ConceptCombatTownData);
})(typeof self !== "undefined" ? self : this, function (D) {
  const SPEED = 4.2;          // tiles a second
  const RADIUS = 0.28;        // the walker's footprint, in tiles
  const NPC_RADIUS = 0.36;
  const REACH = 0.9;          // how close to a building's footprint counts as at its door
  const TALK_REACH = 1.4;
  const WALK_FPS = 9;
  const HEIGHT = { "town/warden": 96, "town/mad-scientist": 90, "arantxa/idle": 104 };   // drawn heights in px at zoom 1
  const FRAMES = { front: [2, 3, 4, 5, 6], back: [2, 3, 4, 5, 6] };                       // walk frames; frame 1 is the idle, front-7 the talk pose
  const { TILE_W: TW, TILE_H: TH } = D;

  const project = (gx, gy) => [(gx - gy) * TW / 2, (gx + gy) * TH / 2];

  // A screen direction (dx right, dy down; each -1, 0 or 1) as a unit step on the grid: project() inverted with TW = 2,
  // TH = 1, so a diagonal key pair walks a true 45 degrees on screen. Screen right is grid (+1, -1), screen down (+1, +1).
  function gridDir(dx, dy) {
    if (!dx && !dy) return [0, 0];
    const gx = dx / 2 + dy, gy = dy - dx / 2;
    const n = Math.hypot(gx, gy) || 1;
    return [gx / n, gy / n];
  }

  function rectDistance(px, py, b) {
    const [bx, by] = b.at, s = b.size;
    const cx = Math.max(bx, Math.min(px, bx + s)), cy = Math.max(by, Math.min(py, by + s));
    return Math.hypot(px - cx, py - cy);
  }

  function collides(px, py, town = D) {
    if (px < RADIUS || py < RADIUS || px > town.SIZE - RADIUS || py > town.SIZE - RADIUS) return true;
    for (const b of town.buildings) if (rectDistance(px, py, b) < RADIUS) return true;
    for (const n of town.npcs) if (Math.hypot(px - n.at[0], py - n.at[1]) < RADIUS + NPC_RADIUS) return true;
    return false;
  }

  // One movement tick. Slides along walls: tries the whole step, then each axis on its own.
  function step(pos, dx, dy, dt, town = D) {
    const [gx, gy] = gridDir(dx, dy), d = SPEED * dt;
    if (!gx && !gy) return pos.slice();
    const tries = [[pos[0] + gx * d, pos[1] + gy * d], [pos[0] + gx * d, pos[1]], [pos[0], pos[1] + gy * d]];
    for (const t of tries) if (!collides(t[0], t[1], town)) return t;
    return pos.slice();
  }

  function facingFor(prev, dx, dy) {
    return { back: dy < 0 ? true : dy > 0 ? false : prev.back, left: dx < 0 ? true : dx > 0 ? false : prev.left };
  }

  // The frame to draw: [cycle, frame number].
  function frameFor(facing, moving, t, talking = false) {
    if (talking && !facing.back) return ["front", 7];
    const cycle = facing.back ? "back" : "front";
    if (!moving) return [cycle, 1];
    const list = FRAMES[cycle];
    return [cycle, list[Math.floor(t * WALK_FPS) % list.length]];
  }

  // What E would open from here: the nearest NPC in reach, else the nearest door in reach. Null when nothing is.
  function nearby(pos, town = D) {
    let best = null;
    for (const n of town.npcs) { const d = Math.hypot(pos[0] - n.at[0], pos[1] - n.at[1]); if (d <= TALK_REACH && (!best || d < best.d)) best = { kind: "npc", it: n, d }; }
    if (best) return best;
    for (const b of town.buildings) if (b.opens) { const d = rectDistance(pos[0], pos[1], b); if (d <= REACH && (!best || d < best.d)) best = { kind: "door", it: b, d }; }
    return best;
  }

  // Painter's order. Buildings go back to front by their front corner. A standing figure goes after every building it
  // is in front of (its x or y is past the footprint's front edge), which on a grid of separate footprints also puts it
  // before every building it is behind.
  function depthOrder(buildings, figures) {
    const list = buildings.slice().sort((a, b) => (a.at[0] + a.at[1] + 2 * a.size) - (b.at[0] + b.at[1] + 2 * b.size)).map((b) => ({ kind: "building", it: b }));
    for (const f of figures.slice().sort((a, b) => (a.at[0] + a.at[1]) - (b.at[0] + b.at[1]))) {
      let i = -1;
      list.forEach((e, k) => { if (e.kind === "building" && (f.at[0] >= e.it.at[0] + e.it.size || f.at[1] >= e.it.at[1] + e.it.size)) i = k; });
      while (list[i + 1] && list[i + 1].kind === "figure" && list[i + 1].it.at[0] + list[i + 1].it.at[1] <= f.at[0] + f.at[1]) i++;
      list.splice(i + 1, 0, { kind: "figure", it: f });
    }
    return list;
  }

  const GROUND = { grass: ["#5d8c3c", "#588637"], road: ["#8b8478", "#857e72"], plaza: ["#bdb19b", "#b5a993"] };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Mount the town in `host`. opts: spriteUrl(key) → image URL; nav: [{ id, label }]; onOpen(id) when a door, an NPC's
  // errand or a side-menu entry is chosen. Returns { destroy, state }.
  function create(host, opts = {}) {
    const town = opts.town || D, url = opts.spriteUrl || ((k) => `combat/sprites/${k}.png`);
    host.innerHTML = `<div class="cc-town">
      <canvas class="cc-town-canvas" aria-label="The town. Walk with WASD or the arrow keys; press E at a door or beside someone."></canvas>
      <nav class="cc-town-nav" aria-label="Quick navigation"><h2>Town</h2>${(opts.nav || []).map((n) => `<button type="button" data-town-nav="${esc(n.id)}" id="ccTown-${esc(n.id)}">${esc(n.label)}</button>`).join("")}
        <p class="cc-muted"><kbd>WASD</kbd> walk · <kbd>E</kbd> enter or talk</p></nav>
      <div class="cc-town-prompt" hidden></div>
      <div class="cc-town-talk" role="dialog" aria-live="polite" hidden><b></b><p></p><small></small></div>
    </div>`;
    const cv = host.querySelector("canvas"), g = cv.getContext("2d"), prompt = host.querySelector(".cc-town-prompt"), talkBox = host.querySelector(".cc-town-talk");
    const S = { pos: (opts.startAt || town.start.at).slice(), facing: { ...town.start.facing, ...(opts.startFacing || {}) }, keys: new Set(), moving: false, t: 0, talk: null, near: null, destroyed: false };
    const images = {};
    const img = (key) => { if (!images[key]) { const im = new Image(); im.src = url(key); images[key] = im; } return images[key]; };
    for (const b of town.buildings) img(b.sprite);
    for (const n of town.npcs) img(n.sprite);
    for (let i = 1; i <= 7; i++) img(`town/warden-front-${i}`);
    for (let i = 1; i <= 6; i++) img(`town/warden-back-${i}`);

    host.querySelectorAll("[data-town-nav]").forEach((b) => { b.onclick = () => opts.onOpen?.(b.dataset.townNav); });

    function interact() {
      if (S.talk) {
        const n = S.talk.npc;
        if (S.talk.line < n.lines.length - 1) { S.talk.line++; return showTalk(); }
        if (n.opens && !S.talk.offered) { S.talk.offered = true; return showTalk(); }
        const go = S.talk.offered && n.opens; S.talk = null; talkBox.hidden = true;
        if (go) opts.onOpen?.(n.opens);
        return;
      }
      const near = nearby(S.pos, town); if (!near) return;
      if (near.kind === "door") return opts.onOpen?.(near.it.opens);
      S.talk = { npc: near.it, line: 0, offered: false };
      S.facing = { back: near.it.at[1] + near.it.at[0] < S.pos[0] + S.pos[1], left: near.it.at[0] - near.it.at[1] < S.pos[0] - S.pos[1] };
      showTalk();
    }
    function showTalk() {
      const n = S.talk.npc; talkBox.hidden = false;
      talkBox.querySelector("b").textContent = n.name;
      talkBox.querySelector("p").textContent = S.talk.offered ? `Go into ${town.buildings.find((b) => b.opens === n.opens)?.name || "the building"}?` : n.lines[S.talk.line];
      talkBox.querySelector("small").textContent = S.talk.offered ? "E: go in · Esc: stay outside" : "E: next · Esc: leave";
    }

    const live = () => !S.destroyed && host.isConnected && !host.closest("[hidden]");
    const KEYS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
    function onKey(e) {
      if (!live() || e.metaKey || e.ctrlKey || e.target.closest?.("input,select,textarea")) return;
      const k = e.key.toLowerCase();
      if (e.type === "keyup") { S.keys.delete(k); return; }
      if (KEYS[k]) { e.preventDefault(); if (!S.talk) S.keys.add(k); return; }
      if (k === "e" || ((k === "enter" || k === " ") && !e.target.closest?.("button"))) { e.preventDefault(); interact(); return; }
      if (k === "escape" && S.talk) { e.preventDefault(); S.talk = null; talkBox.hidden = true; }
    }
    const blur = () => S.keys.clear();
    addEventListener("keydown", onKey); addEventListener("keyup", onKey); addEventListener("blur", blur);

    let last = 0, raf = 0;
    function frame(now) {
      if (S.destroyed) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0); last = now;
      if (live()) { tick(dt); draw(); }
      raf = requestAnimationFrame(frame);
    }
    function tick(dt) {
      let dx = 0, dy = 0;
      for (const k of S.keys) { dx += KEYS[k][0]; dy += KEYS[k][1]; }
      dx = Math.sign(dx); dy = Math.sign(dy);
      S.moving = !!(dx || dy) && !S.talk;
      if (S.moving) { S.facing = facingFor(S.facing, dx, dy); S.pos = step(S.pos, dx, dy, dt, town); S.t += dt; }
      const near = S.talk ? null : nearby(S.pos, town);
      if ((near && near.it) !== (S.near && S.near.it)) {
        S.near = near; prompt.hidden = !near;
        if (near) prompt.innerHTML = near.kind === "door" ? `<kbd>E</kbd> ${esc(near.it.name)} · ${esc(near.it.verb || "")}` : `<kbd>E</kbd> Talk to ${esc(near.it.name)}`;
      }
    }

    function draw() {
      const dpr = globalThis.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const zoom = Math.max(0.7, Math.min(1.4, H / 720));
      const [wx, wy] = project(S.pos[0], S.pos[1]), [mx, my] = project(town.SIZE / 2, town.SIZE / 2);
      const px = wx * 0.65 + mx * 0.35, py = wy * 0.65 + my * 0.35;   // the camera leans toward the town's middle, so the edge of the map never fills the screen
      g.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (W / 2 - px * zoom), dpr * (H * 0.56 - py * zoom));
      g.imageSmoothingEnabled = false;
      g.fillStyle = "#1c2a22"; g.fillRect(px - W / zoom, py - H / zoom, 2 * W / zoom, 2 * H / zoom);
      for (let y = 0; y < town.SIZE; y++) for (let x = 0; x < town.SIZE; x++) {
        const s = town.surfaceAt(x, y), [a, b] = GROUND[s] || GROUND.grass;
        const [sx, sy] = project(x, y);
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + TW / 2, sy + TH / 2); g.lineTo(sx, sy + TH); g.lineTo(sx - TW / 2, sy + TH / 2); g.closePath();
        g.fillStyle = ((x * 7 + y * 13) % 5) < 2 ? b : a; g.fill();
        if (s !== "grass") { g.strokeStyle = "#00000018"; g.lineWidth = 1; g.stroke(); }
      }
      const figures = [{ id: "warden", at: S.pos, warden: true }, ...town.npcs];
      for (const e of depthOrder(town.buildings, figures)) e.kind === "building" ? drawBuilding(e.it) : drawFigure(e.it);
    }
    function drawBuilding(b) {
      const im = img(b.sprite); if (!im.complete || !im.naturalWidth) return;
      const w = b.size * TW, k = w / im.naturalWidth, h = im.naturalHeight * k;
      const [bx, by] = project(b.at[0] + b.size, b.at[1] + b.size);
      if (S.near && S.near.it === b) { g.save(); g.shadowColor = "#ffe9a8"; g.shadowBlur = 18; }
      g.drawImage(im, bx - w / 2, by - h + 2, w, h);
      if (S.near && S.near.it === b) g.restore();
    }
    function drawFigure(f) {
      let key, flip = false;
      if (f.warden) { const [cycle, n] = frameFor(S.facing, S.moving, S.t, !!S.talk); key = `town/warden-${cycle}-${n}`; flip = S.facing.left; }
      else key = f.sprite;
      const im = img(key); if (!im.complete || !im.naturalWidth) return;
      const h = HEIGHT[f.warden ? "town/warden" : f.sprite] || 96, k = h / im.naturalHeight, w = im.naturalWidth * k;
      const [sx, sy] = project(f.at[0], f.at[1]);
      g.fillStyle = "#00000040"; g.beginPath(); g.ellipse(sx, sy, w * 0.32, w * 0.14, 0, 0, Math.PI * 2); g.fill();
      if (flip) { g.save(); g.translate(sx, 0); g.scale(-1, 1); g.drawImage(im, -w / 2, sy - h, w, h); g.restore(); }
      else g.drawImage(im, sx - w / 2, sy - h, w, h);
      if (S.near && S.near.it === f) { g.fillStyle = "#ffe9a8"; g.font = "bold 12px sans-serif"; g.textAlign = "center"; g.fillText(f.name, sx, sy - h - 6); }
    }

    raf = requestAnimationFrame(frame);
    return {
      state: S, interact,
      advance(seconds) { for (let t = 0; t < seconds; t += 1 / 60) tick(1 / 60); draw(); },   // checks: headless Chrome runs no animation frames under virtual time
      destroy() { S.destroyed = true; cancelAnimationFrame(raf); removeEventListener("keydown", onKey); removeEventListener("keyup", onKey); removeEventListener("blur", blur); },
    };
  }

  return { create, step, collides, nearby, facingFor, frameFor, depthOrder, gridDir, project, SPEED, RADIUS };
});
