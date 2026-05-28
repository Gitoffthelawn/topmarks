# Landing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a single-page GitHub Pages site at `https://nx-alejandrolacasa.github.io/topmarks/` with install buttons for Firefox (AMO, live) and Chrome (CWS, coming soon), a scroll-snap screenshot slideshow, a short feature list, and a footer.

**Architecture:** Plain HTML + CSS, no JavaScript, no build step. Files live in `site/` at the repo root and are uploaded as a Pages artifact by a new GitHub Actions workflow. Visual style mirrors the extension's liquid-glass aesthetic via `backdrop-filter`, translucent surfaces, `prefers-color-scheme`, and `prefers-reduced-motion`. Assets are copied (not symlinked) from `packages/shared/assets/`.

**Tech Stack:** HTML5, CSS3 (Grid, Flexbox, custom properties, `backdrop-filter`, `scroll-snap`), GitHub Actions (`actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-05-28-landing-site-design.md`

**Important — this is not a TDD project.** There is no automated test runner for a static landing page. Each task ends with **visual verification in a browser** (or `curl` for the deploy task) instead of a passing unit test. Discipline still applies: small commits, one logical change per task, never skip the verification step.

---

## Pre-flight: Inputs to collect from the user

Before starting Task 3, ask the user for these three inputs and write them down. Do not invent or assume values.

1. **`AMO_URL`** — the live Firefox Add-ons listing URL for Topmarks. Looks like `https://addons.mozilla.org/firefox/addon/<slug>/`. Required.
2. **`BMC_URL`** — the user's Buy Me a Coffee page URL, looks like `https://buymeacoffee.com/<handle>`. If the user does not have one, set this to the literal string `SKIP` and omit the footer entry.
3. **`bg.jpg` source** — either a local file path on disk, or a public image URL to download with `curl`. The image should be a calm, low-contrast photograph (landscape, nature, or abstract — avoid busy product/screenshot imagery). The Unsplash curated wallpapers collection is a good source.

Substitute these literals everywhere the plan writes `__AMO_URL__`, `__BMC_URL__`, or references `bg.jpg`.

---

## Task 1: Scaffold the site directory and copy product assets

**Files:**
- Create: `site/` (directory)
- Create: `site/assets/` (directory)
- Create: `site/assets/screenshots/` (directory)
- Create: `site/assets/icon.svg` (copied from `packages/shared/assets/icons/icon.svg`)
- Create: `site/assets/bmc-logo.svg` (copied from `packages/shared/assets/icons/bmc-logo.svg`)
- Create: `site/assets/screenshots/1-glass_light.png` (copied)
- Create: `site/assets/screenshots/2-glass_dark.png` (copied)
- Create: `site/assets/screenshots/3-classic.png` (copied)
- Create: `site/assets/screenshots/4-settings.png` (copied)

- [ ] **Step 1: Create the directory structure**

Run from the repo root:

```bash
mkdir -p site/assets/screenshots
```

- [ ] **Step 2: Copy icon + BMC logo**

```bash
cp packages/shared/assets/icons/icon.svg site/assets/icon.svg
cp packages/shared/assets/icons/bmc-logo.svg site/assets/bmc-logo.svg
```

- [ ] **Step 3: Copy all four screenshots**

```bash
cp packages/shared/assets/screenshots/1-glass_light.png site/assets/screenshots/
cp packages/shared/assets/screenshots/2-glass_dark.png  site/assets/screenshots/
cp packages/shared/assets/screenshots/3-classic.png     site/assets/screenshots/
cp packages/shared/assets/screenshots/4-settings.png    site/assets/screenshots/
```

- [ ] **Step 4: Verify file presence**

```bash
ls -la site/assets/ site/assets/screenshots/
```

Expected: `icon.svg` and `bmc-logo.svg` in `site/assets/`; all four PNGs in `site/assets/screenshots/`.

- [ ] **Step 5: Commit**

```bash
git add site/
git commit -m "Add static product assets for landing site"
```

---

## Task 2: Add the page backdrop image

**Files:**
- Create: `site/assets/bg.jpg`

- [ ] **Step 1: Place the backdrop image**

Use whichever input the user gave during pre-flight:

**If a local path:**
```bash
cp <user-provided-path> site/assets/bg.jpg
```

**If a URL:**
```bash
curl -L -o site/assets/bg.jpg "<user-provided-url>"
```

- [ ] **Step 2: Verify file size and type**

```bash
file site/assets/bg.jpg
ls -la site/assets/bg.jpg
```

Expected: `JPEG image data ...`, file size between 100 KB and 2 MB. If it's larger than 2 MB, downscale or recompress before committing — the page loads it as a fullscreen backdrop and a multi-MB file will hurt first paint.

If the file is much larger, use `sips` (macOS, available by default):
```bash
sips -Z 2560 site/assets/bg.jpg --out site/assets/bg.jpg
```

- [ ] **Step 3: Commit**

```bash
git add site/assets/bg.jpg
git commit -m "Add backdrop image for landing site"
```

---

## Task 3: Write `index.html`

**Files:**
- Create: `site/index.html`

This task writes the full markup in one shot. The CSS classes referenced here are styled in Tasks 4–8 — leaving the markup unstyled until the next task is intentional.

- [ ] **Step 1: Write the file**

Substitute `__AMO_URL__` and `__BMC_URL__` with the literal values gathered in pre-flight before saving.

If `__BMC_URL__` is the literal `SKIP`, **omit the entire `<li class="footer-bmc">` block** rather than leaving it with a placeholder href.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Topmarks — your bookmarks toolbar, floating at the top of every new tab</title>
    <meta name="description" content="A minimal new-tab extension for Firefox and Chrome that floats your bookmarks toolbar at the top of every new tab, over a rotating Unsplash wallpaper." />
    <link rel="icon" type="image/svg+xml" href="assets/icon.svg" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div class="backdrop" aria-hidden="true"></div>
    <div class="backdrop-overlay" aria-hidden="true"></div>

    <main>
      <section class="hero">
        <div class="hero-card glass">
          <img class="hero-icon" src="assets/icon.svg" alt="" width="96" height="96" />
          <h1 class="hero-title">Topmarks</h1>
          <p class="hero-tagline">Your bookmarks toolbar, floating at the top of every new tab.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="__AMO_URL__">
              <span class="btn-label-small">Add to</span>
              <span class="btn-label-large">Firefox</span>
            </a>
            <span class="btn btn-secondary btn-disabled" role="button" aria-disabled="true">
              <span class="btn-label-small">Coming soon to</span>
              <span class="btn-label-large">Chrome Web Store</span>
            </span>
          </div>
        </div>
      </section>

      <section class="slideshow" aria-label="Screenshots of Topmarks">
        <div class="slides">
          <figure class="slide glass">
            <img src="assets/screenshots/1-glass_light.png" alt="Glass theme, light mode" />
            <figcaption>Glass · Light</figcaption>
          </figure>
          <figure class="slide glass">
            <img src="assets/screenshots/2-glass_dark.png" alt="Glass theme, dark mode" />
            <figcaption>Glass · Dark</figcaption>
          </figure>
          <figure class="slide glass">
            <img src="assets/screenshots/3-classic.png" alt="Classic theme" />
            <figcaption>Classic</figcaption>
          </figure>
          <figure class="slide glass">
            <img src="assets/screenshots/4-settings.png" alt="Settings panel" />
            <figcaption>Settings</figcaption>
          </figure>
        </div>
      </section>

      <section class="features">
        <ul class="features-list glass">
          <li>Floating glass bookmarks bar with folder dropdowns and nested submenus</li>
          <li>Rotating high-resolution wallpapers from Unsplash</li>
          <li>Light · Dark · Auto theme</li>
          <li>Available in 7 languages — English, Spanish, French, Italian, German, Japanese, Chinese Simplified</li>
          <li>Privacy-respecting — no analytics, no third-party trackers, bookmarks never leave your device</li>
        </ul>
      </section>
    </main>

    <footer class="footer">
      <ul class="footer-links">
        <li><a href="https://github.com/nx-alejandrolacasa/topmarks">GitHub</a></li>
        <li><a href="https://github.com/nx-alejandrolacasa/topmarks/blob/main/PRIVACY.md">Privacy</a></li>
        <li><a href="https://github.com/nx-alejandrolacasa/topmarks/blob/main/LICENSE">License</a></li>
        <li class="footer-bmc"><a href="__BMC_URL__"><img src="assets/bmc-logo.svg" alt="Buy Me a Coffee" height="20" /></a></li>
      </ul>
      <p class="footer-credit">Made by Alejandro Lacasa</p>
    </footer>
  </body>
</html>
```

- [ ] **Step 2: Verify HTML parses**

```bash
# Quick syntax check — sed/grep for unclosed tags is too brittle.
# Instead, open the file in a browser (next step) and check DevTools Console for parse errors.
ls -la site/index.html
```

Expected: file exists, ~3 KB.

- [ ] **Step 3: Commit**

```bash
git add site/index.html
git commit -m "Add landing site markup"
```

---

## Task 4: Add base styles — reset, theme tokens, body backdrop

**Files:**
- Create: `site/styles.css`

- [ ] **Step 1: Write the file with base styles**

```css
/* === Reset === */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter",
    system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text);
  background: var(--page-bg);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
}

