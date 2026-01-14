import { match } from "ts-pattern";

export const VIDEO_NODE_TYPE = "video" as const;

export type VideoSourceType = "internal" | "external";
export type VideoProvider = "self" | "youtube" | "vimeo" | "bunny" | "unknown";

export type VideoEmbedAttrs = {
  src: string | null;
  sourceType: VideoSourceType;
  provider: VideoProvider;
};

const isVideoSourceType = (value: string | null | undefined): value is VideoSourceType =>
  value === "internal" || value === "external";

const isVideoProvider = (value: string | null | undefined): value is VideoProvider =>
  value === "self" ||
  value === "youtube" ||
  value === "vimeo" ||
  value === "bunny" ||
  value === "unknown";

const tryParseUrl = (input: string): URL | null => {
  try {
    return new URL(input);
  } catch {
    return null;
  }
};

const extractYoutubeId = (url: URL): string | null => {
  if (url.hostname === "youtu.be") {
    return url.pathname.replace("/", "").split("/")[0] || null;
  }

  if (url.pathname === "/watch") {
    return url.searchParams.get("v");
  }

  const pathParts = url.pathname.split("/").filter(Boolean);

  const embedIndex = pathParts.findIndex((part) => part === "embed" || part === "shorts");

  if (embedIndex !== -1 && pathParts[embedIndex + 1]) {
    return pathParts[embedIndex + 1];
  }

  return null;
};

const extractVimeoId = (url: URL): string | null => {
  const pathParts = url.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  if (!lastPart) return null;

  return /^\d+$/.test(lastPart) ? lastPart : null;
};

export const extractUrlFromClipboard = (e: ClipboardEvent): string | null => {
  const text = e.clipboardData?.getData("text/plain")?.trim();
  if (text) return text;

  const html = e.clipboardData?.getData("text/html")?.trim();
  if (!html) return null;

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.querySelector("a[href]")?.getAttribute("href")?.trim() ?? null;
  } catch {
    return null;
  }
};

export const detectVideoProvider = (src: string): VideoProvider => {
  const url = tryParseUrl(src);

  if (!url) return "unknown";

  const host = url.hostname.toLowerCase();

  return match(host)
    .when(
      (value) => value === "youtu.be" || value.endsWith("youtube.com"),
      () => "youtube" as const,
    )
    .when(
      (value) => value.endsWith("vimeo.com"),
      () => "vimeo" as const,
    )
    .when(
      (value) => value.includes("bunny") || value.includes("b-cdn"),
      () => "bunny" as const,
    )
    .otherwise(() => "unknown");
};

export const canonicalizeExternalUrl = (src: string, provider?: VideoProvider): string => {
  const url = tryParseUrl(src);
  if (!url) return src;

  const resolvedProvider = provider ?? detectVideoProvider(src);

  return match(resolvedProvider)
    .with("youtube", () => {
      const id = extractYoutubeId(url);
      return id ? `https://www.youtube.com/watch?v=${id}` : url.toString();
    })
    .with("vimeo", () => {
      const id = extractVimeoId(url);
      return id ? `https://vimeo.com/${id}` : url.toString();
    })
    .otherwise(() => url.toString());
};

type VideoEmbedAttrsInput = {
  src?: string | null;
  sourceType?: string | null;
  provider?: string | null;
};

export const normalizeVideoEmbedAttributes = (attrs: VideoEmbedAttrsInput): VideoEmbedAttrs => {
  const src = typeof attrs.src === "string" ? attrs.src.trim() : "";

  const sourceType: VideoSourceType = match(attrs.sourceType)
    .when(isVideoSourceType, (value) => value)
    .otherwise(() => "external");

  const detectedProvider = sourceType === "internal" ? "self" : detectVideoProvider(src || "");

  const provider = match(attrs.provider)
    .when(isVideoProvider, (value) => value)
    .otherwise(() => detectedProvider);

  const finalSrc = sourceType === "external" && src ? canonicalizeExternalUrl(src, provider) : src;

  return {
    src: finalSrc || null,
    sourceType,
    provider,
  };
};

export const getVideoEmbedAttrsFromElement = (element: HTMLElement): VideoEmbedAttrs | false => {
  const nodeType = element.getAttribute("data-node-type") ?? null;

  if (nodeType !== VIDEO_NODE_TYPE) return false;

  const src = element.getAttribute("data-src");

  if (!src) return false;

  const sourceTypeAttr = element.getAttribute("data-source-type");
  const providerAttr = element.getAttribute("data-provider");

  const sourceType: VideoSourceType = match(sourceTypeAttr)
    .when(isVideoSourceType, (value) => value)
    .otherwise(() => "external");

  const provider = match(providerAttr)
    .when(isVideoProvider, (value) => value)
    .otherwise(() => (sourceType === "internal" ? "self" : detectVideoProvider(src)));

  return normalizeVideoEmbedAttributes({
    src,
    sourceType,
    provider,
  });
};
