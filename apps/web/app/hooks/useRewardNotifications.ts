import { REWARD_ACTION_TYPES, REWARDS_SOCKET_EVENTS, type RewardActionType } from "@repo/shared";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { queryClient } from "~/api/queryClient";
import { acquireSocket, releaseSocket } from "~/api/socket";
import { useToast } from "~/components/ui/use-toast";

type RewardUpdatedNotification = {
  actionType?: RewardActionType;
  pointsAwarded?: number;
};

export function useRewardNotifications() {
  const { t } = useTranslation();
  const { toast } = useToast();

  useEffect(() => {
    const socket = acquireSocket();
    const handleConnect = () => socket.emit("join:user");
    const handleRewardsUpdated = (notification: RewardUpdatedNotification) => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });

      if (
        !notification.pointsAwarded ||
        (notification.actionType !== REWARD_ACTION_TYPES.CHAPTER_COMPLETED &&
          notification.actionType !== REWARD_ACTION_TYPES.COURSE_COMPLETED)
      ) {
        return;
      }

      const actionKey =
        notification.actionType === REWARD_ACTION_TYPES.COURSE_COMPLETED
          ? "courseCompleted"
          : "chapterCompleted";

      toast({
        title: t(`rewards.notifications.${actionKey}`),
        description: t("rewards.notifications.pointsAwarded", {
          count: notification.pointsAwarded,
        }),
      });
    };

    socket.on("connect", handleConnect);
    socket.on(REWARDS_SOCKET_EVENTS.UPDATED, handleRewardsUpdated);
    socket.connect();

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(REWARDS_SOCKET_EVENTS.UPDATED, handleRewardsUpdated);
      releaseSocket();
    };
  }, [t, toast]);
}
