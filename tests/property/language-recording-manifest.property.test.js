/**
 * Property-Based Tests for Language Recording in Manifest
 * 
 * Feature: cross-reference-extraction, Property 17: Language Recording in Manifest
 * Validates: Requirements 11.6
 * 
 * For any extracted act, the manifest SHALL record the content_language field.
 */

const fc = require('fast-check');
const BDLawCorpusManifest = require('../../bdlaw-corpus-manifest.js');

describe('Property 17: Language Recording in Manifest', () => {
  // Generator for valid internal IDs (numeric strings)
  const internalIdGen = fc.integer({ min: 1, max: 9999 }).map(n => n.toString());

  // Generator for volume numbers
  const volumeNumberGen = fc.integer({ min: 1, max: 50 }).map(n => n.toString());

  // Generator for act titles
  const titleGen = fc.string({ minLength: 5, maxLength: 50 });

  // Generator for content (random text)
  const contentGen = fc.string({ minLength: 100, maxLength: 1000 });

  // Generator for language
  const languageGen = fc.constantFrom('bengali', 'english');

  // Generator for an act object with language
  const actWithLanguageGen = fc.record({
    internal_id: internalIdGen,
    title: titleGen,
    volume_number: volumeNumberGen,
    content: contentGen,
    content_language: languageGen,
    capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()),
    cross_reference_count: fc.integer({ min: 0, max: 20 })
  });

  // Generator for an act object without language
  const actWithoutLanguageGen = fc.record({
    internal_id: internalIdGen,
    title: titleGen,
    volume_number: volumeNumberGen,
    content: contentGen,
    capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()),
    cross_reference_count: fc.integer({ min: 0, max: 20 })
  });

  /**
   * Property: content_language is recorded in manifest when provided
   * Requirements: 11.6
   */
  it('should record content_language in manifest when provided', () => {
    fc.assert(
      fc.property(
        actWithLanguageGen,
        (act) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          
          const entry = manifest.acts[act.internal_id];
          
          return entry !== undefined &&
                 entry.content_language === act.content_language;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_language defaults to 'english' when not provided
   * Requirements: 11.6
   */
  it('should default content_language to english when not provided', () => {
    fc.assert(
      fc.property(
        actWithoutLanguageGen,
        (act) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          
          const entry = manifest.acts[act.internal_id];
          
          return entry !== undefined &&
                 entry.content_language === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali language is preserved correctly
   * Requirements: 11.6
   */
  it('should preserve Bengali language correctly', () => {
    fc.assert(
      fc.property(
        internalIdGen,
        volumeNumberGen,
        titleGen,
        contentGen,
        (internalId, volumeNumber, title, content) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          const bengaliAct = {
            internal_id: internalId,
            title: title,
            volume_number: volumeNumber,
            content: content,
            content_language: 'bengali',
            capturedAt: new Date().toISOString()
          };
          
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, bengaliAct);
          
          const entry = manifest.acts[internalId];
          
          return entry.content_language === 'bengali';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: English language is preserved correctly
   * Requirements: 11.6
   */
  it('should preserve English language correctly', () => {
    fc.assert(
      fc.property(
        internalIdGen,
        volumeNumberGen,
        titleGen,
        contentGen,
        (internalId, volumeNumber, title, content) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          const englishAct = {
            internal_id: internalId,
            title: title,
            volume_number: volumeNumber,
            content: content,
            content_language: 'english',
            capturedAt: new Date().toISOString()
          };
          
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, englishAct);
          
          const entry = manifest.acts[internalId];
          
          return entry.content_language === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Language is updated when act is re-extracted
   * Requirements: 11.6
   */
  it('should update language when act is re-extracted via forceReExtraction', () => {
    fc.assert(
      fc.property(
        internalIdGen,
        volumeNumberGen,
        titleGen,
        contentGen,
        (internalId, volumeNumber, title, content) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // First add English version
          const englishAct = {
            internal_id: internalId,
            title: title,
            volume_number: volumeNumber,
            content: content,
            content_language: 'english',
            capturedAt: new Date().toISOString()
          };
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, englishAct);
          
          // Then force re-extract with Bengali
          const bengaliAct = {
            internal_id: internalId,
            title: title + ' (Bengali)',
            volume_number: volumeNumber,
            content: content,
            content_language: 'bengali',
            capturedAt: new Date().toISOString()
          };
          manifest = BDLawCorpusManifest.forceReExtraction(manifest, internalId, bengaliAct);
          
          const entry = manifest.acts[internalId];
          
          return entry.content_language === 'bengali';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple acts can have different languages
   * Requirements: 11.6
   */
  it('should support multiple acts with different languages', () => {
    fc.assert(
      fc.property(
        fc.array(actWithLanguageGen, { minLength: 2, maxLength: 10 }),
        (acts) => {
          // Ensure unique internal_ids
          const uniqueActs = acts.reduce((acc, act) => {
            if (!acc.find(a => a.internal_id === act.internal_id)) {
              acc.push(act);
            }
            return acc;
          }, []);
          
          if (uniqueActs.length < 2) return true; // Skip if not enough unique acts
          
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          for (const act of uniqueActs) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Verify each act has its correct language
          return uniqueActs.every(act => {
            const entry = manifest.acts[act.internal_id];
            return entry && entry.content_language === act.content_language;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_language field exists in all manifest entries
   * Requirements: 11.6
   */
  it('should ensure content_language field exists in all manifest entries', () => {
    fc.assert(
      fc.property(
        fc.array(actWithLanguageGen, { minLength: 1, maxLength: 5 }),
        (acts) => {
          // Ensure unique internal_ids
          const uniqueActs = acts.reduce((acc, act) => {
            if (!acc.find(a => a.internal_id === act.internal_id)) {
              acc.push(act);
            }
            return acc;
          }, []);
          
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          for (const act of uniqueActs) {
            manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, act);
          }
          
          // Verify all entries have content_language field
          return Object.values(manifest.acts).every(entry => 
            entry.content_language !== undefined &&
            (entry.content_language === 'bengali' || entry.content_language === 'english')
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Language is preserved in version history
   * Requirements: 11.6
   */
  it('should preserve language in version history', () => {
    fc.assert(
      fc.property(
        internalIdGen,
        volumeNumberGen,
        titleGen,
        contentGen,
        (internalId, volumeNumber, title, content) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add English version
          const englishAct = {
            internal_id: internalId,
            title: title,
            volume_number: volumeNumber,
            content: content,
            content_language: 'english',
            capturedAt: new Date().toISOString()
          };
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, englishAct);
          
          // Force re-extract with Bengali
          const bengaliAct = {
            internal_id: internalId,
            title: title + ' (Bengali)',
            volume_number: volumeNumber,
            content: content,
            content_language: 'bengali',
            capturedAt: new Date().toISOString()
          };
          manifest = BDLawCorpusManifest.forceReExtraction(manifest, internalId, bengaliAct);
          
          // Check version history contains the original English entry
          const history = manifest.version_history[internalId];
          
          return history !== undefined &&
                 history.length === 1 &&
                 history[0].content_language === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });
});
