import { getPlatform } from "@/platform";

export function t(key: string): string {
  try {
    const msg = getPlatform().i18n.getMessage(key);
    if (msg) return msg;
  } catch {
    /* fall through */
  }
  return key;
}

export function applyI18n(): void {
  try {
    const lang = getPlatform().i18n.getUILanguage();
    if (lang) document.documentElement.lang = lang;
  } catch {
    /* ignore */
  }
  document.title = t("newTabTitle");
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const msg = t(el.dataset.i18n!);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((el) => {
    const msg = t(el.dataset.i18nAriaLabel!);
    if (msg) el.setAttribute("aria-label", msg);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((el) => {
    const msg = t(el.dataset.i18nPlaceholder!);
    if (msg) el.setAttribute("placeholder", msg);
  });
}
