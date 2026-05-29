# Topmarks landing site — design

> **History:** A first version (v1) shipped as a plain, zero-JS static page —
> CSS-gradient backdrop, a scroll-snap screenshot peek-carousel, text/badge
> install buttons. It was implemented task-by-task per
> [`../plans/2026-05-28-landing-site.md`](../plans/2026-05-28-landing-site.md).
> The site was then **rebuilt** (commit `2cb928d`) as an interactive
> liquid-glass design. This document describes the **current (rebuilt) site**.
> The v1 plan is retained as a historical record and is marked superseded.

## Goal

A single-page marketing site at `https://nx-alejandrolacasa.github.io/topmarks/`
that sells Topmarks and points visitors to install it from the Firefox Add-ons
store (live) and the Chrome Web Store (pending). The page is itself a *live demo*
of the product's aesthetic: a floating glass bookmarks bar over a rotating
Unsplash wallpaper, with Glass/Classic and Light/Dark toggles the visitor can
play with. English only. No custom domain.

## Non-goals

- No marketing CMS, blog, changelog page, or FAQ section.
- No localization (the extension supports 7 languages; the site does not).
- No framework, build step, or bundler. The interactivity is a single hand-written
  vanilla-JS file (`app.js`) — no React, no npm dependencies, no remote code.
- No analytics, no trackers, no cookies. State (theme/style choice) lives only in
  `localStorage`.
- No load-time third-party requests **except** the Unsplash wallpaper. Fonts,
  logos, icon, and screenshots are all self-hosted.

## Page structure (single page, top-to-bottom)

### 0. Rotating wallpaper (fixed, full-bleed, behind everything)

