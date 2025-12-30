/**
 * Property-Based Tests for Manifest Statistics Accuracy
 * 
 * Feature: cross-reference-extraction, Property 11: Manifest Statistics Accuracy
 * Validates: Requirements 8.3
 * 
 * For any corpus manifest, total_acts SHALL equal the count of keys in manifest.acts,
 * and total_volumes SHALL equal the count of keys in manifest.volumes.
 */

const fc = require('fast-check');
const BDLawCorpusManifest = require('../../bdlaw-corpus-manifest.js');

describe('Property 11: Manifest Statistics Accuracy', () => {
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
   * Property: total_acts SHALL equal count of keys in manifest.acts
   */
  it('should have total_acts equal to count of keys in manifest.acts', () => {
    fc.assert(
      fc.property(
        fc.array(actGen, { minLength: 0, maxLength: 10 }),
        (acts) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add each act to the manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // total_acts should equal the number of unique internal_ids
          const expectedCount = Object.keys(manifest.acts).length;
          return manifest.corpus_stats.total_acts === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: total_volumes SHALL equal count of keys in manifest.volumes
   */
  it('should have total_volumes equal to count of keys in manifest.volumes', () => {
    fc.assert(
      fc.property(
        fc.array(actGen, { minLength: 0, maxLength: 10 }),
        (acts) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add each act to the manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // total_volumes should equal the number of unique volume_numbers
          const expectedCount = Object.keys(manifest.volumes).length;
          return manifest.corpus_stats.total_volumes === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Adding duplicate internal_id should not increase total_acts
   */
  it('should not increase total_acts when adding duplicate internal_id', () => {
    fc.assert(
      fc.property(
        actGen,
        titleGen,
        (act, newTitle) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add the act first time
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          const countAfterFirst = manifest.corpus_stats.total_acts;
          
          // Add the same act again with different title
          const duplicateAct = { ...act, title: newTitle };
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, duplicateAct);
          const countAfterSecond = manifest.corpus_stats.total_acts;
          
          // Count should remain the same
          return countAfterFirst === countAfterSecond && countAfterFirst === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty manifest should have zero counts
   */
  it('should have zero counts for empty manifest', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // Just need to run once
        () => {
          const manifest = BDLawCorpusManifest.createEmptyManifest();
          
          return manifest.corpus_stats.total_acts === 0 &&
                 manifest.corpus_stats.total_volumes === 0 &&
                 manifest.corpus_stats.total_characters === 0 &&
                 Object.keys(manifest.acts).length === 0 &&
                 Object.keys(manifest.volumes).length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: total_characters should equal sum of all act content lengths
   */
  it('should have total_characters equal to sum of all act content lengths', () => {
    fc.assert(
      fc.property(
        fc.array(actGen, { minLength: 1, maxLength: 5 }),
        (acts) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add each act to the manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Calculate expected total characters from manifest.acts
          const expectedTotal = Object.values(manifest.acts)
            .reduce((sum, act) => sum + (act.content_length || 0), 0);
          
          return manifest.corpus_stats.total_characters === expectedTotal;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Acts with same volume_number should be tracked in same volume entry
   */
  it('should track acts with same volume_number in same volume entry', () => {
    fc.assert(
      fc.property(
        volumeNumberGen,
        fc.array(internalIdGen, { minLength: 2, maxLength: 5 }),
        titleGen,
        contentGen,
        (volumeNumber, internalIds, title, content) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add multiple acts with the same volume number
          const uniqueIds = [...new Set(internalIds)];
          for (const id of uniqueIds) {
            const act = {
              internal_id: id,
              title: title,
              volume_number: volumeNumber,
              content: content,
              capturedAt: new Date().toISOString()
            };
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Should have exactly one volume entry
          const volumeCount = Object.keys(manifest.volumes).length;
          
          // The volume should track all unique acts
          const volumeEntry = manifest.volumes[volumeNumber];
          const trackedActCount = volumeEntry ? volumeEntry.extracted_acts.length : 0;
          
          return volumeCount === 1 && trackedActCount === uniqueIds.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extraction_date_range should be updated correctly
   */
  it('should update extraction_date_range with earliest and latest dates', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            internal_id: internalIdGen,
            title: titleGen,
            volume_number: volumeNumberGen,
            content: contentGen,
            capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString())
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (acts) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add each act to the manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Get all capture dates
          const dates = acts.map(a => a.capturedAt).sort();
          const expectedEarliest = dates[0];
          const expectedLatest = dates[dates.length - 1];
          
          // Date range should match
          return manifest.corpus_stats.extraction_date_range.earliest <= expectedEarliest &&
                 manifest.corpus_stats.extraction_date_range.latest >= expectedLatest;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Manifest version should be set correctly
   */
  it('should have correct schema version', () => {
    fc.assert(
      fc.property(
        actGen,
        (act) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          
          return manifest.version === BDLawCorpusManifest.SCHEMA_VERSION;
        }
      ),
      { numRuns: 100 }
    );
  });
});
