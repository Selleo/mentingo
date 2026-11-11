import { useTranslation } from "react-i18next";

import { Progress } from "~/components/ui/progress";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AchievementBadge } from "./AchievementBadge";
import { getAchievementProgress } from "./gamification.utils";

import type { UserAchievement } from "./gamification.types";

type AchievementCardProps = {
  achievement: UserAchievement;
};

export function AchievementCard({ achievement }: AchievementCardProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { earnedLevelCount, lastEarnedAt, nextLevel, percent } =
    getAchievementProgress(achievement);
  const isEarned = earnedLevelCount > 0;
  const hasLevels = achievement.levels.length > 1;
  // Show the highest earned level's badge, or the first level's greyed out before any is earned.
  const badgeLevel = Math.max(earnedLevelCount, 1);

  return (
    <li className="flex gap-3 rounded-lg border border-neutral-200 p-4">
      <AchievementBadge
        level={badgeLevel}
        icon={achievement.icon}
        badgeImageUrl={achievement.levels[badgeLevel - 1]?.badgeImageUrl}
        isEarned={isEarned}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="body-base-md text-neutral-950">{achievement.title}</span>
          {hasLevels && (
            <span className="details shrink-0 text-neutral-500">
              {t("gamification.levelOf", {
                level: earnedLevelCount,
                total: achievement.levels.length,
              })}
            </span>
          )}
        </div>
        <p className="body-sm text-neutral-600">{achievement.description}</p>
        {lastEarnedAt && (
          <span className="details text-neutral-500">
            {t("gamification.earnedOn", {
              date: new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(
                new Date(lastEarnedAt),
              ),
            })}
          </span>
        )}
        {nextLevel && (
          <div className="flex items-center gap-2">
            <Progress
              value={percent}
              className="h-1.5 bg-neutral-100"
              aria-label={achievement.title}
            />
            <span className="details shrink-0 text-neutral-500">
              {t("gamification.progress", {
                value: Math.min(achievement.progress, nextLevel.threshold),
                threshold: nextLevel.threshold,
              })}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}
