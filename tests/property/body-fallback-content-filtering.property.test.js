/**
 * Property Test: Body Fallback Content Filtering
 * Feature: textual-fidelity-extraction
 * Property 9: Body Fallback Content Filtering
 * 
 * For any extraction using body as fallback selector, the extracted content SHALL NOT
 * contain text from excluded elements (header, nav, footer, sidebar, search, related-links,
 * copyright, script, style). The exclusion SHALL be applied via selector blacklist before
 * text extraction.
 * 
 * Validates: Requirements 11.5, 11.6
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

// Mock DOM implementation for testing
class MockElement {
  constructor(tagName, textContent = '', className = '') {
    this.tagName = tagName.toUpperCase();
    this._textContent = textContent;
    this.className = className;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index > -1) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  cloneNode(deep = false) {
    const clone = new MockElement(this.tagName, this._textContent, this.className);
    clone.attributes = { ...this.attributes };
    if (deep) {
      this.children.forEach(child => {
        clone.appendChild(child.cloneNode(true));
      });
    }
    return clone;
  }

  querySelectorAll(selector) {
    const results = [];
    this._findMatching(selector, results);
    return results;
  }

  querySelector(selector) {
    const results = this.querySelectorAll(selector);
    return results.length > 0 ? results[0] : null;
  }

  _findMatching(selector, results) {
    if (this._matchesSelector(selector)) {
      results.push(this);
    }
    this.children.forEach(child => {
      if (child._findMatching) {
        child._findMatching(selector, results);
      }
    });
  }

  _matchesSelector(selector) {
    // Simple selector matching for testing
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      return this.className.split(' ').includes(className);
    }
    if (selector.startsWith('#')) {
      return this.attributes.id === selector.slice(1);
    }
    if (selector.startsWith('[')) {
      const match = selector.match(/\[([^\]=]+)(?:="([^"]*)")?\]/);
      if (match) {
        const [, attr, value] = match;
        if (value !== undefined) {
          return this.attributes[attr] === value;
        }
        return this.attributes[attr] !== undefined;
      }
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  // Compute textContent from children recursively
  get textContent() {
    // If this element has direct text content, return it
    if (this._textContent) {
      return this._textContent;
    }
    // Otherwise, concatenate children's textContent
    if (this.children.length > 0) {
      return this.children.map(c => c.textContent || '').join('');
    }
    return '';
  }

  set textContent(value) {
    this._textContent = value;
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement('body');
  }

  querySelector(selector) {
    if (selector === 'body') {
      return this.body;
    }
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    if (selector === 'body') {
      return [this.body];
    }
    return this.body.querySelectorAll(selector);
  }
}

describe('Feature: textual-fidelity-extraction, Property 9: Body Fallback Content Filtering', () => {
  const { SELECTOR_HIERARCHY } = BDLawExtractor;

  // ============================================
  // Generators for test data
  // ============================================

  // Generator for excluded element types
  const excludedElementArb = fc.constantFrom(
    { tag: 'header', class: '', text: 'Header Navigation Content' },
    { tag: 'nav', class: '', text: 'Navigation Menu Items' },
    { tag: 'footer', class: '', text: 'Footer Copyright Info' },
    { tag: 'aside', class: '', text: 'Sidebar Content' },
    { tag: 'div', class: 'sidebar', text: 'Sidebar Widget' },
    { tag: 'div', class: 'navigation', text: 'Navigation Links' },
    { tag: 'div', class: 'menu', text: 'Menu Items' },
    { tag: 'div', class: 'search', text: 'Search Box' },
    { tag: 'div', class: 'search-box', text: 'Search Input' },
    { tag: 'div', class: 'related-links', text: 'Related Articles' },
    { tag: 'div', class: 'breadcrumb', text: 'Home > Category > Page' },
    { tag: 'div', class: 'copyright', text: 'Copyright 2024' },
    { tag: 'script', class: '', text: 'console.log("script")' },
    { tag: 'style', class: '', text: '.class { color: red; }' },
    { tag: 'noscript', class: '', text: 'JavaScript required' }
  );

  // Generator for Bengali legal content
  const bengaliLegalContentArb = fc.constantFrom(
    'ধারা ১। এই আইন বাংলাদেশ আইন নামে পরিচিত হইবে।',
    'অধ্যায় ১ - প্রারম্ভিক',
    'তফসিল - প্রথম তফসিল',
    '১৷ এই আইনের নাম',
    'যেহেতু এই আইন প্রণয়ন করা সমীচীন',
    'সেহেতু এতদ্বারা আইন করা হইল'
  );

  // Generator for English legal content
  const englishLegalContentArb = fc.constantFrom(
    'Section 1. Short title and commencement.',
    'Chapter I - Preliminary',
    'Schedule - First Schedule',
    'WHEREAS it is expedient to make provision',
    'Be it enacted by Parliament'
  );

  // ============================================
  // Property Tests
  // ============================================

  test('body fallback exclusions SHALL include all required element types', () => {
    const requiredExclusions = [
      'header',
      'nav',
      'footer',
      'aside',
      '.sidebar',
      '.navigation',
      '.menu',
      '.search',
      '.search-box',
      '.related-links',
      '.breadcrumb',
      '.copyright',
      'script',
      'style',
      'noscript'
    ];

    // Requirements 11.5, 11.6 - Exclusion list must include all required elements
    requiredExclusions.forEach(exclusion => {
      expect(SELECTOR_HIERARCHY.bodyFallback.exclusions).toContain(exclusion);
    });
  });

  test('_tryBodyFallback SHALL exclude header elements from extracted content', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentArb,
        fc.constant('Header Navigation Content'),
        (legalContent, headerContent) => {
          const doc = new MockDocument();
          
          // Add header element (should be excluded)
          const header = new MockElement('header', headerContent);
          doc.body.appendChild(header);
          
          // Add legal content element
          const content = new MockElement('div', legalContent, 'legal-content');
          doc.body.appendChild(content);
          
          const result = BDLawExtractor._tryBodyFallback(doc, 0);
          
          // Requirements 11.5 - Header content should be excluded
          expect(result.content).not.toContain(headerContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('_tryBodyFallback SHALL exclude nav elements from extracted content', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentArb,
        fc.constant('Navigation Menu Items'),
        (legalContent, navContent) => {
          const doc = new MockDocument();
          
          // Add nav element (should be excluded)
          const nav = new MockElement('nav', navContent);
          doc.body.appendChild(nav);
          
          // Add legal content element
          const content = new MockElement('div', legalContent, 'legal-content');
          doc.body.appendChild(content);
          
          const result = BDLawExtractor._tryBodyFallback(doc, 0);
          
          // Requirements 11.5 - Nav content should be excluded
          expect(result.content).not.toContain(navContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('_tryBodyFallback SHALL exclude footer elements from extracted content', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentArb,
        fc.constant('Footer Copyright Info'),
        (legalContent, footerContent) => {
          const doc = new MockDocument();
          
          // Add footer element (should be excluded)
          const footer = new MockElement('footer', footerContent);
          doc.body.appendChild(footer);
          
          // Add legal content element
          const content = new MockElement('div', legalContent, 'legal-content');
          doc.body.appendChild(content);
          
          const result = BDLawExtractor._tryBodyFallback(doc, 0);
          
          // Requirements 11.5 - Footer content should be excluded
          expect(result.content).not.toContain(footerContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('_tryBodyFallback SHALL exclude sidebar elements from extracted content', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentArb,
        fc.constant('Sidebar Widget Content'),
        (legalContent, sidebarContent) => {
          const doc = new MockDocument();
          
          // Add sidebar element (should be excluded)
          const sidebar = new MockElement('div', sidebarContent, 'sidebar');
          doc.body.appendChild(sidebar);
          
          // Add legal content element
          const content = new MockElement('div', legalContent, 'legal-content');
          doc.body.appendChild(content);
          
          const result = BDLawExtractor._tryBodyFallback(doc, 0);
          
          // Requirements 11.5 - Sidebar content should be excluded
          expect(result.content).not.toContain(sidebarContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('_tryBodyFallback SHALL exclude script and style elements from extracted content', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentArb,
        (legalContent) => {
          const doc = new MockDocument();
          
          // Add script element (should be excluded)
          const script = new MockElement('script', 'console.log("test")');
          doc.body.appendChild(script);
          
          // Add style element (should be excluded)
          const style = new MockElement('style', '.class { color: red; }');
          doc.body.appendChild(style);
          
          // Add legal content element
          const content = new MockElement('div', legalContent, 'legal-content');
          doc.body.appendChild(content);
          
          const result = BDLawExtractor._tryBodyFallback(doc, 0);
          
          // Requirements 11.6 - Script and style content should be excluded
          expect(result.content).not.toContain('console.log');
          expect(result.content).not.toContain('color: red');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('_tryBodyFallback SHALL preserve legal content after exclusion filtering', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentArb,
        (legalContent) => {
          const doc = new MockDocument();
          
          // Add excluded elements
          const header = new MockElement('header', 'Header Content');
          doc.body.appendChild(header);
          
          const nav = new MockElement('nav', 'Navigation');
          doc.body.appendChild(nav);
          
          // Add legal content element
          const content = new MockElement('div', legalContent, 'legal-content');
          doc.body.appendChild(content);
          
          const footer = new MockElement('footer', 'Footer Content');
          doc.body.appendChild(footer);
          
          const result = BDLawExtractor._tryBodyFallback(doc, 0);
          
          // Requirements 11.5, 11.6 - Legal content should be preserved
          expect(result.content).toContain(legalContent);
          expect(result.hasLegalSignal).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('_tryBodyFallback SHALL return hasLegalSignal: false when no legal markers present', () => {
    fc.assert(
      fc.property(
        fc.constant('This is just regular text without any legal markers'),
        (nonLegalContent) => {
          const doc = new MockDocument();
          
          // Add non-legal content
          const content = new MockElement('div', nonLegalContent, 'content');
          doc.body.appendChild(content);
          
          const result = BDLawExtractor._tryBodyFallback(doc, 0);
          
          // Requirements 11.4 - Should detect lack of legal signal
          expect(result.hasLegalSignal).toBe(false);
          expect(result.extraction_success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('_tryBodyFallback SHALL record body selector in selectors_attempted', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentArb,
        fc.integer({ min: 0, max: 10 }),
        (legalContent, startOrder) => {
          const doc = new MockDocument();
          
          // Add legal content
          const content = new MockElement('div', legalContent, 'legal-content');
          doc.body.appendChild(content);
          
          const result = BDLawExtractor._tryBodyFallback(doc, startOrder);
          
          // Requirements 11.2 - Body selector should be recorded
          expect(result.selectors_attempted.length).toBe(1);
          expect(result.selectors_attempted[0].selector).toBe('body');
          expect(result.selectors_attempted[0].attempt_order).toBe(startOrder);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('_tryBodyFallback SHALL set extraction_method to body_fallback on success', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentArb,
        (legalContent) => {
          const doc = new MockDocument();
          
          // Add legal content
          const content = new MockElement('div', legalContent, 'legal-content');
          doc.body.appendChild(content);
          
          const result = BDLawExtractor._tryBodyFallback(doc, 0);
          
          // Requirements 4.6 - extraction_method should be body_fallback
          expect(result.extraction_method).toBe('body_fallback');
          expect(result.successful_selector).toBe('body');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('_tryBodyFallback SHALL NOT modify the original DOM', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentArb,
        (legalContent) => {
          const doc = new MockDocument();
          
          // Add header (should be excluded in extraction but preserved in DOM)
          const header = new MockElement('header', 'Header Content');
          doc.body.appendChild(header);
          
          // Add legal content
          const content = new MockElement('div', legalContent, 'legal-content');
          doc.body.appendChild(content);
          
          // Count children before extraction
          const childCountBefore = doc.body.children.length;
          
          // Perform extraction
          BDLawExtractor._tryBodyFallback(doc, 0);
          
          // Requirements 6.6 - Original DOM should not be modified
          expect(doc.body.children.length).toBe(childCountBefore);
          expect(doc.body.children[0].tagName).toBe('HEADER');
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Edge Cases
  // ============================================

  test('_tryBodyFallback handles null document', () => {
    const result = BDLawExtractor._tryBodyFallback(null, 0);
    
    expect(result.content).toBe('');
    expect(result.extraction_success).toBe(false);
    expect(result.selectors_attempted).toEqual([]);
  });

  test('_tryBodyFallback handles document without body', () => {
    const doc = { body: null };
    const result = BDLawExtractor._tryBodyFallback(doc, 0);
    
    expect(result.content).toBe('');
    expect(result.extraction_success).toBe(false);
  });

  test('_tryBodyFallback handles empty body', () => {
    const doc = new MockDocument();
    // Body is empty
    
    const result = BDLawExtractor._tryBodyFallback(doc, 0);
    
    expect(result.content).toBe('');
    expect(result.extraction_success).toBe(false);
  });

  test('_tryAllSelectorsWithFallback includes body fallback in pipeline', () => {
    const doc = new MockDocument();
    
    // Add legal content directly to body (no matching primary/fallback selectors)
    const content = new MockElement('div', 'ধারা ১। এই আইন', 'random-class');
    doc.body.appendChild(content);
    
    const result = BDLawExtractor._tryAllSelectorsWithFallback(doc, 'content');
    
    // Should have tried primary, fallback, and body selectors
    expect(result.selectors_attempted.length).toBeGreaterThan(0);
    
    // Body selector should be in the attempts
    const bodyAttempt = result.selectors_attempted.find(a => a.selector === 'body');
    expect(bodyAttempt).toBeDefined();
  });

  test('multiple excluded elements are all filtered', () => {
    const doc = new MockDocument();
    
    // Add multiple excluded elements
    const excludedElements = [
      new MockElement('header', 'Header'),
      new MockElement('nav', 'Nav'),
      new MockElement('footer', 'Footer'),
      new MockElement('div', 'Sidebar', 'sidebar'),
      new MockElement('div', 'Search', 'search'),
      new MockElement('script', 'Script'),
      new MockElement('style', 'Style')
    ];
    
    excludedElements.forEach(el => doc.body.appendChild(el));
    
    // Add legal content
    const content = new MockElement('div', 'ধারা ১। এই আইন', 'legal');
    doc.body.appendChild(content);
    
    const result = BDLawExtractor._tryBodyFallback(doc, 0);
    
    // All excluded content should be filtered
    expect(result.content).not.toContain('Header');
    expect(result.content).not.toContain('Nav');
    expect(result.content).not.toContain('Footer');
    expect(result.content).not.toContain('Sidebar');
    expect(result.content).not.toContain('Search');
    expect(result.content).not.toContain('Script');
    expect(result.content).not.toContain('Style');
    
    // Legal content should be preserved
    expect(result.content).toContain('ধারা');
  });
});
