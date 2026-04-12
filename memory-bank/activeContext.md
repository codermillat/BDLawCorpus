# BDLawCorpus — Active Context

## Current Work Focus

Memory-bank synchronization after two related implementation tracks:
- failed-act classification/readiness hardening
- local filesystem sync expansion from placeholder UI into a partial working implementation.

Current emphasis is no longer just "make the sync section visible". The codebase now includes runtime helpers, persisted sync metadata, sync-manifest handling, scheduled/manual flush logic, and sidepanel controls for selecting/reconnecting/reconciling a local folder.

## Completed in This Session

### BDLawsActs Folder Readiness Review
- Reviewed the checked-in `BDLawsActs/` local mirror against the current filesystem sync implementation and confirmed the folder layout matches the extension's canonical sync outputs.
- Confirmed on-disk counts are internally consistent:
  - `acts/`: **1570** act JSON files
  - `failed/`: **3** failed extraction JSON files (`96`, `1082`, `1083`)
  - `manifests/sync-manifest.json`: **1570** successful manifest entries and **3** failed manifest entries
  - `manifests/sync-state.json`: `sync_enabled: true`, `permission: granted`, `pending_count: 0`
- Conclusion captured for future sessions: **`BDLawsActs/` is ready to use as a filesystem-sync mirror and does not require extension changes for format compatibility.**
- Important nuance: the folder is healthy, but the filesystem sync feature as a whole is still considered only partially live-validated because end-to-end browser verification remains pending.
- Release decision for this session: **do not publish a GitHub release yet**; memory bank updated first, release intentionally deferred.

### Filesystem Sync Implementation Expansion
- Diagnosed the "local file system sync not showing in the sidebar" issue as missing implementation, not a hidden/conditional render bug.
- Added/now present in the codebase:
  - dedicated runtime helper module `bdlaw-filesystem-sync.js`
  - dedicated manifest helper module `bdlaw-sync-manifest.js`
  - visible Export-tab sync section and expanded controls in the side panel
  - sidepanel sync orchestration for enable/select/reconnect/manual sync/reconcile/pause
  - persisted sync-state helpers in `bdlaw-storage.js`
  - sync queue rebuilding from captured acts + failed extractions + on-disk manifest state.
- Filesystem sync is now **partial implementation**, not just placeholder UI:
  - folder selection via `showDirectoryPicker()` when available
  - permission checks/reconnect flow
  - folder structure creation (`acts/`, `failed/`, `logs/`, `manifests/`)
  - successful-act JSON writes and failed-act JSON writes
  - sync manifest/state writes to the selected folder
  - audit-log flush to NDJSON and sync-log append behavior
  - auto-sync scheduling with pause/resume support.
- Important limitation: this remains unverified in a live browser workflow end-to-end; it should still be treated as an in-progress local sync feature rather than fully production-validated behavior.
- Added a targeted jsdom regression test: `tests/integration/filesystem-sync-ui.test.js`.
- Saved implementation scaffold plan to `docs/plans/2026-04-12-filesystem-sync-ui-scaffold.md`.
- Verification completed:
  - `npx jest tests/integration/filesystem-sync-ui.test.js --runInBand` ✅
  - `node --check sidepanel.js` ✅

### Public Documentation Updates
- `README.md`
  - Added explicit HTTP/HTTPS support statement
  - Added Failure Taxonomy & Retry Policy section
  - Updated schema sample `source_url` to HTTPS example
- `docs/ARCHITECTURE.md`
  - Updated domain/protocol model to hostname + allowed protocols
  - Updated host permission snippet to include both HTTP/HTTPS
  - Updated failure reasons and retry strategy to transient/permanent classification
- `docs/METHODOLOGY.md`
  - Updated access method to HTTP+HTTPS
  - Added explicit failure classification and retry semantics section
- `docs/PROJECT_ANALYSIS.md`
  - Replaced stale unrelated analysis with BDLawCorpus-specific implementation snapshot
- `PRD.md`
  - Updated FR-1 to hostname scope with both protocols
  - Resolved FR-3 contradiction with queue-based processing
  - Added FR-9 requirements for transient/permanent classification and retry constraints

