"use strict";
// Drone tower art (claude-drone-tower-art-spec TA1; Mala, 2026-11-16: "Drone towers dont have art when theyre summoned in game";
// put next in the ui.js lane 2026-11-24, R-20261124-03). A drone tower is a flag on an object already on the map
// (`o.tower`, set by Drone Station in classes/class-runtime.js), so nothing drew it: the anchor's own art stood unchanged.
// This file draws the sci-fi tower (Garboard CU's cut, sprites/sci-fi-tower/) over the anchor, on the same tile, after the
// anchor is drawn: the tree or bench stays drawn beneath it (Decision 1, R-20261116-20), fitted to 1.5 tile heights
// (Decision 4). It reads state and never writes it: collision, cover, sight and what the anchor is do not change
// (docs/isometric-battle-view.md: drawn architecture adds none). ui.js calls drawOver from drawMapObject, the one object door
// both boards use (flat directly; iso through upright()). TA2 replaces spriteFor with the state picker (damaged, overclocked,
// alert); until then every standing tower is `idle`, the one piece this slice lands (CONVENTIONS C10, Decision 3).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatDroneTowerArt = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const FOLDER = "sci-fi-tower";
  // The fit box, in tiles: 1.5 tile heights (Decision 4) and the 1.1 tile widths drawLivingObject gives object art.
  const FIT = { w: 1.1, h: 1.5 };
  const FOOT = 0.88;   // the foot line drawLivingObject stands object art on, as a share of a tile height

  // The piece a towered object shows, or null when there is no tower to draw: no flag, or the anchor is dead (the tower
  // dies with its anchor). One answer in TA1.
  function spriteFor(o) { return o && o.tower && !o.dead && (o.hp ?? 0) > 0 ? "idle" : null; }
  const src = (id) => `combat/sprites/${FOLDER}/${id}.png`;

  // One image per piece, loaded once; the board redraws when it arrives. A page with no Image (node) never loads.
  const images = new Map();
  function image(id, redraw) {
    if (typeof Image === "undefined" || typeof document === "undefined") return null;
    if (!images.has(id)) {
      const img = new Image(); img.src = new URL(src(id), document.baseURI).href;
      img.onload = () => { if (redraw) redraw(); }; img.onerror = () => {}; images.set(id, img);   // a failed load stays cached, so a missing piece is not re-requested every redraw
    }
    const img = images.get(id); return img && img.complete && img.naturalWidth ? img : null;
  }

  // Where the art goes: centred on the tile, its foot on the anchor's foot line, fitted inside FIT keeping its shape.
  // box is the art's visible part ({ x, y, w, h } in image pixels); foot is the iso lift drawLivingObject applies (0 flat).
  function place(box, x, y, tw, th, foot = 0) {
    const k = Math.min(tw * FIT.w / box.w, th * FIT.h / box.h), dw = box.w * k, dh = box.h * k, bottom = y - foot + th * FOOT;
    return [x + tw / 2 - dw / 2, bottom - dh, x + tw / 2 + dw / 2, bottom];
  }

  // Draw the tower over an object that was just drawn. drawn is the rectangle the anchor's art filled ([x0, y0, x1, y1], or
  // undefined for drawn shapes); the answer is the rectangle both fill, which the iso board uses to hide a unit behind it.
  // opts: { foot, artBox(img) -> visible box, log(group, id, o), redraw(), image(id) for tests }.
  function drawOver(g, o, drawn, x, y, tw, th, opts = {}) {
    const id = spriteFor(o); if (!id) return drawn;
    const img = opts.image ? opts.image(id) : image(id, opts.redraw); if (!img) return drawn;
    const b = opts.artBox ? opts.artBox(img) : { x: 0, y: 0, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
    const r = place(b, x, y, tw, th, opts.foot || 0);
    g.save(); g.imageSmoothingEnabled = false; g.drawImage(img, b.x, b.y, b.w, b.h, r[0], r[1], r[2] - r[0], r[3] - r[1]); g.restore();
    if (opts.log) opts.log(FOLDER, id, o);
    return drawn ? [Math.min(drawn[0], r[0]), Math.min(drawn[1], r[1]), Math.max(drawn[2], r[2]), Math.max(drawn[3], r[3])] : r;
  }

  return { FOLDER, FIT, FOOT, spriteFor, src, place, drawOver };
});
