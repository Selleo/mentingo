import { BadRequestException } from "@nestjs/common";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Reduces a plugin base URL to its origin. Only bare HTTPS origins are accepted, plus HTTP
 * localhost outside production, so stored plugin URLs never carry credentials, paths or queries.
 */
export function toPluginOrigin(baseUrl: string): string {
  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch {
    throw new BadRequestException("integrationApiKey.errors.invalidPluginOrigin");
  }

  const isLocalDevelopment =
    process.env.NODE_ENV !== "production" && LOCAL_HOSTNAMES.includes(url.hostname);
  const hasAllowedProtocol =
    url.protocol === "https:" || (isLocalDevelopment && url.protocol === "http:");

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !hasAllowedProtocol
  ) {
    throw new BadRequestException("integrationApiKey.errors.invalidPluginOrigin");
  }

  return url.origin;
}
