import { useEffect, useState } from "react";

/**
 * Tracks placeholder element's position for VideoPlayerSingleton.
 * Intentionally preserves last rect when placeholder is null - this maintains
 * player position during video-to-video navigation, preserving fullscreen state.
 */
export function usePlaceholderRect(placeholderElement: HTMLElement | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!placeholderElement) {
      return;
    }

    const updateRect = () => setRect(placeholderElement.getBoundingClientRect());
    updateRect();

    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);

    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [placeholderElement]);

  return rect;
}
