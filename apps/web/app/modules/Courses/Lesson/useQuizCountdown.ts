import { useEffect, useMemo, useRef, useState } from "react";

export const QUIZ_TIME_WARNING_SECONDS = 60;

const TICK_MS = 500;

export const formatQuizTimeLeft = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

type UseQuizCountdownOptions = {
  expiresAt?: string;
  serverNow?: string;
  /** Device time when `serverNow` was received; defaults to the first render that sees it. */
  receivedAt?: number;
  /** Seconds after `expiresAt` during which the server still accepts a submit. */
  graceSeconds?: number;
  onExpire: () => void;
};

/**
 * Counts down to `expiresAt` on the server clock: `serverNow` is paired with the device time it was
 * received at, so a skewed device clock or a cached response does not change the remaining time.
 */
export const useQuizCountdown = ({
  expiresAt,
  serverNow,
  receivedAt,
  graceSeconds = 0,
  onExpire,
}: UseQuizCountdownOptions) => {
  const clockOffsetMs = useMemo(
    () => (serverNow ? Date.parse(serverNow) - (receivedAt ?? Date.now()) : 0),
    [serverNow, receivedAt],
  );
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : null;

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isGraceOver, setIsGraceOver] = useState(false);
  const onExpireRef = useRef(onExpire);
  const expiredAtRef = useRef<number | null>(null);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    setIsGraceOver(false);

    if (expiresAtMs === null) {
      setSecondsLeft(null);

      return;
    }

    const graceEndsAtMs = expiresAtMs + graceSeconds * 1000;

    const update = () => {
      const serverNowMs = Date.now() + clockOffsetMs;
      const left = Math.max(0, Math.ceil((expiresAtMs - serverNowMs) / 1000));

      setSecondsLeft(left);

      // fire once per deadline, even if a refetch re-runs this effect with a new clock offset
      if (left === 0 && expiredAtRef.current !== expiresAtMs) {
        expiredAtRef.current = expiresAtMs;
        onExpireRef.current();
      }

      const graceOver = serverNowMs >= graceEndsAtMs;

      setIsGraceOver(graceOver);

      return graceOver;
    };

    if (update()) return;

    const intervalId = setInterval(() => {
      if (update()) clearInterval(intervalId);
    }, TICK_MS);

    return () => clearInterval(intervalId);
  }, [expiresAtMs, clockOffsetMs, graceSeconds]);

  return {
    secondsLeft,
    isWarning: secondsLeft !== null && secondsLeft <= QUIZ_TIME_WARNING_SECONDS,
    isGraceOver,
  };
};
