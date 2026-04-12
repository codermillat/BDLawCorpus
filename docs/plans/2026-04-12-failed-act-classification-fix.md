# Failed Act Classification Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix false failed extractions for valid BDLaws act pages by removing act-ID-as-HTTP-code misclassification and broadening readiness detection for legitimate older/irregular pages.

**Architecture:** Move the error-page classification and readiness decision logic into `bdlaw-queue.js` so it can be unit-tested outside the browser UI. Keep `sidepanel.js` as the orchestrator, but make it delegate classification/readiness decisions to queue helpers fed by browser-collected snapshots. Align `content.js` title selectors with the real BDLaws DOM to reduce blank-title edge cases.

**Tech Stack:** Chrome Extension Manifest V3, side panel UI, browser DOM extraction, Jest property/unit tests.

---

### Task 1: Add testable queue helpers for tab-failure classification and readiness snapshots

**Files:**
- Modify: `bdlaw-queue.js`
- Test: `tests/property/dom-readiness-enforcement.property.test.js`
- Test: `tests/property/tab-error-classification-regression.property.test.js`

**Step 1: Write the failing tests**

- Add tests that assert:
  - `act-details-500.html` with title `The Appropriation Act, 1975` is **not** classified as unavailable.
  - `act-details-404.html` with real act title is **not** classified as not-found.
  - title `404` with requested-page-not-found wording is classified as `ACT_NOT_FOUND`.
  - title `HTTP Status 500 – Internal Server Error` is classified as `SITE_UNAVAILABLE`.
  - readiness succeeds for an `interactive` page with strong DOM structure even without `WHEREAS`.
  - section pattern detection accepts `1.[Preamble.]`.

**Step 2: Run tests to verify they fail**

Run: `npx jest tests/property/dom-readiness-enforcement.property.test.js tests/property/tab-error-classification-regression.property.test.js --runInBand`

Expected: FAIL with missing helper functions or stale readiness expectations.

**Step 3: Write minimal implementation**

- Add helper methods to `bdlaw-queue.js`:
  - `isLikelyActDocumentUrl(rawUrl)`
  - `classifyTabFailure(tabInfo)`
  - `assessReadinessSnapshot(snapshot, options)`
- Extend `LEGAL_CONTENT_SIGNALS` with:
  - real BDLaws title selectors such as `.bg-act-section h3`
  - structural selectors such as `.boxed-layout`, `.col-sm-9.txt-details`, `#sec-dec`, `.lineremoves`
  - relaxed first-section regexes that accept `1.[Preamble.]`

**Step 4: Run tests to verify they pass**

Run: `npx jest tests/property/dom-readiness-enforcement.property.test.js tests/property/tab-error-classification-regression.property.test.js --runInBand`

Expected: PASS.

---

### Task 2: Wire sidepanel queue processing to the new helpers

**Files:**
- Modify: `sidepanel.js`

**Step 1: Write the failing test coverage first**

- Reuse the queue helper tests from Task 1 as the safety net.

**Step 2: Run tests to verify current implementation is still covered**

Run: `npx jest tests/property/dom-readiness-enforcement.property.test.js tests/property/tab-error-classification-regression.property.test.js --runInBand`

Expected: PASS before refactor.

**Step 3: Write minimal implementation**

- Replace local error-page classification calls with `BDLawQueue.classifyTabFailure(tabInfo)`.
- Refactor `waitForExtractionReadiness()` to collect a browser-side snapshot and evaluate it via `BDLawQueue.assessReadinessSnapshot(...)`.
- Preserve the existing queue semantics:
  - real browser/network failures remain transient
  - rendered-but-undetectable pages remain `CONTENT_SELECTOR_MISMATCH`
  - no content inference is introduced

**Step 4: Run targeted tests**

Run: `npx jest tests/property/dom-readiness-enforcement.property.test.js tests/property/tab-error-classification-regression.property.test.js tests/property/retry-mechanism-correctness.property.test.js --runInBand`

Expected: PASS.

---

### Task 3: Align extractor title selectors with real BDLaws DOM and add regression coverage

**Files:**
- Modify: `content.js`
- Test: `tests/property/tab-error-classification-regression.property.test.js`

**Step 1: Write the failing assertion**

- Assert that the queue/content selector configuration includes actual title hooks used by BDLaws act pages, e.g. `.bg-act-section h3`.

**Step 2: Run tests to verify it fails**

Run: `npx jest tests/property/tab-error-classification-regression.property.test.js --runInBand`

Expected: FAIL if selector alignment has not yet been added.

**Step 3: Write minimal implementation**

- Add real BDLaws title selectors to `content.js` so extraction uses the visible act title when available.

**Step 4: Run targeted tests**

Run: `npx jest tests/property/tab-error-classification-regression.property.test.js --runInBand`

Expected: PASS.

---

### Task 4: Verify, document, and update memory bank

**Files:**
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`

**Step 1: Run the targeted verification suite**

Run: `npx jest tests/property/dom-readiness-enforcement.property.test.js tests/property/tab-error-classification-regression.property.test.js tests/property/retry-mechanism-correctness.property.test.js --runInBand`

Expected: PASS.

**Step 2: Update project memory**

- Add the root cause and fix summary:
  - numeric HTTP-code regexes were matching act IDs in valid URLs
  - readiness now accepts strong structural signals for older pages

**Step 3: Final review**

- Verify no content-integrity rule was weakened.
- Verify only classification/readiness behavior changed.
