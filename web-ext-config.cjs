// web-ext config — controls what `web-ext lint` and `web-ext build` see.
// Only files needed at runtime should ship in the ZIP; everything else
// (docs, build tooling, env files) is excluded here.
module.exports = {
  ignoreFiles: [
    ".env",
    ".env.example",
    ".git/**",
    ".gitignore",
    "build-config.sh",
    "node_modules/**",
    "package.json",
    "package-lock.json",
    "README.md",
    "PRIVACY.md",
    "web-ext-config.cjs",
    "web-ext-artifacts/**",
  ],
};
