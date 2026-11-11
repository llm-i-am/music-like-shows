import { defaults, moneyInput, validDate } from "./model.js?v=1.0.0";
const enums = {
  view: ["discover", "my"],
  prices: ["all", "known", "include-unknown", "unknown-only"],
  date: ["any", "today", "weekend", "7", "30", "custom"],
  pick: ["", "1", "2", "3"],
  sort: ["date", "price-asc", "price-desc", "best", "found"],
  period: ["upcoming", "past"],
  collection: ["all", "favorites", "going"],
};
export function readURL(search, shows = []) {
  const p = new URLSearchParams(search),
    s = defaults();
  let corrected = false;
  for (const [key, allowed] of Object.entries(enums))
    if (p.has(key)) {
      if (allowed.includes(p.get(key))) s[key] = p.get(key);
      else corrected = true;
    }
  s.priceExplicit = p.has("prices") && s.prices !== "all";
  for (const key of ["q", "city", "venue", "show"])
    if (p.has(key))
      s[key] = p
        .get(key)
        .slice(0, key === "q" ? 200 : 128)
        .trim();
  for (const key of ["max", "min", "lt"])
    if (p.has(key))
      try {
        s[key] = moneyInput(p.get(key));
      } catch {
        corrected = true;
      }
  for (const key of ["from", "to"])
    if (p.has(key)) {
      if (validDate(p.get(key))) s[key] = p.get(key);
      else corrected = true;
    }
  s.minExclusive = p.get("minExclusive") === "1";
  s.favorite = p.get("curatorFavorite") === "1" || p.get("s") === "1";
  if (p.has("tier") && ["1", "2", "3"].includes(p.get("tier")))
    s.pick = p.get("tier");
  if (p.get("past") === "1") s.period = "past";
  if (p.get("date") === "tonight") s.date = "today";
  const old = p.get("price");
  const legacy = {
    under50: { lt: 5000 },
    "50-69": { min: 5000, max: 6900 },
    "70-100": { min: 7000, max: 10000 },
    over100: { min: 10000, minExclusive: true },
    unlisted: { prices: "unknown-only" },
  };
  if (legacy[old])
    Object.assign(s, legacy[old], { prices: legacy[old].prices || "known" });
  if (p.get("under70") === "1") s.lt = Math.min(s.lt ?? Infinity, 7000);
  if (s.prices === "all" && (s.max !== null || s.min !== null || s.lt !== null))
    s.prices = "known";
  if (s.prices === "unknown-only") {
    s.max = null;
    s.min = null;
    s.lt = null;
    s.minExclusive = false;
  }
  if (s.period === "past" && ["today", "weekend", "7", "30"].includes(s.date))
    s.date = "any";
  if (s.date === "custom" && (!s.from || !s.to || s.from > s.to)) {
    s.date = "any";
    s.from = "";
    s.to = "";
    corrected = true;
  }
  if (shows.length) {
    if (s.city && !shows.some((x) => x.city === s.city)) {
      s.city = "";
      corrected = true;
    }
    if (
      s.venue &&
      !shows.some(
        (x) => x.venueKey === s.venue && (!s.city || s.city === x.city),
      )
    ) {
      s.venue = "";
      corrected = true;
    }
  }
  return { state: s, corrected };
}
export function writeURL(s) {
  const p = new URLSearchParams(),
    d = defaults();
  for (const key of [
    "view",
    "q",
    "city",
    "venue",
    "date",
    "pick",
    "sort",
    "period",
    "collection",
    "show",
    "prices",
  ])
    if (
      s[key] !== d[key] &&
      s[key] &&
      !(
        key === "prices" &&
        s.prices === "known" &&
        s.max !== null &&
        !s.priceExplicit
      )
    )
      p.set(key, s[key]);
  for (const key of ["max", "min", "lt"])
    if (s[key] !== null) p.set(key, String(s[key] / 100));
  if (s.favorite) p.set("curatorFavorite", "1");
  if (s.minExclusive) p.set("minExclusive", "1");
  if (s.date === "custom") {
    p.set("from", s.from);
    p.set("to", s.to);
  }
  return p.size ? "?v=1&" + p.toString() : "";
}
