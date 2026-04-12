# BDLawCorpus — System Patterns

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  bdlaws.minlaw.gov.bd (target website)              │
└──────────────────┬──────────────────────────────────┘
                   │ DOM (textContent only)
┌──────────────────▼──────────────────────────────────┐
│  content.js  (injected content script)              │
│  - Detects page type                                │
│  - Signals extraction readiness                     │
│  - Extracts DOM text on request                     │
│  - Classifies failure reasons                       │
└──────────────────┬──────────────────────────────────┘
                   │ chrome.runtime.sendMessage
┌──────────────────▼──────────────────────────────────┐
│  sidepanel.js  (primary UI driver)                  │
│  - Drives queue processing loop                     │
│  - Shows extraction progress                        │
│  - Triggers retry queue                             │
│  - Manages export + local filesystem sync           │
└──────┬───────────┬────────────────┬─────────────────┘
       │           │                │
┌──────▼──┐  ┌────▼────┐  ┌───────▼────────┐     ┌──────────────────────┐
│bdlaw-   │  │bdlaw-   │  │bdlaw-          │     │bdlaw-filesystem-     │
│extractor│  │queue.js │  │storage.js      │     │sync.js +             │
│.js      │  │         │  │                │     │bdlaw-sync-manifest.js│
│         │  │Queue    │  │IndexedDB       │     │                      │
│DOM      │  │Dedup    │  │→chrome.storage │     │Canonical paths       │
│Extract  │  │Retry    │  │→MemoryBackend  │     │Manifest dedup        │
│Language │  │Classify │  │                │     │Folder IO helpers     │
│Citations│  │Config   │  │WAL + Receipts  │     │Sync queue build      │
│Hashing  │  │         │  │Audit + SyncMeta│     │Status derivation     │
└──────────┘  └─────────┘  └───────┬────────┘     └──────────┬───────────┘
                                   │                         │
                          ┌────────▼────────┐                │
                          │ bdlaw-export.js │                │
                          │ Corpus JSON v3.1│                │
                          │ Failed extracts │                │
                          └─────────────────┘                │
                                                             ▼
                                                 Local folder mirror
                                                 acts/ failed/ logs/
                                                 manifests/
```

## Key Design Patterns

### 1. Three-Version Content Model
Every extracted act has exactly three parallel content fields:
```javascript
content_raw        // IMMUTABLE — textContent verbatim, SHA-256 hashed
content_normalized // Unicode NFC only
content_corrected  // Encoding fixes (non-semantic only)
```
`content_raw` is the single source of truth for all hashes, offsets, and citation positions.

### 2. Storage Fallback Chain
```
IndexedDB (primary, ~50MB+)
    ↓ fails
chrome.storage.local (secondary)
    ↓ fails
MemoryBackend (session only, volatile)
```
`StorageManager._activeBackend` tracks which backend is in use.

### 3. Write-Ahead Log (WAL) + Extraction Receipts
- **WAL**: Operations logged before execution — crash-safe
- **Receipts**: Append-only proof of successful persistence
- Queue can be reconstructed from receipts after crashes

### 4. Failure Classification (Planned Enhancement)
```javascript
TRANSIENT_FAILURES = {
  'site_unavailable',   // HTTP 5xx, connection refused
  'network_timeout',    // Page load timeout  
  'dom_not_ready',      // DOM never became interactive
  'network_error'       // Generic network failure
}
// → Retry after batch completes

PERMANENT_FAILURES = {
  'act_not_found',           // 404 or empty page (act doesn't exist)
  'act_removed',             // Page loads but content is removal notice only
  'content_empty_permanent'  // Confirmed empty after multiple attempts
}
// → Log as permanently failed, do not retry
```

### 5. Queue State Machine
```
pending → processing → success (removed from queue)
                    → failed (added to failedExtractions)
                         → [transient] → retry_queue
                         → [permanent] → permanent_failure_log
```

### 6. Local Filesystem Mirror Pattern
The extension can maintain a second, user-chosen local representation of corpus outputs:

```text
IndexedDB / in-memory state
        ↓
sidepanel rebuilds pending sync queue
        ↓
sync manifest decides what changed
        ↓
filesystem helpers write canonical files
        ↓
