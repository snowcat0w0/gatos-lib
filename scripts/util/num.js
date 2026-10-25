/**
 * Gato's Library — value coercion and number formatting. Pure (no Foundry globals).
 */

/** Finite number, or fallback for "", null, undefined, NaN and ±Infinity. */
// ported from gatos monster-maker builder.js
export function num(v, fallback = 0) {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Finite number, or null for empty / invalid input. */
// ported from gatos monster-maker builder.js
export function numOrNull(v) {
  return num(v, null);
}

/** Form-friendly boolean: true, "true", "on", 1 and "1" are true; everything else false. */
// ported from gatos monster-maker builder.js
export function bool(v) {
  return v === true || v === "true" || v === "on" || v === 1 || v === "1";
}

/** String, with null / undefined as "". */
// ported from gatos monster-maker builder.js
export function str(v) {
  return v === null || v === undefined ? "" : String(v);
}

/** Array as-is; index-keyed objects ({0: a, 1: b}, as expanded form data) as an ordered array; else []. */
// ported from gatos monster-maker builder.js
export function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.keys(v).sort((a, b) => Number(a) - Number(b)).map((k) => v[k]);
  return [];
}

/** Clamp n into [min, max]. */
// ported from gatos hero-points hero-points.js
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/** value / max as a rounded 0..100 percentage; 0 when max is not positive. */
// ported from gatos party-panel party-panel.js
export function clampPct(value, max) {
  if (!(max > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

/** "+3" / "-2" / "+0". */
// ported from gatos party-panel party-panel.js
export function signed(n) {
  n = Number(n ?? 0);
  return (n >= 0 ? "+" : "") + n;
}

/**
 * Format a number for display.
 * Without a locale: integers as-is, otherwise at most `decimals` places with trailing zeros dropped (1.50 → "1.5").
 * With a locale: Number#toLocaleString(locale) capped at `decimals` fraction digits.
 */
// ported from gatos item-crafting crafter.js (fmt) and gatos party-panel party-panel.js (fmt)
export function fmtNumber(n, { locale, decimals = 2 } = {}) {
  const v = Number(n ?? 0);
  if (locale) return v.toLocaleString(locale, { maximumFractionDigits: decimals });
  if (Number.isInteger(v)) return String(v);
  if (!Number.isFinite(v)) return String(v);
  return v.toFixed(decimals).replace(/\.?0+$/, "");
}
