import { PERMISSIONS } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { type Ref, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import {
  useCurrentUser,
  courseQueryOptions,
  useInfiniteAvailableCourseCategories,
  useInfiniteAvailableCourses,
  useInfiniteStudentCourses,
} from "~/api/queries";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useTopCourses } from "~/api/queries/useTopCourses";
import { PageWrapper } from "~/components/PageWrapper";
import { usePermissions } from "~/hooks/usePermissions";
import { sumChapterDisplayDurations } from "~/modules/Courses/utils/formatDuration";
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
  userId?: string;
  rowRef?: Ref<HTMLElement>;
};

type HeroCourse = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  trailerUrl?: string | null;
  estimatedDurationMinutes?: number;
  lessonCount?: number;
  slug: string;
};

const CategoryCoursesRow = ({
  category,
  progressByCourseId,
  userId,
  rowRef,
}: CategoryCoursesRowProps) => {
  const { language } = useLanguageStore();
  const prefetchedAfterPageRef = useRef(0);
  const hasNextPageRef = useRef(false);
  const isCoursePageFetchQueuedRef = useRef(false);
  const previousVisibleCourseCountRef = useRef<number | null>(null);
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteAvailableCourses(
      {
        category: category.title,
        language,
        userId,
      },
      COURSE_PAGE_SIZE,
      { notifyOnChangeProps: ["data", "isLoading", "hasNextPage", "isFetchingNextPage"] },
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
  const watchedSlideIndex = loadedCoursePages > 1 ? courses.length - 1 : undefined;

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

  useEffect(() => {
    if (!data?.pages.length) return;

    const previousVisibleCourseCount = previousVisibleCourseCountRef.current;
    previousVisibleCourseCountRef.current = courses.length;

    if (previousVisibleCourseCount === null) return;
    if (courses.length > previousVisibleCourseCount) return;

    prefetchNextPageAfter(loadedCoursePages);
  }, [courses.length, data?.pages.length, loadedCoursePages, prefetchNextPageAfter]);

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
    return rowRef && <div ref={rowRef as Ref<HTMLDivElement>} className="h-px" />;
  }

  return (
    <ModernCourseCarousel
      title={category.title}
      courses={courses}
      progressByCourseId={progressByCourseId}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
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
  const { data: globalSettings } = useGlobalSettings();
  const featuredCourseId = globalSettings?.featuredCourseId ?? null;
  const { data: featuredCourse, isLoading: isFeaturedCourseLoading } = useQuery({
    ...courseQueryOptions(featuredCourseId ?? "", language),
    enabled: Boolean(featuredCourseId),
  });
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
  } = useInfiniteAvailableCourseCategories(
    { language, userId: currentUser?.id },
    CATEGORY_PAGE_SIZE,
  );

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

  const { heroCourse, isHeroLoading } = useMemo<{
    heroCourse?: HeroCourse;
    isHeroLoading: boolean;
  }>(() => {
    if (featuredCourseId) {
      if (featuredCourse) {
        return {
          heroCourse: {
            id: featuredCourse.id,
            title: featuredCourse.title,
            thumbnailUrl: featuredCourse.thumbnailUrl,
            trailerUrl: featuredCourse.trailerUrl,
            estimatedDurationMinutes:
              sumChapterDisplayDurations(
                featuredCourse.chapters.map((chapter) => chapter.estimatedDurationSeconds),
              ) / 60,
            lessonCount: featuredCourse.chapters.reduce(
              (total, chapter) => total + chapter.lessonCount,
              0,
            ),
            slug: featuredCourse.slug,
          },
          isHeroLoading: false,
        };
      }

      if (isFeaturedCourseLoading) return { heroCourse: undefined, isHeroLoading: true };
    }

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
    featuredCourse,
    featuredCourseId,
    isFeaturedCourseLoading,
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
          <div className="relative z-30 space-y-3 py-6 pb-12 md:-mt-12 md:py-8 md:pb-8">
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

        <div className="relative z-30 space-y-3 py-6 pb-12 md:-mt-12 md:py-8 md:pb-8">
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
              <h2 className="h2 px-4 text-2xl leading-snug md:px-8 md:text-[32px] md:leading-relaxed">
                {t("studentCoursesView.modernView.topCourses")}
              </h2>
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
                  userId={currentUser?.id}
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
    <PageWrapper isBarebones className="mb-4 min-h-screen w-full p-0" wrapperClassName="h-full">
      <div className="min-h-screen">
        {canManageCourses && <CoursesHeader />}

        <div className="overflow-x-hidden">{renderCourses()}</div>
      </div>
    </PageWrapper>
  );
};

export default ModernCoursesView;
