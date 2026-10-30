# ⚡ Zcrap v3.8.4 Crisp Pill Buttons & Glow Filter Fix — Web to Figma Converter (100% Free & Unlimited)

**Zcrap** is a free, open-source web-to-Figma converter. Pixel-Perfect import is the default for visual matching; Auto-Layout conversion remains an explicit option when responsive editable flow is preferred.

## Release notes

### v3.8.4 — Crisp Pill Buttons & Glow Filter Fix

- **Glow Pseudo-Element Filtering**: Suppressed unrenderable CSS blur/radial glow pseudo-elements on buttons and cards, eliminating the squashed white oval/blob that previously obscured pill buttons.
- **Perfect Pill Shape Rendering**: Buttons with 9999px or half-dimension radii now render as crisp, perfect pill shapes matching the source website.

### v3.8.3 — Semantic Landmark Layers & FAQ Bug Fix

- **Root Wrapper Unrolling**: Automatically unwraps full-screen anonymous wrapper `<div>`s (`#__next`, `min-h-screen`, Vite `#root`), promoting top-level semantic sections (`Header`, `Main`, `Footer`, `Nav`, `Section`) directly to canvas root layers, matching `html.to.design` hierarchy.
- **XML-Compliant SVG IDs**: Sanitized SVG element IDs to valid XML NCNames (`Nav-Ordered-List`, `Main`, `Header`, `Button-Get-Started`), preventing Figma's C++ XML parser from discarding layer names and falling back to generic `Group`.
- **Closed FAQ Accordion Overlap Fix**: Excluded collapsed/hidden accordion answers (`height <= 0 && overflow: hidden` or `data-state="closed"`), eliminating visual overlap on FAQ items.
- **Independent Border Line Rendering**: Non-uniform borders (such as FAQ bottom divider lines) now render as discrete 1px divider lines rather than 4-sided rectangular boxes.
- **Interactive Component Preservation**: Prevented interactive controls (Buttons, Links, Accordion Triggers) from being flattened into bare text even when rendered with transparent backgrounds.

### v3.8.2 — Native Rectangle Corner Radius Fidelity

- **Subpixel Symmetry Tolerance**: Implemented tolerance threshold for subpixel corner differences, preventing rounded cards and buttons from falsely degenerating into flat vector paths.
- **Parent Overflow Clipping Inheritance**: Inner background elements now inherit corner radius from `overflow: hidden` parent containers, eliminating sharp corners on modern framework cards.
- **Pill & Circle Clamping**: Clamped 50% and 9999px radii to element half-dimensions, ensuring Figma imports native Rectangles with live corner radius rather than distorted vectors.
- **Removed Mask Wrapping**: Eliminated redundant SVG clipPath wrappers that caused Figma to convert live rounded rectangles into Vector Mask groups.

### v3.8.1 — Redundant Wrapper Flattening & Button Listbox Naming

- **Redundant Group Flattening**: Automatically eliminated unstyled single-child wrapper groups in SVG serialization, lifting text and icons directly into button and container parents without extra nested `Group` layers.
- **ARIA & Role-Aware Naming**: Added dedicated detection for `aria-haspopup="listbox"` (`Button listbox`), `aria-haspopup="menu"` (`Button menu`), `aria-label` theme buttons (`Button - Dark theme`, `Button - Light theme`, `Button - System theme`), `Link - [Label]`, and `<small>` elements.

### v3.8.0 — Direct Canvas Paste Semantic Layers

- **1:1 Semantic Naming matching html.to.design**: SVG groups and elements now receive semantic names (`Header`, `Nav → Ordered List`, `Nav → List`, `Main`, `Footer`, `Section`, `Container`, `Button: [Label]`, `Heading 1-6`).
- **Clean Shape Elements**: Background rectangles and borders now output with clean layer identifiers (`Background`, `Border`) instead of anonymous `Vector` layers.
- **Unrestricted Layer Names in SVG**: Preserved natural human-readable names with spaces and Unicode (`Nav → Ordered List`, `Button: ...`) across Figma's native SVG importer.

### v3.7.1 — Text Sizing Fix

