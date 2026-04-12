# Progress

## Current Status

**Phase:** Hardening complete for protocol/failure-taxonomy scope; local filesystem sync now in partial implementation / validation phase  
**Corpus scope:** ~1,500+ Acts across 57 volumes (1799–2026)  
**Extension:** Chrome MV3 with durable storage, classification-driven retry policy, dual protocol support, and in-progress local filesystem sync

---

## What Works

- [x] Chrome extension loads and opens side panel
- [x] Page type detection supports allowed hostname over both `http:` and `https:`
- [x] Queue state machine tracks pending → processing → success/failed states
- [x] Queue retry policy uses failure classification (`transient` vs `permanent`)
- [x] Side panel error-page taxonomy distinguishes:
  - [x] `ACT_NOT_FOUND` (permanent)
  - [x] `SITE_UNAVAILABLE` (transient)
- [x] Valid act-detail URLs with numeric act IDs like `404`, `500`, `502`, `503`, `504` are no longer mistaken for HTTP error pages
- [x] Readiness detection accepts strong BDLaws DOM structure for irregular/older pages even without modern enactment wording
- [x] IndexedDB storage initialization with fallback chain
- [x] Write-ahead logging (WAL) and extraction receipts
- [x] Audit log structure and export hooks
- [x] DOM extraction via `element.textContent` (canonical)
- [x] Three-version content model (raw → normalized → corrected)
- [x] `computeContentHash()` returns raw 64-char SHA-256 hex
- [x] `_simpleHash()` uses `length_checksum` format
- [x] URL normalization is protocol-aware (`_normalizeUrl` + `_detectPreferredProtocol`)
- [x] Export tab shows a filesystem sync control surface instead of a missing section
- [x] Local sync runtime helpers exist in `bdlaw-filesystem-sync.js`
- [x] Local sync manifest helpers exist in `bdlaw-sync-manifest.js`
- [x] Side panel restores persisted sync state and stored directory handle on startup
- [x] Side panel can rebuild pending sync work from captured acts, failed extractions, and sync manifest state
- [x] Side panel can schedule and manually trigger filesystem sync flushes
- [x] Sync flow can write canonical folder contents for acts, failed acts, logs, manifest, and sync state
- [x] Storage layer persists sync metadata via sync-state helpers and stored directory-handle support
- [x] Checked-in `BDLawsActs/` mirror matches the extension's canonical filesystem sync layout
- [x] Checked-in `BDLawsActs/` snapshot is internally consistent (`1570` acts, `3` failed, manifest counts aligned, `pending_count: 0`)
- [x] Targeted property suites updated and passing:
  - [x] domain property tests
  - [x] page-type property tests
  - [x] retry-mechanism correctness property tests
  - [x] URL normalization property tests

---

## Recently Completed Work

### Failure Taxonomy + Retry Alignment
- Added/confirmed failure reasons in queue flow including `ACT_NOT_FOUND` and `SITE_UNAVAILABLE`
- Added/confirmed `TRANSIENT_FAILURES` and `PERMANENT_FAILURES` sets
- `shouldRetry()` now classification-driven
- Side panel integrated taxonomy-aware error-page classification in both normal queue and retry queue processing

### Failed-Act False Positive Fix
- Root cause identified: sidepanel error-page regexes for `404`, `500`, `502`, `503`, `504` were matching valid act IDs inside `act-details-{ID}.html`
- Moved tab classification logic into `bdlaw-queue.js` as `classifyTabFailure()` for testability
- Added `isLikelyActDocumentUrl()` guard so act IDs are not treated as HTTP status codes
- Moved readiness decision logic into `bdlaw-queue.js` as `assessReadinessSnapshot()`
- Expanded readiness signals with real BDLaws structure markers and relaxed section regex for older documents like `1.[Preamble.]`
- Updated `sidepanel.js` to use queue helpers rather than ad hoc local classification logic
- Updated `content.js` title selectors to match real BDLaws act-page headings
- Added regression coverage for manually audited failures: `404`, `500`, `1318`, soft 404 pages, and real server-error titles

