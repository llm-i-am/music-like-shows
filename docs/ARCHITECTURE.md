# Small now, maintainable later

Website release: 1.0.0. Plan revision: 2.0.0. Existing producer data format retained. Personal export/storage format: 1. These versions have different owners and must not be conflated.

## Boundaries

`js/model.js` contains pure date, price, source adaptation, filtering and sorting functions. It retains the original record as `raw` and derives a display model without writing back. `js/url-state.js` owns shareable discovery state, validation and legacy query migration. `js/personal-store.js` owns personal flags, preferences, snapshots, recovery and export/import. `js/render.js` creates semantic elements using textContent. `app.js` connects those modules and interactions. `js/theme.js` runs early under the existing self-hosted CSP to avoid an incorrect-theme flash.

No framework, backend, CDN font, shader, analytics tracker or browser write credential is needed. The pinned npm dependencies are development-only: a DOM test environment, browser automation and an accessibility checker. None is shipped to visitors. Avoid turning a new design into a runtime dependency migration.

## Growth over time

**A week/month:** Muse writes the same JSON, the site adapts it automatically. No component needs a hand-edited event count, option list, or price ceiling. Browser URL and numeric validation share one contract. Unit/DOM checks run for both UI and data commits.

**A year:** history remains in the dataset; stable IDs and local snapshots keep saved choices useful through rescheduling and source removals. Only the active result lists render; long lists progressively expose 100 records at a time through an accessible Show more button. Search/filter/sort always operate over the entire catalog, not just the visible batch. No auto-archive/purge policy is introduced.

**Two/three years:** expand only measured bottlenecks. If transfer size becomes material, an optional generated archive index can split old records without deleting canonical data or breaking deep links. Add a compatibility reader and ID lookup before changing producer output. Test old URLs and exports as permanent compatibility fixtures. A single fixed key format stays readable across releases.

**Five years:** a backend, isolated origin, or cross-device sync can be added behind the personal-store interface when actually wanted. Treat account/sync/privacy behavior as a separate feature contract. Offer export/import before changing origins. Never make local flags depend on an account migration succeeding. Favor monotonic additive data evolution and explicit storage migrations over rewriting user history.

## Storage and privacy

Keys are namespaced `music-like-shows:v1:`. Favorite and Going use separate per-ID flag keys, so changing one flag cannot overwrite the other. Snapshots retain original listing facts for unavailable-event recovery and change comparison. Same-origin `storage` events refresh other tabs. Same-key concurrent actions are last-write-wins; there is no claim of distributed synchronization.

Storage access and writes can fail. Choices remain in session with a visible warning and an export action. Corrupt entries do not prevent valid choices from loading; exports include raw recovery entries when corruption is detected. Future schema exports are rejected without replacing current choices. Bulk clear only targets this app's namespace; it never uses localStorage.clear(). Other projects on the GitHub Pages origin are not cryptographically isolated from this data.

Saved views are independent of Discover filters. Both flags can coexist; All saved counts the union. No automatic deletion after an event, no automatic conversion of Going into Attended. The shared URL contains only public IDs and filters, never private flags.

## Validation and release

`npm run check` validates producer compatibility and runs pure/domain, storage and DOM integration checks. `scripts/check-preservation.mjs` checks exact producer-file bytes against a reviewed git baseline for website-only releases. Add outcome-based regressions for bugs, not assertions that mirror CSS implementation details or today's concert count.

Browser validation additionally checks phone and desktop reflow, light/dark, modal focus, keyboard, filters, persistence and failure states. DOM tests are not a substitute for actual Safari/Android or screen-reader testing. Device-specific work should retain its observed browser/device details instead of claiming universal certification.

## Deployment and rollback

GitHub Pages publishes main. Keep production publication atomic: one reviewed commit with the complete compatible UI, then verify Pages deployment and live assets. Keep relative asset URLs for the project subpath. Asset query versions change for a UI release; source JSON revalidates on entry.

If rolling back UI, preserve all data updates made after the original UI release and all browser keys. Revert only the implementation files, not a stale source tree. Use a clean git revert/targeted restoration rather than a forced branch reset. A producer failure never authorizes clearing personal choices.
