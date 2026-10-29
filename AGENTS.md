# 🤖 AGENTS.md — Development & Governance Guidelines for Zcrap

This document defines strict operational rules, architectural principles, and release workflows for all AI coding assistants (Antigravity, Cursor, Claude, Copilot, etc.) working on the **Zcrap** codebase.

---

## 🎯 Project Overview
* **Name:** Zcrap — Web to Figma Converter
* **Type:** 100% Free & Unlimited Client-Side Alternative to `html.to.design`
* **Core Components:**
  1. `extension/` — Chrome Extension (Manifest V3, CDP Engine, Vector Serializer, Content Script)
  2. `figma-plugin/` — Figma Plugin (Figma Canvas Node Builder, Auto-Layout Engine)
  3. `scripts/` — Project validation, packing, and release scripts

---

## 🚨 MANDATORY AGENT RULES

### 1. Mandatory Version Bumping & Synchronization
**Never release a new feature, architecture change, or bug fix without bumping the version number.**

* **Versioning Scheme:** Semantic Versioning (`MAJOR.MINOR.PATCH`)
  * `MAJOR` (`v4.0.0`): Fundamental architectural rewrite or breaking schema changes.
  * `MINOR` (`v3.2.0`): New capabilities (e.g. Direct Canvas Paste, new export modes).
  * `PATCH` (`v3.2.1`): Bug fixes, CSS parser tweaks, stability improvements.
* **Synchronized Files (ALL 6 MUST MATCH):**
  Whenever updating the version, the agent **MUST** update all 6 locations in unison:
  1. `package.json` -> `"version": "x.y.z"`
  2. `extension/manifest.json` -> `"version": "x.y.z"`
  3. `extension/popup.html` -> `<span class="version-tag">vx.y.z ...</span>`
  4. `extension/background.js` -> Top comment header: `// ... (vx.y.z Pro)`
  5. `figma-plugin/ui.html` -> Header badge: `vx.y.z ...`
  6. `README.md` -> Title header and release notes.

---

### 2. Dual-Mode Architecture Integrity
Zcrap operates in two complementary modes:
1. **Direct Canvas Paste (Ctrl+V without Plugin):**
   * Uses `buildFigmaDirectPastePayload()` in `content.js` to serialize the DOM into clean, native SVG.
   * Clipboard must write both `text/html` and `text/plain` using `ClipboardItem`.
   * **Rule:** Never break direct SVG paste. Figma canvas paste must work without requiring any plugin to be open.
2. **Auto-Layout Pro Mode (via Figma Plugin):**
   * Embeds base64-encoded metadata (`<!--zcrap-metadata:...-->`) inside the SVG string.
   * The plugin's `ui.html` auto-decodes this metadata to construct full Auto-Layout frames (`figma.createFrame`, `layoutMode`, `itemSpacing`).
   * **Rule:** Any change to DOM serialization must maintain metadata backward compatibility.

---

### 3. Cross-Platform Font & OS Fallback Policy
* Do not rely on raw CSS font family strings alone (`-apple-system`, `BlinkMacSystemFont`).
* Always route font family strings through `resolvePlatformFontFamily()`:
  * Windows -> Map system fallbacks to `Segoe UI`.
  * macOS -> Map system fallbacks to `Inter` / `San Francisco`.
  * Linux/Android -> Map to `Roboto`.
* Always validate available fonts with `document.fonts.check()` before finalizing.
* In `figma-plugin/code.js`, `loadFontSafe()` must always have a graceful fallback to `Inter` if a font is missing from the user's Figma library.

---

### 4. Cross-Origin & Security Rules
* Never assume `iframe.contentDocument` is accessible. Always wrap iframe access in `try/catch` and provide a styled `[IFrame: ...]` placeholder for cross-origin iframes.
* Never use `FileReader` inside Manifest V3 background service workers (`background.js`). Use `await resp.arrayBuffer()` + Base64 Uint8Array conversion.
* Always handle canvas taint errors when capturing images; provide background worker fetch bypass with `<all_urls>` permission.

---

### 5. Verification Before Completion
Before reporting any task as done or committing changes, the agent **MUST**:
1. Run syntax verification:
   ```bash
   node scripts/validate.js
   ```
2. Confirm that all 6 files pass syntax and schema checks with **0 errors**.
3. Check `git status` to ensure no stray files or unwanted diffs remain.
