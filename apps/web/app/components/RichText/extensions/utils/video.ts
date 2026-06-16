import {
  VIDEO_EMBED_PROVIDERS,
  detectVideoProviderFromUrl,
  extractVimeoId,
  extractYoutubeId,
  parseVideoCoverageRanges,
  tryParseUrl,
  type VideoProvider,
  type VideoCoverageRange,
} from "@repo/shared";
import { match } from "ts-pattern";

import { parseFiniteNumberOrNull } from "~/lib/number";

import { VIDEO_UPLOAD_NODE_STATUS } from "./videoUploadNode";

import type { VideoUploadNodeStatus } from "./videoUploadNode";

export const VIDEO_NODE_TYPE = "video" as const;

export type VideoSourceType = "internal" | "external";
export type { VideoProvider } from "@repo/shared";
export type VideoEmbedAttrs = {
  src: string | null;
  sourceType: VideoSourceType;
  provider: VideoProvider;
  hasError: boolean;
  index: number | null;
  uploadId: string | null;
  uploadLabel: string | null;
  uploadStatus: VideoUploadNodeStatus | null;
  uploadErrorMessage: string | null;
  resourceEntityId: string | null;
  videoCoveragePercent: number | null;
  videoIsWatched: boolean;
  videoWatchedRanges: VideoCoverageRange[];
  videoDurationSeconds: number | null;
  videoBucketSizeSeconds: number | null;
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
  index?: number | string | null;
  uploadId?: string | null;
  uploadLabel?: string | null;
  uploadStatus?: VideoUploadNodeStatus | null;
  uploadErrorMessage?: string | null;
  resourceEntityId?: string | null;
  videoCoveragePercent?: number | string | null;
  videoIsWatched?: boolean | string | null;
  videoWatchedRanges?: VideoCoverageRange[] | string | null;
  videoDurationSeconds?: number | string | null;
  videoBucketSizeSeconds?: number | string | null;
};

export const normalizeVideoEmbedAttributes = (attrs: VideoEmbedAttrsInput): VideoEmbedAttrs => {
  const src = typeof attrs.src === "string" ? attrs.src.trim() : "";
  const hasError = attrs.hasError === true || attrs.hasError === "true";

  const sourceType: VideoSourceType = match(attrs.sourceType)
    .when(isVideoSourceType, (value) => value)
    .otherwise(() => "external");

  const detectedProvider =
    sourceType === "internal" ? VIDEO_EMBED_PROVIDERS.SELF : detectVideoProviderFromUrl(src || "");

  const provider = match(attrs.provider)
    .when(isVideoProvider, (value) => value)
    .otherwise(() => detectedProvider);

  const finalSrc = sourceType === "external" && src ? canonicalizeExternalUrl(src, provider) : src;

  return {
    src: finalSrc || null,
    sourceType,
    provider,
    hasError,
    index: attrs.index === null || attrs.index === undefined ? null : Number(attrs.index),
    uploadId: typeof attrs.uploadId === "string" ? attrs.uploadId : null,
    uploadLabel: typeof attrs.uploadLabel === "string" ? attrs.uploadLabel : null,
    uploadStatus:
      attrs.uploadStatus === VIDEO_UPLOAD_NODE_STATUS.UPLOADING ||
      attrs.uploadStatus === VIDEO_UPLOAD_NODE_STATUS.FAILED
        ? attrs.uploadStatus
        : null,
    uploadErrorMessage:
      typeof attrs.uploadErrorMessage === "string" ? attrs.uploadErrorMessage : null,
    resourceEntityId: typeof attrs.resourceEntityId === "string" ? attrs.resourceEntityId : null,
    videoCoveragePercent: parseFiniteNumberOrNull(attrs.videoCoveragePercent),
    videoIsWatched: attrs.videoIsWatched === true || attrs.videoIsWatched === "true",
    videoWatchedRanges: parseVideoCoverageRanges(attrs.videoWatchedRanges),
    videoDurationSeconds: parseFiniteNumberOrNull(attrs.videoDurationSeconds),
    videoBucketSizeSeconds: parseFiniteNumberOrNull(attrs.videoBucketSizeSeconds),
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
  const indexAttr = element.getAttribute("data-index");
  const uploadId = element.getAttribute("data-upload-id") ?? null;
  const uploadLabel = element.getAttribute("data-upload-label") ?? null;
  const uploadStatus =
    (element.getAttribute("data-upload-status") as VideoUploadNodeStatus | null) ?? null;
  const uploadErrorMessage = element.getAttribute("data-upload-error-message") ?? null;
  const resourceEntityId = element.getAttribute("data-resource-entity-id") ?? null;
  const videoCoveragePercent = element.getAttribute("data-video-coverage-percent") ?? null;
  const videoIsWatched = element.getAttribute("data-video-is-watched") ?? null;
  const videoWatchedRanges = element.getAttribute("data-video-watched-ranges") ?? null;
  const videoDurationSeconds = element.getAttribute("data-video-duration-seconds") ?? null;
  const videoBucketSizeSeconds = element.getAttribute("data-video-bucket-size-seconds") ?? null;

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
    hasError: errorAttr,
    index: indexAttr,
    uploadId,
    uploadLabel,
    uploadStatus,
    uploadErrorMessage,
    resourceEntityId,
    videoCoveragePercent,
    videoIsWatched,
    videoWatchedRanges,
    videoDurationSeconds,
    videoBucketSizeSeconds,
  });
};
