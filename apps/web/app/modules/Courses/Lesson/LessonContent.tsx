import { useQueryClient } from "@tanstack/react-query";
import { startCase } from "lodash-es";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useMarkLessonAsCompleted } from "~/api/mutations";
import { useCurrentUser } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useVideoPlayer } from "~/components/VideoPlayer/VideoPlayerContext";
import { useLessonsSequence } from "~/hooks/useLessonsSequence";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";
import { useVideoPreferencesStore } from "~/modules/common/store/useVideoPreferencesStore";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { LessonContentRenderer } from "./LessonContentRenderer";
import { isNextBlocked, isPreviousBlocked } from "./utils";

import type { GetCourseResponse, GetLessonByIdResponse } from "~/api/generated-api";

type LessonContentProps = {
  lesson: GetLessonByIdResponse["data"];
  course: GetCourseResponse["data"];
  lessonsAmount: number;
  handlePrevious: () => void;
  handleNext: () => void;
  isFirstLesson: boolean;
  isLastLesson: boolean;
  lessonLoading: boolean;
  isPreviewMode?: boolean;
};

export const LessonContent = ({
  lesson,
  course,
  lessonsAmount,
  handlePrevious,
  handleNext,
  isFirstLesson,
  lessonLoading,
  isLastLesson,
  isPreviewMode = false,
}: LessonContentProps) => {
  const { t } = useTranslation();

  const { clearVideo } = useVideoPlayer();
  const { autoplay, setAutoplay } = useVideoPreferencesStore();

  const [isPreviousDisabled, setIsPreviousDisabled] = useState(false);
  const [isNextDisabled, setIsNextDisabled] = useState(false);

  const { language } = useLanguageStore();

  const { data: user } = useCurrentUser();
  const { mutate: markLessonAsCompleted } = useMarkLessonAsCompleted(user?.id || "", course.slug);
  const { isAdminLike, isStudent } = useUserRole();
  const { sequenceEnabled } = useLessonsSequence(course.id);

  const currentChapterIndex = course.chapters.findIndex((chapter) =>
    chapter.lessons.some(({ id }) => id === lesson.id),
  );
  const currentLessonIndex = course.chapters[currentChapterIndex]?.lessons.findIndex(
    ({ id }) => id === lesson.id,
  );
  const nextLessonIndex = currentLessonIndex + 1;
  const currentChapter = course.chapters[currentChapterIndex];
  const nextChapter = course.chapters[currentChapterIndex + 1];
  const prevChapter = course.chapters[currentChapterIndex - 1];
  const totalLessons = currentChapter.lessons.length;
  const queryClient = useQueryClient();

  const canAccessLesson = useCallback(
    (courseData: GetCourseResponse["data"], targetLessonId: string) => {
      if (!sequenceEnabled) {
        return true;
      }

      const allLessons =
        courseData.chapters.flatMap((c) => c.lessons?.map((l) => ({ ...l })) ?? []) ?? [];

      const targetIndex = allLessons.findIndex((l) => l.id === targetLessonId);
      if (targetIndex === -1) return true;

      const target = allLessons[targetIndex];
      if (target.status === "completed") return true;

      const priorLessons = allLessons.slice(0, Math.max(targetIndex, 0));
      return priorLessons.every((l) => l.status === "completed");
    },
    [sequenceEnabled],
  );

  useEffect(() => {
    if (isPreviewMode) return;

    if (isAdminLike) {
      setIsNextDisabled(false);
      setIsPreviousDisabled(false);
      return;
    }

    const nextLessonId =
      currentChapter?.lessons?.[nextLessonIndex]?.id ?? nextChapter?.lessons?.[0]?.id;
    const cannotEnterNextLesson = nextLessonId ? !canAccessLesson(course, nextLessonId) : false;

    setIsNextDisabled(
      isNextBlocked(
        currentLessonIndex,
        totalLessons,
        nextChapter?.isFreemium ?? false,
        course.enrolled ?? false,
        cannotEnterNextLesson,
      ),
    );

    setIsPreviousDisabled(
      isPreviousBlocked(
        currentLessonIndex,
        prevChapter?.isFreemium ?? false,
        course.enrolled ?? false,
      ),
    );

    queryClient.invalidateQueries({ queryKey: ["course", { id: course.id }] });
  }, [
    isAdminLike,
    lesson.type,
    lesson.lessonCompleted,
    currentLessonIndex,
    currentChapter.lessons,
    totalLessons,
    nextChapter,
    prevChapter,
    course.enrolled,
    isPreviewMode,
    queryClient,
    course.id,
    nextLessonIndex,
    canAccessLesson,
    course,
  ]);

  useEffect(() => {
    if (isPreviewMode) return;

    if (
      (lesson.type === LessonType.CONTENT || lesson.type === LessonType.EMBED) &&
      !lesson.hasVideo
    ) {
      markLessonAsCompleted({ lessonId: lesson.id, language });
    }

    if (currentLessonIndex === totalLessons - 1) {
      if (course.enrolled && nextChapter?.isFreemium && course.priceInCents !== 0) {
        setIsNextDisabled(true);
      }
      if (currentLessonIndex === 0) {
        if (!prevChapter?.isFreemium) {
          setIsPreviousDisabled(true);
        }
      }
    }
  }, [
    nextChapter?.isFreemium,
    prevChapter?.isFreemium,
    totalLessons,
    currentLessonIndex,
    currentChapterIndex,
    course,
    isLastLesson,
    isPreviewMode,
    lesson.id,
    lesson.type,
    markLessonAsCompleted,
    language,
    lesson.hasVideo,
  ]);

  useEffect(() => {
    if (lesson.id && !lesson.hasVideo) {
      clearVideo();
    }
  }, [lesson.id, lesson.hasVideo, clearVideo]);

  const handleVideoEnded = useCallback(() => {
    setIsNextDisabled(false);
    if (isStudent) markLessonAsCompleted({ lessonId: lesson.id, language });
    if (autoplay && lesson.hasOnlyVideo) handleNext();
  }, [
    isStudent,
    markLessonAsCompleted,
    lesson.id,
    language,
    autoplay,
    handleNext,
    lesson.hasOnlyVideo,
  ]);

  return (
    <TooltipProvider>
      <div
        className={cn("flex w-full min-w-0 flex-col items-center h-auto", {
          "py-10": !isPreviewMode,
        })}
      >
        <div className="flex w-full min-w-0 flex-col gap-y-10 px-6 sm:px-10 max-w-full 3xl:max-w-[1024px] 3xl:px-8 h-auto">
          {!isPreviewMode && (
            <div className="flex w-full flex-col pb-6 sm:flex-row sm:items-end">
              <div className="flex w-full min-w-0 flex-col gap-y-4 overflow-x-hidden">
                <div className="flex items-center gap-x-2">
                  <p className="body-sm-md text-neutral-800">
                    {t("studentLessonView.other.lesson")}{" "}
                    <span data-testid="current-lesson-number">{lesson.displayOrder}</span>/
                    <span data-testid="lessons-count">{lessonsAmount}</span> –{" "}
                    <span data-testid="lesson-type">{startCase(lesson.type)}</span>
                  </p>
                  {lesson.type === LessonType.AI_MENTOR && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="secondary" className="uppercase">
                          Beta
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {t("studentLessonView.tooltip.beta")}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="h4 text-neutral-950 break-words min-w-0">{lesson.title}</p>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:ml-8 sm:mt-0 sm:items-end">
                <div className="flex flex-row gap-x-4">
                  {lesson.type === LessonType.CONTENT && lesson.hasOnlyVideo && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm text-neutral-600">
                        {t("studentLessonView.button.autoplay")}
                      </span>
                      <Switch checked={autoplay} onCheckedChange={setAutoplay} />
                    </label>
                  )}
                  <Button
                    variant="outline"
                    className="w-full gap-x-1 sm:w-auto disabled:opacity-0"
                    disabled={isPreviousDisabled || isFirstLesson}
                    onClick={handlePrevious}
                  >
                    <Icon name="ArrowRight" className="h-auto w-4 rotate-180" />
                  </Button>
                  <Button
                    data-testid="next-lesson-button"
                    variant="outline"
                    disabled={isNextDisabled}
                    className="w-full gap-x-1 sm:w-auto disabled:opacity-0"
                    onClick={handleNext}
                  >
                    <Icon name="ArrowRight" className="h-auto w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <LessonContentRenderer
            lesson={lesson}
            user={user}
            isPreviewMode={isPreviewMode}
            lessonLoading={lessonLoading}
            onVideoEnded={handleVideoEnded}
          />
        </div>
      </div>
    </TooltipProvider>
  );
};
