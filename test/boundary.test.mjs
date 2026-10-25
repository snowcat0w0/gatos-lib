/**
 * Package-level invariants (PLAN §5.1 rule 4, §5.2):
 *  - the system-agnostic library never mentions the game-system id (grep must be empty)
 *  - module.json is consistent with the files on disk
 *  - index.js re-exports every public module exactly once (no `export *` name clashes)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
// Spelled out so this test file itself passes the check.
const SYSTEM_MARKER = ["p", "f", "1"].join("");

test("no system-specific string anywhere in scripts/, lang/, styles/", () => {
  const offenders = [];
  for (const dir of ["scripts", "lang", "styles"]) {
    for (const f of walk(path.join(root, dir))) {
      const text = fs.readFileSync(f, "utf8").toLowerCase();
      if (text.includes(SYSTEM_MARKER)) offenders.push(path.relative(root, f));
    }
  }
  assert.deepEqual(offenders, []);
});

test("module.json points at existing files and is a library", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
  assert.equal(manifest.id, "gatos-lib");
  assert.equal(manifest.library, true);
  assert.equal(manifest.compatibility.minimum, "14");
  for (const f of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map((l) => l.path)]) {
    assert.ok(fs.existsSync(path.join(root, f)), `${f} missing`);
  }
  for (const l of manifest.languages) JSON.parse(fs.readFileSync(path.join(root, l.path), "utf8"));
});

test("lang files share the same key set", () => {
  const keys = (file) => {
    const flat = [];
    const rec = (obj, prefix) => {
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === "object") rec(v, `${prefix}${k}.`);
        else flat.push(`${prefix}${k}`);
      }
    };
    rec(JSON.parse(fs.readFileSync(path.join(root, "lang", file), "utf8")), "");
    return flat.sort();
  };
  assert.deepEqual(keys("ko.json"), keys("en.json"));
});

test("index.js re-exports every script module without name clashes", () => {
  const indexSrc = fs.readFileSync(path.join(root, "scripts/index.js"), "utf8");
  const reexported = [...indexSrc.matchAll(/export \* from "\.\/(.+?)"/g)].map((m) => m[1]);
  const scripts = walk(path.join(root, "scripts"))
    .map((f) => path.relative(path.join(root, "scripts"), f).split(path.sep).join("/"))
    .filter((f) => f.endsWith(".js") && f !== "index.js" && !f.startsWith("pure/"));
  assert.deepEqual([...reexported].sort(), scripts.sort(), "every non-pure module is re-exported exactly once");

  const seen = new Map();
  for (const rel of reexported) {
    const src = fs.readFileSync(path.join(root, "scripts", rel), "utf8");
    const names = new Set();
    for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
      for (const n of m[1].split(",")) {
        const name = n.split(/\s+as\s+/).pop().trim();
        if (name) names.add(name);
      }
    }
    for (const n of names) {
      assert.equal(seen.has(n), false, `export "${n}" defined in both ${seen.get(n)} and ${rel}`);
      seen.set(n, rel);
    }
  }
});
