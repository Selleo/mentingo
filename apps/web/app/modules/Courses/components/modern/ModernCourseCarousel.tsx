import { memo, type Ref, useCallback, useEffect, useRef, useState } from "react";

import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";

import ModernCourseCard from "./ModernCourseCard";

import type { GetAvailableCoursesResponse, GetStudentCoursesResponse } from "~/api/generated-api";

type CourseCarouselCourse =
  | GetAvailableCoursesResponse["data"][number]
  | GetStudentCoursesResponse["data"][number];

const WATCHED_SLIDE_INTERSECTION_THRESHOLD = 0.25;
const WATCHED_SLIDE_FALLBACK_DELAY_MS = 400;
const CAROUSEL_OPTIONS = { align: "start" as const, slidesToScroll: 1, skipSnaps: false };

type ModernCourseCarouselProps = {
  title: string;
  courses: CourseCarouselCourse[];
  progressByCourseId?: Record<string, number | undefined>;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  watchSlideIndex?: number;
  onWatchedSlideVisible?: (index: number) => void;
  rowRef?: Ref<HTMLElement>;
};

const ModernCourseCarousel = ({
  title,
  courses,
  progressByCourseId = {},
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
  watchSlideIndex,
  onWatchedSlideVisible,
  rowRef,
}: ModernCourseCarouselProps) => {
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const watchedSlideRef = useRef<HTMLDivElement | null>(null);
  const pendingWatchedSlideIndexRef = useRef<number | null>(null);
  const pendingWatchedSlideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingWatchedSlideTimeout = useCallback(() => {
    if (!pendingWatchedSlideTimeoutRef.current) return;

    clearTimeout(pendingWatchedSlideTimeoutRef.current);
    pendingWatchedSlideTimeoutRef.current = null;
  }, []);

  const flushPendingWatchedSlide = useCallback(() => {
    const pendingWatchedSlideIndex = pendingWatchedSlideIndexRef.current;
    if (pendingWatchedSlideIndex === null) return;

    clearPendingWatchedSlideTimeout();
    pendingWatchedSlideIndexRef.current = null;
    onWatchedSlideVisible?.(pendingWatchedSlideIndex);
  }, [clearPendingWatchedSlideTimeout, onWatchedSlideVisible]);

  const queueWatchedSlide = useCallback(
    (slideIndex: number) => {
      pendingWatchedSlideIndexRef.current = slideIndex;
      if (pendingWatchedSlideTimeoutRef.current) return;

      pendingWatchedSlideTimeoutRef.current = setTimeout(
        flushPendingWatchedSlide,
        WATCHED_SLIDE_FALLBACK_DELAY_MS,
      );
    },
    [flushPendingWatchedSlide],
  );

  useEffect(() => {
    if (!carouselApi) return;

    const updateScrollState = () => {
      const nextCanScrollPrev = carouselApi.canScrollPrev();
      const nextCanScrollNext = carouselApi.canScrollNext();

      setCanScrollPrev(nextCanScrollPrev);
      setCanScrollNext(nextCanScrollNext);

      return nextCanScrollNext;
    };

    const fetchNextPageAtEnd = (nextCanScrollNext: boolean) => {
      if (onWatchedSlideVisible) return;
      if (nextCanScrollNext) return;
      if (!hasNextPage || isFetchingNextPage || !fetchNextPage) return;

      fetchNextPage();
    };

    updateScrollState();
    const handleSelect = () => updateScrollState();
    const handleSettle = () => {
      fetchNextPageAtEnd(updateScrollState());
      flushPendingWatchedSlide();
    };
    const handleReInit = () => updateScrollState();

    carouselApi.on("select", handleSelect);
    carouselApi.on("settle", handleSettle);
    carouselApi.on("reInit", handleReInit);

    return () => {
      carouselApi.off("select", handleSelect);
      carouselApi.off("settle", handleSettle);
      carouselApi.off("reInit", handleReInit);
      clearPendingWatchedSlideTimeout();
    };
  }, [
    carouselApi,
    clearPendingWatchedSlideTimeout,
    fetchNextPage,
    flushPendingWatchedSlide,
    hasNextPage,
    isFetchingNextPage,
    onWatchedSlideVisible,
  ]);

  useEffect(() => {
    const viewportNode = viewportRef.current;
    const watchedSlideNode = watchedSlideRef.current;

    if (watchSlideIndex === undefined || !onWatchedSlideVisible) return;
    if (!viewportNode || !watchedSlideNode) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        if (entry.intersectionRatio < WATCHED_SLIDE_INTERSECTION_THRESHOLD) return;

        queueWatchedSlide(watchSlideIndex);
      },
      {
        root: viewportNode,
        threshold: WATCHED_SLIDE_INTERSECTION_THRESHOLD,
      },
    );

    observer.observe(watchedSlideNode);

    return () => {
      observer.disconnect();
      clearPendingWatchedSlideTimeout();
    };
  }, [
    clearPendingWatchedSlideTimeout,
    courses.length,
    onWatchedSlideVisible,
    queueWatchedSlide,
    watchSlideIndex,
  ]);

  if (!courses.length) return null;

  return (
    <section ref={rowRef} className="space-y-4 pb-6">
      <h2 className="h2 px-4 md:px-8">{title}</h2>

      <div className="group relative px-4 md:px-8 mt-10" data-course-row data-testid="course-row">
        <Carousel opts={CAROUSEL_OPTIONS} setApi={setCarouselApi}>
          <CarouselContent className="gap-4" viewportRef={viewportRef}>
            {courses.map((course, index) => (
              <CarouselItem
                key={course.id}
                ref={index === watchSlideIndex ? watchedSlideRef : undefined}
                className="w-[320px] md:w-[380px] lg:w-[400px] !basis-auto"
              >
                <ModernCourseCard
                  id={course.id}
                  title={course.title}
                  description={course.description}
                  thumbnailUrl={course.thumbnailUrl}
                  trailerUrl={course.trailerUrl}
                  estimatedDurationMinutes={course.estimatedDurationMinutes}
                  lessonCount={course.lessonCount}
                  progressPercent={progressByCourseId[course.id]}
                  category={course.category}
                  className="w-[320px] max-w-none md:w-[380px] lg:w-[400px]"
                  enrolled={course.enrolled}
                  hasFreeChapters={course.hasFreeChapters}
                  dueDate={course.dueDate ? new Date(course.dueDate) : null}
                />
              </CarouselItem>
            ))}
          </CarouselContent>

          {canScrollPrev && (
            <CarouselPrevious
              iconSize={24}
              className=" left-2 absolute top-1/2 z-[160] border-none flex size-[52px] -translate-y-1/2 items-center justify-center rounded-full bg-black/70 shadow-lg transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:opacity-0 md:group-hover:opacity-100 bg-white hover:border-none duration-200"
            />
          )}
          {canScrollNext && (
            <CarouselNext
              iconSize={24}
              className="right-2 absolute top-1/2 z-[160] border-none flex size-[52px] -translate-y-1/2 items-center justify-center rounded-full bg-black/70 shadow-lg transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:opacity-0 md:group-hover:opacity-100 bg-white hover:border-none duration-200"
            />
          )}
        </Carousel>
        {canScrollPrev && (
          <div
            aria-hidden
            data-testid="course-row-arrow-block-left"
            className="absolute inset-y-0 left-0 z-[140] w-28 pointer-events-auto"
          />
        )}
        {canScrollNext && (
          <div
            aria-hidden
            data-testid="course-row-arrow-block-right"
            className="absolute inset-y-0 right-0 z-[140] w-28 pointer-events-auto"
          />
        )}
        {canScrollPrev && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="h-full w-full bg-gradient-to-r from-white via-white/80 to-white/0" />
          </div>
        )}
        {canScrollNext && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="h-full w-full bg-gradient-to-l from-white via-white/80 to-white/0" />
          </div>
        )}
      </div>
    </section>
  );
};

export default memo(ModernCourseCarousel);
