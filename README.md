# Concerts & Festivals · Tampa Bay & Orlando

[Open the guide](https://llm-i-am.github.io/music-like-shows/)

Ben's curated concert picks, with a responsive Liquid Glass-inspired interface, light/dark themes, optional filters and private Favorite/Going choices. All curated upcoming prices—including exceptions and unknowns—appear by default. Prices are per person and per day when marked; confirm details with the source.

## Concert updates

Muse continues using the existing `data/shows.json` format. No packaging change is required. Read [the updater contract](docs/UPDATER_CONTRACT.md): listing updates must not overwrite the website implementation or change stable IDs.

## Development

Use Node 22 or newer. Run `npm ci --ignore-scripts`, then `npm run check`. Serve this directory with a static HTTP server; no production build step or framework is required. GitHub Pages serves main with the project subpath.

For UI-only changes run `node scripts/check-preservation.mjs <baseline-commit>` to prove the concert file is unchanged. The initial public redesign preserved all 76 source records and their exact bytes. Tests use synthetic fixtures, so future legitimate additions do not break fixed live-count assertions.

See [architecture and growth](docs/ARCHITECTURE.md) for module boundaries, five-year compatibility, privacy, performance, storage and rollback.

For real browser checks, install the test browser with `npx playwright install chromium`, then run `npm run test:browser`. Alternatively set `BROWSER_EXECUTABLE` to an installed Chrome Headless Shell binary. This tests 16 viewport/theme combinations, filters, saved choices, sharing state, import/export, recovery and automated accessibility. Screenshots/reports are written to ignored `test-results/`. These checks complement rather than replace real-device and screen-reader testing.
