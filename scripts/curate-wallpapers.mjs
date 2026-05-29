#!/usr/bin/env node
/*
 * Regenerate site/wallpapers.json — the curated wallpaper set for the
 * marketing site, with the attribution metadata Unsplash requires.
 *
 * Pulls random landscape photos from the same Unsplash collection the
 * extension uses (Tabliss curated, 1053828) and records, for each, the bits
 * the site needs to hotlink the image and credit it: the CDN asset id, the
 * photographer's name + profile URL, the photo page URL, and the dominant
 * color (used as a load-time placeholder). The images themselves are NOT
 * downloaded — the site hotlinks them from images.unsplash.com.
 *
 * Reads UNSPLASH_ACCESS_KEY from .env at the repo root. The key is never
 * written to the output and never shipped.
 *
 * Usage:  node scripts/curate-wallpapers.mjs [count]   (default 30, max 30)
 */

import { readFileSync, writeFileSync } from "node:fs";

const COLLECTION = "1053828";
const COUNT = Math.min(Number(process.argv[2]) || 30, 30);

function readEnvKey() {
  let txt = "";
  try {
    txt = readFileSync(new URL("../.env", import.meta.url), "utf8");
  } catch {
    throw new Error(".env not found at repo root — create it with UNSPLASH_ACCESS_KEY=...");
  }
  const m = txt.match(/^\s*UNSPLASH_ACCESS_KEY\s*=\s*(.+?)\s*$/m);
  if (!m) throw new Error("UNSPLASH_ACCESS_KEY not found in .env");
  return m[1].replace(/^["']|["']$/g, "");
}

const key = readEnvKey();
const url =
  `https://api.unsplash.com/photos/random` +
  `?collections=${COLLECTION}&orientation=landscape&count=${COUNT}`;

const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
if (!res.ok) {
  console.error(`Unsplash API ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const photos = await res.json();

const wallpapers = photos
  .map((p) => {
    // assetId is the bit after "photo-" in the CDN URL — what app.js hotlinks.
    const assetId = (p.urls.raw.match(/photo-([0-9a-f-]+)/) || [])[1] || null;
    return {
      id: assetId,
      author: p.user?.name || "Unknown",
      authorUrl: p.user?.links?.html || "https://unsplash.com/",
      photoUrl: p.links?.html || "https://unsplash.com/",
      color: p.color || "#222222",
    };
  })
  .filter((w) => w.id);

writeFileSync(
  new URL("../site/wallpapers.json", import.meta.url),
  JSON.stringify(wallpapers, null, 2) + "\n"
);

console.log(`Wrote site/wallpapers.json with ${wallpapers.length} wallpapers.`);
