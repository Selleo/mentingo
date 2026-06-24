import { VIDEO_AUTOPLAY, type VideoProvider } from "@repo/shared";
import { load as loadHtml } from "cheerio";

import { annotateVideoAutoplayAndBlockIndexesInContent } from "./annotateVideoAutoplayAndBlockIndexesInContent";

import type { UUIDType } from "src/common";

export type ContentResource = {
  id: UUIDType;
  resourceEntityId?: UUIDType;
  fileUrl: string;
  fileUrlError?: boolean;
  contentType: string | null;
  title?: string;
  description?: string;
  fileName?: string;
  provider?: VideoProvider;
  videoProgress?: {
    coveragePercent: number;
    isWatched: boolean;
    watchedRanges: readonly (readonly [number, number])[];
    durationSeconds?: number;
    bucketSizeSeconds?: number;
  };
};

type InjectResourcesOptions<T extends ContentResource> = {
  resourceIdRegex: RegExp;
  trackNodeTypes?: string[];
  isImageResource?: (resource: T) => boolean;
  buildImageTag?: (resource: T) => string;
  convertImageAnchors?: boolean;
};

export const injectResourcesIntoContent = <T extends ContentResource>(
  content: string | null,
  resources: T[],
  options: InjectResourcesOptions<T>,
): {
  html: string | null;
  contentCount: Record<string, number>;
  hasAutoplayTrigger: boolean;
  videos?: string[];
} => {
  const contentCount: Record<string, number> = {};
  const videos: string[] = [];
  let hasAutoplayTrigger = false;

  const increment = (key: string) => (contentCount[key] = (contentCount[key] ?? 0) + 1);

  if (!content) return { html: content, contentCount, hasAutoplayTrigger };

  const normalizedContent = annotateVideoAutoplayAndBlockIndexesInContent(content) ?? content;
  const $ = loadHtml(normalizedContent);
  const resourceMap = new Map<UUIDType, T>();
  resources.forEach((resource) => {
    resourceMap.set(resource.id, resource);
    if (resource.resourceEntityId) {
      resourceMap.set(resource.resourceEntityId, resource);
    }
  });
  const trackNodeTypes = new Set(options.trackNodeTypes ?? []);
  const convertImageAnchors = options.convertImageAnchors ?? true;

  const isImageResource =
    options.isImageResource ?? ((resource) => (resource.contentType ?? "").startsWith("image/"));

  const buildImageTag =
    options.buildImageTag ??
    ((resource) => `<img src="${resource.fileUrl}" alt="${resource.title ?? ""}" />`);

  $("[data-node-type]").each((_, element) => {
    const nodeType = $(element).attr("data-node-type");

    if (!nodeType) return;

    if (trackNodeTypes.has(nodeType)) {
      increment(nodeType);
    }

    if (nodeType === "video") {
      const autoplayAction = $(element).attr("data-autoplay");
      if (
        autoplayAction === VIDEO_AUTOPLAY.AUTOPLAY ||
        autoplayAction === VIDEO_AUTOPLAY.AUTOPLAY_WITH_PLAY_NEXT
      ) {
        hasAutoplayTrigger = true;
      }

      const src = $(element).attr("data-src");
      const match = src?.match(options.resourceIdRegex);
      const resourceId = match?.[1] ?? null;
      const resource = resourceId ? resourceMap.get(resourceId as UUIDType) : null;

      $(element).attr("data-index", String(videos.length));

      if (src && !resource?.fileUrlError) {
        videos.push(src);
      }

      if (resource?.fileUrlError) {
        $(element).attr("data-error", "true");
      } else {
        $(element).removeAttr("data-error");
      }

      if (resource?.resourceEntityId && resource.contentType?.startsWith("video/")) {
        $(element).attr("data-source-type", "internal");
        if (resource.provider) {
          $(element).attr("data-provider", resource.provider);
        }
        $(element).attr("data-resource-entity-id", resource.resourceEntityId);
        $(element).attr(
          "data-video-coverage-percent",
          String(resource.videoProgress?.coveragePercent ?? 0),
        );
        $(element).attr(
          "data-video-is-watched",
          String(resource.videoProgress?.isWatched ?? false),
        );
        $(element).attr(
          "data-video-watched-ranges",
          JSON.stringify(resource.videoProgress?.watchedRanges ?? []),
        );

        if (resource.videoProgress?.durationSeconds) {
          $(element).attr(
            "data-video-duration-seconds",
            String(resource.videoProgress.durationSeconds),
          );
        }

        if (resource.videoProgress?.bucketSizeSeconds) {
          $(element).attr(
            "data-video-bucket-size-seconds",
            String(resource.videoProgress.bucketSizeSeconds),
          );
        }
      }
    }
  });

  if (convertImageAnchors) {
    $("a").each((_, element) => {
      const anchor = $(element);
      const href = anchor.attr("href") || "";
      const dataResourceId = anchor.attr("data-resource-id");

      const matchingResource =
        (dataResourceId && resourceMap.get(dataResourceId as UUIDType)) ||
        resources.find((resource) => href.includes(String(resource.id)));

      if (!matchingResource) return;

      if (isImageResource(matchingResource)) {
        const parent = anchor.parent();
        const imgTag = buildImageTag(matchingResource);
        increment("image");

        if (parent.is("p")) {
          anchor.remove();
          parent.after(imgTag);
        } else {
          anchor.replaceWith(imgTag);
        }
      }
    });
  }

  const bodyChildren = $("body").children();
  return {
    html: $.html(bodyChildren.length ? bodyChildren : $.root().children()),
    contentCount,
    hasAutoplayTrigger,
    videos,
  };
};
