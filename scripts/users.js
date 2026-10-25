/**
 * Gato's Library — user / GM / ownership helpers.
 */

/** Whether this client is the active (designated) GM. */
export function isActiveGM() {
  return !!game.user?.isActiveGM;
}

/** Whether any GM is connected. */
export function hasActiveGM() {
  return !!game.users?.activeGM;
}

/** The active GM User, or null. */
export function activeGM() {
  return game.users?.activeGM ?? null;
}

/**
 * Whether this client is a GM that should run world-level chores: the active GM, or any GM
 * while no active GM is designated yet.
 * ported from chat-tools session.js:148
 */
export function isLeadGM() {
  return !!game.user?.isGM && (game.users.activeGM?.isSelf ?? true);
}

/**
 * GM or owner of the document.
 * ported from turn-control canControl, buff-finder gmMayActFor, light socket.js owns
 * @param {User|null} user
 * @param {foundry.abstract.Document|null} doc
 */
export function canControl(user, doc) {
  return !!user && !!doc && (user.isGM || doc.testUserPermission(user, "OWNER"));
}

/**
 * The connected non-GM owner with the lowest id, or null.
 * Core v13 documents have no `activeOwner`; when the game system adds one to the document
 * (some do, on Actor), that getter is used instead so the choice matches the system's own.
 * Ids are compared by code unit, not localeCompare, so every client picks the same user.
 * ported from vitalist module.js `maybeSync` (lowest-id active owner)
 * @param {foundry.abstract.Document} doc
 * @returns {User|null}
 */
export function activeOwnerOf(doc) {
  if (!doc) return null;
  if ("activeOwner" in doc) return doc.activeOwner ?? null;
  return game.users
    .filter((u) => u.active && !u.isGM && doc.testUserPermission(u, "OWNER"))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0] ?? null;
}

/**
 * Whether this client is the one that should write for `doc` (avoids duplicate writes):
 * its active owner, else — with `fallbackGM` — the active GM.
 * ported from light sources.js `isResponsible`, turn-control combat.js:193 (fallbackGM: false)
 * @param {foundry.abstract.Document} doc
 * @param {object} [options]
 * @param {boolean} [options.fallbackGM=true]
 */
export function isResponsibleClient(doc, { fallbackGM = true } = {}) {
  const owner = activeOwnerOf(doc);
  if (owner) return owner.isSelf;
  return fallbackGM && !!game.users.activeGM?.isSelf;
}

/**
 * GM users.
 * ported from chat-tools whisper.js gmUsers
 * @param {object} [options]
 * @param {boolean} [options.activeOnly=false]  Only connected GMs.
 * @returns {User[]}
 */
export function gmUsers({ activeOnly = false } = {}) {
  return game.users.filter((u) => u.isGM && (!activeOnly || u.active));
}

/**
 * Users owning the document.
 * ported from chat-tools whisper.js tokenOwners (includeGM: false), vitalist HealthSense
 * @param {foundry.abstract.Document} doc
 * @param {object} [options]
 * @param {boolean} [options.includeGM=true]
 * @param {boolean} [options.activeOnly=false]  Only connected users.
 * @returns {User[]}
 */
export function ownersOf(doc, { includeGM = true, activeOnly = false } = {}) {
  if (!doc) return [];
  return game.users.filter((u) => {
    if (activeOnly && !u.active) return false;
    if (u.isGM) return includeGM;
    return doc.testUserPermission(u, "OWNER");
  });
}
