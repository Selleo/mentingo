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
    <section className="space-y-4">
      <h2 className="h2">{title}</h2>

      <div className="group relative">
        <Carousel
          opts={{ align: "start", slidesToScroll: 1, skipSnaps: false }}
          setApi={setCarouselApi}
        >
          <CarouselContent className="gap-4 pb-6 pt-10 max-w-fit">
            {courses.map((course) => (
              <CarouselItem key={course.id} className="w-[320px] md:w-[380px] lg:w-[400px]">
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
                />
              </CarouselItem>
            ))}
          </CarouselContent>

          {canScrollPrev && (
            <CarouselPrevious className="absolute left-0 top-0 bottom-0 z-[150] w-12 -translate-y-0 items-center justify-center bg-gradient-to-r from-black/50 to-transparent transition-opacity duration-300 hover:from-black/70 md:opacity-0 md:group-hover:opacity-100">
              <div className="flex h-full w-full items-center justify-center">
                <ChevronLeft className="size-6 text-white" />
              </div>
            </CarouselPrevious>
          )}
          {canScrollNext && (
            <CarouselNext className="absolute right-0 top-0 bottom-0 z-[150] w-12 -translate-y-0 items-center justify-center bg-gradient-to-l from-black/50 to-transparent transition-opacity duration-300 hover:from-black/70 md:opacity-0 md:group-hover:opacity-100">
              <div className="flex h-full w-full items-center justify-center">
                <ChevronRight className="size-6 text-white" />
              </div>
            </CarouselNext>
          )}
        </Carousel>
      </div>
    </section>
  );
};

export default ModernCourseCarousel;
