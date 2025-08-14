import { useQueryClient } from "@tanstack/react-query";
import { startCase } from "lodash-es";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useMarkLessonAsCompleted } from "~/api/mutations";
import { Icon } from "~/components/Icon";
import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import { Video } from "~/components/VideoPlayer/Video";
import { useUserRole } from "~/hooks/useUserRole";
import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";
import { Quiz } from "~/modules/Courses/Lesson/Quiz";

import Presentation from "../../../components/Presentation/Presentation";

import AiMentorLesson from "./AiMentorLesson/AiMentorLesson";
import { isNextBlocked, isPreviousBlocked } from "./utils";

import type { GetLessonByIdResponse, GetCourseResponse } from "~/api/generated-api";

type LessonContentProps = {
  lesson: GetLessonByIdResponse["data"];
  course: GetCourseResponse["data"];
  lessonsAmount: number;
  handlePrevious: () => void;
  handleNext: () => void;
  isFirstLesson: boolean;
  isLastLesson: boolean;
  lessonLoading: boolean;
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
}: LessonContentProps) => {
  const [isPreviousDisabled, setIsPreviousDisabled] = useState(false);
  const [isNextDisabled, setIsNextDisabled] = useState(false);
  const { mutate: markLessonAsCompleted } = useMarkLessonAsCompleted();
  const { t } = useTranslation();
  const { isAdminLike } = useUserRole();

  const currentChapterIndex = course.chapters.findIndex((chapter) =>
    chapter.lessons.some(({ id }) => id === lesson.id),
  );
  const currentLessonIndex = course.chapters[currentChapterIndex]?.lessons.findIndex(
    ({ id }) => id === lesson.id,
  );

  const currentChapter = course.chapters[currentChapterIndex];
  const nextChapter = course.chapters[currentChapterIndex + 1];
  const prevChapter = course.chapters[currentChapterIndex - 1];
  const totalLessons = currentChapter.lessons.length;

  const queryClient = useQueryClient();

  useEffect(() => {
    if (isAdminLike) {
      setIsNextDisabled(false);
      setIsPreviousDisabled(false);
      return;
    }
    setIsNextDisabled(
      isNextBlocked(
        currentLessonIndex,
        totalLessons,
        nextChapter?.isFreemium ?? false,
        course.enrolled ?? false,
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
    totalLessons,
    nextChapter,
    prevChapter,
    course.enrolled,
  ]);

  const Content = () =>
    match(lesson.type)
      .with("text", () => <Viewer variant="lesson" content={lesson?.description ?? ""} />)
      .with("quiz", () => <Quiz lesson={lesson} />)
      .with("video", () => (
        <Video
          url={lesson.fileUrl}
          onVideoEnded={() => {
            setIsNextDisabled(false);
            markLessonAsCompleted({ lessonId: lesson.id });
          }}
          isExternalUrl={lesson.isExternal}
        />
      ))
      .with("presentation", () => (
        <Presentation url={lesson.fileUrl ?? ""} isExternalUrl={lesson.isExternal} />
      ))
      .with("ai_mentor", () => <AiMentorLesson lesson={lesson} lessonLoading={lessonLoading} />)
      .otherwise(() => null);

  useEffect(() => {
    if (lesson.type === LessonType.TEXT || lesson.type === LessonType.PRESENTATION) {
      markLessonAsCompleted({ lessonId: lesson.id });
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
  ]);
  return (
    <div className="flex size-full flex-col items-center py-10">
      <div className="flex size-full flex-col gap-y-10 px-6 sm:px-10 3xl:max-w-[1024px] 3xl:px-8">
        <div className="flex w-full flex-col pb-6 sm:flex-row sm:items-end">
          <div className="flex w-full flex-col gap-y-4">
            <p className="body-sm-md text-neutral-800">
              {t("studentLessonView.other.lesson")}{" "}
              <span data-testid="current-lesson-number">{lesson.displayOrder}</span>/
              <span data-testid="lessons-count">{lessonsAmount}</span> –{" "}
              <span data-testid="lesson-type">{startCase(lesson.type)}</span>
            </p>
            <p className="h4 text-neutral-950">{lesson.title}</p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:ml-8 sm:mt-0 sm:flex-row sm:gap-x-4">
            {!isFirstLesson && (
              <Button
                variant="outline"
                className="w-full gap-x-1 sm:w-auto"
                disabled={isPreviousDisabled}
                onClick={handlePrevious}
              >
                <Icon name="ArrowRight" className="h-auto w-4 rotate-180" />
              </Button>
            )}
            <Button
              data-testid="next-lesson-button"
              variant="outline"
              disabled={isNextDisabled}
              className="w-full gap-x-1 sm:w-auto"
              onClick={handleNext}
            >
              <Icon name="ArrowRight" className="h-auto w-4" />
            </Button>
          </div>
        </div>

        <div>
          <Content />
        </div>
      </div>
    </div>
  );
};
