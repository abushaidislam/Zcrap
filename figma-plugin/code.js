// Zcrap - High-Fidelity 1:1 Figma Canvas Engine

figma.showUI(__html__, {
  width: 380,
  height: 540,
  themeColors: true,
  title: 'Zcrap - HTML to Figma'
});

// Parse CSS colors to Figma RGB (0-1) and opacity (Supports Hex, legacy RGBA/RGB, modern slash RGBA, HSL & named colors)
function parseColor(cssColor) {
  if (!cssColor || typeof cssColor !== 'string') return null;
  const str = cssColor.trim().toLowerCase();
  if (str === 'transparent' || str === 'rgba(0, 0, 0, 0)' || str === 'none') {
    return null;
  }

  // 1. Hex format (#rgb, #rgba, #rrggbb, #rrggbbaa)
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 4) hex = hex.split('').map(c => c + c).join('');
    let a = 1;
    if (hex.length === 8) {
      a = parseInt(hex.slice(6, 8), 16) / 255;
      hex = hex.slice(0, 6);
    }
    const num = parseInt(hex, 16);
    if (isNaN(num)) return null;
    return {
      color: {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8) & 255) / 255,
        b: (num & 255) / 255
      },
      opacity: Math.min(1, Math.max(0, a))
    };
  }

  // 2. RGB / RGBA: handles comma-separated and modern space/slash syntax
  // Examples: rgb(255, 255, 255), rgba(255, 255, 255, 0.1), rgb(255 255 255 / 0.1), rgb(255 255 255 / 10%)
  const rgbMatch = str.match(/rgba?\(\s*([\d.]+%?)[,\s]+([\d.]+%?)[,\s]+([\d.]+%?)(?:[,\s/]+([\d.]+%?))?\s*\)/);
  if (rgbMatch) {
    const parseVal = (v) => {
      if (!v) return 0;
      if (v.endsWith('%')) return (parseFloat(v) / 100) * 255;
      return parseFloat(v);
    };
    const r = Math.min(1, Math.max(0, parseVal(rgbMatch[1]) / 255));
    const g = Math.min(1, Math.max(0, parseVal(rgbMatch[2]) / 255));
    const b = Math.min(1, Math.max(0, parseVal(rgbMatch[3]) / 255));
    let a = 1;
    if (rgbMatch[4] !== undefined) {
      if (rgbMatch[4].endsWith('%')) a = parseFloat(rgbMatch[4]) / 100;
      else a = parseFloat(rgbMatch[4]);
    }
    return { color: { r, g, b }, opacity: isNaN(a) ? 1 : Math.min(1, Math.max(0, a)) };
  }

  // 3. HSL / HSLA support
  const hslMatch = str.match(/hsla?\(\s*([\d.]+deg|[\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:[,\s/]+([\d.]+%?))?\s*\)/);
  if (hslMatch) {
    let h = parseFloat(hslMatch[1]) % 360;
    if (h < 0) h += 360;
    const s = Math.min(1, Math.max(0, parseFloat(hslMatch[2]) / 100));
    const l = Math.min(1, Math.max(0, parseFloat(hslMatch[3]) / 100));
    let a = 1;
    if (hslMatch[4] !== undefined) {
      if (hslMatch[4].endsWith('%')) a = parseFloat(hslMatch[4]) / 100;
      else a = parseFloat(hslMatch[4]);
    }
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    if (h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h < 240) { r1 = 0; g1 = c; b1 = x; }
    else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    return {
      color: { r: Math.min(1, Math.max(0, r1 + m)), g: Math.min(1, Math.max(0, g1 + m)), b: Math.min(1, Math.max(0, b1 + m)) },
      opacity: isNaN(a) ? 1 : Math.min(1, Math.max(0, a))
    };
  }

  // 4. Basic named colors
  const NAMED_COLORS = {
    white: { r: 1, g: 1, b: 1 },
    black: { r: 0, g: 0, b: 0 }
  };
  if (NAMED_COLORS[str]) {
    return { color: NAMED_COLORS[str], opacity: 1 };
  }

  return null;
}

