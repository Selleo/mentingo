import { VIDEO_EMBED_PROVIDERS, type VideoProvider } from "../constants/videoProviders";

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export const tryParseUrl = (input: string): URL | null => {
  try {
    return new URL(input);
  } catch {
    try {
      return new URL(input, "http://localhost");
    } catch {
      return null;
    }
  }
};

export const extractYoutubeId = (url: URL): string | null => {
  if (url.hostname === "youtu.be") {
    return url.pathname.replace("/", "").split("/")[0] || null;
  }

  if (url.pathname === "/watch") {
    return url.searchParams.get("v");
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const embedIndex = pathParts.findIndex((part) => part === "embed" || part === "shorts");

  if (embedIndex !== -1 && pathParts[embedIndex + 1]) {
    return pathParts[embedIndex + 1];
  }

  return null;
};

export const extractVimeoId = (url: URL): string | null => {
  const pathParts = url.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  if (!lastPart) return null;

  return /^\d+$/.test(lastPart) ? lastPart : null;
};

const extractBunnyId = (sourceUrl: string, url: URL | null): string | null => {
  if (sourceUrl.startsWith("bunny-")) return sourceUrl.replace("bunny-", "");
  if (!url) return null;

  const pathParts = url.pathname.split("/").filter(Boolean);

  if (url.hostname === "iframe.mediadelivery.net") {
    const embedIndex = pathParts.findIndex((part) => part === "embed");
    if (embedIndex !== -1 && pathParts[embedIndex + 2]) {
      return pathParts[embedIndex + 2];
    }
  }

  const uuidSegment = pathParts.find((part) => UUID_REGEX.test(part));
  if (uuidSegment) return uuidSegment.match(UUID_REGEX)?.[0] ?? null;

  if (pathParts.length >= 2 && pathParts[pathParts.length - 1].endsWith(".jpg")) {
    return pathParts[pathParts.length - 2] ?? null;
  }

  return pathParts[pathParts.length - 1] ?? null;
};

export const detectVideoProviderFromUrl = (sourceUrl: string): VideoProvider => {
  const url = tryParseUrl(sourceUrl);
  if (!url) return VIDEO_EMBED_PROVIDERS.UNKNOWN;

  if (extractResourceIdFromSourceUrl(sourceUrl)) {
    return VIDEO_EMBED_PROVIDERS.SELF;
  }

  const host = url.hostname.toLowerCase();

  if (host === "youtu.be" || host.endsWith("youtube.com")) return VIDEO_EMBED_PROVIDERS.YOUTUBE;
  if (host.endsWith("vimeo.com")) return VIDEO_EMBED_PROVIDERS.VIMEO;
  if (host.includes("bunny") || host.includes("b-cdn") || host.includes("mediadelivery")) {
    return VIDEO_EMBED_PROVIDERS.BUNNY;
  }

  return VIDEO_EMBED_PROVIDERS.UNKNOWN;
};

export const extractVideoIdFromSourceUrl = (
  sourceUrl: string,
  provider: VideoProvider,
): string | null => {
  const url = tryParseUrl(sourceUrl);

  switch (provider) {
    case VIDEO_EMBED_PROVIDERS.YOUTUBE:
      return url ? extractYoutubeId(url) : null;
    case VIDEO_EMBED_PROVIDERS.VIMEO:
      return url ? extractVimeoId(url) : null;
    case VIDEO_EMBED_PROVIDERS.BUNNY:
      return extractBunnyId(sourceUrl, url);
    default:
      return null;
  }
};

export const extractResourceIdFromSourceUrl = (sourceUrl: string): string | null => {
  if (UUID_REGEX.test(sourceUrl)) return sourceUrl.match(UUID_REGEX)?.[0] ?? null;

  const url = tryParseUrl(sourceUrl);
  if (!url) return null;

  const match = url.pathname.match(/\/(?:lesson|articles|news)-resource\/([0-9a-f-]{36})/i);
  if (match?.[1]) return match[1];

  const pathParts = url.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart && UUID_REGEX.test(lastPart)) return lastPart;

  return null;
};
