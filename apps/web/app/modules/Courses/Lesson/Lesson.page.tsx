import { useNavigate, useParams } from "@remix-run/react";
import { first, get, last, orderBy } from "lodash-es";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useCourse, useLesson } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";
import Loader from "~/modules/common/Loader/Loader";
import { LessonContent } from "~/modules/Courses/Lesson/LessonContent";
import { LessonSidebar } from "~/modules/Courses/Lesson/LessonSidebar";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { GetCourseResponse } from "~/api/generated-api";

type Chapters = GetCourseResponse["data"]["chapters"];

const checkOverallLessonPosition = (chapters: Chapters, currentLessonId: string) => {
  const sortedChapters = orderBy(chapters, ["displayOrder"], ["asc"]);

  const firstLesson = get(first(sortedChapters), "lessons[0]");
  const lastChapter = last(sortedChapters);
  const lastLesson = last(get(lastChapter, "lessons", []));

  return {
    isFirst: get(firstLesson, "id") === currentLessonId,
    isLast: get(lastLesson, "id") === currentLessonId,
  };
};

export default function LessonPage() {
  const { courseId = "", lessonId = "" } = useParams();
  const { language } = useLanguageStore();

  const {
    data: lesson,
    isFetching: lessonLoading,
    isError: lessonError,
  } = useLesson(lessonId, language);
  const { data: course } = useCourse(courseId);
  const { isStudent } = useUserRole();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (lessonError) navigate(`/course/${courseId}`);
  }, [lessonError, navigate, courseId]);

  if (!lesson || !course)
    return (
      <div className="fixed inset-0 grid place-items-center">
        <Loader />
      </div>
    );

  const { isFirst, isLast } = checkOverallLessonPosition(course.chapters, lessonId);

  const currentChapter = course.chapters.find((chapter) =>
    chapter?.lessons.some((l) => l.id === lessonId),
  );

  function findCurrentLessonIndex(
    lessons: GetCourseResponse["data"]["chapters"][number]["lessons"],
    currentLessonId: string,
  ) {
    return lessons.findIndex((lesson) => lesson.id === currentLessonId);
  }

  function handleNextLesson(currentLessonId: string, chapters: Chapters) {
    if (isLast) {
      navigate(`/course/${courseId}`);
      return;
    }

    for (const chapter of chapters) {
      const lessonIndex = findCurrentLessonIndex(chapter.lessons, currentLessonId);
      if (lessonIndex !== -1) {
        if (lessonIndex + 1 < chapter.lessons.length) {
          const nextLessonId = chapter.lessons[lessonIndex + 1].id;
          queryClient.invalidateQueries({ queryKey: ["course", { id: courseId }] });
          navigate(`/course/${courseId}/lesson/${nextLessonId}`, {
            state: { chapterId: chapter.id },
          });
        } else {
          const currentChapterIndex = chapters.indexOf(chapter);
          if (currentChapterIndex + 1 < chapters.length) {
            const nextLessonId = chapters[currentChapterIndex + 1].lessons[0].id;
            queryClient.invalidateQueries({ queryKey: ["course", { id: courseId }] });
            navigate(`/course/${courseId}/lesson/${nextLessonId}`, {
              state: { chapterId: chapters[currentChapterIndex + 1].id },
            });
          }
        }
      }
    }

    return null;
  }

  function handlePrevLesson(
    currentLessonId: string,
    chapters: GetCourseResponse["data"]["chapters"],
  ) {
    for (const chapter of chapters) {
      const lessonIndex = findCurrentLessonIndex(chapter.lessons, currentLessonId);
      if (lessonIndex !== -1) {
        if (lessonIndex > 0) {
          const prevLessonId = chapter.lessons[lessonIndex - 1].id;
          navigate(`/course/${courseId}/lesson/${prevLessonId}`, {
            state: { chapterId: chapter.id },
          });
        } else {
          const currentChapterIndex = chapters.indexOf(chapter);
          if (currentChapterIndex > 0) {
            const prevChapter = chapters[currentChapterIndex - 1];
            const prevLessonId = prevChapter.lessons[prevChapter.lessons.length - 1].id;

            navigate(`/course/${courseId}/lesson/${prevLessonId}`, {
              state: { chapterId: prevChapter.id },
            });
          }
        }
      }
    }

    return null;
  }

  const breadcrumbs = [
    {
      title: isStudent
        ? t("studentLessonView.breadcrumbs.yourCourses")
        : t("studentLessonView.breadcrumbs.availableCourses"),
      href: "/courses",
    },
    { title: course.title, href: `/course/${courseId}` },
    {
      title: currentChapter?.title ?? t("studentLessonView.other.chapter"),
      href: `/course/${courseId}/lesson/${lessonId}`,
    },
  ];

  const backButton = {
    title: t("studentLessonView.breadcrumbs.back"),
    href: `/course/${courseId}`,
  };

  return (
    <PageWrapper className="h-auto max-w-full" breadcrumbs={breadcrumbs} backButton={backButton}>
      <div className="flex size-full max-w-full flex-col gap-6 lg:grid lg:grid-cols-[1fr_480px]">
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
            lessonsAmount={currentChapter?.lessons.length ?? 0}
            handlePrevious={() => handlePrevLesson(lessonId, course.chapters)}
            handleNext={() => handleNextLesson(lessonId, course.chapters)}
            isFirstLesson={isFirst}
            isLastLesson={isLast}
            lessonLoading={lessonLoading}
          />
        </div>
        <LessonSidebar course={course} lessonId={lessonId} />
      </div>
    </PageWrapper>
  );
}
