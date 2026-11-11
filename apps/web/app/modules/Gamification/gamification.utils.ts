import type { UserAchievement, UserGamificationProfile } from "./gamification.types";

const toPercent = (value: number, total: number) =>
  total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 100;

export const getLevelProgress = ({
  lifetimeXp,
  currentLevelXp,
  nextLevelXp,
}: UserGamificationProfile) => ({
  percent: toPercent(lifetimeXp - currentLevelXp, nextLevelXp - currentLevelXp),
  remainingXp: Math.max(0, nextLevelXp - lifetimeXp),
});

export const getAchievementProgress = ({ levels, progress }: UserAchievement) => {
  const earnedLevels = levels.filter(({ earnedAt }) => earnedAt);
  const nextLevel = levels.find(({ earnedAt }) => !earnedAt);

  return {
    earnedLevelCount: earnedLevels.length,
    lastEarnedAt: earnedLevels.at(-1)?.earnedAt ?? null,
    nextLevel,
    percent: nextLevel ? toPercent(progress, nextLevel.threshold) : 100,
  };
};
