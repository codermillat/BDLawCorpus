# Filesystem Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a folder-based filesystem sync mode so BDLawCorpus can continuously mirror successful acts, failed-act JSONs, audit logs, and sync manifests into a user-selected directory with deduplication, resume support, and no timestamp-based duplicates in sync mode.

**Architecture:** Keep IndexedDB and existing queue/storage flow as the source of truth. Add a sidepanel-driven filesystem sync layer that stores a persistent directory handle, writes canonical files into organized subfolders, and maintains `sync-manifest.json` + `sync-state.json` so sync can resume after restart, permission loss, or interrupted export runs.

**Tech Stack:** Chrome Extension Manifest V3, Side Panel UI, File System Access API (`showDirectoryPicker` / `FileSystemDirectoryHandle`), IndexedDB, `chrome.storage.local`, Jest.

---

## Preconditions / Notes

- The sync feature should be **separate** from the current timestamped manual export flow.
- Manual export keeps current behavior unless explicitly refactored later.
- Sync mode uses **canonical filenames**:
  - `acts/<act_number>.json`
  - `failed/<act_number>.failed.json`
  - `logs/audit-log.ndjson`
  - `logs/sync-log.ndjson`
  - `manifests/sync-manifest.json`
  - `manifests/sync-state.json`
- File system directory handles should **not** be stored in `chrome.storage.local`; persist them in IndexedDB.

---

### Task 1: Create the sync manifest/domain module

**Files:**
- Create: `bdlaw-sync-manifest.js`
- Test: `tests/property/sync-manifest.property.test.js`

**Step 1: Write the failing test**

```javascript
const BDLawSyncManifest = require('../../bdlaw-sync-manifest.js');

describe('BDLawSyncManifest', () => {
  test('creates empty manifest with expected top-level keys', () => {
    const manifest = BDLawSyncManifest.createEmptyManifest();

    expect(manifest.schema_version).toBe('1.0');
    expect(manifest.acts).toEqual({});
    expect(manifest.failed).toEqual({});
    expect(manifest.logs).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/property/sync-manifest.property.test.js --runInBand`

Expected: FAIL with module not found or missing function.

**Step 3: Write minimal implementation**

```javascript
const BDLawSyncManifest = {
  createEmptyManifest() {
    return {
      schema_version: '1.0',
      acts: {},
      failed: {},
      logs: {
        audit_log_bytes: 0,
        sync_log_bytes: 0
      },
      last_synced_at: null
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BDLawSyncManifest;
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/property/sync-manifest.property.test.js --runInBand`

Expected: PASS.

**Step 5: Commit**

```bash
git add bdlaw-sync-manifest.js tests/property/sync-manifest.property.test.js
git commit -m "feat: add sync manifest module scaffold"
```

---

### Task 2: Add manifest diff/dedup logic

**Files:**
- Modify: `bdlaw-sync-manifest.js`
- Test: `tests/property/sync-deduplication.property.test.js`

**Step 1: Write the failing test**

```javascript
const BDLawSyncManifest = require('../../bdlaw-sync-manifest.js');

describe('sync deduplication', () => {
  test('skips write when act hash and status are unchanged', () => {
    const manifest = BDLawSyncManifest.createEmptyManifest();
    manifest.acts['503'] = {
      content_hash: 'abc',
      path: 'acts/503.json'
    };

    const result = BDLawSyncManifest.shouldSyncSuccessfulAct(manifest, {
      actNumber: '503',
      contentHash: 'abc'
    });

    expect(result).toEqual({ needed: false, reason: 'unchanged' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/property/sync-deduplication.property.test.js --runInBand`

Expected: FAIL with missing function.

**Step 3: Write minimal implementation**

Add these functions to `bdlaw-sync-manifest.js`:

