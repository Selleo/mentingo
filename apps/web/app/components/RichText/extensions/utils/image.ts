import { extractResourceIdFromUrl } from "./resourceNode";

export const IMAGE_NODE_TYPE = "image" as const;

export type ImageEmbedAttrs = {
  src: string | null;
  alt: string | null;
  resourceId: string | null;
  assetId?: string | null;
};

type ImageEmbedAttrsInput = {
  src?: string | null;
  alt?: string | null;
  resourceId?: string | null;
  assetId?: string | null;
};

export const normalizeImageEmbedAttributes = (attrs: ImageEmbedAttrsInput): ImageEmbedAttrs => {
  const src = typeof attrs.src === "string" ? attrs.src.trim() : "";
  const alt = typeof attrs.alt === "string" ? attrs.alt : null;
  const resourceId =
    typeof attrs.resourceId === "string" && attrs.resourceId.trim()
      ? attrs.resourceId.trim()
      : extractResourceIdFromUrl(src);

  return {
    src: src || null,
    alt,
    resourceId,
    ...(attrs.assetId ? { assetId: attrs.assetId } : {}),
  };
};

export const getImageEmbedAttrsFromElement = (element: HTMLElement): ImageEmbedAttrs | false => {
  const nodeType = element.getAttribute("data-node-type") ?? null;

  if (nodeType !== IMAGE_NODE_TYPE) return false;

  const src = element.getAttribute("data-src");

  const assetId = element.getAttribute("data-authoring-asset-id");
  if (!src && !assetId) return false;

  return normalizeImageEmbedAttributes({
    src,
    assetId,
    alt: element.getAttribute("data-alt") ?? null,
    resourceId: element.getAttribute("data-resource-id") ?? null,
  });
};
