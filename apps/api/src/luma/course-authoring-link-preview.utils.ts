/** Pure SSRF guards and HTML metadata extraction for authoring source link previews. */
import { BlockList, isIP } from "node:net";

import { load as loadHtml } from "cheerio";

import type { ExtractedLinkMetadata } from "./course-authoring-link-preview.types";

const blockedAddresses = new BlockList();
[
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
].forEach(([address, prefix]) => blockedAddresses.addSubnet(address as string, prefix as number));
[
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
].forEach(([address, prefix]) =>
  blockedAddresses.addSubnet(address as string, prefix as number, "ipv6"),
);

const MAPPED_IPV4 = /^::ffff:(?:0:)?(\d{1,3}(?:\.\d{1,3}){3})$/i;
const MAPPED_IPV4_HEX = /^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;

/** Rejects every address that is not a globally routable unicast destination. */
export const isBlockedAddress = (rawAddress: string): boolean => {
  const address = rawAddress.replace(/^\[|\]$/g, "").split("%")[0];
  const family = isIP(address);
  if (family === 4) return blockedAddresses.check(address, "ipv4");
  if (family !== 6) return true;

  const mapped = MAPPED_IPV4.exec(address);
  if (mapped) return isBlockedAddress(mapped[1]);
  const mappedHex = MAPPED_IPV4_HEX.exec(address);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return isBlockedAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  if (/^::ffff:/i.test(address)) return true;
  return blockedAddresses.check(address, "ipv6");
};

/** Parses a candidate URL and returns it only when it is a public http(s) page on a default port. */
export const parsePublicHttpUrl = (raw: string, base?: URL): URL | null => {
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  // URL normalizes 80/443 to an empty port for their matching protocols.
  if (url.port !== "") return null;
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) return null;
  if (hostname.endsWith(".internal") || hostname.endsWith(".local")) return null;
  if (isIP(hostname) && isBlockedAddress(hostname)) return null;
  if (!isIP(hostname) && !hostname.includes(".")) return null;
  url.hash = "";
  return url;
};

const collapseWhitespace = (value: string | undefined | null, maxLength: number) => {
  const collapsed = value?.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed.length > maxLength
    ? `${collapsed.slice(0, maxLength - 1).trimEnd()}…`
    : collapsed;
};

const absoluteHttpUrl = (value: string | undefined, base: URL) => {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim(), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    const href = url.toString();
    return href.length <= 2048 ? href : null;
  } catch {
    return null;
  }
};

/** Extracts display-safe metadata from a size-limited HTML document. */
export const extractLinkMetadata = (html: string, pageUrl: URL): ExtractedLinkMetadata => {
  const $ = loadHtml(html);
  const meta = (...selectors: string[]) => {
    for (const selector of selectors) {
      const content = $(selector).first().attr("content");
      if (content?.trim()) return content;
    }
    return undefined;
  };
  const iconHref = $('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    .first()
    .attr("href");

  return {
    title: collapseWhitespace(
      meta('meta[property="og:title"]', 'meta[name="twitter:title"]') ?? $("title").first().text(),
      300,
    ),
    description: collapseWhitespace(
      meta(
        'meta[property="og:description"]',
        'meta[name="description"]',
        'meta[name="twitter:description"]',
      ),
      600,
    ),
    siteName: collapseWhitespace(meta('meta[property="og:site_name"]'), 120),
    imageUrl: absoluteHttpUrl(
      meta('meta[property="og:image"]', 'meta[name="twitter:image"]'),
      pageUrl,
    ),
    faviconUrl: absoluteHttpUrl(iconHref ?? "/favicon.ico", pageUrl),
  };
};
