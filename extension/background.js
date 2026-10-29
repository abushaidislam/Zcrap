// Zcrap Background Service Worker — Chrome DevTools Protocol (CDP) & Workflow Manager (v3.0.0 Pro)

const activeCdpSessions = new Set();

// Safely attach Chrome DevTools Protocol to target tab
async function attachCdp(tabId) {
  if (activeCdpSessions.has(tabId)) return true;
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
    console.warn(`[Zcrap CDP] Failed to attach to tab ${tabId}:`, err);
    return false;
  }
}

// Safely detach CDP session
async function detachCdp(tabId) {
  if (!activeCdpSessions.has(tabId)) return;
  try {
    await chrome.debugger.detach({ tabId });
  } catch {}
  activeCdpSessions.delete(tabId);
}

// Auto cleanup when tab closes or navigates
chrome.tabs.onRemoved.addListener((tabId) => {
  activeCdpSessions.delete(tabId);
});

chrome.debugger.onDetach.addListener((source) => {
  if (source?.tabId) {
    activeCdpSessions.delete(source.tabId);
  }
});

// CDP Command Dispatcher for Content Script & Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = request.tabId || sender.tab?.id;

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
      if (!tabId || !activeCdpSessions.has(tabId)) {
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
      if (!tabId || !activeCdpSessions.has(tabId)) {
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
      if (!tabId || !activeCdpSessions.has(tabId)) {
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
      if (!tabId || !activeCdpSessions.has(tabId)) {
        // Fallback: fetch via background worker (avoids CORS restrictions in extension background)
        try {
          const resp = await fetch(request.url);
          const blob = await resp.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result;
            sendResponse({ success: true, content: dataUrl, mimeType: blob.type, isDataUrl: true });
          };
          reader.readAsDataURL(blob);
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
          url: request.url
        });
        sendResponse({
          success: true,
          content: res.content,
          base64Encoded: res.base64Encoded,
          mimeType: request.mimeType || 'application/octet-stream'
        });
      } catch (err) {
        // Graceful fallback to background fetch
        try {
          const resp = await fetch(request.url);
          const blob = await resp.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            sendResponse({ success: true, content: reader.result, mimeType: blob.type, isDataUrl: true });
          };
          reader.readAsDataURL(blob);
        } catch (fetchErr) {
          sendResponse({ success: false, error: err.message });
        }
      }
    })();
    return true;
  }

  // 7. Device Metrics and Color Scheme Emulation (Mobile/Tablet/Dark Mode)
  if (request.action === 'cdp_emulate') {
    (async () => {
      if (!tabId || !activeCdpSessions.has(tabId)) {
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
});

// Keyboard Shortcut: Alt+Shift+E Full Page Capture
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-full-page') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
        return;
      }

      // Ensure content script is injected
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      } catch {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(r => setTimeout(r, 150));
      }

      // Optionally attach CDP for maximum fidelity
      await attachCdp(tab.id);

      // Trigger full page capture with auto-scroll and animation freezing
      chrome.tabs.sendMessage(tab.id, { action: 'capture_full', autoScroll: true, useCdp: true }, async () => {
        // Detach CDP cleanly after capture completes
        await detachCdp(tab.id);
      });
    } catch (err) {
      console.error('[Zcrap] Shortcut capture error:', err);
    }
  }
});
