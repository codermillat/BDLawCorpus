# Progress

## Current Status

**Phase:** Hardening + documentation synchronization complete for protocol/failure-taxonomy scope  
**Corpus scope:** ~1,500+ Acts across 57 volumes (1799–2026)  
**Extension:** Chrome MV3 with durable storage, classification-driven retry policy, and dual protocol support

---

## What Works

- [x] Chrome extension loads and opens side panel
- [x] Page type detection supports allowed hostname over both `http:` and `https:`
- [x] Queue state machine tracks pending → processing → success/failed states
- [x] Queue retry policy uses failure classification (`transient` vs `permanent`)
- [x] Side panel error-page taxonomy distinguishes:
  - [x] `ACT_NOT_FOUND` (permanent)
  - [x] `SITE_UNAVAILABLE` (transient)
- [x] IndexedDB storage initialization with fallback chain
- [x] Write-ahead logging (WAL) and extraction receipts
- [x] Audit log structure and export hooks
- [x] DOM extraction via `element.textContent` (canonical)
- [x] Three-version content model (raw → normalized → corrected)
- [x] `computeContentHash()` returns raw 64-char SHA-256 hex
- [x] `_simpleHash()` uses `length_checksum` format
- [x] URL normalization is protocol-aware (`_normalizeUrl` + `_detectPreferredProtocol`)
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

### Protocol Hardening
- Confirmed dual protocol support in manifest host permissions and content-script matches
- Confirmed page detector supports both protocols on `bdlaws.minlaw.gov.bd`
- Confirmed extractor URL normalization chooses protocol from context and falls back deterministically

### Documentation Synchronization
- Updated: `README.md`, `docs/ARCHITECTURE.md`, `docs/METHODOLOGY.md`, `docs/PROJECT_ANALYSIS.md`, `PRD.md`
- Updated memory bank: `activeContext.md` (this file and `techContext.md` refreshed in this phase)

---

## Open / Next Phase Items

- [ ] Persistent retry queue persistence methods in `bdlaw-storage.js` (`saveRetryQueue`, `loadRetryQueue`, etc.)
- [ ] Export-level split/reporting of transient vs permanent failed extractions in `bdlaw-export.js`
- [ ] Additional audit-log completeness for classification and retry events
- [ ] UI enhancements for richer failed-act summaries and retry controls

---

## Verification Snapshot

- Latest targeted run result: **4 suites passed, 47 tests passed**
- Suites:
  - `tests/property/domain.property.test.js`
  - `tests/property/page-type.property.test.js`
  - `tests/property/retry-mechanism-correctness.property.test.js`
  - `tests/property/url-normalization.property.test.js`
