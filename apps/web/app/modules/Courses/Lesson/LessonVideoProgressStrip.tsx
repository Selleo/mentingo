import { Info } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { cn } from "~/lib/utils";

import {
  getLessonVideoProgressRangeStyle,
  getLessonVideoProgressSegmentDurationSeconds,
  getLessonVideoProgressSegmentWatchedRanges,
  isLessonVideoProgressSegmentComplete,
  parseLessonVideoProgressSegments,
} from "./LessonVideoProgressStrip.utils";

import type { LessonVideoProgressStripProps } from "./LessonVideoProgressStrip.types";

export const LessonVideoProgressStrip = ({
  lessonId,
  description,
  enabled,
  showRequirementWarning = true,
  store,
}: LessonVideoProgressStripProps) => {
  const { t } = useTranslation();
  const segments = useStore(store, (state) => state.segments);
  const resetLessonVideoProgress = useStore(store, (state) => state.reset);

  useEffect(() => {
    if (!enabled) {
      resetLessonVideoProgress([]);
      return;
    }

    resetLessonVideoProgress(parseLessonVideoProgressSegments(description));
  }, [description, enabled, lessonId, resetLessonVideoProgress]);

  if (!enabled || segments.length === 0) return null;

  const completedSegmentsCount = segments.filter(isLessonVideoProgressSegmentComplete).length;

  return (
    <div
      className="mb-6 flex w-full flex-col gap-2"
      role="group"
      aria-label={t("studentLessonView.videoProgress.overviewAriaLabel")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-neutral-800">
          {t("studentLessonView.videoProgress.label")}
        </span>
        <span className="text-xs font-medium text-neutral-600">
          {t("studentLessonView.videoProgress.completedSummary", {
            completed: completedSegmentsCount,
            total: segments.length,
          })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 gap-1">
        {segments.map((segment, index) => {
          const isComplete = isLessonVideoProgressSegmentComplete(segment);
          const durationSeconds = getLessonVideoProgressSegmentDurationSeconds(segment);
          const progressLabel = Math.round(segment.coveragePercent * 100);
          const watchedRanges = getLessonVideoProgressSegmentWatchedRanges(
            segment,
            durationSeconds,
          );

          return (
            <div
              key={`${segment.id}-${index}`}
              className={cn(
                "relative h-1 min-w-0 flex-1 overflow-hidden rounded-sm bg-neutral-200 transition-colors duration-300 ease-out",
                isComplete && "bg-success-100",
              )}
              role="progressbar"
              aria-label={t("studentLessonView.videoProgress.segmentAriaLabel", {
                index: index + 1,
                progress: progressLabel,
              })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressLabel}
            >
              {watchedRanges.map(([start, end], rangeIndex) => {
                return (
                  <span
                    key={`${segment.id}-${rangeIndex}`}
                    className={cn(
                      "absolute inset-y-0 rounded-sm transition-[background-color,left,width] duration-300 ease-out will-change-[left,width]",
                      isComplete ? "bg-success-500" : "bg-primary-600",
                    )}
                    style={getLessonVideoProgressRangeStyle({ start, end, durationSeconds })}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      {showRequirementWarning && (
        <Alert className="flex items-center mt-4 gap-3 border-primary-200 bg-primary-50 px-3 py-2.5 text-primary-950 [&>svg]:static [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-primary-600 [&>svg~*]:pl-0 [&>svg+div]:translate-y-0">
          <Info aria-hidden="true" />
          <AlertDescription className="text-sm font-medium text-primary-950">
            {t(
              segments.length === 1
                ? "studentLessonView.videoProgress.requirementSingle"
                : "studentLessonView.videoProgress.requirementMultiple",
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
