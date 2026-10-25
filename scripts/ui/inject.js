/**
 * gatos-lib — injecting buttons and sections into core UI (scene controls, sheet headers, token HUD,
 * directory headers, sheets).
 *
 * Functions that register hooks return an unregister function. Functions taking `(app, html)` are meant to be
 * called from the consumer's own render hook and accept either an HTMLElement or a jQuery object.
 * Everything is idempotent: a marker class (`cls`) or action prevents duplicates on re-render.
 *
 * Provenance: BF buff-finder, PP party-panel, VIT vitalist, CRF item-crafting, VN visual-novel, LT light,
 * HP hero-points, MM monster-maker, TC turn-control (PLAN §3 abbreviations).
 */
import { HOOKS, htmlRoot } from "../core/compat.js";

/** Localize a lang key; already-localized text passes through (no "key not defined" debug log). */
const loc = (s) => (!s ? "" : game.i18n.has?.(String(s)) === false ? String(s) : game.i18n.localize(String(s)));
const classList = (c) => (Array.isArray(c) ? c : String(c ?? "").split(/\s+/)).filter(Boolean);
/** CSS selector matching an element carrying every class of `cls`. */
const classSelector = (cls) => classList(cls).map((c) => `.${CSS.escape(c)}`).join("");

/**
 * Register a hook and return its unregister function.
 * @param {string} hook
 * @param {Function} fn
 * @returns {() => void}
 */
function on(hook, fn) {
  const id = Hooks.on(hook, fn);
  return () => Hooks.off(hook, id);
}

/** The document shown by a sheet (AppV2 `document`, AppV1 `object` / `actor` / `item`). */
function sheetDocument(app) {
  return app?.document ?? app?.object ?? app?.actor ?? app?.item ?? null;
}

/* -------------------------------------------- */
/*  Buttons                                     */
/* -------------------------------------------- */

/**
 * Build a small icon button for HUDs, trackers and bars. Clicks do not bubble (preventDefault +
 * stopPropagation) and double-clicks do not reach the row underneath (TC: combatant double-click opens the sheet).
 * ported from TC tracker.js:7-22 makeButton, LT drop.js:142-153 make, BF module.js:119-133
 * @param {object} options
 * @param {string|string[]} [options.classes]  Button classes, e.g. "control-icon my-mod-hud"
 * @param {string} [options.icon]    Icon classes for an inner <i> (omit when the icon classes are in `classes`)
 * @param {string} [options.label]   Tooltip / aria-label (lang key or text)
 * @param {string} [options.text]    Visible text after the icon
 * @param {boolean} [options.active=false]  Adds the "active" class
 * @param {(event: MouseEvent) => void} [options.onClick]
 * @returns {HTMLButtonElement}
 */
export function makeControlButton({ classes, icon, label, text, active = false, onClick } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.classList.add(...classList(classes));
  if (active) btn.classList.add("active");
  if (label) {
    btn.dataset.tooltip = label;
    btn.setAttribute("aria-label", loc(label));
  }
  if (icon) {
    const i = document.createElement("i");
    i.className = icon;
    i.inert = true;
    btn.append(i);
  }
  if (text) {
    const span = document.createElement("span");
    span.textContent = loc(text);
    btn.append(" ", span);
  }
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(event);
  });
  btn.addEventListener("dblclick", (event) => event.stopPropagation());
  return btn;
}

/* -------------------------------------------- */
/*  Scene controls                              */
/* -------------------------------------------- */

