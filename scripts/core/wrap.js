/**
 * Gato's Library — method wrapping. Uses libWrapper when it is active, otherwise installs a plain
 * wrapper with the same calling convention. libWrapper attributes a `register` call to the package whose
 * file makes it (it reads the stack) and refuses any other `package_id`. A consumer that wants the
 * registration under its own id (conflict notices, user priorities) therefore passes `register` /
 * `unregister` callbacks defined in its own file; without them the library registers under "gatos-lib",
 * and a second gatos module wrapping the same target under that id falls back to the plain wrapper.
 * Calling convention:
 *  - "WRAPPER" / "MIXED": `fn.call(this, wrapped, ...args)` — WRAPPER must call `wrapped(...args)`;
 *  - "OVERRIDE":          `fn.call(this, ...args)` — the original is not passed.
 * Register in `init` or later.
 */

const TYPES = new Set(["WRAPPER", "MIXED", "OVERRIDE"]);

/** The package libWrapper sees as the caller: this library (see the header comment). */
const LIB_WRAPPER_ID = "gatos-lib";

/**
 * Wrap a method on `owner[name]` without libWrapper. Inherited methods are looked up on the
 * parent prototype at call time, so later patches there are still honoured.
 * @returns {() => void} unwrap — restores the original when ours is still the outermost
 *   function, otherwise turns the wrapper into a pass-through.
 */
function installManual(mod, owner, name, fn, type) {
  if (!owner) throw new Error(`${mod.id} | cannot wrap "${name}": target not found`);
  const hadOwn = Object.prototype.hasOwnProperty.call(owner, name);
  const own = hadOwn ? owner[name] : undefined;
  const original = function () {
    return hadOwn ? own : Object.getPrototypeOf(owner)?.[name];
  };
  if (typeof (hadOwn ? own : original()) !== "function") throw new Error(`${mod.id} | cannot wrap "${name}": not a function`);
  let active = true;
  const wrapper = function (...args) {
    const base = original();
    if (!active) return base.apply(this, args);
    if (type === "OVERRIDE") return fn.apply(this, args);
    return fn.call(this, base.bind(this), ...args);
  };
  owner[name] = wrapper;
  return () => {
    if (!active) return;
    active = false;
    if (owner[name] !== wrapper) return;
    if (hadOwn) owner[name] = own;
    else delete owner[name];
  };
}

/**
 * Wrap a method by dotted path from `globalThis`, libWrapper-style.
 * ported from header-menu module.js `installWrapper`
 * @param {object} mod
 * @param {string} target  e.g. "foundry.appv1.api.Application.prototype._renderOuter"
 * @param {Function} fn
 * @param {"WRAPPER"|"MIXED"|"OVERRIDE"} [type="WRAPPER"]
 * @param {object} [opts]
 * @param {(target: string, fn: Function, type: string) => number} [opts.register]  libWrapper registration
 *   made from the consumer's own file, e.g. `(t, f, ty) => libWrapper.register(MODULE_ID, t, f, ty)`
 * @param {(id: number) => void} [opts.unregister]  its counterpart, e.g. `(id) => libWrapper.unregister(MODULE_ID, id, false)`
 * @returns {() => void} unwrap (no-op when registration failed)
 */
export function wrapMethod(mod, target, fn, type = "WRAPPER", { register, unregister } = {}) {
  if (!TYPES.has(type)) throw new Error(`${mod.id} | unknown wrapper type "${type}"`);
  try {
    if (game.modules.get("lib-wrapper")?.active && globalThis.libWrapper) {
      try {
        const id = register ? register(target, fn, type) : libWrapper.register(LIB_WRAPPER_ID, target, fn, type);
        return () => (unregister ?? (register ? () => {} : (i) => libWrapper.unregister(LIB_WRAPPER_ID, i, false)))(id);
      } catch (err) {
        mod.warn(`libWrapper refused ${target}, wrapping it directly`, err);
      }
    }
    const dot = target.lastIndexOf(".");
    const owner = foundry.utils.getProperty(globalThis, target.slice(0, dot));
    return installManual(mod, owner, target.slice(dot + 1), fn, type);
  } catch (err) {
    mod.error(`failed to wrap ${target}`, err);
    return () => {};
  }
}

/**
 * Wrap a method on an object reached without a path string (e.g. a class from a game-system or
 * module API). Always a plain wrapper; libWrapper needs a path.
 * ported from light compat.js:16-27
 * @param {object} mod
 * @param {object} proto   Usually `SomeClass.prototype`.
 * @param {string} name
 * @param {Function} fn
 * @param {"WRAPPER"|"MIXED"|"OVERRIDE"} [type="WRAPPER"]
 * @returns {() => void} unwrap (no-op when wrapping failed)
 */
export function wrapPrototypeMethod(mod, proto, name, fn, type = "WRAPPER") {
  if (!TYPES.has(type)) throw new Error(`${mod.id} | unknown wrapper type "${type}"`);
  try {
    return installManual(mod, proto, name, fn, type);
  } catch (err) {
    mod.error(`failed to wrap ${name}`, err);
    return () => {};
  }
}

/**
 * Wrap a method on the prototype of `instance` once — for classes that are not exported, reached
 * only through a live instance (e.g. in a render hook). The prototype is marked with
 * `Symbol.for(`${mod.id}.${name}`)` (own property only, so subclasses are patched separately).
 * ported from coc7-free-occupation module.js:8-13,26-30
 * @param {object} mod
 * @param {object} instance
 * @param {string} name
 * @param {Function} fn
 * @param {"WRAPPER"|"MIXED"|"OVERRIDE"} [type="WRAPPER"]
 * @returns {(() => void)|null} unwrap when patched by this call; null when already patched or on failure
 *   (truthy result = "just patched, re-render to take effect").
 */
export function patchPrototypeOnce(mod, instance, name, fn, type = "WRAPPER") {
  const proto = instance ? Object.getPrototypeOf(instance) : null;
  if (!proto) return null;
  const marker = Symbol.for(`${mod.id}.${name}`);
  if (Object.prototype.hasOwnProperty.call(proto, marker)) return null;
  if (!TYPES.has(type)) throw new Error(`${mod.id} | unknown wrapper type "${type}"`);
  let unwrap;
  try {
    unwrap = installManual(mod, proto, name, fn, type);
  } catch (err) {
    mod.error(`failed to patch ${name}`, err);
    return null;
  }
  Object.defineProperty(proto, marker, { value: true, configurable: true });
  return () => {
    unwrap();
    delete proto[marker];
  };
}
