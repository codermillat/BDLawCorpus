/**
 * Property-Based Tests for Corpus Export Schema Compliance
 * 
 * Feature: bdlawcorpus-mode, Property 22: Corpus Export Schema Compliance
 * Validates: Requirements 29.4 (volume_number never null)
 * 
 * METHODOLOGICAL PRINCIPLE: Corpus-stage extraction only.
 * - NO structured_sections (semantic interpretation)
 * - NO amendments classification (legal analysis)
 * - marker_frequency instead of sections_detected (honest naming)
 * 
 * Property: For any corpus export, each act SHALL include:
 * - act_number, title, content, url (required strings)
 * - volume_number (never null, defaults to "unknown")
 * - marker_frequency (object with marker counts)
 */

const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Property 22: Corpus Export Schema Compliance', () => {
  
  // Generator for valid act numbers (numeric strings)
  const actNumberArb = fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), {
    minLength: 1,
    maxLength: 6
  });

  // Generator for Bengali text
  const bengaliTextArb = fc.stringOf(
    fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 
                    'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 
                    'স', 'হ', 'া', 'ি', 'ী', 'ু', 'ূ', 'ে', 'ৈ', 'ো', 'ৌ', ' ', '\n'),
    { minLength: 0, maxLength: 200 }
  );

  // Generator for marker frequency counts
  const markerFrequencyArb = fc.record({
    'ধারা': fc.integer({ min: 0, max: 100 }),
    'অধ্যায়': fc.integer({ min: 0, max: 50 }),
    'তফসিল': fc.integer({ min: 0, max: 20 })
  });

  // Generator for captured act objects (corpus-stage schema)
  const capturedActArb = fc.record({
    actNumber: actNumberArb,
    title: bengaliTextArb,
    content: bengaliTextArb,
    url: fc.constant('http://bdlaws.minlaw.gov.bd/act-details-').chain(prefix => 
      actNumberArb.map(num => `${prefix}${num}.html`)
    ),
    // volumeNumber can be present, absent, or null to test fallback behavior
    volumeNumber: fc.option(fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), {
      minLength: 1,
      maxLength: 3
    }), { nil: undefined }),
    sections: fc.record({
      counts: markerFrequencyArb
    }),
    metadata: fc.record({
      source: fc.constant('bdlaws.minlaw.gov.bd'),
      source_url: fc.webUrl(),
      scraped_at: fc.date().map(d => d.toISOString()),
      extracted_at: fc.date().map(d => d.toISOString()),
      tool: fc.constant('BDLawCorpus')
    }),
    capturedAt: fc.date().map(d => d.toISOString())
  });

  // Generator for array of captured acts
  const capturedActsArb = fc.array(capturedActArb, { minLength: 0, maxLength: 20 });

  /**
   * Property: All acts include marker_frequency object
   * METHODOLOGICAL PRINCIPLE: marker_frequency is honest naming for string occurrence counts
   */
  it('should include marker_frequency object for all acts in corpus export', () => {
    fc.assert(
      fc.property(
        capturedActsArb,
        (capturedActs) => {
          const corpus = BDLawQueue.formatCorpusExport(capturedActs, true);
          
          // Every act in the corpus should have marker_frequency as an object
          return corpus.acts.every(act => 
            act.marker_frequency !== null && 
            typeof act.marker_frequency === 'object'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: volume_number is never null
   * Requirements: 29.4
   */
  it('should never have null volume_number in corpus export', () => {
    fc.assert(
      fc.property(
        capturedActsArb,
        (capturedActs) => {
          const corpus = BDLawQueue.formatCorpusExport(capturedActs, true);
          
          // Every act in the corpus should have volume_number that is not null
          return corpus.acts.every(act => 
            act.volume_number !== null && act.volume_number !== undefined
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All required string fields are present
   */
  it('should include all required string fields for all acts', () => {
    fc.assert(
      fc.property(
        capturedActsArb,
        (capturedActs) => {
          const corpus = BDLawQueue.formatCorpusExport(capturedActs, true);
          
          return corpus.acts.every(act => 
            typeof act.act_number === 'string' &&
            typeof act.title === 'string' &&
            typeof act.content === 'string' &&
            typeof act.url === 'string' &&
            typeof act.volume_number === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Corpus export validation passes for valid exports
   */
  it('should pass validation for properly formatted corpus exports', () => {
    fc.assert(
      fc.property(
        capturedActsArb,
        (capturedActs) => {
          const corpus = BDLawQueue.formatCorpusExport(capturedActs, true);
          const validation = BDLawQueue.validateCorpusExport(corpus);
          
          return validation.valid === true && validation.errors.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Corpus export preserves act count
   */
  it('should preserve act count in corpus export', () => {
    fc.assert(
      fc.property(
        capturedActsArb,
        (capturedActs) => {
          const corpus = BDLawQueue.formatCorpusExport(capturedActs, true);
          
          return corpus.acts.length === capturedActs.length &&
                 corpus._corpus_metadata.total_acts === capturedActs.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Volume number defaults to "unknown" when not provided
   * Requirements: 29.4, 29.5
   */
  it('should default volume_number to "unknown" when not provided', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          actNumber: actNumberArb,
          title: bengaliTextArb,
          content: bengaliTextArb,
          url: fc.webUrl()
          // volumeNumber intentionally omitted
        }), { minLength: 1, maxLength: 10 }),
        (capturedActs) => {
          const corpus = BDLawQueue.formatCorpusExport(capturedActs, false);
          
          // All acts should have volume_number as "unknown"
          return corpus.acts.every(act => act.volume_number === 'unknown');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Export does NOT include structured_sections (methodological purity)
   * METHODOLOGICAL PRINCIPLE: structured_sections is semantic interpretation, not extraction
   */
  it('should NOT include structured_sections in corpus export (methodological purity)', () => {
    fc.assert(
      fc.property(
        capturedActsArb,
        (capturedActs) => {
          const corpus = BDLawQueue.formatCorpusExport(capturedActs, true);
          
          // No act should have structured_sections field
          return corpus.acts.every(act => !('structured_sections' in act));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Export does NOT include tables (methodological purity)
   * METHODOLOGICAL PRINCIPLE: tables require structural inference
   */
  it('should NOT include tables in corpus export (methodological purity)', () => {
    fc.assert(
      fc.property(
        capturedActsArb,
        (capturedActs) => {
          const corpus = BDLawQueue.formatCorpusExport(capturedActs, true);
          
          // No act should have tables field
          return corpus.acts.every(act => !('tables' in act));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Export does NOT include amendments (methodological purity)
   * METHODOLOGICAL PRINCIPLE: amendments is legal classification, not detection
   */
  it('should NOT include amendments in corpus export (methodological purity)', () => {
    fc.assert(
      fc.property(
        capturedActsArb,
        (capturedActs) => {
          const corpus = BDLawQueue.formatCorpusExport(capturedActs, true);
          
          // No act should have amendments field
          return corpus.acts.every(act => !('amendments' in act));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Export does NOT include sections_detected (renamed to marker_frequency)
   * METHODOLOGICAL PRINCIPLE: honest naming - it's marker frequency, not section count
   */
  it('should NOT include sections_detected in corpus export (renamed to marker_frequency)', () => {
    fc.assert(
      fc.property(
        capturedActsArb,
        (capturedActs) => {
          const corpus = BDLawQueue.formatCorpusExport(capturedActs, true);
          
          // No act should have sections_detected field (renamed to marker_frequency)
          return corpus.acts.every(act => !('sections_detected' in act));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: Empty captured acts array
   */
  it('should handle empty captured acts array', () => {
    const corpus = BDLawQueue.formatCorpusExport([], true);
    
    expect(corpus._corpus_metadata).toBeDefined();
    expect(corpus._corpus_metadata.total_acts).toBe(0);
    expect(corpus.acts).toEqual([]);
  });

  /**
   * Edge case: Null/undefined input
   */
  it('should handle null/undefined input gracefully', () => {
    const corpusNull = BDLawQueue.formatCorpusExport(null, true);
    const corpusUndefined = BDLawQueue.formatCorpusExport(undefined, true);
    
    expect(corpusNull.acts).toEqual([]);
    expect(corpusUndefined.acts).toEqual([]);
    expect(corpusNull._corpus_metadata.total_acts).toBe(0);
    expect(corpusUndefined._corpus_metadata.total_acts).toBe(0);
  });

  /**
   * Edge case: Invalid act objects in array
   */
  it('should handle invalid act objects gracefully', () => {
    const invalidActs = [null, undefined, {}, { actNumber: '123' }];
    const corpus = BDLawQueue.formatCorpusExport(invalidActs, false);
    
    // Should still produce valid output
    expect(corpus.acts.length).toBe(4);
    corpus.acts.forEach(act => {
      expect(typeof act.marker_frequency).toBe('object');
      expect(act.volume_number).not.toBeNull();
      expect(act.volume_number).not.toBeUndefined();
      // Should NOT have deprecated fields
      expect(act.structured_sections).toBeUndefined();
      expect(act.tables).toBeUndefined();
      expect(act.amendments).toBeUndefined();
      expect(act.sections_detected).toBeUndefined();
    });
  });
});
