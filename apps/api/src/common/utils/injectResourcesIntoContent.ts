import { VIDEO_AUTOPLAY } from "@repo/shared";
import { load as loadHtml } from "cheerio";

import { annotateVideoAutoplayInContent } from "./annotateVideoAutoplayInContent";

import type { UUIDType } from "src/common";

export type ContentResource = {
  id: UUIDType;
  fileUrl: string;
  fileUrlError?: boolean;
  contentType: string | null;
  title?: string;
  description?: string;
  fileName?: string;
};

type InjectResourcesOptions<T extends ContentResource> = {
  resourceIdRegex: RegExp;
  trackNodeTypes?: string[];
  isImageResource?: (resource: T) => boolean;
  buildImageTag?: (resource: T) => string;
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

  const normalizedContent = annotateVideoAutoplayInContent(content) ?? content;
  const $ = loadHtml(normalizedContent);
  const resourceMap = new Map(resources.map((resource) => [resource.id, resource]));
  const trackNodeTypes = new Set(options.trackNodeTypes ?? []);

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
    }
  });

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

  const bodyChildren = $("body").children();
  return {
    html: $.html(bodyChildren.length ? bodyChildren : $.root().children()),
    contentCount,
    hasAutoplayTrigger,
    videos,
  };
};
