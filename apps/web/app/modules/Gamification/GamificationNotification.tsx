import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { acquireSocket, releaseSocket } from "~/api/socket";
import { Icon } from "~/components/Icon";
import { toast, useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";

import { getTierIconName } from "../Profile/components/AchievementsCarousel";

export type GamificationNotification = {
  userAchievementId: string | null;
  achievementName: string;
  level: number;
  type: NOTIFICATION_TYPE;
};

type NOTIFICATION_TYPE = "achievement" | "nextLevel";

export function GamificationNotification() {
  const { t } = useTranslation();
  const { toasts } = useToast();

  const [queue, setQueue] = useState<GamificationNotification[]>([]);
  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentToast = currentIdRef.current
      ? toasts.find((t) => t.id === currentIdRef.current)
      : undefined;
    const currentStillVisible = currentToast?.open === true;

    if (currentStillVisible) return;

    currentIdRef.current = null;

    if (queue.length === 0) return;

    const [next, ...rest] = queue;
    setQueue(rest);

    const { id } = toast({
      title: t(`gamification.toast.${next.type}.title`),
      description: (
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-primary-600",
            )}
          >
            <Icon name={getTierIconName(next.level)} className="h-full" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-neutral-950">{next.achievementName}</span>
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full px-2.5 py-0.5",
                "bg-primary-100 text-xs font-semibold text-primary-700",
              )}
            >
              {t(`gamification.toast.${next.type}.level`) + ": " + next.level}
            </span>
          </div>
        </div>
      ),
    });

    currentIdRef.current = id;
  }, [queue, toasts, t]);

  useEffect(() => {
    const socket = acquireSocket();

    const handleEvent = (notification: GamificationNotification) => {
      setQueue((prev) => [...prev, notification]);
    };

    const handleConnect = () => {
      socket.emit("join:user");
    };

    socket.on("connect", handleConnect);
    socket.on("gamification:newLevel", handleEvent);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("gamification:newLevel", handleEvent);
      releaseSocket();
    };
  }, []);

  return null;
}
