import {
  VIDEO_EMBED_PROVIDERS,
  detectVideoProviderFromUrl,
  extractVimeoId,
  extractYoutubeId,
  tryParseUrl,
  type VideoProvider,
  type VideoAutoplay,
  VIDEO_AUTOPLAY,
} from "@repo/shared";
import { match } from "ts-pattern";

export const VIDEO_NODE_TYPE = "video" as const;

export type VideoSourceType = "internal" | "external";
export type { VideoProvider } from "@repo/shared";
export type VideoEmbedAttrs = {
  src: string | null;
  sourceType: VideoSourceType;
  provider: VideoProvider;
  hasError: boolean;
  autoplay: VideoAutoplay;
  index: number | null;
};

const isVideoSourceType = (value: string | null | undefined): value is VideoSourceType =>
  value === "internal" || value === "external";

const isVideoProvider = (value: string | null | undefined): value is VideoProvider =>
  typeof value === "string" &&
  (Object.values(VIDEO_EMBED_PROVIDERS) as VideoProvider[]).includes(value as VideoProvider);

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

export const canonicalizeExternalUrl = (src: string, provider?: VideoProvider): string => {
  const url = tryParseUrl(src);
  if (!url) return src;

  const resolvedProvider = provider ?? detectVideoProviderFromUrl(src);

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
  hasError?: boolean | string | null;
  autoplay?: string | null;
  index?: number | string | null;
};

const normalizeVideoIndex = (value: number | string | null | undefined): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  }

  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
};

export const normalizeVideoEmbedAttributes = (attrs: VideoEmbedAttrsInput): VideoEmbedAttrs => {
  const src = typeof attrs.src === "string" ? attrs.src.trim() : "";
  const hasError = attrs.hasError === true || attrs.hasError === "true";

  const sourceType: VideoSourceType = match(attrs.sourceType)
    .when(isVideoSourceType, (value) => value)
    .otherwise(() => "external");

  const detectedProvider =
    sourceType === "internal" ? VIDEO_EMBED_PROVIDERS.SELF : detectVideoProviderFromUrl(src || "");

  const autoplay = (attrs.autoplay ?? VIDEO_AUTOPLAY.NO_AUTOPLAY) as VideoAutoplay;
  const index = normalizeVideoIndex(attrs.index);

  const provider = match(attrs.provider)
    .when(isVideoProvider, (value) => value)
    .otherwise(() => detectedProvider);

  const finalSrc = sourceType === "external" && src ? canonicalizeExternalUrl(src, provider) : src;

  return {
    src: finalSrc || null,
    sourceType,
    provider,
    hasError,
    autoplay,
    index,
  };
};

export const getVideoEmbedAttrsFromElement = (element: HTMLElement): VideoEmbedAttrs | false => {
  const nodeType = element.getAttribute("data-node-type") ?? null;

  if (nodeType !== VIDEO_NODE_TYPE) return false;

  const src = element.getAttribute("data-src");

  if (!src) return false;

  const sourceTypeAttr = element.getAttribute("data-source-type");
  const providerAttr = element.getAttribute("data-provider");
  const errorAttr = element.getAttribute("data-error");
  const autoplayAttr = element.getAttribute("data-autoplay");
  const indexAttr = element.getAttribute("data-index");

  const sourceType: VideoSourceType = match(sourceTypeAttr)
    .when(isVideoSourceType, (value) => value)
    .otherwise(() => "external");

  const provider = match(providerAttr)
    .when(isVideoProvider, (value) => value)
    .otherwise(() => (sourceType === "internal" ? "self" : detectVideoProviderFromUrl(src)));

  return normalizeVideoEmbedAttributes({
    src,
    sourceType,
    provider,
    autoplay: autoplayAttr,
    hasError: errorAttr,
    index: indexAttr,
  });
};
