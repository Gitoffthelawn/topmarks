import { getPlatform } from "./platform.js";

let searchInput: HTMLInputElement | null = null;
let searchInputParent: Element | null = null;

export function setupSearch(showSearch: boolean): void {
  searchInput = document.getElementById("search-input") as HTMLInputElement | null;
  if (!searchInput) return;
  searchInputParent = searchInput.parentElement;

  searchInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const query = searchInput!.value.trim();
      if (!query) return;
      e.preventDefault();
      const inNewTab = e.shiftKey || e.ctrlKey || e.metaKey;
      try {
        await getPlatform().search.submit(query, { newTab: inNewTab });
      } catch (err) {
        console.error("[Topmarks] Search submit failed:", err);
      }
    } else if (e.key === "Escape") {
      if (searchInput!.value !== "") {
        searchInput!.value = "";
        e.stopPropagation();
      } else {
        searchInput!.blur();
      }
    }
  });

  if (!showSearch) {
    searchInput.remove();
    return;
  }

  searchInput.focus();
}

export function applyShowSearch(showSearch: boolean): void {
  if (!searchInput) return;
  if (showSearch) {
    if (!searchInput.isConnected && searchInputParent) {
      searchInputParent.appendChild(searchInput);
    }
    searchInput.focus();
  } else if (searchInput.isConnected) {
    searchInput.remove();
  }
}
