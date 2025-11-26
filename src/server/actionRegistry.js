// src/server/actionRegistry.js

function createActionRegistry(actionMap) {
  // actionMap: { [name]: function(ctx) {} }
  const registry = new Map();

  Object.keys(actionMap).forEach((name) => {
    const fn = actionMap[name];
    if (typeof fn === "function") {
      registry.set(name, fn);
    }
  });

  return {
    get(name) {
      return registry.get(name);
    },
  };
}

module.exports = {
  createActionRegistry,
};
