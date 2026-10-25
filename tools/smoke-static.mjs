#!/usr/bin/env node
/**
 * Static smoke snapshot of a gatos module, for the "before / after library migration" diff (PLAN §7.0).
 *
 *   node --experimental-default-type=module tools/smoke-static.mjs <module dir> [out.json]
 *   (the flag lets Node load a module folder that has no package.json "type":"module")
 *
 * Stubs just enough of Foundry to import the module's esmodules, fire `init`, and record:
 *   - settings registered under the module id (scope, type name, default, name/hint keys, choices, range)
 *   - settings menus registered
 *   - `game.modules.get(id).api` keys
 *   - hook names registered (Hooks.on / Hooks.once) with counts
 *   - lang keys referenced by the code that do not resolve in lang/ko.json: full literals ("PF1HP.Chat.Gain"),
 *     library short keys (L("Chat.Gain") / mod.notify.warn("Warn.X") prefixed with the defineModule langPrefix),
 *     and dynamic patterns (`Effect.${key}.Name`) checked as wildcards
 * Import runs with `game = { view }` like a real page load, so import-time `game.*` reads fail here as in Foundry.
 * It cannot run UI or documents; it is a structural check, not a behaviour test.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = path.resolve(process.argv[2] ?? ".");
const out = process.argv[3];
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "module.json"), "utf8"));
const id = manifest.id;

/* ---------------- Foundry stubs ---------------- */
const settings = {};
const menus = {};
const keybindings = {};
const hooks = {};
const api = {};
const hookFns = { init: [], ready: [], setup: [] };

const typeName = (t) => (typeof t === "function" ? t.name : t && typeof t === "object" ? t.constructor?.name ?? "object" : String(t));
const plain = (v) => (typeof v === "function" ? `[fn ${v.name}]` : v);

globalThis.Hooks = {
  on: (name, fn) => {
    hooks[name] = (hooks[name] ?? 0) + 1;
    if (hookFns[name]) hookFns[name].push(fn);
    return Object.keys(hooks).length;
  },
  once: (name, fn) => globalThis.Hooks.on(name, fn),
  off: () => {},
  callAll: () => {},
  call: () => true,
};
const moduleRecord = { id, active: true, api: undefined, version: manifest.version };
const libRecords = new Map([[id, moduleRecord]]);
for (const r of manifest.relationships?.requires ?? []) libRecords.set(r.id, { id: r.id, active: true, version: "0.0.0" });
globalThis.game = {
  modules: { get: (mid) => libRecords.get(mid) },
  settings: {
    settings: new Map(),
    register: (mid, key, cfg) => {
      if (mid !== id) return;
      settings[key] = {
        scope: cfg.scope,
        config: cfg.config,
        type: typeName(cfg.type),
        default: plain(cfg.default),
        name: cfg.name,
        hint: cfg.hint,
        ...(cfg.choices ? { choices: cfg.choices } : {}),
        ...(cfg.range ? { range: cfg.range } : {}),
        ...(cfg.requiresReload ? { requiresReload: true } : {}),
        ...(cfg.onChange ? { onChange: true } : {}),
      };
      globalThis.game.settings.settings.set(`${mid}.${key}`, cfg);
    },
    registerMenu: (mid, key, cfg) => {
      if (mid !== id) return;
      menus[key] = { name: cfg.name, label: cfg.label, hint: cfg.hint, icon: cfg.icon, restricted: cfg.restricted, type: typeName(cfg.type) };
    },
    get: (mid, key) => globalThis.game.settings.settings.get(`${mid}.${key}`)?.default,
    set: async () => {},
  },
  i18n: { localize: (k) => k, format: (k) => k, lang: "ko", has: () => true },
  user: { id: "u", isGM: true, isActiveGM: true },
  users: { get: () => null, activeGM: null, filter: () => [] },
  system: { id: manifest.relationships?.systems?.[0]?.id ?? "none", version: "0" },
  release: { generation: 13 },
  socket: { on: () => {}, emit: () => {} },
  keybindings: { register: (mid, key, cfg) => { if (mid === id) keybindings[key] = { name: cfg.name, hint: cfg.hint, editable: cfg.editable, restricted: cfg.restricted }; } },
  packs: [],
  items: { fromCompendium: (d) => d },
  combat: null,
  time: { worldTime: 0 },
};
globalThis.ui = { notifications: { info() {}, warn() {}, error() {} }, controls: null, chat: null };
globalThis.canvas = { ready: false, tokens: { controlled: [] }, scene: null };
globalThis.CONST = {
  CHAT_MESSAGE_STYLES: { OTHER: 0, OOC: 1, IC: 2, EMOTE: 3 },
  KEYBINDING_PRECEDENCE: { PRIORITY: 0, NORMAL: 1, DEFERRED: 2 },
  TOKEN_DISPLAY_MODES: { NONE: 0, CONTROL: 10, OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50 },
  TOKEN_DISPOSITIONS: { SECRET: -2, HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 },
  DOCUMENT_OWNERSHIP_LEVELS: { INHERIT: -1, NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 },
};
class Stub {}
globalThis.foundry = {
  utils: {
    escapeHTML: (s) => String(s),
    deepClone: (o) => structuredClone(o),
    mergeObject: (a, b) => Object.assign(a, b),
    setProperty: (o, p, v) => {
      const parts = p.split(".");
      let cur = o;
      for (const k of parts.slice(0, -1)) cur = cur[k] ??= {};
      cur[parts.at(-1)] = v;
      return true;
    },
    getProperty: (o, p) => p.split(".").reduce((c, k) => c?.[k], o),
    hasProperty: (o, p) => p.split(".").reduce((c, k) => c?.[k], o) !== undefined,
    isEmpty: (o) => !o || Object.keys(o).length === 0,
    isNewerVersion: () => false,
    randomID: () => "x".repeat(16),
    debounce: (fn) => fn,
    expandObject: (o) => o,
    flattenObject: (o) => o,
    saveDataToFile: () => {},
  },
  applications: {
    api: { DialogV2: Stub, ApplicationV2: Stub, HandlebarsApplicationMixin: (B) => B },
    ux: { TextEditor: Stub, DragDrop: Stub, FormDataExtended: Stub, ContextMenu: Stub },
    apps: { FilePicker: Stub, ImagePopout: Stub },
    handlebars: { renderTemplate: async () => "", loadTemplates: async () => {} },
    sheets: {},
    instances: new Map(),
  },
  appv1: { api: { Application: Stub } },
  dice: { Roll: Stub },
  canvas: { placeables: { Token: Stub } },
  abstract: { Document: Stub },
};
globalThis.ChatMessage = { implementation: { create: async () => {}, getSpeaker: () => ({}), getWhisperRecipients: () => [] } };
globalThis.ActiveEffect = Stub;
globalThis.Roll = Stub;
globalThis.RollPF = Stub;
globalThis.pf1 = { config: {}, registry: { conditions: new Map() } };
globalThis.CONFIG = { statusEffects: [], TextEditor: { enrichers: [] }, Item: { documentClasses: {} }, Actor: { documentClass: Stub }, Combat: { documentClass: Stub }, Combatant: { documentClass: Stub }, specialStatusEffects: { DEFEATED: "dead" }, Canvas: { lightAnimations: {} } };
globalThis.document = undefined;
globalThis.window = { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) }; // chat-tools token-hud.js listens at import
globalThis.fromUuid = async () => null;
globalThis.fromUuidSync = () => null;
globalThis.loadTemplates = async () => {};
globalThis.renderTemplate = async () => "";
globalThis.libWrapper = undefined;

