// Zcrap Popup Script - html.to.design style UI & Features
document.addEventListener('DOMContentLoaded', async () => {
  const btnCopyFull = document.getElementById('btn-copy-full');
  const btnInspect = document.getElementById('btn-inspect');
  const btnDownload = document.getElementById('btn-download');
  const btnScreenshot = document.getElementById('btn-screenshot');
  const btnDesignSystem = document.getElementById('btn-design-system');
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const browserWidthLabel = document.getElementById('browser-width-label');

  function setStatus(text, isLoading = false, isSuccess = false) {
    statusText.textContent = text;
    statusDot.className = 'status-dot' + (isLoading ? ' loading' : '');
    statusDot.style.background = isLoading ? '#F59E0B' : (isSuccess ? '#10B981' : '#0D99FF');
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

  // Ensure content script is active on tab
  async function ensureContentScript(tabId, tabUrl) {
    if (!tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('chrome-extension://') || tabUrl.startsWith('about:') || tabUrl.includes('chromewebstore.google.com')) {
      throw new Error('Chrome blocks extensions on internal pages. Open any normal site (e.g. google.com, stripe.com).');
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
    await new Promise(r => setTimeout(r, 120));
    return true;
  }

  // Dynamically update active browser tab width
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && !tab.url.startsWith('chrome://')) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.innerWidth
      });
      if (results && results[0] && results[0].result) {
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
        setStatus('No active tab found.');
        return;
      }
      tabId = tab.id;

      await ensureContentScript(tab.id, tab.url);

      // Pre-clean JS scroll smoothers (GSAP ScrollSmoother, AOS, Lenis) & attach CDP
      await chrome.runtime.sendMessage({ action: 'clean_scroll_libraries', tabId }).catch(() => {});
      await chrome.runtime.sendMessage({ action: 'cdp_attach', tabId }).catch(() => {});

      chrome.tabs.sendMessage(tab.id, { action: 'capture_full', autoScroll: true, useCdp: true }, async (response) => {
        // Cleanly detach CDP after capture
        chrome.runtime.sendMessage({ action: 'cdp_detach', tabId }).catch(() => {});

        if (chrome.runtime.lastError) {
          setStatus('Error: ' + chrome.runtime.lastError.message);
          return;
        }

        if (response && response.success) {
          const directPasteData = response.directPasteSvg || response.jsonString || JSON.stringify(response.data);
          await copyToClipboard(directPasteData);
          setStatus('🎉 Copied! Paste directly in Figma (Ctrl+V) — No plugin needed!', false, true);
        } else {
          setStatus('Capture failed: ' + (response?.error || 'Unknown error'));
        }
      });
    } catch (err) {
      if (tabId) chrome.runtime.sendMessage({ action: 'cdp_detach', tabId }).catch(() => {});
      setStatus('⚠️ ' + err.message);
    }
  });

  // 2. Capture Selection (Yellow Button)
  btnInspect.addEventListener('click', async () => {
    setStatus('Hover & click element to copy...', true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      await ensureContentScript(tab.id, tab.url);

      // Pre-clean JS scroll smoothers
      await chrome.runtime.sendMessage({ action: 'clean_scroll_libraries', tabId: tab.id }).catch(() => {});

      // Send inspect request — content.js handles clipboard & toast on its own
      chrome.tabs.sendMessage(tab.id, { action: 'start_inspect', useCdp: true });

      // Close popup so user can click element on webpage
      setTimeout(() => window.close(), 150);
    } catch (err) {
      setStatus('⚠️ ' + err.message);
    }
  });

  // 3. Record Flow / Download .zcrap File (Dark Button)
  btnDownload.addEventListener('click', async () => {
    setStatus('🔄 Auto-scrolling & generating .zcrap...', true);
    let tabId = null;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      tabId = tab.id;

      await ensureContentScript(tab.id, tab.url);

      // Pre-clean JS scroll smoothers & attach CDP
      await chrome.runtime.sendMessage({ action: 'clean_scroll_libraries', tabId }).catch(() => {});
      await chrome.runtime.sendMessage({ action: 'cdp_attach', tabId }).catch(() => {});

      chrome.tabs.sendMessage(tab.id, { action: 'capture_full', autoScroll: true, useCdp: true }, (response) => {
        // Cleanly detach CDP
        chrome.runtime.sendMessage({ action: 'cdp_detach', tabId }).catch(() => {});

        if (chrome.runtime.lastError) {
          setStatus('Error: ' + chrome.runtime.lastError.message);
          return;
        }

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
          setStatus('Failed to export file.');
        }
      });
    } catch (err) {
      if (tabId) chrome.runtime.sendMessage({ action: 'cdp_detach', tabId }).catch(() => {});
      setStatus('⚠️ ' + err.message);
    }
  });

  // 4. Screenshot Page (High-res PNG)
  btnScreenshot.addEventListener('click', async () => {
    setStatus('Capturing high-res PNG...', true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      if (dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        const cleanName = (tab.title || 'screenshot').replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `${cleanName}.png`;
        a.click();
        setStatus('📷 Screenshot saved to Downloads!', false, true);
      }
    } catch (err) {
      setStatus('⚠️ ' + err.message);
    }
  });

  // 5. Extract Design System (Colors, Typography & Tokens)
  btnDesignSystem.addEventListener('click', async () => {
    setStatus('Extracting design tokens...', true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      await ensureContentScript(tab.id, tab.url);

      chrome.tabs.sendMessage(tab.id, { action: 'capture_full' }, async (response) => {
        if (chrome.runtime.lastError) {
          setStatus('Error: ' + chrome.runtime.lastError.message);
          return;
        }
        if (response && response.success) {
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
            pageTitle: response.data.title,
            url: response.data.url,
            colorPalette: Array.from(colors),
            typography: Array.from(fonts)
          };

          const json = JSON.stringify(tokens, null, 2);
          await copyToClipboard(json);
          setStatus('🎨 Design tokens copied to clipboard!', false, true);
        }
      });
    } catch (err) {
      setStatus('⚠️ ' + err.message);
    }
  });

  // Keyboard shortcut: Alt+Shift+E
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.code === 'KeyE') {
      btnCopyFull.click();
    }
  });
});
