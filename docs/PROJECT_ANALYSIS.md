# BDLawCorpus: Project Analysis

This document provides a factual implementation snapshot of BDLawCorpus as currently shipped in this repository.

## 1) Project Position and Scope

BDLawCorpus is a Manifest V3 Chrome extension for **manual, research-oriented** extraction of legal text from `bdlaws.minlaw.gov.bd`. It is intentionally constrained to archival capture of browser-rendered DOM text (`textContent`) and does not attempt legal interpretation.

### In Scope
- Manual capture of volume indexes and act detail pages
- Queue-based batch processing after explicit user initiation
- Durable local persistence (IndexedDB-first with fallback chain)
- Corpus export with provenance and integrity metadata
- Explicit failure reporting for unsuccessful extractions

### Out of Scope
- Autonomous crawling without user initiation
- Legal validity inference or legal-effect reasoning
- Gazette reconstruction
- External data transmission/remote processing

## 2) Current Architecture and Workflow

The extension is centered on:
- `content.js` for page-side extraction and readiness signaling
- `sidepanel.js` for queue orchestration and user workflow
- `bdlaw-queue.js` for queue state, failure taxonomy, and retry policy
- `bdlaw-storage.js` for durable persistence and recovery
- `bdlaw-export.js` for corpus export formatting

Queue flow is deterministic: pending → processing → success/failed, with failed entries preserved and classifiable for retry eligibility.

## 3) Hardening Status (Implemented)

### 3.1 Dual protocol support (HTTP + HTTPS)
Support is now consistent across:
- `manifest.json` host permissions and content script matches
- `bdlaw-page-detector.js` (`ALLOWED_PROTOCOLS: http/https`)
- URL normalization in extractor via protocol-aware helpers

### 3.2 Failure taxonomy improvements
Queue and side panel now distinguish:
- `ACT_NOT_FOUND` (permanent)
- `SITE_UNAVAILABLE` (transient)

Error-page handling in side panel classifies failures instead of collapsing them into generic network errors.

### 3.3 Retry policy alignment
Retry decisions are classification-driven (`shouldRetry` + `classifyFailure`):
- transient reasons are retryable below max attempts
- permanent reasons are never retried

### 3.4 Integrity and extractor fixes already reflected in codebase
- `computeContentHash()` returns raw 64-char SHA-256 hex
- `_simpleHash()` uses `length_checksum` strategy
- `extractWithRetry()` loop semantics corrected
- Bengali Unicode and mixed Bengali/ASCII numeral citation patterns are present in extractor regex logic

## 4) Verification Snapshot

Targeted property suites for recent hardening work pass:
- `domain.property.test.js`
- `page-type.property.test.js`
- `retry-mechanism-correctness.property.test.js`
- `url-normalization.property.test.js`

Recent run outcome: **4 suites passed, 47 tests passed**.

## 5) Documentation Hygiene Notes

This file replaces prior stale analysis content that referred to an unrelated "Web Text Extractor" project and non-existent modules/files. The current analysis is aligned with the actual BDLawCorpus codebase and behavior.
