# 📝 PageNotes — 沉浸式網頁筆記 Chrome 擴展

## 1. Concept & Vision

**PageNotes** 就像在網頁上放了一張張便利貼，但比便利貼更強大。你可以自由拖曳放置筆記、標記重點，所有筆記自動連結到頁面 URL，隨時回來查看。用過就知道，它改變了你和網頁互動的方式。

核心理念：**網頁是你的畫布，筆記是你的標記。**

---

## 2. Design Language

### 美學方向
參考 Notion + Miro 的乾淨協作風格。卡片帶有輕微陰影和玻璃質感，在任何網頁上都不突兀。

### 色彩系統
```
Primary:    #6366F1  (Indigo — 專注)
Secondary: #8B5CF6  (Purple — 創意)
Accent:    #F59E0B  (Amber — 提醒)
Success:   #10B981
Danger:    #EF4444
Background: rgba(255,255,255,0.95)
Surface:   rgba(255,255,255,0.97)
Text:      #1E293B
Muted:     #64748B
Border:    rgba(0,0,0,0.08)
Highlight Yellow: #FEF08A (蛍光黃)
Highlight Green:  #BBF7D0 (蛍光綠)
Highlight Pink:   #FBCFE8 (蛍光粉)
```

### 字體
- UI: **Inter** (Google Fonts)
- Markdown 內容: **Inter** + **JetBrains Mono** (代碼區塊)

### 圖標
Lucide Icons (SVG inline) — 輕量、乾淨

### 動效哲學
- 筆記建立: scale from 0.8 + fade in, 200ms spring
- 拖曳: 無延遲，實時跟隨鼠標
- 刪除: scale to 0.8 + fade out, 150ms
- Hover: 輕微上浮 + 陰影加深

---

## 3. Layout & Structure

### 擴展檔案架構
```
PageNotes/
├── manifest.json
├── pages/
│   ├── popup.html          # 筆記管理面板
│   └── popup.js            # Popup 邏輯
├── background/
│   ├── background.js       # Service Worker（IndexedDB 管理）
│   └── notes-db.js         # IndexedDB 封裝
├── content/
│   ├── content.js          # Content Script 主體
│   ├── note-card.js        # 筆記卡片渲染
│   ├── highlighter.js      # 文字標記邏輯
│   └── toolbar.js          # 浮動工具列
├── styles/
│   ├── note-card.css       # 筆記卡片樣式（injected）
│   ├── toolbar.css         # 工具列樣式
│   └── popup.css           # Popup 樣式
└── assets/
    └── icons/
```

### Popup 面板佈局
```
┌──────────────────────────────────────┐
│ 📝 PageNotes    [所有筆記] [設定] [+]  │
├──────────────────────────────────────┤
│ 🔍 搜尋所有筆記...                      │
├──────────────────────────────────────┤
│ 📄 github.com/notion.so               │
│    📌 這段 API 文檔寫得很清楚...        │
│    [選取文字] 2026-03-29 11:20        │
├──────────────────────────────────────┤
│ 📄 medium.com/article                 │
│    📌 研究要點摘要...                  │
│    [選取文字] 2026-03-28 18:45        │
└──────────────────────────────────────┘
```

### 網頁上的 UI 元素
1. **浮動按鈕（FAB）** — 右下角，一鍵新增筆記
2. **筆記卡片** — 可拖曳定位的便利貼
3. **標記文字** — 選取文字後浮現的工具提示
4. **工具列** — 選取文字時顯示（標記/筆記/複製）

---

## 4. Features & Interactions

### 4.1 筆記卡片

**建立方式：**
- 點擊 FAB → 在點擊位置建立空白筆記
- 選取文字 → 工具列「📝筆記」→ 在選取區域附近建立預填充筆記

**行為：**
- 拖曳標題區域移動位置
- 點擊內容區域進入編輯模式
- 點擊外部自動儲存
- 點擊關閉按鈕顯示確認刪除
- 雙擊標題固定/取消固定
- 支援 Markdown 渲染（編輯/預覽模式切換）

**筆記資料結構：**
```js
{
  id: "note_1709999999999",
  pageUrl: "https://github.com/user/repo",
  pageTitle: "GitHub",
  content: "# 標題\n\n正文內容，支援 **Markdown**",
  x: 120,        // 相對視口左側 px
  y: 340,        // 相對視口頂部 px
  width: 280,    // 筆記寬度
  color: "white", // 背景色
  zIndex: 100,
  createdAt: 1709999999999,
  updatedAt: 1709999999999,
  isPinned: false
}
```

### 4.2 文字標記（螢光筆）

**建立：**
- 選取任意文字 → 浮現工具列
- 點擊標記顏色按鈕 → 套用標記

