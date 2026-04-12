# Tech Context

## Runtime Environment

**Platform:** Chrome Extension (Manifest V3)  
**Service Worker:** `background.js`  
**Content Scripts:** `bdlaw-quality.js`, `content.js` (`document_end`)  
**Primary UI:** `sidepanel.html` + `sidepanel.js`  
**Popup UI:** `popup.html` + `popup.js`  
**Local sync runtime helpers:** `bdlaw-filesystem-sync.js`, `bdlaw-sync-manifest.js`

### Release / archival metadata tooling
- GitHub releases are now part of the publication workflow
- Repository now includes `.zenodo.json` for Zenodo metadata ingestion
- `CITATION.cff` is maintained alongside GitHub release metadata for citation/export consistency
- Current release preparation version: `1.4.0`
- Zenodo concept DOI for the repository: `10.5281/zenodo.19539460`
- Latest minted version DOI before the `v1.4.0` release: `10.5281/zenodo.19539461` (`v1.3.1`)
- Repository-facing author metadata now uses the named researcher identity instead of a generic contributors label:
  - `MD MILLAT HOSEN`
  - `Sharda University`
  - `https://orcid.org/0009-0005-7198-9893`

---

## Manifest & Permissions (Current)

From `manifest.json`:

- **Permissions:**
  - `activeTab`
  - `scripting`
  - `downloads`
  - `storage`
  - `unlimitedStorage`
  - `sidePanel`
  - `tabs`
  - `alarms`
- **Host permissions:**
  - `http://bdlaws.minlaw.gov.bd/*`
  - `https://bdlaws.minlaw.gov.bd/*`
- **Content script matches:**
  - `http://bdlaws.minlaw.gov.bd/*`
  - `https://bdlaws.minlaw.gov.bd/*`

---

## Domain and Protocol Enforcement

`bdlaw-page-detector.js` enforces:

- `ALLOWED_HOSTNAME: 'bdlaws.minlaw.gov.bd'`
- `ALLOWED_PROTOCOLS: new Set(['http:', 'https:'])`

Any URL outside this hostname/protocol pair is treated as invalid for extraction.

---

## Extraction Core Rules

1. `element.textContent` is canonical extraction API
2. `content_raw` is immutable anchor
3. `content_hash` is SHA-256 raw 64-char hex (no prefix)
4. No legal inference; references remain string-level detection

---

## Local Filesystem Sync Runtime (Current)

The codebase now contains a partial local filesystem sync implementation in the side panel.

### Runtime assumptions
- Relies on `window.showDirectoryPicker()` availability in the browser/profile hosting the side panel
- Uses File System Access directory handles at runtime; these are not traditional manifest permissions
- Sync remains optional and user-enabled

### Current sync outputs
- `acts/{actNumber}.json`
- `failed/{actNumber}.failed.json`
- `logs/audit-log.ndjson`
- `logs/sync-log.ndjson`
- `manifests/sync-manifest.json`
- `manifests/sync-state.json`

### Checked-in local mirror snapshot (`BDLawsActs/`)
- Repository currently contains a concrete filesystem-sync mirror folder: `BDLawsActs/`
- Snapshot verified during memory-bank refresh:
  - **1570** successful act JSON files in `BDLawsActs/acts/`
  - **3** failed JSON files in `BDLawsActs/failed/`
  - manifest counts match folder contents exactly (`1570` successful + `3` failed)
  - sync state reports `sync_enabled: true`, `permission: "granted"`, `pending_count: 0`
- Interpretation: the folder is structurally compatible with the current sync runtime and is ready to use as a local mirror/export artifact.

### Current sidepanel behavior
- Restores persisted sync state on startup
- Restores a stored directory handle when possible
- Re-checks folder permission before sync actions
- Rebuilds pending sync items from captured acts + failed extractions + sync manifest
- Supports manual sync, reconcile, reconnect, and pause/resume auto-sync actions
- Schedules delayed background flushes after relevant state changes

### Current limitations
- Live browser end-to-end validation is still pending
- Environments without `showDirectoryPicker()` currently surface an error state rather than a full fallback workflow
- Regression coverage currently proves UI presence, not full sync semantics
- Even though the checked-in `BDLawsActs/` mirror is internally consistent, that does **not** yet substitute for live browser validation of folder selection, permission recovery, and write flows.

---

## Queue Failure Taxonomy (Current)

Defined in `bdlaw-queue.js`:

- **Transient (retryable):**
  - `SITE_UNAVAILABLE`
  - `NETWORK_ERROR`
  - `DOM_NOT_READY`
  - `DOM_TIMEOUT`
  - `NAVIGATION_ERROR`
  - `UNKNOWN_ERROR`
- **Permanent (non-retryable):**
  - `ACT_NOT_FOUND`
  - `CONTENT_SELECTOR_MISMATCH`
  - `CONTAINER_NOT_FOUND`
  - `CONTENT_EMPTY`
  - `CONTENT_BELOW_THRESHOLD`
  - `EXTRACTION_ERROR`

Retry gate is `BDLawQueue.shouldRetry()` and is classification-driven.

---

## Side Panel Failure Classification Integration

`sidepanel.js` now classifies error pages using `classifyErrorPageFailure(tabInfo)`:

- Returns `ACT_NOT_FOUND` for 404/not-found patterns
- Returns `SITE_UNAVAILABLE` for browser/network/downtime-like errors

This classification is applied in both main queue processing and retry queue processing paths.

---

## Sync Metadata Persistence

`bdlaw-storage.js` now persists local sync metadata separately from extracted acts:

- sync state via `saveSyncState()` / `loadSyncState()`
- directory-handle lifecycle via `saveSyncDirectoryHandle()` / `loadSyncDirectoryHandle()` / `clearSyncDirectoryHandle()`
- IndexedDB `sync_meta` object store when IndexedDB is active
- volatile handle bridge (`_volatileSyncDirectoryHandle`) because directory handles are runtime objects, not plain JSON payloads

---

## URL Normalization Behavior

`bdlaw-extractor.js` includes protocol-aware normalization:

- `_normalizeUrl(href, contextDocument)`
- `_detectPreferredProtocol(contextDocument)`

Behavior:
- Preserves absolute `http://` and `https://`
- Resolves protocol-relative URLs (`//...`) using detected preferred protocol
- Resolves relative URLs against `bdlaws.minlaw.gov.bd` with detected protocol
- Falls back to `http:` in non-context environments

---

## Language & Citation Regex Notes

Current extractor state includes:

- `BENGALI_UNICODE_RANGE: /[\u0980-\u09FF]/`
- Bengali citation patterns support mixed Bengali and ASCII numerals via ranges like `[\u09E6-\u09EF0-9]`
- `calculateLanguageDistribution()` uses Bengali range `[\u0980-\u09FF]` and English `[A-Za-z]`

---

## Test Tooling

**Runtime:** Node.js + Jest + fast-check  
**Targeted verification run used for this hardening scope:**

```bash
npx jest tests/property/domain.property.test.js tests/property/page-type.property.test.js tests/property/retry-mechanism-correctness.property.test.js tests/property/url-normalization.property.test.js --runInBand
```

Result snapshot: **4 suites passed, 47 tests passed**.

Additional sync-related verification snapshot:

```bash
npx jest tests/integration/filesystem-sync-ui.test.js --runInBand
node --check sidepanel.js
```

Result snapshot: filesystem sync UI smoke test passed; sidepanel syntax check passed.
