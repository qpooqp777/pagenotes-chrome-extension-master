// notes-db.js — PageNotes IndexedDB CRUD (唯一 DB 層)
// ==============================================================
// 所有 IndexedDB 操作集中在此檔案，background.js 依賴它。
// 注意：Chrome Extension Service Worker 無法使用 ES module，
// 故以 IIFE 封裝，暴露全域工廠函式。
(function (root) {
  'use strict';

  var DB_NAME = 'PageNotesDB';
  var DB_VERSION = 1;
  var _db = null;
  var _ready = false;
  var _pending = []; // DB 未就緒時的排隊回呼

  // ─── Init ────────────────────────────────────────────────────
  function initDB(cb) {
    if (_ready && _db) { cb && cb(_db); return; }
    if (typeof indexedDB === 'undefined') { cb && cb(null); return; }
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = function (e) {
      console.error('[PN] DB open error', e);
      cb && cb(null);
    };
    req.onsuccess = function (e) {
      _db = e.target.result;
      _ready = true;
      console.log('[PN] DB ready');
      // 釋放排隊的回呼
      _pending.forEach(function (f) { f(_db); });
      _pending = [];
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

  // ─── 內部：排隊式 DB 取得 ────────────────────────────────────
  function withDB(cb) {
    if (_ready && _db) { cb(_db); }
    else { _pending.push(cb); }
  }

  // ─── 低層 CRUD ──────────────────────────────────────────────
  function getOS(name, mode) {
    if (!_db) return null;
    try {
      return _db.transaction(name, mode || 'readonly').objectStore(name);
    } catch (e) { return null; }
  }

  function _put(storeName, data, cb) {
    var s = getOS(storeName, 'readwrite');
    if (!s) { cb && cb(false); return; }
    var r = data.id !== undefined ? s.put(data) : s.add(data);
    r.onsuccess = function () { cb && cb(true); };
    r.onerror = function () { cb && cb(false); };
  }

  function _delete(storeName, key, cb) {
    var s = getOS(storeName, 'readwrite');
    if (!s) { cb && cb(false); return; }
    s.delete(key);
    cb && cb(true);
  }

  function _get(storeName, key, cb) {
    var s = getOS(storeName);
    if (!s) { cb && cb(null); return; }
    var r = s.get(key);
    r.onsuccess = function (e) { cb && cb(e.target.result || null); };
    r.onerror = function () { cb && cb(null); };
  }

  function _getAll(storeName, cb) {
    var s = getOS(storeName);
    if (!s) { cb && cb([]); return; }
    var r = s.getAll();
    r.onsuccess = function (e) { cb && cb(e.target.result || []); };
    r.onerror = function () { cb && cb([]); };
  }

  function _getAllByIndex(storeName, index, value, cb) {
    var s = getOS(storeName);
    if (!s) { cb && cb([]); return; }
    try {
      var r = s.index(index).getAll(value);
      r.onsuccess = function (e) { cb && cb(e.target.result || []); };
      r.onerror = function () { cb && cb([]); };
    } catch (e) { cb && cb([]); }
  }

  // ─── Note API ───────────────────────────────────────────────
  function createNote(data, cb) {
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
    _put('notes', note, function (ok) { cb && cb(ok ? note : null); });
  }

  function updateNote(id, updates, cb) {
    _get('notes', id, function (note) {
      if (!note) { cb && cb(null); return; }
      Object.keys(updates).forEach(function (k) { note[k] = updates[k]; });
      note.updatedAt = Date.now();
      _put('notes', note, function (ok) { cb && cb(ok ? note : null); });
    });
  }

  function deleteNote(id, cb) {
    _delete('notes', id, cb);
  }

  function getNotesByUrl(url, cb) {
    _getAllByIndex('notes', 'pageUrl', url, cb);
  }

  function getAllNotes(cb) { _getAll('notes', cb); }

  function getAllNotesSorted(cb) {
    _getAll('notes', function (notes) {
      notes.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      cb && cb(notes);
    });
  }

  // ─── Highlight API ─────────────────────────────────────────
  function createHighlight(data, cb) {
    var hl = {
      id: 'hl_' + Date.now() + '_' + Math.floor(Math.random() * 99999),
      pageUrl: data.pageUrl || '',
      selector: data.selector || '',
      text: data.text || '',
      color: data.color || 'yellow',
      noteId: data.noteId || null,
      createdAt: Date.now()
    };
    _put('highlights', hl, function (ok) { cb && cb(ok ? hl : null); });
  }

  function deleteHighlight(id, cb) { _delete('highlights', id, cb); }

  function getHighlightsByUrl(url, cb) {
    _getAllByIndex('highlights', 'pageUrl', url, cb);
  }

  function getAllHighlights(cb) { _getAll('highlights', cb); }

  // ─── Settings API ───────────────────────────────────────────
  function saveSetting(k, v, cb) {
    _put('settings', { key: k, value: v }, cb);
  }

  function getSetting(k, dv, cb) {
    _get('settings', k, function (r) { cb && cb(r ? r.value : dv); });
  }

  function getAllSettings(cb) {
    _getAll('settings', function (recs) {
      var s = {};
      if (recs && recs.length) recs.forEach(function (r) { s[r.key] = r.value; });
      cb && cb(s);
    });
  }

  // ─── Data Management ────────────────────────────────────────
  function exportAllData(cb) {
    _getAll('notes', function (notes) {
      _getAll('highlights', function (hls) {
        cb && cb({ notes: notes, highlights: hls, exportedAt: new Date().toISOString() });
      });
    });
  }

  function clearAllData(cb) {
    var stores = ['notes', 'highlights', 'settings'];
    var p = stores.length, d = 0;
    stores.forEach(function (n) {
      var s = getOS(n, 'readwrite');
      if (s) { s.clear(); }
      d++;
      if (d === p) cb && cb(true);
    });
  }

  function getStats(cb) {
    _getAll('notes', function (notes) {
      _getAll('highlights', function (hls) {
        var pages = {};
        notes.forEach(function (n) {
          var m = n.pageUrl && n.pageUrl.match(/https?:\/\/([^\/]+)/);
          if (m) pages[m[1]] = (pages[m[1]] || 0) + 1;
        });
        var sorted = Object.entries(pages).sort(function (a, b) { return b[1] - a[1]; });
        cb && cb({
          totalNotes: notes.length,
          totalHighlights: hls.length,
          totalPages: Object.keys(pages).length,
          topPages: sorted.slice(0, 5)
        });
      });
    });
  }

  // ─── Export ────────────────────────────────────────────────
  root.PNDB = {
    init: initDB,
    isReady: function () { return _ready; },
    note: {
      create: createNote,
      update: updateNote,
      delete: deleteNote,
      getByUrl: getNotesByUrl,
      getAll: getAllNotes,
      getAllSorted: getAllNotesSorted
    },
    highlight: {
      create: createHighlight,
      delete: deleteHighlight,
      getByUrl: getHighlightsByUrl,
      getAll: getAllHighlights
    },
    settings: {
      save: saveSetting,
      get: getSetting,
      getAll: getAllSettings
    },
    data: {
      export: exportAllData,
      clear: clearAllData,
      stats: getStats
    }
  };

})(typeof globalThis !== 'undefined' ? globalThis : window);
