# Tech Context

## Runtime Environment

**Platform:** Chrome Extension, Manifest V3  
**Service Worker:** `background.js` — persistent only while side panel is open  
**Content Scripts:** `bdlaw-quality.js` + `content.js` — injected at `document_end` on `bdlaws.minlaw.gov.bd/*`  
**Side Panel:** `sidepanel.html` / `sidepanel.js` — primary user interface  
**Popup:** `popup.html` / `popup.js` — minimal launch UI  

---

## Languages and Standards

| Layer | Language | Standard |
|---|---|---|
| Extension logic | JavaScript (ES2020+) | No transpilation — native Chrome V8 |
| Bengali text | Unicode | U+0980–U+09FF (Bengali block) |
| Content normalization | Unicode NFC | `String.prototype.normalize('NFC')` |
| Hashing | SHA-256 | `crypto.subtle.digest('SHA-256', ...)` |
| Storage | IndexedDB | Native browser API |
| Tests | Node.js + Jest | `"type": "module"` in package.json |

---

## Chrome Extension APIs Used

```
chrome.sidePanel.open()          — Open side panel on icon click
chrome.runtime.sendMessage()     — Content → Background → Sidepanel messaging
chrome.runtime.onMessage         — Message listener in background.js
chrome.storage.local             — Fallback storage (quota: 10MB)
chrome.downloads.download()      — Export JSON / TXT files
chrome.scripting.executeScript() — (available via manifest permission)
chrome.tabs.query()              — Get active tab info
```

**Permissions declared in manifest.json:**
- `activeTab`, `scripting`, `downloads`, `storage`, `sidePanel`, `tabs`

**Host permissions:**
- `https://bdlaws.minlaw.gov.bd/*` (ONLY — strict scope)

---

## Storage Architecture

### Primary: IndexedDB
- **Database name:** `BDLawCorpus`
- **Version:** 1
- **Object stores:**
  - `acts` — keyed by `actId`, stores full extraction records
  - `receipts` — append-only extraction receipts
  - `auditLog` — append-only audit entries
  - `walLog` — write-ahead log entries for crash recovery

### Fallback Chain
```
IndexedDB (preferred, ~unlimited quota)
    ↓ fails
chrome.storage.local (~10MB quota)
    ↓ fails
MemoryBackend (in-memory Map, session-only)
```

### MemoryBackend
- `MemoryBackend._acts` — `Map<actId, record>`
- `MemoryBackend._receipts` — `Map<actId, receipt>`

---

## Content Processing Pipeline

```
DOM textContent (raw)
    ↓ stored as content_raw (IMMUTABLE)
String.normalize('NFC')
    ↓ stored as content_normalized
OCR/encoding corrections
    ↓ stored as content_corrected
SHA-256 hash of content_raw
    ↓ stored as content_hash (64-char raw hex, NO prefix)
```

**Critical constraint:** `element.textContent` ONLY. `innerText` is STRICTLY FORBIDDEN (triggers layout reflow, produces different whitespace).

---

## Bengali Unicode Details

```javascript
// Correct Bengali Unicode range
/[\u0980-\u09FF]/

// Bengali numerals (০ = U+09E6, ৯ = U+09EF)
/[০-৯]/   // equivalent to /[\u09E6-\u09EF]/

// Latin/ASCII numerals
/[0-9]/

// Combined (for cross-reference patterns)
/(?:[০-৯]+|[0-9]+)/
```

**BUG NOTE:** The current codebase has `BENGALI_UNICODE_RANGE: /[-]/` — this is broken (collapses to a hyphen). The correct value is `/[\u0980-\u09FF]/`.

---

## Hashing

```javascript
// crypto.subtle SHA-256 (async, returns ArrayBuffer)
const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
const hashArray = Array.from(new Uint8Array(hashBuffer));
const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
// hashHex is 64-char raw hex — NO "sha256:" prefix
```

**Validation regex:** `/^[a-fA-F0-9]{64}$/`  
**BUG NOTE:** Current `computeContentHash()` returns `"sha256:" + hex` — breaks `ExtractionReceipt.create()` validation.

---

## Test Setup

```
Runtime:     Node.js v18+
Framework:   Jest (with --experimental-vm-modules for ES modules)
Module type: "type": "module" in package.json
Test dirs:   tests/property/   (~100 property-based tests)
             tests/integration/ (3 integration tests)
```

**Test execution:**
```bash
npm test
# or
npx jest --experimental-vm-modules
```

**Key test dependencies (package.json):**
- `jest` — test runner
- `fast-check` — property-based testing library
- `@jest/globals` — Jest globals for ES module tests

---

## Module Dependency Map

```
manifest.json
├── background.js              (service worker)
├── content.js                 (page scraper, injected)
│   └── bdlaw-quality.js       (quality checks, injected first)
├── sidepanel.js               (UI controller)
│   ├── bdlaw-queue.js         (queue state machine)
│   ├── bdlaw-storage.js       (persistence layer)
│   ├── bdlaw-extractor.js     (extraction logic)
│   ├── bdlaw-metadata.js      (metadata builder)
│   ├── bdlaw-export.js        (export formatter)
│   └── bdlaw-page-detector.js (page type classifier)
└── popup.js                   (launch UI)
    └── [popup.html has dead <script src="text-processor.js"> — BUG 10]
```

---

## Key Constants and Configuration

```javascript
// bdlaw-queue.js
FAILURE_REASONS = {
  container_not_found: 'container_not_found',
  content_empty: 'content_empty',
  network_error: 'network_error',
  dom_not_ready: 'dom_not_ready',
  // ... more
}

// bdlaw-extractor.js
EXTRACTION_DELAY_MS = 2000       // polite crawl delay
MAX_RETRY_ATTEMPTS = 3           // per-act retry limit
CONTENT_HASH_ALGORITHM = 'SHA-256'
```

---

## Target Website Structure

**Domain:** `https://bdlaws.minlaw.gov.bd`  
**TLS:** Standard HTTPS  
**Server:** Static-ish HTML, no JavaScript SPA framework  

| Page Type | URL Pattern | Key DOM |
|---|---|---|
| Volume index | `/laws-of-bangladesh.html` | `<ul>` with 57 volume links |
| Volume page | `/volume-{N}.html` | `<table>` Short Title + Act No columns |
| Act summary | `/act-{ID}.html` | TOC with section links |
| Act details | `/act-details-{ID}.html` | `<div class="boxed-layout">` primary container |
| Section | `/act-{ID}/section-{S}.html` | Section text |

**Primary extraction target:** `/act-details-{ID}.html`  
**Content container selector:** `div.boxed-layout`  

---

## Known Technical Constraints

1. **No background persistence** — MV3 service workers are ephemeral; all state must be in IndexedDB or chrome.storage
2. **10MB chrome.storage.local limit** — IndexedDB is mandatory for large corpora
3. **No fetch() in content scripts for cross-origin** — extraction is DOM-only, no API calls
4. **SHA-256 requires HTTPS context** — `crypto.subtle` unavailable in HTTP contexts (site is HTTPS so this is fine)
5. **Bengali NFC normalization** — some characters may arrive in NFD form from the site; normalization is mandatory before storage
6. **textContent vs innerText** — `innerText` is layout-dependent and forbidden; `textContent` is canonical