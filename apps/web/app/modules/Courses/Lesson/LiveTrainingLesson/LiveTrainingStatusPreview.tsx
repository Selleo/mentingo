import { LIVE_TRAINING_DELIVERY_TYPES, LIVE_TRAINING_STATUSES } from "@repo/shared";
import { CalendarClock, CheckCircle2, Play, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { LIVE_TRAINING_LESSON_HANDLES } from "../../../../../e2e/data/live-training/handles";

import { LiveTrainingLocationNotice } from "./LiveTrainingLocationNotice";

import type { LiveTrainingDetails } from "./LiveTrainingLesson.types";

type LiveTrainingStatusPreviewProps = {
  liveTraining: LiveTrainingDetails;
  scheduleLabel: string;
  canJoin: boolean;
  isJoining: boolean;
  onJoin: () => void;
};

export function LiveTrainingStatusPreview({
  liveTraining,
  scheduleLabel,
  canJoin,
  isJoining,
  onJoin,
}: LiveTrainingStatusPreviewProps) {
  const { t } = useTranslation();
  const isActive = liveTraining.status === LIVE_TRAINING_STATUSES.ACTIVE;
  const isEnded = liveTraining.status === LIVE_TRAINING_STATUSES.ENDED;
  const isScheduled = liveTraining.status === LIVE_TRAINING_STATUSES.SCHEDULED;
  const isOffline = liveTraining.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE;
  const location = isOffline ? liveTraining.location : null;

  if (isActive) {
    return (
      <section
        data-testid={LIVE_TRAINING_LESSON_HANDLES.STATUS_PREVIEW}
        className="overflow-hidden rounded-md border border-primary-100 bg-white shadow-sm"
      >
        <div className="relative bg-primary-950 p-4 text-white">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--primary-800),var(--primary-950)_55%,var(--primary-900))]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white/10">
                <Video className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-white/50">
                  {t("studentLessonView.liveTraining.activeLabel")}
                </p>
                <h2 className="text-base font-semibold text-white">
                  {t("studentLessonView.liveTraining.activeTitle")}
                </h2>
                <p className="mt-1 truncate text-sm text-white/65">{scheduleLabel}</p>
              </div>
            </div>

            {canJoin && (
              <Button
                type="button"
                data-testid={LIVE_TRAINING_LESSON_HANDLES.JOIN_BUTTON}
                className="h-9 gap-2 rounded bg-white text-primary-950 hover:bg-white/90"
                disabled={isJoining}
                onClick={onJoin}
              >
                <Play className="size-4" />
                {t("liveTrainingView.actions.join")}
              </Button>
            )}
          </div>
        </div>
        {location && <LiveTrainingLocationNotice location={location} />}
      </section>
    );
  }

  if (isEnded) {
    return (
      <section
        data-testid={LIVE_TRAINING_LESSON_HANDLES.STATUS_PREVIEW}
        className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-success-50 text-success-700">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {t("studentLessonView.liveTraining.endedLabel")}
            </p>
            <h2 className="text-base font-semibold text-neutral-950">
              {t("studentLessonView.liveTraining.endedTitle")}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">{scheduleLabel}</p>
          </div>
        </div>
        {location && <LiveTrainingLocationNotice location={location} />}
      </section>
    );
  }

  if (isScheduled) {
    return (
      <section
        data-testid={LIVE_TRAINING_LESSON_HANDLES.STATUS_PREVIEW}
        className="rounded-md border border-primary-100 bg-white p-4 shadow-sm"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
            <CalendarClock className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {t("studentLessonView.liveTraining.scheduledLabel")}
            </p>
            <h2 className="text-base font-semibold text-neutral-950">
              {t("studentLessonView.liveTraining.scheduledTitle")}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">{scheduleLabel}</p>
          </div>
        </div>
        {location && <LiveTrainingLocationNotice location={location} />}
      </section>
    );
  }

  return (
    <section
      data-testid={LIVE_TRAINING_LESSON_HANDLES.STATUS_PREVIEW}
      className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-neutral-500">
          <Video className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {t("studentLessonView.liveTraining.inactiveLabel")}
          </p>
          <h2 className="text-base font-semibold text-neutral-950">
            {t("studentLessonView.liveTraining.inactiveTitle")}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">{scheduleLabel}</p>
        </div>
      </div>
    </section>
  );
}
