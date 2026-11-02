"use strict";
// Concept Combat smoke art for fog and smoke barriers (Mala, 2026-11-01: "did we ever get those smoke effects in the game, we could use them for fog").
// Presentation only: it picks a frame and draws it where the barrier loop in ui.js already draws; it adds no rule, no tile and no engine state.
// The art is Keel's cut of the 16-bit smoke sheet (staged-art/smoke-effects/, installed to sprites/smoke/). Each strip holds four growth stages side by side,
// not equal cells, so the frame boxes are data here (sprites/smoke/frames.json is the record; tests/smoke-fx.test.mjs checks both agree).
// fog (the fruit Fog Bank, Weather Front) -> medium-puff, pale; smoke (Smoke Veil) -> large-puff, denser. A frame is fixed per tile (the same map always looks the
// same); with animation on it breathes a little, with animation Fast or reduced motion it is still. On the last owner turn it dims to 60% (one step, not a ramp).
// Size: a frame is drawn at (its pixel width x tile width / 72), so the pale puffs span about 0.75 to 0.85 of a tile and the dark smoke about 0.95 to 1.0.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ConceptCombatSmoke = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STRIPS = {
    "medium-puff": { size: [270, 177], frames: [[20, 94, 56, 130], [70, 79, 124, 131], [132, 66, 192, 130], [200, 72, 256, 130]] },
    "large-puff": { size: [270, 177], frames: [[6, 100, 43, 134], [53, 75, 114, 135], [120, 55, 193, 136], [196, 65, 264, 134]] },
  };
  const KIND = { fog: { strip: "medium-puff", frames: [1, 2], alpha: .86 }, smoke: { strip: "large-puff", frames: [2, 3], alpha: .9 } };
  const stats = { drawn: 0 };   // read by the browser test; nothing else uses it
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0);
  const isSmoke = (b) => !!b && !!KIND[b.concept];
  // Which frame, scale and fade for one barrier tile. `own` is the owner actor or undefined (a fled owner stays in actors; a deleted one does not).
  // `animate` is true only with animation Full and not Fast. Pure: the same inputs give the same output.
  function pick(b, own, now, animate) {
    const k = KIND[b && b.concept]; if (!k) return null;
    const h = hash(b.x, b.y), frame = k.frames[h % k.frames.length];
    const left = !b.permanent && own && typeof b.expiresAt === "number" ? b.expiresAt - own.ownerTurns : 99;
    const phase = (h % 628) / 100, t = animate ? now / 700 : 0;
    return { strip: k.strip, frame, scale: 1 + (animate ? .04 * Math.sin(t + phase) : 0), bob: animate ? 2 * Math.sin(t * .8 + phase) : 0, alpha: k.alpha * (left <= 1 ? .6 : 1) };
  }
  function any(s) { return !!(s && Array.isArray(s.barriers) && s.barriers.some(isSmoke)); }
  // Draw the picked frame bottom-anchored on the tile. `g` is a 2d context, `img` the strip image, (px, py) the tile's top-left, tw/th the tile size.
  function draw(g, img, p, px, py, tw, th) {
    const box = STRIPS[p.strip].frames[p.frame], sw = box[2] - box[0], sh = box[3] - box[1], k = tw / 72 * p.scale, dw = Math.min(sw * k, tw * 1.5), dh = dw * sh / sw;
    g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = p.alpha;
    g.drawImage(img, box[0], box[1], sw, sh, px + (tw - dw) / 2, py + th * .82 - dh + p.bob, dw, dh); g.restore(); stats.drawn++;
  }
  return { STRIPS, KIND, stats, isSmoke, any, pick, draw };
});
