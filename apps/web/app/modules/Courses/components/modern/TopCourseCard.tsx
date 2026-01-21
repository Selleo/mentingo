import { Link } from "@remix-run/react";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";

type TopCourseCardProps = {
  id: string;
  rank: number;
  title: string;
  thumbnailUrl?: string | null;
  category: string;
};

const TopCourseCard = ({ id, rank, title, thumbnailUrl, category }: TopCourseCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(false);
  };

  return (
    <Link
      to={`/course/${id}`}
      className="group relative cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative flex items-center gap-2">
        <div className="relative -mr-12 flex-shrink-0">
          <svg className="h-48 w-40" viewBox="0 0 160 190" fill="none">
            <text
              x="50%"
              y="50%"
              dominantBaseline="middle"
              textAnchor="middle"
              className="fill-zinc-200 stroke-zinc-300"
              style={{
                fontSize: "190px",
                fontWeight: "900",
                strokeWidth: "2px",
              }}
            >
              {rank}
            </text>
          </svg>
        </div>

        <div className="relative w-[clamp(240px,70vw,336px)]">
          <div className="aspect-video w-full" />

          <div className="absolute inset-0">
            <div className="relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
              <img
                src={thumbnailUrl || DefaultPhotoCourse}
                alt={title}
                className="h-full w-full object-cover"
                onError={(event) => {
                  (event.target as HTMLImageElement).src = DefaultPhotoCourse;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/100 via-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <h3 className="line-clamp-2 text-sm font-semibold text-white drop-shadow-lg">
                  {title}
                </h3>
              </div>
            </div>
          </div>

          <div
            className="absolute inset-0 transition-all duration-500 ease-out"
            style={{
              opacity: isHovered ? 1 : 0,
              transform: isHovered ? "scale(1.04) translateY(-4%)" : "scale(1)",
              transformOrigin: "center center",
              zIndex: 100,
              pointerEvents: "none",
            }}
          >
            <div
              className={`relative aspect-video overflow-hidden border border-gray-200 bg-white shadow-md transition-all duration-300 ${
                isHovered ? "rounded-t-lg" : "rounded-lg"
              }`}
            >
              <img
                src={thumbnailUrl || DefaultPhotoCourse}
                alt={title}
                className="h-full w-full object-cover"
                onError={(event) => {
                  (event.target as HTMLImageElement).src = DefaultPhotoCourse;
                }}
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/100 via-black/60 to-transparent transition-opacity duration-300"
                style={{ opacity: isHovered ? 0 : 1 }}
              />
              <div
                className="absolute bottom-0 left-0 right-0 p-2.5 transition-opacity duration-300"
                style={{ opacity: isHovered ? 0 : 1 }}
              >
                <h3 className="line-clamp-2 text-sm font-semibold text-white drop-shadow-lg">
                  {title}
                </h3>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-b-lg transition-all duration-300"
              style={{
                maxHeight: isHovered ? "55px" : "0px",
                opacity: isHovered ? 1 : 0,
              }}
            >
              <div className="border border-t-0 border-gray-200 bg-zinc-900 p-2.5 shadow-lg">
                <h3
                  className="line-clamp-1 text-sm font-semibold text-white transition-all duration-300"
                  style={{
                    opacity: isHovered ? 1 : 0,
                    transform: isHovered ? "translateY(0)" : "translateY(-10px)",
                    transitionDelay: "100ms",
                  }}
                >
                  {title}
                </h3>

                <div
                  className="mt-1.5 flex items-center justify-between transition-all duration-300"
                  style={{
                    opacity: isHovered ? 1 : 0,
                    transform: isHovered ? "translateY(0)" : "translateY(-10px)",
                    transitionDelay: "150ms",
                  }}
                >
                  <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-white">
                    {category}
                  </span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                    <Play className="h-2.5 w-2.5 text-black" fill="currentColor" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default TopCourseCard;
