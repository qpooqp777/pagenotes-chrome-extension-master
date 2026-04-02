// PageNotes Content Script
(function() {
    "use strict";

    // ── State ──────────────────────────────────────────────
    var toolbar = null;
    var fab = null;
    var fabMenu = null;
    var notesOnPage = {};
    var minimizedNotes = {}; // id → note (hidden cards)

    // ── Lang ───────────────────────────────────────────────
    var _lang = "zh-TW";
    try {
        chrome.storage.local.get("lang", function(r) { if (r && r.lang) _lang = r.lang; });
    } catch(e) {}
    function L(zh, en) { return _lang === "en" ? en : zh; }

    // ── Styles ─────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById("pn-css")) return;
        var s = document.createElement("style");
        s.id = "pn-css";
        s.textContent = [
            // FAB
            ".pn-fab{position:fixed;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;border:none;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:white;cursor:pointer;z-index:2147483646;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(99,102,241,.4);transition:transform .2s,box-shadow .2s;}",
            ".pn-fab:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(99,102,241,.5);}",
            ".pn-fab:active{transform:scale(.95);}",
            // Badge on FAB
            ".pn-fab-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:#EF4444;color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none;font-family:Inter,system-ui,sans-serif;}",
            // FAB Menu (minimized list)
            ".pn-fab-menu{position:fixed;bottom:86px;right:16px;z-index:2147483645;display:none;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto;padding:8px;background:rgba(255,255,255,.98);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.18);border:1px solid rgba(0,0,0,.08);backdrop-filter:blur(16px);min-width:220px;animation:pn-pop .2s ease-out;}",
            ".pn-fab-menu.open{display:flex;}",
            "@keyframes pn-pop{from{opacity:0;transform:scale(.9) translateY(8px);}to{opacity:1;transform:scale(1) translateY(0);}}",
            ".pn-menu-header{font-size:11px;font-weight:600;color:#94A3B8;padding:2px 4px 6px;border-bottom:1px solid #F1F5F9;margin-bottom:2px;letter-spacing:.05em;text-transform:uppercase;}",
            ".pn-menu-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .15s;border:none;background:transparent;width:100%;text-align:left;}",
            ".pn-menu-item:hover{background:#EEF2FF;}",
            ".pn-menu-item-icon{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6366F1,#8B5CF6);display:flex;align-items:center;justify-content:center;flex-shrink:0;}",
            ".pn-menu-item-text{flex:1;overflow:hidden;}",
            ".pn-menu-item-title{font-size:12px;font-weight:600;color:#1E293B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
            ".pn-menu-item-sub{font-size:10px;color:#94A3B8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
            ".pn-menu-item-restore{width:22px;height:22px;border-radius:6px;border:none;background:#EEF2FF;color:#6366F1;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;transition:background .15s;}",
            ".pn-menu-item-restore:hover{background:#6366F1;color:white;}",
            ".pn-menu-add{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .15s;border:none;background:transparent;width:100%;text-align:left;border-top:1px solid #F1F5F9;margin-top:4px;}",
            ".pn-menu-add:hover{background:#EEF2FF;}",
            ".pn-menu-add-icon{width:28px;height:28px;border-radius:8px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;flex-shrink:0;}",
            ".pn-menu-add-text{font-size:12px;font-weight:600;color:#6366F1;}",
            // Selection toolbar
            ".pn-toolbar{position:fixed;z-index:2147483645;display:none;flex-direction:column;gap:4px;padding:8px;background:rgba(255,255,255,.98);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);border:1px solid rgba(0,0,0,.08);backdrop-filter:blur(12px);animation:pn-pop .2s ease-out;}",
            ".pn-toolbar-btn{width:36px;height:36px;border:none;border-radius:8px;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}",
            ".pn-toolbar-btn:hover{background:#EEF2FF;}",
            ".pn-toolbar-sep{height:1px;background:rgba(0,0,0,.08);margin:2px 0;}",
            // Note card
            ".pn-card{position:fixed;z-index:2147483640;min-width:240px;max-width:400px;background:rgba(255,255,255,.97);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.12);border:1px solid rgba(0,0,0,.07);backdrop-filter:blur(16px);transition:box-shadow .2s,transform .2s,opacity .2s;animation:pn-card-in .25s ease-out;cursor:default;overflow:hidden;}",
            "@keyframes pn-card-in{from{opacity:0;transform:scale(.85);}to{opacity:1;transform:scale(1);}}",
            ".pn-card:hover{box-shadow:0 12px 48px rgba(0,0,0,.18);}",
            ".pn-card.dragging{box-shadow:0 16px 64px rgba(0,0,0,.22);transform:rotate(1.5deg);cursor:grabbing;}",
            ".pn-card.pinned{box-shadow:0 0 0 2px #F59E0B,0 8px 32px rgba(0,0,0,.12);}",
            ".pn-card-header{display:flex;align-items:center;gap:6px;padding:10px 12px 8px;border-bottom:1px solid rgba(0,0,0,.06);cursor:grab;user-select:none;}",
            ".pn-card-drag-icon{color:#CBD5E1;cursor:grab;flex-shrink:0;}",
            ".pn-card-title{font-size:12px;font-weight:600;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}",
            ".pn-card-actions{display:flex;gap:4px;margin-left:auto;opacity:0;transition:opacity .15s;}",
            ".pn-card:hover .pn-card-actions{opacity:1;}",
            ".pn-card-btn{width:26px;height:26px;border:none;border-radius:6px;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#94A3B8;transition:background .15s,color .15s;}",
            ".pn-card-btn:hover{background:#F1F5F9;color:#1E293B;}",
            ".pn-card-body{padding:10px 12px 12px;min-height:60px;position:relative;}",
            ".pn-card-body textarea{width:100%;min-height:80px;border:none;outline:none;resize:none;font-family:Inter,system-ui,sans-serif;font-size:13px;line-height:1.6;color:#1E293B;background:transparent;box-sizing:border-box;padding:0;}",
            ".pn-card-body .preview{font-family:Inter,system-ui,sans-serif;font-size:13px;line-height:1.6;color:#1E293B;min-height:60px;cursor:text;word-break:break-word;}",
            ".pn-card-body .preview h1{font-size:18px;font-weight:700;margin:0 0 8px;}",
            ".pn-card-body .preview h2{font-size:15px;font-weight:600;margin:8px 0 6px;}",
            ".pn-card-body .preview h3{font-size:13px;font-weight:600;margin:6px 0 4px;}",
            ".pn-card-body .preview p{margin:0 0 6px;}",
            ".pn-card-body .preview code{background:#F1F5F9;border-radius:4px;padding:1px 5px;font-family:monospace;font-size:12px;}",
            ".pn-card-body .preview pre{background:#1E293B;color:#E2E8F0;border-radius:8px;padding:10px;overflow-x:auto;margin:8px 0;}",
            ".pn-card-body .preview ul,.pn-card-body .preview ol{margin:0 0 8px;padding-left:20px;}",
            ".pn-card-body .preview blockquote{border-left:3px solid #6366F1;margin:8px 0;padding-left:12px;color:#64748B;}",
            ".pn-card-body .preview a{color:#6366F1;}",
            ".pn-card-body .preview hr{border:none;border-top:1px solid #E2E8F0;margin:12px 0;}",
            ".pn-card-footer{padding:6px 12px 8px;border-top:1px solid rgba(0,0,0,.05);display:flex;align-items:center;justify-content:space-between;}",
            ".pn-card-url{font-size:10px;color:#94A3B8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;}",
            ".pn-card-time{font-size:10px;color:#CBD5E1;}",
            ".pn-confirm{position:absolute;inset:0;background:rgba(255,255,255,.98);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:10;}",
            ".pn-confirm p{font-size:13px;color:#1E293B;font-weight:500;margin:0;}",
            ".pn-confirm-btns{display:flex;gap:8px;width:80%;}",
            ".pn-confirm-btns button{flex:1;padding:8px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;border:none;}",
            ".pn-confirm-btns .cancel{background:#F1F5F9;color:#1E293B;}",
            ".pn-confirm-btns .delete-btn{background:#EF4444;color:white;}",
            // Highlights
            ".pn-hl-yellow{background:#FEF08A!important;cursor:pointer;}",
            ".pn-hl-yellow:hover{background:#FDE047!important;}",
            ".pn-hl-green{background:#BBF7D0!important;cursor:pointer;}",
            ".pn-hl-green:hover{background:#86EFAC!important;}",
            ".pn-hl-pink{background:#FBCFE8!important;cursor:pointer;}",
            ".pn-hl-pink:hover{background:#F9A8D4!important;}",
            // Toast
            ".pn-toast{position:fixed;bottom:88px;right:24px;z-index:2147483647;background:#1E293B;color:white;padding:8px 16px;border-radius:8px;font-family:Inter,system-ui,sans-serif;font-size:12px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.2);opacity:0;transition:opacity .2s;pointer-events:none;}"
        ].join("");
        document.head.appendChild(s);
    }

    // ── FAB + Menu ─────────────────────────────────────────
    function centerX() { return window.innerWidth / 2 - 140; }
    function centerY() { return window.innerHeight / 2 - 60; }

    function createFAB() {
        if (document.getElementById("pn-fab")) return;

        // FAB Menu
        fabMenu = document.createElement("div");
        fabMenu.id = "pn-fab-menu";
        fabMenu.className = "pn-fab-menu";
        document.body.appendChild(fabMenu);

        // FAB button
        fab = document.createElement("button");
        fab.id = "pn-fab";
        fab.className = "pn-fab";
        fab.title = L("PageNotes - 新增筆記 / 選單", "PageNotes - Add Note / Menu");
        fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" width="22" height="22"><path d="M12 5v14M5 12h14"/></svg>';
        document.body.appendChild(fab);

        fab.addEventListener("click", function(e) {
            e.stopPropagation();
            var hasMinimized = Object.keys(minimizedNotes).length > 0;
            if (hasMinimized) {
                toggleFabMenu();
            } else {
                doAddNoteCenter();
            }
        });

        // Close menu on outside click
        document.addEventListener("click", function(e) {
            if (fabMenu && fabMenu.classList.contains("open")) {
                if (!fabMenu.contains(e.target) && e.target !== fab) {
                    fabMenu.classList.remove("open");
                }
            }
        });
    }

    function toggleFabMenu() {
        if (!fabMenu) return;
        if (fabMenu.classList.contains("open")) {
            fabMenu.classList.remove("open");
        } else {
            renderFabMenu();
            fabMenu.classList.add("open");
        }
    }

    function renderFabMenu() {
        if (!fabMenu) return;
        var ids = Object.keys(minimizedNotes);
        var html = '<div class="pn-menu-header">' + L("縮小的筆記", "Minimized Notes") + ' (' + ids.length + ')</div>';

        ids.forEach(function(id) {
            var note = minimizedNotes[id];
            var preview = (note.content || "").slice(0, 30) || L("空白筆記", "Empty note");
            var host = (note.pageUrl || "").replace(/https?:\/\//, "").split("/")[0].slice(0, 20);
            html += [
                '<button class="pn-menu-item" data-restore="' + id + '">',
                '<div class="pn-menu-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg></div>',
                '<div class="pn-menu-item-text">',
                '<div class="pn-menu-item-title">' + escHtml(preview) + '</div>',
                '<div class="pn-menu-item-sub">' + escHtml(host) + '</div>',
                '</div>',
                '<span class="pn-menu-item-restore" title="' + L("恢復", "Restore") + '">&#x2197;</span>',
                '</button>'
            ].join("");
        });

        // Add new note button at bottom
        html += [
            '<button class="pn-menu-add" id="pn-menu-add-btn">',
            '<div class="pn-menu-add-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.5" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg></div>',
            '<span class="pn-menu-add-text">' + L("新增筆記", "Add Note") + '</span>',
            '</button>'
        ].join("");

        fabMenu.innerHTML = html;

        // Bind restore
        fabMenu.querySelectorAll(".pn-menu-item").forEach(function(btn) {
            btn.addEventListener("click", function(e) {
                e.stopPropagation();
                var id = btn.getAttribute("data-restore");
                restoreNote(id);
                fabMenu.classList.remove("open");
            });
        });

        // Bind add
        var addBtn = fabMenu.querySelector("#pn-menu-add-btn");
        if (addBtn) {
            addBtn.addEventListener("click", function(e) {
                e.stopPropagation();
                fabMenu.classList.remove("open");
                doAddNoteCenter();
            });
        }
    }

    function updateFabBadge() {
        var existing = fab && fab.querySelector(".pn-fab-badge");
        if (existing) existing.remove();
        var count = Object.keys(minimizedNotes).length;
        if (count > 0 && fab) {
            var badge = document.createElement("span");
            badge.className = "pn-fab-badge";
            badge.textContent = count;
            fab.appendChild(badge);
            // Change FAB icon to list when there are minimized notes
            fab.querySelector("svg").innerHTML = '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="white" stroke-width="2.5" stroke-linecap="round"/>';
        } else if (fab) {
            // Reset to + icon
            fab.querySelector("svg").innerHTML = '<path d="M12 5v14M5 12h14"/>';
        }
    }

    function minimizeNote(id) {
        var c = notesOnPage[id];
        if (!c) return;
        var note = c.note;
        note.isMinimized = true;
        minimizedNotes[id] = note;
        // Hide card with animation
        c.el.style.opacity = "0";
        c.el.style.transform = "scale(.8)";
        setTimeout(function() {
            if (c.el.parentNode) c.el.parentNode.removeChild(c.el);
        }, 200);
        delete notesOnPage[id];
        chrome.runtime.sendMessage({ type: "UPDATE_NOTE", id: id, updates: { isMinimized: true } });
        updateFabBadge();
        toast(L("已縮小，點 + 可恢復", "Minimized — click + to restore"));
    }

    function restoreNote(id) {
        var note = minimizedNotes[id];
        if (!note) return;
        note.isMinimized = false;
        delete minimizedNotes[id];
        chrome.runtime.sendMessage({ type: "UPDATE_NOTE", id: id, updates: { isMinimized: false } });
        // Re-render at center
        note.x = centerX();
        note.y = centerY();
        renderCard(note, true);
        updateFabBadge();
    }

    // ── Selection Toolbar ──────────────────────────────────
    function createToolbar() {
        if (document.getElementById("pn-toolbar")) return;
        toolbar = document.createElement("div");
        toolbar.id = "pn-toolbar";
        toolbar.className = "pn-toolbar";
        toolbar.innerHTML = [
            '<button class="pn-toolbar-btn" id="pn-btn-note" title="' + L("新增筆記", "Add Note") + '"><svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2" width="18" height="18"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg></button>',
            '<button class="pn-toolbar-btn" id="pn-btn-copy" title="' + L("複製", "Copy") + '"><svg viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" width="18" height="18"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>',
            '<div class="pn-toolbar-sep"></div>',
            '<button class="pn-toolbar-btn" id="pn-btn-hly" title="' + L("黃色", "Yellow") + '"><svg viewBox="0 0 24 24" fill="#FEF08A" stroke="#F59E0B" stroke-width="1.5" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="3"/></svg></button>',
            '<button class="pn-toolbar-btn" id="pn-btn-hlg" title="' + L("綠色", "Green") + '"><svg viewBox="0 0 24 24" fill="#BBF7D0" stroke="#10B981" stroke-width="1.5" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="3"/></svg></button>',
            '<button class="pn-toolbar-btn" id="pn-btn-hlp" title="' + L("粉色", "Pink") + '"><svg viewBox="0 0 24 24" fill="#FBCFE8" stroke="#EC4899" stroke-width="1.5" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="3"/></svg></button>'
        ].join("");
        toolbar.querySelector("#pn-btn-note").addEventListener("click", function(e) { e.stopPropagation(); doAddNoteFromSel(); hideToolbar(); });
        toolbar.querySelector("#pn-btn-copy").addEventListener("click", function(e) { e.stopPropagation(); doCopy(); hideToolbar(); });
        toolbar.querySelector("#pn-btn-hly").addEventListener("click", function(e) { e.stopPropagation(); doHighlight("yellow"); hideToolbar(); });
        toolbar.querySelector("#pn-btn-hlg").addEventListener("click", function(e) { e.stopPropagation(); doHighlight("green"); hideToolbar(); });
        toolbar.querySelector("#pn-btn-hlp").addEventListener("click", function(e) { e.stopPropagation(); doHighlight("pink"); hideToolbar(); });
        document.body.appendChild(toolbar);
    }

    function showToolbar(x, y) {
        var sel = window.getSelection();
        if (!sel || !sel.toString().trim()) { hideToolbar(); return; }
        if (!toolbar) createToolbar();
        toolbar.style.display = "flex";
        var vw = window.innerWidth;
        var left = Math.min(Math.max(x - 100, 8), vw - 216);
        var top = y - 60;
        if (top < 8) top = y + 20;
        toolbar.style.left = left + "px";
        toolbar.style.top = top + "px";
    }

    function hideToolbar() { if (toolbar) toolbar.style.display = "none"; }

    document.addEventListener("mouseup", function(e) {
        if (toolbar && toolbar.contains(e.target)) return;
        if (fab && fab.contains(e.target)) return;
        setTimeout(function() {
            var sel = window.getSelection();
            if (sel && sel.toString().trim().length > 0) {
                var r = sel.getRangeAt(0).getBoundingClientRect();
                showToolbar(r.left + r.width / 2, r.top);
            } else {
                hideToolbar();
            }
        }, 10);
    });

    document.addEventListener("mousedown", function(e) {
        if (toolbar && !toolbar.contains(e.target)) hideToolbar();
    });

    // ── Actions ────────────────────────────────────────────
    function doHighlight(color) {
        var sel = window.getSelection();
        if (!sel || !sel.toString().trim()) return;
        var text = sel.toString();
        var range = sel.getRangeAt(0);
        var node = range.commonAncestorContainer;
        var el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        var path = getElementPath(el);
        var span = document.createElement("span");
        span.className = "pn-hl-" + color;
        span.setAttribute("data-pn-hl", "true");
        span.setAttribute("data-hl-id", "pending");
        span.textContent = text;
        range.deleteContents();
        range.insertNode(span);
        window.getSelection().removeAllRanges();

        var hlData = { pageUrl: location.href, text: text, color: color, selector: path };
        chrome.runtime.sendMessage({ type: "CREATE_HIGHLIGHT", data: hlData }, function(hl) {
            if (hl && hl.id && span.parentNode) {
                span.setAttribute("data-hl-id", hl.id);
            }
        });
        toast(L("已標記", "Highlighted"));
    }

    // Build a stable CSS path from an element (id > class > nth-child)
    function getElementPath(el) {
        if (!el || el === document.body || el === document.documentElement) return "body";
        var parts = [];
        while (el && el !== document.body) {
            var tag = el.tagName.toLowerCase();
            var id = el.id ? '#' + el.id : "";
            var cls = el.className && typeof el.className === "string"
                ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
            var nth = getNthIndex(el);
            parts.unshift(tag + id + cls + ":nth-of-type(" + nth + ")");
            el = el.parentElement;
        }
        return "body " + parts.join(" > ");
    }

    function getNthIndex(el) {
        var parent = el.parentElement;
        if (!parent) return 1;
        var siblings = Array.prototype.slice.call(parent.children).filter(function(c) { return c.tagName === el.tagName; });
        return siblings.indexOf(el) + 1;
    }



    function doCopy() {
        var sel = window.getSelection();
        if (!sel) return;
        navigator.clipboard.writeText(sel.toString()).then(function() { toast(L("已複製", "Copied")); });
    }

    function doAddNoteFromSel() {
        var sel = window.getSelection();
        if (!sel || !sel.toString().trim()) return;
        var r = sel.getRangeAt(0).getBoundingClientRect();
        var note = { pageUrl: location.href, pageTitle: document.title, content: sel.toString().trim(), x: r.left + r.width / 2 - 140, y: r.bottom + 12, width: 280, color: "white", zIndex: 2147483640, isPinned: false, isMinimized: false };
        chrome.runtime.sendMessage({ type: "CREATE_NOTE", data: note }, function(saved) { if (saved) renderCard(saved, false); });
    }

    function doAddNoteCenter() {
        var note = { pageUrl: location.href, pageTitle: document.title, content: "", x: centerX(), y: centerY(), width: 280, color: "white", zIndex: 2147483640, isPinned: false, isMinimized: false };
        chrome.runtime.sendMessage({ type: "CREATE_NOTE", data: note }, function(saved) { if (saved) renderCard(saved, true); });
    }

    // ── Note Card ──────────────────────────────────────────
    function cardZIndex(note) { return note.isPinned ? 2147483647 : 2147483640; }

    function renderCard(note, focus) {
        if (notesOnPage[note.id]) {
            bringToFront(note.id);
            if (focus) refreshCard(notesOnPage[note.id].el, note, true);
            return;
        }
        var card = document.createElement("div");
        card.className = "pn-card" + (note.isPinned ? " pinned" : "");
        card.id = "pn-card-" + note.id;
        card.style.left = (note.x || 100) + "px";
        card.style.top = (note.y || 100) + "px";
        card.style.width = (note.width || 280) + "px";
        card.style.zIndex = cardZIndex(note);

        var titleText = note.pageTitle || location.hostname || "";
        var urlText = (note.pageUrl || "").replace(/https?:\/\//, "").slice(0, 50);
        card.innerHTML = [
            '<div class="pn-card-header">',
            '<svg class="pn-card-drag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>',
            '<span class="pn-card-title">' + escHtml(titleText) + '</span>',
            '<div class="pn-card-actions">',
            '<button class="pn-card-btn pin-btn" title="' + L("釘選", "Pin") + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="' + (note.isPinned ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg></button>',
            '<button class="pn-card-btn minimize-btn" title="' + L("縮小", "Minimize") + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>',
            '<button class="pn-card-btn delete-btn" title="' + L("刪除", "Delete") + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>',
            '</div></div>',
            '<div class="pn-card-body"></div>',
            '<div class="pn-card-footer">',
            '<span class="pn-card-url">' + escHtml(urlText) + '</span>',
            '<span class="pn-card-time">' + fmtTime(note.updatedAt || Date.now()) + '</span>',
            '</div>'
        ].join("");

        notesOnPage[note.id] = { el: card, note: note };
        document.body.appendChild(card);
        bindCard(card, note);
        refreshCard(card, note, !!focus);
    }

    function bringToFront(id) {
        var c = notesOnPage[id];
        if (!c) return;
        var maxZ = 2147483640;
        Object.keys(notesOnPage).forEach(function(k) {
            if (k !== id) { var z = parseInt(notesOnPage[k].el.style.zIndex || 0, 10); if (z > maxZ) maxZ = z; }
        });
        c.el.style.zIndex = maxZ + 1;
    }

    function refreshCard(card, note, editing) {
        var body = card.querySelector(".pn-card-body");
        if (!body) return;
        if (editing) {
            body.innerHTML = '<textarea placeholder="' + L("寫下筆記... 支援 Markdown", "Write note... Markdown supported") + '">' + escHtml(note.content || "") + '</textarea>';
            var ta = body.querySelector("textarea");
            ta.style.cssText = "width:100%;min-height:80px;border:none;outline:none;resize:none;font-family:Inter,system-ui,sans-serif;font-size:13px;line-height:1.6;color:#1E293B;background:transparent;box-sizing:border-box;padding:0;";
            ta.focus();
            ta.addEventListener("blur", function() { saveEdit(card, note, ta.value); });
            ta.addEventListener("keydown", function(e) { if (e.key === "Escape") ta.blur(); });
        } else {
            var preview = note.content ? mdRender(note.content) : '<span style="color:#94A3B8;font-style:italic">' + L("點擊新增內容...", "Click to edit...") + '</span>';
            body.innerHTML = '<div class="preview">' + preview + '</div>';
            body.querySelector(".preview").addEventListener("click", function() { refreshCard(card, note, true); });
        }
    }

    function saveEdit(card, note, newContent) {
        note.content = newContent;
        note.updatedAt = Date.now();
        chrome.runtime.sendMessage({ type: "UPDATE_NOTE", id: note.id, updates: { content: newContent, updatedAt: note.updatedAt } });
        refreshCard(card, note, false);
    }

    function bindCard(card, note) {
        var header = card.querySelector(".pn-card-header");
        if (!header) return;
        makeDraggable(card, header);
        card.addEventListener("mousedown", function() { bringToFront(note.id); });

        // Pin
        var pinBtn = card.querySelector(".pin-btn");
        if (pinBtn) {
            pinBtn.addEventListener("click", function(e) {
                e.stopPropagation();
                note.isPinned = !note.isPinned;
                chrome.runtime.sendMessage({ type: "UPDATE_NOTE", id: note.id, updates: { isPinned: note.isPinned } });
                card.classList.toggle("pinned", note.isPinned);
                card.style.zIndex = cardZIndex(note);
                var svg = pinBtn.querySelector("svg");
                if (svg) svg.setAttribute("fill", note.isPinned ? "currentColor" : "none");
            });
        }

        // Minimize → hide card, add to FAB menu
        var minBtn = card.querySelector(".minimize-btn");
        if (minBtn) {
            minBtn.addEventListener("click", function(e) {
                e.stopPropagation();
                minimizeNote(note.id);
            });
        }

        // Delete
        var delBtn = card.querySelector(".delete-btn");
        if (delBtn) {
            delBtn.addEventListener("click", function(e) {
                e.stopPropagation();
                var c = card.querySelector(".pn-confirm");
                if (!c) {
                    c = document.createElement("div");
                    c.className = "pn-confirm";
                    c.innerHTML = '<p>' + L("刪除這則筆記？", "Delete this note?") + '</p><div class="pn-confirm-btns"><button class="cancel">' + L("取消", "Cancel") + '</button><button class="delete-btn">' + L("刪除", "Delete") + '</button></div>';
                    card.appendChild(c);
                    c.querySelector(".cancel").addEventListener("click", function(ev) { ev.stopPropagation(); c.remove(); });
                    c.querySelector(".delete-btn").addEventListener("click", function(ev) {
                        ev.stopPropagation();
                        chrome.runtime.sendMessage({ type: "DELETE_NOTE", id: note.id });
                        card.style.opacity = "0"; card.style.transform = "scale(.8)";
                        setTimeout(function() { if (card.parentNode) card.parentNode.removeChild(card); }, 200);
                        delete notesOnPage[note.id];
                    });
                }
            });
        }

        // Dblclick header to edit
        header.addEventListener("dblclick", function(e) {
            if (e.target.closest(".pn-card-actions")) return;
            refreshCard(card, note, true);
        });
    }

    function makeDraggable(el, handle) {
        var dragging = false, startX, startY, origX, origY;
        handle.addEventListener("mousedown", function(e) {
            if (e.target.closest(".pn-card-actions")) return;
            dragging = true; el.classList.add("dragging");
            startX = e.clientX; startY = e.clientY;
            origX = el.offsetLeft; origY = el.offsetTop;
            e.preventDefault();
        });
        document.addEventListener("mousemove", function(e) {
            if (!dragging) return;
            el.style.left = (origX + e.clientX - startX) + "px";
            el.style.top = (origY + e.clientY - startY) + "px";
        });
        document.addEventListener("mouseup", function() {
            if (!dragging) return;
            dragging = false; el.classList.remove("dragging");
            var id = el.id.replace("pn-card-", "");
            var c = notesOnPage[id];
            if (c) chrome.runtime.sendMessage({ type: "UPDATE_NOTE", id: c.note.id, updates: { x: el.offsetLeft, y: el.offsetTop } });
        });
    }

    // ── Load notes + highlights ─────────────────────────────
    function loadNotes() {
        chrome.runtime.sendMessage({ type: "GET_NOTES_BY_URL", url: location.href }, function(notes) {
            if (!notes) return;
            notes.forEach(function(n) {
                if (n.isMinimized) {
                    minimizedNotes[n.id] = n;
                } else {
                    renderCard(n, false);
                }
            });
            updateFabBadge();
        });
        // Load highlights after page is fully interactive
        loadHighlightsWhenReady();
    }

    function wrapTextNode(node, hlId, color) {
        if (node.nodeType !== Node.TEXT_NODE) return false;
        var text = node.nodeValue;
        if (!text || !text.trim()) return false;
        // Check if already highlighted
        var parent = node.parentElement;
        if (parent && parent.hasAttribute("data-pn-hl")) return true;

        var hlSpan = document.createElement("mark");
        hlSpan.className = "pn-hl-" + color;
        hlSpan.setAttribute("data-pn-hl", "true");
        hlSpan.setAttribute("data-hl-id", hlId || "");

        var fullText = text.trim();
        var before = text.substring(0, text.indexOf(fullText));
        var after = text.substring(text.indexOf(fullText) + fullText.length);

        var frag = document.createDocumentFragment();
        if (before) frag.appendChild(document.createTextNode(before));
        frag.appendChild(hlSpan);
        if (after) frag.appendChild(document.createTextNode(after));
        hlSpan.textContent = fullText;
        node.parentNode.replaceChild(frag, node);
        return true;
    }

    function applyHighlightByText(hlId, color, text) {
        if (!text) return false;
        var trimmed = text.trim();
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        var node;
        while ((node = walker.nextNode())) {
            var val = node.nodeValue || "";
            var parent = node.parentElement;
            if (parent && parent.hasAttribute("data-pn-hl")) continue;
            // Exact full-node match
            if (val.trim() === trimmed) {
                if (wrapTextNode(node, hlId, color)) return true;
            }
            // Partial: text appears inside this node (multiple highlights in same element)
            if (val.indexOf(trimmed) >= 0) {
                var idx = 0;
                while (true) {
                    var pos = val.indexOf(trimmed, idx);
                    if (pos < 0) break;
                    // Split node and wrap
                    var before = val.substring(0, pos);
                    var after = val.substring(pos + trimmed.length);
                    var hlSpan = document.createElement("mark");
                    hlSpan.className = "pn-hl-" + color;
                    hlSpan.setAttribute("data-pn-hl", "true");
                    hlSpan.setAttribute("data-hl-id", hlId || "");
                    hlSpan.textContent = trimmed;
                    var frag = document.createDocumentFragment();
                    if (before) frag.appendChild(document.createTextNode(before));
                    frag.appendChild(hlSpan);
                    if (after) frag.appendChild(document.createTextNode(after));
                    node.parentNode.replaceChild(frag, node);
                    node = hlSpan.nextSibling;
                    return true;
                }
            }
        }
        return false;
    }

    function loadHighlightsWhenReady() {
        var retries = 0;
        var maxRetries = 10;

        function tryLoad() {
            retries++;
            chrome.runtime.sendMessage({ type: "GET_HIGHLIGHTS_BY_URL", url: location.href }, function(hls) {
                if (hls && hls.length) {
                    var applied = loadHighlights(hls);
                    if (applied === 0 && retries < maxRetries) {
                        setTimeout(tryLoad, 800);
                        return;
                    }
                }
            });
        }

        if (document.readyState === "complete") {
            setTimeout(tryLoad, 600);
        } else {
            window.addEventListener("load", function() { setTimeout(tryLoad, 600); });
        }
    }

    function loadHighlights(highlights) {
        if (!highlights || !highlights.length) return 0;
        var applied = 0;
        highlights.forEach(function(hl) {
            if (applyHighlightByText(hl.id, hl.color, hl.text)) applied++;
        });
        return applied;
    }

    // ── Messages from background ───────────────────────────
    chrome.runtime.onMessage.addListener(function(req) {
        if (req.type === "CREATE_NOTE_AT_CENTER") doAddNoteCenter();
    });

    // ── Keyboard shortcut ─────────────────────────────────
    document.addEventListener("keydown", function(e) {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "n") {
            e.preventDefault();
            doAddNoteCenter();
        }
    });

    // ── Helpers ────────────────────────────────────────────
    function toast(msg) {
        var t = document.querySelector(".pn-toast");
        if (t) t.remove();
        var el = document.createElement("div");
        el.className = "pn-toast";
        el.textContent = msg;
        document.body.appendChild(el);
        requestAnimationFrame(function() { el.style.opacity = "1"; });
        setTimeout(function() { el.style.opacity = "0"; setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 200); }, 2000);
    }

    function fmtTime(ts) {
        if (!ts) return "";
        var d = new Date(ts), now = new Date(), diff = now - d;
        if (diff < 60000) return L("剛剛", "Just now");
        if (diff < 3600000) return Math.floor(diff / 60000) + L("分鐘前", "m ago");
        if (diff < 86400000) return Math.floor(diff / 3600000) + L("小時前", "h ago");
        if (diff < 604800000) return Math.floor(diff / 86400000) + L("天前", "d ago");
        return d.toLocaleDateString(_lang === "en" ? "en-US" : "zh-TW");
    }

    function escHtml(s) {
        if (!s) return "";
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function mdRender(src) {
        if (!src) return "";
        var o = escHtml(src);
        o = o.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        o = o.replace(/\*([^*]+)\*/g, "<em>$1</em>");
        o = o.replace(/`([^`]+)`/g, "<code>$1</code>");
        o = o.replace(/^### (.+)$/gm, "<h3>$1</h3>");
        o = o.replace(/^## (.+)$/gm, "<h2>$1</h2>");
        o = o.replace(/^# (.+)$/gm, "<h1>$1</h1>");
        o = o.replace(/\n/g, "<br>");
        return o;
    }

    // ── Init ───────────────────────────────────────────────
    var _inited = false;
    function init() {
        if (_inited) return;
        _inited = true;
        injectStyles();
        createFAB();
        createToolbar();
        loadNotes();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
