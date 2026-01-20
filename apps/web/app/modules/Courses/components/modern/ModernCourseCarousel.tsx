import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const checkScroll = () => {
    if (!containerRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setScrollPosition(scrollLeft);
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    if (!containerRef.current) return;

    const scrollAmount = 500;
    const newPosition =
      direction === "left" ? scrollPosition - scrollAmount : scrollPosition + scrollAmount;

    containerRef.current.scrollTo({
      left: newPosition,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", checkScroll);
    checkScroll();
    window.addEventListener("resize", checkScroll);

    return () => {
      container.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  if (!courses?.length) return null;

  return (
    <section className="relative space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">{title}</h2>
      </div>

      <div className="group relative">
        {showLeftArrow && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 z-[150] hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all hover:scale-110 hover:bg-white md:flex md:opacity-0 md:group-hover:opacity-100"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-6 w-6 text-gray-900" />
          </button>
        )}

        {showRightArrow && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/2 z-[150] hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all hover:scale-110 hover:bg-white md:flex md:opacity-0 md:group-hover:opacity-100"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-6 w-6 text-gray-900" />
          </button>
        )}

        <div
          ref={containerRef}
          className="scrollbar-hide flex gap-3 overflow-x-auto pb-6 pt-4 md:gap-4"
        >
          {courses.map((course) => (
            <div key={course.id} className="flex-[0_0_280px] md:flex-[0_0_380px]">
              <ModernCourseCard
                id={course.id}
                title={course.title}
                thumbnailUrl={course.thumbnailUrl}
                trailerUrl={course.trailerUrl}
                category={course.category}
                estimatedDurationMinutes={course.estimatedDurationMinutes}
                lessonCount={course.lessonCount}
                progressPercent={progressByCourseId[course.id]}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ModernCourseCarousel;
