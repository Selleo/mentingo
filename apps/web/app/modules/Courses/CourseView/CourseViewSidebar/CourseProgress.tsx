import { useNavigate } from "@remix-run/react";
import { find, flatMap } from "lodash-es";
import { useTranslation } from "react-i18next";

import { CopyUrlButton } from "~/components/CopyUrlButton";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { useUserRole } from "~/hooks/useUserRole";
import { CourseProgressChart } from "~/modules/Courses/CourseView/components/CourseProgressChart";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseProgressProps = {
  course: GetCourseResponse["data"];
};

const findFirstNotStartedLessonId = (course: CourseProgressProps["course"]) => {
  const allLessons = flatMap(course.chapters, (chapter) => chapter.lessons);
  return find(allLessons, (lesson) => lesson.status === "not_started")?.id;
};

export const CourseProgress = ({ course }: CourseProgressProps) => {
  const { isAdminLike } = useUserRole();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const nonStartedLessonId = findFirstNotStartedLessonId(course);
  const notStartedChapterId = course.chapters.find((chapter) => {
    return chapter.lessons.some((lesson) => lesson.id === nonStartedLessonId);
  })?.id;

  const hasCourseProgress = course.chapters.some(
    ({ completedLessonCount }) => completedLessonCount,
  );

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
          <Button
            className="gap-x-2"
            disabled={!nonStartedLessonId}
            onClick={() =>
              navigate(`lesson/${nonStartedLessonId}`, {
                state: { chapterId: notStartedChapterId },
              })
            }
          >
            <Icon name="Play" className="h-auto w-6 text-white" />
            <span>
              {t(
                isAdminLike
                  ? "adminCourseView.common.preview"
                  : hasCourseProgress
                    ? "studentCourseView.sideSection.button.continueLearning"
                    : "studentCourseView.sideSection.button.startLearning",
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
