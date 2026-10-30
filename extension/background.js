// Zcrap Background Service Worker — Chrome DevTools Protocol (CDP) & Workflow Manager (v3.8.2 Pro)

const activeCdpSessions = new Set();

// Reliable Blob to DataURL converter for Service Workers (no FileReader required)
async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 8192) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
  }
  const base64 = btoa(binary);
  const mimeType = blob.type || 'application/octet-stream';
  return `data:${mimeType};base64,${base64}`;
}

// Neutralize problematic smooth-scroll & parallax libraries in MAIN world before capture
async function neutralizeScrollLibraries(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        try {
          if (window.ScrollSmoother) {
            const s = window.ScrollSmoother.get ? window.ScrollSmoother.get() : window.ScrollSmoother;
            if (s && typeof s.kill === 'function') {
              const w = typeof s.wrapper === 'function' ? s.wrapper() : null;
              s.kill();
              if (w) {
                w.style.opacity = '1';
                w.style.overflow = 'visible';
                w.style.position = 'static';
              }
            }
          }
        } catch {}
        try {
          if (window.AOS && typeof window.AOS.init === 'function') {
            window.AOS.init({ once: true, duration: 0 });
          }
        } catch {}
        try {
          if (window.lenis && typeof window.lenis.destroy === 'function') {
            window.lenis.destroy();
          }
        } catch {}
      }
    });
  } catch (err) {
    console.debug('[Zcrap] Scroll cleaner notice:', err);
  }
}

// Check if CDP is attached even if Service Worker restarted
async function isCdpAttached(tabId) {
  if (!tabId) return false;
  if (activeCdpSessions.has(tabId)) return true;
  try {
    const targets = await chrome.debugger.getTargets();
    const isAttached = targets.some(t => t.tabId === tabId && t.attached);
    if (isAttached) {
      activeCdpSessions.add(tabId);
      return true;
    }
  } catch {}
  return false;
}

// Safely attach Chrome DevTools Protocol to target tab
async function attachCdp(tabId) {
  if (await isCdpAttached(tabId)) return true;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    activeCdpSessions.add(tabId);
    // Enable essential domains for accurate capture
    await Promise.allSettled([
      chrome.debugger.sendCommand({ tabId }, 'DOM.enable'),
      chrome.debugger.sendCommand({ tabId }, 'CSS.enable'),
      chrome.debugger.sendCommand({ tabId }, 'Page.enable')
    ]);
    return true;
  } catch (err) {
    if (err && err.message && err.message.includes('Already attached')) {
      activeCdpSessions.add(tabId);
      return true;
    }
    console.warn(`[Zcrap CDP] Failed to attach to tab ${tabId}:`, err);
    return false;
  }
}

// Safely detach CDP session
async function detachCdp(tabId) {
  if (!(await isCdpAttached(tabId))) return;
  try {
    await chrome.debugger.detach({ tabId });
  } catch {}
  activeCdpSessions.delete(tabId);
}

// Auto cleanup when tab closes or navigates
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await detachCdp(tabId);
});

chrome.debugger.onDetach.addListener((source) => {
  if (source?.tabId) {
    activeCdpSessions.delete(source.tabId);
  }
});

