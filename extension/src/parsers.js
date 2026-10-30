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

