import { Link, useNavigate } from "@remix-run/react";
import { BookOpen, Clock, Info, Play } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useEnrollCourse } from "~/api/mutations";
import {
  availableCoursesQueryOptions,
  courseQueryOptions,
  studentCoursesQueryOptions,
  useCourse,
} from "~/api/queries";
import { topCoursesQueryOptions } from "~/api/queries/useTopCourses";
import { queryClient } from "~/api/queryClient";
import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { Button } from "~/components/ui/button";
import { useUserRole } from "~/hooks/useUserRole";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { findFirstInProgressLessonId, findFirstNotStartedLessonId } from "../../Lesson/utils";
import { navigateToNextLesson } from "../../utils/navigateToNextLesson";

import image from "./kurs.jpeg";
import { formatDuration } from "./utils";

type HeroBannerProps = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  trailerUrl?: string | null;
  estimatedDurationMinutes?: number;
  lessonCount?: number;
  courseSlug: string;
};

const HeroBanner = ({
  id,
  title,
  thumbnailUrl,
  trailerUrl,
  estimatedDurationMinutes,
  lessonCount,
  courseSlug,
}: HeroBannerProps) => {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const navigate = useNavigate();

  const { isAdminLike, isStudent } = useUserRole();
  const { mutateAsync: enrollCourse } = useEnrollCourse();

  const durationLabel = formatDuration(estimatedDurationMinutes);
  const lessonsLabel = lessonCount
    ? t("studentCoursesView.modernView.lessonsCount", { count: lessonCount })
    : undefined;

  const { data: heroCourseData } = useCourse(courseSlug, language);
  const hasCourseProgress = useMemo(() => {
    return (
      heroCourseData?.chapters.some(({ completedLessonCount }) => completedLessonCount) || false
    );
  }, [heroCourseData]);
  const notStartedLessonId = heroCourseData ? findFirstNotStartedLessonId(heroCourseData) : null;
  const firstInProgressLessonId = heroCourseData
    ? findFirstInProgressLessonId(heroCourseData)
    : null;

  const handleNavigateToLesson = useCallback(async () => {
    if (!heroCourseData) return;

    if (!heroCourseData.enrolled && isStudent) {
      await enrollCourse(
        { id: heroCourseData.id },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries(courseQueryOptions(heroCourseData.id));
            await queryClient.invalidateQueries(courseQueryOptions(heroCourseData.slug));
            await queryClient.invalidateQueries(topCoursesQueryOptions({ language }));
            await queryClient.invalidateQueries(availableCoursesQueryOptions({ language }));
            await queryClient.invalidateQueries(studentCoursesQueryOptions({ language }));
          },
        },
      );
    }

    navigateToNextLesson(heroCourseData, navigate);
  }, [heroCourseData, navigate, enrollCourse, isStudent, language]);

  return (
    <div className="relative h-[50vh] min-h-[400px] w-full overflow-hidden md:h-[70vh] md:min-h-[500px]">
      <div className="absolute inset-0">
        <img
          // src={thumbnailUrl || DefaultPhotoCourse}
          src={image}
          alt={title}
          className="h-full w-full object-cover"
          onError={(event) => {
            (event.target as HTMLImageElement).src = DefaultPhotoCourse;
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(0deg, #f2f5fc 0%, rgba(242,245,252,0.95) 8%, rgba(242,245,252,0.4) 25%, rgba(242,245,252,0.08) 50%, rgba(242,245,252,0) 75%),
              radial-gradient(80% 70% at 0% 100%, rgba(242,245,252,0.95) 0%, rgba(242,245,252,0.7) 30%, rgba(242,245,252,0.2) 55%, rgba(242,245,252,0) 100%),
              radial-gradient(80% 70% at 100% 100%, rgba(242,245,252,0.95) 0%, rgba(242,245,252,0.7) 30%, rgba(242,245,252,0.2) 55%, rgba(242,245,252,0) 100%)
            `,
          }}
        />
      </div>

      {trailerUrl && (
        <div className="absolute inset-0 z-10 hidden md:block">
          <video
            src={trailerUrl}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-50/95 via-primary-50/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-50/80 via-primary-50/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[50%] bg-gradient-to-t from-primary-50 via-primary-50/60 to-transparent" />
        </div>
      )}

      <div className="relative z-20 flex h-full items-end px-4 pb-12 md:px-8 md:pb-16">
        <div className="max-w-2xl space-y-3 md:space-y-4">
          <h1 className="h1">{title}</h1>

          {(durationLabel || lessonsLabel) && (
            <div className="flex gap-3 font-medium md:gap-4 md:text-sm">
              {durationLabel && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{durationLabel}</span>
                </div>
              )}
              {lessonsLabel && (
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  <span>{lessonsLabel}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1 md:gap-3 md:pt-2">
            <Button onClick={handleNavigateToLesson}>
              <Play className="mr-2 h-4 w-4" fill="currentColor" />
              {t(
                isAdminLike
                  ? "adminCourseView.common.preview"
                  : !hasCourseProgress
                    ? "studentCourseView.sideSection.button.startLearning"
                    : notStartedLessonId || firstInProgressLessonId
                      ? "studentCourseView.sideSection.button.continueLearning"
                      : "studentCourseView.sideSection.button.repeatLessons",
              )}
            </Button>
            <Button asChild variant="outline">
              <Link to={`/course/${id}`}>
                <Info className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">
                  {t("studentCoursesView.modernView.hero.moreInfo")}
                </span>
                <span className="sm:hidden">{t("studentCoursesView.modernView.hero.info")}</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
