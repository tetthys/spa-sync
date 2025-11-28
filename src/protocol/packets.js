// src/protocol/packets.js
// ECOSYSTEM_DSL route packet builder.

/**
 * Create a spa.route DSL object.
 *
 * Shape:
 * {
 *   kind: "spa.route",
 *   navigation: { action, target?, url? } | null,
 *   view: { key, props? } | null,
 *   payload: {},
 *   flashes: {},
 *   meta: {}
 * }
 */
function makeRoutePacket(dsl = {}) {
  return {
    kind: "spa.route",
    navigation:
      dsl.navigation && typeof dsl.navigation === "object"
        ? dsl.navigation
        : null,
    view: dsl.view && typeof dsl.view === "object" ? dsl.view : null,
    payload: dsl.payload && typeof dsl.payload === "object" ? dsl.payload : {},
    flashes: dsl.flashes && typeof dsl.flashes === "object" ? dsl.flashes : {},
    meta: dsl.meta && typeof dsl.meta === "object" ? dsl.meta : {},
  };
}

/**
 * Action packet (client → server)
 */
function makeActionPacket(name, payload, meta) {
  return {
    type: "action",
    name,
    payload: payload || {},
    meta: meta || {},
  };
}

module.exports = {
  makeRoutePacket,
  makeActionPacket,
};
