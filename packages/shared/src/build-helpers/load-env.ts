// Reads UNSPLASH_ACCESS_KEY from a .env file at the given absolute path.
// Returns empty string if the file doesn't exist or the key isn't set —
// the build proceeds without an Unsplash key, the extension just won't
// load wallpapers until a key is provided.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export async function loadUnsplashKey(envPath: string): Promise<string> {
  if (!existsSync(envPath)) return "";
  try {
    const raw = await readFile(envPath, "utf8");
    const m = raw.match(/^\s*UNSPLASH_ACCESS_KEY\s*=\s*"?([^"\n]*)"?\s*$/m);
    return m ? (m[1] ?? "") : "";
  } catch {
    return "";
  }
}
