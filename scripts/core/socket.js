/**
 * Gato's Library — module socket relay.
 *
 * One `createSocket(mod)` per consumer module, on the `module.<id>` channel
 * (the consumer's module.json needs `"socket": true`).
 *
 * Server facts (Foundry v13 and v14 `dist/server/sockets.mjs` `handleCustomSocket`, unchanged):
 *  - without options the message is `socket.broadcast.emit(event, data, senderUserId)`
 *    — every other client receives it, never the sender itself;
 *  - with `{ recipients: [userId, …] }` it is emitted only to those users' sockets
 *    (the sender included, if listed);
 *  - in both cases the listener's SECOND argument is the sender's User id, filled in
 *    by the server. The library identifies senders from it, never from the payload.
 *
 * Message kinds on the wire (`msg.kind`):
 *  - "gm"  runAsGM / request — handled only on the active GM client;
 *  - "all" broadcast / "to" emitTo — handled on every recipient, but only by handlers
 *          registered with `{ anyClient: true }`;
 *  - "res" a request's response, accepted only from a GM sender.
 *
 * Security checklist for handlers that write documents (see PLAN §5.4): call
 * `assertOwner(user, doc)` (or the module's own policy), whitelist the fields a
 * relayed update may touch, and mark GM-side writes with `mod.mark(options)`.
 * Example, after the light module's 0.1.1 relay:
 *
 *   socket.registerHandler("updateItems", async ({ actorUuid, updates }, user) => {
 *     const actor = await fromUuid(actorUuid);
 *     assertOwner(user, actor);                       // throws → logged, nothing written
 *     const extra = updates.flatMap((u) => Object.keys(foundry.utils.flattenObject(u)))
 *       .filter((k) => !ALLOWED_KEYS.has(k));
 *     if (extra.length) throw new Error(`unexpected fields ${extra.join(", ")}`);
 *     await actor.updateEmbeddedDocuments("Item", updates, mod.mark());
 *   });
 */
import { canControl } from "../users.js";

/**
 * Create a socket relay bound to one module.
 * ported from buff-finder socket.js (handler map, user guard, boolean return)
 * + visual-novel socket.js:42,73-88 (request/response).
 * @param {object} mod                  Module handle from defineModule().
 * @param {object} [options]
 * @param {string} [options.noGMKey]    Module lang key (via mod.L) warned when no GM is connected; default GATOSLIB.NoGM.
 */
