import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";

import TopCourseCard from "./TopCourseCard";

import type { GetTopCoursesResponse } from "~/api/generated-api";

type TopCoursesCarouselProps = {
  courses: GetTopCoursesResponse["data"];
};

const TopCoursesCarousel = ({ courses }: TopCoursesCarouselProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

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
    <section
      className="relative overflow-visible"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Carousel
        opts={{ align: "start", slidesToScroll: 1, skipSnaps: false }}
        setApi={setCarouselApi}
      >
        <CarouselContent
          viewportClassName="overflow-visible"
          className="gap-3 px-2 pb-6 pt-8 md:gap-4 md:px-4 md:pt-10"
        >
          {courses.map((course, index) => (
            <CarouselItem
              key={course.id}
              className="basis-[85%] sm:basis-[55%] md:basis-[50%] lg:basis-[28.5%] xl:basis-[28.5%]"
            >
              <TopCourseCard
                id={course.id}
                rank={index + 1}
                title={course.title}
                thumbnailUrl={course.thumbnailUrl}
                trailerUrl={course.trailerUrl}
                description={course.description}
                estimatedDurationMinutes={course.estimatedDurationMinutes}
                lessonCount={course.lessonCount}
              />
            </CarouselItem>
          ))}
        </CarouselContent>

        {isHovered && (canScrollPrev || canScrollNext) && (
          <>
            <CarouselPrevious className="absolute left-2 top-1/2 z-[150] hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all hover:scale-110 hover:bg-white md:flex md:opacity-0 md:group-hover:opacity-100">
              <ChevronLeft className="size-6 text-gray-900" />
            </CarouselPrevious>
            <CarouselNext className="absolute right-2 top-1/2 z-[150] hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all hover:scale-110 hover:bg-white md:flex md:opacity-0 md:group-hover:opacity-100">
              <ChevronRight className="size-6 text-gray-900" />
            </CarouselNext>
          </>
        )}
      </Carousel>
    </section>
  );
};

export default TopCoursesCarousel;
