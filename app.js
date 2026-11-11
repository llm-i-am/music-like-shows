import {
  defaults,
  regionalDay,
  adapt,
  validateData,
  matches,
  sortShows,
  moneyInput,
  dollars,
  rangeFor,
  dateLabel,
} from "./js/model.js?v=1.0.0";
import { readURL, writeURL } from "./js/url-state.js?v=1.0.0";
import { PersonalStore, validateImport, PREFIX } from "./js/personal-store.js?v=1.0.0";
import { el, card, detail } from "./js/render.js?v=1.0.0";

const $ = (id) => document.getElementById(id);
let source = null,
  shows = [],
  state = readURL(location.search).state,
  draft = null,
  view = state.view,
  returnState = null,
  day = regionalDay(),
  loadFailed = false;
let toastTimer,
  undoAction = null,
  showTrigger = null,
  filterTrigger = null,
  openedWithHistory = false,
  importPayload = null;
const listLimits = new Map();
let storage;
try {
  storage = localStorage;
} catch {
  storage = {
    get length() {
      throw Error("Unavailable");
    },
    setItem() {
      throw Error("Unavailable");
    },
  };
}
const store = new PersonalStore(storage);
function toast(message, undo = null) {
  clearTimeout(toastTimer);
  undoAction = undo;
  $("toast-copy").textContent = message;
  $("undo").hidden = !undo;
  $("toast").hidden = false;
  toastTimer = setTimeout(
    () => {
      $("toast").hidden = true;
      undoAction = null;
    },
    undo ? 10000 : 6500,
  );
}
function syncStorageStatus() {
  $("storage-warning").hidden = !(store.failed || store.corrupt);
  $("storage-warning-text").textContent = store.failed
    ? "Session only—your browser couldn’t save these choices. Export a backup before leaving."
    : "Some saved data could not be read. Your remaining choices are intact; export a backup before making changes.";
}
function personalItems() {
  const current = new Map(shows.map((s) => [s.id, s]));
  return store
    .entries()
    .map((entry) => ({
      entry,
      show:
        current.get(entry.id) ||
        adapt(
          entry.snapshot && typeof entry.snapshot === "object"
            ? entry.snapshot
            : {
                id: entry.id,
                artist: "Saved show",
                date_text: "Date unavailable",
              },
          day,
        ),
      unavailable: !current.has(entry.id),
    }));
}
function listInto(id, items, options = {}) {
  const node = $(id),
    active = document.activeElement,
    activeId = active?.dataset?.id,
    activeAction = active?.dataset?.action;
  const old = active?.closest(".concert"),
    index = old ? [...node.children].indexOf(old) : -1;
  const limit = listLimits.get(id) || 100;
  const frag = document.createDocumentFragment();
  for (const item of items.slice(0, limit)) {
    const show = item.show || item;
    frag.append(
      card(show, store.flags(show.id), {
        ...options,
        unavailable: !!item.unavailable,
      }),
    );
  }
  if (items.length > limit) {
    const more = el(
      "button",
      "secondary",
      `Show ${Math.min(100, items.length - limit)} more · ${items.length - limit} remaining`,
    );
    more.type = "button";
    more.onclick = () => {
      listLimits.set(id, limit + 100);
      listInto(id, items, options);
      node
        .querySelectorAll(".concert")
        [limit]?.querySelector("button")
        ?.focus({ preventScroll: true });
    };
    frag.append(more);
  }
  node.replaceChildren(frag);
  if (activeId && old && index !== -1) {
    const target = [...node.querySelectorAll("[data-action]")].find(
      (b) => b.dataset.id === activeId && b.dataset.action === activeAction,
    );
    if (target) target.focus({ preventScroll: true });
    else if (view === "my") {
      const fallback =
        node.children[Math.min(index, node.children.length - 1)]?.querySelector(
          "button",
        ) || $("my-upcoming-count");
      fallback.focus({ preventScroll: true });
    }
  }
}
function chips() {
  const values = [];
  const add = (text, clear) => values.push({ text, clear });
  if (state.q)
    add("“" + state.q + "”", () => {
      state.q = "";
      $("search").value = "";
    });
  if (state.city)
    add(state.city, () => {
      state.city = "";
      state.venue = "";
    });
  if (state.venue)
    add(state.venue, () => {
      state.venue = "";
    });
  if (state.max !== null)
    add(
      "Up to " +
        dollars(state.max) +
        (state.prices === "include-unknown" ? " + unknown" : ""),
      () => {
        state.max = null;
        if (
          state.prices === "include-unknown" ||
          (state.prices === "known" && !state.priceExplicit)
        )
          state.prices = "all";
      },
    );
  if (state.min !== null || state.lt !== null)
    add(
      state.min === 10000 && state.minExclusive
        ? "Over $100"
        : "Legacy price range",
      () => {
        state.min = null;
        state.lt = null;
        state.minExclusive = false;
        state.max = null;
        state.prices = "all";
      },
    );
  if (state.prices === "known" && state.max === null)
    add("Known prices", () => (state.prices = "all"));
  if (state.prices === "unknown-only")
    add("Unknown prices", () => (state.prices = "all"));
  if (state.date !== "any")
    add(dateText(state), () => {
      state.date = "any";
      state.from = "";
      state.to = "";
    });
  if (state.pick)
    add(
      { 1: "Top picks", 2: "Strong picks", 3: "Worth a look" }[state.pick],
      () => (state.pick = ""),
    );
  if (state.favorite) add("Curator favorites", () => (state.favorite = false));
  if (state.period === "past")
    add("Past shows", () => {
      state.period = "upcoming";
      state.date = "any";
    });
  if (state.sort !== "date")
    add(
      "Sorted: " + $("sort").selectedOptions[0].textContent,
      () => (state.sort = "date"),
    );
  const frag = document.createDocumentFragment();
  for (const value of values) {
    const b = el("button", "chip", value.text + " ×");
    b.type = "button";
    b.setAttribute("aria-label", "Remove filter: " + value.text);
    b.onclick = () => {
      value.clear();
      commit();
    };
    frag.append(b);
  }
  if (values.length) {
    const b = el("button", "quiet-button", "Reset all");
    b.type = "button";
    b.onclick = reset;
    frag.append(b);
  }
  $("chips").replaceChildren(frag);
  $("filter-count").textContent = values.length;
  $("filter-count").hidden = !values.length;
}
function dateText(s) {
  return {
    any: s.period === "past" ? "All past dates" : "Any upcoming date",
    today: "Today",
    weekend: "This weekend",
    7: "Next 7 days",
    30: "Next 30 days",
    custom: s.from + " – " + s.to,
  }[s.date];
}
function render() {
  $("discover-view").hidden = view !== "discover";
  $("my-view").hidden = view !== "my";
  $("settings-view").hidden = view !== "settings";
  document.querySelectorAll(".navigation [data-nav]").forEach((b) => {
    if (b.dataset.nav === view) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $("search").value = state.q;
  $("search-clear").hidden = !state.q;
  $("sort").value = state.sort;
  $("date-quick").textContent = dateText(state) + " ⌄";
  $("budget-quick").textContent =
    state.max !== null ? "Up to " + dollars(state.max) + " ⌄" : "All prices ⌄";
  chips();
  const items = sortShows(
    shows.filter((s) => matches(s, state, day)),
    state.sort,
  );
  $("result-count").textContent = source
    ? `${items.length} ${items.length === 1 ? "show" : "shows"}${state.period === "past" ? " · past" : ""}`
    : loadFailed
      ? "Listings unavailable"
      : "Finding your next show…";
  $("empty").hidden = !source || items.length > 0;
  $("load-error").hidden = !loadFailed;
  if (view === "discover")
    listInto("show-list", items, {
      personalBadges: store.setting("discoverBadges", true),
    });
  const saved = personalItems(),
    upcoming = saved.filter((x) => !x.unavailable && !x.show.past);
  $("saved-count").textContent = upcoming.length;
  $("saved-count").hidden = !upcoming.length;
  $("saved-count").setAttribute(
    "aria-label",
    upcoming.length + " upcoming saved shows",
  );
  const select = (x) =>
    state.collection === "all" ||
    (state.collection === "favorites" ? x.entry.favorite : x.entry.going);
  const selected = saved.filter(select),
    up = selected.filter((x) => !x.unavailable && !x.show.past),
    past = selected.filter((x) => !x.unavailable && x.show.past),
    unavailable = selected.filter((x) => x.unavailable);
  document.querySelectorAll("[data-collection]").forEach((b) => {
    const type = b.dataset.collection,
      count = saved.filter(
        (x) =>
          type === "all" ||
          (type === "favorites" ? x.entry.favorite : x.entry.going),
      ).length;
    b.textContent =
      { all: "All saved", favorites: "Favorites", going: "Going" }[type] +
      " " +
      count;
    b.setAttribute("aria-pressed", String(type === state.collection));
  });
  if (view === "my") {
    listInto("my-upcoming", sortShows(up.map((x) => x.show)));
    listInto("my-past-list", sortShows(past.map((x) => x.show)));
    listInto("my-unavailable-list", unavailable);
  }
  $("my-upcoming-count").textContent = "Upcoming · " + up.length;
  $("my-empty").hidden = selected.length > 0;
  $("my-past-label").textContent = "Past shows · " + past.length;
  $("my-past").hidden = !past.length;
  $("my-unavailable-label").textContent =
    "Unavailable listings · " + unavailable.length;
  $("my-unavailable").hidden = !unavailable.length;
  syncStorageStatus();
}
function writeHistory(push = true) {
  const query = writeURL({
    ...state,
    view: view === "settings" ? "discover" : view,
  });
  history[push ? "pushState" : "replaceState"](
    { view },
    "",
    location.pathname + query,
  );
}
function commit(push = true) {
  listLimits.clear();
  render();
  writeHistory(push);
}
function reset() {
  state = { ...defaults(), view: "discover" };
  view = "discover";
  commit();
}
function navigate(next) {
  if (view === "discover") returnState = { ...state };
  if (next === "discover" && returnState) state = { ...returnState, show: "" };
  if (next === "my" && view !== "my")
    state.collection = store.setting("defaultCollection", "all");
  view = next;
  state.view = next === "settings" ? "discover" : next;
  state.show = "";
  commit();
  window.scrollTo({ top: 0 });
  $(
    next === "my"
      ? "my-title"
      : next === "settings"
        ? "settings-title"
        : "discover-title",
  ).setAttribute("tabindex", "-1");
  $(
    next === "my"
      ? "my-title"
      : next === "settings"
        ? "settings-title"
        : "discover-title",
  ).focus({ preventScroll: true });
}
function lock() {
  document.body.classList.toggle(
    "locked",
    !!document.querySelector("dialog[open]"),
  );
}
function currentShow(id) {
  return (
    shows.find((s) => s.id === id) ||
    personalItems().find((x) => x.show.id === id)?.show
  );
}
function showContent() {
  const active = document.activeElement,
    action = active?.dataset?.action,
    id = active?.dataset?.id;
  const show = currentShow(state.show);
  const content = $("show-content");
  if (show) {
    const entry = store.entries().find((x) => x.id === show.id);
    content.replaceChildren(
      detail(
        show,
        store.flags(show.id),
        !shows.some((s) => s.id === show.id),
        entry?.snapshot,
      ),
    );
  } else {
    const title = el("h2", "", "This listing is unavailable");
    title.id = "show-title";
    content.replaceChildren(
      title,
      el(
        "p",
        "",
        "It may no longer be in this guide. Close this panel to browse other shows.",
      ),
    );
  }
  if (action && id)
    [...content.querySelectorAll("[data-action]")]
      .find((b) => b.dataset.action === action && b.dataset.id === id)
      ?.focus({ preventScroll: true });
}
function openShow(id, trigger = null, push = true) {
  state.show = id;
  showTrigger = trigger;
  if (push) {
    writeHistory(true);
    openedWithHistory = true;
  } else openedWithHistory = false;
  showContent();
  if (!$("show-dialog").open) $("show-dialog").showModal();
  lock();
  $("show-close").focus();
}
function closeShow() {
  if (!$("show-dialog").open) return;
  $("show-dialog").close();
  lock();
  if (openedWithHistory) history.back();
  else {
    state.show = "";
    writeHistory(false);
  }
  showTrigger?.focus({ preventScroll: true });
}
function flip(id, flag) {
  const show = currentShow(id);
  if (!show) return;
  const before = store.flags(id)[flag];
  // Capture first-saved facts, not a continually overwritten snapshot.
  const previous = store.get("snapshot:" + encodeURIComponent(id));
  store.setFlag(id, flag, !before, previous || show.raw);
  render();
  if ($("show-dialog").open) showContent();
  const first = !store.setting("educated", false);
  if (first) store.put("setting:educated", true);
  toast(
    store.failed
      ? "Session only—export to keep this choice."
      : (flag === "favorite"
          ? before
            ? "Removed from Favorites"
            : "Added to Favorites"
          : before
            ? "Removed Going"
            : "Marked Going") +
          (first ? " · Saved on this browser; not public." : ""),
    () => {
      store.setFlag(id, flag, before, previous || show.raw);
      render();
      if ($("show-dialog").open) showContent();
      toast("Choice restored.");
    },
  );
}
function fillOptions(id, values, value, all) {
  const sel = $(id);
  sel.replaceChildren(new Option(all, ""));
  for (const [key, label, count] of values)
    sel.add(new Option(label + " (" + count + ")", key));
  if (value && !values.some((x) => x[0] === value))
    sel.add(new Option(value + " (0)", value));
  sel.value = value;
}
function facets() {
  const period = $("f-period").value,
    city = $("f-city").value,
    venue = $("f-venue").value;
  const available = shows.filter((x) => (period === "past" ? x.past : !x.past));
  const cities = new Map();
  available.forEach((x) => cities.set(x.city, (cities.get(x.city) || 0) + 1));
  fillOptions(
    "f-city",
    [...cities].sort().map(([k, n]) => [k, k, n]),
    city,
    "All listed cities",
  );
  const venues = new Map();
  available
    .filter((x) => !city || x.city === city)
    .forEach((x) => {
      const prev = venues.get(x.venueKey);
      venues.set(x.venueKey, [x.venue, (prev?.[1] || 0) + 1]);
    });
  fillOptions(
    "f-venue",
    [...venues].sort().map(([k, [label, n]]) => [k, label, n]),
    venue,
    "All listed venues",
  );
}
function fillDraft() {
  for (const key of [
    "period",
    "date",
    "from",
    "to",
    "city",
    "venue",
    "pick",
    "prices",
  ])
    $("f-" + key).value = draft[key];
  $("f-max").value = draft.max === null ? "" : String(draft.max / 100);
  $("f-favorite").checked = draft.favorite;
  facets();
  previewDraft();
}
function draftFromControls() {
  const next = { ...draft };
  for (const key of [
    "period",
    "date",
    "from",
    "to",
    "city",
    "venue",
    "pick",
    "prices",
  ])
    next[key] = $("f-" + key).value;
  next.favorite = $("f-favorite").checked;
  next.max = next.prices === "unknown-only" ? null : moneyInput($("f-max").value);
  if (
    next.period === "past" &&
    ["today", "weekend", "7", "30"].includes(next.date)
  )
    next.date = "any";
  if (next.prices === "unknown-only") {
    next.max = null;
    next.min = null;
    next.lt = null;
    next.minExclusive = false;
  } else if (next.max !== null && next.prices === "all") next.prices = "known";
  if (next.date === "custom" && (!next.from || !next.to || next.from > next.to))
    throw Error(
      "Choose a valid start and end date, with the end on or after the start.",
    );
  return next;
}
function previewDraft() {
  const past = $("f-period").value === "past";
  for (const o of $("f-date").options)
    o.disabled = past && ["today", "weekend", "7", "30"].includes(o.value);
  if (past && ["today", "weekend", "7", "30"].includes($("f-date").value))
    $("f-date").value = "any";
  $("custom-dates").hidden = $("f-date").value !== "custom";
  $("f-max").disabled = $("f-prices").value === "unknown-only";
  try {
    const next = draftFromControls(),
      range = rangeFor(next, day);
    $("filter-apply").textContent =
      "Show " + shows.filter((s) => matches(s, next, day)).length + " concerts";
    $("filter-error").hidden = true;
    $("date-explanation").textContent =
      range && next.date !== "custom"
        ? dateLabel(range[0]) + " – " + dateLabel(range[1]) + " · Eastern time"
        : "All event times are Eastern.";
  } catch {
    $("filter-apply").textContent = "Apply filters";
  }
}
function openFilters(target = "filter-title") {
  filterTrigger = document.activeElement;
  draft = { ...state };
  fillDraft();
  $("price-info").hidden = true;
  $("price-info-button").setAttribute("aria-expanded", "false");
  $("filter-error").hidden = true;
  $("filter-dialog").showModal();
  lock();
  $(target).focus();
}
function closeFilters() {
  $("filter-dialog").close();
  lock();
  draft = null;
  filterTrigger?.focus({ preventScroll: true });
}
function exportChoices() {
  const blob = new Blob([JSON.stringify(store.export(), null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = el("a");
  a.href = url;
  a.download = "music-like-shows-choices-" + day + ".json";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Exported your concert choices.");
}
async function confirmAction(title, copy, label = "Continue", extra = null) {
  $("confirm-title").textContent = title;
  $("confirm-copy").textContent = copy;
  $("confirm-accept").textContent = label;
  $("confirm-extra").replaceChildren();
  if (extra) $("confirm-extra").append(extra);
  const dialog = $("confirm-dialog");
  dialog.returnValue = "cancel";
  dialog.showModal();
  lock();
  dialog.querySelector('[value="cancel"]').focus();
  return new Promise((resolve) =>
    dialog.addEventListener(
      "close",
      () => {
        lock();
        resolve(dialog.returnValue === "confirm");
      },
      { once: true },
    ),
  );
}
async function share(url, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied.");
  } catch {
    const input = el("input");
    input.value = url;
    input.readOnly = true;
    input.setAttribute("aria-label", "Link to copy");
    await confirmAction(
      "Copy this link",
      "Select and copy the link below.",
      "Done",
      input,
    );
  }
}
function applyTheme() {
  const theme = store.setting("theme", "system");
  document.documentElement.dataset.theme = ["system", "dark", "light"].includes(
    theme,
  )
    ? theme
    : "system";
  document.documentElement.dataset.reduceGlass = String(
    store.setting("reduceGlass", false),
  );
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme:dark)").matches);
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => (m.content = dark ? "#0d101c" : "#f5f3fa"));
}
function settings() {
  $("theme").value = store.setting("theme", "system");
  $("reduce-glass").checked = store.setting("reduceGlass", false);
  $("default-collection").value = store.setting("defaultCollection", "all");
  $("past-expanded").checked = store.setting("pastExpanded", false);
  $("my-past").open = store.setting("pastExpanded", false);
  $("discover-badges").checked = store.setting("discoverBadges", true);
  applyTheme();
}
async function load() {
  loadFailed = false;
  render();
  try {
    const response = await fetch("data/shows.json", {
      cache: "no-cache",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error("HTTP " + response.status);
    source = validateData(await response.json());
    shows = source.shows.map((raw) => adapt(raw, day));
    const parsed = readURL(location.search, shows);
    state = parsed.state;
    view = history.state?.view || state.view;
    loadFailed = false;
    render();
    writeHistory(false);
    if (state.show) openShow(state.show, null, false);
    if (parsed.corrected) toast("An outdated filter was adjusted.");
  } catch (error) {
    console.error("Could not load concert listings:", error);
    loadFailed = true;
    render();
  }
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.nav) {
    navigate(b.dataset.nav);
    return;
  }
  if (b.hasAttribute("data-open-settings")) {
    navigate("settings");
    $(b.dataset.settingsTarget || "about-guide").scrollIntoView();
    return;
  }
  if (b.dataset.collection) {
    state.collection = b.dataset.collection;
    commit();
    return;
  }
  if (b.dataset.action) {
    const { id, action } = b.dataset;
    if (action === "details") openShow(id, b);
    else if (action === "share")
      await share(
        location.origin +
          location.pathname +
          writeURL({ ...defaults(), show: id }),
        currentShow(id)?.artist || "Concert",
      );
    else flip(id, action);
    return;
  }
  if (b.hasAttribute("data-max")) {
    $("f-max").value = b.dataset.max;
    $("f-prices").value = b.dataset.max === "" ? "all" : "known";
    draft.priceExplicit = false;
    draft.min = null;
    draft.lt = null;
    draft.minExclusive = false;
    previewDraft();
    return;
  }
  if (b.dataset.clear) {
    const kind = b.dataset.clear,
      n = store.entries().filter((x) => kind === "all" || x[kind]).length;
    const exportButton = el("button", "secondary", "Export a backup first");
    exportButton.type = "button";
    exportButton.onclick = exportChoices;
    if (
      await confirmAction(
        "Clear saved choices?",
        `This removes ${n} ${n === 1 ? "choice" : "choices"} from this browser. Other settings stay unchanged. Export first if you want a backup.`,
        "Clear choices",
        exportButton,
      )
    ) {
      store.clear(kind);
      render();
      toast("Saved choices cleared.");
    }
    return;
  }
});
$("filters-open").onclick = () => openFilters();
$("date-quick").onclick = () => openFilters("f-date");
$("budget-quick").onclick = () => openFilters("f-max");
$("filter-cancel").onclick = closeFilters;
$("filter-dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeFilters();
});
$("filter-dialog").addEventListener("click", (e) => {
  if (e.target === $("filter-dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeFilters();
  }
});
$("filter-reset").onclick = () => {
  draft = { ...defaults(), q: "", sort: "date" };
  fillDraft();
};
$("price-info-button").onclick = () => {
  const open = $("price-info").hidden;
  $("price-info").hidden = !open;
  $("price-info-button").setAttribute("aria-expanded", String(open));
};
$("filter-form").addEventListener("input", (e) => {
  if (e.target.id === "f-max") {
    draft.min = null;
    draft.lt = null;
    draft.minExclusive = false;
    if (e.target.value !== "" && $("f-prices").value === "all")
      $("f-prices").value = "known";
    else if (
      e.target.value === "" &&
      !draft.priceExplicit &&
      $("f-prices").value === "known"
    )
      $("f-prices").value = "all";
  }
  previewDraft();
});
$("filter-form").addEventListener("change", (e) => {
  if (e.target.id === "f-prices") {
    draft.priceExplicit = e.target.value !== "all";
    if (e.target.value === "all") {
      $("f-max").value = "";
      draft.min = null;
      draft.lt = null;
      draft.minExclusive = false;
    }
  }
  if (["f-city", "f-period"].includes(e.target.id)) {
    if (e.target.id === "f-city" && $("f-venue").value) {
      $("f-venue").value = "";
      toast("Venue cleared for the selected city.");
    }
    facets();
  }
  previewDraft();
});
$("filter-form").addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    const next = draftFromControls();
    state = { ...next, show: "" };
    closeFilters();
    commit();
  } catch (error) {
    $("filter-error").textContent = error.message;
    $("filter-error").hidden = false;
    $("filter-error").scrollIntoView({ block: "nearest" });
  }
});
let searchTimer;
$("search").oninput = (e) => {
  state.q = e.target.value.slice(0, 200);
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => commit(false), 120);
};
$("search-clear").onclick = () => {
  clearTimeout(searchTimer);
  state.q = "";
  commit(false);
  $("search").focus();
};
$("sort").onchange = (e) => {
  state.sort = e.target.value;
  commit();
};
$("reset-empty").onclick = reset;
$("retry").onclick = load;
$("show-close").onclick = closeShow;
$("show-dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeShow();
});
$("show-dialog").addEventListener("click", (e) => {
  if (e.target === $("show-dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeShow();
  }
});
$("share-filters").onclick = () =>
  share(
    location.origin +
      location.pathname +
      writeURL({ ...state, view: "discover", show: "", collection: "all" }),
    "Concerts & Festivals",
  );
$("export").onclick = exportChoices;
$("warning-export").onclick = exportChoices;
$("import").onclick = () => $("import-file").click();
$("import-file").onchange = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (file.size > 1000000) throw Error("Choose an export smaller than 1 MB.");
    importPayload = validateImport(JSON.parse(await file.text()));
    const wrap = el("label", "check-label"),
      check = el("input");
    check.type = "checkbox";
    wrap.append(
      check,
      document.createTextNode("Replace existing choices instead of merging"),
    );
    if (
      await confirmAction(
        "Import " + importPayload.shows.length + " saved shows?",
        "Merge adds choices without removing existing Favorites or Going. Replace clears existing choices first.",
        "Import choices",
        wrap,
      )
    ) {
      if (
        check.checked &&
        !(await confirmAction(
          "Replace all existing choices?",
          "This removes current choices before importing. Export a backup first if needed.",
          "Replace choices",
        ))
      )
        return;
      store.importFile(importPayload, check.checked);
      render();
      toast("Concert choices imported.");
    }
  } catch (error) {
    toast(error.message);
  } finally {
    importPayload = null;
  }
};
for (const [id, key] of [
  ["theme", "theme"],
  ["reduce-glass", "reduceGlass"],
  ["default-collection", "defaultCollection"],
  ["past-expanded", "pastExpanded"],
  ["discover-badges", "discoverBadges"],
])
  $(id).onchange = (e) => {
    store.put(
      "setting:" + key,
      e.target.type === "checkbox" ? e.target.checked : e.target.value,
    );
    settings();
    render();
  };
$("toast-close").onclick = () => {
  $("toast").hidden = true;
};
$("undo").onclick = () => {
  const undo = undoAction;
  undoAction = null;
  undo?.();
};
window.addEventListener("storage", (e) => {
  if (e.key?.startsWith(PREFIX)) {
    store.receive(e.key, e.newValue);
    settings();
    render();
    if ($("show-dialog").open) showContent();
  }
});
window.addEventListener("popstate", () => {
  const parsed = readURL(location.search, shows);
  state = parsed.state;
  view = history.state?.view || state.view;
  if (state.show) openShow(state.show, null, false);
  else if ($("show-dialog").open) {
    $("show-dialog").close();
    lock();
    showTrigger?.focus({ preventScroll: true });
  }
  render();
});
function refreshDay() {
  const next = regionalDay();
  if (next !== day) {
    day = next;
    shows = source ? source.shows.map((raw) => adapt(raw, day)) : [];
    render();
  }
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshDay();
});
setInterval(refreshDay, 60000);
matchMedia("(prefers-color-scheme:dark)").addEventListener(
  "change",
  applyTheme,
);
settings();
render();
load();
