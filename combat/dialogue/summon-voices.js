"use strict";
// Voices for memory-palace summons (allies). Same Tracery spec shape as speakers.js, but summons
// speak only their own lines (they are the player's palace, not Arantxa). Flavour only: no battle
// state. Real-person adaptations (Napoleon, Kobe, Aristotle, Genghis Khan) use ORIGINAL lines in
// the spirit of their game roles; no quotes, catchphrases or claims are attributed to the real people.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSummonVoices = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const events = ["summoned", "dismissed", "attack", "hit", "hurt", "ally_hurt", "low_lf", "ordered", "ultimate", "defeat", "rethink"];

  const voices = {
    the_king: { summary: "Grave, formal, bound by his own law.", lines: {
      summoned: ["The court is in session.", "You called. The law answers."],
      dismissed: ["The session is adjourned.", "Rule well while I am gone."],
      attack: ["By decree.", "This line is not yours to cross."],
      hit: ["Judgment delivered.", "The law holds."],
      hurt: ["I am bound as you are.", "A king bleeds by the same rule."],
      ally_hurt: ["No one strikes my subject unanswered.", "That was an offence against the realm."],
      low_lf: ["The crown is heavy. I still wear it."],
      ordered: ["So ordered.", "It will be decreed."],
      ultimate: ["There is only the law, and it binds me too."],
      defeat: ["The throne returns to the palace.", "Even kings yield to the rule."],
      rethink: ["The law must be rewritten. Next session."] } },

    mitsuko: { summary: "Warm, steady, quietly fierce about protecting others.", lines: {
      summoned: ["I'm here. Lean on me.", "Let me take some of it."],
      dismissed: ["Rest a little. I'll be near.", "You carried it well."],
      attack: ["Leave them alone.", "Not while I'm standing."],
      hit: ["Back away from them.", "That's enough."],
      hurt: ["I can carry it.", "It's all right. I meant to take that."],
      ally_hurt: ["Give that one to me.", "I've got you.", "Stay behind me."],
      low_lf: ["Still carrying it.", "A little more. I can."],
      ordered: ["I'll be ready. Stay close.", "Next turn. I promise."],
      ultimate: ["No one falls alone."],
      defeat: ["Look after each other.", "I'll be in the garden."],
      rethink: ["That isn't helping them. Something else."] } },

    inner_child: { summary: "Bright, curious, mischievous; sees every rule as a game.", lines: {
      summoned: ["Ooh, can I play?", "Is it my turn now?"],
      dismissed: ["Okay, bye! That was fun!", "Can we play again later?"],
      attack: ["What if it was like this?", "Bet you didn't think of this one!"],
      hit: ["Ha! Tag!", "It worked! It actually worked!"],
      hurt: ["Hey! That's not fair!", "Ow. Okay, new game."],
      ally_hurt: ["Hey, leave them alone!", "That wasn't nice."],
      low_lf: ["I'm okay. I'm okay!"],
      ordered: ["Ooh! Can I do the big one? Yes!", "Okay okay okay, next turn!"],
      ultimate: ["Let's play something else! New rules, for everybody!"],
      defeat: ["I'm tired now.", "Can someone carry me back?"],
      rethink: ["Boring. Let's pretend it's something different."] } },

    perimeter_guardian: { summary: "Quiet, watchful, protective; a former pursuer now standing guard.", lines: {
      summoned: ["Something must keep watch.", "I used to wait on the other side."],
      dismissed: ["The perimeter holds.", "I return to the wall."],
      attack: ["Leave the threshold.", "I have seen this approach."],
      hit: ["There. That was different.", "Recorded."],
      hurt: ["Remember the cause.", "Pain is evidence. Nothing more."],
      ally_hurt: ["I saw what did that.", "It will not work twice."],
      low_lf: ["Still here.", "The gate has not fallen."],
      ordered: ["I will remember for all of us.", "Understood."],
      ultimate: ["You cannot frighten me the same way twice."],
      defeat: ["You found what I had not learned.", "The wall remembers."],
      rethink: ["Memory has become a habit.", "That protection no longer answers."] } },

    napoleon: { summary: "Brisk and decisive; thinks in timing and convergence.", lines: {
      summoned: ["Where is the decisive point?", "Show me the field."],
      dismissed: ["Hold what we took.", "The campaign continues without me."],
      attack: ["Everything to one place.", "Now. All at once."],
      hit: ["The line breaks there.", "Concentration wins it."],
      hurt: ["A flank I didn't cover.", "Acceptable losses. Barely."],
      ally_hurt: ["Bring them back into formation.", "Close that gap."],
      low_lf: ["Not retreat. Regroup."],
      ordered: ["The point is chosen. Next turn.", "Prepare to converge."],
      ultimate: ["Everything arrives here, at once."],
      defeat: ["The other front was weaker than I planned.", "Withdraw in order."],
      rethink: ["Wrong point. Shift the weight."] } },

    kobe: { summary: "Intense, patient, obsessed with repetition and getting it right.", lines: {
      summoned: ["Let's get to work.", "One more rep."],
      dismissed: ["Back to the gym.", "Good session. Again tomorrow."],
      attack: ["Again.", "Same move. Better."],
      hit: ["That's the one.", "Knew it would fall eventually."],
      hurt: ["Noted. Adjust.", "That's information."],
      ally_hurt: ["Shake it off. Next play.", "Stay in it."],
      low_lf: ["Not finished.", "This is where it counts."],
      ordered: ["Give me the ball.", "Next possession is mine."],
      ultimate: ["One more possession. No changes now."],
      defeat: ["Watch the tape. Fix it.", "Didn't go in. Next time."],
      rethink: ["Wrong look. Change the angle."] } },

    aristotle: { summary: "Measured and precise; separates what must be true from what merely is.", lines: {
      summoned: ["Let us find what is necessary.", "What causes this, and what merely accompanies it?"],
      dismissed: ["Enough has been demonstrated.", "Think on the cause, not the appearance."],
      attack: ["Remove the premise.", "Not the effect. Its condition."],
      hit: ["As predicted.", "Without that, the rest cannot stand."],
      hurt: ["I mistook a coincidence for a cause.", "An instructive error."],
      ally_hurt: ["Observe what made that possible.", "There is a reason that landed."],
      low_lf: ["The argument is not yet finished."],
      ordered: ["Then let us show what must be true.", "I will prepare the demonstration."],
      ultimate: ["Show me what must be true."],
      defeat: ["My model was incomplete.", "Another dependency, unseen."],
      rethink: ["That was present, not necessary. Again."] } },

    // Goethe hot-build (Muse Berry BD, 2026-10-29): questing, aphoristic, warm. No digits anywhere (flavour-only rule).
    goethe: { summary: "Questing and aphoristic; treats every battle as material for becoming.", lines: {
      summoned: ["In the beginning was the deed.", "Show me what wants to become."],
      dismissed: ["What persists is what was truly done.", "Become what you are."],
      attack: ["Act, and watch what answers.", "The deed first."],
      hit: ["It holds.", "There: the consequence."],
      hurt: ["Theory is grey; this is green.", "Noted. The wound teaches."],
      ally_hurt: ["Rise and become again.", "This too is material."],
      low_lf: ["More light. Always more light."],
      ordered: ["Then it shall be done. Next turn.", "Hold the aim; I am coming."],
      ultimate: ["Walpurgis Night. Burn clean."],
      defeat: ["The striving was the point.", "I have seen enough of this shape."],
      rethink: ["Wrong form. Let it die; try the next."] } },

    genghis_khan: { summary: "Restless and expansive; always looking at the open horizon.", lines: {
      summoned: ["The field is wide. Good.", "Which roads are open?"],
      dismissed: ["The horizon calls elsewhere.", "Ride on without me."],
      attack: ["Around, not through.", "They defend one road. Take another."],
      hit: ["They watched the wrong horizon.", "From the open side."],
      hurt: ["Too close together. Spread out.", "They closed a road."],
      ally_hurt: ["Pull back to open ground.", "Don't let them pin you."],
      low_lf: ["Keep moving."],
      ordered: ["Ready the riders.", "We open the horizon next."],
      ultimate: ["You defended the wrong horizon."],
      defeat: ["The roads closed.", "Ride on."],
      rethink: ["This road is shut. Find another."] } },

    zherm: { summary: "Calm, communal and a little eerie; a body that is also a colony.", lines: {
      summoned: ["We are here.", "Spores in the air. Good air."],
      dismissed: ["We go back to the dark and damp.", "Something of us stays."],
      attack: ["Spread.", "Take root."],
      hit: ["It grows on them now.", "Colonised."],
      hurt: ["One of us is lost. The rest remain.", "Prune and regrow."],
      ally_hurt: ["Share with them.", "Feed the weak part."],
      low_lf: ["Nothing here is only me."],
      ordered: ["We gather. Next turn, we wake.", "The colony hears you."],
      ultimate: ["Nothing here is only me. Wake, all of us."],
      defeat: ["Decompose. Return.", "The network rests."],
      rethink: ["Wrong soil. Spread elsewhere."] } },

    gaia: { summary: "Calm and severe; she speaks for the ground, and keeps her accord only while you keep the conditions.", lines: {
      summoned: ["Keep the conditions, and we keep the accord.", "You bound me. Now tend what I am."],
      dismissed: ["I go back into the ground. It remembers you.", "The accord rests."],
      attack: ["The ground closes.", "Settle."],
      hit: ["The earth has them.", "Held."],
      hurt: ["You have broken more than the surface.", "Scars stay. So do I."],
      ally_hurt: ["Root to root. Let me reach them.", "Hold still. The ground will carry you."],
      low_lf: ["A wounded ground still stands."],
      ordered: ["The roots gather. Next turn, they answer.", "I hear you through the ground."],
      ultimate: ["Reconnect.", "The ground remembers."],
      defeat: ["Back to soil. Not gone.", "The land outlasts this."],
      rethink: ["Not this ground. Another way through."] } },

    little_king: { summary: "Charming, theatrical, never quite who he says he is.", lines: {
      summoned: ["You already recognised me.", "Ah, my loyal audience."],
      dismissed: ["Exit, stage left.", "Remember me as you like."],
      attack: ["Bow, if you please.", "A small command, nothing more."],
      hit: ["You obeyed so nicely.", "Recognition is everything."],
      hurt: ["How rude, to check my credentials.", "The costume tears."],
      ally_hurt: ["Someone will answer for that, darling.", "Unseemly."],
      low_lf: ["The show must go on."],
      ordered: ["A royal command? How delicious.", "Next turn, they will all rise."],
      ultimate: ["All rise for the King. Which one? Does it matter?"],
      defeat: ["Unmasked. How dull.", "Curtain."],
      rethink: ["They see through it. New disguise."] } },
  };

  const fallback = { summoned: "Here.", dismissed: "Back to the palace.", attack: "Now.", hit: "Got one.", hurt: "Ah.", ally_hurt: "Hold on!", ordered: "Understood.",
    low_lf: "Still here.", ultimate: "Now, all of it.", defeat: "Back to the palace.", rethink: "Something else, then." };

  // Tracery spec (tracery.js shape). Each line is literal text; no shared grammar needed.
  function spec(id) {
    const v = voices[id], ev = {};
    for (const e of events) ev[e] = (v && v.lines[e]) || [fallback[e]];
    return { enemy: id, name: id, events: ev, rules: {}, filters: { drop: ["{img", "http"], maxLength: 120 }, fallback };
  }

  return { events, voices, fallback, spec };
});
