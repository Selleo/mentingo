import { useTranslation } from "react-i18next";

import { Progress } from "~/components/ui/progress";

import { getLevelProgress } from "./gamification.utils";

import type { UserGamificationProfile } from "./gamification.types";

type LevelProgressProps = {
  profile: UserGamificationProfile;
};

export function LevelProgress({ profile }: LevelProgressProps) {
  const { t } = useTranslation();
  const { percent, remainingXp } = getLevelProgress(profile);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="h5 brand-gradient-text">
          {t("gamification.level", { level: profile.level })}
        </span>
        <span className="rounded-full bg-warning-100 px-2.5 py-0.5 text-sm font-extrabold text-warning-800">
          {t("gamification.xp", { xp: profile.lifetimeXp })}
        </span>
      </div>
      <Progress
        value={percent}
        className="h-3 bg-primary-100"
        aria-label={t("gamification.xpToNextLevel", {
          xp: remainingXp,
          level: profile.level + 1,
        })}
      />
      <span className="details font-semibold text-neutral-600">
        {t("gamification.xpToNextLevel", { xp: remainingXp, level: profile.level + 1 })}
      </span>
    </div>
  );
}
