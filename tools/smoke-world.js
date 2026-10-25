/**
 * In-world smoke snapshot (PLAN §7.0 "스모크 매크로"). Paste into the browser console or a script macro
 * in a world where the gatos modules are enabled. Prints and returns, per active gatos module:
 *   - api keys, setting keys (scope/type/default), keybindings; plus hook counts per hook name (all modules),
 *   - unresolved lang keys: `<PREFIX>.*` keys referenced in loaded module code whose localize() returns the key,
 *   - library status (gatos-lib / gatos-pf1-lib active, api present, versions).
 * Run once before and once after a migration and diff the JSON (`copy(result)` puts it on the clipboard).
 */
(async () => {
  const mods = [...game.modules.values()].filter((m) => m.active && m.id.startsWith("gatos-"));
  const out = { world: game.world.id, system: `${game.system.id} ${game.system.version}`, foundry: game.version, modules: {}, libs: {}, errors: [] };

  for (const id of ["gatos-lib", "gatos-pf1-lib"]) {
    const m = game.modules.get(id);
    out.libs[id] = m ? { installed: true, active: m.active, version: m.version, api: !!m.api, apiKeys: m.api ? Object.keys(m.api).length : 0 } : { installed: false };
  }

  // Hook counts per hook name (all modules; a before/after diff shows registrations gained or lost).
  out.hooks = Object.fromEntries(Object.entries(Hooks.events ?? {}).map(([name, fns]) => [name, fns.length]).sort());

  const localizeMisses = (prefix, srcText) => {
    const misses = new Set();
    const re = new RegExp(`["'\`](${prefix}\\.[A-Za-z0-9_.]+)["'\`]`, "g");
    for (const m of srcText.matchAll(re)) if (game.i18n.localize(m[1]) === m[1]) misses.add(m[1]);
    return [...misses].sort();
  };

  for (const m of mods) {
    const entry = { version: m.version, api: m.api ? Object.keys(m.api).sort() : null, settings: {}, keybindings: [], langUnresolved: [] };
    for (const [key, s] of game.settings.settings) {
      if (s.namespace !== m.id) continue;
      entry.settings[s.key] = { scope: s.scope, config: s.config, type: s.type?.name ?? String(s.type), default: typeof s.default === "function" ? "[fn]" : s.default };
    }
    for (const [key, kb] of game.keybindings.actions) if (key.startsWith(`${m.id}.`)) entry.keybindings.push(key);

    // Lang prefix: the first top-level key the module's lang file declares.
    try {
      const langPath = m.languages.find((l) => l.lang === game.i18n.lang)?.path ?? m.languages[0]?.path;
      if (langPath) {
        const lang = await (await fetch(`/modules/${m.id}/${langPath}`)).json();
        const prefixes = Object.keys(lang);
        // Scan the module's script files (the manifest esmodules + their folder) for literal keys.
        let text = "";
        for (const es of m.esmodules ?? []) {
          const dir = es.split("/").slice(0, -1).join("/");
          const files = new Set([es]);
          // Fetch sibling scripts listed via import statements (one level deep is enough for these modules).
          const entrySrc = await (await fetch(`/modules/${m.id}/${es}`)).text();
          text += entrySrc;
          for (const im of entrySrc.matchAll(/from\s+"\.\/([^"]+)"/g)) files.add(`${dir}/${im[1]}`);
          for (const f of files) {
            if (f === es) continue;
            try {
              text += await (await fetch(`/modules/${m.id}/${f}`)).text();
            } catch (err) {
              /* optional */
            }
          }
        }
        for (const p of prefixes) entry.langUnresolved.push(...localizeMisses(p, text));
      }
    } catch (err) {
      out.errors.push(`${m.id}: lang scan failed: ${err.message}`);
    }
    out.modules[m.id] = entry;
  }

  console.log("gatos smoke", out);
  return out;
})();
