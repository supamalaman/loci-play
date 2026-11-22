"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatCrimes = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const crimes = Object.freeze({
    statuteBreach: 1, testimony: 1, warrant: 1, contempt: 1, civilianCollateral: 1,
    civilianAttack: 2, civilianKilling: 4, resistedJudgment: 2, desecration: 2, conviction: null,
  });
  return { crimes };
});
