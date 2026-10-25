/**
 * Gato's Library — document flag helpers.
 * Every helper takes the module id (or the `mod` handle from defineModule); nothing is global.
 * No hook is registered until a store's watch() is called or it is created with onChange.
 */

const TYPE_CHECKS = {
  number: (v) => typeof v === "number" && Number.isFinite(v),
  string: (v) => typeof v === "string",
  boolean: (v) => typeof v === "boolean",
  array: (v) => Array.isArray(v),
  object: (v) => !!v && typeof v === "object" && !Array.isArray(v),
};

const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const clone = (v) => (v && typeof v === "object" ? foundry.utils.deepClone(v) : v);

/** `flags.${id}.${key}` */
export const flagKey = (id, key) => `flags.${id}.${key}`;

/** `flags.${id}.-=${key}` — update key that deletes the flag (value null). */
export const flagDeleteKey = (id, key) => `flags.${id}.-=${key}`;

/**
 * Was this update/create issued by the module itself? Checks the `options[id]` marker
 * (any truthy value: `true` or a context object).
 */
export const isSelfUpdate = (id, options) => !!options?.[id];

/**
 * Read a flag with a fallback.
 * Works on documents, embedded data models (e.g. a prototype token) and plain serialized objects;
 * `key` may be a dotted path. null / undefined, or a value failing `validate`, yields `dflt`
 * (object defaults are cloned so callers may mutate them).
 * validate: a predicate, or one of "number" | "string" | "boolean" | "array" | "object".
 */
export function getFlagOr(doc, id, key, dflt, { validate } = {}) {
  const flags = doc?.flags?.[id];
  const value = flags == null ? undefined : foundry.utils.getProperty(flags, key);
  const check = typeof validate === "string" ? TYPE_CHECKS[validate] : validate;
  if (value === undefined || value === null || (check && !check(value))) return clone(dflt);
  return value;
}

/* -------------------------------------------- */
/*  User flag stores                            */
/* -------------------------------------------- */

/** Does an updateUser change set touch flags.<id>.<key> (set, deleted with -= or replaced with ==)? */
function touchesFlag(changes, id, key) {
  const flags = changes?.flags;
  if (!flags || typeof flags !== "object") return false;
  if (`-=${id}` in flags) return true;
  let node = flags[id];
  if (!node || typeof node !== "object") return false;
  for (const seg of key.split(".")) {
    if (!node || typeof node !== "object") return true; // a parent was replaced wholesale
    if (`-=${seg}` in node || `==${seg}` in node) return true;
    if (!(seg in node)) return false;
    node = node[seg];
  }
  return true;
}

/**
 * Call fn(value, user, changes) when the current user's flags.<id>.<key> changes (any window, any client).
 * Returns a function that removes the hook.
 */
export function watchUserFlag(mod, key, fn, read = () => getFlagOr(game.user, mod.id, key, undefined)) {
  const hookId = Hooks.on("updateUser", (user, changes) => {
    if (!user.isSelf || !touchesFlag(changes, mod.id, key)) return;
    fn(read(), user, changes);
  });
  return () => Hooks.off("updateUser", hookId);
}

/**
 * Per-user flag store on the current user.
 * - get(): the stored value, or `default` (a plain-object default is merged under the stored object,
 *   so missing keys keep their defaults).
 * - set(v): setFlag (null / undefined unsets).  unset(): unsetFlag.
 * - toggle(): flips a boolean flag.  toggle(item): adds/removes item in an array flag.
 *   toggle(subKey, value = true): adds/removes a sub-key of an object flag (deleted with -=).
 *   Each toggle resolves to the new on/off state.
 * - watch(fn): updateUser watcher, see watchUserFlag. onChange in the options registers one immediately.
 */
