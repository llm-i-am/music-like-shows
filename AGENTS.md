# Repository maintenance

- Read `docs/UPDATER_CONTRACT.md` before changing the site or its data.
- Website-only changes must leave `data/shows.json` byte-identical. Preserve legitimate concurrent Muse updates when rebasing; never restore an older data file to pass a check.
- Keep existing IDs, original values, unknown fields, past records and intentional price exceptions. A UI task is not permission to re-curate or clean the catalog.
- Keep all curated prices and unknowns visible by default. Optional visitor maxima are unrestricted by the curator's $100/day preference.
- Run `npm run check`. For UI-only work also run `node scripts/check-preservation.mjs <reviewed-baseline-commit>`.
- Keep runtime code self-hosted, accessible and dependency-light. Do not weaken CSP to add visual effects.
- Browser state is namespaced/versioned. Never clear unrelated origin data, leak personal flags into links, or derive replacement IDs from mutable event fields.
- A new backend, source-format migration, account system or public attendance feature needs a separate explicit scope decision.
