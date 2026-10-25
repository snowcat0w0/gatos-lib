/**
 * Gato's Library — public surface (system-agnostic).
 *
 * Consumers import this file statically through a one-line shim (PLAN §5.1):
 *   // <module>/scripts/lib.js
 *   export * from "../../gatos-lib/scripts/index.js";
 *
 * Nothing here registers hooks on the consumer's behalf or touches the DOM at import time.
 * The only side effect is exposing the same surface as `game.modules.get("gatos-lib").api`
 * for macros and the console once Foundry reaches `init`.
 */
import * as self from "./index.js";
import * as pureDom from "./pure/dom.js";
import * as pureFn from "./pure/fn.js";

export const LIB_ID = "gatos-lib";
export const LIB_VERSION = "1.1.0-alpha.1";

// core
export * from "./core/module.js";
export * from "./core/settings.js";
export * from "./core/compat.js";
export * from "./core/socket.js";
export * from "./core/hooks.js";
export * from "./core/wrap.js";

// documents / users
export * from "./users.js";
export * from "./actors.js";
export * from "./chat.js";

// ui
export * from "./ui/app.js";
export * from "./ui/dialogs.js";
export * from "./ui/inject.js";
export * from "./ui/dom.js";

// data
export * from "./data/flags.js";
export * from "./data/registry.js";
export * from "./data/files.js";
export * from "./data/compendium.js";

// util
export * from "./util/text.js";
export * from "./util/time.js";
export * from "./util/num.js";

// systems (adapter registry only; implementations live in system libraries)
export * from "./systems/adapter.js";

/** Foundry-free helpers, also usable inline in exported pages (PLAN §5.7). */
export const pure = Object.freeze({ ...pureDom, ...pureFn });

/** True when the library module is installed AND enabled in this world (PLAN §5.6 "half state" check). */
export function libActive() {
  return !!globalThis.game?.modules?.get(LIB_ID)?.active;
}

if (globalThis.Hooks?.once) {
  Hooks.once("init", () => {
    const module = game.modules.get(LIB_ID);
    if (module) module.api = self;
    console.log(`${LIB_ID} | v${LIB_VERSION} ready`);
  });
}
