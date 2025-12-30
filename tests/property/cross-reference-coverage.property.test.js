/**
 * Property-Based Tests for Cross-Reference Coverage Tracking
 * 
 * Feature: cross-reference-extraction, Property 12: Cross-Reference Coverage Tracking
 * Validates: Requirements 8.4
 * 
 * For any corpus with cross-references, referenced_acts_in_corpus SHALL contain
 * only internal_ids that exist in manifest.acts, and referenced_acts_missing
 * SHALL contain only internal_ids NOT in manifest.acts.
 */

const fc = require('fast-check');
const BDLawCorpusManifest = require('../../bdlaw-corpus-manifest.js');

describe('Property 12: Cross-Reference Coverage Tracking', () => {
  // Generator for valid internal IDs (numeric strings)
  const internalIdGen = fc.integer({ min: 1, max: 9999 }).map(n => n.toString());

  // Generator for volume numbers
  const volumeNumberGen = fc.integer({ min: 1, max: 50 }).map(n => n.toString());

  // Generator for years (for cross-references)
  const yearGen = fc.integer({ min: 1900, max: 2025 }).map(n => n.toString());

  // Generator for serial numbers
  const serialGen = fc.integer({ min: 1, max: 100 }).map(n => n.toString());

  // Generator for a single act object
  const actGen = fc.record({
    internal_id: internalIdGen,
    title: fc.string({ minLength: 5, maxLength: 50 }),
    volume_number: volumeNumberGen,
    content: fc.string({ minLength: 100, maxLength: 500 }),
    capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString())
  });

  // Generator for a cross-reference object
  const crossRefGen = fc.record({
    citation_year: yearGen,
    citation_serial: serialGen,
    lexical_relation_type: fc.constantFrom('amendment', 'repeal', 'substitution', 'dependency', 'mention')
  });

  /**
   * Property: referenced_acts_in_corpus SHALL contain only IDs that exist in manifest.acts
   */
  it('should have referenced_acts_in_corpus contain only IDs in manifest.acts', () => {
    fc.assert(
      fc.property(
        fc.array(actGen, { minLength: 1, maxLength: 5 }),
        fc.array(crossRefGen, { minLength: 0, maxLength: 10 }),
        (acts, crossRefs) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add acts to manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Create cross-reference data map
          const crossRefData = {};
          if (acts.length > 0) {
            crossRefData[acts[0].internal_id] = crossRefs;
          }
          
          // Update coverage
          manifest = BDLawCorpusManifest.updateCrossReferenceCoverage(manifest, crossRefData);
          
          // All IDs in referenced_acts_in_corpus should exist in manifest.acts
          const corpusActIds = new Set(Object.keys(manifest.acts));
          return manifest.cross_reference_coverage.referenced_acts_in_corpus.every(
            id => corpusActIds.has(id)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: referenced_acts_missing SHALL contain only IDs NOT in manifest.acts
   */
  it('should have referenced_acts_missing contain only IDs NOT in manifest.acts', () => {
    fc.assert(
      fc.property(
        fc.array(actGen, { minLength: 1, maxLength: 5 }),
        fc.array(crossRefGen, { minLength: 0, maxLength: 10 }),
        (acts, crossRefs) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add acts to manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Create cross-reference data map
          const crossRefData = {};
          if (acts.length > 0) {
            crossRefData[acts[0].internal_id] = crossRefs;
          }
          
          // Update coverage
          manifest = BDLawCorpusManifest.updateCrossReferenceCoverage(manifest, crossRefData);
          
          // All IDs in referenced_acts_missing should NOT exist in manifest.acts
          const corpusActIds = new Set(Object.keys(manifest.acts));
          return manifest.cross_reference_coverage.referenced_acts_missing.every(
            id => !corpusActIds.has(id)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: referenced_acts_in_corpus and referenced_acts_missing should be disjoint
   */
  it('should have disjoint in_corpus and missing sets', () => {
    fc.assert(
      fc.property(
        fc.array(actGen, { minLength: 1, maxLength: 5 }),
        fc.array(crossRefGen, { minLength: 1, maxLength: 10 }),
        (acts, crossRefs) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add acts to manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Create cross-reference data map
          const crossRefData = {};
          if (acts.length > 0) {
            crossRefData[acts[0].internal_id] = crossRefs;
          }
          
          // Update coverage
          manifest = BDLawCorpusManifest.updateCrossReferenceCoverage(manifest, crossRefData);
          
          // Sets should be disjoint (no overlap)
          const inCorpusSet = new Set(manifest.cross_reference_coverage.referenced_acts_in_corpus);
          const missingSet = new Set(manifest.cross_reference_coverage.referenced_acts_missing);
          
          for (const id of inCorpusSet) {
            if (missingSet.has(id)) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: coverage_percentage should be between 0 and 100
   */
  it('should have coverage_percentage between 0 and 100', () => {
    fc.assert(
      fc.property(
        fc.array(actGen, { minLength: 0, maxLength: 5 }),
        fc.array(crossRefGen, { minLength: 0, maxLength: 10 }),
        (acts, crossRefs) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add acts to manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Create cross-reference data map
          const crossRefData = {};
          if (acts.length > 0) {
            crossRefData[acts[0].internal_id] = crossRefs;
          }
          
          // Update coverage
          manifest = BDLawCorpusManifest.updateCrossReferenceCoverage(manifest, crossRefData);
          
          const percentage = manifest.cross_reference_coverage.coverage_percentage;
          return percentage >= 0 && percentage <= 100;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty cross-reference data should result in 100% coverage
   */
  it('should have 100% coverage when no cross-references exist', () => {
    fc.assert(
      fc.property(
        fc.array(actGen, { minLength: 0, maxLength: 5 }),
        (acts) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add acts to manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Update coverage with empty cross-reference data
          manifest = BDLawCorpusManifest.updateCrossReferenceCoverage(manifest, {});
          
          // Should be 100% coverage (nothing to cover)
          return manifest.cross_reference_coverage.coverage_percentage === 100 &&
                 manifest.cross_reference_coverage.referenced_acts_in_corpus.length === 0 &&
                 manifest.cross_reference_coverage.referenced_acts_missing.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: coverage_percentage should be calculated correctly
   */
  it('should calculate coverage_percentage correctly', () => {
    fc.assert(
      fc.property(
        fc.array(actGen, { minLength: 1, maxLength: 5 }),
        fc.array(crossRefGen, { minLength: 1, maxLength: 10 }),
        (acts, crossRefs) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add acts to manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Create cross-reference data map
          const crossRefData = {};
          if (acts.length > 0) {
            crossRefData[acts[0].internal_id] = crossRefs;
          }
          
          // Update coverage
          manifest = BDLawCorpusManifest.updateCrossReferenceCoverage(manifest, crossRefData);
          
          const inCorpusCount = manifest.cross_reference_coverage.referenced_acts_in_corpus.length;
          const missingCount = manifest.cross_reference_coverage.referenced_acts_missing.length;
          const totalRefs = inCorpusCount + missingCount;
          
          if (totalRefs === 0) {
            return manifest.cross_reference_coverage.coverage_percentage === 100;
          }
          
          const expectedPercentage = Math.round((inCorpusCount / totalRefs) * 100);
          return manifest.cross_reference_coverage.coverage_percentage === expectedPercentage;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Updating coverage should not modify acts or volumes
   */
  it('should not modify acts or volumes when updating coverage', () => {
    fc.assert(
      fc.property(
        fc.array(actGen, { minLength: 1, maxLength: 5 }),
        fc.array(crossRefGen, { minLength: 0, maxLength: 10 }),
        (acts, crossRefs) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add acts to manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Store original acts and volumes
          const originalActsJson = JSON.stringify(manifest.acts);
          const originalVolumesJson = JSON.stringify(manifest.volumes);
          
          // Create cross-reference data map
          const crossRefData = {};
          if (acts.length > 0) {
            crossRefData[acts[0].internal_id] = crossRefs;
          }
          
          // Update coverage
          manifest = BDLawCorpusManifest.updateCrossReferenceCoverage(manifest, crossRefData);
          
          // Acts and volumes should be unchanged
          return JSON.stringify(manifest.acts) === originalActsJson &&
                 JSON.stringify(manifest.volumes) === originalVolumesJson;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cross-reference coverage arrays should be arrays
   */
  it('should have arrays for referenced_acts_in_corpus and referenced_acts_missing', () => {
    fc.assert(
      fc.property(
        fc.array(actGen, { minLength: 0, maxLength: 5 }),
        fc.array(crossRefGen, { minLength: 0, maxLength: 10 }),
        (acts, crossRefs) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add acts to manifest
          for (const act of acts) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Create cross-reference data map
          const crossRefData = {};
          if (acts.length > 0) {
            crossRefData[acts[0].internal_id] = crossRefs;
          }
          
          // Update coverage
          manifest = BDLawCorpusManifest.updateCrossReferenceCoverage(manifest, crossRefData);
          
          return Array.isArray(manifest.cross_reference_coverage.referenced_acts_in_corpus) &&
                 Array.isArray(manifest.cross_reference_coverage.referenced_acts_missing);
        }
      ),
      { numRuns: 100 }
    );
  });
});
