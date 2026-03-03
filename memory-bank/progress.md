# Progress

## Current Status

**Phase:** Bug fixes complete — Failure classification redesign complete  
**Corpus scope:** ~1,500+ Acts across 57 volumes (1799–2026)  
**Extension:** Chrome MV3, 10 confirmed bugs fixed, retry queue added  

---

## What Works

- [x] Chrome extension loads and opens side panel
- [x] Page type detection (`bdlaw-page-detector.js`) classifies volume pages vs act-detail pages
- [x] Queue state machine (`bdlaw-queue.js`) tracks pending → processing → success/failed states
- [x] IndexedDB storage initialization with fallback chain
- [x] Write-ahead logging (WAL) structure exists in `bdlaw-storage.js`
- [x] Extraction receipts (append-only) structure exists
- [x] Audit log structure exists
- [x] Export formatter (`bdlaw-export.js`) produces JSON with `failed_extractions` placeholder
- [x] `formatFailedActForExport()` in `bdlaw-queue.js` includes failed acts in corpus output
- [x] Metadata builder (`bdlaw-metadata.js`) generates act metadata
- [x] DOM extraction via `element.textContent` (correct API used)
- [x] Three-version content model (raw → normalized → corrected) structure defined
- [x] All 100+ property-based tests exist in `tests/property/`
- [x] Integration tests exist in `tests/integration/`
- [x] Memory Bank fully initialized (6 core files created)
- [x] **BUG 4 FIXED** — `StorageManager.loadAct()` dispatches to active backend
- [x] **BUG 5 FIXED** — `_simpleHash()` uses `length_checksum` format
- [x] **BUG 6 FIXED** — `extractWithRetry()` no-op loop removed
- [x] **BUG 7 FIXED** — `computeContentHash()` returns raw 64-char hex (no prefix)
- [x] **BUG 8 FIXED** — `_getMemoryUsage()` reads from `MemoryBackend._acts/_receipts/_wal/_auditLog`
- [x] **BUG 9 FIXED** — `_verifyChromeStorage()` cleans up test key on all failure paths
- [x] **BUG 10 FIXED** — Dead `text-processor.js` script tag removed from `popup.html`
- [x] **TRANSIENT/PERMANENT classification added** — `TRANSIENT_FAILURES` and `PERMANENT_FAILURES` Sets in `bdlaw-queue.js`
- [x] **`classifyFailure(reason)`** method added to `BDLawQueue`
- [x] **`buildRetryQueue(failedExtractions, maxRetriesPerItem)`** method added to `BDLawQueue`

---

## Confirmed Bugs — Status

| Bug | File | Description | Status |
|---|---|---|---|
| BUG 1 | `bdlaw-extractor.js` | Bengali Unicode regex broken (`BENGALI_UNICODE_RANGE`) | ⚠️ Still open |
| BUG 2 | `bdlaw-extractor.js` | `calculateLanguageDistribution()` uses broken regex | ⚠️ Still open |
| BUG 3 | `bdlaw-extractor.js` | Bengali citation patterns broken (hyphen instead of numeral ranges) | ⚠️ Still open |
| BUG 4 | `bdlaw-storage.js` | `StorageManager.loadAct()` stub returning null | ✅ Fixed |
| BUG 5 | `bdlaw-extractor.js` | `_simpleHash()` weak 32-bit djb2 | ✅ Fixed |
| BUG 6 | `bdlaw-extractor.js` | `extractWithRetry()` no-op retry loop | ✅ Fixed |
| BUG 7 | `bdlaw-extractor.js` | `computeContentHash()` prefixed hash breaks receipt validation | ✅ Fixed |
| BUG 8 | `bdlaw-storage.js` | `_getMemoryUsage()` reads empty Map | ✅ Fixed |
| BUG 9 | `bdlaw-storage.js` | `_verifyChromeStorage()` test key leak on failure | ✅ Fixed |
| BUG 10 | `popup.html` | Dead `text-processor.js` script reference | ✅ Fixed |

> **Note:** BUGs 1, 2, 3 involve Bengali Unicode regex ranges. The summary shows the regex bodies collapsed during context serialization. These require careful character-by-character editing to insert the correct U+0980–U+09FF codepoints. They are tracked as still open.

---

## Completed Enhancements

