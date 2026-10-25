/**
 * gatos-lib — small DOM helpers for Foundry-side UI code.
 * `el` and `debounce` are the Foundry-free versions from pure/; this file adds the ones that need `foundry`.
 */
export { el } from "../pure/dom.js";
export { debounce } from "../pure/fn.js";

/**
 * Escape a value for HTML text or attribute use. `null`/`undefined` become "".
 * ported from LT sheet.js:9, CT esc
 * @param {*} s
 * @returns {string}
 */
export function esc(s) {
  return foundry.utils.escapeHTML(String(s ?? ""));
}

/** KeyboardEvent / MouseEvent flag for each modifier key name. */
const MODIFIER_FLAGS = { Shift: "shiftKey", Control: "ctrlKey", Ctrl: "ctrlKey", Alt: "altKey", Meta: "metaKey" };

/**
 * Toggle a CSS class on an element while a modifier key is held, e.g. to show that Shift-click skips a
 * confirmation (BF: Shift on the remove button skips the confirm dialog). Listens on `window` and stops by
 * itself once the element has left the DOM; call the returned function to stop earlier.
 * @param {HTMLElement} element
 * @param {object} options
 * @param {"Shift"|"Control"|"Alt"|"Meta"} [options.key="Shift"]
 * @param {string} options.cls  Class to toggle
 * @returns {() => void} stop listening
 */
export function trackModifierClass(element, { key = "Shift", cls } = {}) {
  if (!element || !cls) return () => {};
  const flag = MODIFIER_FLAGS[key] ?? "shiftKey";
  let seen = element.isConnected;
  const set = (on) => element.classList.toggle(cls, !!on);
  const onEvent = (event) => {
    if (element.isConnected) seen = true;
    else if (seen) return stop();
    set(event[flag]);
  };
  const onBlur = () => set(false);
  const stop = () => {
    window.removeEventListener("keydown", onEvent, true);
    window.removeEventListener("keyup", onEvent, true);
    window.removeEventListener("pointermove", onEvent, { capture: true });
    window.removeEventListener("blur", onBlur);
    set(false);
  };
  window.addEventListener("keydown", onEvent, true);
  window.addEventListener("keyup", onEvent, true);
  // Re-sync when the key was pressed or released while another window had focus.
  window.addEventListener("pointermove", onEvent, { capture: true, passive: true });
  window.addEventListener("blur", onBlur);
  return stop;
}
