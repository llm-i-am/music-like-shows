# Concert updates: stable contract

The website is a static, account-free app. Muse can continue producing the **existing `data/shows.json` format**. No repackaging, new search process, new curation rule, or new required metadata is needed.

## Ownership

- Concert updates: `data/shows.json` only. Preserve envelope fields (`counts`, `source_sha256`, any future fields) according to the existing producer's process.
- Website implementation: `index.html`, `app.js`, `js/`, `styles.css`, `assets/`, tests, configuration and documentation. Do not regenerate or overwrite them during a listing refresh.
- `data/shows.schema.json` documents compatibility and belongs to the website code. It is not concert output.

## Identity and compatibility

Keep every existing show ID stable when changing its price, time, spelling or date. Separate ticketed performances/nights need separate IDs. Do not regenerate IDs from mutable facts, renumber the catalog, strip unknown fields, purge past shows or deduplicate by artist as part of a normal UI update. Preserve intentional price exceptions and unknown prices. Existing ranking fields, dates, original labels and links remain supported.

The app derives present-day Upcoming/Past status in Eastern time without writing it back. Existing `past` and producer counts are retained and remain useful as fallback/audit information. With no visitor filters, all curated upcoming records appear, including over-$100 entries and unknown prices. The curator's approximate $100/person/day preference is an optional info note, never an app-enforced collection limit.

Keep nullable values null. Do not fabricate prices, dates, verification times or sold-out status to satisfy a new UI. Optional future `date_end`, `status` (canceled/postponed/rescheduled) and `availability: sold_out` fields are supported when genuinely known, but are not required. Original fields always remain intact. Ticket/article/details link categories control honest link labels.

## Checks and publication

Run `npm ci --ignore-scripts` once after checkout, then `npm run check`. Tests use fixed synthetic fixtures and do not enforce a specific live count or date horizon. They permit additions, unknown fields and retained history. No test is a request to delete records to make a count match.

Publish a complete JSON file atomically, not partially written content. Commit only intended data changes; pull the latest main before writing, review the added/changed/removed ID diff, and do not force-push over concurrent website changes. Investigate unexplained removals or ID churn rather than silently accepting them. Normal intentional curator corrections belong in the existing curation workflow, with a reviewable diff.

For website-only work, `node scripts/check-preservation.mjs <reviewed-baseline-commit>` must pass. If legitimate Muse additions landed meanwhile, rebase the UI work onto that new baseline; never restore stale data. The first public UI release preserved the original `data/shows.json` bytes.

## Future changes

Any necessary producer format change is a separate compatibility decision: adapter first, no removed fields, stable IDs, representative fixtures and lossless round-trip tests. Website and personal-storage versions are separate. A later website must migrate personal state deliberately; it must never clear browser storage wholesale.
