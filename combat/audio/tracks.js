"use strict";
// Tracks (W7.4 build, integrator lane): the first playback pipe. Cue calls
// from ceremony/shop/milestones resolve per-slot (Mala's custom wavs win,
// warm defaults never leave silence), layer the soul-kind bed under, and
// pitch the ripple-bell +2 semitones per cascade step. Assets land from the
// held muse-jinki-tracks shelf (tracks/*.wav → web/combat/audio/tracks/);
// this module is the pipe + the contract, playable the moment they do.
//   MANIFEST                         → 14 slots + mixes (mirrors the held manifest.json)
//   resolve(slot, { mix, base })      → [customURL, defaultURL] tried in order (never silence)
//   rateFor(pitchStep)                → +2 semitones per step (the climb!)
//   cue(slot, opts, io)               → play + kind bed (io injectable; <audio> in browser)
//   setEnabled(bool) / enabled()      → mute that persists (localStorage)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTracks = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MANIFEST = {
    defaultsDir: "tracks", customDir: "tracks/custom", mixes: ["base", "lofi", "stripped"],
    slots: ["ascension-crescendo", "awaken-anthem", "beloved-lullaby", "claim-chime", "gold-transformation",
      "ignite-sting", "kind-humble", "kind-mythic", "kind-noble", "kind-steadfast", "naming-flourish",
      "ripple-bell", "saga-fanfare", "seal-thump"],
    kindBeds: { humble: "kind-humble", steadfast: "kind-steadfast", noble: "kind-noble", mythic: "kind-mythic" },
  };
  const file = (slot, mix) => (mix && mix !== "base" ? `${slot}.${mix}.wav` : `${slot}.wav`);
  function resolve(slot, { mix = "base", base = "combat/audio" } = {}) {
    if (!MANIFEST.slots.includes(slot)) return [];
    return [`${base}/${MANIFEST.customDir}/${file(slot, mix)}`, `${base}/${MANIFEST.defaultsDir}/${slot}.wav`];
  }
  const rateFor = (pitchStep = 0) => Math.pow(2, (2 * pitchStep) / 12);
  let on = true;
  try { on = (typeof localStorage !== "undefined" && localStorage.getItem("loci-mute")) !== "1"; } catch (e) { /* private mode: sound on */ }
  function setEnabled(v) {
    on = !!v;
    try { if (typeof localStorage !== "undefined") localStorage.setItem("loci-mute", on ? "0" : "1"); } catch (e) { /* ignore */ }
  }
  const enabled = () => on;
  // io: () => audio-like ({ src, volume, playbackRate, play() }). Browser
  // default builds <audio>; tests inject a stub. Custom tried first, default
  // on error — file:// cannot probe, so failure IS the probe. Never silence:
  // the chain always ends at the default.
  const defaultIO = () => (typeof Audio !== "undefined" ? new Audio() : null);
  function playChain(urls, { volume = 1, rate = 1, io = defaultIO } = {}) {
    if (!on || !urls.length) return null;
    const el = io();
    if (!el) return null;
    let i = 0;
    el.volume = volume;
    try { el.playbackRate = rate; } catch (e) { /* fixed-rate stubs */ }
    el.onerror = () => { i++; if (i < urls.length) { el.src = urls[i]; el.play?.()?.catch?.(() => {}); } };
    el.src = urls[0];
    try { const p = el.play?.(); if (p?.catch) p.catch(() => {}); } catch (e) { /* autoplay gate: the gesture unlocks */ }
    return el;
  }
  function cue(slot, { kind = null, mix = "base", pitchStep = 0, volume = 1, io = defaultIO } = {}, base) {
    const played = [];
    const main = playChain(resolve(slot, { mix, ...(base ? { base } : {}) }), { volume, rate: rateFor(pitchStep), io });
    if (main) played.push(slot);
    const bed = kind && MANIFEST.kindBeds[kind];
    if (bed && bed !== slot) {
      const el = playChain(resolve(bed, { ...(base ? { base } : {}) }), { volume: volume * 0.4, io });
      if (el) played.push(bed);
    }
    return played;
  }
  return { MANIFEST, resolve, rateFor, cue, setEnabled, enabled };
});