/**
 * Add a tool to a scene control layer. Handles the v13 record shape (`controls[layer].tools[name] = tool`,
 * callback `onChange(event, active)`) and the v12 array shape (`controls.find(c => c.name === layer).tools.push`,
 * callback `onClick(active)`). Only the callback of the running version is set: v13 calls a deprecated `onClick`
 * in addition to `onChange`, so setting both (as BF/PP/VIT did) fires twice.
 * ported from BF module.js:89-109, PP module.js:98-118, VIT module.js:217-235
 * @param {object} options
 * @param {string} [options.layer="tokens"]  Control name; "tokens" and "token" are tried both ways
 * @param {string} options.name     Tool id, unique in the layer
 * @param {string} options.title    Lang key or text
 * @param {string} options.icon
 * @param {number} [options.order]  Default: after the existing tools
 * @param {(event: Event|null, active: boolean) => void} options.onClick
 * @param {boolean|(() => boolean)} [options.visible=true]
 * @param {boolean} [options.toggle=false]  On/off toggle instead of a one-shot button
 * @param {boolean|(() => boolean)} [options.active=false]  Initial toggle state
 * @returns {() => void} unregister
 */
export function addSceneControlTool({ layer = "tokens", name, title, icon, order, onClick, visible = true, toggle = false, active = false } = {}) {
  const names = [...new Set([layer, layer.endsWith("s") ? layer.slice(0, -1) : `${layer}s`])];
  const evaluate = (v) => (typeof v === "function" ? !!v() : !!v);
  // Toggle state for a plain boolean `active`: the hook re-runs on every controls reset
  // (`render({reset:true})`), so the last state must survive or the button snaps back to its initial value.
  let last = typeof active === "function" ? null : !!active;
  const remember = (fn) => (event, state) => {
    if (toggle && typeof active !== "function") last = !!state;
    return fn?.(event, state);
  };

  const off = on(HOOKS.sceneControls, (controls) => {
    const tool = {
      name,
      title,
      icon,
      visible: evaluate(visible),
      button: !toggle,
      toggle: !!toggle,
    };
    if (toggle) tool.active = typeof active === "function" ? evaluate(active) : last;
    if (Array.isArray(controls)) {
      // Foundry v12: array of controls, tools are arrays, buttons use onClick(active)
      const control = controls.find((c) => names.includes(c.name));
      if (!control?.tools || control.tools.some((t) => t.name === name)) return;
      tool.order = order ?? control.tools.length;
      tool.onClick = (state) => remember(onClick)(null, toggle ? !!state : true);
      control.tools.push(tool);
    } else {
      // Foundry v13: record keyed by control name, tools are a record, callbacks are onChange(event, active)
      const control = names.map((n) => controls?.[n]).find((c) => c?.tools);
      if (!control || control.tools[name]) return;
      tool.order = order ?? Object.keys(control.tools).length;
      tool.onChange = remember(onClick);
      control.tools[name] = tool;
    }
  });

  refreshSceneControls();
  return () => {
    off();
    refreshSceneControls();
  };
}

/** Rebuild the scene controls when they are already on screen (late registration / unregister). */
function refreshSceneControls() {
  const controls = globalThis.ui?.controls;
  if (!controls?.rendered) return;
  if (Array.isArray(controls.controls)) controls.initialize?.(); // v12
  else controls.render({ reset: true });
}

/* -------------------------------------------- */
/*  Actor sheet header                          */
/* -------------------------------------------- */

/**
 * Add a header button to actor sheets of both frameworks:
 * - AppV1 sheets (`getActorSheetHeaderButtons`): `{ label, class: cls, icon, onclick }`, duplicate guard by class;
 * - AppV2 sheets (`getHeaderControlsActorSheetV2`): `{ action, icon, label, onClick }`, duplicate guard by action.
 * `cls` is required, module-unique and stable: gatos-header-menu decides keep/hide for AppV1 buttons by their
 * class and stores it in its known-button list.
 * ported from CRF module.js:66-89, VIT module.js:189-212, VN expression-config.js:287-309, MM module.js:33-44
 * @param {object} mod  Module handle (used for error logging)
 * @param {object} options
 * @param {string} [options.action]  AppV2 control action (default: `cls`)
 * @param {string} options.cls       AppV1 button class
 * @param {string} options.icon
 * @param {string|{v1?: string, v2?: string}} options.label  Lang key or text; an object gives each framework its own
 * @param {(actor: Actor, sheet: Application) => boolean} [options.condition]
 * @param {(actor: Actor, sheet: Application, event: Event) => void} options.onClick
 * @param {"start"|"end"|{v1?: "start"|"end", v2?: "start"|"end"}} [options.position="start"]  Insert before or after
 *   the existing buttons; an object gives each framework its own (VN: AppV1 unshift, AppV2 push)
 * @returns {() => void} unregister
 */
