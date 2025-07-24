import { useState, useEffect, useMemo } from "react";

export function useQuizRetakeStatus(
  attempts: number | null,
  attemptsLimit: number | null,
  lastUpdate: string | null,
  quizCooldownInHours: number | null,
) {
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);
  const timeBuffer = 5000;

  const quizCooldownInMs = useMemo(() => {
    return quizCooldownInHours !== null ? quizCooldownInHours * 60 * 60 * 1000 : null;
  }, [quizCooldownInHours]);

  useEffect(() => {
    if (
      attempts !== null &&
      attemptsLimit !== null &&
      lastUpdate !== null &&
      quizCooldownInMs !== null
    ) {
      const lastUpdateDate = new Date(lastUpdate);
      const cooldownEnd = new Date(lastUpdateDate.getTime() + quizCooldownInMs);
      const now = new Date();

      const hoursRemaining = Math.max(
        0,
        Math.ceil((cooldownEnd.getTime() - now.getTime() - timeBuffer) / (60 * 60 * 1000)),
      );

      setHoursLeft(hoursRemaining > 0 ? hoursRemaining : null);
    }
  }, [attempts, attemptsLimit, lastUpdate, quizCooldownInMs]);

  useEffect(() => {
    if (hoursLeft === null || quizCooldownInMs === null || lastUpdate === null) return;

    const interval = setInterval(
      () => {
        const lastUpdateDate = new Date(lastUpdate);
        const cooldownEnd = new Date(lastUpdateDate.getTime() + quizCooldownInMs);
        const now = new Date();

        const updatedHoursLeft = Math.max(
          0,
          Math.ceil((cooldownEnd.getTime() - now.getTime() - timeBuffer) / (60 * 60 * 1000)),
        );

        setHoursLeft(updatedHoursLeft > 0 ? updatedHoursLeft : null);
      },
      60 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [hoursLeft, lastUpdate, quizCooldownInMs]);

  const canRetake = useMemo(() => {
    if (attemptsLimit === null || attempts === null) return true;
    if (attempts % attemptsLimit !== 0) return true;
    if (lastUpdate && quizCooldownInMs !== null) {
      const lastUpdateDate = new Date(lastUpdate);
      const cooldownEnd = new Date(lastUpdateDate.getTime() + quizCooldownInMs);
      const now = new Date();

      if (now < cooldownEnd) {
        return false;
      }
    }
    return true;
  }, [attempts, attemptsLimit, lastUpdate, quizCooldownInMs]);

  return { hoursLeft, canRetake };
}
