import { createSearchParams } from "@remix-run/react";
import { HelpCircle } from "lucide-react";

import { GlobalSearchResultRow } from "./GlobalSearchResultRow";

import type { GlobalSearchContentNode } from "./globalSearchNodes";
import type { GlobalSearchEntryProps } from "./GlobalSearchResultRow";

export const QAEntry = ({
  item,
  onSelect,
  typeLabel,
  isActive,
  showPassage,
}: GlobalSearchEntryProps<GlobalSearchContentNode>) => (
  <GlobalSearchResultRow
    to={{ pathname: "/qa", search: `?${createSearchParams({ qaId: item.id })}` }}
    onSelect={onSelect}
    leading={<HelpCircle className="size-4" aria-hidden />}
    title={item.title}
    typeLabel={typeLabel}
    isActive={isActive}
    showPassage={showPassage}
    matchedAttachmentFileName={item.matchedAttachmentFileName}
    matchedPassage={item.matchedPassage}
  />
);
