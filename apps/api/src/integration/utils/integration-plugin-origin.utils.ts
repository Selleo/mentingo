import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { match } from "ts-pattern";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];
const PLUGIN_DNS_TIMEOUT_MS = 5_000;

const NON_PUBLIC_ADDRESSES = createNonPublicAddressBlockList();

function createNonPublicAddressBlockList(): BlockList {
  const blockList = new BlockList();

  blockList.addSubnet("0.0.0.0", 8, "ipv4");
  blockList.addSubnet("10.0.0.0", 8, "ipv4");
  blockList.addSubnet("100.64.0.0", 10, "ipv4");
  blockList.addSubnet("127.0.0.0", 8, "ipv4");
  blockList.addSubnet("169.254.0.0", 16, "ipv4");
  blockList.addSubnet("172.16.0.0", 12, "ipv4");
  blockList.addSubnet("192.0.0.0", 24, "ipv4");
  blockList.addSubnet("192.168.0.0", 16, "ipv4");
  blockList.addSubnet("198.18.0.0", 15, "ipv4");
  blockList.addSubnet("224.0.0.0", 4, "ipv4");
  blockList.addSubnet("240.0.0.0", 4, "ipv4");

  blockList.addAddress("::", "ipv6");
  blockList.addAddress("::1", "ipv6");
  blockList.addSubnet("64:ff9b::", 96, "ipv6");
  blockList.addSubnet("fc00::", 7, "ipv6");
  blockList.addSubnet("fe80::", 10, "ipv6");
  blockList.addSubnet("ff00::", 8, "ipv6");

  return blockList;
}

/**
 * Reduces a plugin base URL to its origin. Only bare HTTPS origins that resolve to public
 * addresses are accepted, plus HTTP localhost outside production, so stored plugin URLs never
 * carry credentials, paths or queries and never point the API at internal services.
 */
export async function toPluginOrigin(baseUrl: string): Promise<string> {
  const url = parsePluginOriginUrl(baseUrl);

  if (!url || !(await isPluginHostAllowed(url))) {
    throw new BadRequestException("integrationApiKey.errors.invalidPluginOrigin");
  }

  return url.origin;
}

/**
 * Re-checks a stored plugin origin right before it is called, because its DNS records may have
 * changed since it was saved.
 */
export async function isAllowedPluginOrigin(baseUrl: string): Promise<boolean> {
  const url = parsePluginOriginUrl(baseUrl);

  return url !== null && (await isPluginHostAllowed(url));
}

function parsePluginOriginUrl(baseUrl: string): URL | null {
  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }

  const hasAllowedProtocol =
    url.protocol === "https:" || (isLocalDevelopmentHost(url) && url.protocol === "http:");

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !hasAllowedProtocol
  ) {
    return null;
  }

  return url;
}

function isLocalDevelopmentHost(url: URL): boolean {
  return process.env.NODE_ENV !== "production" && LOCAL_HOSTNAMES.includes(url.hostname);
}

/**
 * A hostname that does not resolve is allowed: the plugin call fails on the same lookup, so it
 * cannot reach anything.
 */
async function isPluginHostAllowed(url: URL): Promise<boolean> {
  if (isLocalDevelopmentHost(url)) return true;

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await resolveHostAddresses(hostname);

  return addresses.every((address) => !isNonPublicAddress(address));
}

async function resolveHostAddresses(hostname: string): Promise<string[]> {
  if (isIP(hostname)) return [hostname];

  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      lookup(hostname, { all: true, verbatim: true }).then((resolved) =>
        resolved.map(({ address }) => address),
      ),
      new Promise<never>((_resolve, reject) => {
        deadline = setTimeout(
          () =>
            reject(
              new ServiceUnavailableException("integrationApiKey.errors.pluginAddressUnavailable"),
            ),
          PLUGIN_DNS_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (error) {
    if (error instanceof ServiceUnavailableException) throw error;
    return [];
  } finally {
    if (deadline !== undefined) clearTimeout(deadline);
  }
}

/** IPv4-mapped IPv6 addresses such as `::ffff:127.0.0.1` are matched against the IPv4 ranges. */
function isNonPublicAddress(address: string): boolean {
  const family = match(isIP(address))
    .with(4, () => "ipv4" as const)
    .otherwise(() => "ipv6" as const);

  return NON_PUBLIC_ADDRESSES.check(address, family);
}
