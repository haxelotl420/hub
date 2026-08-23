const rules = require('../shared/rules');
function createBingoRuntime() { return { createState: rules.createInitialState, applyAction: rules.reduce, getResult: rules.result, getView: rules.getView }; }
module.exports = { createBingoRuntime };
