import { useEffect, useState } from "react";

export function useQuizAvailability(availableFrom?: string | null, availableUntil?: string | null) {
  const [now, setNow] = useState(Date.now);
  const opensAt = availableFrom ? Date.parse(availableFrom) : null;
  const closesAt = availableUntil ? Date.parse(availableUntil) : null;
  const isBeforeOpening = opensAt !== null && opensAt > now;

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return {
    now,
    isBeforeOpening,
    isUnavailable: isBeforeOpening || (closesAt !== null && closesAt <= now),
    openingSecondsLeft: Math.max(0, Math.ceil(((opensAt ?? now) - now) / 1000)),
  };
}
