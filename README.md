# ⚡ Zcrap v3.3.0 Pro Layout Engine — Web to Figma Converter (100% Free & Unlimited)

**Zcrap** হলো একটি সম্পূর্ণ ফ্রি, ওপেন-সোর্স বিকল্প (Alternative to `html.to.design`), যা যেকোনো লাইভ ওয়েবসাইট বা ওয়েব এলিমেন্টকে হুবহু ফিগমাতে (Figma) এডিটেবল Auto-Layout লেয়ার, ফন্ট, ইমেজ, গ্রেডিয়েন্ট এবং SVG আকারে কনভার্ট করে।

`v3.3.0` আপডেটে `html.to.design` এর আর্কিটেকচার পুঙ্খানুপুঙ্খভাবে বিশ্লেষণ করে **Chrome DevTools Protocol (CDP) ব্রিজ অ্যাক্টিভেশন**, ওএস-অ্যাওয়ার প্ল্যাটফর্ম ফন্ট ডিটেকশন, নিরাপদ ক্রস-অরিজিন আইফ্রেম হ্যান্ডলিং এবং GSAP/AOS স্ক্রোল ক্লিনার সহ সব প্রফেশনাল মেকানিজম সরাসরি কার্যকর করা হয়েছে। এটি সম্পূর্ণ ক্লায়েন্ট-সাইড এবং লোকালি কাজ করে, যার ফলে কোনো ক্লাউড ক্রেডিট লিমিট বা পেইড সাবস্ক্রিপশন প্রয়োজন হয় না।

---

## 📁 প্রজেক্ট স্ট্রাকচার
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

## 🔬 v3.3.0 Pro Layout Engine এ যুক্ত হওয়া মেকানিজমসমূহ:

0. **📐 Auto-Layout Pro Default & Multi-line Text Auto-Wrapping:**
   - সরাসরি ফিগমা ক্যানভাসে পেস্ট করার সময় দীর্ঘ প্যারাগ্রাফ যেন এক লাইনে ওভারফ্লো না হয় সেজন্য SVG `<tspan>` ভিত্তিক ডাইনামিক ওয়ার্ড-র‌্যাপিং ইঞ্জিন।
   - প্লাগিনে ডিফল্টভাবে রেস্পন্সিভ Auto-Layout ইঞ্জিন সক্রিয় এবং সাধারণ HTML ব্লক কনটেইনারের জন্য উল্লম্ব স্ট্যাক ও প্যাডিং ডিটেকশন।
   - ফুল ইউনিকোড এবং ইমোজি সাপোর্টের জন্য UTF-8 সেফ মেটাডাটা এনকোডার/ডিকোডার।

1. **🛡️ Chrome DevTools Protocol (CDP) Engine:**
   - ব্রাউজারের লো-লেভেল রেন্ডারিং কার্নেলে এক্সেস নিয়ে রিয়েল সাবপিক্সেল কোঅর্ডিনেট এবং ফন্ট ডেটা সংগ্রহ করে।
   - `CSS.getPlatformFontsForNode`: ইউজারের অপারেটিং সিস্টেমে আসলে কোন ফন্টটি (PostScriptName) রেন্ডার হয়েছে তা নিখুঁতভাবে চিহ্নিত করে।

2. **⏸️ অ্যানিমেশন ও ট্রানজিশন ফ্রিজার (`__zcrap_anim_pause`):**
   - স্ক্র্যাপ চলাকালীন পুরো পেজের CSS অ্যানিমেশন এবং ট্রানজিশন সাময়িকভাবে স্থগিত (`paused !important`) করে রাখে, ফলে কোনো এলিমেন্ট স্থানচ্যুত বা ব্লার হয় না।

3. **🧩 ইনলাইন SVG Sprite & `<use>` রেজোলিউশন:**
   - আধুনিক ওয়েবসাইটে (Twitter/X, GitHub, Stripe, Shopify) ব্যবহৃত বহিরাগত বা লুকানো `<use href="#id">` স্প্রাইটগুলো স্বয়ংক্রিয়ভাবে ইনলাইন ভেক্টর পাথে রূপান্তর করে, ফলে কোনো আইকন মিস হয় না।

4. **🧊 WebGL ও ক্যানভাস রিডব্যাক প্রিজার্ভেশন:**
   - চার্ট, ৩ডি ক্যানভাস এবং গ্রাফিক্স ক্যাপচার করার জন্য ফ্রেম ড্র শেষ হওয়ার সাথে সাথেই রিডব্যাক করে ডেটা ইউআরএলে রূপান্তর করে।

5. **🌐 ডিপ শ্যাডো ডিওএম ও `<slot>` ফ্ল্যাটেনিং:**
   - আধুনিক Web Components-এর ওপেন ও ক্লোজড শ্যাডো রুট এবং স্লটেড এলিমেন্টগুলো নিখুঁত প্যারেন্ট-চাইল্ড হায়ারার্কিতে ক্যাপচার করে।

6. **✂️ ভেক্টর ক্লিপ-পাথ মাস্কিং (`clip-path`):**
   - CSS `clip-path: polygon(...)` এবং SVG ক্লিপপাথ ডেটা এক্সট্র্যাক্ট করে ফিগমার মাস্ক ও ক্লিপ ফ্রেমে রূপান্তর করে।

7. **🌈 Native Gradients & Auto-Layout v4:**
   - `linear-gradient` ও `radial-gradient` সরাসরি ফিগমার গ্রাফিকাল ট্র্যান্সফর্মেশন ম্যাট্রিক্সে রূপান্তর করে।
   - Flexbox ও CSS Grid স্বয়ংক্রিয়ভাবে ফিগমার Auto-Layout Wrap-এ কনভার্ট হয়।

---

## 🚀 সেটআপ ও ব্যবহারের নিয়ম