**標記資料結構：**
```js
{
  id: "hl_1709999999999",
  pageUrl: "https://example.com/article",
  selector: "p:nth-child(3)",   // DOM 路徑
  startOffset: 12,
  endOffset: 45,
  text: "被標記的原文",
  color: "yellow",
  noteId: null,     // 可選：關聯筆記
  createdAt: 1709999999999
}
```

**難點處理：**
- SPA 頁面：使用 MutationObserver 監聽 DOM 變化，重新附加標記
- 動態內容：用相對位置（previousElementSibling）定位，失敗時顯示為浮層
- 刪除：點擊標記區域顯示移除按鈕

### 4.3 浮動工具列

**何時出現：**
- 用戶選取任意文字時，在選取範圍上方顯示

**工具列按鈕：**
- 🎨 標記（黃/綠/粉三色）
- 📝 新增筆記（預填充選取文字）
- 📋 複製選取文字
- 🔗 複製連結（並標記）

### 4.4 側邊欄面板（Popup）

**功能：**
- 所有筆記列表（按頁面分組）
- 搜尋：支援標題/內容/URL 全文搜索
- 點擊筆記 → 跳轉到對應頁面 + 自動滾動到筆記位置
- 批次刪除、匯出 JSON

### 4.5 Markdown 支援

**支援語法：**
- 標題（# / ## / ###）
- 粗體（**text**）
- 斜體（*text*）
- 代碼（`inline` / ```block```）
- 列表（- / 1.）
- 連結（[text](url)）
- 引用（>）
- 水平線（---）

**渲染方式：** marked.js（CDN）→ 轉 HTML → DOMPurify 消毒 → 寫入卡片

### 4.6 Pro 版雲端同步（Premium）

**Firebase Realtime Database 方案：**
- Firebase Auth（Google 登入）
- Realtime DB 結構：`users/{uid}/notes/`
- 即時同步：WebSocket 長連接
- 離線支援：Firebase SDK 內建 Offline Persistence
- 衝突處理：Last-write-wins + 版本號

**定價模式：**
- Free：本地 100 筆記，5 頁面
- Pro（$2.99/月）：雲端無限同步，多設備

---

## 5. Component Inventory

### 5.1 浮動按鈕（FAB）
- Default：半透明玻璃質感，深色背景
- Hover：放大 1.05x，陰影加深
- Active：點擊縮小 0.95x
- 展開：展開為微型工具列

### 5.2 筆記卡片
- Default：白色半透明，毛玻璃效果，輕微陰影
- Hover：z-index 提升，工具列浮現
- Editing：邊框變成紫色，陰影加深
- Pinned：頂部有固定圖標，始終置頂
- Dragging：輕微旋轉（2deg），陰影最大

### 5.3 工具列
- 出現：scale + fade，200ms
- 消失：150ms fade out
- 按鈕 Hover：背景變紫色

### 5.4 標記高亮
- 三色可選：黃/綠/粉
- Hover：顯示移除按鈕
- 刪除：點擊移除 + 淡出動畫

---

## 6. Technical Approach

### 技術棧
- **Manifest V3** — Chrome Extension
- **IndexedDB** — 本地持久化存儲
- **Vanilla JS** — 無框架，輕量（ES5 兼容）
- **marked.js** — Markdown 解析（CDN）
- **DOMPurify** — HTML 消毒（CDN）
- **Firebase** — Pro 版雲端同步

### IndexedDB Schema
```
DB: "PageNotesDB"
Version: 1

ObjectStore: "notes"
  keyPath: "id"
  Indexes: pageUrl, updatedAt

ObjectStore: "highlights"
  keyPath: "id"
  Indexes: pageUrl

ObjectStore: "settings"
  keyPath: "key"
```

### Content Script 架構
- 單例模式：每個頁面只有一個 content script 實例
- DOM 掛載點：`document.body`
- 樣式隔離：所有 CSS 加上 `.pagenotes-` 前綴
- 事件委託：統一的事件監聽器

### 跨設備同步（Pro）
- Firebase Realtime Database
- 結構：`/users/{uid}/notes/{noteId}`
- 訂閱：`onValue` 監聽，變更時寫入 IndexedDB + 更新 DOM

---

## 7. 驗收標準

- [ ] FAB 按鈕在所有頁面正確顯示
- [ ] 點擊 FAB 可在點擊位置建立筆記
- [ ] 筆記可自由拖曳定位
- [ ] 編輯筆記支援 Markdown 渲染
- [ ] 選取文字浮現工具列
- [ ] 標記文字正確保存和顯示
- [ ] 重新打開頁面筆記正確恢復
- [ ] Popup 顯示所有筆記並可搜索
- [ ] 點擊 Popup 筆記跳轉並定位
- [ ] Pro 版 Firebase 同步正常運作
