# BDLawCorpus — Active Context

## Current Work Focus

All 10 confirmed bugs have been fixed and the TRANSIENT/PERMANENT failure classification with persistent retry queue has been added to `bdlaw-queue.js`. Memory bank is being updated to reflect completed work.

## Completed in This Session

### Bug Fixes Applied

**bdlaw-extractor.js (3 bugs)**
- BUG 7: `computeContentHash()` — removed `"sha256:"` prefix; now returns raw 64-char hex only
- BUG 5: `_simpleHash()` — replaced 32-bit djb2 with `length_checksum` format
- BUG 6: `extractWithRetry()` — removed no-op retry loop; returns terminal result directly

**bdlaw-storage.js (3 bugs)**
- BUG 4: `loadAct()` — was a stub returning null; now dispatches to active backend (IndexedDB / ChromeStorageBackend / MemoryBackend)
- BUG 8: `_getMemoryUsage()` — was iterating `this._memoryStore.acts` (always-empty Map); now reads from `MemoryBackend._acts/_receipts/_wal/_auditLog`
- BUG 9: `_verifyChromeStorage()` — test key not cleaned up on failure paths; cleanup call added before each `reject()`

**popup.html (1 bug)**
- BUG 10: Removed `<script src="text-processor.js"></script>` (file does not exist in project)

**bdlaw-queue.js (feature additions)**
- Added `TRANSIENT_FAILURES` Set: NETWORK_ERROR, DOM_NOT_READY, DOM_TIMEOUT, NAVIGATION_ERROR, UNKNOWN_ERROR
- Added `PERMANENT_FAILURES` Set: CONTENT_SELECTOR_MISMATCH, CONTAINER_NOT_FOUND, CONTENT_EMPTY, CONTENT_BELOW_THRESHOLD, EXTRACTION_ERROR
- Both sets exposed on `BDLawQueue` object
- Added `classifyFailure(reason)` method
- Added `buildRetryQueue(failedExtractions, maxRetriesPerItem)` method returning `{ retryQueue, permanentFailures, stats }`

## Key Decisions & Patterns

- `content_hash` is always raw 64-char hex with no prefix — validated by `ExtractionReceipt.create()` regex `/^[a-fA-F0-9]{64}$/`
- `_memoryStore` in `StorageManager` is a separate in-process cache; `MemoryBackend` holds the actual fallback storage
- `shouldRetry()` handles immediate same-session retries with broader selectors — distinct from `buildRetryQueue()` which is for persistent cross-session retry
- TRANSIENT failures = environmental/recoverable; PERMANENT = structural content issues that won't resolve on retry
- `transient_exhausted` classification used when retry count has reached limit despite transient reason

## Next Steps

- All code work complete
- Memory bank documentation update (activeContext.md, progress.md) — in progress