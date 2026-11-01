"use strict";
// Agent duel page (web/live-agent.html; Codex's prototype, UI pass by Claude 2026-10-26). Pick fighters and an arena, start
// the duel, and give an active agent the command; the status pill says who controls the agent's fighter, and a bar counts
// down the agent's time on its turn. The battle itself is the normal Loci UI; only the foe is agent-controlled.
(async function () {
  const q = (id) => document.getElementById(id), status = q("agentStatus"), box = q("agentState"), clock = q("agentClock");
  let config, ui, started = false, released = false, deadline = 0, limit = 0;
  // States: idle (grey), waiting (gold, counting down), chose (green), builtin (blue), lost (red).
  const show = (state, text) => { box.dataset.state = state; status.textContent = text; };
  const stepNow = (id) => { for (const s of ["stepPick", "stepConnect"]) { q(s).classList.toggle("now", s === id); q(s).classList.toggle("done", s === "stepPick" && id === "stepConnect"); } };
  const C = globalThis.ConceptCombatContent;
  const foeName = () => C?.characters?.[q("opponent").value]?.name || "the agent's fighter";

  // Fighters: the Warden and the playable roster (every character with a build), by name. Arenas: the Gap Court and the authored maps.
  function fillPickers() {
    const roster = Object.entries(C.characters).filter(([id, c]) => (c.configs || id === "warden") && !c.permanentAlly && !c.boss)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name));
    for (const [sel, pick] of [["human", "warden"], ["opponent", "pathfinder"]])
      q(sel).innerHTML = roster.map(([id, c]) => `<option value="${id}"${id === pick ? " selected" : ""}>${c.name}</option>`).join("");
    const authored = globalThis.ConceptCombatAuthoredArenas || {};
    const arenas = [["gapCourt", C.arenas.gapCourt.name], ...Object.entries(authored).map(([id, a]) => [id, a.name])];
    q("arena").innerHTML = arenas.map(([id, name]) => `<option value="${id}">${name}</option>`).join("");
  }
  // The arena and where the two fighters start: an authored map's own spawns, else the Gap Court's lanes.
  function stage() {
    const id = q("arena").value, Mapgen = globalThis.ConceptCombatMapgen;
    const arena = id === "gapCourt" || !Mapgen?.designed ? structuredClone(C.arenas.gapCourt) : Mapgen.designed(id);
    return { arena, at: [arena.spawns?.player?.[0] || [1, 2], arena.spawns?.enemy?.[0] || [5, 2]] };
  }

  const release = async () => {
    if (released) return;
    released = true; q("agentRelease").disabled = true; q("agentStart").disabled = false; q("agentStart").textContent = "Attach agent";
    ui?.useBuiltinAI();
    await fetch("/api/release", { method: "POST", headers: { "X-Loci-Token": config.token } });
    show("builtin", `Built-in AI controls ${foeName()}. Attach agent to hand it back.`);
  };
  try {
    if (!globalThis.ConceptCombatUI || !C) throw Error("Battle assets did not load. Reload this page.");
    fillPickers();
    const response = await fetch("/api/session"); if (!response.ok) throw Error("Prototype service is unavailable"); config = await response.json();
    const command = `python3 '${config.controller.replaceAll("'", "'\\''")}' pending --session '${config.session.replaceAll("'", "'\\''")}'`;
    q("agentCommand").textContent = command; q("agentCommand").title = command;
    q("agentCopy").onclick = async () => { await navigator.clipboard.writeText(command); q("agentCopy").textContent = "Copied ✓"; setTimeout(() => { q("agentCopy").textContent = "Copy command"; }, 1800); };
    const initial = await (await fetch("/api/status")).json();
    show("idle", initial.enabled ? "Ready. Ask an active agent to join this session." : "Ready. Pick fighters and start the duel.");
    q("agentRelease").onclick = () => release().catch((error) => show("lost", error.message));
    q("agentStart").onclick = async () => {
      const armed = await fetch("/api/attach", { method: "POST", headers: { "X-Loci-Token": config.token } });
      if (!armed.ok) { show("lost", "The previous turn is still closing. Try Attach agent again."); return; }
      released = false;
      if (started) {
        if (!ui.useSocketAI(config)) { show("lost", "This battle has ended. Reload for a new duel."); return; }
        q("agentStart").disabled = true; q("agentRelease").disabled = false; show("chose", `Agent attached to this battle: it controls ${foeName()}`); return;
      }
      started = true; stepNow("stepConnect");
      q("agentStart").disabled = true; q("human").disabled = q("opponent").disabled = q("arena").disabled = true; q("agentRelease").disabled = false;
      const { arena, at } = stage();   // account/profile writes stay in this prototype origin
      ui = window.duelUI = ConceptCombatUI.mount(q("duelHost"), {
        params: { autostart: true, socket: true, opener: "foe", narration: "", setupOpts: {
          encounter: "firstWall", startingActor: "foe", seed: 20261025, arenaData: arena,
          participants: [{ id: "player", character: q("human").value, side: "player", at: at[0] },
            { id: "foe", character: q("opponent").value, side: "enemy", at: at[1] }]
        } },
        llmBridge: { start: async () => config, stop: async () => {
          if (!released) { released = true; q("agentRelease").disabled = true; q("agentStart").disabled = false; q("agentStart").textContent = "Attach agent"; show("lost", `Agent disconnected · built-in AI controls ${foeName()}`); await fetch("/api/release", { method: "POST", headers: { "X-Loci-Token": config.token } }); }
        } }, onExit: () => { ui?.destroy(); release(); }
      });
      show("idle", `Duel started. Give the agent the command to control ${foeName()}.`);
    };
    setInterval(async () => {
      if (released || !started) return;
      try {
        const s = await (await fetch("/api/status")).json();
        if (!s.enabled) { await release(); return; }
        if (s.pending) {
          const left = Math.max(0, s.pending.expiresAt - Date.now() / 1000);
          if (s.pending.expiresAt !== deadline) { deadline = s.pending.expiresAt; limit = Math.max(left, 1); }
          clock.style.width = `${Math.round((left / limit) * 100)}%`;
          show("waiting", `Agent's turn as ${foeName()} · ${s.pending.choices} choices · ${Math.ceil(left)}s left`);
        } else if (s.last?.status === "selected") show("chose", "Agent chose its action · your battle continues");
        else show("idle", `Agent connected · waiting for ${foeName()}'s turn`);
      } catch (_) { show("lost", "Connection lost · Use built-in AI to continue"); }
    }, 500);
  } catch (error) { show("lost", error.message); q("agentStart").disabled = true; }
})();
