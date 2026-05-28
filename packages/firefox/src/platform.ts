/// <reference types="firefox-webext-browser" />
// Firefox impl of the shared Platform interface. Wraps browser.* APIs in the
// shapes shared/ expects. Toolbar ID and search submit behavior are Firefox-
// specific; everything else is thin re-export of browser.*.

import type { Platform, BookmarkNode, StorageChanges } from "@topmarks/shared/platform";

const TOOLBAR_ID = "toolbar_____";

const BOOKMARK_EVENTS = ["onCreated", "onRemoved", "onChanged", "onMoved"] as const;

export const platform: Platform = {
  bookmarks: {
    async getToolbar(): Promise<BookmarkNode> {
      const [node] = await browser.bookmarks.getSubTree(TOOLBAR_ID);
      return node as BookmarkNode;
    },
    onChanged(handler) {
      for (const ev of BOOKMARK_EVENTS) {
        const api = browser.bookmarks[ev];
        if (api) api.addListener(handler);
      }
      return () => {
        for (const ev of BOOKMARK_EVENTS) {
          const api = browser.bookmarks[ev];
          if (api) api.removeListener(handler);
        }
      };
    },
    cachedFaviconUrl(pageUrl) {
      // Firefox-only URL scheme. Returns Firefox's cached favicon. No network.
      return `page-icon:${pageUrl}`;
    },
  },
  storage: {
    get(keys) {
      // browser.storage.local.get accepts string[] or Record<string,default>;
      // Platform interface unifies both.
      return browser.storage.local.get(keys as any) as Promise<Record<string, unknown>>;
    },
    set(values) {
      return browser.storage.local.set(values);
    },
    onChanged(handler) {
      const wrapped = (changes: Record<string, browser.storage.StorageChange>, area: string) => {
        handler(changes as StorageChanges, area);
      };
      browser.storage.onChanged.addListener(wrapped);
      return () => browser.storage.onChanged.removeListener(wrapped);
    },
  },
  search: {
    async submit(query, { newTab }) {
      if (newTab) {
        const tab = await browser.tabs.create({ url: "about:blank", active: true });
        await browser.search.search({ query, tabId: tab.id });
      } else {
        const current = await browser.tabs.getCurrent();
        if (current?.id != null) {
          await browser.search.search({ query, tabId: current.id });
        }
      }
    },
  },
  i18n: {
    getMessage(key) {
      return browser.i18n.getMessage(key) || "";
    },
    getUILanguage() {
      return browser.i18n.getUILanguage();
    },
  },
  runtime: {
    isFirefox: true,
  },
};
