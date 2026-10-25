/**
 * Gato's Library — DOM / HTML helpers with no Foundry dependency.
 * Safe to import in Node and inline into exported pages: the DOM is only used when it exists,
 * with a regex fallback otherwise. Nothing here reads Foundry globals.
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape text for HTML content and attribute values. */
// ported from gatos-visual-novel player-core.js
export const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * Create an element.
 * attrs: `class` / `cls` (string or array), `text`, `html`, `dataset` {}, `style` (string or {}),
 * `on` { event: handler }, `doc` (Document to create in; defaults to the global document).
 * Any other key becomes an attribute: false / null / undefined are skipped, true sets an empty attribute.
 * children: a node, a string or an array of them (null / false skipped).
 */
// ported from gatos-visual-novel stage-dom.js / player-core.js
export function el(tag, attrs = {}, children = []) {
  const { doc: ownerDoc, class: klass, cls, text, html, dataset, style, on, ...rest } = attrs ?? {};
  const doc = ownerDoc ?? (typeof document !== "undefined" ? document : null);
  if (!doc) throw new Error("el() needs a document");
  const e = doc.createElement(tag);
  const className = klass ?? cls;
  if (className) e.className = Array.isArray(className) ? className.filter(Boolean).join(" ") : String(className);
  for (const [k, v] of Object.entries(rest)) {
    if (v === false || v == null) continue;
    e.setAttribute(k, v === true ? "" : String(v));
  }
  if (dataset) for (const [k, v] of Object.entries(dataset)) if (v != null) e.dataset[k] = String(v);
  if (typeof style === "string") e.setAttribute("style", style);
  else if (style) Object.assign(e.style, style);
  if (on) for (const [type, fn] of Object.entries(on)) if (fn) e.addEventListener(type, fn);
  if (html != null) e.innerHTML = html;
  else if (text != null) e.textContent = String(text);
  for (const child of [children].flat(Infinity)) {
    if (child == null || child === false) continue;
    e.append(typeof child === "object" ? child : doc.createTextNode(String(child)));
  }
  return e;
}

/* -------------------------------------------- */
/*  HTML → text                                 */
/* -------------------------------------------- */

const hasParser = () => typeof DOMParser !== "undefined";

/** Parse a fragment into an inert container (DOMParser documents never load images or run handlers). */
function parseFragment(html) {
  const doc = new DOMParser().parseFromString(`<div id="gatos-root">${html}</div>`, "text/html");
  return doc.getElementById("gatos-root");
}

const BLOCK_TAGS = new Set(["P", "DIV", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "TR", "TABLE", "SECTION", "HEADER", "FOOTER", "BLOCKQUOTE", "PRE", "HR"]);
const BLOCK_RE = "p|div|li|ul|ol|h[1-6]|tr|table|section|header|footer|blockquote|pre|hr";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Regex fallback: drop every element whose class list contains cls, nested same-tag children included. */
function removeByClass(html, cls) {
  const open = new RegExp(`<([a-z][a-z0-9-]*)\\b[^>]*\\bclass\\s*=\\s*(["'])(?:(?!\\2).)*\\b${cls}\\b(?:(?!\\2).)*\\2[^>]*>`, "i");
  let out = html;
  for (let m = open.exec(out); m; m = open.exec(out)) {
    const tag = m[1];
    const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
    tagRe.lastIndex = m.index + m[0].length;
    let depth = 1;
    let end = out.length;
    for (let t = tagRe.exec(out); t; t = tagRe.exec(out)) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) {
        end = t.index + t[0].length;
        break;
      }
    }
    out = out.slice(0, m.index) + out.slice(end);
  }
  return out;
}

function stripScripts(html) {
  return html.replace(/<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, "");
}

/** Remove every `.dice-tooltip` block from rendered chat HTML (keeps the rest of the markup). */
// ported from gatos-visual-novel player-core.js
export function stripTooltips(html) {
  if (!html || !/dice-tooltip/.test(html)) return html ?? "";
  if (!hasParser()) return removeByClass(String(html), "dice-tooltip");
  const root = parseFragment(html);
  root.querySelectorAll(".dice-tooltip").forEach((e) => e.remove());
  return root.innerHTML;
}

/**
 * HTML fragment → plain text. Dice tooltips, scripts and styles are dropped.
 * Default: one line with whitespace collapsed (gatos-visual-novel player-core.js).
 * multiline: block elements and <br> become line breaks, table cells tabs (gatos-chat-tools export.js htmlToText).
 */
export function plainText(html, { multiline = false } = {}) {
  if (!html) return "";
  html = String(html);
  let text;
  if (hasParser()) {
    const root = parseFragment(html);
    root.querySelectorAll(".dice-tooltip, script, style, template").forEach((e) => e.remove());
    if (multiline) {
      root.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      root.querySelectorAll("td, th").forEach((c) => c.append("\t"));
      root.querySelectorAll("*").forEach((e) => {
        if (BLOCK_TAGS.has(e.tagName)) {
          e.prepend("\n");
          e.append("\n");
        }
      });
    }
    text = root.textContent ?? "";
  } else {
    let s = stripScripts(removeByClass(html, "dice-tooltip"));
    if (multiline) {
      s = s
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(td|th)\s*>/gi, "\t$&")
        .replace(new RegExp(`</?(?:${BLOCK_RE})\\b[^>]*>`, "gi"), "\n$&\n");
    }
    text = decodeEntities(s.replace(/<[^>]*>/g, ""));
  }
  if (!multiline) return text.replace(/\s+/g, " ").trim();
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
