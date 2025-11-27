// tests/docs/01-minimal-usage.test.js

// This file documents the minimal usage of the SpaSync server
// from a package user's perspective.

const { createSpaSyncServer } = require("../../src/server/createSpaSyncServer");
const { makeActionPacket } = require("../../src/protocol/packets");
const { createViewStore } = require("../../src/server/viewStore");

// ---------------------------------------------------------------------------
// Simple fake socket implementation for docs/tests
// ---------------------------------------------------------------------------
function createFakeSocket(id = "socket-1") {
  const handlers = {};
  const emitted = [];

  return {
    id,
    emitted,
    handlers,

    on(event, fn) {
      handlers[event] = fn;
    },

    emit(event, payload) {
      emitted.push({ event, payload });
    },

    trigger(event, payload) {
      if (handlers[event]) {
        handlers[event](payload);
      }
    },

    disconnect: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// 1. Minimal setup: only actions + registerClient
// ---------------------------------------------------------------------------
describe("SpaSync – minimal usage (actions + registerClient)", () => {
  test("minimal setup: user passes only actions map", async () => {
    // From the package user's perspective, the minimal configuration is:
    //
    //   const spa = createSpaSyncServer({
    //     actions: {
    //       "counter.increment": async (ctx) => {
    //         const current = ctx.payload.current || 0;
    //         ctx.view("counter").set({ value: current + 1 });
    //       },
    //     },
    //   });
    //
    //   io.on("connection", (socket) => {
    //     spa.registerClient(socket);
    //   });
    //
    // No need to deal with viewStore, clients map, broadcast logic, or errors.

    const spa = createSpaSyncServer({
      actions: {
        "counter.increment": async (ctx) => {
          const current = ctx.payload.current || 0;
          ctx.view("counter").set({ value: current + 1 });
        },
      },
    });

    const socket = createFakeSocket("socket-minimal");
    await spa.registerClient(socket);

    const packet = makeActionPacket("counter.increment", { current: 10 });
    socket.trigger("message", packet);

    const messages = socket.emitted.filter((e) => e.event === "message");
    expect(messages).toHaveLength(1);

    const viewPacket = messages[0].payload;
    expect(viewPacket.type).toBe("view");
    expect(viewPacket.kind).toBe("set");
    expect(viewPacket.view).toBe("counter");
    expect(viewPacket.state).toEqual({ value: 11 });

    // Internals such as viewStore are managed inside the library,
    // but exposed for debugging and testing:
    expect(spa.viewStore.get("counter")).toEqual({ value: 11 });
  });
});

// ---------------------------------------------------------------------------
// 2. requestId: optional correlation metadata
// ---------------------------------------------------------------------------
describe("SpaSync – requestId as optional meta info", () => {
  test("unknown action: requestId is optional in error meta", async () => {
    const spa = createSpaSyncServer({
      actions: {
        "known.action": async () => {},
      },
    });

    const socket = createFakeSocket("socket-unknown");
    await spa.registerClient(socket);

    // We omit meta.requestId on purpose (it is optional).
    const packet = makeActionPacket("unknown.action", { foo: 1 });
    socket.trigger("message", packet);

    const messages = socket.emitted.filter((e) => e.event === "message");
    expect(messages).toHaveLength(1);

    const errorPacket = messages[0].payload;
    expect(errorPacket.type).toBe("error");
    expect(errorPacket.name).toBe("UnknownAction");
    expect(errorPacket.message).toContain("Unknown action");
    expect(errorPacket.meta.action).toBe("unknown.action");
    // errorPacket.meta.requestId is undefined because we did not send it.
    expect(errorPacket.meta.requestId).toBeUndefined();
  });

  test("view meta: requestId is forwarded only when provided", async () => {
    const spa = createSpaSyncServer({
      actions: {
        withId: async (ctx) => {
          ctx.view("example").set({ value: 1 });
        },
        withoutId: async (ctx) => {
          ctx.view("example").set({ value: 2 });
        },
      },
    });

    const socket = createFakeSocket("socket-meta");
    await spa.registerClient(socket);

    const withId = makeActionPacket("withId", {}, { requestId: "req-1" });
    const withoutId = makeActionPacket("withoutId", {});

    socket.trigger("message", withId);
    socket.trigger("message", withoutId);

    const messages = socket.emitted.filter((e) => e.event === "message");
    expect(messages).toHaveLength(2);

    const first = messages[0].payload;
    const second = messages[1].payload;

    expect(first.meta).toEqual({ requestId: "req-1" });
    expect(second.meta).toEqual({ requestId: undefined });

    expect(first.state).toEqual({ value: 1 });
    expect(second.state).toEqual({ value: 2 });
  });
});

// ---------------------------------------------------------------------------
// 3. view().patch and viewStore merge behavior
// ---------------------------------------------------------------------------
describe("SpaSync – view().patch + viewStore merge", () => {
  test("patch sends partial patch and merges with existing state", async () => {
    const spa = createSpaSyncServer({
      actions: {
        "counter.patch": async (ctx) => {
          ctx.view("counter").patch({
            value: ctx.payload.value,
          });
        },
      },
    });

    const socket = createFakeSocket("socket-patch");
    await spa.registerClient(socket);

    // Prepare initial state directly for testing
    spa.viewStore.set("counter", { value: 1, step: 1 });

    const packet = makeActionPacket(
      "counter.patch",
      { value: 2 },
      { requestId: "req-merge" }
    );
    socket.trigger("message", packet);

    const messages = socket.emitted.filter((e) => e.event === "message");
    expect(messages).toHaveLength(1);

    const patchPacket = messages[0].payload;
    expect(patchPacket.type).toBe("view");
    expect(patchPacket.kind).toBe("patch");
    expect(patchPacket.view).toBe("counter");
    expect(patchPacket.patch).toEqual({ value: 2 });
    expect(patchPacket.meta).toEqual({ requestId: "req-merge" });

    // viewStore merges prev + partial
    expect(spa.viewStore.get("counter")).toEqual({ value: 2, step: 1 });
  });
});

// ---------------------------------------------------------------------------
// 4. onAuthorize is optional
// ---------------------------------------------------------------------------
describe("SpaSync – onAuthorize is optional", () => {
  test("when onAuthorize is omitted, ctx.user is null", async () => {
    const seenUsers = [];

    const spa = createSpaSyncServer({
      actions: {
        whoami: async (ctx) => {
          seenUsers.push(ctx.user);
          ctx.emit({
            type: "system",
            kind: "whoami",
            payload: { user: ctx.user },
          });
        },
      },
      // onAuthorize is intentionally omitted here.
    });

    const socket = createFakeSocket("socket-no-auth");
    await spa.registerClient(socket);

    const packet = makeActionPacket("whoami", {});
    socket.trigger("message", packet);

    const messages = socket.emitted.filter((e) => e.event === "message");
    expect(messages).toHaveLength(1);

    const systemPacket = messages[0].payload;
    expect(systemPacket.type).toBe("system");
    expect(systemPacket.kind).toBe("whoami");
    expect(systemPacket.payload.user).toBeNull();

    expect(seenUsers).toEqual([null]);
  });
});