export function addActorSheetHeaderButton(mod, { action, cls, icon, label, condition, onClick, position = "start" } = {}) {
  if (!cls) throw new Error(`${mod?.id ?? "gatos-lib"} | addActorSheetHeaderButton requires a unique "cls"`);
  const actionName = action ?? cls;
  const per = (value, which, dflt) => (value && typeof value === "object" ? value[which] ?? dflt : value ?? dflt);
  const insert = (list, entry, which) => (per(position, which, "start") === "end" ? list.push(entry) : list.unshift(entry));

  const actorOf = (sheet) => {
    const doc = sheet?.actor ?? sheet?.document ?? sheet?.object;
    return doc?.documentName === "Actor" ? doc : null;
  };
  const allowed = (actor, sheet) => {
    if (!actor) return false;
    if (!condition) return true;
    try {
      return !!condition(actor, sheet);
    } catch (err) {
      mod?.error?.(`header button "${cls}" condition failed`, err);
      return false;
    }
  };

  const offV1 = on(HOOKS.actorSheetHeader.v1, (sheet, buttons) => {
    const actor = actorOf(sheet);
    if (!Array.isArray(buttons) || !allowed(actor, sheet) || buttons.some((b) => b.class === cls)) return;
    insert(buttons, { label: loc(per(label, "v1", "")), class: cls, icon, onclick: (event) => onClick?.(actor, sheet, event) }, "v1");
  });
  const offV2 = on(HOOKS.actorSheetHeader.v2, (sheet, controls) => {
    const actor = actorOf(sheet);
    if (!Array.isArray(controls) || !allowed(actor, sheet) || controls.some((c) => c.action === actionName)) return;
    insert(controls, { action: actionName, icon, label: per(label, "v2", ""), onClick: (event) => onClick?.(actor, sheet, event) }, "v2");
  });
  return () => {
    offV1();
    offV2();
  };
}

/* -------------------------------------------- */
/*  Token HUD                                   */
/* -------------------------------------------- */

/**
 * Add a button to a column of the token HUD (`.col.left` / `.col.right`).
 * ported from BF module.js:114-136, LT drop.js:131-158
 * @param {object} options
 * @param {"left"|"right"} [options.side="right"]
 * @param {string} options.cls      Marker class (duplicate guard), added next to "control-icon"
 * @param {string} options.icon
 * @param {string|((token: Token, hud: TokenHUD) => string)} [options.tooltip]  Lang key or text, or a function
 *   evaluated at render time (use this for localized text when registering at import time, before `game.i18n`)
 * @param {(token: Token, hud: TokenHUD) => boolean} [options.condition]
 * @param {(token: Token, hud: TokenHUD, event: MouseEvent) => void} options.onClick
 * @returns {() => void} unregister
 */
export function addTokenHudButton({ side = "right", cls, icon, tooltip, condition, onClick } = {}) {
  if (!cls) throw new Error('gatos-lib | addTokenHudButton requires a marker "cls"');
  return on(HOOKS.tokenHud, (hud, html) => {
    const root = htmlRoot(html);
    const col = root?.querySelector(`.col.${side}`);
    if (!col || col.querySelector(classSelector(cls))) return;
    const token = hud.object;
    if (condition && !condition(token, hud)) return;
    col.append(
      makeControlButton({
        classes: ["control-icon", ...classList(cls)],
        icon,
        // A function is resolved at render time: modules register HUD buttons at import, before game.i18n exists.
        label: typeof tooltip === "function" ? tooltip(token, hud) : tooltip,
        onClick: (event) => onClick?.(token, hud, event),
      })
    );
  });
}

