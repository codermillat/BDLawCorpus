# Architecture

## System Overview

BDLawCorpus is a Chrome extension that captures browser-rendered DOM text from bdlaws.minlaw.gov.bd. The system operates entirely within the browser environment with no server-side components.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Side Panel │◄──►│  Background  │◄──►│   Content    │      │
│  │     (UI)     │    │   Service    │    │   Script     │      │
│  └──────────────┘    │   Worker     │    └──────────────┘      │
│         │            └──────────────┘           │               │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │    Queue     │    │   Downloads  │    │     DOM      │      │
│  │   Storage    │    │     API      │    │   Access     │      │
│  │ (chrome.     │    │              │    │ (textContent │      │
│  │  storage)    │    │              │    │    ONLY)     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  bdlaws.minlaw.  │
                    │   gov.bd (HTTP)  │
                    │                  │
                    │  [Source Pages]  │
                    └──────────────────┘
```

## Module Structure

### Core Modules

| Module | File | Responsibility |
|--------|------|----------------|
| Page Detector | `bdlaw-page-detector.js` | URL pattern matching, domain restriction |
| Extractor | `bdlaw-extractor.js` | DOM text extraction, section detection |
| Metadata | `bdlaw-metadata.js` | Provenance metadata generation |
| Quality | `bdlaw-quality.js` | Data quality assessment, encoding repair |
| Export | `bdlaw-export.js` | JSON formatting, file generation |
| Queue | `bdlaw-queue.js` | Batch processing, deduplication |
| Manifest | `bdlaw-corpus-manifest.js` | Corpus tracking, statistics |

### Extension Components

| Component | File | Role |
|-----------|------|------|
| Background | `background.js` | Service worker, download handling |
| Content Script | `content.js` | DOM access, extraction execution |
| Side Panel | `sidepanel.js` | User interface, workflow control |

## Data Flow

### Extraction Flow

```
User Navigation          Content Script           Side Panel
      │                        │                      │
      │  Navigate to act page  │                      │
      ├───────────────────────►│                      │
      │                        │                      │
      │                        │  Page type detected  │
      │                        ├─────────────────────►│
      │                        │                      │
      │                        │  User clicks Extract │
      │                        │◄─────────────────────┤
      │                        │                      │
      │  element.textContent   │                      │
      │◄───────────────────────┤                      │
      │                        │                      │
      │                        │  Raw content         │
      │                        ├─────────────────────►│
      │                        │                      │
      │                        │                      │  Generate metadata
      │                        │                      │  Apply quality checks
      │                        │                      │  Format export
      │                        │                      │
      │                        │                      │  Store in chrome.storage
      │                        │                      ▼
```

### Content Processing Pipeline

```
┌─────────────────┐
│  DOM Element    │
│  (source page)  │
└────────┬────────┘
         │
         │ element.textContent (ONLY)
         ▼
┌─────────────────┐
│  content_raw    │◄─── Immutable anchor
│  (verbatim)     │     Hash computed here
└────────┬────────┘     Offsets reference here
         │
         │ Unicode NFC normalization
         ▼
┌─────────────────┐
│  content_       │
│  normalized     │
└────────┬────────┘
         │
         │ Non-semantic encoding fixes
         │ (HTML artifacts only)
         ▼
┌─────────────────┐
│  content_       │
│  corrected      │
└─────────────────┘
```

## Domain Restriction

The extension enforces strict domain restriction:

```javascript
ALLOWED_ORIGIN: 'http://bdlaws.minlaw.gov.bd'
```

All extraction functionality is disabled on any other domain. This is enforced at multiple levels:
1. Manifest host permissions
2. Page detector validation
3. Content script URL checks

## Storage Architecture

### Chrome Storage (Persistent)

```javascript
{
  // Extraction queue
  "bdlaw_queue": [
    { id, actNumber, title, url, status, addedAt }
  ],
  
  // Captured acts
  "bdlaw_captured_acts": [
    { actNumber, title, content, metadata, capturedAt }
  ],
  
  // Corpus manifest
  "bdlaw_corpus_manifest": {
    version, created_at, updated_at,
    corpus_stats, acts, volumes
  }
}
```

### Local Storage (Session)

```javascript
{
  // Queue configuration
  "bdlaw_queue_config": {
    extraction_delay_ms,
    minimum_content_threshold,
    max_retry_attempts
  },
  
  // Extraction audit log
  "bdlaw_extraction_log": [
    { timestamp, operation, internal_id, result }
  ]
}
```

## Security Model

### Permissions

```json
{
  "permissions": [
    "activeTab",      // Access current tab only
    "scripting",      // Inject content scripts
    "downloads",      // Save exports
    "storage",        // Persist data
    "sidePanel",      // UI panel
    "tabs"            // Tab navigation
  ],
  "host_permissions": [
    "http://bdlaws.minlaw.gov.bd/*"  // Single domain only
  ]
}
```

### Content Security

- No external network requests
- No data transmission to third parties
- All processing occurs locally in browser
- Exports saved to local filesystem only

## Error Handling

### Extraction Failures

```javascript
FAILURE_REASONS: {
  CONTAINER_NOT_FOUND,      // Primary selector failed
  CONTENT_EMPTY,            // No text in container
  CONTENT_BELOW_THRESHOLD,  // Insufficient content
  CONTENT_SELECTOR_MISMATCH,// Page rendered, no legal anchors
  DOM_NOT_READY,            // DOM timeout
  NETWORK_ERROR,            // Navigation failed
  EXTRACTION_ERROR          // Processing error
}
```

### Retry Strategy

- Only `CONTENT_SELECTOR_MISMATCH` triggers retry
- Exponential backoff: `base_delay * 2^(attempt-1)`
- Maximum 3 retry attempts
- Broader selectors used on retry

## Performance Considerations

### Extraction Timing

- Configurable delay between extractions (default: 3000ms)
- DOM readiness timeout: 30000ms
- Minimum content threshold: 100 characters

### Storage Limits

- Chrome storage quota: ~5MB for sync, ~10MB for local
- Extraction log capped at 1000 entries
- Large corpus exports use downloads API
