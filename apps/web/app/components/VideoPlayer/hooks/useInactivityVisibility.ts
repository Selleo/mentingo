import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  enabled: boolean;
  target?: HTMLElement | null;
  timeoutMs?: number;
  initialVisible?: boolean;
  autoShow?: boolean;
  onActivity?: () => void;
};

export const useInactivityVisibility = ({
  enabled,
  target,
  timeoutMs = 2500,
  initialVisible = true,
  autoShow = true,
  onActivity,
}: Options) => {
  const [visible, setVisible] = useState(initialVisible);
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current === null) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimer();
    timeoutRef.current = window.setTimeout(() => {
      setVisible(false);
    }, timeoutMs);
  }, [clearTimer, timeoutMs]);

  const show = useCallback(() => {
    if (autoShow) {
      setVisible(true);
    }
    onActivity?.();
    scheduleHide();
  }, [autoShow, onActivity, scheduleHide]);

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      clearTimer();
      return;
    }

    show();

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "pointermove",
      "mousedown",
      "pointerdown",
      "keydown",
      "touchstart",
      "touchmove",
      "scroll",
    ];

    const handleActivity = () => show();

    const targets: Array<Window | Document | HTMLElement> = [window, document];
    if (target) targets.push(target);

    targets.forEach((el) => {
      events.forEach((event) => el.addEventListener(event, handleActivity, { passive: true }));
    });

    return () => {
      clearTimer();
      targets.forEach((el) => {
        events.forEach((event) => el.removeEventListener(event, handleActivity));
      });
    };
  }, [enabled, target, clearTimer, show]);

  return { visible, show };
};
