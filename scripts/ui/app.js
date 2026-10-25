/**
 * gatos-lib — ApplicationV2 helpers: singleton / per-document window registries, persisted window position,
 * and form extraction for windows and DialogV2 callbacks.
 *
 * The mixins compose with `HandlebarsApplicationMixin(ApplicationV2)` (or any ApplicationV2 subclass):
 *
 *   class BuffFinder extends SingletonMixin(HandlebarsApplicationMixin(ApplicationV2)) {
 *     static DEFAULT_OPTIONS = { id: "my-finder", gatos: { persistPosition: { mod, key: "position" } } };
 *   }
 *
 * Library options live under `DEFAULT_OPTIONS.gatos`. ApplicationV2 merges DEFAULT_OPTIONS along the class
 * chain (`inheritanceChain()` up to BASE_APPLICATION, objects merged, arrays concatenated, values deep-cloned),
 * so `gatos` also ends up in `app.options.gatos`. The library itself reads the static declarations directly
 * (see `gatosOptions`) so that function / handle values are used by reference and arrays are not concatenated.
 * Because ApplicationV2 deep-clones plain objects, a `mod` handle placed in DEFAULT_OPTIONS must be a class
 * instance or an acyclic object.
 *
 * Provenance: BF buff-finder, PP party-panel, VIT vitalist, VN visual-novel, CRF item-crafting,
 * MM monster-maker, CT chat-tools, HM header-menu, HP hero-points (PLAN §3 abbreviations).
 */
import { impl, bringToFront, htmlRoot } from "../core/compat.js";

/* -------------------------------------------- */
/*  Library options                             */
/* -------------------------------------------- */

/** @type {WeakMap<Function, object>} merged `gatos` options per class */
const OPTIONS_CACHE = new WeakMap();

/**
 * Merged `DEFAULT_OPTIONS.gatos` of an application class, read from the static declarations along the class
 * chain (base first, subclass keys replace parent keys). Values are not cloned.
 * @param {typeof foundry.applications.api.ApplicationV2} cls
 * @returns {{persistPosition?: PersistPositionConfig, keyFn?: (doc: object) => string}}
 */
export function gatosOptions(cls) {
  if (!cls) return {};
  let merged = OPTIONS_CACHE.get(cls);
  if (merged) return merged;
  const chain = typeof cls.inheritanceChain === "function" ? [...cls.inheritanceChain()] : [cls];
  merged = {};
  for (const c of chain.reverse()) {
    if (!Object.hasOwn(c, "DEFAULT_OPTIONS")) continue;
    const g = c.DEFAULT_OPTIONS?.gatos;
    if (g && typeof g === "object") Object.assign(merged, g);
  }
  OPTIONS_CACHE.set(cls, merged);
  return merged;
}

/* -------------------------------------------- */
/*  Persisted position                          */
/* -------------------------------------------- */

/**
 * @typedef PersistPositionConfig
 * @property {object} mod         Module handle (`mod.setting`, `mod.setSetting`, `mod.warn`)
 * @property {string} key         Setting key holding the saved position (usually client scope, type Object)
 * @property {string[]} [fields]  Position fields to keep, default left/top/width/height
 */

/**
 * Fields kept by default. Width/height are only persisted for resizable windows: saving them for an
 * auto-sized window would freeze its size forever, because ApplicationV2 re-applies "auto" only when the
 * configured position still says "auto" (application.mjs `_configureRenderOptions`), and a single
 * minimize/maximize turns the size into a fixed number.
 */
const DEFAULT_FIELDS = ["left", "top"];
const RESIZABLE_FIELDS = ["left", "top", "width", "height"];

/** Does the class (or the constructor options) declare a resizable window? Walks the DEFAULT_OPTIONS chain. */
function isResizable(cls, options) {
  if (options?.window?.resizable !== undefined) return !!options.window.resizable;
  const chain = typeof cls.inheritanceChain === "function" ? [...cls.inheritanceChain()] : [cls];
  for (const c of chain) {
    if (!Object.hasOwn(c, "DEFAULT_OPTIONS")) continue;
    const r = c.DEFAULT_OPTIONS?.window?.resizable;
    if (r !== undefined) return !!r;
  }
  return false;
}

/** The position fields to persist: explicit `fields`, else left/top (+ width/height when resizable). */
function positionFields(config, cls, options) {
  return config.fields ?? (isResizable(cls, options) ? RESIZABLE_FIELDS : DEFAULT_FIELDS);
}

/**
 * Read a saved window position, keeping only finite numeric fields.
 * ported from BF buff-finder.js:90-92, PP party-panel.js:130-132
 * @param {PersistPositionConfig} config
 * @returns {object|null}
 */
