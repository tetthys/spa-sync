// src/server/viewStore.js

/**
 * In-memory store for view states.
 *
 * It keeps the last known state per viewKey so that:
 * - Full snapshots can be inspected later for debugging.
 * - Partial patches can be merged into the previous state.
 */
function createViewStore() {
  // viewKey -> last state
  const store = new Map();

  /**
   * Replace the entire state of a view.
   */
  function set(viewKey, state) {
    store.set(viewKey, state);
  }

  /**
   * Get the last known state of a view.
   */
  function get(viewKey) {
    return store.get(viewKey);
  }

  /**
   * Merge a partial state into the last known state.
   * If there is no previous state, an empty object is assumed.
   */
  function patch(viewKey, partial) {
    const prev = store.get(viewKey) || {};
    const next = Object.assign({}, prev, partial);
    store.set(viewKey, next);
  }

  return {
    set,
    get,
    patch,
  };
}

module.exports = {
  createViewStore,
};
