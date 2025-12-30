/**
 * BDLawCorpus Background Service Worker
 * 
 * Handles:
 * - Side panel management
 * - File downloads
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

console.log('BDLawCorpus background service worker loaded');
