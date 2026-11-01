"use strict";
// Gaia's field veil. Same device as Dream Space in ui.js: a wash on every tile,
// drifting motes, then a breathing vignette and an edge after the actors.
// It holds while she is on the field. An open Dream Space keeps its own veil.
// Colors: Wounded Ground is umber and charcoal. The Living Accord adds moss and
// water and keeps the umber, so the scars stay.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ConceptCombatGaiaField = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Alphas match drawDreamTerrain / drawDreamFilter. Only the pigments change.
  const WASH = 0.13;
  const MOTE = 0.34;
  const DISTURBED = {
    id: "disturbed",
    name: "The Wounded Ground",
    tile: ["90, 58, 36", "42, 36, 32"],
    mote: "232, 186, 120",
    core: "92, 64, 40",
    edge: "28, 18, 12",
    border: "210, 148, 78",
    scar: "90, 58, 36",
  };
  const RESTORED = {
    id: "restored",
    name: "The Living Accord",
    tile: ["58, 96, 62", "90, 58, 36"],
    mote: "150, 198, 186",
    core: "64, 96, 70",
    edge: "20, 34, 26",
    border: "168, 196, 140",
    scar: "90, 58, 36",
  };

  function gaiaActor(state) {
    const actors = state && state.actors;
    if (!actors) return null;
    const list = Array.isArray(actors) ? actors : Object.values(actors);
    return list.find((a) => a && a.boss === "gaia" && !a.defeated) || null;
  }

  function veil(state) {
    if (!state || state.dreamSpace) return null;
    const gaia = gaiaActor(state);
    if (!gaia) return null;
    const palette = gaia.gaiaForm === "restored" ? RESTORED : DISTURBED;
    return { form: palette.id, palette, label: palette.name };
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  // each(x, y, draw) lets a board that is not a flat grid place a tile's drawing itself (the isometric view).
  function paintTerrain(ctx, look, arena, toTile, tile, now, each) {
    if (!ctx || !look || !arena || typeof toTile !== "function") return;
    const tw = tile.tw, th = tile.th;
    const phase = (now || 0) / 1400;
    const pal = look.palette;
    for (let y = 0; y < arena.h; y++) for (let x = 0; x < arena.w; x++) {
      const cell = (px, py) => {
      const i = (x * 13 + y * 7) % 2;
      ctx.fillStyle = "rgba(" + pal.tile[i] + "," + WASH + ")";
      roundRect(ctx, px + 3, py + 3, tw - 6, th - 6, 5);
      ctx.fill();
      if ((x * 17 + y * 29) % 7 === 0) {
        const drift = Math.sin(phase + x * 0.8 + y * 0.4);
        ctx.fillStyle = "rgba(" + pal.mote + "," + MOTE + ")";
        ctx.beginPath();
        ctx.arc(
          px + tw * (0.68 + drift * 0.08),
          py + th * (0.28 + Math.cos(phase + y) * 0.07),
          Math.max(1.5, tw * 0.025),
          0, Math.PI * 2,
        );
        ctx.fill();
      }
      };
      if (each) each(x, y, cell); else cell(...toTile(x, y));
    }
  }

  function paintFilter(ctx, look, view, now) {
    if (!ctx || !look || !view) return;
    const W = view.W, H = view.H;
    const pal = look.palette;
    const breathe = (Math.sin((now || 0) / 1800) + 1) * 0.025;
    ctx.save();
    const vignette = ctx.createRadialGradient(
      W * 0.5, H * 0.48, Math.min(W, H) * 0.18,
      W * 0.5, H * 0.48, Math.max(W, H) * 0.72,
    );
    vignette.addColorStop(0, "rgba(" + pal.core + ",0.025)");
    vignette.addColorStop(1, "rgba(" + pal.edge + "," + (0.26 + breathe) + ")");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(" + pal.border + ",0.56)";
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.restore();
  }

  return { DISTURBED, RESTORED, veil, paintTerrain, paintFilter };
});
