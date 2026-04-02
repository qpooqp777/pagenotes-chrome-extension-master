// background.js — PageNotes Service Worker (MV3) v1.05
// ================================================================
// 修復：
// 1. 訊息一定回應（即使 DB 還沒 ready）
// 2. CREATE_HIGHLIGHT 用同步 ID，確保 DOM 與 DB 一致
// ================================================================
'use strict';

// ─── IndexedDB ───────────────────────────────────────────────
var _db = null, _dbReady = false;

function _initDB(cb) {
  if (typeof indexedDB === 'undefined') { cb && cb(null); return; }
  var req = indexedDB.open('PageNotesDB', 1);
  req.onerror = function (e) { console.error('[PN] DB open error', e); cb && cb(null); };
  req.onsuccess = function (e) {
    _db = e.target.result;
    _dbReady = true;
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
  if (_dbReady && _db) { cb(_db); return true; }
  // DB 還沒 ready，立即回傳空結果，不卡住 caller
  return false;
}

// ─── Note API ───────────────────────────────────────────────
function _createNote(data, res) {
  var note = {
    id: 'note_' + Date.now() + '_' + Math.floor(Math.random() * 99999),
    pageUrl: data.pageUrl || '',
    pageTitle: data.pageTitle || '',
    content: data.content || '',
    x: data.x !== undefined ? data.x : 100,
    y: data.y !== undefined ? data.y : 100,
    width: data.width || 280,
    color: data.color || 'white',
    zIndex: data.zIndex || 2147483640,
    isPinned: false,
    isMinimized: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  if (_withDB(function (db) {
    try {
      db.transaction('notes', 'readwrite').objectStore('notes').put(note);
      res({ ok: true, note: note });
    } catch (e) { res({ ok: false }); }
  })) return;
  res({ ok: false });
}

function _updateNote(id, updates, res) {
  if (!_withDB(function (db) {
    try {
      var tx = db.transaction('notes', 'readwrite');
      var store = tx.objectStore('notes');
      var getReq = store.get(id);
      getReq.onsuccess = function (e) {
        var note = e.target.result;
        if (!note) { res({ ok: false }); return; }
        Object.keys(updates).forEach(function (k) { note[k] = updates[k]; });
        note.updatedAt = Date.now();
        store.put(note);
        res({ ok: true, note: note });
      };
      getReq.onerror = function () { res({ ok: false }); };
    } catch (e) { res({ ok: false }); }
  })) { res({ ok: false }); }
}

function _deleteNote(id, res) {
  if (_withDB(function (db) {
    try { db.transaction('notes', 'readwrite').objectStore('notes').delete(id); } catch (e) {}
    res({ ok: true });
  })) return;
  res({ ok: true }); // 視為成功（SW restart 後本來就沒了）
}

function _getNotesByUrl(url, res) {
  if (_withDB(function (db) {
    try {
      var req = db.transaction('notes').objectStore('notes').index('pageUrl').getAll(url);
      req.onsuccess = function (e) { res(e.target.result || []); };
      req.onerror = function () { res([]); };
    } catch (e) { res([]); }
  })) return;
  res([]);
}

function _getAllNotes(res) {
  if (_withDB(function (db) {
    try {
      var req = db.transaction('notes').objectStore('notes').getAll();
      req.onsuccess = function (e) { res(e.target.result || []); };
      req.onerror = function () { res([]); };
    } catch (e) { res([]); }
  })) return;
  res([]);
}

function _getAllNotesSorted(res) {
  _getAllNotes(function (notes) {
    notes.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    res(notes);
  });
}

// ─── Highlight API ─────────────────────────────────────────
// ★ 用同步 ID，確保 content script 立即拿到真實 ID寫入 DOM
function _createHighlight(data, res) {
  var hl = {
    id: 'hl_' + Date.now() + '_' + Math.floor(Math.random() * 99999),
    pageUrl: data.pageUrl || '',
    text: data.text || '',
    color: data.color || 'yellow',
    noteId: data.noteId || null,
    createdAt: Date.now()
  };
  if (_withDB(function (db) {
    try {
      db.transaction('highlights', 'readwrite').objectStore('highlights').put(hl);
      res(hl); // 同步回傳真實 ID，DOM 馬上可寫
    } catch (e) { res(null); }
  })) return;
  res(null);
}

function _deleteHighlight(id, res) {
  if (_withDB(function (db) {
    try { db.transaction('highlights', 'readwrite').objectStore('highlights').delete(id); } catch (e) {}
    res({ ok: true });
  })) return;
  res({ ok: true });
}

function _getHighlightsByUrl(url, res) {
  if (_withDB(function (db) {
    try {
      var req = db.transaction('highlights').objectStore('highlights').index('pageUrl').getAll(url);
      req.onsuccess = function (e) { res(e.target.result || []); };
      req.onerror = function () { res([]); };
    } catch (e) { res([]); }
  })) return;
  res([]);
}

function _getAllHighlights(res) {
  if (_withDB(function (db) {
    try {
      var req = db.transaction('highlights').objectStore('highlights').getAll();
      req.onsuccess = function (e) { res(e.target.result || []); };
      req.onerror = function () { res([]); };
    } catch (e) { res([]); }
  })) return;
  res([]);
}

// ─── Settings API ───────────────────────────────────────────
function _saveSetting(k, v, res) {
  if (_withDB(function (db) {
    try { db.transaction('settings', 'readwrite').objectStore('settings').put({ key: k, value: v }); res({ ok: true }); } catch (e) { res({ ok: false }); }
  })) return;
  res({ ok: false });
}

function _getSetting(k, dv, res) {
  if (_withDB(function (db) {
    try {
      var req = db.transaction('settings').objectStore('settings').get(k);
      req.onsuccess = function (e) { res(e.target.result ? e.target.result.value : dv); };
      req.onerror = function () { res(dv); };
    } catch (e) { res(dv); }
  })) return;
  res(dv);
}

function _getAllSettings(res) {
  if (_withDB(function (db) {
    try {
      var req = db.transaction('settings').objectStore('settings').getAll();
      req.onsuccess = function (e) {
        var s = {};
        (e.target.result || []).forEach(function (r) { s[r.key] = r.value; });
        res(s);
      };
      req.onerror = function () { res({}); };
    } catch (e) { res({}); }
  })) return;
  res({});
}

// ─── Data Management ────────────────────────────────────────
function _exportData(res) {
  _getAllNotes(function (notes) {
    _getAllHighlights(function (hls) {
      res({ notes: notes, highlights: hls, exportedAt: new Date().toISOString() });
    });
  });
}

function _clearAll(res) {
  if (!_withDB(function (db) {
    try {
      ['notes', 'highlights', 'settings'].forEach(function (n) {
        db.transaction(n, 'readwrite').objectStore(n).clear();
      });
      res({ ok: true });
    } catch (e) { res({ ok: false }); }
  })) { res({ ok: false }); }
}

function _getStats(res) {
  _getAllNotes(function (notes) {
    _getAllHighlights(function (hls) {
      var pages = {};
      notes.forEach(function (n) {
        var m = n.pageUrl && n.pageUrl.match(/https?:\/\/([^\/]+)/);
        if (m) pages[m[1]] = (pages[m[1]] || 0) + 1;
      });
      var sorted = Object.entries(pages).sort(function (a, b) { return b[1] - a[1]; });
      res({
        totalNotes: notes.length,
        totalHighlights: hls.length,
        totalPages: Object.keys(pages).length,
        topPages: sorted.slice(0, 5)
      });
    });
  });
}

// ─── Service Worker Lifecycle ────────────────────────────────
chrome.runtime.onInstalled.addListener(function () {
  console.log('[PN] Installed v1.05');
  _initDB(function (db) { console.log('[PN] DB', db ? 'OK' : 'FAIL'); });
  _setupContextMenu();
});

chrome.runtime.onStartup.addListener(function () {
  console.log('[PN] Startup');
  _initDB();
});

function _setupContextMenu() {
  try {
    chrome.contextMenus.removeAll(function () {
      chrome.contextMenus.create({ id: 'pn-addNote', title: '📝 在此新增筆記', contexts: ['page'] });
    });
    chrome.contextMenus.onClicked.addListener(function (info, tab) {
      if (info.menuItemId === 'pn-addNote') {
        chrome.tabs.sendMessage(tab.id, { type: 'CREATE_NOTE_AT_CENTER' });
      }
    });
  } catch (e) { console.error('[PN] ContextMenu error:', e); }
}

// ─── Message Handler ────────────────────────────────────────
// ★ 每一條訊息都一定回應，決不漏掉
chrome.runtime.onMessage.addListener(function (req, sender, res) {
  var t = req.type || '';

  if (t === 'CREATE_NOTE')          { _createNote(req.data || {}, res); return true; }
  if (t === 'UPDATE_NOTE')           { _updateNote(req.id, req.updates || {}, res); return true; }
  if (t === 'DELETE_NOTE')          { _deleteNote(req.id, res); return true; }
  if (t === 'GET_NOTES_BY_URL')    { _getNotesByUrl(req.url || '', res); return true; }
  if (t === 'GET_ALL_NOTES')        { _getAllNotes(res); return true; }
  if (t === 'GET_ALL_NOTES_SORTED') { _getAllNotesSorted(res); return true; }

  if (t === 'CREATE_HIGHLIGHT')     { _createHighlight(req.data || {}, res); return true; }
  if (t === 'DELETE_HIGHLIGHT')     { _deleteHighlight(req.id, res); return true; }
  if (t === 'GET_HIGHLIGHTS_BY_URL'){ _getHighlightsByUrl(req.url || '', res); return true; }
  if (t === 'GET_ALL_HIGHLIGHTS')   { _getAllHighlights(res); return true; }

  if (t === 'SAVE_SETTING')         { _saveSetting(req.key, req.value, res); return true; }
  if (t === 'GET_SETTING')          { _getSetting(req.key, req.defaultValue, res); return true; }
  if (t === 'GET_ALL_SETTINGS')     { _getAllSettings(res); return true; }

  if (t === 'EXPORT_DATA')           { _exportData(res); return true; }
  if (t === 'CLEAR_ALL_DATA')       { _clearAll(res); return true; }
  if (t === 'GET_STATS')            { _getStats(res); return true; }

  // 不認識的訊息也要回應
  res({ error: 'unknown type: ' + t });
  return true;
});

console.log('[PN] Service Worker v1.05 loaded');
