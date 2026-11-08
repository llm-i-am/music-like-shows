"use strict";
/* Concerts & Festivals — client-side app (plan S4).
   Fetch data/shows.json (same-origin, relative), render upcoming by
   default; past only in the Past section behind its toggle. All controls
   compose over one in-memory result set; state round-trips through the
   URL query string (params: q,tier,s,under70,city,venue,price,date,sort,past). */

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TIER_LINES = {
  1: "Tier 1 — strongest recommendation",
  2: "Tier 2 — strong pick",
  3: "Tier 3 — worth a look"
};

const state = {
  q: "", tier: "", s: false, under70: false,
  city: "", venue: "", price: "any", date: "any",
  sort: "date", past: false
};
let DATA = null;

const $ = (id) => document.getElementById(id);

function localISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
function longDate(iso) {
  const d = parseISO(iso);
  return WEEKDAY_LONG[d.getDay()] + ", " + MONTH_LONG[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}
function foundLine(foundDate) {
  const d = parseISO(foundDate);
  return "Found " + MONTH_SHORT[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}
function priceLine(show) {
  if (show.price_pp === null) return "Price unlisted";
  if (show.per_day) return "$" + show.price_pp + " per person, per day";
  return "$" + show.price_pp + " per person";
}

function readStateFromURL() {
  const p = new URLSearchParams(location.search);
  if (p.get("q")) state.q = p.get("q");
  if (["1", "2", "3"].includes(p.get("tier"))) state.tier = p.get("tier");
  state.s = p.get("s") === "1";
  state.under70 = p.get("under70") === "1";
  if (p.get("city")) state.city = p.get("city");
  if (p.get("venue")) state.venue = p.get("venue");
  if (p.get("price")) state.price = p.get("price");
  if (p.get("date")) state.date = p.get("date");
  if (p.get("sort")) state.sort = p.get("sort");
  state.past = p.get("past") === "1";
}
function writeStateToURL() {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.tier) p.set("tier", state.tier);
  if (state.s) p.set("s", "1");
  if (state.under70) p.set("under70", "1");
  if (state.city) p.set("city", state.city);
  if (state.venue) p.set("venue", state.venue);
  if (state.price !== "any") p.set("price", state.price);
  if (state.date !== "any") p.set("date", state.date);
  if (state.sort !== "date") p.set("sort", state.sort);
  if (state.past) p.set("past", "1");
  const qs = p.toString();
  history.replaceState(null, "", qs ? "?" + qs : location.pathname);
}
function isDefaultState() {
  return !state.q && !state.tier && !state.s && !state.under70 && !state.city &&
    !state.venue && state.price === "any" && state.date === "any" &&
    state.sort === "date" && !state.past;
}

function priceBucketOk(show) {
  const v = show.price_pp;
  switch (state.price) {
    case "any": return true;
    case "under50": return v !== null && v < 50;
    case "50-69": return v !== null && v >= 50 && v <= 69;
    case "70-100": return v !== null && v >= 70 && v <= 100;
    case "over100": return v !== null && v > 100;
    case "unlisted": return v === null;
    default: return true;
  }
}
function dateRangeOk(show) {
  if (state.date === "any") return true;
  if (!show.date_iso) return false;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const todayISO = localISO(today);
  const d = parseISO(show.date_iso);
  if (state.date === "tonight") return show.date_iso === todayISO;
  if (state.date === "weekend") {
    const dow = today.getDay(); // 0 Sun .. 6 Sat
    const sinceMonday = (dow + 6) % 7;
    const friday = new Date(today); friday.setDate(today.getDate() - sinceMonday + 4);
    const sunday = new Date(friday); sunday.setDate(friday.getDate() + 2);
    return d >= friday && d <= sunday;
  }
  if (state.date === "7" || state.date === "30") {
    const days = Number(state.date);
    const end = new Date(today); end.setDate(today.getDate() + days - 1);
    return d >= today && d <= end;
  }
  return true;
}
function matches(show, ignoreSearch) {
  if (!ignoreSearch && state.q) {
    const q = state.q.toLowerCase();
    const hay = (show.artist + " " + show.venue + " " + show.city).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (state.tier && show.tier !== Number(state.tier)) return false;
  if (state.s && !show.s_tier) return false;
  if (state.under70 && !show.sweet_spot) return false;
  if (state.city && show.city !== state.city) return false;
  if (state.venue && show.venue_key !== state.venue) return false;
  if (!priceBucketOk(show)) return false;
  if (!dateRangeOk(show)) return false;
  return true;
}
function sortShows(list) {
  const byDate = (a, b) => {
    if (a.date_iso === b.date_iso) return 0;
    if (a.date_iso === null) return 1;
    if (b.date_iso === null) return -1;
    return a.date_iso < b.date_iso ? -1 : 1;
  };
  const out = list.slice();
  switch (state.sort) {
    case "price-asc":
      out.sort((a, b) => {
        if (a.price_pp === null && b.price_pp === null) return byDate(a, b);
        if (a.price_pp === null) return 1;
        if (b.price_pp === null) return -1;
        return a.price_pp - b.price_pp || byDate(a, b);
      }); break;
    case "price-desc":
      out.sort((a, b) => {
        if (a.price_pp === null && b.price_pp === null) return byDate(a, b);
        if (a.price_pp === null) return 1;
        if (b.price_pp === null) return -1;
        return b.price_pp - a.price_pp || byDate(a, b);
      }); break;
    case "best":
      out.sort((a, b) => {
        const ta = a.tier === null ? 99 : a.tier;
        const tb = b.tier === null ? 99 : b.tier;
        if (ta !== tb) return ta - tb;
        if (a.s_tier !== b.s_tier) return a.s_tier ? -1 : 1;
        return byDate(a, b);
      }); break;
    case "found":
      out.sort((a, b) => {
        if (a.found_date !== b.found_date) {
          if (a.found_date === null) return 1;
          if (b.found_date === null) return -1;
          return a.found_date < b.found_date ? 1 : -1;
        }
        return byDate(a, b);
      }); break;
    default:
      out.sort((a, b) => byDate(a, b) || ((a.tier || 99) - (b.tier || 99)) || a.artist.localeCompare(b.artist));
  }
  return out;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function renderCard(show) {
  const card = el("article", "show-card glass");
  const summary = el("button", "card-summary");
  summary.type = "button";
  summary.setAttribute("aria-expanded", "false");
  const artistLine = el("p", "card-artist", show.artist);
  if (show.s_tier) artistLine.appendChild(el("span", "pill pill-stier", "S-tier"));
  if (show.updated) artistLine.appendChild(el("span", "pill pill-updated", "Updated"));
  summary.appendChild(artistLine);
  const when = el("p", "card-line");
  const whenText = show.date_iso === null ? show.date_text : (show.date_text + ", " + show.time_text);
  when.appendChild(el("strong", "", whenText));
  summary.appendChild(when);
  summary.appendChild(el("p", "card-line", show.venue + ", " + show.city));
  const price = el("p", "card-line");
  price.appendChild(el("strong", "", show.price_label));
  if (show.tier !== null) price.appendChild(el("span", "pill pill-tier-" + show.tier, "Tier " + show.tier));
  if (show.over_100) price.appendChild(el("span", "over-flag", "⚠ Over $100"));
  summary.appendChild(price);
  if (show.link) {
    const lb = el("p", "card-line", show.link_label);
    summary.appendChild(lb);
  }
  const detail = el("div", "card-detail");
  detail.hidden = true;
  const fullDate = show.date_iso === null ? show.date_text : longDate(show.date_iso);
  detail.appendChild(el("p", "", fullDate));
  detail.appendChild(el("p", "", "Time: " + show.time_text));
  detail.appendChild(el("p", "", show.venue + ", " + show.city + ", FL"));
  detail.appendChild(el("p", "", priceLine(show)));
  if (show.tier !== null) detail.appendChild(el("p", "", TIER_LINES[show.tier]));
  if (show.s_tier) detail.appendChild(el("p", "", "S-tier — top-shelf favourite"));
  if (show.found_date) detail.appendChild(el("p", "", foundLine(show.found_date)));
  if (show.link) {
    const a = el("a", "link-button", show.link_label);
    a.href = show.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    detail.appendChild(a);
  } else {
    detail.appendChild(el("p", "no-link", "No link in the listings"));
  }
  summary.addEventListener("click", () => {
    const open = detail.hidden;
    detail.hidden = !open;
    summary.setAttribute("aria-expanded", String(open));
  });
  card.appendChild(summary);
  card.appendChild(detail);
  return card;
}

function render() {
  const upcomingAll = DATA.shows.filter((s) => !s.past);
  const pastAll = DATA.shows.filter((s) => s.past);
  $("header-count").textContent = upcomingAll.length + " upcoming shows · updated from the latest listings";
  const upcoming = sortShows(upcomingAll.filter((s) => matches(s, false)));
  const past = sortShows(pastAll.filter((s) => matches(s, false)));
  $("result-count").textContent = upcoming.length + " shows";
  const list = $("upcoming-list");
  list.textContent = "";
  upcoming.forEach((s) => list.appendChild(renderCard(s)));
  const empty = $("empty-state");
  if (upcoming.length === 0) {
    empty.hidden = false;
    if (state.q) {
      const qMatchesSomething = DATA.shows.some((s) =>
        (s.artist + " " + s.venue + " " + s.city).toLowerCase().includes(state.q.toLowerCase()));
      empty.textContent = qMatchesSomething
        ? "No shows match — try widening the filters."
        : "No shows match — and no listing mentions “" + state.q + "”.";
    } else {
      empty.textContent = "No shows match — try widening the filters.";
    }
  } else {
    empty.hidden = true;
  }
  const pastSection = $("past-section");
  pastSection.hidden = !state.past;
  if (state.past) {
    const pl = $("past-list");
    pl.textContent = "";
    past.forEach((s) => pl.appendChild(renderCard(s)));
  }
  $("clear-all").hidden = isDefaultState();
  writeStateToURL();
}

function buildSelects() {
  const cities = [...new Set(DATA.shows.map((s) => s.city))].sort();
  const citySel = $("city");
  cities.forEach((c) => {
    const o = el("option", "", c); o.value = c; citySel.appendChild(o);
  });
  const venueDisplay = new Map();
  DATA.shows.forEach((s) => { if (!venueDisplay.has(s.venue_key)) venueDisplay.set(s.venue_key, s.venue); });
  const venueSel = $("venue");
  [...venueDisplay.keys()].sort().forEach((k) => {
    const o = el("option", "", venueDisplay.get(k)); o.value = k; venueSel.appendChild(o);
  });
}
function applyStateToControls() {
  $("q").value = state.q;
  document.querySelectorAll(".seg").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.tier === state.tier));
  $("s-tier").checked = state.s;
  $("under70").checked = state.under70;
  $("past-toggle").checked = state.past;
  $("city").value = state.city;
  $("venue").value = state.venue;
  $("price").value = state.price;
  $("date-range").value = state.date;
  $("sort").value = state.sort;
}
function wireControls() {
  $("q").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
  document.querySelectorAll(".seg").forEach((b) =>
    b.addEventListener("click", () => {
      state.tier = b.dataset.tier;
      document.querySelectorAll(".seg").forEach((x) => x.classList.toggle("is-active", x === b));
      render();
    }));
  $("s-tier").addEventListener("change", (e) => { state.s = e.target.checked; render(); });
  $("under70").addEventListener("change", (e) => { state.under70 = e.target.checked; render(); });
  $("past-toggle").addEventListener("change", (e) => { state.past = e.target.checked; render(); });
  $("city").addEventListener("change", (e) => { state.city = e.target.value; render(); });
  $("venue").addEventListener("change", (e) => { state.venue = e.target.value; render(); });
  $("price").addEventListener("change", (e) => { state.price = e.target.value; render(); });
  $("date-range").addEventListener("change", (e) => { state.date = e.target.value; render(); });
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("clear-all").addEventListener("click", () => {
    Object.assign(state, { q: "", tier: "", s: false, under70: false, city: "", venue: "",
      price: "any", date: "any", sort: "date", past: false });
    applyStateToControls();
    render();
  });
  $("controls").addEventListener("submit", (e) => e.preventDefault());
}

fetch("data/shows.json")
  .then((r) => { if (!r.ok) throw new Error("shows.json " + r.status); return r.json(); })
  .then((data) => {
    DATA = data;
    readStateFromURL();
    buildSelects();
    applyStateToControls();
    wireControls();
    render();
  })
  .catch(() => {
    $("result-count").textContent = "";
    const empty = $("empty-state");
    empty.hidden = false;
    empty.textContent = "Listings could not be loaded — please try again.";
  });
