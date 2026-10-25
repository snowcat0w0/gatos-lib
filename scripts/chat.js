/**
 * Chat helpers: cards, markers, speakers, message context menus, chat-controls buttons and the
 * chat UI re-render hook set. Nothing here runs at import time; every hook is registered by a call.
 */
import { htmlRoot } from "./core/compat.js";
import { esc } from "./ui/dom.js";

const Msg = () => ChatMessage.implementation;

/* -------------------------------------------- */
/*  Speakers & recipients                       */
/* -------------------------------------------- */

/** Speaker data for a user without a character (what core builds for "speaking as yourself"). */
function userSpeaker(user, alias) {
  return { scene: canvas?.scene?.id ?? null, actor: null, token: null, alias: alias || user?.name || "" };
}

// ported from gatos-turn-control chat.js speakerFor
/**
 * Speaker data for a combatant, actor, token (document or placeable) or user.
 * Combatants speak with their token and their combatant name (so hidden-name tokens stay hidden).
 * Anything else falls back to core's inferred speaker.
 * @param {Combatant|Actor|TokenDocument|Token|User|null} doc
 * @param {{alias?: string}} [options]
 * @returns {object} ChatSpeakerData
 */
export function speakerFor(doc, { alias } = {}) {
  if (!doc) return Msg().getSpeaker(alias ? { alias } : {});
  if (doc instanceof foundry.canvas.placeables.Token) doc = doc.document;
  switch (doc.documentName) {
    case "Combatant":
      return Msg().getSpeaker({ actor: doc.actor, token: doc.token, alias: alias ?? doc.name });
    case "Token":
      return Msg().getSpeaker({ token: doc, alias });
    case "Actor":
      return Msg().getSpeaker({ actor: doc, alias });
    case "User":
      return userSpeaker(doc, alias);
    default:
      return Msg().getSpeaker(alias ? { alias } : {});
  }
}

/**
 * Resolve a whisper option to user ids.
 * `null` = public; "gm" = every GM; "owners" = GMs and the actor's owners; a User/id array as given;
 * any other string is looked up by core (user name, character name, "players").
 * @param {null|"gm"|"owners"|string|Array<User|string>} whisper
 * @param {Actor|null} [actor]
 * @returns {string[]|null}
 */
export function resolveWhisper(whisper, actor = null) {
  if (whisper == null || whisper === false) return null;
  let users;
  if (Array.isArray(whisper)) users = whisper.map((u) => (typeof u === "string" ? u : u?.id));
  else if (whisper === "gm") users = Msg().getWhisperRecipients("GM").map((u) => u.id);
  else if (whisper === "owners") users = game.users.filter((u) => u.isGM || actor?.testUserPermission(u, "OWNER")).map((u) => u.id);
  else if (typeof whisper === "string") users = Msg().getWhisperRecipients(whisper).map((u) => u.id);
  else return null;
  return [...new Set(users.filter(Boolean))];
}

/* -------------------------------------------- */
/*  Cards                                       */
/* -------------------------------------------- */

// ported from gatos-turn-control chat.js post(); also replaces the card builders of the hero-points, item-crafting (postChat), vitalist (8 sites) and buff-finder (apply.js postChat) modules
/**
 * Post a module chat card:
 * `<div class="gatos-card {cls}"><header><i class="{icon}" inert></i> {title}</header>{body}</div>`.
 * The header is left out when neither icon nor title is given. `title` and `body` are HTML.
 * @param {object} mod                       Module handle (`mod.id` namespaces the flags).
 * @param {object} options
 * @param {Actor} [options.actor]            Speak as this actor (and its token).
 * @param {object} [options.speaker]         Explicit speaker data (wins over actor/user).
 * @param {User} [options.user]              Post on behalf of this user (sets `author`; GM-side relays).
 * @param {string} [options.icon]            Font Awesome classes.
 * @param {string} [options.title]
 * @param {string} [options.body=""]
 * @param {string} [options.cls]             Card class, default `${mod.id}-card`.
 * @param {string} [options.headerTag="header"]  e.g. "h3" for cards styled on an `h3` title.
 * @param {object} [options.flags={}]        Stored as `flags[mod.id]`.
 * @param {null|"gm"|"owners"|string|Array<User|string>} [options.whisper=null]
 * @param {Roll[]} [options.rolls]
 * @param {number} [options.style]           CONST.CHAT_MESSAGE_STYLES value.
 * @param {object} [options.messageData]     Extra ChatMessage data merged last (sound, blind …).
 * @returns {Promise<ChatMessage|undefined>}
 */
