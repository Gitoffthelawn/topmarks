// Build the zip from the dist/ directory produced by build.ts.
// Only runtime files live in dist/, so no ignoreFiles needed.
module.exports = {
  sourceDir: "./dist",
  build: {
    filename: "topmarks-firefox-v{version}.zip",
    overwriteDest: true,
  },
};