/* -------------------------------------------- */
/*  Directory header                            */
/* -------------------------------------------- */

/**
 * Add a button to a sidebar directory header. Call from the consumer's `render<Directory>` hook.
 * ported from MM module.js:19-31
 * @param {Application} app
 * @param {HTMLElement|JQuery} html
 * @param {object} options
 * @param {string} options.cls    Marker class (duplicate guard)
 * @param {string} [options.icon]
 * @param {string} [options.label]  Lang key or text
 * @param {(event: MouseEvent, app: Application) => void} options.onClick
 * @returns {HTMLButtonElement|null} the new button, or null when absent / already present
 */
export function addDirectoryHeaderButton(app, html, { cls, icon, label, onClick } = {}) {
  const root = htmlRoot(html);
  const bar = root?.querySelector(".directory-header .header-actions") ?? root?.querySelector(".directory-header .action-buttons");
  if (!bar || !cls || bar.querySelector(classSelector(cls))) return null;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.classList.add(...classList(cls));
  if (icon) {
    const i = document.createElement("i");
    i.className = icon;
    i.inert = true;
    btn.append(i);
  }
  if (label) {
    const span = document.createElement("span");
    span.textContent = loc(label);
    btn.append(" ", span);
  }
  btn.addEventListener("click", (event) => onClick?.(event, app));
  bar.append(btn);
  return btn;
}

/* -------------------------------------------- */
/*  Sheet sections                              */
/* -------------------------------------------- */

/**
 * Insert a section into a rendered sheet next to an anchor found by selector. Generic: the caller passes the
 * selector(s) for its game system's sheet layout. Call from the consumer's sheet render hook.
 * ported from LT sheet.js:15-21,111-115 (details tab fieldset), HP sheet.js:6-39 (header box)
 * @param {Application} app
 * @param {HTMLElement|JQuery} html
 * @param {object} options
 * @param {string|string[]} options.tab  Anchor selector, or selectors tried in order
 * @param {string} options.cls           Marker class added to the section (duplicate guard)
 * @param {(doc: object, context: {app: Application, root: HTMLElement, anchor: HTMLElement, editable: boolean})
 *   => HTMLElement|string|null} options.build  Section element or HTML; null skips
 * @param {"append"|"prepend"|"before"|"after"} [options.position="append"]  Relative to the anchor
 * @returns {HTMLElement|null} the inserted section
 */
export function injectSheetSection(app, html, { tab, cls, build, position = "append" } = {}) {
  const root = htmlRoot(html);
  if (!root || !cls || typeof build !== "function") return null;
  if (root.querySelector(classSelector(cls))) return null;
  const selectors = Array.isArray(tab) ? tab : [tab];
  let anchor = null;
  for (const sel of selectors) {
    if (sel && (anchor = root.querySelector(sel))) break;
  }
  if (!anchor) return null;

  const doc = sheetDocument(app);
  const editable = !!(app?.isEditable ?? doc?.isOwner);
  let node = build(doc, { app, root, anchor, editable });
  if (node === null || node === undefined || node === "") return null;
  if (typeof node === "string") {
    const template = document.createElement("template");
    template.innerHTML = node.trim();
    node = template.content.childElementCount === 1 ? template.content.firstElementChild : wrap(template.content);
  }
  if (!(node instanceof HTMLElement)) return null;
  node.classList.add(...classList(cls));

  switch (position) {
    case "prepend":
      anchor.prepend(node);
      break;
    case "before":
      anchor.before(node);
      break;
    case "after":
      anchor.after(node);
      break;
    default:
      anchor.append(node);
  }
  return node;
}

/** Wrap a fragment with several top-level nodes in a <div>. */
function wrap(fragment) {
  const div = document.createElement("div");
  div.append(fragment);
  return div;
}
