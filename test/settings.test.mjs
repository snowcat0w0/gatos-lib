import { test } from "node:test";
import assert from "node:assert/strict";
import { pascal, settingsTableToRegistrations } from "../scripts/core/settings.js";

const asMap = (pairs) => Object.fromEntries(pairs);

test("pascal", () => {
  assert.equal(pascal("topLeft"), "TopLeft");
  assert.equal(pascal("gm-only"), "GmOnly");
  assert.equal(pascal("autoDetect"), "AutoDetect");
});

test("settings table: defaults, name/hint keys, hidden, choices array conversion", () => {
  const regs = asMap(settingsTableToRegistrations("my-mod", "MYMOD.Settings", {
    autoDetect: { type: Boolean, default: true },
    portraitShape: { scope: "client", type: String, default: "square", choices: ["square", "circle", "topLeft"] },
    archiveIndex: { hidden: true, type: Object, default: { list: [] } },
    custom: { type: Number, default: 1, nameKey: "OTHER.Name", hintKey: false },
    shown: { type: String, default: "", choices: { a: "X.A" } },
  }));

  assert.equal(regs.autoDetect.scope, "world");
  assert.equal(regs.autoDetect.config, true);
  assert.equal(regs.autoDetect.name, "MYMOD.Settings.AutoDetect.Name");
  assert.equal(regs.autoDetect.hint, "MYMOD.Settings.AutoDetect.Hint");

  assert.equal(regs.portraitShape.scope, "client");
  assert.deepEqual(regs.portraitShape.choices, {
    square: "MYMOD.Settings.PortraitShape.Square",
    circle: "MYMOD.Settings.PortraitShape.Circle",
    topLeft: "MYMOD.Settings.PortraitShape.TopLeft",
  });

  assert.equal(regs.archiveIndex.config, false);
  assert.equal("name" in regs.archiveIndex, false);
  assert.equal("hint" in regs.archiveIndex, false);
  assert.equal("hidden" in regs.archiveIndex, false);

  assert.equal(regs.custom.name, "OTHER.Name");
  assert.equal("hint" in regs.custom, false);
  assert.equal("nameKey" in regs.custom, false);

  assert.deepEqual(regs.shown.choices, { a: "X.A" });
});

test("settings table: raw key style", () => {
  const regs = asMap(settingsTableToRegistrations("m", "GATOSHM.Settings", { enabled: { type: Boolean, default: true } }, { keyStyle: "raw" }));
  assert.equal(regs.enabled.name, "GATOSHM.Settings.enabled.Name");
});

test("settings table: menu entries and string onChange", () => {
  class Menu {}
  const pairs = settingsTableToRegistrations("m", "P", {
    blockingMenu: { menu: { type: Menu, icon: "fa-solid fa-x", restricted: true } },
    size: { type: Number, default: 1, onChange: "sizeChanged" },
  });
  const regs = asMap(pairs);
  assert.equal(regs.blockingMenu.menu, true);
  assert.equal(regs.blockingMenu.type, Menu);
  assert.equal(regs.blockingMenu.restricted, true);
  assert.equal(regs.blockingMenu.name, "P.BlockingMenu.Name");
  assert.equal(regs.blockingMenu.label, "P.BlockingMenu.Label");

  assert.equal(typeof regs.size.onChange, "function");
  const calls = [];
  globalThis.Hooks = { callAll: (...a) => calls.push(a) };
  try {
    regs.size.onChange(42);
  } finally {
    delete globalThis.Hooks;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "m.sizeChanged");
  assert.equal(calls[0][1], 42);
});
