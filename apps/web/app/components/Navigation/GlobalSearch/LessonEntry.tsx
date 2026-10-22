import { Link } from "@remix-run/react";

import type { SearchResponse } from "~/api/generated-api";

export const LessonEntry = ({
  item,
  onSelect,
}: {
  item: SearchResponse["data"]["lessons"][number];
  onSelect: () => void;
}) => {
  return (
    <Link
      to={`/course/${item.courseId}/lesson/${item.id}`}
      onClick={onSelect}
      className="group focus:outline-none focus-visible:outline-none"
    >
      <div className="rounded-md px-2 py-1.5 text-sm text-neutral-800 hover:bg-primary-50 group-focus:bg-primary-100">
        <span className="line-clamp-1">{item.title}</span>
      </div>
    </Link>
  );
};