- Preserve captured widths for constrained multiline text in vertical Auto-Layout containers so headings keep their browser line breaks.

### v3.7.0 — Semantic Layers

- Give direct-paste SVG text layers readable names without an extra wrapper group.
- Use readable unique layer IDs and content-based names for masks instead of `zcrap_fclip_*` IDs.
- Infer card and section names from direct headings when a page wrapper has no semantic class or ID.

### v3.6.0 — Fidelity Engine

- Preserve sub-pixel DOM bounds through capture instead of rounding every edge to whole pixels.
- Fix DOM text line measurement so wrapped text line ranges are actually read from the captured Range.
- Preserve image `object-fit` when generating direct-paste SVG and use fit scaling for contained images in the plugin.
- Preserve inline font family, weight, and italic differences in rich-text ranges where Figma has a matching font.
- Make Pixel-Perfect import the default; Auto-Layout stays available as an opt-in mode.

In the **v3.5.0** update, after thoroughly analyzing `html.to.design`'s architecture, professional mechanisms such as **Chrome DevTools Protocol (CDP) bridge activation**, OS-aware platform font detection, secure cross-origin iframe handling, and GSAP/AOS scroll cleaning have been directly implemented. It operates entirely client-side and locally, eliminating the need for cloud credit limits or paid subscriptions.

---

## 📁 Project Structure
```
Zcrap/
├── extension/          # Chrome Extension (CDP Engine, DOM/CSS/SVG Serializer)
│   ├── icons/          # Extension Icons (16x16, 32x32, 48x48, 128x128 & SVG)
│   ├── manifest.json   # Extension Manifest v3 (CDP "debugger" permission enabled)
│   ├── background.js   # Service Worker (CDP Controller & Platform Fonts / CORS Bypass)
│   ├── popup.html      # Modern UI Popup
│   ├── popup.js        # Capture Actions & Clipboard Handlers
│   └── content.js      # 1:1 Subpixel Engine & Animation Freezing Serializer
├── figma-plugin/       # Figma Plugin (Figma Canvas Engine & Effects Renderer)
│   ├── assets/         # High-res Plugin Icons
│   ├── icon.png        # 128x128 Plugin Manifest Icon
│   ├── manifest.json
│   ├── code.js         # Figma Canvas Node Builder, Auto-Layout & Font Engine
│   └── ui.html         # One-Click Clipboard Paste & Dropzone Interface
├── Simplification.svg  # Master Vector Brand Logo
└── README.md
```

---

## 🔬 Mechanisms Added in v3.5.0 High-Fidelity Engine:

0. **🎯 Circular Avatar ClipPaths, Glass Borders & Exact DOM Word Wrapping:**
   - Native SVG `<clipPath>` engine for rounded avatars and circular images (including parent `overflow: hidden` detection).
   - Dedicated `stroke-opacity` and `fill-opacity` parser for dark-mode glass borders (fixing the harsh 100% white stroke issue in Figma).
   - Exact rendered text line-break detection directly from the live DOM `Range`.

1. **📐 Auto-Layout Pro Default & Multi-line Text Auto-Wrapping:**
   - Dynamic word-wrapping engine based on SVG `<tspan>` to prevent long paragraphs from overflowing onto a single line when pasted directly into Figma.
   - Responsive Auto-Layout engine enabled by default in the plugin, featuring vertical stacking and padding detection for standard HTML block containers.
   - UTF-8 safe metadata encoder/decoder for full Unicode and emoji support.

2. **🛡️ Chrome DevTools Protocol (CDP) Engine:**
   - Accesses the browser's low-level rendering kernel to extract real subpixel coordinates and font data.
   - `CSS.getPlatformFontsForNode`: Precisely identifies which font (PostScriptName) was actually rendered on the user's operating system.

3. **⏸️ Animation & Transition Freezer (`__zcrap_anim_pause`):**
   - Temporarily pauses (`paused !important`) all CSS animations and transitions across the page during scraping, preventing elements from shifting or appearing blurred.

4. **🧩 Inline SVG Sprite & `<use>` Resolution:**
   - Automatically converts external or hidden `<use href="#id">` sprites used on modern websites (Twitter/X, GitHub, Stripe, Shopify) into inline vector paths so no icons are missed.

