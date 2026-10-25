/**
 * Extension points between modules: provider lists, action registries and soft module dependencies.
 * Registries are plain objects owned by the module that creates them; nothing here is global.
 */

// ported from gatos-chat-tools portrait.js registerPortraitProvider / fromProviders
/**
 * An ordered list of provider functions. `first()` asks them in registration order and returns the
 * first non-null (and non-undefined) answer; a provider that throws is skipped with a warning.
 * @returns {{register: (fn: Function) => () => void, first: (...args: any[]) => any, all: (...args: any[]) => any[], size: number}}
 */
export function providerRegistry() {
  const providers = [];
  const call = (fn, args) => {
    try {
      return fn(...args);
    } catch (err) {
      console.warn("gatos-lib | provider failed", err);
      return null;
    }
  };
  return {
    /** Add a provider (once). Returns a function that removes it again. */
    register(fn) {
      if (typeof fn !== "function") throw new Error("providerRegistry.register needs a function");
      if (!providers.includes(fn)) providers.push(fn);
      return () => {
        const i = providers.indexOf(fn);
        if (i >= 0) providers.splice(i, 1);
      };
    },
    /**
     * The first provider answer that is not null/undefined, else null. When the first argument is a function it
     * is an `accept(answer)` mapper: the walk stops at the first answer it maps to a non-null value and returns
     * that value (chat-tools portraits: a provider answer without an image moves on to the next provider).
     */
    first(...args) {
      const accept = typeof args[0] === "function" ? args.shift() : null;
      for (const fn of [...providers]) {
        const r = call(fn, args);
        if (r == null) continue;
        if (!accept) return r;
        const mapped = accept(r);
        if (mapped != null) return mapped;
      }
      return null;
    },
    /** Every non-null provider answer, in registration order. */
    all(...args) {
      return [...providers].map((fn) => call(fn, args)).filter((r) => r != null);
    },
    get size() {
      return providers.length;
    },
  };
}

// ported from gatos-chat-tools viewer-actions.js registerViewerAction / viewerActions / getViewerAction
/**
 * A registry of action definitions keyed by `id`. Re-registering an id replaces it. Every change calls
 * `Hooks.callAll(hookName)` when a hook name is given, so open windows can re-render.
 * @param {string} [hookName]
 * @returns {{register: (def: {id: string, visible?: (ctx: any) => boolean}) => () => void,
 *            list: (ctx?: any) => object[], get: (id: string) => object|null}}
 */
export function actionRegistry(hookName) {
  const actions = new Map();
  const changed = () => {
    if (hookName) Hooks.callAll(hookName);
  };
  return {
    /** Add or replace an action. Returns a function that removes it (if it was not replaced since). */
    register(def) {
      if (!def?.id) throw new Error("actionRegistry.register needs an id");
      actions.set(def.id, def);
      changed();
      return () => {
        if (actions.get(def.id) !== def) return;
        actions.delete(def.id);
        changed();
      };
    },
    /** The registered actions whose `visible(ctx)` is not false (a throwing `visible` hides the action). */
    list(ctx) {
      return [...actions.values()].filter((def) => {
        try {
          return def.visible?.(ctx) ?? true;
        } catch {
          return false;
        }
      });
    },
    get(id) {
      return actions.get(id) ?? null;
    },
  };
}

// ported from gatos-visual-novel constants.js chatTools() / chatToolsHooksAvailable(), gatos-chat-tools images.js chatImagesActive
/**
 * Soft dependency gate: the module's api when the module is active, at least `minVersion`, and its api
 * has every member in `members` (dotted paths allowed). Otherwise null.
 * A module without an api passes as `{}` when no members are required (e.g. "is chat-images active?").
 * @param {string} id
 * @param {{minVersion?: string, members?: string[]}} [options]
 * @returns {object|null}
 */
export function requireModule(id, { minVersion, members = [] } = {}) {
  const mod = game.modules.get(id);
  if (!mod?.active) return null;
  if (minVersion && foundry.utils.isNewerVersion(minVersion, mod.version ?? "0.0.0")) return null;
  const api = mod.api ?? null;
  if (members.length) {
    if (!api) return null;
    if (!members.every((m) => foundry.utils.getProperty(api, m) !== undefined)) return null;
  }
  return api ?? {};
}
