export type ScormContentConfig = {
  origin: string;
  parentOrigin: string;
  connectOrigins: string[];
  enforceConnectSrc: boolean;
};

export function exactHttpsOrigin(value: string): string {
  if (!value || !value.startsWith("https://")) throw new Error("SCORM origin must be HTTPS");
  const url = new URL(value);
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.hostname.includes("*")
  ) {
    throw new Error("SCORM origin must be an exact HTTPS origin");
  }
  return value;
}

export function resolveScormContentConfig(
  env: NodeJS.ProcessEnv,
  parentOrigin: string,
): ScormContentConfig {
  const origin = exactHttpsOrigin(
    env.SCORM_CONTENT_ORIGIN ||
      (env.NODE_ENV === "development" || env.NODE_ENV === "test"
        ? "https://scorm.lms.localhost"
        : ""),
  );
  const parent = exactHttpsOrigin(parentOrigin);
  if (origin === parent) throw new Error("SCORM content and LMS must use different origins");
  if (
    env.SCORM_CONTENT_ENFORCE_CONNECT_SRC &&
    !["true", "false"].includes(env.SCORM_CONTENT_ENFORCE_CONNECT_SRC)
  ) {
    throw new Error("Invalid SCORM_CONTENT_ENFORCE_CONNECT_SRC");
  }
  const connectOrigins = (env.SCORM_CONTENT_ALLOWED_CONNECT_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(exactHttpsOrigin);
  return {
    origin,
    parentOrigin: parent,
    connectOrigins,
    enforceConnectSrc: env.SCORM_CONTENT_ENFORCE_CONNECT_SRC === "true",
  };
}

export function contentHeaders(config: ScormContentConfig): Record<string, string> {
  const connect = `connect-src 'self' ${config.connectOrigins.join(" ")}`.trim();
  const enforced = [
    `sandbox allow-scripts allow-same-origin allow-forms allow-modals`,
    `frame-ancestors ${config.parentOrigin} 'self'`,
    "object-src 'none'",
    "form-action 'none'",
  ];
  if (config.enforceConnectSrc) enforced.push(connect);
  return {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), fullscreen=()",
    "Content-Security-Policy": enforced.join("; "),
    "Content-Security-Policy-Report-Only": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "font-src 'self' data:",
      connect,
    ].join("; "),
  };
}
