// Zcrap Popup Script - html.to.design style UI & Features (v3.4.1 Pro)
document.addEventListener('DOMContentLoaded', async () => {
  const btnCopyFull = document.getElementById('btn-copy-full');
  const btnInspect = document.getElementById('btn-inspect');
  const btnDownload = document.getElementById('btn-download');
  const btnScreenshot = document.getElementById('btn-screenshot');
  const btnDesignSystem = document.getElementById('btn-design-system');
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const browserWidthLabel = document.getElementById('browser-width-label');

  let activeTimeout = null;

  function setStatus(text, isLoading = false, isSuccess = false) {
    if (activeTimeout) {
      clearTimeout(activeTimeout);
      activeTimeout = null;
    }
    statusText.textContent = text;
    statusDot.className = 'status-dot' + (isLoading ? ' loading' : '');
    statusDot.style.background = isLoading ? '#F59E0B' : (isSuccess ? '#10B981' : '#0D99FF');

    if (isLoading) {
      activeTimeout = setTimeout(() => {
        setStatus('⚠️ Operation is taking longer than usual. Please refresh the tab if stuck.');
      }, 45000);
    }
  }

  // Direct Paste Figma Clipboard Writer (HTML/SVG Vector + Plain Text)
  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([text], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' })
          })
        ]);
        return true;
      } catch (err) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {}
      }
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      ta.remove();
      return false;
    }
  }

  // Ensure content script is active on tab with verification retry loop
  async function ensureContentScript(tabId, tabUrl) {
    if (!tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('brave://') || tabUrl.startsWith('opera://') || tabUrl.startsWith('chrome-extension://') || tabUrl.startsWith('about:') || tabUrl.includes('chromewebstore.google.com')) {
      throw new Error('Chrome blocks extensions on internal/system pages. Open any normal site (e.g. google.com, stripe.com).');
    }

    try {
      const res = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (res?.pong) return true;
    } catch {}

    // Inject if not responding
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });

    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 80));
      try {
        const ping = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        if (ping?.pong) return true;
      } catch {}
    }
    return true;
  }

  // Read user theme choice (Browser / Light / Dark)
  function getSelectedTheme() {
    const dark = document.getElementById('theme-dark');
    const light = document.getElementById('theme-light');
    if (dark?.checked) return 'dark';
    if (light?.checked) return 'light';
    return 'default';
  }

  // Read user viewport selection
  function getSelectedViewportWidth() {
    const vpBrowser = document.getElementById('vp-browser');
    if (vpBrowser?.checked) return null;
    const checks = [
      { id: 'vp-1920', val: 1920 },
      { id: 'vp-1440', val: 1440 },
      { id: 'vp-1024', val: 1024 },
      { id: 'vp-768', val: 768 },
      { id: 'vp-390', val: 390 }
    ];
    for (const c of checks) {
      const el = document.getElementById(c.id);
      if (el?.checked) {
        const input = el.parentElement?.querySelector('.px-input');
        const customVal = parseInt(input?.value, 10);
        return (!isNaN(customVal) && customVal > 0) ? customVal : c.val;
      }
    }
    return null;
  }

  // Viewport checkboxes: handle mutual selection
  const vpCheckboxes = ['vp-browser', 'vp-1920', 'vp-1440', 'vp-1024', 'vp-768', 'vp-390'];
  vpCheckboxes.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        if (el.checked) {
          vpCheckboxes.forEach(otherId => {
            if (otherId !== id) {
              const other = document.getElementById(otherId);
              if (other) other.checked = false;
            }
          });
        }
      });
    }
  });

  // Apply CDP theme / viewport emulation if requested
  async function applyEmulationIfConfigured(tabId) {
    const theme = getSelectedTheme();
    const width = getSelectedViewportWidth();
    if (theme !== 'default' || width) {
      await chrome.runtime.sendMessage({
        action: 'cdp_emulate',
        tabId,
        width: width || undefined,
        theme: theme !== 'default' ? theme : undefined,
        isMobile: Boolean(width && width <= 768)
      }).catch(() => {});
    }
  }

  // Dynamically update active browser tab width
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.innerWidth
      }).catch(() => null);
      if (results && results[0] && typeof results[0].result === 'number' && results[0].result > 0) {
        browserWidthLabel.textContent = `Browser (${results[0].result}px)`;
      }
    }
  } catch {}

  // 1. Capture Full Page (Blue Button)
  btnCopyFull.addEventListener('click', async () => {
    setStatus('🔄 Auto-scrolling & loading lazy content...', true);
    let tabId = null;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setStatus('⚠️ No active tab found.');
        return;
      }
      tabId = tab.id;

      await ensureContentScript(tab.id, tab.url);

      // Pre-clean JS scroll smoothers (GSAP ScrollSmoother, AOS, Lenis) & attach CDP
      await chrome.runtime.sendMessage({ action: 'clean_scroll_libraries', tabId }).catch(() => {});
      await chrome.runtime.sendMessage({ action: 'cdp_attach', tabId }).catch(() => {});

      // Apply theme/viewport emulation if user selected non-default
      await applyEmulationIfConfigured(tabId);

      // Send capture request with Promise-based await
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'capture_full',
        autoScroll: true,
        useCdp: true
      });

      // Detach CDP cleanly
      await chrome.runtime.sendMessage({ action: 'cdp_detach', tabId }).catch(() => {});

      if (response && response.success) {
        const directPasteData = response.directPasteSvg || response.jsonString || JSON.stringify(response.data);
        await copyToClipboard(directPasteData);
        setStatus('🎉 Copied! Paste directly in Figma (Ctrl+V) — No plugin needed!', false, true);
      } else {
        setStatus('Capture failed: ' + (response?.error || 'Unknown error'));
      }
    } catch (err) {
      if (tabId) await chrome.runtime.sendMessage({ action: 'cdp_detach', tabId }).catch(() => {});
      setStatus('⚠️ ' + (err?.message || 'Capture failed'));
    }
  });

  // 2. Capture Selection (Yellow Button)
  btnInspect.addEventListener('click', async () => {
    setStatus('Hover & click element to copy...', true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setStatus('⚠️ No active tab found.');
        return;
      }

      await ensureContentScript(tab.id, tab.url);

      // Pre-clean JS scroll smoothers
      await chrome.runtime.sendMessage({ action: 'clean_scroll_libraries', tabId: tab.id }).catch(() => {});

      // Send inspect request
      chrome.tabs.sendMessage(tab.id, { action: 'start_inspect', useCdp: true }, () => {
        if (chrome.runtime.lastError) {
          console.debug('[Zcrap] Inspect start notice:', chrome.runtime.lastError.message);
        }
      });

      // Close popup so user can click element on webpage
      setTimeout(() => window.close(), 150);
    } catch (err) {
      setStatus('⚠️ ' + (err?.message || 'Inspect failed'));
    }
  });

  // 3. Record Flow / Download .zcrap File (Dark Button)
  btnDownload.addEventListener('click', async () => {
    setStatus('🔄 Auto-scrolling & generating .zcrap...', true);
    let tabId = null;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setStatus('⚠️ No active tab found.');
        return;
      }
      tabId = tab.id;

      await ensureContentScript(tab.id, tab.url);

      // Pre-clean JS scroll smoothers & attach CDP
      await chrome.runtime.sendMessage({ action: 'clean_scroll_libraries', tabId }).catch(() => {});
      await chrome.runtime.sendMessage({ action: 'cdp_attach', tabId }).catch(() => {});

      await applyEmulationIfConfigured(tabId);

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'capture_full',
        autoScroll: true,
        useCdp: true
      });

      await chrome.runtime.sendMessage({ action: 'cdp_detach', tabId }).catch(() => {});

      if (response?.success) {
        const json = response.jsonString || JSON.stringify(response.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cleanName = (tab.title || 'page').replace(/[^a-zA-Z0-9_-]/g, '_');
        a.href = url;
        a.download = `${cleanName}.zcrap`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus('💾 File downloaded! Drop into Figma plugin.', false, true);
      } else {
        setStatus('Failed to export file: ' + (response?.error || 'Unknown error'));
      }
    } catch (err) {
      if (tabId) await chrome.runtime.sendMessage({ action: 'cdp_detach', tabId }).catch(() => {});
      setStatus('⚠️ ' + (err?.message || 'Download failed'));
    }
  });

  // 4. Screenshot Page (High-res PNG)
  btnScreenshot.addEventListener('click', async () => {
    setStatus('Capturing high-res PNG...', true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setStatus('⚠️ No active tab found.');
        return;
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      if (dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        const cleanName = (tab.title || 'screenshot').replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `${cleanName}.png`;
        a.click();
        setStatus('📷 Screenshot saved to Downloads!', false, true);
      } else {
        setStatus('⚠️ Could not capture screenshot.');
      }
    } catch (err) {
      setStatus('⚠️ ' + (err?.message || 'Screenshot failed'));
    }
  });

  // 5. Extract Design System (Colors, Typography & Tokens)
  btnDesignSystem.addEventListener('click', async () => {
    setStatus('Extracting design tokens...', true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setStatus('⚠️ No active tab found.');
        return;
      }

      await ensureContentScript(tab.id, tab.url);

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'capture_full', autoScroll: false });
      if (response && response.success && response.data?.rootNode) {
        const colors = new Set();
        const fonts = new Set();

        function walk(n) {
          if (!n) return;
          if (n.backgroundColor) colors.add(n.backgroundColor);
          if (n.style?.color) colors.add(n.style.color);
          if (n.style?.fontFamily) fonts.add(n.style.fontFamily);
          if (n.children) n.children.forEach(walk);
        }
        walk(response.data.rootNode);

        const tokens = {
          appName: 'Zcrap Design System',
          pageTitle: response.data.title || 'Page',
          url: response.data.url || '',
          colorPalette: Array.from(colors),
          typography: Array.from(fonts)
        };

        const json = JSON.stringify(tokens, null, 2);
        await copyToClipboard(json);
        setStatus('🎨 Design tokens copied to clipboard!', false, true);
      } else {
        setStatus('⚠️ No structured design tokens found on page.');
      }
    } catch (err) {
      setStatus('⚠️ ' + (err?.message || 'Token extraction failed'));
    }
  });
});
