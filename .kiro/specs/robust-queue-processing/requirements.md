# Requirements Document: Robust Queue Processing with Delay & Retry

## Introduction

This feature enhances the BDLawCorpus queue processing system to be resilient to temporary site downtime, network issues, and partial DOM loads. It implements configurable delays between extractions, deterministic failure detection, automatic retry mechanisms, and comprehensive failure tracking while maintaining research integrity.

## Glossary

- **Extraction_Delay**: Configurable pause between processing queue items to avoid server overload
- **DOM_Readiness**: State where page content is fully loaded and accessible via textContent
- **Failed_Extraction**: An extraction attempt that did not produce valid content_raw
- **Retry_Queue**: Secondary queue for acts that failed initial extraction
- **Exponential_Backoff**: Delay strategy where wait time doubles with each retry attempt
- **Extraction_Status**: Classification of extraction outcome (success, failed, pending)
- **Minimum_Content_Threshold**: Minimum character count for content_raw to be considered valid
- **Content_Selector_Mismatch**: Failure where page rendered successfully but no valid legal content anchors were detected under allowed DOM extraction rules
- **Legal_Content_Signal**: Verifiable indicator that legal content is present (act title, enactment clause, numbered section, or sufficient text length)
- **Extraction_Readiness**: State where at least one legal content signal is verified, not merely DOM or network completion

## Requirements

### Requirement 1: Configurable Extraction Delay

**User Story:** As a corpus builder, I want configurable delays between extractions, so that I don't overload the source server or trigger rate limiting.

#### Acceptance Criteria

1. THE System SHALL provide a configurable `extraction_delay_ms` setting with default value of 3000 milliseconds
2. THE System SHALL apply the delay AFTER page load AND DOM readiness confirmation, not just after navigation
3. WHEN processing queue items, THE System SHALL wait for the configured delay before navigating to the next act
4. THE System SHALL allow delay values between 1000ms and 30000ms
5. THE System SHALL persist the delay setting across sessions
6. THE System SHALL display the current delay setting in the UI

### Requirement 2: Extraction Readiness Detection

**User Story:** As a corpus builder, I want the system to confirm extraction readiness via legal content signals before extraction, so that I don't capture incomplete content or misclassify fully-rendered pages as failures.

#### Acceptance Criteria

1. WHEN a page loads, THE System SHALL wait for document.readyState === 'complete' as a prerequisite
2. THE System SHALL verify at least one legal content signal before proceeding with extraction
3. THE System SHALL accept ANY ONE of the following as valid legal content signals:
   - Act title text is present in DOM
   - Enactment clause detected (English: "It is hereby enacted" OR Bengali: "এতদ্দ্বারা প্রণীত")
   - First numbered section detected (English: "1." OR Bengali: "১.")
   - Extracted text length meets minimum threshold
4. THE System SHALL implement an extraction readiness timeout of 30 seconds
5. IF extraction readiness timeout is exceeded, THE System SHALL mark the extraction as failed with reason "dom_timeout"
6. IF page is fully rendered but no legal content signals are detected, THE System SHALL mark the extraction as failed with reason "content_selector_mismatch"
7. THE System SHALL NOT proceed with extraction until at least one legal content signal is verified
8. THE System SHALL support both English-only and Bengali-only act page layouts

### Requirement 3: Deterministic Failure Detection

**User Story:** As a corpus builder, I want clear criteria for what constitutes a failed extraction, so that failures are detected consistently and classified accurately.

#### Acceptance Criteria

1. THE System SHALL mark extraction as failed IF no legal content signals are detected (content_selector_mismatch)
2. THE System SHALL mark extraction as failed IF content_raw is empty (length === 0)
3. THE System SHALL mark extraction as failed IF content_raw length is below minimum threshold (default: 100 characters)
4. THE System SHALL mark extraction as failed IF extraction readiness timeout is exceeded (dom_timeout)
5. THE System SHALL mark extraction as failed IF network error or navigation error occurs
6. FOR EACH failure, THE System SHALL record the specific failure_reason
7. THE System SHALL provide a configurable `minimum_content_threshold` setting
8. THE System SHALL distinguish between "content_selector_mismatch" (page rendered, no anchors) and "dom_timeout" (page did not render)
9. THE System SHALL NOT classify selector mismatch failures as timeout failures

### Requirement 4: Failed Extractions Tracking

**User Story:** As a corpus builder, I want failed extractions tracked separately, so that I can review and retry them.

#### Acceptance Criteria

1. THE System SHALL maintain a `failed_extractions` list separate from the main queue
2. FOR EACH failed extraction, THE System SHALL record: act_id, url, failure_reason, retry_count, failed_at timestamp
3. THE System SHALL persist failed_extractions across sessions
4. THE System SHALL display failed extraction count in the UI
5. THE System SHALL allow viewing the failed extractions list with failure details
6. THE System SHALL NOT remove failed extractions from tracking until explicitly cleared by user

### Requirement 5: Automatic Retry Mechanism

**User Story:** As a corpus builder, I want failed extractions automatically retried with relaxed selectors, so that temporary failures and layout variations don't require manual intervention.

#### Acceptance Criteria

