// Pure view model. Source records are never modified or serialized back to data.
export const ZONE = "America/New_York";
export const PICKS = { 1: "Top pick", 2: "Strong pick", 3: "Worth a look" };
export const defaults = () => ({
  view: "discover",
  q: "",
  city: "",
  venue: "",
  max: null,
  prices: "all",
  priceExplicit: false,
  date: "any",
  from: "",
  to: "",
  pick: "",
  favorite: false,
  sort: "date",
  period: "upcoming",
  collection: "all",
  show: "",
  min: null,
  minExclusive: false,
  lt: null,
});
export const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(value + "T12:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === value;
}
export function regionalDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k).value)
    .join("-");
}
export function addDays(day, count) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function dateLabel(day, full = false) {
  if (!validDate(day)) return "Date to be announced";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: full ? "long" : "short",
    month: full ? "long" : "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(day + "T12:00:00Z"));
}
export function moneyInput(value) {
  if (value === "" || value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text))
    throw new Error(
      "Enter a positive amount with up to two decimal places, or leave blank.",
    );
  const cents = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(cents))
    throw new Error("That amount is too large.");
  return cents;
}
export const dollars = (cents) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
export function safeURL(value) {
  try {
    const u = new URL(value);
    return /^(https?:)$/.test(u.protocol) && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function validateData(data) {
  if (!data || !Array.isArray(data.shows))
    throw new Error("Listings need a shows array.");
  const ids = new Set();
  for (const raw of data.shows) {
    if (
      !raw ||
      typeof raw.id !== "string" ||
      !raw.id ||
      raw.id.length > 128 ||
      ids.has(raw.id)
    )
      throw new Error("Each listing needs a unique stable ID.");
    ids.add(raw.id);
  }
  return data;
}
export function adapt(raw, today = regionalDay()) {
  const text = (v, fallback = "") => (typeof v === "string" ? v : fallback);
  const day = validDate(raw.date_iso)
    ? raw.date_iso
    : validDate(raw.date_start)
      ? raw.date_start
      : null;
  const end =
    validDate(raw.date_end) && raw.date_end >= day ? raw.date_end : day;
  const cents =
    typeof raw.price_pp === "number" &&
    Number.isFinite(raw.price_pp) &&
    raw.price_pp >= 0
      ? Math.round(raw.price_pp * 100)
      : null;
  return {
    raw,
    id: raw.id,
    artist: text(raw.artist, "Untitled show"),
    city: text(raw.city, "Location to be announced"),
    venue: text(raw.venue, "Venue to be announced"),
    venueKey: text(raw.venue_key, text(raw.venue)),
    day,
    end,
    past: end ? end < today : raw.past === true,
    cents,
    perDay: raw.per_day === true,
    time: text(raw.time_text, "Time to be announced"),
    tier: [1, 2, 3].includes(raw.tier) ? raw.tier : null,
    curatorFavorite: raw.s_tier === true,
    link: safeURL(raw.link),
    linkType: text(raw.link_type),
    found: validDate(raw.found_date) ? raw.found_date : null,
    search: normalizeText(
      [raw.artist, raw.city, raw.venue, raw.venue_key].join(" "),
    ),
    status: ["canceled", "postponed", "rescheduled"].includes(raw.status)
      ? raw.status
      : "",
    availability: raw.availability === "sold_out" ? "Sold out" : "",
  };
}
export function priceLabel(show) {
  if (show.cents === null)
    return typeof show.raw.price_label === "string" && show.raw.price_label
      ? show.raw.price_label
      : "Price unknown";
  // Preserve unusual source precision rather than silently displaying a rounded price.
  if (Math.abs(show.raw.price_pp * 100 - show.cents) > 0.00001)
    return show.raw.price_label || `$${show.raw.price_pp}/person`;
  return `${dollars(show.cents)}/person${show.perDay ? "/day" : ""}`;
}
export function rangeFor(state, today) {
  if (state.date === "today") return [today, today];
  if (state.date === "7" || state.date === "30")
    return [today, addDays(today, Number(state.date) - 1)];
  if (state.date === "weekend") {
    const dow = new Date(today + "T12:00Z").getUTCDay();
    const monday = addDays(today, -((dow + 6) % 7));
    return [addDays(monday, 4), addDays(monday, 6)];
  }
  if (state.date === "custom")
    return [state.from || "0000-01-01", state.to || "9999-12-31"];
  return null;
}
export function matches(show, state, today = regionalDay()) {
  if (state.period === "past" ? !show.past : show.past) return false;
  if (state.q && !show.search.includes(normalizeText(state.q.trim())))
    return false;
  if (state.city && show.city !== state.city) return false;
  if (state.venue && show.venueKey !== state.venue) return false;
  if (state.pick && show.tier !== Number(state.pick)) return false;
  if (state.favorite && !show.curatorFavorite) return false;
  const unknown = show.cents === null;
  if (state.prices === "unknown-only" && !unknown) return false;
  if (state.prices === "known" && unknown) return false;
  if (state.prices !== "unknown-only") {
    if (
      unknown &&
      (state.max !== null || state.min !== null || state.lt !== null) &&
      state.prices !== "include-unknown"
    )
      return false;
    if (
      !unknown &&
      ((state.max !== null && show.cents > state.max) ||
        (state.min !== null &&
          (state.minExclusive
            ? show.cents <= state.min
            : show.cents < state.min)) ||
        (state.lt !== null && show.cents >= state.lt))
    )
      return false;
  }
  const range = rangeFor(state, today);
  if (range && (!show.day || show.day > range[1] || show.end < range[0]))
    return false;
  return true;
}
export function sortShows(shows, sort = "date") {
  const date = (a, b) => (a.day || "9999").localeCompare(b.day || "9999");
  const stable = (a, b) =>
    date(a, b) || a.artist.localeCompare(b.artist) || a.id.localeCompare(b.id);
  return [...shows].sort((a, b) => {
    if (sort === "price-asc" || sort === "price-desc") {
      if (a.cents === null || b.cents === null)
        return a.cents === b.cents ? stable(a, b) : a.cents === null ? 1 : -1;
      return (
        (a.cents - b.cents) * (sort === "price-desc" ? -1 : 1) || stable(a, b)
      );
    }
    if (sort === "best")
      return (
        Number(b.curatorFavorite) - Number(a.curatorFavorite) ||
        (a.tier ?? 99) - (b.tier ?? 99) ||
        stable(a, b)
      );
    if (sort === "found")
      return (b.found || "").localeCompare(a.found || "") || stable(a, b);
    return stable(a, b);
  });
}
