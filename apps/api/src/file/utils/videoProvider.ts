import {
  VIDEO_EMBED_PROVIDERS,
  detectVideoProviderFromUrl,
  type VideoProvider,
} from "@repo/shared";

export const getVideoProviderFromReference = (reference: string): VideoProvider => {
  const detectedProvider = detectVideoProviderFromUrl(reference);

  return detectedProvider === VIDEO_EMBED_PROVIDERS.UNKNOWN
    ? VIDEO_EMBED_PROVIDERS.SELF
    : detectedProvider;
};