export function postCard(mod, { actor, speaker, user, icon, title, body = "", cls, headerTag = "header", flags = {}, whisper = null, rolls, style, messageData = {} } = {}) {
  cls ??= `${mod.id}-card`;
  const head = icon || title ? `<${headerTag}>${icon ? `<i class="${esc(icon)}" inert></i> ` : ""}${title ?? ""}</${headerTag}>` : "";
  const data = {
    content: `<div class="gatos-card ${esc(cls)}">${head}${body}</div>`,
    speaker: speaker ?? (actor ? speakerFor(actor) : user ? userSpeaker(user) : Msg().getSpeaker()),
    flags: { [mod.id]: flags },
  };
  if (user) data.author = user.id;
  const ids = resolveWhisper(whisper, actor);
  if (ids) data.whisper = ids;
  if (rolls?.length) data.rolls = rolls;
  if (style !== undefined) data.style = style;
  if (messageData) foundry.utils.mergeObject(data, messageData);
  return Msg().create(data);
}

// ported from gatos-chat-tools session.js postMarker
/**
 * Post a system-style marker message (no actor, `style: OTHER`), e.g. session start/end.
 * @param {object} mod
 * @param {{alias: string, content: string, flags?: object, whisper?: any}} options
 * @returns {Promise<ChatMessage|undefined>}
 */
export function postMarker(mod, { alias, content, flags = {}, whisper = null } = {}) {
  const data = {
    content,
    speaker: { scene: null, actor: null, token: null, alias: alias ?? "" },
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    flags: { [mod.id]: flags },
  };
  const ids = resolveWhisper(whisper);
  if (ids) data.whisper = ids;
  return Msg().create(data);
}

// ported from gatos-chat-tools archive.js renderMessageContent
/**
 * Render a message and return the inner HTML of its `.message-content` (falls back to the raw content).
 * Note: `renderHTML` fires every module's `renderChatMessageHTML` hook on the detached element, so other
 * modules' injected buttons may end up in the result; strip them in the caller when exporting.
 * @param {ChatMessage} message
 * @returns {Promise<string>}
 */
export async function renderMessageContent(message) {
  try {
    const node = htmlRoot(await message.renderHTML({ canDelete: false, canClose: false }));
    const content = node?.querySelector(".message-content");
    return content ? content.innerHTML : node?.innerHTML ?? message.content ?? "";
  } catch (err) {
    console.warn(`gatos-lib | failed to render message ${message?.id}`, err);
    return message?.content ?? "";
  }
}

/* -------------------------------------------- */
/*  Message lookup & context menus              */
/* -------------------------------------------- */

// ported from gatos-chat-tools edit.js / bookmarks.js / reorder.js
/**
 * The ChatMessage for a chat log element (the `li`, any element inside it, or a jQuery wrapper).
 * @param {HTMLElement|jQuery} li
 * @returns {ChatMessage|null}
 */
export function messageOf(li) {
  const el = htmlRoot(li);
  const id = el?.dataset?.messageId ?? el?.closest?.("[data-message-id]")?.dataset.messageId;
  return id ? game.messages.get(id) ?? null : null;
}

// ported from gatos-chat-tools edit.js / bookmarks.js / reorder.js context options
/**
 * Push a getChatMessageContextOptions entry whose condition/callback receive the ChatMessage instead
 * of the `li`. A condition that throws hides the entry. `icon` may be HTML or bare FA classes.
 * @param {object[]} options  The hook's options array.
 * @param {{name: string, icon?: string, group?: string, classes?: string,
 *          condition?: (message: ChatMessage, li: HTMLElement) => boolean,
 *          callback: (message: ChatMessage, li: HTMLElement) => any}} entry
 * @returns {object} The pushed entry.
 */
