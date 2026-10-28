import { registerAs } from "@nestjs/config";

export interface HelpdeskConfig {
  enabled: boolean;
  baseURL: string;
  appVersion?: string;
}

/** Read-only catalog configuration. Core never accepts a publishing credential. */
export function readHelpdeskConfig(env: NodeJS.ProcessEnv = process.env): HelpdeskConfig {
  const enabled = env.HELPDESK_ENABLED?.trim().toLowerCase() ?? "true";
  if (enabled !== "true" && enabled !== "false") {
    throw new Error("HELPDESK_ENABLED must be true or false");
  }

  const baseURL = env.HELPDESK_API_URL?.trim() || "https://help.mentingo.com";
  let url: URL;
  try {
    url = new URL(baseURL);
  } catch {
    throw new Error("HELPDESK_API_URL must be an HTTPS origin or local HTTP origin");
  }

  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("HELPDESK_API_URL must be an HTTPS origin or local HTTP origin");
  }

  const appVersion = env.HELPDESK_APP_VERSION?.trim();
  return {
    enabled: enabled === "true",
    baseURL: url.origin,
    ...(appVersion ? { appVersion } : {}),
  };
}

export default registerAs("helpdesk", () => readHelpdeskConfig());
