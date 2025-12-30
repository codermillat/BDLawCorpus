/**
 * Property-Based Tests for Export JSON Round-Trip
 * 
 * Feature: bdlawcorpus-mode, Property 6: Export JSON Round-Trip
 * Validates: Requirements 12.1, 12.5
 * 
 * Property: For any valid act content and metadata, formatting as JSON
 * and then parsing SHALL produce an equivalent object structure
 */

const fc = require('fast-check');
const BDLawExport = require('../../bdlaw-export.js');
const BDLawMetadata = require('../../bdlaw-metadata.js');

describe('Property 6: Export JSON Round-Trip', () => {
  const ALLOWED_ORIGIN = 'http://bdlaws.minlaw.gov.bd';

  /**
   * Generator for Bengali text content (including section markers)
   */
  const bengaliTextArb = fc.array(
    fc.oneof(
      fc.constant('ধারা ১। এই আইন'),
      fc.constant('অধ্যায় ২'),
      fc.constant('তফসিল'),
      fc.constant('বাংলাদেশ আইন'),
      fc.constant('সংবিধান'),
      fc.unicodeString({ minLength: 0, maxLength: 100 })
    ),
    { minLength: 0, maxLength: 10 }
  ).map(arr => arr.join('\n'));

  /**
   * Generator for act content objects
   */
  const actContentArb = fc.record({
    title: fc.oneof(
      fc.constant('বাংলাদেশ শ্রম আইন'),
      fc.constant('দণ্ডবিধি'),
      fc.unicodeString({ minLength: 0, maxLength: 100 })
    ),
    content: bengaliTextArb,
    sections: fc.record({
      counts: fc.record({
        'ধারা': fc.nat({ max: 100 }),
        'অধ্যায়': fc.nat({ max: 20 }),
        'তফসিল': fc.nat({ max: 10 })
      })
    })
  });

  /**
   * Generator for act numbers
   */
  const actNumberArb = fc.stringMatching(/^[0-9]{1,6}$/);

  /**
   * Generator for valid bdlaws act URLs
   */
  const actUrlArb = actNumberArb.map(num => `${ALLOWED_ORIGIN}/act-details-${num}.html`);

  /**
   * Property: Act export JSON round-trip preserves structure
   * For any valid act content and metadata, JSON.parse(formatActExport(...)) 
   * should produce an equivalent object
   */
  it('should preserve act export structure through JSON round-trip', () => {
    fc.assert(
      fc.property(
        actContentArb,
        actUrlArb,
        (content, url) => {
          const metadata = BDLawMetadata.generate(url);
          const jsonString = BDLawExport.formatActExport(content, metadata);
          
          // Validate JSON is well-formed
          if (!BDLawExport.validateJSON(jsonString)) {
            return false;
          }
          
          // Parse and verify structure
          const parsed = JSON.parse(jsonString);
          
          // Check required fields exist
          if (!parsed._metadata) return false;
          if (!('title' in parsed)) return false;
          if (!('act_number' in parsed)) return false;
          if (!('content' in parsed)) return false;
          if (!('sections_detected' in parsed)) return false;
          
          // Check metadata is preserved
          if (parsed._metadata.source_url !== url) return false;
          if (parsed._metadata.tool !== 'BDLawCorpus') return false;
          
          // Check content is preserved (string equality)
          if (parsed.title !== (content.title || '')) return false;
          if (parsed.content !== (content.content || '')) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Volume export JSON round-trip preserves structure
   */
  it('should preserve volume export structure through JSON round-trip', () => {
    const volumeNumberArb = fc.stringMatching(/^[0-9]{1,3}$/);
    const volumeUrlArb = volumeNumberArb.map(num => `${ALLOWED_ORIGIN}/volume-${num}.html`);
    
    const actEntryArb = fc.record({
      title: fc.unicodeString({ minLength: 0, maxLength: 100 }),
      year: fc.stringMatching(/^[0-9]{4}$/),
      actNumber: fc.stringMatching(/^[0-9]{1,6}$/),
      url: actUrlArb
    });
    
    const actsArrayArb = fc.array(actEntryArb, { minLength: 0, maxLength: 20 });

    fc.assert(
      fc.property(
        actsArrayArb,
        volumeUrlArb,
        (acts, url) => {
          const metadata = BDLawMetadata.generate(url);
          const jsonString = BDLawExport.formatVolumeExport(acts, metadata);
          
          // Validate JSON is well-formed
          if (!BDLawExport.validateJSON(jsonString)) {
            return false;
          }
          
          // Parse and verify structure
          const parsed = JSON.parse(jsonString);
          
          // Check required fields exist
          if (!parsed._metadata) return false;
          if (!('volume_number' in parsed)) return false;
          if (!Array.isArray(parsed.acts)) return false;
          if (!('total_count' in parsed)) return false;
          
          // Check metadata is preserved
          if (parsed._metadata.source_url !== url) return false;
          
          // Check acts count matches
          if (parsed.total_count !== acts.length) return false;
          if (parsed.acts.length !== acts.length) return false;
          
          // Check each act entry is preserved
          for (let i = 0; i < acts.length; i++) {
            const original = acts[i];
            const parsed_act = parsed.acts[i];
            
            if (parsed_act.title !== (original.title || '')) return false;
            if (parsed_act.year !== (original.year || '')) return false;
            if (parsed_act.url !== (original.url || '')) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: JSON output is always valid JSON
   */
  it('should always produce valid JSON for any input', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        fc.anything(),
        (content, metadata) => {
          // formatActExport should handle any input gracefully
          const jsonString = BDLawExport.formatActExport(content, metadata);
          return BDLawExport.validateJSON(jsonString);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali characters are preserved through round-trip
   */
  it('should preserve Bengali characters through JSON round-trip', () => {
    const bengaliStrings = [
      'ধারা',
      'অধ্যায়',
      'তফসিল',
      'বাংলাদেশ',
      'আইন',
      'সংবিধান',
      'দণ্ডবিধি'
    ];
    
    const bengaliContentArb = fc.record({
      title: fc.constantFrom(...bengaliStrings),
      content: fc.array(fc.constantFrom(...bengaliStrings), { minLength: 1, maxLength: 5 })
        .map(arr => arr.join(' ')),
      sections: fc.record({
        counts: fc.record({
          'ধারা': fc.nat({ max: 10 }),
          'অধ্যায়': fc.nat({ max: 5 }),
          'তফসিল': fc.nat({ max: 3 })
        })
      })
    });

    fc.assert(
      fc.property(
        bengaliContentArb,
        actUrlArb,
        (content, url) => {
          const metadata = BDLawMetadata.generate(url);
          const jsonString = BDLawExport.formatActExport(content, metadata);
          const parsed = JSON.parse(jsonString);
          
          // Bengali title should be preserved exactly
          if (parsed.title !== content.title) return false;
          
          // Bengali content should be preserved exactly
          if (parsed.content !== content.content) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Double round-trip produces identical output
   */
  it('should produce identical output on double round-trip', () => {
    fc.assert(
      fc.property(
        actContentArb,
        actUrlArb,
        (content, url) => {
          const metadata = BDLawMetadata.generate(url);
          
          // First round-trip
          const json1 = BDLawExport.formatActExport(content, metadata);
          const parsed1 = JSON.parse(json1);
          
          // Second round-trip (using parsed content)
          const json2 = BDLawExport.formatActExport(
            { 
              title: parsed1.title, 
              content: parsed1.content, 
              sections: { counts: parsed1.sections_detected } 
            },
            parsed1._metadata
          );
          const parsed2 = JSON.parse(json2);
          
          // Content should be identical
          return (
            parsed1.title === parsed2.title &&
            parsed1.content === parsed2.content &&
            parsed1.act_number === parsed2.act_number
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
