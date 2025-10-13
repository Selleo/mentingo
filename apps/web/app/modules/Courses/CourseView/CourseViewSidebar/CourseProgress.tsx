import { useNavigate } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { CopyUrlButton } from "~/components/CopyUrlButton";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { useUserRole } from "~/hooks/useUserRole";
import { CourseProgressChart } from "~/modules/Courses/CourseView/components/CourseProgressChart";

import { findFirstInProgressLessonId, findFirstNotStartedLessonId } from "../../Lesson/utils";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseProgressProps = {
  course: GetCourseResponse["data"];
};

export const CourseProgress = ({ course }: CourseProgressProps) => {
  const { isAdminLike } = useUserRole();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const notStartedLessonId = findFirstNotStartedLessonId(course);
  const notStartedChapterId = course.chapters.find((chapter) => {
    return chapter.lessons.some(({ id }) => id === notStartedLessonId);
  })?.id;

  const firstInProgressLessonId = findFirstInProgressLessonId(course);
  const firstInProgressChapterId = course.chapters.find((chapter) => {
    return chapter.lessons.some(({ id }) => id === firstInProgressLessonId);
  })?.id;

  const hasCourseProgress = course.chapters.some(
    ({ completedLessonCount }) => completedLessonCount,
  );

  const firstLessonId = course.chapters[0]?.lessons[0]?.id;

  const handleNavigateToLesson = () => {
    if (!notStartedLessonId && !firstInProgressLessonId) {
      return navigate(`lesson/${firstLessonId}`);
    }

    navigate(`lesson/${firstInProgressLessonId ?? notStartedLessonId}`, {
      state: { chapterId: firstInProgressChapterId ?? notStartedChapterId },
    });
  };

  return (
    <>
      <h4 className="h6 pb-1 text-neutral-950">
        {isAdminLike
          ? t("studentCourseView.sideSection.other.options")
          : t("studentCourseView.sideSection.other.courseProgress")}
      </h4>
      {!isAdminLike && (
        <CourseProgressChart
          chaptersCount={course?.courseChapterCount}
          completedChaptersCount={course?.completedChapterCount}
        />
      )}
      <div className="flex flex-col gap-y-2">
        <CopyUrlButton className="gap-x-2" variant="outline">
          <Icon name="Share" className="h-auto w-6 text-primary-800" />
          <span>{t("studentCourseView.sideSection.button.shareCourse")}</span>
        </CopyUrlButton>
        <>
          <Button className="gap-x-2" onClick={handleNavigateToLesson}>
            <Icon name="Play" className="text-contrast h-auto w-6" />
            <span>
              {t(
                isAdminLike
                  ? "adminCourseView.common.preview"
                  : !hasCourseProgress
                    ? "studentCourseView.sideSection.button.startLearning"
                    : notStartedLessonId || firstInProgressLessonId
                      ? "studentCourseView.sideSection.button.continueLearning"
                      : "studentCourseView.sideSection.button.repeatLessons",
              )}
            </span>
          </Button>
          <p className="details flex items-center justify-center gap-x-2 text-neutral-800">
            <Icon name="Info" className="h-auto w-4 text-neutral-800" />
            <span>{t("studentCourseView.sideSection.other.informationText")}</span>
          </p>
        </>
      </div>
    </>
  );
};
