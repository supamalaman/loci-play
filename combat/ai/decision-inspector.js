/* Emissary E2. Developer-only, bounded, private session traces. */
(function(root) {
  "use strict";
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const number = v => typeof v === "number" && Number.isFinite(v) ? String(Number(v.toFixed(3))) : String(v ?? "");
  const label = a => a ? [a.type, a.ability || a.response || "", a.target ? "→ " + a.target : "", a.to ? "at " + a.to.join(", ") : ""].filter(Boolean).join(" ") : "No action";
  function summarizeApplication(before, result) {
    const changed = Object.values(result.state?.actors || {}).flatMap(a => {
      const b = before?.actors?.[a.id], after = {lf:a.lf,ap:a.tempo,at:[a.x,a.y],defeated:!!a.defeated};
      const previous = b ? {lf:b.lf,ap:b.tempo,at:[b.x,b.y],defeated:!!b.defeated} : null;
      return JSON.stringify(previous) === JSON.stringify(after) ? [] : [{actor:a.id,before:previous,after}];
    });
    return {ok:result.ok,error:result.error || null,round:result.state?.round,outcome:result.state?.outcome || null,eventCount:result.events?.length || 0,actorChanges:changed};
  }
  function createStore(limit = 24) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid history limit");
    let records = [], sequence = 0;
    return {
      add(result, meta = {}) {
        // Only bounded trace data is retained; no account, content or board snapshots.
        const record = structuredClone({ id: ++sequence, at: new Date().toISOString(), round: meta.round, actor: meta.actor, action: result.action, trace: result.trace });
        records.push(record); if (records.length > limit) records.shift(); return record.id;
      },
      replay(id, replay) { const r = records.find(x => x.id === id); if (r) r.replay = structuredClone(replay); },
      observe(id, observation) { const r = records.find(x => x.id === id); if (r) r.observation = structuredClone(observation); },
      get records() { return structuredClone(records); },
      clear() { records = []; },
      report(id) { const record = records.find(r => r.id === id); if (!record) throw new Error("Decision no longer retained"); return JSON.stringify({format:"emissary-trace-report-v1", visibility:"developer-private", replayable:false, record}, null, 2); }
    };
  }
  function mount(host) {
    const codec = root.ConceptCombatDecisionCodec;
    const snapshots = new Map();
    const history = createStore(); let selected = null, recording = false, blocked = false, serial = 0, replayFrame = null, replayTimer = null, generation = 0;
    host.innerHTML = `<details class="emissary-inspector"><summary>Emissary · decision inspector</summary><div class="emissary-body"><p>Developer private · traces may expose hidden rules and traits. Full diagnostic data, not actor-visible knowledge. Session memory only. Secret encounters are excluded.</p><div class="emissary-controls"><label><input type="checkbox" data-record> Record AI decisions</label><button type="button" data-clear>Clear</button><button type="button" data-replay disabled>Replay selected</button><label>Export name <input data-name value="emissary-decision" maxlength="80"></label><button type="button" data-copy disabled>Copy JSON</button><button type="button" data-export disabled>Export JSON</button></div><p data-status role="status">Recording off · no decisions saved.</p><div class="emissary-columns"><nav aria-label="Recorded decisions" data-history></nav><section aria-label="Selected decision" data-detail><p>Turn recording on, then let an opponent act.</p></section></div></div></details>`;
    const q = s => host.querySelector(s);
    function message(s) { q('[data-status]').textContent = s; }
    function draw() {
      const records = history.records, r = records.find(x => x.id === selected);
      q('[data-history]').innerHTML = records.slice().reverse().map(x => `<button type="button" data-id="${x.id}" aria-current="${x.id === selected}">#${x.id} · round ${esc(x.round)} · ${esc(x.actor)}<small>${esc(label(x.action))}</small></button>`).join('');
      q('[data-copy]').disabled = q('[data-export]').disabled = !r;
      q('[data-replay]').disabled = !r || !snapshots.get(selected)?.observed;
      if (!r) { q('[data-detail]').innerHTML = '<p>No decision selected.</p>'; return; }
      const t = r.trace, site = root.ConceptCombatDecisionSites?.find(x => x.site === r.trace.selection?.site), candidates = t.topCandidates || [], excluded = (t.events || []).filter(e => ['rejected','pruned','unscored'].includes(e.kind));
      const max = Math.max(1, ...candidates.map(c => Math.abs(c.value || 0)));
      q('[data-detail]').innerHTML = `<h3>${esc(label(r.action))}</h3><p>Selected by <code>${esc(t.selection?.site || 'final wrapper')}</code> · ${esc(t.selection?.mechanism || 'not captured')}</p><p>Return-site IDs identify instrumented rules; they are not current source line numbers.</p>${site ? `<details><summary>Executed source rule</summary><pre>return ${esc(site.expression)}</pre><ol>${site.enclosingPredicates.map(p=>`<li><code>${esc(p.expression)}</code> · ${p.branch ? "true branch" : "false branch"}</li>`).join("")}</ol><p>Source branch metadata locates the executed rule; it does not establish causal necessity.</p></details>` : "<p>Source rule metadata unavailable.</p>"}${t.chosenPlan ? `<p>Scored plan: ${esc(label(t.chosenPlan.action))} · ${esc(number(t.chosenPlan.value))}</p>` : '<p>No scored plan: this decision may use an earlier rule.</p>'}<h4>Scored alternatives · highest retained</h4><p>Scores shown to three decimals; JSON retains the original precision.</p>${candidates.length ? candidates.map(c => `<details><summary>${esc(label(c.action))}${c.to ? ' via ' + esc(c.to.join(', ')) : ''} · <b>${esc(number(c.value))}</b><span class="emissary-bar" style="width:${Math.max(1, Math.abs(c.value || 0)/max*100)}%"></span></summary><ol>${(c.terms || []).map(x => `<li>${esc(x.name)}: <b>${esc(number(x.value))}</b></li>`).join('')}</ol><p>Terms are ordered operations, including multipliers; they cannot all be added.</p></details>`).join('') : '<p>No scored alternatives captured for this rule.</p>'}<h4>Predicted versus observed</h4><p>Prediction is the captured scored plan above; its numeric value is a heuristic, not predicted damage. Replay computes a one-step engine prediction in isolation and compares the complete engine result with what happened. This does not predict an entire battle.</p><pre>${esc(JSON.stringify({observed:r.observation || {status:"Not observed yet"},replay:r.replay || {status:"Run Replay selected to compute the one-step prediction"}},null,2))}</pre><h4>Overrides and final processing</h4><pre>${esc(JSON.stringify({overrides:t.overrides,postprocess:(t.events || []).filter(e => e.kind === 'postprocess')},null,2))}</pre><h4>Excluded options · captured only</h4><pre>${esc(JSON.stringify(excluded,null,2))}</pre><h4>Coverage</h4><p>${t.truncated ? 'Trace truncated · ' + esc(t.dropped) + ' events omitted. ' : ''}${esc(t.nestedEventsOmitted)} nested preview events omitted. History retains the latest 24 decisions.</p><ul>${Object.entries(t.coverage || {}).map(([k,v])=>`<li>${esc(k)}: ${esc(v)}</li>`).join('')}</ul><p>Scoring evidence describes this heuristic. Trait labels do not prove a causal effect. Export contains trace evidence only. Replay snapshots remain in memory for the latest four decisions (48 MiB serialized-data limit). Browser replay checks the current loaded runtime; use E1 tooling for source-pinned offline replay.</p>`;
    }
    q('[data-record]').onchange = ev => { recording = !blocked && ev.target.checked; message(recording ? 'Recording · latest 24 decisions kept in memory.' : 'Recording off.'); };
    q('[data-clear]').onclick = () => { history.clear(); snapshots.clear(); cancelReplay(); selected = null; draw(); message('Decision history cleared.'); };
    q('[data-history]').onclick = ev => { const b = ev.target.closest('[data-id]'); if (b) { selected = Number(b.dataset.id); draw(); } };
    function cancelReplay() { generation++; clearTimeout(replayTimer); replayFrame?._cleanup?.(); replayFrame?.remove(); replayFrame = null; }
    q('[data-replay]').onclick = () => {
      cancelReplay(); const snapshot = snapshots.get(selected); if (!snapshot?.observed) return;
      const replayId = selected, epoch = generation, token = `${Date.now()}-${Math.random()}`;
      const frame = document.createElement('iframe'); replayFrame = frame; frame.hidden = true;
      const scripts = [...document.scripts].filter(s => s.src && /\/combat\//.test(s.src)).map(s => `<script src="${esc(s.src)}"><\/script>`).join('');
      const driver = new URL('combat/ai/decision-replay-frame.js', document.baseURI).href;
      frame.srcdoc = `<!doctype html><html><head><base href="${esc(document.baseURI)}">${scripts}<script src="${esc(driver)}"><\/script></head><body></body></html>`;
      const listener = ev => {
        if (ev.source !== frame.contentWindow || epoch !== generation) return;
        if (ev.data?.kind === 'emissary-ready') frame.contentWindow.postMessage({kind:'emissary-replay',token,snapshot}, '*');
        if (ev.data?.kind !== 'emissary-result' || ev.data.token !== token) return;
        window.removeEventListener('message', listener); cancelReplay();
        history.replay(replayId, {ok:ev.data.ok,checks:ev.data.checks,prediction:ev.data.prediction,error:ev.data.error}); draw();
        message(ev.data.error ? 'Replay unavailable: ' + ev.data.error : ev.data.ok ? `Current-runtime replay #${replayId} matched action, trace, decision state and observed engine result.` : `Replay #${replayId} mismatch · ` + Object.entries(ev.data.checks).filter(([,v])=>!v).map(([k])=>k).join(', '));
      };
      window.addEventListener('message', listener);
      frame.addEventListener('load', () => {}, {once:true});
      // Remove the listener on every cancellation as well as success/timeout.
      frame._cleanup = () => window.removeEventListener('message', listener);
      host.appendChild(frame); message('Replaying in an isolated runtime…');
      replayTimer = setTimeout(() => { if (epoch === generation) { window.removeEventListener('message', listener); cancelReplay(); message('Replay timed out; no result established.'); } }, 20000);
    };
    q('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(history.report(selected)); message('Private JSON report copied.'); } catch { message('Clipboard unavailable. Export JSON instead.'); } };
    q('[data-export]').onclick = async () => {
      const name = q('[data-name]').value.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80) || 'emissary-decision';
      if (root.webkit?.messageHandlers?.loci && typeof Loci !== 'undefined' && Loci.exportEmissaryTrace) {
        try {
          const result = await Loci.exportEmissaryTrace(`${name}-${Date.now()}-${++serial}.trace.json`, history.report(selected));
          message(result.error ? 'Export failed: ' + result.error : result.cancelled ? 'Export cancelled.' : 'Private JSON report saved to ' + result.path);
        } catch (error) { message('Export failed: ' + error.message); }
        return;
      }
      const url = URL.createObjectURL(new Blob([history.report(selected)], {type:'application/json'})), a = document.createElement('a');
      a.href = url; a.download = `${name}-${Date.now()}-${++serial}.trace.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 30000);
      message('JSON download requested · browser chooses the destination.');
    };
    return {
      get recording() { return recording && !blocked; },
      prepare(state, content) {
        try { return blocked ? null : {before:codec.encode(state),content:codec.encode(content)}; }
        catch { return null; } // Unsupported snapshots never interfere with the real decision.
      },
      add(result, meta, draft, afterDecision) {
        if (blocked) return null;
        selected = history.add(result, meta);
        if (draft) {
          try {
            draft.expected = {action:codec.encode(result.action),trace:codec.encode(result.trace),afterDecision:codec.encode(afterDecision)};
            const size = JSON.stringify(draft).length * 2;
            if (size <= 48*1024*1024) {
              snapshots.set(selected, { ...draft, size });
              while (snapshots.size > 4 || [...snapshots.values()].reduce((n,x)=>n+x.size,0) > 48*1024*1024) snapshots.delete(snapshots.keys().next().value);
            }
          } catch { /* Trace remains useful even when replay data cannot be retained. */ }
        }
        draw(); message('Decision recorded · private session history.'); return selected;
      },
      observe(id, result) {
        const snapshot = snapshots.get(id);
        if (snapshot) { snapshot.observed = codec.encode(result); snapshot.size += JSON.stringify(snapshot.observed).length * 2; }
        while ([...snapshots.values()].reduce((n,x)=>n+x.size,0) > 48*1024*1024) snapshots.delete(snapshots.keys().next().value);
        history.observe(id, summarizeApplication(snapshot ? codec.decode(snapshot.expected.afterDecision) : null,result)); draw();
      },
      reset(secret = false) { history.clear(); snapshots.clear(); cancelReplay(); selected = null; blocked = secret; recording = false; q('[data-record]').checked = false; q('[data-record]').disabled = blocked; draw(); message(blocked ? 'Recording unavailable for this encounter.' : 'New battle · recording off.'); },
      destroy() { cancelReplay(); history.clear(); snapshots.clear(); host.replaceChildren(); }
    };
  }
  const api = {createStore, label, summarizeApplication, mount};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ConceptCombatDecisionInspector = api;
})(typeof globalThis === 'object' ? globalThis : this);
