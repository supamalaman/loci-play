"use strict";
// Shared sight geometry for the combat engine and the Arena Maps preview.
// A window is one-way glass: someone on the inside looks out along a normal
// line. From the outside, that look is open only within `limit` Manhattan
// tiles of the glass. No facing means both ends of the line must be that close.
// Opaque tiles (pillars, full cover above both ends) are decided by the caller
// or by hasSight below. Endpoints never block.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSight = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function line(x0, y0, x1, y1) {
    const out = []; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, x = x0, y = y0;
    for (;;) { out.push([x, y]); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } }
    return out;
  }

  function windowAllows(win, x0, y0, x1, y1, limit) {
    const lim = limit == null ? 4 : limit;
    const near = (x, y) => Math.abs(x - win.x) + Math.abs(y - win.y) <= lim;
    const facing = win.inside;
    if (!facing || (!facing[0] && !facing[1])) return near(x0, y0) && near(x1, y1);
    const side = (x, y) => {
      const dot = (x - win.x) * facing[0] + (y - win.y) * facing[1];
      return dot > 0 ? 1 : dot < 0 ? -1 : 0;
    };
    const from = side(x0, y0), to = side(x1, y1);
    if (from === 0 || to === 0 || from === to) return true;
    if (from > 0) return true;
    return near(x0, y0);
  }

  // Static boards: ground tiles plus authored objects. No barriers or units.
  function hasSight(arena, tiles, x0, y0, x1, y1, limit) {
    const h = arena.map.length, w = arena.map[0].length;
    if (x0 < 0 || y0 < 0 || x1 < 0 || y1 < 0 || x0 >= w || x1 >= w || y0 >= h || y1 >= h) return false;
    const heightAt = (x, y) => +(arena.height?.[y]?.[x] || 0);
    const pts = line(x0, y0, x1, y1);
    const top = Math.max(heightAt(x0, y0), heightAt(x1, y1));
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      const def = tiles[arena.map[y][x]] || {};
      const obj = (arena.objects || []).find((o) => o.x === x && o.y === y);
      const sightHeight = obj
        ? (obj.crownSuppressed ? 0 : (obj.sightHeight ?? null))
        : (def.blocksSightAtHeight != null ? def.blocksSightAtHeight : (def.sightHeight != null ? def.sightHeight : null));
      const cover = obj ? (obj.crownSuppressed ? 0 : (obj.cover ?? 0)) : (def.cover || 0);
      if (!obj && def.blocksSight && sightHeight == null) return false;
      if (sightHeight != null && sightHeight > top && cover >= 1) return false;
      if (obj?.window && !windowAllows(obj, x0, y0, x1, y1, limit)) return false;
    }
    return true;
  }

  return { line, windowAllows, hasSight };
});
