# Implementation Plan: Zcrap Architecture & CDP Alignment Fixes

- **Target Project:** `c:\Users\ASUS\Desktop\Zcrap`
- **Objective:** Fix architectural discrepancies between `html.to.design` and `Zcrap`, fix dead CDP code, resolve font mismatch bugs, prevent cross-origin iframe failures, fix Manifest V3 service worker `FileReader` error, and neutralize JS scroll smoothers.

---

## Tasks

### Task 1: Update Extension Manifest Permissions
- **File:** `extension/manifest.json`
- **Changes:**
  - Add `"webNavigation"`, `"storage"` to `permissions`.
  - Ensure background service worker permissions and commands are aligned.

### Task 2: Fix Background Service Worker (`extension/background.js`)
- **File:** `extension/background.js`
- **Changes:**
  - Fix `FileReader` in Service Worker (replace with `response.arrayBuffer()` + Base64 Uint8Array encoder).
  - Add `neutralize_scroll_libraries` (injected in `world: 'MAIN'` to kill `ScrollSmoother`, `AOS`, `Lenis`, `LocomotiveScroll`).
  - Wire up robust CDP attach/detach and command proxying.
  - Add fallback image downloader with `<all_urls>` privilege to bypass CORS.

### Task 3: Upgrade Popup Controller (`extension/popup.js`)
- **File:** `extension/popup.js`
- **Changes:**
  - Call `neutralize_scroll_libraries` before capture.
  - Automatically attach CDP before full-page or inspect capture, and detach after completion.
  - Pass `useCdp: true` flag.

### Task 4: Upgrade Content Script Serializer (`extension/content.js`)
- **File:** `extension/content.js`
- **Changes:**
  - Add OS-aware font normalizer (`resolvePlatformFontFamily`) to map `-apple-system`, `BlinkMacSystemFont`, `system-ui` to real OS fonts (`Segoe UI`, `Inter`, `Roboto`) and check `document.fonts.check`.
  - Fix cross-origin iframe handling: catch `SecurityError` gracefully and generate a styled placeholder node with exact geometry instead of dropping it.
  - Ensure animations and transitions are paused cleanly.

### Task 5: Upgrade Figma Plugin Engine (`figma-plugin/code.js`)
- **File:** `figma-plugin/code.js`
- **Changes:**
  - Pass `nodeData.postScriptName` into `loadFontSafe` for 1:1 platform font resolution.
  - Ensure font loading never crashes or hangs (robust `Inter` fallback).

### Task 6: Verification
- Verify syntax and run integration validation script across all modified files.
