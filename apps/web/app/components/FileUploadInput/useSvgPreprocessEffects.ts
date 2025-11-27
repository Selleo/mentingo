import { useEffect } from "react";

import type { MutableRefObject } from "react";

export function useSvgPreprocessEffects(
  imageUrl: string | null | undefined,
  isSvgUrl: (url?: string | null) => boolean,
  preprocessSvgUrl: (url: string) => Promise<string | null>,
  previousObjectUrlRef: MutableRefObject<string | null>,
  setProcessedImageUrl: (url: string | null) => void,
) {
  useEffect(() => {
    let cancelled = false;

    async function preprocessSvgIfNeeded(url?: string | null) {
      if (!url) {
        setProcessedImageUrl(null);
        return;
      }

      if (!isSvgUrl(url)) {
        setProcessedImageUrl(url);
        return;
      }

      try {
        const objectUrl = await preprocessSvgUrl(url);

        if (cancelled) return;
        // Revoke previous object URL if exists
        if (previousObjectUrlRef.current) {
          URL.revokeObjectURL(previousObjectUrlRef.current);
        }
        if (objectUrl && objectUrl.startsWith("blob:")) {
          previousObjectUrlRef.current = objectUrl;
          setProcessedImageUrl(objectUrl);
          return;
        }

        setProcessedImageUrl(url);
      } catch {
        setProcessedImageUrl(url);
      }
    }

    preprocessSvgIfNeeded(imageUrl);

    return () => {
      cancelled = true;
    };
  }, [imageUrl, isSvgUrl, preprocessSvgUrl, previousObjectUrlRef, setProcessedImageUrl]);

  useEffect(() => {
    return () => {
      if (!previousObjectUrlRef.current) return;

      URL.revokeObjectURL(previousObjectUrlRef.current);
      previousObjectUrlRef.current = null;
    };
  }, [previousObjectUrlRef]);
}
