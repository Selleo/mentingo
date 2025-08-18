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

import type { GetLessonByIdResponse } from "~/api/generated-api";

type LessonContentProps = {
  lesson: GetLessonByIdResponse["data"];
  lessonsAmount: number;
  handlePrevious: () => void;
  handleNext: () => void;
  isFirstLesson: boolean;
  isLastLesson: boolean;
  lessonLoading: boolean;
};

export const LessonContent = ({
  lesson,
  lessonsAmount,
  handlePrevious,
  handleNext,
  isFirstLesson,
  lessonLoading,
}: LessonContentProps) => {
  const [isNextDisabled, setIsNextDisabled] = useState(false);
  const { mutate: markLessonAsCompleted } = useMarkLessonAsCompleted();
  const { t } = useTranslation();
  const { isAdminLike } = useUserRole();

  useEffect(() => {
    if (isAdminLike) return;

    if (lesson.type == LessonType.VIDEO || lesson.type == LessonType.AI_MENTOR) {
      return setIsNextDisabled(!lesson.lessonCompleted);
    }
    if (lesson.type == LessonType.QUIZ) {
      return setIsNextDisabled(
        (lesson.attempts === null || lesson.attempts === 1) && !lesson.lessonCompleted,
      );
    }

    setIsNextDisabled(false);
  }, [isAdminLike, lesson.lessonCompleted, lesson.type, lesson.attempts]);

  const Content = () =>
    match(lesson.type)
      .with("text", () => <Viewer variant="lesson" content={lesson?.description ?? ""} />)
      .with("quiz", () => <Quiz lesson={lesson} />)
      .with("video", () => (
        <Video
          url={lesson.fileUrl}
          onVideoEnded={() => setIsNextDisabled(false)}
          isExternalUrl={lesson.isExternal}
        />
      ))
      .with("presentation", () => (
        <Presentation url={lesson.fileUrl ?? ""} isExternalUrl={lesson.isExternal} />
      ))
      .with("ai_mentor", () => <AiMentorLesson lesson={lesson} lessonLoading={lessonLoading} />)
      .otherwise(() => null);

  const handleMarkLessonAsComplete = () => {
    handleNext();

    if (isAdminLike) return;
    if (lesson.type == LessonType.AI_MENTOR) return;

    markLessonAsCompleted({ lessonId: lesson.id });
  };

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
              onClick={handleMarkLessonAsComplete}
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
