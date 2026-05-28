// web-ext config — controls what `web-ext lint` and `web-ext build` see.
// Only files needed at runtime should ship in the ZIP; everything else
// (docs, build tooling, env files) is excluded here.
module.exports = {
  build: {
    // {version} is replaced with manifest.json's version field.
    filename: "topmarks-extension-v{version}.zip",
    overwriteDest: true,
  },
  ignoreFiles: [
    ".env",
    ".env.example",
    ".git/**",
    ".github/**",
    ".gitignore",
    ".nvmrc",
    "build-config.sh",
    "node_modules/**",
    "package.json",
    "package-lock.json",
    "README.md",
    "PRIVACY.md",
    "LISTING.md",
    "sample-bookmarks.html",
    "web-ext-config.cjs",
    "web-ext-artifacts/**",
  ],
};
