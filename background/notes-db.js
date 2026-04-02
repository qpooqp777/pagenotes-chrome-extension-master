// notes-db.js — PageNotes IndexedDB CRUD
// ============================================================

var DB_NAME = "PageNotesDB";
var DB_VERSION = 1;
var db = null;

// ─── Init ────────────────────────────────────────────────────

function initDB(callback) {
    if (typeof indexedDB === "undefined") { callback && callback(null); return; }
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = function(e) { console.error("[PageNotes] DB error:", e); callback && callback(null); };
    req.onsuccess = function(e) {
        db = e.target.result;
        console.log("[PageNotes] DB ready");
        callback && callback(db);
    };
    req.onupgradeneeded = function(e) {
        var d = e.target.result;

        // notes store
        if (!d.objectStoreNames.contains("notes")) {
            var ns = d.createObjectStore("notes", { keyPath: "id" });
            ns.createIndex("pageUrl", "pageUrl", { unique: false });
            ns.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        // highlights store
        if (!d.objectStoreNames.contains("highlights")) {
            var hs = d.createObjectStore("highlights", { keyPath: "id" });
            hs.createIndex("pageUrl", "pageUrl", { unique: false });
        }

        // settings store
        if (!d.objectStoreNames.contains("settings")) {
            d.createObjectStore("settings", { keyPath: "key" });
        }
    };
}

function getOS(name, mode) {
    if (!db) return null;
    return db.transaction(name, mode || "readonly").objectStore(name);
}

function upsert(storeName, data, callback) {
    var s = getOS(storeName, "readwrite");
    if (!s) { callback && callback(false); return; }
    var r = s.put(data);
    r.onsuccess = function() { callback && callback(true); };
    r.onerror = function() { callback && callback(false); };
}

function remove(storeName, key, callback) {
    var s = getOS(storeName, "readwrite");
    if (!s) { callback && callback(false); return; }
    var r = s.delete(key);
    r.onsuccess = function() { callback && callback(true); };
    r.onerror = function() { callback && callback(false); };
}

function getByKey(storeName, key, callback) {
    var s = getOS(storeName);
    if (!s) { callback && callback(null); return; }
    var r = s.get(key);
    r.onsuccess = function(e) { callback && callback(e.target.result || null); };
    r.onerror = function() { callback && callback(null); };
}

function getAll(storeName, callback) {
    var s = getOS(storeName);
    if (!s) { callback && callback([]); return; }
    var r = s.getAll();
    r.onsuccess = function(e) { callback && callback(e.target.result || []); };
    r.onerror = function() { callback && callback([]); };
}

function getByIndex(storeName, index, value, callback) {
    var s = getOS(storeName);
    if (!s) { callback && callback([]); return; }
    var idx = s.index(index);
    var r = idx.getAll(value);
    r.onsuccess = function(e) { callback && callback(e.target.result || []); };
    r.onerror = function() { callback && callback([]); };
}

function getAllFromStore(storeName, callback) {
    var s = getOS(storeName);
    if (!s) { callback && callback([]); return; }
    var r = s.getAll();
    r.onsuccess = function(e) { callback && callback(e.target.result || []); };
    r.onerror = function() { callback && callback([]); };
}

// ─── Note CRUD ───────────────────────────────────────────────

function createNote(data, callback) {
    var note = {
        id: "note_" + Date.now(),
        pageUrl: data.pageUrl || "",
        pageTitle: data.pageTitle || "",
        content: data.content || "",
        x: data.x !== undefined ? data.x : 100,
        y: data.y !== undefined ? data.y : 100,
        width: data.width || 280,
        color: data.color || "white",
        zIndex: data.zIndex || 100,
        isPinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    upsert("notes", note, function(ok) {
        callback && callback(ok ? note : null);
    });
}

function updateNote(id, updates, callback) {
    getByKey("notes", id, function(note) {
        if (!note) { callback && callback(null); return; }
        var keys = Object.keys(updates);
        for (var i = 0; i < keys.length; i++) {
            note[keys[i]] = updates[keys[i]];
        }
        note.updatedAt = Date.now();
        upsert("notes", note, function(ok) {
            callback && callback(ok ? note : null);
        });
    });
}

function deleteNote(id, callback) {
    remove("notes", id, callback);
}

function getNotesByUrl(pageUrl, callback) {
    getByIndex("notes", "pageUrl", pageUrl, callback);
}

function getAllNotes(callback) {
    getAllFromStore("notes", callback);
}

function getAllNotesSorted(callback) {
    getAllFromStore("notes", function(notes) {
        notes.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
        callback && callback(notes);
    });
}

// ─── Highlight CRUD ─────────────────────────────────────────

function createHighlight(data, callback) {
    var hl = {
        id: "hl_" + Date.now(),
        pageUrl: data.pageUrl || "",
        selector: data.selector || "",
        startOffset: data.startOffset || 0,
        endOffset: data.endOffset || 0,
        text: data.text || "",
        color: data.color || "yellow",
        noteId: data.noteId || null,
        createdAt: Date.now()
    };
    upsert("highlights", hl, function(ok) {
        callback && callback(ok ? hl : null);
    });
}

function deleteHighlight(id, callback) {
    remove("highlights", id, callback);
}

function getHighlightsByUrl(pageUrl, callback) {
    getByIndex("highlights", "pageUrl", pageUrl, callback);
}

function getAllHighlights(callback) {
    getAllFromStore("highlights", callback);
}

// ─── Settings ────────────────────────────────────────────────

function saveSetting(key, value, callback) {
    upsert("settings", { key: key, value: value }, callback);
}

function getSetting(key, defaultVal, callback) {
    getByKey("settings", key, function(rec) {
        callback && callback(rec ? rec.value : defaultVal);
    });
}

function getAllSettings(callback) {
    getAllFromStore("settings", function(recs) {
        var s = {};
        if (recs && recs.length) recs.forEach(function(r) { s[r.key] = r.value; });
        callback && callback(s);
    });
}

// ─── Export / Import ────────────────────────────────────────

function exportAllData(callback) {
    getAllFromStore("notes", function(notes) {
        getAllFromStore("highlights", function(highlights) {
            callback && callback({ notes: notes, highlights: highlights, exportedAt: new Date().toISOString() });
        });
    });
}

function importData(data, callback) {
    var pending = 0, done = 0, errors = 0;
    if (!data) { callback && callback(false); return; }

    if (data.notes && data.notes.length) {
        pending++;
        data.notes.forEach(function(n) { upsert("notes", n, function(ok) { if (!ok) errors++; done++; if (done === pending) callback && callback(errors === 0); }); });
    }
    if (data.highlights && data.highlights.length) {
        pending++;
        data.highlights.forEach(function(h) { upsert("highlights", h, function(ok) { if (!ok) errors++; done++; if (done === pending) callback && callback(errors === 0); }); });
    }
    if (pending === 0) callback && callback(true);
}

function clearAllData(callback) {
    var stores = ["notes", "highlights", "settings"];
    var p = stores.length, d = 0;
    stores.forEach(function(n) {
        var s = getOS(n, "readwrite");
        if (s) { var r = s.clear(); r.onsuccess = function() { d++; if (d === p) callback && callback(true); }; }
        else { d++; if (d === p) callback && callback(true); }
    });
}

// ─── Stats ─────────────────────────────────────────────────

function getStats(callback) {
    getAllFromStore("notes", function(notes) {
        getAllFromStore("highlights", function(hls) {
            var pages = {};
            notes.forEach(function(n) {
                if (n.pageUrl) {
                    var host = n.pageUrl.match(/https?:\/\/([^\/]+)/);
                    if (host) pages[host[1]] = (pages[host[1]] || 0) + 1;
                }
            });
            callback && callback({
                totalNotes: notes.length,
                totalHighlights: hls.length,
                totalPages: Object.keys(pages).length,
                topPages: Object.entries(pages).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5)
            });
        });
    });
}
