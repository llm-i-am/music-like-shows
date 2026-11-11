import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  adapt,
  matches,
  sortShows,
  regionalDay,
  rangeFor,
  validDate,
  moneyInput,
  safeURL,
  validateData,
} from "../js/model.js";
import { readURL, writeURL } from "../js/url-state.js";
const today = "2026-11-10";
const raw = (price, id = "a", extra = {}) => ({
  id,
  artist: "Café Live",
  city: "Tampa",
  venue: "Long Venue",
  venue_key: "venue",
  date_iso: "2026-11-13",
  price_pp: price,
  tier: 2,
  past: false,
  ...extra,
});
const show = (price, id, extra) => adapt(raw(price, id, extra), today);
test("all prices includes expensive exceptions and unknowns without mutating data", () => {
  const source = { shows: [raw(38, "a"), raw(117, "b"), raw(null, "c")] };
  const before = JSON.stringify(source);
  Object.freeze(source.shows[0]);
  const rows = source.shows.map((s) => adapt(s, today));
  assert.equal(rows.filter((s) => matches(s, defaults(), today)).length, 3);
  assert.equal(JSON.stringify(source), before);
});
test("prices above 100 accepted; exact cents and unknown handling", () => {
  assert.equal(moneyInput("150"), 15000);
  assert.equal(moneyInput(""), null);
  assert.equal(moneyInput("69.50"), 6950);
  for (const bad of ["-1", "1e2", "Infinity", "abc", "1.999"])
    assert.throws(() => moneyInput(bad));
  for (const price of [0, 49.99, 50, 69, 69.5, 70, 100])
    assert(
      matches(
        show(price),
        { ...defaults(), max: 10000, prices: "known" },
        today,
      ),
    );
  assert(
    !matches(
      show(100.01),
      { ...defaults(), max: 10000, prices: "known" },
      today,
    ),
  );
  assert(
    matches(show(117), { ...defaults(), max: 15000, prices: "known" }, today),
  );
  assert(
    !matches(show(null), { ...defaults(), max: 15000, prices: "known" }, today),
  );
  assert(
    matches(
      show(null),
      { ...defaults(), max: 15000, prices: "include-unknown" },
      today,
    ),
  );
});
test("regional calendar, leap dates, DST and weekend overlap", () => {
  assert.equal(regionalDay(new Date("2026-11-11T01:00Z")), "2026-11-10");
  assert(!validDate("2026-02-29"));
  assert(validDate("2028-02-29"));
  assert.deepEqual(rangeFor({ ...defaults(), date: "7" }, "2026-03-07"), [
    "2026-03-07",
    "2026-03-13",
  ]);
  assert.deepEqual(rangeFor({ ...defaults(), date: "weekend" }, "2026-11-15"), [
    "2026-11-13",
    "2026-11-15",
  ]);
  assert.deepEqual(rangeFor({ ...defaults(), date: "weekend" }, "2026-11-16"), [
    "2026-11-20",
    "2026-11-22",
  ]);
  const multi = show(50, "m", {
    date_iso: "2026-11-12",
    date_end: "2026-11-15",
  });
  assert(matches(multi, { ...defaults(), date: "weekend" }, today));
  assert(
    adapt(raw(50, "past", { past: false, date_iso: "2020-01-01" }), today).past,
  );
  assert(!adapt(raw(50, "now", { date_iso: today, past: true }), today).past);
});
test("accent-insensitive search and filters intersect", () => {
  assert(matches(show(50), { ...defaults(), q: "cafe" }, today));
  assert(!matches(show(50), { ...defaults(), city: "Orlando" }, today));
});
test("unknown prices sort last both directions; curator favorites rank first", () => {
  const rows = [show(null, "null"), show(70, "70"), show(20, "20")];
  assert.equal(sortShows(rows, "price-desc").at(-1).id, "null");
  assert.equal(sortShows(rows, "price-asc").at(-1).id, "null");
  assert.equal(
    sortShows(
      [
        show(20, "top", { tier: 1 }),
        show(20, "fav", { tier: 3, s_tier: true }),
      ],
      "best",
    )[0].id,
    "fav",
  );
});
test("URL canonicalization, higher maxima, validation and first duplicate wins", () => {
  const s = readURL("?max=150&max=50&sort=bogus&city=Atlantis", [
    show(100),
  ]).state;
  assert.equal(s.max, 15000);
  assert.equal(s.sort, "date");
  assert.equal(s.city, "");
  assert.equal(s.prices, "known");
  assert.equal(readURL(writeURL(s)).state.max, 15000);
  assert.equal(readURL("?max=NaN").state.max, null);
  assert.equal(
    readURL("?date=custom&from=2026-11-15&to=2026-11-01").state.date,
    "any",
  );
});
test("legacy prices preserve strict bounds and impossible intersections", () => {
  const bounded = readURL("?price=50-69").state;
  assert(matches(show(69), bounded, today));
  assert(!matches(show(69.5), bounded, today));
  const above = readURL("?price=over100").state;
  assert(matches(show(117), above, today));
  assert(!matches(show(100), above, today));
  const impossible = readURL("?price=over100&under70=1").state;
  assert(!matches(show(117), impossible, today));
  assert(!matches(show(50), impossible, today));
  assert.equal(readURL("?past=1&date=7").state.date, "any");
});
test("unsafe URLs and duplicate identities rejected without rewriting source", () => {
  assert.equal(safeURL("javascript:alert(1)"), null);
  assert.equal(safeURL("https://user:pass@example.org"), null);
  assert.equal(safeURL("https://example.org/?x=1"), "https://example.org/?x=1");
  assert.throws(() => validateData({ shows: [raw(1), raw(2)] }));
});
