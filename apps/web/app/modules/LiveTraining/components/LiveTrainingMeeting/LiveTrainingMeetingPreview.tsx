import { LIVE_TRAINING_SESSION_STATUSES } from "@repo/shared";
import { Play, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import type { LiveTrainingMeetingPreviewProps } from "./LiveTrainingMeeting.types";

export function LiveTrainingMeetingPreview({
  liveTraining,
  actions,
  isJoining,
  onJoin,
}: LiveTrainingMeetingPreviewProps) {
  const { t } = useTranslation();
  const currentSession = liveTraining.currentSession;

  if (!currentSession) return null;

  const isWaiting = currentSession.status === LIVE_TRAINING_SESSION_STATUSES.WAITING;

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/10 text-white">
            <Video className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">
              {t("liveTrainingView.meeting.previewLabel")}
            </p>
            <h2 className="text-base font-semibold text-white">
              {t(
                isWaiting
                  ? "liveTrainingView.meeting.waitingTitle"
                  : "liveTrainingView.meeting.activeTitle",
              )}
            </h2>
          </div>
        </div>

        {actions.canShowJoin && (
          <Button
            type="button"
            onClick={onJoin}
            disabled={isJoining}
            className="h-9 gap-2 bg-white text-primary-950 hover:bg-white/90"
          >
            <Play className="size-4" />
            {t("liveTrainingView.actions.join")}
          </Button>
        )}
      </div>
    </div>
  );
}
