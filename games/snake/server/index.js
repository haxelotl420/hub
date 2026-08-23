const rules = require('../shared/rules');
function createSnakeRuntime() { return { createState: rules.initialState, applyAction: rules.reduce, getResult: rules.result, getView: rules.getView }; }
module.exports = { createSnakeRuntime };
