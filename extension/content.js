// Zcrap Content Script - High-Fidelity 1:1 Web Serializer
(function () {
  window.__zcrap_installed = true;
  console.log('[Zcrap] High-fidelity 1:1 engine active.');

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

  // Parse CSS RGBA/RGB/Hex color
  function parseCssColor(str) {
    if (!str || typeof str !== 'string') return null;
    const clean = str.trim().toLowerCase();
    if (clean === 'transparent' || clean === 'none' || clean === 'rgba(0, 0, 0, 0)' || clean === 'rgba(0,0,0,0)' || clean === 'rgb(0 0 0 / 0)') {
      return null;
    }
    return str;
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
          if (!svgClone.getAttribute('viewBox') && targetEl.getAttribute('viewBox')) {
            svgClone.setAttribute('viewBox', targetEl.getAttribute('viewBox'));
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

  // --- 6. Text Ellipsis Truncation Detection ---
  function detectTextEllipsis(el, style) {
    if (!el || !style) return false;
    const hasEllipsis = style.textOverflow === 'ellipsis';
    const hasLineClamp = style.webkitLineClamp && style.webkitLineClamp !== 'none';
    if (!hasEllipsis && !hasLineClamp) return false;
    return (el.scrollWidth > el.clientWidth + 1) || (el.scrollHeight > el.clientHeight + 1);
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
      const isLinear = str.includes('linear-gradient(');
      const isRadial = str.includes('radial-gradient(');
      if (!isLinear && !isRadial) return null;

      const gradMatch = str.match(/(linear|radial)-gradient\((.*)\)/s);
      if (!gradMatch) return null;

      const type = gradMatch[1];
      const inner = gradMatch[2].trim();

      // Split arguments respecting inner commas
      const args = [];
      let depth = 0;
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
        stopStartIndex = 1;
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
            fontFamily: pStyle.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
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
    if (!el || typeof el.className !== 'string') return null;
    const classes = el.className.trim().split(/\s+/);
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
    const textSnippet = directText || truncate(getDirectTextContent(el), 24);
    const id = el.id && !el.id.startsWith('__') ? toTitleCase(el.id) : null;
    const role = el.getAttribute('role');

    // 1. Explicit ARIA Names
    if (ariaLabel && ariaLabel.trim().length > 0) {
      return truncate(ariaLabel.trim(), 30);
    }

    // 2. Semantic Roles & Landmarks
    if (role === 'navigation' || tagName === 'nav') {
      return semanticClass || id || 'Navigation';
    }
    if (role === 'banner' || tagName === 'header') {
      return semanticClass || id || 'Header';
    }
    if (role === 'contentinfo' || tagName === 'footer') {
      return semanticClass || id || 'Footer';
    }
    if (role === 'main' || tagName === 'main') {
      return semanticClass || id || 'Main Content';
    }
    if (role === 'dialog' || tagName === 'dialog') {
      return semanticClass || id || 'Modal Dialog';
    }

    // 3. Buttons & Links
    if (tagName === 'button' || role === 'button') {
      const label = textSnippet || semanticClass || id;
      return label ? `Button: ${label}` : 'Button';
    }
    if (tagName === 'a') {
      const label = textSnippet || semanticClass || id;
      return label ? `Link: ${label}` : 'Link';
    }

    // 4. Headings
    if (/^h[1-6]$/.test(tagName)) {
      const level = tagName.charAt(1);
      return textSnippet ? `H${level}: ${textSnippet}` : `Heading ${level}`;
    }

    // 5. Paragraphs
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
    if (tagName === 'ul' || tagName === 'ol') {
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
        const start = rawText.indexOf(cText);
        const end = start + cText.length;
        ranges.push({
          start,
          end,
          color: isDiffColor ? cStyle.color : null,
          fontWeight: isDiffWeight ? cStyle.fontWeight : null,
          href
        });
      }
    }

    return { text: rawText, ranges };
  }

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
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) === 0
    ) {
      return null;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0 && el.children.length === 0) {
      return null;
    }

    // RELATIVE POSITION TO DIRECT PARENT (Prevents cumulative double-offsetting!)
    const relX = Math.round(rect.left - parentRect.left);
    const relY = Math.round(rect.top - parentRect.top);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

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

    // 0. Same-Origin Iframe Serialization
    if (tagName === 'iframe') {
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
        }
      } catch (err) {}
    }

    // 1. Handle SVG Elements (Smart Icon Naming & Inlined <use> References)
    if (tagName === 'svg') {
      try {
        const svgClone = el.cloneNode(true);
        if (!svgClone.getAttribute('xmlns')) {
          svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        // Resolve sprite sheet <use href="#id"> symbols
        inlineSvgUseReferences(svgClone);

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

    // 2. Handle Image Elements (Smart Image Naming)
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

      return {
        type: 'image',
        name: imgName,
        bounds,
        isAbsolute,
        flexChild,
        href,
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
          ranges: textInfo.ranges,
          isSingleLine,
          style: {
            color: style.color,
            fontFamily: style.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
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
            fontFamily: style.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
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
          const textVal = child.textContent?.replace(/\s+/g, ' ');
          if (textVal && textVal.trim().length > 0) {
            let textBounds = { x: 0, y: 0, width, height };
            try {
              const range = document.createRange();
              range.selectNodeContents(child);
              const textRect = range.getBoundingClientRect();
              if (textRect.width > 0 && textRect.height > 0) {
                textBounds = {
                  x: Math.round(textRect.left - rect.left),
                  y: Math.round(textRect.top - rect.top),
                  width: Math.round(textRect.width),
                  height: Math.round(textRect.height)
                };
              }
            } catch {}

            const fontSize = parsePx(style.fontSize) || 14;
            const isSingleLine = textBounds.height <= fontSize * 1.6;

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
                isSingleLine,
                style: {
                  color: style.color,
                  fontFamily: style.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
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
              fontFamily: style.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
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

    // Extract styles: Corner Radius
    const borderRadius = {
      topLeft: parsePx(style.borderTopLeftRadius),
      topRight: parsePx(style.borderTopRightRadius),
      bottomRight: parsePx(style.borderBottomRightRadius),
      bottomLeft: parsePx(style.borderBottomLeftRadius)
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
      gap: parsePx(style.gap || style.columnGap),
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
        }
      }

      return {
        app: 'Zcrap',
        version: '3.0.0',
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

  // Clipboard Writer
  async function writeToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
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
          await writeToClipboard(json);
          showToast('⚡ Zcrap: Full page captured with 1:1 precision! Paste in Figma.');

          // Restore original scroll position if scrolled
          if (scrollState) {
            window.scrollTo({ left: scrollState.initialX, top: scrollState.initialY, behavior: 'instant' });
          }

          sendResponse({ success: true, data: payload, jsonString: json });
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
          await writeToClipboard(json);
          showToast('🎯 Zcrap: Element copied with 1:1 precision! Paste in Figma.');
          sendResponse({ success: true, data: payload, jsonString: json });
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
