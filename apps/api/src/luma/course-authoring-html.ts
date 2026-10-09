import { BadRequestException } from "@nestjs/common";
import { load } from "cheerio";

const URL_ATTRIBUTES = new Set([
  "href",
  "src",
  "data-src",
  "poster",
  "data-poster",
  "action",
  "formaction",
  "xlink:href",
  "background",
  "cite",
  "longdesc",
]);
const ASSET_REFERENCE =
  /^authoring-asset:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Validate model-provided HTML before creating native resources or persisting lesson content. */
export const validateAuthoringHtml = (content: string) => {
  const $ = load(content);
  for (const element of $("*").toArray()) {
    const node = $(element);
    const tag = element.type === "tag" ? element.name.toLowerCase() : element.type;
    if (
      [
        "script",
        "style",
        "object",
        "embed",
        "base",
        "meta",
        "link",
        "svg",
        "math",
        "noscript",
        "textarea",
        "title",
        "xmp",
        "plaintext",
      ].includes(tag)
    )
      throw new BadRequestException("courseAuthoring.errors.invalidOperations");
    if (tag === "iframe" && node.text().trim())
      throw new BadRequestException("courseAuthoring.errors.invalidOperations");
    for (const [name, value] of Object.entries(node.attr() ?? {})) {
      if (name.startsWith("on") || name === "srcdoc")
        throw new BadRequestException("courseAuthoring.errors.invalidOperations");
      if (!URL_ATTRIBUTES.has(name)) continue;
      if (
        (tag === "img" || node.attr("data-node-type") === "image") &&
        (name === "src" || name === "data-src") &&
        ASSET_REFERENCE.test(value)
      )
        continue;
      let url: URL;
      try {
        url = new URL(value, "https://authoring.invalid/");
      } catch {
        throw new BadRequestException("courseAuthoring.errors.invalidOperations");
      }
      if (!["http:", "https:"].includes(url.protocol))
        throw new BadRequestException("courseAuthoring.errors.invalidOperations");
    }
  }
};

const FETCH_ATTRIBUTES = new Set([
  "src",
  "data-src",
  "poster",
  "data-poster",
  "background",
  "srcset",
  "data-srcset",
]);
const canonicalMediaUrl = (value: string) => new URL(value, "https://authoring.invalid/").href;

export const collectAuthoringMediaUrls = (contents: readonly string[]): ReadonlySet<string> => {
  const urls = new Set<string>();
  for (const content of contents) {
    const $ = load(content);
    for (const element of $("*").toArray())
      for (const [name, value] of Object.entries($(element).attr() ?? {})) {
        if (!FETCH_ATTRIBUTES.has(name) || name.endsWith("srcset")) continue;
        try {
          urls.add(canonicalMediaUrl(value));
        } catch {
          continue;
        }
      }
  }
  return urls;
};

export const validateAuthoringMedia = (
  content: string,
  allowedUrls: ReadonlySet<string>,
  authorizedResourceIds: ReadonlySet<string>,
  stagedAssetIds: ReadonlySet<string>,
) => {
  const $ = load(content);
  for (const element of $("*").toArray()) {
    const node = $(element);
    for (const [name, value] of Object.entries(node.attr() ?? {})) {
      if (!FETCH_ATTRIBUTES.has(name)) continue;
      const image =
        element.type === "tag" &&
        (element.name === "img" || node.attr("data-node-type") === "image");
      const assetId = node.attr("data-authoring-asset-id");
      if (
        image &&
        (name === "src" || name === "data-src") &&
        assetId &&
        stagedAssetIds.has(assetId) &&
        value === `authoring-asset:${assetId}`
      )
        continue;
      const resourceId = node.attr("data-resource-id");
      if (
        resourceId &&
        authorizedResourceIds.has(resourceId) &&
        value === `/api/lesson/lesson-resource/${resourceId}`
      )
        continue;
      if (!name.endsWith("srcset") && allowedUrls.has(canonicalMediaUrl(value))) continue;
      throw new BadRequestException("courseAuthoring.errors.mediaOutsideCourse");
    }
  }
};

export const stripAuthoringHtmlStyles = (content: string): string => {
  const $ = load(content);
  if (!$("[style]").length) return content;
  $("[style]").removeAttr("style");
  return $("body").html() ?? "";
};
