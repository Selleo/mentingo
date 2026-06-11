import { PERMISSIONS } from "@repo/shared";
import { type Ref, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import {
  useCurrentUser,
  useInfiniteAvailableCourseCategories,
  useInfiniteAvailableCourses,
  useInfiniteStudentCourses,
} from "~/api/queries";
import { useTopCourses } from "~/api/queries/useTopCourses";
import { PageWrapper } from "~/components/PageWrapper";
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import CoursesHeader from "./CoursesHeader";
import HeroBanner from "./HeroBanner";
import HeroBannerSkeleton from "./HeroBannerSkeleton";
import ModernCourseCarousel from "./ModernCourseCarousel";
import ModernCourseRowSkeleton from "./ModernCourseRowSkeleton";
import TopCoursesCarousel from "./TopCoursesCarousel";

import type { GetAllCategoriesResponse } from "~/api/generated-api";

const COURSE_PAGE_SIZE = 5;
const CATEGORY_PAGE_SIZE = 4;

type CategoryCoursesRowProps = {
  category: GetAllCategoriesResponse["data"][number];
  progressByCourseId: Record<string, number | undefined>;
  rowRef?: Ref<HTMLElement>;
};

const CategoryCoursesRow = ({ category, progressByCourseId, rowRef }: CategoryCoursesRowProps) => {
  const { language } = useLanguageStore();
  const prefetchedAfterPageRef = useRef(0);
  const hasNextPageRef = useRef(false);
  const isCoursePageFetchQueuedRef = useRef(false);
  const { data, isLoading, hasNextPage, fetchNextPage } = useInfiniteAvailableCourses(
    {
      category: category.title,
      language,
    },
    COURSE_PAGE_SIZE,
    { notifyOnChangeProps: ["data", "isLoading", "hasNextPage"] },
  );
  const fetchNextPageRef = useRef(fetchNextPage);

  useEffect(() => {
    hasNextPageRef.current = hasNextPage;
    fetchNextPageRef.current = fetchNextPage;
  }, [fetchNextPage, hasNextPage]);

  const courses = useMemo(
    () => data?.pages.flatMap((page) => page.data).filter((course) => !course.enrolled) ?? [],
    [data],
  );
  const loadedCoursePages = data?.pages.length ?? 0;
  const watchedSlideIndex =
    loadedCoursePages > 1 ? (loadedCoursePages - 1) * COURSE_PAGE_SIZE : undefined;

  const prefetchNextPageAfter = useCallback((currentPage: number) => {
    if (prefetchedAfterPageRef.current >= currentPage) return;
    if (!hasNextPageRef.current) return;
    if (isCoursePageFetchQueuedRef.current) return;

    prefetchedAfterPageRef.current = currentPage;
    isCoursePageFetchQueuedRef.current = true;

    requestAnimationFrame(() => {
      void fetchNextPageRef.current().finally(() => {
        isCoursePageFetchQueuedRef.current = false;
      });
    });
  }, []);

  useEffect(() => {
    if (!data?.pages.length) return;

    prefetchNextPageAfter(1);
  }, [data?.pages.length, prefetchNextPageAfter]);

  const handleWatchedSlideVisible = useCallback(
    (slideIndex: number) => {
      const visiblePage = Math.floor(slideIndex / COURSE_PAGE_SIZE) + 1;

      prefetchNextPageAfter(visiblePage);
    },
    [prefetchNextPageAfter],
  );

  if (isLoading) {
    return <ModernCourseRowSkeleton title={category.title} />;
  }

  if (!courses.length) {
    return rowRef ? <div ref={rowRef as Ref<HTMLDivElement>} className="h-px" /> : null;
  }

  return (
    <ModernCourseCarousel
      title={category.title}
      courses={courses}
      progressByCourseId={progressByCourseId}
      watchSlideIndex={watchedSlideIndex}
      onWatchedSlideVisible={handleWatchedSlideVisible}
      rowRef={rowRef}
    />
  );
};

const ModernCoursesView = () => {
  const { t } = useTranslation();

  const { language } = useLanguageStore();
  const { data: currentUser } = useCurrentUser();
  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });

  const { data: availableHeroCoursesData, isLoading: isAvailableHeroCoursesLoading } =
    useInfiniteAvailableCourses(
      {
        language,
        userId: currentUser?.id,
      },
      COURSE_PAGE_SIZE,
    );

  const { data: topCourses, isLoading: isTopCoursesLoading } = useTopCourses({
    limit: 5,
    days: 30,
    language,
  });

  const {
    data: studentCoursesData,
    isLoading: isStudentCoursesLoading,
    hasNextPage: hasNextStudentCoursesPage,
    isFetchingNextPage: isFetchingNextStudentCoursesPage,
    fetchNextPage: fetchNextStudentCoursesPage,
  } = useInfiniteStudentCourses({ language }, COURSE_PAGE_SIZE);

  const {
    data: categoriesData,
    isLoading: isCategoriesLoading,
    hasNextPage: hasNextCategoriesPage,
    isFetchingNextPage: isFetchingNextCategoriesPage,
    fetchNextPage: fetchNextCategoriesPage,
  } = useInfiniteAvailableCourseCategories({ language }, CATEGORY_PAGE_SIZE);

  const categories = useMemo(
    () =>
      categoriesData?.pages
        .flatMap((page) => page.data)
        .sort((a, b) => a.title.localeCompare(b.title)) ?? [],
    [categoriesData],
  );

  const studentCourses = useMemo(
    () => studentCoursesData?.pages.flatMap((page) => page.data) ?? [],
    [studentCoursesData],
  );

  const availableHeroCourses = useMemo(
    () => availableHeroCoursesData?.pages.flatMap((page) => page.data) ?? [],
    [availableHeroCoursesData],
  );

  const progressByCourseId = useMemo(() => {
    if (!studentCourses.length) return {};

    return studentCourses.reduce<Record<string, number | undefined>>((acc, course) => {
      const completed = course.completedChapterCount ?? 0;
      if (course.courseChapterCount > 0) {
        acc[course.id] = Math.round((completed / course.courseChapterCount) * 100);
      }
      return acc;
    }, {});
  }, [studentCourses]);

  const { heroCourse, isHeroLoading } = useMemo(() => {
    const topHero = topCourses?.[0];
    if (topHero) return { heroCourse: topHero, isHeroLoading: false };
    if (isTopCoursesLoading) return { heroCourse: undefined, isHeroLoading: true };

    const availableHero = availableHeroCourses.find((course) => !course.enrolled);
    if (availableHero) return { heroCourse: availableHero, isHeroLoading: false };
    if (isAvailableHeroCoursesLoading) return { heroCourse: undefined, isHeroLoading: true };

    const studentHero = studentCourses?.[0];
    if (studentHero) return { heroCourse: studentHero, isHeroLoading: false };
    if (isStudentCoursesLoading) return { heroCourse: undefined, isHeroLoading: true };

    return { heroCourse: undefined, isHeroLoading: false };
  }, [
    topCourses,
    availableHeroCourses,
    studentCourses,
    isTopCoursesLoading,
    isAvailableHeroCoursesLoading,
    isStudentCoursesLoading,
  ]);

  const categoryObserverRef = useRef<IntersectionObserver | null>(null);
  const isCategoryFetchQueuedRef = useRef(false);
  const lastCategoryRowRef = useCallback(
    (node: HTMLElement | null) => {
      categoryObserverRef.current?.disconnect();
      categoryObserverRef.current = null;

      if (!node) return;
      if (!hasNextCategoriesPage) return;

      categoryObserverRef.current = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          if (entry.intersectionRatio < 0.35) return;
          if (isFetchingNextCategoriesPage) return;
          if (isCategoryFetchQueuedRef.current) return;

          isCategoryFetchQueuedRef.current = true;
          void fetchNextCategoriesPage().finally(() => {
            isCategoryFetchQueuedRef.current = false;
          });
        },
        { threshold: 0.35 },
      );

      categoryObserverRef.current.observe(node);
    },
    [fetchNextCategoriesPage, hasNextCategoriesPage, isFetchingNextCategoriesPage],
  );

  useEffect(() => {
    return () => {
      categoryObserverRef.current?.disconnect();
    };
  }, []);

  const renderCourses = () => {
    if (isHeroLoading && !heroCourse) {
      return (
        <>
          <HeroBannerSkeleton />
          <div className="relative z-30 -mt-8 space-y-3 py-6 pb-12 md:-mt-12 md:py-8 md:pb-8">
            <ModernCourseRowSkeleton />
            {Array.from({ length: CATEGORY_PAGE_SIZE }).map((_, index) => (
              <ModernCourseRowSkeleton key={index} />
            ))}
          </div>
        </>
      );
    }

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

        <div className="relative z-30 -mt-8 space-y-3 py-6 pb-12 md:-mt-12 md:py-8 md:pb-8">
          {match({ hasCourses: studentCourses.length > 0, isLoading: isStudentCoursesLoading })
            .with({ isLoading: true }, () => (
              <ModernCourseRowSkeleton
                title={t("studentCoursesView.modernView.continueLearning")}
              />
            ))
            .with({ hasCourses: true }, () => (
              <ModernCourseCarousel
                title={t("studentCoursesView.modernView.continueLearning")}
                courses={studentCourses}
                progressByCourseId={progressByCourseId}
                hasNextPage={hasNextStudentCoursesPage}
                isFetchingNextPage={isFetchingNextStudentCoursesPage}
                fetchNextPage={() => void fetchNextStudentCoursesPage()}
              />
            ))
            .otherwise(() => null)}

          {topCourses?.length && (
            <section>
              <h2 className="h2 px-4 md:px-8">{t("studentCoursesView.modernView.topCourses")}</h2>
              <TopCoursesCarousel courses={topCourses ?? []} />
            </section>
          )}

          {match({ isLoading: isCategoriesLoading })
            .with({ isLoading: true }, () =>
              Array.from({ length: CATEGORY_PAGE_SIZE }).map((_, index) => (
                <ModernCourseRowSkeleton key={index} />
              )),
            )
            .otherwise(() =>
              categories.map((category, index) => (
                <CategoryCoursesRow
                  key={category.id}
                  category={category}
                  progressByCourseId={progressByCourseId}
                  rowRef={index === categories.length - 1 ? lastCategoryRowRef : undefined}
                />
              )),
            )}

          {isFetchingNextCategoriesPage &&
            Array.from({ length: CATEGORY_PAGE_SIZE }).map((_, index) => (
              <ModernCourseRowSkeleton key={`next-category-skeleton-${index}`} />
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
        {canManageCourses && <CoursesHeader />}

        {renderCourses()}
      </div>
    </PageWrapper>
  );
};

export default ModernCoursesView;