a {
  color: inherit;
}

/* === Theme tokens === */
:root {
  --text: #1a1a1c;
  --text-muted: rgba(26, 26, 28, 0.65);
  --surface: rgba(255, 255, 255, 0.55);
  --surface-hairline: rgba(255, 255, 255, 0.7);
  --shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  --page-bg: #f4f4f6;
  --overlay: rgba(255, 255, 255, 0.25);
  --accent: #2eb872; /* extension bookmark-pill green */
  --accent-text: #ffffff;
  --link-underline: rgba(26, 26, 28, 0.25);
}

@media (prefers-color-scheme: dark) {
  :root {
    --text: #f0f0f2;
    --text-muted: rgba(240, 240, 242, 0.65);
    --surface: rgba(20, 20, 22, 0.55);
    --surface-hairline: rgba(255, 255, 255, 0.12);
    --shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    --page-bg: #0e0e10;
    --overlay: rgba(0, 0, 0, 0.4);
    --link-underline: rgba(240, 240, 242, 0.3);
  }
}

/* === Backdrop === */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: -2;
  background-image: url("assets/bg.jpg");
  background-size: cover;
  background-position: center;
}

.backdrop-overlay {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: var(--overlay);
}

/* === Glass surface (shared) === */
.glass {
  background: var(--surface);
  border: 1px solid var(--surface-hairline);
  box-shadow: var(--shadow);
  border-radius: 20px;
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  backdrop-filter: blur(20px) saturate(140%);
}

