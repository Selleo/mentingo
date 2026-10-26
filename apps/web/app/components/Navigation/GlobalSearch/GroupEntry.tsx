import { UsersRound } from "lucide-react";

import { GlobalSearchResultRow } from "./GlobalSearchResultRow";

import type { GlobalSearchEntryProps } from "./GlobalSearchResultRow";
import type { SearchResponse } from "~/api/generated-api";

export const GroupEntry = ({
  item,
  onSelect,
  typeLabel,
  isActive,
  showPassage,
}: GlobalSearchEntryProps<SearchResponse["data"]["groups"][number]>) => (
  <GlobalSearchResultRow
    to={`/admin/groups/${item.id}`}
    onSelect={onSelect}
    leading={<UsersRound className="size-4" aria-hidden />}
    title={item.name}
    typeLabel={typeLabel}
    isActive={isActive}
    showPassage={showPassage}
  />
);