5. **🧊 WebGL & Canvas Readback Preservation:**
   - Captures charts, 3D canvases, and graphics immediately after frame draw and converts them into data URLs.

6. **🌐 Deep Shadow DOM & `<slot>` Flattening:**
   - Captures open and closed shadow roots as well as slotted elements in modern Web Components with exact parent-child hierarchy.

7. **✂️ Vector Clip-Path Masking (`clip-path`):**
   - Extracts CSS `clip-path: polygon(...)` and SVG clipPath data to convert them into Figma mask and clip frames.

8. **🌈 Native Gradients & Auto-Layout v4:**
   - Converts `linear-gradient` and `radial-gradient` directly into Figma's graphical transformation matrices.
   - Flexbox and CSS Grid automatically convert to Figma's Auto-Layout Wrap.

---

## 🚀 Setup and Usage Instructions

### Step 1: Install Chrome Extension
1. Open Google Chrome browser and navigate to: `chrome://extensions/`
2. Enable **"Developer mode"** in the top right corner.
3. Click the **"Load unpacked"** button on the top left.
4. Select the extension directory:
   ```
   C:\Users\ASUS\Desktop\Zcrap\extension
   ```
5. The **Zcrap - Web to Figma (v3.5.0 High-Fidelity Engine)** extension will be added to your browser!

---

### Step 2: Install and Run Figma Plugin
1. Open **Figma Desktop App** on your computer and open any file.
2. From the top menu, go to **Figma Menu** -> **Plugins** -> **Development** -> **Import plugin from manifest...**.
3. Select the manifest file from the file explorer:
   ```
   C:\Users\ASUS\Desktop\Zcrap\figma-plugin\manifest.json
   ```
4. Done! The **Zcrap - HTML to Figma** plugin will be installed in your Figma app.

---

## 🎨 How to Copy Websites to Figma

### Method 1: Direct Paste (Like html.to.design — Direct Ctrl + V without plugin) 🚀
1. Navigate to the tab of the website UI you want to copy.
2. Open **Zcrap** from the extension bar and click **"⚡ Capture Full Page"** (or press **Alt+Shift+E**). Alternatively, use **"🎯 Capture Selection"** to select a specific section.
3. Switch to your Figma file, click on the canvas, and press **Ctrl + V** (or **Cmd + V** on Mac)!
4. **Boom! Without opening any plugin**, the entire website will drop onto your Figma canvas as editable vectors, frames, colors, and text layers!

### Method 2: Auto-Layout Pro Mode (Using Zcrap Figma Plugin) 📐
1. If you want responsive Auto-Layout (Flexbox, Padding, Auto-width/height) for the entire website:
2. Run the **Zcrap** plugin in Figma and click **"📋 Paste from Clipboard"** (or press **Ctrl + V** inside the plugin).
3. The plugin will automatically render full Auto-Layout structures.

### Method 3: Drag & Drop (.zcrap file)
1. Click **"🔴 Record Flow"** in the extension popup to download a `.zcrap` file.
2. Drag and drop the file into the Figma plugin dropzone.
3. The plugin will automatically generate all frames, colors, and fonts.

---

## 🛠️ Developer Scripts & CI/CD

GitHub Actions CI/CD workflows are integrated into the repository to ensure automated code quality and packaging:
* **CI Validation (`.github/workflows/ci.yml`):** Validates code syntax, Manifest V3, and Figma schema on every PR and push, creating test zip artifacts.
* **Automated Releases (`.github/workflows/release.yml`):** Automatically creates clean `zcrap-extension.zip` and `zcrap-figma-plugin.zip` files and uploads them to GitHub Releases upon pushing a new git tag (`v*`).
* **CodeQL Security (`.github/workflows/codeql.yml`):** Automatically scans code for security vulnerabilities.

### Local Testing & Packaging Commands:
```bash
# Run all code syntax and manifest validations
npm test

# Build distribution zips (generated in dist/ directory)
npm run build
```

---

## 💯 100% Free & Unlimited
No cloud APIs or paid trials—convert any website to Figma as many times as you want!