export function pushMessageContextOption(options, { name, icon, group, classes, condition, callback }) {
  const entry = {
    name,
    icon: icon && !icon.includes("<") ? `<i class="${esc(icon)}"></i>` : icon ?? "",
    condition: (li) => {
      const message = messageOf(li);
      if (!message) return false;
      try {
        return condition ? !!condition(message, htmlRoot(li)) : true;
      } catch {
        return false;
      }
    },
    callback: (li) => {
      const message = messageOf(li);
      if (message) return callback(message, htmlRoot(li));
    },
  };
  if (group) entry.group = group;
  if (classes) entry.classes = classes;
  options.push(entry);
  return entry;
}

/* -------------------------------------------- */
/*  Chat logs                                   */
/* -------------------------------------------- */

/** The rendered ChatLog applications: the sidebar tab and, when open, its popout. */
export function chatLogs() {
  return [ui.chat, ui.chat?.popout].filter((app) => app?.rendered && app.element);
}

// ported from gatos-chat-tools grouping.js regroupAll / reorder.js placeMessageElement
/** Every `.chat-log` list on the page except the notifications area (sidebar and popout). */
export function chatLogElements() {
  return [...document.querySelectorAll(".chat-log")].filter((log) => !log.closest("#chat-notifications"));
}

// ported from gatos-chat-tools edit.js rerenderVisibleMessages
/**
 * Re-render every chat message currently in the DOM (after a setting that changes their look).
 * `ui.chat.updateMessage` also updates the popout.
 * @param {(message: ChatMessage) => boolean} [filter]
 */
export function rerenderVisibleMessages(filter) {
  const seen = new Set();
  for (const li of document.querySelectorAll(".chat-message[data-message-id]")) {
    const id = li.dataset.messageId;
    if (seen.has(id)) continue;
    seen.add(id);
    const message = game.messages.get(id);
    if (message && (!filter || filter(message))) ui.chat?.updateMessage(message);
  }
}

// ported from gatos-chat-tools viewer.js #onJumpTo
/**
 * Scroll the chat log to a message and flash it; when it is not rendered in the log, open it in a popout.
 * @param {string} id
 * @param {{flashClass?: string, duration?: number, popout?: boolean}} [options]
 * @returns {boolean} true when the message was found in a log.
 */
export function jumpToMessage(id, { flashClass = "gatos-flash", duration = 1600, popout = true } = {}) {
  const message = game.messages.get(id);
  if (!message) return false;
  for (const app of chatLogs()) {
    const li = app.element.querySelector(`.chat-message[data-message-id="${id}"]`);
    if (!li) continue;
    li.scrollIntoView({ block: "center" });
    if (flashClass) {
      li.classList.add(flashClass);
      setTimeout(() => li.classList.remove(flashClass), duration);
    }
    return true;
  }
  if (popout) new CONFIG.ChatMessage.popoutClass({ message }).render({ force: true });
  return false;
}

/* -------------------------------------------- */
/*  Chat UI injection                           */
/* -------------------------------------------- */

// ported from gatos-chat-tools viewer.js injectChatButton, images.js injectUploadButton, whisper.js injectWhisperButton, gatos-visual-novel stage.js injectToggleButton
/**
 * Add a `button.ui-control.icon` to `#chat-controls`, once (the first class of `cls` is the marker).
 * Returns the button (new or existing) so callers can update its state, or null when the bar is missing.
 * @param {object} options
 * @param {string} options.cls               Marker class(es), e.g. "gct-open-viewer".
 * @param {string} options.icon              Font Awesome classes.
 * @param {string} [options.label]           aria-label; core shows it as the tooltip.
 * @param {(ev: MouseEvent, btn: HTMLButtonElement) => any} [options.onClick]
 * @param {(ev: MouseEvent, btn: HTMLButtonElement) => any} [options.onContextMenu]  Right click (default prevented).
 * @param {"append"|"prepend"|{after?: string, before?: string, fallback?: "append"|"prepend"}} [options.position="append"]
 * @param {HTMLElement} [options.controls]   The bar (renderChatInput passes it); default `#chat-controls`.
 * @returns {HTMLButtonElement|null}
 */
