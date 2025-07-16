import { startCase } from "lodash-es";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useMarkLessonAsCompleted } from "~/api/mutations";
import { useCurrentUser } from "~/api/queries";
import { Icon } from "~/components/Icon";
import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import { Video } from "~/components/VideoPlayer/Video";
import { useUserRole } from "~/hooks/useUserRole";
import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";
import { Quiz } from "~/modules/Courses/Lesson/Quiz";

import Presentation from "../../../components/Presentation/Presentation";

import type { GetLessonByIdResponse } from "~/api/generated-api";

type LessonContentProps = {
  lesson: GetLessonByIdResponse["data"];
  lessonsAmount: number;
  handlePrevious: () => void;
  handleNext: () => void;
  isFirstLesson: boolean;
  isLastLesson: boolean;
  courseId: string;
};

export const LessonContent = ({
  lesson,
  lessonsAmount,
  handlePrevious,
  handleNext,
  isFirstLesson,
  isLastLesson,
  courseId,
}: LessonContentProps) => {
  const { data: user } = useCurrentUser();
  const [isNextDisabled, setIsNextDisabled] = useState(false);
  const { mutate: markLessonAsCompleted } = useMarkLessonAsCompleted(
    user?.id || "",
    courseId || "",
  );
  const { t } = useTranslation();
  const { isAdminLike } = useUserRole();

  useEffect(() => {
    if (isAdminLike) return;

    if (lesson.type == LessonType.QUIZ || lesson.type == LessonType.VIDEO) {
      return setIsNextDisabled(!lesson.lessonCompleted);
    }

    setIsNextDisabled(false);
  }, [isAdminLike, lesson.lessonCompleted, lesson.type]);

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
      .otherwise(() => null);

  const handleMarkLessonAsComplete = () => {
    handleNext();

    if (isAdminLike) return;

    markLessonAsCompleted({ lessonId: lesson.id });
  };

  return (
    <div className="flex h-full w-full flex-col items-center py-6">
      <div className="flex h-full w-full flex-col gap-y-8 px-8 3xl:max-w-[1024px] 3xl:p-0">
        <div className="flex w-full items-end">
          <div className="flex w-full flex-col gap-y-2">
            <p className="body-sm-md text-neutral-800">
              {t("studentLessonView.other.lesson")}{" "}
              <span data-testid="current-lesson-number">{lesson.displayOrder}</span>/
              <span data-testid="lessons-count">{lessonsAmount}</span> -{" "}
              <span data-testid="lesson-type">{startCase(lesson.type)}</span>
            </p>
            <p className="h4 text-neutral-950">{lesson.title}</p>
          </div>
          <div className="flex gap-x-3">
            {!isFirstLesson && (
              <Button variant="outline" className="gap-x-1" onClick={handlePrevious}>
                <Icon name="ArrowRight" className="h-auto w-4 rotate-180" />
                <span>{t("studentLessonView.button.previous")}</span>
              </Button>
            )}

            <Button
              disabled={isNextDisabled}
              className="gap-x-1"
              onClick={handleMarkLessonAsComplete}
            >
              <Icon name="ArrowRight" className="h-auto w-4" />
              <span>
                {isLastLesson
                  ? t("studentLessonView.button.complete")
                  : t("studentLessonView.button.next")}
              </span>
            </Button>
          </div>
        </div>
        <Content />
      </div>
    </div>
  );
};
