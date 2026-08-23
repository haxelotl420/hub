const rules = require('../shared/rules');
function createTrisRuntime() { return { createState: rules.createInitialState, applyAction: rules.reduce, getResult: rules.result, getView: state => state }; }
module.exports = { createTrisRuntime };
