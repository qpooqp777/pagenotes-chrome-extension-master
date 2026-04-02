var fs = require('fs');
var html = '<!DOCTYPE html>\n' +
'<html lang="zh-TW">\n' +
'<head>\n' +
'    <meta charset="UTF-8">\n' +
'    <meta name="viewport" content="width=420">\n' +
'    <title>PageNotes</title>\n' +
'    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">\n' +
'    <link rel="stylesheet" href="../styles/popup.css">\n' +
'</head>\n' +
'<body>\n' +
'    <header class="header">\n' +
'        <div class="header-brand">\n' +
'            <span class="brand-icon">&#x1F4DD;</span>\n' +
'            <span class="brand-name">PageNotes</span>\n' +
'        </div>\n' +
'        <div class="header-actions">\n' +
'            <button class="icon-btn" id="btn-export" title="&#x6A94;&#x51FA;">' +
'                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
'            </button>\n' +
'            <button class="icon-btn" id="btn-settings" title="&#x8A2D;&#x5B9A;">' +
'                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>' +
'            </button>\n' +
'        </div>\n' +
'    </header>\n' +
'\n' +
'    <main class="main">\n' +
'        <section id="view-home" class="view active">\n' +
'            <div class="search-bar">\n' +
'                <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>\n' +
'                <input type="text" id="search-input" class="search-input" placeholder="&#x641C;&#x7D22;&#x7B46;&#x8A18;&#x5167;&#x5BB9;&#x3001;&#x7DB2;&#x5740;...">\n' +
'            </div>\n' +
'\n' +
'            <div class="stats-bar" id="stats-bar">\n' +
'                <span class="stat-item"><strong id="stat-notes">0</strong> &#x7B46;&#x8A18;</span>\n' +
'                <span class="stat-sep">&#183;</span>\n' +
'                <span class="stat-item"><strong id="stat-hls">0</strong> &#x6A19;&#x8A18;</span>\n' +
'                <span class="stat-sep">&#183;</span>\n' +
'                <span class="stat-item"><strong id="stat-pages">0</strong> &#x9801;&#x9762;</span>\n' +
'            </div>\n' +
'\n' +
'            <div class="note-list" id="note-list">\n' +
'                <div class="empty-state">\n' +
'                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>\n' +
'                    <span>&#x5C1A;&#x7121;&#x7B46;&#x8A18;</span>\n' +
'                    <small>&#x5728;&#x7DB2;&#x9801;&#x4E0A;&#x9EDE;&#x64CA;&#x6309;&#x9215;&#x65B0;&#x589E;&#x7B46;&#x8A18;</small>\n' +
'                </div>\n' +
'            </div>\n' +
'        </section>\n' +
'\n' +
'        <section id="view-settings" class="view">\n' +
'            <div class="view-header">\n' +
'                <button class="back-btn" id="btn-back">\n' +
'                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> &#x8FD4;&#x56DE;\n' +
'                </button>\n' +
'                <span class="view-title">&#x8A2D;&#x5B9A;</span>\n' +
'            </div>\n' +
'\n' +
'            <div class="settings-group">\n' +
'                <div class="settings-group-title">&#x1F3A8; &#x5916;&#x89C0;</div>\n' +
'                <div class="setting-row">\n' +
'                    <div class="setting-info">\n' +
'                        <div class="setting-name">&#x9810;&#x8A2D;&#x6A19;&#x8A18;&#x984F;&#x8272;</div>\n' +
'                    </div>\n' +
'                    <div class="color-picker" id="default-color">\n' +
'                        <button class="color-opt active" data-color="yellow" style="background:#FEF08A"></button>\n' +
'                        <button class="color-opt" data-color="green" style="background:#BBF7D0"></button>\n' +
'                        <button class="color-opt" data-color="pink" style="background:#FBCFE8"></button>\n' +
'                    </div>\n' +
'                </div>\n' +
'            </div>\n' +
'\n' +
'            <div class="settings-group">\n' +
'                <div class="settings-group-title">&#x1F510; Pro &#x7248;&#xFF08;&#x96F2;&#x7AEF;&#x540C;&#x6B65;&#xFF09;</div>\n' +
'                <div class="setting-row">\n' +
'                    <div class="setting-info">\n' +
'                        <div class="setting-name">Firebase &#x540C;&#x6B65;</div>\n' +
'                        <div class="setting-desc">&#x8DE8;&#x8A2D;&#x5099;&#x5373;&#x6642;&#x540C;&#x6B65;&#x6240;&#x6709;&#x7B46;&#x8A18;</div>\n' +
'                    </div>\n' +
'                    <label class="toggle">\n' +
'                        <input type="checkbox" id="setting-sync">\n' +
'                        <span class="toggle-slider"></span>\n' +
'                    </label>\n' +
'                </div>\n' +
'                <div id="firebase-config" style="padding:0 14px 12px;display:none;">\n' +
'                    <div class="input-group">\n' +
'                        <label>Firebase API Key</label>\n' +
'                        <input type="text" id="setting-firebaseApiKey" class="setting-input" placeholder="AIzaSy...">\n' +
'                    </div>\n' +
'                    <div class="input-group">\n' +
'                        <label>Firebase Auth Domain</label>\n' +
'                        <input type="text" id="setting-firebaseAuthDomain" class="setting-input" placeholder="xxx.firebaseapp.com">\n' +
'                    </div>\n' +
'                    <div class="input-group">\n' +
'                        <label>Firebase Database URL</label>\n' +
'                        <input type="text" id="setting-firebaseDbUrl" class="setting-input" placeholder="https://xxx-default-rtdb.firebaseio.com">\n' +
'                    </div>\n' +
'                </div>\n' +
'            </div>\n' +
'\n' +
'            <div class="settings-group">\n' +
'                <div class="settings-group-title">&#x1F4E6; &#x8CC7;&#x6599;</div>\n' +
'                <div class="setting-row data-actions">\n' +
'                    <button class="data-btn" id="btn-export-json">\n' +
'                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>\n' +
'                        &#x532F;&#x51FA; JSON\n' +
'                    </button>\n' +
'                    <button class="data-btn danger" id="btn-clear-all">\n' +
'                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>\n' +
'                        &#x6E05;&#x9664;&#x5168;&#x90E8;\n' +
'                    </button>\n' +
'                </div>\n' +
'            </div>\n' +
'        </section>\n' +
'    </main>\n' +
'\n' +
'    <script src="popup.js"></script>\n' +
'</body>\n' +
'</html>\n';

var outPath = 'C:/Users/qpooq/.qclaw/workspace/pagenotes-chrome-extension/pages/popup.html';
fs.writeFileSync(outPath, html, 'utf8');
var stat = fs.statSync(outPath);
console.log('popup.html written: ' + stat.size + ' bytes');
