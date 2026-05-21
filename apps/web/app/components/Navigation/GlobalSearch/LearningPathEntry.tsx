import { Link } from "@remix-run/react";
import { BookOpen } from "lucide-react";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";

import type { GetLearningPathsResponse } from "~/api/generated-api";

export const LearningPathEntry = ({
  item,
  onSelect,
}: {
  item: GetLearningPathsResponse["data"][number];
  onSelect: () => void;
}) => {
  const searchParams = new URLSearchParams({ searchQuery: item.title });

  return (
    <Link
      to={`/learning-paths?${searchParams.toString()}`}
      onClick={onSelect}
      className="group focus:outline-none focus-visible:outline-none"
    >
      <li className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-neutral-900 hover:bg-primary-50 group-focus:bg-primary-100">
        <img
          src={item.thumbnailReference || DefaultPhotoCourse}
          alt={item.title}
          className="size-4 rounded-sm bg-[#D9D9D9] object-cover"
          onError={(event) => {
            event.currentTarget.src = DefaultPhotoCourse;
          }}
        />
        <span className="line-clamp-1 flex-1 body-sm-md">{item.title}</span>
        <span className="flex items-center gap-1 ps-3 details-md text-neutral-600">
          <BookOpen className="size-3.5" />
          {item.courses.length}
        </span>
      </li>
    </Link>
  );
};
