import { CalendarClock, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { formatScheduledLiveTrainingDateRange } from "./liveTrainingLessonForm.utils";

import type { GetLiveTrainingsResponse } from "~/api/generated-api";

type ScheduledLiveTraining = GetLiveTrainingsResponse["data"][number];

type ScheduledLiveTrainingListProps = {
  error?: string | null;
  isLoading: boolean;
  liveTrainings: ScheduledLiveTraining[];
  selectedLiveTrainingId: string | null;
  onSelect: (liveTrainingId: string) => void;
};

export function ScheduledLiveTrainingList({
  error,
  isLoading,
  liveTrainings,
  selectedLiveTrainingId,
  onSelect,
}: ScheduledLiveTrainingListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-sm text-neutral-500">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {t("adminCourseView.curriculum.lesson.liveTraining.linkExistingLoading")}
      </div>
    );
  }

  if (!liveTrainings.length) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
        {t("adminCourseView.curriculum.lesson.liveTraining.linkExistingEmpty")}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="grid max-h-96 gap-2 overflow-y-auto pr-1">
        {liveTrainings.map((liveTraining) => {
          const isSelected = liveTraining.id === selectedLiveTrainingId;

          return (
            <button
              key={liveTraining.id}
              type="button"
              className={cn(
                "grid gap-2 rounded-md border bg-white p-3 text-left transition hover:border-primary-400 hover:bg-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                {
                  "border-primary-500 bg-primary-50": isSelected,
                  "border-neutral-200": !isSelected,
                },
              )}
              onClick={() => onSelect(liveTraining.id)}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-950">
                  {liveTraining.title}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                  <CalendarClock className="size-3.5 shrink-0" />
                  {formatScheduledLiveTrainingDateRange(liveTraining)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm font-medium text-error-600">{error}</p>}
    </div>
  );
}
