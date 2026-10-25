/**
 * Game-system adapter registry (placeholder, PLAN §5.2 Tier 2). gatos-lib ships no implementation:
 * a system library registers one for its system id, consumers look it up and keep their own fallback.
 *
 * Adapter shape (from gatos-turn-control systems/index.js; every member optional):
 * @typedef {object} SystemAdapter
 * @property {() => Array<{id: string, label: string, img?: string, default?: boolean}>} [conditions]
 * @property {(id: string) => string} [hint]                       Extra text for a condition id.
 * @property {(actor: Actor) => ({value: number, deathAt?: number}|null)} [getHealth]
 * @property {(actor: Actor, health?: object) => object[]} [hpStateBlockers]  Blockers derived from hit points.
 * @property {(actor: Actor, health?: object) => Promise<any>} [rollStabilize]
 */

const adapters = new Map();

/** Register (or replace) the adapter for a game system id. Returns a function that removes it. */
export function registerSystemAdapter(systemId, adapter) {
  adapters.set(systemId, adapter);
  return () => adapters.get(systemId) === adapter && adapters.delete(systemId);
}

/** The adapter for a system id (default: the running game system), or null. */
export function getAdapter(systemId = game.system?.id) {
  return adapters.get(systemId) ?? null;
}

/** Is an adapter registered for this system id? */
export function hasAdapter(systemId = game.system?.id) {
  return adapters.has(systemId);
}
