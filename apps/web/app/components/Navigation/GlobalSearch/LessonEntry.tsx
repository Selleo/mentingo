import { Link } from "@remix-run/react";

import type { GetEnrolledLessonsResponse } from "~/api/generated-api";

export const LessonEntry = ({
  item,
  onSelect,
}: {
  item: GetEnrolledLessonsResponse["data"][number];
  onSelect: () => void;
}) => {
  return (
    <Link
      to={`/course/${item.courseId}/lesson/${item.id}`}
      onClick={onSelect}
      className="group focus:outline-none focus-visible:outline-none"
    >
      <li className="rounded-md px-[8px] py-[6px] text-sm text-neutral-800 hover:bg-primary-50 group-focus:bg-primary-100">
        <span className="line-clamp-1">{item.title}</span>
      </li>
    </Link>
  );
};
