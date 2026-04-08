# BDLawCorpus — Active Context

## Current Work Focus

Documentation and memory-bank synchronization after hardening changes for:
- dual protocol support (`http` + `https`) on `bdlaws.minlaw.gov.bd`
- failure taxonomy alignment across queue + side panel (`ACT_NOT_FOUND` vs `SITE_UNAVAILABLE`)
- classification-driven retry behavior and updated property tests.

## Completed in This Session

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
- `sidepanel.js` classifies error pages through `classifyErrorPageFailure()` and maps labels in UI
- `bdlaw-extractor.js` has:
  - protocol-aware URL normalization (`_normalizeUrl`, `_detectPreferredProtocol`)
  - corrected hash behavior and simplified retry semantics
  - corrected Bengali Unicode and mixed numeral regex patterns

### Test Verification (already executed)
- Targeted property suites passed:
  - `domain.property.test.js`
  - `page-type.property.test.js`
  - `retry-mechanism-correctness.property.test.js`
  - `url-normalization.property.test.js`
- Result: **4 suites passed, 47 tests passed**.

## Next Steps

1. Finalize memory-bank updates (`progress.md`, `techContext.md`)
2. Run final consistency checks
3. Deliver completion summary.
