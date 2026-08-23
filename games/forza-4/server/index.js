const rules = require('../shared/rules');

function createForza4Runtime() {
  return {
    createState: rules.createInitialState,
    applyAction: (state, action) => rules.reduce(state, action),
    getResult: rules.result,
    getView: state => state
  };
}

module.exports = { createForza4Runtime };
