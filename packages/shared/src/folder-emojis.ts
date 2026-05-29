import { getPlatform, type BookmarkNode } from "./platform.js";
import { isFolder } from "./bookmarks.js";
import { t } from "./i18n.js";
import { getFolderEmoji, setFolderEmoji, clearFolderEmoji } from "./settings.js";

// Best-effort emoji detection. `\p{RGI_Emoji}` (v flag) covers ZWJ sequences,
// flags and skin-tone modifiers and is supported by current Chrome/Firefox.
// We fall back to the broader `\p{Extended_Pictographic}` (u flag), then to
// "no restriction" — so the field can never block a legitimate emoji.
const EMOJI_RE: RegExp | null = (() => {
  try {
    return new RegExp("\\p{RGI_Emoji}", "v");
  } catch {
    /* v flag / RGI_Emoji unsupported */
  }
  try {
    return new RegExp("\\p{Extended_Pictographic}", "u");
  } catch {
    /* property escapes unsupported */
  }
  return null;
})();

function firstGrapheme(input: string): string {
  const SegmenterCtor = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (SegmenterCtor) {
    const seg = new SegmenterCtor(undefined, { granularity: "grapheme" });
    for (const { segment } of seg.segment(input)) return segment;
    return "";
  }
  // Fallback: split by code points (good enough when Segmenter is absent).
  return [...input][0] ?? "";
}

// Returns the emoji to store, "" to clear, or null to reject the input.
function sanitizeEmoji(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const grapheme = firstGrapheme(trimmed);
  if (!grapheme) return "";
  if (!EMOJI_RE) return grapheme; // can't validate → don't restrict
  return EMOJI_RE.test(grapheme) ? grapheme : null;
}

function buildFolderRow(folder: BookmarkNode): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "folder-emoji-row";

  const name = document.createElement("span");
  name.className = "folder-emoji-name";
  name.textContent = folder.title || t("unnamedFolder");
  name.title = name.textContent;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "folder-emoji-input";
  input.value = getFolderEmoji(folder.id) ?? "";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", t("folderEmojiInputLabel"));

  input.addEventListener("input", () => {
    const result = sanitizeEmoji(input.value);
    if (result === null) {
      // Rejected non-emoji input — restore the last accepted value.
      input.value = getFolderEmoji(folder.id) ?? "";
      return;
    }
    input.value = result;
    if (result) {
      void setFolderEmoji(folder.id, result);
    } else {
      void clearFolderEmoji(folder.id);
    }
  });

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "folder-emoji-clear";
  clearBtn.textContent = "✕";
  clearBtn.setAttribute("aria-label", t("clearEmoji"));
  clearBtn.addEventListener("click", () => {
    input.value = "";
    void clearFolderEmoji(folder.id);
  });

  row.append(name, input, clearBtn);
  return row;
}

async function buildList(list: HTMLElement): Promise<void> {
  list.textContent = "";
  let folders: BookmarkNode[] = [];
  try {
    const toolbar = await getPlatform().bookmarks.getToolbar();
    folders = (toolbar.children || []).filter(isFolder);
  } catch {
    /* fall through to empty state */
  }
  if (!folders.length) {
    const empty = document.createElement("p");
    empty.className = "folder-emoji-empty";
    empty.textContent = t("folderEmojisNoFolders");
    list.append(empty);
    return;
  }
  for (const folder of folders) {
    list.append(buildFolderRow(folder));
  }
}

export function setupFolderEmojiOverlay(): void {
  const openBtn = document.getElementById("open-folder-emojis");
  const overlay = document.getElementById("folder-emoji-overlay");
  const backdrop = document.getElementById("folder-emoji-backdrop");
  const closeBtn = document.getElementById("folder-emoji-close");
  const list = document.getElementById("folder-emoji-list");
  if (!openBtn || !overlay || !backdrop || !closeBtn || !list) return;

  const settingsPanel = document.getElementById("settings-panel");
  const settingsBtn = document.getElementById("settings-btn");

  const close = () => {
    if (overlay.hidden) return;
    overlay.hidden = true;
    list.textContent = "";
    openBtn.focus();
  };

  const open = async () => {
    // The overlay supersedes the settings panel it was launched from.
    if (settingsPanel && !settingsPanel.hidden) {
      settingsPanel.hidden = true;
      settingsBtn?.setAttribute("aria-expanded", "false");
    }
    overlay.hidden = false;
    await buildList(list);
    const firstInput = list.querySelector<HTMLInputElement>(".folder-emoji-input");
    (firstInput ?? closeBtn).focus();
  };

  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    void open();
  });
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  });
}
