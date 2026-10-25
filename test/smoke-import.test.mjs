/**
 * Import-time smoke test: the whole public surface must load in plain Node (no Foundry globals),
 * and with a stubbed `Hooks` it must only register its own `init` listener that exposes the api.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

test("index.js imports without any Foundry global", async () => {
  const lib = await import("../scripts/index.js");

  const expected = [
    "LIB_ID", "LIB_VERSION", "libActive", "pure",
    // core
    "defineModule", "registerSettings", "settingsTableToRegistrations", "settingStore", "onSettingChanged",
    "generation", "impl", "htmlRoot", "HOOKS", "renderJournalPage", "bringToFront",
    "createSocket", "assertOwner", "asOwnerOrRelay",
    "onAll", "watchTargets", "watchActorDocs", "keyedDebounce",
    "wrapMethod", "wrapPrototypeMethod", "patchPrototypeOnce",
    // users / actors / chat
    "isActiveGM", "hasActiveGM", "isLeadGM", "isResponsibleClient", "canControl", "gmUsers", "ownersOf",
    "resolveActor", "resolveTargetActors", "tokensFor", "setTargets", "toggleTargetActor", "panToActor", "byName",
    "postCard", "postMarker", "speakerFor", "messageOf", "pushMessageContextOption", "rerenderVisibleMessages",
    "chatLogs", "jumpToMessage", "addChatControl", "onChatUiRender", "metadataButton",
    // ui
    "SingletonMixin", "PerDocumentMixin", "readForm", "dialogRoot",
    "formDialog", "confirm", "promptText", "promptNumber", "pickOne", "pickList",
    "addSceneControlTool", "addActorSheetHeaderButton", "addTokenHudButton", "injectSheetSection",
    "addDirectoryHeaderButton", "makeControlButton", "el", "esc", "debounce", "trackModifierClass",
    // data
    "getFlagOr", "flagKey", "flagDeleteKey", "isSelfUpdate", "userFlagStore", "userListFlag", "stashField", "restoreField",
    "providerRegistry", "actionRegistry", "requireModule",
    "ensureDataDir", "uploadToData", "uploadJson", "download", "safeFilename", "fileNameOf",
    "itemIndex", "invalidateItemIndex",
    // util
    "normalize", "slug", "norm", "stripEnrichers", "localizeMaybe", "escapeRegExp", "csvList",
    "pad", "fmtDate", "fmtDateTime", "fmtTime", "startOfDay", "endOfDay", "parseDateInput", "toLocalInput", "stamp",
    "num", "numOrNull", "bool", "str", "toArray", "clamp", "clampPct", "signed", "fmtNumber",
    // systems
    "registerSystemAdapter", "getAdapter", "hasAdapter",
  ];
  const missing = expected.filter((k) => !(k in lib));
  assert.deepEqual(missing, [], "PLAN §5.3 surface present");

  assert.equal(typeof lib.pure.escapeHtml, "function");
  assert.equal(typeof lib.pure.keyedDebounce, "function");
  assert.equal(lib.libActive(), false);
});

test("defineModule needs no Foundry global and yields an acyclic handle", async () => {
  const { defineModule } = await import("../scripts/core/module.js");
  const mod = defineModule("my-mod", { langPrefix: "MYMOD" });
  assert.equal(mod.id, "my-mod");
  assert.equal(mod.settingsPrefix, "MYMOD.Settings");
  assert.equal(mod.template("viewer"), "modules/my-mod/templates/viewer.hbs");
  assert.equal(mod.template("templates/x.hbs"), "templates/x.hbs");
  assert.equal(mod.flagKey("k"), "flags.my-mod.k");
  assert.equal(mod.flagDeleteKey("k"), "flags.my-mod.-=k");
  assert.equal(mod.isSelfUpdate(mod.mark({ diff: false })), true);
  assert.equal(mod.isSelfUpdate({}), false);
  assert.equal(mod.setting("anything"), undefined, "unregistered setting → undefined, no throw");

  // ApplicationV2 deep-clones DEFAULT_OPTIONS; a cyclic handle would throw there.
  const seen = new Set();
  const walk = (v) => {
    if (!v || typeof v !== "object") return;
    assert.equal(seen.has(v), false, "handle must not contain cycles");
    seen.add(v);
    for (const x of Object.values(v)) walk(x);
  };
  walk(mod);
});

test("with a stubbed Hooks, index.js registers exactly one init listener that exposes the api", async () => {
  const once = [];
  const api = {};
  globalThis.Hooks = { once: (name, fn) => once.push([name, fn]), on: () => 1, off: () => {} };
  globalThis.game = { modules: new Map([["gatos-lib", api]]) };
  try {
    // Fresh module instance: cache-bust the specifier.
    const lib = await import(`../scripts/index.js?stub=${Date.now()}`);
    assert.deepEqual(once.map(([n]) => n), ["init"]);
    const log = console.log;
    console.log = () => {};
    try {
      once[0][1]();
    } finally {
      console.log = log;
    }
    // index.js imports itself without the cache-busting query, so compare surface rather than identity.
    assert.equal(api.api.LIB_ID, lib.LIB_ID);
    assert.deepEqual(Object.keys(api.api).sort(), Object.keys(lib).sort());
  } finally {
    delete globalThis.Hooks;
    delete globalThis.game;
  }
});
