const rules = require('../shared/rules');
function createWordleCompetitiveRuntime() { return { createState: (players, settings) => rules.createInitialState(players, { ...settings, variant: 'competitive' }), applyAction: rules.reduce, getResult: rules.result, getView: rules.getView }; }
module.exports = { createWordleCompetitiveRuntime };
