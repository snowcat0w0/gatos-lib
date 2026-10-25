/**
 * Gato's Library — hook bundles. Nothing is registered until a function is called;
 * every function returns an `unregister()` that removes exactly what it added.
 */
export { keyedDebounce } from "../pure/fn.js";

/**
 * Register one callback on several hooks.
 * @param {string|string[]} hookNames
 * @param {Function} fn   Receives the hook's own arguments.
 * @returns {() => void}  unregister
 */
export function onAll(hookNames, fn) {
  const ids = [hookNames].flat().map((hook) => [hook, Hooks.on(hook, fn)]);
  return () => {
    for (const [hook, id] of ids) Hooks.off(hook, id);
    ids.length = 0;
  };
}

/** Register `[hook, fn]` pairs and return one unregister for all. */
function onPairs(pairs) {
  const offs = pairs.map(([hook, fn]) => onAll(hook, fn));
  return () => offs.forEach((off) => off());
}

/**
 * Call `fn(reason, ...hookArgs)` whenever this user's selection, targets or character may have changed.
 * `reason` is "selected" (controlToken), "targeted" (targetToken by this user), "canvas" (canvasReady)
 * or "character" (this user's assigned character changed). Debounce in the caller if needed —
 * controlToken fires once per token on group selection.
 * ported from buff-finder module.js:141-165, party-panel module.js:149-178, vitalist module.js:241-302
 * @param {Function} fn
 * @param {object} [options]
 * @param {boolean} [options.selected=true]
 * @param {boolean} [options.targeted=true]
 * @param {boolean} [options.character=true]
 * @returns {() => void}  unregister
 */
export function watchTargets(fn, { selected = true, targeted = true, character = true } = {}) {
  const pairs = [["canvasReady", (...args) => fn("canvas", ...args)]];
  if (selected) pairs.push(["controlToken", (...args) => fn("selected", ...args)]);
  if (targeted) {
    pairs.push(["targetToken", (user, ...args) => {
      if (user?.id === game.user.id) fn("targeted", user, ...args);
    }]);
  }
  if (character) {
    pairs.push(["updateUser", (user, changes, ...args) => {
      if (user?.id === game.user.id && changes && "character" in changes) fn("character", user, changes, ...args);
    }]);
  }
  return onPairs(pairs);
}

/** Actor owning an embedded document (Item / ActiveEffect, also effects on owned items). */
function owningActor(doc) {
  let parent = doc?.parent;
  while (parent) {
    if (parent instanceof Actor) return parent;
    parent = parent.parent;
  }
  return null;
}

/**
 * Call `fn(actor, doc, hookName, ...hookArgs)` on create/update/delete of actors and of the
 * documents that make up an actor: its items, its active effects (directly or through an owned
 * item) and its tokens. Items and effects outside an actor are ignored; for tokens `actor` may be
 * null (token without an actor).
 * ported from party-panel module.js:128-158, vitalist module.js:241-269, turn-control
 * @param {Function} fn
 * @param {object} [options]
 * @param {boolean|string[]} [options.items=true]  true for every item, or only these `item.type`s.
 * @param {boolean} [options.effects=true]
 * @param {boolean} [options.tokens=true]
 * @param {boolean} [options.actors=true]
 * @returns {() => void}  unregister
 */
export function watchActorDocs(fn, { items = true, effects = true, tokens = true, actors = true } = {}) {
  const crud = (name) => ["create", "update", "delete"].map((op) => `${op}${name}`);
  const pairs = [];
  if (actors) {
    for (const hook of crud("Actor")) pairs.push([hook, (actor, ...args) => fn(actor, actor, hook, ...args)]);
  }
  if (items) {
    const types = Array.isArray(items) ? new Set(items) : null;
    for (const hook of crud("Item")) {
      pairs.push([hook, (item, ...args) => {
        if (types && !types.has(item?.type)) return;
        const actor = owningActor(item);
        if (actor) fn(actor, item, hook, ...args);
      }]);
    }
  }
  if (effects) {
    for (const hook of crud("ActiveEffect")) {
      pairs.push([hook, (effect, ...args) => {
        const actor = owningActor(effect);
        if (actor) fn(actor, effect, hook, ...args);
      }]);
    }
  }
  if (tokens) {
    for (const hook of crud("Token")) pairs.push([hook, (token, ...args) => fn(token?.actor ?? null, token, hook, ...args)]);
  }
  return onPairs(pairs);
}
