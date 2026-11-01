"use strict";
// Jinki soul-kind voices: the awakened object speaks (Muse, Jinki J4).
// Humble, steadfast, noble, mythic — each soul kind answers care in its
// own voice, on the tend/cherish/mend lines and as a codicil to the care
// tale on the gear card. Objects stay silent: a codicil fires ONLY when
// the soul is awake (gear.care[id].soul present), so every soulless line
// in the game renders byte-identical. Pure and dependency-free.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatJinkiVoice = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const VOICES = {
    humble: {
      tended: "It is glad of the hands.",
      cherished: "It will remember this kindness.",
      mended: "It bears the mending gratefully.",
      smith: "It thanks the smith in its quiet way.",
      card: "It asks nothing, and gives what it has.",
      animist: "It was never just a thing. Now you know.",
    },
    steadfast: {
      tended: "It will hold.",
      cherished: "It stands a little straighter.",
      mended: "It takes the mending and holds.",
      smith: "It nods to the smith, once.",
      card: "It will be here when you need it.",
      animist: "It stands straighter. So do you.",
    },
    noble: {
      tended: "It accepts your care with grace.",
      cherished: "It inclines toward you, honored.",
      mended: "It receives the mending as its due.",
      smith: "It commends the smith's work.",
      card: "It carries itself like a promise.",
      animist: "It inclines toward you. You see at last.",
    },
    mythic: {
      tended: "The epic remembers this.",
      cherished: "Legends lean closer to listen.",
      mended: "The story refuses to end here.",
      smith: "Even the smith feels watched, kindly.",
      card: "It has outlived epics before.",
      animist: "The epic turns a page: you are in it now.",
    },
  };
  const MOMENTS = ["tended", "cherished", "mended", "smith", "card", "animist"];
  const kindOf = (account, id) => account?.gear?.care?.[id]?.soul?.kind || null;
  // Null unless the soul is awake AND the kind and moment are known —
  // an unknown future kind degrades to silence, never to a wrong voice.
  function codicil(account, id, moment) {
    const voice = VOICES[kindOf(account, id)];
    return voice && MOMENTS.includes(moment) ? voice[moment] : null;
  }
  return { VOICES, MOMENTS, kindOf, codicil };
});
