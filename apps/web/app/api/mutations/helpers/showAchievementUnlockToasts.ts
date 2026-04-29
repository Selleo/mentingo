import { toast } from "~/components/ui/use-toast";

export type GamificationAwardPayload = {
  pointsAwarded: number;
  newlyUnlocked?: Array<{
    id: string;
    localizedName?: string;
    pointThreshold?: number;
  }>;
};

export function showAchievementUnlockToasts(
  gamification: GamificationAwardPayload | undefined,
  translate: (key: string, options?: Record<string, unknown>) => string,
) {
  gamification?.newlyUnlocked?.forEach((achievement) => {
    toast({
      title: translate("gamification.toast.achievementUnlockedTitle"),
      description: translate("gamification.toast.achievementUnlockedDescription", {
        name: achievement.localizedName,
      }),
    });
  });
}
