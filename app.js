"use strict";
// Loci UI: library of walks → full-window play with a field-notes drawer.
const Loci = (() => {
  let seq = 0;
  const pending = new Map();
  const call = (cmd, ...args) => new Promise((resolve) => {
    const id = ++seq; pending.set(id, resolve);
    window.webkit.messageHandlers.loci.postMessage({ id, cmd, args: args.map(String) });
  });
  const $ = (id) => document.getElementById(id);
  const VignetteCampaign = window.ConceptCombatVignettes;
  const VerdictScenarios = window.ConceptCombatVerdict;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const keyFor = (slug) => "loci:" + slug;

  const S = { walks: [], data: {}, current: null, engine: null, duel: null, emergent: null, story: null };
  const STORY_KEY = "loci:vignettes:phase-one";
  // Hall of Warriors (combat/modes/hall.js): every class that wins the campaign gets a badge; milestones pay Seeds.
  const Hall = window.ConceptCombatHall, HALL_KEY = "loci:hall:v1", ACCOUNT_KEY = "loci:combat:account:v1";
  const readHall = () => { const h = store.get(HALL_KEY, null); return Hall?.valid(h) ? h : Hall?.create(); };
  const saveHall = (h) => store.set(HALL_KEY, h);
  const hallRoster = () => Hall ? Hall.eligible(window.ConceptCombatContent?.characters || {}) : [];

  // Load one walk's explainer-data.js (defines window.ExplainerData) and capture it.
  function loadData(w) {
    if (S.data[w.slug]) return Promise.resolve(S.data[w.slug]);
    return new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = w.data + "?t=" + Date.now();
      tag.onload = () => { S.data[w.slug] = window.ExplainerData; delete window.ExplainerData; tag.remove(); resolve(S.data[w.slug]); };
      tag.onerror = () => { tag.remove(); reject(new Error("couldn't read " + w.data)); };
      document.head.appendChild(tag);
    });
  }

  // ── library ───────────────────────────────────────────────────────────────
  async function refresh() {
    S.walks = await call("walks");
    S.data = {};
    for (const w of S.walks) { try { await loadData(w); } catch (e) { w.error = e.message; } }
    renderLibrary();
  }

  function progressOf(w) {
    const d = S.data[w.slug];
    const total = d?.walk?.stations?.length || 0;
    const visited = store.get(keyFor(w.slug) + ":visited", []).length;
    const score = store.get(keyFor(w.slug) + ":score", {});
    const vals = Object.values(score);
    return { total, visited, recalled: vals.filter(Boolean).length, tested: vals.length, recall: store.get(keyFor(w.slug) + ":recall", false) };
  }

  // The Locusfruit (respec S6a): a walk with a perfect recall score (every question recalled, at least one asked) earns it, once; the walks half of Loci writes the combat account it
  // already reads (homeAccount). account/fruit.js decides: it grants only with RULES.respec on, and only while the fruit rests in the palace.
  function grantLocusfruit() {
    try {
      const F = window.ConceptCombatFruit, A = window.ConceptCombatAccount, raw = localStorage.getItem("loci:combat:account:v1");
      if (!F || !A || !raw || !S.walks.some((w) => { const p = progressOf(w); return p.tested >= 1 && p.recalled === p.tested; })) return "";
      const r = F.grantLocus(A.deserialize(JSON.parse(raw)));
      if (!r.granted) return "";
      localStorage.setItem("loci:combat:account:v1", JSON.stringify(A.serialize(r.account)));
      return r.line;
    } catch { return ""; }
  }
  function renderLibrary() {
    const host = $("walks"), grown = grantLocusfruit();
    if (!S.walks.length) {
      host.innerHTML = `<div class="empty"><b>No walks yet.</b><br>Create one in the Explainer Library with
        <code>node scaffold.mjs "Walk with X" --kind walk</code>, then press ⌘R.</div>`;
      renderDuels();
      return;
    }
    host.innerHTML = S.walks.map((w) => {
      const d = S.data[w.slug], p = progressOf(w);
      const pct = p.total ? Math.round((p.visited / p.total) * 100) : 0;
      const theme = d?.walk?.theme || "alpine";
      return `<button class="walk-card" data-slug="${esc(w.slug)}" style="--accent:${esc(w.accent)}" ${w.error ? "disabled" : ""}>
        <canvas class="thumb" data-slug="${esc(w.slug)}" width="320" height="180"></canvas>
        <div class="wc-body">
          <div class="wc-eyebrow">${esc(theme)} · ${p.total} stations</div>
          <div class="wc-title">${esc(w.title)}</div>
          <div class="wc-dek">${esc(w.error || w.dek || d?.hero?.dek || "")}</div>
          <div class="wc-meta">
            <span class="bar"><i style="width:${pct}%"></i></span>
            <span>${p.visited}/${p.total} visited${p.tested ? ` · recall ${p.recalled}/${p.tested}` : ""}</span>
          </div>
          <div class="wc-cta">${p.visited === 0 ? "Start walk ▶" : p.visited < p.total ? "Continue ▶" : p.recall ? "Recall again ▶" : "Walk in Recall mode ▶"}</div>
        </div>
      </button>`;
    }).join("");
    host.querySelectorAll(".walk-card").forEach((b) => b.onclick = () => play(b.dataset.slug));
    host.querySelectorAll("canvas.thumb").forEach((cv) => drawThumb(cv, S.data[cv.dataset.slug]));
    if (grown) host.insertAdjacentHTML("afterbegin", `<div class="empty" id="locusGrown" role="status"><b>${esc(grown)}</b><br>Eat it from the Field Kit, if you dare.</div>`);   // respec S6a: the walk-complete card, once per grant
    renderDuels();
  }

  // ── home: Concept Combat first (Mala, 2026-10-26), then Study, then Labs ──
  // The panel reads the real account (level, title, seeds, record) and the saved character; the old profile record is not used.
  function homeAccount() {
    try { const raw = localStorage.getItem("loci:combat:account:v1"), A = window.ConceptCombatAccount; return raw && A ? A.deserialize(JSON.parse(raw)) : null; } catch { return null; }
  }
  // Arantxa on the home surfaces (NPC faces S4b): the home hero, the practice card, the Quiet House board.
  // Fresh visitors (no account yet) get no strip: no account is conjured from the home page, and their first
  // keeper meeting is Rama in town. Hosts without a heading get a slot div so the strip never lands inside a card.
  function mountHomeKeeper(hostId, windowId) {
    const KU = window.ConceptCombatKeeperUI, A = window.ConceptCombatAccount, Board = window.ConceptCombatBoard;
    const acc = homeAccount(), host = $(hostId);
    if (!KU || !A || !acc || !host) return null;
    const ov = host.querySelector("h2") ? host : host.appendChild(document.createElement("div"));
    const b = acc.board || {}, job = (b.postings || []).find((m) => m.id === b.accepted && m.expiresAt > (acc.battles || 0));
    return KU.mount(ov, windowId, { account: acc, store, dialogueOn: store.get("loci:combat:dialogue", true),
      facts: { owed: Math.max(0, acc.debt || 0), accepted: job ? { text: Board ? Board.describe(job) : job.condition, left: job.expiresAt - (acc.battles || 0) } : null, perkPoints: acc.perkPoints || 0 },
      onAccount: (a) => { try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(A.serialize(a))); } catch {} },
      onDialogue: (on) => store.set("loci:combat:dialogue", on) });
  }
  function renderDuels() {
    const C = window.ConceptCombatContent; if (!C) return;
    const acc = homeAccount(), saved = store.get("loci:combat:character", null), classId = saved?.classId && C.characters[saved.classId] ? saved.classId : "warden";
    const ch = C.characters[classId], art = window.ConceptCombatUI?.portraitSource?.({ sprite: ch.sprite })?.idle || "combat/sprites/player/idle.png";
    const A = window.ConceptCombatAccount, level = acc?.level || 1, per = A?.rules?.xpPerLevel || 100, into = acc ? (acc.xp % per) : 0;
    const earned = acc && A?.titlesOf ? A.titlesOf(acc).slice(-1)[0] : null;   // titles are kept as earned; fall back to what the level has reached
    const title = earned?.name || (typeof earned === "string" ? earned : "") || ((A?.rules?.titles || []).filter((t) => level >= t.level).slice(-1)[0]?.name || "");
    const secretDone = !!(acc && window.ConceptCombatSecretWarriorNext && A?.secretsOf?.(acc).includes(window.ConceptCombatSecretWarriorNext.ENCOUNTER));   // beaten: grey out until a new secret ships
    const campaign = readStory(), story = campaign?.status === "active" ? "Resume" : campaign?.status === "won" || campaign?.status === "lost" ? "Review" : "Begin";
    $("ccHome").innerHTML = `<div class="cch-art"><img src="${esc(art)}" alt=""></div>
      <div class="cch-main">
        <div class="cch-eyebrow">Concept Combat · turn-based battles where concepts interact</div>
        <div class="cch-name">${esc(ch.name)}${title ? `<span>${esc(title)}</span>` : ""}</div>
        <div class="cch-stats"><b>Level ${level}</b><span class="bar" title="${into}/${per} XP to level ${level + 1}"><i style="width:${Math.round((into / per) * 100)}%"></i></span>
          <span>${acc ? `${acc.seeds ?? 0} Seeds · ${acc.wins || 0}/${acc.battles || 0} won` : "A new account starts at level 1"}</span></div>
        <div class="cch-actions">
          ${window.ConceptCombatSecretWarriorNext ? (secretDone ? `<button type="button" class="cch-go cch-secret" id="ccHomeSecret" disabled title="No new sealed fight yet">Fight Secret Warrior ▶<small>Coming soon...</small></button>` : `<button type="button" class="cch-go cch-secret" id="ccHomeSecret" title="The sealed fight, straight from the front page">Fight Secret Warrior ▶<small>a sealed fight</small></button>`) : ""}
          <button type="button" class="cch-go" id="ccHomeGo">Continue ▶<small>the town and every mode</small></button>
          <button type="button" id="ccHomeQuick" title="A random battle: arena, foes and weather all rolled">Quick battle</button>
          <button type="button" id="ccHomeStory" title="A branching campaign: evidence, a hearing, a verdict">${story} The Quiet House</button>
          <button type="button" id="ccHomeKit" title="Stash, battle pack, worn gear and the camp kitchen">Field Kit</button>
        </div>
      </div>`;
    if ($("ccHomeSecret")) $("ccHomeSecret").onclick = () => duel("secret");
    $("ccHomeGo").onclick = () => duel();
    $("ccHomeQuick").onclick = () => duel("quick");
    $("ccHomeStory").onclick = campaignBoard;
    $("ccHomeKit").onclick = () => duel("kit");
    $("duels").innerHTML = `<button class="walk-card" id="duelCard" style="--accent:#e9c46a">
      <canvas class="thumb" id="duelThumb" width="320" height="180"></canvas>
      <div class="wc-body"><div class="wc-eyebrow">practice · 1 vs 1</div>
        <div class="wc-title">First Wall</div>
        <div class="wc-dek">Learn one interaction at a time: place a Shield Wall across a straight-line Filter Bolt.</div>
        <div class="wc-cta">Start practice ▶</div></div></button>
      <button class="walk-card" id="emergentCard" style="--accent:#77c9a1">
        <canvas class="thumb" id="fieldThumb" width="320" height="180"></canvas>
        <div class="wc-body"><div class="wc-eyebrow">field combat · mathematics track</div>
          <div class="wc-title">Emergent Field Lab</div>
          <div class="wc-dek">Play with eight relational operators, then learn graph theory through paths, cycles, bridges and a formalized theorem.</div>
          <div class="wc-cta">Play and study ▶</div></div>
      </button>`;
    $("duelCard").onclick = () => duel();
    $("emergentCard").onclick = openEmergent;
    mountHomeKeeper("ccHome", "homeHero");   // Arantxa (S4b)
    mountHomeKeeper("duels", "practiceYard");   // Arantxa (S4b)
    drawCombatThumb($("duelThumb"), C);
    const fv=$("fieldThumb"),fg=fv.getContext("2d");fg.fillStyle="#1d1b22";fg.fillRect(0,0,fv.width,fv.height);
    const FC=EmergentCombatContent.arena.cells, scale=50,fx=65,fy=25;
    for(const e of EmergentCombatContent.arena.connections){const a=FC.find(c=>c.id===e.a),b=FC.find(c=>c.id===e.b);
      fg.strokeStyle="#77c9a1";fg.lineWidth=4;fg.beginPath();fg.moveTo(fx+(a.x+.5)*scale,fy+(a.y+.5)*scale);fg.lineTo(fx+(b.x+.5)*scale,fy+(b.y+.5)*scale);fg.stroke();}
    for(const c of FC){fg.fillStyle="#363341";fg.beginPath();fg.arc(fx+(c.x+.5)*scale,fy+(c.y+.5)*scale,15,0,Math.PI*2);fg.fill();
      fg.fillStyle="#e9c46a";fg.font="11px Menlo";fg.textAlign="center";fg.fillText(c.q?"q="+c.q:c.id,fx+(c.x+.5)*scale,fy+(c.y+.5)*scale+4);}
  }
  // Current game art and the practice interaction: an opposing line stops at a placed Shield Wall.
  // The canvas fallback is useful even before the two local sprite files finish loading.
  function drawCombatThumb(cv, C) {
    const g = cv.getContext("2d"), art = [new Image(), new Image()];
    const draw = () => {
      const bg = g.createLinearGradient(0, 0, 320, 180); bg.addColorStop(0, "#172333"); bg.addColorStop(1, "#2d2441");
      g.fillStyle = bg; g.fillRect(0, 0, 320, 180);
      g.strokeStyle = "#70849a"; g.lineWidth = 1;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) {
        const px = 20 + x * 40 + y * 6, py = 90 + y * 23;
        g.fillStyle = (x + y) % 2 ? "#35405a" : "#303b52";
        g.fillRect(px, py, 38, 21);
      }
      g.font = "bold 12px system-ui"; g.textAlign = "left"; g.fillStyle = "#f7e5b1";
      g.fillText("CONCEPT COMBAT", 18, 24);
      g.font = "11px system-ui"; g.fillStyle = "#d1dce8"; g.fillText("Placement changes the fight", 18, 41);
      // A translucent wall intercepts the incoming bolt; the solid endpoint means it stops here.
      g.fillStyle = "#d2b46d55"; g.fillRect(145, 68, 16, 68); g.strokeStyle = "#f0d58d"; g.lineWidth = 2; g.strokeRect(145, 68, 16, 68);
      g.strokeStyle = "#91d7f1"; g.lineWidth = 3; g.beginPath(); g.moveTo(231, 97); g.lineTo(163, 97); g.stroke();
      g.fillStyle = "#d4f5ff"; g.beginPath(); g.arc(163, 97, 4, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < art.length; i++) {
        const x = i ? 252 : 78, img = art[i];
        g.fillStyle = "#0006"; g.beginPath(); g.ellipse(x, 138, 24, 6, 0, 0, Math.PI * 2); g.fill();
        if (img.complete && img.naturalWidth) {
          const h = i ? 85 : 94, w = h * img.naturalWidth / img.naturalHeight;
          g.imageSmoothingEnabled = false; g.drawImage(img, x - w / 2, 138 - h, w, h);
        } else { g.fillStyle = i ? "#a3c2ee" : "#ecd28c"; g.fillRect(x - 9, 94, 18, 42); }
      }
      g.font = "bold 10px system-ui"; g.textAlign = "center";
      g.fillStyle = "#f4dfaa"; g.fillText("BARRIER", 78, 166);
      g.fillStyle = "#f4dfaa"; g.fillText("BLOCKS", 153, 166);
      g.fillStyle = "#c0e4f2"; g.fillText("LINE", 252, 166);
    };
    art.forEach(img => { img.onload = draw; img.onerror = draw; });
    art[0].src = `combat/sprites/${C.characters.warden.sprite === "warden" ? "player" : C.characters.warden.sprite}/idle.png`;
    art[1].src = "combat/sprites/student/idle.png";
    draw();
  }
  function duel(then) {   // then: "quick" starts a random battle, "kit" opens the Field Kit, "secret" starts the Secret Warrior fight (the home page's shortcuts)
    if (S.emergent) { S.emergent.destroy(); S.emergent = null; }
    if (S.engine) { S.engine.destroy(); S.engine = null; }
    if (S.duel) S.duel.destroy();
    $("library").hidden = true; $("play").hidden = true; $("emergent").hidden = true; $("duel").hidden = false;
    const duelTitle = document.querySelector("#duel .play-title span");
    const setEncounterTitle = (id) => {
      if (!duelTitle) return;
      duelTitle.textContent = id === "secretWarriorNext" ? "Secret Warrior · 1 vs 1 · sealed fight"
        : id === "gapCourt"
        ? "The Gap Court · 1 vs 2 · challenge · provisional rules"
        : "First Wall · 1 vs 1 · practice · provisional rules";
    };
    setEncounterTitle("firstWall");
    try {
      S.duel = ConceptCombatUI.mount($("duelHost"), { onExit: library, onEncounterChange: setEncounterTitle, town: true,
        llmBridge: { start: (settings) => call("llmStart", settings?.provider || "fake", settings?.baseURL || "", settings?.model || ""),
          models: (baseURL) => call("llmModels", baseURL || ""), copyCommand: () => call("llmCopyCommand"), stop: () => call("llmStop") } });
      if (then === "quick") S.duel.quickBattle?.(); else if (then === "kit") S.duel.openFieldKit?.(); else if (then === "secret") S.duel.fightSecretWarrior?.();
    } catch (error) {
      console.error("Concept Combat failed to start", error);
      $("duelHost").innerHTML = `<pre class="cc-start-error">Concept Combat failed to start: ${String(error?.stack || error).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</pre>`;
    }
  }
  function readStory() {
    const raw = store.get(STORY_KEY, null);
    if (!raw) return null;
    const result = VignetteCampaign?.deserialize?.(raw);
    return result?.ok ? result.state : null;
  }
  function saveStory(state) {
    const before = readStory();
    store.set(STORY_KEY, VignetteCampaign.serialize(state)); S.story = state;
    if (Hall && state?.status === "won" && before?.status !== "won" && state.playerCharacter) {   // Hall: a class just won the campaign
      const name = window.ConceptCombatContent?.characters?.[state.playerCharacter]?.name || state.playerCharacter;
      const r = Hall.recordWin(readHall(), state.playerCharacter, { name, recognition: state.recognition }, Date.now(), hallRoster().length);
      r.hall.news = r.lines; saveHall(r.hall);
    }
  }
  // Pay the Hall's pending Seeds into the combat account (only once the battle UI has closed and saved its own copy).
  function payHall() {
    if (!Hall) return;
    const raw = store.get(ACCOUNT_KEY, null); if (!raw) return;   // no account yet: keep it pending
    const { hall, seeds } = Hall.takePending(readHall()); if (!seeds) return;
    try { const acc = JSON.parse(raw); acc.seeds = (acc.seeds || 0) + seeds; store.set(ACCOUNT_KEY, JSON.stringify(acc)); saveHall({ ...hall, paid: seeds }); }
    catch (error) { console.warn("Hall rewards could not be paid into the account yet.", error); }
  }
  function hallSection() {
    if (!Hall) return "";
    const h = readHall(), pr = Hall.progress(h, hallRoster());
    const won = S.story?.status === "won", news = won ? (h.news || []).map((l) => `<li>${esc(l)}</li>`).join("") : "";
    const badges = pr.entries.map((c) => `<figure class="hall-badge ${c.entry ? "won" : ""}" title="${esc(c.name)}${c.entry ? ` · ${c.entry.wins} win${c.entry.wins === 1 ? "" : "s"}` : " · not yet"}">
        <img src="combat/sprites/${esc(c.sprite)}/idle.png" alt="" loading="lazy"><figcaption>${esc(c.name)}</figcaption></figure>`).join("");
    return `<section class="hall"><h3>Hall of Warriors · ${pr.done}/${pr.total}</h3>
      <div class="hall-bar"><i style="width:${(100 * pr.done / Math.max(1, pr.total)).toFixed(1)}%"></i></div>
      <p class="hall-count"><b>${pr.left}</b> class${pr.left === 1 ? "" : "es"} still to walk the Quiet House${pr.next ? ` · next reward in <b>${pr.nextIn}</b>: “${esc(pr.next.title)}”${pr.next.seeds ? ` (+${pr.next.seeds} Seeds)` : ""}` : " · every path walked"}.
        Each new class that wins earns its badge and +${Hall.FIRST_WIN_SEEDS} Seeds.</p>
      ${pr.titles.length ? `<p class="cc-muted">Titles: ${pr.titles.map(esc).join(" · ")}</p>` : ""}
      ${news ? `<ul class="hall-news">${news}</ul>` : ""}${won && h.paid ? `<p class="cc-muted">+${h.paid} Seeds added to your account.</p>` : ""}
      <div class="hall-grid">${badges}</div></section>`;
  }
  function campaignConceptPool(characterId) {
    const C = window.ConceptCombatContent, character = C?.characters?.[characterId];
    if (!C || characterId === "warden") return Object.keys(C?.concepts || {});
    const configured = (character?.configs || []).flatMap(fit => [fit.primary, fit.secondary]).filter(Boolean);
    return [...new Set([...(character?.conceptPool || []), ...configured, character?.primary, character?.secondary].filter(Boolean))];
  }
  function defaultCampaignLoadout(characterId, firstScene = false) {
    if (characterId === "warden" && firstScene) return { primary: "selectivity", secondary: "extraction" };
    const character = window.ConceptCombatContent?.characters?.[characterId] || window.ConceptCombatContent?.characters?.warden;
    const fit = character.configs?.[0] || character;
    return { primary: fit.primary || character.primary || "barrier", secondary: fit.secondary ?? character.secondary ?? null };
  }
  function campaignLoadout(characterId, state, firstScene = false) {
    return state?.playerLoadout || defaultCampaignLoadout(characterId, firstScene);
  }
  function conceptOptions(ids, selected, allowNone = false) {
    const C = window.ConceptCombatContent;
    return `${allowNone ? `<option value="" ${!selected ? "selected" : ""}>None</option>` : ""}` + ids.map(id => `<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${esc(C?.concepts?.[id]?.name || id)}</option>`).join("");
  }
  function campaignBoard(stateOverride = null) {
    if (S.engine) { S.engine.destroy(); S.engine = null; }
    if (S.duel) { S.duel.destroy(); S.duel = null; }
    if (S.emergent) { S.emergent.destroy(); S.emergent = null; }
    S.story = VignetteCampaign.validState(stateOverride) ? stateOverride : readStory();
    $("library").hidden = true; $("play").hidden = true; $("duel").hidden = true; $("emergent").hidden = true; $("story").hidden = false;
    let state = S.story;
    const sceneNames = { quietHouse: "The Quiet House", courtyard: "The Hearing", lastVerdict: "The Last Verdict" };
    const stanceLabels = { accuseMaid: "Accuse the Maid", accuseRobot: "Accuse the AGI", standWithOfficer: "Stand with the officer", devilsAdvocate: "Play devil’s advocate",
      readWithScientist: "Read it with me", accuseScientist: "You coached the robot", standWithRecord: "The house’s record stands", challengeOffice: "The office moved too fast" };
    const intervals = { long: "Long · fully prepared", short: "Short · partial recovery", rush: "Rush · enemy arrives early" };
    const characters = window.ConceptCombatContent?.characters || {};
    const playerCharacters = Object.entries(characters)
      .filter(([id, character]) => id === "warden" || (!character.randomEventOnly && character.configs?.length))
      .sort(([a], [b]) => a === "warden" ? -1 : b === "warden" ? 1 : (characters[a].name || a).localeCompare(characters[b].name || b));
    const playerCharacter = state?.playerCharacter || "warden";
    const currentScene = state?.current.scene || "quietHouse";
    const inHall = readHall()?.entries || {};   // Hall: steer toward classes that haven't won yet
    const characterOptions = playerCharacters.map(([id, character]) => `<option value="${esc(id)}" ${id === state?.playerCharacter ? "selected" : ""}>${esc(character.name || id)}${inHall[id] ? " · ✓ in the Hall" : ""}</option>`).join("");
    const editableLoadout = campaignLoadout(playerCharacter, state, currentScene === "quietHouse");
    const characterConcepts = [editableLoadout.primary, editableLoadout.secondary]
      .filter(Boolean).map(id => window.ConceptCombatContent?.concepts?.[id]?.name || id).join(" + ");
    const picked = !!state?.playerCharacter;   // the character picker replaces the scene controls until a fighter is chosen
    const choices = picked && ["quietHouse", "courtyard"].includes(currentScene) && !state?.current.completed;
    const finalScene = picked && currentScene === "lastVerdict" && state?.status === "active";
    $("storyProgress").textContent = state ? `${state.records.length}/3 scenes · ${state.recognition}` : "No campaign save yet";
    $("storyPanel").innerHTML = !state?.playerCharacter
      ? `<h2>Choose your character</h2><p>Select your fighter and customize their concepts. Allies, opponents, and scenes follow the story.</p>
        <label for="storyCharacter">Player character <select id="storyCharacter"><option value="" selected>Choose a character…</option>${characterOptions}</select></label>
        <button id="storyRandomCharacter" type="button">🎲 Random character + build</button>
        <div class="story-loadout-grid"><label for="storyPrimary">Primary concept <select id="storyPrimary" disabled>${conceptOptions(campaignConceptPool("warden"), defaultCampaignLoadout("warden", true).primary)}</select></label>
        <label for="storySecondary">Secondary concept <select id="storySecondary" disabled>${conceptOptions(campaignConceptPool("warden").filter(id => id !== defaultCampaignLoadout("warden", true).primary), defaultCampaignLoadout("warden", true).secondary, true)}</select></label></div>
        <p id="storyCharacterHint" class="cc-muted">Choose your concepts from this character’s available pool, then continue to the campaign setup.</p>
        <button id="storyCharacterContinue" class="cc-primary" type="button" disabled>Continue to campaign setup ▶</button> <button id="storyRestart" type="button">Restart Campaign</button>`
      : state?.status === "won" || state?.status === "lost"
      ? `<h2>${state.status === "won" ? "Campaign complete" : "Campaign ended"}</h2><p>${state.records.length} scene records saved. Recognition: ${esc(state.recognition)}.</p><button id="storyRestart" type="button">Restart Campaign</button>`
      : `<h2>${esc(sceneNames[currentScene])}</h2><p>${state ? `${state.records.length} scene${state.records.length === 1 ? "" : "s"} recorded · player LF ${state.playerLF} · current scene saved.` : "A three-scene case about evidence, recognition, and the limits of a final judgment."}</p>
        <section class="story-character-choice"><small>PLAYING AS</small><b>${esc(characters[playerCharacter]?.name || "Warden")}</b>${characterConcepts ? `<small>${esc(characterConcepts)}</small>` : ""}</section>
        <div class="story-loadout-grid"><label for="storyPrimary">Primary concept <select id="storyPrimary">${conceptOptions(campaignConceptPool(playerCharacter), editableLoadout.primary)}</select></label>
        <label for="storySecondary">Secondary concept <select id="storySecondary">${conceptOptions(campaignConceptPool(playerCharacter).filter(id => id !== editableLoadout.primary), editableLoadout.secondary, true)}</select></label></div>
        ${choices ? `<label>Approach <select id="storyStance"></select></label>
          <label>Preparation interval <select id="storyInterval">${VignetteCampaign.INTERVALS.map(id => `<option value="${id}" ${state?.current.interval === id ? "selected" : ""}>${intervals[id]}</option>`).join("")}</select></label>
          <p class="cc-muted">Your approach changes the room, roster, available proof, and who stands with you. The interval sets the opening resources.</p>
          <button id="storyStart" type="button">${state?.current.stance ? `Resume ${sceneNames[currentScene]} ▶` : `Enter ${sceneNames[currentScene]} ▶`}</button>${state ? ` <button id="storyRestart" type="button">Restart Campaign</button>` : ""}`
        : finalScene ? `<p>The hearing record chooses the boss and its objective. Your interval sets how far the decree, contract, or breach has advanced.</p>
          <label>Preparation interval <select id="finalInterval">${VignetteCampaign.INTERVALS.map(id => `<option value="${id}" ${state.current.interval === id || (!state.current.interval && id === "short") ? "selected" : ""}>${intervals[id]}</option>`).join("")}</select></label>
          <button id="storyStartVerdict" type="button">Begin Last Verdict ▶</button> <button id="storyPreviewVerdict" type="button">Review scenario</button>
          <div id="storyVerdictPreview"></div>
          <p class="cc-muted">Defeat the boss or destroy the marked objective before its countdown ends. Long preparation starts the clock one step ahead.</p>
          <button id="storyRestart" type="button">Restart Campaign</button>`
        : `<p>The campaign has ended. Your three scene records are saved.</p><button id="storyRestart" type="button">Restart Campaign</button>`}`;
    payHall(); $("storyPanel").insertAdjacentHTML("beforeend", hallSection());   // Hall of Warriors
    if (choices) {
      const syncStanceOptions = () => {
        const rush = currentScene === "courtyard" && $("storyInterval").value === "rush";
        const ids = currentScene !== "courtyard" ? VignetteCampaign.STANCES.quietHouse
          : rush ? ["readWithScientist", "accuseScientist", "devilsAdvocate"] : ["standWithRecord", "challengeOffice", "devilsAdvocate"];
        const select = $("storyStance"), selected = ids.includes(select.value) ? select.value : ids.includes(state?.current.stance) ? state.current.stance : ids[0];
        select.innerHTML = ids.map(id => `<option value="${id}">${stanceLabels[id]}</option>`).join(""); select.value = selected;
      };
      syncStanceOptions(); $("storyInterval").addEventListener("change", syncStanceOptions);
    }
    const picker = $("storyCharacter"), pickerContinue = $("storyCharacterContinue");
    const refreshPickedLoadout = () => {
      const id = picker?.value, primary = $("storyPrimary"), secondary = $("storySecondary");
      if (!id || !primary || !secondary) { if (pickerContinue) pickerContinue.disabled = true; return; }
      const pool = campaignConceptPool(id), fit = defaultCampaignLoadout(id, true);
      primary.innerHTML = conceptOptions(pool, fit.primary);
      secondary.innerHTML = conceptOptions(pool.filter(concept => concept !== fit.primary), fit.secondary, true);
      primary.disabled = false; secondary.disabled = false;
      pickerContinue.disabled = !pool.includes(fit.primary);
      $("storyCharacterHint").textContent = `Playing as ${characters[id]?.name || id}. Choose a primary and secondary concept from this character’s pool.`;
    };
    picker?.addEventListener("change", refreshPickedLoadout);
    $("storyRandomCharacter")?.addEventListener("click", () => {
      if (!playerCharacters.length || !picker) return;
      const [id, character] = playerCharacters[Math.floor(Math.random() * playerCharacters.length)];
      const build = VignetteCampaign.randomBuild(character.configs, campaignConceptPool(id));
      if (!build) return;
      picker.value = id; refreshPickedLoadout();
      $("storyPrimary").value = build.primary;
      $("storySecondary").value = build.secondary || "";
      const conceptName = concept => window.ConceptCombatContent?.concepts?.[concept]?.name || concept;
      $("storyCharacterHint").textContent = `Random selection: ${characters[id]?.name || id} · ${conceptName(build.primary)}${build.secondary ? ` + ${conceptName(build.secondary)}` : ""}. You can change any choice before continuing.`;
    });
    pickerContinue?.addEventListener("click", () => {
      if (!picker?.value) return;
      let result = VignetteCampaign.setPlayerCharacter(readStory() || VignetteCampaign.create(), picker.value);
      if (!result.ok) { $("storyCharacterHint").textContent = result.error; return; }
      result = VignetteCampaign.setPlayerLoadout(result.state, { primary: $("storyPrimary").value, secondary: $("storySecondary").value || null });
      if (!result.ok) { $("storyCharacterHint").textContent = result.error; return; }
      saveStory(result.state); campaignBoard(result.state);
    });
    const bindLoadoutEditor = () => {
      const primary = $("storyPrimary"), secondary = $("storySecondary");
      if (!primary || !secondary || !state?.playerCharacter) return;
      const commitLoadout = () => {
        const updated = VignetteCampaign.setPlayerLoadout(readStory() || state, { primary: primary.value, secondary: secondary.value || null });
        if (updated.ok) {
          state = updated.state; saveStory(state);
          const label = [primary.value, secondary.value].filter(Boolean).map(id => window.ConceptCombatContent?.concepts?.[id]?.name || id).join(" + ");
          const summary = $("storyPanel").querySelector(".story-character-choice small:last-child");
          if (summary) summary.textContent = label;
        }
      };
      primary.addEventListener("change", () => {
        const oldSecondary = secondary.value;
        secondary.innerHTML = conceptOptions(campaignConceptPool(state.playerCharacter).filter(id => id !== primary.value), oldSecondary === primary.value ? null : oldSecondary, true);
        commitLoadout();
      });
      secondary.addEventListener("change", commitLoadout);
    };
    bindLoadoutEditor();
    $("storyStart")?.addEventListener("click", () => currentScene === "courtyard" ? launchCourtyard(state) : launchQuietHouse(state));
    const drawVerdictPreview = (saveSelection = false) => {
      if (!finalScene || !VerdictScenarios) return;
      const interval = $("finalInterval").value;
      let scenarioState = readStory();
      if (saveSelection) {
        const setup = VignetteCampaign.setInterval(scenarioState, interval);
        if (!setup.ok) return;
        scenarioState = setup.state; saveStory(scenarioState);
      }
      const preview = VerdictScenarios.make(scenarioState, interval, scenarioState.playerLF);
      const bossNames = { dragon: "Dragon", oni: "Red Oni", kaiju: "Insect Kaiju" };
      const cast = preview.participants.map(p => `${p.side === "player" ? "Ally" : "Enemy"}: ${p.character.startsWith("boss-") ? bossNames[preview.branch] : window.ConceptCombatContent.characters[p.character]?.name || p.character}`).join(" · ");
      $("storyVerdictPreview").innerHTML = `<article class="cc-card"><h3>${esc(preview.name)}</h3><p><b>Boss:</b> ${esc(bossNames[preview.branch])} · <b>Opening AP:</b> ${Object.values(preview.openingTempo)[0] || 100} · <b>Your LF:</b> ${preview.playerStartingLF}</p>
        <p>${esc(preview.preparation.text)}</p><p><b>Opposing objective:</b> ${esc(preview.enemyObjective.kind)} · <b>Your objective:</b> defeat the boss.</p>
        <p>${esc(cast)}</p><pre style="overflow:auto;padding:12px;background:#111827;border-radius:8px;color:#ddd">${esc(VerdictScenarios.maps[preview.branch].join("\n"))}</pre>
        <p><b>Transfer check:</b> ${esc(preview.transfer.question)}</p></article>`;
    };
    if (finalScene) { $("storyPreviewVerdict")?.addEventListener("click", () => drawVerdictPreview(true)); drawVerdictPreview(false); }
    $("storyStartVerdict")?.addEventListener("click", () => launchLastVerdict(state));
    $("storyRestart")?.addEventListener("click", () => { const fresh = VignetteCampaign.create(); saveStory(fresh); campaignBoard(fresh); });
    mountHomeKeeper("storyPanel", "quietHouse");   // Arantxa (S4b)
  }
  function launchQuietHouse(previous) {
    let state = previous || VignetteCampaign.create();
    const stance = $("storyStance").value, interval = $("storyInterval").value;
    const sr = VignetteCampaign.setStance(state, stance); if (!sr.ok) return;
    const ir = VignetteCampaign.setInterval(sr.state, interval); if (!ir.ok) return;
    state = ir.state; saveStory(state);
    const playerCharacter = state.playerCharacter || "warden";
    const scene = VignetteCampaign.quietHouseArena(stance, playerCharacter);
    const participants = scene.participants.map(p => p.id === "player" ? { ...p, startingLF: ir.setup.playerLF } : p);
    const openingTempo = Object.fromEntries(participants.filter(p => p.side === "enemy").map(p => [p.id, ir.setup.enemyOpeningAP]));
    const setupOpts = { encounter: "firstWall", title: "Campaign: The Quiet House", mode: "classic", startingActor: "player", participants, openingTempo,
      arenaData: scene.arenaData, loadouts: { player: campaignLoadout(playerCharacter, state, true) }, seed: 0 };
    $("story").hidden = true; $("duel").hidden = false;
    storyTitle("The Quiet House · campaign scene 1");
    S.duel = ConceptCombatUI.mount($("duelHost"), { params: { autostart: true, campaign: true, encounter: "firstWall", narration: "quiet-house", setupOpts }, onExit: campaignBoard,
      onCampaignContinue: campaignBoard, onCampaignFinish: ({ state: battle, account }) => {
        const player = battle.actors.player, stopped = Object.values(battle.actors).filter(a => a.defeated && !a.notArrived).map(a => a.id);
        const obj = id => battle.arena.objects.find(o => o.evidenceId === id || o.id === `house-${id}`);
        const completed = VignetteCampaign.finishScene(readStory(), { playerLF: player.maxLF ? Math.round(player.lf / player.maxLF * 100) : 0,
          playerStopped: player.defeated, stopped, allyStopped: Object.values(battle.actors).find(a => a.id !== "player" && a.side === "player" && a.defeated)?.id || null,
          evidence: { receptacle: obj("receptacle") ? obj("receptacle").hp > 0 ? "intact" : "broken" : "unvisited", robotLog: obj("robotLog") ? obj("robotLog").hp > 0 ? "intact" : "broken" : "unvisited" }, result: battle.outcome?.winner || "progress" });
        if (completed.ok) saveStory(completed.state);
        return { nextScene: completed.ok ? completed.next : null };
      } });
  }
  // Campaign scenes reuse the duel host; name the scene in its header instead of the last practice encounter.
  function storyTitle(text) { const span = document.querySelector("#duel .play-title span"); if (span) span.textContent = text; }
  function launchCourtyard(previous) {
    const sr = VignetteCampaign.setStance(previous, $("storyStance").value); if (!sr.ok) return;
    const ir = VignetteCampaign.setInterval(sr.state, $("storyInterval").value); if (!ir.ok) return;
    const state = ir.state, scene = VignetteCampaign.courtyardArena(state, state.current.stance);
    const participants = scene.participants.map(p => p.id === "player" ? { ...p, startingLF: ir.setup.playerLF } : p);
    saveStory(state); $("story").hidden = true; $("duel").hidden = false;
    storyTitle("The Courtyard Hearing · campaign scene 2");
    S.duel = ConceptCombatUI.mount($("duelHost"), { params: { autostart: true, campaign: true, encounter: "firstWall", narration: "courtyard",
      setupOpts: { encounter: "firstWall", title: "Campaign: The Courtyard Hearing", mode: "classic", startingActor: "player", participants,
        openingTempo: scene.openingTempo, arenaData: scene.arenaData, loadouts: { player: campaignLoadout(state.playerCharacter || "warden", state, false) }, seed: state.seed } }, onExit: campaignBoard,
      onCampaignContinue: campaignBoard, onCampaignFinish: ({ state: battle, account }) => {
        const player = battle.actors.player, stopped = Object.values(battle.actors).filter(a => a.defeated && !a.notArrived).map(a => a.id);
        const bench = battle.arena.objects.find(o => o.role === "evidence:hearing");
        const story = readStory();
        const outcome = VignetteCampaign.courtyardOutcome(story, { playerStopped: player.defeated, stopped,
          benchIntact: !!scene.proof && !!bench && bench.hp > 0, recognized: scene.recognized, ownsFieldNotebook: !!account?.gear?.owned?.includes("fieldNotebook") });
        const completed = VignetteCampaign.finishScene(readStory(), { playerLF: player.maxLF ? Math.round(player.lf / player.maxLF * 100) : 0,
          playerStopped: player.defeated, stopped, allyStopped: Object.values(battle.actors).find(a => a.id !== "player" && a.side === "player" && a.defeated)?.id || null,
          recognition: outcome.recognition || (scene.recognized ? "recognized" : previous.recognition), reward: outcome.reward,
          result: battle.outcome?.winner || "progress" });
        if (completed.ok) saveStory(completed.state);
        return { text: outcome.text, transfer: outcome.transfer, item: outcome.reward, nextScene: completed.ok ? completed.next : null };
      } });
  }
  function launchLastVerdict(previous) {
    const chosen = VignetteCampaign.setInterval(previous, $("finalInterval").value); if (!chosen.ok) return;
    const state = chosen.state, scene = VerdictScenarios.make(state, state.current.interval, state.playerLF);
    saveStory(state); $("story").hidden = true; $("duel").hidden = false;
    storyTitle("The Last Verdict · campaign scene 3");
    S.duel = ConceptCombatUI.mount($("duelHost"), { params: { autostart: true, campaign: true, encounter: "firstWall", narration: `verdict-${scene.branch}`,
      setupOpts: { encounter: "firstWall", title: "Campaign: The Last Verdict", mode: "classic", startingActor: "player", participants: scene.participants,
        openingTempo: scene.openingTempo, arenaData: scene.arenaData, loadouts: { player: campaignLoadout(state.playerCharacter || "warden", state, false) }, vignette: scene, seed: state.seed } }, onExit: campaignBoard,
      onCampaignContinue: campaignBoard, onCampaignFinish: ({ state: battle }) => {
        const player = battle.actors.player, stopped = Object.values(battle.actors).filter(a => a.defeated && !a.notArrived).map(a => a.id);
        const completed = VignetteCampaign.finishScene(readStory(), { playerLF: player.maxLF ? Math.round(player.lf / player.maxLF * 100) : 0,
          playerStopped: player.defeated, stopped, result: battle.outcome?.winner || "enemy", reward: battle.vignette?.bossOrb || null, recognition: readStory().recognition });
        if (completed.ok) saveStory(completed.state);
        const orb = battle.vignette?.bossOrb;
        const orbName = orb && window.ConceptCombatBosses?.data?.orbs?.[orb]?.name;
        return { text: (battle.outcome?.reason || scene.outcomeText.loss) + (orbName ? ` ${orbName} is recorded with the case.` : ""), transfer: scene.transfer };
      } });
  }
  function openEmergent() {
    if (S.engine) { S.engine.destroy(); S.engine = null; }
    if (S.duel) { S.duel.destroy(); S.duel = null; }
    if (S.emergent) S.emergent.destroy();
    $("library").hidden = true; $("play").hidden = true; $("duel").hidden = true; $("emergent").hidden = false;
    S.emergent = EmergentCombatUI.mount($("emergentHost"), { onExit: library });
  }

  // Little overview map for the card: terrain colours + station dots in route order.
  function drawThumb(cv, d) {
    const W = d?.walk; if (!W) return;
    const g = cv.getContext("2d"), rows = W.map, mw = rows[0].length, mh = rows.length;
    const P = WalkEngine.THEMES[W.theme] || WalkEngine.THEMES.alpine;
    const legend = { ...WalkEngine.DEFAULT_LEGEND, ...(W.legend || {}) };
    const col = { rock: P.rock[0], water: P.water[0], pine: P.pine[0], shrub: P.shrub[0], boulder: P.rock[1], wall: P.wall[0],
                  grass: P.grass[0], path: P.path[0], scree: P.scree[0], snow: P.snow[0], flowers: P.grass[1], floor: P.floor[0], ground: P.ground[0] };
    const s = Math.min(cv.width / mw, cv.height / mh), ox = (cv.width - mw * s) / 2, oy = (cv.height - mh * s) / 2;
    g.fillStyle = "#1d1b22"; g.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { g.fillStyle = col[legend[rows[y][x]]] || P.ground[0]; g.fillRect(ox + x * s, oy + y * s, Math.ceil(s), Math.ceil(s)); }
    g.strokeStyle = "#ffffffaa"; g.lineWidth = 1.5; g.setLineDash([3, 3]); g.beginPath();
    W.stations.forEach((st, i) => { const px = ox + (st.x + .5) * s, py = oy + (st.y + .5) * s; i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke(); g.setLineDash([]);
    W.stations.forEach((st) => { g.fillStyle = "#2b2731"; g.beginPath(); g.arc(ox + (st.x + .5) * s, oy + (st.y + .5) * s, Math.max(2.5, s * .55), 0, 7); g.fill(); });
  }

  // ── play ──────────────────────────────────────────────────────────────────
  async function play(slug) {
    if (!S.walks.length) await refresh();
    const w = S.walks.find((x) => x.slug === slug); if (!w) return;
    const d = await loadData(w);
    S.current = w;
    $("library").hidden = true; $("play").hidden = false;
    $("playTitle").textContent = w.title;
    $("playSub").textContent = d.hero?.eyebrow || "";
    renderNotes(d);
    if (S.engine) S.engine.destroy();
    S.engine = WalkEngine.mount($("walkHost"), d, {
      storageKey: keyFor(slug), fit: "contain",
      onReadMore: (section) => openNotes(section),
      extraMenu: [["Field notes", () => openNotes()], ["Leave walk → library", () => library()]],
    });
    S.engine.start();
  }

  function renderNotes(d) {
    const body = $("notesBody");
    body.innerHTML = Object.entries(d.sections || {}).map(([k, s]) => `
      <article data-copy-section="${esc(k)}">
        ${s.eyebrow ? `<p class="n-eyebrow">${esc(s.eyebrow)}</p>` : ""}${s.title ? `<h3>${esc(s.title)}</h3>` : ""}
        ${(s.blocks || []).map((b) => `<p class="${esc(b.className || "")}">${b.html ? b.html : esc(b.text)}</p>`).join("")}
      </article>`).join("") +
      (d.sources?.length ? `<article class="n-sources"><h3>Sources</h3><ul>${d.sources.map((s) => `<li>${s.html || esc(s.text)}</li>`).join("")}</ul></article>` : "");
    body.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!/^https?:/.test(href)) a.href = new URL(href, S.current.data).href;   // relative links resolve against the explainer
    });
  }

  function openNotes(section) {
    $("notes").hidden = false; $("notesBtn").setAttribute("aria-expanded", "true");
    if (section) {
      const el = $("notesBody").querySelector(`[data-copy-section="${CSS.escape(section)}"]`);
      if (el) { el.scrollIntoView({ block: "start" }); el.classList.add("walk-flash"); setTimeout(() => el.classList.remove("walk-flash"), 1600); }
    }
  }
  function closeNotes() { $("notes").hidden = true; $("notesBtn").setAttribute("aria-expanded", "false"); focusStage(); }
  const focusStage = () => { const st = document.querySelector(".walk-stage"); if (st) st.focus({ preventScroll: true }); };

  function library() {
    if (S.engine) { S.engine.destroy(); S.engine = null; }
    if (S.duel) { S.duel.destroy(); S.duel = null; }
    if (S.emergent) { S.emergent.destroy(); S.emergent = null; }
    $("play").hidden = true; $("duel").hidden = true; $("emergent").hidden = true; $("story").hidden = true; $("library").hidden = false; $("notes").hidden = true; $("help").hidden = true; $("duelHelp").hidden = true;
    S.current = null;
    renderLibrary();
  }

  $("back").onclick = library;
  $("duelBack").onclick = () => { if (S.duel?.backOut?.()) return; library(); };   // one step back in Concept Combat first; home only from its main menu
  $("fieldBack").onclick = library;
  $("storyBack").onclick = library;
  // Version and update ticker (Mala, 2026-10-14: "add the version number somewhere visible in the main game menu, and when a
  // new update is ready, a little ticker line that says update available"). The app reports what it is running and any newer
  // build tools/ship.sh staged; Restart installs that build (Loci.swift restartApplication). Checked every minute.
  async function refreshVersion() {
    if (!window.webkit?.messageHandlers?.loci) return;
    const v = await call("version"); if (!v || !v.running) return;
    document.querySelectorAll("[data-version]").forEach((el) => { el.textContent = `v${v.running}`; });
    const t = $("updateTicker"); if (!t) return;
    t.hidden = !v.updateReady;
    if (v.updateReady) { t.textContent = `Update available: Loci ${v.staged} is ready (you are on ${v.running}) · ${v.restartLabel || "Restart to install"}`; t.onclick = () => call("restart"); }
  }
  refreshVersion(); setInterval(refreshVersion, 60000);
  document.querySelectorAll("[data-restart]").forEach((button) => {
    button.onclick = () => {
      if (window.webkit?.messageHandlers?.loci) call("restart");
      else if (window.confirm("Reload Loci? Any active walk or battle will end.")) window.location.reload();
    };
  });
  $("duelHelpBtn").onclick = () => { $("duelHelp").hidden = !$("duelHelp").hidden; };
  $("notesBtn").onclick = () => ($("notes").hidden ? openNotes() : closeNotes());
  $("notesClose").onclick = closeNotes;
  $("helpBtn").onclick = () => { $("help").hidden = !$("help").hidden; focusStage(); };
  $("openClassic").onclick = () => S.current && call("openExplainer", S.current.slug);
  document.addEventListener("keydown", (e) => {
    if ($("play").hidden || e.metaKey || e.ctrlKey) return;
    if (e.key.toLowerCase() === "n" && !e.target.closest("input,textarea")) { e.preventDefault(); $("notes").hidden ? openNotes() : closeNotes(); }
  });

  refresh();
  async function open(o) { await play(o.slug); if (o.notes) openNotes(o.notes); }
  return { exportEmissaryTrace: (name, json) => call("exportEmissaryTrace", name, json), _resolve(id, data) { const r = pending.get(id); if (r) { pending.delete(id); r(data); } else window.ConceptCombatSaveFile?._resolve?.(id, data); }, library, refresh, open, duel, openEmergent };
})();
