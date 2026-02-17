import { useEffect, useState } from "react";

type Options = {
  enabled: boolean;
  seconds: number;
  onComplete?: () => void;
};

export const useCountdown = ({ enabled, seconds, onComplete }: Options) => {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setValue(null);
      return;
    }

    setValue(seconds);

    const interval = window.setInterval(() => {
      setValue((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          window.clearInterval(interval);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, seconds, onComplete]);

  return value;
};
