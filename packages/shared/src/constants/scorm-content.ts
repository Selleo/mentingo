export const SCORM_CONTENT_PATHS = {
  CONTROLLER: "scorm/delivery/:token",
  PREFIX: "/api/scorm/delivery/",
  PLAYER: "player",
  ASSETS: "assets",
  RUNTIME_SCRIPT: "runtime.js",
  BOOTSTRAP_SCRIPT: "bootstrap.js",
} as const;

export const SCORM_CONTENT_TOKEN = {
  BYTE_LENGTH: 32,
  LENGTH: 64,
  PATTERN: "^[a-f0-9]{64}$",
} as const;

export const SCORM_CONTENT_ACCESS = {
  GRANT_TTL_SECONDS: 15 * 60,
  RENEW_INTERVAL_MS: 5 * 60 * 1000,
} as const;

export const SCORM_PLAYER_ATTRIBUTES = {
  SANDBOX: "allow-scripts allow-same-origin allow-forms allow-modals",
  REFERRER_POLICY: "no-referrer",
  IFRAME_ALLOW: "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'",
  CONTENT_FRAME_TEST_ID: "scorm-package-iframe",
} as const;
