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
