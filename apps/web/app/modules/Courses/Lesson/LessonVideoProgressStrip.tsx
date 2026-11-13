import { Headphones, Info, Video } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { useStore } from "zustand";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { cn } from "~/lib/utils";

import { LESSON_PROGRESS_MEDIA_KIND } from "./LessonVideoProgressStrip.types";
import {
  getLessonVideoProgressRangeStyle,
  getLessonVideoProgressSegmentDurationSeconds,
  getLessonVideoProgressSegmentWatchedRanges,
  isLessonVideoProgressSegmentComplete,
  parseLessonAudioProgressSegments,
  parseLessonVideoProgressSegments,
} from "./LessonVideoProgressStrip.utils";

import type {
  LessonProgressMediaKind,
  LessonVideoProgressSegment,
  LessonVideoProgressStripProps,
} from "./LessonVideoProgressStrip.types";

const getMediaProgressTranslationKeys = (mediaKind: LessonProgressMediaKind) =>
  match(mediaKind)
    .with(LESSON_PROGRESS_MEDIA_KIND.VIDEO, () => ({
      overviewAriaLabel: "studentLessonView.videoProgress.overviewAriaLabel",
      label: "studentLessonView.videoProgress.label",
      completedSummary: "studentLessonView.videoProgress.completedSummary",
      segmentAriaLabel: "studentLessonView.videoProgress.segmentAriaLabel",
    }))
    .with(LESSON_PROGRESS_MEDIA_KIND.AUDIO, () => ({
      overviewAriaLabel: "studentLessonView.audioProgress.overviewAriaLabel",
      label: "studentLessonView.audioProgress.label",
      completedSummary: "studentLessonView.audioProgress.completedSummary",
      segmentAriaLabel: "studentLessonView.audioProgress.segmentAriaLabel",
    }))
    .exhaustive();

const getMediaRequirementTranslationKey = (segments: LessonVideoProgressSegment[]) => {
  const videoCount = segments.filter(
    (segment) => segment.mediaKind === LESSON_PROGRESS_MEDIA_KIND.VIDEO,
  ).length;
  const audioCount = segments.filter(
    (segment) => segment.mediaKind === LESSON_PROGRESS_MEDIA_KIND.AUDIO,
  ).length;

  return match({ videoCount, audioCount })
    .with(
      { videoCount: 1, audioCount: 0 },
      () => "studentLessonView.videoProgress.requirementSingle",
    )
    .with({ audioCount: 0 }, () => "studentLessonView.videoProgress.requirementMultiple")
    .with(
      { videoCount: 0, audioCount: 1 },
      () => "studentLessonView.audioProgress.requirementSingle",
    )
    .with({ videoCount: 0 }, () => "studentLessonView.audioProgress.requirementMultiple")
    .with(
      { videoCount: 1, audioCount: 1 },
      () => "studentLessonView.mediaProgress.requirementSingle",
    )
    .otherwise(() => "studentLessonView.mediaProgress.requirementMultiple");
};

const countSegmentsOfKind = (
  segments: LessonVideoProgressSegment[],
  mediaKind: LessonProgressMediaKind,
) => {
  const segmentsOfKind = segments.filter((segment) => segment.mediaKind === mediaKind);

  return {
    total: segmentsOfKind.length,
    completed: segmentsOfKind.filter(isLessonVideoProgressSegmentComplete).length,
  };
};

const MEDIA_KIND_ICONS = {
  [LESSON_PROGRESS_MEDIA_KIND.VIDEO]: Video,
  [LESSON_PROGRESS_MEDIA_KIND.AUDIO]: Headphones,
} as const;

type LessonMediaProgressSummaryProps = {
  segments: LessonVideoProgressSegment[];
};

