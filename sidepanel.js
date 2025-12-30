/**
 * BDLawCorpus Side Panel Script
 * 
 * Persistent UI with batch collection and export functionality.
 * Features:
 * - Volume catalog capture
 * - Queue-based act collection
 * - Bulk export as corpus
 */
(function() {
  'use strict';

  // ============================================
  // STORAGE KEYS
  // ============================================
  const STORAGE_KEYS = {
    QUEUE: 'bdlaw_queue',
    CAPTURED_ACTS: 'bdlaw_captured_acts',
    CURRENT_VOLUME: 'bdlaw_current_volume',
    EXPORT_HISTORY: 'bdlaw_export_history',
    FAILED_EXTRACTIONS: 'bdlaw_failed_extractions',
    QUEUE_STATS: 'bdlaw_queue_stats',
    PROCESSING_STATE: 'bdlaw_processing_state'  // Requirements: 8.5 - Track interrupted processing
  };

  // ============================================
  // STATE
  // ============================================
  const state = {
    currentTab: 'capture',
    currentUrl: '',
    pageType: null,
    currentVolume: null,
    queue: [],
    capturedActs: [],
    isProcessing: false,
    isRetrying: false,  // Requirements: 5.1 - Track retry queue processing
    pendingDuplicateInfo: null,  // Requirements: 7.1, 7.4 - Track pending duplicate for UI
    forceReExtract: null,        // Requirements: 7.5 - Track force re-extract state
    // Robust queue processing state
    failedExtractions: [],       // Requirements: 4.1 - Track failed extractions
    queueStats: {                // Requirements: 7.1-7.3 - Processing statistics
      successCount: 0,
      failedCount: 0,
      retriedCount: 0
    }
  };

  // ============================================
  // DOM ELEMENTS
  // ============================================
  const $ = (id) => document.getElementById(id);

  // ============================================
  // STORAGE HELPERS
  // ============================================
  async function loadFromStorage() {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.QUEUE,
        STORAGE_KEYS.CAPTURED_ACTS,
        STORAGE_KEYS.CURRENT_VOLUME,
        STORAGE_KEYS.EXPORT_HISTORY,
        STORAGE_KEYS.FAILED_EXTRACTIONS,
        STORAGE_KEYS.QUEUE_STATS
      ]);
      
      state.queue = result[STORAGE_KEYS.QUEUE] || [];
      state.capturedActs = result[STORAGE_KEYS.CAPTURED_ACTS] || [];
      state.currentVolume = result[STORAGE_KEYS.CURRENT_VOLUME] || null;
      state.failedExtractions = result[STORAGE_KEYS.FAILED_EXTRACTIONS] || [];
      state.queueStats = result[STORAGE_KEYS.QUEUE_STATS] || {
        successCount: 0,
        failedCount: 0,
        retriedCount: 0
      };
      
      console.log('Loaded from storage:', {
        queueLength: state.queue.length,
        capturedActsLength: state.capturedActs.length,
        failedExtractionsLength: state.failedExtractions.length
      });
    } catch (e) {
      console.error('Failed to load from storage:', e);
    }
  }

  async function saveToStorage() {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.QUEUE]: state.queue,
        [STORAGE_KEYS.CAPTURED_ACTS]: state.capturedActs,
        [STORAGE_KEYS.CURRENT_VOLUME]: state.currentVolume,
        [STORAGE_KEYS.FAILED_EXTRACTIONS]: state.failedExtractions,
        [STORAGE_KEYS.QUEUE_STATS]: state.queueStats
      });
    } catch (e) {
      console.error('Failed to save to storage:', e);
    }
  }

  // ============================================
  // PROCESSING STATE PERSISTENCE
  // Requirements: 8.5 - Allow resuming interrupted queue processing
  // ============================================
  
  /**
   * Save processing state to detect interrupted processing
   * Requirements: 8.5 - Detect interrupted processing on load
   * 
   * @param {boolean} isProcessing - Whether processing is active
   * @param {Array} pendingItems - Items that were being processed
   */
  async function saveProcessingState(isProcessing, pendingItems = []) {
    try {
      const processingState = isProcessing ? {
        isProcessing: true,
        startedAt: new Date().toISOString(),
        pendingItemIds: pendingItems.map(item => item.id),
        totalItems: pendingItems.length
      } : null;
      
      await chrome.storage.local.set({
        [STORAGE_KEYS.PROCESSING_STATE]: processingState
      });
    } catch (e) {
      console.error('Failed to save processing state:', e);
    }
  }
  
  /**
   * Load processing state to detect interrupted processing
   * Requirements: 8.5 - Detect interrupted processing on load
   * 
   * @returns {Object|null} Processing state if interrupted, null otherwise
   */
  async function loadProcessingState() {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.PROCESSING_STATE]);
      return result[STORAGE_KEYS.PROCESSING_STATE] || null;
    } catch (e) {
      console.error('Failed to load processing state:', e);
      return null;
    }
  }
  
  /**
   * Clear processing state (called when processing completes normally)
   * Requirements: 8.5 - Clear state after successful completion
   */
  async function clearProcessingState() {
    try {
      await chrome.storage.local.remove([STORAGE_KEYS.PROCESSING_STATE]);
    } catch (e) {
      console.error('Failed to clear processing state:', e);
    }
  }
  
  /**
   * Check for interrupted processing and offer to resume
   * Requirements: 8.5 - Offer to resume processing
   */
  async function checkForInterruptedProcessing() {
    const processingState = await loadProcessingState();
    
    if (!processingState || !processingState.isProcessing) {
      return;
    }
    
    // Check if there are still pending items in the queue
    const pendingItems = state.queue.filter(q => q.status === 'pending' || q.status === 'processing');
    
    if (pendingItems.length === 0) {
      // No pending items, clear the stale processing state
      await clearProcessingState();
      return;
    }
    
    // Reset any items that were stuck in 'processing' status back to 'pending'
    let resetCount = 0;
    for (const item of state.queue) {
      if (item.status === 'processing') {
        item.status = 'pending';
        resetCount++;
      }
    }
    
    if (resetCount > 0) {
      await saveToStorage();
    }
    
    // Show the resume prompt
    showResumePrompt(processingState, pendingItems.length);
  }
  
  /**
   * Show UI prompt to resume interrupted processing
   * Requirements: 8.5 - Offer to resume processing
   * 
   * @param {Object} processingState - The interrupted processing state
   * @param {number} pendingCount - Number of pending items
   */
  function showResumePrompt(processingState, pendingCount) {
    const section = $('resumeProcessingSection');
    if (!section) return;
    
    const startedAt = processingState.startedAt 
      ? new Date(processingState.startedAt).toLocaleString()
      : 'Unknown';
    
    $('resumeProcessingMessage').textContent = 
      `Queue processing was interrupted. ${pendingCount} item(s) remaining.`;
    $('resumeProcessingTimestamp').textContent = `Started: ${startedAt}`;
    
    section.classList.remove('hidden');
  }
  
  /**
   * Hide the resume prompt
   */
  function hideResumePrompt() {
    const section = $('resumeProcessingSection');
    if (section) {
      section.classList.add('hidden');
    }
  }
  
  /**
   * Handle resume processing button click
   * Requirements: 8.5 - Allow resuming interrupted queue processing
   */
  async function handleResumeProcessing() {
    hideResumePrompt();
    await clearProcessingState();
    
    // Switch to queue tab and start processing
    switchTab('queue');
    processQueue();
  }
  
  /**
   * Handle dismiss resume prompt button click
   */
  async function handleDismissResume() {
    hideResumePrompt();
    await clearProcessingState();
  }

  // ============================================
  // TAB NAVIGATION
  // ============================================
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        switchTab(tabId);
      });
    });
  }

  function switchTab(tabId) {
    state.currentTab = tabId;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId + 'Tab');
    });
    
    // Refresh tab content
    if (tabId === 'queue') {
      renderQueue();
    } else if (tabId === 'export') {
      updateExportStats();
    }
  }

  // ============================================
  // CONNECTION & PAGE DETECTION
  // ============================================
  async function checkCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        updateConnectionStatus(false);
        return;
      }

      state.currentUrl = tab.url;
      const isAllowed = BDLawPageDetector.isAllowedDomain(state.currentUrl);
      updateConnectionStatus(isAllowed);

      if (isAllowed) {
        state.pageType = BDLawPageDetector.detectPageType(state.currentUrl);
        updatePageInfo();
        updateCaptureButtons();
      } else {
        state.pageType = null;
        resetPageInfo();
      }
    } catch (e) {
      console.error('Failed to check current page:', e);
      updateConnectionStatus(false);
    }
  }

  function updateConnectionStatus(connected) {
    const statusEl = $('connectionStatus');
    const textEl = $('statusText');
    
    statusEl.classList.toggle('connected', connected);
    statusEl.classList.toggle('disconnected', !connected);
    textEl.textContent = connected 
      ? 'Connected to bdlaws.minlaw.gov.bd' 
      : 'Not connected to bdlaws.minlaw.gov.bd';
  }

  function updatePageInfo() {
    const badge = $('pageTypeBadge');
    const urlEl = $('pageUrl');
    const PAGE_TYPES = BDLawPageDetector.PAGE_TYPES;

    badge.classList.remove('volume', 'act', 'invalid', 'index');
    
    let icon = '⚠️';
    let text = 'Unknown Page';
    let badgeClass = 'invalid';

    switch (state.pageType) {
      case PAGE_TYPES.VOLUME:
        icon = '📖';
        text = 'Volume Page';
        badgeClass = 'volume';
        break;
      case PAGE_TYPES.CHRONOLOGICAL_INDEX:
        icon = '📅';
        text = 'Chronological Index';
        badgeClass = 'index';
        break;
      case PAGE_TYPES.ALPHABETICAL_INDEX:
        icon = '🔤';
        text = 'Alphabetical Index';
        badgeClass = 'index';
        break;
      case PAGE_TYPES.ACT_DETAILS:
        icon = '📄';
        text = 'Act Details';
        badgeClass = 'act';
        break;
      case PAGE_TYPES.RANGE_INDEX:
        icon = '📚';
        text = 'Range Index';
        badgeClass = 'invalid';
        break;
      case PAGE_TYPES.ACT_SUMMARY:
        icon = '🔗';
        text = 'Act Summary';
        badgeClass = 'invalid';
        break;
    }

    badge.classList.add(badgeClass);
    badge.querySelector('.badge-icon').textContent = icon;
    badge.querySelector('.badge-text').textContent = text;
    urlEl.textContent = state.currentUrl;
  }

  function resetPageInfo() {
    const badge = $('pageTypeBadge');
    badge.classList.remove('volume', 'act', 'index');
    badge.classList.add('invalid');
    badge.querySelector('.badge-icon').textContent = '⚠️';
    badge.querySelector('.badge-text').textContent = 'Navigate to bdlaws.minlaw.gov.bd';
    $('pageUrl').textContent = '';
  }

  function updateCaptureButtons() {
    const PAGE_TYPES = BDLawPageDetector.PAGE_TYPES;
    const volumeBtn = $('captureVolumeBtn');
    const actBtn = $('captureActBtn');
    const queueBtn = $('addToQueueBtn');

    // Reset all
    volumeBtn.disabled = true;
    actBtn.disabled = true;
    queueBtn.disabled = true;

    // Enable capture button for catalog sources (volume and index pages)
    if (BDLawPageDetector.isCatalogSource(state.pageType)) {
      volumeBtn.disabled = false;
    } else if (state.pageType === PAGE_TYPES.ACT_DETAILS) {
      actBtn.disabled = false;
      queueBtn.disabled = false;
    }
  }

  // ============================================
  // VOLUME NUMBER EXTRACTION
  // Requirements: 29.1, 29.2, 29.3, 29.5
  // Uses BDLawQueue module for testable volume number extraction
  // ============================================
  
  /**
   * Extract volume number from URL
   * Requirements: 29.2, 29.5 - Parse volume-{XX}.html pattern
   * 
   * @param {string} url - The URL to extract volume number from
   * @returns {string} The volume number or "unknown" if not found
   */
  function extractVolumeNumber(url) {
    return BDLawQueue.extractVolumeNumber(url);
  }

  // ============================================
  // QUEUE DEDUPLICATION
  // Requirements: 27.1, 27.2, 27.3, 27.4, 27.5
  // Uses BDLawQueue module for testable deduplication logic
  // ============================================
  
  /**
   * Check if an act with the given act_number already exists in the queue
   * Requirements: 27.1, 27.4 - Use act_number as unique identifier
   * 
   * @param {string} actNumber - The act number to check
   * @returns {boolean} True if duplicate exists in queue, false otherwise
   */
  function isDuplicateInQueue(actNumber) {
    return BDLawQueue.isDuplicateInQueue(actNumber, state.queue);
  }

  /**
   * Check if an act with the given act_number already exists in captured acts
   * 
   * @param {string} actNumber - The act number to check
   * @returns {boolean} True if already captured, false otherwise
   */
  function isAlreadyCaptured(actNumber) {
    return BDLawQueue.isAlreadyCaptured(actNumber, state.capturedActs);
  }

  // ============================================
  // VOLUME/INDEX CAPTURE
  // Handles both volume pages and index pages (chronological/alphabetical)
  // ============================================
  async function captureVolume() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');

      // Ensure content script
      await ensureContentScript(tab.id);

      const PAGE_TYPES = BDLawPageDetector.PAGE_TYPES;
      let response;
      let sourceType = 'volume';
      let sourceLabel = 'Volume';

      // Determine extraction method based on page type
      if (state.pageType === PAGE_TYPES.CHRONOLOGICAL_INDEX) {
        response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'bdlaw:extractIndex',
          indexType: 'chronological'
        });
        sourceType = 'chronological_index';
        sourceLabel = 'Chronological Index';
      } else if (state.pageType === PAGE_TYPES.ALPHABETICAL_INDEX) {
        response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'bdlaw:extractIndex',
          indexType: 'alphabetical'
        });
        sourceType = 'alphabetical_index';
        sourceLabel = 'Alphabetical Index';
      } else {
        // Default: volume page extraction
        response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'bdlaw:extractVolume' 
        });
      }

      if (!response?.success) {
        throw new Error(response?.error || `Failed to extract ${sourceLabel.toLowerCase()}`);
      }

      // Extract volume number from URL (only meaningful for volume pages)
      // For index pages, use the source type as identifier
      const volumeNumber = sourceType === 'volume' 
        ? extractVolumeNumber(state.currentUrl)
        : sourceType;

      state.currentVolume = {
        volumeNumber,
        sourceType,
        sourceLabel,
        url: state.currentUrl,
        acts: response.acts || [],
        capturedAt: new Date().toISOString()
      };

      await saveToStorage();
      showCurrentVolume();
      
      alert(`${sourceLabel} captured!\n${response.acts.length} acts found.`);
    } catch (e) {
      console.error('Catalog capture failed:', e);
      alert('Failed to capture catalog: ' + e.message);
    }
  }

  function showCurrentVolume() {
    if (!state.currentVolume) {
      $('currentVolumeSection').classList.add('hidden');
      return;
    }

    $('currentVolumeSection').classList.remove('hidden');
    
    // Display appropriate label based on source type
    const sourceLabel = state.currentVolume.sourceLabel || 'Volume';
    const volumeNumber = state.currentVolume.volumeNumber;
    
    // Update the label text based on source type
    const volumeLabelEl = $('volumeLabel');
    if (volumeLabelEl) {
      volumeLabelEl.textContent = sourceLabel + ':';
    }
    
    $('volumeNumber').textContent = volumeNumber;
    $('volumeActCount').textContent = state.currentVolume.acts.length;
  }

  async function addAllActsToQueue() {
    if (!state.currentVolume?.acts?.length) {
      alert('No volume captured. Capture a volume first.');
      return;
    }

    const acts = state.currentVolume.acts;
    let added = 0;
    let skippedInQueue = 0;
    let skippedCaptured = 0;

    for (const act of acts) {
      // Requirements: 27.1, 27.3 - Check for existing act_number before adding
      if (isDuplicateInQueue(act.actNumber)) {
        skippedInQueue++;
        continue;
      }
      
      if (isAlreadyCaptured(act.actNumber)) {
        skippedCaptured++;
        continue;
      }

      state.queue.push({
        id: Date.now() + '_' + act.actNumber,
        actNumber: act.actNumber,
        title: act.title,
        url: act.url,
        year: act.year,
        volumeNumber: state.currentVolume.volumeNumber,
        status: 'pending',
        addedAt: new Date().toISOString()
      });
      added++;
    }

    await saveToStorage();
    updateQueueBadge();
    renderQueue();
    
    // Requirements: 27.5 - Display count of skipped duplicates when adding from volume
    const totalSkipped = skippedInQueue + skippedCaptured;
    let message = `Added ${added} acts to queue.`;
    if (totalSkipped > 0) {
      message += `\n${totalSkipped} duplicate(s) skipped:`;
      if (skippedInQueue > 0) {
        message += `\n  - ${skippedInQueue} already in queue`;
      }
      if (skippedCaptured > 0) {
        message += `\n  - ${skippedCaptured} already captured`;
      }
    }
    alert(message);
  }

  // ============================================
  // ACT CAPTURE
  // Requirements: 7.1, 7.4 - Check for duplicates before capture
  // Requirements: 10.1, 10.2, 10.3 - Content hashing and idempotency
  // Requirements: 11.2, 11.3, 11.4, 11.5, 11.7 - Language-aware deduplication
  // ============================================
  async function captureCurrentAct() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');

      // Extract act number from URL first for duplicate check
      const actMatch = state.currentUrl.match(/act-(?:details-)?(\d+)\.html/);
      const actNumber = actMatch ? actMatch[1] : 'unknown';

      await ensureContentScript(tab.id);

      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'bdlaw:extractAct' 
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to extract act');
      }

      // Requirements: 29.3, 29.5 - Include volume_number in captured act data
      const volumeNumber = extractVolumeNumber(state.currentUrl);

      // Requirements: 10.2 - Compute content hash during capture
      const content = response.content || '';
      const contentHash = await BDLawCorpusManifest.computeContentHash(content);

      // Requirements: 11.1 - Detect content language before duplicate check
      const contentLanguage = BDLawExtractor.detectContentLanguage(content);

      // Requirements: 11.2, 11.3, 11.4, 11.5 - Language-aware deduplication
      const manifest = await BDLawCorpusManifest.loadCorpusManifest();
      const duplicateCheck = BDLawCorpusManifest.checkLanguageAwareDuplicate(manifest, actNumber, contentLanguage);
      
      if (duplicateCheck.isDuplicate) {
        // Requirements: 10.5 - Log duplicate detection
        BDLawCorpusManifest.logExtractionOperation({
          type: 'duplicate_check',
          internal_id: actNumber,
          result: 'duplicate',
          details: {
            previous_capture: duplicateCheck.existingEntry.capture_timestamp,
            previous_title: duplicateCheck.existingEntry.title,
            existing_language: duplicateCheck.existingLanguage,
            new_language: duplicateCheck.newLanguage,
            allow_extraction: duplicateCheck.allowExtraction
          }
        });

        // Requirements: 11.4 - Block English extraction when Bengali exists
        if (!duplicateCheck.allowExtraction) {
          // Requirements: 11.7 - Show language-specific warning message
          const existingEntry = duplicateCheck.existingEntry;
          alert(
            `Act ${actNumber} already exists in corpus.\n\n` +
            `Existing version: ${existingEntry.content_language || 'english'}\n` +
            `New version: ${contentLanguage}\n` +
            `Previous capture: ${existingEntry.capture_timestamp}\n` +
            `Title: ${existingEntry.title || 'Unknown'}\n\n` +
            (duplicateCheck.existingLanguage === 'bengali' && duplicateCheck.newLanguage === 'english'
              ? `Bengali version is preferred - English extraction blocked.`
              : `Extraction blocked.`)
          );
          
          // Requirements: 10.5 - Log skipped extraction
          BDLawCorpusManifest.logExtractionOperation({
            type: 'extract',
            internal_id: actNumber,
            result: 'skipped',
            details: { 
              reason: duplicateCheck.existingLanguage === 'bengali' 
                ? 'bengali_preferred_english_blocked' 
                : 'duplicate_same_language',
              existing_language: duplicateCheck.existingLanguage,
              new_language: duplicateCheck.newLanguage
            }
          });
          return; // Don't proceed with capture
        }

        // Requirements: 11.5 - Bengali replaces English (allowExtraction is true, replaceExisting is true)
        if (duplicateCheck.replaceExisting) {
          // Requirements: 11.7 - Show language-specific message for replacement
          const existingEntry = duplicateCheck.existingEntry;
          const confirmMessage = `Act ${actNumber} exists in English.\n\n` +
            `Bengali version detected - Bengali is preferred.\n` +
            `Previous capture: ${existingEntry.capture_timestamp}\n` +
            `Title: ${existingEntry.title || 'Unknown'}\n\n` +
            `Do you want to replace the English version with Bengali?\n` +
            `(Previous version will be archived)`;
          
          if (!confirm(confirmMessage)) {
            // Requirements: 10.5 - Log skipped extraction
            BDLawCorpusManifest.logExtractionOperation({
              type: 'extract',
              internal_id: actNumber,
              result: 'skipped',
              details: { reason: 'user_cancelled_bengali_replacement' }
            });
            return; // User cancelled, don't proceed with capture
          }
          
          // User confirmed replacement - will use forceReExtraction later
          state.forceReExtract = { manifest, actNumber, reason: 'bengali_replacement' };
        }
      }

      const actData = {
        id: Date.now() + '_' + actNumber,
        actNumber,
        title: response.title || '',
        content: content,
        content_hash: contentHash, // Requirements: 10.2 - Store content hash
        content_language: contentLanguage, // Requirements: 11.6 - Store content language
        url: state.currentUrl,
        volumeNumber: volumeNumber, // Requirements: 29.3 - Store volume_number
        sections: response.sections || {},
        // Requirements: 26.1, 26.2, 26.3 - Store structured data from extraction
        structured_sections: response.structured_sections || [],
        tables: response.tables || [],
        amendments: response.amendments || [],
        metadata: BDLawMetadata.generate(state.currentUrl),
        capturedAt: new Date().toISOString()
      };

      // Requirements: 7.5 - Handle force re-extraction with version tracking
      // Requirements: 10.3 - Check idempotency if re-extracting
      if (state.forceReExtract && state.forceReExtract.actNumber === actNumber) {
        // Check idempotency before re-extraction (skip for Bengali replacement)
        if (state.forceReExtract.reason !== 'bengali_replacement') {
          const idempotencyCheck = await BDLawCorpusManifest.checkExtractionIdempotency(
            state.forceReExtract.manifest,
            actNumber,
            content
          );
          
          // If content is identical, inform user but still allow re-extraction
          if (idempotencyCheck.isIdentical) {
            const proceedAnyway = confirm(
              `Content is identical to previous extraction.\n\n` +
              `Hash: ${idempotencyCheck.newHash}\n\n` +
              `Do you still want to re-extract?`
            );
            if (!proceedAnyway) {
              // Requirements: 10.5 - Log skipped extraction
              BDLawCorpusManifest.logExtractionOperation({
                type: 'extract',
                internal_id: actNumber,
                result: 'skipped',
                details: { reason: 'identical_content_user_cancelled' }
              });
              state.forceReExtract = null;
              return;
            }
          } else if (idempotencyCheck.flag === 'source_changed') {
            // Notify user that source has changed
            alert(
              `Source content has changed since last extraction.\n\n` +
              `Previous hash: ${idempotencyCheck.previousHash}\n` +
              `New hash: ${idempotencyCheck.newHash}\n\n` +
              `Proceeding with re-extraction...`
            );
          }
        }
        
        // Use forceReExtraction to archive previous version
        const updatedManifest = BDLawCorpusManifest.forceReExtraction(
          state.forceReExtract.manifest, 
          actNumber, 
          {
            internal_id: actNumber,
            title: actData.title,
            volume_number: actData.volumeNumber,
            capturedAt: actData.capturedAt,
            content: actData.content,
            content_hash: contentHash, // Requirements: 10.2 - Store hash in manifest
            content_language: contentLanguage, // Requirements: 11.6 - Store language in manifest
            cross_reference_count: 0 // Will be updated during export
          }
        );
        await BDLawCorpusManifest.saveCorpusManifest(updatedManifest);
        
        // Requirements: 10.5 - Log force re-extraction
        BDLawCorpusManifest.logExtractionOperation({
          type: 'force_re_extract',
          internal_id: actNumber,
          result: 'success',
          details: {
            title: actData.title,
            volume_number: actData.volumeNumber,
            content_hash: contentHash,
            content_language: contentLanguage,
            reason: state.forceReExtract.reason || 'user_requested'
          }
        });
        
        state.forceReExtract = null; // Clear the flag
      } else {
        // New extraction - update manifest with content hash and language
        // Requirements: 10.2 - Store content_hash in manifest entry
        // Requirements: 11.6 - Store content_language in manifest entry
        const updatedManifest = BDLawCorpusManifest.updateCorpusManifest(manifest, {
          internal_id: actNumber,
          title: actData.title,
          volume_number: actData.volumeNumber,
          capturedAt: actData.capturedAt,
          content: actData.content,
          content_hash: contentHash,
          content_language: contentLanguage,
          cross_reference_count: 0
        });
        await BDLawCorpusManifest.saveCorpusManifest(updatedManifest);
        
        // Requirements: 10.5 - Log extract operation
        BDLawCorpusManifest.logExtractionOperation({
          type: 'extract',
          internal_id: actNumber,
          result: 'success',
          details: {
            title: actData.title,
            volume_number: actData.volumeNumber,
            content_hash: contentHash,
            content_language: contentLanguage,
            content_length: content.length
          }
        });
      }

      // Add to captured acts
      state.capturedActs.push(actData);
      
      // Remove from queue if present
      state.queue = state.queue.filter(q => q.actNumber !== actNumber);
      
      await saveToStorage();
      updateQueueBadge();
      updateExportStats();
      showPreview(actData);
      
      alert(`Act ${actNumber} captured successfully!`);
    } catch (e) {
      console.error('Act capture failed:', e);
      
      // Requirements: 10.5 - Log extraction errors
      const actMatch = state.currentUrl?.match(/act-(?:details-)?(\d+)\.html/);
      const actNumber = actMatch ? actMatch[1] : 'unknown';
      BDLawCorpusManifest.logExtractionOperation({
        type: 'extract',
        internal_id: actNumber,
        result: 'error',
        details: { error: e.message }
      });
      
      alert('Failed to capture act: ' + e.message);
    }
  }

  async function addCurrentActToQueue() {
    const actMatch = state.currentUrl.match(/act-(?:details-)?(\d+)\.html/);
    if (!actMatch) {
      alert('Cannot determine act number from URL');
      return;
    }

    const actNumber = actMatch[1];
    
    // Requirements: 27.1, 27.2 - Check for existing act_number before adding
    if (isDuplicateInQueue(actNumber)) {
      // Requirements: 27.2 - Display notification when duplicate is skipped
      alert(`Act ${actNumber} is already in the queue.`);
      return;
    }
    
    if (isAlreadyCaptured(actNumber)) {
      // Requirements: 27.2 - Display notification when duplicate is skipped
      alert(`Act ${actNumber} has already been captured.`);
      return;
    }

    state.queue.push({
      id: Date.now() + '_' + actNumber,
      actNumber,
      title: document.title || `Act ${actNumber}`,
      url: state.currentUrl,
      status: 'pending',
      addedAt: new Date().toISOString()
    });

    await saveToStorage();
    updateQueueBadge();
    
    alert(`Act ${actNumber} added to queue.`);
  }

  function showPreview(actData) {
    $('previewSection').classList.remove('hidden');
    $('previewTitle').textContent = actData.title || 'Untitled';
    $('previewChars').textContent = (actData.content?.length || 0).toLocaleString();
    
    // Display section counts
    const sectionCounts = actData.sections?.counts || {};
    $('previewSections').textContent = `ধারা: ${sectionCounts['ধারা'] || 0}, অধ্যায়: ${sectionCounts['অধ্যায়'] || 0}, তফসিল: ${sectionCounts['তফসিল'] || 0}`;
    
    // Detect and display amendment markers
    // Requirements: 25.5 - Display amendment markers with distinct visual highlighting
    const content = actData.content || '';
    const amendments = BDLawExtractor.detectAmendmentMarkers(content);
    
    // Count amendments by type
    const amendmentCounts = {
      'বিলুপ্ত': 0,
      'সংশোধিত': 0,
      'প্রতিস্থাপিত': 0
    };
    amendments.forEach(a => {
      if (amendmentCounts.hasOwnProperty(a.type)) {
        amendmentCounts[a.type]++;
      }
    });
    
    // Display amendment count alongside section counts
    const totalAmendments = amendments.length;
    const amendmentText = totalAmendments > 0 
      ? `বিলুপ্ত: ${amendmentCounts['বিলুপ্ত']}, সংশোধিত: ${amendmentCounts['সংশোধিত']}, প্রতিস্থাপিত: ${amendmentCounts['প্রতিস্থাপিত']}`
      : 'None detected';
    $('previewAmendments').textContent = amendmentText;
    
    // Show/hide amendment stats based on whether any were found
    const amendmentStatsEl = $('amendmentStats');
    if (amendmentStatsEl) {
      amendmentStatsEl.classList.toggle('hidden', totalAmendments === 0);
    }
    
    // Apply visual highlighting to preview text
    // Requirements: 25.5 - Use different color for বিলুপ্ত (deleted) vs সংশোধিত (amended)
    const previewContent = content.substring(0, 500);
    const highlightedPreview = highlightAmendmentMarkers(previewContent);
    $('previewText').innerHTML = highlightedPreview + (content.length > 500 ? '...' : '');
  }

  /**
   * Highlight amendment markers in text with distinct colors
   * Requirements: 25.5 - Display amendment markers with distinct visual highlighting
   * - বিলুপ্ত (deleted) - red tone
   * - সংশোধিত (amended) - orange tone
   * - প্রতিস্থাপিত (substituted) - yellow tone
   * 
   * @param {string} text - The text to highlight
   * @returns {string} HTML string with highlighted markers
   */
  function highlightAmendmentMarkers(text) {
    if (!text) return '';
    
    // Escape HTML first to prevent XSS
    let escaped = escapeHtml(text);
    
    // Apply highlighting for each amendment marker type
    // Use different CSS classes for different marker types
    const markerClasses = {
      'বিলুপ্ত': 'amendment-deleted',      // Red - deleted/abolished
      'সংশোধিত': 'amendment-amended',      // Orange - amended
      'প্রতিস্থাপিত': 'amendment-substituted' // Yellow - substituted
    };
    
    for (const [marker, cssClass] of Object.entries(markerClasses)) {
      const regex = new RegExp(marker, 'g');
      escaped = escaped.replace(regex, `<span class="amendment-marker ${cssClass}">${marker}</span>`);
    }
    
    return escaped;
  }

  // ============================================
  // QUEUE MANAGEMENT
  // ============================================
  function updateQueueBadge() {
    const badge = $('queueBadge');
    const pendingCount = state.queue.filter(q => q.status === 'pending').length;
    const failedCount = state.failedExtractions?.length || 0;
    
    badge.textContent = pendingCount;
    badge.classList.toggle('hidden', pendingCount === 0 && failedCount === 0);
    badge.classList.toggle('has-failures', failedCount > 0);
    
    // Update badge title for accessibility
    if (failedCount > 0) {
      badge.title = `${pendingCount} pending, ${failedCount} failed`;
    } else {
      badge.title = `${pendingCount} pending`;
    }
  }

  function renderQueue() {
    const listEl = $('queueList');
    const pending = state.queue.filter(q => q.status === 'pending').length;
    const completed = state.queue.filter(q => q.status === 'completed').length;
    
    $('queueTotal').textContent = state.queue.length;
    $('queuePending').textContent = pending;
    $('queueCompleted').textContent = completed;
    
    $('processQueueBtn').disabled = pending === 0 || state.isProcessing;
    $('clearQueueBtn').disabled = state.queue.length === 0;

    if (state.queue.length === 0) {
      listEl.innerHTML = '<p class="empty-message">Queue is empty. Add acts from a volume page.</p>';
      return;
    }

    listEl.innerHTML = state.queue.map(item => `
      <div class="queue-item ${item.status}" data-id="${item.id}">
        <input type="checkbox" class="queue-item-checkbox" ${item.status === 'completed' ? 'checked disabled' : ''}>
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(item.title || `Act ${item.actNumber}`)}</div>
          <div class="queue-item-meta">Act #${item.actNumber} ${item.volumeNumber ? `• Vol ${item.volumeNumber}` : ''}</div>
        </div>
        <span class="queue-item-status">${getStatusIcon(item.status)}</span>
        <button class="queue-item-remove" data-id="${item.id}" title="Remove">×</button>
      </div>
    `).join('');

    // Bind remove buttons
    listEl.querySelectorAll('.queue-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromQueue(btn.dataset.id);
      });
    });
    
    // Also render failed extractions when queue is rendered
    renderFailedExtractions();
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'pending': return '⏳';
      case 'processing': return '🔄';
      case 'completed': return '✅';
      case 'error': return '❌';
      case 'retrying': return '🔁';
      default: return '⏳';
    }
  }

  async function removeFromQueue(id) {
    state.queue = state.queue.filter(q => q.id !== id);
    await saveToStorage();
    updateQueueBadge();
    renderQueue();
  }

  async function clearQueue() {
    if (!confirm('Clear all items from queue?')) return;
    
    state.queue = [];
    await saveToStorage();
    updateQueueBadge();
    renderQueue();
  }

  // ============================================
  // LEGAL CONTENT SIGNAL DETECTION
  // Requirements: 2.2, 2.3, 2.8
  // ============================================
  
  /**
   * Check for legal content signals in page
   * Requirements: 2.2, 2.3, 2.8
   * 
   * Checks for presence of legal content indicators:
   * - Act title presence
   * - Enactment clause (EN: "It is hereby enacted", BN: "এতদ্দ্বারা প্রণীত")
   * - First numbered section (EN: "1." or BN: "১.")
   * 
   * @param {number} tabId - Chrome tab ID
   * @returns {Promise<Object>} { hasSignal: boolean, signalType?: string, error?: string }
   */
  async function checkLegalContentSignals(tabId) {
    const { LEGAL_CONTENT_SIGNALS } = BDLawQueue;
    
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (titleSelectors, enactmentPatternStrings, sectionPatternStrings) => {
          // Check for act title
          for (const sel of titleSelectors) {
            try {
              const el = document.querySelector(sel);
              if (el && el.textContent && el.textContent.trim().length > 0) {
                return { hasSignal: true, signalType: 'act_title' };
              }
            } catch (e) {
              // Invalid selector, skip
            }
          }
          
          // Get body text for pattern matching (using textContent per legal-integrity-rules)
          const bodyText = document.body?.textContent || '';
          
          // Check for enactment clause (English or Bengali)
          for (const patternStr of enactmentPatternStrings) {
            const pattern = new RegExp(patternStr.source, patternStr.flags);
            if (pattern.test(bodyText)) {
              return { hasSignal: true, signalType: 'enactment_clause' };
            }
          }
          
          // Check for first numbered section (English or Bengali)
          for (const patternStr of sectionPatternStrings) {
            const pattern = new RegExp(patternStr.source, patternStr.flags);
            if (pattern.test(bodyText)) {
              return { hasSignal: true, signalType: 'first_section' };
            }
          }
          
          return { hasSignal: false };
        },
        args: [
          LEGAL_CONTENT_SIGNALS.ACT_TITLE_SELECTORS,
          // Convert RegExp to serializable format
          LEGAL_CONTENT_SIGNALS.ENACTMENT_PATTERNS.map(r => ({ source: r.source, flags: r.flags })),
          LEGAL_CONTENT_SIGNALS.SECTION_PATTERNS.map(r => ({ source: r.source, flags: r.flags }))
        ]
      });
      
      return result;
    } catch (e) {
      console.error('Legal content signal check error:', e);
      return { hasSignal: false, error: e.message };
    }
  }

  // ============================================
  // EXTRACTION READINESS DETECTION
  // Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
  // ============================================
  
  /**
   * Wait for extraction readiness with legal content signal verification
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
   * 
   * CORRECTED LOGIC:
   * - Page is extractable if readyState is "interactive" OR "complete"
   * - AND at least one legal signal exists in DOM textContent
   * - Do NOT require readyState === "complete" (pages may never reach it due to hanging resources)
   * 
   * @param {number} tabId - Chrome tab ID
   * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
   * @param {number} minThreshold - Minimum content threshold (default: 100)
   * @returns {Promise<Object>} { ready: boolean, reason?: string, signalType?: string }
   */
  async function waitForExtractionReadiness(tabId, timeoutMs = 30000, minThreshold = 100) {
    const { FAILURE_REASONS } = BDLawQueue;
    const startTime = Date.now();
    let domInteractive = false; // Track if DOM is at least interactive
    
    return new Promise((resolve) => {
      const checkReadiness = async () => {
        const elapsedMs = Date.now() - startTime;
        
        // Check if timeout exceeded
        if (elapsedMs > timeoutMs) {
          // Distinguish between dom_not_ready and content_selector_mismatch
          if (domInteractive) {
            // DOM was interactive but no legal content signals detected
            resolve({ ready: false, reason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH });
          } else {
            // DOM never became interactive - true timeout
            resolve({ ready: false, reason: FAILURE_REASONS.DOM_NOT_READY });
          }
          return;
        }
        
        try {
          // Step 1: Check document.readyState
          // FIXED: Accept "interactive" OR "complete" - do NOT require "complete"
          // Many bdlaws pages render content before "complete" due to hanging resources
          const [{ result: readyState }] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => document.readyState
          });
          
          const readyStateOk = readyState === 'interactive' || readyState === 'complete';
          
          if (!readyStateOk) {
            // Still loading, wait
            setTimeout(checkReadiness, 500);
            return;
          }
          
          // Mark DOM as interactive once we reach interactive or complete
          domInteractive = true;
          
          // Step 2: Check for legal content signals
          // Requirements: 2.2, 2.3, 2.8 - Verify at least one legal content signal
          const signalResult = await checkLegalContentSignals(tabId);
          
          if (signalResult.hasSignal) {
            // Legal signal found - page is ready for extraction
            resolve({ ready: true, signalType: signalResult.signalType });
            return;
          }
          
          // Step 3: Fallback - check minimum content threshold with legal signal in body
          const [{ result: fallbackResult }] = await chrome.scripting.executeScript({
            target: { tabId },
            func: (threshold) => {
              const bodyText = document.body?.textContent || '';
              const contentLength = bodyText.length;
              
              // Check for any legal signal in body text
              // Bengali legal markers
              const hasLegalSignal = 
                /[০-৯]+৷/.test(bodyText) ||           // Bengali numeral + danda
                /ধারা/.test(bodyText) ||              // Section marker
                /যেহেতু/.test(bodyText) ||            // Preamble
                /সেহেতু/.test(bodyText) ||            // Enactment
                /তফসিল/.test(bodyText) ||             // Schedule
                /অধ্যায়/.test(bodyText) ||            // Chapter
                /\bSection\b/i.test(bodyText) ||      // English section
                /\bChapter\b/i.test(bodyText) ||      // English chapter
                /\bSchedule\b/i.test(bodyText) ||     // English schedule
                /\bWHEREAS\b/i.test(bodyText) ||      // English preamble
                /\bBe\s+it\s+enacted\b/i.test(bodyText); // English enactment
              
              return { contentLength, hasLegalSignal };
            },
            args: [minThreshold]
          });
          
          if (fallbackResult.contentLength >= minThreshold && fallbackResult.hasLegalSignal) {
            resolve({ ready: true, signalType: 'content_threshold_with_signal' });
            return;
          }
          
          // No signals detected yet, keep waiting if within timeout
          if (elapsedMs < timeoutMs) {
            setTimeout(checkReadiness, 500);
            return;
          }
          
          // Timeout reached with DOM interactive but no legal signals
          resolve({ ready: false, reason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH });
          
        } catch (e) {
          // Handle Chrome error page injection failure
          if (e.message && e.message.includes('showing error page')) {
            console.error('Tab is showing error page, cannot inject script:', e);
            resolve({ ready: false, reason: FAILURE_REASONS.NETWORK_ERROR });
            return;
          }
          console.error('Extraction readiness check error:', e);
          resolve({ ready: false, reason: FAILURE_REASONS.NETWORK_ERROR });
        }
      };
      
      checkReadiness();
    });
  }
  
  /**
   * Legacy alias for backward compatibility
   * @deprecated Use waitForExtractionReadiness instead
   */
  async function waitForDOMReadiness(tabId, timeoutMs = 30000) {
    return waitForExtractionReadiness(tabId, timeoutMs);
  }

  // ============================================
  // QUEUE PROCESSING
  // Requirements: 1.2, 1.3, 2.1-2.5, 3.1-3.6, 5.1
  // ============================================
  async function processQueue() {
    if (state.isProcessing) return;
    
    const pendingItems = state.queue.filter(q => q.status === 'pending');
    if (pendingItems.length === 0) {
      alert('No pending items in queue.');
      return;
    }

    // Get queue configuration
    const config = BDLawQueue.getQueueConfig();
    const { FAILURE_REASONS } = BDLawQueue;

    if (!confirm(`Process ${pendingItems.length} items?\n\nThis will open each act page and extract content.\nDelay between extractions: ${config.extraction_delay_ms / 1000}s\nMax retries: ${config.max_retry_attempts}`)) {
      return;
    }

    state.isProcessing = true;
    state.queueStats = { successCount: 0, failedCount: 0, retriedCount: 0 };
    $('processingStatus').classList.remove('hidden');
    $('processQueueBtn').disabled = true;
    
    // Requirements: 8.5 - Save processing state to detect interruptions
    await saveProcessingState(true, pendingItems);

    let processed = 0;
    const total = pendingItems.length;

    for (const item of pendingItems) {
      try {
        // Update status
        item.status = 'processing';
        renderQueue();
        updateProgress(processed, total, `Processing: ${item.title || item.actNumber}`);

        // Open the act page in current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.update(tab.id, { url: item.url });
        
        // Wait for page to load
        await waitForPageLoad(tab.id);
        
        // FIX: Detect error pages BEFORE attempting script injection
        // Chrome forbids script injection into error pages
        const tabInfo = await chrome.tabs.get(tab.id);
        if (isErrorPage(tabInfo)) {
          console.error(`Error page detected for ${item.actNumber}: ${tabInfo.url}`);
          item.status = 'error';
          item.error = FAILURE_REASONS.NETWORK_ERROR;
          state.failedExtractions = BDLawQueue.addFailedExtraction(
            state.failedExtractions,
            item,
            FAILURE_REASONS.NETWORK_ERROR,
            1,
            config.max_retry_attempts
          );
          state.queueStats.failedCount++;
          processed++;
          await saveToStorage();
          renderQueue();
          continue;
        }
        
        // Requirements: 2.1-2.5 - Wait for DOM readiness
        const domReadiness = await waitForDOMReadiness(tab.id, config.dom_readiness_timeout_ms);
        
        if (!domReadiness.ready) {
          // DOM readiness failed - add to failed extractions
          console.error(`DOM readiness failed for ${item.actNumber}:`, domReadiness.reason);
          item.status = 'error';
          item.error = domReadiness.reason;
          state.failedExtractions = BDLawQueue.addFailedExtraction(
            state.failedExtractions,
            item,
            domReadiness.reason,
            1,
            config.max_retry_attempts
          );
          state.queueStats.failedCount++;
          processed++;
          await saveToStorage();
          renderQueue();
          continue;
        }

        // Requirements: 1.2, 1.3 - Apply configurable delay AFTER DOM readiness
        updateProgress(processed, total, `Waiting ${config.extraction_delay_ms / 1000}s before extraction...`);
        await new Promise(r => setTimeout(r, config.extraction_delay_ms));

        // Ensure content script
        await ensureContentScript(tab.id);

        // Extract content
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'bdlaw:extractAct' 
        });

        // Requirements: 3.1-3.6, 3.8, 3.9 - Validate extraction result
        // Pass domReadiness to distinguish CONTENT_SELECTOR_MISMATCH from CONTAINER_NOT_FOUND
        const validation = BDLawQueue.validateExtraction(response, config.minimum_content_threshold, domReadiness);
        
        if (validation.valid) {
          // Save captured act with structured data
          // Requirements: 26.1, 26.2, 26.3 - Store structured data from extraction
          const actData = {
            id: item.id,
            actNumber: item.actNumber,
            title: response.title || item.title,
            content: response.content || '',
            url: item.url,
            volumeNumber: item.volumeNumber,
            sections: response.sections || {},
            structured_sections: response.structured_sections || [],
            tables: response.tables || [],
            amendments: response.amendments || [],
            metadata: BDLawMetadata.generate(item.url),
            capturedAt: new Date().toISOString()
          };

          state.capturedActs.push(actData);
          item.status = 'completed';
          state.queueStats.successCount++;
        } else {
          // Extraction validation failed - add to failed extractions
          console.error(`Extraction validation failed for ${item.actNumber}:`, validation.reason);
          item.status = 'error';
          item.error = validation.reason;
          state.failedExtractions = BDLawQueue.addFailedExtraction(
            state.failedExtractions,
            item,
            validation.reason,
            1,
            config.max_retry_attempts
          );
          state.queueStats.failedCount++;
        }
      } catch (e) {
        console.error(`Failed to process ${item.actNumber}:`, e);
        item.status = 'error';
        item.error = e.message;
        state.failedExtractions = BDLawQueue.addFailedExtraction(
          state.failedExtractions,
          item,
          FAILURE_REASONS.EXTRACTION_ERROR,
          1,
          config.max_retry_attempts
        );
        state.queueStats.failedCount++;
      }

      processed++;
      await saveToStorage();
      renderQueue();
    }

    // Remove completed items from queue
    state.queue = state.queue.filter(q => q.status !== 'completed');
    await saveToStorage();

    // Requirements: 5.1 - Process retry queue after main queue
    await processRetryQueue();

    state.isProcessing = false;
    $('processingStatus').classList.add('hidden');
    $('processQueueBtn').disabled = false;
    
    // Requirements: 8.5 - Clear processing state after successful completion
    await clearProcessingState();
    
    updateQueueBadge();
    renderQueue();
    updateExportStats();

    // Show summary with success/failed/retried counts
    const stats = state.queueStats;
    let message = `Processing complete!\n`;
    message += `✅ Successful: ${stats.successCount}\n`;
    if (stats.failedCount > 0) {
      message += `❌ Failed: ${stats.failedCount}\n`;
    }
    if (stats.retriedCount > 0) {
      message += `🔁 Retried: ${stats.retriedCount}\n`;
    }
    message += `\n${state.capturedActs.length} total acts captured.`;
    
    if (state.failedExtractions.length > 0) {
      const permanentlyFailed = state.failedExtractions.filter(f => !BDLawQueue.shouldRetry(f)).length;
      if (permanentlyFailed > 0) {
        message += `\n\n⚠️ ${permanentlyFailed} act(s) permanently failed after max retries.`;
      }
    }
    
    alert(message);
  }

  // ============================================
  // RETRY QUEUE PROCESSING
  // Requirements: 5.1, 5.3, 5.4, 5.5
  // ============================================
  
  /**
   * Process failed extractions that can be retried
   * Requirements: 5.1, 5.3, 5.4, 5.7, 5.8, 5.9, 5.10
   */
  async function processRetryQueue() {
    const config = BDLawQueue.getQueueConfig();
    const { FAILURE_REASONS } = BDLawQueue;
    
    // Get items that can be retried
    const retryableItems = state.failedExtractions.filter(f => BDLawQueue.shouldRetry(f));
    
    if (retryableItems.length === 0) {
      return;
    }
    
    state.isRetrying = true;
    updateProgress(0, retryableItems.length, 'Processing retry queue...');
    
    // Requirements: 5.8 - Get broader selectors for retry attempts
    const selectorConfig = BDLawQueue.getBroaderContentSelectors();
    
    let retryIndex = 0;
    
    for (const failedEntry of retryableItems) {
      const attemptNumber = failedEntry.retry_count + 1;
      
      // Requirements: 5.3 - Apply exponential backoff delay
      const retryDelay = BDLawQueue.calculateRetryDelay(attemptNumber, config.retry_base_delay_ms);
      updateProgress(retryIndex, retryableItems.length, `Retry #${attemptNumber} for Act ${failedEntry.act_number} (waiting ${retryDelay / 1000}s)...`);
      await new Promise(r => setTimeout(r, retryDelay));
      
      // Requirements: 5.7 - Track selector strategy for this attempt
      const useBroaderSelectors = true; // Always use broader selectors on retry
      const selectorStrategy = BDLawQueue.getSelectorStrategyLabel(useBroaderSelectors);
      
      try {
        // Open the act page
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.update(tab.id, { url: failedEntry.url });
        
        // Wait for page to load
        await waitForPageLoad(tab.id);
        
        // FIX: Detect error pages BEFORE attempting script injection
        const tabInfo = await chrome.tabs.get(tab.id);
        if (isErrorPage(tabInfo)) {
          console.error(`Error page detected for retry of ${failedEntry.act_number}: ${tabInfo.url}`);
          // Do NOT retry error pages - mark as network_error and move on
          state.failedExtractions = BDLawQueue.addFailedExtraction(
            state.failedExtractions,
            { 
              id: failedEntry.act_id, 
              actNumber: failedEntry.act_number, 
              url: failedEntry.url, 
              title: failedEntry.title,
              selector_strategy: selectorStrategy
            },
            FAILURE_REASONS.NETWORK_ERROR,
            attemptNumber,
            config.max_retry_attempts
          );
          state.queueStats.retriedCount++;
          retryIndex++;
          await saveToStorage();
          continue;
        }
        
        // Wait for DOM readiness
        const domReadiness = await waitForDOMReadiness(tab.id, config.dom_readiness_timeout_ms);
        
        if (!domReadiness.ready) {
          // Update failed entry with new attempt
          // Requirements: 5.7 - Include selector strategy in attempt history
          state.failedExtractions = BDLawQueue.addFailedExtraction(
            state.failedExtractions,
            { 
              id: failedEntry.act_id, 
              actNumber: failedEntry.act_number, 
              url: failedEntry.url, 
              title: failedEntry.title,
              selector_strategy: selectorStrategy  // Requirements: 5.7 - Log selector strategy
            },
            domReadiness.reason,
            attemptNumber,
            config.max_retry_attempts
          );
          state.queueStats.retriedCount++;
          retryIndex++;
          await saveToStorage();
          continue;
        }
        
        // Apply delay after DOM readiness
        await new Promise(r => setTimeout(r, config.extraction_delay_ms));
        
        // Ensure content script
        await ensureContentScript(tab.id);
        
        // Extract content with broader selectors
        // Requirements: 5.8 - On retry, use expanded selector set
        // Requirements: 5.9 - Never infer missing text
        // Requirements: 5.10 - Never downgrade integrity rules
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'bdlaw:extractAct',
          useBroaderSelectors: useBroaderSelectors,
          broaderSelectors: selectorConfig.broader
        });
        
        // Validate extraction
        // Requirements: 3.8, 3.9 - Pass domReadiness to distinguish selector mismatch from container not found
        const validation = BDLawQueue.validateExtraction(response, config.minimum_content_threshold, domReadiness);
        
        if (validation.valid) {
          // Success! Save the act
          const actData = {
            id: failedEntry.act_id,
            actNumber: failedEntry.act_number,
            title: response.title || failedEntry.title,
            content: response.content || '',
            url: failedEntry.url,
            volumeNumber: 'unknown', // May not have volume info from retry
            sections: response.sections || {},
            structured_sections: response.structured_sections || [],
            tables: response.tables || [],
            amendments: response.amendments || [],
            metadata: BDLawMetadata.generate(failedEntry.url),
            capturedAt: new Date().toISOString(),
            // Requirements: 5.7 - Record selector strategy used
            selector_strategy_used: response.selector_strategy_used || selectorStrategy,
            recovered_via_retry: true,
            retry_attempt: attemptNumber
          };
          
          state.capturedActs.push(actData);
          
          // Remove from failed extractions
          state.failedExtractions = state.failedExtractions.filter(f => f.act_id !== failedEntry.act_id);
          
          state.queueStats.successCount++;
          state.queueStats.retriedCount++;
        } else {
          // Still failing - update entry with selector strategy
          // Requirements: 5.7 - Include selector strategy in attempt history
          state.failedExtractions = BDLawQueue.addFailedExtraction(
            state.failedExtractions,
            { 
              id: failedEntry.act_id, 
              actNumber: failedEntry.act_number, 
              url: failedEntry.url, 
              title: failedEntry.title,
              selector_strategy: selectorStrategy  // Requirements: 5.7 - Log selector strategy
            },
            validation.reason,
            attemptNumber,
            config.max_retry_attempts
          );
          state.queueStats.retriedCount++;
        }
      } catch (e) {
        console.error(`Retry failed for ${failedEntry.act_number}:`, e);
        // Requirements: 5.7 - Include selector strategy even on error
        state.failedExtractions = BDLawQueue.addFailedExtraction(
          state.failedExtractions,
          { 
            id: failedEntry.act_id, 
            actNumber: failedEntry.act_number, 
            url: failedEntry.url, 
            title: failedEntry.title,
            selector_strategy: selectorStrategy  // Requirements: 5.7 - Log selector strategy
          },
          FAILURE_REASONS.EXTRACTION_ERROR,
          attemptNumber,
          config.max_retry_attempts
        );
        state.queueStats.retriedCount++;
      }
      
      retryIndex++;
      await saveToStorage();
    }
    
    state.isRetrying = false;
  }

  function updateProgress(current, total, text) {
    const percent = Math.round((current / total) * 100);
    $('progressFill').style.width = percent + '%';
    $('processingText').textContent = text;
  }

  async function waitForPageLoad(tabId) {
    return new Promise((resolve) => {
      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 30000);
    });
  }

  /**
   * Detect if a tab is showing an error page
   * Chrome forbids script injection into error pages (chrome-error://, 404, etc.)
   * 
   * @param {Object} tabInfo - Chrome tab info object from chrome.tabs.get()
   * @returns {boolean} True if tab is showing an error page
   */
  function isErrorPage(tabInfo) {
    if (!tabInfo) return true;
    
    const url = tabInfo.url || '';
    const title = tabInfo.title || '';
    
    // Chrome internal error pages
    if (url.startsWith('chrome-error://')) return true;
    if (url.startsWith('chrome://')) return true;
    
    // Common HTTP error indicators in title
    const errorTitlePatterns = [
      /404/i,
      /not found/i,
      /error/i,
      /500/i,
      /503/i,
      /502/i,
      /server error/i,
      /connection refused/i,
      /err_/i
    ];
    
    for (const pattern of errorTitlePatterns) {
      if (pattern.test(title)) return true;
    }
    
    // Empty or about:blank pages
    if (url === '' || url === 'about:blank') return true;
    
    return false;
  }

  // ============================================
  // EXPORT
  // ============================================
  async function updateExportStats() {
    const acts = state.capturedActs;
    const volumes = new Set(acts.map(a => a.volumeNumber).filter(Boolean));
    const totalChars = acts.reduce((sum, a) => sum + (a.content?.length || 0), 0);

    $('exportActCount').textContent = acts.length;
    $('exportVolumeCount').textContent = volumes.size;
    $('exportTotalChars').textContent = formatNumber(totalChars);

    // Update button states
    $('exportAllBtn').disabled = acts.length === 0;
    $('exportVolumeCatalogBtn').disabled = !state.currentVolume;
    
    // Update research document export buttons
    // Requirements: 8.5, 9.1, 9.2, 9.5 - Enable research document exports when acts are captured
    $('exportManifestBtn').disabled = acts.length === 0;
    $('exportResearchDocsBtn').disabled = acts.length === 0;
    
    // Update corpus statistics display
    // Requirements: 8.3 - Show corpus-level statistics
    await updateCorpusStatsDisplay();
    
    // Update manifest viewer
    // Requirements: 8.4 - Display corpus manifest contents
    await updateManifestViewer();
    
    // Render captured acts list for individual export
    renderCapturedActsList();
    
    // Update cleaning summary if checkbox is checked
    updateCleaningSummary();
  }

  /**
   * Update cleaning summary display in Export tab
   * Requirements: 8.1, 8.2, 8.3 - Show transformation summary when cleaning is enabled
   */
  function updateCleaningSummary() {
    const cleaningSummarySection = $('cleaningSummarySection');
    const cleaningSummaryContent = $('cleaningSummaryContent');
    const applyTextCleaningCheckbox = $('applyTextCleaning');
    
    if (!cleaningSummarySection || !cleaningSummaryContent) return;
    
    // Hide section if cleaning is not enabled or no acts captured
    if (!applyTextCleaningCheckbox?.checked || state.capturedActs.length === 0) {
      cleaningSummarySection.classList.add('hidden');
      return;
    }
    
    // Perform dry run on all captured acts to get transformation summary
    const transformationSummary = {
      encoding_repair: { count: 0, rules: new Set() },
      ocr_correction: { count: 0, corrections: new Set() },
      formatting: { count: 0, rules: new Set() }
    };
    
    let actsWithIssues = 0;
    
    for (const act of state.capturedActs) {
      if (!act.content) continue;
      
      // Dry run to detect transformations without applying them
      const result = BDLawQuality.cleanContent(act.content, {
        applyEncodingRepairs: true,
        applyOcrCorrections: true,
        applyFormatting: true,
        dryRun: true
      });
      
      if (result.transformations.length > 0) {
        actsWithIssues++;
        
        for (const t of result.transformations) {
          if (t.type === 'encoding_repair') {
            transformationSummary.encoding_repair.count += t.count;
            transformationSummary.encoding_repair.rules.add(t.rule);
          } else if (t.type === 'ocr_correction') {
            transformationSummary.ocr_correction.count += t.count;
            transformationSummary.ocr_correction.corrections.add(`${t.incorrect} → ${t.correct}`);
          } else if (t.type === 'formatting') {
            transformationSummary.formatting.count += t.count;
            transformationSummary.formatting.rules.add(t.rule);
          }
        }
      }
    }
    
    // Build summary HTML
    if (actsWithIssues === 0) {
      cleaningSummaryContent.innerHTML = '<p class="empty-message">No transformations needed for captured acts.</p>';
    } else {
      let summaryHtml = `<p class="cleaning-summary-intro">${actsWithIssues} of ${state.capturedActs.length} acts will be cleaned:</p>`;
      summaryHtml += '<ul class="cleaning-summary-list">';
      
      if (transformationSummary.encoding_repair.count > 0) {
        summaryHtml += `<li><strong>Encoding repairs:</strong> ${transformationSummary.encoding_repair.count} fixes`;
        summaryHtml += `<br><small>${Array.from(transformationSummary.encoding_repair.rules).join(', ')}</small></li>`;
      }
      
      if (transformationSummary.ocr_correction.count > 0) {
        summaryHtml += `<li><strong>OCR corrections:</strong> ${transformationSummary.ocr_correction.count} fixes`;
        summaryHtml += `<br><small>${Array.from(transformationSummary.ocr_correction.corrections).join(', ')}</small></li>`;
      }
      
      if (transformationSummary.formatting.count > 0) {
        summaryHtml += `<li><strong>Formatting improvements:</strong> ${transformationSummary.formatting.count} changes`;
        summaryHtml += `<br><small>${Array.from(transformationSummary.formatting.rules).map(r => r.replace(/_/g, ' ')).join(', ')}</small></li>`;
      }
      
      summaryHtml += '</ul>';
      cleaningSummaryContent.innerHTML = summaryHtml;
    }
    
    cleaningSummarySection.classList.remove('hidden');
  }

  /**
   * Update corpus statistics display in Export tab
   * Requirements: 8.3 - Show total acts, volumes, characters, cross-reference coverage, extraction date range
   */
  async function updateCorpusStatsDisplay() {
    const corpusStatsSection = $('corpusStatsSection');
    if (!corpusStatsSection) return;

    try {
      const manifest = await BDLawCorpusManifest.loadCorpusManifest();
      
      // Show section if we have any acts
      if (manifest.corpus_stats.total_acts > 0) {
        corpusStatsSection.classList.remove('hidden');
        
        // Update coverage percentage
        const coverage = manifest.cross_reference_coverage || {};
        $('corpusCoveragePercent').textContent = `${coverage.coverage_percentage || 0}%`;
        
        // Update referenced acts counts
        $('corpusReferencedInCorpus').textContent = (coverage.referenced_acts_in_corpus || []).length;
        $('corpusReferencedMissing').textContent = (coverage.referenced_acts_missing || []).length;
        
        // Update extraction date range
        const dateRange = manifest.corpus_stats.extraction_date_range || {};
        if (dateRange.earliest && dateRange.latest) {
          const earliest = new Date(dateRange.earliest).toLocaleDateString();
          const latest = new Date(dateRange.latest).toLocaleDateString();
          $('corpusDateRange').textContent = earliest === latest 
            ? earliest 
            : `${earliest} - ${latest}`;
        } else {
          $('corpusDateRange').textContent = 'N/A';
        }
      } else {
        corpusStatsSection.classList.add('hidden');
      }
    } catch (e) {
      console.error('Failed to update corpus stats display:', e);
      corpusStatsSection.classList.add('hidden');
    }
  }

  /**
   * Update manifest viewer display
   * Requirements: 8.4 - Display corpus manifest contents and missing referenced acts
   */
  async function updateManifestViewer() {
    const manifestViewerSection = $('manifestViewerSection');
    if (!manifestViewerSection) return;

    try {
      const manifest = await BDLawCorpusManifest.loadCorpusManifest();
      
      // Show section if we have any acts
      if (manifest.corpus_stats.total_acts > 0) {
        manifestViewerSection.classList.remove('hidden');
        
        // Render acts list
        renderManifestActsList(manifest);
        
        // Render missing referenced acts
        renderMissingActsList(manifest);
      } else {
        manifestViewerSection.classList.add('hidden');
      }
    } catch (e) {
      console.error('Failed to update manifest viewer:', e);
      manifestViewerSection.classList.add('hidden');
    }
  }

  /**
   * Render the list of acts in the corpus manifest
   * Requirements: 8.4 - Display corpus manifest contents
   * Requirements: 11.6 - Display language column in acts list
   */
  function renderManifestActsList(manifest) {
    const listEl = $('manifestActsList');
    if (!listEl) return;

    const acts = Object.values(manifest.acts || {});
    
    if (acts.length === 0) {
      listEl.innerHTML = '<p class="empty-message">No acts in manifest.</p>';
      return;
    }

    // Sort by capture timestamp (most recent first)
    acts.sort((a, b) => new Date(b.capture_timestamp) - new Date(a.capture_timestamp));

    listEl.innerHTML = acts.map(act => {
      const captureDate = act.capture_timestamp 
        ? new Date(act.capture_timestamp).toLocaleDateString()
        : 'Unknown';
      
      // Requirements: 11.6 - Display content_language in manifest viewer
      const language = act.content_language || 'english';
      const languageDisplay = language === 'bengali' ? 'বাং' : 'EN';
      const languageClass = language === 'bengali' ? 'bengali' : 'english';
      const languageTitle = language === 'bengali' ? 'Bengali (বাংলা)' : 'English';
      
      return `
        <div class="manifest-item">
          <div class="manifest-item-info">
            <div class="manifest-item-title">${escapeHtml(act.title || `Act ${act.internal_id}`)}</div>
            <div class="manifest-item-meta">
              ID: ${act.internal_id} • Vol: ${act.volume_number || 'N/A'} • ${captureDate}
            </div>
          </div>
          <span class="manifest-item-language language-badge-small ${languageClass}" title="${languageTitle}">${languageDisplay}</span>
          <span class="manifest-item-status">✅</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Render the list of missing referenced acts
   * Requirements: 8.4 - Show missing referenced acts
   */
  function renderMissingActsList(manifest) {
    const listEl = $('manifestMissingActsList');
    if (!listEl) return;

    const missingActs = manifest.cross_reference_coverage?.referenced_acts_missing || [];
    
    if (missingActs.length === 0) {
      listEl.innerHTML = '<p class="empty-message">No missing referenced acts.</p>';
      return;
    }

    listEl.innerHTML = missingActs.map(actRef => `
      <div class="missing-act-item">
        <span>📌 ${escapeHtml(actRef)}</span>
      </div>
    `).join('');
  }

  /**
   * Toggle manifest viewer content visibility
   */
  function toggleManifestViewer() {
    const content = $('manifestViewerContent');
    const btn = $('toggleManifestViewerBtn');
    
    if (!content || !btn) return;
    
    const isHidden = content.classList.contains('hidden');
    content.classList.toggle('hidden');
    
    btn.querySelector('.btn-text').textContent = isHidden 
      ? 'Hide Manifest Details' 
      : 'Show Manifest Details';
  }

  /**
   * Show duplicate warning UI
   * Requirements: 7.1, 7.4 - Show warning when duplicate detected
   * Requirements: 11.7 - Display language information in duplicate warning
   * 
   * @param {Object} duplicateInfo - Information about the duplicate
   * @param {string} duplicateInfo.actNumber - The act number
   * @param {Object} duplicateInfo.existingEntry - The existing manifest entry
   * @param {string} [duplicateInfo.existingLanguage] - Language of existing version
   * @param {string} [duplicateInfo.newLanguage] - Language of new version
   * @param {boolean} [duplicateInfo.allowExtraction] - Whether extraction is allowed
   * @param {boolean} [duplicateInfo.replaceExisting] - Whether to replace existing
   */
  function showDuplicateWarning(duplicateInfo) {
    const section = $('duplicateWarningSection');
    if (!section) return;

    const { actNumber, existingEntry, existingLanguage, newLanguage, allowExtraction, replaceExisting } = duplicateInfo;
    
    $('duplicateWarningMessage').textContent = 
      `Act ${actNumber} (${existingEntry.title || 'Untitled'}) already exists in the corpus.`;
    
    const timestamp = existingEntry.capture_timestamp 
      ? new Date(existingEntry.capture_timestamp).toLocaleString()
      : 'Unknown';
    $('duplicatePreviousTimestamp').textContent = timestamp;
    
    // Requirements: 11.7 - Display language information
    const languageInfoEl = $('duplicateLanguageInfo');
    const existingLangEl = $('duplicateExistingLanguage');
    const newLangEl = $('duplicateNewLanguage');
    const langMessageEl = $('duplicateLanguageMessage');
    
    if (languageInfoEl && existingLanguage && newLanguage) {
      languageInfoEl.classList.remove('hidden');
      
      // Update existing language badge
      existingLangEl.textContent = existingLanguage === 'bengali' ? 'Bengali (বাংলা)' : 'English';
      existingLangEl.className = `language-badge ${existingLanguage}`;
      
      // Update new language badge
      newLangEl.textContent = newLanguage === 'bengali' ? 'Bengali (বাংলা)' : 'English';
      newLangEl.className = `language-badge ${newLanguage}`;
      
      // Show appropriate message based on language comparison
      if (existingLanguage === 'bengali' && newLanguage === 'english') {
        // Bengali exists, English blocked
        langMessageEl.textContent = 'Bengali version is preferred. English extraction is blocked.';
        langMessageEl.className = 'language-message english-blocked';
        langMessageEl.classList.remove('hidden');
        
        // Disable force re-extract button when English is blocked
        const forceBtn = $('forceReExtractBtn');
        if (forceBtn) {
          forceBtn.disabled = true;
          forceBtn.title = 'Cannot replace Bengali version with English';
        }
      } else if (existingLanguage === 'english' && newLanguage === 'bengali') {
        // English exists, Bengali can replace
        langMessageEl.textContent = 'Bengali version detected. Bengali is preferred and will replace the English version.';
        langMessageEl.className = 'language-message bengali-preferred';
        langMessageEl.classList.remove('hidden');
        
        // Enable force re-extract button for Bengali replacement
        const forceBtn = $('forceReExtractBtn');
        if (forceBtn) {
          forceBtn.disabled = false;
          forceBtn.title = 'Replace English version with Bengali';
          forceBtn.querySelector('.btn-text').textContent = 'Replace with Bengali';
        }
      } else {
        // Same language - standard duplicate
        langMessageEl.textContent = `Both versions are in ${existingLanguage === 'bengali' ? 'Bengali' : 'English'}.`;
        langMessageEl.className = 'language-message';
        langMessageEl.classList.remove('hidden');
        
        // Enable force re-extract button for same language
        const forceBtn = $('forceReExtractBtn');
        if (forceBtn) {
          forceBtn.disabled = false;
          forceBtn.title = 'Force re-extract this act';
          forceBtn.querySelector('.btn-text').textContent = 'Force Re-extract';
        }
      }
    } else {
      // No language info available - hide language section
      if (languageInfoEl) {
        languageInfoEl.classList.add('hidden');
      }
      
      // Reset force re-extract button
      const forceBtn = $('forceReExtractBtn');
      if (forceBtn) {
        forceBtn.disabled = false;
        forceBtn.title = 'Force re-extract this act';
        forceBtn.querySelector('.btn-text').textContent = 'Force Re-extract';
      }
    }
    
    // Store the duplicate info for force re-extract action
    state.pendingDuplicateInfo = duplicateInfo;
    
    section.classList.remove('hidden');
  }

  /**
   * Hide duplicate warning UI
   * Requirements: 11.7 - Reset language information display when hiding
   */
  function hideDuplicateWarning() {
    const section = $('duplicateWarningSection');
    if (section) {
      section.classList.add('hidden');
    }
    
    // Reset language info section
    const languageInfoEl = $('duplicateLanguageInfo');
    if (languageInfoEl) {
      languageInfoEl.classList.add('hidden');
    }
    
    // Reset force re-extract button
    const forceBtn = $('forceReExtractBtn');
    if (forceBtn) {
      forceBtn.disabled = false;
      forceBtn.title = 'Force re-extract this act';
      const btnText = forceBtn.querySelector('.btn-text');
      if (btnText) {
        btnText.textContent = 'Force Re-extract';
      }
    }
    
    state.pendingDuplicateInfo = null;
  }

  /**
   * Handle force re-extract button click
   * Requirements: 7.5 - Provide "Force Re-extract" option
   */
  async function handleForceReExtract() {
    if (!state.pendingDuplicateInfo) {
      alert('No duplicate information available.');
      return;
    }

    const { actNumber } = state.pendingDuplicateInfo;
    
    if (!confirm(`Are you sure you want to re-extract Act ${actNumber}?\n\nThe previous version will be archived.`)) {
      return;
    }

    // Set the force re-extract flag and trigger capture
    state.forceReExtract = {
      manifest: await BDLawCorpusManifest.loadCorpusManifest(),
      actNumber: actNumber
    };
    
    hideDuplicateWarning();
    
    // Trigger the capture
    await captureCurrentAct();
  }

  /**
   * Render the list of captured acts for individual export selection
   * Requirements: 31.7 - Add "Export Selected Act" option for individual act export
   * Requirements: 7.2 - Show completeness badge and flag icons for detected issues
   * Shows ML risk indicators and extraction risk warnings
   */
  function renderCapturedActsList() {
    const listEl = $('capturedActsList');
    if (!listEl) return;

    if (state.capturedActs.length === 0) {
      listEl.innerHTML = '<p class="empty-message">No acts captured yet.</p>';
      return;
    }

    listEl.innerHTML = state.capturedActs.map(act => {
      // Get quality assessment for this act
      const quality = getActQualityAssessment(act);
      const qualityIndicatorsHtml = renderQualityIndicators(quality);
      
      // Get integrity indicators (ML risk factors, extraction_risk)
      const integrityIndicatorsHtml = renderIntegrityIndicators(act, quality);
      
      return `
        <div class="captured-act-item" data-act-number="${act.actNumber}">
          <div class="captured-act-info">
            <div class="captured-act-title">${escapeHtml(act.title || `Act ${act.actNumber}`)}</div>
            <div class="captured-act-meta">Act #${act.actNumber} ${act.volumeNumber ? `• Vol ${act.volumeNumber}` : ''}</div>
          </div>
          ${integrityIndicatorsHtml}
          ${qualityIndicatorsHtml}
          <button class="export-single-btn" data-act-number="${act.actNumber}" title="Export this act">
            📄
          </button>
        </div>
      `;
    }).join('');

    // Bind export buttons for individual acts
    listEl.querySelectorAll('.export-single-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const actNumber = btn.dataset.actNumber;
        const act = state.capturedActs.find(a => a.actNumber === actNumber);
        if (act) {
          exportSingleAct(act);
        }
      });
    });

    // Bind click on captured act items to show quality details
    listEl.querySelectorAll('.captured-act-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking on export button
        if (e.target.closest('.export-single-btn')) return;
        
        const actNumber = item.dataset.actNumber;
        const act = state.capturedActs.find(a => a.actNumber === actNumber);
        if (act) {
          showQualityDetailsPanel(act);
        }
      });
    });
  }

  /**
   * Render integrity indicators HTML for an act
   * Shows ML risk factors and extraction risk warnings
   * 
   * @param {Object} act - The captured act data
   * @param {Object} quality - Quality assessment object
   * @returns {string} HTML string for integrity indicators
   */
  function renderIntegrityIndicators(act, quality) {
    if (!act) {
      return '';
    }

    let indicatorsHtml = '';
    
    // ML Risk Factors indicator (replaces safe_for_ml_training)
    // Shows warning-based indicator, no guarantees
    const hasRiskFactors = quality?.risks?.length > 0 || quality?.flags?.length > 0;
    const mlBadgeClass = hasRiskFactors ? 'has-risks' : 'no-risks';
    const mlBadgeIcon = hasRiskFactors ? '⚠' : '○';
    const mlBadgeText = hasRiskFactors ? 'ML Risks' : 'No Risks';
    const mlBadgeTitle = hasRiskFactors 
      ? 'ML risk factors detected - exploratory use only'
      : 'No risk factors detected - still exploratory use only';
    
    indicatorsHtml += `
      <span class="ml-risk-badge ${mlBadgeClass}" title="${mlBadgeTitle}">
        <span class="badge-icon">${mlBadgeIcon}</span>
        ${mlBadgeText}
      </span>
    `;
    
    // Extraction Risk warning
    // Requirements: 13.5 - Show extraction_risk warning if truncation possible
    const extractionRisk = act.extraction_risk || { possible_truncation: false, reason: 'none' };
    if (extractionRisk.possible_truncation) {
      const riskReason = extractionRisk.reason || 'unknown';
      const riskTitle = `Possible truncation detected: ${riskReason}`;
      
      indicatorsHtml += `
        <span class="extraction-risk-warning" title="${escapeHtml(riskTitle)}">
          <span class="warning-icon">⚠️</span>
          Truncation Risk
        </span>
      `;
    }
    
    return `<div class="integrity-indicators">${indicatorsHtml}</div>`;
  }

  /**
   * Get quality assessment for an act
   * Requirements: 7.2 - Assess completeness and detect issues
   * 
   * @param {Object} act - The captured act data
   * @returns {Object} Quality assessment { completeness, flags, issues }
   */
  function getActQualityAssessment(act) {
    if (!act || !act.content) {
      return BDLawQuality.createEmptyAssessment();
    }
    return BDLawQuality.validateContentQuality(act.content);
  }

  /**
   * Render quality indicators HTML for an act
   * Requirements: 7.2 - Show completeness badge and flag icons
   * 
   * @param {Object} quality - Quality assessment object
   * @returns {string} HTML string for quality indicators
   */
  function renderQualityIndicators(quality) {
    if (!quality) {
      return '';
    }

    const { completeness, flags } = quality;
    
    // Completeness badge
    const badgeClass = completeness || 'complete';
    const badgeText = completeness === 'complete' ? '✓' : 
                      completeness === 'partial' ? '⚠' : '?';
    const badgeTitle = completeness === 'complete' ? 'Complete' :
                       completeness === 'partial' ? 'Partial - Missing content' : 'Uncertain';
    
    // Flag icons
    let flagsHtml = '';
    if (flags && flags.length > 0) {
      const flagIcons = flags.map(flag => {
        switch (flag) {
          case 'missing_schedule':
            return `<span class="quality-flag-icon missing-schedule" title="Missing schedule content">📋</span>`;
          case 'encoding_error':
            return `<span class="quality-flag-icon encoding-error" title="Encoding errors detected">⚠️</span>`;
          case 'ocr_artifact':
            return `<span class="quality-flag-icon ocr-artifact" title="OCR artifacts detected">🔤</span>`;
          default:
            return '';
        }
      }).filter(Boolean).join('');
      
      if (flagIcons) {
        flagsHtml = `<div class="quality-flags">${flagIcons}</div>`;
      }
    }

    return `
      <div class="quality-indicators">
        <span class="completeness-badge ${badgeClass}" title="${badgeTitle}">${badgeText}</span>
        ${flagsHtml}
      </div>
    `;
  }

  /**
   * Show quality details panel for a specific act
   * Requirements: 7.4 - Display all detected issues with descriptions and suggested fixes
   * Requirements: 2.5 - Show transformation log viewer
   * Requirements: 17.4 - Show protected section indicators
   * 
   * @param {Object} act - The captured act data
   */
  function showQualityDetailsPanel(act) {
    const panel = $('qualityDetailsPanel');
    const titleEl = $('qualityDetailsActTitle');
    const contentEl = $('qualityDetailsContent');
    
    if (!panel || !titleEl || !contentEl) return;
    
    // Set the act title
    titleEl.textContent = act.title || `Act ${act.actNumber}`;
    
    // Get detailed quality assessment
    const quality = getActQualityAssessment(act);
    
    // Render the quality details content
    contentEl.innerHTML = renderQualityDetailsContent(quality);
    
    // Show the panel
    panel.classList.remove('hidden');
    
    // Highlight the selected act in the list
    document.querySelectorAll('.captured-act-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.actNumber === act.actNumber);
    });
    
    // Store current act for cleaning preview
    state.selectedActForQuality = act;
    
    // Update cleaning preview if cleaning checkbox is checked
    updateCleaningPreview(act);
    
    // Show transformation log panel
    // Requirements: 2.5 - Display all transformations with risk levels
    showTransformationLogPanel(act);
    
    // Show protected sections panel
    // Requirements: 17.4 - Show which sections are protected
    showProtectedSectionsPanel(act);
  }

  /**
   * Render quality details content HTML
   * Requirements: 7.4 - Display all detected issues with descriptions and suggested fixes
   * 
   * @param {Object} quality - Quality assessment object
   * @returns {string} HTML string for quality details content
   */
  function renderQualityDetailsContent(quality) {
    if (!quality) {
      return '<p class="empty-message">No quality data available.</p>';
    }

    const { completeness, flags, issues } = quality;
    
    // If no issues, show success message
    if (!issues || issues.length === 0) {
      return `
        <div class="no-issues-message">
          <span class="icon">✅</span>
          <p>No quality issues detected. Content appears complete.</p>
        </div>
      `;
    }

    // Build issues list with suggested fixes
    const issuesHtml = issues.map(issueDesc => {
      const issueInfo = parseIssueDescription(issueDesc);
      return `
        <li class="quality-issue-item">
          <span class="quality-issue-icon">${issueInfo.icon}</span>
          <div class="quality-issue-content">
            <div class="quality-issue-description">${escapeHtml(issueDesc)}</div>
            <div class="quality-issue-fix"><strong>Suggested fix:</strong> ${issueInfo.suggestedFix}</div>
          </div>
        </li>
      `;
    }).join('');

    return `
      <div class="quality-summary">
        <p><strong>Completeness:</strong> <span class="completeness-badge ${completeness}">${completeness}</span></p>
        <p><strong>Issues found:</strong> ${issues.length}</p>
      </div>
      <ul class="quality-issues-list">
        ${issuesHtml}
      </ul>
    `;
  }

  /**
   * Parse issue description to determine type and suggested fix
   * Requirements: 7.4 - Show suggested fixes for each issue type
   * 
   * @param {string} description - Issue description string
   * @returns {Object} { icon, suggestedFix }
   */
  function parseIssueDescription(description) {
    if (!description) {
      return { icon: '❓', suggestedFix: 'Review the content manually.' };
    }

    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('schedule') && lowerDesc.includes('missing')) {
      return {
        icon: '📋',
        suggestedFix: 'Navigate to the source page and verify if schedule content exists. If present, re-extract the act.'
      };
    }
    
    if (lowerDesc.includes('encoding') || lowerDesc.includes('corrupted')) {
      return {
        icon: '⚠️',
        suggestedFix: 'Enable "Apply text cleaning" option during export to automatically fix encoding errors.'
      };
    }
    
    if (lowerDesc.includes('ocr') || lowerDesc.includes('artifact')) {
      return {
        icon: '🔤',
        suggestedFix: 'Enable "Apply text cleaning" option during export to automatically correct OCR artifacts.'
      };
    }

    return {
      icon: '❓',
      suggestedFix: 'Review the content manually and consider re-extracting if issues persist.'
    };
  }

  /**
   * Hide the quality details panel
   */
  function hideQualityDetailsPanel() {
    const panel = $('qualityDetailsPanel');
    if (panel) {
      panel.classList.add('hidden');
    }
    
    // Remove selection highlight
    document.querySelectorAll('.captured-act-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    state.selectedActForQuality = null;
    
    // Also hide transformation log and protected sections panels
    hideTransformationLogPanel();
    hideProtectedSectionsPanel();
  }

  // ============================================
  // TRANSFORMATION LOG VIEWER
  // Requirements: 2.5 - Display all transformations with risk levels
  // ============================================

  /**
   * Show transformation log panel for a specific act
   * Requirements: 2.5 - Display all transformations with risk levels
   * 
   * @param {Object} act - The captured act data
   */
  function showTransformationLogPanel(act) {
    const section = $('transformationLogSection');
    const titleEl = $('transformationLogActTitle');
    const contentEl = $('transformationLogContent');
    const totalEl = $('transformationLogTotal');
    const appliedEl = $('transformationLogApplied');
    const flaggedEl = $('transformationLogFlagged');
    
    if (!section || !titleEl || !contentEl) return;
    
    // Set the act title
    titleEl.textContent = act.title || `Act ${act.actNumber}`;
    
    // Get transformation log from act or generate from content
    let transformationLog = act.transformation_log || [];
    
    // If no transformation log exists, try to generate one from content analysis
    if (transformationLog.length === 0 && act.content) {
      const cleaningResult = BDLawQuality.cleanContent(act.content, {
        applyEncodingRepairs: true,
        applyOcrCorrections: true,
        applyFormatting: true,
        dryRun: true
      });
      
      // Convert cleaning transformations to transformation log format
      transformationLog = cleaningResult.transformations.map(t => ({
        transformation_type: t.type === 'encoding_repair' ? 'encoding_fix' : 
                             t.type === 'ocr_correction' ? 'ocr_correction' : 
                             t.type === 'formatting' ? 'formatting' : t.type,
        original: t.incorrect || t.rule || '',
        corrected: t.correct || t.replacement || '',
        position: 0,
        risk_level: t.type === 'ocr_correction' ? 'potential-semantic' : 'non-semantic',
        applied: t.type !== 'ocr_correction', // OCR corrections are flagged, not applied
        timestamp: new Date().toISOString()
      }));
    }
    
    // Calculate stats
    const total = transformationLog.length;
    const applied = transformationLog.filter(t => t.applied !== false).length;
    const flagged = transformationLog.filter(t => t.applied === false).length;
    
    // Update stats
    if (totalEl) totalEl.textContent = total;
    if (appliedEl) appliedEl.textContent = applied;
    if (flaggedEl) flaggedEl.textContent = flagged;
    
    // Render transformation log content
    contentEl.innerHTML = renderTransformationLogContent(transformationLog);
    
    // Show the section
    section.classList.remove('hidden');
  }

  /**
   * Render transformation log content HTML
   * Requirements: 2.5 - Display all transformations with risk levels
   * 
   * @param {Array} transformationLog - Array of transformation entries
   * @returns {string} HTML string for transformation log content
   */
  function renderTransformationLogContent(transformationLog) {
    if (!transformationLog || transformationLog.length === 0) {
      return '<p class="transformation-log-empty">No transformations recorded.</p>';
    }

    return transformationLog.map(entry => {
      const typeClass = getTransformationTypeClass(entry.transformation_type);
      const riskClass = entry.risk_level === 'potential-semantic' ? 'potential-semantic' : 'non-semantic';
      const appliedClass = entry.applied === false ? 'flagged' : 'applied';
      const itemClass = entry.applied === false ? 'flagged' : riskClass;
      
      return `
        <div class="transformation-log-item ${itemClass}">
          <span class="transformation-type-badge ${typeClass}">${formatTransformationType(entry.transformation_type)}</span>
          <div class="transformation-content">
            <div class="transformation-change">
              <span class="transformation-original">${escapeHtml(entry.original || '(empty)')}</span>
              <span class="transformation-arrow">→</span>
              <span class="transformation-corrected">${escapeHtml(entry.corrected || '(empty)')}</span>
            </div>
            <div class="transformation-meta">
              <span class="transformation-risk-badge ${riskClass}">${entry.risk_level || 'unknown'}</span>
              <span class="transformation-applied-badge ${appliedClass}">${entry.applied === false ? 'Flagged Only' : 'Applied'}</span>
              ${entry.reason ? `<span class="transformation-reason">(${escapeHtml(entry.reason)})</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Get CSS class for transformation type
   * @param {string} type - Transformation type
   * @returns {string} CSS class name
   */
  function getTransformationTypeClass(type) {
    switch (type) {
      case 'encoding_fix':
      case 'mojibake':
      case 'html_entity':
      case 'broken_unicode':
        return 'encoding';
      case 'ocr_correction':
      case 'ocr_word_correction':
        return 'ocr';
      case 'formatting':
        return 'formatting';
      case 'unicode_normalization':
      case 'normalization':
        return 'normalization';
      default:
        return 'encoding';
    }
  }

  /**
   * Format transformation type for display
   * @param {string} type - Transformation type
   * @returns {string} Formatted type name
   */
  function formatTransformationType(type) {
    switch (type) {
      case 'encoding_fix':
        return 'Encoding';
      case 'mojibake':
        return 'Mojibake';
      case 'html_entity':
        return 'HTML Entity';
      case 'broken_unicode':
        return 'Unicode';
      case 'ocr_correction':
      case 'ocr_word_correction':
        return 'OCR';
      case 'formatting':
        return 'Format';
      case 'unicode_normalization':
      case 'normalization':
        return 'Normalize';
      default:
        return type || 'Unknown';
    }
  }

  /**
   * Hide the transformation log panel
   */
  function hideTransformationLogPanel() {
    const section = $('transformationLogSection');
    if (section) {
      section.classList.add('hidden');
    }
  }

  /**
   * Initialize transformation log panel event listeners
   * Requirements: 2.5 - Transformation log viewer
   */
  function initTransformationLogPanel() {
    const closeBtn = $('closeTransformationLogBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', hideTransformationLogPanel);
    }
  }

  // ============================================
  // PROTECTED SECTION INDICATORS
  // Requirements: 17.4 - Show which sections are protected
  // ============================================

  /**
   * Show protected sections panel for a specific act
   * Requirements: 17.4 - Show which sections are protected
   * 
   * @param {Object} act - The captured act data
   */
  function showProtectedSectionsPanel(act) {
    const section = $('protectedSectionsSection');
    const titleEl = $('protectedSectionsActTitle');
    const listEl = $('protectedSectionsList');
    const flaggedSection = $('flaggedArtifactsSection');
    const flaggedListEl = $('flaggedArtifactsList');
    
    if (!section || !titleEl || !listEl) return;
    
    // Set the act title
    titleEl.textContent = act.title || `Act ${act.actNumber}`;
    
    // Get protected sections from act or detect from content
    let protectedSections = act.protected_sections || [];
    let flaggedArtifacts = [];
    
    // If no protected sections stored, detect from content
    if (protectedSections.length === 0 && act.content && typeof BDLawExtractor !== 'undefined') {
      const result = BDLawExtractor.detectProtectedSections(act.content);
      protectedSections = result.protected_sections || [];
    }
    
    // Get flagged artifacts from transformation log
    if (act.transformation_log) {
      flaggedArtifacts = act.transformation_log.filter(t => 
        t.applied === false && 
        (t.reason === 'protected_section_enforcement' || t.risk_level === 'potential-semantic')
      );
    }
    
    // Render protected sections list
    if (protectedSections.length === 0) {
      listEl.innerHTML = '<p class="empty-message">No protected sections detected.</p>';
    } else {
      listEl.innerHTML = protectedSections.map(sectionType => {
        const icon = getProtectedSectionIcon(sectionType);
        const label = formatProtectedSectionType(sectionType);
        return `
          <span class="protected-section-badge">
            <span class="section-icon">${icon}</span>
            ${label}
          </span>
        `;
      }).join('');
    }
    
    // Render flagged artifacts
    if (flaggedArtifacts.length > 0 && flaggedSection && flaggedListEl) {
      flaggedSection.classList.remove('hidden');
      flaggedListEl.innerHTML = flaggedArtifacts.map(artifact => `
        <div class="flagged-artifact-item">
          <span class="flagged-artifact-icon">⚠️</span>
          <span class="flagged-artifact-text">${escapeHtml(artifact.original || '')} → ${escapeHtml(artifact.corrected || '')}</span>
          <span class="flagged-artifact-note">Not corrected (protected section)</span>
        </div>
      `).join('');
    } else if (flaggedSection) {
      flaggedSection.classList.add('hidden');
    }
    
    // Show the section
    section.classList.remove('hidden');
  }

  /**
   * Get icon for protected section type
   * @param {string} sectionType - Protected section type
   * @returns {string} Icon emoji
   */
  function getProtectedSectionIcon(sectionType) {
    switch (sectionType) {
      case 'definitions':
        return '📖';
      case 'proviso':
        return '⚖️';
      case 'explanation':
        return '💡';
      default:
        return '🛡️';
    }
  }

  /**
   * Format protected section type for display
   * @param {string} sectionType - Protected section type
   * @returns {string} Formatted type name
   */
  function formatProtectedSectionType(sectionType) {
    switch (sectionType) {
      case 'definitions':
        return 'Definitions (সংজ্ঞা)';
      case 'proviso':
        return 'Proviso (তবে শর্ত)';
      case 'explanation':
        return 'Explanation (ব্যাখ্যা)';
      default:
        return sectionType;
    }
  }

  /**
   * Hide the protected sections panel
   */
  function hideProtectedSectionsPanel() {
    const section = $('protectedSectionsSection');
    if (section) {
      section.classList.add('hidden');
    }
  }

  /**
   * Initialize quality details panel event listeners
   */
  function initQualityDetailsPanel() {
    const closeBtn = $('closeQualityDetailsBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', hideQualityDetailsPanel);
    }
    
    // Initialize transformation log panel
    // Requirements: 2.5 - Transformation log viewer
    initTransformationLogPanel();
  }

  /**
   * Initialize cleaning preview section event listeners
   * Requirements: 9.2, 9.3 - Show before/after comparison when cleaning is enabled
   */
  function initCleaningPreview() {
    const toggleBtn = $('toggleCleaningPreviewBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleCleaningPreviewContent);
    }
    
    // Listen for changes to the cleaning checkbox
    const cleaningCheckbox = $('applyTextCleaning');
    if (cleaningCheckbox) {
      cleaningCheckbox.addEventListener('change', () => {
        const previewSection = $('cleaningPreviewSection');
        if (cleaningCheckbox.checked) {
          previewSection?.classList.remove('hidden');
          // Update preview if an act is selected
          if (state.selectedActForQuality) {
            updateCleaningPreview(state.selectedActForQuality);
          }
        } else {
          previewSection?.classList.add('hidden');
        }
      });
    }
  }

  /**
   * Toggle the cleaning preview content visibility
   */
  function toggleCleaningPreviewContent() {
    const content = $('cleaningPreviewContent');
    const btn = $('toggleCleaningPreviewBtn');
    
    if (content && btn) {
      const isHidden = content.classList.toggle('hidden');
      btn.querySelector('.btn-text').textContent = isHidden 
        ? 'Show Before/After Comparison' 
        : 'Hide Before/After Comparison';
    }
  }

  /**
   * Update cleaning preview for a specific act
   * Requirements: 9.2, 9.3 - Show before/after comparison and transformation count
   * 
   * @param {Object} act - The captured act data
   */
  function updateCleaningPreview(act) {
    const previewSection = $('cleaningPreviewSection');
    const cleaningCheckbox = $('applyTextCleaning');
    
    // Only show preview if cleaning is enabled and an act is selected
    if (!cleaningCheckbox?.checked || !act || !act.content) {
      previewSection?.classList.add('hidden');
      return;
    }
    
    previewSection?.classList.remove('hidden');
    
    // Get cleaning result with dry run first to see what would change
    const cleaningResult = BDLawQuality.cleanContent(act.content, {
      applyEncodingRepairs: true,
      applyOcrCorrections: true,
      applyFormatting: true,
      dryRun: false
    });
    
    // Update before/after text (show first 500 chars)
    const beforeEl = $('cleaningPreviewBefore');
    const afterEl = $('cleaningPreviewAfter');
    
    if (beforeEl) {
      beforeEl.textContent = act.content.substring(0, 500) + (act.content.length > 500 ? '...' : '');
    }
    
    if (afterEl) {
      afterEl.textContent = cleaningResult.cleaned.substring(0, 500) + (cleaningResult.cleaned.length > 500 ? '...' : '');
    }
    
    // Update transformation stats
    const transformations = cleaningResult.transformations || [];
    
    let encodingCount = 0;
    let ocrCount = 0;
    let formattingCount = 0;
    
    transformations.forEach(t => {
      if (t.type === 'encoding_repair') {
        encodingCount += t.count || 0;
      } else if (t.type === 'ocr_correction') {
        ocrCount += t.count || 0;
      } else if (t.type === 'formatting') {
        formattingCount += t.count || 0;
      }
    });
    
    const encodingStatEl = $('cleaningStatEncoding');
    const ocrStatEl = $('cleaningStatOcr');
    const formattingStatEl = $('cleaningStatFormatting');
    
    if (encodingStatEl) encodingStatEl.textContent = encodingCount;
    if (ocrStatEl) ocrStatEl.textContent = ocrCount;
    if (formattingStatEl) formattingStatEl.textContent = formattingCount;
  }

  /**
   * Export a single act as an individual JSON file
   * Requirements: 31.1 - Export each act as a separate JSON file
   * Requirements: 31.2 - Generate filename: bdlaw_act_{act_number}_{timestamp}.json
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 - Include cross_references in export
   * 
   * METHODOLOGICAL PRINCIPLE: Corpus-stage extraction only.
   * - NO structured_sections (semantic interpretation)
   * - NO amendments classification (legal analysis)
   * - marker_frequency instead of sections_detected (honest naming)
   * - Cross-references are pattern-detected, not semantically verified
   * - All interpretation belongs in Phase 2 post-processing
   * - Data quality assessment for completeness validation
   * - Three-version content model (content_raw, content_normalized, content_corrected)
   * - Transformation audit log with risk levels
   * - Numeric region and protected section detection
   * - Schedule HTML preservation
   * - Extraction risk detection
   * 
   * Requirements: All Legal Integrity Enhancement requirements
   * 
   * @param {Object} act - The captured act data to export
   */
  async function exportSingleAct(act) {
    if (!act) {
      alert('No act data provided.');
      return;
    }

    const includeMetadata = $('includeMetadata').checked;
    const prettyPrint = $('prettyPrint').checked;
    
    // Check if text cleaning is enabled
    // Requirements: 8.1, 8.2, 8.3 - Configurable cleaning rules
    const applyTextCleaning = $('applyTextCleaning')?.checked || false;

    // Build the export object - CORPUS STAGE ONLY
    // NO semantic interpretation, NO classification
    // Only raw extraction with honest field naming
    
    // Get raw marker counts
    const rawCounts = act.sections?.counts || {
      'ধারা': 0,
      'অধ্যায়': 0,
      'তফসিল': 0
    };

    // ============================================
    // THREE-VERSION CONTENT MODEL
    // Requirements: 1.1-1.6 - Legal Integrity Enhancement
    // ============================================
    
    // Create three-version content structure from act content
    // content_raw: Exact extracted text, NEVER modified
    // content_normalized: Unicode NFC normalized only
    // content_corrected: Encoding-level fixes applied
    const threeVersionContent = act.content 
      ? BDLawExtractor.createThreeVersionContent(act.content)
      : { content_raw: '', content_normalized: '', content_corrected: '' };
    
    // Initialize transformation log for audit trail
    // Requirements: 2.1, 2.5 - Transformation Audit Logging
    let transformationLog = act.transformation_log || [];
    
    // ============================================
    // TITLE PRESERVATION
    // Requirements: 18.1-18.5 - Legal Integrity Enhancement
    // ============================================
    
    // Create title preservation structure
    const titlePreservation = act.title 
      ? BDLawExtractor.createTitlePreservation(act.title)
      : { title_raw: '', title_normalized: '' };

    // ============================================
    // NUMERIC REGION DETECTION
    // Requirements: 3.1-3.7 - Legal Integrity Enhancement
    // ============================================
    
    // Detect numeric-sensitive regions (currency, percentages, rates, tables)
    const numericRegions = act.numeric_regions || 
      (threeVersionContent.content_raw ? BDLawExtractor.detectNumericRegions(threeVersionContent.content_raw) : []);

    // ============================================
    // PROTECTED SECTION DETECTION
    // Requirements: 17.1-17.7 - Legal Integrity Enhancement
    // ============================================
    
    // Detect protected sections (definitions, provisos, explanations)
    const protectedSectionsResult = act.protected_sections_result ||
      (threeVersionContent.content_raw ? BDLawExtractor.detectProtectedSections(threeVersionContent.content_raw) : { protected_sections: [], regions: [] });

    // ============================================
    // CROSS-REFERENCE DETECTION WITH LEXICAL RELATIONS
    // Requirements: 4.1-4.4, 5.1-5.5, 16.1-16.5 - Legal Integrity Enhancement
    // ============================================
    
    // Detect cross-references with negation-aware classification and confidence levels
    const crossReferences = threeVersionContent.content_raw 
      ? BDLawExtractor.detectCrossReferences(threeVersionContent.content_raw) 
      : [];
    
    // Build lexical references metadata with disclaimer
    // Requirements: 5.2, 5.3, 5.4, 5.5 - Lexical Relation Purity
    const lexicalReferences = BDLawExtractor.getLexicalReferencesMetadata(
      crossReferences.map(ref => ({
        citation_text: ref.citation_text,
        lexical_relation_type: ref.lexical_relation_type || 'mention',
        lexical_relation_confidence: ref.lexical_relation_confidence || 'low',
        negation_present: ref.negation_present || false,
        negation_word: ref.negation_word || null,
        negation_context: ref.negation_context || null,
        position: ref.position,
        context_before: ref.context_before,
        context_after: ref.context_after
      }))
    );

    // ============================================
    // DATA QUALITY ASSESSMENT
    // Requirements: 9.1-9.6, 10.1-10.4 - Legal Integrity Enhancement
    // ============================================
    
    // Validate content quality with enhanced schema
    const dataQuality = threeVersionContent.content_raw 
      ? BDLawQuality.validateContentQuality(threeVersionContent.content_raw, null, {
          hasNumericCorruptionRisk: numericRegions.length > 0 && act.has_numeric_corruption_risk,
          hasEncodingAmbiguity: act.has_encoding_ambiguity,
          hasMissingSchedules: act.has_missing_schedules,
          hasHeavyOcrCorrection: act.has_heavy_ocr_correction,
          numericRegions: numericRegions,
          protectedRegions: protectedSectionsResult.regions
        })
      : BDLawQuality.createEmptyAssessment();
    
    // ============================================
    // TEXT CLEANING WITH TRANSFORMATION LOGGING
    // Requirements: 2.1-2.5, 3.6, 3.7, 17.5-17.7 - Legal Integrity Enhancement
    // ============================================
    
    // Determine content to export (original or cleaned)
    let cleaningTransformations = [];
    
    if (applyTextCleaning && threeVersionContent.content_normalized) {
      const cleaningResult = BDLawQuality.cleanContent(threeVersionContent.content_normalized, {
        applyEncodingRepairs: true,
        applyOcrCorrections: true,
        applyFormatting: true,
        dryRun: false,
        numericRegions: numericRegions,
        protectedRegions: protectedSectionsResult.regions
      });
      
      // Update content_corrected with cleaned content
      threeVersionContent.content_corrected = cleaningResult.cleaned;
      cleaningTransformations = cleaningResult.transformations;
      
      // Add transformations to the audit log
      // Requirements: 2.1, 2.5 - Log all transformations
      for (const transform of cleaningTransformations) {
        transformationLog.push({
          transformation_type: transform.type === 'encoding_repair' ? 'encoding_fix' : 
                               transform.type === 'ocr_correction' ? 'ocr_correction' : 
                               transform.type === 'formatting' ? 'formatting' : transform.type,
          original: transform.incorrect || transform.rule || '',
          corrected: transform.correct || transform.replacement || '',
          position: 0, // Position tracking would require more detailed logging
          risk_level: BDLawExtractor.getRiskLevel(transform.type === 'ocr_correction' ? 'ocr_correction' : 'encoding_fix'),
          applied: transform.applied !== false,
          timestamp: new Date().toISOString()
        });
      }
      
      // Add flagged protected section artifacts to log
      if (cleaningResult.flaggedInProtectedSections && cleaningResult.flaggedInProtectedSections.length > 0) {
        for (const flagged of cleaningResult.flaggedInProtectedSections) {
          transformationLog.push({
            transformation_type: 'ocr_correction',
            original: flagged.incorrect,
            corrected: flagged.correct,
            position: flagged.position,
            risk_level: 'potential-semantic',
            applied: false,
            timestamp: new Date().toISOString(),
            reason: 'protected_section_enforcement'
          });
        }
      }
      
      // Add cleaning_applied flag if transformations were made
      if (cleaningTransformations.length > 0 && !dataQuality.flags.includes('cleaning_applied')) {
        dataQuality.flags.push('cleaning_applied');
      }
    }

    // ============================================
    // NUMERIC REPRESENTATION RECORDING
    // Requirements: 14.1-14.5 - Legal Integrity Enhancement
    // ============================================
    
    const numericRepresentation = act.numeric_representation ||
      (threeVersionContent.content_raw ? BDLawExtractor.detectNumericRepresentation 
        ? BDLawExtractor.detectNumericRepresentation(threeVersionContent.content_raw)
        : { numeric_representation: [], bn_digit_count: 0, en_digit_count: 0, is_mixed: false }
      : { numeric_representation: [], bn_digit_count: 0, en_digit_count: 0, is_mixed: false });

    // ============================================
    // LANGUAGE DISTRIBUTION RECORDING
    // Requirements: 19.1-19.5 - Legal Integrity Enhancement
    // ============================================
    
    const languageDistribution = act.language_distribution ||
      (threeVersionContent.content_raw ? BDLawExtractor.calculateLanguageDistribution
        ? BDLawExtractor.calculateLanguageDistribution(threeVersionContent.content_raw)
        : { bn_ratio: 0, en_ratio: 0 }
      : { bn_ratio: 0, en_ratio: 0 });

    // ============================================
    // EDITORIAL CONTENT DETECTION
    // Requirements: 15.1-15.6 - Legal Integrity Enhancement
    // ============================================
    
    const editorialContent = act.editorial_content ||
      (threeVersionContent.content_raw ? BDLawExtractor.detectEditorialContent
        ? BDLawExtractor.detectEditorialContent(threeVersionContent.content_raw)
        : { editorial_content_present: false, editorial_types: [] }
      : { editorial_content_present: false, editorial_types: [] });

    // ============================================
    // COMPUTE CONTENT HASH
    // Requirements: 1.5 - Content hash anchored to content_raw
    // ============================================
    
    let contentHashResult = { content_hash: null, hash_source: 'content_raw' };
    try {
      contentHashResult = await BDLawExtractor.computeContentHash(threeVersionContent);
    } catch (e) {
      console.error('Content hash computation failed:', e);
      contentHashResult = { content_hash: null, hash_source: 'content_raw', error: e.message };
    }
    
    // ============================================
    // BUILD EXPORT OBJECT
    // ============================================
    
    const exportAct = {
      // IDENTIFIERS: Separated for clarity
      identifiers: {
        internal_id: act.actNumber,
        note: "internal_id is the bdlaws database identifier, not the legal citation number"
      },
      
      // TITLE PRESERVATION
      // Requirements: 18.1-18.5 - Store both raw and normalized titles
      title_raw: titlePreservation.title_raw,
      title_normalized: titlePreservation.title_normalized,
      
      // THREE-VERSION CONTENT MODEL
      // Requirements: 1.1-1.6 - Three parallel content versions
      content_raw: threeVersionContent.content_raw,
      content_normalized: threeVersionContent.content_normalized,
      content_corrected: threeVersionContent.content_corrected,
      
      url: act.url,
      volume_number: act.volumeNumber || 'unknown',
      
      // LEGAL STATUS AND TEMPORAL MARKING
      // Requirements: 6.1-6.3, 7.1-7.4 - Legal Integrity Enhancement
      legal_status: act.legal_status || 'unknown',
      temporal_status: BDLawExtractor.TEMPORAL_STATUS,
      temporal_disclaimer: BDLawExtractor.TEMPORAL_DISCLAIMER,
      
      // LEXICAL REFERENCES (renamed from cross_references)
      // Requirements: 5.1-5.5, 16.1-16.5 - Lexical Relation Purity
      lexical_references: lexicalReferences,
      
      // SCHEDULES
      // Requirements: 8.1-8.6 - Schedule HTML Preservation
      schedules: act.schedules || {
        representation: 'raw_html',
        extraction_method: 'verbatim_dom_capture',
        processed: false,
        html_content: null
      },
      
      // TRANSFORMATION LOG
      // Requirements: 2.1-2.5 - Transformation Audit Logging
      transformation_log: transformationLog,
      
      // PROTECTED SECTIONS
      // Requirements: 17.1-17.7 - Protected Section Detection
      protected_sections: protectedSectionsResult.protected_sections,
      
      // NUMERIC REGIONS
      // Requirements: 3.1-3.7 - Numeric Region Protection
      numeric_regions: numericRegions.map(region => ({
        start: region.start,
        end: region.end,
        type: region.type,
        numeric_integrity_sensitive: true
      })),
      
      // DATA QUALITY - WARNING-BASED, NO GUARANTEES
      // Replaces safe_for_ml_training with explicit warnings
      data_quality: {
        completeness: dataQuality.completeness,
        completeness_disclaimer: dataQuality.completeness_disclaimer || 'Website representation incomplete; legal completeness unknown',
        flags: dataQuality.flags,
        ml_risk_factors: dataQuality.risks || [],
        known_limitations: dataQuality.known_limitations || [],
        ml_usage_warning: BDLawExtractor.ML_USAGE_WARNING
      },
      
      // EXTRACTION RISK
      // Requirements: 13.1-13.6 - Extraction Risk Detection
      extraction_risk: act.extraction_risk || {
        possible_truncation: false,
        reason: 'none'
      },
      
      // NUMERIC REPRESENTATION
      // Requirements: 14.1-14.5 - Numeric Representation Recording
      numeric_representation: numericRepresentation.numeric_representation || [],
      
      // LANGUAGE DISTRIBUTION
      // Requirements: 19.1-19.5 - Language Distribution Recording
      language_distribution: {
        bn_ratio: languageDistribution.bn_ratio || 0,
        en_ratio: languageDistribution.en_ratio || 0
      },
      
      // EDITORIAL CONTENT
      // Requirements: 15.1-15.6 - Editorial Content Detection
      editorial_content_present: editorialContent.editorial_content_present || false,
      
      // SOURCE AUTHORITY DECLARATION
      // Requirements: 11.1-11.4 - Legal Integrity Enhancement
      source_authority: BDLawExtractor.SOURCE_AUTHORITY,
      authority_rank: BDLawExtractor.AUTHORITY_RANK,
      
      // MARKER FREQUENCY (kept for backward compatibility)
      marker_frequency: {
        'ধারা': {
          count: rawCounts['ধারা'] || 0,
          method: "raw string frequency, including cross-references"
        },
        'অধ্যায়': {
          count: rawCounts['অধ্যায়'] || 0,
          method: "raw string frequency"
        },
        'তফসিল': {
          count: rawCounts['তফসিল'] || 0,
          method: "raw string frequency, including schedule references"
        }
      },

      // ============================================
      // ARCHIVAL CAPTURE METADATA (RESEARCH INTEGRITY)
      // These fields define exactly what was captured and what can be trusted
      // ============================================
      
      // HTML capture definition - what content_raw actually represents
      html_capture_definition: BDLawExtractor.HTML_CAPTURE_DEFINITION,
      dom_extraction_method: BDLawExtractor.DOM_EXTRACTION_METHOD,
      capture_environment: BDLawExtractor.CAPTURE_ENVIRONMENT,
      
      // content_raw disclaimer - clarifies this is NOT raw HTML
      content_raw_disclaimer: BDLawExtractor.CONTENT_RAW_DISCLAIMER,
      
      // CONTENT HASH - SHA-256 of content_raw for integrity verification
      // Provides cryptographic anchor for content_raw immutability
      content_raw_sha256: contentHashResult.content_hash 
        ? contentHashResult.content_hash.replace(/^sha256:/, '') 
        : null,
      
      // Reference semantics - string matching only, no legal interpretation
      reference_semantics: BDLawExtractor.REFERENCE_SEMANTICS,
      reference_warning: BDLawExtractor.REFERENCE_WARNING,
      
      // Negation handling - classification suppression only
      negation_handling: BDLawExtractor.NEGATION_HANDLING,
      
      // Numeric integrity - best effort, HTML limitations apply
      numeric_integrity: BDLawExtractor.NUMERIC_INTEGRITY,
      numeric_warning: BDLawExtractor.NUMERIC_WARNING,
      
      // Encoding policy - HTML artifacts, not errors
      encoding_policy: BDLawExtractor.ENCODING_POLICY,
      encoding_scope: BDLawExtractor.ENCODING_SCOPE,
      
      // TRUST BOUNDARY - MANDATORY, defines what can and cannot be trusted
      trust_boundary: BDLawExtractor.TRUST_BOUNDARY
    };
    
    // Add formatting_scope if cleaning was applied
    // Requirements: 12.1-12.4 - Formatting Scope Declaration
    if (cleaningTransformations.length > 0) {
      exportAct.formatting_scope = BDLawExtractor.FORMATTING_SCOPE;
    }

    // Include metadata if option is checked
    if (includeMetadata) {
      const metadata = act.metadata ? { ...act.metadata } : BDLawMetadata.generate(act.url);
      metadata.extracted_at = act.capturedAt || new Date().toISOString();
      metadata.content_hash = contentHashResult.content_hash;
      metadata.hash_source = contentHashResult.hash_source;
      metadata.schema_version = '3.1';
      exportAct._metadata = metadata;
    }

    const jsonContent = prettyPrint 
      ? JSON.stringify(exportAct, null, 2) 
      : JSON.stringify(exportAct);

    // Requirements: 31.2 - Generate filename: bdlaw_act_{act_number}_{timestamp}.json
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `bdlaw_act_${act.actNumber}_${timestamp}.json`;

    try {
      await chrome.runtime.sendMessage({
        type: 'downloadJSON',
        content: jsonContent,
        filename: filename
      });
      
      // Requirements: 10.5 - Log export operation with data quality info
      BDLawCorpusManifest.logExtractionOperation({
        type: 'export',
        internal_id: act.actNumber,
        result: 'success',
        details: {
          filename: filename,
          content_length: jsonContent.length,
          lexical_reference_count: lexicalReferences.count,
          include_metadata: includeMetadata,
          data_quality_completeness: dataQuality.completeness,
          data_quality_flags: dataQuality.flags,
          ml_risk_factors: dataQuality.risks || [],
          cleaning_applied: applyTextCleaning,
          transformations_count: transformationLog.length,
          content_hash: contentHashResult.content_hash,
          schema_version: '3.1'
        }
      });
      
      console.log(`Act ${act.actNumber} exported to ${filename}`);
    } catch (e) {
      console.error('Export failed:', e);
      
      // Requirements: 10.5 - Log export errors
      BDLawCorpusManifest.logExtractionOperation({
        type: 'export',
        internal_id: act.actNumber,
        result: 'error',
        details: { error: e.message, filename: filename }
      });
      
      alert('Export failed: ' + e.message);
    }
  }

  /**
   * Export all captured acts as separate individual files
   * Requirements: 31.5 - Provide "Export All as Separate Files" option
   * Requirements: 31.8 - Allow batch download of multiple individual act files
   * Requirements: 6.5 - Include failed acts in corpus export
   */
  async function exportAllAsSeparateFiles() {
    // Get permanently failed extractions (those that exceeded max retries)
    const permanentlyFailed = (state.failedExtractions || []).filter(f => !BDLawQueue.shouldRetry(f));
    
    if (state.capturedActs.length === 0 && permanentlyFailed.length === 0) {
      alert('No acts captured. Capture some acts first.');
      return;
    }

    const successfulCount = state.capturedActs.length;
    const failedCount = permanentlyFailed.length;
    const total = successfulCount + failedCount;
    
    // Build confirmation message
    let confirmMsg = `Export ${total} acts as separate files?\n\n`;
    confirmMsg += `• ${successfulCount} successful extraction(s)\n`;
    if (failedCount > 0) {
      confirmMsg += `• ${failedCount} failed extraction(s) (with failure metadata)\n`;
    }
    confirmMsg += `\nThis will download ${total} individual JSON files.`;
    
    if (!confirm(confirmMsg)) {
      return;
    }

    // Show progress indicator
    $('exportProgress').classList.remove('hidden');
    $('exportProgressText').textContent = `Exporting 0 of ${total}...`;
    $('exportProgressFill').style.width = '0%';

    let exported = 0;
    const delay = 500; // 500ms delay between downloads to prevent browser blocking

    // Export successful acts
    for (const act of state.capturedActs) {
      try {
        await exportSingleAct(act);
        exported++;
        
        // Update progress
        const percent = Math.round((exported / total) * 100);
        $('exportProgressFill').style.width = percent + '%';
        $('exportProgressText').textContent = `Exporting ${exported} of ${total}...`;
        
        // Add delay between downloads to prevent browser blocking
        // Requirements: 31.8 - Add delay between file downloads
        if (exported < total) {
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (e) {
        console.error(`Failed to export act ${act.actNumber}:`, e);
      }
    }

    // Export failed acts - Requirements: 6.5 - Do not skip or omit failed acts
    for (const failedEntry of permanentlyFailed) {
      try {
        await exportFailedAct(failedEntry);
        exported++;
        
        // Update progress
        const percent = Math.round((exported / total) * 100);
        $('exportProgressFill').style.width = percent + '%';
        $('exportProgressText').textContent = `Exporting ${exported} of ${total}...`;
        
        // Add delay between downloads
        if (exported < total) {
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (e) {
        console.error(`Failed to export failed act ${failedEntry.act_number}:`, e);
      }
    }

    // Hide progress indicator
    $('exportProgress').classList.add('hidden');
    
    // Build completion message
    let completeMsg = `Export complete!\n${exported} of ${total} acts exported as separate files.`;
    if (failedCount > 0) {
      completeMsg += `\n\n⚠️ ${failedCount} failed act(s) exported with extraction_status: "failed"`;
    }
    alert(completeMsg);
  }

  /**
   * Export a single failed act as a JSON file
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6 - Failed Act Export Format
   * 
   * @param {Object} failedEntry - The failed extraction entry to export
   */
  async function exportFailedAct(failedEntry) {
    if (!failedEntry) {
      console.error('No failed entry data provided.');
      return;
    }

    const prettyPrint = $('prettyPrint').checked;
    
    // Format the failed act for export using BDLawQueue
    const exportData = BDLawQueue.formatFailedActForExport(failedEntry);
    
    // Add trust boundary for research integrity
    exportData.trust_boundary = {
      can_trust: [
        'Text extraction was attempted at the recorded timestamps',
        'Failure reasons are accurately recorded',
        'No content inference or auto-correction was applied'
      ],
      must_not_trust: [
        'Content availability (extraction failed)',
        'Legal validity',
        'Completeness'
      ]
    };

    const jsonContent = prettyPrint 
      ? JSON.stringify(exportData, null, 2) 
      : JSON.stringify(exportData);

    // Generate filename with _FAILED suffix to distinguish from successful exports
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const actNumber = failedEntry.act_number || 'unknown';
    const filename = `bdlaw_act_${actNumber}_FAILED_${timestamp}.json`;

    try {
      await chrome.runtime.sendMessage({
        type: 'downloadJSON',
        content: jsonContent,
        filename: filename
      });
      
      // Log export operation
      BDLawCorpusManifest.logExtractionOperation({
        type: 'export',
        internal_id: actNumber,
        result: 'success',
        details: {
          filename: filename,
          export_type: 'failed_act',
          failure_reason: failedEntry.failure_reason,
          total_attempts: failedEntry.attempts?.length || 0
        }
      });
    } catch (e) {
      console.error('Failed act export failed:', e);
      
      BDLawCorpusManifest.logExtractionOperation({
        type: 'export',
        internal_id: actNumber,
        result: 'error',
        details: { error: e.message, filename: filename, export_type: 'failed_act' }
      });
      
      throw e;
    }
  }

  /**
   * Export volume catalog as a separate JSON file
   * Requirements: 31.3 - Export volume catalog as a separate JSON file
   * Requirements: 31.4 - Generate filename: bdlaw_volume_{volume_number}_{timestamp}.json
   * Requirements: 31.6 - Provide "Export Volume Catalog" option
   */
  async function exportVolumeCatalog() {
    if (!state.currentVolume) {
      alert('No volume captured. Capture a volume first.');
      return;
    }

    const includeMetadata = $('includeMetadata').checked;
    const prettyPrint = $('prettyPrint').checked;

    // Build the volume catalog export object
    const volumeExport = {
      volume_number: state.currentVolume.volumeNumber,
      source_url: state.currentVolume.url,
      captured_at: state.currentVolume.capturedAt,
      total_acts: state.currentVolume.acts.length,
      acts: state.currentVolume.acts.map(act => ({
        title: act.title || '',
        year: act.year || '',
        act_number: act.actNumber || '',
        url: act.url || ''
      }))
    };

    // Include metadata if option is checked
    if (includeMetadata) {
      volumeExport._metadata = {
        source: 'bdlaws.minlaw.gov.bd',
        source_url: state.currentVolume.url,
        scraped_at: state.currentVolume.capturedAt,
        extracted_at: new Date().toISOString(),
        scraping_method: 'manual page-level extraction',
        tool: 'BDLawCorpus',
        language: 'bn',
        research_purpose: 'academic legal corpus construction',
        disclaimer: 'This tool performs manual extraction of publicly available legal texts for academic research. No automated crawling, modification, or interpretation is performed.'
      };
    }

    const jsonContent = prettyPrint 
      ? JSON.stringify(volumeExport, null, 2) 
      : JSON.stringify(volumeExport);

    // Requirements: 31.4 - Generate filename: bdlaw_volume_{volume_number}_{timestamp}.json
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `bdlaw_volume_${state.currentVolume.volumeNumber}_${timestamp}.json`;

    try {
      await chrome.runtime.sendMessage({
        type: 'downloadJSON',
        content: jsonContent,
        filename: filename
      });
      
      // Requirements: 10.5 - Log volume export operation
      BDLawCorpusManifest.logExtractionOperation({
        type: 'export',
        volume_number: state.currentVolume.volumeNumber,
        result: 'success',
        details: {
          filename: filename,
          total_acts: state.currentVolume.acts.length,
          include_metadata: includeMetadata
        }
      });
      
      alert(`Volume catalog exported!\n${state.currentVolume.acts.length} acts listed in ${filename}`);
    } catch (e) {
      console.error('Export failed:', e);
      
      // Requirements: 10.5 - Log volume export errors
      BDLawCorpusManifest.logExtractionOperation({
        type: 'export',
        volume_number: state.currentVolume?.volumeNumber,
        result: 'error',
        details: { error: e.message, filename: filename }
      });
      
      alert('Export failed: ' + e.message);
    }
  }

  /**
   * Export corpus manifest as a JSON file
   * Requirements: 8.5 - Generate an updated manifest alongside act files
   */
  async function exportCorpusManifest() {
    if (state.capturedActs.length === 0) {
      alert('No acts captured. Capture some acts first.');
      return;
    }

    const prettyPrint = $('prettyPrint').checked;

    try {
      // Load the current manifest
      const manifest = await BDLawCorpusManifest.loadCorpusManifest();
      
      const jsonContent = prettyPrint 
        ? JSON.stringify(manifest, null, 2) 
        : JSON.stringify(manifest);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `bdlaw_corpus_manifest_${timestamp}.json`;

      await chrome.runtime.sendMessage({
        type: 'downloadJSON',
        content: jsonContent,
        filename: filename
      });
      
      // Log export operation
      BDLawCorpusManifest.logExtractionOperation({
        type: 'export',
        result: 'success',
        details: {
          filename: filename,
          export_type: 'corpus_manifest',
          total_acts: manifest.corpus_stats?.total_acts || 0,
          total_volumes: manifest.corpus_stats?.total_volumes || 0
        }
      });
      
      alert(`Corpus manifest exported!\n${filename}`);
    } catch (e) {
      console.error('Manifest export failed:', e);
      
      BDLawCorpusManifest.logExtractionOperation({
        type: 'export',
        result: 'error',
        details: { error: e.message, export_type: 'corpus_manifest' }
      });
      
      alert('Export failed: ' + e.message);
    }
  }

  /**
   * Export research documents (README.md, CITATION.cff, DATA_DICTIONARY.md)
   * Requirements: 9.1, 9.2, 9.5 - Generate research documentation
   */
  async function exportResearchDocuments() {
    if (state.capturedActs.length === 0) {
      alert('No acts captured. Capture some acts first.');
      return;
    }

    const total = 3; // README, CITATION, DATA_DICTIONARY
    if (!confirm(`Export research documents?\n\nThis will download:\n• README.md\n• CITATION.cff\n• DATA_DICTIONARY.md`)) {
      return;
    }

    // Show progress indicator
    $('exportProgress').classList.remove('hidden');
    $('exportProgressText').textContent = `Exporting research documents...`;
    $('exportProgressFill').style.width = '0%';

    try {
      // Load the current manifest for generating documents
      const manifest = await BDLawCorpusManifest.loadCorpusManifest();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const delay = 500; // Delay between downloads

      // 1. Export README.md
      // Requirements: 9.1 - Include a corpus-level README with methodology documentation
      $('exportProgressText').textContent = `Exporting README.md...`;
      $('exportProgressFill').style.width = '33%';
      
      const readmeContent = BDLawCorpusManifest.generateCorpusReadme(manifest);
      await chrome.runtime.sendMessage({
        type: 'downloadText',
        content: readmeContent,
        filename: `bdlaw_README_${timestamp}.md`,
        mimeType: 'text/markdown'
      });
      
      await new Promise(r => setTimeout(r, delay));

      // 2. Export CITATION.cff
      // Requirements: 9.2 - Generate a CITATION.cff file for proper academic citation
      $('exportProgressText').textContent = `Exporting CITATION.cff...`;
      $('exportProgressFill').style.width = '66%';
      
      const citationContent = BDLawCorpusManifest.generateCitationCff(manifest);
      await chrome.runtime.sendMessage({
        type: 'downloadText',
        content: citationContent,
        filename: `CITATION_${timestamp}.cff`,
        mimeType: 'text/plain'
      });
      
      await new Promise(r => setTimeout(r, delay));

      // 3. Export DATA_DICTIONARY.md
      // Requirements: 9.5 - Include a data dictionary defining all schema fields
      $('exportProgressText').textContent = `Exporting DATA_DICTIONARY.md...`;
      $('exportProgressFill').style.width = '100%';
      
      const dataDictContent = BDLawCorpusManifest.generateDataDictionary();
      await chrome.runtime.sendMessage({
        type: 'downloadText',
        content: dataDictContent,
        filename: `bdlaw_DATA_DICTIONARY_${timestamp}.md`,
        mimeType: 'text/markdown'
      });

      // Log export operation
      BDLawCorpusManifest.logExtractionOperation({
        type: 'export',
        result: 'success',
        details: {
          export_type: 'research_documents',
          files: ['README.md', 'CITATION.cff', 'DATA_DICTIONARY.md']
        }
      });

      // Hide progress indicator
      $('exportProgress').classList.add('hidden');
      
      alert(`Research documents exported!\n• README.md\n• CITATION.cff\n• DATA_DICTIONARY.md`);
    } catch (e) {
      console.error('Research documents export failed:', e);
      
      // Hide progress indicator
      $('exportProgress').classList.add('hidden');
      
      BDLawCorpusManifest.logExtractionOperation({
        type: 'export',
        result: 'error',
        details: { error: e.message, export_type: 'research_documents' }
      });
      
      alert('Export failed: ' + e.message);
    }
  }

  // Keep the old exportAll function for backward compatibility but mark as deprecated
  // This is now replaced by exportAllAsSeparateFiles as the default behavior
  async function exportAll() {
    // Redirect to the new separate files export
    // Requirements: 31.7 - Remove combined corpus export as default behavior
    await exportAllAsSeparateFiles();
  }

  /**
   * Clear and reset all extracted data
   * Removes all captured acts, queue items, current volume, and corpus manifest from storage
   */
  async function clearAllData() {
    const actCount = state.capturedActs.length;
    const queueCount = state.queue.length;
    const hasVolume = state.currentVolume !== null;
    
    // Also check manifest for acts (in case capturedActs is empty but manifest has entries)
    let manifestActCount = 0;
    try {
      const manifest = await BDLawCorpusManifest.loadCorpusManifest();
      manifestActCount = Object.keys(manifest.acts || {}).length;
    } catch (e) {
      console.error('Failed to load manifest for count:', e);
    }

    if (actCount === 0 && queueCount === 0 && !hasVolume && manifestActCount === 0) {
      alert('No data to clear.');
      return;
    }

    const message = `Are you sure you want to clear all data?\n\n` +
      `This will permanently delete:\n` +
      `• ${actCount} captured act(s)\n` +
      `• ${queueCount} queued item(s)\n` +
      `${manifestActCount > 0 ? `• ${manifestActCount} act(s) in corpus manifest\n` : ''}` +
      `${hasVolume ? '• Current volume catalog\n' : ''}` +
      `\nThis action cannot be undone.`;

    if (!confirm(message)) {
      return;
    }

    // Clear all state
    state.capturedActs = [];
    state.queue = [];
    state.currentVolume = null;
    state.failedExtractions = [];
    state.queueStats = {
      totalQueued: 0,
      successCount: 0,
      failedCount: 0,
      retriedCount: 0
    };

    // Save to storage
    await saveToStorage();
    
    // Clear corpus manifest to keep it in sync with capturedActs
    await BDLawCorpusManifest.clearCorpusManifest();

    // Update UI
    updateQueueBadge();
    renderQueue();
    updateExportStats();
    showCurrentVolume();
    
    // Hide preview section
    $('previewSection').classList.add('hidden');

    alert('All data has been cleared.');
  }

  // ============================================
  // HELPERS
  // ============================================
  async function ensureContentScript(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response?.success) return true;
    } catch (e) {
      // Content script not loaded, inject it
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 500));
    }
    return true;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  // ============================================
  // QUEUE SETTINGS UI
  // Requirements: 1.6, 10.6
  // ============================================
  
  /**
   * Initialize queue settings UI with current values
   */
  function initQueueSettings() {
    const config = BDLawQueue.getQueueConfig();
    
    const delayInput = $('extractionDelayInput');
    const thresholdInput = $('minContentThresholdInput');
    const retryInput = $('maxRetryAttemptsInput');
    const retryDelayInput = $('retryBaseDelayInput');
    
    if (delayInput) delayInput.value = config.extraction_delay_ms / 1000;
    if (thresholdInput) thresholdInput.value = config.minimum_content_threshold;
    if (retryInput) retryInput.value = config.max_retry_attempts;
    if (retryDelayInput) retryDelayInput.value = config.retry_base_delay_ms / 1000;
  }
  
  /**
   * Toggle queue settings visibility
   */
  function toggleQueueSettings() {
    const content = $('queueSettingsContent');
    const btn = $('toggleQueueSettingsBtn');
    
    if (content && btn) {
      const isHidden = content.classList.toggle('hidden');
      btn.querySelector('.btn-icon').textContent = isHidden ? '▼' : '▲';
      btn.querySelector('.btn-text').textContent = isHidden ? 'Show' : 'Hide';
    }
  }
  
  /**
   * Save queue settings from UI inputs
   */
  function saveQueueSettings() {
    const delayInput = $('extractionDelayInput');
    const thresholdInput = $('minContentThresholdInput');
    const retryInput = $('maxRetryAttemptsInput');
    const retryDelayInput = $('retryBaseDelayInput');
    
    const config = {
      extraction_delay_ms: (parseFloat(delayInput?.value) || 3) * 1000,
      minimum_content_threshold: parseInt(thresholdInput?.value) || 100,
      max_retry_attempts: parseInt(retryInput?.value) || 3,
      retry_base_delay_ms: (parseFloat(retryDelayInput?.value) || 5) * 1000
    };
    
    BDLawQueue.saveQueueConfig(config);
    
    // Re-read to get clamped values
    initQueueSettings();
    
    alert('Queue settings saved!');
  }
  
  // ============================================
  // FAILED EXTRACTIONS UI
  // Requirements: 4.4, 4.5, 4.6
  // ============================================
  
  /**
   * Render failed extractions list
   */
  function renderFailedExtractions() {
    const section = $('failedExtractionsSection');
    const list = $('failedExtractionsList');
    const countEl = $('failedExtractionsCount');
    
    if (!section || !list) return;
    
    const failed = state.failedExtractions || [];
    
    if (failed.length === 0) {
      section.classList.add('hidden');
      return;
    }
    
    section.classList.remove('hidden');
    if (countEl) countEl.textContent = failed.length;
    
    list.innerHTML = failed.map(entry => {
      const isPermanent = !BDLawQueue.shouldRetry(entry);
      const reasonLabel = getFailureReasonLabel(entry.failure_reason);
      
      return `
        <div class="failed-extraction-item">
          <div class="failed-extraction-title">${escapeHtml(entry.title || `Act ${entry.act_number}`)}</div>
          <div class="failed-extraction-meta">Act #${entry.act_number}</div>
          <div class="failed-extraction-reason">${reasonLabel}</div>
          <div class="failed-extraction-attempts">Attempts: ${entry.retry_count}/${entry.max_retries}</div>
          ${isPermanent ? '<div class="failed-extraction-permanent">⚠️ Permanently failed (max retries reached)</div>' : ''}
        </div>
      `;
    }).join('');
  }
  
  /**
   * Get human-readable label for failure reason
   */
  function getFailureReasonLabel(reason) {
    const { FAILURE_REASONS } = BDLawQueue;
    const labels = {
      [FAILURE_REASONS.CONTAINER_NOT_FOUND]: 'Content container not found',
      [FAILURE_REASONS.CONTENT_EMPTY]: 'Empty content',
      [FAILURE_REASONS.CONTENT_BELOW_THRESHOLD]: 'Content too short',
      [FAILURE_REASONS.DOM_TIMEOUT]: 'Page load timeout',
      [FAILURE_REASONS.NETWORK_ERROR]: 'Network error',
      [FAILURE_REASONS.NAVIGATION_ERROR]: 'Navigation error',
      [FAILURE_REASONS.EXTRACTION_ERROR]: 'Extraction error',
      [FAILURE_REASONS.UNKNOWN_ERROR]: 'Unknown error'
    };
    return labels[reason] || reason;
  }
  
  /**
   * Clear all failed extractions
   */
  async function clearFailedExtractions() {
    if (!confirm('Clear all failed extractions? This cannot be undone.')) return;
    
    state.failedExtractions = [];
    await saveToStorage();
    renderFailedExtractions();
    updateQueueBadge();
  }
  
  /**
   * Update queue badge to show failures indicator
   * Requirements: 7.7
   */
  function updateQueueBadgeWithFailures() {
    const badge = $('queueBadge');
    if (!badge) return;
    
    const pendingCount = state.queue.filter(q => q.status === 'pending').length;
    const failedCount = state.failedExtractions?.length || 0;
    
    badge.textContent = pendingCount;
    badge.classList.toggle('hidden', pendingCount === 0 && failedCount === 0);
    badge.classList.toggle('has-failures', failedCount > 0);
    
    // Update badge title for accessibility
    if (failedCount > 0) {
      badge.title = `${pendingCount} pending, ${failedCount} failed`;
    } else {
      badge.title = `${pendingCount} pending`;
    }
  }

  function bindEvents() {
    // Capture buttons
    $('captureVolumeBtn').addEventListener('click', captureVolume);
    $('captureActBtn').addEventListener('click', captureCurrentAct);
    $('addToQueueBtn').addEventListener('click', addCurrentActToQueue);
    $('addAllActsBtn').addEventListener('click', addAllActsToQueue);

    // Queue buttons
    $('processQueueBtn').addEventListener('click', processQueue);
    $('clearQueueBtn').addEventListener('click', clearQueue);
    
    // Queue settings buttons
    // Requirements: 1.6, 10.6 - Queue settings UI
    const toggleSettingsBtn = $('toggleQueueSettingsBtn');
    if (toggleSettingsBtn) {
      toggleSettingsBtn.addEventListener('click', toggleQueueSettings);
    }
    
    const saveSettingsBtn = $('saveQueueSettingsBtn');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', saveQueueSettings);
    }
    
    // Failed extractions clear button
    // Requirements: 4.6 - Allow clearing failed extractions
    const clearFailedBtn = $('clearFailedExtractionsBtn');
    if (clearFailedBtn) {
      clearFailedBtn.addEventListener('click', clearFailedExtractions);
    }
    
    // Resume processing buttons
    // Requirements: 8.5 - Allow resuming interrupted queue processing
    const resumeProcessingBtn = $('resumeProcessingBtn');
    if (resumeProcessingBtn) {
      resumeProcessingBtn.addEventListener('click', handleResumeProcessing);
    }
    
    const dismissResumeBtn = $('dismissResumeBtn');
    if (dismissResumeBtn) {
      dismissResumeBtn.addEventListener('click', handleDismissResume);
    }

    // Export buttons
    // Requirements: 31.5 - Replace "Export All" with "Export All as Separate Files"
    $('exportAllBtn').addEventListener('click', exportAllAsSeparateFiles);
    // Requirements: 31.6 - Add "Export Volume Catalog" button
    $('exportVolumeCatalogBtn').addEventListener('click', exportVolumeCatalog);
    // Requirements: 8.5 - Add "Export Corpus Manifest" button
    $('exportManifestBtn').addEventListener('click', exportCorpusManifest);
    // Requirements: 9.1, 9.2, 9.5 - Add "Export Research Documents" button
    $('exportResearchDocsBtn').addEventListener('click', exportResearchDocuments);
    // Clear all data button
    $('clearAllDataBtn').addEventListener('click', clearAllData);

    // Manifest viewer toggle
    // Requirements: 8.4 - Display corpus manifest contents
    const toggleManifestBtn = $('toggleManifestViewerBtn');
    if (toggleManifestBtn) {
      toggleManifestBtn.addEventListener('click', toggleManifestViewer);
    }

    // Duplicate warning buttons
    // Requirements: 7.5 - Provide "Force Re-extract" option
    const forceReExtractBtn = $('forceReExtractBtn');
    if (forceReExtractBtn) {
      forceReExtractBtn.addEventListener('click', handleForceReExtract);
    }
    
    const dismissDuplicateBtn = $('dismissDuplicateBtn');
    if (dismissDuplicateBtn) {
      dismissDuplicateBtn.addEventListener('click', hideDuplicateWarning);
    }

    // Text cleaning checkbox
    // Requirements: 8.1, 8.2, 8.3 - Configurable cleaning rules
    const applyTextCleaningCheckbox = $('applyTextCleaning');
    if (applyTextCleaningCheckbox) {
      applyTextCleaningCheckbox.addEventListener('change', updateCleaningSummary);
    }

    // Listen for tab changes
    chrome.tabs.onActivated.addListener(checkCurrentPage);
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'complete') {
        checkCurrentPage();
      }
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  async function init() {
    console.log('BDLawCorpus Side Panel initializing...');
    
    await loadFromStorage();
    initTabs();
    bindEvents();
    initQualityDetailsPanel();
    initCleaningPreview();
    initQueueSettings();
    
    await checkCurrentPage();
    showCurrentVolume();
    updateQueueBadge();
    renderQueue();
    renderFailedExtractions();
    updateExportStats();
    
    // Requirements: 8.5 - Check for interrupted processing and offer to resume
    await checkForInterruptedProcessing();
    
    console.log('BDLawCorpus Side Panel ready');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
