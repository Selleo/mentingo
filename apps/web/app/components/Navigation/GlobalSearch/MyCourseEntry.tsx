import { Link } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";

import { SegmentedRing } from "~/assets/svgs";
import { usePermissions } from "~/hooks/usePermissions";

import type { SearchResponse } from "~/api/generated-api";

export const MyCourseEntry = ({
  item,
  onSelect,
}: {
  item: SearchResponse["data"]["myCourses"][number];
  onSelect: () => void;
}) => {
  const { hasAccess: canUpdateLearningProgress } = usePermissions({
    required: PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  });
  const courseChapterCount = item.courseChapterCount ?? 0;
  const completedChapterCount = item.completedChapterCount ?? 0;

  return (
    <Link
      to={canUpdateLearningProgress ? `/course/${item.id}` : `/admin/beta-courses/${item.id}`}
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
            segments={courseChapterCount}
            completed={completedChapterCount}
            size={16}
          />
          <span className="text-md text-neutral-950">{`${completedChapterCount}/${courseChapterCount}`}</span>
        </span>
      </li>
    </Link>
  );
};
