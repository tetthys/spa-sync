// src/server/viewStore.js

function createViewStore() {
  // viewKey -> last state (optional, used for debugging or replay)
  const store = new Map();

  function set(viewKey, state) {
    // Save snapshot for debugging
    store.set(viewKey, state);
  }

  function get(viewKey) {
    return store.get(viewKey);
  }

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
