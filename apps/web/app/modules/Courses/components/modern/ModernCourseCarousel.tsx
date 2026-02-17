import { useEffect, useState } from "react";

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

type ModernCourseCarouselProps = {
  title: string;
  courses: CourseCarouselCourse[];
  progressByCourseId?: Record<string, number | undefined>;
};

const ModernCourseCarousel = ({
  title,
  courses,
  progressByCourseId = {},
}: ModernCourseCarouselProps) => {
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const popoutEnabled = courses.length > 1;

  useEffect(() => {
    if (!carouselApi) return;

    const updateScrollState = () => {
      setCanScrollPrev(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
    };

    updateScrollState();
    carouselApi.on("select", updateScrollState);
    carouselApi.on("reInit", updateScrollState);

    return () => {
      carouselApi.off("select", updateScrollState);
      carouselApi.off("reInit", updateScrollState);
    };
  }, [carouselApi]);

  if (!courses?.length) return null;

  return (
    <section className="space-y-4 pb-6">
      <h2 className="h2 px-4 md:px-8">{title}</h2>

      <div className="group relative px-4 md:px-8 mt-10">
        <Carousel
          opts={{ align: "start", slidesToScroll: 1, skipSnaps: false }}
          setApi={setCarouselApi}
        >
          <CarouselContent className="gap-4">
            {courses.map((course) => (
              <CarouselItem
                key={course.id}
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
                  popoutEnabled={popoutEnabled}
                />
              </CarouselItem>
            ))}
          </CarouselContent>

          {canScrollPrev && (
            <CarouselPrevious
              iconSize={24}
              className="absolute left-2 top-1/2 border-none flex h-[52px] w-[52px] -translate-y-1/2 items-center justify-center rounded-full bg-black/70 shadow-lg transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:opacity-0 md:group-hover:opacity-100 bg-white hover:border-none duration-200"
            />
          )}
          {canScrollNext && (
            <CarouselNext
              iconSize={24}
              className="absolute right-2 top-1/2 border-none flex h-[52px] w-[52px] -translate-y-1/2 items-center justify-center rounded-full bg-black/70 shadow-lg transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:opacity-0 md:group-hover:opacity-100 bg-white hover:border-none duration-200"
            />
          )}
        </Carousel>
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

export default ModernCourseCarousel;
