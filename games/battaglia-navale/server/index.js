const rules = require('../shared/rules');
function createBattleshipRuntime() { return { createState: rules.createInitialState, applyAction: rules.reduce, getResult: rules.result, getView: rules.getView }; }
module.exports = { createBattleshipRuntime };
