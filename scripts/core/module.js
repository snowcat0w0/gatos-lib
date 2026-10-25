/**
 * Gato's Library — module handle.
 *
 *   const mod = defineModule("my-module", { langPrefix: "MYMOD", settingsPrefix: "MYMOD.Settings" });
 *
 * defineModule touches no Foundry global, so it is safe at import time; the handle's methods read
 * `game` / `ui` / `foundry` only when called.
 */
import { registerSettings } from "./settings.js";
import { getFlagOr, flagKey, flagDeleteKey, flagDeletion, isFlagDeleted, isSelfUpdate } from "../data/flags.js";

/** Template names may be bare ("viewer", "parts/row") or full paths ending in .hbs / .html. */
const isPath = (name) => /\.(hbs|html)$/i.test(name);

/**
 * Create the handle every library entry point takes.
 * @param {string} id                       The module id.
 * @param {object} [opts]
 * @param {string} [opts.langPrefix]        Prefix for mod.L ("" = keys are used as given).
 * @param {string} [opts.settingsPrefix]    Prefix for setting name/hint keys; defaults to `${langPrefix}.Settings`.
 */
export function defineModule(id, { langPrefix = "", settingsPrefix } = {}) {
  if (!id) throw new Error("defineModule: a module id is required");
  settingsPrefix ??= langPrefix ? `${langPrefix}.Settings` : "";
  const prefixed = (key) => (langPrefix ? `${langPrefix}.${key}` : key);

  /** Localize a full key, formatting with data when given. */
  // ported from light module sources.js (i18n) / monster-maker module dialog.js (loc)
  const Lraw = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

  const notifier = (level) => (key, data, opts) => ui.notifications?.[level](mod.L(key, data), opts);

  const mod = {
    id,
    langPrefix,
    settingsPrefix,

    /** Localize `${langPrefix}.${key}`, formatting with data when given. */
    // ported from gatos-chat-tools constants.js / gatos-visual-novel constants.js / gatos-turn-control tracker.js
    L: (key, data) => Lraw(prefixed(key), data),
    Lraw,

    /** game.settings.get; undefined (instead of a throw) while the key is not registered yet. */
    // ported from gatos-header-menu module.js (setting) / hero-points module settings.js
    setting(key) {
      const settings = globalThis.game?.settings;
      if (!settings?.settings?.has(`${id}.${key}`)) return undefined;
      return settings.get(id, key);
    },
    setSetting: (key, value) => game.settings.set(id, key, value),
    /** Declarative settings table, see core/settings.js. */
    registerSettings: (table, options) => registerSettings(mod, table, options),

    /** `modules/${id}/templates/${name}.hbs` (full paths pass through). */
    template: (name) => (isPath(name) ? name : `modules/${id}/templates/${name}.hbs`),

    /**
     * Preload templates. names: array (or object of) template names/paths;
     * partials: { partialName: templateName } registered as named Handlebars partials.
     */
    // ported from item-crafting module module.js (template preload) / gatos-chat-tools module.js
    preloadTemplates(names = [], partials) {
      const load = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
      const list = Array.isArray(names) ? names : Object.values(names ?? {});
      const jobs = [];
      if (list.length) jobs.push(load(list.map(mod.template)));
      if (partials && Object.keys(partials).length) {
        jobs.push(load(Object.fromEntries(Object.entries(partials).map(([k, v]) => [k, mod.template(v)]))));
      }
      return Promise.all(jobs);
    },

    /** Flag of this module with a fallback, see getFlagOr. */
    flag: (doc, key, dflt, options) => getFlagOr(doc, id, key, dflt, options),
    /** `flags.${id}.${key}` */
    flagKey: (key) => flagKey(id, key),
    /** `flags.${id}.-=${key}` — legacy deletion key, warns on v14; prefer flagDeletion. */
    flagDeleteKey: (key) => flagDeleteKey(id, key),
    /** `{ "flags.${id}.${key}": _del }` — spread into update data to delete the flag. */
    flagDeletion: (key, options) => flagDeletion(id, key, options),
    /** Did these update-hook changes delete `flags.${id}.${key}` (or a parent)? */
    isFlagDeleted: (changes, key) => isFlagDeleted(changes, id, key),
    /** Was this update marked by mod.mark()? */
    isSelfUpdate: (options) => isSelfUpdate(id, options),
    /** Copy of options with the `[id]: true` self-update marker. */
    mark: (options = {}) => ({ ...options, [id]: true }),

    /** game.modules.get(id).api = obj, plus globalThis[global] when given. Returns obj. */
    // ported from gatos-header-menu module.js and the api blocks of the other gatos modules
    exposeApi(obj, { global } = {}) {
      const module = game.modules.get(id);
      if (module) module.api = obj;
      if (global) globalThis[global] = obj;
      return obj;
    },

    log: (...args) => console.log(`${id} |`, ...args),
    warn: (...args) => console.warn(`${id} |`, ...args),
    error: (...args) => console.error(`${id} |`, ...args),

    /** ui.notifications.* with a localized (prefixed) message. */
    notify: Object.freeze({ info: notifier("info"), warn: notifier("warn"), error: notifier("error") }),
  };
  return mod;
}
