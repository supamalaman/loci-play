"use strict";
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ConceptCombatDeskMargin=factory();})(typeof self!=='undefined'?self:this,function(){
 // The scribing desk's constants, in one table (specs/SCRIBING_DESK.md sections 3 to 6; slices in specs/SLICES.md, A0).
 // tariff.defStamp is the value written to a new def's `tariff` field (the spec's TARIFF); a def with none counts as 1. The Dedicated AP floor lives in notes.dedicated.minAp only.
 // Provisional numbers: a sim result changes this table, not code. Nothing reads it yet: A3 wires F and C into workshop.js (loop:1a199c41b25-1ab5).
 const table=Object.freeze({
  tariff:Object.freeze({F:1,C:1.15,defStamp:2,surcharge:Object.freeze({beast:1,construct:1,concentrating:1,water:1,large:2})}),
  floors:Object.freeze({minPhi:3,grossShare:0.6,control:4}),
  margin:Object.freeze({slots:3,marginaliaSlots:1}),
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
 return Object.freeze({table});
});
