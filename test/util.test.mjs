import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, slug, norm, stripEnrichers, localizeMaybe, escapeRegExp, csvList } from "../scripts/util/text.js";
import { pad, fmtDate, fmtDateTime, fmtTime, startOfDay, endOfDay, parseDateInput, toLocalInput, stamp } from "../scripts/util/time.js";
import { num, numOrNull, bool, str, toArray, clamp, clampPct, signed, fmtNumber } from "../scripts/util/num.js";

test("text: normalize strips accents, case, apostrophes and whitespace", () => {
  assert.equal(normalize("  Bull’s   Strength "), "bulls strength");
  assert.equal(normalize("Café"), "cafe");
  assert.equal(normalize(null), "");
});

test("text: slug keeps ascii alnum and drops parenthesised parts", () => {
  assert.equal(slug("Guardian (Ex)"), "guardian");
  assert.equal(slug("Steal Health 2"), "stealhealth2");
});

test("text: norm trims, lowers and collapses spaces", () => {
  assert.equal(norm("  Potion  of   Healing "), "potion of healing");
  assert.equal(norm(undefined), "");
});

test("text: stripEnrichers", () => {
  assert.equal(stripEnrichers("@UUID[Compendium.x.y]{Label} and [[1d4]] @Distance[30 ft;dual]"), "Label and 1d4 30 ft");
  assert.equal(stripEnrichers("roll [[/r 2d6 + 1]] now"), "roll 2d6 + 1 now");
  assert.equal(stripEnrichers("@UUID[Actor.abc] gone"), "gone");
});

test("text: localizeMaybe without game returns the key", () => {
  assert.equal(localizeMaybe("X.Y"), "X.Y");
  assert.equal(localizeMaybe({ label: "A.B" }), "A.B");
  assert.equal(localizeMaybe(""), "");
});

test("text: escapeRegExp / csvList", () => {
  assert.equal(new RegExp(escapeRegExp("a.b*c")).test("a.b*c"), true);
  assert.equal(new RegExp(escapeRegExp("a.b*c")).test("aXbbc"), false);
  assert.deepEqual(csvList(" a, b ,,c "), ["a", "b", "c"]);
  assert.deepEqual(csvList(["x", " ", "y"]), ["x", "y"]);
  assert.deepEqual(csvList(null), []);
});

test("time: formatting round-trips through local time", () => {
  const ts = new Date(2026, 9, 25, 7, 5, 9).getTime();
  assert.equal(pad(7), "07");
  assert.equal(pad(7, 3), "007");
  assert.equal(fmtDate(ts), "2026-10-25");
  assert.equal(fmtDateTime(ts), "2026-10-25 07:05:09");
  assert.equal(fmtTime(ts), "07:05");
  assert.equal(toLocalInput(ts), "2026-10-25T07:05:09");
  assert.equal(stamp(false, ts), "20261025");
  assert.equal(stamp(true, ts), "20261025-0705");
  assert.equal(parseDateInput("2026-10-25"), startOfDay(ts));
  assert.equal(parseDateInput(""), null);
  assert.equal(parseDateInput("nope"), null);
  assert.equal(endOfDay(ts) - startOfDay(ts), 24 * 3600 * 1000 - 1);
});

test("num: coercion helpers", () => {
  assert.equal(num("3"), 3);
  assert.equal(num(""), 0);
  assert.equal(num("x", 5), 5);
  assert.equal(num(Infinity), 0);
  assert.equal(numOrNull(""), null);
  assert.equal(numOrNull("2.5"), 2.5);
  assert.equal(bool("on"), true);
  assert.equal(bool("false"), false);
  assert.equal(str(null), "");
  assert.deepEqual(toArray({ 1: "b", 0: "a" }), ["a", "b"]);
  assert.deepEqual(toArray("x"), []);
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clampPct(5, 20), 25);
  assert.equal(clampPct(5, 0), 0);
  assert.equal(signed(3), "+3");
  assert.equal(signed(-2), "-2");
  assert.equal(signed(0), "+0");
  assert.equal(fmtNumber(1.5), "1.5");
  assert.equal(fmtNumber(2), "2");
  assert.equal(fmtNumber(1.005, { decimals: 2 }), "1");
  assert.equal(fmtNumber(1234.5, { locale: "en-US" }), "1,234.5");
});