export function readSavedPosition({ mod, key, fields = DEFAULT_FIELDS } = {}) {
  if (!mod || !key) return null;
  let saved;
  try {
    saved = mod.setting(key);
  } catch (err) {
    return null;
  }
  if (!saved || typeof saved !== "object") return null;
  const position = {};
  for (const k of fields) if (Number.isFinite(saved[k])) position[k] = saved[k];
  return foundry.utils.isEmpty(position) ? null : position;
}

/**
 * Save the current position of an application. Non-numeric values ("auto") are skipped.
 * ported from BF buff-finder.js:608-613, PP party-panel.js:470-474
 * @param {ApplicationV2} app
 * @param {PersistPositionConfig} config
 * @returns {Promise<void>}
 */
export async function savePosition(app, { mod, key, fields = DEFAULT_FIELDS } = {}) {
  if (!app?.position || !mod || !key) return;
  const position = {};
  for (const k of fields) if (Number.isFinite(app.position[k])) position[k] = app.position[k];
  if (foundry.utils.isEmpty(position)) return;
  try {
    await mod.setSetting(key, position);
  } catch (err) {
    mod.warn?.(`could not save window position to setting "${key}"`, err);
  }
}

const PERSIST = Symbol.for("gatos-lib.persistPosition");

/**
 * Restore the window position from `DEFAULT_OPTIONS.gatos.persistPosition` when the application is constructed
 * and save it when the window closes. A `position` passed to the constructor wins over the saved one.
 * Applied automatically by SingletonMixin and PerDocumentMixin; applying it twice is a no-op.
 * @template {typeof foundry.applications.api.ApplicationV2} T
 * @param {T} Base
 * @returns {T}
 */
export function PersistPositionMixin(Base) {
  if (Base[PERSIST]) return Base;
  return class GatosPersistPosition extends Base {
    static [PERSIST] = true;

    /** @override */
    _initializeApplicationOptions(options = {}) {
      const config = gatosOptions(this.constructor).persistPosition;
      const saved = config ? readSavedPosition({ ...config, fields: positionFields(config, this.constructor, options) }) : null;
      if (saved) options = { ...options, position: { ...saved, ...(options.position ?? {}) } };
      return super._initializeApplicationOptions(options);
    }

    /** @override */
    _onClose(options) {
      super._onClose(options);
      const config = gatosOptions(this.constructor).persistPosition;
      if (config) savePosition(this, { ...config, fields: positionFields(config, this.constructor, this.options) });
    }
  };
}

/* -------------------------------------------- */
/*  Singleton                                   */
/* -------------------------------------------- */

/** @type {WeakMap<Function, ApplicationV2>} open singleton per class */
const SINGLETONS = new WeakMap();

/**
 * One window per class: `open()` creates or focuses it, `toggle()` opens or closes it, `instance` is the open
 * window or null (never auto-created), and the reference is dropped when the window closes.
 * Note: CT's viewer used an auto-creating `static get instance`; callers of that pattern switch to `open()`.
 * ported from BF buff-finder.js:89-108,616-619, PP party-panel.js:129-141, VN keyword-manager
 * @template {typeof foundry.applications.api.ApplicationV2} T
 * @param {T} Base
 * @returns {T}
 */
export function SingletonMixin(Base) {
  return class GatosSingleton extends PersistPositionMixin(Base) {
    /** The current window, or null when none is open. */
    static get instance() {
      return SINGLETONS.get(this) ?? null;
    }

    static set instance(app) {
      if (app) SINGLETONS.set(this, app);
      else SINGLETONS.delete(this);
    }

    /**
     * Create the window (constructor options apply only on creation) or bring the open one to the front.
     * @param {object} [options]  Constructor options
     * @returns {ApplicationV2}
     */
    static open(options = {}) {
      let app = this.instance;
      if (!app) {
        app = new this(options);
        this.instance = app;
      }
      if (app.rendered) {
        if (app.minimized) app.maximize();
        bringToFront(app);
      } else {
        app.render({ force: true });
      }
      return app;
    }

    /**
     * Close the window when it is open, otherwise open it.
     * @param {object} [options]  Constructor options for `open`
     * @returns {ApplicationV2|null} the opened window, or null when it was closed
     */
    static toggle(options) {
      const app = this.instance;
      if (app?.rendered) {
        app.close();
        return null;
      }
      return this.open(options);
    }

    /**
     * Re-render the open window (no-op when closed).
     * @param {string[]} [parts]  HandlebarsApplication parts to re-render
     */
    static refresh(parts) {
      const app = this.instance;
      if (app?.rendered) app._gatosRefresh(parts);
    }

    /**
     * Re-render hook used by `refresh`; override to debounce or keep local state.
     * @param {string[]} [parts]
     * @protected
     */
    _gatosRefresh(parts) {
      return this.render(parts?.length ? { parts } : {});
    }

    /**
     * Register on render as well as in `open()`: `close()` and `render()` share one queue, so a window
     * re-opened during its close animation renders again after `_onClose` already dropped it from the
     * registry. Without this a second instance with the same element id could be created.
     * @override
     */
    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      SINGLETONS.set(this.constructor, this);
    }

    /** @override */
    _onClose(options) {
      super._onClose(options);
      if (SINGLETONS.get(this.constructor) === this) SINGLETONS.delete(this.constructor);
    }
  };
}

