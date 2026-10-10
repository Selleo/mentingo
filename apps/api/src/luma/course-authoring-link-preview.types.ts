/** Contracts shared by the link-preview fetcher, its HTML extraction, and its tests. */
export type LinkPreviewHttpResponse = {
  statusCode: number;
  location: string | null;
  contentType: string | null;
  body: string | null;
};

/** Performs one request against an already validated URL without following redirects. */
export type LinkPreviewHttpFetcher = (url: URL) => Promise<LinkPreviewHttpResponse>;

export type ExtractedLinkMetadata = {
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
};

export const LINK_PREVIEW_FETCHER = Symbol("LINK_PREVIEW_FETCHER");
