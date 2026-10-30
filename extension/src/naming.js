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

