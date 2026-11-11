/** Builds a bounded image figure from structured data rather than model-authored lesson HTML. */
import { load } from "cheerio";

import type { AuthoringOperation } from "./schema/course-authoring-operations.schema";

/** Escapes labels through the HTML parser and assigns the asset a stable top-level identity. */
export const authoringImageFigure = (
  payload: Extract<AuthoringOperation, { type: "lesson.image.insert" }>["payload"],
): string => {
  const $ = load("<figure><img></figure>", {}, false);
  $("figure").attr("data-authoring-block-id", payload.assetId);
  $("img")
    .attr("data-authoring-asset-id", payload.assetId)
    .attr("src", `authoring-asset:${payload.assetId}`)
    .attr("alt", payload.altText);
  if (payload.caption !== null)
    $("figure").append($("<figcaption></figcaption>").text(payload.caption));
  return $.html();
};

/** Reads explicit asset references without confusing labels or prose mentioning an image UUID. */
export const referencedAuthoringAssets = (operation: AuthoringOperation): ReadonlySet<string> => {
  const ids = new Set<string>();
  const visit = (value: unknown, key?: string): void => {
    if (typeof value === "string") {
      if (key === "assetId" || key?.endsWith("AssetId")) ids.add(value.toLowerCase());
      if (value.startsWith("authoring-asset:"))
        ids.add(value.slice("authoring-asset:".length).toLowerCase());
      if (value.includes("data-authoring-asset-id")) {
        const $ = load(value, {}, false);
        $("[data-authoring-asset-id]").each((_, element) => {
          const id = $(element).attr("data-authoring-asset-id");
          if (id) ids.add(id.toLowerCase());
        });
      }
    } else if (Array.isArray(value)) value.forEach((item) => visit(item));
    else if (value && typeof value === "object")
      Object.entries(value).forEach(([name, item]) => visit(item, name));
  };
  if ("payload" in operation) visit(operation.payload);
  return ids;
};
