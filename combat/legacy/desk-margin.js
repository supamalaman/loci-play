"use strict";
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ConceptCombatDeskMargin=factory();})(typeof self!=='undefined'?self:this,function(){
 // The scribing desk's constants, in one table (specs/SCRIBING_DESK.md sections 3 to 6; slices in specs/SLICES.md, A0).
 // tariff.defStamp is the value written to a new def's `tariff` field (the spec's TARIFF); a def with none counts as 1. The Dedicated AP floor lives in notes.dedicated.minAp only.
 // Provisional numbers: a sim result changes this table, not code. Read today: the tariff (F, C) and defStamp by workshop.js (A3, A5) and Transcribe by legacy-battle.js (B1b); deskSlots (B2a) and floorOf (C0a3) have only tests as callers until B2c/B2d and C0a4/C0a5 (loop:1a199c41b25-1ab5).
 const table=Object.freeze({
  tariff:Object.freeze({F:1,C:1.15,defStamp:2,surcharge:Object.freeze({beast:1,construct:1,concentrating:1,water:1,large:2})}),
  floors:Object.freeze({minPhi:3,grossShare:0.6,control:4}),
  margin:Object.freeze({slots:3,marginaliaSlots:1}),
  desk:Object.freeze({fameAt:3,favorAt:4}),   // the desk shelf: one slot, +1 at Fame 3, +1 at favor 4 (SCRIBING_DESK.md, B2)
  notes:Object.freeze({
   ink:Object.freeze({seeds:Object.freeze([60,90,150]),potency:1,ward:1,maxPotency:19,max:3}),
   tempered:Object.freeze({orgonite:2,seeds:36,phi:1,max:2}),
   dedicated:Object.freeze({ap:4,minAp:15,minCare:10}),
   lensed:Object.freeze({seedsWaived:100})
  }),
  transcribe:Object.freeze({seeds:40,perComponent:20}),
  amend:Object.freeze({seeds:30,perComponent:10}),
  lien:Object.freeze({cap:100,rate:1.25})
 });
 // The desk shelf: how many scribed works can sit on it. Fame is the account's level (account/fame.js); favor is the legacy ledger's (legacy.ledger.favor).
 const deskSlots=(account)=>1+(((account&&account.fame)||0)>=table.desk.fameAt?1:0)+(((account&&account.legacy&&account.legacy.ledger&&account.legacy.ledger.favor)||0)>=table.desk.favorAt?1:0);
 // The price floor a margin may not take a work below (scribing desk C0a3): 60 percent of the work's gross phi, at least 3, and 4 for a control work (root, item lock, stagger or push).
 const floorOf=(gross,hasControl)=>{const f=table.floors,share=Math.max(f.minPhi,Math.ceil(f.grossShare*(Number(gross)||0)));return hasControl?Math.max(share,f.control):share;};
 return Object.freeze({table,deskSlots,floorOf});
});
