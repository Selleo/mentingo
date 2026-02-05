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

import type { GetTopCoursesResponse } from "~/api/generated-api";

type TopCoursesCarouselProps = {
  courses: GetTopCoursesResponse["data"];
};

const TopCoursesCarousel = ({ courses }: TopCoursesCarouselProps) => {
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

  const renderRank = (rank: number) => (
    <div className="pointer-events-none absolute -left-20 top-3 h-52 w-32">
      <svg className="h-full w-full" viewBox="0 0 160 190" fill="none">
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-zinc-200 stroke-zinc-300"
          style={{
            fontSize: "230px",
            fontWeight: "900",
            strokeWidth: "2px",
          }}
        >
          {rank}
        </text>
      </svg>
    </div>
  );

  return (
    <section className="relative group px-4 md:px-8 pb-6">
      <Carousel
        opts={{ align: "start", slidesToScroll: 1, skipSnaps: false }}
        setApi={setCarouselApi}
      >
        <CarouselContent className="gap-24 px-4 mt-4 md:px-8 ml-20">
          {courses.map((course, index) => (
            <CarouselItem
              key={course.id}
              className="w-[360px] md:w-[420px] lg:w-[440px] !basis-auto"
            >
              <div className="relative pl-6">
                {renderRank(index + 1)}
                <ModernCourseCard
                  id={course.id}
                  title={course.title}
                  description={course.description}
                  thumbnailUrl={course.thumbnailUrl}
                  trailerUrl={course.trailerUrl}
                  estimatedDurationMinutes={course.estimatedDurationMinutes}
                  lessonCount={course.lessonCount}
                  category={course.category}
                  className="w-[320px] max-w-none md:w-[380px] lg:w-[400px]"
                  enrolled={course.enrolled}
                  hasFreeChapters={course.hasFreeChapters}
                  dueDate={course.dueDate ? new Date(course.dueDate) : null}
                  popoutEnabled={popoutEnabled}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {canScrollPrev && (
          <CarouselPrevious
            iconSize={24}
            className="absolute left-2 top-1/2 z-[150] border-none flex h-[52px] w-[52px] -translate-y-1/2 items-center justify-center rounded-full bg-black/70 shadow-lg transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:opacity-0 md:group-hover:opacity-100 bg-white hover:border-none duration-200"
          />
        )}
        {canScrollNext && (
          <CarouselNext
            iconSize={24}
            className="absolute right-2 top-1/2 z-[150] border-none flex h-[52px] w-[52px] -translate-y-1/2 items-center justify-center rounded-full bg-black/70 shadow-lg transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:opacity-0 md:group-hover:opacity-100 bg-white hover:border-none duration-200"
          />
        )}
      </Carousel>
      {canScrollPrev && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="h-full w-full bg-gradient-to-r from-white via-white/80 to-white/0" />
        </div>
      )}
      {canScrollNext && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="h-full w-full bg-gradient-to-l from-white via-white/80 to-white/0" />
        </div>
      )}
    </section>
  );
};

export default TopCoursesCarousel;