/* -------------------------------------------- */
/*  Per document                                */
/* -------------------------------------------- */

/** @type {WeakMap<Function, Map<string, ApplicationV2>>} */
const REGISTRIES = new WeakMap();
/** Document key of each window opened through PerDocumentMixin.open(). @type {WeakMap<object, string>} */
const KEYS = new WeakMap();

function registry(cls) {
  let map = REGISTRIES.get(cls);
  if (!map) REGISTRIES.set(cls, (map = new Map()));
  return map;
}

/**
 * One window per document. Windows are keyed by `DEFAULT_OPTIONS.gatos.keyFn(doc)` (default `doc.uuid`).
 * New windows are built by `static createFor(doc, options)` — default `new this({ ...options, document: doc })`;
 * override it when the constructor takes the document differently. Give the class an id containing `{id}`
 * (or set one per document in `createFor`) so two windows never share an element id.
 * ported from VIT collective-panel.js:58,121-148, VN expression-config.js:18-49,268-271, CRF module.js:19-28
 * @template {typeof foundry.applications.api.ApplicationV2} T
 * @param {T} Base
 * @returns {T}
 */
export function PerDocumentMixin(Base) {
  return class GatosPerDocument extends PersistPositionMixin(Base) {

    /** @type {Map<string, ApplicationV2>} open windows of this class by key */
    static get instances() {
      return registry(this);
    }

    /**
     * Registry key of a document.
     * @param {object} doc
     * @returns {string|null}
     */
    static keyFor(doc) {
      if (!doc) return null;
      const fn = gatosOptions(this).keyFn;
      return (fn ? fn(doc) : doc.uuid) ?? null;
    }

    /**
     * Build a new window for a document. Override when the constructor signature differs.
     * @param {object} doc
     * @param {object} [options]
     * @returns {ApplicationV2}
     */
    static createFor(doc, options = {}) {
      return new this({ ...options, document: doc });
    }

    /**
     * The open window of a document, if any.
     * @param {object} doc
     * @returns {ApplicationV2|null}
     */
    static instanceFor(doc) {
      return this.instances.get(this.keyFor(doc)) ?? null;
    }

    /**
     * Create the document's window or bring the open one to the front.
     * @param {object} doc
     * @param {object} [options]  Options for `createFor` (creation only)
     * @returns {ApplicationV2|null}
     */
    static open(doc, options = {}) {
      const key = this.keyFor(doc);
      if (key === null) return null;
      let app = this.instances.get(key);
      if (!app) {
        app = this.createFor(doc, options);
        KEYS.set(app, key); // WeakMap, not a private field: createFor may return an instance of another class
        this.instances.set(key, app);
      }
      if (app.rendered) {
        if (app.minimized) app.maximize();
        bringToFront(app);
      } else {
        app.render({ force: true });
      }
      return app;
    }

    /**
     * Close the document's window when open, otherwise open it.
     * @param {object} doc
     * @param {object} [options]
     * @returns {ApplicationV2|null}
     */
    static toggle(doc, options) {
      const app = this.instanceFor(doc);
      if (app?.rendered) {
        app.close();
        return null;
      }
      return this.open(doc, options);
    }

    /**
     * Re-render every open window that shows the document (see `showsDocument`).
     * @param {object} doc
     * @param {string[]} [parts]
     */
    static refreshFor(doc, parts) {
      for (const app of this.instances.values()) {
        if (app.rendered && app.showsDocument(doc)) app._gatosRefresh(parts);
      }
    }

    /**
     * Re-render every open window of this class.
     * @param {string[]} [parts]
     */
    static refreshAll(parts) {
      for (const app of this.instances.values()) if (app.rendered) app._gatosRefresh(parts);
    }

    /**
     * Close the document's window (e.g. from a delete hook).
     * @param {object} doc
     * @returns {Promise<ApplicationV2>|undefined}
     */
    static closeFor(doc) {
      return this.instanceFor(doc)?.close();
    }

    /**
     * Whether this window displays the document. Default: same registry key. Override to also match related
     * documents (VIT refreshes a leader's panel when any member changes).
     * @param {object} doc
     * @returns {boolean}
     */
    showsDocument(doc) {
      const key = KEYS.get(this) ?? null;
      return key !== null && key === this.constructor.keyFor(doc);
    }

    /**
     * Re-render hook used by `refreshFor` / `refreshAll`; override to debounce or keep unsaved edits.
     * @param {string[]} [parts]
     * @protected
     */
    _gatosRefresh(parts) {
      return this.render(parts?.length ? { parts } : {});
    }

    /** Re-register on render (see SingletonMixin#_onFirstRender for why). @override */
    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      const key = KEYS.get(this);
      if (key !== undefined && key !== null) registry(this.constructor).set(key, this);
    }

    /** @override */
    _onClose(options) {
      super._onClose(options);
      const map = REGISTRIES.get(this.constructor);
      const key = KEYS.get(this) ?? null;
      if (map && key !== null && map.get(key) === this) map.delete(key);
    }
  };
}

