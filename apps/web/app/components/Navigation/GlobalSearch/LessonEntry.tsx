import { FileText } from "lucide-react";

import { GlobalSearchResultRow } from "./GlobalSearchResultRow";

import type { GlobalSearchLessonNode } from "./globalSearchNodes";
import type { GlobalSearchEntryProps } from "./GlobalSearchResultRow";

export const LessonEntry = ({
  item,
  onSelect,
  typeLabel,
  isActive,
  showPassage,
}: GlobalSearchEntryProps<GlobalSearchLessonNode>) => (
  <GlobalSearchResultRow
    to={`/course/${item.courseId}/lesson/${item.id}`}
    onSelect={onSelect}
    leading={<FileText className="size-4" aria-hidden />}
    title={item.title}
    typeLabel={typeLabel}
    meta={item.chapterTitle}
    isActive={isActive}
    matchedAttachmentFileName={item.matchedAttachmentFileName}
    matchedPassage={item.matchedPassage}
    showPassage={showPassage}
  />
);
