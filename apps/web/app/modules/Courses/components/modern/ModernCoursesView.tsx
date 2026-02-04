import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useAvailableCourses } from "~/api/queries/useAvailableCourses";
import { useStudentCourses } from "~/api/queries/useStudentCourses";
import { useTopCourses } from "~/api/queries/useTopCourses";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";
import Loader from "~/modules/common/Loader/Loader";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import CoursesHeader from "./CoursesHeader";
import HeroBanner from "./HeroBanner";
import ModernCourseCarousel from "./ModernCourseCarousel";
import TopCoursesCarousel from "./TopCoursesCarousel";

import type { GetAvailableCoursesResponse } from "~/api/generated-api";

const ModernCoursesView = () => {
  const { t } = useTranslation();

  const { language } = useLanguageStore();
  const { data: currentUser } = useCurrentUser();
  const { isAdminLike } = useUserRole();

  const { data: availableCourses, isLoading: isAvailableCoursesLoading } = useAvailableCourses({
    language,
    userId: currentUser?.id,
  });

  const { data: topCourses, isLoading: isTopCoursesLoading } = useTopCourses({
    limit: 5,
    days: 30,
    language,
  });

  const { data: studentCourses, isLoading: isStudentCoursesLoading } = useStudentCourses({
    language,
  });

  const progressByCourseId = useMemo(() => {
    if (!studentCourses) return {};

    return studentCourses.reduce<Record<string, number | undefined>>((acc, course) => {
      const completed = course.completedChapterCount ?? 0;
      if (course.courseChapterCount > 0) {
        acc[course.id] = Math.round((completed / course.courseChapterCount) * 100);
      }
      return acc;
    }, {});
  }, [studentCourses]);

  const coursesInProgress = useMemo(() => studentCourses ?? [], [studentCourses]);

  const groupedCourses = useMemo(() => {
    const grouped = new Map<string, GetAvailableCoursesResponse["data"]>();

    (availableCourses || []).forEach((course) => {
      if (course.enrolled) return;
      if (!course.category) return;
      const bucket = grouped.get(course.category) || [];
      bucket.push(course);
      grouped.set(course.category, bucket);
    });

    return Array.from(grouped.entries())
      .map(([category, courses]) => ({
        category,
        courses,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [availableCourses]);

  const heroCourse = topCourses?.[0] ?? availableCourses?.[0] ?? studentCourses?.[0];

  if ((isAvailableCoursesLoading || isTopCoursesLoading) && !heroCourse) {
    return (
      <PageWrapper isBarebones className="w-full p-0">
        <div className="flex h-full min-h-[60vh] items-center justify-center">
          <Loader />
        </div>
      </PageWrapper>
    );
  }

  const renderCourses = () => {
    if (!heroCourse) {
      return (
        <div className="flex min-h-screen items-center justify-center text-neutral-600">
          {t("studentCoursesView.other.cannotFindCourses")}
        </div>
      );
    }

    return (
      <>
        <HeroBanner
          id={heroCourse.id}
          title={heroCourse.title}
          thumbnailUrl={heroCourse.thumbnailUrl}
          trailerUrl={heroCourse.trailerUrl}
          estimatedDurationMinutes={heroCourse.estimatedDurationMinutes}
          lessonCount={heroCourse.lessonCount}
          courseSlug={heroCourse.slug}
        />

        <div className="relative z-30 -mt-8 space-y-4 py-6 pb-12 md:-mt-12 md:py-8 md:pb-8">
          {isStudentCoursesLoading ? (
            <div className="flex h-full items-center justify-center py-6">
              <Loader />
            </div>
          ) : (
            coursesInProgress.length > 0 && (
              <ModernCourseCarousel
                title={t("studentCoursesView.modernView.continueLearning")}
                courses={coursesInProgress}
                progressByCourseId={progressByCourseId}
              />
            )
          )}

          {topCourses?.length ? (
            <section>
              <h2 className="h2 px-4 md:px-8">{t("studentCoursesView.modernView.topCourses")}</h2>
              <TopCoursesCarousel courses={topCourses ?? []} />
            </section>
          ) : null}

          {groupedCourses.map(({ category, courses }) => (
            <ModernCourseCarousel
              key={category}
              title={category}
              courses={courses}
              progressByCourseId={progressByCourseId}
            />
          ))}
        </div>
      </>
    );
  };

  return (
    <PageWrapper
      isBarebones
      className="w-full p-0 mb-4 overflow-x-hidden min-h-screen"
      wrapperClassName="h-full"
    >
      <div className="min-h-screen">
        {isAdminLike && <CoursesHeader />}

        {renderCourses()}
      </div>
    </PageWrapper>
  );
};

export default ModernCoursesView;