- Two stacked `<div class="layer">` elements crossfade between curated Unsplash
  photos every ~9s (mirrors the extension's wallpaper feature).
- Photos load at runtime from `images.unsplash.com` (sized ~2400px). The curated
  set lives in the `WALLPAPERS` array in `app.js` (Unsplash photo IDs +
  photographer names).
- A rich brand **mesh gradient** (indigo/violet/cyan) sits underneath as an
  always-present fallback if a photo fails or is slow.
- Legibility scrims (two layered linear-gradients) darken the edges for hero text.
- Photographer attribution shows in the hero corner; clicking it shuffles to the
  next wallpaper.

### 1. Floating glass bookmarks bar (the live product demo)

- A fixed glass pill at the top of the page reproducing the extension's bar:
  brand mini-logo, folder items with hover dropdowns (one populated with demo
  links), and site items with colored favicon dots.
- In **Classic** style it anchors flush to the top edge, squares off, and drops
  the blur/shadow — exactly like the extension's Classic mode.

### 2. Hero

- Eyebrow pill ("Firefox & Chrome · New tab" with a status dot).
- Headline: "Your bookmarks, floating on every new tab."
- Lede paragraph.
- Two install buttons:
  - **Firefox** — primary (solid white) CTA with the colorful Firefox logo,
    links to the AMO listing (`https://addons.mozilla.org/firefox/addon/topmarks/`),
    opens in a new tab.
  - **Chrome** — ghost button with the colorful Chrome logo and a "Soon" tag,
    non-interactive (a `<span>`, not a link) until the CWS listing is live.
- Hero meta row: "Free & open source", "No tracking, ever", "7 languages".
- A scroll hint and the wallpaper attribution are anchored to the hero.

### 3. Live demo controls

A small fixed glass panel (bottom-right) with two segmented controls that
restyle the **whole page** live:

- **Style**: Glass / Classic
- **Theme**: Light / Dark (sun/moon icons)

Both are plain `<button>`s wired in `app.js`, reflect their state via
`aria-pressed`, and persist the choice to `localStorage` (`tm_style`, `tm_theme`).

### 4. Styles split

A two-up comparison ("Frosted Glass, or solid Classic") with the
`1-glass_light.png` and `3-classic.png` screenshots and captions.

### 5. Feature grid (6 cards)

Icon + title + copy for: Bookmarks placement, Curated wallpapers, Light/Dark/Auto,
7 languages, Privacy-respecting, and Tuned-to-taste (alignment, hide icons, search
field, refresh interval).

### 6. Gallery band

The four screenshots (`1`–`4`) in a row with captions
(Glass · Light / Glass · Dark / Classic / Settings).

### 7. Privacy

A shield mark, headline, copy, and four check-chips: No analytics · No third-party
trackers · Bookmarks stay local · Open source · MIT. The copy states the single
outbound request is the Unsplash wallpaper — which the implementation upholds.

### 8. Final CTA + footer

- Final CTA repeats the two install buttons.
- Footer: brand, links (GitHub, Privacy, License, Firefox Add-ons), and the credit
  "Made by Alejandro G. Lacasa · Photos courtesy of Unsplash".

## Visual style — liquid glass

- **Glass surface** (`.glass`): translucent fill + hairline border +
  `backdrop-filter: blur(26px) saturate(150%)` + soft shadow. In Classic style
  (`html[data-style="classic"]`) the blur is removed and the surface goes fully
  opaque (`--solid`).
- **Theme**: light is the default on `:root`; `html[data-theme="dark"]` overrides
  the token set. Driven by the toggle (persisted), initialised from
  `prefers-color-scheme` on first visit.
- **Accent**: indigo → violet (`#6366f1` → `#a855f7`), lifted from the extension
  icon, exposed as `--accent`, `--accent-2`, `--accent-grad`.
- **Typography**: **Inter**, self-hosted as a single latin variable `woff2`
  (`assets/fonts/inter-latin.woff2`, `font-weight: 100 900`), with a system-font
  fallback stack. No Google Fonts request.
- **Motion**: wallpaper crossfade + scroll-reveal (IntersectionObserver) + smooth
  anchor scrolling. `prefers-reduced-motion: reduce` disables the wallpaper
  auto-rotation.

## Responsive behavior

- Fluid type via `clamp()` throughout; hero padding and headline scale with the
  viewport.
- The bookmarks bar, demo controls, feature grid, gallery, and footer collapse
  to comfortable mobile layouts at the small breakpoints in `styles.css`.

## File structure

```
site/
  index.html                 # markup + inline SVG icons (no external scripts)
  styles.css                 # all styling; tokens via :root + html[data-theme|data-style]
  app.js                     # vanilla JS: wallpaper rotation, toggles, reveal, anchors
  assets/
    icon.svg                 # app icon (favicon + brand marks)
    fonts/
      inter-latin.woff2      # self-hosted Inter (latin, variable)
    badges/
      firefox-logo.png       # colorful store logo, 64px (rendered ~20px)
      chrome-logo.png        # colorful store logo, 64px (rendered ~20px)
    screenshots/
      1-glass_light.png
      2-glass_dark.png
      3-classic.png
      4-settings.png
```

The `site/` folder is self-contained and is uploaded verbatim as the Pages
artifact — it has no runtime dependency on the extension's TypeScript source.

## Deployment

- Workflow: `.github/workflows/pages.yml`.
- Triggers: `push` to `main` filtered to `site/**` and the workflow file itself,
  plus `workflow_dispatch`.
- Permissions: `pages: write`, `id-token: write`, `contents: read`.
- Concurrency group `pages`, `cancel-in-progress: false`.
- Two jobs: **build** (`actions/checkout@v6` → `actions/upload-pages-artifact@v3`
  with `path: site`) and **deploy** (`actions/deploy-pages@v4`, environment
  `github-pages`).
- One-time manual setup: repo **Settings → Pages → Source → GitHub Actions**.
- URL: `https://nx-alejandrolacasa.github.io/topmarks/`.

## Open inputs

- **AMO URL** — live: `https://addons.mozilla.org/firefox/addon/topmarks/`.
- **CWS URL** — pending. When live, swap the Chrome `<span>` for an `<a>` and drop
  the "Soon" tag.
- **Wallpapers** — curated via the `WALLPAPERS` array in `app.js` (Unsplash photo
  IDs + photographer names).

## Out of scope

- Open Graph / Twitter card meta tags (can be added later if traffic warrants).
- `robots.txt`, `sitemap.xml`.
- A Buy Me a Coffee footer link (no BMC page yet; the old `bmc-logo.svg` was
  dropped in the rebuild).
- Localized variants.

## Production-hardening decisions (rebuild)

The rebuild arrived as a design handoff that included a dev-only React tweak panel
and oversized assets. Before shipping, the following were applied so the live site
matches its own claims and stays lightweight:

- **Removed the React/Babel-from-unpkg tweak panel.** It loaded remote code at
  runtime, contradicting the page's "no remote code" claim. The Glass/Classic and
  Light/Dark toggles were kept — they run from `app.js`, not the panel.
- **Self-hosted Inter** (48 KB latin variable woff2) and dropped the Google Fonts
  links, so the only load-time external request is the Unsplash wallpaper.
- **Downscaled the store logos** from 3840px PNGs (1.8 MB + 0.4 MB) to 64px
  (~6 KB each); they render at ~20px.
- **Dropped orphaned files**: old AMO/CWS badge images, `bmc-logo.svg`, and the
  `HANDOFF.md` / `tweaks-panel.jsx` dev artifacts.

## Testing / verification

- Serve locally with `npm run dev:site` (`npx http-server ./site --port 8080`)
  and open in Firefox and Chrome.
- Visual checks:
  - Wallpaper loads and crossfades; mesh-gradient fallback shows if a photo fails.
  - Glass/Classic and Light/Dark toggles restyle the page and persist across reload.
  - Hero install buttons reach AMO; Chrome button is inert with a "Soon" tag.
  - Light and dark render correctly; `:focus-visible` rings are present.
  - `prefers-reduced-motion` stops wallpaper rotation.
- Confirm the Network tab shows no requests to Google Fonts or unpkg — only
  `images.unsplash.com` for wallpapers.
- After deploy, load the public URL on desktop and mobile.
