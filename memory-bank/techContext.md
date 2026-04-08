# Tech Context

## Runtime Environment

**Platform:** Chrome Extension (Manifest V3)  
**Service Worker:** `background.js`  
**Content Scripts:** `bdlaw-quality.js`, `content.js` (`document_end`)  
**Primary UI:** `sidepanel.html` + `sidepanel.js`  
**Popup UI:** `popup.html` + `popup.js`

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
