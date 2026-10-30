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
