/**
 * Property-Based Tests for Export Progress Tracking
 * 
 * Feature: durable-persistence-hardening, Property 19: Export Progress Tracking
 * Validates: Requirements 12.1, 12.2, 12.3
 * 
 * For any batch export of N acts, the progress SHALL update N times (once per act).
 * If export is interrupted at act K, resuming SHALL start from act K (not from the beginning).
 */

const fc = require('fast-check');

const {
  ExportProgressTracker
} = require('../../bdlaw-storage.js');

describe('Property 19: Export Progress Tracking', () => {
  beforeEach(async () => {
    // Reset the ExportProgressTracker state before each test
    ExportProgressTracker.clearCache();
    // Reset to default state
    ExportProgressTracker._state = {
      export_id: null,
      total_acts: 0,
      current_index: 0,
      exported_act_ids: [],
      failed_act_ids: [],
      status: 'idle',
      started_at: null,
      last_updated_at: null,
      rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
      pending_act_ids: []
    };
  });

  afterEach(() => {
    // Clean up
    ExportProgressTracker.clearCache();
  });

  // Generator for act IDs
  const actIdGen = fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 1, maxLength: 6 });
  
  // Generator for arrays of unique act IDs
  const actIdArrayGen = fc.array(actIdGen, { minLength: 1, maxLength: 50 })
    .map(ids => [...new Set(ids)]) // Ensure uniqueness
    .filter(ids => ids.length > 0);

  /**
   * Property: Progress updates N times for N acts
   * Requirements: 12.1
   */
  it('should update progress N times for N acts exported', async () => {
    await fc.assert(
      fc.asyncProperty(
        actIdArrayGen,
        async (actIds) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Track progress updates
          let progressUpdates = 0;
          ExportProgressTracker.setProgressCallback(() => {
            progressUpdates++;
          });

          // Start export
          await ExportProgressTracker.startExport(actIds);
          const startUpdates = progressUpdates;

          // Export each act
          for (const actId of actIds) {
            await ExportProgressTracker.recordActExported(actId);
          }

          // Clean up callback
          ExportProgressTracker._progressCallback = null;

          // Verify progress updated N times (once per act) plus 1 for start
          // startExport triggers 1 update, then each recordActExported triggers 1
          return progressUpdates === actIds.length + 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: current_index increments correctly
   * Requirements: 12.1
   */
  it('should increment current_index correctly for each exported act', async () => {
    await fc.assert(
      fc.asyncProperty(
        actIdArrayGen,
        async (actIds) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Start export
          await ExportProgressTracker.startExport(actIds);

          // Export each act and verify index
          for (let i = 0; i < actIds.length; i++) {
            const result = await ExportProgressTracker.recordActExported(actIds[i]);
            if (result.current_index !== i + 1) {
              return false;
            }
          }

          // Verify final state
          const state = await ExportProgressTracker.getState();
          return state.current_index === actIds.length &&
                 state.exported_act_ids.length === actIds.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Resume starts from last successful act (not beginning)
   * Requirements: 12.2
   */
  it('should resume from last successful act, not from beginning', async () => {
    await fc.assert(
      fc.asyncProperty(
        actIdArrayGen.filter(ids => ids.length >= 3),
        fc.integer({ min: 1, max: 49 }),
        async (actIds, interruptPoint) => {
          // Ensure interrupt point is valid
          const actualInterruptPoint = Math.min(interruptPoint, actIds.length - 1);
          if (actualInterruptPoint < 1) return true;

          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Start export
          await ExportProgressTracker.startExport(actIds);

          // Export some acts (simulate partial export)
          for (let i = 0; i < actualInterruptPoint; i++) {
            await ExportProgressTracker.recordActExported(actIds[i]);
          }

          // Simulate interruption by pausing
          await ExportProgressTracker.pauseExport();

          // Check for interrupted export
          const interruptedCheck = await ExportProgressTracker.checkForInterruptedExport();
          if (!interruptedCheck.can_resume) return false;
          if (interruptedCheck.exported_count !== actualInterruptPoint) return false;
          if (interruptedCheck.remaining_count !== actIds.length - actualInterruptPoint) return false;

          // Resume export
          const resumeResult = await ExportProgressTracker.resumeExport();
          
          // Verify resume starts from correct position
          if (resumeResult.current_index !== actualInterruptPoint) return false;
          
          // Verify remaining acts are correct
          const remainingIds = resumeResult.remaining_act_ids;
          const expectedRemaining = actIds.slice(actualInterruptPoint);
          
          // Check that remaining IDs match expected
          if (remainingIds.length !== expectedRemaining.length) return false;
          for (const id of expectedRemaining) {
            if (!remainingIds.includes(id)) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Status transitions correctly through export lifecycle
   * Requirements: 12.1, 12.2
   */
  it('should transition status correctly through export lifecycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        actIdArrayGen,
        async (actIds) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Initial state should be idle
          let state = await ExportProgressTracker.getState();
          if (state.status !== 'idle') return false;

          // Start export - status should be in_progress
          await ExportProgressTracker.startExport(actIds);
          state = await ExportProgressTracker.getState();
          if (state.status !== 'in_progress') return false;

          // Export all acts - status should be completed
          for (const actId of actIds) {
            await ExportProgressTracker.recordActExported(actId);
          }
          state = await ExportProgressTracker.getState();
          if (state.status !== 'completed') return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Exported act IDs are tracked correctly
   * Requirements: 12.1, 12.3
   */
  it('should track exported act IDs correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        actIdArrayGen,
        async (actIds) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Start export
          await ExportProgressTracker.startExport(actIds);

          // Export each act
          for (const actId of actIds) {
            await ExportProgressTracker.recordActExported(actId);
          }

          // Verify all act IDs are tracked
          const state = await ExportProgressTracker.getState();
          
          // Check that all exported IDs match
          if (state.exported_act_ids.length !== actIds.length) return false;
          for (const actId of actIds) {
            if (!state.exported_act_ids.includes(actId)) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Progress percentage is calculated correctly
   * Requirements: 12.1
   */
  it('should calculate progress percentage correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        actIdArrayGen,
        async (actIds) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Start export
          await ExportProgressTracker.startExport(actIds);

          // Export each act and verify progress percentage
          for (let i = 0; i < actIds.length; i++) {
            const result = await ExportProgressTracker.recordActExported(actIds[i]);
            const expectedPercent = Math.round(((i + 1) / actIds.length) * 100);
            if (result.progress_percent !== expectedPercent) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Failed acts are tracked separately from exported acts
   * Requirements: 12.1
   */
  it('should track failed acts separately from exported acts', async () => {
    await fc.assert(
      fc.asyncProperty(
        actIdArrayGen.filter(ids => ids.length >= 4),
        async (actIds) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Start export
          await ExportProgressTracker.startExport(actIds);

          // Export some, fail some
          const halfPoint = Math.floor(actIds.length / 2);
          for (let i = 0; i < actIds.length; i++) {
            if (i < halfPoint) {
              await ExportProgressTracker.recordActExported(actIds[i]);
            } else {
              await ExportProgressTracker.recordActFailed(actIds[i], 'Test error');
            }
          }

          // Verify counts
          const state = await ExportProgressTracker.getState();
          if (state.exported_act_ids.length !== halfPoint) return false;
          if (state.failed_act_ids.length !== actIds.length - halfPoint) return false;
          if (state.current_index !== actIds.length) return false;

          // Verify no overlap between exported and failed
          for (const id of state.exported_act_ids) {
            if (state.failed_act_ids.includes(id)) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cancel preserves already-exported acts
   * Requirements: 12.6
   */
  it('should preserve already-exported acts on cancel', async () => {
    await fc.assert(
      fc.asyncProperty(
        actIdArrayGen.filter(ids => ids.length >= 3),
        fc.integer({ min: 1, max: 49 }),
        async (actIds, cancelPoint) => {
          // Ensure cancel point is valid
          const actualCancelPoint = Math.min(cancelPoint, actIds.length - 1);
          if (actualCancelPoint < 1) return true;

          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Start export
          await ExportProgressTracker.startExport(actIds);

          // Export some acts
          for (let i = 0; i < actualCancelPoint; i++) {
            await ExportProgressTracker.recordActExported(actIds[i]);
          }

          // Cancel export
          const cancelResult = await ExportProgressTracker.cancelExport();

          // Verify exported count is preserved
          if (cancelResult.exported_count !== actualCancelPoint) return false;
          if (cancelResult.status !== 'cancelled') return false;

          // Verify state still has exported acts
          const state = await ExportProgressTracker.getState();
          if (state.exported_act_ids.length !== actualCancelPoint) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
