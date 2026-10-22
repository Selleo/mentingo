import { Icon } from "~/components/Icon";

import { GlobalSearchResultRow } from "./GlobalSearchResultRow";

import type { GlobalSearchContentNode } from "./globalSearchNodes";
import type { GlobalSearchEntryProps } from "./GlobalSearchResultRow";

export const NewsEntry = ({
  item,
  onSelect,
  typeLabel,
  isActive,
  showPassage,
}: GlobalSearchEntryProps<GlobalSearchContentNode>) => (
  <GlobalSearchResultRow
    to={`/news/${item.id}`}
    onSelect={onSelect}
    leading={<Icon name="News" className="size-4" />}
    title={item.title}
    typeLabel={typeLabel}
    isActive={isActive}
    showPassage={showPassage}
    matchedAttachmentFileName={item.matchedAttachmentFileName}
    matchedPassage={item.matchedPassage}
  />
);