```javascript
shouldSyncSuccessfulAct(manifest, act) {
  const existing = manifest?.acts?.[act.actNumber];
  if (!existing) return { needed: true, reason: 'new' };
  if (existing.content_hash === act.contentHash) {
    return { needed: false, reason: 'unchanged' };
  }
  return { needed: true, reason: 'content_changed' };
},

shouldSyncFailedAct(manifest, failedEntry) {
  const existing = manifest?.failed?.[failedEntry.act_number];
  const fingerprint = `${failedEntry.failure_reason}:${failedEntry.retry_count}:${failedEntry.max_retries}`;
  if (!existing) return { needed: true, reason: 'new_failed' };
  if (existing.failure_fingerprint === fingerprint) {
    return { needed: false, reason: 'unchanged' };
  }
  return { needed: true, reason: 'failure_changed' };
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/property/sync-deduplication.property.test.js --runInBand`

Expected: PASS.

**Step 5: Commit**

```bash
git add bdlaw-sync-manifest.js tests/property/sync-deduplication.property.test.js
git commit -m "feat: add sync dedup rules for acts and failed entries"
```

---

### Task 3: Extend storage for directory handle + sync state

**Files:**
- Modify: `bdlaw-storage.js`
- Test: `tests/integration/filesystem-sync-storage.test.js`

**Step 1: Write the failing test**

```javascript
const StorageManager = require('../../bdlaw-storage.js');

describe('filesystem sync storage', () => {
  test('persists and loads sync state record', async () => {
    await StorageManager.initialize();

    await StorageManager.saveSyncState({
      folder_name: 'bdlaw-sync',
      sync_enabled: true
    });

    const state = await StorageManager.loadSyncState();
    expect(state.sync_enabled).toBe(true);
    expect(state.folder_name).toBe('bdlaw-sync');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/integration/filesystem-sync-storage.test.js --runInBand`

Expected: FAIL with missing `saveSyncState` / `loadSyncState`.

**Step 3: Write minimal implementation**

- Add a new IndexedDB object store, e.g. `sync_meta`.
- Add methods to `StorageManager`:

```javascript
async saveSyncState(state) { /* put into sync_meta with key 'state' */ }
async loadSyncState() { /* get from sync_meta key 'state' */ }
async saveSyncDirectoryHandle(handle) { /* put into sync_meta key 'directory_handle' */ }
async loadSyncDirectoryHandle() { /* get from sync_meta key 'directory_handle' */ }
async clearSyncDirectoryHandle() { /* delete handle record */ }
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/integration/filesystem-sync-storage.test.js --runInBand`

Expected: PASS.

**Step 5: Commit**

```bash
git add bdlaw-storage.js tests/integration/filesystem-sync-storage.test.js
git commit -m "feat: persist filesystem sync state in IndexedDB"
```

---

### Task 4: Create filesystem sync runtime module

**Files:**
- Create: `bdlaw-filesystem-sync.js`
- Modify: `sidepanel.html`
- Test: `tests/integration/filesystem-sync-runtime.test.js`

**Step 1: Write the failing test**

```javascript
const BDLawFilesystemSync = require('../../bdlaw-filesystem-sync.js');

describe('filesystem sync runtime', () => {
  test('returns canonical path for successful act', () => {
    expect(BDLawFilesystemSync.getActPath('503')).toBe('acts/503.json');
  });

  test('returns canonical path for failed act', () => {
    expect(BDLawFilesystemSync.getFailedPath('503')).toBe('failed/503.failed.json');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/integration/filesystem-sync-runtime.test.js --runInBand`

Expected: FAIL with module not found.

**Step 3: Write minimal implementation**

```javascript
const BDLawFilesystemSync = {
  getActPath(actNumber) {
    return `acts/${actNumber}.json`;
  },

  getFailedPath(actNumber) {
    return `failed/${actNumber}.failed.json`;
  },

  getManifestPath() {
    return 'manifests/sync-manifest.json';
  },

  getStatePath() {
    return 'manifests/sync-state.json';
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BDLawFilesystemSync;
}
```

