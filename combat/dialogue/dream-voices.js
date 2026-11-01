"use strict";
// Voices for dream monsters. Signature lines are Mala's (dream pack, 2026-10-08); the rest are written to
// match them. Flavour only: no battle state. Same Tracery spec shape as summon-voices.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatDreamVoices = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const events = ["appear", "attack", "hit", "hurt", "low_lf", "ultimate", "named", "unnamed", "fade", "defeat"];

  const voices = {
    last_span: { signature: ["Almost there.", "The crossing is not the arrival.", "Do not trust the next step because the last one held."], lines: {
      appear: ["Almost there.", "You are so close to the other side."],
      attack: ["The crossing is not the arrival.", "Step. Step. Step."],
      hit: ["Do not trust the next step because the last one held.", "There was no railing."],
      hurt: ["A plank gives.", "Still spanning."],
      ultimate: ["Almost across. Almost."],
      named: ["Every segment. You checked every segment."],
      unnamed: ["You looked at the far bank again."],
      fade: ["The bridge ends here."], defeat: ["The span falls into the gap."] } },
    many_mouths: { signature: ["One gate is not every gate.", "We follow what remains open.", "You stopped a mouth."], lines: {
      appear: ["We follow what remains open.", "Run. We like it when you run."],
      attack: ["One gate is not every gate.", "From every side."],
      hit: ["Another way in.", "We were already here."],
      hurt: ["You stopped a mouth.", "One mouth. Not all."],
      ultimate: ["Every mouth arrives."],
      named: ["You closed the routes, not the mouths."],
      unnamed: ["Bar the door. We have others."],
      fade: ["The pack scatters into shadow."], defeat: ["The shadow has no more mouths."] } },
    amber_host: { signature: ["An opening is an invitation.", "Listen to what passes.", "Not every wall refuses us."], lines: {
      appear: ["Listen to what passes.", "The hive hums."],
      attack: ["An opening is an invitation.", "Through the gap."],
      hit: ["Not every wall refuses us.", "We found the space."],
      hurt: ["The hum falters.", "Fewer of us."],
      ultimate: ["The hive agrees."],
      named: ["You named the criterion. We have no way in."],
      unnamed: ["A wall is not a filter."],
      fade: ["The hum drifts away."], defeat: ["The hive is hollow."] } },
    witness_vessel: { signature: ["You believed the announcement.", "The eye is not the event.", "Look again."], lines: {
      appear: ["Look again.", "I have been watching."],
      attack: ["You believed the announcement.", "See what you expect."],
      hit: ["The eye is not the event.", "You saw it coming. You were wrong about what it was."],
      hurt: ["A crack in the glaze.", "Look away, then."],
      ultimate: ["You saw it coming."],
      named: ["You checked what happened, not what I showed you."],
      unnamed: ["You are still watching the eye."],
      fade: ["The eye closes."], defeat: ["The vessel shatters. Nothing was inside."] } },
    salt_heir: { signature: ["Held is not gone.", "The basin keeps its inheritance.", "Abundance can close a passage."], lines: {
      appear: ["The basin keeps its inheritance.", "Water remembers where it was held."],
      attack: ["Abundance can close a passage.", "Everything flows here."],
      hit: ["Held is not gone.", "The tide mark rises."],
      hurt: ["The crown tips.", "Salt in the wound."],
      ultimate: ["Everything flows here."],
      named: ["Stored is not removed. You knew."],
      unnamed: ["You think slowing it is enough."],
      fade: ["The water drains away."], defeat: ["The boat sinks with its crown."] } },
    unfinished_customer: { signature: ["This is the way I always go.", "There must be another entrance.", "I have not finished."], lines: {
      appear: ["This is the way I always go.", "Excuse me. Excuse me."],
      attack: ["There must be another entrance.", "Same aisle."],
      hit: ["I have not finished.", "Next in line."],
      hurt: ["Wrong aisle.", "The receipt tears."],
      ultimate: ["The mall never closes."],
      named: ["The routine was the trap. Yes."],
      unnamed: ["It worked before. It will work again."],
      fade: ["The lights go out, aisle by aisle."], defeat: ["Closed. Finally closed."] } },
  };

  const fallback = { appear: "...", attack: "...", hit: "...", hurt: "...", low_lf: "...", ultimate: "...", named: "...", unnamed: "...", fade: "...", defeat: "..." };

  function spec(id) {
    const v = voices[id], ev = {};
    for (const e of events) ev[e] = (v && (v.lines[e] || (e === "low_lf" ? v.signature : null))) || [fallback[e]];
    return { enemy: id, name: id, events: ev, rules: {}, filters: { drop: ["{img", "http"], maxLength: 120 }, fallback };
  }
  return { events, voices, fallback, spec };
});
