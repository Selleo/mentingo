import { match } from "ts-pattern";

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

  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  return match({ host, path })
    .when(
      ({ host: currentHost, path: currentPath }) =>
        currentHost === "docs.google.com" && currentPath.includes("/presentation/"),
      () => "google" as const,
    )
    .when(
      ({ host: currentHost, path: currentPath }) =>
        currentHost.endsWith("canva.com") && currentPath.includes("/design/"),
      () => "canva" as const,
    )
    .otherwise(() => "unknown");
};

export const canonicalizeExternalPresentationUrl = (
  src: string,
  provider?: PresentationProvider,
): string => {
  const url = tryParseUrl(src);

  if (!url) return src;

  const resolvedProvider = provider ?? detectPresentationProvider(src);

  return match(resolvedProvider)
    .with("google", () => {
      const id = extractGooglePresentationId(url);
      return id ? `https://docs.google.com/presentation/d/${id}` : url.toString();
    })
    .with("canva", () => {
      const cleanedUrl = new URL(url.toString());

      cleanedUrl.search = "";

      if (!cleanedUrl.pathname.includes("/view")) {
        const basePath = cleanedUrl.pathname.replace(/\/(edit|view).*$/, "");
        cleanedUrl.pathname = basePath.replace(/\/$/, "") + "/view";
      }

      cleanedUrl.searchParams.set("embed", "");

      return cleanedUrl.toString();
    })
    .otherwise(() => url.toString());
};

type PresentationEmbedAttrsInput = {
  src?: string | null;
  sourceType?: string | null;
  provider?: string | null;
};

export const normalizePresentationEmbedAttributes = (
  attrs: PresentationEmbedAttrsInput,
): PresentationEmbedAttrs => {
  const src = typeof attrs.src === "string" ? attrs.src.trim() : "";

  const sourceType: PresentationSourceType = match(attrs.sourceType)
    .when(isPresentationSourceType, (value) => value)
    .otherwise(() => "external");

  const detectedProvider = sourceType === "internal" ? "self" : detectPresentationProvider(src);

  const provider = match(attrs.provider)
    .when(isPresentationProvider, (value) => value)
    .otherwise(() => detectedProvider);

  const finalSrc =
    sourceType === "external" && src ? canonicalizeExternalPresentationUrl(src, provider) : src;

  return {
    src: finalSrc || null,
    sourceType,
    provider,
  };
};

export const getPresentationEmbedAttrsFromElement = (
  element: HTMLElement,
): PresentationEmbedAttrs | false => {
  const nodeType = element.getAttribute("data-node-type") ?? null;

  if (nodeType !== PRESENTATION_NODE_TYPE) return false;

  const src = element.getAttribute("data-src");

  if (!src) return false;

  const sourceTypeAttr = element.getAttribute("data-source-type");
  const providerAttr = element.getAttribute("data-provider");

  const sourceType: PresentationSourceType = match(sourceTypeAttr)
    .when(isPresentationSourceType, (value) => value)
    .otherwise(() => "external");

  const provider = match(providerAttr)
    .when(isPresentationProvider, (value) => value)
    .otherwise(() => (sourceType === "internal" ? "self" : detectPresentationProvider(src)));

  return normalizePresentationEmbedAttributes({
    src,
    sourceType,
    provider,
  });
};