// CDP Command Dispatcher for Content Script & Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = request.tabId || sender.tab?.id;

  // 0. Neutralize JS Scroll / Parallax libraries
  if (request.action === 'clean_scroll_libraries') {
    (async () => {
      if (tabId) await neutralizeScrollLibraries(tabId);
      sendResponse({ success: true });
    })();
    return true;
  }

  // 0.1 Discover all sub-frames across domains
  if (request.action === 'get_all_frames') {
    (async () => {
      try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        sendResponse({ success: true, frames });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 1. Attach CDP Session
  if (request.action === 'cdp_attach') {
    (async () => {
      const ok = await attachCdp(tabId);
      sendResponse({ success: ok });
    })();
    return true;
  }

  // 2. Detach CDP Session
  if (request.action === 'cdp_detach') {
    (async () => {
      await detachCdp(tabId);
      sendResponse({ success: true });
    })();
    return true;
  }

  // 3. Get Real OS Platform Fonts for Node (CSS.getPlatformFontsForNode)
  if (request.action === 'cdp_get_platform_fonts') {
    (async () => {
      if (!tabId || !(await isCdpAttached(tabId))) {
        sendResponse({ success: false, error: 'CDP not attached' });
        return;
      }
      try {
        const { backendNodeId, nodeId } = request;
        let targetNodeId = nodeId;
        if (!targetNodeId && backendNodeId) {
          const pushRes = await chrome.debugger.sendCommand({ tabId }, 'DOM.pushNodesByBackendIdsToFrontend', {
            backendNodeIds: [backendNodeId]
          });
          targetNodeId = pushRes.nodeIds?.[0];
        }
        if (!targetNodeId) {
          sendResponse({ success: false, error: 'Node not found' });
          return;
        }

        const res = await chrome.debugger.sendCommand({ tabId }, 'CSS.getPlatformFontsForNode', {
          nodeId: targetNodeId
        });
        const fonts = (res.fonts || [])
          .sort((a, b) => b.glyphCount - a.glyphCount)
          .map(({ familyName, postScriptName }) => ({ familyName, postScriptName }));
        sendResponse({ success: true, fonts });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 4. Get Box Model with Subpixel Precision (DOM.getBoxModel)
  if (request.action === 'cdp_get_box_model') {
    (async () => {
      if (!tabId || !(await isCdpAttached(tabId))) {
        sendResponse({ success: false, error: 'CDP not attached' });
        return;
      }
      try {
        const res = await chrome.debugger.sendCommand({ tabId }, 'DOM.getBoxModel', {
          nodeId: request.nodeId,
          backendNodeId: request.backendNodeId
        });
        sendResponse({ success: true, model: res.model });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 5. Get Content Quads for Rotated/Transformed Nodes (DOM.getContentQuads)
  if (request.action === 'cdp_get_content_quads') {
    (async () => {
      if (!tabId || !(await isCdpAttached(tabId))) {
        sendResponse({ success: false, error: 'CDP not attached' });
        return;
      }
      try {
        const res = await chrome.debugger.sendCommand({ tabId }, 'DOM.getContentQuads', {
          nodeId: request.nodeId,
          backendNodeId: request.backendNodeId
        });
        sendResponse({ success: true, quads: res.quads });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 6. Direct Resource Extraction from Browser Cache (Bypassing CORS)
  if (request.action === 'cdp_get_resource_content') {
    (async () => {
      const url = request.url;
      if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:'))) {
        sendResponse({ success: false, error: 'Invalid or unsupported resource URL' });
        return;
      }

      if (!tabId || !(await isCdpAttached(tabId))) {
        // Fallback: fetch via background worker (avoids CORS restrictions in extension background)
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const dataUrl = await blobToDataUrl(blob);
          sendResponse({ success: true, content: dataUrl, mimeType: blob.type, isDataUrl: true });
        } catch (fetchErr) {
          sendResponse({ success: false, error: fetchErr.message });
        }
        return;
      }
      try {
        // Find frameTree
        const tree = await chrome.debugger.sendCommand({ tabId }, 'Page.getResourceTree');
        const frameId = request.frameId || tree.frameTree.frame.id;
        const res = await chrome.debugger.sendCommand({ tabId }, 'Page.getResourceContent', {
          frameId,
          url
        });
        sendResponse({
          success: true,
          content: res.content,
          base64Encoded: res.base64Encoded,
          mimeType: request.mimeType || 'application/octet-stream'
        });
      } catch (err) {
        // Graceful fallback to background fetch with exact fetchErr message
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const dataUrl = await blobToDataUrl(blob);
          sendResponse({ success: true, content: dataUrl, mimeType: blob.type, isDataUrl: true });
        } catch (fetchErr) {
          sendResponse({ success: false, error: fetchErr.message });
        }
      }
    })();
    return true;
  }

  // 7. Device Metrics and Color Scheme Emulation (Mobile/Tablet/Dark Mode)
  if (request.action === 'cdp_emulate') {
    (async () => {
      if (!tabId || !(await isCdpAttached(tabId))) {
        sendResponse({ success: false, error: 'CDP not attached' });
        return;
      }
      try {
        if (request.width) {
          await chrome.debugger.sendCommand({ tabId }, 'Emulation.setDeviceMetricsOverride', {
            width: Math.round(request.width),
            height: Math.round(request.height || 900),
            deviceScaleFactor: 0,
            mobile: Boolean(request.isMobile)
          });
        }
        if (request.theme && request.theme !== 'default') {
          await chrome.debugger.sendCommand({ tabId }, 'Emulation.setEmulatedMedia', {
            features: [{ name: 'prefers-color-scheme', value: request.theme }]
          });
        }
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // Fallback for unhandled action
  sendResponse({ success: false, error: 'Unknown action: ' + request.action });
  return false;
});

// Keyboard Shortcut: Alt+Shift+E Full Page Capture
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-full-page') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
        return;
      }

      // Ensure content script is ready with retry loop
      let ready = false;
      for (let i = 0; i < 5; i++) {
        try {
          const res = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
          if (res?.pong) { ready = true; break; }
        } catch {
          if (i === 0) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
          }
          await new Promise(r => setTimeout(r, 100));
        }
      }
      if (!ready) return;

      // Clean scroll smoothers & attach CDP
      await neutralizeScrollLibraries(tab.id);
      await attachCdp(tab.id);

      // Trigger full page capture with auto-scroll and animation freezing
      chrome.tabs.sendMessage(tab.id, { action: 'capture_full', autoScroll: true, useCdp: true }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Zcrap] Shortcut capture message notice:', chrome.runtime.lastError.message);
        }
        detachCdp(tab.id).catch(e => console.warn('[Zcrap] Detach notice:', e));
      });
    } catch (err) {
      console.error('[Zcrap] Shortcut capture error:', err);
    }
  }
});
