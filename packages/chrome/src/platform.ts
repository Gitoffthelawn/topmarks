/// <reference types="chrome" />
// Chrome impl of the shared Platform interface. Wraps chrome.* APIs in the
// shapes shared/ expects. Toolbar ID and search submit are Chrome-specific;
// everything else is a thin re-export of chrome.*.
//
// Chrome MV3's chrome.* APIs return promises natively when called without a
// callback, so no polyfill needed.

import type { Platform, BookmarkNode, StorageChanges } from "@topmarks/shared/platform";

// Chrome's bookmarks bar root is "1" (the bookmark bar's stable ID). Compare
// with Firefox's "toolbar_____".
const TOOLBAR_ID = "1";

export const platform: Platform = {
  bookmarks: {
    async getToolbar(): Promise<BookmarkNode> {
      const [node] = await chrome.bookmarks.getSubTree(TOOLBAR_ID);
      return node as BookmarkNode;
    },
    onChanged(handler) {
      chrome.bookmarks.onCreated.addListener(handler);
      chrome.bookmarks.onRemoved.addListener(handler);
      chrome.bookmarks.onChanged.addListener(handler);
      chrome.bookmarks.onMoved.addListener(handler);
      return () => {
        chrome.bookmarks.onCreated.removeListener(handler);
        chrome.bookmarks.onRemoved.removeListener(handler);
        chrome.bookmarks.onChanged.removeListener(handler);
        chrome.bookmarks.onMoved.removeListener(handler);
      };
    },
  },
  storage: {
    get(keys) {
      return chrome.storage.local.get(keys as any) as unknown as Promise<Record<string, unknown>>;
    },
    set(values) {
      return chrome.storage.local.set(values);
    },
    onChanged(handler) {
      const wrapped = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
        handler(changes as StorageChanges, area);
      };
      chrome.storage.onChanged.addListener(wrapped);
      return () => chrome.storage.onChanged.removeListener(wrapped);
    },
  },
  search: {
    async submit(query, { newTab }) {
      // chrome.search.query() submits to the default search engine and
      // navigates either the current tab or a new one based on `disposition`.
      await chrome.search.query({
        text: query,
        disposition: newTab ? "NEW_TAB" : "CURRENT_TAB",
      });
    },
  },
  i18n: {
    getMessage(key) {
      return chrome.i18n.getMessage(key) || "";
    },
    getUILanguage() {
      return chrome.i18n.getUILanguage();
    },
  },
  runtime: {
    isFirefox: false,
  },
};
