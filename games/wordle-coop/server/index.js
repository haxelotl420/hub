const rules = require('../shared/rules');
function createWordleCoopRuntime() { return { createState: (players, settings) => rules.createInitialState(players, { ...settings, variant: 'coop' }), applyAction: rules.reduce, getResult: rules.result, getView: rules.getView }; }
module.exports = { createWordleCoopRuntime };
