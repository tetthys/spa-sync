// tests/docs/03-viewStore-standalone.test.js
// Doc-style test: using createViewStore standalone.

const { createViewStore } = require("../..");

describe("03 – viewStore standalone usage", () => {
  it("stores and retrieves payload for each view key", () => {
    const store = createViewStore();

    // Initially, get() returns an empty object for unknown keys.
    expect(store.get("counter")).toEqual({});

    // After set(), get() returns the stored payload.
    store.set("counter", { value: 1 });
    expect(store.get("counter")).toEqual({ value: 1 });

    // Overwriting with another set() replaces the payload.
    store.set("counter", { value: 5 });
    expect(store.get("counter")).toEqual({ value: 5 });

    // Another view key does not interfere.
    store.set("profile", { name: "Alice" });
    expect(store.get("profile")).toEqual({ name: "Alice" });
    expect(store.get("counter")).toEqual({ value: 5 });
  });
});
