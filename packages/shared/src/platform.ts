// The browser-agnostic surface shared/* code uses. Each platform package
// (@topmarks/firefox, @topmarks/chrome) provides a concrete impl via its own
// platform.ts and passes it to startApp(platform) at extension load.
//
// The interface mirrors only the WebExtensions APIs newtab.ts actually calls.
// Anything not used today is intentionally not in the interface.

export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  type?: "bookmark" | "folder" | "separator";
  children?: BookmarkNode[];
}

export interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

export type StorageChanges = Record<string, StorageChange>;

export interface Platform {
  bookmarks: {
    getToolbar(): Promise<BookmarkNode>;
    onChanged(handler: () => void): () => void;
  };
  storage: {
    get<K extends string>(keys: readonly K[] | Record<K, unknown>): Promise<Record<K, unknown>>;
    set(values: Record<string, unknown>): Promise<void>;
    onChanged(handler: (changes: StorageChanges, area: string) => void): () => void;
  };
  search: {
    submit(query: string, opts: { newTab: boolean }): Promise<void>;
  };
  i18n: {
    getMessage(key: string): string;
    getUILanguage(): string;
  };
  runtime: {
    isFirefox: boolean;
  };
}

// Runtime binding. startApp() in newtab.ts calls setPlatform() before any
// other shared module runs. getPlatform() throws if called before init —
// catches "forgot to call startApp()" early.

let current: Platform | null = null;

export function setPlatform(p: Platform): void {
  current = p;
}

export function getPlatform(): Platform {
  if (!current) {
    throw new Error("Platform not initialized. Did entry.ts forget to call startApp()?");
  }
  return current;
}