### ধাপ ১: Chrome Extension ইনস্টল করা
1. গুগল ক্রোম ব্রাউজার ওপেন করে ইউআরএল বারে যান: `chrome://extensions/`
2. উপরে ডান কোণে থাকা **"Developer mode"** টগলটি অন করুন।
3. বাম পাশের **"Load unpacked"** বাটনে ক্লিক করুন।
4. এই ফোল্ডারটি সিলেক্ট করুন:
   ```
   C:\Users\ASUS\Desktop\Zcrap\extension
   ```
5. আপনার ব্রাউজারে **Zcrap - Web to Figma (v3.3.0 Pro Layout Engine)** এক্সটেনশনটি যুক্ত হয়ে যাবে!

---

### ধাপ ২: Figma Plugin ইনস্টল ও রান করা
1. আপনার কম্পিউটারে **Figma Desktop App** ওপেন করে যেকোনো ফাইলে প্রবেশ করুন।
2. উপরের মেনু থেকে **Figma Menu** -> **Plugins** -> **Development** -> **Import plugin from manifest...** এ ক্লিক করুন।
3. ফাইল এক্সপ্লোরার থেকে এই ফাইলটি সিলেক্ট করুন:
   ```
   C:\Users\ASUS\Desktop\Zcrap\figma-plugin\manifest.json
   ```
4. ব্যাস! আপনার ফিগমাতে **Zcrap - HTML to Figma** প্লাগিনটি ইনস্টল হয়ে যাবে।

---

## 🎨 কীভাবে ওয়েবসাইট ফিগমাতে কপি করবেন?

### পদ্ধতি ১: Direct Paste (html.to.design এর মতো — প্লাগিন ছাড়াই সরাসরি Ctrl + V) 🚀
1. যে ওয়েবসাইটের UI কপি করতে চান সেই ট্যাবে যান।
2. এক্সটেনশন বার থেকে **Zcrap** ওপেন করে **"⚡ Capture Full Page"** (বা **Alt+Shift+E**) চাপুন। অথবা **"🎯 Capture Selection"** দিয়ে নির্দিষ্ট সেকশন সিলেক্ট করুন।
3. Figma ফাইলে যান এবং ক্যানভাসে ক্লিক করে সরাসরি **Ctrl + V** (বা Mac এ **Cmd + V**) চাপুন!
4. **বুম! কোনো প্লাগিন ওপেন করা ছাড়াই** সম্পূর্ণ ওয়েবসাইটটি এডিটেবল ভেক্টর, ফ্রেম, কালার ও টেক্সট লেয়ার আকারে আপনার ফিগমা ক্যানভাসে ড্রপ হয়ে যাবে!

### পদ্ধতি ২: Auto-Layout Pro Mode (Zcrap Figma Plugin সহ) 📐
1. আপনি যদি সম্পূর্ণ ওয়েবসাইটের রেস্পনসিভ Auto-Layout (Flexbox, Padding, Auto-width/height) চান:
2. Figma তে **Zcrap** প্লাগিনটি রান করুন এবং **"📋 Paste from Clipboard"** এ ক্লিক করুন (অথবা প্লাগিনের ভেতর **Ctrl + V** চাপুন)।
3. প্লাগিন স্বয়ংক্রিয়ভাবে ফুল Auto-Layout রেন্ডার করে দেবে।

### পদ্ধতি ২: Drag & Drop (.zcrap ফাইল)
1. এক্সটেনশন পপআপ থেকে **"🔴 Record Flow"** বাটনে ক্লিক করে `.zcrap` ফাইল ডাউনলোড করুন।
2. ফিগমা প্লাগিনের ড্রপজোনে ফাইলটি ড্র্যাগ অ্যান্ড ড্রপ করুন।
3. প্লাগিন স্বয়ংক্রিয়ভাবে সব ফ্রেম, কালার ও ফন্ট তৈরি করে দেবে।

---

## 🛠️ ডেভেলপার স্ক্রিপ্টস ও সিআই/সিডি (CI/CD)

প্রজেক্টে স্বয়ংক্রিয় কোড কোয়ালিটি ও প্যাকেজিং নিশ্চিত করার জন্য GitHub Actions CI/CD ওয়ার্কফ্লো যুক্ত রয়েছে:
* **CI Validation (`.github/workflows/ci.yml`):** প্রতিটি PR ও পুশে কোড সিনট্যাক্স, Manifest V3 ও Figma স্কিমা ভ্যালিডেশন করে টেস্ট জিপ আর্টফ্যাক্ট তৈরি করে।
* **Automated Releases (`.github/workflows/release.yml`):** নতুন গিট ট্যাগ (`v*`) পুশ করলে স্বয়ংক্রিয়ভাবে ক্লিন `zcrap-extension.zip` ও `zcrap-figma-plugin.zip` বানিয়ে GitHub Release-এ আপলোড করে।
* **CodeQL Security (`.github/workflows/codeql.yml`):** কোড সিকিউরিটি ও কোনো ভালনারেবিলিটি আছে কিনা তা স্বয়ংক্রিয়ভাবে স্ক্যান করে।

### লোকাল টেস্ট ও প্যাকেজিং কমান্ড:
```bash
# সব কোড সিনট্যাক্স ও ম্যানিফেস্ট ভ্যালিডেশন চালানো
npm test

# ডিস্ট্রিবিউশন জিপ তৈরি করা (dist/ ফোল্ডারে তৈরি হবে)
npm run build
```

---

## 💯 ১০০% ফ্রি ও আনলিমিটেড
কোনো ক্লাউড এপিআই বা পেইড ট্রায়াল নেই—যত খুশি ততবার যেকোনো ওয়েবসাইট ফিগমাতে কনভার্ট করুন!
