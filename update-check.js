"use strict";
// The browser build's "update available" check (Mala, 2026-11-01: Redux needs the update bar the Mac app has).
// The build writes version.json (the version that was published); this compares it with the version the page is running
// (combat/version.js, written by ship.sh). Loaded by web-shim.js for the full app and by play.js for the Random Battle page.
(function (root) {
  const parts = (v) => String(v).split(".").map((n) => Number(n));
  const newer = (a, b) => {
    const x = parts(a), y = parts(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; }
    return false;
  };
  // version.json sits beside this script, so it is found from the script's own address, whatever address the page was opened at
  // (with or without the trailing slash). Without a document (tests) the plain relative name is used.
  const here = root.document && root.document.currentScript && root.document.currentScript.src;
  const where = () => (here ? new URL("version.json", here).href : "version.json") + "?t=" + Date.now();
  // fetcher is only replaced by tests. The query string defeats the host's cache so a fresh publish is seen at once.
  async function check(fetcher) {
    const running = root.ConceptCombatVersion || "";
    try {
      const r = await (fetcher || root.fetch.bind(root))(where(), { cache: "no-store" });
      if (!r.ok) throw new Error("no version.json");
      const staged = (await r.json()).version;
      return { running, staged: typeof staged === "string" ? staged : null, updateReady: !!running && typeof staged === "string" && /^\d+\.\d+\.\d+$/.test(staged) && newer(staged, running) };
    } catch (e) {
      return { running, staged: null, updateReady: false };
    }
  }
  root.ConceptCombatUpdate = { newer, check };
})(typeof self !== "undefined" ? self : this);
