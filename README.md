# Topmarks

A minimal Firefox new-tab extension that floats your bookmarks toolbar at the top of every new tab, over a rotating Unsplash wallpaper.

## Features

- Floating glass bookmarks bar with folder dropdowns and nested submenus
- Rotating high-resolution wallpapers from Unsplash's curated wallpaper collection
- Light / Dark / Auto theme
- Configurable background refresh interval (1h / 6h / 12h / 24h)
- 7 languages: English, Spanish, French, Italian, German, Japanese, Chinese (Simplified)
- Liquid-glass aesthetic with backdrop blur, inspired by iOS 26
- Respects `prefers-reduced-motion` and `prefers-reduced-transparency`
- Privacy-respecting: no analytics, no third-party trackers, bookmarks never leave your device

Firefox only (manifest v2, uses Firefox-specific APIs).

## Setup

1. Get an Unsplash Access Key at <https://unsplash.com/oauth/applications>. Only the **Access Key** is needed — the Secret Key must never be placed in client-side code.
2. Configure:

   ```sh
   cp .env.example .env
   # paste your UNSPLASH_ACCESS_KEY into .env
   ./build-config.sh
   ```

   This generates a gitignored `config.local.js`. Re-run after editing `.env`.

## Install in Firefox (development)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Pick `manifest.json` from this directory.
4. Open a new tab.

Temporary add-ons are removed when Firefox restarts. For a persistent install, the extension needs to be signed via [addons.mozilla.org](https://addons.mozilla.org), or you can run Firefox Developer Edition with `xpinstall.signatures.required` set to `false` in `about:config`.

## Configuration

Click the gear icon at the bottom-right of the new tab page:

- **Hide folder icons** — show only bookmark titles
- **Center bookmarks in bar** — center-align instead of left-aligning
- **Show background image** — toggle Unsplash wallpaper on/off
- **Theme** — Auto / Light / Dark
- **Refresh background every** — 1h / 6h / 12h / 24h
- **Refresh background now** — fetch a fresh photo immediately

Settings persist in `browser.storage.local` and are wiped on uninstall.

## Privacy

The extension does not collect, transmit, or store your bookmarks, browsing history, or any personal identifier. When backgrounds are enabled, the extension makes HTTPS requests to `api.unsplash.com` for a random wallpaper. Favicons load directly from each bookmarked site's own `/favicon.ico` — no third-party favicon services.

Full policy: [PRIVACY.md](./PRIVACY.md).

## Project structure

```
manifest.json          Extension manifest (icons, permissions, locale)
newtab.html            New tab page markup
newtab.css             Liquid-glass styles, theme tokens
newtab.js              Bookmarks rendering, settings, Unsplash fetch
icons/icon.svg         Extension icon (single SVG, scales to all sizes)
_locales/<lang>/       Translations (en, es, fr, it, de, ja, zh_CN)
build-config.sh        Generates config.local.js from .env
.env.example           Template — copy to .env, fill in, gitignored
PRIVACY.md             Privacy policy
```

## Development

- **Reload after changes**: in `about:debugging`, click **Reload** on the extension.
- **Inspect DevTools**: in `about:debugging`, click **Inspect** on the extension to open the new tab page in DevTools.
- **Re-run** `./build-config.sh` after editing `.env`.

## Credits

- [Unsplash](https://unsplash.com) — photo API and the curated wallpaper collection.
- [Tabliss](https://github.com/joelshepherd/tabliss) — collection ID and the screen-aware image-sizing approach (snap to 240px increments, clamp 1920–3840px).

## License

Released under the [MIT License](./LICENSE).
