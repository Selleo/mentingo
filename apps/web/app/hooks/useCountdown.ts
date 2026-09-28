import { useCallback, useEffect, useState } from "react";

/**
 * Seconds-based countdown (e.g. "resend code in 42 s").
 * `start(seconds)` (re)starts it; `remaining` reaches 0 when it is done.
 */
export function useCountdown() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (endsAt === null) return;

    const tick = () => {
      const secondsLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));

      setRemaining(secondsLeft);

      if (secondsLeft === 0) setEndsAt(null);
    };

    tick();

    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [endsAt]);

  const start = useCallback((seconds: number) => {
    setRemaining(Math.max(0, Math.ceil(seconds)));
    setEndsAt(Date.now() + seconds * 1000);
  }, []);

  const reset = useCallback(() => {
    setEndsAt(null);
    setRemaining(0);
  }, []);

  return { remaining, isRunning: remaining > 0, start, reset };
}
