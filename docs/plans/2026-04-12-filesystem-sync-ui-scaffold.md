# Filesystem Sync UI Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the filesystem sync area visibly appear in the Export sidebar so the missing UI can be validated before implementing real sync behavior.

**Architecture:** Add a small, always-rendered filesystem sync section to `sidepanel.html`, style it in `sidepanel.css`, and wire minimal placeholder state/handlers in `sidepanel.js` so the panel shows a stable default status instead of nothing. Add one targeted UI test that proves the controls exist in the export markup.

**Tech Stack:** Chrome Extension MV3, side panel HTML/CSS/JS, Jest, jsdom.

---

### Task 1: Add Export-tab filesystem sync markup

**Files:**
- Modify: `sidepanel.html`

**Step 1: Add the section markup**

Insert a new export-tab section with these controls:

```html
<div id="filesystemSyncSection" class="filesystem-sync-section">
  <h4>📁 Local Filesystem Sync</h4>
  <p class="section-description">Prepare a local sync target for canonical act files and sync manifests.</p>
  <label class="checkbox-label">
    <input type="checkbox" id="enableFilesystemSync">
    Enable filesystem sync
  </label>
  <div class="sync-controls-row">
    <button id="selectSyncFolderBtn" class="action-btn secondary">Select Sync Folder</button>
    <button id="syncNowBtn" class="action-btn secondary">Sync Now</button>
  </div>
  <button id="reconnectSyncFolderBtn" class="action-btn secondary small">Reconnect Folder</button>
  <div id="syncStatusLabel" class="sync-status-label">Not configured</div>
</div>
```

**Step 2: Verify visually in markup review**

Expected: section appears inside the Export tab near other export controls.

---

### Task 2: Add minimal styles for the new section

**Files:**
- Modify: `sidepanel.css`

**Step 1: Add styles**

Add compact styling for:

```css
.filesystem-sync-section { ... }
.sync-controls-row { ... }
.sync-status-label { ... }
.sync-note { ... }
```

**Step 2: Verify style intent**

Expected: section visually matches other export panels and is clearly visible.

---

### Task 3: Add minimal sidepanel wiring

**Files:**
- Modify: `sidepanel.js`

**Step 1: Add minimal state**

Add a small UI-only state object:

```javascript
filesystemSync: {
  enabled: false,
  folderName: null,
  statusLabel: 'Not configured'
}
```

**Step 2: Add minimal UI updater**

Add a helper that updates the checkbox/button states and status label.

**Step 3: Add placeholder handlers**

Bind handlers for:
- `enableFilesystemSync`
- `selectSyncFolderBtn`
- `syncNowBtn`
- `reconnectSyncFolderBtn`

These should update UI text safely without implementing full File System Access behavior yet.

**Step 4: Call the updater during init/export-tab refresh**

Expected: the section shows a stable default status when the side panel loads and when the Export tab opens.

---

### Task 4: Add targeted UI regression test

**Files:**
- Create: `tests/integration/filesystem-sync-ui.test.js`

**Step 1: Write the test**

```javascript
/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

test('export sidebar includes filesystem sync controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../sidepanel.html'), 'utf8');
  document.documentElement.innerHTML = html;

  expect(document.getElementById('filesystemSyncSection')).not.toBeNull();
  expect(document.getElementById('enableFilesystemSync')).not.toBeNull();
  expect(document.getElementById('selectSyncFolderBtn')).not.toBeNull();
  expect(document.getElementById('syncNowBtn')).not.toBeNull();
  expect(document.getElementById('reconnectSyncFolderBtn')).not.toBeNull();
  expect(document.getElementById('syncStatusLabel').textContent).toContain('Not configured');
});
```

**Step 2: Run the targeted test**

Run: `npx jest tests/integration/filesystem-sync-ui.test.js --runInBand`

Expected: PASS.

---

### Task 5: Verify + document current scope

**Files:**
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`

**Step 1: Update memory bank**

Document that the sidebar visibility issue was caused by missing implementation, and that a minimal UI scaffold now exists while full sync behavior remains future work.

**Step 2: Run final verification**

Run:

```bash
npx jest tests/integration/filesystem-sync-ui.test.js --runInBand
node --check sidepanel.js
```

Expected: PASS / no syntax errors.