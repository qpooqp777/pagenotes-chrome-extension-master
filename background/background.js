// background.js — PageNotes Service Worker (MV3) v1.04
// ================================================================
// 職責：訊息路由 + Context Menu
// IndexedDB 操作內聯在此檔案（notes-db.js 為參考文件）
// ================================================================

'use strict';

// ─── IndexedDB ───────────────────────────────────────────────
var _db = null, _dbReady = false;
var _dbQueue = [];

function _initDB(cb) {
  if (_dbReady && _db) { cb && cb(_db); return; }
  if (typeof indexedDB === 'undefined') { cb && cb(null); return; }
  var req = indexedDB.open('PageNotesDB', 1);
  req.onerror = function (e) { console.error('[PN] DB error', e); cb && cb(null); };
  req.onsuccess = function (e) {
    _db = e.target.result; _dbReady = true;
    _dbQueue.forEach(function (f) { f(_db); });
    _dbQueue = [];
    console.log('[PN] DB ready');
    cb && cb(_db);
  };
  req.onupgradeneeded = function (e) {
    var d = e.target.result;
    if (!d.objectStoreNames.contains('notes')) {
      var ns = d.createObjectStore('notes', { keyPath: 'id' });
      ns.createIndex('pageUrl', 'pageUrl', { unique: false });
      ns.createIndex('updatedAt', 'updatedAt', { unique: false });
    }
    if (!d.objectStoreNames.contains('highlights')) {
      var hs = d.createObjectStore('highlights', { keyPath: 'id' });
      hs.createIndex('pageUrl', 'pageUrl', { unique: false });
    }
    if (!d.objectStoreNames.contains('settings')) {
      d.createObjectStore('settings', { keyPath: 'key' });
    }
  };
}

function _withDB(cb) {
  if (_dbReady && _db) cb(_db); else _dbQueue.push(cb);
}

function _put(store, data, cb) {
  _withDB(function (db) {
    if (!db) { cb && cb(false); return; }
    try {
      var s = db.transaction(store, 'readwrite').objectStore(store);
      (data.id !== undefined ? s.put(data) : s.add(data))
        .onsuccess = function () { cb && cb(true); };
    } catch (e) { cb && cb(false); }
  });
}

function _del(store, key, cb) {
  _withDB(function (db) {
    if (!db) { cb && cb(false); return; }
    try { db.transaction(store, 'readwrite').objectStore(store).delete(key); } catch (e) {}
    cb && cb(true);
  });
}

function _get(store, key, cb) {
  _withDB(function (db) {
    if (!db) { cb && cb(null); return; }
    try {
      var r = db.transaction(store).objectStore(store).get(key);
      r.onsuccess = function (e) { cb && cb(e.target.result || null); };
      r.onerror = function () { cb && cb(null); };
    } catch (e) { cb && cb(null); }
  });
}

function _getAll(store, cb) {
  _withDB(function (db) {
    if (!db) { cb && cb([]); return; }
    try {
      var r = db.transaction(store).objectStore(store).getAll();
      r.onsuccess = function (e) { cb && cb(e.target.result || []); };
      r.onerror = function () { cb && cb([]); };
    } catch (e) { cb && cb([]); }
  });
}

function _getAllByIndex(store, index, value, cb) {
  _withDB(function (db) {
    if (!db) { cb && cb([]); return; }
    try {
      var r = db.transaction(store).objectStore(store).index(index).getAll(value);
      r.onsuccess = function (e) { cb && cb(e.target.result || []); };
      r.onerror = function () { cb && cb([]); };
    } catch (e) { cb && cb([]); }
  });
}

// ─── Note API ───────────────────────────────────────────────
function _createNote(data, cb) {
  var note = {
    id: 'note_' + Date.now() + '_' + Math.floor(Math.random() * 99999),
    pageUrl: data.pageUrl || '', pageTitle: data.pageTitle || '',
    content: data.content || '',
    x: data.x !== undefined ? data.x : 100,
    y: data.y !== undefined ? data.y : 100,
    width: data.width || 280, color: data.color || 'white',
    zIndex: data.zIndex || 2147483640,
    isPinned: false, isMinimized: false,
    createdAt: Date.now(), updatedAt: Date.now()
  };
  _put('notes', note, function (ok) { cb && cb(ok ? note : null); });
}

function _updateNote(id, updates, cb) {
  _get('notes', id, function (note) {
    if (!note) { cb && cb(null); return; }
    Object.keys(updates).forEach(function (k) { note[k] = updates[k]; });
    note.updatedAt = Date.now();
    _put('notes', note, function (ok) { cb && cb(ok ? note : null); });
  });
}

function _deleteNote(id, cb) { _del('notes', id, cb); }

function _getNotesByUrl(url, cb) { _getAllByIndex('notes', 'pageUrl', url, cb); }
function _getAllNotes(cb) { _getAll('notes', cb); }
function _getAllNotesSorted(cb) {
  _getAll('notes', function (notes) {
    notes.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    cb && cb(notes);
  });
}

