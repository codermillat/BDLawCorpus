/**
 * Property-Based Tests for Corpus Deduplication Enforcement
 * 
 * Feature: cross-reference-extraction, Property 9: Deduplication Enforcement
 * Validates: Requirements 7.1, 7.4
 * 
 * For any act with internal_id already in the corpus manifest, attempting to add it 
 * again without force flag SHALL return isDuplicate: true and NOT modify the manifest.
 */

const fc = require('fast-check');
const BDLawCorpusManifest = require('../../bdlaw-corpus-manifest.js');

describe('Property 9: Deduplication Enforcement', () => {
  // Generator for valid internal IDs (numeric strings)
  const internalIdGen = fc.integer({ min: 1, max: 9999 }).map(n => n.toString());

  // Generator for volume numbers
  const volumeNumberGen = fc.integer({ min: 1, max: 50 }).map(n => n.toString());

  // Generator for act titles (Bengali-like strings)
  const titleGen = fc.stringOf(
    fc.constantFrom('আ', 'ই', 'উ', 'এ', 'ও', 'ক', 'খ', 'গ', 'ঘ', 'চ', 'ছ', 'জ', 'ঝ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ', ' '),
    { minLength: 5, maxLength: 50 }
  );

  // Generator for content (random text)
  const contentGen = fc.string({ minLength: 100, maxLength: 1000 });

  // Generator for a single act object
  const actGen = fc.record({
    internal_id: internalIdGen,
    title: titleGen,
    volume_number: volumeNumberGen,
    content: contentGen,
    capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()),
    cross_reference_count: fc.integer({ min: 0, max: 20 })
  });

  /**
   * Property: isDuplicateAct returns true for existing internal_id
   * Requirements: 7.1, 7.4
   */
  it('should return isDuplicate: true for existing internal_id in manifest', () => {
    fc.assert(
      fc.property(
        actGen,
        (act) => {
          // Create manifest and add the act
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          
          // Check if the act is detected as duplicate
          const result = BDLawCorpusManifest.isDuplicateAct(manifest, act.internal_id);
          
          return result.isDuplicate === true &&
                 result.existingEntry !== undefined &&
                 result.existingEntry.internal_id === act.internal_id;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isDuplicateAct returns false for non-existing internal_id
   * Requirements: 7.1
   */
  it('should return isDuplicate: false for non-existing internal_id', () => {
    fc.assert(
      fc.property(
        actGen,
        internalIdGen,
        (act, differentId) => {
          // Skip if IDs happen to be the same
          if (act.internal_id === differentId) return true;
          
          // Create manifest and add the act
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          
          // Check for a different internal_id
          const result = BDLawCorpusManifest.isDuplicateAct(manifest, differentId);
          
          return result.isDuplicate === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isDuplicateAct returns false for empty manifest
   */
  it('should return isDuplicate: false for empty manifest', () => {
    fc.assert(
      fc.property(
        internalIdGen,
        (internalId) => {
          const manifest = BDLawCorpusManifest.createEmptyManifest();
          const result = BDLawCorpusManifest.isDuplicateAct(manifest, internalId);
          
          return result.isDuplicate === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isDuplicateAct message contains capture timestamp
   * Requirements: 7.4
   */
  it('should include capture timestamp in duplicate message', () => {
    fc.assert(
      fc.property(
        actGen,
        (act) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          
          const result = BDLawCorpusManifest.isDuplicateAct(manifest, act.internal_id);
          
          // Message should contain the act ID and timestamp info
          return result.isDuplicate === true &&
                 typeof result.message === 'string' &&
                 result.message.includes(act.internal_id) &&
                 result.existingEntry.capture_timestamp !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isDuplicateVolume returns true for existing volume_number
   * Requirements: 7.2
   */
  it('should return isDuplicate: true for existing volume_number', () => {
    fc.assert(
      fc.property(
        actGen,
        (act) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          
          const result = BDLawCorpusManifest.isDuplicateVolume(manifest, act.volume_number);
          
          return result.isDuplicate === true &&
                 result.existingEntry !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isDuplicateVolume returns false for non-existing volume_number
   * Requirements: 7.2
   */
  it('should return isDuplicate: false for non-existing volume_number', () => {
    fc.assert(
      fc.property(
        actGen,
        volumeNumberGen,
        (act, differentVolume) => {
          // Skip if volumes happen to be the same
          if (act.volume_number === differentVolume) return true;
          
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          
          const result = BDLawCorpusManifest.isDuplicateVolume(manifest, differentVolume);
          
          return result.isDuplicate === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: forceReExtraction archives previous version
   * Requirements: 7.5
   */
  it('should archive previous version when force re-extracting', () => {
    fc.assert(
      fc.property(
        actGen,
        titleGen,
        contentGen,
        (originalAct, newTitle, newContent) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add original act
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, originalAct);
          const originalTimestamp = manifest.acts[originalAct.internal_id].capture_timestamp;
          
          // Force re-extract with new data
          const newAct = {
            internal_id: originalAct.internal_id,
            title: newTitle,
            volume_number: originalAct.volume_number,
            content: newContent,
            capturedAt: new Date().toISOString()
          };
          
          manifest = BDLawCorpusManifest.forceReExtraction(manifest, originalAct.internal_id, newAct);
          
          // Check that version history contains the original
          const history = manifest.version_history[originalAct.internal_id];
          
          return history !== undefined &&
                 history.length === 1 &&
                 history[0].capture_timestamp === originalTimestamp &&
                 history[0].reason === 'force_re_extraction' &&
                 history[0].archived_at !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: forceReExtraction updates manifest with new act data
   * Requirements: 7.5
   */
  it('should update manifest with new act data after force re-extraction', () => {
    fc.assert(
      fc.property(
        actGen,
        titleGen,
        contentGen,
        (originalAct, newTitle, newContent) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add original act
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, originalAct);
          
          // Force re-extract with new data
          const newAct = {
            internal_id: originalAct.internal_id,
            title: newTitle,
            volume_number: originalAct.volume_number,
            content: newContent,
            capturedAt: new Date().toISOString()
          };
          
          manifest = BDLawCorpusManifest.forceReExtraction(manifest, originalAct.internal_id, newAct);
          
          // Check that the manifest now has the new data
          const currentEntry = manifest.acts[originalAct.internal_id];
          
          return currentEntry.title === newTitle &&
                 currentEntry.content_length === newContent.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: forceReExtraction maintains total_acts count
   * Requirements: 7.5
   */
  it('should not increase total_acts when force re-extracting', () => {
    fc.assert(
      fc.property(
        actGen,
        titleGen,
        (originalAct, newTitle) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add original act
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, originalAct);
          const countBefore = manifest.corpus_stats.total_acts;
          
          // Force re-extract
          const newAct = {
            internal_id: originalAct.internal_id,
            title: newTitle,
            volume_number: originalAct.volume_number,
            content: originalAct.content,
            capturedAt: new Date().toISOString()
          };
          
          manifest = BDLawCorpusManifest.forceReExtraction(manifest, originalAct.internal_id, newAct);
          const countAfter = manifest.corpus_stats.total_acts;
          
          return countBefore === countAfter && countAfter === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple force re-extractions accumulate in version history
   * Requirements: 7.5
   */
  it('should accumulate version history with multiple force re-extractions', () => {
    fc.assert(
      fc.property(
        actGen,
        fc.array(titleGen, { minLength: 2, maxLength: 5 }),
        (originalAct, newTitles) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add original act
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, originalAct);
          
          // Force re-extract multiple times
          for (const newTitle of newTitles) {
            const newAct = {
              internal_id: originalAct.internal_id,
              title: newTitle,
              volume_number: originalAct.volume_number,
              content: originalAct.content,
              capturedAt: new Date().toISOString()
            };
            manifest = BDLawCorpusManifest.forceReExtraction(manifest, originalAct.internal_id, newAct);
          }
          
          // Version history should have entries for original + all but last re-extraction
          const history = manifest.version_history[originalAct.internal_id];
          
          return history !== undefined &&
                 history.length === newTitles.length; // Original + (n-1) re-extractions = n entries
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Handle invalid inputs gracefully
   */
  it('should handle invalid inputs gracefully', () => {
    // Null/undefined manifest
    expect(BDLawCorpusManifest.isDuplicateAct(null, '123').isDuplicate).toBe(false);
    expect(BDLawCorpusManifest.isDuplicateAct(undefined, '123').isDuplicate).toBe(false);
    
    // Null/undefined internalId
    const manifest = BDLawCorpusManifest.createEmptyManifest();
    expect(BDLawCorpusManifest.isDuplicateAct(manifest, null).isDuplicate).toBe(false);
    expect(BDLawCorpusManifest.isDuplicateAct(manifest, undefined).isDuplicate).toBe(false);
    
    // Null/undefined volumeNumber
    expect(BDLawCorpusManifest.isDuplicateVolume(manifest, null).isDuplicate).toBe(false);
    expect(BDLawCorpusManifest.isDuplicateVolume(manifest, undefined).isDuplicate).toBe(false);
    
    // forceReExtraction with invalid inputs returns empty manifest (graceful fallback)
    const result = BDLawCorpusManifest.forceReExtraction(null, '123', {});
    expect(result).not.toBeNull();
    expect(result.version).toBe(BDLawCorpusManifest.SCHEMA_VERSION);
  });
});
