"use strict";
// Parley voices: the socket for characters who argue in their own words (Mala, 2026-11-04: "the Ramayana cast
// should all talk in character"). Plain data, flavour only, keyed by speaker id (the same ids as speakers.js).
// insight/mind-talk.js reads an entry when one speaker side has it; a voiced character speaks ONLY these lines
// for any key it supplies (a story voice never borrows the shared wording), and falls back to the shared
// wording per key for any key it leaves out. Speakers with no entry here are untouched.
//
// Shape (every key optional, each a list of strings; tokens: {n} you, {o} the other person, {t} a topic clause
// the matrix gives only for a trait you have READ):
//   open:   { debate, empathize, insult, concede }   what you say when you make that move, no topic read
//   topic:  { debate, empathize, insult }            same, with a read topic; must contain {t}
//   win lose clash shrug backfire steady yield listen bothYield   your reaction, first person:
//     win (you took the exchange) lose (you lost it) clash (talked over each other) shrug (the argument aimed
//     at YOU was turned aside by your own nature: spoken by the defender, only when its cause was read) backfire (your scorn rebounded) steady (your kindness steadied you) yield (you gave ground)
//     listen (they gave ground to you) bothYield
//   end:    { won, lost, tie }                       closing lines when the argument ends
// Rule: no digits, no battle state, no trait names. A test pins every entry.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatParleyVoices = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const voices = {
    // The Ramayana cast. Each voice follows that character's `voice:` note in speakers.js (and the Voice section of their *-build.md where one exists: Rama, Sita, Ravana, Hanuman), in our own words.
    rama: {
      open: { debate: ["Hear it as dharma weighs it, {o}.", "A word given is a debt. Let us reckon this one."], empathize: ["I do not come to you in anger, {o}.", "Say what grieves you. I will hear it."], insult: ["You mistake my patience for weakness.", "An exile still remembers what is owed."], concede: ["Speak, {o}. I will not interrupt.", "I have wandered long. I can listen."] },
      topic: { debate: ["Weigh this by dharma: {t}.", "Consider the law of it: {t}."], empathize: ["I know it well, {o}: {t}.", "Let me speak to your heart: {t}."], insult: ["Your own conduct answers you: {t}.", "I spare you nothing, {o}: {t}."] },
      win: ["Dharma is not a matter of opinion.", "The matter is settled."], lose: ["I will bear that, and answer it later.", "You press well, {o}. I am not moved."], clash: ["We are both certain. That settles nothing."], shrug: ["A fair blow. It does not reach what I keep."], backfire: ["That was not worthy of me."], steady: ["Calm returns. It always does."], yield: ["Very well. Say all of it."], listen: ["You have honored me by stopping."], bothYield: ["Two who keep their word may rest a moment."],
      end: { won: ["It is finished, {o}. Go in peace.", "I take no pride in this."], lost: ["I yield the point, not the vow.", "Your argument stands. My word stands also."], tie: ["Neither of us will bend. So be it."] },
    },
    sita: {
      open: { debate: ["I speak plainly, {o}: you are mistaken.", "Truth does not tire, {o}."], empathize: ["You are afraid, {o}. I see it.", "There is no need for cruelty between us."], insult: ["You are smaller than you believe.", "Shame on you, {o}. Look at what you do."], concede: ["I will hear you. It changes nothing I know.", "Go on, {o}."] },
      topic: { debate: ["Look at it clearly: {t}.", "I will say it gently and truly: {t}."], empathize: ["I see you, {o}: {t}.", "It is not too late, {o}: {t}."], insult: ["You know it is so: {t}.", "Say it to my face, {o}: {t}."] },
      win: ["Faith is not argued away.", "You cannot move what is already certain."], lose: ["That hurt. It did not change me.", "Say what you like. I know whom I wait for."], clash: ["We say our words past each other."], shrug: ["It passes over me like wind over water."], backfire: ["I did not mean that to sound so sharp."], steady: ["I breathe. He is coming."], yield: ["Speak. I am listening, though I am not moved."], listen: ["Thank you for hearing me."], bothYield: ["Let us both be still a moment."],
      end: { won: ["You may go. I forgive what I can.", "Rest, {o}. The truth will wait."], lost: ["You have the words. I have my faith.", "I yield nothing that matters."], tie: ["We part where we began."] },
    },
    lakshmana: {
      open: { debate: ["Listen to me, {o}, and do not interrupt.", "My brother's honor is not up for trade."], empathize: ["Easy, {o}. I do not want to fight you.", "I can see you are hurting."], insult: ["You are a coward and you know it.", "Say that again and see what happens."], concede: ["Fine. Talk. I am listening, barely.", "Say your piece, {o}."] },
      topic: { debate: ["Hear this, {o}: {t}.", "I will say it once: {t}."], empathize: ["I understand it, {o}: {t}.", "Believe me, I do: {t}."], insult: ["You are a disgrace: {t}.", "Look at yourself: {t}."] },
      win: ["Good. Remember that.", "Now you know where I stand."], lose: ["That landed. I will not forget it.", "Hmph. Not bad, {o}."], clash: ["Neither of us will give way. Typical."], shrug: ["Nice try. It means nothing to me."], backfire: ["Too hot. I spoke before I thought."], steady: ["Breathe. My brother would say the same."], yield: ["I will hear you, only because he would want me to."], listen: ["Good. That took courage."], bothYield: ["Enough. We are both tired."],
      end: { won: ["Do not make me do that again.", "Go. And think of my brother's name."], lost: ["You have won this. I will answer for it.", "Rama would have found better words. I am sorry."], tie: ["We are done. Neither of us enjoyed it."] },
    },
    hanuman: {
      open: { debate: ["I serve Rama, {o}, and I will say it plainly.", "Let me tell you what I have seen."], empathize: ["I mean you no harm, {o}.", "I am only a messenger. Let me carry your words."], insult: ["You talk big for someone so small.", "Come closer, {o}. I do not bite my words."], concede: ["I am a servant. I will listen.", "Speak, {o}. I am in no hurry."] },
      topic: { debate: ["Rama would say it this way: {t}.", "I have crossed an ocean and learned this: {t}."], empathize: ["I know this ache, {o}: {t}.", "Let me carry that for you: {t}."], insult: ["I have burned cities, {o}: {t}.", "Even a monkey sees it: {t}."] },
      win: ["Rama's name carries further than my voice.", "That is what I came to say."], lose: ["I am only a messenger. I will bring that back.", "Well argued. I still know what I know."], clash: ["We shout past each other. Rama would sigh."], shrug: ["I have leapt over harder things."], backfire: ["That was beneath a servant of Rama."], steady: ["His name steadies me."], yield: ["I will listen first, and answer after."], listen: ["Rama's way is to listen too."], bothYield: ["Two listeners, and nothing to fear."],
      end: { won: ["I am glad it was words, {o}.", "Go well. Rama sends peace."], lost: ["You won the day. Rama still wins the war.", "Do not mistake my quiet for surrender."], tie: ["No one wins. I will carry the matter home."] },
    },
    ravana: {
      open: { debate: ["We shall explain it to you slowly, {o}.", "A king reasons. You would do well to listen."], empathize: ["Even a king can be gracious, {o}.", "Come. Sit. We are not unreasonable."], insult: ["You are dust beneath our gate.", "We have not been refused in an age, and we will not begin with you."], concede: ["We allow you to speak.", "Very well. Amuse us."] },
      topic: { debate: ["Learn something, {o}: {t}.", "We know the shastras better than you: {t}."], empathize: ["Even we feel it, {o}: {t}.", "We say this to few: {t}."], insult: ["Pitiful: {t}.", "Hear what you are, {o}: {t}."] },
      win: ["Of course. We have never lost an argument that mattered.", "You see? There is no answer."], lose: ["Hmph. A fluke.", "You will regret that insolence, {o}."], clash: ["Two voices, and ours is louder."], shrug: ["Insects hum. We do not listen."], backfire: ["Our own scorn rings hollow. That will not happen twice."], steady: ["We compose ourselves. We are a king."], yield: ["We permit you the floor. Briefly."], listen: ["Good. Learn to listen to your king."], bothYield: ["A truce. Not a surrender."],
      end: { won: ["Bow, or go, {o}. We care little which.", "Remember who spoke last."], lost: ["We are not beaten. We are resting.", "Take your victory. It will not last."], tie: ["We refuse to be bargained with."] },
    },
    mandodari: {
      open: { debate: ["I say this knowing no one will listen.", "Hear me once, {o}, and then decide."], empathize: ["I am sorry for your trouble, {o}.", "I do not want anyone else to suffer."], insult: ["You see only what pleases you, {o}.", "Your pride will cost more than you know."], concede: ["I will listen. I have listened to worse.", "Speak, {o}. Perhaps I am wrong."] },
      topic: { debate: ["I have seen how this ends: {t}.", "Think carefully, {o}: {t}."], empathize: ["I understand, {o}: {t}.", "I would spare you this: {t}."], insult: ["It is not pride that speaks, it is blindness: {t}.", "You will not like to hear it: {t}."] },
      win: ["I take no joy in being right.", "I told you how it would go."], lose: ["Perhaps you are right. I hope so.", "You are not wrong to say it."], clash: ["We both speak. Neither listens."], shrug: ["I have heard that before, and still I stay."], backfire: ["I did not mean to be cruel."], steady: ["A quiet breath. Sorrow steadies me."], yield: ["I will hear all of it."], listen: ["Thank you for hearing it."], bothYield: ["Two weary hearts may rest."],
      end: { won: ["I wish it had not come to this, {o}.", "Go. And take care of yourself."], lost: ["You are right to answer so. I am sorry.", "I have said what I came to say."], tie: ["We part unconvinced. It is a sad thing."] },
    },
    indrajit: {
      open: { debate: ["Let me lay it out precisely, {o}.", "You are mistaken, and I can show you why."], empathize: ["Disappointing that we must argue, {o}.", "I could be gracious. If you earn it."], insult: ["You are not even a challenge.", "How tedious you are, {o}."], concede: ["Continue. I am taking notes.", "Go on, {o}. I can wait."] },
      topic: { debate: ["Consider the obvious flaw: {t}.", "Your position fails here: {t}."], empathize: ["I will be generous, once: {t}.", "Let me spare you the embarrassment: {t}."], insult: ["You are transparent: {t}.", "Pathetic, really: {t}."] },
      win: ["Predictable.", "As calculated."], lose: ["Unexpected. I will adjust.", "You surprise me, {o}. Do not make a habit of it."], clash: ["Equal footing. That will not last."], shrug: ["You will have to try harder."], backfire: ["That was unworthy of me. Noted."], steady: ["Composure restored."], yield: ["I will indulge you for a moment."], listen: ["Good. You are learning."], bothYield: ["A pause. Do not mistake it for friendship."],
      end: { won: ["I could have done it faster.", "Learn from this, {o}."], lost: ["Enjoy it. It is rare.", "You have won an argument. I will win the war."], tie: ["No result. Unacceptable."] },
    },
    kumbhakarna: {
      open: { debate: ["Hear me out, {o}. I am a plain man.", "I will say it straight, {o}."], empathize: ["Sit, {o}. No need to be afraid.", "I do not like fighting, {o}."], insult: ["You talk too much, {o}.", "Small words from a small mind."], concede: ["Go on. I am awake. Mostly.", "Say it, {o}. I will listen."] },
      topic: { debate: ["It is simple, {o}: {t}.", "I will not dress it up: {t}."], empathize: ["I know how it is, {o}: {t}.", "Come now: {t}."], insult: ["Say that again: {t}.", "I am blunt, {o}: {t}."] },
      win: ["There. Plain as that.", "Hmph. Settled."], lose: ["Fair. I have no clever answer.", "You are sharper than I thought, {o}."], clash: ["We both shout. Nothing gets said."], shrug: ["Too slow. I barely noticed."], backfire: ["That was not kind. Sorry."], steady: ["I feel better. A deep breath helps."], yield: ["Fine. I am listening."], listen: ["Thank you. That was frank."], bothYield: ["We are both too tired for this."],
      end: { won: ["I did not want that, {o}. Go home.", "I tell my brother when he is wrong. He does not listen."], lost: ["You are right. I will fight anyway, for him.", "I lose the argument. I keep my word."], tie: ["Enough. I want to sleep."] },
    },
    surpanakha: {
      open: { debate: ["Listen, {o}, and listen well.", "I have a few things to say, {o}."], empathize: ["Oh, {o}. Can you not see how I suffer?", "Be kind to me, {o}. You are so fine."], insult: ["How dare you look at me like that?", "You will pay for that look, {o}."], concede: ["Fine. Say what you must.", "Speak, then. I am listening, sweetly."] },
      topic: { debate: ["I will tell you this much: {t}.", "You do not see it, but: {t}."], empathize: ["You, of all people: {t}.", "Look at me, {o}: {t}."], insult: ["Ugly, truly: {t}.", "I will remember this, {o}: {t}."] },
      win: ["You see? I am never wrong.", "Remember who got the last word."], lose: ["You will answer for that.", "Cruel. You are cruel, {o}."], clash: ["Neither of us will stop talking."], shrug: ["Say what you like, {o}. I have heard it all."], backfire: ["Even my own words cut me."], steady: ["There. I feel prettier already."], yield: ["I will listen. Do not mistake it for forgiveness."], listen: ["How sweet that you listen."], bothYield: ["A truce, then. A short one."],
      end: { won: ["I will tell my brother how you spoke.", "You will remember me."], lost: ["You have not seen the last of me.", "Every slight is a debt, {o}."], tie: ["Neither wins. I do not forgive that."] },
    },
    jatayu: {
      open: { debate: ["I am old, {o}, and I know a wrong when I see one.", "Hear an old king, {o}."], empathize: ["Peace, child. There is no need for this.", "I mean no harm to you, {o}."], insult: ["Shame on you, {o}. I have seen worse men fall.", "You are no warrior."], concede: ["I am old. I will listen.", "Speak, {o}. My ears are still good."] },
      topic: { debate: ["Hear what an old bird knows: {t}.", "I was a king once: {t}."], empathize: ["I know it, child: {t}.", "Let an elder tell you: {t}."], insult: ["I will not spare you: {t}.", "You know it is true: {t}."] },
      win: ["An old king still has the words.", "That is the end of it, {o}."], lose: ["I am old and slow, and still I am not wrong.", "You are quick, {o}. I will remember."], clash: ["Two hard voices. It is how birds argue."], shrug: ["I have heard worse in my long life."], backfire: ["I forgot myself. Forgive an old man."], steady: ["The wind steadies me."], yield: ["I will hear you out, though I do not change."], listen: ["That was well done."], bothYield: ["Two old voices, tired of fighting."],
      end: { won: ["Go, {o}, and do better.", "I fought for what is right. That is all."], lost: ["I lose the argument. I do not lose my duty.", "You have won. I will still fly."], tie: ["Even. So be it."] },
    },
    // The masks pair (speakers.js: super_hero takes the hit meant for someone else; super_villain owns the input everything runs through).
    super_hero: {
      open: { debate: ["Let me stand between you and this argument, {o}.", "Say it to me, not to them."], empathize: ["Hey. Easy, {o}. Nobody has to get hurt.", "I am not your enemy, {o}."], insult: ["You pick on people who cannot hit back.", "Go on, {o}. I can take it."], concede: ["Fine. Talk. I am not going anywhere.", "I will listen, {o}. Then we will see."] },
      topic: { debate: ["Here is the thing, {o}: {t}.", "Someone has to say it: {t}."], empathize: ["I get it, {o}: {t}.", "Lean on me a moment: {t}."], insult: ["You hide behind others: {t}.", "Look at yourself, {o}: {t}."] },
      win: ["That is what we stand for.", "No one standing behind me is getting hurt."], lose: ["I have borne heavier loads than that.", "Good hit, {o}. I am still standing."], clash: ["Neither of us is moving."], shrug: ["Nice try. I have taken worse for strangers."], backfire: ["That was cheap. I should not have said it."], steady: ["Deep breath. Back on my feet."], yield: ["Go ahead. I will take it."], listen: ["Thank you for hearing me out."], bothYield: ["Good. Let us both stand down."],
      end: { won: ["Go home, {o}. Nobody else needs to be hurt.", "It is over. Let us leave it here."], lost: ["You win this one. Somebody else carries on.", "I will not be the reason they get hurt."], tie: ["Draw. We keep standing."] },
    },
    super_villain: {
      open: { debate: ["Whatever you lean on passes through my hands, {o}.", "Let me show you what you are really defending."], empathize: ["Come now, {o}. We can be reasonable.", "I have no quarrel with you. Yet."], insult: ["How quaint, {o}.", "You do not even know what you hold."], concede: ["Go on. I enjoy a proposal.", "Speak, {o}. Everyone does, eventually."] },
      topic: { debate: ["You overlooked something, {o}: {t}.", "Follow the thread to its source: {t}."], empathize: ["Even I see it, {o}: {t}.", "Let us be civilized: {t}."], insult: ["How predictable: {t}.", "Pitiful, {o}: {t}."] },
      win: ["Inconvenient for you. Not for me.", "You see where the choke point is."], lose: ["A setback. Nothing more.", "A flaw in the plan. I will find the next one."], clash: ["A stalemate is only a pause."], shrug: ["That will not reach me, {o}."], backfire: ["I gave away more than I meant to."], steady: ["Composure. It is the cheapest weapon."], yield: ["I will hear your terms. Briefly."], listen: ["Good. Now you are negotiating."], bothYield: ["A truce. Everything has a price."],
      end: { won: ["You found out what I hold, {o}. Now you know the price.", "Run along. Everything will still need me."], lost: ["You found where it all begins. Well done.", "Take your win. I still hold the rest."], tie: ["No result. I will find a lever."] },
    },
  };
  return { voices };
});
