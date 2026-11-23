"use strict";
// Bonds B1 (claude-bonds-spec section 1.13, R-20261114-39, R-20261122-11): the authored routes the bond ledger reads.
// One route a character. B1 ships Jatayu's introduction, beat 1 (the missing map) as a talk encounter, the line for fighting
// beside him, and his answer when the player asks for the next rank. Lines are in his keeper voice ("old, exact, patient",
// npc/keepers.js). A beat's answers all write the SAME memory id: one credit per id, ever, whatever the choice (spec 1.2).
// Bonds B2a (R-20261122-46, R-20261122-47): beat 3, the confidence, a promise beat that opens at Familiar (`opens: 2`); its
// promise, "keep it, and do not leave your post", is checked as a win at the next battle's settle (check "win", ledger.js
// CHECKS). The lines for a kept, broken, owned and repaired promise, his two reasons to say no, Close, and the two types the
// spec allows him (Decision 2: friendship or mentorship).
// Bonds B2b (R-20261122-69, R-20261122-70): beat 5, the pact, a talk that opens at Close (the third memory) whose "Swear the
// pact" choice offers the pact (ledger.js offerPact); beat 6, the map, a promise beat that opens at Allied with its own promise
// lines (a clerk from Lanka, the feuding crew, wants the flood map; the check is a win at the next settle); the floor hints and
// his answers for Allied and Full Bond. The pact's halves (call, vouch) are stored for B4 and B6; no line here promises either.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatBondRoutes = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ROUTES = {
    jatayu: {
      name: "Jatayu",
      intro: { label: "Introduce yourself",
        line: "Jatayu. I keep the Archive. Your name is in the register now; what goes beside it is up to you." },
      beats: [
        { id: "missingMap", title: "The missing map", kind: "talk",
          prompt: "Two flood records for the lower ward disagree. One puts the old water at the third step of the court, the other at the seventh. Someone copied one of them badly.",
          choices: [
            { id: "accuse", label: "Accuse the copyist",
              line: "Quick to a name. The clerk you blame has been dead thirty years, and he copied what he was told. I will remember that you wanted someone to answer for it." },
            { id: "ask", label: "Ask him to check",
              line: "You asked the one who keeps it. We set both pages against the marks on the court steps; the seventh is the true one. I will remember that you trusted the Archive to correct itself." },
            { id: "letGo", label: "Let it go",
              line: "You let it rest. Most do. The water will not, when it comes again. I will remember that you left it with me." },
            { id: "look", label: "Look yourself",
              line: "You took the lamp and read both pages. The seventh step is the true one: the other copy skipped a line. I will remember that you went and looked." },
          ] },
        { id: "confidence", title: "The confidence", kind: "promise", opens: 2,
          prompt: "He sets a ledger on the table and keeps his hand on it. \"The lower ward drowned because the gate-keepers left their post the night the water came. Their names are here, and their families still live on that street. I should not be showing you this.\"",
          promise: { text: "Keep the confidence, and do not leave your post: win your next battle.", check: "win" },
          choices: [
            { id: "keep", label: "Promise to keep it", promise: true,
              line: "Then it stays between us. One thing more: the gate-keepers ran. Do not run. Win your next fight, and I will know the promise holds." },
            { id: "terms", label: "Set terms for telling", promise: true,
              line: "Only if the families ask. That is fair; it is more than the Archive ever gave them. Win your next fight, and I will know you hold to your terms." },
            { id: "decline", label: "Decline to promise",
              line: "Honest. I would rather have a no than a promise you cannot carry. The ledger goes back on the shelf; ask for it when you are ready." },
          ] },
        { id: "pact", title: "The pact", kind: "talk", opens: 3,
          prompt: "He closes the register and does not open another. \"I have written down what you did. I have not written down what we are. The old kings of my line swore at a river, and kept it. Say it, if you mean it.\"",
          choices: [
            { id: "swear", label: "Swear the pact", pact: true,
              line: "You say it plainly, and he listens to every word." },
            { id: "plain", label: "Say it without an oath",
              line: "Plain words. Those I trust more than most oaths. When you want it sworn, say so; the page will wait." },
          ] },
        { id: "map", title: "The map", kind: "promise", opens: 4,
          prompt: "A clerk from Lanka has come to the Archive door three days running, asking for the flood map of the lower ward. \"They want to know where the water goes, and so where it does not. I have told them no. I will be away from the Archive for a while; keep the map out of their hands until I am back.\"",
          promise: { text: "Keep the flood map from Lanka's clerk: win your next battle.", check: "win" },
          choices: [
            { id: "keep", label: "Keep the map", promise: true,
              line: "Then it is in your keeping. They will try again when they think I am gone. Win your next fight, and I will know the map stayed where it belongs." },
            { id: "decline", label: "Tell him you cannot",
              line: "Then I will stay and keep it myself. There is no harm in saying you cannot." },
          ],
          promiseLines: {
            kept: "The clerk went home with nothing. The map is in its drawer, and the register says who kept it there.",
            broken: "The fight went the wrong way, and the clerk had a long look at the drawer while it did. I am writing it down; it is not the end of anything.",
            owned: "You came and told me before the clerk could. That is the first half. Win the next fight, and the page can be corrected.",
            repaired: "Corrected. The map is back in its drawer, and the register keeps both lines.",
          } },
      ],
      battleTitle: "You fought beside him",
      floorHints: {
        2: "answer his question about the missing map",   // the beat is always open once met; fighting beside him is rare for a new player (he joins a random battle only once he is in account.foughtBeside), so it is not offered as the way
        3: "keep the promise he asks of you",
        4: "talk with him about what you are to each other, and swear the pact",   // beat 5 is the third memory (R-20261122-69)
        5: "keep the map out of the wrong hands when he asks",                     // beat 6's kept promise is the fourth (R-20261122-69)              // the confidence opens at Familiar and its kept promise is the second kind (R-20261122-47 1)
      },
      paceHint: "has given you his time this cycle",
      foughtBeside: "You stood on my side of a fight. The register has a line for that, and it is not a short one.",
      rankUp: { 2: "Familiar, then. Sit when you come in; the Archive has a second chair.",
        3: "Close. Few people sit in that chair long enough to be called that. Tell me what we are to each other, and I will write it down.",
        4: "Allied. It is in the register in ink now, not pencil.",
        5: "Full Bond. I have kept this Archive a long time, and I write that line in my own hand, not a clerk's." },
      promiseLines: {
        kept: "You held your post. The ledger stays shut, and your name in the register has a second line beside it.",
        broken: "The fight ended and you were not the one holding the field. The gate-keepers did not hold theirs either. I am not angry; I am writing it down.",   // a loss and a round-limit stop alike (ledger.js CHECKS.win)
        owned: "You came and said it yourself. That is the first half. The second is the next fight: win it, and the page can be corrected.",
        repaired: "Corrected, then. The register keeps both lines, the break and the mending. That is what it is for.",
      },
      pact: { beat: "pact", call: true, vouch: true, label: "Swear the pact",   // call: he has a combat character (classes-data.js jatayu); both halves wait on B4 and B6
        accepted: "Sworn. I have written it under both our names, in my own hand." },
      refuse: {
        broken: "Not while a broken promise stands between us. Own it, and mend it, and ask me again.",
        trust: "You sent me into a fall I did not need to take. I do not answer that for someone I cannot follow yet.",
      },
      typePrompt: "What are you to each other?",
      types: [
        { id: "friendship", label: "Friends", line: "Friends. The Archive has few of those; I will keep this one carefully." },
        { id: "mentorship", label: "His student", line: "A student, then. Read slowly, check the steps, and never trust a copy you have not set against the stone." },
      ],
    },
  };
  return { ROUTES };
});
