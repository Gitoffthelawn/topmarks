// Read packages/shared/package.json's version, write it into root,
// packages/firefox, and packages/chrome package.json files. Run manually
// before tagging a release. Build-time manifest stamping is separate and
// always reads from packages/shared/package.json directly.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readVersion(file) {
  return JSON.parse(await readFile(file, "utf8")).version;
}

async function writeVersion(file, version) {
  const pkg = JSON.parse(await readFile(file, "utf8"));
  if (pkg.version === version) return false;
  pkg.version = version;
  await writeFile(file, JSON.stringify(pkg, null, 2) + "\n");
  return true;
}

const sharedPkg = path.join(ROOT, "packages", "shared", "package.json");
const version = await readVersion(sharedPkg);

const targets = [
  path.join(ROOT, "package.json"),
  path.join(ROOT, "packages", "firefox", "package.json"),
  path.join(ROOT, "packages", "chrome", "package.json"),
];

let updated = 0;
for (const file of targets) {
  if (await writeVersion(file, version)) {
    console.log(`Updated ${path.relative(ROOT, file)} → ${version}`);
    updated += 1;
  }
}
console.log(`Sync complete: ${updated} file(s) updated to ${version}.`);
