import { Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

type UserAchievement = {
  achievementId: string;
  achievementKey: string;
  visibility: "hidden" | "visible";
  levelId: string;
  levelNumber: number;
  threshold: number;
  xpReward: number;
  earnedAt: string;
};

type GroupedAchievement = {
  achievementId: string;
  achievementKey: string;
  currentLevel: UserAchievement;
  history: UserAchievement[];
};

type AchievementsCarouselProps = {
  achievements: UserAchievement[];
};

const containerClasses =
  "justify-between flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow";

function groupAchievements(achievements: UserAchievement[]): GroupedAchievement[] {
  const achievementsMap = new Map<string, UserAchievement[]>();

  achievements.forEach((achievement) => {
    const existingAchievements = achievementsMap.get(achievement.achievementId) ?? [];
    existingAchievements.push(achievement);
    achievementsMap.set(achievement.achievementId, existingAchievements);
  });

  return Array.from(achievementsMap.values()).map((levels) => {
    const sorted = [...levels].sort((a, b) => b.levelNumber - a.levelNumber);

    return {
      achievementId: sorted[0].achievementId,
      achievementKey: sorted[0].achievementKey,
      currentLevel: sorted[0],
      history: sorted,
    };
  });
}

const AchievementHistoryDialog = ({
  achievement,
  open,
  onClose,
}: {
  achievement: GroupedAchievement | null;
  open: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <Trophy className="size-8" />
          </div>

          <DialogTitle className="text-xl">
            {achievement &&
              t(`gamification.profile.${achievement.achievementKey}.name`, {
                defaultValue: achievement.achievementKey,
              })}
          </DialogTitle>
        </DialogHeader>

        <ul className="flex flex-col gap-2 pt-2">
          {achievement?.history.map((level) => (
            <li
              key={level.levelId}
              className="flex items-center justify-between rounded-md border border-neutral-100 px-3 py-2"
            >
              <span className="px-2.5 py-0.5 text-sm font-semibold text-primary-700">
                {t("gamification.profile.dialog.level")}: {level.levelNumber}
              </span>

              <span className="text-sm text-neutral-600">
                {level.earnedAt
                  ? new Date(level.earnedAt).toLocaleString("pl-PL").slice(0, -3)
                  : "—"}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
};

const AchievementCard = ({
  achievement,
  onClick,
}: {
  achievement: GroupedAchievement;
  onClick: () => void;
}) => {
  const { t } = useTranslation();

  const hasHistory = achievement.history.length > 1;

  return (
    <button
      type="button"
      disabled={!hasHistory}
      onClick={onClick}
      className={cn(
        "flex h-full w-full flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 text-center",
        hasHistory && "cursor-pointer transition-shadow hover:shadow-md",
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Trophy className="size-6" />
      </div>

      <span className="text-sm font-medium text-neutral-950">
        {t(`gamification.profile.${achievement.achievementKey}.name`, {
          defaultValue: achievement.achievementKey,
        })}
      </span>

      <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
        {t("gamification.profile.dialog.level")}: {achievement.currentLevel.levelNumber}
      </span>

      {achievement.currentLevel.earnedAt && (
        <span className="text-xs text-neutral-500">
          {new Date(achievement.currentLevel.earnedAt).toLocaleDateString()}
        </span>
      )}

      {hasHistory && (
        <span className="text-xs font-medium text-primary-600">
          {t("gamification.profile.showHistory")}
        </span>
      )}
    </button>
  );
};

export const AchievementsCarousel = ({ achievements }: AchievementsCarouselProps) => {
  const { t } = useTranslation();

  const grouped = useMemo(() => groupAchievements(achievements), [achievements]);

  const [selected, setSelected] = useState<GroupedAchievement | null>(null);

  if (!grouped.length) {
    return (
      <div className={containerClasses}>
        <h5 className="h5">{t("gamification.profile.header")}</h5>

        <p className="text-sm text-gray-600">{t("gamification.profile.zeroAchievementsHeader")}</p>
      </div>
    );
  }

  return (
    <>
      <Carousel className={containerClasses} opts={{ slidesToScroll: "auto" }}>
        <div className="flex w-full items-center justify-between">
          <h5 className="h5">{t("gamification.profile.header")}</h5>

          <div className="hidden gap-x-2 lg:flex">
            <CarouselPrevious className="static translate-y-0 rounded-full" />
            <CarouselNext className="static translate-y-0 rounded-full" />
          </div>
        </div>

        <CarouselContent
          className="flex w-full rounded-lg"
          viewportClassName="overflow-x-hidden overflow-y-visible"
        >
          {grouped.map((achievement) => (
            <CarouselItem
              key={achievement.achievementId}
              className="w-full max-w-[calc(100%-24px)] shrink-0 pr-3 *:h-full xs:max-w-[220px] sm:pr-6 last:pr-0"
            >
              <AchievementCard achievement={achievement} onClick={() => setSelected(achievement)} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <AchievementHistoryDialog
        achievement={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
};
