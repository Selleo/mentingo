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

  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    return "youtube";
  }

  if (host.endsWith("vimeo.com")) {
    return "vimeo";
  }

  if (host.includes("bunny") || host.includes("b-cdn")) {
    return "bunny";
  }

  return "unknown";
};

export const canonicalizeExternalUrl = (src: string, provider?: VideoProvider): string => {
  const url = tryParseUrl(src);
  if (!url) return src;

  const resolvedProvider = provider ?? detectVideoProvider(src);

  if (resolvedProvider === "youtube") {
    const id = extractYoutubeId(url);
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  }

  if (resolvedProvider === "vimeo") {
    const id = extractVimeoId(url);
    if (id) return `https://vimeo.com/${id}`;
  }

  return url.toString();
};

type VideoEmbedAttrsInput = {
  src?: string | null;
  sourceType?: string | null;
  provider?: string | null;
};

export const normalizeVideoEmbedAttributes = (attrs: VideoEmbedAttrsInput): VideoEmbedAttrs => {
  const rawSrc = typeof attrs.src === "string" ? attrs.src.trim() : "";
  const sourceType = isVideoSourceType(attrs.sourceType) ? attrs.sourceType : "external";
  const detectedProvider = sourceType === "internal" ? "self" : detectVideoProvider(rawSrc || "");
  const provider = isVideoProvider(attrs.provider) ? attrs.provider : detectedProvider;
  const finalSrc =
    sourceType === "external" && rawSrc ? canonicalizeExternalUrl(rawSrc, provider) : rawSrc;

  return {
    src: finalSrc || null,
    sourceType,
    provider,
  };
};

export const getVideoEmbedAttrsFromElement = (element: HTMLElement): VideoEmbedAttrs | false => {
  const nodeType =
    element.getAttribute("data-node-type") ?? element.getAttribute("data-type") ?? null;

  if (nodeType && nodeType !== VIDEO_NODE_TYPE) return false;

  const src =
    element.getAttribute("data-src") ??
    element.getAttribute("data-url") ??
    element.getAttribute("href") ??
    element.getAttribute("src");

  if (!src) return false;

  const sourceTypeAttr = element.getAttribute("data-source-type");
  const providerAttr = element.getAttribute("data-provider");
  const legacyExternal = element.getAttribute("data-external");

  const sourceType = isVideoSourceType(sourceTypeAttr)
    ? sourceTypeAttr
    : legacyExternal === "true"
      ? "external"
      : "internal";

  const provider = isVideoProvider(providerAttr)
    ? providerAttr
    : sourceType === "internal"
      ? "self"
      : detectVideoProvider(src);

  return normalizeVideoEmbedAttributes({
    src,
    sourceType,
    provider,
  });
};
