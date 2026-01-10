export const PRESENTATION_NODE_TYPE = "presentation" as const;

export type PresentationSourceType = "internal" | "external";
export type PresentationProvider = "self" | "google" | "canva" | "unknown";

export type PresentationEmbedAttrs = {
  src: string | null;
  sourceType: PresentationSourceType;
  provider: PresentationProvider;
};

const isPresentationSourceType = (
  value: string | null | undefined,
): value is PresentationSourceType => value === "internal" || value === "external";

const isPresentationProvider = (value: string | null | undefined): value is PresentationProvider =>
  value === "self" || value === "google" || value === "canva" || value === "unknown";

const tryParseUrl = (input: string): URL | null => {
  try {
    return new URL(input);
  } catch {
    return null;
  }
};

const extractGooglePresentationId = (url: URL): string | null => {
  if (!url.hostname.includes("google")) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const presentationIndex = parts.findIndex((part) => part === "presentation");
  if (presentationIndex === -1) return null;

  const idIndex = parts.findIndex((part) => part === "d");
  if (idIndex !== -1 && parts[idIndex + 1]) return parts[idIndex + 1];

  const dIndex = parts.findIndex((part) => part.startsWith("d/"));
  if (dIndex !== -1) return parts[dIndex].split("/")[1] ?? null;

  return null;
};

export const detectPresentationProvider = (src: string): PresentationProvider => {
  const url = tryParseUrl(src);
  if (!url) return "unknown";

  if (url.hostname === "docs.google.com" && url.pathname.includes("/presentation/")) {
    return "google";
  }

  if (url.hostname.endsWith("canva.com") && url.pathname.includes("/design/")) {
    return "canva";
  }

  return "unknown";
};

export const canonicalizeExternalPresentationUrl = (
  src: string,
  provider?: PresentationProvider,
): string => {
  const url = tryParseUrl(src);
  if (!url) return src;

  const resolvedProvider = provider ?? detectPresentationProvider(src);

  if (resolvedProvider === "google") {
    const id = extractGooglePresentationId(url);
    if (id) return `https://docs.google.com/presentation/d/${id}`;
  }

  if (resolvedProvider === "canva") {
    const cleaned = new URL(url.toString());
    cleaned.search = "";
    if (!cleaned.pathname.includes("/view")) {
      const basePath = cleaned.pathname.replace(/\/(edit|view).*$/, "");
      cleaned.pathname = basePath.replace(/\/$/, "") + "/view";
    }
    cleaned.searchParams.set("embed", "");
    return cleaned.toString();
  }

  return url.toString();
};

type PresentationEmbedAttrsInput = {
  src?: string | null;
  sourceType?: string | null;
  provider?: string | null;
};

export const normalizePresentationEmbedAttributes = (
  attrs: PresentationEmbedAttrsInput,
): PresentationEmbedAttrs => {
  const rawSrc = typeof attrs.src === "string" ? attrs.src.trim() : "";
  const sourceType = isPresentationSourceType(attrs.sourceType) ? attrs.sourceType : "external";
  const detectedProvider = sourceType === "internal" ? "self" : detectPresentationProvider(rawSrc);
  const provider = isPresentationProvider(attrs.provider) ? attrs.provider : detectedProvider;
  const finalSrc =
    sourceType === "external" && rawSrc
      ? canonicalizeExternalPresentationUrl(rawSrc, provider)
      : rawSrc;

  return {
    src: finalSrc || null,
    sourceType,
    provider,
  };
};

export const getPresentationEmbedAttrsFromElement = (
  element: HTMLElement,
): PresentationEmbedAttrs | false => {
  const nodeType =
    element.getAttribute("data-node-type") ?? element.getAttribute("data-type") ?? null;

  if (nodeType && nodeType !== PRESENTATION_NODE_TYPE) return false;

  const src =
    element.getAttribute("data-src") ??
    element.getAttribute("data-url") ??
    element.getAttribute("href") ??
    element.getAttribute("src");

  if (!src) return false;

  const sourceTypeAttr = element.getAttribute("data-source-type");
  const providerAttr = element.getAttribute("data-provider");
  const legacyExternal = element.getAttribute("data-external");

  const sourceType = isPresentationSourceType(sourceTypeAttr)
    ? sourceTypeAttr
    : legacyExternal === "true"
      ? "external"
      : "internal";

  const provider = isPresentationProvider(providerAttr)
    ? providerAttr
    : sourceType === "internal"
      ? "self"
      : detectPresentationProvider(src);

  return normalizePresentationEmbedAttributes({
    src,
    sourceType,
    provider,
  });
};
