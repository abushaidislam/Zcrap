# ⚡ Zcrap v3.3.0 Pro Layout Engine — Web to Figma Converter (100% Free & Unlimited)

**Zcrap** is a completely free, open-source alternative to `html.to.design` that converts any live website or web element into editable Figma Auto-Layout layers, fonts, images, gradients, and SVGs with 1:1 precision.

In the `v3.3.0` update, after thoroughly analyzing `html.to.design`'s architecture, professional mechanisms such as **Chrome DevTools Protocol (CDP) bridge activation**, OS-aware platform font detection, secure cross-origin iframe handling, and GSAP/AOS scroll cleaning have been directly implemented. It operates entirely client-side and locally, eliminating the need for cloud credit limits or paid subscriptions.

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

## 🔬 Mechanisms Added in v3.3.0 Pro Layout Engine:

0. **📐 Auto-Layout Pro Default & Multi-line Text Auto-Wrapping:**
   - Dynamic word-wrapping engine based on SVG `<tspan>` to prevent long paragraphs from overflowing onto a single line when pasted directly into Figma.
   - Responsive Auto-Layout engine enabled by default in the plugin, featuring vertical stacking and padding detection for standard HTML block containers.
   - UTF-8 safe metadata encoder/decoder for full Unicode and emoji support.

1. **🛡️ Chrome DevTools Protocol (CDP) Engine:**
   - Accesses the browser's low-level rendering kernel to extract real subpixel coordinates and font data.
   - `CSS.getPlatformFontsForNode`: Precisely identifies which font (PostScriptName) was actually rendered on the user's operating system.

2. **⏸️ Animation & Transition Freezer (`__zcrap_anim_pause`):**
   - Temporarily pauses (`paused !important`) all CSS animations and transitions across the page during scraping, preventing elements from shifting or appearing blurred.

3. **🧩 Inline SVG Sprite & `<use>` Resolution:**
   - Automatically converts external or hidden `<use href="#id">` sprites used on modern websites (Twitter/X, GitHub, Stripe, Shopify) into inline vector paths so no icons are missed.

4. **🧊 WebGL & Canvas Readback Preservation:**
   - Captures charts, 3D canvases, and graphics immediately after frame draw and converts them into data URLs.

5. **🌐 Deep Shadow DOM & `<slot>` Flattening:**
   - Captures open and closed shadow roots as well as slotted elements in modern Web Components with exact parent-child hierarchy.

6. **✂️ Vector Clip-Path Masking (`clip-path`):**
   - Extracts CSS `clip-path: polygon(...)` and SVG clipPath data to convert them into Figma mask and clip frames.

7. **🌈 Native Gradients & Auto-Layout v4:**
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
5. The **Zcrap - Web to Figma (v3.3.0 Pro Layout Engine)** extension will be added to your browser!

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
