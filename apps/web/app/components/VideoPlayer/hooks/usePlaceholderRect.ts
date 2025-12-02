import { useEffect, useState } from "react";

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