export function createSocket(mod, { noGMKey = null } = {}) {
  const event = `module.${mod.id}`;
  /** @type {Map<string, {fn: Function, anyClient: boolean}>} */
  const handlers = new Map();
  /** @type {Map<string, {resolve: Function, timer: number}>} */
  const pending = new Map();
  let listening = false;

  const warnNoGM = () => {
    const text = noGMKey ? mod.L(noGMKey) : game.i18n.localize("GATOSLIB.NoGM");
    ui.notifications.warn(text);
  };

  /** Run a handler and normalize its outcome to `{ ok, error?, data? }`. */
  async function invoke(action, data, user) {
    const entry = handlers.get(action);
    if (!entry) return { ok: false, code: "unknownAction", error: `unknown socket action "${action}"` };
    try {
      const result = await entry.fn(data ?? {}, user);
      if (result && typeof result === "object" && typeof result.ok === "boolean") return result;
      return { ok: true, data: result };
    } catch (err) {
      mod.error(`socket action "${action}" from ${user?.name ?? "unknown user"} failed`, err);
      return { ok: false, code: "error", error: err?.message ?? String(err) };
    }
  }

  async function onMessage(msg, senderId) {
    if (!msg || typeof msg !== "object") return;

    // Response to one of our requests: only a GM may answer.
    if (msg.kind === "res") {
      const entry = pending.get(msg.requestId);
      if (!entry) return;
      if (!game.users.get(senderId)?.isGM) return mod.warn(`dropped socket response from non-GM user ${senderId}`);
      pending.delete(msg.requestId);
      clearTimeout(entry.timer);
      entry.resolve(msg.result ?? { ok: false, code: "error", error: "empty response" });
      return;
    }

    if (typeof msg.action !== "string") return;
    const user = game.users.get(senderId);
    if (!user) return mod.warn(`dropped socket action "${msg.action}" from unknown sender ${senderId}`);

    if (msg.kind === "gm") {
      if (!game.user.isActiveGM) return;
      const result = await invoke(msg.action, msg.data, user);
      if (msg.requestId) {
        game.socket.emit(event, { kind: "res", requestId: msg.requestId, result }, { recipients: [senderId] });
      }
      return;
    }

    if (msg.kind === "all" || msg.kind === "to") {
      const entry = handlers.get(msg.action);
      if (!entry?.anyClient) return;
      await invoke(msg.action, msg.data, user);
    }
  }

  return {
    /** Socket event name (`module.<id>`). */
    event,

    /**
     * Register a handler. `fn(data, user)` — `user` is the sender resolved from the server-supplied id.
     * By default it runs only on the active GM (runAsGM / request); with `anyClient` it also
     * accepts broadcast / emitTo deliveries on every client and must check `user.isGM` itself
     * when only GMs may trigger it. Return `{ ok, error?, data? }` or any value (wrapped as `data`).
     * @param {string} action
     * @param {(data: object, user: User) => any} fn
     * @param {object} [options]
     * @param {boolean} [options.anyClient=false]
     */
    registerHandler(action, fn, { anyClient = false } = {}) {
      handlers.set(action, { fn, anyClient });
    },

    /** Start listening. Call once, in `ready` (or `setup`). */
    init() {
      if (listening) return;
      listening = true;
      game.socket.on(event, onMessage);
    },

    /**
     * Run an action with GM authority: locally when this client is a GM, otherwise relayed to the active GM.
     * @returns {Promise<boolean>} true when run locally or relayed; false when no GM is connected,
     *   the action is unknown, or the local handler failed.
     */
    async runAsGM(action, data = {}) {
      if (game.user.isGM) {
        const res = await invoke(action, data, game.user);
        if (res.code === "unknownAction") mod.warn(res.error);
        return res.code !== "unknownAction" && res.code !== "error";
      }
      if (!game.users.activeGM) {
        warnNoGM();
        return false;
      }
      game.socket.emit(event, { kind: "gm", action, data });
      return true;
    },

    /**
     * Ask the active GM to run an action and wait for its result. Does not notify on failure.
     * Library failures carry a `code`: "noGM" | "timeout" | "unknownAction" | "error".
     * @returns {Promise<{ok: boolean, error?: string, code?: string, data?: any}>}
     */
    async request(action, data = {}, { timeout = 8000 } = {}) {
      if (game.user.isGM) return invoke(action, data, game.user);
      if (!game.users.activeGM) return { ok: false, code: "noGM", error: "GATOSLIB.NoGM" };
      const requestId = foundry.utils.randomID(16);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          resolve({ ok: false, code: "timeout", error: "GATOSLIB.Timeout" });
        }, timeout);
        pending.set(requestId, { resolve, timer });
        game.socket.emit(event, { kind: "gm", action, data, requestId });
      });
    },

    /**
     * Send an action to every other client (`anyClient` handlers). Receivers check `user.isGM`
     * when only a GM may trigger it.
     * @param {object} [options]
     * @param {boolean} [options.includeSelf=false]  Also run the handler on this client.
     */
    broadcast(action, data = {}, { includeSelf = false } = {}) {
      game.socket.emit(event, { kind: "all", action, data });
      if (includeSelf) return invoke(action, data, game.user);
    },

    /**
     * Send an action only to the given users (`anyClient` handlers). The server also delivers
     * to this client when its own id is listed.
     * @param {string|string[]} userIds
     */
    emitTo(userIds, action, data = {}) {
      const recipients = [userIds].flat().filter((id) => typeof id === "string" && id);
      if (!recipients.length) return;
      game.socket.emit(event, { kind: "to", action, data }, { recipients });
    },
  };
}

/**
 * Throw unless `user` is a GM or an owner of `doc`. For use inside socket handlers.
 * ported from light socket.js `owns`
 */
export function assertOwner(user, doc) {
  if (canControl(user, doc)) return;
  throw new Error(`${user?.name ?? "unknown user"} may not modify ${doc?.uuid ?? "a missing document"}`);
}

/**
 * Run `localFn` when this client owns `doc`, otherwise relay `action` to the active GM.
 * ported from light / vitalist socket.js owner-else-emit wrappers
 * @param {ReturnType<typeof createSocket>} socket
 * @param {foundry.abstract.Document} doc
 * @param {() => any} localFn
 * @returns {Promise<any>} localFn's result, or runAsGM's boolean.
 */
export async function asOwnerOrRelay(socket, doc, localFn, action, data) {
  if (doc?.isOwner) return localFn();
  return socket.runAsGM(action, data);
}
