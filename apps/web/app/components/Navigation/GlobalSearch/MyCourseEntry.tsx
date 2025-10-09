import { Link } from "@remix-run/react";

import { SegmentedRing } from "~/assets/svgs";
import { useUserRole } from "~/hooks/useUserRole";

import type { GetStudentCoursesResponse } from "~/api/generated-api";

export const MyCourseEntry = ({
  item,
  onSelect,
}: {
  item: GetStudentCoursesResponse["data"][number];
  onSelect: () => void;
}) => {
  const { isStudent } = useUserRole();

  return (
    <Link
      to={isStudent ? `/course/${item.id}` : `/admin/beta-courses/${item.id}`}
      onClick={onSelect}
      className="group focus:outline-none focus-visible:outline-none"
    >
      <li className="flex items-center gap-3 rounded-md px-[8px] py-[6px] text-sm text-neutral-900 hover:bg-primary-50 group-focus:bg-primary-100">
        <img
          src={item?.thumbnailUrl ?? ""}
          alt={item.title}
          className="size-4 rounded-sm bg-[#D9D9D9]"
        />
        <span className="line-clamp-1 flex-1">{item.title}</span>
        <span className="flex items-center gap-2 ps-3 text-neutral-600">
          <SegmentedRing
            segments={item.courseChapterCount}
            completed={item.completedChapterCount}
            size={16}
          />
          <span className="text-md text-neutral-950">{`${item.completedChapterCount}/${item.courseChapterCount}`}</span>
        </span>
      </li>
    </Link>
  );
};
