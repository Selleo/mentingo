import { Navigate, useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";
import { useSearchParam } from "react-use";

import { useCourse, useLesson } from "~/api/queries";
import { useUserById } from "~/api/queries/admin/useUserById";
import { PageWrapper } from "~/components/PageWrapper";
import Loader from "~/modules/common/Loader/Loader";
import { LessonContent } from "~/modules/Courses/Lesson/LessonContent";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.lessonPreview");

export default function LessonPreviewPage() {
  const { t } = useTranslation();

  const userId = useSearchParam("userId");
  const { courseId = "", lessonId = "" } = useParams();

  const { language } = useLanguageStore();

  const { data: user, isLoading: isLoadingUser } = useUserById(userId ?? "");
  const { data: lesson, isLoading: isLoadingLesson } = useLesson(
    lessonId,
    language,
    userId || undefined,
  );
  const { data: course, isLoading: isLoadingCourse } = useCourse(courseId);

  if (isLoadingUser || isLoadingLesson || isLoadingCourse) {
    return (
      <div className="w-screen h-full grid place-items-center">
        <Loader />
      </div>
    );
  }

  if (!user || !lesson || !course) {
    return <Navigate to="/courses" replace />;
  }

  const breadcrumbs = [
    { title: "Przeglądaj kursy", href: "/courses" },
    { title: course.title, href: `/courses/${courseId}` },
    { title: `${user.firstName} ${user.lastName}`, href: `/admin/users/${userId}` },
    { title: `${lesson.title} Preview`, href: "#" },
  ];

  const backButton = { href: `/course/${courseId}`, title: "Wstecz" };

  const currentChapter = course.chapters.find((chapter) =>
    chapter?.lessons.some((l) => l.id === lessonId),
  );

  return (
    <PageWrapper className="relative" backButton={backButton} breadcrumbs={breadcrumbs}>
      <div className="flex size-full max-w-full flex-col gap-6">
        <div className="flex size-full flex-col divide-y rounded-lg bg-white">
          <div className="flex items-center p-6 sm:px-10 3xl:px-8">
            <p className="h6 text-neutral-950">
              <span className="text-neutral-800">
                {t("studentLessonView.other.chapter")} {currentChapter?.displayOrder}:
              </span>{" "}
              {currentChapter?.title}
            </p>
          </div>
          <LessonContent
            lesson={lesson}
            course={course}
            lessonsAmount={currentChapter?.lessons.length ?? 0}
            handleNext={() => {}}
            handlePrevious={() => {}}
            isLastLesson={true}
            isFirstLesson={true}
            lessonLoading={isLoadingLesson}
            isPreviewMode={true}
          />
        </div>
      </div>
    </PageWrapper>
  );
}
