import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
test("complete UI: default data, filter drafts, no cap, saved flags, themes, discreet note", async () => {
  const window = new Window({
    url: "https://example.org/music-like-shows/",
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
      disableJavaScriptEvaluation: true,
    },
  });
  const html = readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8",
  ).replace(/<script[\s\S]*?<\/script>/g, "");
  window.document.write(html);
  const realDate = globalThis.Date;
  class FixedDate extends realDate {
    constructor(...args) {
      super(...(args.length ? args : ["2026-11-10T23:00:00Z"]));
    }
  }
  const original = {};
  for (const key of [
    "window",
    "document",
    "navigator",
    "location",
    "history",
    "localStorage",
    "Option",
  ]) {
    original[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {
      value: window[key],
      configurable: true,
      writable: true,
    });
  }
  const realFetch = globalThis.fetch,
    realInterval = globalThis.setInterval,
    realTimeout = globalThis.setTimeout;
  globalThis.Date = FixedDate;
  globalThis.matchMedia = window.matchMedia.bind(window);
  globalThis.setInterval = () => 0;
  globalThis.setTimeout = (fn, ms, ...args) => {
    const timer = realTimeout(fn, ms, ...args);
    timer.unref?.();
    return timer;
  };
  // Synthetic fixed fixture: production updates must never break tests by adding shows.
  const fixture = {
    shows: Array.from({ length: 68 }, (_, i) => ({
      id: "fixture-" + i,
      artist: "Fixture Artist " + i,
      city: "Tampa",
      venue: "Fixture Venue",
      venue_key: "fixture-venue",
      date_iso: "2026-11-13",
      time_text: "7:00pm",
      price_pp: i < 63 ? 50 : i === 63 ? 117 : null,
      tier: 2,
      past: false,
      link: "https://example.org/tickets",
      link_type: "tickets",
    })),
  };
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => structuredClone(fixture),
  });
  window.scrollTo = () => {};
  for (const el of window.document.querySelectorAll("dialog")) {
    el.showModal = () => el.setAttribute("open", "");
    el.close = () => {
      el.removeAttribute("open");
      el.dispatchEvent(new window.Event("close"));
    };
  }
  window.HTMLElement.prototype.scrollIntoView = function () {};
  const $ = (id) => window.document.getElementById(id),
    tick = () => new Promise((resolve) => setImmediate(resolve));
  try {
    await import("../app.js?dom-test");
    await tick();
    assert.equal($("result-count").textContent, "68 shows");
    assert.equal($("show-list").children.length, 68);
    assert($("price-info").hidden);
    assert.equal($("f-max").getAttribute("max"), null);
    $("filters-open").click();
    $("f-max").value = "150";
    $("f-max").dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal($("filter-apply").textContent, "Show 64 concerts");
    assert.equal($("result-count").textContent, "68 shows");
    $("filter-cancel").click();
    assert.equal($("result-count").textContent, "68 shows");
    $("filters-open").click();
    $("price-info-button").click();
    assert(!$("price-info").hidden);
    assert.equal(
      $("price-info").textContent.trim(),
      "Mostly ≤$100/person/day; exceptions included.",
    );
    $("f-max").value = "150";
    $("f-max").dispatchEvent(new window.Event("input", { bubbles: true }));
    $("filter-form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    assert.equal($("result-count").textContent, "64 shows");
    assert(location.search.includes("max=150"));
    const first = $("show-list").querySelector('[data-action="favorite"]');
    const id = first.dataset.id;
    first.click();
    assert.equal($("saved-count").textContent, "1");
    $("show-list")
      .querySelector(`[data-action="going"][data-id="${id}"]`)
      .click();
    assert.equal($("saved-count").textContent, "1");
    window.document.querySelector('.navigation [data-nav="my"]').click();
    assert.equal($("my-upcoming").children.length, 1);
    $("my-upcoming").querySelector('[data-action="favorite"]').click();
    assert.equal($("my-upcoming").children.length, 1);
    window.document.querySelector('.navigation [data-nav="settings"]').click();
    $("theme").value = "dark";
    $("theme").dispatchEvent(new window.Event("change"));
    assert.equal(document.documentElement.dataset.theme, "dark");
    const ids = [...document.querySelectorAll("[id]")].map((n) => n.id);
    assert.equal(ids.length, new Set(ids).size);
  } finally {
    globalThis.Date = realDate;
    globalThis.fetch = realFetch;
    globalThis.setInterval = realInterval;
    globalThis.setTimeout = realTimeout;
    for (const [key, desc] of Object.entries(original)) {
      if (desc) Object.defineProperty(globalThis, key, desc);
      else delete globalThis[key];
    }
    await window.happyDOM.close();
  }
});
