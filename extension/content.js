// Zcrap Content Script - High-Fidelity 1:1 Web Serializer
// AUTO-GENERATED from extension/src/ by scripts/build.js — DO NOT EDIT DIRECTLY!
(function () {
  window.__zcrap_installed = true;
  console.log('[Zcrap] High-fidelity 1:1 engine active.');

  // ==========================================================================
  // MODULE: parsers.js
  // ==========================================================================

// Zcrap - CSS & Style Parsers
  function parsePx(val) {
    if (!val) return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  }

  function parseOpacity(val) {
    if (val === undefined || val === null || val === '') return 1;
    const num = parseFloat(val);
    return isNaN(num) ? 1 : num;
  }

  // Parse CSS color into separate Hex and Opacity for SVG (fixes Figma 100% white stroke bug)
  function parseSvgColor(str) {
    if (!str || typeof str !== 'string') return null;
    const clean = str.trim().toLowerCase();
    if (clean === 'transparent' || clean === 'none' || clean === 'rgba(0, 0, 0, 0)' || clean === 'rgba(0,0,0,0)' || clean === 'rgb(0 0 0 / 0)') {
      return null;
    }

    // Hex (#rgb, #rgba, #rrggbb, #rrggbbaa)
    if (clean.startsWith('#')) {
      let hex = clean.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      if (hex.length === 4) hex = hex.split('').map(c => c + c).join('');
      let opacity = 1;
      if (hex.length === 8) {
        opacity = Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 100) / 100;
        hex = hex.slice(0, 6);
      }
      return { hex: '#' + hex, opacity };
    }

    // RGB / RGBA
    const rgbMatch = clean.match(/rgba?\(\s*([\d.]+%?)[,\s]+([\d.]+%?)[,\s]+([\d.]+%?)(?:[,\s/]+([\d.]+%?))?\s*\)/);
    if (rgbMatch) {
      const parseVal = (v) => {
        if (!v) return 0;
        if (v.endsWith('%')) return Math.round((parseFloat(v) / 100) * 255);
        return Math.round(parseFloat(v));
      };
      const r = parseVal(rgbMatch[1]);
      const g = parseVal(rgbMatch[2]);
      const b = parseVal(rgbMatch[3]);
      let opacity = 1;
      if (rgbMatch[4] !== undefined) {
        if (rgbMatch[4].endsWith('%')) opacity = parseFloat(rgbMatch[4]) / 100;
        else opacity = parseFloat(rgbMatch[4]);
      }
      opacity = Math.round(opacity * 1000) / 1000;
      if (opacity <= 0.001) return null;

      const toHex = (n) => {
        const h = Math.max(0, Math.min(255, n)).toString(16);
        return h.length === 1 ? '0' + h : h;
      };
      return { hex: '#' + toHex(r) + toHex(g) + toHex(b), opacity };
    }

    return { hex: str, opacity: 1 };
  }

  // Parse CSS RGBA/RGB/Hex color
  function parseCssColor(str) {
    if (!str || typeof str !== 'string') return null;
    const clean = str.trim().toLowerCase();
    if (clean === 'transparent' || clean === 'none' || clean === 'rgba(0, 0, 0, 0)' || clean === 'rgba(0,0,0,0)' || clean === 'rgb(0 0 0 / 0)') {
      return null;
    }
    return str;
  }

  // --- 0. OS-Aware Platform Font Normalizer ---
  function resolvePlatformFontFamily(rawFamily) {
    if (!rawFamily || typeof rawFamily !== 'string') return 'Inter';
    const families = rawFamily.split(',').map(f => f.replace(/['"]/g, '').trim()).filter(Boolean);
    const isWindows = /windows/i.test(navigator.userAgent);
    const isMac = /macintosh|mac os x/i.test(navigator.userAgent);

    let candidate = null;
    for (const fam of families) {
      const lower = fam.toLowerCase();
      // Skip generic CSS keywords
      if (['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'inherit', 'initial', 'unset'].includes(lower)) {
        continue;
      }
      // Map system font aliases to actual OS rendered fonts
      if (lower === '-apple-system' || lower === 'blinkmacsystemfont') {
        if (isMac) return 'Inter';
        if (isWindows) return 'Segoe UI';
        return 'Roboto';
      }
      if (!candidate) candidate = fam;
      // Check if browser has access to this font face
      try {
        if (document.fonts && typeof document.fonts.check === 'function' && document.fonts.check(`12px "${fam}"`)) {
          return fam;
        }
      } catch {}
    }
    if (candidate) return candidate;
    return isWindows ? 'Segoe UI' : (isMac ? 'Inter' : 'Roboto');
  }

  // --- 1. Animation Freezing Engine (html.to.design CDP style) ---
  function pauseAnimations() {
    let style = document.getElementById('__zcrap_anim_pause');
    if (!style) {
      style = document.createElement('style');
      style.id = '__zcrap_anim_pause';
      style.textContent = `
        *, *::before, *::after {
          animation-play-state: paused !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }
    return () => {
      const el = document.getElementById('__zcrap_anim_pause');
      if (el) el.remove();
    };
  }

  // --- 2. Inline SVG <use> Symbols & Sprites Resolution ---
  function inlineSvgUseReferences(svgClone) {
    try {
      const useElements = Array.from(svgClone.querySelectorAll('use'));
      for (const use of useElements) {
        const href = use.getAttribute('href') || use.getAttribute('xlink:href');
        if (!href || !href.startsWith('#')) continue;
        const targetId = href.slice(1);
        const targetEl = document.getElementById(targetId);
        if (!targetEl) continue;

        if (targetEl.tagName.toLowerCase() === 'symbol') {
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          for (const child of targetEl.childNodes) {
            g.appendChild(child.cloneNode(true));
          }
          const symVb = targetEl.getAttribute('viewBox');
          if (symVb) {
            svgClone.setAttribute('viewBox', symVb);
          }
          use.replaceWith(g);
        } else {
          use.replaceWith(targetEl.cloneNode(true));
        }
      }
    } catch (e) {
      console.warn('[Zcrap] SVG use inline notice:', e);
    }
  }

  // --- 3. WebGL and Canvas Readback Handler ---
  function captureCanvasWithWebGL(canvasEl) {
    try {
      return canvasEl.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  // --- 4. CSS Clip Path Parser ---
  function parseClipPath(style, el) {
    const cp = style.clipPath || style.webkitClipPath;
    if (!cp || cp === 'none') return null;
    const urlMatch = cp.match(/url\(["']?#([^"')]+)["']?\)/);
    if (urlMatch) {
      const clipId = urlMatch[1];
      const clipEl = document.getElementById(clipId);
      if (clipEl) {
        const path = clipEl.querySelector('path');
        if (path && path.getAttribute('d')) {
          return { type: 'path', d: path.getAttribute('d') };
        }
      }
    }
    if (cp.startsWith('polygon(') || cp.startsWith('circle(') || cp.startsWith('inset(')) {
      return { type: 'shape', value: cp };
    }
    return null;
  }

  // --- 5. Deep Shadow Root Access (Open & Closed) ---
  function getShadowRootSafe(el) {
    if (!el) return null;
    try {
      if (typeof window.chrome?.dom?.openOrClosedShadowRoot === 'function') {
        const root = window.chrome.dom.openOrClosedShadowRoot(el);
        if (root) return root;
      }
    } catch {}
    return el.shadowRoot || null;
  }

  // Fast canvas image capture (for rendered images on page)
  function captureRenderedImage(imgEl) {
    try {
      if (imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
        const scale = Math.min(1, 1920 / imgEl.naturalWidth, 1920 / imgEl.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(imgEl.naturalWidth * scale);
        canvas.height = Math.round(imgEl.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png');
      }
    } catch {}
    return imgEl.currentSrc || imgEl.src || null;
  }

  // Parse CSS Box Shadows
  function parseBoxShadow(shadowStr) {
    if (!shadowStr || shadowStr === 'none') return null;
    // Matches: rgba(...) x y blur spread [inset] or #hex / rgb(...)
    const shadows = [];
    const parts = shadowStr.split(/,(?![^(]*\))/);
    for (const part of parts) {
      const isInset = part.includes('inset');
      const clean = part.replace('inset', '').trim();
      const colorMatch = clean.match(/(rgba?\([^)]+\)|#[a-fA-F0-9]{3,8}|(?!none\b|inset\b)[a-zA-Z]{3,})/);
      const color = colorMatch ? colorMatch[1] : 'rgba(0,0,0,0.2)';
      const lengths = clean.replace(color, '').trim().split(/\s+/).map(parsePx);
      if (lengths.length >= 2) {
        shadows.push({
          color,
          x: lengths[0] || 0,
          y: lengths[1] || 0,
          blur: lengths[2] || 0,
          spread: lengths[3] || 0,
          isInset
        });
      }
    }
    return shadows.length ? shadows : null;
  }

  // Parse CSS linear & radial gradients into Figma-compatible gradient descriptors
  function parseGradient(str) {
    if (!str || !str.includes('-gradient(')) return null;
    try {
      const gradStart = str.search(/(?:repeating-)?(?:linear|radial)-gradient\(/);
      if (gradStart === -1) return null;
      const sub = str.slice(gradStart);
      const isLinear = sub.startsWith('linear-gradient(') || sub.startsWith('repeating-linear-gradient(');
      const isRadial = sub.startsWith('radial-gradient(') || sub.startsWith('repeating-radial-gradient(');
      if (!isLinear && !isRadial) return null;

      const type = isLinear ? 'linear' : 'radial';
      const openParenIdx = sub.indexOf('(');
      let depth = 1;
      let inner = '';
      for (let i = openParenIdx + 1; i < sub.length; i++) {
        const c = sub[i];
        if (c === '(') depth++;
        else if (c === ')') {
          depth--;
          if (depth === 0) break;
        }
        inner += c;
      }
      inner = inner.trim();
      if (!inner) return null;

      // Split arguments respecting inner commas
      const args = [];
      depth = 0;
      let current = '';
      for (let i = 0; i < inner.length; i++) {
        const c = inner[i];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        if (c === ',' && depth === 0) {
          args.push(current.trim());
          current = '';
        } else {
          current += c;
        }
      }
      if (current.trim()) args.push(current.trim());
      if (args.length < 2) return null;

      let angleDeg = 180; // default to bottom in CSS
      let stopStartIndex = 0;

      if (type === 'linear') {
        const firstArg = args[0].toLowerCase();
        if (firstArg.includes('deg')) {
          angleDeg = parseFloat(firstArg) || 180;
          stopStartIndex = 1;
        } else if (firstArg.startsWith('to ')) {
          if (firstArg.includes('top') && firstArg.includes('right')) angleDeg = 45;
          else if (firstArg.includes('bottom') && firstArg.includes('right')) angleDeg = 135;
          else if (firstArg.includes('bottom') && firstArg.includes('left')) angleDeg = 225;
          else if (firstArg.includes('top') && firstArg.includes('left')) angleDeg = 315;
          else if (firstArg.includes('top')) angleDeg = 0;
          else if (firstArg.includes('right')) angleDeg = 90;
          else if (firstArg.includes('bottom')) angleDeg = 180;
          else if (firstArg.includes('left')) angleDeg = 270;
          stopStartIndex = 1;
        }
      } else {
        const firstArg = args[0].toLowerCase();
        const isShapeOrPosition = firstArg.includes('circle') || firstArg.includes('ellipse') || firstArg.includes(' at ') || firstArg.startsWith('at ');
        if (isShapeOrPosition) {
          stopStartIndex = 1;
        } else {
          stopStartIndex = 0;
        }
      }

      const stopsRaw = args.slice(stopStartIndex);
      if (stopsRaw.length === 0) return null;

      const stops = [];
      for (let i = 0; i < stopsRaw.length; i++) {
        const part = stopsRaw[i].trim();
        const colorMatch = part.match(/(rgba?\([^)]+\)|#[a-fA-F0-9]{3,8}|(?!none\b)[a-zA-Z]{3,})/);
        if (!colorMatch) continue;
        const colorStr = colorMatch[1];
        const rest = part.replace(colorStr, '').trim();
        let pos = null;
        if (rest) {
          const num = parseFloat(rest);
          if (!isNaN(num)) {
            pos = rest.includes('%') ? num / 100 : num;
          }
        }
        if (pos === null) {
          pos = i / Math.max(1, stopsRaw.length - 1);
        }
        stops.push({ color: colorStr, position: Math.min(1, Math.max(0, pos)) });
      }

      if (stops.length < 2) return null;
      return {
        type: type === 'linear' ? 'GRADIENT_LINEAR' : 'GRADIENT_RADIAL',
        angle: angleDeg,
        stops
      };
    } catch {
      return null;
    }
  }

  // Parse CSS backdrop-filter and filter for blur (Glassmorphism)
  function parseBlur(style) {
    const effects = [];
    const backdrop = style.backdropFilter || style.webkitBackdropFilter;
    if (backdrop && backdrop !== 'none') {
      const match = backdrop.match(/blur\(([\d.]+)px\)/);
      if (match && parseFloat(match[1]) > 0) {
        effects.push({
          type: 'BACKGROUND_BLUR',
          radius: parseFloat(match[1])
        });
      }
    }
    const filter = style.filter || style.webkitFilter;
    if (filter && filter !== 'none') {
      const match = filter.match(/blur\(([\d.]+)px\)/);
      if (match && parseFloat(match[1]) > 0) {
        effects.push({
          type: 'LAYER_BLUR',
          radius: parseFloat(match[1])
        });
      }
    }
    return effects.length ? effects : null;
  }

  // Parse CSS transform rotation (in degrees)
  function parseTransform(transformStr) {
    if (!transformStr || transformStr === 'none') return null;
    try {
      const rotMatch = transformStr.match(/rotate\(([-\d.]+)deg\)/);
      if (rotMatch) return parseFloat(rotMatch[1]);
      const matrixMatch = transformStr.match(/matrix\(([^)]+)\)/);
      if (matrixMatch) {
        const parts = matrixMatch[1].split(',').map(parseFloat);
        if (parts.length >= 4) {
          const a = parts[0];
          const b = parts[1];
          const rad = Math.atan2(b, a);
          const deg = Math.round(rad * (180 / Math.PI));
          if (deg !== 0) return deg;
        }
      }
    } catch {}
    return null;
  }

  // Extract CSS Pseudo-elements (::before / ::after) as virtual layers
  function extractPseudo(el, pseudoName, parentRect) {
    try {
      const pStyle = window.getComputedStyle(el, pseudoName);
      if (!pStyle || pStyle.display === 'none' || pStyle.visibility === 'hidden' || parseFloat(pStyle.opacity) === 0) {
        return null;
      }
      const content = pStyle.content;
      const width = parsePx(pStyle.width);
      const height = parsePx(pStyle.height);
      const bg = parseCssColor(pStyle.backgroundColor);
      const bgImg = pStyle.backgroundImage && pStyle.backgroundImage !== 'none' ? pStyle.backgroundImage : null;

      if ((!content || content === 'none' || content === 'normal' || content === '""') && width === 0 && height === 0 && !bg && !bgImg) {
        return null;
      }

      let textContent = '';
      if (content && content !== 'none' && content !== 'normal' && content !== '""') {
        textContent = content.replace(/^['"]|['"]$/g, '');
        textContent = textContent.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      }

      const isAbsolute = pStyle.position === 'absolute' || pStyle.position === 'fixed';
      let posX = 0;
      let posY = 0;
      if (isAbsolute && parentRect) {
        if (pStyle.left && pStyle.left !== 'auto') {
          posX = parsePx(pStyle.left);
        } else if (pStyle.right && pStyle.right !== 'auto') {
          posX = Math.max(0, Math.round(parentRect.width - width - parsePx(pStyle.right)));
        }
        if (pStyle.top && pStyle.top !== 'auto') {
          posY = parsePx(pStyle.top);
        } else if (pStyle.bottom && pStyle.bottom !== 'auto') {
          posY = Math.max(0, Math.round(parentRect.height - height - parsePx(pStyle.bottom)));
        }
      }

      const labelPrefix = pseudoName === '::before' ? 'Before' : 'After';

      // 1. If it has text content (e.g. FontAwesome icon, bullet, badge text)
      if (textContent.trim()) {
        const fontSize = parsePx(pStyle.fontSize) || 14;
        return {
          type: 'text',
          name: `${labelPrefix}: ${truncate(textContent.trim(), 16)}`,
          bounds: { x: posX, y: posY, width: Math.max(width, Math.round(fontSize * textContent.length * 0.8)), height: Math.max(height, Math.round(fontSize * 1.2)) },
          isAbsolute,
          text: textContent.trim(),
          style: {
            color: pStyle.color,
            fontFamily: resolvePlatformFontFamily(pStyle.fontFamily),
            fontSize,
            fontWeight: pStyle.fontWeight || '400',
            fontStyle: pStyle.fontStyle || 'normal',
            lineHeight: pStyle.lineHeight === 'normal' ? null : parsePx(pStyle.lineHeight),
            textAlign: pStyle.textAlign || 'left',
            letterSpacing: parsePx(pStyle.letterSpacing),
            textTransform: pStyle.textTransform,
            textDecoration: pStyle.textDecorationLine || pStyle.textDecoration
          },
          opacity: parseOpacity(pStyle.opacity)
        };
      }

      // 2. If it is a visible shape / pill / dot / divider / overlay
      if (width > 0 || height > 0 || bg || bgImg) {
        // Skip decorative blur/glow pseudo-elements without text/icons
        // (In SVG vector output, CSS GPU blurs degrade into hideous solid squashed ovals that obscure buttons!)
        const filterStr = pStyle.filter || pStyle.webkitFilter || '';
        const isBlurGlow = filterStr.includes('blur(') || (bgImg && bgImg.includes('radial-gradient') && isAbsolute && parentRect && (width >= parentRect.width * 0.7));
        if (isBlurGlow) {
          return null;
        }

        let grad = null;
        let bgUrl = null;
        if (bgImg) {
          if (bgImg.includes('gradient(')) grad = parseGradient(bgImg);
          else {
            const m = bgImg.match(/url\(["']?([^"')]+)["']?\)/);
            if (m) bgUrl = m[1];
          }
        }

        return {
          type: 'frame',
          name: `${labelPrefix}: Shape`,
          bounds: { x: posX, y: posY, width: Math.max(width, 4), height: Math.max(height, 4) },
          isAbsolute,
          backgroundColor: bg,
          backgroundImage: bgUrl,
          gradient: grad,
          borderRadius: {
            topLeft: parsePx(pStyle.borderTopLeftRadius),
            topRight: parsePx(pStyle.borderTopRightRadius),
            bottomRight: parsePx(pStyle.borderBottomRightRadius),
            bottomLeft: parsePx(pStyle.borderBottomLeftRadius)
          },
          opacity: parseOpacity(pStyle.opacity)
        };
      }
    } catch {}
    return null;
  }

  // ==========================================================================
  // MODULE: naming.js
  // ==========================================================================

// Zcrap - Semantic Layer Naming Engine
  // --- Smart Semantic Layer Naming Engine (html.to.design style) ---
  const UTILITY_CLASS_REGEX = /^(flex|grid|block|inline|hidden|items-|justify-|content-|self-|gap-|space-|p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|w-|h-|min-w-|max-w-|min-h-|max-h-|bg-|text-|font-|leading-|tracking-|border|rounded|shadow|opacity-|transition-|duration-|ease-|delay-|animate-|overflow-|z-|cursor-|select-|top-|bottom-|left-|right-|inset-|relative|absolute|fixed|sticky|row|col|container|mx-auto|col-|row-|hover:|focus:|active:|disabled:|group-|dark:|sm:|md:|lg:|xl:|2xl:|css-|sc-|jsx-|_)/i;

  function toTitleCase(str) {
    if (!str) return '';
    return str
      .replace(/[-_]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  function getCleanSemanticClass(el) {
    if (!el) return null;
    const rawClass = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
    if (!rawClass || typeof rawClass !== 'string') return null;
    const classes = rawClass.trim().split(/\s+/);
    for (const cls of classes) {
      if (!cls || cls.length < 2) continue;
      if (UTILITY_CLASS_REGEX.test(cls)) continue;
      if (/^[a-z0-9_-]{12,}$/i.test(cls) || /^[a-z0-9]{7,}$/i.test(cls)) continue;
      return toTitleCase(cls);
    }
    return null;
  }

  function getDirectTextContent(el) {
    if (!el) return '';
    let text = '';
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += ' ' + (child.textContent || '');
      }
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  function truncate(str, max = 28) {
    if (!str) return '';
    const clean = str.replace(/\s+/g, ' ').trim();
    return clean.length > max ? clean.slice(0, max).trim() + '…' : clean;
  }

  function computeSmartName(el, tagName, style, directText = '') {
    // 0. Explicit Framework Component Names (Framer, React, Webflow, C2D)
    const framerName = el.getAttribute('data-framer-name') || el.getAttribute('data-c2d-cmp-name') || el.getAttribute('data-component') || el.getAttribute('data-component-name') || el.getAttribute('data-slot');
    if (framerName && framerName.trim()) {
      return toTitleCase(framerName.trim());
    }
    const testId = el.getAttribute('data-testid');
    if (testId && !/^[0-9]+$/.test(testId)) {
      return toTitleCase(testId.replace(/[-_](container|wrapper|root|box)$/i, ''));
    }

    const semanticClass = getCleanSemanticClass(el);
    const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title');
    const ariaHasPopup = el.getAttribute('aria-haspopup');
    const textSnippet = directText || truncate(getDirectTextContent(el), 24);
    const id = el.id && !el.id.startsWith('__') ? toTitleCase(el.id) : null;
    const role = el.getAttribute('role');

    // 1. Buttons & Links (Full ARIA & html.to.design naming alignment)
    if (tagName === 'button' || role === 'button') {
      if (ariaHasPopup === 'listbox' || role === 'combobox') {
        return 'Button listbox';
      }
      if (ariaHasPopup === 'menu' || role === 'menu') {
        return 'Button menu';
      }
      if (el.getAttribute('data-slot') === 'accordion-trigger' || el.getAttribute('aria-expanded') !== null) {
        return textSnippet ? `Accordion: ${textSnippet}` : 'Accordion Trigger';
      }
      if (ariaLabel && ariaLabel.trim().length > 0) {
        return `Button - ${truncate(ariaLabel.trim(), 30)}`;
      }
      const label = textSnippet || semanticClass || id;
      return label ? `Button: ${label}` : 'Button';
    }

    if (tagName === 'a') {
      if (ariaLabel && ariaLabel.trim().length > 0) {
        return `Link - ${truncate(ariaLabel.trim(), 30)}`;
      }
      const label = textSnippet || semanticClass || id;
      return label ? `Link: ${label}` : 'Link';
    }

    // 2. Semantic Roles & Landmarks
    if (role === 'navigation' || tagName === 'nav') {
      const hasOl = el.querySelector && el.querySelector('ol');
      const hasUl = el.querySelector && el.querySelector('ul');
      if (hasOl) return 'Nav → Ordered List';
      if (hasUl) return 'Nav → List';
      return semanticClass || id || 'Nav';
    }
    if (role === 'banner' || tagName === 'header') {
      return semanticClass || id || 'Header';
    }
    if (role === 'contentinfo' || tagName === 'footer') {
      return semanticClass || id || 'Footer';
    }
    if (role === 'main' || tagName === 'main') {
      return semanticClass || id || 'Main';
    }
    if (role === 'dialog' || tagName === 'dialog') {
      return semanticClass || id || 'Modal Dialog';
    }

    // 3. Other elements with explicit ARIA label
    if (ariaLabel && ariaLabel.trim().length > 0) {
      return truncate(ariaLabel.trim(), 30);
    }

    // 4. Headings
    if (/^h[1-6]$/.test(tagName)) {
      const level = tagName.charAt(1);
      return textSnippet ? `Heading ${level}: ${textSnippet}` : `Heading ${level}`;
    }

    // 5. Paragraphs & Small text
    if (tagName === 'small') {
      return 'Small';
    }
    if (tagName === 'p') {
      return textSnippet ? `Paragraph: ${textSnippet}` : 'Paragraph';
    }

    // 6. Form Elements
    if (tagName === 'input') {
      const placeholder = el.getAttribute('placeholder');
      const type = el.getAttribute('type') || 'text';
      if (placeholder) return `Input: ${truncate(placeholder, 18)}`;
      return `Input (${toTitleCase(type)})`;
    }
    if (tagName === 'select') return 'Dropdown';
    if (tagName === 'textarea') return 'Text Area';
    if (tagName === 'form') return semanticClass || id || 'Form';

    // 7. Lists
    if (tagName === 'ol') {
      return semanticClass || id || 'Ordered List';
    }
    if (tagName === 'ul') {
      return semanticClass || id || 'List';
    }
    if (tagName === 'li') {
      return textSnippet ? `Item: ${textSnippet}` : (semanticClass || 'List Item');
    }

    // 8. Sections & Articles
    if (tagName === 'section') {
      return id ? `Section: ${id}` : (semanticClass ? `Section: ${semanticClass}` : 'Section');
    }
    if (tagName === 'article') {
      return id || semanticClass || 'Article';
    }
    if (tagName === 'aside') {
      return id || semanticClass || 'Sidebar';
    }

    // 9. Semantic Class or ID on Div/Span
    if (semanticClass) return semanticClass;
    if (id) return id;

    // Give otherwise anonymous wrappers a useful layer name from their
    // direct content without searching the full descendant tree repeatedly.
    if (tagName === 'div' || tagName === 'section') {
      const directHeading = Array.from(el.children).find(child => /^h[1-6]$/.test(child.tagName.toLowerCase()));
      const headingText = directHeading ? truncate(getDirectTextContent(directHeading), 36) : '';
      const hasCardStyling = parsePx(style.borderTopLeftRadius) > 0 ||
        (style.boxShadow && style.boxShadow !== 'none') ||
        parsePx(style.borderTopWidth) > 0;
      const mediaCount = el.querySelectorAll(':scope > img, :scope > picture, :scope > video, :scope > canvas').length;

      if (hasCardStyling && headingText) return `Card: ${headingText}`;
      if (headingText) return `Section: ${headingText}`;
      if (mediaCount > 1) return 'Media Gallery';
    }

    // 10. Layout Type Fallback
    if (style.display === 'flex' || style.display === 'inline-flex') {
      return style.flexDirection === 'column' ? 'Column' : 'Row';
    }
    if (style.display === 'grid' || style.display === 'inline-grid') {
      return 'Grid';
    }

    return 'Container';
  }

  // Check if an element is purely an inline text container (no blocks, no media, no visual box children)
  function isInlineFormattingContext(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const tagName = el.tagName.toLowerCase();
    if (['svg', 'img', 'video', 'canvas', 'iframe', 'input', 'textarea', 'select', 'button', 'hr', 'table'].includes(tagName)) {
      return false;
    }

    const text = el.textContent || '';
    if (text.trim().length === 0) return false;

    // Must NOT contain media or embed elements
    if (el.querySelector('svg, img, video, canvas, iframe, input, textarea, select, button, hr, table')) {
      return false;
    }

    // Must NOT have pseudo elements that generate visual boxes or images
    try {
      const bStyle = window.getComputedStyle(el, '::before');
      if (bStyle && bStyle.content && bStyle.content !== 'none' && bStyle.content !== 'normal' && bStyle.content !== '""') {
        return false;
      }
      const aStyle = window.getComputedStyle(el, '::after');
      if (aStyle && aStyle.content && aStyle.content !== 'none' && aStyle.content !== 'normal' && aStyle.content !== '""') {
        return false;
      }
    } catch {}

    // Check all child elements: none of them should have their own visual box or block/flex/grid layout
    const descendants = el.getElementsByTagName('*');
    for (let i = 0; i < descendants.length; i++) {
      const d = descendants[i];
      const dStyle = window.getComputedStyle(d);

      if (dStyle.display === 'block' || dStyle.display === 'flex' || dStyle.display === 'grid' || dStyle.display === 'inline-flex' || dStyle.display === 'inline-grid') {
        return false;
      }
      if (dStyle.position === 'absolute' || dStyle.position === 'fixed') {
        return false;
      }

      // If any child has background, border, or shadow, it has its own visual box!
      if (
        (dStyle.backgroundColor && dStyle.backgroundColor !== 'transparent' && dStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && dStyle.backgroundColor !== 'rgb(0 0 0 / 0)') ||
        (dStyle.backgroundImage && dStyle.backgroundImage !== 'none') ||
        parseFloat(dStyle.borderTopWidth) > 0 ||
        parseFloat(dStyle.borderRightWidth) > 0 ||
        parseFloat(dStyle.borderBottomWidth) > 0 ||
        parseFloat(dStyle.borderLeftWidth) > 0 ||
        (dStyle.boxShadow && dStyle.boxShadow !== 'none')
      ) {
        return false;
      }
    }

    return true;
  }

  // Extract clean rendered text and styled ranges from an inline formatting context
  function extractInlineTextInfo(el) {
    const rawText = (el.innerText || el.textContent || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
    const defaultStyle = window.getComputedStyle(el);
    const ranges = [];

    // Find links or child spans with different colors or font weights
    const children = el.querySelectorAll('*');
    let searchOffset = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const cText = (child.innerText || child.textContent || '').trim();
      if (!cText || !rawText.includes(cText)) continue;

      const cStyle = window.getComputedStyle(child);
      const isDiffColor = cStyle.color && cStyle.color !== defaultStyle.color;
      const isDiffWeight = cStyle.fontWeight && cStyle.fontWeight !== defaultStyle.fontWeight;
      const linkEl = child.tagName.toLowerCase() === 'a' ? child : child.closest('a');
      const href = linkEl ? (linkEl.href || linkEl.getAttribute('href')) : null;

      if (isDiffColor || isDiffWeight || href) {
        let start = rawText.indexOf(cText, searchOffset);
        if (start === -1) {
          start = rawText.indexOf(cText);
        }
        if (start !== -1) {
          const end = start + cText.length;
          searchOffset = end;
          ranges.push({
            start,
            end,
            color: isDiffColor ? cStyle.color : null,
            fontWeight: isDiffWeight ? cStyle.fontWeight : null,
            fontFamily: cStyle.fontFamily ? resolvePlatformFontFamily(cStyle.fontFamily) : null,
            fontStyle: cStyle.fontStyle || null,
            href
          });
        }
      }
    }

    return { text: rawText, ranges };
  }

  // Read the browser's actual line layout for plain and richly styled inline
  // text. Character-count estimates drift from CSS wrapping as font metrics vary.
  function getRenderedTextLines(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const lines = [];
    let currentLine = '';
    let lineTop = null;
    let textNode;

    while ((textNode = walker.nextNode())) {
      const value = textNode.textContent || '';
      const words = /\S+/g;
      let match;
      while ((match = words.exec(value))) {
        const range = document.createRange();
        range.setStart(textNode, match.index);
        range.setEnd(textNode, match.index + match[0].length);
        const rect = range.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;

        if (lineTop !== null && Math.abs(rect.top - lineTop) > 3) {
          if (currentLine) lines.push(currentLine);
          currentLine = '';
        }
        if (lineTop === null || !currentLine) lineTop = rect.top;
        currentLine += (currentLine ? ' ' : '') + match[0];
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // ==========================================================================
  // MODULE: dom-serializer.js
  // ==========================================================================

// Zcrap - DOM Traversal & Node Serializer
  // Main Recursive Serializer with RELATIVE PARENT BOUNDS
  function serializeNode(el, parentRect, depth = 0) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
    if (depth > 60) return null;

    const tagName = el.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'meta', 'link', 'template'].includes(tagName)) {
      return null;
    }

    // Exclude Zcrap UI elements
    if (el.id && el.id.startsWith('__zcrap')) {
      return null;
    }

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || parseFloat(style.opacity) === 0) {
      return null;
    }
    if (style.visibility === 'hidden') {
      let hasVisibleChild = false;
      const allDescendants = el.querySelectorAll('*');
      for (let i = 0; i < Math.min(allDescendants.length, 25); i++) {
        if (window.getComputedStyle(allDescendants[i]).visibility === 'visible') {
          hasVisibleChild = true;
          break;
        }
      }
      if (!hasVisibleChild) return null;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0 && el.children.length === 0) {
      return null;
    }

    // Skip collapsed/hidden accordions, drawers, and menus (e.g. data-state="closed" or height: 0 with overflow: hidden)
    const isCollapsedWithClip = (rect.height <= 0 || rect.width <= 0) &&
      (style.overflow === 'hidden' || style.overflow === 'clip' || style.overflowX === 'hidden' || style.overflowY === 'hidden');
    if (isCollapsedWithClip) {
      return null;
    }
    if (el.getAttribute('data-state') === 'closed' && (rect.height <= 0 || style.display === 'none')) {
      return null;
    }
    if (el.hasAttribute('hidden') && rect.height <= 0) {
      return null;
    }

    // RELATIVE POSITION TO DIRECT PARENT (Prevents cumulative double-offsetting!)
    // Keep CSS sub-pixel geometry. Rounding each DOM edge independently adds
    // cumulative drift in long pages and flex/grid rows.
    const relX = Math.round((rect.left - parentRect.left) * 1000) / 1000;
    const relY = Math.round((rect.top - parentRect.top) * 1000) / 1000;
    const width = Math.max(1, Math.round(rect.width * 1000) / 1000);
    const height = Math.max(1, Math.round(rect.height * 1000) / 1000);

    const bounds = { x: relX, y: relY, width, height };
    const isAbsolute = style.position === 'absolute' || style.position === 'fixed';

    // Interactive Hyperlink Detection (<a> tags or parent link)
    const linkEl = el.tagName.toLowerCase() === 'a' ? el : el.closest('a');
    const href = linkEl ? (linkEl.href || linkEl.getAttribute('href')) : null;

    // Flex Child Sizing & Alignment Data (for Figma Auto-Layout Hug / Fill)
    const flexGrow = parseFloat(style.flexGrow) || 0;
    const flexShrink = parseFloat(style.flexShrink) || 1;
    const alignSelf = style.alignSelf;
    const isFullWidth = style.width === '100%' || style.width === '100vw';
    const isFullHeight = style.height === '100%' || style.height === '100vh';
    const flexChild = {
      grow: flexGrow,
      shrink: flexShrink,
      alignSelf: alignSelf === 'auto' ? null : alignSelf,
      isFullWidth,
      isFullHeight
    };

    // 0. Same-Origin & Cross-Origin Iframe Serialization
    if (tagName === 'iframe') {
      let isCrossOrigin = false;
      try {
        const doc = el.contentDocument;
        if (doc && doc.body) {
          const iframeRoot = serializeNode(doc.body, rect, depth + 1);
          if (iframeRoot) {
            iframeRoot.name = `IFrame: ${el.title || el.name || 'Embedded Page'}`;
            iframeRoot.bounds = bounds;
            iframeRoot.isAbsolute = isAbsolute;
            iframeRoot.flexChild = flexChild;
            if (href) iframeRoot.href = href;
            return iframeRoot;
          }
        } else {
          isCrossOrigin = true;
        }
      } catch (err) {
        isCrossOrigin = true;
      }

      if (isCrossOrigin && bounds.width > 15 && bounds.height > 15) {
        const frameTitle = el.title || el.name || el.getAttribute('aria-label') || 'Embedded Frame';
        return {
          type: 'frame',
          name: `[IFrame: ${truncate(frameTitle, 24)}]`,
          bounds,
          isAbsolute,
          flexChild,
          style: {
            backgroundColor: '#F8FAFC',
            borderRadius: parsePx(style.borderRadius) || 4,
            border: '1px solid #CBD5E1'
          },
          fills: [{ type: 'SOLID', color: '#F8FAFC', opacity: 1 }],
          strokes: [{ color: '#CBD5E1', width: 1 }],
          children: [{
            type: 'text',
            name: 'IFrame Notice',
            bounds: { x: 8, y: Math.max(8, Math.round(bounds.height / 2 - 10)), width: Math.max(20, bounds.width - 16), height: 20 },
            isAbsolute: false,
            text: `🔒 [IFrame]: ${truncate(frameTitle, 30)}`,
            isSingleLine: true,
            style: {
              color: '#64748B',
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: '500',
              textAlign: 'center'
            },
            opacity: 1
          }]
        };
      }
    }

    // 1. Handle SVG Elements (Smart Icon Naming, Inlined <use> & Precise ViewBox Capture)
    if (tagName === 'svg') {
      try {
        const svgClone = el.cloneNode(true);
        if (!svgClone.getAttribute('xmlns')) {
          svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        // Resolve sprite sheet <use href="#id"> symbols
        inlineSvgUseReferences(svgClone);

        // Extract precise viewBox from DOM element or clone
        let vbData = null;
        const vbAttr = svgClone.getAttribute('viewBox') || el.getAttribute('viewBox');
        if (vbAttr) {
          const parts = vbAttr.trim().split(/[\s,]+/).map(parseFloat);
          if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            vbData = { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
          }
        } else if (el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal.width > 0) {
          vbData = {
            minX: el.viewBox.baseVal.x || 0,
            minY: el.viewBox.baseVal.y || 0,
            width: el.viewBox.baseVal.width,
            height: el.viewBox.baseVal.height
          };
        } else {
          const wAttr = parseFloat(el.getAttribute('width'));
          const hAttr = parseFloat(el.getAttribute('height'));
          if (!isNaN(wAttr) && !isNaN(hAttr) && wAttr > 0 && hAttr > 0) {
            vbData = { minX: 0, minY: 0, width: wAttr, height: hAttr };
          } else {
            vbData = { minX: 0, minY: 0, width: bounds.width, height: bounds.height };
          }
        }

        // Ensure clone has explicit viewBox and bounding dimensions
        if (vbData) {
          svgClone.setAttribute('viewBox', `${vbData.minX} ${vbData.minY} ${vbData.width} ${vbData.height}`);
          svgClone.setAttribute('width', bounds.width);
          svgClone.setAttribute('height', bounds.height);
        }

        let iconName = el.getAttribute('aria-label') || el.querySelector('title')?.textContent;
        if (!iconName) {
          const parentAria = el.parentElement?.getAttribute('aria-label');
          if (parentAria) iconName = parentAria;
        }
        if (!iconName) {
          const semClass = getCleanSemanticClass(el) || getCleanSemanticClass(el.parentElement);
          if (semClass) iconName = semClass.replace(/icon/i, '').trim();
        }
        const svgName = iconName ? `Icon: ${toTitleCase(iconName)}` : 'Icon';
        let svgString = new XMLSerializer().serializeToString(svgClone);
        // Resolve currentColor to computed CSS color
        if (style.color) {
          svgString = svgString.replace(/currentColor/gi, style.color);
        }

        return {
          type: 'svg',
          name: svgName,
          bounds,
          isAbsolute,
          flexChild,
          href,
          clipPath: parseClipPath(style, el),
          rotation: parseTransform(style.transform),
          svg: svgString,
          viewBox: vbData,
          opacity: parseOpacity(style.opacity)
        };
      } catch (e) {
        console.warn('SVG error', e);
      }
    }

    // 1.5 Handle Canvas Elements (e.g. Charts, Visualizations, WebGL)
    if (tagName === 'canvas') {
      try {
        const dataUri = captureCanvasWithWebGL(el) || el.toDataURL('image/png');
        return {
          type: 'image',
          name: 'Canvas: Visualization',
          bounds,
          isAbsolute,
          flexChild,
          href,
          clipPath: parseClipPath(style, el),
          rotation: parseTransform(style.transform),
          src: dataUri,
          borderRadius: {
            topLeft: parsePx(style.borderTopLeftRadius),
            topRight: parsePx(style.borderTopRightRadius),
            bottomRight: parsePx(style.borderBottomRightRadius),
            bottomLeft: parsePx(style.borderBottomLeftRadius)
          },
          opacity: parseOpacity(style.opacity)
        };
      } catch (e) {
        console.warn('Canvas export error', e);
      }
    }

    // 1.6 Handle Video Elements (Snapshot or Poster)
    if (tagName === 'video') {
      try {
        let videoDataUri = null;
        if (el.videoWidth > 0 && el.videoHeight > 0) {
          const scale = Math.min(1, 1280 / el.videoWidth, 720 / el.videoHeight);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(el.videoWidth * scale);
          canvas.height = Math.round(el.videoHeight * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
          videoDataUri = canvas.toDataURL('image/png');
        } else if (el.poster) {
          videoDataUri = el.poster;
        }

        if (videoDataUri) {
          return {
            type: 'image',
            name: 'Video Preview',
            bounds,
            isAbsolute,
            flexChild,
            href,
            rotation: parseTransform(style.transform),
            src: videoDataUri,
            borderRadius: {
              topLeft: parsePx(style.borderTopLeftRadius),
              topRight: parsePx(style.borderTopRightRadius),
              bottomRight: parsePx(style.borderBottomRightRadius),
              bottomLeft: parsePx(style.borderBottomLeftRadius)
            },
            opacity: parseOpacity(style.opacity)
          };
        }
      } catch (e) {
        console.warn('Video export error', e);
      }
    }

    // 2. Handle Image Elements (Smart Image Naming & Circular Avatar Detection)
    if (tagName === 'img') {
      const dataUri = captureRenderedImage(el);
      const alt = el.getAttribute('alt')?.trim();
      let imgName = 'Image';
      if (alt) {
        imgName = `Image: ${truncate(alt, 24)}`;
      } else {
        const src = el.currentSrc || el.src || '';
        if (/logo/i.test(src) || /logo/i.test(el.className)) {
          imgName = 'Logo';
        } else if (/avatar/i.test(src) || /avatar/i.test(el.className)) {
          imgName = 'Avatar';
        } else {
          const semClass = getCleanSemanticClass(el);
          if (semClass) imgName = `Image: ${semClass}`;
        }
      }

      // Check if image itself has rounded corners or is a 50% circle
      let imgBorderRadius = {
        topLeft: parsePx(style.borderTopLeftRadius),
        topRight: parsePx(style.borderTopRightRadius),
        bottomRight: parsePx(style.borderBottomRightRadius),
        bottomLeft: parsePx(style.borderBottomLeftRadius)
      };

      const rawRadius = el.style?.borderRadius || style.borderRadius || '';
      if (rawRadius.includes('50%') || rawRadius.includes('9999px') || /rounded-full/i.test(el.className)) {
        const half = Math.round(Math.min(bounds.width, bounds.height) / 2);
        imgBorderRadius = { topLeft: half, topRight: half, bottomRight: half, bottomLeft: half };
      }

      // If img has no border radius, check parent element for overflow:hidden + rounded-full (Tailwind/Radix avatar)
      if (imgBorderRadius.topLeft === 0 && imgBorderRadius.topRight === 0 && imgBorderRadius.bottomRight === 0 && imgBorderRadius.bottomLeft === 0) {
        let cur = el.parentElement;
        while (cur && cur !== document.body) {
          const pStyle = window.getComputedStyle(cur);
          const pRaw = cur.style?.borderRadius || pStyle.borderRadius || '';
          const hasRadius = pStyle.borderTopLeftRadius !== '0px' || pRaw.includes('50%') || pRaw.includes('9999px') || /rounded-full/i.test(cur.className);
          const hasClip = pStyle.overflow === 'hidden' || pStyle.overflow === 'clip';

          if (hasRadius && hasClip) {
            let rTopLeft = parsePx(pStyle.borderTopLeftRadius);
            if (pRaw.includes('50%') || pRaw.includes('9999px') || /rounded-full/i.test(cur.className) || rTopLeft >= bounds.width / 2) {
              const half = Math.round(Math.min(bounds.width, bounds.height) / 2);
              imgBorderRadius = { topLeft: half, topRight: half, bottomRight: half, bottomLeft: half };
            } else {
              imgBorderRadius = {
                topLeft: rTopLeft,
                topRight: parsePx(pStyle.borderTopRightRadius),
                bottomRight: parsePx(pStyle.borderBottomRightRadius),
                bottomLeft: parsePx(pStyle.borderBottomLeftRadius)
              };
            }
            break;
          }
          if (cur === el.parentElement?.parentElement) break;
          cur = cur.parentElement;
        }
      }

      return {
        type: 'image',
        name: imgName,
        bounds,
        isAbsolute,
        flexChild,
        href,
        rotation: parseTransform(style.transform),
        src: dataUri,
        objectFit: style.objectFit || 'fill',
        objectPosition: style.objectPosition || '50% 50%',
        borderRadius: imgBorderRadius,
        opacity: parseOpacity(style.opacity)
      };
    }

    // Check if element has visual container styling (background, border, shadow, or is a button/input)
    const hasVisualContainer = 
      Boolean(parseCssColor(style.backgroundColor)) ||
      (style.backgroundImage && style.backgroundImage !== 'none') ||
      parsePx(style.borderTopWidth) > 0 ||
      parsePx(style.borderRightWidth) > 0 ||
      parsePx(style.borderBottomWidth) > 0 ||
      parsePx(style.borderLeftWidth) > 0 ||
      parsePx(style.borderTopLeftRadius) > 0 ||
      parsePx(style.borderTopRightRadius) > 0 ||
      parsePx(style.borderBottomRightRadius) > 0 ||
      parsePx(style.borderBottomLeftRadius) > 0 ||
      (style.boxShadow && style.boxShadow !== 'none') ||
      tagName === 'button' ||
      el.getAttribute('role') === 'button' ||
      tagName === 'input' ||
      tagName === 'textarea';

    // 2.5 Unified Inline Formatting Context (No background/border/shadow box, pure text & inline spans)
    // E.g. <div class="role"><span>AI Engineering Leader</span>, <span>Sierra</span></div>
    // Returns ONE single Figma TextNode directly! Eliminates split words, commas as layers & overlaps!
    if (!hasVisualContainer && isInlineFormattingContext(el)) {
      const textInfo = extractInlineTextInfo(el);
      if (textInfo.text.length > 0) {
        let textName = truncate(textInfo.text, 32);
        if (/^h[1-6]$/.test(tagName)) {
          textName = `H${tagName.charAt(1)}: ${textName}`;
        } else if (tagName === 'a') {
          textName = `Link: ${textName}`;
        }

        const fontSize = parsePx(style.fontSize) || 14;
        const isSingleLine = height <= fontSize * 1.6;

        return {
          type: 'text',
          name: textName,
          bounds,
          isAbsolute,
          flexChild,
          href,
          rotation: parseTransform(style.transform),
          text: textInfo.text,
          lines: getRenderedTextLines(el),
          ranges: textInfo.ranges,
          isSingleLine,
          style: {
            color: style.color,
            fontFamily: resolvePlatformFontFamily(style.fontFamily),
            fontSize,
            fontWeight: style.fontWeight || '400',
            fontStyle: style.fontStyle || 'normal',
            lineHeight: style.lineHeight === 'normal' ? null : parsePx(style.lineHeight),
            textAlign: style.textAlign || 'left',
            letterSpacing: parsePx(style.letterSpacing),
            textTransform: style.textTransform,
            textDecoration: style.textDecorationLine || style.textDecoration,
            whiteSpace: style.whiteSpace
          },
          opacity: parseOpacity(style.opacity)
        };
      }
    }

    // 3. Extract Children in Natural Sequential DOM Order
    const childrenNodes = [];

    // 3a. Check ::before pseudo element (Icons, Badges, Overlays)
    const beforeNode = extractPseudo(el, '::before', rect);
    if (beforeNode) childrenNodes.push(beforeNode);

    // If this container is a styled wrapper with purely inline text, unify children into ONE single TextNode!
    if (isInlineFormattingContext(el)) {
      const textInfo = extractInlineTextInfo(el);
      if (textInfo.text.length > 0) {
        const pLeft = parsePx(style.paddingLeft) || 0;
        const pTop = parsePx(style.paddingTop) || 0;
        const pRight = parsePx(style.paddingRight) || 0;
        const pBottom = parsePx(style.paddingBottom) || 0;
        const fontSize = parsePx(style.fontSize) || 14;

        childrenNodes.push({
          type: 'text',
          name: truncate(textInfo.text, 32),
          bounds: {
            x: pLeft,
            y: pTop,
            width: Math.max(1, width - pLeft - pRight),
            height: Math.max(1, height - pTop - pBottom)
          },
          isAbsolute: false,
          flexChild: { grow: 0, shrink: 1 },
          href,
          text: textInfo.text,
          ranges: textInfo.ranges,
          isSingleLine: height <= fontSize * 1.6,
          style: {
            color: style.color,
            fontFamily: resolvePlatformFontFamily(style.fontFamily),
            fontSize,
            fontWeight: style.fontWeight || '400',
            fontStyle: style.fontStyle || 'normal',
            lineHeight: style.lineHeight === 'normal' ? null : parsePx(style.lineHeight),
            textAlign: style.textAlign || 'left',
            letterSpacing: parsePx(style.letterSpacing),
            textTransform: style.textTransform,
            textDecoration: style.textDecorationLine || style.textDecoration,
            whiteSpace: style.whiteSpace
          },
          opacity: 1
        });
      }
    } else {
      // 3b. Traverse childNodes in sequential DOM order (maintains natural text & element order!)
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const sourceText = child.textContent || '';
          const textVal = sourceText.replace(/\s+/g, ' ');
          if (textVal && textVal.trim().length > 0) {
            let textBounds = { x: 0, y: 0, width, height };
            let range = null;
            try {
              range = document.createRange();
              range.selectNodeContents(child);
              const textRect = range.getBoundingClientRect();
              if (textRect.width > 0 && textRect.height > 0) {
                textBounds = {
                  x: Math.round((textRect.left - rect.left) * 1000) / 1000,
                  y: Math.round((textRect.top - rect.top) * 1000) / 1000,
                  width: Math.round(textRect.width * 1000) / 1000,
                  height: Math.round(textRect.height * 1000) / 1000
                };
              }
            } catch {}

            const fontSize = parsePx(style.fontSize) || 14;
            const isSingleLine = textBounds.height <= fontSize * 1.6;

            // Extract exact rendered line breaks using DOM Range
            let exactLines = [];
            try {
              const clientRects = range.getClientRects();
              if (clientRects.length > 1) {
                const words = textVal.trim().split(/\s+/);
                if (words.length > 1) {
                  let curLine = '';
                  let lastTop = null;
                  let searchOffset = 0;
                  
                  for (let w = 0; w < words.length; w++) {
                    const word = words[w];
                    const wordIdx = sourceText.indexOf(word, searchOffset);
                    if (wordIdx !== -1) {
                      searchOffset = wordIdx + word.length;
                      const wRange = document.createRange();
                      wRange.setStart(child, wordIdx);
                      wRange.setEnd(child, wordIdx + word.length);
                      const wRect = wRange.getBoundingClientRect();
                      
                      if (lastTop === null) {
                        lastTop = wRect.top;
                        curLine = word;
                      } else if (Math.abs(wRect.top - lastTop) > 4) {
                        if (curLine) exactLines.push(curLine);
                        curLine = word;
                        lastTop = wRect.top;
                      } else {
                        curLine += ' ' + word;
                      }
                    } else {
                      curLine += (curLine ? ' ' : '') + word;
                    }
                  }
                  if (curLine) exactLines.push(curLine);
                }
              }
            } catch (e) {}

            // Preserve whitespace intelligently between inline items
            let textClean = textVal;
            if (!child.previousSibling && !child.nextSibling) {
              textClean = textVal.trim();
            } else {
              if (!child.previousSibling) textClean = textClean.trimStart();
              if (!child.nextSibling) textClean = textClean.trimEnd();
            }

            if (textClean.length > 0) {
              childrenNodes.push({
                type: 'text',
                name: truncate(textClean.trim(), 32),
                bounds: textBounds,
                isAbsolute: false,
                flexChild,
                href,
                rotation: parseTransform(style.transform),
                text: textClean,
                lines: exactLines.length > 0 ? exactLines : null,
                isSingleLine,
                style: {
                  color: style.color,
                  fontFamily: resolvePlatformFontFamily(style.fontFamily),
                  fontSize,
                  fontWeight: style.fontWeight || '400',
                  fontStyle: style.fontStyle || 'normal',
                  lineHeight: style.lineHeight === 'normal' ? null : parsePx(style.lineHeight),
                  textAlign: style.textAlign || 'left',
                  letterSpacing: parsePx(style.letterSpacing),
                  textTransform: style.textTransform,
                  textDecoration: style.textDecorationLine || style.textDecoration,
                  whiteSpace: style.whiteSpace
                },
                opacity: 1
              });
            }
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const childData = serializeNode(child, rect, depth + 1);
          if (childData) {
            childrenNodes.push(childData);
          }
        }
      }

      // 3c. Form Input Values / Placeholders
      if ((tagName === 'input' || tagName === 'textarea') && (el.value || el.placeholder)) {
        const val = el.value || el.placeholder;
        if (val && val.trim().length > 0) {
          const isPlaceholder = !el.value && !!el.placeholder;
          childrenNodes.push({
            type: 'text',
            name: isPlaceholder ? `Placeholder: ${truncate(val.trim(), 20)}` : `Value: ${truncate(val.trim(), 20)}`,
            bounds: { x: parsePx(style.paddingLeft) || 8, y: parsePx(style.paddingTop) || 8, width: Math.max(10, width - 16), height: Math.max(10, height - 16) },
            isAbsolute: false,
            flexChild,
            href,
            text: val.trim(),
            isSingleLine: true,
            style: {
              color: isPlaceholder ? 'rgba(156, 163, 175, 0.8)' : style.color,
              fontFamily: resolvePlatformFontFamily(style.fontFamily),
              fontSize: parsePx(style.fontSize) || 14,
              fontWeight: style.fontWeight || '400',
              fontStyle: style.fontStyle || 'normal',
              lineHeight: parsePx(style.lineHeight) || height,
              textAlign: style.textAlign || 'left'
            },
            opacity: 1
          });
        }
      }

      // 3d. Traverse Web Component Slots & Deep Shadow DOM (Open & Closed)
      if (tagName === 'slot') {
        try {
          const assigned = el.assignedNodes({ flatten: true });
          for (const aNode of assigned) {
            if (aNode.nodeType === Node.ELEMENT_NODE) {
              const aData = serializeNode(aNode, rect, depth + 1);
              if (aData) childrenNodes.push(aData);
            }
          }
        } catch {}
      }

      const shadowRoot = getShadowRootSafe(el);
      if (shadowRoot) {
        try {
          for (const sChild of shadowRoot.children) {
            const sData = serializeNode(sChild, rect, depth + 1);
            if (sData) childrenNodes.push(sData);
          }
        } catch {}
      }
    }

    // 3e. Check ::after pseudo element (Tooltips, Underlines, Accents)
    const afterNode = extractPseudo(el, '::after', rect);
    if (afterNode) childrenNodes.push(afterNode);

    // Leaf Text Element optimization: ONLY collapse into a pure TextNode if it has NO background/border/shadow/padding!
    if (!hasVisualContainer && el.children.length === 0 && childrenNodes.length === 1 && childrenNodes[0].type === 'text') {
      let leafName = childrenNodes[0].name;
      if (/^h[1-6]$/.test(tagName)) {
        leafName = `H${tagName.charAt(1)}: ${childrenNodes[0].name}`;
      } else if (tagName === 'a') {
        leafName = `Link: ${childrenNodes[0].name}`;
      }
      return {
        ...childrenNodes[0],
        name: leafName,
        bounds,
        isAbsolute,
        flexChild,
        href
      };
    }

    // Extract styles: Corner Radius with full CSS resolution (50%, 9999px, pills, and parent overflow:hidden inheritance)
    const rawRadius = el.style?.borderRadius || style.borderRadius || '';
    let rTopLeft = parsePx(style.borderTopLeftRadius);
    let rTopRight = parsePx(style.borderTopRightRadius);
    let rBottomRight = parsePx(style.borderBottomRightRadius);
    let rBottomLeft = parsePx(style.borderBottomLeftRadius);

    // If all corners are 0, check if immediate parent has overflow:hidden with rounded corners
    // (Common in React/Tailwind/Radix cards where outer wrapper clips inner background)
    if (rTopLeft === 0 && rTopRight === 0 && rBottomRight === 0 && rBottomLeft === 0 && el.parentElement && el.parentElement !== document.body) {
      try {
        const p = el.parentElement;
        const pStyle = window.getComputedStyle(p);
        if (pStyle.overflow === 'hidden' || pStyle.overflow === 'clip') {
          const pTL = parsePx(pStyle.borderTopLeftRadius);
          const pTR = parsePx(pStyle.borderTopRightRadius);
          const pBR = parsePx(pStyle.borderBottomRightRadius);
          const pBL = parsePx(pStyle.borderBottomLeftRadius);
          if (pTL > 0 || pTR > 0 || pBR > 0 || pBL > 0) {
            const pRect = p.getBoundingClientRect();
            if (Math.abs(rect.width - pRect.width) < 6 && Math.abs(rect.height - pRect.height) < 6) {
              rTopLeft = pTL;
              rTopRight = pTR;
              rBottomRight = pBR;
              rBottomLeft = pBL;
            }
          }
        }
      } catch {}
    }

    // Handle 50% (circles) and 9999px (pills) / Tailwind rounded-full across all elements
    const isPillOrCircle = rawRadius.includes('50%') || rawRadius.includes('9999px') || /rounded-full/i.test(el.className) || rTopLeft >= width / 2 || rTopLeft >= height / 2;
    if (isPillOrCircle && width > 0 && height > 0) {
      const half = Math.round(Math.min(width, height) / 2);
      rTopLeft = half;
      rTopRight = half;
      rBottomRight = half;
      rBottomLeft = half;
    }

    const borderRadius = {
      topLeft: rTopLeft,
      topRight: rTopRight,
      bottomRight: rBottomRight,
      bottomLeft: rBottomLeft
    };

    // Extract styles: 4-Sided Independent Borders
    const border = {
      widthTop: parsePx(style.borderTopWidth),
      widthRight: parsePx(style.borderRightWidth),
      widthBottom: parsePx(style.borderBottomWidth),
      widthLeft: parsePx(style.borderLeftWidth),
      colorTop: parseCssColor(style.borderTopColor || style.borderColor),
      colorRight: parseCssColor(style.borderRightColor || style.borderColor),
      colorBottom: parseCssColor(style.borderBottomColor || style.borderColor),
      colorLeft: parseCssColor(style.borderLeftColor || style.borderColor),
      color: parseCssColor(style.borderColor),
      styleTop: style.borderTopStyle
    };

    // Auto Layout styles
    const isGrid = style.display === 'grid' || style.display === 'inline-grid';
    const autoLayout = {
      display: style.display,
      flexDirection: style.flexDirection,
      flexWrap: style.flexWrap,
      justifyContent: style.justifyContent,
      alignItems: style.alignItems,
      gap: parsePx(style.columnGap || style.gap),
      gapY: parsePx(style.rowGap || style.gap),
      paddingTop: parsePx(style.paddingTop),
      paddingRight: parsePx(style.paddingRight),
      paddingBottom: parsePx(style.paddingBottom),
      paddingLeft: parsePx(style.paddingLeft),
      isGrid
    };

    // Background Image & CSS Gradients
    let bgUrl = null;
    let gradient = null;
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      if (style.backgroundImage.includes('gradient(')) {
        gradient = parseGradient(style.backgroundImage);
      }
      const match = style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (match && match[1]) bgUrl = match[1];
    }

    const smartFrameName = computeSmartName(el, tagName, style);

    return {
      type: 'frame',
      name: smartFrameName,
      bounds,
      isAbsolute,
      flexChild,
      href,
      clipPath: parseClipPath(style, el),
      rotation: parseTransform(style.transform),
      backgroundColor: parseCssColor(style.backgroundColor),
      backgroundImage: bgUrl,
      gradient,
      borderRadius,
      border,
      shadows: parseBoxShadow(style.boxShadow),
      blurs: parseBlur(style),
      overflow: style.overflow,
      opacity: parseOpacity(style.opacity),
      blendMode: style.mixBlendMode && style.mixBlendMode !== 'normal' ? style.mixBlendMode : null,
      autoLayout,
      children: childrenNodes
    };
  }

  // ==========================================================================
  // MODULE: svg-serializer.js
  // ==========================================================================

// Zcrap - SVG Vector Serializer & Direct Paste Generator
  // Helper for generating precise SVG Path for asymmetric rounded corners
  function buildRoundedRectSvgPath(x, y, w, h, tl, tr, br, bl) {
    const maxR = Math.min(w / 2, h / 2);
    tl = Math.max(0, Math.min(tl, maxR));
    tr = Math.max(0, Math.min(tr, maxR));
    br = Math.max(0, Math.min(br, maxR));
    bl = Math.max(0, Math.min(bl, maxR));
    return 'M ' + (x + tl) + ' ' + y +
      ' H ' + (x + w - tr) +
      (tr > 0 ? ' A ' + tr + ' ' + tr + ' 0 0 1 ' + (x + w) + ' ' + (y + tr) : '') +
      ' V ' + (y + h - br) +
      (br > 0 ? ' A ' + br + ' ' + br + ' 0 0 1 ' + (x + w - br) + ' ' + (y + h) : '') +
      ' H ' + (x + bl) +
      (bl > 0 ? ' A ' + bl + ' ' + bl + ' 0 0 1 ' + x + ' ' + (y + h - bl) : '') +
      ' V ' + (y + tl) +
      (tl > 0 ? ' A ' + tl + ' ' + tl + ' 0 0 1 ' + (x + tl) + ' ' + y : '') +
      ' Z';
  }

  // --- 4. Direct Figma Canvas Vector Serializer (Ctrl+V without Plugin) ---
  function escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function angleToSvgCoords(angleDeg) {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return {
      x1: Math.round(50 - Math.cos(rad) * 50) + '%',
      y1: Math.round(50 - Math.sin(rad) * 50) + '%',
      x2: Math.round(50 + Math.cos(rad) * 50) + '%',
      y2: Math.round(50 + Math.sin(rad) * 50) + '%'
    };
  }

  let gradCounter = 0;
  function buildSvgDefs(node, defsMap) {
    if (!node) return;
    if (node.fills && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === 'GRADIENT_LINEAR' && fill.stops) {
          const id = 'zcrap_lin_grad_' + (++gradCounter);
          const coords = angleToSvgCoords(fill.angle || 180);
          let stops = '';
          for (const s of fill.stops) {
            const stopOp = s.opacity !== undefined ? ' stop-opacity="' + s.opacity + '"' : '';
            stops += '    <stop offset="' + Math.round(s.position * 100) + '%" stop-color="' + s.color + '"' + stopOp + '/>\n';
          }
          defsMap.push('  <linearGradient id="' + id + '" x1="' + coords.x1 + '" y1="' + coords.y1 + '" x2="' + coords.x2 + '" y2="' + coords.y2 + '">\n' + stops + '  </linearGradient>');
          fill._svgGradId = id;
        }
      }
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        buildSvgDefs(child, defsMap);
      }
    }
  }

  function wrapTextToLines(text, maxWidth, fontSize, letterSpacing) {
    if (!text || maxWidth <= 0) return [text];
    const ls = letterSpacing || 0;
    // High-fidelity average char width: ~0.47 * fontSize for sans-serif with tracking
    const avgCharWidth = Math.max(1, fontSize * 0.47 + ls);
    const maxCharsPerLine = Math.max(10, Math.floor(maxWidth / avgCharWidth));

    const rawLines = text.split('\n');
    const resultLines = [];

    for (const rawLine of rawLines) {
      if (rawLine.length <= maxCharsPerLine) {
        resultLines.push(rawLine);
        continue;
      }
      const words = rawLine.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (testLine.length > maxCharsPerLine && currentLine) {
          resultLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) resultLines.push(currentLine);
    }
    return resultLines.length > 0 ? resultLines : [text];
  }

  function encodeBase64Utf8(str) {
    const bytes = new TextEncoder().encode(str);
    let binString = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binString += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binString);
  }

  let svgIdCounts = Object.create(null);

  function formatSvgId(name) {
    if (!name) return 'Layer';
    let clean = String(name)
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[→>]+/g, '-')
      .replace(/[:\/\\|#.,]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim();
    if (!clean || /^[0-9]/.test(clean)) {
      clean = 'Layer-' + (clean || 'node');
    }
    const base = clean.slice(0, 50) || 'Layer';
    const count = (svgIdCounts[base] || 0) + 1;
    svgIdCounts[base] = count;
    return count === 1 ? base : base + '-' + count;
  }

  function formatSvgDataName(name) {
    if (!name) return 'Layer';
    return escapeXml(String(name).replace(/[\r\n\t]+/g, ' ').replace(/[<>"'&]/g, '').trim().slice(0, 80));
  }

  function serializeNodeToFigmaSvg(node, isRoot) {
    if (!node || !node.bounds) return '';
    const { x, y, width, height } = node.bounds;
    const s = node.style || {};
    const opacityAttr = node.opacity !== undefined && node.opacity !== 1 ? ' opacity="' + node.opacity + '"' : '';

    // 1. Text Node (with separate fill-opacity & exact lines)
    if (node.type === 'text') {
      const text = node.text || '';
      const rawColor = s.color || '#000000';
      const tc = parseSvgColor(rawColor) || { hex: '#000000', opacity: 1 };
      const color = tc.hex;
      const textFillOpacity = tc.opacity < 1 ? ' fill-opacity="' + tc.opacity + '"' : '';
      const fontSize = s.fontSize || 14;
      const fontFamily = s.fontFamily || 'Inter, -apple-system, sans-serif';
      const fontWeight = s.fontWeight || '400';
      const lineHeight = s.lineHeight || Math.round(fontSize * 1.3);
      const textY = Math.round(fontSize * 0.85);
      const letterSpacingAttr = s.letterSpacing ? ' letter-spacing="' + s.letterSpacing + 'px"' : '';
      const textName = node.name || truncate(text, 48) || 'Text';
      const textId = formatSvgId(textName);
      const textDataName = formatSvgDataName(textName);
      const italicAttr = s.fontStyle === 'italic' ? ' font-style="italic"' : '';
      const decorationAttr = s.textDecoration && s.textDecoration !== 'none'
        ? ' text-decoration="' + escapeXml(s.textDecoration) + '"'
        : '';

      let textAnchor = '';
      let textX = 0;
      if (s.textAlign === 'center') {
        textAnchor = ' text-anchor="middle"';
        textX = Math.round(width / 2);
      } else if (s.textAlign === 'right') {
        textAnchor = ' text-anchor="end"';
        textX = width;
      }

      const isSingleLine = node.isSingleLine || (s.whiteSpace === 'nowrap');
      const lines = (node.lines && node.lines.length > 0) 
        ? node.lines 
        : ((!isSingleLine && width > 24) ? wrapTextToLines(text, width, fontSize, s.letterSpacing) : [text]);

      if (lines.length > 1) {
        let tspans = '';
        lines.forEach((line, index) => {
          const curY = y + textY + (index * lineHeight);
          tspans += '    <tspan x="' + (x + textX) + '" y="' + curY + '">' + escapeXml(line) + '</tspan>\n';
        });
        return '<text id="' + textId + '" data-name="' + textDataName + '" font-family="' + escapeXml(fontFamily) + '" font-size="' + fontSize + '" font-weight="' + fontWeight + '" fill="' + color + '"' + textFillOpacity + textAnchor + letterSpacingAttr + italicAttr + decorationAttr + opacityAttr + '>\n' +
          tspans +
          '</text>\n';
      }

      return '<text id="' + textId + '" data-name="' + textDataName + '" x="' + (x + textX) + '" y="' + (y + textY) + '" font-family="' + escapeXml(fontFamily) + '" font-size="' + fontSize + '" font-weight="' + fontWeight + '" fill="' + color + '"' + textFillOpacity + textAnchor + letterSpacingAttr + italicAttr + decorationAttr + opacityAttr + '>' + escapeXml(text) + '</text>\n';
    }

    // 2. Image Node (with circular clipPath support)
    if (node.type === 'image' && node.src) {
      let clipDef = '';
      let clipAttr = '';
      const radii = node.borderRadius || {};
      const tl = radii.topLeft || 0;
      const tr = radii.topRight || 0;
      const br = radii.bottomRight || 0;
      const bl = radii.bottomLeft || 0;
      if (tl || tr || br || bl) {
        const clipId = formatSvgId('Mask for ' + (node.name || 'Image'));
        const pathData = buildRoundedRectSvgPath(0, 0, width, height, tl, tr, br, bl);
        clipDef = '  <defs><clipPath id="' + clipId + '"><path d="' + pathData + '"/></clipPath></defs>\n';
        clipAttr = ' clip-path="url(#' + clipId + ')"';
      }

      const objectFit = node.objectFit || 'fill';
      const objectPosition = (node.objectPosition || '50% 50%').trim().split(/\s+/);
      const align = (v, axis) => {
        if (v === 'left' || v === 'top') return axis === 'x' ? 'xMin' : 'YMin';
        if (v === 'right' || v === 'bottom') return axis === 'x' ? 'xMax' : 'YMax';
        return axis === 'x' ? 'xMid' : 'YMid';
      };
      const preserveAspectRatio = objectFit === 'cover'
        ? align(objectPosition[0], 'x') + align(objectPosition[1] || objectPosition[0], 'y') + ' slice'
        : objectFit === 'contain' || objectFit === 'scale-down'
          ? align(objectPosition[0], 'x') + align(objectPosition[1] || objectPosition[0], 'y') + ' meet'
          : 'none';

      const imgLayerName = node.name || 'image';
      const imgId = formatSvgId(imgLayerName);
      const imgDataName = formatSvgDataName(imgLayerName);

      return '<g id="' + imgId + '" data-name="' + imgDataName + '" transform="translate(' + x + ', ' + y + ')"' + opacityAttr + clipAttr + '>\n' +
        clipDef +
        '  <image id="' + imgId + '_img" data-name="' + imgDataName + '" href="' + escapeXml(node.src) + '" x="0" y="0" width="' + width + '" height="' + height + '" preserveAspectRatio="' + preserveAspectRatio + '"/>\n' +
        '</g>\n';
    }

        // 3. Raw SVG Node (Direct Vector Output with Automatic ViewBox Scaling & Containment)
    const rawSvg = node.svg || node.svgContent;
    if (node.type === 'svg' && rawSvg) {
      let minX = 0, minY = 0, vbW = width, vbH = height;
      let hasViewBox = false;

      if (node.viewBox && node.viewBox.width > 0 && node.viewBox.height > 0) {
        minX = node.viewBox.minX || 0;
        minY = node.viewBox.minY || 0;
        vbW = node.viewBox.width;
        vbH = node.viewBox.height;
        hasViewBox = true;
      } else {
        const vbMatch = rawSvg.match(/viewBox=["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*["']/i);
        if (vbMatch) {
          minX = parseFloat(vbMatch[1]) || 0;
          minY = parseFloat(vbMatch[2]) || 0;
          vbW = parseFloat(vbMatch[3]) || width;
          vbH = parseFloat(vbMatch[4]) || height;
          hasViewBox = true;
        } else {
          const wMatch = rawSvg.match(/width=["']\s*([\d.]+)/i);
          const hMatch = rawSvg.match(/height=["']\s*([\d.]+)/i);
          if (wMatch && hMatch) {
            vbW = parseFloat(wMatch[1]) || width;
            vbH = parseFloat(hMatch[2]) || height;
            hasViewBox = true;
          }
        }
      }

      let transformStr = 'translate(' + x + ', ' + y + ')';
      if (hasViewBox && vbW > 0 && vbH > 0 && (Math.abs(vbW - width) > 0.5 || Math.abs(vbH - height) > 0.5 || minX !== 0 || minY !== 0)) {
        const sx = Math.round((width / vbW) * 10000) / 10000;
        const sy = Math.round((height / vbH) * 10000) / 10000;
        if (minX !== 0 || minY !== 0) {
          transformStr += ' scale(' + sx + ', ' + sy + ') translate(' + (-minX) + ', ' + (-minY) + ')';
        } else {
          transformStr += ' scale(' + sx + ', ' + sy + ')';
        }
      }

      const svgClipId = formatSvgId('Vector bounds for ' + (node.name || 'SVG'));
      const clipDef = '  <defs><clipPath id="' + svgClipId + '"><rect x="' + minX + '" y="' + minY + '" width="' + vbW + '" height="' + vbH + '"/></clipPath></defs>\n';
      const clipAttr = ' clip-path="url(#' + svgClipId + ')"';

      const inner = rawSvg
        .replace(/<\?xml[^>]*\?>/gi, '')
        .replace(/<svg[^>]*>/i, '')
        .replace(/<\/svg>/i, '');

      const svgLayerName = node.name || 'SVG';
      const sId = formatSvgId(svgLayerName);
      const sDataName = formatSvgDataName(svgLayerName);

      return '<g id="' + sId + '" data-name="' + sDataName + '" transform="' + transformStr + '"' + opacityAttr + clipAttr + '>\n' +
        clipDef +
        inner + '\n' +
        '</g>\n';
    }

    // 4. Frame / Container Node (with glass border stroke-opacity & fill-opacity)
    let fillVal = 'none';
    let fillOpacityAttr = '';
    const rawBg = node.backgroundColor || s.backgroundColor;

    if (node.fills && node.fills.length > 0) {
      const f = node.fills[0];
      if (f.type === 'SOLID') {
        const sc = parseSvgColor(f.color);
        if (sc) {
          fillVal = sc.hex;
          if (sc.opacity < 1) fillOpacityAttr = ' fill-opacity="' + sc.opacity + '"';
        }
      } else if (f.type === 'GRADIENT_LINEAR' && f._svgGradId) {
        fillVal = 'url(#' + f._svgGradId + ')';
      }
    } else if (rawBg) {
      const sc = parseSvgColor(rawBg);
      if (sc) {
        fillVal = sc.hex;
        if (sc.opacity < 1) fillOpacityAttr = ' fill-opacity="' + sc.opacity + '"';
      }
    }

    let rx = '';
    let maxRadius = 0;
    let isAsymmetric = false;
    let tl = 0, tr = 0, br = 0, bl = 0;
    const maxPossibleR = Math.min(width / 2, height / 2);

    if (node.borderRadius) {
      tl = node.borderRadius.topLeft || 0;
      tr = node.borderRadius.topRight || 0;
      br = node.borderRadius.bottomRight || 0;
      bl = node.borderRadius.bottomLeft || 0;

      // Tolerance of 0.75px for subpixel/high-DPI zoom rounding discrepancies across corners
      const isSymmetric = Math.abs(tl - tr) <= 0.75 && Math.abs(tr - br) <= 0.75 && Math.abs(br - bl) <= 0.75;

      if (isSymmetric) {
        const avgR = Math.round((tl + tr + br + bl) / 4);
        maxRadius = Math.max(0, Math.min(avgR, maxPossibleR));
        if (maxRadius > 0) {
          rx = ' rx="' + maxRadius + '" ry="' + maxRadius + '"';
        }
      } else {
        tl = Math.min(tl, maxPossibleR);
        tr = Math.min(tr, maxPossibleR);
        br = Math.min(br, maxPossibleR);
        bl = Math.min(bl, maxPossibleR);
        maxRadius = Math.max(tl, tr, br, bl);
        if (maxRadius > 0) {
          isAsymmetric = true;
        }
      }
    } else if (s.borderRadius) {
      const numR = parseFloat(s.borderRadius);
      if (!isNaN(numR) && numR > 0) {
        maxRadius = Math.min(Math.round(numR), maxPossibleR);
        rx = ' rx="' + maxRadius + '" ry="' + maxRadius + '"';
      }
    }

    let strokeAttr = '';
    let rawBorderColor = null;
    let strokeWidth = 0;
    const b = node.border;
    const wT = b ? (b.widthTop || 0) : 0;
    const wR = b ? (b.widthRight || 0) : 0;
    const wB = b ? (b.widthBottom || 0) : 0;
    const wL = b ? (b.widthLeft || 0) : 0;
    const cT = b ? (b.colorTop || b.color) : null;
    const cR = b ? (b.colorRight || b.color) : null;
    const cB = b ? (b.colorBottom || b.color) : null;
    const cL = b ? (b.colorLeft || b.color) : null;

    let independentBordersSvg = '';

    if (node.strokes && node.strokes.length > 0) {
      rawBorderColor = node.strokes[0].color;
      strokeWidth = node.strokes[0].width || 1;
    } else if (b) {
      const isUniform = (wT === wR && wR === wB && wB === wL);
      if (isUniform && wT > 0) {
        strokeWidth = wT;
        rawBorderColor = cT || cB || cR || cL;
      } else {
        // Individual borders (e.g. FAQ bottom divider line, card top/bottom borders)
        if (wB > 0 && cB) {
          const sc = parseSvgColor(cB);
          if (sc) {
            const op = sc.opacity < 1 ? ' fill-opacity="' + sc.opacity + '"' : '';
            independentBordersSvg += '<rect id="' + formatSvgId('Border Bottom') + '" data-name="Border Bottom" x="0" y="' + Math.max(0, height - wB) + '" width="' + width + '" height="' + wB + '" fill="' + sc.hex + '"' + op + '/>\n';
          }
        }
        if (wT > 0 && cT) {
          const sc = parseSvgColor(cT);
          if (sc) {
            const op = sc.opacity < 1 ? ' fill-opacity="' + sc.opacity + '"' : '';
            independentBordersSvg += '<rect id="' + formatSvgId('Border Top') + '" data-name="Border Top" x="0" y="0" width="' + width + '" height="' + wT + '" fill="' + sc.hex + '"' + op + '/>\n';
          }
        }
        if (wL > 0 && cL) {
          const sc = parseSvgColor(cL);
          if (sc) {
            const op = sc.opacity < 1 ? ' fill-opacity="' + sc.opacity + '"' : '';
            independentBordersSvg += '<rect id="' + formatSvgId('Border Left') + '" data-name="Border Left" x="0" y="0" width="' + wL + '" height="' + height + '" fill="' + sc.hex + '"' + op + '/>\n';
          }
        }
        if (wR > 0 && cR) {
          const sc = parseSvgColor(cR);
          if (sc) {
            const op = sc.opacity < 1 ? ' fill-opacity="' + sc.opacity + '"' : '';
            independentBordersSvg += '<rect id="' + formatSvgId('Border Right') + '" data-name="Border Right" x="' + Math.max(0, width - wR) + '" y="0" width="' + wR + '" height="' + height + '" fill="' + sc.hex + '"' + op + '/>\n';
          }
        }
      }
    } else if (s.border && s.border.width) {
      strokeWidth = s.border.width;
      rawBorderColor = s.border.color;
    }

    if (strokeWidth > 0 && rawBorderColor) {
      const sc = parseSvgColor(rawBorderColor);
      if (sc) {
        strokeAttr = ' stroke="' + sc.hex + '" stroke-width="' + strokeWidth + '"';
        if (sc.opacity < 1) {
          strokeAttr += ' stroke-opacity="' + sc.opacity + '"';
        }
      }
    }

    let bgRect = '';
    if (fillVal !== 'none' || strokeAttr) {
      const rectName = (fillVal !== 'none') ? 'Background' : 'Border';
      const rId = formatSvgId(rectName);
      const rDataName = formatSvgDataName(rectName);
      if (isAsymmetric) {
        const pathData = buildRoundedRectSvgPath(0, 0, width, height, tl, tr, br, bl);
        bgRect = '<path id="' + rId + '" data-name="' + rDataName + '" d="' + pathData + '" fill="' + fillVal + '"' + fillOpacityAttr + strokeAttr + '/>\n';
      } else {
        bgRect = '<rect id="' + rId + '" data-name="' + rDataName + '" x="0" y="0" width="' + width + '" height="' + height + '" fill="' + fillVal + '"' + fillOpacityAttr + rx + strokeAttr + '/>\n';
      }
    }
    bgRect += independentBordersSvg;

    // Do not generate SVG clipPath mask for standard containers when bgRect already has rx/ry,
    // because Figma converts SVG clipPath into a Clip Path Group (Vector Mask) which destroys the live Rectangle!
    let frameClipDef = '';
    let frameClipAttr = '';

    let childrenSvg = '';
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        childrenSvg += serializeNodeToFigmaSvg(child, false);
      }
    }

    if (isRoot) {
      return bgRect + childrenSvg;
    }

    // Redundant wrapper flattening:
    // Only flatten unstyled ANONYMOUS wrappers ('Container', 'Group', 'Span').
    // NEVER flatten interactive components like Buttons, Links, or semantic landmarks!
    const isAnonymousWrapper = node.name === 'Container' || node.name === 'Group' || node.name === 'Span';
    const hasVisuals = (bgRect && bgRect.trim().length > 0) || (frameClipAttr && frameClipAttr.length > 0) || (opacityAttr && opacityAttr.length > 0);
    if (!hasVisuals && isAnonymousWrapper && node.children && node.children.length === 1) {
      const singleChild = node.children[0];
      if (singleChild.type === 'text') {
        const adjustedText = Object.assign({}, singleChild, {
          bounds: {
            x: singleChild.bounds.x + x,
            y: singleChild.bounds.y + y,
            width: singleChild.bounds.width,
            height: singleChild.bounds.height
          }
        });
        return serializeNodeToFigmaSvg(adjustedText, false);
      }
      if (singleChild.type === 'frame' && (node.name === 'Container' || node.name === 'Group' || node.name === 'Span')) {
        const adjustedFrame = Object.assign({}, singleChild, {
          bounds: {
            x: singleChild.bounds.x + x,
            y: singleChild.bounds.y + y,
            width: singleChild.bounds.width,
            height: singleChild.bounds.height
          }
        });
        return serializeNodeToFigmaSvg(adjustedFrame, false);
      }
      if ((singleChild.type === 'svg' || singleChild.type === 'image') && (node.name === 'Container' || node.name === 'Group' || node.name === 'Span')) {
        const adjustedChild = Object.assign({}, singleChild, {
          bounds: {
            x: singleChild.bounds.x + x,
            y: singleChild.bounds.y + y,
            width: singleChild.bounds.width,
            height: singleChild.bounds.height
          }
        });
        return serializeNodeToFigmaSvg(adjustedChild, false);
      }
    }

    const frameName = node.name || 'Container';
    const gId = formatSvgId(frameName);
    const gDataName = formatSvgDataName(frameName);

    return '<g id="' + gId + '" data-name="' + gDataName + '" transform="translate(' + x + ', ' + y + ')"' + opacityAttr + frameClipAttr + '>\n' + frameClipDef + bgRect + childrenSvg + '</g>\n';
  }

  function buildFigmaDirectPastePayload(payload) {
    const rootNode = payload.rootNode;
    const width = Math.max(10, rootNode.bounds.width);
    const height = Math.max(10, rootNode.bounds.height);

    const defs = [];
    svgIdCounts = Object.create(null);
    gradCounter = 0;
    buildSvgDefs(rootNode, defs);

    const body = serializeNodeToFigmaSvg(rootNode, true);
    const defsStr = defs.length > 0 ? '<defs>\n' + defs.join('\n') + '\n</defs>\n' : '';

    // Strip temporary private properties before serialization
    function cleanPrivateProps(n) {
      if (!n) return;
      if (n.fills && Array.isArray(n.fills)) {
        for (const f of n.fills) if (f && f._svgGradId) delete f._svgGradId;
      }
      if (n.children && Array.isArray(n.children)) {
        for (const c of n.children) cleanPrivateProps(c);
      }
    }
    cleanPrivateProps(rootNode);

    const jsonStr = JSON.stringify(payload);
    let base64Json = '';
    try {
      base64Json = encodeBase64Utf8(jsonStr);
    } catch {
      try {
        base64Json = btoa(unescape(encodeURIComponent(jsonStr)));
      } catch {
        base64Json = btoa(jsonStr.slice(0, 1000));
      }
    }

    const rootTitle = payload.title || document.title || 'Web Page';
    const rootId = formatSvgId(rootTitle);
    const rootDataName = formatSvgDataName(rootTitle);

    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="' + rootId + '" data-name="' + rootDataName + '" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">\n' +
      '<!--zcrap-metadata:' + base64Json + ':zcrap-metadata-->\n' +
      defsStr + body + '</svg>';
  }

  // ==========================================================================
  // MODULE: controller.js
  // ==========================================================================

// Zcrap - Page Capture Controller & Extension Messaging

  // Full Capture Function with Animation Freezing (CDP Engine v3.0.0)
  function capturePage(targetEl) {
    const resumeAnimations = pauseAnimations();
    try {
      const root = targetEl || document.body;
      const rootRect = root.getBoundingClientRect();

      // Root node relative to itself is at (0, 0)
      const rootData = serializeNode(root, rootRect, 0);
      if (rootData) {
        rootData.bounds.x = 0;
        rootData.bounds.y = 0;
        if (!targetEl || targetEl === document.body) {
          const fullHeight = Math.max(
            document.body.scrollHeight || 0,
            document.documentElement.scrollHeight || 0,
            document.body.offsetHeight || 0,
            document.documentElement.offsetHeight || 0,
            rootData.bounds.height
          );
          rootData.bounds.height = fullHeight;

          // Root Wrapper Unrolling:
          // Modern frameworks (Next.js #__next, Nuxt, Vite #root) wrap all page content in full-height
          // anonymous <div> wrappers. If the root contains only a single unstyled wrapper (or nested wrappers),
          // unroll them so semantic landmark sections (<header>, <main>, <footer>, <nav>, <section>)
          // are promoted directly under the canvas artboard, matching html.to.design!
          while (
            rootData.children &&
            rootData.children.length === 1 &&
            rootData.children[0].type === 'frame'
          ) {
            const onlyChild = rootData.children[0];
            const hasVisuals = onlyChild.backgroundColor || onlyChild.backgroundImage || onlyChild.border || (onlyChild.borderRadius && (onlyChild.borderRadius.topLeft > 0));
            if (hasVisuals) break;
            if (onlyChild.children && onlyChild.children.length > 0) {
              const offX = onlyChild.bounds ? (onlyChild.bounds.x || 0) : 0;
              const offY = onlyChild.bounds ? (onlyChild.bounds.y || 0) : 0;
              if (offX !== 0 || offY !== 0) {
                for (const c of onlyChild.children) {
                  if (c.bounds) {
                    c.bounds.x += offX;
                    c.bounds.y += offY;
                  }
                }
              }
              rootData.children = onlyChild.children;
            } else {
              break;
            }
          }
        }
      }

      return {
        app: 'Zcrap',
        version: '3.7.1',
        title: document.title || 'Web Capture',
        url: window.location.href,
        viewport: {
          width: Math.round(window.innerWidth),
          height: Math.round(window.innerHeight)
        },
        rootNode: rootData
      };
    } finally {
      resumeAnimations();
    }
  }

  // Visual Toast
  function showToast(msg, isSuccess = true) {
    const old = document.getElementById('__zcrap_toast');
    if (old) old.remove();

    const t = document.createElement('div');
    t.id = '__zcrap_toast';
    t.style.position = 'fixed';
    t.style.bottom = '24px';
    t.style.right = '24px';
    t.style.background = isSuccess ? '#090D16' : '#7F1D1D';
    t.style.color = '#FFF';
    t.style.border = `2px solid ${isSuccess ? '#00F0FF' : '#EF4444'}`;
    t.style.borderRadius = '8px';
    t.style.padding = '12px 20px';
    t.style.fontSize = '14px';
    t.style.fontWeight = 'bold';
    t.style.boxShadow = '0 12px 30px rgba(0,0,0,0.6)';
    t.style.zIndex = '2147483647';
    t.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    t.style.transition = 'opacity 0.3s ease';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 300);
    }, 4000);
  }

  // Auto-scroll and preload pipeline for deep pages (Lazy images, dynamic sections, web fonts)
  async function autoScrollAndPreloadPage() {
    const initialX = window.scrollX;
    const initialY = window.scrollY;

    // 1. Force lazy-loading attributes to eager on all media
    try {
      const lazyElements = document.querySelectorAll('img, picture source, iframe');
      lazyElements.forEach(el => {
        if (el.getAttribute('loading') === 'lazy') {
          el.setAttribute('loading', 'eager');
        }
        const lazySrc = el.dataset?.src || el.dataset?.original || el.dataset?.lazySrc || el.dataset?.url;
        if (lazySrc && !el.src) {
          el.src = lazySrc;
        }
        const lazySrcset = el.dataset?.srcset;
        if (lazySrcset && !el.srcset) {
          el.srcset = lazySrcset;
        }
      });
    } catch {}

    // 2. Step-scroll from top to bottom to trigger IntersectionObservers and scroll events
    const viewportHeight = window.innerHeight || 800;
    const totalHeight = Math.max(
      document.body.scrollHeight || 0,
      document.documentElement.scrollHeight || 0,
      document.body.offsetHeight || 0,
      document.documentElement.offsetHeight || 0
    );

    if (totalHeight > viewportHeight * 1.2) {
      const step = Math.min(Math.round(viewportHeight * 0.75), 650);
      const maxSteps = 40; // Max ~25,000px depth protection
      let currentY = 0;
      let stepCount = 0;

      while (currentY < totalHeight && stepCount < maxSteps) {
        currentY += step;
        window.scrollTo({ left: 0, top: currentY, behavior: 'instant' });
        window.dispatchEvent(new Event('scroll'));
        await new Promise(r => setTimeout(r, 40));
        stepCount++;
      }

      // Hit very bottom
      window.scrollTo({ left: 0, top: totalHeight, behavior: 'instant' });
      window.dispatchEvent(new Event('scroll'));
      await new Promise(r => setTimeout(r, 80));
    }

    // 3. Wait for pending images to finish loading / decoding
    const imgs = Array.from(document.images);
    const pending = imgs.filter(img => !img.complete && (img.src || img.currentSrc));
    if (pending.length > 0) {
      await Promise.allSettled(
        pending.slice(0, 50).map(img => {
          if (img.decode) return img.decode().catch(() => {});
          return new Promise(resolve => {
            img.onload = img.onerror = resolve;
            setTimeout(resolve, 500);
          });
        })
      );
    }

    // 4. Wait for web fonts
    if (document.fonts && document.fonts.ready) {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise(r => setTimeout(r, 600))
        ]);
      } catch {}
    }

    // 5. Scroll back to top (0,0) for 1:1 clean canvas coordinates
    window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
    window.dispatchEvent(new Event('scroll'));
    // Allow sticky / fixed headers to re-dock cleanly
    await new Promise(r => setTimeout(r, 120));

    return { initialX, initialY };
  }



    // Direct Paste Figma Clipboard Writer (writes text/html & text/plain)
  async function writeToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([text], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' })
          })
        ]);
        return true;
      }
    } catch (e) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {}
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }

  // Element Inspector / Interactive Selector
  function initSelector(onSelected) {
    const existingOverlay = document.getElementById('__zcrap_inspector_overlay');
    if (existingOverlay) existingOverlay.remove();
    const existingBanner = document.getElementById('__zcrap_inspector_banner');
    if (existingBanner) existingBanner.remove();

    let currentHovered = null;

    // Helper banner at top
    const banner = document.createElement('div');
    banner.id = '__zcrap_inspector_banner';
    banner.style.position = 'fixed';
    banner.style.top = '16px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.backgroundColor = '#090D16';
    banner.style.color = '#FFF';
    banner.style.border = '2px solid #00F0FF';
    banner.style.borderRadius = '30px';
    banner.style.padding = '8px 22px';
    banner.style.fontSize = '13px';
    banner.style.fontWeight = '600';
    banner.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
    banner.style.zIndex = '2147483647';
    banner.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    banner.style.pointerEvents = 'none';
    banner.innerHTML = '🎯 <b>Zcrap Inspector:</b> Hover & click an element to copy (Press <kbd style="background:#222;padding:2px 6px;border-radius:4px;border:1px solid #444;color:#00F0FF">Esc</kbd> to cancel)';
    document.body.appendChild(banner);

    // Overlay box
    const overlay = document.createElement('div');
    overlay.id = '__zcrap_inspector_overlay';
    overlay.style.position = 'fixed';
    overlay.style.pointerEvents = 'none';
    overlay.style.border = '2px solid #00F0FF';
    overlay.style.backgroundColor = 'rgba(0, 240, 255, 0.18)';
    overlay.style.zIndex = '2147483646';
    overlay.style.transition = 'all 0.05s ease-out';
    overlay.style.borderRadius = '4px';
    overlay.style.boxSizing = 'border-box';
    overlay.style.display = 'none';

    // Tag Label on overlay
    const label = document.createElement('div');
    label.id = '__zcrap_inspector_label';
    label.style.position = 'absolute';
    label.style.bottom = '-26px';
    label.style.left = '0';
    label.style.backgroundColor = '#00F0FF';
    label.style.color = '#000';
    label.style.fontFamily = 'monospace';
    label.style.fontSize = '11px';
    label.style.fontWeight = 'bold';
    label.style.padding = '2px 8px';
    label.style.borderRadius = '3px';
    label.style.whiteSpace = 'nowrap';
    label.style.pointerEvents = 'none';
    overlay.appendChild(label);
    document.body.appendChild(overlay);

    function onMouseMove(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || (el.id && el.id.startsWith('__zcrap')) || overlay.contains(el)) return;
      currentHovered = el;
      const r = el.getBoundingClientRect();
      overlay.style.display = 'block';
      overlay.style.top = r.top + 'px';
      overlay.style.left = r.left + 'px';
      overlay.style.width = r.width + 'px';
      overlay.style.height = r.height + 'px';

      if (r.bottom + 30 > window.innerHeight) {
        label.style.bottom = 'auto';
        label.style.top = '-24px';
      } else {
        label.style.top = 'auto';
        label.style.bottom = '-26px';
      }

      const tagName = el.tagName.toLowerCase();
      const cls = typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/)[0]
        : '';
      label.textContent = `<${tagName}${cls}> ${Math.round(r.width)}×${Math.round(r.height)}`;
    }

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      if (currentHovered) {
        onSelected(currentHovered);
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        cleanup();
        onSelected(null);
      }
    }

    function cleanup() {
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    }

    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
  }

  // Message Handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ pong: true });
      return;
    }

    if (request.action === 'capture_full') {
      (async () => {
        let scrollState = null;
        try {
          if (request.autoScroll !== false) {
            showToast('🔄 Preloading: Scrolling & triggering lazy images/sections...');
            scrollState = await autoScrollAndPreloadPage();
          }

          const payload = capturePage(document.body);
          const json = JSON.stringify(payload);
          const directPasteSvg = buildFigmaDirectPastePayload(payload);
          await writeToClipboard(directPasteSvg);
          showToast('⚡ Zcrap: Copied! Paste directly in Figma (Ctrl+V) — No plugin needed!');

          // Restore original scroll position if scrolled
          if (scrollState) {
            window.scrollTo({ left: scrollState.initialX, top: scrollState.initialY, behavior: 'instant' });
          }

          sendResponse({ success: true, data: payload, jsonString: json, directPasteSvg });
        } catch (err) {
          console.error('[Zcrap] Capture error:', err);
          showToast('❌ Capture failed: ' + err.message, false);
          if (scrollState) {
            window.scrollTo({ left: scrollState.initialX, top: scrollState.initialY, behavior: 'instant' });
          }
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // Keep message port open for async response
    }

    if (request.action === 'start_inspect') {
      initSelector(async (targetEl) => {
        if (!targetEl) {
          showToast('Selection cancelled.', false);
          sendResponse({ cancelled: true });
          return;
        }
        try {
          const payload = capturePage(targetEl);
          const json = JSON.stringify(payload);
          const directPasteSvg = buildFigmaDirectPastePayload(payload);
          await writeToClipboard(directPasteSvg);
          showToast('🎯 Zcrap: Element copied! Paste directly in Figma (Ctrl+V) — No plugin needed!');
          sendResponse({ success: true, data: payload, jsonString: json, directPasteSvg });
        } catch (err) {
          console.error('[Zcrap] Element capture error:', err);
          showToast('❌ Element capture failed: ' + err.message, false);
          sendResponse({ success: false, error: err.message });
        }
      });
      return true; // Keep message channel open for async response
    }
  });


})();
