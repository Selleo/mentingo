import { useState, useEffect } from "react";

export function useQuizRetakeStatus(
  attempts: number | null,
  attemptsLimit: number | null,
  lastUpdate: string | null,
  quizCooldown: number | null,
) {
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (
      attempts !== null &&
      attemptsLimit !== null &&
      lastUpdate !== null &&
      quizCooldown !== null
    ) {
      const lastUpdateDate = new Date(lastUpdate);
      const cooldownEnd = new Date(lastUpdateDate.getTime() + quizCooldown * 60 * 60 * 1000);
      const now = new Date();

      const secondsLeft = Math.max(0, Math.floor((cooldownEnd.getTime() - now.getTime()) / 1000));
      if (secondsLeft > 0) {
        setCooldownTimeLeft(secondsLeft);
      } else {
        setCooldownTimeLeft(null);
      }
    }
  }, [attempts, attemptsLimit, lastUpdate, quizCooldown]);

  useEffect(() => {
    if (cooldownTimeLeft === null) return;
    const interval = setInterval(() => {
      setCooldownTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownTimeLeft]);

  const canRetake = (() => {
    if (attemptsLimit === null || attempts === null) return true;
    if (attempts <= attemptsLimit) return true;
    if (lastUpdate && quizCooldown) {
      const lastUpdateDate = new Date(lastUpdate);
      const cooldownEnd = new Date(lastUpdateDate.getTime() + quizCooldown * 60 * 60 * 1000);
      return new Date() >= cooldownEnd;
    }
    return true;
  })();

  return { cooldownTimeLeft, canRetake };
}