// ─── Highlight API ─────────────────────────────────────────
function _createHighlight(data, cb) {
  var hl = {
    id: 'hl_' + Date.now() + '_' + Math.floor(Math.random() * 99999),
    pageUrl: data.pageUrl || '', text: data.text || '',
    color: data.color || 'yellow',
    noteId: data.noteId || null,
    createdAt: Date.now()
  };
  _put('highlights', hl, function (ok) { cb && cb(ok ? hl : null); });
}

function _deleteHighlight(id, cb) { _del('highlights', id, cb); }
function _getHighlightsByUrl(url, cb) { _getAllByIndex('highlights', 'pageUrl', url, cb); }
function _getAllHighlights(cb) { _getAll('highlights', cb); }

// ─── Settings API ───────────────────────────────────────────
function _saveSetting(k, v, cb) { _put('settings', { key: k, value: v }, cb); }
function _getSetting(k, dv, cb) {
  _get('settings', k, function (r) { cb && cb(r ? r.value : dv); });
}
function _getAllSettings(cb) {
  _getAll('settings', function (recs) {
    var s = {}; if (recs && recs.length) recs.forEach(function (r) { s[r.key] = r.value; });
    cb && cb(s);
  });
}

// ─── Data Management ────────────────────────────────────────
function _exportData(cb) {
  _getAll('notes', function (notes) {
    _getAll('highlights', function (hls) {
      cb && cb({ notes: notes, highlights: hls, exportedAt: new Date().toISOString() });
    });
  });
}

function _clearAll(cb) {
  var stores = ['notes', 'highlights', 'settings'];
  var p = stores.length, d = 0;
  stores.forEach(function (n) {
    _withDB(function (db) {
      if (db) try { db.transaction(n, 'readwrite').objectStore(n).clear(); } catch (e) {}
      d++;
      if (d === p) cb && cb(true);
    });
  });
}

function _getStats(cb) {
  _getAll('notes', function (notes) {
    _getAll('highlights', function (hls) {
      var pages = {};
      notes.forEach(function (n) {
        var m = n.pageUrl && n.pageUrl.match(/https?:\/\/([^\/]+)/);
        if (m) pages[m[1]] = (pages[m[1]] || 0) + 1;
      });
      var sorted = Object.entries(pages).sort(function (a, b) { return b[1] - a[1]; });
      cb && cb({ totalNotes: notes.length, totalHighlights: hls.length, totalPages: Object.keys(pages).length, topPages: sorted.slice(0, 5) });
    });
  });
}

// ─── Service Worker Lifecycle ────────────────────────────────
chrome.runtime.onInstalled.addListener(function () {
  console.log('[PageNotes] Installed v1.04');
  _initDB(function (ok) { if (ok) console.log('[PageNotes] DB ready'); else console.error('[PageNotes] DB FAILED'); });
  _setupContextMenu();
});

chrome.runtime.onStartup.addListener(function () {
  console.log('[PageNotes] Startup');
  _initDB();
});

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
  } catch (e) { console.error('[PN] Context menu error:', e); }
}

// ─── Message Handler ────────────────────────────────────────
chrome.runtime.onMessage.addListener(function (req, sender, res) {
  var t = req.type || '';

  if (t === 'CREATE_NOTE')          { _createNote(req.data || {}, function (n) { res(n); }); return true; }
  if (t === 'UPDATE_NOTE')           { _updateNote(req.id, req.updates || {}, function (n) { res(n); }); return true; }
  if (t === 'DELETE_NOTE')          { _deleteNote(req.id, function (ok) { res({ success: ok }); }); return true; }
  if (t === 'GET_NOTES_BY_URL')    { _getNotesByUrl(req.url || '', function (n) { res(n || []); }); return true; }
  if (t === 'GET_ALL_NOTES')        { _getAllNotes(function (n) { res(n || []); }); return true; }
  if (t === 'GET_ALL_NOTES_SORTED') { _getAllNotesSorted(function (n) { res(n || []); }); return true; }

  if (t === 'CREATE_HIGHLIGHT')     { _createHighlight(req.data || {}, function (h) { res(h); }); return true; }
  if (t === 'DELETE_HIGHLIGHT')     { _deleteHighlight(req.id, function (ok) { res({ success: ok }); }); return true; }
  if (t === 'GET_HIGHLIGHTS_BY_URL'){ _getHighlightsByUrl(req.url || '', function (h) { res(h || []); }); return true; }
  if (t === 'GET_ALL_HIGHLIGHTS')   { _getAllHighlights(function (h) { res(h || []); }); return true; }

  if (t === 'SAVE_SETTING')         { _saveSetting(req.key, req.value, function (ok) { res({ success: ok }); }); return true; }
  if (t === 'GET_SETTING')          { _getSetting(req.key, req.defaultValue, function (v) { res(v); }); return true; }
  if (t === 'GET_ALL_SETTINGS')     { _getAllSettings(function (s) { res(s || {}); }); return true; }

  if (t === 'EXPORT_DATA')           { _exportData(function (d) { res(d); }); return true; }
  if (t === 'CLEAR_ALL_DATA')       { _clearAll(function (ok) { res({ success: ok }); }); return true; }
  if (t === 'GET_STATS')            { _getStats(function (s) { res(s); }); return true; }

  res({ error: 'unknown type: ' + t }); return true;
});

console.log('[PageNotes] Service Worker loaded');
