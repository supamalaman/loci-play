"use strict";
// Keeper line tables: plain rows { id, face, when, text } (decision D10: plain tables, not Tracery, so every line is auditable).
// Source: ~/loci-orbit/ready-to-review/claude-npc-faces-spec/specs/NPC_LINES.md. Slice S0 carries Rama; S1 adds Sita, Jatayu, the Tallyman and Jambavan; S2 adds Hermes, Ravana, Lakshmana and the Gambler; S3 adds Pioneer, Talisman and Kaikeyi; each later slice adds its keepers.
// Rules (spec section 12; tests/npc-lines.test.mjs lints them): no digits and no number words; tokens only from the whitelist
// `name seeds price item n owed level wins fame slots slotsMax scenario tier cycle`, filled at render time or the line is skipped;
// at most 110 characters and two sentences; no living person; a line may state only what the window does.
//   face: neutral | happy | angry | sad | surprised
//   when: first | return | loss | win | streak | owing | big | idle | buy | refuse | err | mile | leave | fold:<id>
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatKeeperLines = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // gate: a line that names an effect is shown only while that effect is on (spec section 12): "perk" = K.KEEPER_PERKS (the Seeds perks, off).
  const row = (keeper, n, face, when, text, gate) => ({ id: `${keeper}.${when}.${n}`, face, when, text, ...(gate ? { gate } : {}) });
  const rama = [
    ["neutral", "first", "Choose your ground, Warden. A good fight starts with a good choice."],
    ["neutral", "return", "You are back. Which ground tonight?"],
    ["neutral", "idle", "I do not hurry a decision. I do not wait forever for one either."],
    ["happy", "win", "Well fought. {wins} won so far, and you earned each one."],
    ["happy", "streak", "A fair run. Do not let it make you careless."],
    ["sad", "loss", "You lost that ground. Study it, then take it back."],
    ["sad", "refuse", "That ground is closed to you for now."],
    ["angry", "err", "The gate would not open, and nothing was spent. Try again."],
    ["surprised", "mile", "Level {level} already. The hall takes note."],
    ["neutral", "fold:scenarios", "Every scenario here teaches one thing. Pick the lesson you need."],
  ].map(([face, when, text], i) => row("rama", i, face, when, text));
  const bank = (keeper, rows) => rows.map(([face, when, text, gate], i) => row(keeper, i, face, when, text, gate));
  const sita = bank("sita", [
    ["neutral", "first", "This is your home, {name}. Sit and look over what you carry."],
    ["neutral", "return", "Welcome home. Let us see what you carry."],
    ["neutral", "idle", "A prepared fighter is a calm one."],
    ["happy", "buy", "Good. That will serve you."],
    ["happy", "win", "You came home whole. I am glad."],
    ["sad", "loss", "Rest now. The pack can wait until you have eaten."],
    ["sad", "refuse", "There is no room for that. Something has to come out before it goes in."],
    ["angry", "err", "That did not save. Do it again, and slowly."],
    ["surprised", "mile", "Level {level}. Look how far you have come."],
    ["neutral", "fold:character", "Concepts, lenses, the pack: choose with the next fight in mind."],
  ]);
  const jatayu = bank("jatayu", [
    ["neutral", "first", "I keep what has been met. Ask, and I will show you."],
    ["neutral", "return", "You return to the records. Good."],
    ["neutral", "idle", "An old hunter remembers by writing it down."],
    ["happy", "mile", "A new level gained. The Archive is richer for it."],
    ["happy", "win", "I have written that one down. It was well done."],
    ["sad", "loss", "I have written that down too. Losses teach the longest."],
    ["sad", "refuse", "The page is not here. Nothing was written of it."],
    ["angry", "err", "The record is torn. That is not your doing."],
    ["surprised", "big", "So many entries in one visit. You read fast."],
    ["neutral", "fold:bestiary", "Read what each creature means, not only what it does."],
  ]);
  const tallyman = bank("tallyman", [
    ["neutral", "first", "Every account starts clean, {name}. Mine does not stay that way for everyone."],
    ["neutral", "return", "Ledger open. Say what you need entered."],
    ["neutral", "owing", "You owe {owed}. I am not unkind, but I do count."],
    ["neutral", "idle", "A line unentered is a line forgotten."],
    ["happy", "buy", "Entered, and paid in full. I like paid in full."],
    ["happy", "win", "The book shows {wins} won. It is a good-looking page."],
    ["sad", "loss", "A loss is also an entry. I am sorry to write it."],
    ["sad", "refuse", "The ledger will not carry that. The Seeds are not there."],
    ["angry", "owing", "You still owe {owed}. I will say it once more, and then I will say it louder."],
    ["surprised", "big", "That is a large entry. I had to check the figure again."],
  ]);
  const jambavan = bank("jambavan", [
    ["neutral", "first", "Contracts for muscle, letters for peace. Both are bought before the fight."],
    ["neutral", "return", "Back, {name}. The roster is steady."],
    ["neutral", "idle", "A good hire is worth waiting for."],
    ["happy", "buy", "Signed. They will come when you call."],
    ["happy", "big", "You hire often. A regular gets a regular's price.", "perk"],
    ["sad", "refuse", "You are short {price} Seeds. Wait for the next battle."],
    ["sad", "loss", "Hirelings leave when it goes bad. That is the trade."],
    ["angry", "err", "The paper is not valid. I do not sell what does not stand."],
    ["surprised", "mile", "Fame {fame}? People will want to work for you."],
    ["neutral", "fold:hall", "Pack the contract before the fight. It takes a slot like anything else."],
  ]);
  const hermes = bank("hermes", [
    ["neutral", "first", "Postings here, a job at a time. I carry the word, not the fight."],
    ["neutral", "return", "New postings. Some will rot if you wait."],
    ["neutral", "idle", "Speed is a kind of kindness. Choose."],
    ["happy", "win", "A fight won. Look over the postings."],
    ["happy", "buy", "Accepted. Fight their fight, not yours."],
    ["sad", "loss", "A fight lost. A job can be abandoned clean, with no pay and no penalty."],
    ["angry", "refuse", "You cannot take another yet. Finish or abandon the job you hold."],
  ]);
  const ravana = bank("ravana", [
    ["neutral", "first", "Behold the board of threats. Find where you stand."],
    ["neutral", "return", "Back to measure yourself against the rest? Brave."],
    ["neutral", "idle", "Many minds, and none of them idle. Choose your question."],
    ["happy", "win", "Impressive. Do not let it go to your head."],
    ["happy", "mile", "Level {level} already. The board will measure you soon enough."],
    ["sad", "loss", "Even the mighty fall. Rise, as the rest of us did."],
    ["neutral", "fold:threat", "The ratings come from simulated fights. They are tendencies, not promises."],
  ]);
  const lakshmana = bank("lakshmana", [
    ["neutral", "first", "A drill is a handful of questions, and each right answer is paid in Seeds. Begin."],
    ["neutral", "return", "Ready to be tested again?"],
    ["neutral", "idle", "Think it through. There is no penalty for care."],
    ["happy", "win", "You won. A drill here pays Seeds for what you have learned."],
    ["happy", "streak", "A run of wins. Test the lessons behind them."],
    ["sad", "loss", "A fight lost. Drill what it taught you."],
    ["neutral", "fold:school", "Each drill is a few questions on the Teach bank. Take them one at a time."],
  ]);
  const gambler = bank("gambler", [
    ["neutral", "first", "The hat is on the ground. Fame is a gamble, friend."],
    ["neutral", "return", "The crowd is here. Your move."],
    ["neutral", "idle", "Fortune likes a steady hand."],
    ["happy", "win", "A good result. The hat is a fair judge."],
    ["sad", "loss", "A bad day happens. The hat will be there next cycle."],
    ["sad", "refuse", "You have busked this cycle. The crowd needs a rest too."],
    ["neutral", "fold:square", "The room is hard or easy, and you know which before you play."],
  ]);
  // S3: the Field Kit counter keepers (spec NPC_LINES.md sections 6, 8, 9). The Pioneer's `big` line is a price promise, gated
  // "perk" like Jambavan's (the audit caught it ungated; P1 is off). The three `mile` lines are reworded: a level gain says
  // nothing about better stock, rare parts or buy orders, so each says what the level means instead.
  const pioneer = bank("pioneer", [
    ["neutral", "first", "Fresh stock, {name}. Everything here is built to be carried."],
    ["neutral", "return", "Back for more gear? Look over what is on the shelves."],
    ["neutral", "idle", "Pack light. Carry what you will use."],
    ["happy", "buy", "A good pick. That will see you through a long walk."],
    ["happy", "big", "You bought well last time. Same deal today.", "perk"],
    ["sad", "refuse", "I cannot sell you that one. You carry it already, or the stash is full."],
    ["sad", "loss", "Rough fight? Some of this is built for exactly that."],
    ["surprised", "mile", "Level {level}. Pack for the longer walk."],
    ["neutral", "fold:shop", "Stock turns over after each battle. What you see is what I have."],
  ]);
  const talisman = bank("talisman", [
    ["neutral", "first", "Parts in, vessel out. The kiln keeps an honest account."],
    ["neutral", "return", "The kiln is warm. What shall we make?"],
    ["neutral", "idle", "Patience. Heat does not rush."],
    ["happy", "buy", "Fired clean. It sits in your stash now."],
    ["happy", "big", "A good batch. Nothing cracked."],
    ["sad", "refuse", "You are short on parts or the fee for that batch. The kiln will not cheat for you."],
    ["sad", "loss", "Bring back what you salvaged. Some of it will still burn."],
    ["angry", "err", "The kiln guttered and nothing was spent. Try again."],
    ["surprised", "mile", "Level {level}. The kiln will be here when you return."],
    ["neutral", "fold:kiln", "Firing is exact: no luck, only parts and the fee."],
  ]);
  const kaikeyi = bank("kaikeyi", [
    ["neutral", "first", "Buyers want your vessels, {name}. Each has a price and a temper."],
    ["neutral", "return", "Prices moved while you were away. They always do."],
    ["neutral", "idle", "A good seller waits for the right buyer."],
    ["happy", "buy", "Sold, and well. Remember who paid you."],
    ["happy", "big", "A good sale builds your standing. Buyers remember who sells well."],
    ["sad", "refuse", "They will not buy that today. Try another buyer."],
    ["sad", "loss", "Fewer vessels, fewer offers. It happens after a hard fight."],
    ["angry", "err", "That buyer closed his hand. Do not push."],
    ["surprised", "mile", "Level {level}. The market remembers a steady seller."],
    ["neutral", "fold:stall", "The drift and the campaign both move the price. Watch both."],
  ]);
  const magistrate = bank("magistrate", [
    ["neutral", "first", "You stand before the Codex. State your business and your evidence."],
    ["neutral", "return", "The record is open. Proceed."],
    ["neutral", "idle", "The court is patient. The law is more so."],
    ["happy", "win", "The verdict stands in your favor. That is not common here."],
    ["happy", "mile", "Level {level}. The court takes note."],
    ["sad", "loss", "The court notes the loss. It is entered without prejudice."],
    ["angry", "refuse", "Not admissible. Bring better evidence."],
    ["surprised", "big", "An unusual filing. The court will read it closely."],
    ["neutral", "fold:traditions", "Each tradition is a pattern you performed. The Codex remembers what you did."],
    ["neutral", "fold:scribing", "At the desk you shape recovered parts into a technique. Open it from here."],
  ]);
  const starfarer = bank("starfarer", [
    ["neutral", "first", "Out here nothing is mapped until you walk it. Step anywhere free."],
    ["neutral", "return", "The map has grown a little. Look."],
    ["neutral", "idle", "Stars do not hurry. Neither do good discoveries."],
    ["happy", "mile", "Level {level}. The map is large; keep walking."],
    ["happy", "buy", "Claimed. It is yours to walk."],
    ["sad", "refuse", "That claim is refused for now. The tip says why."],
    ["sad", "loss", "Even a navigator loses a heading. Take a fix and try again."],
    ["surprised", "big", "A whole constellation at once? Show me how."],
    ["neutral", "fold:workshop", "Walk anywhere free, own a path, and see what grows beside it."],
  ]);
  // S4c carries the Freemason (spec NPC_LINES.md section 14). Three rows are reworded from the draft so each
  // line says what the desk does: `big` (the desk inscribes, it never takes apart), `refuse` (the only clickable
  // refusal is an already-inscribed blueprint; the button is gone for a bad draft and disabled when poor) and
  // `err` (draft, equip and trial failures all land in the status notice).
  const freemason = bank("freemason", [
    ["neutral", "first", "A craftsman measures with care. Sit at the bench."],
    ["neutral", "return", "The bench is as you left it."],
    ["neutral", "idle", "Joinery is patience, in wood and in thought."],
    ["happy", "buy", "A clean cut. Keep the offcuts."],
    ["happy", "mile", "That joint will hold. Good work."],
    ["sad", "loss", "A cracked piece is still a lesson in the grain."],
    ["sad", "refuse", "That blueprint is already inscribed. Equip it from the library below."],
    ["angry", "err", "That did not work. Read the notice and try again."],
    ["surprised", "big", "A great deal of work crossed this bench. Where do you want to start?"],
    ["neutral", "fold:scribing", "Held techniques come apart into parts. Parts go back together as something new."],
  ]);
  return { LINES: { rama, sita, jatayu, tallyman, jambavan, hermes, ravana, lakshmana, gambler, pioneer, talisman, kaikeyi, magistrate, starfarer, freemason } };
});