export function addChatControl({ cls, icon, label = "", onClick, onContextMenu, position = "append", controls } = {}) {
  controls ??= document.getElementById("chat-controls");
  if (!controls || !cls) return null;
  const marker = String(cls).trim().split(/\s+/)[0];
  const existing = controls.querySelector(`button.${CSS.escape(marker)}`);
  if (existing) return existing;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ui-control icon ${icon ?? ""} ${cls}`.replace(/\s+/g, " ").trim();
  btn.dataset.tooltip = "";
  if (label) btn.setAttribute("aria-label", label);
  if (onClick) {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      onClick(ev, btn);
    });
  }
  if (onContextMenu) {
    btn.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      onContextMenu(ev, btn);
    });
  }

  if (position === "prepend") controls.prepend(btn);
  else if (position && typeof position === "object") {
    const anchor = position.after ? controls.querySelector(position.after) : position.before ? controls.querySelector(position.before) : null;
    if (anchor && position.after) anchor.after(btn);
    else if (anchor) anchor.before(btn);
    else if (position.fallback === "prepend") controls.prepend(btn);
    else controls.append(btn);
  } else controls.append(btn);
  return btn;
}

const delayOf = (v, dflt) => (v === true ? dflt : Number.isFinite(v) ? v : null);

// ported from gatos-chat-tools speaker-bar.js / whisper.js / images.js / module.js hook sets, gatos-visual-novel stage.js
/**
 * Run `fn` whenever the chat input UI is (re)built: `renderChatInput`, `renderChatLog` and, deferred,
 * `collapseSidebar` (the input moves between the sidebar, the popout and the notifications area).
 * Hooks are registered immediately with `Hooks.on`, so several callers run in the order they called
 * `onChatUiRender` (bars mounted above the textarea depend on that order). Deferred calls with the same
 * delay keep that order too.
 * @param {(ctx: {hook: string, app: Application|null, input: HTMLTextAreaElement|null, controls: HTMLElement|null}) => any} fn
 * @param {object} [options]
 * @param {boolean|number} [options.deferCollapse=true]  collapseSidebar delay in ms (true = 50, false = not hooked).
 * @param {boolean|number} [options.defer=false]         Also defer the render hooks (true = 0 ms).
 * @returns {() => void} Unregisters the hooks (and drops pending deferred calls).
 */
export function onChatUiRender(fn, { deferCollapse = true, defer = false } = {}) {
  let active = true;
  const run = (hook, app, elements) => {
    if (!active) return;
    fn({
      hook,
      app: app ?? null,
      input: elements?.["#chat-message"] ?? document.getElementById("chat-message"),
      controls: elements?.["#chat-controls"] ?? document.getElementById("chat-controls"),
    });
  };
  const schedule = (ms) => (hook, app, elements) => (ms === null ? run(hook, app, elements) : setTimeout(() => run(hook, app, elements), ms));
  const renderRun = schedule(delayOf(defer, 0));
  const ids = [
    ["renderChatInput", Hooks.on("renderChatInput", (app, elements) => renderRun("renderChatInput", app, elements))],
    ["renderChatLog", Hooks.on("renderChatLog", (app) => renderRun("renderChatLog", app))],
  ];
  const collapseMs = delayOf(deferCollapse, 50);
  if (deferCollapse !== false) {
    const collapseRun = schedule(collapseMs ?? 0);
    ids.push(["collapseSidebar", Hooks.on("collapseSidebar", () => collapseRun("collapseSidebar", ui.chat))]);
  }
  return () => {
    active = false;
    for (const [hook, id] of ids) Hooks.off(hook, id);
  };
}

// ported from gatos-chat-tools edit.js makeButton, bookmarks.js, token-hud.js reply button
/**
 * A message-metadata icon button: `<a class="{cls}"><i class="{icon}" inert></i></a>`.
 * The click does not reach the chat log's own handlers.
 * @param {{cls: string, icon: string, label?: string, onClick?: (ev: MouseEvent) => any}} options
 * @returns {HTMLAnchorElement}
 */
export function metadataButton({ cls, icon, label = "", onClick } = {}) {
  const a = document.createElement("a");
  a.className = cls ?? "";
  if (label) {
    a.dataset.tooltip = label;
    a.setAttribute("aria-label", label);
  }
  a.innerHTML = `<i class="${esc(icon ?? "")}" inert></i>`;
  a.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    onClick?.(ev);
  });
  return a;
}
