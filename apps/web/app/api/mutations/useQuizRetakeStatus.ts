import { useState, useEffect } from "react";

export function useQuizRetakeStatus(
  attempts: number | null,
  attemptsLimit: number | null,
  lastUpdate: string | null,
  quizCooldown: number | null,
) {
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);
  const timeBuffer = 5000;

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

      const hoursRemaining = Math.max(
        0,
        Math.ceil((cooldownEnd.getTime() - now.getTime() - timeBuffer) / (60 * 60 * 1000)),
      );
      if (hoursRemaining > 0) {
        setHoursLeft(hoursRemaining);
      } else {
        setHoursLeft(null);
      }
    }
  }, [attempts, attemptsLimit, lastUpdate, quizCooldown]);

  useEffect(() => {
    if (hoursLeft === null) return;

    const interval = setInterval(
      () => {
        const lastUpdateDate = new Date(lastUpdate!);
        const cooldownEnd = new Date(lastUpdateDate.getTime() + quizCooldown! * 60 * 60 * 1000);
        const now = new Date();

        const updatedHoursLeft = Math.max(
          0,
          Math.ceil((cooldownEnd.getTime() - now.getTime() - timeBuffer) / (1000 * 60 * 60)),
        );

        setHoursLeft(updatedHoursLeft > 0 ? updatedHoursLeft : null);
      },
      60 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [hoursLeft, lastUpdate, quizCooldown]);

  const canRetake = (() => {
    if (attemptsLimit === null || attempts === null) return true;
    if (attempts % attemptsLimit !== 0) return true;
    if (lastUpdate && quizCooldown) {
      const lastUpdateDate = new Date(lastUpdate);
      const cooldownEnd = new Date(lastUpdateDate.getTime() + quizCooldown * 60 * 60 * 1000);
      const now = new Date();

      if (now < cooldownEnd) {
        return false;
      }
    }
    return true;
  })();

  return { hoursLeft, canRetake };
}
