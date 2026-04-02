// background.js — PageNotes Service Worker
// ============================================================

var DB_NAME = "PageNotesDB";
var DB_VERSION = 1;
var db = null;
var dbReady = false; // NEW: blocks all DB operations until truly ready

// ─── DB Init ────────────────────────────────────────────────
function initDB(cb) {
    if (typeof indexedDB === "undefined") { cb && cb(null); return; }
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = function(e) { console.error("[PN] DB open error", e); cb && cb(null); };
    req.onsuccess = function(e) {
        db = e.target.result;
        dbReady = true;
        console.log("[PN] DB open success — all operations now active");
        cb && cb(db);
    };
    req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains("notes")) {
            var ns = d.createObjectStore("notes", { keyPath: "id" });
            ns.createIndex("pageUrl", "pageUrl", { unique: false });
            ns.createIndex("updatedAt", "updatedAt", { unique: false });
        }
        if (!d.objectStoreNames.contains("highlights")) {
            var hs = d.createObjectStore("highlights", { keyPath: "id" });
            hs.createIndex("pageUrl", "pageUrl", { unique: false });
        }
        if (!d.objectStoreNames.contains("settings")) {
            d.createObjectStore("settings", { keyPath: "key" });
        }
    };
}

// ─── DB Helpers ─────────────────────────────────────────────
function getOS(n, m) {
    if (!db) return null;
    try { return db.transaction(n, m || "readonly").objectStore(n); }
    catch(e) { return null; }
}

function upsert(n, d, cb) {
    var s = getOS(n, "readwrite");
    if (!s) { cb && cb(false); return; }
    var r = d.id !== undefined ? s.put(d) : s.add(d);
    r.onsuccess = function() { cb && cb(true); };
    r.onerror = function() { cb && cb(false); };
}

function remove(n, k, cb) {
    var s = getOS(n, "readwrite");
    if (!s) { cb && cb(false); return; }
    s.delete(k);
    cb && cb(true);
}

function getAllFromStore(n, cb) {
    var s = getOS(n);
    if (!s) { cb && cb([]); return; }
    var r = s.getAll();
    r.onsuccess = function(e) { cb && cb(e.target.result || []); };
    r.onerror = function() { cb && cb([]); };
}

function getByKey(n, k, cb) {
    var s = getOS(n);
    if (!s) { cb && cb(null); return; }
    var r = s.get(k);
    r.onsuccess = function(e) { cb && cb(e.target.result || null); };
    r.onerror = function() { cb && cb(null); };
}

function getByIndex(n, idx, v, cb) {
    var s = getOS(n);
    if (!s) { cb && cb([]); return; }
    var r = s.index(idx).getAll(v);
    r.onsuccess = function(e) { cb && cb(e.target.result || []); };
    r.onerror = function() { cb && cb([]); };
}

