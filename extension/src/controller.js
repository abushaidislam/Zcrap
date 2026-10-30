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
