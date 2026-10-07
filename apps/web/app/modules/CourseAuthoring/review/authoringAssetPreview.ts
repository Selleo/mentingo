/** Authoring image markers stay canonical while native rich-text review gets a temporary source. */

const ASSET_MARKER_PATTERN = /data-authoring-asset-id\s*=\s*(["'])([0-9a-f-]{36})\1/gi;
const IMAGE_TAG_PATTERN = /<img\b([^>]*)>/gi;
const ATTRIBUTE_PATTERN = /(?:^|\s)([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

/** Return the unique asset UUIDs referenced by canonical HTML placeholders. */
export const getAuthoringAssetIds = (html: string): string[] => {
  const ids = new Set<string>();
  for (const match of html.matchAll(ASSET_MARKER_PATTERN)) {
    const assetId = match[2];
    if (assetId) ids.add(assetId);
  }
  return [...ids];
};

/** Read display labels from canonical markers or already-resolved native image nodes. */
export const getAuthoringAssetLabels = (html: string): Readonly<Record<string, string>> => {
  const ids = new Set(getAuthoringAssetIds(html));
  const labels: Record<string, string> = {};
  for (const match of html.matchAll(/<(?:img|div)\b([^>]*)>/gi)) {
    const attributes = readAttributes(match[1] ?? "");
    const id = attributes.get("data-authoring-asset-id");
    if (!id || !ids.has(id)) continue;
    labels[id] = decodeAttribute(attributes.get("alt") ?? attributes.get("data-alt") ?? "");
  }
  return labels;
};

/** Resolve ready placeholders into the native image node understood by the course editor. */
export const withAuthoringAssetPreviewUrls = (
  html: string,
  previewUrls: Readonly<Record<string, string>>,
): string =>
  html.replace(IMAGE_TAG_PATTERN, (tag, rawAttributes: string) => {
    const attributes = readAttributes(rawAttributes);
    const assetId = attributes.get("data-authoring-asset-id");
    const previewUrl = (assetId ? previewUrls[assetId] : undefined) ?? attributes.get("src");
    if (!assetId && !previewUrl) return tag;

    const alt = attributes.get("alt") ?? attributes.get("data-alt");
    const blockId = attributes.get("data-authoring-block-id");
    const wrapperAttributes = [
      `data-node-type="image"`,
      `data-src="${escapeAttribute(decodeAttribute(previewUrl ?? ""))}"`,
      ...(alt === undefined ? [] : [`data-alt="${escapeAttribute(decodeAttribute(alt))}"`]),
      ...(assetId ? [`data-authoring-asset-id="${escapeAttribute(assetId)}"`] : []),
      ...(blockId === undefined
        ? []
        : [`data-authoring-block-id="${escapeAttribute(decodeAttribute(blockId))}"`]),
    ];
    return `<div ${wrapperAttributes.join(" ")}></div>`;
  });

/** Read quoted or unquoted HTML attributes while preserving their encoded values for re-emission. */
const readAttributes = (rawAttributes: string): Map<string, string> => {
  const attributes = new Map<string, string>();
  for (const match of rawAttributes.matchAll(ATTRIBUTE_PATTERN)) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    const value = doubleQuoted ?? singleQuoted ?? unquoted;
    if (name && value !== undefined) attributes.set(name.toLowerCase(), value);
  }
  return attributes;
};

/** Escape a generated object URL or UUID before placing it in an HTML attribute. */
const escapeAttribute = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/** Decode existing attribute entities before safely moving their values to a new attribute. */
const decodeAttribute = (value: string): string =>
  value.replace(/&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    const named: Record<string, string> = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      quot: '"',
    };
    if (!code.startsWith("#")) return named[code.toLowerCase()] ?? entity;
    const numeric =
      code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
    return Number.isInteger(numeric) && numeric >= 0 && numeric <= 0x10ffff
      ? String.fromCodePoint(numeric)
      : entity;
  });
