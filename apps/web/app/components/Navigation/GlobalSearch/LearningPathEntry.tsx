import { BookOpen } from "lucide-react";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";

import { GlobalSearchResultRow } from "./GlobalSearchResultRow";

import type { GlobalSearchLearningPathNode } from "./globalSearchNodes";
import type { GlobalSearchEntryProps } from "./GlobalSearchResultRow";

export const LearningPathEntry = ({
  item,
  onSelect,
  typeLabel,
  isActive,
  showPassage,
}: GlobalSearchEntryProps<GlobalSearchLearningPathNode>) => {
  const searchParams = new URLSearchParams({ searchQuery: item.title });

  return (
    <GlobalSearchResultRow
      to={`/development-paths?${searchParams.toString()}`}
      onSelect={onSelect}
      leading={
        <img
          src={item.thumbnailUrl || DefaultPhotoCourse}
          alt=""
          className="size-full object-cover"
          onError={(event) => {
            event.currentTarget.src = DefaultPhotoCourse;
          }}
        />
      }
      title={item.title}
      typeLabel={typeLabel}
      meta={
        <>
          <BookOpen className="size-3" aria-hidden />
          {item.courseCount}
        </>
      }
      isActive={isActive}
      matchedAttachmentFileName={item.matchedAttachmentFileName}
      matchedPassage={item.matchedPassage}
      showPassage={showPassage}
    />
  );
};
