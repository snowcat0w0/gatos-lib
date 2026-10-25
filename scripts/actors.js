/**
 * Gato's Library — actor / token resolution, targeting and panning.
 */
import { generation } from "./core/compat.js";

/** Actor from an Actor, a TokenDocument, a Token, or a resolved uuid document. */
function actorOf(doc) {
  if (!doc) return null;
  if (doc instanceof Actor) return doc;
  if (doc.documentName === "Token" || doc.document?.documentName === "Token") return doc.actor ?? null;
  return null;
}

/**
 * Actor from an Actor / Token uuid (unlinked token actors have token-embedded uuids) or a world actor id.
 * ported from light socket.js `resolveActor`, vitalist collective.js:218-229
 * @param {string|Actor|TokenDocument|null} uuidOrId
 * @returns {Promise<Actor|null>}
 */
export async function resolveActor(uuidOrId) {
  if (!uuidOrId) return null;
  if (typeof uuidOrId !== "string") return actorOf(uuidOrId);
  if (uuidOrId.includes(".")) {
    try {
      const actor = actorOf(await fromUuid(uuidOrId));
      if (actor) return actor;
    } catch {
      /* malformed uuid: fall through */
    }
  }
  return game.actors.get(uuidOrId) ?? null;
}

/**
 * Synchronous `resolveActor` for documents already in memory (no compendium lookups).
 * ported from vitalist collective.js:218-229
 * @param {string|Actor|TokenDocument|null} uuidOrId
 * @returns {Actor|null}
 */
export function resolveActorSync(uuidOrId) {
  if (!uuidOrId) return null;
  if (typeof uuidOrId !== "string") return actorOf(uuidOrId);
  if (uuidOrId.includes(".")) {
    try {
      const actor = actorOf(fromUuidSync(uuidOrId));
      if (actor) return actor;
    } catch {
      /* compendium or malformed uuid: fall through */
    }
  }
  return game.actors.get(uuidOrId) ?? null;
}

/**
 * Unique actors of this user's selected or targeted tokens.
 * - "selected": controlled tokens; "targeted": targeted tokens;
 * - "auto": targeted tokens if any, else controlled tokens.
 * When nothing is found in "selected" / "auto" mode, `fallbackCharacter` returns the user's character.
 * ported from buff-finder buff-finder.js:127-140 `getTargetActors`, light use.js:80-84 `recipients`
 * @param {object} [options]
 * @param {"selected"|"targeted"|"auto"} [options.mode="auto"]
 * @param {boolean} [options.fallbackCharacter=true]
 * @returns {Actor[]}
 */
export function resolveTargetActors({ mode = "auto", fallbackCharacter = true } = {}) {
  const controlled = () => (canvas?.ready ? canvas.tokens.controlled : []);
  const targeted = () => Array.from(game.user.targets ?? []);
  let tokens;
  if (mode === "targeted") tokens = targeted();
  else if (mode === "selected") tokens = controlled();
  else {
    tokens = targeted();
    if (!tokens.length) tokens = controlled();
  }
  const actors = new Map();
  for (const token of tokens) {
    const actor = token.actor;
    if (actor) actors.set(actor.uuid, actor);
  }
  const character = game.user.character;
  if (!actors.size && fallbackCharacter && mode !== "targeted" && character) actors.set(character.uuid, character);
  return [...actors.values()];
}

/**
 * Token documents of `actor` in a scene. A synthetic (token) actor yields its own token; a world
 * actor yields every token of it, linked or not. With `visibleOrOwned`, only tokens this user can
 * see (rendered token visible, or not hidden off-canvas) or owns.
 * ported from party-panel party-panel.js:148-151, vitalist collective.js:420-424, light sources.js `actorTokenDocs`
 * @param {Actor} actor
 * @param {object} [options]
 * @param {Scene|null} [options.scene=canvas.scene]
 * @param {boolean} [options.visibleOrOwned=true]
 * @returns {TokenDocument[]}
 */
export function tokensFor(actor, { scene = globalThis.canvas?.scene ?? null, visibleOrOwned = true } = {}) {
  if (!actor || !scene) return [];
  const docs = actor.isToken
    ? scene.tokens.filter((t) => t === actor.token)
    : scene.tokens.filter((t) => t.actorId === actor.id);
  if (!visibleOrOwned) return docs;
  return docs.filter((t) => t.isOwner || (t.object ? t.object.visible : !t.hidden));
}

/**
 * Set this user's targets on the current canvas.
 * v13: `canvas.tokens.setTargets(ids, { mode })` (client/canvas/layers/tokens.mjs); v12 fallback below.
 * ported from party-panel party-panel.js:44-62, vitalist collective.js:426-439
 * @param {string[]|Set<string>} tokenIds  Token ids on the current scene.
 * @param {object} [options]
 * @param {"replace"|"acquire"|"release"} [options.mode="replace"]
 * @returns {boolean} false when the canvas is not ready.
 */
export function setTargets(tokenIds, { mode = "replace" } = {}) {
  if (!canvas?.ready) return false;
  const ids = Array.from(tokenIds ?? []);
  if (generation() >= 13) {
    canvas.tokens.setTargets(ids, { mode });
    return true;
  }
  const user = game.user;
  if (mode === "replace") {
    user.updateTokenTargets(ids);
    return true;
  }
  for (const id of ids) {
    canvas.tokens.get(id)?.setTarget(mode === "acquire", { user, releaseOthers: false, groupSelection: true });
  }
  user.broadcastActivity({ targets: user.targets.ids });
  return true;
}

/** Rendered tokens of the actor on the current canvas. */
function canvasTokens(actor) {
  if (!canvas?.ready) return [];
  return tokensFor(actor).map((t) => t.object).filter(Boolean);
}

/**
 * Toggle targeting of all the actor's tokens on the current canvas.
 * ported from party-panel party-panel.js:161-173
 * @param {Actor} actor
 * @param {object} [options]
 * @param {boolean} [options.exclusive=false]  Target only this actor (releases other targets).
 * @param {boolean|null} [options.state=null]  Force a target state instead of toggling.
 * @returns {boolean|null} whether the actor is targeted afterwards; null when it has no token here
 *   (the caller decides how to notify).
 */
export function toggleTargetActor(actor, { exclusive = false, state = null } = {}) {
  const tokens = canvasTokens(actor);
  if (!tokens.length) return null;
  const ids = tokens.map((t) => t.id);
  const anyTargeted = tokens.some((t) => game.user.targets.has(t));
  const target = state ?? (exclusive ? true : !anyTargeted);
  if (exclusive) setTargets(target ? ids : [], { mode: "replace" });
  else setTargets(ids, { mode: target ? "acquire" : "release" });
  return target;
}

/**
 * Pan the canvas to the actor's first visible token, controlling it when owned.
 * ported from party-panel party-panel.js:176-185, vitalist collective-panel.js:280-283
 * @param {Actor} actor
 * @param {object} [options]
 * @param {boolean} [options.control=true]  Control the token (releasing others) if this user owns it.
 * @param {number} [options.duration=250]
 * @returns {Token|null} the token panned to; null when the actor has no token here.
 */
export function panToActor(actor, { control = true, duration = 250 } = {}) {
  const token = canvasTokens(actor)[0];
  if (!token) return null;
  if (control && token.isOwner) token.control({ releaseOthers: true });
  canvas.animatePan({ x: token.center.x, y: token.center.y, duration });
  return token;
}

/** Sort comparator by `name` in the client language. */
export function byName(a, b) {
  return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), game.i18n.lang);
}