/* === Main layout === */
main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 64px 24px 32px;
  display: grid;
  gap: 64px;
}
```

- [ ] **Step 2: Visual verification — base layout**

In one terminal, start a static server in `site/`:

```bash
cd site && python3 -m http.server 8000
```

In a browser, open `http://localhost:8000/`.

Expected:
- Background image fills the viewport
- The page content is unstyled rectangles but readable (system font, dark text on light, or inverted in dark mode)
- DevTools → Console: no errors
- DevTools → Network: `bg.jpg`, `icon.svg`, `bmc-logo.svg`, the four screenshots, and `styles.css` all return 200

Stop the server with Ctrl+C when done.

- [ ] **Step 3: Commit**

```bash
git add site/styles.css
git commit -m "Add base styles, theme tokens, and backdrop for landing site"
```

---

## Task 5: Add hero section styles

**Files:**
- Modify: `site/styles.css` (append)

- [ ] **Step 1: Append hero styles to `site/styles.css`**

```css
/* === Hero === */
.hero {
  display: flex;
  justify-content: center;
}

.hero-card {
  padding: 48px 32px;
  text-align: center;
  max-width: 640px;
  width: 100%;
}

.hero-icon {
  width: 96px;
  height: 96px;
  margin: 0 auto 16px;
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.18));
}

.hero-title {
  margin: 0 0 8px;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.hero-tagline {
  margin: 0 0 32px;
  font-size: 18px;
  color: var(--text-muted);
}

.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

/* === Buttons === */
.btn {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 12px 20px;
  border-radius: 12px;
  text-decoration: none;
  font-weight: 600;
  line-height: 1.2;
  min-width: 180px;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.btn-label-small {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.75;
}

.btn-label-large {
  font-size: 18px;
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-text);
  box-shadow: 0 6px 16px rgba(46, 184, 114, 0.35);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(46, 184, 114, 0.45);
}

.btn-primary:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--surface-hairline);
}

.btn-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Visual verification — hero**

Start the server (`cd site && python3 -m http.server 8000`), reload the browser.

Expected:
- The hero is a centered glass card with the Topmarks icon, "Topmarks" heading, tagline, and two buttons.
- The Firefox button is green and stands out; the Chrome button is muted and has a "not-allowed" cursor on hover.
- Hover the Firefox button → it lifts slightly.
- Tab through with the keyboard → the Firefox button shows a green focus ring.

- [ ] **Step 3: Commit**

```bash
git add site/styles.css
git commit -m "Style hero section and install buttons"
```

---

## Task 6: Add scroll-snap slideshow styles

**Files:**
- Modify: `site/styles.css` (append)

- [ ] **Step 1: Append slideshow styles**

```css
/* === Screenshot slideshow === */
.slideshow {
  /* Bleed past `main`'s padding so slides reach near the viewport edges */
  margin: 0 -24px;
}

