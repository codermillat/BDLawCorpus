/**
 * BDLawCorpus Popup Script
 * 
 * Integrates page detector, metadata generator, legal extractor, and export handler
 * for academic legal text extraction from bdlaws.minlaw.gov.bd.
 * 
 * Requirements: 2.5, 3.1-3.3, 4.1-4.3, 5.1-5.6, 6.1-6.3, 9.1-9.6, 15.1-15.5
 */
(function() {
  'use strict';

  // ============================================
  // DOM ELEMENT REFERENCES
  // ============================================
  function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) console.warn(`Element not found: ${id}`);
    return element;
  }

  const elements = {
    // Domain and page type indicators
    get domainNotice() { return safeGetElement('domainNotice'); },
    get domainMessage() { return safeGetElement('domainMessage'); },
    get pageTypeIndicator() { return safeGetElement('pageTypeIndicator'); },
    get pageTypeIcon() { return safeGetElement('pageTypeIcon'); },
    get pageTypeLabel() { return safeGetElement('pageTypeLabel'); },
    get pageTypeLayer() { return safeGetElement('pageTypeLayer'); },
    
    // Workflow steps
    get step1() { return safeGetElement('step1'); },
    get step2() { return safeGetElement('step2'); },
    get step3() { return safeGetElement('step3'); },
    
    // Help section
    get helpMessage() { return safeGetElement('helpMessage'); },
    
    // Extraction controls
    get extractionControls() { return safeGetElement('extractionControls'); },
    get extractBtn() { return safeGetElement('extractBtn'); },
    get extractBtnLabel() { return safeGetElement('extractBtnLabel'); },
    
    // Content preview
    get contentDiv() { return safeGetElement('contentDiv'); },
    get extractedText() { return safeGetElement('extractedText'); },
    get lineNumbers() { return safeGetElement('lineNumbers'); },
    get charCount() { return safeGetElement('charCount'); },
    get wordCount() { return safeGetElement('wordCount'); },
    get lineCount() { return safeGetElement('lineCount'); },
    
    // Section markers
    get sectionMarkersSection() { return safeGetElement('sectionMarkersSection'); },
    get dharaCount() { return safeGetElement('dharaCount'); },
    get adhyayCount() { return safeGetElement('adhyayCount'); },
    get tofsilCount() { return safeGetElement('tofsilCount'); },
    
    // Metadata preview
    get metadataSection() { return safeGetElement('metadataSection'); },
    get metadataToggle() { return safeGetElement('metadataToggle'); },
    get metadataContent() { return safeGetElement('metadataContent'); },
    get metadataCollapseIcon() { return safeGetElement('metadataCollapseIcon'); },
    get metaSource() { return safeGetElement('metaSource'); },
    get metaSourceUrl() { return safeGetElement('metaSourceUrl'); },
    get metaScrapedAt() { return safeGetElement('metaScrapedAt'); },
    
    // Technical section
    get technicalToggle() { return safeGetElement('technicalToggle'); },
    get technicalContent() { return safeGetElement('technicalContent'); },
    
    // Actions
    get actionsDiv() { return safeGetElement('actionsDiv'); },
    get saveBtn() { return safeGetElement('saveBtn'); },
    get copyBtn() { return safeGetElement('copyBtn'); },
    get clearBtn() { return safeGetElement('clearBtn'); },
    
    // Views
    get loadingDiv() { return safeGetElement('loadingDiv'); },
    get loadingText() { return safeGetElement('loadingText'); },
    get errorDiv() { return safeGetElement('errorDiv'); },
    get errorMessage() { return safeGetElement('errorMessage'); },
    get welcomeDiv() { return safeGetElement('welcomeDiv'); }
  };

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const state = {
    currentUrl: '',
    currentTitle: '',
    pageType: null,
    layerNumber: null,
    extractionAllowed: false,
    extractionType: 'none', // 'none', 'catalog', 'content'
    extractedContent: null,
    metadata: null,
    sectionCounts: { 'ধারা': 0, 'অধ্যায়': 0, 'তফসিল': 0 },
    workflowStep: 0,
    isExtracting: false
  };

  // ============================================
  // LOGGER UTILITY
  // ============================================
  const Logger = {
    error: (message, error, context = {}) => {
      console.error('BDLawCorpus Error:', {
        timestamp: new Date().toISOString(),
        message,
        error: error?.message || error,
        stack: error?.stack,
        context
      });
    },
    warn: (message, context = {}) => console.warn('BDLawCorpus Warning:', { message, context }),
    info: (message, context = {}) => console.info('BDLawCorpus Info:', { message, context })
  };

  // ============================================
  // VIEW MANAGEMENT
  // ============================================
  function showView(view) {
    const views = ['loading', 'error', 'content', 'welcome'];
    views.forEach(v => {
      const el = document.getElementById(v + 'Div');
      if (el) el.classList.toggle('hidden', v !== view);
    });
  }

  function showError(message) {
    if (elements.errorMessage) elements.errorMessage.textContent = message || 'An unknown error occurred';
    showView('error');
  }

  function showLoading(message = 'Processing...') {
    if (elements.loadingText) elements.loadingText.textContent = message;
    showView('loading');
  }


  // ============================================
  // PAGE TYPE DETECTION AND UI STATE
  // Requirements: 2.5, 3.1-3.3, 4.1-4.3, 5.1-5.3, 6.1-6.3
  // ============================================
  
  /**
   * Detect page type and update UI state accordingly
   */
  async function detectAndUpdatePageType() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        updateUIForInvalidDomain();
        return;
      }

      state.currentUrl = tab.url;
      state.currentTitle = tab.title || '';
      
      // Use BDLawPageDetector to detect page type
      state.pageType = BDLawPageDetector.detectPageType(state.currentUrl);
      state.layerNumber = BDLawPageDetector.getLayerNumber(state.pageType);
      
      Logger.info('Page type detected', { 
        url: state.currentUrl, 
        pageType: state.pageType, 
        layer: state.layerNumber 
      });

      // Update UI based on page type
      updatePageTypeIndicator();
      updateWorkflowSteps();
      updateHelpText();
      updateExtractionControls();
      updateDomainNotice();
      
    } catch (error) {
      Logger.error('Failed to detect page type', error);
      updateUIForInvalidDomain();
    }
  }

  /**
   * Update the page type indicator UI
   * Requirements: 13.1-13.6
   */
  function updatePageTypeIndicator() {
    const indicator = elements.pageTypeIndicator;
    if (!indicator) return;

    // Remove all page type classes
    indicator.classList.remove('range-index', 'volume', 'act-details', 'act-summary', 'unsupported', 'invalid-domain');

    const PAGE_TYPES = BDLawPageDetector.PAGE_TYPES;
    let icon = '⚠️';
    let label = 'Unknown Page';
    let layerText = '';
    let cssClass = 'unsupported';

    switch (state.pageType) {
      case PAGE_TYPES.RANGE_INDEX:
        icon = '📚';
        label = 'Range Index';
        layerText = 'Layer 1 - Navigation';
        cssClass = 'range-index';
        break;
      case PAGE_TYPES.VOLUME:
        icon = '📖';
        label = 'Volume Index';
        layerText = 'Layer 2 - Act Catalog';
        cssClass = 'volume';
        break;
      case PAGE_TYPES.ACT_DETAILS:
        icon = '📄';
        label = 'Act Details';
        layerText = 'Layer 3 - Full Content';
        cssClass = 'act-details';
        break;
      case PAGE_TYPES.ACT_SUMMARY:
        icon = '🔗';
        label = 'Act Summary';
        layerText = 'Navigate to Details';
        cssClass = 'act-summary';
        break;
      case PAGE_TYPES.INVALID_DOMAIN:
        icon = '🚫';
        label = 'Invalid Domain';
        layerText = 'Not bdlaws.minlaw.gov.bd';
        cssClass = 'invalid-domain';
        break;
      default:
        icon = '⚠️';
        label = 'Unsupported Page';
        layerText = 'Cannot extract from this page';
        cssClass = 'unsupported';
    }

    indicator.classList.add(cssClass);
    if (elements.pageTypeIcon) elements.pageTypeIcon.textContent = icon;
    if (elements.pageTypeLabel) elements.pageTypeLabel.textContent = label;
    if (elements.pageTypeLayer) elements.pageTypeLayer.textContent = layerText;
  }

  /**
   * Update workflow step highlighting
   * Requirements: 14.1-14.3
   */
  function updateWorkflowSteps() {
    const steps = [elements.step1, elements.step2, elements.step3];
    
    // Reset all steps
    steps.forEach(step => {
      if (step) {
        step.classList.remove('active', 'completed');
      }
    });

    const PAGE_TYPES = BDLawPageDetector.PAGE_TYPES;
    
    switch (state.pageType) {
      case PAGE_TYPES.RANGE_INDEX:
        state.workflowStep = 1;
        if (elements.step1) elements.step1.classList.add('active');
        break;
      case PAGE_TYPES.VOLUME:
        state.workflowStep = 2;
        if (elements.step1) elements.step1.classList.add('completed');
        if (elements.step2) elements.step2.classList.add('active');
        break;
      case PAGE_TYPES.ACT_DETAILS:
        state.workflowStep = 3;
        if (elements.step1) elements.step1.classList.add('completed');
        if (elements.step2) elements.step2.classList.add('completed');
        if (elements.step3) elements.step3.classList.add('active');
        break;
      default:
        state.workflowStep = 0;
    }
  }

  /**
   * Update contextual help text based on page type
   * Requirements: 3.2, 4.3, 5.3, 6.2, 14.5
   */
  function updateHelpText() {
    const helpEl = elements.helpMessage;
    if (!helpEl) return;

    const PAGE_TYPES = BDLawPageDetector.PAGE_TYPES;
    let message = 'Navigate to bdlaws.minlaw.gov.bd to begin extracting legal texts.';

    switch (state.pageType) {
      case PAGE_TYPES.RANGE_INDEX:
        // Requirement 3.2
        message = 'Navigation Page: Browse to a Volume page to see available acts.';
        break;
      case PAGE_TYPES.VOLUME:
        // Requirement 4.3
        message = 'Volume Index: Extract act catalog for this volume. Click "Extract Catalog" to get metadata for all acts listed.';
        break;
      case PAGE_TYPES.ACT_DETAILS:
        // Requirement 5.3
        message = 'Act Detail: Extract full legal text. Click "Extract Content" to capture the complete Bengali legal text.';
        break;
      case PAGE_TYPES.ACT_SUMMARY:
        // Requirement 6.2
        message = "Navigate to 'View Details' or 'বিস্তারিত দেখুন' for full text extraction.";
        break;
      case PAGE_TYPES.INVALID_DOMAIN:
        message = 'This tool only works on bdlaws.minlaw.gov.bd. Please navigate to the official Bangladesh Laws website.';
        break;
      default:
        message = 'This page type is not supported for extraction. Navigate to a Volume or Act Details page.';
    }

    helpEl.textContent = message;
  }

  /**
   * Update extraction controls based on page type
   * Requirements: 3.1, 4.2, 5.1, 6.3
   */
  function updateExtractionControls() {
    const PAGE_TYPES = BDLawPageDetector.PAGE_TYPES;
    
    // Determine extraction capability
    state.extractionAllowed = false;
    state.extractionType = 'none';
    let buttonLabel = 'Extract Content';
    let buttonEnabled = false;

    switch (state.pageType) {
      case PAGE_TYPES.RANGE_INDEX:
        // Requirement 3.1 - Disable all content extraction
        state.extractionAllowed = false;
        state.extractionType = 'none';
        buttonLabel = 'No Extraction Available';
        buttonEnabled = false;
        break;
      case PAGE_TYPES.VOLUME:
        // Requirement 4.1, 4.2 - Allow catalog extraction only
        state.extractionAllowed = true;
        state.extractionType = 'catalog';
        buttonLabel = 'Extract Catalog';
        buttonEnabled = true;
        break;
      case PAGE_TYPES.ACT_DETAILS:
        // Requirement 5.1 - Enable full content extraction
        state.extractionAllowed = true;
        state.extractionType = 'content';
        buttonLabel = 'Extract Content';
        buttonEnabled = true;
        break;
      case PAGE_TYPES.ACT_SUMMARY:
        // Requirement 6.3 - Disable extraction
        state.extractionAllowed = false;
        state.extractionType = 'none';
        buttonLabel = 'Navigate to Details First';
        buttonEnabled = false;
        break;
      default:
        state.extractionAllowed = false;
        state.extractionType = 'none';
        buttonLabel = 'Extraction Disabled';
        buttonEnabled = false;
    }

    // Update button state
    if (elements.extractBtn) {
      elements.extractBtn.disabled = !buttonEnabled;
    }
    if (elements.extractBtnLabel) {
      elements.extractBtnLabel.textContent = buttonLabel;
    }

    // Show/hide extraction controls
    if (elements.extractionControls) {
      elements.extractionControls.classList.toggle('hidden', !state.extractionAllowed);
    }
  }

  /**
   * Update domain notice styling
   */
  function updateDomainNotice() {
    const notice = elements.domainNotice;
    const message = elements.domainMessage;
    if (!notice) return;

    const isValid = BDLawPageDetector.isAllowedDomain(state.currentUrl);
    
    notice.classList.remove('valid', 'invalid');
    notice.classList.add(isValid ? 'valid' : 'invalid');
    
    if (message) {
      message.textContent = isValid 
        ? 'Connected to bdlaws.minlaw.gov.bd' 
        : 'This tool only works on bdlaws.minlaw.gov.bd';
    }
  }

  /**
   * Update UI for invalid domain state
   */
  function updateUIForInvalidDomain() {
    state.pageType = BDLawPageDetector.PAGE_TYPES.INVALID_DOMAIN;
    state.layerNumber = null;
    state.extractionAllowed = false;
    state.extractionType = 'none';
    
    updatePageTypeIndicator();
    updateWorkflowSteps();
    updateHelpText();
    updateExtractionControls();
    updateDomainNotice();
  }


  // ============================================
  // EXTRACTION FUNCTIONALITY
  // Requirements: 7.1, 9.1-9.6, 15.1-15.5
  // ============================================

  /**
   * Main extraction handler - routes to appropriate extraction method
   */
  async function handleExtraction() {
    if (state.isExtracting || !state.extractionAllowed) {
      return;
    }

    state.isExtracting = true;
    
    try {
      showLoading('Extracting content...');

      if (state.extractionType === 'catalog') {
        await extractVolumeCatalog();
      } else if (state.extractionType === 'content') {
        await extractActContent();
      }
    } catch (error) {
      Logger.error('Extraction failed', error);
      showError(error.message || 'Failed to extract content');
    } finally {
      state.isExtracting = false;
    }
  }

  /**
   * Extract act content from Layer 3 pages
   * Requirements: 5.1, 5.2, 7.1, 9.4, 9.5
   */
  async function extractActContent() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }

    // Ensure content script is available
    await ensureContentScript(tab.id);

    // Send extraction request to content script
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'bdlaw:extractAct'
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to extract act content');
    }

    // Store extracted content
    state.extractedContent = {
      title: response.title || '',
      content: response.content || '',
      sections: response.sections || { detected: [], counts: {} }
    };

    // Generate metadata
    state.metadata = BDLawMetadata.generate(state.currentUrl);

    // Update section counts
    state.sectionCounts = response.sections?.counts || { 'ধারা': 0, 'অধ্যায়': 0, 'তফসিল': 0 };

    // Display the preview
    displayExtractionPreview();
    showView('content');
  }

  /**
   * Extract volume catalog from Layer 2 pages
   * Requirements: 4.1, 4.4
   */
  async function extractVolumeCatalog() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }

    // Ensure content script is available
    await ensureContentScript(tab.id);

    // Send extraction request to content script
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'bdlaw:extractVolume'
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to extract volume catalog');
    }

    // Store extracted content
    state.extractedContent = {
      acts: response.acts || [],
      volumeNumber: extractVolumeNumber(state.currentUrl)
    };

    // Generate metadata
    state.metadata = BDLawMetadata.generate(state.currentUrl);

    // For volume pages, section counts are not applicable
    state.sectionCounts = { 'ধারা': 0, 'অধ্যায়': 0, 'তফসিল': 0 };

    // Display the preview
    displayVolumeCatalogPreview();
    showView('content');
  }

  /**
   * Ensure content script is loaded in the tab
   */
  async function ensureContentScript(tabId) {
    const maxAttempts = 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await Promise.race([
          chrome.tabs.sendMessage(tabId, { action: 'ping' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 1500))
        ]);
        
        if (response && response.success) {
          return true;
        }
      } catch (err) {
        if (attempt < maxAttempts) {
          try {
            await chrome.scripting.executeScript({ 
              target: { tabId: tabId }, 
              files: ['content.js'] 
            });
            await new Promise(r => setTimeout(r, 500));
          } catch (injErr) {
            if (attempt === maxAttempts) {
              throw new Error('Failed to inject content script. Please refresh the page and try again.');
            }
          }
        }
      }
    }
    
    throw new Error('Content script not available. Please refresh the page and try again.');
  }

  /**
   * Extract volume number from URL
   */
  function extractVolumeNumber(url) {
    const match = url.match(/volume-(\d+)\.html/);
    return match ? match[1] : '';
  }

  /**
   * Extract act number from URL
   */
  function extractActNumber(url) {
    const match = url.match(/act-(?:details-)?(\d+)\.html/);
    return match ? match[1] : '';
  }

  // ============================================
  // PREVIEW DISPLAY WITH SECTION HIGHLIGHTING
  // Requirements: 9.1, 9.2, 9.6, 15.1, 15.3, 15.4, 15.5
  // ============================================

  /**
   * Display extraction preview for act content
   */
  function displayExtractionPreview() {
    if (!state.extractedContent) return;

    const content = state.extractedContent.content || '';
    
    // Display content with section highlighting
    displayContentWithHighlighting(content);
    
    // Update stats
    updateContentStats(content);
    
    // Update section marker counts
    updateSectionMarkerCounts();
    
    // Update metadata preview
    updateMetadataPreview();
    
    // Show action buttons
    showActionButtons(true);
  }

  /**
   * Display volume catalog preview
   */
  function displayVolumeCatalogPreview() {
    if (!state.extractedContent) return;

    const acts = state.extractedContent.acts || [];
    
    // Format catalog as readable text
    let catalogText = `Volume ${state.extractedContent.volumeNumber} - Act Catalog\n`;
    catalogText += `${'='.repeat(50)}\n\n`;
    catalogText += `Total Acts: ${acts.length}\n\n`;
    
    acts.forEach((act, index) => {
      catalogText += `${index + 1}. ${act.title || 'Untitled'}\n`;
      if (act.year) catalogText += `   Year: ${act.year}\n`;
      if (act.actNumber) catalogText += `   Act Number: ${act.actNumber}\n`;
      if (act.url) catalogText += `   URL: ${act.url}\n`;
      catalogText += '\n';
    });

    // Display in text area
    if (elements.extractedText) {
      elements.extractedText.value = catalogText;
    }

    // Update line numbers
    updateLineNumbers(catalogText);
    
    // Update stats
    updateContentStats(catalogText);
    
    // Hide section markers for volume pages
    if (elements.sectionMarkersSection) {
      elements.sectionMarkersSection.classList.add('hidden');
    }
    
    // Update metadata preview
    updateMetadataPreview();
    
    // Show action buttons
    showActionButtons(true);
  }

  /**
   * Display content with section marker highlighting
   * Requirement: 9.6 - Distinct visual highlighting for each Section_Marker type
   */
  function displayContentWithHighlighting(content) {
    if (!elements.extractedText) return;

    // For textarea, we can't do HTML highlighting, so we display plain text
    // The highlighting is shown in the section markers count section
    elements.extractedText.value = content;
    
    // Update line numbers
    updateLineNumbers(content);
  }

  /**
   * Update line numbers display
   * Requirement: 15.3 - Display line numbers in preview
   */
  function updateLineNumbers(content) {
    if (!elements.lineNumbers) return;

    const lines = content.split('\n');
    const lineNumbersHtml = lines.map((_, i) => i + 1).join('\n');
    elements.lineNumbers.textContent = lineNumbersHtml;
  }

  /**
   * Update content statistics
   * Requirements: 15.4, 15.5 - Display character and word counts
   */
  function updateContentStats(content) {
    const text = content || '';
    
    // Character count
    const chars = text.length;
    if (elements.charCount) {
      elements.charCount.textContent = chars.toLocaleString();
    }
    
    // Word count (handles Bengali and English)
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (elements.wordCount) {
      elements.wordCount.textContent = words.toLocaleString();
    }
    
    // Line count
    const lines = text ? text.split('\n').length : 0;
    if (elements.lineCount) {
      elements.lineCount.textContent = lines.toLocaleString();
    }
  }

  /**
   * Update section marker counts display
   * Requirements: 9.1, 9.2 - Display count of detected Section_Markers
   */
  function updateSectionMarkerCounts() {
    if (elements.dharaCount) {
      elements.dharaCount.textContent = state.sectionCounts['ধারা'] || 0;
    }
    if (elements.adhyayCount) {
      elements.adhyayCount.textContent = state.sectionCounts['অধ্যায়'] || 0;
    }
    if (elements.tofsilCount) {
      elements.tofsilCount.textContent = state.sectionCounts['তফসিল'] || 0;
    }
    
    // Show section markers section for act content
    if (elements.sectionMarkersSection && state.extractionType === 'content') {
      elements.sectionMarkersSection.classList.remove('hidden');
    }
  }

  /**
   * Update metadata preview section
   * Requirement: 8.5 - Display metadata preview
   */
  function updateMetadataPreview() {
    if (!state.metadata) return;

    if (elements.metaSource) {
      elements.metaSource.textContent = state.metadata.source || '-';
    }
    if (elements.metaSourceUrl) {
      elements.metaSourceUrl.textContent = state.metadata.source_url || '-';
    }
    if (elements.metaScrapedAt) {
      const date = new Date(state.metadata.scraped_at);
      elements.metaScrapedAt.textContent = date.toLocaleString();
    }
    
    // Show metadata section
    if (elements.metadataSection) {
      elements.metadataSection.classList.remove('hidden');
    }
  }

  /**
   * Show/hide action buttons
   */
  function showActionButtons(show) {
    if (elements.actionsDiv) {
      elements.actionsDiv.classList.toggle('hidden', !show);
    }
    if (elements.saveBtn) {
      elements.saveBtn.disabled = !show;
    }
    if (elements.copyBtn) {
      elements.copyBtn.disabled = !show;
    }
  }


  // ============================================
  // EXPORT WITH CONFIRMATION DIALOG
  // Requirements: 5.4, 5.5, 8.4, 8.5, 9.3
  // ============================================

  /**
   * Handle save/export action with confirmation
   * Requirements: 5.5, 9.3 - Display confirmation dialog with extraction summary
   */
  async function handleSave() {
    if (!state.extractedContent || !state.metadata) {
      showError('No content to save. Please extract content first.');
      return;
    }

    // Validate metadata before export
    // Requirement: 8.2 - Prevent export if metadata is incomplete
    const validation = BDLawMetadata.validate(state.metadata);
    if (!validation.valid) {
      showError(`Required metadata missing: ${validation.missing.join(', ')}`);
      return;
    }

    // Show confirmation dialog
    // Requirement: 9.3 - Display confirmation dialog showing extraction summary
    const confirmed = await showExportConfirmation();
    if (!confirmed) {
      return;
    }

    try {
      showLoading('Preparing export...');
      
      let jsonContent, filename;
      
      if (state.extractionType === 'content') {
        // Act content export
        jsonContent = BDLawExport.formatActExport(state.extractedContent, state.metadata);
        const actNumber = extractActNumber(state.currentUrl);
        filename = BDLawExport.generateActFilename(actNumber, state.metadata.scraped_at);
      } else if (state.extractionType === 'catalog') {
        // Volume catalog export
        jsonContent = BDLawExport.formatVolumeExport(state.extractedContent.acts, state.metadata);
        filename = BDLawExport.generateVolumeFilename(state.extractedContent.volumeNumber, state.metadata.scraped_at);
      } else {
        throw new Error('Invalid extraction type');
      }

      // Validate JSON before saving
      // Requirement: 12.5 - Validate JSON structure before saving
      if (!BDLawExport.validateJSON(jsonContent)) {
        throw new Error('Export data is malformed');
      }

      // Trigger download
      await BDLawExport.triggerDownload(jsonContent, filename);
      
      showSaveSuccess(filename);
      
    } catch (error) {
      Logger.error('Export failed', error);
      showError(error.message || 'Failed to save file');
    }
  }

  /**
   * Show export confirmation dialog
   * Requirements: 5.5, 9.3 - Confirmation with extraction summary
   */
  async function showExportConfirmation() {
    let summary = '';
    
    if (state.extractionType === 'content') {
      const content = state.extractedContent.content || '';
      const charCount = content.length;
      const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
      
      summary = `Act Content Export Summary:\n\n`;
      summary += `Title: ${state.extractedContent.title || 'Untitled'}\n`;
      summary += `Characters: ${charCount.toLocaleString()}\n`;
      summary += `Words: ${wordCount.toLocaleString()}\n`;
      summary += `\nSection Markers Detected:\n`;
      summary += `  ধারা (Section): ${state.sectionCounts['ধারা']}\n`;
      summary += `  অধ্যায় (Chapter): ${state.sectionCounts['অধ্যায়']}\n`;
      summary += `  তফসিল (Schedule): ${state.sectionCounts['তফসিল']}\n`;
      summary += `\nSource: ${state.metadata.source_url}\n`;
      summary += `\nProceed with export?`;
    } else if (state.extractionType === 'catalog') {
      const actCount = state.extractedContent.acts?.length || 0;
      
      summary = `Volume Catalog Export Summary:\n\n`;
      summary += `Volume: ${state.extractedContent.volumeNumber}\n`;
      summary += `Acts Found: ${actCount}\n`;
      summary += `\nSource: ${state.metadata.source_url}\n`;
      summary += `\nProceed with export?`;
    }

    return confirm(summary);
  }

  /**
   * Show save success feedback
   */
  function showSaveSuccess(filename) {
    showView('content');
    
    if (elements.saveBtn) {
      const originalLabel = elements.saveBtn.querySelector('.btn-label');
      const originalText = originalLabel?.textContent;
      
      if (originalLabel) {
        originalLabel.textContent = 'Saved!';
      }
      elements.saveBtn.style.background = '#28a745';
      
      setTimeout(() => {
        if (originalLabel && originalText) {
          originalLabel.textContent = originalText;
        }
        if (elements.saveBtn) {
          elements.saveBtn.style.background = '';
        }
      }, 2000);
    }
  }

  // ============================================
  // COPY AND CLEAR ACTIONS
  // ============================================

  /**
   * Copy extracted content to clipboard
   */
  async function handleCopy() {
    try {
      const text = elements.extractedText?.value || '';
      if (!text.trim()) {
        showError('No content to copy');
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        elements.extractedText.select();
        document.execCommand('copy');
        elements.extractedText.blur();
      }

      // Show feedback
      if (elements.copyBtn) {
        const label = elements.copyBtn.querySelector('.btn-label');
        const originalText = label?.textContent;
        
        elements.copyBtn.classList.add('copied');
        if (label) label.textContent = 'Copied!';
        
        setTimeout(() => {
          elements.copyBtn?.classList.remove('copied');
          if (label && originalText) label.textContent = originalText;
        }, 1500);
      }
    } catch (error) {
      Logger.error('Copy failed', error);
      showError('Failed to copy to clipboard');
    }
  }

  /**
   * Clear extracted content and reset state
   */
  function handleClear() {
    state.extractedContent = null;
    state.metadata = null;
    state.sectionCounts = { 'ধারা': 0, 'অধ্যায়': 0, 'তফসিল': 0 };
    
    if (elements.extractedText) {
      elements.extractedText.value = '';
    }
    if (elements.lineNumbers) {
      elements.lineNumbers.textContent = '';
    }
    
    updateContentStats('');
    updateSectionMarkerCounts();
    
    if (elements.metadataSection) {
      elements.metadataSection.classList.add('hidden');
    }
    
    showActionButtons(false);
    showView('welcome');
  }

  // ============================================
  // COLLAPSIBLE SECTIONS
  // ============================================

  /**
   * Toggle collapsible section
   */
  function toggleCollapsible(toggleBtn, contentEl, iconEl) {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    
    toggleBtn.setAttribute('aria-expanded', !isExpanded);
    contentEl.setAttribute('aria-hidden', isExpanded);
    
    if (iconEl) {
      iconEl.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
    }
  }

  // ============================================
  // EVENT BINDING
  // ============================================

  function debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(null, args), delay);
    };
  }

  function bindEventListeners() {
    // Extraction button
    if (elements.extractBtn) {
      elements.extractBtn.addEventListener('click', debounce(handleExtraction, 400));
    }

    // Action buttons
    if (elements.saveBtn) {
      elements.saveBtn.addEventListener('click', debounce(handleSave, 400));
    }
    if (elements.copyBtn) {
      elements.copyBtn.addEventListener('click', debounce(handleCopy, 250));
    }
    if (elements.clearBtn) {
      elements.clearBtn.addEventListener('click', handleClear);
    }

    // Metadata collapsible
    if (elements.metadataToggle && elements.metadataContent) {
      elements.metadataToggle.addEventListener('click', () => {
        toggleCollapsible(
          elements.metadataToggle, 
          elements.metadataContent, 
          elements.metadataCollapseIcon
        );
      });
    }

    // Technical details collapsible
    if (elements.technicalToggle && elements.technicalContent) {
      elements.technicalToggle.addEventListener('click', () => {
        toggleCollapsible(
          elements.technicalToggle, 
          elements.technicalContent, 
          safeGetElement('technicalCollapseIcon')
        );
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'e' && state.extractionAllowed && !state.isExtracting) {
          e.preventDefault();
          handleExtraction();
        } else if (e.key === 'c' && state.extractedContent) {
          e.preventDefault();
          handleCopy();
        } else if (e.key === 's' && state.extractedContent) {
          e.preventDefault();
          handleSave();
        }
      }
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async function init() {
    try {
      Logger.info('Initializing BDLawCorpus popup');
      
      // Show welcome view initially
      showView('welcome');
      
      // Bind event listeners
      bindEventListeners();
      
      // Detect page type and update UI
      await detectAndUpdatePageType();
      
      // Focus extract button if enabled
      if (elements.extractBtn && !elements.extractBtn.disabled) {
        elements.extractBtn.focus();
      }
      
      Logger.info('BDLawCorpus popup initialized successfully');
    } catch (error) {
      Logger.error('Popup initialization failed', error);
      showError('Extension initialization failed: ' + error.message);
    }
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