### Failure Classification Redesign (`bdlaw-queue.js`) — COMPLETE
- [x] `TRANSIENT_FAILURES` Set: `NETWORK_ERROR`, `DOM_NOT_READY`, `DOM_TIMEOUT`, `NAVIGATION_ERROR`, `UNKNOWN_ERROR`
- [x] `PERMANENT_FAILURES` Set: `CONTENT_SELECTOR_MISMATCH`, `CONTAINER_NOT_FOUND`, `CONTENT_EMPTY`, `CONTENT_BELOW_THRESHOLD`, `EXTRACTION_ERROR`
- [x] Both sets exposed on `BDLawQueue` object
- [x] `classifyFailure(reason)` — returns `'transient'` or `'permanent'`
- [x] `buildRetryQueue(failedExtractions, maxRetriesPerItem)` — returns `{ retryQueue, permanentFailures, stats }`
- [x] `transient_exhausted` classification for transient failures that have hit the retry limit

---

## Pending Enhancements (Next Phase)

### Fix Remaining Open Bugs
- [ ] BUG 1: Fix `BENGALI_UNICODE_RANGE` constant in `bdlaw-extractor.js`
- [ ] BUG 2: Fix `calculateLanguageDistribution()` regex in `bdlaw-extractor.js`
- [ ] BUG 3: Fix Bengali citation patterns in `bdlaw-extractor.js`

### Persistent Retry Queue (`bdlaw-storage.js`)
- [ ] `saveRetryQueue(queue)` — persist retry queue to IndexedDB
- [ ] `loadRetryQueue()` — reload retry queue across sessions
- [ ] `saveFailureLog(entries)` — persist permanent failure log
- [ ] `loadFailureLog()` — load permanent failure log

### Content Script Failure Detection (`content.js`)
- [ ] Distinguish HTTP 404 from network timeout
- [ ] Detect site unavailability patterns
- [ ] Emit `site_unavailable` failure reason
- [ ] Emit `act_not_found_404` for confirmed missing acts

### UI Enhancements (`sidepanel.html` + `sidepanel.js`)
- [ ] "Retry Failed Acts" button
- [ ] Failure summary panel (transient vs permanent counts)
- [ ] Per-act failure reason display
- [ ] Retry progress tracking

### Export Enhancement (`bdlaw-export.js`)
- [ ] `failed_extractions` section split into `transient_failures[]` and `permanent_failures[]`
- [ ] Summary with counts, timestamps, retry recommendations

### Audit Log Completeness
- [ ] Log entry for every failure classification decision
- [ ] Log entry for every retry attempt
- [ ] Log entry for retry queue build/clear events

---

## Evolution of Key Decisions

| Decision | Chosen Approach | Rationale |
|---|---|---|
| Bengali Unicode range | U+0980–U+09FF | Standard Unicode Bengali block |
| Content_raw API | `element.textContent` only | `innerText` is layout-dependent |
| Hash format | Raw 64-char hex, no prefix | Prefix breaks receipt validation regex |
| Retry policy | TRANSIENT vs PERMANENT classification | Site downtime ≠ missing act |
| `_simpleHash` replacement | `length + '_' + checksum` | Better collision resistance for immutability guard |
| `extractWithRetry` | Remove loop, delay at queue level | Retrying same DOM state is a no-op |
| Storage backend | IndexedDB primary, fallback chain | MV3 service workers are ephemeral |
| `buildRetryQueue` vs `shouldRetry` | Two separate concerns | `shouldRetry` = same-session broader selector; `buildRetryQueue` = cross-session persistent retry |

---

## Known Issues (Non-Bug)

1. **Bengali schedule PDFs** — PDF content cannot be extracted via DOM; schedules are linked but not scraped
2. **Site downtime** — bdlaws.minlaw.gov.bd has intermittent availability; primary motivation for retry queue
3. **Volume 30+ Bengali titles** — Bengali-only titles require correct Unicode detection (blocked on BUG 1/2)
4. **Act ID gaps** — Not all integer IDs between 1–1500 have corresponding pages; gap detection needed
5. **Amendment footnotes** — `<sup>` markers captured in textContent but not parsed into structured amendment records

---

## Files Requiring Further Changes

| File | Changes Needed |
|---|---|
| `bdlaw-extractor.js` | BUGs 1, 2, 3 (Bengali Unicode regex) |
| `bdlaw-storage.js` | Persistent retry queue methods |
| `content.js` | Failure detection improvements |
| `sidepanel.html` | Retry UI |
| `sidepanel.js` | Retry logic |
| `bdlaw-export.js` | Split failed_extractions section |