// ported from gatos-chat-tools bookmarks.js / whisper.js / speaker-bar.js and buff-finder module favorites
export function userFlagStore(mod, key, { default: dflt = null, onChange } = {}) {
  const id = mod.id;
  const get = () => {
    const value = getFlagOr(game.user, id, key, dflt);
    if (isPlainObject(dflt) && isPlainObject(value) && value !== dflt) return { ...clone(dflt), ...value };
    return value;
  };
  const unset = () => game.user.unsetFlag(id, key);
  const set = (value) => (value === null || value === undefined ? unset() : game.user.setFlag(id, key, value));

  async function toggle(item, value = true) {
    const current = get();
    if (item === undefined) {
      const on = !current;
      await set(on);
      return on;
    }
    if (Array.isArray(current) || Array.isArray(dflt)) {
      const list = Array.isArray(current) ? [...current] : [];
      const i = list.indexOf(item);
      if (i >= 0) list.splice(i, 1);
      else list.push(item);
      await set(list);
      return i < 0;
    }
    const on = !current?.[item];
    await game.user.update({ [on ? `${flagKey(id, key)}.${item}` : `${flagKey(id, key)}.-=${item}`]: on ? value : null });
    return on;
  }

  const store = { key, get, set, unset, toggle, watch: (fn) => watchUserFlag(mod, key, fn, get) };
  if (onChange) store.unwatch = store.watch(onChange);
  return store;
}

/**
 * Most-recently-used list in a user flag (newest first, no duplicates, at most `max` entries).
 * Also usable as an unordered set (has / toggle / remove), e.g. favorites.
 */
// ported from buff-finder module buff-finder.js (recent / favorites)
export function userListFlag(mod, key, { max = Infinity, onChange } = {}) {
  const id = mod.id;
  const get = () => getFlagOr(game.user, id, key, [], { validate: "array" });
  const set = (list) => game.user.setFlag(id, key, [...new Set(list)].slice(0, max));
  const store = {
    key,
    get,
    set,
    has: (value) => get().includes(value),
    /** Move value to the front (adding it when missing). */
    push: (value) => set([value, ...get().filter((v) => v !== value)]),
    remove: (value) => set(get().filter((v) => v !== value)),
    clear: () => game.user.unsetFlag(id, key),
    /** Append value when missing, remove it when present; resolves to the new state. */
    async toggle(value) {
      const list = get();
      const on = !list.includes(value);
      await set(on ? [...list, value] : list.filter((v) => v !== value));
      return on;
    },
    watch: (fn) => watchUserFlag(mod, key, fn, get),
  };
  if (onChange) store.unwatch = store.watch(onChange);
  return store;
}

/* -------------------------------------------- */
/*  Field stash / restore                       */
/* -------------------------------------------- */

/**
 * Update data that stores the current value of `path` in flags.<id>.<key> — but only when nothing is
 * stashed yet, so the original survives repeated overrides. Merge it with your own `{ [path]: newValue }`.
 * prefix: prepended to the flag path, e.g. "prototypeToken." when doc is a prototype token updated via its actor.
 * pick: transforms the stored value (e.g. keep only some keys). Returns {} when a stash already exists.
 */
// ported from light module sources.js (token light flags.<id>.base)
export function stashField(doc, path, mod, key, { prefix = "", pick } = {}) {
  if (getFlagOr(doc, mod.id, key, undefined) !== undefined) return {};
  const raw = foundry.utils.getProperty(doc, path);
  const value = raw?.toObject?.() ?? clone(raw);
  return { [`${prefix}${flagKey(mod.id, key)}`]: pick ? pick(value) : value ?? null };
}

/**
 * Update data that writes the stashed value back to `path` and deletes the stash,
 * or null when nothing is stashed. Same `prefix` rule as stashField.
 */
// ported from light module sources.js
export function restoreField(doc, path, mod, key, { prefix = "" } = {}) {
  const stashed = getFlagOr(doc, mod.id, key, undefined);
  if (stashed === undefined) return null;
  return { [`${prefix}${path}`]: clone(stashed), [`${prefix}${flagDeleteKey(mod.id, key)}`]: null };
}
