import { useEffect, useState } from "react";

/**
 * Tracks placeholder element's position for VideoPlayerSingleton.
 */
export function usePlaceholderRect(
  placeholderElement: HTMLElement | null,
  syncKey?: string | null,
): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!placeholderElement) {
      setRect(null);
      return;
    }

    let isActive = true;
    const updateRect = () => {
      if (!isActive) return;
      if (!document.contains(placeholderElement)) {
        setRect(null);
        return;
      }
      setRect(placeholderElement.getBoundingClientRect());
    };

    updateRect();

    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(placeholderElement);

    let settleFrames = 12;
    let settleRaf = 0;
    const settle = () => {
      if (!isActive) return;
      updateRect();
      settleFrames -= 1;
      if (settleFrames > 0) {
        settleRaf = window.requestAnimationFrame(settle);
      }
    };
    settleRaf = window.requestAnimationFrame(settle);

    window.addEventListener("scroll", updateRect, { capture: true, passive: true });
    window.addEventListener("resize", updateRect);

    return () => {
      isActive = false;
      window.cancelAnimationFrame(settleRaf);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [placeholderElement, syncKey]);

  return rect;
}
