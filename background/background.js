// background.js — PageNotes Service Worker (MV3)
// ==============================================================
// 職責：訊息路由 + Context Menu
// 所有 IndexedDB 操作委派給 notes-db.js
// ==============================================================

// ─── Service Worker Lifecycle ────────────────────────────────
chrome.runtime.onInstalled.addListener(function () {
  console.log('[PageNotes] Installed v1.04');
  PNDB.init(function (ok) {
    if (ok) console.log('[PageNotes] DB ready');
    else console.error('[PageNotes] DB FAILED');
  });
  _setupContextMenu();
});

chrome.runtime.onStartup.addListener(function () {
  console.log('[PageNotes] Startup');
  PNDB.init();
});

// ─── Context Menu ───────────────────────────────────────────
function _setupContextMenu() {
  try {
    chrome.contextMenus.removeAll(function () {
      chrome.contextMenus.create({
        id: 'pn-addNote',
        title: '📝 在此新增筆記',
        contexts: ['page']
      });
    });
    chrome.contextMenus.onClicked.addListener(function (info, tab) {
      if (info.menuItemId === 'pn-addNote') {
        chrome.tabs.sendMessage(tab.id, { type: 'CREATE_NOTE_AT_CENTER' });
      }
    });
  } catch (e) {
    console.error('[PN] Context menu error:', e);
  }
}

// ─── Message Handler ────────────────────────────────────────
chrome.runtime.onMessage.addListener(function (req, sender, res) {
  var t = req.type || '';

  // ── Notes ────────────────────────────────────────────────
  if (t === 'CREATE_NOTE') {
    PNDB.note.create(req.data || {}, function (note) { res(note); });
    return true;
  }
  if (t === 'UPDATE_NOTE') {
    PNDB.note.update(req.id, req.updates || {}, function (note) { res(note); });
    return true;
  }
  if (t === 'DELETE_NOTE') {
    PNDB.note.delete(req.id, function (ok) { res({ success: ok }); });
    return true;
  }
  if (t === 'GET_NOTES_BY_URL') {
    PNDB.note.getByUrl(req.url || '', function (notes) { res(notes || []); });
    return true;
  }
  if (t === 'GET_ALL_NOTES') {
    PNDB.note.getAll(function (notes) { res(notes || []); });
    return true;
  }
  if (t === 'GET_ALL_NOTES_SORTED') {
    PNDB.note.getAllSorted(function (notes) { res(notes || []); });
    return true;
  }

  // ── Highlights ──────────────────────────────────────────
  if (t === 'CREATE_HIGHLIGHT') {
    PNDB.highlight.create(req.data || {}, function (hl) { res(hl); });
    return true;
  }
  if (t === 'DELETE_HIGHLIGHT') {
    PNDB.highlight.delete(req.id, function (ok) { res({ success: ok }); });
    return true;
  }
  if (t === 'GET_HIGHLIGHTS_BY_URL') {
    PNDB.highlight.getByUrl(req.url || '', function (hls) { res(hls || []); });
    return true;
  }
  if (t === 'GET_ALL_HIGHLIGHTS') {
    PNDB.highlight.getAll(function (hls) { res(hls || []); });
    return true;
  }

  // ── Settings ────────────────────────────────────────────
  if (t === 'SAVE_SETTING') {
    PNDB.settings.save(req.key, req.value, function (ok) { res({ success: ok }); });
    return true;
  }
  if (t === 'GET_SETTING') {
    PNDB.settings.get(req.key, req.defaultValue, function (val) { res(val); });
    return true;
  }
  if (t === 'GET_ALL_SETTINGS') {
    PNDB.settings.getAll(function (sets) { res(sets || {}); });
    return true;
  }

  // ── Data Management ────────────────────────────────────
  if (t === 'EXPORT_DATA') {
    PNDB.data.export(function (data) { res(data); });
    return true;
  }
  if (t === 'CLEAR_ALL_DATA') {
    PNDB.data.clear(function (ok) { res({ success: ok }); });
    return true;
  }

  // ── Stats ──────────────────────────────────────────────
  if (t === 'GET_STATS') {
    PNDB.data.stats(function (stats) { res(stats); });
    return true;
  }

  res({ error: 'unknown type: ' + t });
  return true;
});

console.log('[PageNotes] Service Worker loaded');
