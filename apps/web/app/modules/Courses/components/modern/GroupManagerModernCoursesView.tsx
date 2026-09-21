import { useTranslation } from "react-i18next";

import { useCoursesSuspense } from "~/api/queries/useCourses";
import { PageWrapper } from "~/components/PageWrapper";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import HeroBanner from "./HeroBanner";
import ModernCourseCarousel from "./ModernCourseCarousel";

const GroupManagerModernCoursesView = () => {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const { data: courses } = useCoursesSuspense({ language });

  const heroCourse = courses[0];

  if (!heroCourse) {
    return (
      <div className="flex min-h-screen items-center justify-center text-neutral-600">
        {t("studentCoursesView.other.cannotFindCourses")}
      </div>
    );
  }

  return (
    <PageWrapper
      isBarebones
      className="w-full p-0 mb-4 overflow-x-hidden min-h-screen"
      wrapperClassName="h-full"
    >
      <div className="min-h-screen">
        <HeroBanner
          id={heroCourse.id}
          title={heroCourse.title}
          thumbnailUrl={heroCourse.thumbnailUrl}
          trailerUrl={heroCourse.trailerUrl}
          estimatedDurationMinutes={heroCourse.estimatedDurationMinutes}
          lessonCount={heroCourse.lessonCount}
          courseSlug={heroCourse.id}
        />

        <div className="relative z-30 space-y-3 py-6 pb-12 md:-mt-12 md:py-8 md:pb-8">
          <ModernCourseCarousel title={t("navigationSideBar.courses")} courses={courses} />
        </div>
      </div>
    </PageWrapper>
  );
};

export default GroupManagerModernCoursesView;
