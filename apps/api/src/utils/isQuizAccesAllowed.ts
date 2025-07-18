export const isQuizAccessAllowed = (
  attempts: number | null,
  attemptsLimit: number | null,
  lastUpdate: string | null,
  quizCooldown: number | null,
): boolean => {
  if (attemptsLimit === null || attempts === null) {
    return true;
  }

  if (attempts <= attemptsLimit) {
    return true;
  }

  if (lastUpdate && quizCooldown) {
    const lastUpdateDate = new Date(lastUpdate);

    const cooldownEnd = new Date(lastUpdateDate.getTime() + quizCooldown * 60 * 60 * 1000);
    const now = new Date();

    if (now < cooldownEnd) {
      return false;
    }
  }

  return true;
};
