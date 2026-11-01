"use strict";
// Isometric battle camera. An arena whose catalog entry says visual.style "isometric" (today: Oculus Court) can be
// drawn through this instead of the flat board; the shared sculptor terrain/arena-iso.js models it from its recipe. It is presentation only: it reads terrain and never changes it, and nothing
// here is asked about movement, cover or sight. The balustrade, rails and canopy are decoration, not obstacles.
//
// One projection serves everything the battle draws:
//   snapshot(arena, read)   the terrain as it stands NOW (surface and height through the engine's own accessors, live
//                           trees and hedges from arena.objects), in the string-map shape a sculptor expects
//   model(snap)             the sculptor's faces without its population: the battle draws plants, people and objects
//                           from the game's own sprites, so only the ground, the tree ring and the planter stay
//   view(snap, opts)        a camera fitted to the canvas, with
//     at(x, y)              screen point of a tile centre, standing on the ground or the ramp deck (fractions blend)
//     tile(g, x, y, r, fn)  run tile-rectangle drawing code laid onto the tile's ground quad
//     paint(g, ground)      the scene, with per-tile ground drawings merged into its depth order
//     occlude(g, box, at)   redraw what stands in front of an upright sprite; returns the faces that covered it
//     pick(sx, sy)          the frontmost tile under a screen point
// The sculptor is used only as { sceneFor(arena) -> { faces, casters }, rawProject, rampHeight, LEVEL }. A new map needs
// no code here: author its recipe and register it in the catalog (docs/map-generation.md).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./arena-iso.js"), require("./terrain-data.js"));
  else root.ConceptCombatIsoView = factory(root.ConceptCombatArenaIso, root.ConceptCombatTerrain);
})(typeof self !== "undefined" ? self : this, function (P, D) {
  let kept = null;                                    // the one cached scene bitmap (see backdrop)
  const FLAT = new Set(["ground", "joint", "ring", "water", "coping", "bridge"]);   // lies on a tile's top; never hides a sprite at that level
  const CUT = new Set(["canopy", "beam", "balustrade", "rail"]);            // what a cutaway removes (the approved preview's list)
  const POPULATION = new Set(["unit", "plant", "trunk"]);                   // the preview's study figures and faceted foliage: a battle draws its own sprites (Mala, 2026-10-13)
  const TINT = { day: [1.02, 1, 0.94], golden: [1.06, 0.95, 0.83], night: [0.6, 0.68, 0.94] };
  const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, k) => a.map((v) => v * k);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norm = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
  const mid = (p) => p.reduce((sum, q) => add(sum, mul(q, 1 / p.length)), [0, 0, 0]);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const sculpted = (o) => !!o && o.kind === "plant" && !o.dead && (o.form === "tree" || o.form === "hedge");
  // A catalog arena at its authored size, or a generated map that carries its own isometric visual (mapgen.js), up to 20×12.
  const supports = (arena) => { if (!P || !arena) return false;
    const a = D.arenas[arena.id]; if (a) return a.visual?.style === "isometric" && (arena.w ?? arena.map[0].length) === a.map[0].length && (arena.h ?? arena.map.length) === a.map.length;
    const w = arena.w ?? arena.map?.[0]?.length ?? 0, h = arena.h ?? arena.map?.length ?? 0;
    return !!(arena.generated && arena.visual?.style === "isometric" && w && h && w <= 20 && h <= 12 && arena.map.every((r) => r.length === w)); };

  // ── terrain as it stands ───────────────────────────────────────────────────────────────────────────────────────
  // A battle's arena is not the authored one: vegetation.populate turns T and h tiles into plant objects on other
  // ground, heights are number rows, and abilities change both. read = { surfaceAt(x, y), heightAt(x, y) }.
  const snaps = new Map();
  function snapshot(arena, read) {
    const w = arena.w ?? arena.map[0].length, h = arena.h ?? arena.map.length, plants = new Map();
    for (const o of arena.objects || []) if (sculpted(o)) plants.set(o.x + "," + o.y, o.form === "tree" ? "T" : "h");
    const surface = [], height = [];
    for (let y = 0; y < h; y++) {
      let row = ""; const levels = [];
      for (let x = 0; x < w; x++) {
        row += plants.get(x + "," + y) || (read?.surfaceAt ? read.surfaceAt(x, y) : arena.map[y][x]) || ".";
        levels.push(Number(read?.heightAt ? read.heightAt(x, y) : arena.height?.[y]?.[x] || 0));
      }
      surface.push(row); height.push(levels);
    }
    const key = arena.id + "|" + surface.join("/") + "|" + height.map((r) => r.join("")).join("/");
    if (snaps.has(key)) return snaps.get(key);
    if (snaps.size > 5) snaps.delete(snaps.keys().next().value);
    // The recipe's architecture comes from the catalog, never from the battle: a state cannot add or move a feature.
    const snap = { id: arena.id, w, h, key, surface, height, map: surface, visual: D.arenas[arena.id]?.visual ?? arena.visual, interior: !!D.arenas[arena.id]?.interior, spawns: { player: [], enemy: [] }, views: new Map() };
    snaps.set(key, snap); return snap;
  }
  const authoredSnap = (id) => snapshot({ id, ...D.arenas[id] }, null);

  // The sculptor models the terrain it is given, so parts the battle has taken away are already gone: a ramp tile
  // that is no longer ramp has no deck or parapet, a missing pillar takes its canopy, a felled tree its stone ring.
  function model(snap) {
    if (snap.model) return snap.model;
    const scene = P.sceneFor(snap), L = P.LEVEL;
    const cellOf = (c) => [clamp(Math.floor(c[0]), 0, snap.w - 1), clamp(Math.floor(c[1]), 0, snap.h - 1)];
    const faces = [], kept = new Set(), extent = [];
    for (const f of scene.faces) {
      const skirt = f.kind === "ground" && f.p.every((p) => p[0] < 0 || p[0] > snap.w || p[1] < 0 || p[1] > snap.h);
      if (f.kind !== "unit" && !skirt) extent.push(...f.p);                  // the frame still leaves room for a crown (but not the whole ground skirt)
      if (POPULATION.has(f.kind)) continue;                                  // fighters, trees and hedges are sprites, drawn by the battle
      const c = mid(f.p), [x, y] = cellOf(c), flat = FLAT.has(f.kind) || (f.kind === "ramp" && f.n[2] > 0.5);
      faces.push({ p: f.p, n: f.n, kind: f.kind, color: f.color, flat: flat && !skirt, x, y, c, skirt }); kept.add(f.p);   // skirt: the soil apron around a backdrop
    }
    const casters = scene.casters.filter((c) => kept.has(c.p));
    // Ground quad of every tile. A straight ramp tile slopes with its deck; everything else is level.
    const deck = new Set(faces.filter((f) => f.kind === "ramp" && f.flat).map((f) => f.x + "," + f.y));
    const ramp = (x, y) => deck.has(x + "," + y);
    const cells = [];
    for (let y = 0; y < snap.h; y++) for (let x = 0; x < snap.w; x++) {
      const z = snap.height[y][x] * L; let zs = [z, z, z, z].map((v) => v + 0.004);
      if (ramp(x, y)) {
        const ns = ramp(x, y - 1) || ramp(x, y + 1), ew = ramp(x - 1, y) || ramp(x + 1, y), lift = 0.05;
        if (ns && !ew) { const a = P.rampHeight(snap, x + 0.5, y) + lift, b = P.rampHeight(snap, x + 0.5, y + 1) + lift; zs = [a, a, b, b]; }
        else if (ew && !ns) { const a = P.rampHeight(snap, x, y + 0.5) + lift, b = P.rampHeight(snap, x + 1, y + 0.5) + lift; zs = [a, b, b, a]; }
        else zs = [z, z, z, z].map((v) => v + lift);
      }
      cells.push({ x, y, z, stand: (zs[0] + zs[1] + zs[2] + zs[3]) / 4, ramp: ramp(x, y), underlay: snap.surface[y][x] === "/", quad: [[x, y, zs[0]], [x + 1, y, zs[1]], [x + 1, y + 1, zs[2]], [x, y + 1, zs[3]]] });
    }
    return (snap.model = { L, faces, casters, cells, extent });
  }

  function shade(hex, n, sun, lighting) {
    if (lighting === "none") return hex;
    const rgb = hex.match(/\w\w/g).map((v) => parseInt(v, 16)), brightness = 0.60 + 0.46 * Math.max(0, dot(n, sun)), warm = TINT[lighting] || TINT.day;
    return "#" + rgb.map((v, i) => Math.round(Math.min(255, v * brightness * warm[i])).toString(16).padStart(2, "0")).join("");
  }
  const inside = (p, polygon) => { let hit = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit; } return hit; };
  const boundsOf = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
  const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const trace = (g, pts) => { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };

  // The frame is fitted to the AUTHORED scene, so the camera does not jump when a tree comes down.
  const frames = new Map();
  // A generated map has no authored scene: it frames on its own snapshot (keyed by its terrain, which is unique per map).
  function frame(snap, turn) {
    const authored = !!D.arenas[snap.id], key = (authored ? snap.id : snap.key) + "|" + turn; if (frames.has(key)) return frames.get(key);
    const m = model(authored ? authoredSnap(snap.id) : snap), pts = [];
    for (const p of m.extent) pts.push(P.rawProject(p, turn));
    const b = boundsOf(pts); frames.set(key, b); return b;
  }

  function view(snap, { width = 900, height = 600, turn = 0, lighting = "day", cutaway = false, grid = true, pad = [26, 18, 18, 18], zoom = 1, panX = 0, panY = 0 } = {}) {
    zoom = Math.max(0.5, Math.min(3, +zoom || 1)); panX = Math.round(panX) || 0; panY = Math.round(panY) || 0;   // battle-map zoom (Mala, 2026-10-22)
    const vkey = [width, height, turn, lighting, cutaway, grid, pad, zoom.toFixed(3), panX, panY].join("|");
    if (snap.views.has(vkey)) return snap.views.get(vkey);
    if (snap.views.size > 8) snap.views.delete(snap.views.keys().next().value);
    const m = model(snap), [bx0, by0, bx1, by1] = frame(snap, turn);
    const scale = Math.max(4, Math.min((width - pad[1] - pad[3]) / (bx1 - bx0), (height - pad[0] - pad[2]) / (by1 - by0))) * zoom;
    const oxC = pad[3] + (width - pad[1] - pad[3]) / 2 - (bx0 + bx1) / 2 * scale, oyC = pad[0] + (height - pad[0] - pad[2]) / 2 - (by0 + by1) / 2 * scale;
    const ox = oxC + panX, oy = oyC + panY;
    const project = (p) => { const r = P.rawProject(p, turn); return [r[0] * scale + ox, r[1] * scale + oy, r[2]]; };
    const angle = turn * Math.PI / 2, cos = Math.cos(angle), sin = Math.sin(angle);
    const towards = norm([cos + sin, cos - sin, 1]);                                     // from the scene to the camera
    const near = (x, y) => x * (cos + sin) + y * (cos - sin);                            // ground distance towards the camera
    const sun = norm(lighting === "golden" ? [-4, -5, 5] : [-3, -4, 8]), lit = lighting === "day" || lighting === "golden";
    const depthOf = (pts) => pts.reduce((sum, p) => sum + P.rawProject(p, turn)[2], 0) / pts.length;

    const cells = m.cells.map((c) => { const screen = c.quad.map(project); return { ...c, screen, box: boundsOf(screen), depth: depthOf(c.quad), near: near(c.x + 0.5, c.y + 0.5), ground: null }; });
    const cellAt = (x, y) => cells[clamp(y, 0, snap.h - 1) * snap.w + clamp(x, 0, snap.w - 1)];
    const faces = [];
    for (const f of m.faces) {
      if (dot(f.n, towards) <= 0.0001 || (cutaway && CUT.has(f.kind))) continue;
      const screen = f.p.map(project), depth = f.skirt ? -Infinity : depthOf(f.p);   // the apron is one board-sized quad: by its centre it sorted over the court (Mala, 2026-10-26: "grey blobs ... like a rectangle underneath and clipping through the map")
      faces.push({ kind: f.kind, flat: f.flat, skirt: f.skirt, x: f.x, y: f.y, screen, box: boundsOf(screen), depth, top: f.c[2], near: f.flat ? near(f.x + 0.5, f.y + 0.5) : near(f.c[0], f.c[1]),
        up: f.n[2] > 0.5, color: f.color, wb: [Math.min(...f.p.map((p) => p[0])), Math.min(...f.p.map((p) => p[1])), Math.max(...f.p.map((p) => p[0])), Math.max(...f.p.map((p) => p[1]))], span: f.p.length === 4 ? [Math.hypot(f.p[1][0] - f.p[0][0], f.p[1][1] - f.p[0][1]), Math.hypot(f.p[3][0] - f.p[0][0], f.p[3][1] - f.p[0][1])] : null, fill: shade(f.color, f.n, sun, lighting), receiver: !f.skirt && (f.kind === "ground" || (f.kind === "ramp" && f.flat)) });
    }
    // Paving under the rounded deck fills the trimmed tile corners; it goes down before everything else.
    const under = cells.filter((c) => c.underlay).map((c) => { const world = [[c.x, c.y, c.z], [c.x + 1, c.y, c.z], [c.x + 1, c.y + 1, c.z], [c.x, c.y + 1, c.z]], screen = world.map(project);
      return { kind: "underlay", flat: true, x: c.x, y: c.y, screen, box: boundsOf(screen), depth: -Infinity, top: c.z, near: c.near, fill: shade("#e1d4b8", [0, 0, 1], sun, lighting), receiver: false }; });
    faces.sort((a, b) => a.depth - b.depth);
    // A tile's ground drawings go down straight after the last piece of its own top surface.
    for (const f of faces) if (f.flat) { const c = cellAt(f.x, f.y); if (f.depth > c.depth) c.depth = f.depth; }
    const order = [...under.map((face) => ({ face })), ...faces.map((face) => ({ face, depth: face.depth, rank: 0 })), ...cells.map((cell) => ({ cell, depth: cell.depth, rank: 1 }))];
    order.sort((a, b) => (a.depth ?? -Infinity) - (b.depth ?? -Infinity) || (a.rank || 0) - (b.rank || 0));
    order.forEach((entry, index) => { entry.index = index; });

    // Cast shadows onto the receiving top surface: the sculptor's receiver-clipped approximation, not ray tracing.
    const shadows = [];
    if (lit) for (const caster of m.casters) {
      if (cutaway && CUT.has(caster.kind)) continue;
      const c = mid(caster.p), floor = snap.height[clamp(Math.floor(c[1]), 0, snap.h - 1)][clamp(Math.floor(c[0]), 0, snap.w - 1)] * m.L;
      if (c[2] - floor < 0.12) continue;
      const pts = caster.p.map((p) => { const dz = Math.max(0, p[2] - floor); return [p[0] - sun[0] / sun[2] * dz, p[1] - sun[1] / sun[2] * dz, floor + 0.012]; });
      if (pts.some((p) => p[0] < 0 || p[1] < 0 || p[0] > snap.w || p[1] > snap.h)) continue;
      const screen = pts.map(project); shadows.push({ screen, box: boundsOf(screen) });
    }
    for (const f of faces) if (f.receiver) { const local = shadows.filter((s) => overlap(s.box, f.box)); if (local.length) f.shadows = local; }

    // Built stone only (an allowlist: thorn mounds, beams, rails and painted balustrades keep their own colour).
    const TEXTURED = new Set(["architecture", "wall", "column", "coping", "planter"]);
    // Top-down texture laid on the world plane at height z: one image covers `tiles` tiles, aligned to the world grid, so
    // neighbouring faces join without seams and a thin top shows its slice. Clipped to the face.
    const patterns = new WeakMap();
    function lay(g, f, img, tiles) {
      const z = f.top, p0 = project([0, 0, z]), px = project([1, 0, z]), py = project([0, 1, z]), iw = img.naturalWidth / tiles, ih = img.naturalHeight / tiles;
      let pat = patterns.get(img); if (!pat) { pat = g.createPattern(img, "repeat"); patterns.set(img, pat); }
      const [x0, y0, x1, y1] = f.wb;
      g.save(); g.beginPath(); trace(g, f.screen); g.clip();
      g.transform((px[0] - p0[0]) / iw, (px[1] - p0[1]) / iw, (py[0] - p0[0]) / ih, (py[1] - p0[1]) / ih, p0[0], p0[1]);
      g.fillStyle = pat; g.fillRect(x0 * iw, y0 * ih, (x1 - x0) * iw, (y1 - y0) * ih);
      g.restore();
    }
    function texture(g, f) {   // Mala, 2026-10-27: "texture everything" / "actual terrain instead of grey blob"
      if (!api.surface || !f.up || !f.wb || !(f.skirt || TEXTURED.has(f.kind))) return;
      const t = api.surface(f.skirt ? "apron" : "top", f); if (!t || !t.img || !t.img.naturalWidth) return;
      lay(g, f, t.img, t.tiles || 1);
      // keep the sun's shading (tops) or dim it a little (the apron: land you cannot walk on)
      g.save(); g.globalAlpha = f.skirt ? 0.3 : 0.32; g.beginPath(); trace(g, f.screen); g.fillStyle = f.skirt ? "#0d1208" : f.fill; g.fill(); g.restore();
    }
    function drawFace(g, f) {
      g.beginPath(); trace(g, f.screen); g.fillStyle = f.fill; g.fill(); g.strokeStyle = f.fill; g.lineWidth = 0.35; g.stroke();
      texture(g, f);
      if (!f.shadows) return;
      g.save(); g.beginPath(); trace(g, f.screen); g.clip(); g.globalAlpha = 0.17; g.fillStyle = "#514735"; g.beginPath();
      for (const s of f.shadows) trace(g, s.screen);
      g.fill(); g.restore();
    }
    // Lay tile-rectangle drawing onto a tile's ground quad. rect = [px, py, tw, th]: the rectangle fn draws into.
    function tile(g, x, y, rect, fn) {
      const q = cellAt(x, y).screen, [px, py, tw, th] = rect;
      const a = (q[1][0] - q[0][0]) / tw, b = (q[1][1] - q[0][1]) / tw, c = (q[3][0] - q[0][0]) / th, d = (q[3][1] - q[0][1]) / th;
      g.save(); g.transform(a, b, c, d, q[0][0] - a * px - c * py, q[0][1] - b * px - d * py); fn(px, py); g.restore();
    }
    function gridOf(g, c) { if (grid) { g.beginPath(); trace(g, c.screen); g.strokeStyle = lighting === "night" ? "#d8dcf02e" : "#39433345"; g.lineWidth = 0.65; g.stroke(); } }
    function drawCell(g, c) { gridOf(g, c); if (c.ground) for (const item of c.ground) item(g); }
    function scene(g, withGround) {
      // Model grounding, separate from the architectural cast shadows.
      g.save(); g.filter = "blur(15px)"; g.beginPath(); trace(g, [[0, 0, -0.3], [snap.w, 0, -0.3], [snap.w, snap.h, -0.3], [0, snap.h, -0.3]].map(project)); g.fillStyle = "#1a181433"; g.fill(); g.restore();
      for (const entry of order) entry.face ? drawFace(g, entry.face) : withGround ? drawCell(g, entry.cell) : gridOf(g, entry.cell);
    }
    // The scene without any ground drawings, kept as one bitmap: it only changes when the terrain, the size or the
    // lighting does, and it is some four thousand faces.
    function backdrop(g) {
      if (!api.layer) return null;
      const ratio = g.getTransform ? g.getTransform().a || 1 : 1, key = snap.key + "|" + vkey + "|" + ratio + "|" + (api.textureEpoch || 0);   // a texture that finished loading rebakes
      if (kept && kept.key === key) return kept.canvas;
      const canvas = api.layer(Math.ceil(width * ratio), Math.ceil(height * ratio)), lg = canvas && canvas.getContext("2d");
      if (!lg) return null;
      lg.setTransform(ratio, 0, 0, ratio, 0, 0); scene(lg, false); kept = { key, canvas }; return canvas;
    }
    // ground = [{ x, y, draw(g) }]: drawn on a tile's top, in the scene's own depth order, so a wall or a crown in
    // front of the tile still covers it. With a few of them the kept bitmap goes down first and one pass over the
    // order redraws, inside the touched tiles only, whatever the scene draws after each; with many (a dream over the
    // whole court) the scene is painted through.
    function paint(g, ground = []) {
      for (const c of cells) c.ground = null;
      let busy = 0;
      for (const item of ground) { const c = cellAt(Math.round(item.x), Math.round(item.y)); if (!c.ground) { c.ground = []; busy++; } c.ground.push(item.draw); }
      const layer = busy <= 60 ? backdrop(g) : null;
      if (!layer) return scene(g, true);
      g.drawImage(layer, 0, 0, width, height);
      if (!busy) return;
      const touched = [], spill = scale * 0.5; let clipped = false;
      for (const entry of order) {
        const c = entry.cell;
        if (c && c.ground) {
          if (clipped) g.restore();
          for (const item of c.ground) item(g);
          touched.push([c.box[0] - spill, c.box[1] - spill, c.box[2] + spill, c.box[3] + spill]);
          g.save(); g.beginPath(); for (const b of touched) g.rect(b[0], b[1], b[2] - b[0], b[3] - b[1]); g.clip(); clipped = true;
          continue;
        }
        const item = entry.face || c;
        if (!clipped || !touched.some((b) => overlap(item.box, b))) continue;
        entry.face ? drawFace(g, item) : gridOf(g, item);
      }
      if (clipped) g.restore();
    }
    // An upright sprite standing at tile `at` was just drawn inside `box`. Put back whatever stands between it and
    // the camera: anything nearer on the ground, except tile tops that are not above its feet (they cannot cover it,
    // and leaving them alone keeps overlays drawn on them intact). Returns the faces that did the covering.
    function occlude(g, box, at) {
      const from = near(at[0] + 0.5, at[1] + 0.5) + 1e-6, feet = cellAt(Math.round(at[0]), Math.round(at[1])).stand + 0.1, hit = [];
      g.save(); g.beginPath(); g.rect(box[0], box[1], box[2] - box[0], box[3] - box[1]); g.clip();
      for (const entry of order) {
        const item = entry.face || entry.cell;
        if (item.skirt || item.near <= from || !overlap(item.box, box)) continue;   // the apron is never in front of anything
        if (entry.face) { if (item.flat && item.top <= feet) continue; drawFace(g, item); hit.push(item.screen); }
        else if (item.stand > feet) drawCell(g, item);
      }
      g.restore(); return hit;
    }
    const stand = (x, y) => cellAt(x, y).stand;
    function zAt(x, y) {
      const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
      if (!tx && !ty) return stand(x0, y0);
      return (stand(x0, y0) * (1 - tx) + stand(x0 + 1, y0) * tx) * (1 - ty) + (stand(x0, y0 + 1) * (1 - tx) + stand(x0 + 1, y0 + 1) * tx) * ty;
    }
    const at = (x, y) => { const p = project([x + 0.5, y + 0.5, zAt(x, y)]); return [p[0], p[1]]; };
    const byDepth = cells.slice().sort((a, b) => b.depth - a.depth);
    const pick = (sx, sy) => { const c = byDepth.find((c) => sx >= c.box[0] && sx <= c.box[2] && sy >= c.box[1] && sy <= c.box[3] && inside([sx, sy], c.screen)); return c ? [c.x, c.y] : null; };
    const tw = scale * 1.2;
    const made = { snap, scale, turn, lighting, cutaway, width, height, tw, th: tw * 0.6, ring: [scale, scale / Math.sqrt(3)], project, at, zAt, tile, paint, occlude, pick,
      near: (x, y) => near(x + 0.5, y + 0.5), quad: (x, y) => cellAt(x, y).screen, faces, cells, order,
      zoom, ox, oy, oxC, oyC, frameC: [oxC + (bx0 + bx1) / 2 * scale, oyC + (by0 + by1) / 2 * scale] };
    snap.views.set(vkey, made); return made;
  }

  // layer(w, h) makes the canvas the scene is kept on; without one (no document) every frame paints the scene through.
  // surface(kind, face) → { img, tiles } or null for kind "top" (flat built tops) or "apron" (the ground outside the board);
  // the battle supplies the art. textureEpoch bumps when one of those images loads, which rebakes the kept scene.
  const api = { supports, sculpted, snapshot, view, model, CUT, POPULATION, surface: null, textureEpoch: 0,
    layer: typeof document !== "undefined" ? (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; } : null };
  return api;
});
