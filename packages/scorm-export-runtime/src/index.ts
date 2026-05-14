export const SCORM_EXPORT_RUNTIME_VERSION = "0.1.0";

export const SCORM_EXPORT_RUNTIME_PLAYER_FILES = [
  "player/index.html",
  "player/main.global.js",
  "player/styles.css",
  "player/video-js.css",
  "player/video-js.js",
  "player/videojs-youtube.js",
  "player/vimeo-player.js",
  "player/assets/mentingo-signet.svg",
  "player/assets/fonts/open-sans-latin-400-normal.woff2",
  "player/assets/fonts/open-sans-latin-600-normal.woff2",
  "player/assets/fonts/open-sans-latin-700-normal.woff2",
  "player/assets/fonts/open-sans-latin-800-normal.woff2",
] as const;

export const SCORM_EXPORT_DEFAULT_LOGO_PATH = "player/assets/mentingo-signet.svg";

export const SCORM_EXPORT_SUPPORTED_VIDEO_PROVIDERS = [
  "selfHosted",
  "bunny",
  "vimeo",
  "youtube",
] as const;

export type ScormExportRuntimePlayerFile = (typeof SCORM_EXPORT_RUNTIME_PLAYER_FILES)[number];
export type ScormExportSupportedVideoProvider =
  (typeof SCORM_EXPORT_SUPPORTED_VIDEO_PROVIDERS)[number];
