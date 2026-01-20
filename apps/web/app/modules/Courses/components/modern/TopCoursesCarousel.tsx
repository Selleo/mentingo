import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import TopCourseCard from "./TopCourseCard";

import type { GetTopCoursesResponse } from "~/api/generated-api";

type TopCoursesCarouselProps = {
  courses: GetTopCoursesResponse["data"];
};

const TopCoursesCarousel = ({ courses }: TopCoursesCarouselProps) => {
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
    <div className="group/carousel relative overflow-visible">
      {showLeftArrow && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-30 hidden w-16 items-center justify-start bg-gradient-to-r from-gray-50 to-transparent pl-2 opacity-0 transition-opacity duration-300 md:flex group-hover/carousel:opacity-100"
          aria-label="Scroll left"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all hover:scale-110 hover:bg-white">
            <ChevronLeft className="h-6 w-6 text-gray-900" />
          </div>
        </button>
      )}

      {showRightArrow && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-30 hidden w-16 items-center justify-end bg-gradient-to-l from-gray-50 to-transparent pr-2 opacity-0 transition-opacity duration-300 md:flex group-hover/carousel:opacity-100"
          aria-label="Scroll right"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all hover:scale-110 hover:bg-white">
            <ChevronRight className="h-6 w-6 text-gray-900" />
          </div>
        </button>
      )}

      <div ref={containerRef} className="scrollbar-hide flex gap-3 overflow-x-auto pb-4 md:gap-6">
        {courses.slice(0, 5).map((course, index) => (
          <TopCourseCard
            key={course.id}
            id={course.id}
            rank={index + 1}
            title={course.title}
            thumbnailUrl={course.thumbnailUrl}
            category={course.category}
          />
        ))}
      </div>
    </div>
  );
};

export default TopCoursesCarousel;
