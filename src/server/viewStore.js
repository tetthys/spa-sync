// src/server/viewStore.js
// Very small payload store for each viewKey.

/**
 * Stores only payload for each view.
 * No legacy state merging or "patch" logic.
 */
function createViewStore() {
  const store = new Map();

  return {
    set(viewKey, payload) {
      store.set(viewKey, payload || {});
    },

    get(viewKey) {
      return store.get(viewKey) || {};
    },
  };
}

module.exports = { createViewStore };
