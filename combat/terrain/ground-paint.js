"use strict";
// Continuous ground for a Concept Combat arena. The tile grid stays in the data.
// Neighbouring cells of the same material and height share a surface. A line is
// drawn only where the material or the height changes. A panel outline is the
// caller's highlight, not part of the ground.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatGround = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const FILL = {
    ".": "#c6b59a",
    ",": "#6e8f4e",
    m: "#8a6846",
    w: "#5f97a4",
    "~": "#1e4e64",
    h: "#6e8f4e",
    T: "#8a6846",
    "#": "#8d877c",
    "/": "#c6b59a",
    "=": "#8d877c",
    b: "#a67c52",
    "*": "#7a624c",
    "^": "#6a7040",
  };
  const FACE = "#4a3b30";

  function hash(x, y, n) {
    let h = (x * 374761393 + y * 668265263 + n * 1274126177) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return h / 4294967296;
  }

  // What the ground is made of. A tree or hedge slot sits on mulch or turf.
  function material(ch) {
    if (ch === "T") return "m";
    if (ch === "h") return ",";
    return ch;
  }

  function paint(ctx, arena, geo) {
    const rows = arena.map.length;
    const cols = arena.map[0].length;
    const { tw, th, riseY, ox, oy } = geo;
    const heightAt = (x, y) => +arena.height[y][x];
    const at = (x, y) => [ox + x * tw, oy + y * th - heightAt(x, y) * riseY];

    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const drop = y + 1 < rows ? heightAt(x, y) - heightAt(x, y + 1) : 0;
      if (drop <= 0) continue;
      const [px, py] = at(x, y);
      ctx.fillStyle = FACE;
      ctx.fillRect(px, py + th, tw + 1, drop * riseY);
      ctx.fillStyle = "rgba(255,236,210,.28)";
      ctx.fillRect(px, py + th, tw, 2);
    }

    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const ch = material(arena.map[y][x]);
      const [px, py] = at(x, y);
      const eastSame = x + 1 < cols && material(arena.map[y][x + 1]) === ch && heightAt(x + 1, y) === heightAt(x, y);
      const southSame = y + 1 < rows && material(arena.map[y + 1][x]) === ch && heightAt(x, y + 1) === heightAt(x, y);
      ctx.fillStyle = FILL[ch] || "#6d7384";
      ctx.fillRect(px, py, tw + (eastSame ? 1 : 0), th + (southSame ? 1 : 0));
      ctx.save();
      ctx.beginPath();
      ctx.rect(px + 0.5, py + 0.5, tw - 1, th - 1);
      ctx.clip();
      if (ch === "," || ch === "m") {
        ctx.fillStyle = ch === "m" ? "rgba(58,34,18,.32)" : "rgba(255,255,255,.14)";
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.ellipse(
            px + 4 + hash(x, y, i) * (tw - 8),
            py + 4 + hash(x, y, i + 3) * (th - 8),
            ch === "m" ? 3 : 1.4,
            1.2,
            hash(x, y, i) * 3,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      } else if (ch === "." || ch === "/") {
        ctx.fillStyle = "rgba(255,248,230,.07)";
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(px + 6 + hash(x, y, i) * (tw - 12), py + 5 + hash(x, y, i + 2) * (th - 10), 2, 2);
        }
        if (ch === "/") {
          ctx.strokeStyle = "rgba(92,72,48,.4)";
          for (let i = 1; i <= 3; i++) {
            const yy = py + (th * i) / 4;
            ctx.beginPath();
            ctx.moveTo(px + 5, yy);
            ctx.lineTo(px + tw - 5, yy);
            ctx.stroke();
          }
        }
      } else if (ch === "w" || ch === "~") {
        ctx.strokeStyle = ch === "~" ? "rgba(186,224,232,.34)" : "rgba(226,246,250,.42)";
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 2; i++) {
          const yy = py + th * (0.35 + i * 0.28);
          ctx.beginPath();
          ctx.moveTo(px + 5, yy);
          ctx.quadraticCurveTo(px + tw * 0.5, yy - 3, px + tw - 5, yy);
          ctx.stroke();
        }
      }
      ctx.restore();

      ctx.strokeStyle = "rgba(28,22,16,.4)";
      ctx.lineWidth = 1;
      const seam = (nx, ny, x0, y0, x1, y1) => {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
        if (material(arena.map[ny][nx]) === ch && heightAt(nx, ny) === heightAt(x, y)) return;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      };
      seam(x + 1, y, px + tw, py + 1, px + tw, py + th - 1);
      seam(x, y + 1, px + 1, py + th, px + tw - 1, py + th);
    }
    return { at, cols, rows };
  }

  return { paint, material, FILL };
});
