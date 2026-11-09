const IFRAME_EMBED_ROUTES: ReadonlyMap<string, RegExp> = new Map([
  ["www.youtube.com", /^\/embed\/[\w-]+\/?$/],
  ["youtube.com", /^\/embed\/[\w-]+\/?$/],
  ["www.youtube-nocookie.com", /^\/embed\/[\w-]+\/?$/],
  ["youtube-nocookie.com", /^\/embed\/[\w-]+\/?$/],
  ["player.vimeo.com", /^\/video\/\d+\/?$/],
  ["iframe.mediadelivery.net", /^\/embed\/\d+\/[\w-]+\/?$/],
  ["docs.google.com", /^\/presentation\/d\/(?:e\/)?[\w-]+\/(?:embed|pubembed|preview)\/?$/],
  ["www.canva.com", /^\/design\/[\w-]+(?:\/[\w-]+)?\/view\/?$/],
  ["canva.com", /^\/design\/[\w-]+(?:\/[\w-]+)?\/view\/?$/],
]);

const parseAbsoluteUrl = (value: unknown): URL | null => {
  if (typeof value !== "string") return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const hasPlainHttpsOrigin = (url: URL) =>
  url.protocol === "https:" && !url.username && !url.password && !url.port;

export const isHttpsUrl = (value: unknown): value is string =>
  parseAbsoluteUrl(value)?.protocol === "https:";

/** Allows iframes only for HTTPS embed routes of supported video and presentation providers. */
export const isAllowedIframeUrl = (source: unknown): source is string => {
  const url = parseAbsoluteUrl(source);

  return Boolean(
    url && hasPlainHttpsOrigin(url) && IFRAME_EMBED_ROUTES.get(url.hostname)?.test(url.pathname),
  );
};
