/** Fetches public page metadata for authoring source citations behind strict SSRF guards. */
import { createHash } from "node:crypto";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

import { BadRequestException, Inject, Injectable, Logger, Optional } from "@nestjs/common";

import { CACHE_MANAGER_TOKEN, type Cache } from "src/cache/cache.types";

import {
  LINK_PREVIEW_FETCHER,
  type LinkPreviewHttpFetcher,
  type LinkPreviewHttpResponse,
} from "./course-authoring-link-preview.types";
import {
  extractLinkMetadata,
  isBlockedAddress,
  parsePublicHttpUrl,
} from "./course-authoring-link-preview.utils";

import type { AuthoringLinkPreview } from "./schema/course-authoring-link-preview.schema";
import type { LookupFunction } from "node:net";

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 15 * 60 * 1000;
const CACHE_PREFIX = "course-authoring:link-preview:";
const USER_AGENT = "MentingoLinkPreview/1.0 (+https://mentingo.com)";

/** Resolves DNS and refuses to connect when any returned address is non-public. */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as LookupAddress[];
    if (list.length === 0 || list.some(({ address }) => isBlockedAddress(address))) {
      return callback(
        Object.assign(new Error("Blocked link preview address"), { code: "EBLOCKED" }),
        "",
        0,
      );
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
};

/** Issues one GET without following redirects and reads at most MAX_BODY_BYTES of HTML. */
export const nodeLinkPreviewFetcher: LinkPreviewHttpFetcher = (url) =>
  new Promise<LinkPreviewHttpResponse>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-language": "en;q=0.9,*;q=0.5",
          "user-agent": USER_AGENT,
        },
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const contentType = response.headers["content-type"] ?? null;
        const location = response.headers.location ?? null;
        const isHtml =
          contentType !== null && /text\/html|application\/xhtml\+xml/i.test(contentType);
        if (statusCode < 200 || statusCode >= 300 || !isHtml) {
          response.destroy();
          return resolve({ statusCode, location, contentType, body: null });
        }

        const chunks: Buffer[] = [];
        let received = 0;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase();
          let decoder: TextDecoder;
          try {
            decoder = new TextDecoder(charset || "utf-8");
          } catch {
            decoder = new TextDecoder("utf-8");
          }
          resolve({
            statusCode,
            location,
            contentType,
            body: decoder.decode(Buffer.concat(chunks)),
          });
        };
        response.on("data", (chunk: Buffer) => {
          const remaining = MAX_BODY_BYTES - received;
          chunks.push(chunk.subarray(0, Math.max(remaining, 0)));
          received += chunk.length;
          if (received >= MAX_BODY_BYTES) {
            response.destroy();
            finish();
          }
        });
        response.on("end", finish);
        response.on("error", reject);
      },
    );
    const deadline = setTimeout(
      () => request.destroy(new Error("Link preview timed out")),
      REQUEST_TIMEOUT_MS,
    );
    request.on("close", () => clearTimeout(deadline));
    request.on("timeout", () => request.destroy(new Error("Link preview timed out")));
    request.on("error", reject);
    request.end();
  });

@Injectable()
export class CourseAuthoringLinkPreviewService {
  private readonly logger = new Logger(CourseAuthoringLinkPreviewService.name);
  private readonly fetchOnce: LinkPreviewHttpFetcher;

  constructor(
    @Inject(CACHE_MANAGER_TOKEN) private readonly cache: Cache,
    @Optional() @Inject(LINK_PREVIEW_FETCHER) fetcher?: LinkPreviewHttpFetcher,
  ) {
    this.fetchOnce = fetcher ?? nodeLinkPreviewFetcher;
  }

  /** Returns cached or freshly fetched metadata; unreachable pages degrade to the bare domain. */
  async preview(rawUrl: string): Promise<AuthoringLinkPreview> {
    const url = parsePublicHttpUrl(rawUrl);
    if (!url) throw new BadRequestException("courseAuthoring.linkPreview.invalidUrl");

    const cacheKey = `${CACHE_PREFIX}${createHash("sha256").update(url.href).digest("hex")}`;
    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    const fallback = this.emptyPreview(url, url);
    let preview = fallback;
    try {
      preview = await this.fetchWithRedirects(url);
    } catch (error) {
      this.logger.debug(
        `Link preview unavailable for ${url.hostname}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
    await this.writeCache(
      cacheKey,
      preview,
      preview === fallback ? FAILURE_TTL_MS : SUCCESS_TTL_MS,
    );
    return preview;
  }

  private async fetchWithRedirects(original: URL): Promise<AuthoringLinkPreview> {
    let current = original;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const response = await this.fetchOnce(current);
      if (response.statusCode >= 300 && response.statusCode < 400 && response.location) {
        const next = parsePublicHttpUrl(response.location, current);
        if (!next) throw new Error("Redirect target rejected");
        current = next;
        continue;
      }
      if (!response.body) return this.emptyPreview(original, current);
      return {
        ...this.emptyPreview(original, current),
        ...extractLinkMetadata(response.body, current),
      };
    }
    throw new Error("Too many redirects");
  }

  private emptyPreview(original: URL, finalUrl: URL): AuthoringLinkPreview {
    const hostname = finalUrl.hostname.replace(/^www\./, "");
    return {
      url: original.href,
      finalUrl: finalUrl.href,
      domain: isIP(hostname) ? finalUrl.hostname : hostname,
      title: null,
      description: null,
      siteName: null,
      imageUrl: null,
      faviconUrl: null,
    };
  }

  private async readCache(key: string) {
    try {
      return (await this.cache.get<AuthoringLinkPreview>(key)) ?? null;
    } catch {
      return null;
    }
  }

  private async writeCache(key: string, value: AuthoringLinkPreview, ttl: number) {
    try {
      await this.cache.set(key, value, ttl);
    } catch {
      // A cache outage only costs a refetch.
    }
  }
}
