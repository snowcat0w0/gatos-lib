/**
 * Gato's Library — local date/time formatting. Pure (no Foundry globals).
 * Every function takes a timestamp (ms) or anything `new Date()` accepts.
 */
// ported from gatos-chat-tools constants.js, reorder.js (toLocalInput) and export.js (stamp)

/** Left-pad a number with zeros (default width 2). */
export const pad = (n, width = 2) => String(n).padStart(width, "0");

/** yyyy-mm-dd */
export function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** yyyy-mm-dd HH:MM:SS */
export function fmtDateTime(ts) {
  const d = new Date(ts);
  return `${fmtDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** HH:MM */
export function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Start of the local day containing ts. */
export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** End of the local day containing ts. */
export function endOfDay(ts) {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Parse an <input type="date"> value (yyyy-mm-dd) as a local date; null when empty or invalid. */
export function parseDateInput(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

/** "YYYY-MM-DDTHH:MM:SS" in local time, for <input type="datetime-local" step="1">. */
export function toLocalInput(ts) {
  const d = new Date(ts);
  return `${fmtDate(ts)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Compact file-name stamp: "yyyymmdd", or "yyyymmdd-HHMM" with withTime. Defaults to now. */
export function stamp(withTime = false, ts = Date.now()) {
  const d = new Date(ts);
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return withTime ? `${date}-${pad(d.getHours())}${pad(d.getMinutes())}` : date;
}
