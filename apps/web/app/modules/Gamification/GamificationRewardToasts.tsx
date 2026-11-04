import { PERMISSIONS } from "@repo/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
import { useUserGamificationProfile } from "~/api/queries/useUserGamificationProfile";
import { useToast } from "~/components/ui/use-toast";
import { usePermissions } from "~/hooks/usePermissions";

// Rewards are granted asynchronously after the outbox event, so the UI polls instead of using sockets.
const REWARD_POLL_INTERVAL_MS = 30_000;

/** Toasts rewards that appear among the latest five after the first load; disabled in support mode. */
export function GamificationRewardToasts() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUserSuspense();
  const { hasAccess } = usePermissions({ required: PERMISSIONS.GAMIFICATION_READ });
  const { data: profile } = useUserGamificationProfile(currentUser?.id, {
    enabled: hasAccess && !currentUser?.isSupportMode,
    refetchInterval: REWARD_POLL_INTERVAL_MS,
  });
  const seenRewardIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!profile) return;

    if (!seenRewardIds.current) {
      seenRewardIds.current = new Set(profile.recentRewards.map(({ id }) => id));

      return;
    }

    for (const reward of profile.recentRewards) {
      if (seenRewardIds.current.has(reward.id)) continue;

      seenRewardIds.current.add(reward.id);
      toast({
        title: t("gamification.toast.title"),
        description: t("gamification.toast.description", {
          title: reward.achievementTitle,
          xp: reward.xpReward,
        }),
      });
    }
  }, [profile, t, toast]);

  return null;
}
