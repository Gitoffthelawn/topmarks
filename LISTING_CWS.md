# Chrome Web Store listing copy

Text to paste into the chrome.google.com/webstore/devconsole submission form. Keep this in sync with the actual extension behavior.

CWS rendering note: the description field does **not** support Markdown. Line breaks render, but `**bold**` and `#` headings render as literal characters. Sections below use ALL-CAPS labels so they remain readable when pasted as plain text.

## Name

> 50-character limit. Provided by `_locales/en/messages.json` (`extName`).

```
Topmarks
```

## Summary

> 132-character limit. Current: 121 chars.

```
Floats your bookmarks toolbar at the top of every new tab, over a rotating Unsplash wallpaper. No tracking, no analytics.
```

## Description

> 16,000-character limit. Paste as plain text — CWS does not render Markdown.

```
Topmarks floats your Chrome bookmarks toolbar at the top of every new tab, over a rotating wallpaper from Unsplash. Designed to be minimal, fast, and unobtrusive.

FEATURES

• Bookmarks where you want them. Your Bookmarks Toolbar appears as a clean pill at the top of every new tab. Folders open as dropdowns; nested folders cascade as side menus.

• Curated wallpapers. Each session loads a high-resolution photo from a curated Unsplash collection, sized to your display (up to 4K). Pick a refresh interval: every 1, 6, 12, or 24 hours.

• Two styles. Pick Glass for a frosted-glass aesthetic with backdrop blur, or Classic for solid surfaces and a flush-anchored bar.

• Light, Dark, or Auto. Follows your system theme or whatever you choose.

• 7 languages. English, Spanish, French, Italian, German, Japanese, and Simplified Chinese — auto-detects your Chrome UI language.

• Accessibility-aware. Respects prefers-reduced-motion and prefers-reduced-transparency. Folder dropdowns are keyboard-navigable with proper ARIA semantics.

PRIVACY

Topmarks does not collect, transmit, or store your bookmarks, browsing history, or any personal identifier. The only outbound network request is to api.unsplash.com when wallpapers are enabled, to fetch a random photo. Favicons load from Chrome's own favicon cache first (no network), then fall back to each bookmarked site's own /favicon.ico — no third-party favicon services. No analytics. No telemetry. No remote code.

Full privacy policy: https://github.com/nx-alejandrolacasa/topmarks/blob/main/PRIVACY.md

SOURCE AND LICENSE

Open source under the MIT License.

GitHub: https://github.com/nx-alejandrolacasa/topmarks

Photos courtesy of Unsplash.
```

## Category

> CWS allows one primary category.

- **Workflow & Planning** (primary recommendation — new-tab/bookmarks workflow customization)
- Fallback: **Functionality & UI**

## Language

```
English (United States)
```

The extension itself ships translations for 7 locales (en, es, fr, it, de, ja, zh_CN) via `_locales/`, but the CWS listing language field controls the listing copy above, not the extension UI.

## Store icon

`packages/shared/assets/icons/icon.png` (128×128 PNG) — already embedded in the package, also uploaded separately as the store-listing icon.

## Screenshots

CWS requires **exactly 1280×800** or **640×400**. At least one screenshot is required; up to five may be uploaded.

Available in `packages/shared/assets/screenshots/`:

| File | Current size | What it shows | CWS-ready? |
|---|---|---|---|
| `1-glass_light.png` | 2560×1632 | Glass style, light theme, bookmarks pill at top | ❌ Needs downscale + crop |
| `2-glass_dark.png` | 2560×1632 | Glass style, dark theme, bookmarks pill at top | ❌ Needs downscale + crop |
| `3-classic.png` | 2560×1600 | Classic style, bookmarks bar flush at bottom | ✅ Downscale only — already 16:10 |
| `4-settings.png` | 2560×1632 | Settings panel open, bottom-right | ❌ Needs downscale + crop |

The shots are Retina captures (2× the CWS target). `3-classic.png` is already 16:10 so it downscales cleanly to 1280×800. The others are 2560×1632 (≈1.569:1), slightly taller than 16:10 — need a 32px crop off the height before downscaling, or a single combined crop+resize.

ImageMagick one-liner (handles both cases, gravity centered):

```sh
cd packages/shared/assets/screenshots
mkdir -p cws
for f in 1-glass_light.png 2-glass_dark.png 3-classic.png 4-settings.png; do
  magick "$f" -resize 1280x -gravity center -crop 1280x800+0+0 +repage "cws/$f"
done
```

For `4-settings.png` the settings panel sits in the lower-right; if the centered crop clips it, swap `-gravity center` → `-gravity south` for that file.

Suggested additional shot to capture before submission (optional, max 5 total):
- Localized UI (Japanese or Spanish) — demonstrates the 7-language support

## Promotional images (optional but recommended)

- **Small promo tile**: 440×280 PNG/JPG — improves visibility in CWS rotations.
- **Marquee promo**: 1400×560 PNG/JPG — only used if the extension is featured.

If we don't have these yet, skip them; they can be added in a later edit without re-review.
