# Firefox listing copy

Text to paste into the addons.mozilla.org submission form. Keep this in sync with the actual extension behavior.

## Summary

> 250-character limit. Current: 199 chars.

```
Floats your bookmarks toolbar at the top of every new tab, over a curated rotating wallpaper from Unsplash. Glass or Classic style, light/dark themes, 7 languages. No tracking, no analytics.
```

## Description

> Markdown is supported (basic). Paste into the AMO description field.

```markdown
**Topmarks** floats your Firefox bookmarks toolbar at the top of every new tab, over a rotating wallpaper from Unsplash. Designed to be minimal, fast, and unobtrusive.

**Features**

- **Bookmarks where you want them.** Your Bookmarks Toolbar appears as a clean pill at the top of every new tab. Folders open as dropdowns; nested folders cascade as side menus.
- **Reopen your tab groups.** Topmarks remembers the browser tab groups you've opened and lists the closed ones in the bookmarks bar — click one to reopen the whole group in a tab. Opt-in: turn it on in Settings (it requests the tabs and tab-groups permissions only then), and your groups are saved on your device, never uploaded.
- **Folders with personality.** Replace any top-level folder's icon with an emoji — just paste one from your system picker. Clear it anytime to restore the default.
- **Curated wallpapers.** Each session loads a high-resolution photo from a curated Unsplash collection, sized to your display (up to 4K). Pick a refresh interval: every 1, 6, 12, or 24 hours.
- **Two styles.** Pick **Glass** for a frosted-glass aesthetic with backdrop blur, or **Classic** for solid surfaces and a flush-anchored bar.
- **Light, Dark, or Auto.** Follows your system theme or whatever you choose.
- **7 languages.** English, Spanish, French, Italian, German, Japanese, and Simplified Chinese — auto-detects your Firefox UI language.
- **Accessibility-aware.** Respects prefers-reduced-motion and prefers-reduced-transparency. Folder dropdowns are keyboard-navigable with proper ARIA semantics.

**Privacy**

Topmarks does **not** collect, transmit, or store your bookmarks, browsing history, or any personal identifier. The only outbound network request is to api.unsplash.com when wallpapers are enabled, to fetch a random photo. Favicons come from icons your browser has already seen (remembered locally from your open tabs) with a fallback to each bookmarked site's own /favicon.ico — no third-party favicon services. When the optional **Tab groups** feature is enabled, Topmarks reads your tab groups (their names, colors, and member tab URLs) to save them on your device for one-click reopening — this stays in local storage and is never transmitted. No analytics. No telemetry. No remote code.

Full privacy policy: https://github.com/nx-alejandrolacasa/topmarks/blob/main/PRIVACY.md

**Source & license**

Open source under the MIT License.

GitHub: https://github.com/nx-alejandrolacasa/topmarks

Photos courtesy of Unsplash.
```

## Categories

- New Tab Page
- Appearance

## Tags

`bookmarks`, `new tab`, `wallpaper`, `unsplash`, `minimal`

## Notes for reviewer

> Paste into AMO's "Notes for reviewer" field on submission.

```
This extension reads bookmarks via the bookmarks API and renders the
toolbar on the new tab page. The only network destination is
api.unsplash.com (when "Show background image" is enabled), used to
fetch a random photo from Unsplash's curated wallpaper collection
1053828.

Build: npm install && npm run build (esbuild monorepo; see README).
The public Unsplash Access Key (Client-ID) is read from .env at build
time and embedded into the bundle, per Unsplash's API guidelines for
client-side apps — it is the only value injected into the source.

Favicons: Firefox does not expose its favicon cache to extensions
(the page-icon: scheme is chrome-privileged), so while the optional
"tabs" permission is granted the extension remembers the favicon URLs
of tabs the user opens (tabs.favIconUrl, keyed by site origin, stored
in storage.local) and uses them for the bookmarks bar, falling back to
the bookmarked site's own /favicon.ico. No third-party favicon
services are used and the cache never leaves the device.

The optional "Tab groups" feature (off by default) requests the
"tabs" and "tabGroups" permissions only when the user enables it in
Settings. It reads open tab groups (names, colors, and member tab
URLs) to snapshot them in local storage so closed groups can be
reopened from the new tab page, and re-creates a group via tabs.group
when one is reopened. The "tabs" grant also powers the favicon cache
described above. This data is stored only on the device and is never
transmitted.

No analytics, telemetry, or crash reporting. No remote code. No
content scripts. Bookmarks data never leaves the browser.
```

## Release notes

> Paste the latest entry into the version's "Release notes" / "What's new" field. Newest first.

### v1.11.0

```
Bookmark favicons now actually load on Firefox: icons are remembered locally from the tabs you open (no network, no third-party services) instead of relying on a favicon cache Firefox doesn't expose to extensions. Plus a friendlier Groups menu — forgetting a saved group is now a direct two-click action instead of a submenu, and Topmarks detects and lets you re-grant the tab permissions if the browser has dropped them.
```

### v1.10.0

```
New: Tab groups. Reopen your closed browser tab groups straight from the bookmarks bar. Fully opt-in — Topmarks requests the tabs and tab-groups permissions only when you enable the feature in Settings, and your groups are saved locally, never uploaded.
```
