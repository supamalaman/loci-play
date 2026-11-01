"use strict";
// Browser stand-in for the Mac app's native bridge (Loci.swift, Bridge.userContentController).
// Only the browser build loads this (tools/web-build/build-web.sh puts it before app.js).
// app.js calls window.webkit.messageHandlers.loci.postMessage({id, cmd, args}) and waits for Loci._resolve(id, data).
(function () {
  const reply = (id, data) => setTimeout(() => { if (typeof Loci !== "undefined") Loci._resolve(id, data); }, 0);
  const macOnly = () => ({ error: "The live agent needs the Loci Mac app." });
  const commands = {
    walks: async () => (await fetch("walks/walks.json", { cache: "no-store" })).json(),
    version: () => ({ running: self.ConceptCombatVersion || "", updateReady: false }),
    restart: () => { if (window.confirm("Reload Loci? Any active walk or battle will end.")) location.reload(); return { ok: true }; },   // app.js skips its own confirm when a bridge exists
    openExplainer: () => ({ ok: true }),   // the classic explainer page lives in the Explainer Library, not on this site
    reveal: () => ({ ok: true }),
    exportEmissaryTrace: (name, json) => {   // the Mac app saves a file; the browser downloads it
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      a.download = /\.json$/i.test(name) ? name : (name || "emissary-trace") + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return { ok: true };
    },
    llmStart: macOnly, llmModels: macOnly, llmCopyCommand: macOnly,
    llmStop: () => ({ ok: true }),
  };
  self.webkit = { messageHandlers: { loci: { postMessage({ id, cmd, args = [] }) {
    const run = commands[cmd] || (() => ({ error: "unknown command" }));
    Promise.resolve().then(() => run(...args)).then((d) => reply(id, d), (e) => reply(id, { error: String(e && e.message || e) }));
  } } } };
})();
