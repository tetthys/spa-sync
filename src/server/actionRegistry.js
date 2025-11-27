// src/server/actionRegistry.js

/**
 * Create a simple action registry from a plain object.
 *
 * - actionMap: { [actionName]: function(ctx) {} }
 * - Only functions are registered; everything else is ignored.
 */
function createActionRegistry(actionMap) {
  const registry = new Map();

  Object.keys(actionMap || {}).forEach((name) => {
    const fn = actionMap[name];
    if (typeof fn === "function") {
      registry.set(name, fn);
    }
  });

  return {
    /**
     * Look up an action handler by name.
     */
    get(name) {
      return registry.get(name);
    },
  };
}

module.exports = {
  createActionRegistry,
};
