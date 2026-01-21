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
      className="space-y-4 overflow-visible"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">{title}</h2>

      <div className="group relative">
        <Carousel
          opts={{ align: "start", slidesToScroll: 1, skipSnaps: false }}
          setApi={setCarouselApi}
        >
          <CarouselContent
            viewportClassName="overflow-visible"
            className="gap-3 px-2 pb-6 pt-10 md:gap-4 md:px-4 md:pt-12"
          >
            {courses.map((course) => (
              <CarouselItem
                key={course.id}
                className="basis-[85%] sm:basis-[55%] md:basis-[50%] lg:basis-[28.5%] xl:basis-[28.5%]"
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
      </div>
    </section>
  );
};

export default ModernCourseCarousel;
