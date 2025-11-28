// src/server/actionRegistry.js
// Minimal registry for action handlers.

function createActionRegistry(map = {}) {
  const registry = new Map();

  Object.entries(map).forEach(([name, fn]) => {
    if (typeof fn === "function") registry.set(name, fn);
  });

  return {
    get(name) {
      return registry.get(name);
    },
  };
}

module.exports = { createActionRegistry };
