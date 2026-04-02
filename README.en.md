# 📝 PageNotes

### [繁體中文](./README.md) | English | [简体中文](./README.zh-CN.md)

An elegant browser extension for creating floating notes and highlighting text on any webpage. Your notes stay anchored to the page URL, ready whenever you return.

---

## ✨ Features

- 📝 **Floating Notes** — Create draggable note cards anywhere on any webpage
- ✏️ **Markdown Support** — Write notes with Markdown syntax, rendered in real-time
- 🎨 **Highlight Text** — Mark important passages with 3 color choices (yellow/green/pink)
- 🔗 **URL-Linked** — Notes automatically anchor to their source page
- 📋 **Smart Sidebar** — All notes panel with full-text search
- ☁️ **Pro: Cloud Sync** — Firebase-powered cross-device sync (coming soon)
- 📤 **Export** — One-click JSON backup of all notes

## 📦 Installation

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select `pagenotes-chrome-extension/`
4. 📝 icon appears in toolbar

## 🚀 How to Use

| Action | How |
|--------|-----|
| New note | Click 📝 button in page corner |
| Note from selection | Select text → click toolbar 📝 |
| Quick note | `Ctrl+Shift+N` |
| Highlight | Select text → click color in toolbar |
| Manage notes | Click extension 📝 icon |

## 🗂️ Project Structure

```
PageNotes/
├── manifest.json           # Manifest V3 config
├── pages/
│   ├── popup.html         # Sidebar panel
│   └── popup.js           # Panel logic
├── background/
│   └── background.js      # Service Worker + IndexedDB
├── content/
│   └── content.js         # Content Script (notes, toolbar, highlights)
└── styles/
    └── popup.css         # Panel styles
```

## 🔧 Tech Stack

- **Manifest V3** — Latest Chrome Extension API
- **IndexedDB** — Local persistent storage
- **Vanilla JS** — Zero dependencies, lightweight
- **Firebase** — Pro cloud sync (optional)

## ⚠️ Notes

- All data stored locally — never sent to any server (except Pro sync)
- Notes persist across page reloads
- Works on all websites including SPAs

## 📄 License

MIT
