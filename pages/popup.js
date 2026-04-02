// popup.js — PageNotes Popup v1.03
(function() {
    "use strict";
    var $ = function(id) { return document.getElementById(id); };
    var _allNotes = [];
    var _allHighlights = [];
    var _searchQuery = "";
    var _currentView = "home";

    document.addEventListener("DOMContentLoaded", function() {
        loadAllNotes();
        loadHighlights();
        loadStats();
        bindEvents();
    });

    // ─── Messaging ───────────────────────────────────────
    function sendMsg(msg, cb) {
        chrome.runtime.sendMessage(msg, function(res) { if (cb) cb(res); });
    }

    // ─── Load ─────────────────────────────────────────────
    function loadAllNotes() {
        sendMsg({ type: "GET_ALL_NOTES_SORTED" }, function(notes) {
            _allNotes = notes || [];
            if (_currentView === "home") renderList(_allNotes);
        });
    }

    function loadHighlights() {
        sendMsg({ type: "GET_ALL_HIGHLIGHTS" }, function(hls) {
            _allHighlights = hls || [];
        });
    }

    function loadStats() {
        sendMsg({ type: "GET_STATS" }, function(stats) {
            if (!stats) return;
            if ($("stat-notes")) $("stat-notes").textContent = stats.totalNotes || 0;
            if ($("stat-hls")) $("stat-hls").textContent = stats.totalHighlights || 0;
            if ($("stat-pages")) $("stat-pages").textContent = stats.totalPages || 0;
        });
    }

    // ─── Render: Notes ──────────────────────────────────
    function renderList(notes) {
        notes = notes || [];
        var el = $("note-list");
        if (!el) return;
        var q = (_searchQuery || "").toLowerCase().trim();
        var filtered = q ? notes.filter(function(n) {
            return (n.content && n.content.toLowerCase().indexOf(q) >= 0) ||
                   (n.pageTitle && n.pageTitle.toLowerCase().indexOf(q) >= 0) ||
                   (n.pageUrl && n.pageUrl.toLowerCase().indexOf(q) >= 0);
        }) : notes;

        if (filtered.length === 0) {
            el.innerHTML = '<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg><span>' + (q ? t("noMatch") : t("noNotes")) + '</span><small>' + (q ? t("tryAgain") : t("noNotesHint")) + '</small></div>';
            return;
        }

        var pages = {};
        filtered.forEach(function(n) {
            var host = getHost(n.pageUrl);
            if (!pages[host]) pages[host] = [];
            pages[host].push(n);
        });

        Object.keys(pages).forEach(function(host) {
            pages[host].sort(function(a, b) {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return (b.updatedAt || 0) - (a.updatedAt || 0);
            });
        });

        var html = "";
        var hostKeys = Object.keys(pages).sort();
        hostKeys.forEach(function(host) {
            html += '<div class="page-group"><div class="page-group-header"><span class="page-host">' + escHtml(host) + '</span><span class="page-count">' + pages[host].length + '</span></div>';
            pages[host].forEach(function(note) {
                var preview = escHtml((note.content || "").slice(0, 80)) || '<em style="color:#94A3B8">空白</em>';
                html += '<div class="note-item' + (note.isPinned ? " pinned-item" : "") + '">';
                html += '<div class="note-item-content" data-id="' + escAttr(note.id) + '">' + preview + '</div>';
                html += '<div class="note-item-meta">';
                html += '<span class="note-time">' + fmtTime(note.updatedAt) + '</span>';
                html += '<button class="note-pin-btn" data-id="' + escAttr(note.id) + '" title="' + t("pin") + '">' + (note.isPinned ? "P" : "p") + '</button>';
                html += '<button class="note-open-btn" data-url="' + escAttr(note.pageUrl) + '" title="' + t("open") + '">&#x2197;</button>';
                html += '<button class="note-del-btn" data-id="' + escAttr(note.id) + '" title="' + t("del") + '">&#x2715;</button>';
                html += '</div></div>';
            });
            html += '</div>';
        });

        el.innerHTML = html;

        el.querySelectorAll(".note-open-btn").forEach(function(b) {
            b.addEventListener("click", function(e) { e.stopPropagation(); openUrl(this.getAttribute("data-url")); });
        });
        el.querySelectorAll(".note-del-btn").forEach(function(b) {
            b.addEventListener("click", function(e) { e.stopPropagation(); delNote(this.getAttribute("data-id")); });
        });
        el.querySelectorAll(".note-pin-btn").forEach(function(b) {
            b.addEventListener("click", function(e) { e.stopPropagation(); togglePin(this.getAttribute("data-id")); });
        });
        el.querySelectorAll(".note-item-content").forEach(function(el2) {
            el2.addEventListener("dblclick", function(e) {
                e.stopPropagation();
                var id = el2.getAttribute("data-id");
                var note = findById(id);
                if (!note) return;
                el2.innerHTML = '<textarea class="inline-editor" data-id="' + escAttr(id) + '">' + escHtml(note.content || "") + '</textarea>';
                var ta = el2.querySelector("textarea");
                ta.focus(); ta.select();
                ta.addEventListener("blur", function() { saveEdit(id, ta.value, el2, note); });
                ta.addEventListener("keydown", function(ev) {
                    if (ev.key === "Escape") ta.blur();
                    if (ev.key === "Enter" && ev.ctrlKey) ta.blur();
                });
            });
        });
    }

    // ─── Helpers ─────────────────────────────────────────
    function escHtml(s) { if (!s) return ""; return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
    function escAttr(s) { if (!s) return ""; return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;"); }
    function getHost(u) { if (!u) return "Unknown"; var m = u.match(/https?:\/\/([^\/]+)/); return m ? m[1] : u; }
    function findById(id) { for (var i = 0; i < _allNotes.length; i++) if (_allNotes[i].id === id) return _allNotes[i]; return null; }

    function fmtTime(ts) {
        if (!ts) return "";
        var d = new Date(ts), diff = new Date() - d;
        if (diff < 60000) return _lang === "en" ? "Just now" : "剛剛";
        if (diff < 3600000) return Math.floor(diff / 60000) + (_lang === "en" ? "m" : "分");
        if (diff < 86400000) return Math.floor(diff / 3600000) + (_lang === "en" ? "h" : "小時");
        if (diff < 604800000) return Math.floor(diff / 86400000) + (_lang === "en" ? "d" : "天");
        return d.toLocaleDateString(_lang === "en" ? "en-US" : "zh-TW");
    }

    function delNote(id) {
        if (!confirm(t("confirmDel"))) return;
        sendMsg({ type: "DELETE_NOTE", id: id }, function() { loadAllNotes(); loadStats(); });
    }

    function togglePin(id) {
        var note = findById(id);
        if (!note) return;
        var v = !note.isPinned;
        sendMsg({ type: "UPDATE_NOTE", id: id, updates: { isPinned: v } }, function() {
            note.isPinned = v;
            loadAllNotes();
        });
    }

    function saveEdit(id, val, el2, note) {
        note.content = val;
        note.updatedAt = Date.now();
        el2.innerHTML = val ? escHtml(val.slice(0, 80)) : '<em style="color:#94A3B8">空白</em>';
        sendMsg({ type: "UPDATE_NOTE", id: id, updates: { content: val, updatedAt: note.updatedAt } }, function() {});
    }

    function openUrl(url) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            var cur = tabs && tabs[0];
            if (cur && cur.url !== url) chrome.tabs.create({ url: url, active: true });
            else if (cur) chrome.tabs.reload(cur.id, { bypassCache: true });
        });
    }

    function showToast(msg) {
        var old = document.querySelector(".popup-toast");
        if (old) old.remove();
        var el = document.createElement("div");
        el.className = "popup-toast";
        el.textContent = msg;
        el.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1E293B;color:white;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:500;z-index:99999;opacity:0;transition:opacity .2s;pointer-events:none;";
        document.body.appendChild(el);
        requestAnimationFrame(function() { el.style.opacity = "1"; });
        setTimeout(function() { el.style.opacity = "0"; setTimeout(function() { el.remove(); }, 200); }, 2500);
    }

    // ─── View Switching ──────────────────────────────────
    function switchView(view) {
        _currentView = view;
        var home = $("view-home");
        var settings = $("view-settings");
        if (home) home.classList.toggle("active", view === "home");
        if (settings) settings.classList.toggle("active", view === "settings");

        // Show/hide search bar + stats for home view
        var searchBar = $("search-bar");
        var statsBar = $("stats-bar");
        if (view === "home") {
            if (searchBar) searchBar.style.display = "";
            if (statsBar) statsBar.style.display = "";
            var si = $("search-input");
            if (si) si.value = "";
            _searchQuery = "";
            renderList(_allNotes);
        } else {
            if (searchBar) searchBar.style.display = "none";
            if (statsBar) statsBar.style.display = "none";
        }

        if (view === "settings") {
            updateSettingsText();
        }
    }

    // ─── Events ─────────────────────────────────────────
    function bindEvents() {
        // Header buttons
        var settingsBtn = $("btn-settings");
        var aboutBtn = $("btn-about");
        var exportBtn = $("btn-export");
        var backBtn = $("btn-back");

        if (settingsBtn) settingsBtn.addEventListener("click", function() { switchView("settings"); });
        if (aboutBtn) aboutBtn.addEventListener("click", function() { showAbout(); });
        if (backBtn) backBtn.addEventListener("click", function() { switchView("home"); });
        if (exportBtn) exportBtn.addEventListener("click", function() {
            sendMsg({ type: "EXPORT_DATA" }, function(data) {
                if (!data) return;
                var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                a.download = "pagenotes.json"; a.click();
                URL.revokeObjectURL(a.href);
                showToast(t("exported"));
            });
        });

        // Search
        var si = $("search-input");
        if (si) si.addEventListener("input", function() {
            _searchQuery = this.value;
            renderList(_allNotes);
        });

        // Settings: color picker
        var cp = $("default-color");
        if (cp) cp.querySelectorAll(".color-opt").forEach(function(btn) {
            btn.addEventListener("click", function() {
                cp.querySelectorAll(".color-opt").forEach(function(b) { b.classList.remove("active"); });
                btn.classList.add("active");
                var color = btn.getAttribute("data-color");
                sendMsg({ type: "SAVE_SETTING", key: "defaultHighlightColor", value: color }, function() {});
            });
        });

        // Settings: clear all
        var clearBtn = $("btn-clear-all");
        if (clearBtn) clearBtn.addEventListener("click", function() {
            if (!confirm(t("confirmClearAll"))) return;
            sendMsg({ type: "CLEAR_ALL_DATA" }, function() { loadAllNotes(); loadHighlights(); loadStats(); showToast(t("cleared")); });
        });

        // Settings: Pro banner
        var buyBtn = $("btn-buy-pro");
        if (buyBtn) buyBtn.addEventListener("click", function() {
            var url = "https://chrome.google.com/webstore";
            chrome.tabs && chrome.tabs.create ? chrome.tabs.create({ url: url }) : window.open(url);
        });
    }

    // ─── About Page ──────────────────────────────────────
    function showAbout() {
        _currentView = "about";
        var home = $("view-home");
        var settings = $("view-settings");
        if (home) home.classList.remove("active");
        if (settings) settings.classList.remove("active");
        var searchBar = $("search-bar");
        var statsBar = $("stats-bar");
        if (searchBar) searchBar.style.display = "none";
        if (statsBar) statsBar.style.display = "none";

        var el = $("note-list");
        if (!el) return;
        var isEn = _lang === "en";
        el.innerHTML = [
            '<div class="about-view-header">',
            '<button class="about-back-btn" id="about-home-back">&larr; <span class="about-back-home">' + (isEn ? "Home" : "首頁") + '</span></button>',
            '<span class="about-view-title">PageNotes v1.03</span>',
            '</div>',
            '<div class="about-menu">',
            '<button class="about-menu-item" id="am-privacy">',
            '<span class="about-menu-icon">&#x1F512;</span>',
            '<span class="about-menu-text">' + (isEn ? "Privacy Policy" : "隱私權政策") + '</span>',
            '<svg class="about-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
            '</button>',
            '<button class="about-menu-item" id="am-features">',
            '<span class="about-menu-icon">&#x2139;</span>',
            '<span class="about-menu-text">' + (isEn ? "About / Features" : "關於 / 功能項目") + '</span>',
            '<svg class="about-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
            '</button>',
            '</div>'
        ].join("");

        el.querySelector("#am-privacy").addEventListener("click", showPrivacy);
        el.querySelector("#am-features").addEventListener("click", showFeatures);
        el.querySelector("#about-home-back").addEventListener("click", function() { switchView("home"); });
    }

    function showPrivacy() {
        var isEn = _lang === "en";
        $("note-list").innerHTML = [
            '<div class="about-view-header">',
            '<button class="about-back-btn" id="about-back-btn">&larr; <span id="about-back-label">' + (isEn ? "Back" : "返回") + '</span></button>',
            '<span class="about-view-title">' + (isEn ? "Privacy Policy" : "隱私權政策") + '</span>',
            '</div>',
            '<div class="about-content">',
            '<p class="about-lead">' + (isEn
                ? "All notes and highlights are stored locally in your browser. No data is sent to any external server."
                : "所有筆記和標記都儲存在瀏覽器本機的 IndexedDB 中，不會上傳至任何外部伺服器。") + '</p>',
            '<div class="policy-item">&#x2705; ' + (isEn ? "Data stays on your device only" : "資料完全保存在本機") + '</div>',
            '<div class="policy-item">&#x2705; ' + (isEn ? "No analytics or tracking scripts" : "無分析工具、無追蹤腳本") + '</div>',
            '<div class="policy-item">&#x2705; ' + (isEn ? "Pro cloud sync uses your own Firebase account" : "Pro 雲端同步使用您自己的 Firebase 帳戶") + '</div>',
            '<div class="policy-item">&#x2705; ' + (isEn ? "Uninstalling removes all data automatically" : "解除安裝時自動刪除所有資料") + '</div>',
            '</div>'
        ].join("");
        $("about-back-btn").addEventListener("click", showAbout);
    }

    function showFeatures() {
        var isEn = _lang === "en";
        var feats = [
            ["&#x1F4CC;", isEn ? "Add floating notes on any page" : "在任意網頁新增浮動筆記"],
            ["&#x1F58F;", isEn ? "3-color text highlighting" : "3 種顏色文字標記"],
            ["&#x1F512;", isEn ? "All data stored locally (IndexedDB)" : "資料完全儲存在本機（IndexedDB）"],
            ["&#x1F510;", isEn ? "Firebase cloud sync (Pro)" : "Firebase 雲端同步（Pro 版）"],
            ["&#x1F4C1;", isEn ? "Markdown support" : "支援 Markdown 格式"],
            ["&#x1F5A5;", isEn ? "Export all data as JSON" : "匯出所有資料為 JSON"],
            ["&#x1F310;", isEn ? "Multilingual: TW / CN / EN" : "多語言：繁體 / 簡體 / English"],
            ["&#x1F4BE;", isEn ? "Minimize notes to tray menu" : "筆記可縮小到工具列選單"],
            ["&#x1F5FD;", isEn ? "Always on top (pin notes)" : "置頂釘選功能"],
            ["&#x1F4F1;", isEn ? "Highlight restore on page reload" : "刷新網頁自動還原標記"],
            ["&#x1F517;", isEn ? "Keyboard shortcut: Ctrl+Shift+N" : "快捷鍵 Ctrl+Shift+N 新增筆記"]
        ];

        var html = [
            '<div class="about-view-header">',
            '<button class="about-back-btn" id="about-features-back">&larr; <span id="about-back-label">' + (isEn ? "Back" : "返回") + '</span></button>',
            '<span class="about-view-title">' + (isEn ? "About / Features" : "關於 / 功能項目") + '</span>',
            '</div>',
            '<div class="about-content">'
        ];
        feats.forEach(function(f) {
            html.push('<div class="feature-item"><span class="feature-icon">' + f[0] + '</span><span>' + f[1] + '</span></div>');
        });
        html.push('</div>');

        $("note-list").innerHTML = html.join("");
        $("about-features-back").addEventListener("click", showAbout);
    }

    function updateSettingsText() {
        var t2 = T[_lang] || T["zh-TW"];
        var backBtn = $("btn-back");
        if (backBtn) backBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg><span>' + t2.back + '</span>';
        var settingsTitle = document.querySelector(".settings-title");
        if (settingsTitle) settingsTitle.textContent = t2.settings;
        var colorsTitle = document.querySelector(".colors-title");
        if (colorsTitle) colorsTitle.textContent = t2.colors;
        var proTitle = document.querySelector(".pro-title");
        if (proTitle) proTitle.textContent = t2.pro;
        var dataTitle = document.querySelector(".data-title");
        if (dataTitle) dataTitle.textContent = t2.data;
        var colorName = document.querySelector(".highlightcolor-name");
        if (colorName) colorName.textContent = t2.highlightColor;
        var cloudBackup = document.querySelector(".cloud-backup-name");
        if (cloudBackup) cloudBackup.textContent = t2.proTitle;
        var cloudSync = document.querySelector(".cloud-sync-name");
        if (cloudSync) cloudSync.textContent = t2.proDesc;
        var exportLbl = document.querySelector(".export-lbl");
        if (exportLbl) exportLbl.textContent = t2.exportJSON;
        var clearLbl = document.querySelector(".clear-lbl");
        if (clearLbl) clearLbl.textContent = t2.clearAll;
    }

    // ─── Language ────────────────────────────────────────
    var _lang = "zh-TW";

    var T = {
        "zh-TW": {
            notes: "筆記", highlights: "標記", pages: "頁面",
            noNotes: "尚無筆記", noNotesHint: "在網頁上點擊按鈕新增筆記",
            noMatch: "找不到符合的筆記", tryAgain: "試搜其他關鍵字",
            back: "返回", settings: "設定",
            colors: "外觀", highlightColor: "預設標記顏色",
            pro: "Pro 版（雲端同步）", proTitle: "雲端備份",
            proDesc: "跨裝置即時同步筆記與標記",
            proBtn: "$0.99 USD",
            data: "資料", exportJSON: "匯出 JSON", clearAll: "清除全部",
            confirmClearAll: "確定清除所有筆記和標記？", confirmDel: "刪除此筆記？",
            exported: "已匯出 ✓", cleared: "已清除 ✓",
            pin: "置頂", open: "開啟", del: "刪除"
        },
        "zh-CN": {
            notes: "笔记", highlights: "标记", pages: "页面",
            noNotes: "尚无笔记", noNotesHint: "在网页上点击按钮新增笔记",
            noMatch: "找不到符合的笔记", tryAgain: "试试其他关键字",
            back: "返回", settings: "设定",
            colors: "外观", highlightColor: "预设标记颜色",
            pro: "Pro 版（云端同步）", proTitle: "云端备份",
            proDesc: "跨装置即时同步笔记与标记",
            proBtn: "$0.99 USD",
            data: "资料", exportJSON: "导出 JSON", clearAll: "清除全部",
            confirmClearAll: "确定清除所有笔记和标记？", confirmDel: "删除此笔记？",
            exported: "已导出 ✓", cleared: "已清除 ✓",
            pin: "置顶", open: "开启", del: "删除"
        },
        en: {
            notes: "Notes", highlights: "Highlights", pages: "Pages",
            noNotes: "No notes yet", noNotesHint: "Click the button on any webpage to add notes",
            noMatch: "No matching notes", tryAgain: "Try different keywords",
            back: "Back", settings: "Settings",
            colors: "Colors", highlightColor: "Default Highlight Color",
            pro: "Pro (Cloud Sync)", proTitle: "Cloud Backup",
            proDesc: "Sync notes and highlights across devices instantly",
            proBtn: "$0.99 USD",
            data: "Data", exportJSON: "Export JSON", clearAll: "Clear All",
            confirmClearAll: "Clear all notes and highlights?", confirmDel: "Delete this note?",
            exported: "Exported ✓", cleared: "Cleared ✓",
            pin: "Pin", open: "Open", del: "Delete"
        }
    };

    function t(key) { return (T[_lang] && T[_lang][key]) || (T["zh-TW"][key]) || key; }

    function applyLang(lang) {
        _lang = lang;
        var sel = $("lang-sel");
        if (sel) sel.value = _lang;

        // Search placeholder
        var si = $("search-input");
        if (si) si.placeholder = _lang === "en" ? "Search notes..." : _lang === "zh-CN" ? "搜索笔记..." : "搜尋筆記內容、網址...";

        // Stats labels
        var notesEl = document.querySelector(".stat-notes-lbl");
        var hlsEl = document.querySelector(".stat-hls-lbl");
        var pagesEl = document.querySelector(".stat-pages-lbl");
        if (notesEl) notesEl.textContent = _lang === "en" ? "Notes" : _lang === "zh-CN" ? "笔记" : "筆記";
        if (hlsEl) hlsEl.textContent = _lang === "en" ? "Highlights" : _lang === "zh-CN" ? "标记" : "標記";
        if (pagesEl) pagesEl.textContent = _lang === "en" ? "Pages" : _lang === "zh-CN" ? "页面" : "頁面";

        // Re-render current view
        if (_currentView === "home") renderList(_allNotes);
        else if (_currentView === "settings") updateSettingsText();
    }

    // Init language
    if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get("lang", function(r) {
            var lang = (r && r.lang) || "zh-TW";
            applyLang(lang);
        });
    } else {
        applyLang("zh-TW");
    }

    $("lang-sel") && $("lang-sel").addEventListener("change", function() {
        var lang = this.value;
        applyLang(lang);
        sendMsg({ type: "SAVE_SETTING", key: "lang", value: lang }, function() {});
        try { chrome.storage.local.set({ lang: lang }); } catch(e) {}
    });
})();
