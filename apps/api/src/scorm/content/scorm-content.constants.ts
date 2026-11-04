export const SCORM_CONTENT_READ_METHODS = {
  GET: "GET",
  HEAD: "HEAD",
} as const;

export const SCORM_CONTENT_CONFIG = {
  LOCAL_ORIGIN: "https://scorm.lms.localhost",
  REDIS_KEY_PREFIX: "scorm:content:",
  RUNTIME_BUNDLE: "scorm12.min.js",
} as const;

export const SCORM_CONTENT_RESPONSE_POLICY = {
  CACHE_CONTROL: "private, no-store",
  CONTENT_TYPE_OPTIONS: "nosniff",
  PERMISSIONS_POLICY: "camera=(), microphone=(), geolocation=(), payment=(), fullscreen=()",
} as const;

export const SCORM_CONTENT_CSP = {
  OBJECT_SRC: "object-src 'none'",
  FORM_ACTION: "form-action 'none'",
} as const;

export const SCORM_CONTENT_REPORT_ONLY_CSP = {
  DEFAULT_SRC: "default-src 'self'",
  SCRIPT_SRC: "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  STYLE_SRC: "style-src 'self' 'unsafe-inline'",
  IMG_SRC: "img-src 'self' data: blob:",
  MEDIA_SRC: "media-src 'self' blob:",
  FONT_SRC: "font-src 'self' data:",
  CONNECT_SRC: "connect-src 'self'",
} as const;

export const SCORM_CONTENT_CONFIG_ERRORS = {
  MISSING_ORIGIN: "SCORM_CONTENT_ORIGIN must be configured",
  INVALID_ORIGIN: "SCORM_CONTENT_ORIGIN must be an HTTPS origin",
} as const;

export const SCORM_CONTENT_ERROR_KEYS = {
  NOT_FOUND: "adminScorm.errors.runtime.contentNotFound",
  FORBIDDEN: "adminScorm.errors.runtime.contentForbidden",
  ACCESS_EXPIRED: "studentLessonView.scorm.contentAccessExpired",
  UNAVAILABLE: "adminScorm.errors.runtime.contentUnavailable",
} as const;
