# Public website 1.0.0

Implements plan revision 2.0.0: all-price discovery, discreet optional collection note, responsive glass navigation, complete System/Light/Dark themes, independent Favorite/Going choices, My Shows, sharing and source details, import/export, accessible filter drafts and recovery states.

## Preserved data

The production dataset was not edited, migrated or re-curated. Its 76 original records, IDs, values, metadata and bytes remain intact.

- Baseline commit: `5186f8fff47ceb89faf2896a5338a4a58e2dbdb7`
- Original Git blob: `cf4f469e467f2ad6793a56fe7beadaae3ea6f235`
- Dataset SHA-256: `f111fd5a3670374e258405e68829b22f37a40b7cfac1be154c70866de101854c`

## Validation

- 14 domain/storage/DOM tests and the producer compatibility validator.
- Real Chromium 157.0.8103.50 checks with the event calendar frozen to November 10, 2026, Eastern: all 68 upcoming entries, budget $150 retaining $117, $100 known-only = 63, explicit unknown inclusion = 67, and reset = 68.
- 16 viewport/theme screenshots: 320, 360, 375, 390, 430, 768, 1024, 1440 CSS pixels in light and dark. No horizontal overflow in this matrix. At 390×844, the first concert begins above 420px.
- Real-browser saved flags, union counts, reload persistence, modal action focus, canceled filter drafts, direct show links, export download, import merge, confirmed flag clearing, network failure and Retry.
- Axe automated WCAG A/AA checks: Discover/Filters in light mode and all three main views in dark mode, without violations in those checked states. No browser runtime exceptions in the tested main flow.

This is not a claim of completed physical iPhone/Android, VoiceOver/TalkBack or field Core Web Vitals certification. Those remain useful follow-up checks on actual devices. Chrome screenshots and automated accessibility checks have narrower coverage.

## Compatibility

Muse keeps the exact current JSON format and existing curation workflow. Only listing data should be updated during a concert refresh. Read `UPDATER_CONTRACT.md`. Keep original IDs stable through corrections/rescheduling, preserve history and unknown fields, and do not regenerate UI files.

Future website releases must bump the asset query version in HTML **and the module import URLs** when their contents change, avoiding stale cached child modules. The dataset revalidates independently. A rollback must not roll back newer Muse data changes or clear personal storage.
