// packages/firefox/build.ts — esbuild + static copy + manifest version stamp.
//
// Run via:  npx tsx build.ts            (one-shot build)
//           npx tsx build.ts --watch    (rebuild on file change)
//
// Output: ./dist/, a fully-self-contained Firefox-loadable extension dir.
import { build, context, type BuildOptions } from "esbuild";
import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, "..", "..");
const SHARED_DIR = path.resolve(REPO_ROOT, "packages", "shared");
const DIST = path.join(HERE, "dist");
const WATCH = process.argv.includes("--watch");
const DEV = WATCH || process.env.NODE_ENV !== "production";

async function loadUnsplashKey(): Promise<string> {
  const envPath = path.join(REPO_ROOT, ".env");
  if (!existsSync(envPath)) return "";
  const raw = await readFile(envPath, "utf8");
  const m = raw.match(/^\s*UNSPLASH_ACCESS_KEY\s*=\s*"?([^"\n]*)"?\s*$/m);
  return m ? (m[1] ?? "") : "";
}

async function readSharedVersion(): Promise<string> {
  // Until Phase 3 stands up @topmarks/shared, this package's own package.json
  // is the version source. After Phase 3, the line below switches to SHARED_DIR.
  const pkgPath = existsSync(path.join(SHARED_DIR, "package.json"))
    ? path.join(SHARED_DIR, "package.json")
    : path.join(HERE, "package.json");
  const { version } = JSON.parse(await readFile(pkgPath, "utf8"));
  return version;
}

async function copyAssets(version: string) {
  // Phase 2: assets are still in packages/firefox/. Phase 3 moves them to
  // packages/shared/assets/ and this function changes to copy from there.
  const filesAtRoot = ["newtab.html", "newtab.css", "sample-bookmarks.html"];
  for (const f of filesAtRoot) {
    const src = path.join(HERE, f);
    if (existsSync(src)) await cp(src, path.join(DIST, f));
  }
  for (const dir of ["icons", "fonts", "_locales"]) {
    const src = path.join(HERE, dir);
    if (existsSync(src)) await cp(src, path.join(DIST, dir), { recursive: true });
  }
  // Stamp version into manifest.
  const manifest = JSON.parse(await readFile(path.join(HERE, "manifest.json"), "utf8"));
  manifest.version = version;
  await writeFile(
    path.join(DIST, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );
}

function pageBundleOptions(unsplashKey: string): BuildOptions {
  return {
    entryPoints: [path.join(HERE, "src", "entry.ts")],
    outfile: path.join(DIST, "newtab.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["firefox142"],
    sourcemap: DEV ? "inline" : false,
    minify: !DEV,
    define: {
      "process.env.UNSPLASH_ACCESS_KEY": JSON.stringify(unsplashKey),
    },
    logLevel: "info",
  };
}

function themeInitBundleOptions(): BuildOptions {
  // theme-init.ts must execute synchronously in <head>, before stylesheet parse.
  // Phase 2: source lives in packages/firefox/. Phase 3 moves it to shared.
  return {
    entryPoints: [path.join(HERE, "theme-init.ts")],
    outfile: path.join(DIST, "theme-init.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["firefox142"],
    sourcemap: DEV ? "inline" : false,
    minify: !DEV,
    logLevel: "info",
  };
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const [unsplashKey, version] = await Promise.all([
    loadUnsplashKey(),
    readSharedVersion(),
  ]);

  await copyAssets(version);

  if (WATCH) {
    const pageCtx = await context(pageBundleOptions(unsplashKey));
    const themeCtx = await context(themeInitBundleOptions());
    await Promise.all([pageCtx.watch(), themeCtx.watch()]);
    console.log("esbuild watching… (Ctrl+C to exit)");
  } else {
    await Promise.all([
      build(pageBundleOptions(unsplashKey)),
      build(themeInitBundleOptions()),
    ]);
    console.log(`Built @topmarks/firefox v${version} → ${path.relative(REPO_ROOT, DIST)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
