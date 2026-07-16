import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const playerSourceRoot = join(packageRoot, "src", "player");
const playerDistRoot = join(packageRoot, "dist", "player");
const assetDistRoot = join(playerDistRoot, "assets");
const fontDistRoot = join(assetDistRoot, "fonts");

function copyRequiredFile(source, target) {
  if (!existsSync(source)) {
    throw new Error(`Missing SCORM export runtime asset: ${source}`);
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function packagePath(packageName, relativePath) {
  return join(dirname(require.resolve(`${packageName}/package.json`)), relativePath);
}

mkdirSync(assetDistRoot, { recursive: true });
mkdirSync(fontDistRoot, { recursive: true });

copyRequiredFile(join(playerSourceRoot, "index.html"), join(playerDistRoot, "index.html"));
copyRequiredFile(join(playerSourceRoot, "styles.css"), join(playerDistRoot, "styles.css"));
copyRequiredFile(
  join(playerSourceRoot, "assets", "mentingo-signet.svg"),
  join(assetDistRoot, "mentingo-signet.svg"),
);

[
  "open-sans-latin-400-normal.woff2",
  "open-sans-latin-600-normal.woff2",
  "open-sans-latin-700-normal.woff2",
  "open-sans-latin-800-normal.woff2",
].forEach((fontFile) => {
  copyRequiredFile(
    packagePath("@fontsource/open-sans", `files/${fontFile}`),
    join(fontDistRoot, fontFile),
  );
});

copyRequiredFile(packagePath("video.js", "dist/video.min.js"), join(playerDistRoot, "video-js.js"));
copyRequiredFile(packagePath("video.js", "dist/video-js.min.css"), join(playerDistRoot, "video-js.css"));
copyRequiredFile(
  packagePath("videojs-youtube", "dist/Youtube.min.js"),
  join(playerDistRoot, "videojs-youtube.js"),
);
copyRequiredFile(packagePath("@vimeo/player", "dist/player.min.js"), join(playerDistRoot, "vimeo-player.js"));