### Implementation State Confirmed
- `manifest.json` contains both protocol permissions and matches
- `bdlaw-page-detector.js` accepts `http:` and `https:` via `ALLOWED_PROTOCOLS`
- `bdlaw-queue.js` has:
  - `ACT_NOT_FOUND`, `SITE_UNAVAILABLE`
  - `TRANSIENT_FAILURES` / `PERMANENT_FAILURES`
  - `classifyFailure()` and classification-driven `shouldRetry()`
- `bdlaw-queue.js` now also has:
  - `isLikelyActDocumentUrl()` to protect valid act URLs like `act-details-500.html`
  - `classifyTabFailure()` for testable tab-level error classification
  - `assessReadinessSnapshot()` for testable readiness decisions
- `sidepanel.js` now delegates error-page classification to `BDLawQueue.classifyTabFailure()`
- `sidepanel.js` readiness logic now collects a browser snapshot and evaluates it through `BDLawQueue.assessReadinessSnapshot()`
- `bdlaw-extractor.js` has:
  - protocol-aware URL normalization (`_normalizeUrl`, `_detectPreferredProtocol`)
  - corrected hash behavior and simplified retry semantics
  - corrected Bengali Unicode and mixed numeral regex patterns
- `content.js` title selector list now includes real BDLaws DOM hooks such as `.bg-act-section h3` / `.boxed-layout h3`
- `bdlaw-storage.js` now includes sync-state persistence methods and a sync-meta store path for:
  - `saveSyncState()` / `loadSyncState()`
  - `saveSyncDirectoryHandle()` / `loadSyncDirectoryHandle()` / `clearSyncDirectoryHandle()`
- `sidepanel.js` now includes filesystem sync flows for:
  - startup initialization from persisted state + stored directory handle
  - queue rebuilding against sync manifest state
  - scheduled and manual sync flushing
  - manual reconcile and auto-sync pause/resume actions
- `bdlaw-filesystem-sync.js` now centralizes:
  - canonical relative paths for acts/failed/logs/manifests
  - filesystem read/write helpers
  - pending sync queue computation
  - derived UI status labels
- `bdlaw-sync-manifest.js` now centralizes:
  - empty manifest creation / normalization
  - successful-act dedup decisions by content hash
  - failed-act dedup decisions by failure fingerprint
  - manifest updates for successful/failed writes and log stats.

### Root Cause Analysis Confirmed
- Acts `500`, `502`, `503`, `504` were being falsely marked `SITE_UNAVAILABLE` because the old sidepanel classifier matched `/\b500\b/`, `/\b502\b/`, `/\b503\b/`, `/\b504\b/` against valid act-detail URLs.
- Act `404` was being falsely marked `ACT_NOT_FOUND` because `/\b404\b/` matched the act ID in `act-details-404.html`.
- Act `1318` is a real page but lacked modern enactment wording; readiness detection is now allowed to succeed from strong DOM structure and relaxed old-style section patterns like `1.[Preamble.]`.
- Act `96` still appears to be a genuine upstream server-side 500 from the source website and remains appropriately transient/retryable.

### Test Verification (already executed)
- Targeted property suites passed:
  - `domain.property.test.js`
  - `page-type.property.test.js`
  - `retry-mechanism-correctness.property.test.js`
  - `url-normalization.property.test.js`
- Result: **4 suites passed, 47 tests passed**.

### Test Verification (this session)
- Additional targeted suites passed:
  - `tab-error-classification-regression.property.test.js`
  - `dom-readiness-enforcement.property.test.js`
  - `failure-classification-accuracy.property.test.js`
  - `retry-mechanism-correctness.property.test.js`
- Result: **4 suites passed, 46 tests passed**.

## Next Steps

1. Reload the extension in Chrome so the updated queue/sidepanel/content/filesystem-sync code is active
2. Re-run the failed extraction queue for acts `404`, `500`, `502`, `503`, `504`, `1318`
3. Confirm only true source-side failures remain in failed state and reconcile the checked-in `BDLawsActs/failed/` set against current results (`96`, `1082`, `1083` at the time of review)
4. Run a live browser validation of local filesystem sync:
   - select a folder
   - verify manifest/state/log files are written
   - verify successful and failed act exports land in the expected canonical paths
   - verify reconnect/reconcile/pause behavior after panel reload.
5. After live validation is complete, prepare the eventual GitHub release/tag from the validated state rather than from the current partially verified sync implementation.
