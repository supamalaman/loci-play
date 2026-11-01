"use strict";
// Read-only presentation of public combat conditions. Counts come from engine state, never icon filenames.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatStatus = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const DEFINITIONS = {
    guard: { name: "Guarding", text: "G", color: "#9ad1ff", help: "Reduces incoming LF damage until the guard expires." },
    ward: { name: "Warded", help: "Stored protection absorbs incoming damage; hits spend it." },
    stun: { name: "Stunned", text: "S", color: "#f08c83", icon: "stun", help: "Removes action points at the next turn start, then clears. It does not skip the whole turn." },
    poison: { name: "Poison", text: "☠", color: "#a6d85c", icon: "poison", help: "Loses LF and action points at each turn start. Clears after its remaining ticks; poison alone cannot finish a unit." },
    burning: { name: "Burning", text: "B", color: "#f4a261", icon: "burn", help: "Fire damage at turn start while burning. No fixed duration is recorded." },
    wrapped: { name: "Wrapped", text: "W", color: "#c9b27c", icon: "stun", help: "Binding Wraps: cannot move on its next turn." },
    infected: { name: "Infected", text: "I", color: "#d85c7a", icon: "bleed", help: "Loses 3 LF per infection tick. Healing clears the infection." },
    seedLodge: { name: "Lodged seeds", text: "✿", color: "#a6d85c", icon: "regrow", help: "Each lodged seed sprouts for damage at the next turn start, then clears." },
    soothed: { name: "Soothed", text: "z", color: "#b8a6e8", icon: "sleep", help: "Hostile actions are unavailable. Clears at the stated turn end, or when harm to its side breaks the soothing." },
    asleep: { name: "Asleep", text: "Z", color: "#9aa0ae", icon: "sleep", help: "Fast asleep after three pets. Unpettetable; nothing disturbs him." },
    inebriated: { name: "Inebriated", text: "?", color: "#e9c46a", icon: "confuse", help: "The turn's action-point budget is halved while inebriated." },
    parry: { name: "Rebound armed", text: "R", color: "#f4a261", help: "Can catch an eligible incoming delivery. Remains hidden from enemies until disclosed." },
    membrane: { name: "Membrane", text: "M", color: "#8fb3ff", help: "A selective membrane affects eligible deliveries until it expires or ruptures." },
    recovery: { name: "Recovery", help: "Treatment advances at the patient's turn start. Damage interrupts it unless treatment is held through one disturbance." },
    entangled: { name: "Entangled", help: "Tangled growth: movement reduced while it holds." }, rooted: { name: "Rooted", help: "Movement is unavailable while the binding holds." },
    stagger: { name: "Staggered", help: "Knocked off stride by a fall: −1 movement while it lasts." }, silenced: { name: "Silenced", help: "That harm channel is refused until your next turn — and no singing." }, choked: { name: "Choked" },
    slowStart: { name: "Slow start", help: "Slow off the mark: movement halved while it lasts." }, grounded: { name: "Grounded", help: "Wet wings: a grounded flyer walks until dry." }, held: { name: "Held", help: "No listed freedoms while contact holds. Break contact, answer with resonance, or wait it out." },
    scramble: { name: "Scrambling", help: "Hurt and running: +2 movement and swing-free steps until your next turn." },
    moveAdd: { name: "Movement boosted", help: "Stride lengthened: movement increased while it lasts." }, rangeBuff: { name: "Range enhanced", help: "Eyes up: line techniques reach farther." }, lockMove: { name: "Movement locked", help: "Pinned: no movement until your next turn." },
    sharedBurden: { name: "Shared burden", help: "Incoming damage is shared with other protected group members." },
    lawsProtection: { name: "The King's Law", help: "Reduces incoming damage while the protection holds." },
    rememberedThreats: { name: "Remembered threats", help: "Resists damage channels already used in this encounter." },
    routeBudget: { name: "Route extended", help: "The long way round: routed techniques run farther." }, catharsis: { name: "Catharsis", help: "Catharsis: techniques land harder while the feeling holds." },
    attention: { name: "Focused", help: "Attacks on the one target ×1.5, ignoring cover and parries — but anyone else hits you ×1.25. A feint or resonance pulse breaks it." }, tippingPoint: { name: "Tipping point set", help: "Crossing below half LF — or a resonance hit — triggers the mark." },
    grappled: { name: "Grappled", help: "Cannot move or dodge; Break hold frees you. A hold breaks when either unit is moved by anything but its own Move, Jump or Climb (a shove, pull, throw, dash, swap, teleport or dodge)." },
    cornerAdvice: { name: "Corner advice", help: "Someone talks you through it: Strikes hit harder through your next turn." }, exposed: { name: "Exposed", help: "Exposed: incoming damage ×1.25 until your next turn." },
    immovable: { name: "Immovable", help: "Set: forced movement cancelled, Nigredo · impact −20%. Slows you after." }, anchor: { name: "Anchored", help: "Anchored: the next forced displacement is cancelled. Damage is not reduced." }, constrained: { name: "Held" }, prone: { name: "Prone" },
    tauntProtection: { name: "Braced against a taunt", help: "Braced against the taunt's source: their damage reduced." }, afraid: { name: "Afraid" }, standDown: { name: "Standing down" },
    truce: { name: "Truce" }, trapped: { name: "Trapped", help: "No way off the set but through: the only exits are CUT, ruin, or the twelfth take." },
    malnote: { name: "Blessing of Malnote", help: "+1 move, ×0.85 damage taken." },
    ambush: { name: "Ambush set", help: "Anyone ending a move closer before your next turn is hit." },
    bleed: { name: "Bleeding", help: "Loses LF at each turn start until the bleeding stops." },
    bloodyHands: { name: "Bloody Hands", help: "Carrying a foe's blood: spend it on a blood rite step for no LF." },
    overwatch: { name: "Overwatch", help: "Watching: the first foe to step in range eats a snapshot. No Guard or dodge while watching." },
    cushion: { name: "Cushioned", help: "Someone is ready to catch you: Nigredo hits softened while uses last." },
    cyphPocket: { name: "Pocketed bar", help: "A pocketed bar: perform it at full strength with no second fee." },
    detained: { name: "Detained", help: "Detained: no actions until the hold ends." },
    dread: { name: "Dread-marked", help: "The visage marked you: a strike while fleeing lands ×2 (coup de grace), consuming the mark." },
    soaked: { name: "Soaked", text: "≈", color: "#5fa8d3", help: "Sinkerfruit: water damps the fruit's power for a turn: no fruit technique, no ΦF regen, damage taken ×1.25." },
    drowning: { name: "Drowning", help: "A non-swimmer in water: −8 LF at each turn start. Reach dry ground." },
    entranced: { name: "Entranced", help: "Entranced: friend and foe read swapped until it clears." },
    establishedGuard: { name: "Holding the ground", help: "Stood still and set: the next shield-side hit reduced. Moving resets it." },
    fulcrum: { name: "Braced", help: "Braced on a support: leverage throws are armed. Moving loses it." },
    fullChord: { name: "Full Chord", help: "The siege hymn: nearby allies knit, nearby enemies bleed, at each of the singer's turn starts." },
    oath: { name: "Oath", help: "Sworn in public, two terms: stand fast (no retreat) and keep faith (a ward stays above half). Kept, it feeds Smite and the aura; broken, those gifts end until you swear again." },
    hands: { name: "Hands", help: "A finite store of mercy: Lay on Hands heals up to 10 LF at a time from this pool, for the battle." },
    hymn: { name: "Hymn of the Oath", help: "The oath sung aloud: nearby allies knit and nearby foes burn at each of the singer's turn starts, stronger while the oath holds." },
    heldTones: { name: "Holding tones", help: "Named tones held: verses hit harder per tone, and nearby allies knit at your turn starts. Damage or distance breaks the hold." },
    imaginedRehearsal: { name: "Rehearsed", help: "Rehearsed the summon: extra hints toward the imagined form." },
    inputFilter: { name: "Filtering", help: "Filtering one harm channel: other channels hit softer, and a matching Typed Channel silences." },
    intercept: { name: "Covered", help: "Someone stands ready to step between you and the next hit." },
    maidProtected: { name: "Maid's protection", help: "The maid's protection: the next incoming hit lands ×0.5." },
    onePossession: { name: "One Possession", help: "Damage focused on its one mark." },
    order: { name: "Under orders", help: "A standing order names one target: attacks there hit harder, everything else obeys the obsolete plan." },
    quarry: { name: "Marked quarry", help: "Marked as quarry: the hunter's shots land harder on you." },
    petrified: { name: "Petrified", help: "Turned to stone: immune to all damage, but cannot act or move." },
    marked: { name: "Marked", help: "Marked by a gaze: the gazer's sight-line techniques are armed on you." },
    verse: { name: "Held verse", help: "A drawn line, already paid for: deliver it or discard it." },
    woozy: { name: "Woozy", text: "~", color: "#c9b3e8", help: "Surgery anaesthetic: fewer action points at each turn start and ability damage reduced, until it wears off." },
    whatIf: { name: "What If", help: "The kit is a draft: every basic may be played as another known basic." }
  };
  const finite = (n) => typeof n === "number" && Number.isFinite(n);
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  function rows(a, { showParry = false, showAmbush = false, actors = null, content = null } = {}) {
    const out = [];
    const who = (id) => actors?.[id]?.name || null;
    const ability = (id) => content?.abilities?.[id]?.name || id;
    for (const [key, def] of Object.entries(DEFINITIONS)) {
      const value = a?.status?.[key]; if (!value || (key === "parry" && !showParry) || (key === "ambush" && !showAmbush)) continue;
      if ((key === "silenced" || key === "bleed") && finite(value.until) && value.until < a.ownerTurns) continue;   // spent: the effect gate and the tick both read `until`, so the card must too
      const row = { key, ...def, detail: "", help: def.help || "", count: null };
      if (key === "poison") {
        if (finite(value.turnsLeft)) { row.count = value.turnsLeft; row.detail = plural(value.turnsLeft, "turn") + " left"; }
        if (finite(value.lf) && finite(value.apLoss)) row.help += ` Each tick: −${value.lf} LF, −${value.apLoss} AP.`;
      } else if (key === "infected" && finite(value)) { row.count = value; row.detail = plural(value, "tick") + " left"; }
      else if (key === "burning" && finite(value)) row.detail = `${value} LF / turn`;
      else if (key === "stun" && finite(value.points)) row.detail = `${value.points} AP at next turn start`;
      else if (key === "seedLodge" && finite(value.count)) { row.count = value.count; row.detail = plural(value.count, "seed"); if (finite(value.damage)) row.help += ` ${value.damage} damage per seed.`; }
      else if (key === "ward" && finite(value.protection)) row.detail = `${value.protection} protection`;
      else if (key === "guard" && finite(value.multiplier)) row.detail = `${Math.round((1 - value.multiplier) * 100)}% LF reduction`;
      if (key === "recovery" && finite(value.stage)) row.detail = `Stage ${value.stage}${value.held ? " · held through one disturbance" : ""}`;
      if (key === "scramble") row.detail = `+${value.amount} move`;
      if (["moveAdd", "rangeBuff", "routeBudget"].includes(key) && finite(value.amount)) row.detail = value.amount < 0 ? `−${-value.amount} move` : `+${value.amount}`;
      if (key === "moveAdd" && finite(value.amount) && value.amount < 0) { row.name = "Movement slowed"; row.help = "Heavy steps: movement reduced while it lasts."; }
      if (key === "held" && value.gaze) row.help = "No listed freedoms while the gaze holds. Break the sight line (berm, wall, smoke, a reflection) or wait it out.";
      if (key === "entangled" && finite(value.lostMove)) row.detail = `−${value.lostMove} move`;
      if (key === "silenced" && value.channel) row.detail = String(value.channel);
      if (key === "held" && Array.isArray(value.freedoms)) row.detail = `${who(value.by) || "held"}: no ${value.freedoms.join(" / ")}`;
      if (key === "catharsis" && finite(value.potencyMul)) row.detail = `×${value.potencyMul}`;
      if (key === "attention" && value.target) row.detail = `on ${who(value.target) || value.target}`;
      if (key === "tippingPoint" && finite(value.potency)) row.detail = `${value.potency} Albedo`;
      if (key === "tauntProtection" && finite(value.multiplier)) row.detail = `×${value.multiplier}`;
      if (key === "cornerAdvice" && finite(value.mul)) row.detail = `Strikes ×${value.mul}`;
      if (key === "lawsProtection" && finite(value.multiplier)) row.detail = `×${value.multiplier}`;
      if (key === "rememberedThreats" && finite(value.multiplier)) row.detail = `×${value.multiplier}`;
      if (key === "ambush" && finite(value.potency)) row.detail = `${value.potency} Albedo on approach`;
      if (key === "woozy") { row.detail = [finite(value.apLoss) ? `−${value.apLoss} AP` : "", finite(value.damageMul) ? `ability damage ×${value.damageMul}` : "", finite(value.left) ? plural(value.left, "turn") + " left" : ""].filter(Boolean).join(", "); if (finite(value.left)) row.count = value.left; }
      if (key === "bleed" && finite(value.drain)) row.detail = `−${value.drain} LF / turn`;
      if (key === "cushion") row.detail = [finite(value.mul) ? `×${value.mul}` : "", finite(value.uses) ? `${value.uses} left` : ""].filter(Boolean).join(", ");
      if (key === "cyphPocket" && value.id) row.detail = ability(value.id);
      if (key === "verse") row.detail = value.id ? ability(value.id) : Array.isArray(value.choices) ? `${value.choices.length} lines to choose` : "";
      if (key === "oath") row.detail = value.broken ? "broken" : value.ward ? `ward: ${who(value.ward) || value.ward}` : "sworn alone";
      if (key === "hands" && finite(value.pool)) row.detail = `${value.pool}/${value.max ?? 30}`;
      if (key === "heldTones" && finite(value.count)) { row.count = value.count; row.detail = plural(value.count, "tone"); }
      if (key === "order" && value.target) row.detail = `${who(value.target) || value.target}${finite(value.mul) ? ` ×${value.mul}` : ""}`;
      if (key === "quarry" && value.by) row.detail = `hunted by ${who(value.by) || value.by}`;
      if (key === "establishedGuard" && finite(value.mul)) row.detail = `next shield-side hit ×${value.mul}`;
      if (key === "inputFilter" && value.channel) row.detail = String(value.channel);
      if (key === "intercept" && value.by) row.detail = `${who(value.by) || value.by}${finite(value.uses) ? `, ${value.uses} left` : ""}`;
      if (key === "onePossession" && finite(value.multiplier)) row.detail = `×${value.multiplier} on its mark`;
      if (key === "imaginedRehearsal" && finite(value.hints)) row.detail = `+${value.hints} hints`;
      if (key === "soothed" && finite(value.throughTurn)) row.help += ` Ends after this unit's turn ${value.throughTurn}.`;
      if (key === "inebriated" && finite(value.expiresAt)) row.help += ` Clears at this unit's turn ${value.expiresAt + 1} start.`;
      // Timed barriers use their caster's owner-turn clock; never substitute the target's clock.
      if (!["soothed", "inebriated"].includes(key) && finite(value.expiresAt)) {
        const owner = value.owner === a.id ? a : actors?.[value.owner];
        const clock = owner ? (value.owner === a.id ? "this unit" : owner.name) : null;
        if (clock) row.help += ` Expires at ${clock}'s turn ${value.expiresAt} start.`;
      }
      out.push(row);
    }
    // Ritual feedback (Muse-2's RITUAL_FEEDBACK.md, built by Lantern 2026-10-19): the chant rides the marker rail with its
    // turns left, and a creature held by someone's chant says so. Capture rituals keep a.ritual, not a status.
    if (a?.ritual) out.push({ key: "chant", name: "Chanting", text: "✦", color: "#e8c85a", icon: null, count: finite(a.ritual.turnsLeft) ? a.ritual.turnsLeft : null,
      detail: finite(a.ritual.turnsLeft) ? plural(a.ritual.turnsLeft, "turn") + " left" : "", help: "Holding a capture chant. Damage can break it; moving ends it." });
    if (actors && Object.values(actors).some((u) => u && !u.defeated && u.ritual?.monsterId === a?.id))
      out.push({ key: "held", name: "Held", text: "◎", color: "#dfe8f0", icon: null, count: null, detail: "in a capture chant", help: "Held in stasis by a capture chant: it can't act, and nothing can hit it until the chant ends." });
    for (const [zone, label] of [["head", "Head"], ["arms", "Arms"], ["legs", "Legs"]]) {   // injuries: one card line per wounded zone (card only — no map mark)
      const w = a?.injuries?.[zone];
      if (!w || !w.g) continue;
      const bleed = w.s ? 0 : (w.g === 2 ? 2 : 1);
      const effect = zone === "head" ? (w.g === 2 ? "no reactions" : "Observe and Investigate +10 AP") : zone === "arms" ? (w.g === 2 ? "no Strike or Grapple" : "strikes −20%, holds −20%") : (w.g === 2 ? "cannot move; a dodge is 1 tile and costs double" : "−1 move and −1 dodge tile") + " (fliers ignore it)";
      out.push({ key: `wound-${zone}`, name: `${label}: ${w.g === 2 ? "maimed" : "wounded"}`, text: null, color: null, icon: null, count: null,
        detail: bleed ? `bleed ${bleed}` : "steady", help: `${effect}. MEND downgrades, TEND steadies the bleeding.` });
    }
    return out;
  }
  function marks(a, { showParry = false, wardAsNumber = false, actors = null } = {}) {   // actors: lets a held creature show its "Held" mark
    return rows(a, { showParry, actors }).filter(r => r.text || (wardAsNumber && r.key === "ward")).map(r => {
      if (r.key === "ward") return { text: String(a.status.ward.protection), color: "#e9c46a", name: r.name };
      return { text: r.key === "poison" && r.count != null ? `☠${r.count}` : r.text, color: r.color,
        ...(r.icon ? { icon: r.icon } : {}), ...(r.count != null ? { count: r.count } : {}), name: r.name };
    });
  }
  const escape = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function html(list, esc = escape, unit = "") {
    if (!list?.length) return "";
    return `<div class="cc-status-list" data-status-unit="${esc(unit)}" aria-label="Conditions">${list.map(r => `<details class="cc-status" data-status="${esc(r.key)}"><summary>${r.icon ? `<img src="combat/sprites/fx/status/${esc(r.icon)}.png" alt="" aria-hidden="true" onerror="this.hidden=true">` : ""}<span>${esc(r.name)}</span>${r.detail ? `<small>${esc(r.detail)}</small>` : ""}</summary><div class="cc-status-help">${esc(r.help || "An active condition. No further duration or effect is recorded here.")}</div></details>`).join("")}</div>`;
  }
  // Redraws during effect waits must not close the explanation or steal its keyboard focus.
  function replace(panel, markup) {
    const key = d => `${d.closest("[data-status-unit]")?.dataset.statusUnit || ""}:${d.dataset.status}`;
    const old = [...(panel.querySelectorAll?.(".cc-status") || [])], opened = new Set(old.filter(d => d.open).map(key));
    const active = panel.ownerDocument?.activeElement;
    const focused = active?.matches(".cc-status > summary") && panel.contains(active) ? key(active.parentElement) : null;
    panel.innerHTML = markup;
    for (const d of panel.querySelectorAll?.(".cc-status") || []) {
      if (opened.has(key(d))) d.open = true;
      if (focused === key(d)) d.querySelector("summary").focus({ preventScroll: true });
    }
  }
  const artUses = () => Object.values(DEFINITIONS).filter(r => r.icon).map(r => ({ icon: r.icon, name: r.name }));
  return { rows, marks, html, replace, artUses };
});
