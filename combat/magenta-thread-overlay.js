"use strict";
// Magenta Trickster HUD: one magenta thread line and a 0–3 tension label between visible endpoints (MT1 T11).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatMagentaOverlay = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function viewOf(s, Magenta, viewer, H) {
    if (Magenta?.view) return Magenta.view(s, viewer, H);
    return [];
  }
  function draw(g, s, opts) {
    if (!g || !s) return;
    const Magenta = (typeof module === "object" && module.exports)
      ? require("./classes/magenta-trickster.js")
      : (typeof self !== "undefined" ? self : this).ConceptCombatMagenta;
    const viewer = opts?.viewer || s.actors?.player;
    const rows = viewOf(s, Magenta, viewer, opts?.H);
    const centre = opts.centre, reduced = !!(opts.reduced);
    if (typeof centre !== "function") return;
    g.save();
    for (const row of rows) {
      const a = centre(...row.from), b = centre(...row.to);
      if (!a || !b) continue;
      g.strokeStyle = "rgba(220, 64, 160, 0.92)";
      g.lineWidth = 2;
      if (!reduced) g.setLineDash([6, 4]);
      else g.setLineDash([]);
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
      g.setLineDash([]);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      g.fillStyle = "rgba(18, 8, 16, 0.78)";
      g.fillRect(mx - 28, my - 10, 56, 16);
      g.fillStyle = "#f4c6e4";
      g.font = "11px ui-sans-serif, system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(`Tension ${row.tension}/3 · expires at your turn ${row.expiresOwnerTurn}`, mx, my);
    }
    g.restore();
  }
  return { draw, viewOf };
});
