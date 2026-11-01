// Loaded only in a disposable iframe. No UI mount, account writes, rewards or uploads.
(function(root) {
  "use strict";
  root.addEventListener('message', ev => {
    if (ev.source !== root.parent || ev.data?.kind !== 'emissary-replay') return;
    const {snapshot,token} = ev.data; let reply;
    try {
      const {encode,decode} = root.ConceptCombatDecisionCodec;
      const E = root.ConceptCombatUI.createInspectorEngine(decode(snapshot.content));
      const state = decode(snapshot.before), result = E.inspectAiAction(state);
      const actual = {action:encode(result.action),trace:encode(result.trace),afterDecision:encode(state)};
      const checks = Object.fromEntries(Object.keys(actual).map(k => [k, JSON.stringify(actual[k]) === JSON.stringify(snapshot.expected[k])]));
      const application = E.apply(state,result.action);
      checks.application = JSON.stringify(encode(application)) === JSON.stringify(snapshot.observed);
      reply = {ok:Object.values(checks).every(Boolean),checks,prediction:root.ConceptCombatDecisionInspector.summarizeApplication(state,application)};
    } catch(error) { reply = {error:error.message}; }
    root.parent.postMessage({kind:'emissary-result',token,...reply}, '*');
  });
  root.parent.postMessage({kind:'emissary-ready'}, '*');
})(globalThis);