1. WHEN main queue processing completes, THE System SHALL automatically process the retry queue
2. THE System SHALL limit retries to a configurable maximum (default: 3 attempts per act)
3. THE System SHALL apply exponential backoff delay before each retry (base_delay * 2^retry_count)
4. THE System SHALL increment retry_count for each retry attempt
5. IF maximum retries exceeded, THE System SHALL mark the act as permanently failed
6. THE System SHALL NOT merge partial retry results into successful extractions
7. EACH retry attempt SHALL be logged separately with attempt number and outcome
8. ON retry attempts, THE System SHALL use a broader selector set while maintaining extraction constraints
9. ON retry attempts, THE System SHALL NOT infer missing text or auto-correct content
10. ON retry attempts, THE System SHALL NOT downgrade research integrity rules

### Requirement 6: Failed Act Export Format

**User Story:** As a corpus builder, I want permanently failed acts exported with failure metadata, so that the corpus honestly reflects extraction limitations.

#### Acceptance Criteria

1. WHEN all retries fail, THE System SHALL export the act with extraction_status: "failed"
2. THE System SHALL include failure_reason in the export
3. THE System SHALL include total attempts count in the export
4. THE System SHALL include timestamps for each attempt
5. THE System SHALL NOT silently skip or omit failed acts from exports
6. THE System SHALL NOT auto-correct or infer content for failed extractions

### Requirement 7: UI Feedback for Queue Processing

**User Story:** As a corpus builder, I want clear UI feedback on extraction status, so that I understand the processing state.

#### Acceptance Criteria

1. THE System SHALL display count of successful extractions
2. THE System SHALL display count of failed extractions
3. THE System SHALL display count of retried extractions
4. THE System SHALL clearly label retry attempts as "Retry #N" in progress display
5. THE System SHALL show current delay countdown between extractions
6. THE System SHALL indicate when retry queue is being processed
7. THE System SHALL NOT create illusion of completeness when failures exist

### Requirement 8: Processing State Persistence

**User Story:** As a corpus builder, I want processing state preserved if the browser closes, so that I can resume without losing progress.

#### Acceptance Criteria

1. THE System SHALL save queue state after each extraction attempt
2. THE System SHALL save failed_extractions list after each failure
3. THE System SHALL save retry_count for each item
4. WHEN sidepanel reopens, THE System SHALL restore processing state
5. THE System SHALL allow resuming interrupted queue processing

### Requirement 9: Research Integrity Constraints

**User Story:** As a researcher, I want the retry system to maintain research integrity, so that the corpus remains honest and auditable.

#### Acceptance Criteria

1. THE System SHALL NOT perform automated crawling beyond the user-queued acts
2. THE System SHALL NOT infer or generate content for failed extractions
3. THE System SHALL NOT modify HTML or DOM during extraction
4. THE System SHALL continue using element.textContent exclusively for extraction
5. THE System SHALL log all retry attempts for audit purposes
6. THE System SHALL clearly distinguish between successful and failed extractions in exports

### Requirement 10: Configurable Retry Settings

**User Story:** As a corpus builder, I want configurable retry settings, so that I can adjust behavior based on site conditions.

#### Acceptance Criteria

1. THE System SHALL provide configurable `max_retry_attempts` (default: 3, range: 1-5)
2. THE System SHALL provide configurable `retry_base_delay_ms` (default: 5000, range: 2000-30000)
3. THE System SHALL provide configurable `minimum_content_threshold` (default: 100, range: 50-1000)
4. THE System SHALL persist all retry settings across sessions
5. THE System SHALL display current retry settings in the UI
6. THE System SHALL allow modifying settings without clearing the queue

## Non-Functional Requirements

### Performance

- Delay and retry mechanisms SHALL NOT block the browser UI
- Queue processing SHALL use async/await for non-blocking operation
- Settings changes SHALL take effect immediately for subsequent extractions

### Reliability

- Failed extraction tracking SHALL survive browser restarts
- Retry mechanism SHALL handle network interruptions gracefully
- System SHALL recover from partial state corruption

## Known Limitations (Documented, No Code Required)

### Limitation 1: Site Downtime Beyond Retry Window

If the source site is down for longer than the retry window (max_retries * exponential_backoff), extractions will be marked as permanently failed. Users must manually re-queue such acts after site recovery.

### Limitation 2: No Cross-Session Retry Resumption

If the browser is closed during retry processing, the retry queue state is preserved but automatic retry processing does not resume on next session. Users must manually trigger queue processing.

### Limitation 3: Rate Limiting Detection

The system does not detect server-side rate limiting. If rate limited, extractions may fail with generic network errors. Users should increase delay settings if rate limiting is suspected.

### Limitation 4: Layout Heterogeneity

Some failures occur due to heterogeneous DOM layouts in fully rendered act pages, where legal content cannot be reliably anchored without violating extraction constraints. These are classified as "content_selector_mismatch" failures and represent a methodological boundary, not a system error. Such acts require manual review or updated selector patterns.

## Methodology Disclosure

Some extraction failures arise from layout heterogeneity across fully rendered act pages, where DOM structure diverges from assumed extraction anchors. The system explicitly distinguishes between:
- **Network/timeout failures**: Page did not render successfully
- **Selector mismatch failures**: Page rendered but legal content could not be reliably detected

This distinction preserves research integrity by refusing to infer content when extraction anchors are ambiguous.
