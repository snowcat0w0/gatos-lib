import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, plainText, stripTooltips } from "../scripts/pure/dom.js";
import { debounce, keyedDebounce } from "../scripts/pure/fn.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("dom: escapeHtml", () => {
  assert.equal(escapeHtml(`<a href="x">Tom & Jerry's</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;");
  assert.equal(escapeHtml(null), "");
});

test("dom: plainText (regex fallback in Node)", () => {
  assert.equal(plainText("<p>Hello <b>big</b>&nbsp;world &amp; co</p>"), "Hello big world & co");
  assert.equal(plainText('<div class="dice-tooltip"><span>secret</span></div>Total: 7'), "Total: 7");
  assert.equal(plainText("<script>alert(1)</script>ok"), "ok");
  assert.equal(plainText("<p>a</p><p>b</p>", { multiline: true }), "a\n\nb"); // blocks are separated by a blank line (same as the DOM path)
  assert.equal(plainText("line1<br>line2", { multiline: true }), "line1\nline2");
  assert.equal(plainText(""), "");
});

test("dom: stripTooltips keeps the rest of the markup", () => {
  const html = '<div class="dice-roll"><div class="dice-tooltip"><div class="dice-tooltip">x</div></div><h4 class="dice-total">7</h4></div>';
  assert.equal(stripTooltips(html), '<div class="dice-roll"><h4 class="dice-total">7</h4></div>');
  assert.equal(stripTooltips("<p>no dice</p>"), "<p>no dice</p>");
});

test("fn: debounce runs once with the latest args", async () => {
  const calls = [];
  const d = debounce((x) => calls.push(x), 10);
  d(1);
  d(2);
  d(3);
  assert.equal(d.pending(), true);
  await sleep(30);
  assert.deepEqual(calls, [3]);
  d(4);
  d.cancel();
  await sleep(20);
  assert.deepEqual(calls, [3]);
  d(5);
  d.flush();
  assert.deepEqual(calls, [3, 5]);
  assert.equal(d.flush(), undefined, "nothing pending → undefined");
});

test("fn: keyedDebounce collapses per key and coalesces re-requests while running", async () => {
  const runs = [];
  let release;
  const gate = new Promise((r) => (release = r));
  // fn receives the call's args (not the key); callers pass whatever they need.
  const fn = async (key, n) => {
    runs.push([key, n, "start"]);
    if (key === "slow") await gate;
    runs.push([key, n, "end"]);
  };
  const s = keyedDebounce(fn, 5);

  s("a", "a", 1);
  s("a", "a", 2);
  s("b", "b", 1);
  await sleep(20);
  assert.deepEqual(runs, [["a", 2, "start"], ["a", 2, "end"], ["b", 1, "start"], ["b", 1, "end"]]);

  runs.length = 0;
  s("slow", "slow", 1);
  await sleep(10); // now running, awaiting the gate
  s("slow", "slow", 2); // requested while running → one rerun afterwards, with the latest args
  s("slow", "slow", 3);
  await sleep(10);
  assert.deepEqual(runs, [["slow", 1, "start"]]);
  release();
  await sleep(20);
  assert.deepEqual(runs, [["slow", 1, "start"], ["slow", 1, "end"], ["slow", 3, "start"], ["slow", 3, "end"]]);
});

test("fn: keyedDebounce passes the key when called without args, cancel/flush work", async () => {
  const seen = [];
  const s = keyedDebounce((k) => seen.push(k), 50);
  s("x");
  s("y");
  s.cancel("y");
  await s.flush("x");
  assert.deepEqual(seen, ["x"]);
  assert.equal(s.has("x"), false);
  assert.equal(s.has("y"), false);
});

test("fn: keyedDebounce reports errors through onError and keeps working", async () => {
  const errors = [];
  const s = keyedDebounce(
    (k) => {
      if (k === "bad") throw new Error("boom");
    },
    5,
    { onError: (err, key) => errors.push([key, err.message]) },
  );
  s("bad");
  s("good");
  await sleep(20);
  assert.deepEqual(errors, [["bad", "boom"]]);
});