/* ---------------- import + init ---------------- */
// Import the module the way Foundry does: `<script type="module">` tags run before the Game instance exists, when
// `globalThis.game` is only `{ view }` and `game.i18n` / `game.settings` are undefined. Anything the module reads from
// `game` at import time therefore throws here too (the full stub is restored before `init` fires).
const fullGame = globalThis.game;
globalThis.game = { view: "game" };
for (const es of manifest.esmodules ?? []) await import(pathToFileURL(path.join(dir, es)).href);
globalThis.game = fullGame;
// Hooks may touch the DOM (chat-tools chitchat.js sets CSS variables in init): a minimal document for the hook phase only.
globalThis.document = { documentElement: { style: { setProperty() {}, removeProperty() {} } }, body: { classList: { add() {}, remove() {}, toggle() {} } }, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, classList: { add() {} }, setAttribute() {}, append() {} }), addEventListener() {}, removeEventListener() {} };
// Keep stdout pure JSON: the libraries log "ready" lines from their init hooks.
const log = console.log;
console.log = () => {};
for (const fn of hookFns.init) await fn();
for (const fn of hookFns.setup) await fn();
console.log = log;
if (moduleRecord.api) Object.assign(api, moduleRecord.api);

/* ---------------- lang key check ---------------- */
const langPath = (manifest.languages ?? []).find((l) => l.lang === "ko")?.path ?? "lang/ko.json";
let lang = {};
try {
  lang = JSON.parse(fs.readFileSync(path.join(dir, langPath), "utf8"));
} catch {
  /* module without a lang file (spirit-totem, coc7-free-occupation): every key counts as unresolved */
}
const flat = new Set();
(function rec(o, p) {
  for (const [k, v] of Object.entries(o)) v && typeof v === "object" ? rec(v, `${p}${k}.`) : flat.add(`${p}${k}`);
})(lang, "");
const prefixes = [...new Set([...flat].map((k) => k.split(".")[0]))];
const literal = new Set();
const dynamic = new Set();
// langPrefix of defineModule(id, { langPrefix }) calls: L("Chat.Gain") → "<prefix>.Chat.Gain"
const langPrefixes = new Set();
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const KEY = "[A-Za-z0-9_.{}$]+";
const Q = "[\"'`]";
const sources = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(m?js|hbs)$/.test(e.name)) sources.push(stripComments(fs.readFileSync(p, "utf8")));
  }
};
walk(path.join(dir, "scripts"));
if (fs.existsSync(path.join(dir, "templates"))) walk(path.join(dir, "templates"));
// First pass: collect every langPrefix, so short keys resolve whatever the file order is.
for (const src of sources) for (const m of src.matchAll(/defineModule\([^)]*?langPrefix:\s*["']([^"']+)["']/g)) langPrefixes.add(m[1]);
const addKey = (k) => (k.includes("${") ? dynamic : literal).add(k);
for (const src of sources) {
  for (const pre of prefixes) {
    const escPre = pre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const m of src.matchAll(new RegExp(`${Q}(${escPre}\\.${KEY})${Q}`, "g"))) addKey(m[1]);
    for (const m of src.matchAll(new RegExp(`\\{\\{\\s*localize\\s+"(${escPre}\\.[^"]+)"`, "g"))) addKey(m[1]);
  }
  // Library-style short keys: L("Key"), mod.L("Key"), mod.notify.warn("Key") → prefixed with every langPrefix seen
  for (const m of src.matchAll(new RegExp(`(?:\\bL|\\.L|notify\\.(?:info|warn|error))\\(\\s*${Q}(${KEY})${Q}`, "g"))) {
    for (const pre of langPrefixes) addKey(`${pre}.${m[1]}`);
  }
}
// Settings name/hint keys produced by the (possibly declarative) registration:
for (const s of Object.values(settings)) for (const k of [s.name, s.hint]) if (k) literal.add(k);
for (const m of Object.values(menus)) for (const k of [m.name, m.label, m.hint]) if (k) literal.add(k);
for (const kb of Object.values(keybindings)) for (const k of [kb.name, kb.hint]) if (k) literal.add(k);
const unresolved = [...literal].filter((k) => !flat.has(k)).sort();
/** `A.${x}.B` → /^A\.[^.]+\.B$/ ; unmatched when no lang key fits */
const wildcard = (pat) => {
  const parts = pat.split(/\$\{[^}]*\}/g).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${parts.join("[^.]+")}$`);
};
const dynamicUnmatched = [...dynamic].filter((pat) => ![...flat].some((k) => wildcard(pat).test(k))).sort();

/* ---------------- namespace member check ---------------- */
// Named imports from "./lib.js" fail at ESM link time when missing, but `pf1lib.X` / `pure.X` property reads
// resolve to undefined silently. Verify every such member against the libraries' actual exports.
const exportsOf = (indexFile) => {
  const names = new Set();
  const root = path.dirname(indexFile);
  const idx = fs.readFileSync(indexFile, "utf8");
  const collect = (src) => {
    for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) for (const n of m[1].split(",")) { const name = n.split(/\s+as\s+/).pop().trim(); if (name) names.add(name); }
  };
  collect(idx);
  for (const m of idx.matchAll(/export \* from "\.\/(.+?)"/g)) collect(fs.readFileSync(path.join(root, m[1]), "utf8"));
  return names;
};
const namespaceMisses = [];
const shimPath = path.join(dir, "scripts", "lib.js");
if (fs.existsSync(shimPath)) {
  const shim = fs.readFileSync(shimPath, "utf8");
  for (const m of shim.matchAll(/export \* as (\w+) from "([^"]+)"/g)) {
    const [, ns, rel] = m;
    const names = exportsOf(path.resolve(path.dirname(shimPath), rel));
    const use = new RegExp(`\\b${ns}\\.([A-Za-z_$][\\w$]*)`, "g");
    for (const src of sources) for (const u of src.matchAll(use)) if (!names.has(u[1])) namespaceMisses.push(`${ns}.${u[1]}`);
  }
}
const namespaceUnknown = [...new Set(namespaceMisses)].sort();

const snapshot = {
  module: id,
  version: manifest.version,
  requires: (manifest.relationships?.requires ?? []).map((r) => r.id),
  settings: Object.fromEntries(Object.entries(settings).sort()),
  menus,
  keybindings,
  api: Object.keys(api).sort(),
  hooks: Object.fromEntries(Object.entries(hooks).sort()),
  langPrefixes: [...langPrefixes],
  langUnresolved: unresolved,
  langDynamicPatterns: [...dynamic].sort(),
  langDynamicUnmatched: dynamicUnmatched,
  namespaceUnknown,
};
const json = JSON.stringify(snapshot, null, 2);
if (out) fs.writeFileSync(out, json);
console.log(json);