function getFontStyle(weight, isItalic = false) {
  const w = parseInt(weight) || 400;
  if (isItalic) {
    if (w >= 700) return 'Bold Italic';
    if (w >= 600) return 'Semi Bold Italic';
    if (w <= 300) return 'Light Italic';
    return 'Italic';
  }
  if (w >= 700) return 'Bold';
  if (w >= 600) return 'Semi Bold';
  if (w >= 500) return 'Medium';
  if (w <= 300) return 'Light';
  return 'Regular';
}

async function loadFontSafe(family, style, isItalic = false, postScriptName = null) {
  const fallback = isItalic ? 'Italic' : 'Regular';
  const cleanFamily = (family || 'Inter').replace(/['"]/g, '').trim();

  // Try real platform PostScript font name if provided by CDP
  const attempts = [];
  if (postScriptName) {
    attempts.push({ family: postScriptName, style });
    attempts.push({ family: postScriptName, style: fallback });
  }

  // Popular font aliases and fallbacks
  const familyCandidates = [cleanFamily];
  if (cleanFamily.toLowerCase().includes('sans-serif') || cleanFamily.toLowerCase().includes('system-ui') || cleanFamily.toLowerCase().includes('apple-system') || cleanFamily.toLowerCase().includes('blinkmacsystemfont')) {
    familyCandidates.unshift('Inter');
  }

  for (const fam of familyCandidates) {
    attempts.push({ family: fam, style });
    attempts.push({ family: fam, style: fallback });
  }

  // Standard universal web fonts
  const universal = ['Inter', 'Roboto', 'Open Sans', 'Lato'];
  for (const u of universal) {
    attempts.push({ family: u, style });
    attempts.push({ family: u, style: fallback });
  }

  for (const f of attempts) {
    try {
      await figma.loadFontAsync(f);
      return f;
    } catch {}
  }
  return { family: 'Inter', style: 'Regular' };
}

// Compute Figma GradientTransform matrix from CSS angle in degrees
function getFigmaGradientTransform(angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [cos, -sin, 0.5 - 0.5 * cos + 0.5 * sin],
    [sin, cos, 0.5 - 0.5 * sin - 0.5 * cos]
  ];
}

// Build Figma Gradient Fill
function buildGradientFill(gradData) {
  if (!gradData || !gradData.stops || gradData.stops.length < 2) return null;
  const gradientStops = [];
  for (const s of gradData.stops) {
    const c = parseColor(s.color);
    if (c) {
      gradientStops.push({
        position: s.position,
        color: { r: c.color.r, g: c.color.g, b: c.color.b, a: c.opacity }
      });
    }
  }
  if (gradientStops.length < 2) return null;
  const angle = gradData.angle !== undefined ? gradData.angle : 180;
  return {
    type: gradData.type === 'GRADIENT_RADIAL' ? 'GRADIENT_RADIAL' : 'GRADIENT_LINEAR',
    gradientStops,
    gradientTransform: getFigmaGradientTransform(angle)
  };
}

// Build 1:1 Figma Node
async function buildFigmaNode(nodeData, options = {}) {
  if (!nodeData) return null;

  const { type, bounds, name } = nodeData;
  const width = Math.max(1, bounds?.width || 10);
  const height = Math.max(1, bounds?.height || 10);
  const x = bounds?.x || 0;
  const y = bounds?.y || 0;

  // 1. Text Node
  if (type === 'text') {
    const textNode = figma.createText();
    textNode.name = name || 'Text';
    textNode.x = x;
    textNode.y = y;

    const isItalic = nodeData.style?.fontStyle === 'italic';
    const fontStyle = getFontStyle(nodeData.style?.fontWeight, isItalic);
    const targetFamily = nodeData.style?.fontFamily || 'Inter';
    const postScriptName = nodeData.postScriptName || nodeData.style?.postScriptName || null;
    textNode.fontName = await loadFontSafe(targetFamily, fontStyle, isItalic, postScriptName);

    textNode.characters = nodeData.text || '';
    if (nodeData.style?.fontSize) {
      textNode.fontSize = Math.max(8, nodeData.style.fontSize);
    }
    if (nodeData.style?.lineHeight && nodeData.style.lineHeight > 0) {
      textNode.lineHeight = { value: nodeData.style.lineHeight, unit: 'PIXELS' };
    }

    const textColor = parseColor(nodeData.style?.color);
    if (textColor) {
      textNode.fills = [{ type: 'SOLID', color: textColor.color, opacity: textColor.opacity }];
    }

    // Alignments
    if (nodeData.style?.textAlign === 'center') textNode.textAlignHorizontal = 'CENTER';
    else if (nodeData.style?.textAlign === 'right') textNode.textAlignHorizontal = 'RIGHT';
    else if (nodeData.style?.textAlign === 'justify') textNode.textAlignHorizontal = 'JUSTIFIED';
    else textNode.textAlignHorizontal = 'LEFT';

    // Typography: Text Case (Transform)
    const tt = nodeData.style?.textTransform;
    if (tt === 'uppercase') textNode.textCase = 'UPPER';
    else if (tt === 'lowercase') textNode.textCase = 'LOWER';
    else if (tt === 'capitalize') textNode.textCase = 'TITLE';

    // Typography: Text Decoration
    const td = nodeData.style?.textDecoration;
    if (td && td.includes('underline')) textNode.textDecoration = 'UNDERLINE';
    else if (td && td.includes('line-through')) textNode.textDecoration = 'STRIKETHROUGH';

    // Typography: Letter Spacing
    if (nodeData.style?.letterSpacing !== undefined && nodeData.style?.letterSpacing !== 0) {
      textNode.letterSpacing = { value: nodeData.style.letterSpacing, unit: 'PIXELS' };
    }

    // Rotation
    if (nodeData.rotation) {
      try { textNode.rotation = -nodeData.rotation; } catch {}
    }

    if (nodeData.opacity !== undefined && nodeData.opacity < 1) {
      try { textNode.opacity = nodeData.opacity; } catch {}
    }

    // Interactive Hyperlink on Text
    if (nodeData.href && textNode.characters.length > 0) {
      try {
        textNode.setRangeHyperlink(0, textNode.characters.length, { type: 'URL', value: nodeData.href });
      } catch {}
    }

    // Styled Text Ranges (for inline spans with different colors, font weights, or links)
    if (nodeData.ranges && nodeData.ranges.length > 0) {
      for (const r of nodeData.ranges) {
        if (r.start >= 0 && r.end <= textNode.characters.length && r.start < r.end) {
          if (r.color) {
            const rangeCol = parseColor(r.color);
            if (rangeCol) {
              try {
                textNode.setRangeFills(r.start, r.end, [{
                  type: 'SOLID',
                  color: rangeCol.color,
                  opacity: rangeCol.opacity
                }]);
              } catch {}
            }
          }
          if (r.href) {
            try {
              textNode.setRangeHyperlink(r.start, r.end, { type: 'URL', value: r.href });
            } catch {}
          }
          if (r.fontWeight || r.fontFamily || r.fontStyle) {
            const rangeItalic = (r.fontStyle || nodeData.style?.fontStyle) === 'italic';
            const rangeStyle = getFontStyle(r.fontWeight || nodeData.style?.fontWeight, rangeItalic);
            const rangeFamily = r.fontFamily || targetFamily;
            try {
              const rangeFont = await loadFontSafe(rangeFamily, rangeStyle, rangeItalic);
              textNode.setRangeFontName(r.start, r.end, rangeFont);
            } catch {}
          }
        }
      }
    }

    // High-Fidelity Text Auto-Wrapping & Bounding Box Sizing
    const isSingleLine = nodeData.isSingleLine || (nodeData.style?.whiteSpace === 'nowrap');
    const targetWidth = Math.max(1, width);
    const targetHeight = Math.max(1, height);

    try {
      if (isSingleLine || targetWidth <= 12) {
        textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
      } else {
        // Multi-line paragraph, quote or heading: lock width so text wraps across multiple lines!
        textNode.textAutoResize = 'NONE';
        textNode.resize(targetWidth, targetHeight);
        textNode.textAutoResize = 'HEIGHT';
      }
    } catch (e) {
      console.warn('Text resize notice:', e);
    }

    return textNode;
  }

  // 2. SVG Vector Node
  if (type === 'svg' && nodeData.svg) {
    try {
      const svgNode = figma.createNodeFromSvg(nodeData.svg);
      svgNode.name = name || 'Icon';
      svgNode.x = x;
      svgNode.y = y;
      if (width > 0 && height > 0) {
        svgNode.resize(width, height);
      }
      if (nodeData.rotation) {
        try { svgNode.rotation = -nodeData.rotation; } catch {}
      }
      if (nodeData.opacity !== undefined && nodeData.opacity < 1) {
        try { svgNode.opacity = nodeData.opacity; } catch {}
      }
      return svgNode;
    } catch (e) {
      console.warn('SVG parse error', e);
    }
  }

  // 3. Image Node
  if (type === 'image') {
    const rectNode = figma.createRectangle();
    rectNode.name = name || 'Image';
    rectNode.resize(width, height);
    rectNode.x = x;
    rectNode.y = y;

    if (nodeData.imageBytes) {
      try {
        const image = figma.createImage(new Uint8Array(nodeData.imageBytes));
        rectNode.fills = [{
          type: 'IMAGE',
          imageHash: image.hash,
          scaleMode: nodeData.objectFit === 'contain' || nodeData.objectFit === 'scale-down' ? 'FIT' : 'FILL'
        }];
      } catch {
        rectNode.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
      }
    } else {
      rectNode.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
    }

    if (nodeData.borderRadius) {
      const maxR = Math.min((nodeData.bounds?.width || 100) / 2, (nodeData.bounds?.height || 100) / 2);
      rectNode.topLeftRadius = Math.min(nodeData.borderRadius.topLeft || 0, maxR);
      rectNode.topRightRadius = Math.min(nodeData.borderRadius.topRight || 0, maxR);
      rectNode.bottomRightRadius = Math.min(nodeData.borderRadius.bottomRight || 0, maxR);
      rectNode.bottomLeftRadius = Math.min(nodeData.borderRadius.bottomLeft || 0, maxR);
    }
    if (nodeData.rotation) {
      try { rectNode.rotation = -nodeData.rotation; } catch {}
    }
    if (nodeData.opacity !== undefined && nodeData.opacity < 1) {
      try { rectNode.opacity = nodeData.opacity; } catch {}
    }
    return rectNode;
  }

  // 4. Container Frame Node
  const frame = figma.createFrame();
  frame.name = name || 'Frame';
  frame.resize(width, height);
  frame.x = x;
  frame.y = y;

  // Staked Fills (Solid + Gradient + Background Image)
  const fills = [];
  const bg = parseColor(nodeData.backgroundColor);
  if (bg) {
    fills.push({ type: 'SOLID', color: bg.color, opacity: bg.opacity });
  }
  if (nodeData.gradient) {
    const gradFill = buildGradientFill(nodeData.gradient);
    if (gradFill) fills.push(gradFill);
  }
  if (nodeData.bgImageBytes) {
    try {
      const bgImg = figma.createImage(new Uint8Array(nodeData.bgImageBytes));
      fills.push({ type: 'IMAGE', imageHash: bgImg.hash, scaleMode: 'FILL' });
    } catch {}
  }
  frame.fills = fills;

  // 4-Sided Independent Borders & Strokes
  if (nodeData.border) {
    const b = nodeData.border;
    const maxStroke = Math.max(b.widthTop || 0, b.widthRight || 0, b.widthBottom || 0, b.widthLeft || 0);
    if (maxStroke > 0) {
      const borderColor = parseColor(b.colorTop || b.color || b.colorBottom);
      if (borderColor) {
        frame.strokes = [{ type: 'SOLID', color: borderColor.color, opacity: borderColor.opacity }];
        frame.strokeAlign = 'INSIDE';
        frame.strokeTopWeight = b.widthTop || 0;
        frame.strokeRightWeight = b.widthRight || 0;
        frame.strokeBottomWeight = b.widthBottom || 0;
        frame.strokeLeftWeight = b.widthLeft || 0;
        if (b.styleTop === 'dashed') frame.dashPattern = [4, 4];
        else if (b.styleTop === 'dotted') frame.dashPattern = [1, 2];
      }
    }
  }

  // Corner Radius
  if (nodeData.borderRadius) {
    const maxR = Math.min((nodeData.bounds?.width || 100) / 2, (nodeData.bounds?.height || 100) / 2);
    frame.topLeftRadius = Math.min(nodeData.borderRadius.topLeft || 0, maxR);
    frame.topRightRadius = Math.min(nodeData.borderRadius.topRight || 0, maxR);
    frame.bottomRightRadius = Math.min(nodeData.borderRadius.bottomRight || 0, maxR);
    frame.bottomLeftRadius = Math.min(nodeData.borderRadius.bottomLeft || 0, maxR);
  }

  // Effects: Drop Shadows + Glassmorphism Backdrop Blur + Layer Blur
  const effects = [];
  if (nodeData.shadows && nodeData.shadows.length > 0) {
    for (const s of nodeData.shadows) {
      const c = parseColor(s.color);
      if (c) {
        effects.push({
          type: s.isInset ? 'INNER_SHADOW' : 'DROP_SHADOW',
          color: { r: c.color.r, g: c.color.g, b: c.color.b, a: c.opacity },
          offset: { x: s.x, y: s.y },
          radius: s.blur,
          spread: s.spread,
          visible: true,
          blendMode: 'NORMAL'
        });
      }
    }
  }
  if (nodeData.blurs && nodeData.blurs.length > 0) {
    for (const b of nodeData.blurs) {
      effects.push({
        type: b.type,
        radius: b.radius,
        visible: true
      });
    }
  }
  if (effects.length > 0) {
    frame.effects = effects;
  }

  // Rotation & Opacity & CSS Blend Modes
  if (nodeData.rotation) {
    try { frame.rotation = -nodeData.rotation; } catch {}
  }
  if (nodeData.opacity !== undefined && nodeData.opacity < 1) {
    try { frame.opacity = nodeData.opacity; } catch {}
  }
  if (nodeData.blendMode) {
    const BLEND_MODES = {
      'multiply': 'MULTIPLY',
      'screen': 'SCREEN',
      'overlay': 'OVERLAY',
      'darken': 'DARKEN',
      'lighten': 'LIGHTEN',
      'color-dodge': 'COLOR_DODGE',
      'color-burn': 'COLOR_BURN',
      'hard-light': 'HARD_LIGHT',
      'soft-light': 'SOFT_LIGHT',
      'difference': 'DIFFERENCE',
      'exclusion': 'EXCLUSION',
      'hue': 'HUE',
      'saturation': 'SATURATION',
      'color': 'COLOR',
      'luminosity': 'LUMINOSITY'
    };
    const fMode = BLEND_MODES[nodeData.blendMode.toLowerCase()];
    if (fMode) {
      try { frame.blendMode = fMode; } catch {}
    }
  }

  // Interactive Hyperlink on Frame (Saved to Plugin Data & Relaunch)
  if (nodeData.href) {
    try {
      frame.setPluginData('url', nodeData.href);
      frame.setRelaunchData({ open: nodeData.href });
    } catch {}
  }

  // Overflow / Clip Content & Vector Clip Paths
  if (nodeData.overflow === 'hidden' || nodeData.overflow === 'clip' || nodeData.clipPath) {
    frame.clipsContent = true;
  }

  // Layout mode logic: Auto-Layout Engine v3.3.0 Pro
  const useAutoLayout = (options.layoutMode !== 'pixel-perfect') && !!nodeData.autoLayout;
  if (useAutoLayout) {
    const al = nodeData.autoLayout;
    if (al.display === 'flex' || al.display === 'inline-flex') {
      frame.layoutMode = al.flexDirection === 'column' ? 'VERTICAL' : 'HORIZONTAL';
      frame.itemSpacing = al.gap || 0;
      frame.paddingTop = al.paddingTop || 0;
      frame.paddingRight = al.paddingRight || 0;
      frame.paddingBottom = al.paddingBottom || 0;
      frame.paddingLeft = al.paddingLeft || 0;

      if (al.flexWrap === 'wrap') {
        try {
          frame.layoutWrap = 'WRAP';
          if (al.gapY !== undefined) {
            frame.counterAxisSpacing = al.gapY;
          }
        } catch {}
      }

      if (al.alignItems === 'center') frame.counterAxisAlignItems = 'CENTER';
      else if (al.alignItems === 'flex-end') frame.counterAxisAlignItems = 'MAX';
      else frame.counterAxisAlignItems = 'MIN';

      if (al.justifyContent === 'center') frame.primaryAxisAlignItems = 'CENTER';
      else if (al.justifyContent === 'space-between') frame.primaryAxisAlignItems = 'SPACE_BETWEEN';
      else if (al.justifyContent === 'flex-end') frame.primaryAxisAlignItems = 'MAX';
      else frame.primaryAxisAlignItems = 'MIN';
    } else if (al.display === 'grid' || al.display === 'inline-grid' || al.isGrid) {
      // In Figma Auto-Layout v4, CSS Grid with multiple columns maps directly to WRAP layout!
      frame.layoutMode = 'HORIZONTAL';
      try {
        frame.layoutWrap = 'WRAP';
      } catch {}
      frame.itemSpacing = al.gap || 0;
      frame.counterAxisSpacing = al.gapY !== undefined ? al.gapY : (al.gap || 0);
      frame.paddingTop = al.paddingTop || 0;
      frame.paddingRight = al.paddingRight || 0;
      frame.paddingBottom = al.paddingBottom || 0;
      frame.paddingLeft = al.paddingLeft || 0;

      if (al.alignItems === 'center') frame.counterAxisAlignItems = 'CENTER';
      else if (al.alignItems === 'flex-end') frame.counterAxisAlignItems = 'MAX';
      else frame.counterAxisAlignItems = 'MIN';

      if (al.justifyContent === 'center') frame.primaryAxisAlignItems = 'CENTER';
      else if (al.justifyContent === 'space-between') frame.primaryAxisAlignItems = 'SPACE_BETWEEN';
      else if (al.justifyContent === 'flex-end') frame.primaryAxisAlignItems = 'MAX';
      else frame.primaryAxisAlignItems = 'MIN';
    } else if (nodeData.children && nodeData.children.length > 1) {
      // Standard HTML Block Flow: sequential vertical children automatically form VERTICAL auto-layout
      const inFlowChildren = nodeData.children.filter(c => !c.isAbsolute);
      if (inFlowChildren.length > 1) {
        let isVertical = true;
        for (let i = 1; i < inFlowChildren.length; i++) {
          if (inFlowChildren[i].bounds.y + 4 < inFlowChildren[i - 1].bounds.y) {
            isVertical = false;
            break;
          }
        }
        if (isVertical) {
          frame.layoutMode = 'VERTICAL';
          let totalGap = 0;
          let gapCount = 0;
          for (let i = 1; i < inFlowChildren.length; i++) {
            const prevBottom = inFlowChildren[i - 1].bounds.y + inFlowChildren[i - 1].bounds.height;
            const curTop = inFlowChildren[i].bounds.y;
            const g = curTop - prevBottom;
            if (g >= 0 && g < 150) {
              totalGap += g;
              gapCount++;
            }
          }
          frame.itemSpacing = gapCount > 0 ? Math.round(totalGap / gapCount) : (al.gap || 0);
          frame.paddingTop = al.paddingTop || 0;
          frame.paddingRight = al.paddingRight || 0;
          frame.paddingBottom = al.paddingBottom || 0;
          frame.paddingLeft = al.paddingLeft || 0;
        }
      }
    }
  }

  // Recursively process children
  if (nodeData.children && nodeData.children.length > 0) {
    for (const childData of nodeData.children) {
      const childNode = await buildFigmaNode(childData, options);
      if (childNode) {
        frame.appendChild(childNode);

        // Crucial: In Auto-Layout frames, mark absolute elements as ABSOLUTE positioning!
        if (frame.layoutMode !== 'NONE' && childData.isAbsolute) {
          try {
            childNode.layoutPositioning = 'ABSOLUTE';
            childNode.x = childData.bounds.x;
            childNode.y = childData.bounds.y;
          } catch {}
        } else if (frame.layoutMode !== 'NONE') {
          // Dynamic Auto-Layout Sizing (Fill, Hug, Stretch, Fixed)
          try {
            const fc = childData.flexChild || {};
            const isHorizontal = frame.layoutMode === 'HORIZONTAL';
            const isParentGrid = Boolean(nodeData.autoLayout?.isGrid || nodeData.autoLayout?.display?.includes('grid'));

            // In grid wrap containers, children keep their calculated column width!
            if (isParentGrid && childData.bounds?.width > 0) {
              try {
                childNode.layoutSizingHorizontal = 'FIXED';
                childNode.resize(childData.bounds.width, childNode.height);
              } catch {}
            } else {
              // 1. Primary Axis Fill / Grow
              if (fc.grow > 0 || (isHorizontal && fc.isFullWidth) || (!isHorizontal && fc.isFullHeight)) {
                try { childNode.layoutGrow = 1; } catch {}
                if (isHorizontal) {
                  try { childNode.layoutSizingHorizontal = 'FILL'; } catch {}
                } else {
                  try { childNode.layoutSizingVertical = 'FILL'; } catch {}
                }
              }

              // 2. Counter Axis Stretch / Fill
              if (fc.alignSelf === 'stretch' || (isHorizontal && fc.isFullHeight) || (!isHorizontal && fc.isFullWidth)) {
                try { childNode.layoutAlign = 'STRETCH'; } catch {}
                if (isHorizontal) {
                  try { childNode.layoutSizingVertical = 'FILL'; } catch {}
                } else {
                  try { childNode.layoutSizingHorizontal = 'FILL'; } catch {}
                }
              }
            }

            // 3. Preserve captured text widths in vertical containers. Filling every
            // multiline text node makes constrained headings expand to the parent
            // width and changes the browser's original line breaks.
            if (childData.type === 'text') {
              try {
                const isSingleLine = childData.isSingleLine || childData.style?.whiteSpace === 'nowrap';
                if (!isHorizontal) {
                  // Inside a VERTICAL container (e.g. Card, Column, List)
                  if (isSingleLine) {
                    childNode.layoutSizingHorizontal = 'HUG';
                  } else if (fc.isFullWidth || fc.alignSelf === 'stretch') {
                    childNode.layoutAlign = 'STRETCH';
                    childNode.layoutSizingHorizontal = 'FILL';
                    childNode.textAutoResize = 'HEIGHT';
                  } else {
                    // Keep the measured browser width for max-width headings and
                    // other constrained text blocks.
                    childNode.layoutSizingHorizontal = 'FIXED';
                    childNode.textAutoResize = 'HEIGHT';
                  }
                  childNode.layoutSizingVertical = 'HUG';
                } else {
                  // Inside a HORIZONTAL container (e.g. Nav row, Tag list)
                  if (fc.grow > 0 || fc.isFullWidth) {
                    childNode.layoutAlign = 'STRETCH';
                    childNode.layoutSizingHorizontal = 'FILL';
                    childNode.textAutoResize = 'HEIGHT';
                  } else {
                    childNode.layoutSizingHorizontal = 'HUG';
                  }
                  childNode.layoutSizingVertical = 'HUG';
                }
              } catch {}
            }
          } catch {}
        }
      }
    }
  }

  return frame;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'import-zcrap') {
    try {
      const payload = msg.data;
      if (!payload || !payload.rootNode) {
        figma.notify('❌ Invalid Zcrap payload.');
        return;
      }

      figma.notify('⏳ Building 1:1 Figma layers...');

      const rootNode = await buildFigmaNode(payload.rootNode, {
        layoutMode: msg.layoutMode || 'autolayout'
      });

      if (rootNode) {
        rootNode.name = payload.title ? `${payload.title}` : 'Imported Web Page';
        figma.currentPage.appendChild(rootNode);
        figma.viewport.scrollAndZoomIntoView([rootNode]);
        try {
          rootNode.setRelaunchData({ open: 'Open Zcrap importer for this frame' });
        } catch {}
        figma.notify('🎉 1:1 Web UI imported successfully!');
      }

      figma.ui.postMessage({ type: 'done' });
    } catch (err) {
      console.error(err);
      figma.notify('⚠️ Import failed: ' + err.message);
      figma.ui.postMessage({ type: 'error', message: err.message });
    }
  }

  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};