manifests + logs updated in selected folder
```

Important traits:
- sync is user-enabled and folder-backed
- successful acts and failed acts have separate canonical paths
- dedup is manifest-driven (`content_hash` for successes, failure fingerprint for failures)
- audit log is materialized to NDJSON in the sync folder
- sidepanel remains the orchestrator; helper modules stay pure/testable where possible.

## Module Responsibilities

### `bdlaw-extractor.js` (~2500 lines)
- `BDLawExtractor` class (static + instance methods)
- Language detection (`detectContentLanguage`, `calculateLanguageDistribution`)
- Bengali/English citation pattern matching
- Content normalization and encoding correction
- SHA-256 content hashing (`computeContentHash`)
- Structure derivation (`deriveStructureAndReferences`)
- Extraction with retry (`extractWithRetry`)

### `bdlaw-storage.js` (~1800 lines)
- `StorageManager` class — backend dispatch
- `MemoryBackend` — static in-memory store
- `ChromeStorageBackend` — chrome.storage.local adapter
- IndexedDB operations (CRUD)
- WAL management
- Extraction receipt management
- Audit log operations
- Sync metadata persistence (`sync_meta` object store + volatile directory handle bridge)
- `loadAct()`, `saveAct()`, `loadReceipts()`, etc.

### `bdlaw-queue.js`
- `BDLawQueue` plain object (not a class)
- Queue deduplication
- Failure tracking + retry policy
- Export formatting (corpus + failed acts)
- Queue configuration management

### `bdlaw-filesystem-sync.js`
- Canonical relative paths for successful acts, failed acts, logs, and manifests
- File System Access helper methods (read/write/append/delete)
- Pending sync queue construction from in-memory extraction state + manifest state
- Computed status helper for UI display

### `bdlaw-sync-manifest.js`
- Sync-manifest schema normalization
- Success/failure dedup decisions
- Manifest update logic for successful and failed sync writes
- Sync log-stat bookkeeping

### `content.js`
- Injected at `document_end` on all bdlaws pages
- Page type detection
- DOM readiness signaling
- Text extraction via `textContent`
- Failure reason signaling to background

### `bdlaw-export.js`
- Corpus JSON v3.1 serialization
- Schema validation
- Export checkpointing
- Rate limiting

### `bdlaw-page-detector.js`
- URL pattern matching → page type
- `isVolumePage()`, `isActDetailsPage()`, `isActSummaryPage()`, `isRangeIndexPage()`

### `bdlaw-metadata.js`
- Provenance metadata builder
- Timestamps, source URLs, schema version tagging

### `bdlaw-quality.js`
- OCR artifact detection
- Encoding error detection
- Completeness scoring
- ML risk factor flagging

### `bdlaw-corpus-manifest.js`
- Corpus-level statistics
- Act counts, language distribution, volume coverage

### `sidepanel.js` (notable orchestration role)
- Restores sync state and stored directory handle at startup
- Rebuilds pending sync work from captured acts, failed extractions, and sync manifest
- Schedules sync flushes after state changes
- Handles folder select/reconnect/manual sync/reconcile/pause UI actions
- Writes sync status back to both storage and selected folder manifests

## Critical Implementation Rules
1. **NEVER use `element.innerText`** — only `element.textContent`
2. **NEVER modify `content_raw`** after initial capture
3. **NEVER infer missing content** — failed acts get `content_raw: null`
4. **NEVER make legal inferences** — citations are string patterns only
5. **ALWAYS log failures** — every failed extraction must be in the audit log
6. **ALWAYS include failed acts in export** — `extraction_status: "failed"` with null content

## Export Schema v3.1 Key Fields
```json
{
  "identifiers": { "internal_id": "25" },
  "content_raw": "...",
  "content_normalized": "...", 
  "content_corrected": "...",
  "language": "bengali" | "english" | "mixed",
  "cross_references": [],
  "data_quality": { "completeness": "complete|textual_partial|uncertain" },
  "trust_boundary": { "can_trust": [], "must_not_trust": [] },
  "_metadata": { "schema_version": "3.1", "extracted_at": "ISO8601" }
}
```

## Website DOM Structure (Mapped)

### Volume Page Table
```html
<table>
  <thead><tr><th>Short Title</th><th>Act No</th></tr></thead>
  <tbody>
    <tr>
      <td><a href="/act-{ID}.html">Act Title</a></td>
      <td><a href="/act-{ID}.html">Act Number</a></td>
    </tr>
  </tbody>
</table>
```

### Act Details Page Section Structure
```html
<div class="boxed-layout"> <!-- primary extraction target -->
  <div> <!-- section container -->
    <div>Section heading</div>
    <div>Section text content with <sup>1</sup> footnote markers</div>
  </div>
</div>
<ul> <!-- footnote list at bottom -->
  <li><h6><sup>1</sup></h6> Amendment text with <a href="/act-{ID}.html">links</a></li>
</ul>