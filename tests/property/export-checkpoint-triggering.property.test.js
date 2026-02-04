/**
 * Property-Based Tests for Export Checkpoint Triggering
 * 
 * Feature: durable-persistence-hardening, Property 14: Export Checkpoint Triggering
 * Validates: Requirements 8.1, 8.2, 8.3
 * 
 * For any extraction sequence, when acts_since_export >= N (where N is the configured threshold),
 * the system SHALL set exportPromptDisplayed = true. After user dismisses the prompt,
 * the counter SHALL reset, and the prompt SHALL reappear after another N extractions.
 */

const fc = require('fast-check');

const {
  ExportCheckpointManager
} = require('../../bdlaw-storage.js');

describe('Property 14: Export Checkpoint Triggering', () => {
  beforeEach(async () => {
    // Reset the ExportCheckpointManager state before each test
    ExportCheckpointManager.clearCache();
    // Reset to default state
    ExportCheckpointManager._state = {
      last_export_timestamp: null,
      acts_since_export: 0,
      threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
      prompt_displayed: false,
      prompt_dismissed_at: null
    };
  });

  afterEach(() => {
    // Clean up
    ExportCheckpointManager.clearCache();
  });

  // Generator for valid threshold values (10-200)
  const thresholdGen = fc.integer({ min: 10, max: 200 });

  // Generator for extraction counts
  const extractionCountGen = fc.integer({ min: 0, max: 300 });

  /**
   * Property: Prompt is triggered when acts_since_export >= threshold
   * Requirements: 8.1, 8.2
   */
  it('should trigger prompt when acts_since_export >= threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        thresholdGen,
        async (threshold) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: threshold,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Record exactly threshold number of extractions
          let shouldPrompt = false;
          for (let i = 0; i < threshold; i++) {
            const result = await ExportCheckpointManager.recordExtraction();
            if (i === threshold - 1) {
              shouldPrompt = result.should_prompt;
            }
          }

          // Verify prompt is triggered at threshold
          return shouldPrompt === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Prompt is NOT triggered when acts_since_export < threshold
   * Requirements: 8.1
   */
  it('should NOT trigger prompt when acts_since_export < threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        thresholdGen,
        fc.integer({ min: 1, max: 199 }), // Count less than max threshold
        async (threshold, countBelowThreshold) => {
          // Ensure count is less than threshold
          const count = Math.min(countBelowThreshold, threshold - 1);
          if (count <= 0) return true; // Skip if count would be 0 or negative

          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: threshold,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Record count extractions (less than threshold)
          let lastResult;
          for (let i = 0; i < count; i++) {
            lastResult = await ExportCheckpointManager.recordExtraction();
          }

          // Verify prompt is NOT triggered
          return lastResult.should_prompt === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Counter resets after dismiss, re-prompts after another N acts
   * Requirements: 8.3
   */
  it('should reset counter on dismiss and re-prompt after another N acts', async () => {
    await fc.assert(
      fc.asyncProperty(
        thresholdGen,
        async (threshold) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: threshold,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Record threshold extractions to trigger first prompt
          for (let i = 0; i < threshold; i++) {
            await ExportCheckpointManager.recordExtraction();
          }

          // Verify prompt is triggered
          const checkBefore = await ExportCheckpointManager.shouldPromptExport();
          if (!checkBefore.should_prompt) return false;

          // Dismiss the prompt
          const dismissResult = await ExportCheckpointManager.dismissPrompt();
          
          // Verify counter is reset
          if (dismissResult.acts_since_export !== 0) return false;

          // Verify prompt is no longer triggered
          const checkAfterDismiss = await ExportCheckpointManager.shouldPromptExport();
          if (checkAfterDismiss.should_prompt) return false;

          // Record another threshold extractions
          let rePromptTriggered = false;
          for (let i = 0; i < threshold; i++) {
            const result = await ExportCheckpointManager.recordExtraction();
            if (i === threshold - 1) {
              rePromptTriggered = result.should_prompt;
            }
          }

          // Verify re-prompt is triggered
          return rePromptTriggered === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Counter resets after export
   * Requirements: 8.2, 8.3
   */
  it('should reset counter on export', async () => {
    await fc.assert(
      fc.asyncProperty(
        thresholdGen,
        fc.integer({ min: 1, max: 200 }),
        async (threshold, extractionCount) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: threshold,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Record some extractions
          const count = Math.min(extractionCount, threshold + 50);
          for (let i = 0; i < count; i++) {
            await ExportCheckpointManager.recordExtraction();
          }

          // Record export
          const exportResult = await ExportCheckpointManager.recordExport();

          // Verify counter is reset
          if (exportResult.acts_since_export !== 0) return false;

          // Verify last_export_timestamp is set
          if (!exportResult.last_export_timestamp) return false;

          // Verify prompt is no longer triggered
          const checkAfterExport = await ExportCheckpointManager.shouldPromptExport();
          return checkAfterExport.should_prompt === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: acts_since_export increments correctly
   * Requirements: 8.2
   */
  it('should increment acts_since_export correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        async (extractionCount) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Record extractions
          for (let i = 0; i < extractionCount; i++) {
            await ExportCheckpointManager.recordExtraction();
          }

          // Verify counter matches extraction count
          const state = await ExportCheckpointManager.getState();
          return state.acts_since_export === extractionCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: last_export_timestamp is updated on export
   * Requirements: 8.2
   */
  it('should update last_export_timestamp on export', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),
        async (extractionCount) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Record some extractions
          for (let i = 0; i < extractionCount; i++) {
            await ExportCheckpointManager.recordExtraction();
          }

          // Verify no timestamp before export
          const stateBefore = await ExportCheckpointManager.getState();
          if (stateBefore.last_export_timestamp !== null) return false;

          // Record export
          const beforeExport = Date.now();
          const exportResult = await ExportCheckpointManager.recordExport();
          const afterExport = Date.now();

          // Verify timestamp is set and is valid ISO-8601
          if (!exportResult.last_export_timestamp) return false;
          
          const exportTime = new Date(exportResult.last_export_timestamp).getTime();
          if (isNaN(exportTime)) return false;
          
          // Verify timestamp is within expected range
          return exportTime >= beforeExport && exportTime <= afterExport;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Prompt callback is invoked when threshold is reached
   * Requirements: 8.1
   */
  it('should invoke prompt callback when threshold is reached', async () => {
    await fc.assert(
      fc.asyncProperty(
        thresholdGen,
        async (threshold) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: threshold,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Track callback invocations
          let callbackInvoked = false;
          let callbackData = null;

          ExportCheckpointManager.setPromptCallback((data) => {
            callbackInvoked = true;
            callbackData = data;
          });

          // Record threshold extractions
          for (let i = 0; i < threshold; i++) {
            await ExportCheckpointManager.recordExtraction();
          }

          // Clean up callback
          ExportCheckpointManager._promptCallback = null;

          // Verify callback was invoked
          if (!callbackInvoked) return false;
          if (!callbackData) return false;
          if (callbackData.acts_since_export !== threshold) return false;
          if (callbackData.threshold !== threshold) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