### Protocol Hardening
- Confirmed dual protocol support in manifest host permissions and content-script matches
- Confirmed page detector supports both protocols on `bdlaws.minlaw.gov.bd`
- Confirmed extractor URL normalization chooses protocol from context and falls back deterministically

### Documentation Synchronization
- Updated: `README.md`, `docs/ARCHITECTURE.md`, `docs/METHODOLOGY.md`, `docs/PROJECT_ANALYSIS.md`, `PRD.md`
- Updated memory bank: `activeContext.md` (this file and `techContext.md` refreshed in this phase)

### Filesystem Sync Implementation Expansion
- Root cause for missing sidebar sync controls confirmed: the filesystem sync feature was planned but not yet implemented in the actual UI/runtime files.
- Added visible Export-tab sync UI and expanded behavior in:
  - `sidepanel.html`
  - `sidepanel.css`
  - `sidepanel.js`
- Added new helper modules:
  - `bdlaw-filesystem-sync.js`
  - `bdlaw-sync-manifest.js`
- Added persisted sync support in `bdlaw-storage.js` for sync state and stored directory handles.
- Added sidepanel orchestration for:
  - folder selection and permission recovery
  - manifest loading and pending queue rebuild
  - scheduled/manual sync flushes
  - reconcile and auto-sync pause/resume flows
- Added on-folder outputs for:
  - `acts/{act}.json`
  - `failed/{act}.failed.json`
  - `logs/audit-log.ndjson`
  - `logs/sync-log.ndjson`
  - `manifests/sync-manifest.json`
  - `manifests/sync-state.json`
- Status: implemented enough to reason about and document, but still needs live browser validation before being considered complete.
- Added targeted regression test:
  - `tests/integration/filesystem-sync-ui.test.js`
- Added scaffold implementation plan:
  - `docs/plans/2026-04-12-filesystem-sync-ui-scaffold.md`

### BDLawsActs Mirror Assessment
- Reviewed `BDLawsActs/` as a candidate ready-to-use output folder for the current sync implementation.
- Confirmed the folder already conforms to the extension's expected canonical structure:
  - `acts/`
  - `failed/`
  - `logs/`
  - `manifests/`
- Verified concrete snapshot consistency:
  - `1570` files in `acts/`
  - `3` files in `failed/` (`96.failed.json`, `1082.failed.json`, `1083.failed.json`)
  - `sync-manifest.json` counts match disk contents
  - `sync-state.json` reports granted permission and zero pending work
- Conclusion: no extension enhancement is required for `BDLawsActs/` folder compatibility; any further work is robustness/validation work, not format-support work.

---

## Open / Next Phase Items

- [ ] Persistent retry queue persistence methods in `bdlaw-storage.js` (`saveRetryQueue`, `loadRetryQueue`, etc.)
- [ ] Export-level split/reporting of transient vs permanent failed extractions in `bdlaw-export.js`
- [ ] Additional audit-log completeness for classification and retry events
- [ ] UI enhancements for richer failed-act summaries and retry controls
- [ ] Live browser verification of filesystem sync end-to-end behavior
- [ ] More regression coverage for filesystem sync runtime/helpers beyond the current markup smoke test
- [ ] Decide how degraded/no-`showDirectoryPicker()` environments should be messaged and handled long-term
- [ ] Prepare a GitHub release only after live filesystem sync validation is complete; release was intentionally deferred during this memory-bank-only update

---

## Verification Snapshot

- Latest targeted run result: **4 suites passed, 47 tests passed**
- Suites:
  - `tests/property/domain.property.test.js`
  - `tests/property/page-type.property.test.js`
  - `tests/property/retry-mechanism-correctness.property.test.js`
  - `tests/property/url-normalization.property.test.js`

- Latest failed-act regression run result: **4 suites passed, 46 tests passed**
- Suites:
  - `tests/property/tab-error-classification-regression.property.test.js`
  - `tests/property/dom-readiness-enforcement.property.test.js`
  - `tests/property/failure-classification-accuracy.property.test.js`
  - `tests/property/retry-mechanism-correctness.property.test.js`

- Latest filesystem sync UI smoke-test run result: **1 suite passed, 1 test passed**
- Suites:
  - `tests/integration/filesystem-sync-ui.test.js`
