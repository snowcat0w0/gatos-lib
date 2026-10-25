/**
 * Gato's Library — text helpers.
 * Pure except localizeMaybe, which reads game.i18n when it exists.
 */

/**
 * Lower-case, accent-free, whitespace-collapsed text for matching.
 * Apostrophes are dropped so "Bull's Strength" matches "bulls strength".
 */
// ported from gatos buff-finder catalog.js
export function normalize(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2019'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lower-case ASCII letters and digits only; parenthesised parts are dropped ("Guardian (Ex)" → "guardian"). */
// ported from gatos vitalist collective.js
export function slug(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Trimmed, lower-case, single-spaced text. */
// ported from gatos item-crafting crafter.js
export function norm(text) {
  return (text ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

/** Turn "@UUID[...]{Label}" / "@Distance[30 ft;dual]" / "[[1d4]]" into plain text. */
// ported from gatos buff-finder catalog.js
export function stripEnrichers(text) {
  return String(text ?? "")
    .replace(/@(\w+)\[([^\]]*)\](?:\{([^}]*)\})?/g, (m, type, inner, label) => {
      if (label) return label;
      if (type === "UUID" || type === "Compendium") return "";
      return inner.split(";")[0];
    })
    .replace(/\[\[(?:\/\w+\s*)?|\]\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Localize a key that may be a string, a `{ label }` object or empty.
 * Returns "" for empty input and the key itself when no i18n is available (Node, before init).
 */
// ported from gatos buff-finder catalog.js
export function localizeMaybe(key) {
  if (!key) return "";
  if (typeof key === "object") key = key.label ?? "";
  if (!key) return "";
  key = String(key);
  const i18n = globalThis.game?.i18n;
  return i18n ? i18n.localize(key) : key;
}

/** Escape a string for literal use inside a RegExp. */
// ported from gatos-chat-tools viewer.js
export function escapeRegExp(text) {
  return String(text ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "a, b ,,c" → ["a", "b", "c"]. Arrays are trimmed and filtered the same way. */
// ported from gatos-header-menu module.js / gatos item-crafting crafter.js
export function csvList(value) {
  const parts = Array.isArray(value) ? value : String(value ?? "").split(",");
  return parts.map((s) => String(s ?? "").trim()).filter(Boolean);
}
