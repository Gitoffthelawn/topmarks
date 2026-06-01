import { getPlatform } from "@/platform";

let searchInput: HTMLInputElement | null = null;

export function setupSearch(): void {
  searchInput = document.getElementById("search-input") as HTMLInputElement | null;
  if (!searchInput) return;

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
}

// Visibility is CSS-driven via :root[data-center-widget]; we only need to grab
// focus when the search field is the active center widget.
export function focusSearch(): void {
  searchInput?.focus();
}
