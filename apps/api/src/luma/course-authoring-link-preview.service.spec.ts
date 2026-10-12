import { BadRequestException } from "@nestjs/common";

import { CourseAuthoringLinkPreviewService } from "./course-authoring-link-preview.service";
import {
  extractLinkMetadata,
  isBlockedAddress,
  parsePublicHttpUrl,
} from "./course-authoring-link-preview.utils";

import type { LinkPreviewHttpFetcher } from "./course-authoring-link-preview.types";
import type { Cache } from "src/cache/cache.types";

const memoryCache = () => {
  const store = new Map<string, unknown>();
  return {
    store,
    cache: {
      get: jest.fn(async (key: string) => store.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        store.set(key, value);
        return value;
      }),
    } as unknown as Cache,
  };
};

describe("course authoring link preview guards", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a00:1",
    "not-an-ip",
  ])("blocks non-public address %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "allows public address %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );

  it.each([
    "ftp://example.com/file",
    "javascript:alert(1)",
    "http://user:pass@example.com/",
    "https://example.com:8443/",
    "http://localhost/",
    "http://app.localhost/",
    "http://metadata.internal/",
    "http://printer.local/",
    "http://intranet/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data",
    "not a url",
  ])("rejects unsafe URL %s", (url) => {
    expect(parsePublicHttpUrl(url)).toBeNull();
  });

  it("accepts public http(s) URLs on default ports and drops the fragment", () => {
    expect(parsePublicHttpUrl("https://example.com:443/docs#intro")?.href).toBe(
      "https://example.com/docs",
    );
    expect(parsePublicHttpUrl("http://example.com/a")?.href).toBe("http://example.com/a");
  });
});

describe("extractLinkMetadata", () => {
  const pageUrl = new URL("https://docs.example.com/guide/start");

  it("prefers Open Graph values and absolutizes image and icon URLs", () => {
    const metadata = extractLinkMetadata(
      `<html><head>
        <title>Fallback title</title>
        <meta property="og:title" content="  Getting   started  ">
        <meta property="og:description" content="How to onboard.">
        <meta name="description" content="Plain description">
        <meta property="og:site_name" content="Example Docs">
        <meta property="og:image" content="/img/cover.png">
        <link rel="icon" href="/static/icon.svg">
      </head></html>`,
      pageUrl,
    );

    expect(metadata).toEqual({
      title: "Getting started",
      description: "How to onboard.",
      siteName: "Example Docs",
      imageUrl: "https://docs.example.com/img/cover.png",
      faviconUrl: "https://docs.example.com/static/icon.svg",
    });
  });

  it("falls back to the title tag, meta description and /favicon.ico", () => {
    const metadata = extractLinkMetadata(
      `<title>Plain page</title><meta name="description" content="Plain description">`,
      pageUrl,
    );

    expect(metadata.title).toBe("Plain page");
    expect(metadata.description).toBe("Plain description");
    expect(metadata.faviconUrl).toBe("https://docs.example.com/favicon.ico");
    expect(metadata.imageUrl).toBeNull();
  });

  it("drops non-http image URLs and truncates long text", () => {
    const metadata = extractLinkMetadata(
      `<meta property="og:image" content="javascript:alert(1)"><title>${"a".repeat(400)}</title>`,
      pageUrl,
    );

    expect(metadata.imageUrl).toBeNull();
    expect(metadata.title).toHaveLength(300);
    expect(metadata.title?.endsWith("…")).toBe(true);
  });
});

describe("CourseAuthoringLinkPreviewService", () => {
  it("rejects unsafe URLs before fetching", async () => {
    const fetcher = jest.fn<
      ReturnType<LinkPreviewHttpFetcher>,
      Parameters<LinkPreviewHttpFetcher>
    >();
    const service = new CourseAuthoringLinkPreviewService(memoryCache().cache, fetcher);

    await expect(service.preview("http://127.0.0.1/admin")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("follows validated redirects, extracts metadata and caches the result", async () => {
    const fetcher = jest
      .fn<ReturnType<LinkPreviewHttpFetcher>, Parameters<LinkPreviewHttpFetcher>>()
      .mockResolvedValueOnce({
        statusCode: 301,
        location: "https://www.example.com/start",
        contentType: null,
        body: null,
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        location: null,
        contentType: "text/html",
        body: `<title>Start here</title><meta name="description" content="Welcome">`,
      });
    const { cache } = memoryCache();
    const service = new CourseAuthoringLinkPreviewService(cache, fetcher);

    const preview = await service.preview("http://example.com/start");
    const again = await service.preview("http://example.com/start");

    expect(preview).toMatchObject({
      url: "http://example.com/start",
      finalUrl: "https://www.example.com/start",
      domain: "example.com",
      title: "Start here",
      description: "Welcome",
    });
    expect(again).toEqual(preview);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("never follows a redirect to a private address and degrades to the bare domain", async () => {
    const fetcher = jest
      .fn<ReturnType<LinkPreviewHttpFetcher>, Parameters<LinkPreviewHttpFetcher>>()
      .mockResolvedValue({
        statusCode: 302,
        location: "http://169.254.169.254/latest/meta-data",
        contentType: null,
        body: null,
      });
    const service = new CourseAuthoringLinkPreviewService(memoryCache().cache, fetcher);

    const preview = await service.preview("https://example.com/redirect");

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(preview).toMatchObject({ domain: "example.com", title: null, description: null });
  });

  it("stops after the redirect limit", async () => {
    const fetcher = jest
      .fn<ReturnType<LinkPreviewHttpFetcher>, Parameters<LinkPreviewHttpFetcher>>()
      .mockImplementation(async (url) => ({
        statusCode: 302,
        location: `${url.href}x`,
        contentType: null,
        body: null,
      }));
    const service = new CourseAuthoringLinkPreviewService(memoryCache().cache, fetcher);

    const preview = await service.preview("https://example.com/loop");

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(preview.title).toBeNull();
  });
});
