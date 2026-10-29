import { Link, useNavigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { BookOpen, Clock, Info, Play, Star } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { match, P } from "ts-pattern";

import { useEnrollCourse } from "~/api/mutations";
import {
  availableCoursesQueryOptions,
  courseQueryOptions,
  useCurrentUser,
  studentCoursesQueryOptions,
  useCourse,
} from "~/api/queries";
import { topCoursesQueryOptions } from "~/api/queries/useTopCourses";
import { queryClient } from "~/api/queryClient";
import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { hasPermission } from "~/common/permissions/permission.utils";
import { Button } from "~/components/ui/button";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { resolveCourseExperienceState } from "~/modules/Courses/context/CourseAccessProvider";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { COURSES_INLINE_EDIT_HANDLES } from "../../../../../e2e/data/courses/handles";
import { findFirstInProgressLessonId, findFirstNotStartedLessonId } from "../../Lesson/utils";
import { navigateToNextLesson } from "../../utils/navigateToNextLesson";
import { CourseRepetition } from "../CourseRepetition";

import { HeroTrailerVideo } from "./HeroTrailerVideo";
import { formatDuration } from "./utils";

type HeroBannerProps = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  trailerUrl?: string | null;
  estimatedDurationMinutes?: number;
  lessonCount?: number;
  courseSlug: string;
  onEditFeatured?: () => void;
};

