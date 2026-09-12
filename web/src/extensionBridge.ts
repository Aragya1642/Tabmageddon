import type { BrowserTab } from "./types";

interface BridgeResponse {
  source?: string;
  requestId?: string;
  ok?: boolean;
  tabs?: BrowserTab[];
  error?: string;
}

function requestExtension<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", listener);
      reject(new Error("Chrome extension not detected. Load it or use demo tabs."));
    }, 2500);
    const listener = (event: MessageEvent<BridgeResponse>) => {
      if (event.source !== window || event.data?.source !== "TABMAGGEDON_EXTENSION" || event.data.requestId !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", listener);
      if (!event.data.ok) reject(new Error(event.data.error || "Extension request failed."));
      else resolve(event.data as T);
    };
    window.addEventListener("message", listener);
    window.postMessage({ source: "TABMAGGEDON_WEB", type, requestId, ...payload }, window.location.origin);
  });
}

export async function importLiveTabs(): Promise<BrowserTab[]> {
  const response = await requestExtension<BridgeResponse>("GET_TABS");
  return response.tabs ?? [];
}

export async function closeLiveTab(tabId: number, url: string): Promise<void> {
  if (tabId < 0) return;
  await requestExtension("CLOSE_TAB", { tabId, url });
}
