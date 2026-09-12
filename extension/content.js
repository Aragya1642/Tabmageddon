window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "TABMAGGEDON_WEB") return;
  const { requestId, type, tabId, url } = event.data;
  chrome.runtime.sendMessage({
    source: "TABMAGGEDON_CONTENT",
    type,
    tabId,
    url,
  }, (response) => {
    const error = chrome.runtime.lastError;
    window.postMessage({
      source: "TABMAGGEDON_EXTENSION",
      requestId,
      ok: !error && Boolean(response?.ok),
      tabs: response?.tabs,
      error: error?.message || response?.error,
    }, window.location.origin);
  });
});

window.postMessage({ source: "TABMAGGEDON_EXTENSION", type: "READY" }, window.location.origin);
