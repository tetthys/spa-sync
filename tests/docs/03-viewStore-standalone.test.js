// tests/docs/03-viewStore-standalone.test.js

// This file documents how the viewStore can be used standalone,
// without any sockets or server logic.

const { createViewStore } = require("../../src/server/viewStore");

describe("viewStore – standalone usage as an in-memory view state container", () => {
  test("set, get, patch can be used without sockets", () => {
    // Package users normally use viewStore through ctx.view(...),
    // but it can also be created and used on its own.

    const viewStore = createViewStore();

    // Set an initial snapshot
    viewStore.set("profile", { name: "Alice", age: 30 });
    expect(viewStore.get("profile")).toEqual({ name: "Alice", age: 30 });

    // Patch merges fields into the previous state
    viewStore.patch("profile", { age: 31 });
    expect(viewStore.get("profile")).toEqual({ name: "Alice", age: 31 });

    // A different viewKey is independent
    viewStore.set("dashboard", { widgets: ["chart", "table"] });
    expect(viewStore.get("dashboard")).toEqual({ widgets: ["chart", "table"] });
  });
});