// ─── Note API ───────────────────────────────────────────────
function createNote(data, cb) {
    var note = {
        id: "note_" + Date.now() + "_" + Math.floor(Math.random() * 99999),
        pageUrl: data.pageUrl || "",
        pageTitle: data.pageTitle || "",
        content: data.content || "",
        x: data.x !== undefined ? data.x : 100,
        y: data.y !== undefined ? data.y : 100,
        width: data.width || 280,
        color: data.color || "white",
        zIndex: data.zIndex || 2147483640,
        isPinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    upsert("notes", note, function(ok) {
        cb && cb(ok ? note : null);
    });
}

function updateNote(id, updates, cb) {
    getByKey("notes", id, function(note) {
        if (!note) { cb && cb(null); return; }
        var ks = Object.keys(updates);
        for (var i = 0; i < ks.length; i++) note[ks[i]] = updates[ks[i]];
        note.updatedAt = Date.now();
        upsert("notes", note, function(ok) { cb && cb(ok ? note : null); });
    });
}

function deleteNote(id, cb) { remove("notes", id, cb); }
function getNotesByUrl(url, cb) { getByIndex("notes", "pageUrl", url, cb); }
function getAllNotesSorted(cb) {
    getAllFromStore("notes", function(notes) {
        notes.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
        cb && cb(notes);
    });
}
function getAllNotes(cb) { getAllFromStore("notes", cb); }

// ─── Highlight API ──────────────────────────────────────────
function createHighlight(data, cb) {
    var hl = {
        id: "hl_" + Date.now() + "_" + Math.floor(Math.random() * 99999),
        pageUrl: data.pageUrl || "",
        selector: data.selector || "",
        text: data.text || "",
        color: data.color || "yellow",
        noteId: data.noteId || null,
        createdAt: Date.now()
    };
    upsert("highlights", hl, function(ok) { cb && cb(ok ? hl : null); });
}

function deleteHighlight(id, cb) { remove("highlights", id, cb); }
function getHighlightsByUrl(url, cb) { getByIndex("highlights", "pageUrl", url, cb); }
function getAllHighlights(cb) { getAllFromStore("highlights", cb); }

// ─── Settings API ───────────────────────────────────────────
function saveSetting(k, v, cb) { upsert("settings", { key: k, value: v }, cb); }
function getSetting(k, dv, cb) { getByKey("settings", k, function(r) { cb && cb(r ? r.value : dv); }); }
function getAllSettings(cb) {
    getAllFromStore("settings", function(recs) {
        var s = {};
        if (recs && recs.length) { for (var i = 0; i < recs.length; i++) s[recs[i].key] = recs[i].value; }
        cb && cb(s);
    });
}

// ─── Data Management ───────────────────────────────────────
function exportAllData(cb) {
    getAllFromStore("notes", function(notes) {
        getAllFromStore("highlights", function(hls) {
            cb && cb({ notes: notes, highlights: hls, exportedAt: new Date().toISOString() });
        });
    });
}

function clearAllData(cb) {
    var stores = ["notes", "highlights", "settings"];
    var count = stores.length;
    var done = 0;
    stores.forEach(function(n) {
        var s = getOS(n, "readwrite");
        if (s) { s.clear(); }
        done++;
        if (done === count) cb && cb(true);
    });
}

// ─── Service Worker Lifecycle ────────────────────────────────
chrome.runtime.onInstalled.addListener(function() {
    console.log("[PageNotes] Installed v1.03");
    initDB(function(ok) {
        if (ok) console.log("[PageNotes] DB ready");
        else console.error("[PageNotes] DB FAILED to open");
    });
});

chrome.runtime.onStartup.addListener(function() {
    console.log("[PageNotes] Startup");
    initDB(function(ok) {
        if (ok) console.log("[PageNotes] DB ready");
    });
});

// ─── Also init immediately on script load ──────────────────
// (Service worker may handle messages before onInstalled fires)
initDB(function(ok) {
    if (ok) console.log("[PageNotes] DB initialized on load");
});

// ─── Message Debug Log ─────────────────────────────────────
var _msgCount = 0;

// ─── Message Handler ───────────────────────────────────────
chrome.runtime.onMessage.addListener(function(req, sender, res) {
    var t = req.type || "";

    // ── Notes ──────────────────────────────────────────────
    if (t === "CREATE_NOTE") {
        createNote(req.data || {}, function(note) { res(note); });
        return true; // async — keep channel open
    }
    if (t === "UPDATE_NOTE") {
        updateNote(req.id, req.updates || {}, function(note) { res(note); });
        return true;
    }
    if (t === "DELETE_NOTE") {
        deleteNote(req.id, function(ok) { res({ success: ok }); });
        return true;
    }
    if (t === "GET_NOTES_BY_URL") {
        getNotesByUrl(req.url || "", function(notes) { res(notes || []); });
        return true;
    }
    if (t === "GET_ALL_NOTES") {
        getAllNotes(function(notes) { res(notes || []); });
        return true;
    }
    if (t === "GET_ALL_NOTES_SORTED") {
        getAllNotesSorted(function(notes) { res(notes || []); });
        return true;
    }

    // ── Highlights ─────────────────────────────────────────
    if (t === "CREATE_HIGHLIGHT") {
        createHighlight(req.data || {}, function(hl) { res(hl); });
        return true;
    }
    if (t === "DELETE_HIGHLIGHT") {
        deleteHighlight(req.id, function(ok) { res({ success: ok }); });
        return true;
    }
    if (t === "GET_HIGHLIGHTS_BY_URL") {
        getHighlightsByUrl(req.url || "", function(hls) { res(hls || []); });
        return true;
    }
    if (t === "GET_ALL_HIGHLIGHTS") {
        getAllHighlights(function(hls) { res(hls || []); });
        return true;
    }

    // ── Settings ───────────────────────────────────────────
    if (t === "SAVE_SETTING") {
        saveSetting(req.key, req.value, function(ok) { res({ success: ok }); });
        return true;
    }
    if (t === "GET_SETTING") {
        getSetting(req.key, req.defaultValue, function(val) { res(val); });
        return true;
    }
    if (t === "GET_ALL_SETTINGS") {
        getAllSettings(function(sets) { res(sets || {}); });
        return true;
    }

    // ── Data Management ────────────────────────────────────
    if (t === "EXPORT_DATA") {
        exportAllData(function(data) { res(data); });
        return true;
    }
    if (t === "CLEAR_ALL_DATA") {
        clearAllData(function(ok) { res({ success: ok }); });
        return true;
    }

    // ── Stats ──────────────────────────────────────────────
    if (t === "GET_STATS") {
        getAllFromStore("notes", function(notes) {
            getAllFromStore("highlights", function(hls) {
                var pages = {};
                for (var i = 0; i < notes.length; i++) {
                    var m = notes[i].pageUrl && notes[i].pageUrl.match(/https?:\/\/([^\/]+)/);
                    if (m) pages[m[1]] = (pages[m[1]] || 0) + 1;
                }
                var sorted = [];
                var keys = Object.keys(pages);
                for (var j = 0; j < keys.length; j++) sorted.push([keys[j], pages[keys[j]]]);
                sorted.sort(function(a, b) { return b[1] - a[1]; });
                res({
                    totalNotes: notes.length,
                    totalHighlights: hls.length,
                    totalPages: keys.length,
                    topPages: sorted.slice(0, 5)
                });
            });
        });
        return true;
    }

    res({ error: "unknown type: " + t });
    return true;
});

// ─── Context Menu ──────────────────────────────────────────
try {
    chrome.contextMenus.removeAll(function() {
        chrome.contextMenus.create({
            id: "pn-addNote",
            title: "📝 在此新增筆記",
            contexts: ["page"]
        });
    });
    chrome.contextMenus.onClicked.addListener(function(info, tab) {
        if (info.menuItemId === "pn-addNote") {
            chrome.tabs.sendMessage(tab.id, { type: "CREATE_NOTE_AT_CENTER" });
        }
    });
} catch(e) {
    console.error("[PN] Context menu error:", e);
}

console.log("[PageNotes] Service Worker loaded");
