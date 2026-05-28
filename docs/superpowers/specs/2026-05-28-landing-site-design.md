# Topmarks landing site — design

## Goal

A simple, single-page website at `https://nx-alejandrolacasa.github.io/topmarks/` that points visitors to install Topmarks from the Firefox Add-ons store (live) and the Chrome Web Store (pending). The page doubles as a lightweight product showcase via screenshots and a short feature list. English only. No custom domain.

## Non-goals

- No marketing CMS, blog, changelog page, or FAQ section.
- No localization (the extension supports 7 languages; the site does not).
- No JavaScript framework, build step, or bundler for the site itself.
- No analytics, no trackers, no cookies.
- No theme toggle on the page — light/dark follows the OS via `prefers-color-scheme`.

## Page structure (single page, top-to-bottom)

### 1. Hero

- Topmarks icon (existing `icon.svg`) + wordmark "Topmarks".
- Tagline: "Your bookmarks toolbar, floating at the top of every new tab."
- Two install buttons, side by side:
  - **Firefox** — primary CTA, accent-colored, links to the AMO listing URL. The AMO URL is unknown at spec time; the spec uses the placeholder `__AMO_URL__` which the implementation plan will surface as a prompt so the user can paste the real URL before commit.
  - **Chrome** — secondary, visually de-emphasized (muted background, lower contrast), labelled "Coming soon to Chrome Web Store" and rendered as a non-interactive element (e.g., a `<span>` styled as a disabled button — *not* a disabled `<button>`, to keep the markup semantic). No tooltip, no link — when the CWS goes live we swap it for an `<a>` and update the label.

### 2. Screenshot showcase — horizontal scroll-snap slideshow

- A horizontally-scrolling container holding the four existing screenshots:
  - `1-glass_light.png` — caption "Glass · Light"
  - `2-glass_dark.png` — caption "Glass · Dark"
  - `3-classic.png` — caption "Classic"
  - `4-settings.png` — caption "Settings"
- The first screenshot fills the container width; the next peeks on the right edge to signal scrollability.
- CSS-only: `scroll-snap-type: x mandatory` on the container, `scroll-snap-align: center` on each slide. Native momentum scrolling on touch and trackpad.
- Each slide is a "glass card" frame around the screenshot image.
- No JS, no dots/arrows controls in v1 (YAGNI — scroll-snap on the OS is sufficient signal).

### 3. Features

A short bulleted list, 5 items pulled from the README:

- Floating glass bookmarks bar with folder dropdowns and nested submenus
- Rotating high-resolution wallpapers from Unsplash
- Light · Dark · Auto theme
- Available in 7 languages (English, Spanish, French, Italian, German, Japanese, Chinese Simplified)
- Privacy-respecting — no analytics, no third-party trackers, bookmarks never leave your device

### 4. Footer

Single row of links, centered:

- GitHub repo → `https://github.com/nx-alejandrolacasa/topmarks`
- Privacy policy → `https://github.com/nx-alejandrolacasa/topmarks/blob/main/PRIVACY.md`
- License → `https://github.com/nx-alejandrolacasa/topmarks/blob/main/LICENSE`
- Buy Me a Coffee → (use existing `bmc-logo.svg` asset, link to the user's BMC page — implementation plan will prompt for the URL with placeholder `__BMC_URL__`; if the user does not have one, the link is omitted)

Below the link row: a small "Made by Alejandro Lacasa" credit.

## Visual style — liquid glass

Mirrors the extension's own aesthetic so a visitor immediately understands the product's vibe.

- **Backdrop**: a simple solid color with a very subtle vertical gradient (light: near-white with a faint cool tint; dark: near-black with a faint cool tint). No photographic background in v1 — kept intentionally minimal so the glass cards and screenshots are the visual focus. Easy to swap for a photo later.
- **Glass cards**: hero block, each screenshot frame, and the feature list use `backdrop-filter: blur(20px) saturate(140%)` over a translucent surface (light: `rgba(255,255,255,0.55)`, dark: `rgba(20,20,22,0.55)`) with a 1px hairline border (`rgba(255,255,255,0.15)`) and a soft outer shadow.
- **Typography**: system stack `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif`. No web fonts.
- **Theme**: `prefers-color-scheme` only, no manual toggle. Two CSS custom-property sets keyed to `:root` and `@media (prefers-color-scheme: dark)`.
- **Accent color**: the same green used by the extension's bookmark pill, applied only to the primary Firefox CTA so it pops.
- **Motion**: no animations beyond native scroll-snap. Inside `@media (prefers-reduced-motion: reduce)` the smooth-scroll behavior on the slideshow is disabled.
- **Glass fallback**: where `backdrop-filter` is unsupported, the translucent surfaces remain visually solid enough to be readable (covered by the chosen `rgba(...)` values being opaque enough on their own).

## Responsive behavior

- **Mobile (< 640px)**: single-column hero (icon above text above buttons), buttons full-width and stacked. Screenshot slideshow remains horizontal but each slide narrows to the viewport. Features list stays single-column.
- **Tablet/Desktop (≥ 640px)**: buttons side-by-side, screenshot slides at a fixed max-width of ~960px and centered with peek margins.

## File structure

```
site/
  index.html
  styles.css
  assets/
    icon.svg                  # copied from packages/shared/assets/icons/icon.svg
    bmc-logo.svg              # copied from packages/shared/assets/icons/bmc-logo.svg
    screenshots/
      1-glass_light.png       # copied from packages/shared/assets/screenshots/
      2-glass_dark.png
      3-classic.png
      4-settings.png
```

Assets are **copied**, not symlinked. The `site/` folder is self-contained so it can be uploaded as a Pages artifact without any awareness of the rest of the repo. If a screenshot or icon changes upstream, a small npm script (or manual `cp`) re-copies it — the implementation plan will decide whether that's worth automating.

## Deployment

- New workflow file: `.github/workflows/pages.yml`.
- Triggers:
  - `push` to `main` with paths filter `site/**` and `.github/workflows/pages.yml`
  - `workflow_dispatch` (manual)
- Permissions: `pages: write`, `id-token: write`, `contents: read`.
- Concurrency group `pages` with `cancel-in-progress: false` (Pages best practice — never cancel a deploy mid-flight).
- Two jobs:
  1. **build** — `actions/checkout@v4`, then `actions/upload-pages-artifact@v3` with `path: site`.
  2. **deploy** — depends on build, runs `actions/deploy-pages@v4`. Environment `github-pages` with the deploy URL surfaced in the job summary.
- One-time manual setup (documented in the implementation plan): repo **Settings → Pages → Source → GitHub Actions**.
- Final URL: `https://nx-alejandrolacasa.github.io/topmarks/`.

## Open inputs (resolved at implementation time)

- `__AMO_URL__` — the live Firefox Add-ons listing URL. User pastes during implementation.
- `__BMC_URL__` — Buy Me a Coffee page URL, or omit the footer entry if none exists.

## Out of scope (explicit non-features for v1)

- Slideshow dot indicators / prev-next arrows
- Theme toggle
- Localized variants
- Animations beyond scroll-snap
- Open Graph / Twitter card meta tags (can be added later if traffic warrants)
- `robots.txt`, `sitemap.xml`
- Favicon variants beyond `icon.svg` referenced as the page favicon

## Testing / verification

- Build the site locally by serving `site/` with any static HTTP server (e.g., `python3 -m http.server` from the `site/` directory) and load `http://localhost:8000/` in Firefox and Chrome.
- Visual checks:
  - Light and dark modes render correctly (toggle via OS).
  - Slideshow snaps cleanly on trackpad scroll and touch (test in DevTools mobile emulator).
  - Buttons keyboard-focusable and visibly focused (`:focus-visible` ring).
  - All external links (hero install buttons and footer) open in the same tab — keeps markup simple and avoids the need for `rel="noopener noreferrer"`. Revisit if user feedback suggests otherwise.
- Lighthouse: aim for ≥ 95 on Accessibility and Best Practices. Performance not benchmarked beyond "no obvious regression" — single-page static site with one image-heavy backdrop.
- After first deploy, visit the public URL on at least one mobile device or device-emulator to confirm CDN cache works.

## Why this is one self-contained sub-project

The site has no runtime dependency on the extension's TypeScript source — it only consumes static assets. Keeping it as a flat `site/` folder with plain HTML/CSS means:

- No new npm workspace to maintain
- No build cache to invalidate
- The deploy workflow is fully decoupled from the extension's release workflow (`.github/workflows/release.yml`)
- A future contributor can edit `site/index.html` without understanding the extension build at all
