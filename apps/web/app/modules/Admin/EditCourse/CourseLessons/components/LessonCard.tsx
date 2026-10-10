import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { LessonType, type Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";
import { REVIEW_CHANGE_KIND } from "~/modules/CourseAuthoring/review/curriculumReview.constants";
import {
  ReviewCardMarker,
  reviewAccentClass,
} from "~/modules/CourseAuthoring/review/ReviewChangeBadge";
import { LessonTypeIcon } from "~/modules/Courses/CourseView/LessonTypeIcon";
import { getLessonTypeTranslationKey } from "~/modules/Courses/CourseView/lessonTypes";

import { CURRICULUM_HANDLES } from "../../../../../../e2e/data/curriculum/handles";

import type { ReactNode } from "react";
import type { CurriculumReviewMarker } from "~/modules/CourseAuthoring/review/curriculumReview.types";

interface LessonCardProps {
  item: Lesson;
  onClickLessonCard: (lesson: Lesson) => void;
  dragTrigger: ReactNode;
  selectedLesson: Lesson | null;
  isCourseGenerationLocked: boolean;
  isReadOnlyPreview?: boolean;
  isPreviewLessonReady?: boolean;
  baseLanguageLesson?: Lesson;
  reviewMarker?: CurriculumReviewMarker;
}

const LessonCard = ({
  item,
  onClickLessonCard,
  dragTrigger,
  selectedLesson,
  isCourseGenerationLocked,
  isReadOnlyPreview,
  isPreviewLessonReady = true,
  baseLanguageLesson,
  reviewMarker,
}: LessonCardProps) => {
  const isRemovedInReview = reviewMarker?.kind === REVIEW_CHANGE_KIND.REMOVED;
  const { t } = useTranslation();
  const displayTitle = item.title || baseLanguageLesson?.title || "";
  const isUsingBaseLanguageTitle = !item.title && Boolean(baseLanguageLesson?.title);

  const isInteractionLocked =
    (isCourseGenerationLocked && !isReadOnlyPreview) ||
    (isReadOnlyPreview && !isPreviewLessonReady);

  const activate = () => {
    if (isInteractionLocked) return;
    onClickLessonCard(item);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    activate();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      activate();
    }
  };

  const contentTypeKey = useMemo(() => getLessonTypeTranslationKey(item.type), [item.type]);
  const lockedReason = isPreviewLessonReady
    ? t("courseAuthoring.livePreview.readOnly", {
        defaultValue: "Draft preview is read-only until you apply it.",
      })
    : t("courseAuthoring.livePreview.contentPending", {
        defaultValue: "The content for this lesson hasn’t been generated yet.",
      });

  const card = (
    <div
      key={item.id}
      data-testid={CURRICULUM_HANDLES.lessonCard(item.id)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isInteractionLocked ? undefined : 0}
      role={isInteractionLocked ? undefined : "button"}
      aria-disabled={isInteractionLocked ? true : undefined}
      aria-label={`Lesson: ${displayTitle}`}
      className={cn(
        "flex gap-x-3 rounded-lg border bg-white p-3 hover:border-neutral-300 hover:bg-neutral-50",
        {
          "border-neutral-200": selectedLesson?.id !== item.id,
          "border-primary-500 bg-primary-50": selectedLesson?.id === item.id,
          "cursor-not-allowed opacity-60 hover:border-neutral-200 hover:bg-white":
            isInteractionLocked,
        },
        reviewAccentClass(reviewMarker?.kind),
      )}
    >
      {dragTrigger}
      <div className="flex min-w-0 flex-1 items-start gap-x-2">
        <LessonTypeIcon type={item.type} className="size-6 shrink-0 text-primary-700" />
        <hgroup className="min-w-0">
          <p
            className={cn("text-l break-words", {
              "text-neutral-500": isUsingBaseLanguageTitle || isRemovedInReview,
              "text-neutral-950": !isUsingBaseLanguageTitle && !isRemovedInReview,
              "line-through": isRemovedInReview,
            })}
            title={displayTitle}
            data-testid={CURRICULUM_HANDLES.lessonTitle(item.id)}
          >
            {item.type === LessonType.QUIZ ? (
              <>
                {displayTitle}{" "}
                <span className="text-neutral-600">({item.questions?.length || 0})</span>
              </>
            ) : (
              displayTitle
            )}
          </p>
          {reviewMarker?.previousTitle && (
            <p className="details truncate text-neutral-500 line-through">
              {reviewMarker.previousTitle}
            </p>
          )}
          <p
            className="details text-neutral-600 truncate"
            title={t(contentTypeKey, { defaultValue: item.type })}
          >
            {t(contentTypeKey, { defaultValue: item.type })}
          </p>
          {reviewMarker?.note && (
            <p className="details truncate text-primary-700">{reviewMarker.note}</p>
          )}
        </hgroup>
      </div>
      <ReviewCardMarker marker={reviewMarker} />
    </div>
  );

  if (!isInteractionLocked) return card;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            role="button"
            aria-disabled="true"
            aria-label={lockedReason}
            className="block"
          >
            {card}
          </span>
        </TooltipTrigger>
        <TooltipContent variant="black">{lockedReason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default LessonCard;
