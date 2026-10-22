import { Icon } from "~/components/Icon";

import { GlobalSearchResultRow } from "./GlobalSearchResultRow";

import type { GlobalSearchContentNode } from "./globalSearchNodes";
import type { GlobalSearchEntryProps } from "./GlobalSearchResultRow";

export const ArticleEntry = ({
  item,
  onSelect,
  typeLabel,
  isActive,
  showPassage,
}: GlobalSearchEntryProps<GlobalSearchContentNode>) => (
  <GlobalSearchResultRow
    to={`/articles/${item.id}`}
    onSelect={onSelect}
    leading={<Icon name="Articles" className="size-4" />}
    title={item.title}
    typeLabel={typeLabel}
    isActive={isActive}
    showPassage={showPassage}
    matchedAttachmentFileName={item.matchedAttachmentFileName}
    matchedPassage={item.matchedPassage}
  />
);
