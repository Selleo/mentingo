export const isQuizAccessAllowed = (
  attempts: number | null,
  attemptsLimit: number | null,
  lastUpdate: string | null,
  quizCooldownInHours: number | null,
): boolean => {
  if (attemptsLimit === null || attempts === null) {
    return true;
  }
  if (attempts % attemptsLimit !== 0) return true;

  if (lastUpdate && quizCooldownInHours) {
    const lastUpdateDate = new Date(lastUpdate);

    const cooldownEnd = new Date(lastUpdateDate.getTime() + quizCooldownInHours * 60 * 60 * 1000);
    const now = new Date();

    if (now < cooldownEnd) {
      return false;
    }
  }

  return true;
};
