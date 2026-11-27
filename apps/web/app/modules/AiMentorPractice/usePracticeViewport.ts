import { useEffect, useRef } from "react";

export function usePracticeViewport() {
  const practiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const practice = practiceRef.current;
    const viewport = window.visualViewport;
    if (!practice || !viewport) return;

    const updateHeight = () => {
      // The keyboard can shrink the visual viewport without resizing 100dvh.
      const visibleBottom = viewport.offsetTop + viewport.height;
      const availableHeight = visibleBottom - practice.getBoundingClientRect().top;
      practice.style.setProperty("--practice-viewport-height", `${Math.max(0, availableHeight)}px`);
    };

    updateHeight();
    viewport.addEventListener("resize", updateHeight);
    viewport.addEventListener("scroll", updateHeight);
    return () => {
      viewport.removeEventListener("resize", updateHeight);
      viewport.removeEventListener("scroll", updateHeight);
    };
  }, []);

  return practiceRef;
}
