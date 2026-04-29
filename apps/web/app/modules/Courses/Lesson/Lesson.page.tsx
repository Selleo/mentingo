import { useNavigate, useParams, useSearchParams } from "@remix-run/react";
import { VIDEO_AUTOPLAY } from "@repo/shared";
import { first, get, last, orderBy } from "lodash-es";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCourse, useCurrentUser, useLesson } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { Icon } from "~/components/Icon";
import { LoaderWithTextSequence } from "~/components/LoaderWithTextSequence";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { getNextVideoUrl } from "~/components/VideoPlayer/autoplayFlow";
import { useVideoPlayer } from "~/components/VideoPlayer/VideoPlayerContext";
import { useLearningTimeTracker } from "~/hooks/useLearningTimeTracker";
import { cn } from "~/lib/utils";
import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";
import Loader from "~/modules/common/Loader/Loader";
import { useVideoPreferencesStore } from "~/modules/common/store/useVideoPreferencesStore";
import { CourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import {
  fetchCourseTakeaway,
  getCourseTakeawayLocalFallback,
  saveCourseTakeaway,
} from "~/modules/Courses/learning/courseTakeaway";
import { saveCourseResumeProgress } from "~/modules/Courses/learning/resumeProgress";
import { LearningModeBanner } from "~/modules/Courses/Lesson/LearningModeBanner";
import { LessonContent } from "~/modules/Courses/Lesson/LessonContent";
import { LessonSidebar } from "~/modules/Courses/Lesson/LessonSidebar";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";
import type { GetCourseResponse } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.lesson");

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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { courseId = "", lessonId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const { language } = useLanguageStore();
  const { data: user } = useCurrentUser();

  const [error, setError] = useState(false);
  const isFocusMode = searchParams.get("focus") === "1";
  const focusSearch = isFocusMode ? `?${new URLSearchParams({ focus: "1" }).toString()}` : "";
  const [takeaway, setTakeaway] = useState("");

  const {
    data: lesson,
    isFetching: lessonLoading,
    isError: lessonError,
  } = useLesson(lessonId, language, user?.id || "");
  const { data: course } = useCourse(courseId, language);

  useLearningTimeTracker({
    lessonId,
    courseId,
    enabled: !!lesson && !!course,
  });

  const { state, clearVideo } = useVideoPlayer();

  const { autoplay, setAutoplaySettings, autoplaySettings } = useVideoPreferencesStore();
  const lessonType = lesson?.type;
  const lessonHasAutoplayTrigger = lesson?.hasAutoplayTrigger;

  useEffect(() => {
    setAutoplaySettings({ currentAction: VIDEO_AUTOPLAY.NO_AUTOPLAY, nextVideoUrl: undefined });
  }, [lessonId, setAutoplaySettings]);

  useEffect(() => {
    setAutoplaySettings({
      currentAction: autoplaySettings.currentAction,
      nextVideoUrl: getNextVideoUrl({
        videos: lesson?.videos,
        currentUrl: state.currentUrl,
        index: state.index,
      }),
    });
  }, [
    state.currentUrl,
    state.index,
    setAutoplaySettings,
    autoplaySettings.currentAction,
    lesson?.videos,
  ]);

  useEffect(() => {
    if (!lessonType) return;

    if (lessonType !== "content") {
      clearVideo();
      return;
    }

    if (!autoplay) {
      clearVideo();
      return;
    }

    if (!lessonHasAutoplayTrigger) {
      clearVideo();
    }
  }, [lessonId, lessonType, lessonHasAutoplayTrigger, autoplay, clearVideo]);

  useEffect(() => {
    if (lessonError) {
      setError(true);
    }
  }, [lessonError]);

  useEffect(() => {
    if (!course?.id || !lessonId) return;

    const chapterId =
      course.chapters.find((chapter) => chapter?.lessons.some((l) => l.id === lessonId))?.id ??
      undefined;

    saveCourseResumeProgress({
      userId: user?.id,
      courseId: course.id,
      lessonId,
      chapterId,
    });
  }, [course?.id, course?.chapters, lessonId, user?.id]);

  useEffect(() => {
    if (!course?.id) return;

    setTakeaway(getCourseTakeawayLocalFallback({ userId: user?.id, courseId: course.id }));

    let cancelled = false;
    void fetchCourseTakeaway({ courseId: course.id })
      .then((content) => {
        if (cancelled) return;
        setTakeaway(content);
      })
      .catch(() => {
        // keep local fallback
      });

    return () => {
      cancelled = true;
    };
  }, [course?.id, user?.id]);

  useEffect(() => {
    if (!isFocusMode) return;
    if (!course?.id) return;

    const timer = window.setTimeout(() => {
      void saveCourseTakeaway({ userId: user?.id, courseId: course.id, value: takeaway }).catch(() => {
        // local cache still persists
      });
    }, 800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [course?.id, isFocusMode, takeaway, user?.id]);

  if (error) {
    return (
      <ErrorPage
        title={t("studentLessonView.error.notAuthorizedTitle")}
        description={t("studentLessonView.error.notAuthorizedDescription")}
        actionLabel={t("studentLessonView.error.goBackToCourse")}
        to={`/course/${courseId}`}
      />
    );
  }

  if (!lesson || !course) {
    const targetLessonType = course?.chapters
      .flatMap((chapter) => chapter.lessons)
      .find((courseLesson) => courseLesson.id === lessonId)?.type;

    return (
      <div className="fixed inset-0 grid place-items-center">
        {targetLessonType === LessonType.AI_MENTOR ? (
          <LoaderWithTextSequence preset="aiMentor" />
        ) : (
          <Loader />
        )}
      </div>
    );
  }

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
      navigate(`/course/${courseId}${focusSearch}`);
      return;
    }

    for (const chapter of chapters) {
      const lessonIndex = findCurrentLessonIndex(chapter.lessons, currentLessonId);
      if (lessonIndex !== -1) {
        if (lessonIndex + 1 < chapter.lessons.length) {
          const nextLessonId = chapter.lessons[lessonIndex + 1].id;
          queryClient.invalidateQueries({ queryKey: ["course", { id: courseId }] });
          navigate(`/course/${courseId}/lesson/${nextLessonId}${focusSearch}`, {
            state: { chapterId: chapter.id },
          });
        } else {
          const currentChapterIndex = chapters.indexOf(chapter);
          if (currentChapterIndex + 1 < chapters.length) {
            const nextLessonId = chapters[currentChapterIndex + 1].lessons[0].id;
            queryClient.invalidateQueries({ queryKey: ["course", { id: courseId }] });
            navigate(`/course/${courseId}/lesson/${nextLessonId}${focusSearch}`, {
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
          navigate(`/course/${courseId}/lesson/${prevLessonId}${focusSearch}`, {
            state: { chapterId: chapter.id },
          });
        } else {
          const currentChapterIndex = chapters.indexOf(chapter);
          if (currentChapterIndex > 0) {
            const prevChapter = chapters[currentChapterIndex - 1];
            const prevLessonId = prevChapter.lessons[prevChapter.lessons.length - 1].id;

            navigate(`/course/${courseId}/lesson/${prevLessonId}${focusSearch}`, {
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
      title: t("studentCoursesView.breadcrumbs.courses"),
      href: "/courses",
    },
    { title: course.title, href: `/course/${courseId}` },
    {
      title: currentChapter?.title ?? t("studentLessonView.other.chapter"),
      href: `/course/${courseId}/lesson/${lessonId}`,
    },
  ];

  return (
    <CourseAccessProvider course={course}>
      <PageWrapper
        className={cn("h-auto", isFocusMode && "p-4 md:p-6 3xl:p-8")}
        breadcrumbs={isFocusMode ? undefined : breadcrumbs}
        aboveBreadcrumbs={isFocusMode ? null : <LearningModeBanner />}
        isBarebones={isFocusMode}
      >
        <div className="flex w-full max-w-full flex-col gap-6">
          <div
            className={cn(
              "flex w-full max-w-full flex-col gap-6 lg:items-start",
              !isFocusMode && "lg:grid lg:grid-cols-[1fr_480px]",
            )}
          >
            <div className="flex w-full min-w-0 flex-col divide-y rounded-lg bg-white">
              <div className="flex items-center justify-between gap-4 p-6 sm:px-10 3xl:px-8">
                <p className="h6 text-neutral-950">
                  <span className="text-neutral-800">
                    {t("studentLessonView.other.chapter")} {currentChapter?.displayOrder}:
                  </span>{" "}
                  {currentChapter?.title}
                </p>
                <Button
                  type="button"
                  variant={isFocusMode ? "primary" : "outline"}
                  className="shrink-0 flex items-center gap-2"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    if (isFocusMode) next.delete("focus");
                    else next.set("focus", "1");
                    setSearchParams(next, { replace: true });
                  }}
                >
                  <Icon name={isFocusMode ? "X" : "Target"} className="size-4" />
                  {isFocusMode
                    ? t("common.actions.exitFocusMode", { defaultValue: "Wyjdź z trybu skupienia" })
                    : t("common.actions.enterFocusMode", {
                        defaultValue: "Wejdź w tryb skupienia",
                      })}
                </Button>
              </div>
              {isFocusMode && (
                <div className="border-b border-neutral-200 px-6 py-4 sm:px-10 3xl:px-8">
                  <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
                    <p className="body-sm-md text-neutral-950">
                      {t("studentCourseView.takeaway.title", {
                        defaultValue: "Co wyniosłeś dotychczas z kursu",
                      })}
                    </p>
                    <p className="mt-1 text-xs text-neutral-700">
                      {t("studentCourseView.takeaway.subtitle", {
                        defaultValue:
                          "Zapisuj własnymi słowami wnioski i notatki. Możesz używać Markdown. Autosave do bazy.",
                      })}
                    </p>
                    <textarea
                      className="mt-3 w-full min-h-28 rounded-md border border-primary-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:ring-2 focus:ring-primary-300"
                      value={takeaway}
                      onChange={(e) => setTakeaway(e.target.value)}
                      placeholder={t("studentCourseView.takeaway.placeholder", {
                        defaultValue:
                          "Np.\n- 3 najważniejsze rzeczy…\n- co wdrażam od jutra…\n- pytania do wyjaśnienia…",
                      })}
                    />
                  </div>
                </div>
              )}
              <LessonContent
                lesson={lesson}
                course={course}
                lessonsAmount={currentChapter?.lessons.length ?? 0}
                handlePrevious={() => handlePrevLesson(lessonId, course.chapters)}
                handleNext={() => handleNextLesson(lessonId, course.chapters)}
                isFirstLesson={isFirst}
                isLastLesson={isLast}
                lessonLoading={lessonLoading}
              />
            </div>
            {!isFocusMode && <LessonSidebar course={course} lessonId={lessonId} />}
          </div>
        </div>
      </PageWrapper>
    </CourseAccessProvider>
  );
}
