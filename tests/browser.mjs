// Real layout/integration checks. Run: BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run test:browser
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  root = fileURLToPath(new URL("../", import.meta.url)),
  out = path.join(root, "test-results");
await mkdir(out, { recursive: true });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost"),
      name = decodeURIComponent(
        url.pathname === "/" ? "/index.html" : url.pathname,
      ),
      file = path.resolve(root, "." + name);
    if (!file.startsWith(root)) throw Error();
    const bytes = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "text/plain",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
  args: ["--no-sandbox"],
});
const checks = [],
  errors = [];
const axeSource = await readFile(
  require.resolve("axe-core/axe.min.js"),
  "utf8",
);
const data = JSON.parse(
  await readFile(path.join(root, "data/shows.json"), "utf8"),
);
const upcoming = data.shows.filter((s) =>
  s.date_iso ? (s.date_end || s.date_iso) >= "2026-11-10" : !s.past,
);
const expected = (max = null, unknown = true) =>
  upcoming.filter((s) =>
    s.price_pp === null ? unknown : max === null || s.price_pp <= max,
  ).length;
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "America/New_York",
    colorScheme: "light",
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => {
    const ActualDate = Date;
    globalThis.Date = class extends ActualDate {
      constructor(...args) {
        super(...(args.length ? args : ["2026-11-10T23:00:00Z"]));
      }
      static now() {
        return new ActualDate("2026-11-10T23:00:00Z").getTime();
      }
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base);
  await page.locator(".concert").first().waitFor();
  assert.equal(
    await page.locator("#result-count").textContent(),
    expected() + " shows",
  );
  checks.push(
    `all ${expected()} upcoming listings visible, including exceptions and unknowns`,
  );
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        first: document.querySelector(".concert").getBoundingClientRect().top,
      }));
      assert(
        layout.scroll <= layout.width,
        `overflow at ${width}/${colorScheme}: ${layout.scroll}`,
      );
      if (width === 390)
        assert(layout.first < 420, `first concert too low: ${layout.first}`);
      await page.screenshot({
        path: path.join(out, `${colorScheme}-${width}.png`),
      });
    }
  }
  checks.push(
    "16 viewport/theme screenshots; no horizontal overflow; phone content starts above 420px",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.locator("#filters-open").click();
  assert(await page.locator("#price-info").isHidden());
  await page.locator("#price-info-button").click();
  assert(await page.locator("#price-info").isVisible());
  await page.locator("#f-max").fill("150");
  await page.locator("#filter-apply").click();
  assert.equal(
    await page.locator("#result-count").textContent(),
    expected(150, false) + " shows",
  );
  assert(page.url().includes("max=150"));
  await page.locator("#filters-open").click();
  await page.locator("#f-max").fill("100");
  await page.locator("#filter-cancel").click();
  assert.equal(
    await page.locator("#result-count").textContent(),
    expected(150, false) + " shows",
  );
  await page.locator("#filters-open").click();
  await page.locator("#f-max").fill("100");
  await page.locator("#filter-apply").click();
  assert.equal(
    await page.locator("#result-count").textContent(),
    expected(100, false) + " shows",
  );
  await page.locator("#filters-open").click();
  await page.locator("#f-prices").selectOption("include-unknown");
  await page.locator("#filter-apply").click();
  assert.equal(
    await page.locator("#result-count").textContent(),
    expected(100, true) + " shows",
  );
  await page
    .locator("#chips")
    .getByRole("button", { name: "Reset all", exact: true })
    .click();
  assert.equal(
    await page.locator("#result-count").textContent(),
    expected() + " shows",
  );
  checks.push(
    "uncapped budget, exact known/unknown results, canceled draft, reset, discreet info",
  );
  const first = page.locator(".concert").first();
  const id = await first.getAttribute("data-event");
  await first.locator('[data-action="favorite"]').click();
  await first.locator('[data-action="going"]').click();
  assert.equal(await page.locator("#saved-count").textContent(), "1");
  await page.locator('.navigation [data-nav="my"]').click();
  assert.equal(await page.locator("#my-upcoming .concert").count(), 1);
  await page.locator('#my-upcoming [data-action="favorite"]').click();
  assert.equal(await page.locator("#my-upcoming .concert").count(), 1);
  await page.reload();
  await page.locator("#my-upcoming .concert").waitFor();
  assert.equal(
    await page
      .locator('#my-upcoming [data-action="going"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.locator('.navigation [data-nav="discover"]').click();
  await page
    .locator(`#show-list [data-event="${id}"] [data-action="details"]`)
    .click();
  assert(await page.locator("#show-dialog").isVisible());
  await page.locator('#show-content [data-action="favorite"]').click();
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset.action),
    "favorite",
  );
  await page.locator("#show-close").click();
  checks.push(
    "independent Favorite/Going, unique counts, persistence, detail actions preserve focus",
  );
  await page.locator('.navigation [data-nav="settings"]').click();
  await page.locator("#theme").selectOption("dark");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.locator("#reduce-glass").check();
  assert.equal(
    await page.locator("html").getAttribute("data-reduce-glass"),
    "true",
  );
  await page.locator("#theme").selectOption("light");
  await page.locator("#reduce-glass").uncheck();
  await page.locator('.navigation [data-nav="discover"]').click();
  // axe is test-only and never loaded by the website.
  await page.evaluate(axeSource);
  let audit = await page.evaluate(async () => {
    const r = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    }));
  });
  await writeFile(
    path.join(out, "accessibility.json"),
    JSON.stringify(audit, null, 2),
  );
  assert.deepEqual(
    audit,
    [],
    "accessibility violations in Discover (see test-results/accessibility.json)",
  );
  await page.locator("#filters-open").click();
  await page.screenshot({ path: path.join(out, "filter-phone.png") });
  audit = await page.evaluate(async () => {
    const r = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    }));
  });
  await writeFile(
    path.join(out, "accessibility-filter.json"),
    JSON.stringify(audit, null, 2),
  );
  assert.deepEqual(audit, [], "accessibility violations in Filters");
  await page.keyboard.press("Escape");
  checks.push("automated accessibility checks in Discover and Filters");
  await page.goto(base + "?v=1&show=" + encodeURIComponent(id));
  await page.locator("#show-dialog[open]").waitFor();
  await page.locator("#show-close").click();
  assert(!page.url().includes("show="));
  await page.locator('.navigation [data-nav="settings"]').click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(exported.schema_version, 1);
  assert(exported.shows.some((s) => s.id === id && s.favorite && s.going));
  await page
    .locator('[data-clear="favorite"]')
    .evaluate((el) => (el.closest("details").open = true));
  await page.locator('[data-clear="favorite"]').click();
  await page.locator("#confirm-accept").click();
  await page
    .locator("#import-file")
    .setInputFiles({
      name: "choices.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exported)),
    });
  await page.locator("#confirm-dialog[open]").waitFor();
  await page.locator("#confirm-accept").click();
  await page.locator("#theme").selectOption("dark");
  await page.locator('.navigation [data-nav="discover"]').click();
  await page.evaluate(axeSource);
  for (const destination of ["discover", "my", "settings"]) {
    if (destination !== "discover")
      await page.locator(`.navigation [data-nav="${destination}"]`).click();
    const violations = await page.evaluate(async () => {
      const r = await axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      });
      return r.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      }));
    });
    assert.deepEqual(
      violations,
      [],
      `dark-theme accessibility: ${destination}`,
    );
  }
  checks.push(
    "export download, confirmed flag clearing, import merge, accessibility across all dark-theme views",
  );
  const failedPage = await context.newPage();
  await failedPage.route("**/data/shows.json", (r) =>
    r.fulfill({ status: 503, body: "Unavailable" }),
  );
  await failedPage.goto(base);
  await failedPage.locator("#load-error:not([hidden])").waitFor();
  assert.equal(
    await failedPage.locator("#result-count").textContent(),
    "Listings unavailable",
  );
  await failedPage.unroute("**/data/shows.json");
  await failedPage.locator("#retry").click();
  await failedPage.locator(".concert").first().waitFor();
  await failedPage.close();
  checks.push(
    "network-failure state recovers through Retry without losing choices",
  );
  assert.deepEqual(errors, []);
  checks.push("direct show links, close behavior, no browser runtime errors");
  await writeFile(
    path.join(out, "browser-checks.json"),
    JSON.stringify(
      { browser: await browser.version(), checks, errors },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { browser: await browser.version(), checks, errors },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.close();
}