.slides {
  display: flex;
  gap: 16px;
  padding: 0 24px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 0 24px;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

.slide {
  flex: 0 0 min(960px, calc(100% - 48px));
  scroll-snap-align: center;
  padding: 16px;
  display: grid;
  gap: 8px;
}

.slide img {
  width: 100%;
  border-radius: 10px;
  display: block;
}

.slide figcaption {
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Hide scrollbar in WebKit; keep semantic scrollability */
.slides::-webkit-scrollbar {
  height: 0;
  background: transparent;
}

@media (prefers-reduced-motion: reduce) {
  .slides {
    scroll-behavior: auto;
  }
}
```

- [ ] **Step 2: Visual verification — slideshow**

Reload the browser.

Expected:
- The first screenshot (`1-glass_light.png`) fills the centered slide area.
- A sliver of the second slide (`2-glass_dark.png`) peeks on the right edge.
- Scrolling horizontally (trackpad two-finger, touch swipe, or shift+scroll) moves between slides; each slide snaps cleanly into position.
- No visible scrollbar in WebKit (Chrome/Safari). Firefox shows a thin one — acceptable.
- DevTools → Toggle device toolbar → switch to a mobile size → slides shrink to roughly the viewport width and still snap.

- [ ] **Step 3: Commit**

```bash
git add site/styles.css
git commit -m "Style screenshot scroll-snap slideshow"
```

---

## Task 7: Add features list and footer styles

**Files:**
- Modify: `site/styles.css` (append)

- [ ] **Step 1: Append features + footer styles**

```css
/* === Features === */
.features {
  display: flex;
  justify-content: center;
}

.features-list {
  list-style: none;
  margin: 0;
  padding: 32px 40px;
  max-width: 720px;
  width: 100%;
  display: grid;
  gap: 12px;
  font-size: 16px;
}

.features-list li {
  position: relative;
  padding-left: 28px;
}

.features-list li::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 0.55em;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

/* === Footer === */
.footer {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 24px 48px;
  text-align: center;
  color: var(--text-muted);
}

.footer-links {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  gap: 24px;
  justify-content: center;
  flex-wrap: wrap;
  align-items: center;
}

.footer-links a {
  text-decoration: none;
  border-bottom: 1px solid var(--link-underline);
  padding-bottom: 1px;
  font-size: 14px;
}

.footer-links a:hover {
  border-bottom-color: var(--text);
}

.footer-bmc a {
  border-bottom: none;
  display: inline-flex;
  align-items: center;
}

.footer-credit {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.04em;
}
```

- [ ] **Step 2: Visual verification — features and footer**

Reload the browser.

Expected:
- The features list is a glass card with five bullet points, each prefixed by a small green dot.
- The footer shows four links (GitHub · Privacy · License · BMC logo) centered in a row, with a "Made by Alejandro Lacasa" credit below.
- Hovering a footer text link darkens its underline.
- If `__BMC_URL__` was set to `SKIP`, there should only be three text links (no logo). Confirm visually that the BMC element is absent.

- [ ] **Step 3: Commit**

```bash
git add site/styles.css
git commit -m "Style features list and footer"
```

---

## Task 8: Add responsive media queries

**Files:**
- Modify: `site/styles.css` (append)

- [ ] **Step 1: Append responsive overrides at the end of `site/styles.css`**

```css
/* === Responsive: mobile === */
@media (max-width: 640px) {
  main {
    padding: 32px 16px 24px;
    gap: 40px;
  }

  .hero-card {
    padding: 32px 20px;
  }

  .hero-title {
    font-size: 32px;
  }

  .hero-tagline {
    font-size: 16px;
    margin-bottom: 24px;
  }

  .hero-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-actions .btn {
    align-items: center;
    min-width: 0;
  }

  .slideshow {
    margin: 0 -16px;
  }

  .slides {
    padding: 0 16px;
    scroll-padding: 0 16px;
  }

  .slide {
    flex-basis: calc(100% - 32px);
  }

  .features-list {
    padding: 24px 24px;
  }

  .footer-links {
    gap: 16px;
  }
}
```

- [ ] **Step 2: Visual verification — mobile**

Reload the browser. Open DevTools → Toggle device toolbar → iPhone 14 Pro (or any width ≤ 640px).

Expected:
- Hero stacks: icon, then title, then tagline, then full-width buttons stacked vertically (Firefox green on top, Chrome muted below).
- Slides narrow to nearly the viewport width with a small peek of the next slide.
- Features padding tightens. Footer links wrap to two rows if needed but stay centered.
- Switch back to desktop width (> 640px) and confirm the desktop layout returns intact.

- [ ] **Step 3: Commit**

```bash
git add site/styles.css
git commit -m "Add mobile responsive layout for landing site"
```

---

## Task 9: Local end-to-end verification

**Files:**
- (none modified — verification only)

- [ ] **Step 1: Start the local server**

```bash
cd site && python3 -m http.server 8000
```

- [ ] **Step 2: Run through the verification checklist in Firefox**

Open `http://localhost:8000/` in Firefox.

- [ ] Background image visible behind everything; legible overlay
- [ ] Hero icon, title, tagline render correctly
- [ ] Firefox button is green and clickable; visiting it (in a new tab) reaches the real AMO listing
- [ ] Chrome button is muted, says "Coming soon to Chrome Web Store", and shows a not-allowed cursor — clicking does nothing
- [ ] Slideshow snaps cleanly with trackpad two-finger scroll
- [ ] Slideshow respects `prefers-reduced-motion` — toggle System Settings → Accessibility → Motion: "Reduce motion" on macOS, reload, scrollbar momentum is jumpier (no smooth scroll)
- [ ] Features bullets render with green dots
- [ ] Footer links open the right URLs (GitHub, Privacy, License, BMC if present)
- [ ] Console: zero errors and zero 404s in the Network tab
- [ ] Switch the OS to dark mode (or DevTools → Rendering → Emulate `prefers-color-scheme: dark`) → all surfaces invert correctly, no light-mode artifacts remain

- [ ] **Step 3: Repeat the checklist in Chrome**

Same checks as Step 2, in Chrome. Pay extra attention to:
- `backdrop-filter` (Chrome supports it well, but check the glass effect is actually blurring the backdrop)
- Slideshow `scroll-snap` behavior on a Mac trackpad

- [ ] **Step 4: Lighthouse audit (Chrome DevTools)**

Open DevTools → Lighthouse tab → Categories: Accessibility + Best Practices → Mode: Navigation → Device: Desktop → Analyze page load.

Expected scores: **Accessibility ≥ 95, Best Practices ≥ 95**.

If Accessibility is below 95, fix the specific finding before continuing (likely candidates: missing `alt` text on a decorative image, low color contrast, missing focus indicator).

- [ ] **Step 5: Stop the server**

Ctrl+C in the server terminal.

- [ ] **Step 6: No commit needed**

This task introduces no changes — it is a verification gate before deployment.

---

## Task 10: Add GitHub Actions workflow for Pages

**Files:**
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Deploy landing site to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "site/**"
      - ".github/workflows/pages.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/pages.yml'))" && echo OK
```

Expected: `OK`. If you see a `yaml.YAMLError`, fix the indentation and re-run.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pages.yml
git commit -m "Add GitHub Actions workflow to deploy landing site to Pages"
```

---

## Task 11: Enable GitHub Pages and trigger first deploy

**Files:**
- (none modified — repo settings + manual verification)

- [ ] **Step 1: Push to `main`**

Confirm we're on `main` and pushing the new commits:

```bash
git status
git log --oneline -10
git push origin main
```

Expected: push succeeds. The Pages workflow does not yet auto-run because Pages source has not been set.

- [ ] **Step 2: Enable Pages in repo settings (manual, requires user action)**

This step **must be done by the user** in the GitHub web UI — there is no equivalent `gh` CLI command that flips the source to "GitHub Actions" reliably.

Instruct the user:

> Go to `https://github.com/nx-alejandrolacasa/topmarks/settings/pages`.
> Under **Build and deployment** → **Source**, select **GitHub Actions**. Save.

Wait for the user to confirm they have done this before proceeding.

- [ ] **Step 3: Trigger the workflow manually**

```bash
gh workflow run "Deploy landing site to GitHub Pages" --ref main
```

Expected: `✓ Created workflow_dispatch event for pages.yml at main`.

- [ ] **Step 4: Watch the run**

```bash
gh run watch
```

Pick the most recent `pages.yml` run if prompted. Expected: both `build` and `deploy` jobs end in `✓ succeeded`. The deploy job's summary contains the page URL.

If `deploy` fails with "The configured source for Pages is not GitHub Actions", Step 2 was not completed — go back and complete it.

- [ ] **Step 5: Verify the live URL**

```bash
curl -I https://nx-alejandrolacasa.github.io/topmarks/
```

Expected: `HTTP/2 200`. If you see `404`, wait 30 seconds for the CDN and retry; if it persists, check `gh run view` for the deploy job's logs.

Then open `https://nx-alejandrolacasa.github.io/topmarks/` in a browser and walk through the same checklist as Task 9 Step 2 — confirm the production site renders identically to localhost.

- [ ] **Step 6: No commit needed**

This task is operational only.

---

## Task 12: Link the site from the README

**Files:**
- Modify: `README.md` (add a one-line link near the top)

- [ ] **Step 1: Read the current top of the README**

```bash
head -10 README.md
```

- [ ] **Step 2: Insert a link**

Replace the first two lines:

```markdown
# Topmarks

A minimal new-tab extension for Firefox and Chrome that floats your bookmarks toolbar at the top of every new tab, over a rotating Unsplash wallpaper.
```

with:

```markdown
# Topmarks

[**Website**](https://nx-alejandrolacasa.github.io/topmarks/) · [Install for Firefox](__AMO_URL__)

A minimal new-tab extension for Firefox and Chrome that floats your bookmarks toolbar at the top of every new tab, over a rotating Unsplash wallpaper.
```

Substitute `__AMO_URL__` with the real value.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Link landing site from README"
git push origin main
```

The push will retrigger the Pages workflow only if `site/**` changed — it won't here, so the workflow will be skipped. That's expected.

---

## Done

The landing site is live at `https://nx-alejandrolacasa.github.io/topmarks/`. Any future change to `site/**` on `main` will redeploy automatically.

When the Chrome Web Store listing goes live:
1. Open `site/index.html`.
2. Replace the `<span class="btn btn-secondary btn-disabled" ...>...</span>` block with an `<a class="btn btn-secondary" href="<CWS_URL>">...</a>` and update the inner labels to `"Add to"` / `"Chrome"`.
3. Commit and push — the workflow redeploys.