Also load the new script in `sidepanel.html` after existing core modules.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/integration/filesystem-sync-runtime.test.js --runInBand`

Expected: PASS.

**Step 5: Commit**

```bash
git add bdlaw-filesystem-sync.js sidepanel.html tests/integration/filesystem-sync-runtime.test.js
git commit -m "feat: add filesystem sync runtime module"
```

---

### Task 5: Add folder selection and permission recovery UI

**Files:**
- Modify: `sidepanel.html`
- Modify: `sidepanel.js`
- Test: `tests/integration/filesystem-sync-ui.test.js`

**Step 1: Write the failing test**

```javascript
describe('filesystem sync UI', () => {
  test('shows sync controls when export tab renders', () => {
    document.body.innerHTML = `
      <button id="selectSyncFolderBtn"></button>
      <div id="syncStatusLabel"></div>
    `;

    expect(document.getElementById('selectSyncFolderBtn')).not.toBeNull();
    expect(document.getElementById('syncStatusLabel')).not.toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/integration/filesystem-sync-ui.test.js --runInBand`

Expected: FAIL until UI controls are added and wired.

**Step 3: Write minimal implementation**

Add export-tab controls in `sidepanel.html`:

```html
<section id="filesystemSyncSection">
  <label>
    <input type="checkbox" id="enableFilesystemSync">
    Enable filesystem sync
  </label>
  <button id="selectSyncFolderBtn">Select Sync Folder</button>
  <button id="syncNowBtn">Sync Now</button>
  <button id="reconnectSyncFolderBtn">Reconnect Folder</button>
  <div id="syncStatusLabel">Not configured</div>
</section>
```

In `sidepanel.js`, add:

```javascript
async function handleSelectSyncFolder() {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await StorageManager.saveSyncDirectoryHandle(handle);
  await StorageManager.saveSyncState({ sync_enabled: true, folder_name: handle.name });
}
```

Also add permission-check helpers using `queryPermission` / `requestPermission`.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/integration/filesystem-sync-ui.test.js --runInBand`

Expected: PASS.

**Step 5: Commit**

```bash
git add sidepanel.html sidepanel.js tests/integration/filesystem-sync-ui.test.js
git commit -m "feat: add filesystem sync controls and folder selection"
```

---

### Task 6: Implement canonical act + failed-act sync writes

**Files:**
- Modify: `bdlaw-filesystem-sync.js`
- Modify: `sidepanel.js`
- Test: `tests/integration/filesystem-sync-write-flow.test.js`

**Step 1: Write the failing test**

```javascript
const BDLawFilesystemSync = require('../../bdlaw-filesystem-sync.js');

describe('filesystem sync writes', () => {
  test('writes successful act to canonical file path', async () => {
    const calls = [];
    const fakeRoot = createFakeDirectory(calls);

    await BDLawFilesystemSync.writeSuccessfulAct(fakeRoot, '503', '{"act_number":"503"}');

    expect(calls).toContainEqual(['writeFile', 'acts/503.json']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/integration/filesystem-sync-write-flow.test.js --runInBand`

Expected: FAIL with missing writer.

**Step 3: Write minimal implementation**

Add writer helpers to `bdlaw-filesystem-sync.js`:

```javascript
async writeTextFile(rootHandle, relativePath, content) { /* ensure subdirs, create writable, write, close */ }
async writeSuccessfulAct(rootHandle, actNumber, jsonContent) {
  return this.writeTextFile(rootHandle, this.getActPath(actNumber), jsonContent);
}
async writeFailedAct(rootHandle, actNumber, jsonContent) {
  return this.writeTextFile(rootHandle, this.getFailedPath(actNumber), jsonContent);
}
```

Hook from `sidepanel.js` so sync mode calls these after export JSON is built.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/integration/filesystem-sync-write-flow.test.js --runInBand`

Expected: PASS.

**Step 5: Commit**

```bash
git add bdlaw-filesystem-sync.js sidepanel.js tests/integration/filesystem-sync-write-flow.test.js
git commit -m "feat: write canonical sync files for acts and failed entries"
```

---

### Task 7: Add manifest/state update and failed→success reconciliation

**Files:**
- Modify: `bdlaw-sync-manifest.js`
- Modify: `bdlaw-filesystem-sync.js`
- Modify: `sidepanel.js`
- Test: `tests/integration/filesystem-sync-reconcile.test.js`

**Step 1: Write the failing test**

```javascript
describe('failed to success reconciliation', () => {
  test('removes failed file when a later successful act is synced', async () => {
    const ops = [];
    const fakeRoot = createFakeDirectory(ops);

    await BDLawFilesystemSync.reconcileActTransition(fakeRoot, {
      actNumber: '503',
      becameSuccessful: true
    });

    expect(ops).toContainEqual(['deleteFile', 'failed/503.failed.json']);
    expect(ops).toContainEqual(['writeFile', 'acts/503.json']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/integration/filesystem-sync-reconcile.test.js --runInBand`

Expected: FAIL.

**Step 3: Write minimal implementation**

Implement:

```javascript
async reconcileActTransition(rootHandle, options) {
  if (options.becameSuccessful) {
    await this.deleteIfExists(rootHandle, this.getFailedPath(options.actNumber));
  }
}

updateManifestForSuccessfulAct(manifest, actNumber, contentHash) { /* update acts index and remove failed index */ }
updateManifestForFailedAct(manifest, failedEntry) { /* update failed index */ }
```

Update `sidepanel.js` so successful retry sync removes stale failed record from folder and manifest.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/integration/filesystem-sync-reconcile.test.js --runInBand`

Expected: PASS.

**Step 5: Commit**

```bash
git add bdlaw-sync-manifest.js bdlaw-filesystem-sync.js sidepanel.js tests/integration/filesystem-sync-reconcile.test.js
git commit -m "feat: reconcile failed-to-success filesystem sync transitions"
```

---

### Task 8: Add audit-log and sync-log flushing

**Files:**
- Modify: `bdlaw-filesystem-sync.js`
- Modify: `sidepanel.js`
- Test: `tests/integration/filesystem-sync-log-flush.test.js`

**Step 1: Write the failing test**

```javascript
describe('sync log flushing', () => {
  test('appends audit and sync events to ndjson logs', async () => {
    const ops = [];
    const fakeRoot = createFakeDirectory(ops);

    await BDLawFilesystemSync.appendNdjson(fakeRoot, 'logs/sync-log.ndjson', { event: 'act_synced' });

    expect(ops).toContainEqual(['appendFile', 'logs/sync-log.ndjson']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/integration/filesystem-sync-log-flush.test.js --runInBand`

Expected: FAIL.

**Step 3: Write minimal implementation**

Implement NDJSON helpers in `bdlaw-filesystem-sync.js`:

```javascript
async appendNdjson(rootHandle, relativePath, record) {
  const line = JSON.stringify(record) + '\n';
  return this.appendTextFile(rootHandle, relativePath, line);
}
```

In `sidepanel.js`, call sync-log append on:
- folder selected
- act synced
- failed act synced
- sync error
- permission lost
- reconcile completed

For audit log export sync, pull from `StorageManager.getAuditLog()` and flush a serialized NDJSON snapshot/checkpoint.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/integration/filesystem-sync-log-flush.test.js --runInBand`

Expected: PASS.

**Step 5: Commit**

```bash
git add bdlaw-filesystem-sync.js sidepanel.js tests/integration/filesystem-sync-log-flush.test.js
git commit -m "feat: append audit and sync ndjson logs"
```

---

### Task 9: Wire automatic sync triggers and startup resume

**Files:**
- Modify: `sidepanel.js`
- Modify: `bdlaw-storage.js`
- Test: `tests/integration/filesystem-sync-resume.test.js`

**Step 1: Write the failing test**

```javascript
describe('filesystem sync resume', () => {
  test('queues unsynced acts on startup when sync is enabled', async () => {
    const syncState = { sync_enabled: true, folder_name: 'bdlaw-sync' };
    const manifest = { schema_version: '1.0', acts: {}, failed: {}, logs: {} };

    const result = buildPendingSyncQueue({
      capturedActs: [{ actNumber: '503', content_raw_sha256: 'abc' }],
      failedExtractions: [],
      manifest,
      syncState
    });

    expect(result.pendingActs).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/integration/filesystem-sync-resume.test.js --runInBand`

Expected: FAIL.

**Step 3: Write minimal implementation**

In `sidepanel.js`:
- add `initializeFilesystemSync()` during init
- load handle + sync state + manifest
- verify permission
- build pending sync queue from current `state.capturedActs` and `state.failedExtractions`
- debounce `flushFilesystemSyncQueue()` after capture/failure changes

Add a pure helper for pending queue creation so it is easy to test.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/integration/filesystem-sync-resume.test.js --runInBand`

Expected: PASS.

**Step 5: Commit**

```bash
git add sidepanel.js bdlaw-storage.js tests/integration/filesystem-sync-resume.test.js
git commit -m "feat: resume filesystem sync from manifest and stored handle"
```

---

### Task 10: Add manual reconcile and permission-loss UX

**Files:**
- Modify: `sidepanel.html`
- Modify: `sidepanel.js`
- Test: `tests/integration/filesystem-sync-permission.test.js`

**Step 1: Write the failing test**

```javascript
describe('permission loss UX', () => {
  test('marks sync as paused when directory permission is lost', async () => {
    const status = computeSyncStatus({ permission: 'denied', syncEnabled: true });
    expect(status.label).toBe('Permission lost');
    expect(status.paused).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/integration/filesystem-sync-permission.test.js --runInBand`

Expected: FAIL.

**Step 3: Write minimal implementation**

Add UI buttons and handlers:
- `Reconnect Folder`
- `Sync Now`
- `Reconcile Existing Folder`
- `Pause Sync`

Add a pure helper:

```javascript
function computeSyncStatus({ permission, syncEnabled }) {
  if (!syncEnabled) return { label: 'Disabled', paused: true };
  if (permission !== 'granted') return { label: 'Permission lost', paused: true };
  return { label: 'Ready', paused: false };
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/integration/filesystem-sync-permission.test.js --runInBand`

Expected: PASS.

**Step 5: Commit**

```bash
git add sidepanel.html sidepanel.js tests/integration/filesystem-sync-permission.test.js
git commit -m "feat: handle filesystem sync permission loss and reconcile UX"
```

---

### Task 11: Update documentation and verification checklist

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/STORAGE_API.md`
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/systemPatterns.md`
- Modify: `memory-bank/progress.md`

**Step 1: Write the doc assertions as a checklist**

Document these exact facts:
- sync mode is optional and separate from manual export
- sync mode uses canonical filenames, not timestamped filenames
- sync root contains `acts/`, `failed/`, `logs/`, `manifests/`
- folder handle is stored in IndexedDB
- sync manifest/state enable dedup and resume

**Step 2: Update docs**

Add concise sections to the files above. Do not rewrite unrelated docs.

**Step 3: Run targeted tests**

Run:

```bash
npx jest \
  tests/property/sync-manifest.property.test.js \
  tests/property/sync-deduplication.property.test.js \
  tests/integration/filesystem-sync-storage.test.js \
  tests/integration/filesystem-sync-runtime.test.js \
  tests/integration/filesystem-sync-write-flow.test.js \
  tests/integration/filesystem-sync-reconcile.test.js \
  tests/integration/filesystem-sync-log-flush.test.js \
  tests/integration/filesystem-sync-resume.test.js \
  tests/integration/filesystem-sync-permission.test.js \
  --runInBand
```

Expected: PASS.

**Step 4: Run one manual validation in Chrome**

Checklist:
- select folder
- capture one act
- confirm `acts/<id>.json` appears
- mark/create one failed act and confirm `failed/<id>.failed.json` appears
- confirm `manifests/sync-manifest.json` updates
- reload panel and confirm sync resumes without duplicates

**Step 5: Commit**

```bash
git add README.md docs/ARCHITECTURE.md docs/STORAGE_API.md memory-bank/activeContext.md memory-bank/systemPatterns.md memory-bank/progress.md
git commit -m "docs: document filesystem sync architecture and workflow"
```

---

## Suggested final verification sequence

Run these after all tasks:

```bash
npx jest tests/integration/filesystem-sync-*.test.js tests/property/sync-*.test.js --runInBand
npx jest tests/property/research-integrity-preservation.property.test.js tests/property/persist-before-done.property.test.js --runInBand
```

Then validate manually in Chrome with a fresh sync folder.

---

## YAGNI guardrails

Do **not** implement any of these in this feature:
- cloud sync
- multi-folder sync
- bidirectional import from filesystem into IndexedDB
- background service worker sync without sidepanel presence
- per-volume folder partitioning unless later required

Keep the feature limited to **one selected folder, canonical files, manifests, logs, dedup, and resume**.