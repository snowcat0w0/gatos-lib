/**
 * Cached light-weight document indexes over compendiums (and optionally the world collection), built
 * from `pack.getIndex({ fields })` without loading documents. The library knows no game-system schema:
 * the caller names the extra `fields` it needs and filters/sorts the result itself.
 * Hook-free: the caller decides when to invalidate (e.g. on createItem / updateCompendium).
 */

/** key → Promise<entry[]> */
const cache = new Map();

const asList = (v) => (v == null ? null : [v].flat().filter(Boolean));

/**
 * The cache key for a set of options. Functions are keyed by their source text, so pass an explicit
 * `key` when `packFilter` depends on captured state (e.g. a setting read outside the function).
 * @param {object} options  Same as itemIndex.
 * @returns {string}
 */
export function itemIndexKey({ key, type, fields = [], includeWorld = true, visibleOnly = true, packFilter, documentName = "Item" } = {}) {
  if (key) return String(key);
  return JSON.stringify({
    documentName,
    type: asList(type)?.sort() ?? null,
    fields: [...new Set(fields)].sort(),
    includeWorld: !!includeWorld,
    visibleOnly: !!visibleOnly,
    packFilter: packFilter ? String(packFilter) : null,
  });
}

/** A world document reduced to the same shape as a compendium index entry. */
function worldEntry(doc, fields) {
  const src = doc._source ?? doc;
  const entry = { _id: doc.id, uuid: doc.uuid, name: doc.name, img: src.img ?? null, type: src.type ?? null, pack: null, packTitle: null };
  for (const f of fields) {
    const v = foundry.utils.getProperty(src, f);
    if (v !== undefined) foundry.utils.setProperty(entry, f, foundry.utils.deepClone(v));
  }
  return entry;
}

async function buildIndex({ type, fields = [], includeWorld = true, visibleOnly = true, packFilter, documentName = "Item" }) {
  const types = asList(type);
  const wanted = types ? new Set(types) : null;
  const entries = [];

  for (const pack of game.packs) {
    if (pack.documentName !== documentName) continue;
    if (visibleOnly && !pack.visible) continue;
    try {
      if (packFilter && !packFilter(pack)) continue;
      // Skip packs without a matching type before asking the server for the extra fields.
      if (wanted && fields.length) {
        const basic = await pack.getIndex();
        if (!basic.some((i) => wanted.has(i.type))) continue;
      }
      const index = await pack.getIndex({ fields });
      const packTitle = game.i18n.localize(pack.title);
      for (const i of index) {
        if (wanted && !wanted.has(i.type)) continue;
        // Shallow copy: the index entries belong to the pack's cached index.
        entries.push({ ...i, uuid: i.uuid ?? pack.getUuid(i._id), pack: pack.collection, packTitle });
      }
    } catch (err) {
      console.warn(`gatos-lib | could not index pack ${pack.collection}`, err);
    }
  }

  if (includeWorld) {
    for (const doc of game.collections.get(documentName) ?? []) {
      if (wanted && !wanted.has(doc.type)) continue;
      if (visibleOnly && doc.visible === false) continue;
      entries.push(worldEntry(doc, fields));
    }
  }
  return entries;
}

// ported from the buff-finder module catalog.js getCatalog / buildCatalog (skeleton); shaped so the
// item-crafting spell index and the monster-maker feat index can call it with their own fields
/**
 * A memoised index of documents of `type` from every visible compendium of `documentName` and, when
 * `includeWorld`, the world collection. Entries keep the index shape
 * (`{_id, uuid, name, img, type, system?…}` with only the requested `fields`) plus `pack` (collection id,
 * null for world documents) and `packTitle`. Order: packs in `game.packs` order, then world documents.
 * Treat entries as read-only. A failed build is not cached.
 * @param {object} [options]
 * @param {string|string[]} [options.type]       Document type(s); all types when omitted.
 * @param {string[]} [options.fields=[]]        Extra index fields, passed to getIndex untouched.
 * @param {boolean} [options.includeWorld=true]
 * @param {boolean} [options.visibleOnly=true]  Skip packs (and world documents) the user cannot see.
 * @param {(pack: CompendiumCollection) => boolean} [options.packFilter]
 * @param {string} [options.documentName="Item"]
 * @param {string} [options.key]                Explicit cache key (see itemIndexKey).
 * @returns {Promise<object[]>}
 */
export function itemIndex(options = {}) {
  const key = itemIndexKey(options);
  let pending = cache.get(key);
  if (!pending) {
    pending = buildIndex(options);
    cache.set(key, pending);
    pending.catch(() => {
      if (cache.get(key) === pending) cache.delete(key);
    });
  }
  return pending;
}

/**
 * Drop cached indexes so the next request rebuilds them.
 * @param {string|object} [keyOrOptions]  A key, or the options given to itemIndex; all when omitted.
 */
export function invalidateItemIndex(keyOrOptions) {
  if (keyOrOptions == null) return cache.clear();
  cache.delete(typeof keyOrOptions === "string" ? keyOrOptions : itemIndexKey(keyOrOptions));
}
