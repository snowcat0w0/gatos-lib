/**
 * Gato's Library — declarative settings registration and setting-backed stores.
 *
 * Table entry (all keys optional):
 *   scope ("world"), config (true), type, default, range, choices, onChange, requiresReload, ...
 *   hidden: true            → config:false, no name/hint (internal JSON stores)
 *   nameKey / hintKey       → override `${settingsPrefix}.${PascalKey}.Name` / `.Hint` (false = omit)
 *   choices: ["a", "b"]     → { a: `${settingsPrefix}.${PascalKey}.A`, ... } (objects pass through)
 *   onChange: "name"        → Hooks.callAll(`${id}.name`, value, options)
 *   menu: { type, icon, restricted, ... } → game.settings.registerMenu; name/label/hint keys
 *                             default to `.Name` / `.Label` / `.Hint` (labelKey overrides .Label)
 */
// ported from gatos-chat-tools / gatos-turn-control / light module settings.js and the reg() sugar of
// gatos item-crafting, gatos-visual-novel and gatos-header-menu

/** "topLeft" → "TopLeft", "gm-only" → "GmOnly", "a b" → "AB". */
export function pascal(value) {
  return String(value)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

/** Table-only keys that never reach game.settings. */
const TABLE_KEYS = ["hidden", "nameKey", "hintKey", "labelKey", "menu"];

function omit(obj, keys) {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

/** Resolve a lang key option: undefined → fallback, false/null → omitted. */
const langKey = (explicit, fallback) => (explicit === undefined ? fallback : explicit || undefined);

/**
 * Convert a settings table into `[key, config]` pairs ready for game.settings.register / registerMenu.
 * Pure: never touches `game`. Menu entries carry `menu: true` in their config (stripped on registration).
 * options.keyStyle: "pascal" (default) builds lang keys from PascalKey; "raw" uses the setting key as written
 * (for modules whose lang files use `Settings.myKey.Name`).
 * @returns {Array<[string, object]>}
 */
export function settingsTableToRegistrations(id, settingsPrefix, table, { keyStyle = "pascal" } = {}) {
  const out = [];
  const base = (key) => {
    const name = keyStyle === "raw" ? key : pascal(key);
    return settingsPrefix ? `${settingsPrefix}.${name}` : name;
  };
  for (const [key, spec = {}] of Object.entries(table ?? {})) {
    const prefix = base(key);

    if (spec.menu) {
      const config = {
        name: langKey(spec.nameKey, `${prefix}.Name`),
        label: langKey(spec.labelKey, `${prefix}.Label`),
        hint: langKey(spec.hintKey, `${prefix}.Hint`),
        ...spec.menu,
        menu: true,
      };
      for (const k of ["name", "label", "hint"]) if (config[k] === undefined) delete config[k];
      out.push([key, config]);
      continue;
    }

    const config = { scope: "world", config: true, ...omit(spec, TABLE_KEYS) };
    if (spec.hidden) config.config = false;

    // Lang keys only for settings shown in the configuration window.
    if (config.config) {
      config.name ??= langKey(spec.nameKey, `${prefix}.Name`);
      config.hint ??= langKey(spec.hintKey, `${prefix}.Hint`);
      if (config.name === undefined) delete config.name;
      if (config.hint === undefined) delete config.hint;
    } else if (spec.hidden) {
      delete config.name;
      delete config.hint;
    }

    // Arrays would be read as { "0": …, "1": … } and store indices — convert to { value: langKey }.
    if (Array.isArray(spec.choices)) {
      config.choices = Object.fromEntries(spec.choices.map((value) => [String(value), `${prefix}.${pascal(value)}`]));
    }

    // String onChange → module hook, so settings.js never has to import feature files.
    if (typeof spec.onChange === "string") {
      const hook = `${id}.${spec.onChange}`;
      config.onChange = (value, options) => globalThis.Hooks?.callAll(hook, value, options);
    }

    out.push([key, config]);
  }
  return out;
}

/**
 * Register every entry of a settings table for the module handle.
 * Call from an `init` hook. Returns the registered `[key, config]` pairs.
 */
export function registerSettings(mod, table, options = {}) {
  const pairs = settingsTableToRegistrations(mod.id, mod.settingsPrefix, table, options);
  for (const [key, config] of pairs) {
    if (config.menu) {
      const { menu, ...data } = config;
      game.settings.registerMenu(mod.id, key, data);
    } else {
      game.settings.register(mod.id, key, config);
    }
  }
  return pairs;
}

/* -------------------------------------------- */
/*  Setting-backed stores                       */
/* -------------------------------------------- */

/**
 * A JSON-ish setting (usually `hidden: true, type: Object`) as a store.
 * get() returns a deep clone, so callers may mutate it freely.
 * update(fn) passes a clone to fn and saves fn's return value (or the mutated clone when fn returns undefined).
 */
// ported from gatos-chat-tools archive.js / session.js, gatos-visual-novel links.js, gatos-turn-control settings.js
export function settingStore(mod, key) {
  const get = () => foundry.utils.deepClone(game.settings.get(mod.id, key));
  const set = (value) => game.settings.set(mod.id, key, value);
  return {
    key,
    get,
    set,
    async update(fn) {
      const draft = get();
      const result = await fn(draft);
      return set(result === undefined ? draft : result);
    },
  };
}

/**
 * Call fn(value, setting) whenever one of the module's settings changes.
 * key may be a string or an array of keys. World/user settings are watched through updateSetting and
 * createSetting (the first save creates the Setting document), client settings through clientSettingChanged.
 * Returns a function that removes the hooks.
 */
// ported from gatos-chat-tools viewer.js (onUpdateSetting) and gatos-visual-novel keyword-manager.js
export function onSettingChanged(mod, key, fn) {
  const ids = new Set([key].flat().map((k) => `${mod.id}.${k}`));
  const onDoc = (setting) => {
    if (ids.has(setting?.key)) fn(setting.value, setting);
  };
  const onClient = (settingKey, value) => {
    if (ids.has(settingKey)) fn(value, null);
  };
  const hooks = [
    ["updateSetting", Hooks.on("updateSetting", onDoc)],
    ["createSetting", Hooks.on("createSetting", onDoc)],
    ["clientSettingChanged", Hooks.on("clientSettingChanged", onClient)],
  ];
  return () => hooks.forEach(([name, hookId]) => Hooks.off(name, hookId));
}

/**
 * World defaults (set by the GM in `worldKeys`) that each client may override key by key.
 * `clientKey` is a client-scope Object setting holding `{ [worldKey]: value }` for overridden keys only.
 * (Tier 2 placeholder — the configuration window stays in the consuming module.)
 */
// ported from gatos-visual-novel settings.js (display / displayOverrides / setDisplayOverrides)
export function overridesStore(mod, { worldKeys = [], clientKey }) {
  const keys = [...worldKeys];
  /** This client's overrides ({ key: value } for overridden keys only). */
  const overrides = () => {
    const o = game.settings.get(mod.id, clientKey);
    return o && typeof o === "object" ? { ...o } : {};
  };
  /** Replace this client's overrides (unknown keys and null/undefined values are dropped). */
  const setOverrides = (next) => {
    const clean = Object.fromEntries(
      Object.entries(next ?? {}).filter(([k, v]) => keys.includes(k) && v !== undefined && v !== null)
    );
    return game.settings.set(mod.id, clientKey, clean);
  };
  return {
    keys,
    overrides,
    setOverrides,
    /** Effective value: this client's override when set, otherwise the world default. */
    get(key) {
      const o = overrides();
      return Object.hasOwn(o, key) ? o[key] : game.settings.get(mod.id, key);
    },
    /** The world default, ignoring overrides. */
    worldValue: (key) => game.settings.get(mod.id, key),
    isOverridden: (key) => Object.hasOwn(overrides(), key),
    /** Override one key (null/undefined clears it). */
    setOverride: (key, value) => setOverrides({ ...overrides(), [key]: value }),
    clearOverride(key) {
      const o = overrides();
      delete o[key];
      return setOverrides(o);
    },
    reset: () => setOverrides({}),
  };
}