/* -------------------------------------------- */
/*  Forms                                       */
/* -------------------------------------------- */

/**
 * The element holding a dialog's inputs, found from a clicked button.
 * ported from PP party-panel.js:527 (#dialogRoot), HP hero-points.js:131, HM module.js:222
 * @param {HTMLElement} button
 * @returns {HTMLElement|null}
 */
export function dialogRoot(button) {
  if (!button) return null;
  return button.form ?? button.closest?.("form") ?? button.closest?.("dialog") ?? button.closest?.(".application") ?? null;
}

/**
 * Find the <form> behind a form, a button / input inside it, a jQuery wrapper, or an application.
 * @param {*} target
 * @returns {HTMLFormElement|null}
 */
function formOf(target) {
  if (!target) return null;
  let element = htmlRoot(target);
  if (!element && typeof target === "object") element = htmlRoot(target.form) ?? htmlRoot(target.element);
  if (!element) return null;
  if (element instanceof HTMLFormElement) return element;
  return (
    element.form ??
    element.closest("form") ??
    element.querySelector("form") ??
    element.closest("dialog, .application")?.querySelector("form") ??
    null
  );
}

/**
 * Read a form into a plain object with FormDataExtended, plus the post-processing the gatos modules repeat:
 * - groups of same-name checkboxes with `value` attributes become the list of checked values (unchecked
 *   entries, which FormDataExtended reports as null, are dropped);
 * - `multi` names are always arrays (one checked box, or none, still yields an array);
 * - `csv` names are split on commas, trimmed, empties dropped (`{ src: "dest" }` renames the field);
 * - `expand` runs foundry.utils.expandObject for dotted names.
 * Multi-selects are arrays already (FormDataExtended reads `select-multiple`).
 * ported from CT viewer.js:802 readRangeForm, CRF dialog.js:209 #readForm, MM dialog.js:122 _readForm,
 * HM module.js:222-226 (keep list + CSV extra)
 * @param {HTMLFormElement|HTMLElement|ApplicationV2|JQuery} target  A form, a button in it, or an application
 * @param {object} [options]
 * @param {string[]} [options.multi]                         Names that must be arrays
 * @param {string[]|Record<string, string>} [options.csv]    Names holding comma-separated lists
 * @param {boolean} [options.expand=false]                   Expand dotted keys into nested objects
 * @returns {object}
 */
export function readForm(target, { multi = [], csv = [], expand = false } = {}) {
  const form = formOf(target);
  if (!form) return {};
  const FDE = impl.FormDataExtended();
  const data = { ...new FDE(form).object };

  // Checkbox groups: keep the checked values only.
  for (const [name, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue;
    const field = form.elements.namedItem(name);
    if (field instanceof RadioNodeList && Array.from(field).every((f) => f.type === "checkbox")) {
      data[name] = value.filter((v) => v !== null && v !== undefined);
    }
  }

  for (const name of multi) {
    const value = data[name];
    if (Array.isArray(value)) continue;
    data[name] = value === null || value === undefined || value === "" || value === false ? [] : [value];
  }

  const csvMap = Array.isArray(csv) ? Object.fromEntries(csv.map((n) => [n, n])) : csv ?? {};
  for (const [src, dest] of Object.entries(csvMap)) {
    if (!(src in data)) continue;
    const raw = data[src];
    const list = (Array.isArray(raw) ? raw.join(",") : String(raw ?? ""))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (dest !== src) delete data[src];
    data[dest] = list;
  }

  return expand ? foundry.utils.expandObject(data) : data;
}