const HeroBanner = ({
  id,
  title,
  thumbnailUrl,
  trailerUrl,
  estimatedDurationMinutes,
  lessonCount,
  courseSlug,
  onEditFeatured,
}: HeroBannerProps) => {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const navigate = useNavigate();

  const { data: currentUser } = useCurrentUser();
  const { hasAccess: canUseLearningMode } = usePermissions({
    required: PERMISSIONS.LEARNING_MODE_USE,
  });
  const { hasAccess: canUpdateLearningProgress } = usePermissions({
    required: PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  });
  const { mutateAsync: enrollCourse } = useEnrollCourse();
  const isGroupManager = hasPermission(
    currentUser?.permissions ?? [],
    PERMISSIONS.MANAGED_GROUP_RESULTS_READ,
  );

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
  const courseExperienceState = useMemo(() => {
    if (!heroCourseData) return null;

    return resolveCourseExperienceState({
      course: heroCourseData,
      forcePreviewMode: false,
      currentUserId: currentUser?.id,
      canUseLearningMode,
      canUpdateLearningProgress,
      activeLearningModeCourseIds: currentUser?.studentModeCourseIds ?? [],
    });
  }, [
    heroCourseData,
    currentUser?.id,
    currentUser?.studentModeCourseIds,
    canUseLearningMode,
    canUpdateLearningProgress,
  ]);
  const isPreviewMode = courseExperienceState?.isPreviewMode ?? canUseLearningMode;
  const primaryActionLabel = match({
    isGroupManager,
    isPreviewMode,
    hasCourseProgress,
    hasNextLesson: Boolean(notStartedLessonId || firstInProgressLessonId),
  })
    .with({ isGroupManager: true }, () => "calendarView.details.action.goToCourse")
    .with({ isPreviewMode: true }, () => "adminCourseView.common.preview")
    .with({ hasCourseProgress: false }, () => "studentCourseView.sideSection.button.startLearning")
    .with({ hasNextLesson: true }, () => "studentCourseView.sideSection.button.continueLearning")
    .with(P._, () => "studentCourseView.sideSection.button.repeatLessons")
    .exhaustive();

  const handleNavigateToLesson = useCallback(async () => {
    if (!heroCourseData) return;

    if (isGroupManager) {
      navigate(`/course/${heroCourseData.id}`);
      return;
    }

    const shouldEnrollBeforeNavigation =
      !isPreviewMode && !heroCourseData.enrolled && canUpdateLearningProgress;

    if (shouldEnrollBeforeNavigation) {
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

    navigateToNextLesson(heroCourseData, navigate, {
      openFirstLesson: isPreviewMode || shouldEnrollBeforeNavigation,
    });
  }, [
    heroCourseData,
    isGroupManager,
    isPreviewMode,
    navigate,
    enrollCourse,
    canUpdateLearningProgress,
    language,
  ]);

  return (
    <section className="group/hero relative w-full bg-primary-50 md:h-[70vh] md:min-h-[500px] md:overflow-hidden">
      <div className="relative aspect-video w-full overflow-hidden bg-primary-200 md:absolute md:inset-0 md:aspect-auto">
        <img
          src={thumbnailUrl || DefaultPhotoCourse}
          alt={title}
          className="h-full w-full object-cover"
          onError={(event) => {
            (event.target as HTMLImageElement).src = DefaultPhotoCourse;
          }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-1/2 w-full md:inset-x-0 md:top-0 md:-bottom-0.5 md:h-auto"
          style={{
            backgroundImage: `
              linear-gradient(0deg, var(--primary-50) 0%, color-mix(in srgb, var(--primary-50) 72%, var(--primary-200)) 8%, color-mix(in srgb, var(--primary-200) 24%, transparent) 25%, color-mix(in srgb, var(--primary-200) 5%, transparent) 50%, transparent 75%),
              radial-gradient(80% 70% at 0% 100%, var(--primary-50) 0%, color-mix(in srgb, var(--primary-200) 42%, transparent) 30%, color-mix(in srgb, var(--primary-200) 12%, transparent) 55%, transparent 100%),
              radial-gradient(80% 70% at 100% 100%, var(--primary-50) 0%, color-mix(in srgb, var(--primary-200) 42%, transparent) 30%, color-mix(in srgb, var(--primary-200) 12%, transparent) 55%, transparent 100%)
            `,
          }}
        />
      </div>

      {trailerUrl && (
        <div className="absolute inset-0 z-10 hidden md:block">
          <HeroTrailerVideo src={trailerUrl} />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-200/75 via-primary-200/45 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-200/55 via-primary-200/18 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[50%] bg-gradient-to-t from-primary-50 via-primary-200/32 to-transparent" />
        </div>
      )}

      {onEditFeatured && (
        <button
          type="button"
          onClick={onEditFeatured}
          aria-label={t("studentCoursesView.modernView.featuredCourse.change")}
          className="group/edit absolute inset-0 z-[15] cursor-pointer focus-visible:outline-none"
          data-testid={COURSES_INLINE_EDIT_HANDLES.FEATURED_COURSE_EDIT}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-1 top-0 border-2 border-transparent transition-colors duration-200 group-hover/edit:border-primary-500 group-focus-visible/edit:border-primary-500 md:bottom-8"
          />
          <span className="absolute left-0 top-0 flex items-center gap-1.5 rounded-br-md bg-primary-500 px-2.5 py-1 text-xs font-semibold text-white transition-opacity duration-200 md:opacity-0 md:group-hover/edit:opacity-100 md:group-focus-visible/edit:opacity-100">
            <Star className="size-3" fill="currentColor" aria-hidden="true" />
            {t("studentCoursesView.modernView.featuredCourse.label")}
            <span className="font-normal text-white/80">
              · {t("studentCoursesView.modernView.featuredCourse.clickToChange")}
            </span>
          </span>
        </button>
      )}

      <div
        className={cn(
          "relative z-20 px-4 py-5 md:flex md:h-full md:items-end md:px-8 md:pb-16 md:pt-0",
          { "pointer-events-none": onEditFeatured },
        )}
      >
        <div className="max-w-2xl space-y-3 md:space-y-4">
          <h1 className="h1 -mt-3 text-3xl leading-tight md:mt-0 md:text-4xl md:leading-relaxed">
            {title}
          </h1>

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

          <div className="pointer-events-auto flex flex-wrap gap-2 pt-1 md:gap-3 md:pt-2">
            <Button onClick={handleNavigateToLesson}>
              <Play className="mr-2 h-4 w-4" fill="currentColor" />
              {t(primaryActionLabel)}
            </Button>
            {heroCourseData && !isPreviewMode && !isGroupManager && (
              <CourseRepetition course={heroCourseData} />
            )}
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
    </section>
  );
};

export default HeroBanner;
