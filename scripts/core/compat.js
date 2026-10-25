/**
 * gatos-lib — Foundry version shims.
 *
 * Every Foundry-version dependent lookup lives here; code elsewhere must not branch on
 * game.release.generation directly. Seeded from VN scripts/compat.js and extended
 * with the fallbacks scattered across the other gatos-* modules.
 *
 * Nothing here runs at import time: every lookup is a function so the namespaces are read lazily.
 *
 * Provenance notes use the PLAN §3 module abbreviations: BF buff-finder, PP party-panel, VIT vitalist,
 * CRF item-crafting, LT light, HP hero-points, MM monster-maker, CT chat-tools, VN visual-novel,
 * HM header-menu, TC turn-control, CK coc7-ko.
 */

/** Major Foundry generation (12, 13, ...). Defaults to 13 before `game.release` exists. */
export const generation = () => game.release?.generation ?? 13;

/**
 * Resolve a configurable class: `Cls.implementation` (the CONFIG override) when the class offers one,
 * else the class itself, else the legacy global of the same name.
 * ported from PP party-panel.js:31, VIT collective-panel.js:43
 * @param {Function|undefined} cls
 * @param {string} legacy  Name of the pre-v13 global
 * @returns {Function|undefined}
 */
function resolve(cls, legacy) {
  return cls?.implementation ?? cls ?? globalThis[legacy];
}

/**
 * Lazy class lookups. Call them (`new (impl.FilePicker())(...)`), never cache them at import time.
 */
export const impl = {
  /** @returns {typeof foundry.applications.ux.TextEditor} */
  TextEditor: () => resolve(foundry.applications?.ux?.TextEditor, "TextEditor"),
  /** @returns {typeof foundry.applications.apps.FilePicker} */
  FilePicker: () => resolve(foundry.applications?.apps?.FilePicker, "FilePicker"),
  /** @returns {typeof foundry.applications.ux.DragDrop} */
  DragDrop: () => resolve(foundry.applications?.ux?.DragDrop, "DragDrop"),
  /** @returns {typeof foundry.applications.ux.FormDataExtended} */
  FormDataExtended: () => resolve(foundry.applications?.ux?.FormDataExtended, "FormDataExtended"),
  /** @returns {typeof foundry.applications.ux.ContextMenu} */
  ContextMenu: () => resolve(foundry.applications?.ux?.ContextMenu, "ContextMenu"),
  /** @returns {typeof foundry.applications.apps.ImagePopout} */
  ImagePopout: () => resolve(foundry.applications?.apps?.ImagePopout, "ImagePopout"),
  /** Legacy AppV1 base class.  ported from HM module.js:61,331 */
  ApplicationV1: () => foundry.appv1?.api?.Application ?? globalThis.Application,
};

/**
 * Render a Handlebars template (v13 namespace, legacy global fallback).
 * @param {string} path
 * @param {object} [data]
 * @returns {Promise<string>}
 */
export function renderTemplate(path, data = {}) {
  const fn = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  return fn(path, data);
}

/**
 * Preload Handlebars templates (v13 namespace, legacy global fallback).
 * ported from CRF module.js:43
 * @param {string[]|Record<string, string>} paths
 * @returns {Promise<Function[]>}
 */
export function loadTemplates(paths) {
  const fn = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
  return fn(paths);
}

/**
 * Normalise the `html` argument of render hooks: AppV2 passes an HTMLElement, AppV1 a jQuery object.
 * @param {HTMLElement|JQuery|null|undefined} html
 * @returns {HTMLElement|null}
 */
export function htmlRoot(html) {
  return html instanceof HTMLElement ? html : html?.[0] ?? null;
}

/**
 * Hook names that differ between sheet frameworks or Foundry versions.
 * - actorSheetHeader: AppV1 sheets (game-system sheets that still use AppV1) vs AppV2 actor sheets
 * - actorContext: actor directory context menu (v13: `get${documentName}ContextOptions`)
 * - journalRender: AppV2 journal sheet (v13) and the AppV1 one (v12)
 */
export const HOOKS = Object.freeze({
  actorSheetHeader: Object.freeze({ v1: "getActorSheetHeaderButtons", v2: "getHeaderControlsActorSheetV2" }),
  actorContext: "getActorContextOptions",
  journalRender: Object.freeze(["renderJournalEntrySheet", "renderJournalSheet"]),
  sceneControls: "getSceneControlButtons",
  tokenHud: "renderTokenHUD",
});

/**
 * Open a journal entry's sheet, optionally on a page. Accepts the entry, one of its pages, or a uuid.
 * v13 takes `render({force, pageId})`, v12 `render(true, {pageId})`.
 * ported from CK scripts/module.js:6-23 (branch), PP party-panel.js:433 (page → parent)
 * @param {JournalEntry|JournalEntryPage|string} doc
 * @param {string} [pageId]
 * @returns {Promise<Application|null>} the sheet that was rendered
 */
export async function renderJournalPage(doc, pageId) {
  if (typeof doc === "string") doc = await fromUuid(doc);
  if (!doc) return null;
  let entry = doc;
  if (doc.documentName === "JournalEntryPage") {
    entry = doc.parent;
    pageId ??= doc.id;
  }
  const sheet = entry?.sheet;
  if (!sheet) return null;
  if (generation() >= 13) await sheet.render({ force: true, pageId });
  else await sheet.render(true, { pageId });
  return sheet;
}

/**
 * Raise a window above the others. AppV2 has `bringToFront`, AppV1 `bringToTop` (AppV2 keeps a deprecated
 * `bringToTop` alias, so the check must not call both).
 * ported from BF buff-finder.js:97
 * @param {Application|ApplicationV2} app
 */
export function bringToFront(app) {
  if (!app) return;
  if (typeof app.bringToFront === "function") return app.bringToFront();
  return app.bringToTop?.();
}

/**
 * Where full-screen overlays are attached: inside #interface, measured against the sidebar (right) and
 * the hotbar (bottom) so neither is covered.  ported from VN compat.js
 * @returns {{parent: HTMLElement, sidebar: HTMLElement|null, hotbar: HTMLElement|null}}
 */
export function mountPoint() {
  const parent = document.getElementById("interface") ?? document.body;
  return {
    parent,
    sidebar: document.getElementById("sidebar"),
    hotbar: document.getElementById("hotbar"),
  };
}

/** Is this chat log application a popout (separate window) rather than the sidebar tab?  ported from VN compat.js */
export function isChatPopout(app) {
  return !!(app?.isPopout ?? app?.options?.popOut ?? app?.popOut);
}
