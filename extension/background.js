function safeUrl(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.source !== "TABMAGGEDON_CONTENT") return false;

  if (message.type === "PING") {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "GET_TABS") {
    chrome.tabs.query({}).then((tabs) => {
      const result = tabs
        .filter((tab) => tab.id !== sender.tab?.id && tab.id != null && safeUrl(tab.url))
        .map((tab) => {
          const sanitizedUrl = safeUrl(tab.url);
          return {
            tabId: tab.id,
            title: (tab.title || new URL(sanitizedUrl).hostname).slice(0, 180),
            url: sanitizedUrl,
            domain: new URL(sanitizedUrl).hostname,
            faviconUrl: tab.favIconUrl,
            pinned: tab.pinned,
            audible: tab.audible,
            discarded: tab.discarded,
            active: tab.active,
            lastAccessed: tab.lastAccessed,
          };
        });
      sendResponse({ ok: true, tabs: result });
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CLOSE_TAB") {
    const tabId = Number(message.tabId);
    if (!Number.isInteger(tabId) || tabId < 0) {
      sendResponse({ ok: false, error: "Invalid tab ID." });
      return false;
    }
    chrome.tabs.get(tabId).then((tab) => {
      if (!safeUrl(tab.url) || safeUrl(tab.url) !== safeUrl(message.url)) {
        throw new Error("That tab changed since the game and was not closed.");
      }
      return chrome.tabs.remove(tabId);
    }).then(() => sendResponse({ ok: true }))
      .catch((error) => {
        if (String(error?.message).toLowerCase().includes("no tab with id")) {
          sendResponse({ ok: true, alreadyClosed: true });
        } else {
          sendResponse({ ok: false, error: error.message });
        }
      });
    return true;
  }

  sendResponse({ ok: false, error: "Unknown extension request." });
  return false;
});