const LessonMediaProgressSummary = ({ segments }: LessonMediaProgressSummaryProps) => {
  const { t } = useTranslation();
  const mediaKindCounts = Object.values(LESSON_PROGRESS_MEDIA_KIND)
    .map((mediaKind) => ({ mediaKind, ...countSegmentsOfKind(segments, mediaKind) }))
    .filter(({ total }) => total > 0);

  const [singleMediaKindCount] = mediaKindCounts;

  if (mediaKindCounts.length === 1 && singleMediaKindCount) {
    return (
      <span className="text-xs font-medium text-neutral-600">
        {t(getMediaProgressTranslationKeys(singleMediaKindCount.mediaKind).completedSummary, {
          completed: singleMediaKindCount.completed,
          total: singleMediaKindCount.total,
        })}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-3 text-xs font-medium text-neutral-600">
      {mediaKindCounts.map(({ mediaKind, completed, total }) => {
        const MediaKindIcon = MEDIA_KIND_ICONS[mediaKind];

        return (
          <span
            key={mediaKind}
            className="flex items-center gap-1"
            aria-label={t(getMediaProgressTranslationKeys(mediaKind).completedSummary, {
              completed,
              total,
            })}
          >
            <MediaKindIcon className="size-3.5" aria-hidden />
            <span aria-hidden>
              {completed}/{total}
            </span>
          </span>
        );
      })}
    </span>
  );
};

const getMediaProgressLabelKey = (segments: LessonVideoProgressSegment[]) => {
  const mediaKinds = new Set(segments.map((segment) => segment.mediaKind));

  if (mediaKinds.size > 1) return "studentLessonView.mediaProgress.label";

  const [mediaKind] = mediaKinds;

  return getMediaProgressTranslationKeys(mediaKind ?? LESSON_PROGRESS_MEDIA_KIND.VIDEO).label;
};

const getSegmentIndexWithinKind = (
  segments: LessonVideoProgressSegment[],
  segmentIndex: number,
) => {
  const { mediaKind } = segments[segmentIndex];

  return segments.slice(0, segmentIndex + 1).filter((segment) => segment.mediaKind === mediaKind)
    .length;
};

export const LessonVideoProgressStrip = ({
  lessonId,
  description,
  enabled,
  audioEnabled = false,
  showRequirementWarning = true,
  store,
}: LessonVideoProgressStripProps) => {
  const { t } = useTranslation();
  const segments = useStore(store, (state) => state.segments);
  const resetLessonVideoProgress = useStore(store, (state) => state.reset);

  useEffect(() => {
    resetLessonVideoProgress([
      ...(enabled ? parseLessonVideoProgressSegments(description) : []),
      ...(audioEnabled ? parseLessonAudioProgressSegments(description) : []),
    ]);
  }, [audioEnabled, description, enabled, lessonId, resetLessonVideoProgress]);

  if (segments.length === 0) return null;

  return (
    <div className="mb-6 flex w-full flex-col gap-6">
      <div
        className="flex w-full flex-col gap-2"
        role="group"
        aria-label={t("studentLessonView.mediaProgress.overviewAriaLabel")}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-neutral-800">
            {t(getMediaProgressLabelKey(segments))}
          </span>
          <LessonMediaProgressSummary segments={segments} />
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
                aria-label={t(getMediaProgressTranslationKeys(segment.mediaKind).segmentAriaLabel, {
                  index: getSegmentIndexWithinKind(segments, index),
                  progress: progressLabel,
                })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressLabel}
              >
                {watchedRanges.map(([start, end], rangeIndex) => (
                  <span
                    key={`${segment.id}-${rangeIndex}`}
                    className={cn(
                      "absolute inset-y-0 rounded-sm transition-[background-color,left,width] duration-300 ease-out will-change-[left,width]",
                      isComplete ? "bg-success-500" : "bg-primary-600",
                    )}
                    style={getLessonVideoProgressRangeStyle({ start, end, durationSeconds })}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {showRequirementWarning && (
        <Alert className="flex items-center gap-3 border-primary-200 bg-primary-50 px-3 py-2.5 text-primary-950 [&>svg]:static [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-primary-600 [&>svg~*]:pl-0 [&>svg+div]:translate-y-0">
          <Info aria-hidden="true" />
          <AlertDescription className="text-sm font-medium text-primary-950">
            {t(getMediaRequirementTranslationKey(segments))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
