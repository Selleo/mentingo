import { Shapes } from "lucide-react";

import { GlobalSearchResultRow } from "./GlobalSearchResultRow";

import type { GlobalSearchEntryProps } from "./GlobalSearchResultRow";
import type { SearchResponse } from "~/api/generated-api";

export const CategoryEntry = ({
  item,
  onSelect,
  typeLabel,
  isActive,
  showPassage,
}: GlobalSearchEntryProps<SearchResponse["data"]["categories"][number]>) => (
  <GlobalSearchResultRow
    to={`/admin/categories/${item.id}`}
    onSelect={onSelect}
    leading={<Shapes className="size-4" aria-hidden />}
    title={item.title}
    typeLabel={typeLabel}
    isActive={isActive}
    showPassage={showPassage}
  />
);
