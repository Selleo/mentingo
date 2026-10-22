import { GraduationCap } from "lucide-react";

import { SegmentedRing } from "~/assets/svgs";

import { GlobalSearchResultRow } from "./GlobalSearchResultRow";

import type { GlobalSearchCourseNode } from "./globalSearchNodes";
import type { GlobalSearchEntryProps } from "./GlobalSearchResultRow";

export const CourseEntry = ({
  item,
  onSelect,
  typeLabel,
  isActive,
  showPassage,
}: GlobalSearchEntryProps<GlobalSearchCourseNode>) => {
  const courseChapterCount = item.courseChapterCount ?? 0;
  const completedChapterCount = item.completedChapterCount ?? 0;

  return (
    <GlobalSearchResultRow
      to={`/course/${item.id}`}
      onSelect={onSelect}
      leading={
        item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <GraduationCap className="size-4" aria-hidden />
        )
      }
      title={item.title}
      typeLabel={typeLabel}
      meta={
        completedChapterCount > 0 ? (
          <>
            <SegmentedRing
              segments={courseChapterCount}
              completed={completedChapterCount}
              size={12}
            />
            {`${completedChapterCount}/${courseChapterCount}`}
          </>
        ) : (
          item.category
        )
      }
      isActive={isActive}
      matchedAttachmentFileName={item.matchedAttachmentFileName}
      matchedPassage={item.matchedPassage}
      showPassage={showPassage}
    />
  );
};
