// tests/docs/02-auth-and-broadcasting.test.js

// This file documents how optional hooks (onAuthorize, onError)
// and broadcasting helpers work together.

const { createSpaSyncServer } = require("../../src/server/createSpaSyncServer");
const { makeActionPacket } = require("../../src/protocol/packets");

// ---------------------------------------------------------------------------
// Simple fake socket for docs/tests
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
// 1. onAuthorize: optional way to populate ctx.user
// ---------------------------------------------------------------------------
describe("SpaSync – onAuthorize to populate ctx.user", () => {
  test("when onAuthorize is provided, ctx.user is filled with custom user object", async () => {
    const spa = createSpaSyncServer({
      actions: {
        whoami: async (ctx) => {
          ctx.emit({
            type: "system",
            kind: "whoami",
            payload: { user: ctx.user },
          });
        },
      },

      onAuthorize: async (socket) => {
        // Package user can attach any structure here.
        return { id: `user-of-${socket.id}`, role: "member" };
      },
    });

    const socket = createFakeSocket("socket-auth");
    await spa.registerClient(socket);

    const packet = makeActionPacket("whoami", {});
    socket.trigger("message", packet);

    const messages = socket.emitted.filter((e) => e.event === "message");
    expect(messages).toHaveLength(1);

    const systemPacket = messages[0].payload;
    expect(systemPacket.type).toBe("system");
    expect(systemPacket.kind).toBe("whoami");
    expect(systemPacket.payload.user).toEqual({
      id: "user-of-socket-auth",
      role: "member",
    });
  });
});

// ---------------------------------------------------------------------------
// 2. onError: optional error logging hook
// ---------------------------------------------------------------------------
describe("SpaSync – onError as an optional error logger", () => {
  test("errors thrown inside actions are caught and passed to onError", async () => {
    const logs = [];

    const spa = createSpaSyncServer({
      actions: {
        "broken.action": async () => {
          throw new Error("Broken in action");
        },
      },

      onError: (err, ctx) => {
        logs.push({
          message: err.message,
          meta: ctx ? ctx.meta : null,
        });
      },
    });

    const socket = createFakeSocket("socket-error");
    await spa.registerClient(socket);

    const packet = makeActionPacket(
      "broken.action",
      {},
      { requestId: "req-err" }
    );
    socket.trigger("message", packet);

    // Client receives an error packet.
    const messages = socket.emitted.filter((e) => e.event === "message");
    expect(messages).toHaveLength(1);

    const errorPacket = messages[0].payload;
    expect(errorPacket.type).toBe("error");
    expect(errorPacket.message).toContain("Broken in action");
    expect(errorPacket.meta.requestId).toBe("req-err");

    // onError was called once with err + ctx.meta.
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe("Broken in action");
    expect(logs[0].meta).toEqual({ requestId: "req-err" });
  });
});

// ---------------------------------------------------------------------------
// 3. Broadcasting helpers: emit, broadcastToOthers, broadcastToAll, broadcastTo
// ---------------------------------------------------------------------------
describe("SpaSync – broadcasting helpers for different broadcast strategies", () => {
  test("chat.send uses emit + broadcastToOthers", async () => {
    const spa = createSpaSyncServer({
      actions: {
        "chat.send": async (ctx) => {
          const packet = {
            type: "chat",
            from: ctx.user ? ctx.user.id : null,
            text: ctx.payload.text,
          };

          // Send to sender
          ctx.emit(packet);
          // And to all other clients
          ctx.broadcastToOthers(packet);
        },
      },

      onAuthorize: async (socket) => {
        return { id: `user-of-${socket.id}`, role: "user" };
      },
    });

    const alice = createFakeSocket("socket-alice");
    const bob = createFakeSocket("socket-bob");

    await spa.registerClient(alice);
    await spa.registerClient(bob);

    const packet = makeActionPacket("chat.send", { text: "Hello Bob" });
    alice.trigger("message", packet);

    const aliceMsgs = alice.emitted.filter((e) => e.event === "message");
    const bobMsgs = bob.emitted.filter((e) => e.event === "message");

    expect(aliceMsgs).toHaveLength(1);
    expect(bobMsgs).toHaveLength(1);

    expect(aliceMsgs[0].payload.text).toBe("Hello Bob");
    expect(bobMsgs[0].payload.text).toBe("Hello Bob");
  });

  test("broadcastToAll sends to everyone including sender", async () => {
    const spa = createSpaSyncServer({
      actions: {
        "chat.broadcastAll": async (ctx) => {
          const packet = {
            type: "chat",
            from: ctx.user ? ctx.user.id : null,
            text: ctx.payload.text,
          };

          ctx.broadcastToAll(packet);
        },
      },

      onAuthorize: async (socket) => {
        return { id: `user-of-${socket.id}` };
      },
    });

    const a = createFakeSocket("socket-a");
    const b = createFakeSocket("socket-b");
    const c = createFakeSocket("socket-c");

    await spa.registerClient(a);
    await spa.registerClient(b);
    await spa.registerClient(c);

    const packet = makeActionPacket("chat.broadcastAll", { text: "To all" });
    a.trigger("message", packet);

    const aMsgs = a.emitted.filter((e) => e.event === "message");
    const bMsgs = b.emitted.filter((e) => e.event === "message");
    const cMsgs = c.emitted.filter((e) => e.event === "message");

    expect(aMsgs[aMsgs.length - 1].payload.text).toBe("To all");
    expect(bMsgs[bMsgs.length - 1].payload.text).toBe("To all");
    expect(cMsgs[cMsgs.length - 1].payload.text).toBe("To all");
  });

  test("broadcastTo(filterFn) targets only selected clients (e.g., admins)", async () => {
    const spa = createSpaSyncServer({
      actions: {
        "system.notifyAdmins": async (ctx) => {
          const packet = {
            type: "system",
            kind: "notice",
            text: ctx.payload.text,
          };

          ctx.broadcastTo(
            (client) => client.user && client.user.role === "admin",
            packet
          );
        },
      },

      onAuthorize: async (socket) => {
        if (socket.id === "socket-admin1") {
          return { id: "admin-1", role: "admin" };
        }
        if (socket.id === "socket-admin2") {
          return { id: "admin-2", role: "admin" };
        }
        return { id: `user-of-${socket.id}`, role: "user" };
      },
    });

    const admin1 = createFakeSocket("socket-admin1");
    const admin2 = createFakeSocket("socket-admin2");
    const user1 = createFakeSocket("socket-user1");

    await spa.registerClient(admin1);
    await spa.registerClient(admin2);
    await spa.registerClient(user1);

    const packet = makeActionPacket("system.notifyAdmins", {
      text: "Admin-only notice",
    });
    user1.trigger("message", packet);

    const admin1Msgs = admin1.emitted.filter((e) => e.event === "message");
    const admin2Msgs = admin2.emitted.filter((e) => e.event === "message");
    const user1Msgs = user1.emitted.filter((e) => e.event === "message");

    expect(admin1Msgs[admin1Msgs.length - 1].payload.text).toBe(
      "Admin-only notice"
    );
    expect(admin2Msgs[admin2Msgs.length - 1].payload.text).toBe(
      "Admin-only notice"
    );

    // User should not receive the admin-only notice as the last message.
    const lastUserPayload = user1Msgs[user1Msgs.length - 1]?.payload;
    if (lastUserPayload) {
      expect(lastUserPayload.text).not.toBe("Admin-only notice");
    }
  });
});
