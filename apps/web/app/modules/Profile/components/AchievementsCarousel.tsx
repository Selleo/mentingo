import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { formatDate } from "~/utils/formatDate";

import type { IconName } from "~/types/shared";

type UserAchievement = {
  achievementId: string;
  achievementTitle: string;
  visibility: "hidden" | "visible";
  levelId: string;
  levelNumber: number;
  threshold: number;
  xpReward: number;
  earnedAt: string;
};

type GroupedAchievement = {
  achievementId: string;
  achievementTitle: string;
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
      achievementTitle: sorted[0].achievementTitle,
      currentLevel: sorted[0],
      history: sorted,
    };
  });
}

export function getTierIconName(levelNumber: number): IconName {
  return `Tier${levelNumber}` as IconName;
}

const AchievementIcon = ({
  levelNumber,
  className,
}: {
  levelNumber: number;
  className?: string;
}) => (
  <Avatar className={cn("flex items-center justify-center text-primary-600", className)}>
    <AvatarFallback className="flex size-full items-center justify-center bg-transparent text-inherit">
      <Icon name={getTierIconName(levelNumber)} className="h-full" />
    </AvatarFallback>
  </Avatar>
);

const AchievementHistoryDialog = ({
  achievement,
  open,
  onClose,
}: {
  achievement: GroupedAchievement | null;
  open: boolean;
  onClose: () => void;
}) => {
  const { t, i18n } = useTranslation();

  if (!achievement) return;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center text-center">
          <AchievementIcon
            levelNumber={achievement.currentLevel.levelNumber}
            className="mb-2 size-20"
          />

          <DialogTitle className="text-xl">
            {achievement &&
              t(`gamification.profile.${achievement.achievementTitle}.name`, {
                defaultValue: achievement.achievementTitle,
              })}
          </DialogTitle>
        </DialogHeader>

        <Separator />

        <ScrollArea className="max-h-72 pr-2">
          <ul className="flex flex-col gap-2 pt-2">
            {achievement?.history.map((level) => (
              <li key={level.levelId}>
                <Card className="border-neutral-100 shadow-none">
                  <CardContent className="flex items-center justify-between px-3 py-2">
                    <Badge className="rounded-full border-transparent bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                      {t("gamification.profile.dialog.level")}: {level.levelNumber}
                    </Badge>

                    <span className="text-sm text-neutral-600">
                      {level.earnedAt
                        ? formatDate(
                            level.earnedAt,
                            { dateStyle: "short", timeStyle: "short" },
                            i18n.language,
                          )
                        : "—"}
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </ScrollArea>
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
  const { t, i18n } = useTranslation();

  const hasHistory = achievement.history.length > 1;

  return (
    <Button
      type="button"
      disabled={!hasHistory}
      onClick={onClick}
      className={cn(
        "flex h-full w-full flex-col items-center justify-start gap-2 rounded-lg border border-neutral-200 bg-white p-4 text-center text-neutral-950 hover:opacity-100 disabled:opacity-100",
        hasHistory && "cursor-pointer transition-shadow hover:shadow-md",
      )}
    >
      <AchievementIcon levelNumber={achievement.currentLevel.levelNumber} className="size-32" />

      <span className="text-sm font-medium text-neutral-950">
        {t(`gamification.profile.${achievement.achievementTitle}.name`, {
          defaultValue: achievement.achievementTitle,
        })}
      </span>

      <Badge className="rounded-full border-transparent bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
        {t("gamification.profile.dialog.level")}: {achievement.currentLevel.levelNumber}
      </Badge>

      {achievement.currentLevel.earnedAt && (
        <span className="text-xs text-neutral-500">
          {formatDate(achievement.currentLevel.earnedAt, { dateStyle: "short" }, i18n.language)}
        </span>
      )}

      {hasHistory && (
        <span className="text-xs font-medium text-primary-600">
          {t("gamification.profile.showHistory")}
        </span>
      )}
    </Button>
  );
};

export const AchievementsCarousel = ({ achievements }: AchievementsCarouselProps) => {
  const { t } = useTranslation();

  const grouped = useMemo(() => groupAchievements(achievements), [achievements]).reverse();

  const [selected, setSelected] = useState<GroupedAchievement | null>(null);

  if (!grouped.length) {
    return (
      <Card className={cn(containerClasses, "border-none shadow-none")}>
        <CardContent className="flex flex-col gap-y-6 p-0">
          <h5 className="h5">{t("gamification.profile.header")}</h5>

          <span className="text-sm text-gray-600">
            {t("gamification.profile.zeroAchievementsHeader")}
          </span>
        </CardContent>
      </Card>
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
