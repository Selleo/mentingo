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
        <span className="h6 text-neutral-950">
          {t("gamification.level", { level: profile.level })}
        </span>
        <span className="body-sm text-neutral-600">
          {t("gamification.xp", { xp: profile.lifetimeXp })}
        </span>
      </div>
      <Progress
        value={percent}
        className="h-2 bg-neutral-100"
        aria-label={t("gamification.xpToNextLevel", {
          xp: remainingXp,
          level: profile.level + 1,
        })}
      />
      <span className="details text-neutral-500">
        {t("gamification.xpToNextLevel", { xp: remainingXp, level: profile.level + 1 })}
      </span>
    </div>
  );
}
