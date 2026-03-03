/**
 * BDLawCorpus Background Service Worker
 *
 * Handles:
 * - Side panel management
 * - File downloads
 * - Service worker keep-alive utilities for long-running operations
 *
 * Storage note: IndexedDB is the primary corpus store (accessible from service
 * workers). chrome.storage.local (with unlimitedStorage permission) is the
 * fallback. Global variables must NEVER be used for persistent state — they
 * are reset on every service worker restart.
 *
 * Keep-alive: Use waitUntil() or startHeartbeat()/stopHeartbeat() when
 * initiating any operation that may take >30s to prevent the service worker
 * from being terminated mid-operation.
 */

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) {
    console.error('Failed to open side panel:', e);
  }
});

// Set side panel behavior - open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(e => console.error('Failed to set panel behavior:', e));

// Handle download requests from popup/sidepanel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  
  // Handle JSON downloads
  if (msg.type === 'downloadJSON') {
    (async () => {
      try {
        const content = typeof msg.content === 'string' ? msg.content : '';
        const filename = msg.filename || 'bdlaw_export.json';
        
        // Create data URL for JSON content
        const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(content);
        
        // Trigger download
        await chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: false
        });
        
        sendResponse({ ok: true });
      } catch (e) {
        console.error('Download failed:', e);
        sendResponse({ ok: false, error: e?.message || 'Download failed' });
      }
    })();
    
    return true; // Keep channel open for async response
  }
  
  // Handle text/markdown downloads
  // Requirements: 9.1, 9.2, 9.5 - Support downloading research documents
  if (msg.type === 'downloadText') {
    (async () => {
      try {
        const content = typeof msg.content === 'string' ? msg.content : '';
        const filename = msg.filename || 'bdlaw_export.txt';
        const mimeType = msg.mimeType || 'text/plain';
        
        // Create data URL for text content
        const dataUrl = `data:${mimeType};charset=utf-8,` + encodeURIComponent(content);
        
        // Trigger download
        await chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: false
        });
        
        sendResponse({ ok: true });
      } catch (e) {
        console.error('Download failed:', e);
        sendResponse({ ok: false, error: e?.message || 'Download failed' });
      }
    })();
    
    return true; // Keep channel open for async response
  }
});

// ---------------------------------------------------------------------------
// Service Worker Keep-Alive Utilities
// (Official pattern from developer.chrome.com/docs/extensions/develop/migrate)
// ---------------------------------------------------------------------------

/**
 * Wraps a long-running promise, keeping the service worker alive by pinging
 * chrome.runtime.getPlatformInfo every 25 seconds. Use for any single
 * async operation that might exceed the 30s service worker timeout.
 *
 * @param {Promise} promise - The long-running operation to await.
 * @returns {Promise} Resolves/rejects with the same value as the input promise.
 */
async function waitUntil(promise) {
  const keepAlive = setInterval(chrome.runtime.getPlatformInfo, 25 * 1000);
  try {
    return await promise;
  } finally {
    clearInterval(keepAlive);
  }
}

/**
 * Heartbeat interval reference for startHeartbeat/stopHeartbeat pair.
 * @type {number|undefined}
 */
let _heartbeatInterval;

/**
 * Starts a heartbeat that writes a timestamp to chrome.storage.local every
 * 20 seconds, keeping the service worker alive during extended batch work.
 * Call stopHeartbeat() when the operation finishes.
 *
 * Preferred over waitUntil() when the duration is unknown (e.g. queued batch
 * processing triggered by chrome.alarms).
 */
async function startHeartbeat() {
  await chrome.storage.local.set({ 'bdlaw-sw-heartbeat': Date.now() });
  _heartbeatInterval = setInterval(async () => {
    await chrome.storage.local.set({ 'bdlaw-sw-heartbeat': Date.now() });
  }, 20 * 1000);
}

/** Stops the service worker heartbeat started by startHeartbeat(). */
function stopHeartbeat() {
  if (_heartbeatInterval !== undefined) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = undefined;
  }
}

// ---------------------------------------------------------------------------
// Alarm-based retry trigger
// Fired by bdlaw-queue when a persistent retry queue needs processing.
// chrome.alarms is used instead of setTimeout because alarms survive service
// worker restarts; setTimeout is canceled when the worker terminates.
// ---------------------------------------------------------------------------
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'bdlaw-retry-queue') {
    // Notify the side panel to process the persisted retry queue.
    // The side panel may not be open; the message will be silently dropped
    // if no listener is registered — this is intentional (retry on next open).
    chrome.runtime.sendMessage({ type: 'processRetryQueue' }).catch(() => {});
  }
});

console.log('BDLawCorpus background service worker loaded');
