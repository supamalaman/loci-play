"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./decision.js"));
  else root.ConceptCombatLLMSocket = factory(root.ConceptCombatLLMDecision);
})(typeof self !== "undefined" ? self : this, function (Decision) {
  function endpoint(url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "ws:" || parsed.hostname !== "127.0.0.1") throw new Error("LLM socket must use ws://127.0.0.1 on loopback.");
    return parsed.href;
  }
  function requestAction({ url, token, request, currentDecisionId = () => request.decisionId,
    WebSocketCtor = globalThis.WebSocket, timeoutMs = 12000, signal } = {}) {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 305000) return Promise.reject(new Error("Invalid decision deadline."));
    if (typeof token !== "string" || token.length < 24) return Promise.reject(new Error("Missing ephemeral LLM bridge token."));
    if (typeof WebSocketCtor !== "function") return Promise.reject(new Error("WebSocket is unavailable in this runtime."));
    let target;
    try { target = endpoint(url); } catch (error) { return Promise.reject(error); }
    return new Promise((resolve, reject) => {
      let socket, settled = false, authenticated = false;
      const timer = setTimeout(() => finish(new Error("LLM opponent timed out.")), timeoutMs);
      const finish = (error, action) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        try { socket?.close(); } catch (_) { /* already closed */ }
        error ? reject(error) : resolve(action);
      };
      const abort = () => finish(new Error("LLM decision cancelled."));
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener("abort", abort, { once: true });
      try { socket = new WebSocketCtor(target); } catch (error) { finish(error); return; }
      socket.onopen = () => socket.send(JSON.stringify({ v: Decision.VERSION, type: "auth", token }));
      socket.onmessage = (event) => {
        if (settled) return;
        let message;
        try { message = JSON.parse(event.data); } catch (_) { finish(new Error("LLM bridge sent invalid JSON.")); return; }
        if (!authenticated) {
          if (message.v !== Decision.VERSION || message.type !== "bridge.ready") { finish(new Error("LLM bridge authentication failed.")); return; }
          authenticated = true; socket.send(JSON.stringify(request)); return;
        }
        if (message.type === "protocol.error" || message.type === "provider.error") { finish(new Error(message.message || "LLM bridge could not choose an action.")); return; }
        try { finish(null, Decision.resolveReply(request, message, currentDecisionId())); }
        catch (error) { finish(error); }
      };
      socket.onerror = () => finish(new Error("Could not connect to the local LLM bridge."));
      socket.onclose = () => { if (!settled) finish(new Error("LLM bridge disconnected before choosing an action.")); };
    });
  }
  return { endpoint, requestAction };
});
