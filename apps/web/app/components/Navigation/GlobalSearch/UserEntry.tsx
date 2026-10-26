import { toLower, upperFirst } from "lodash-es";
import { UserRound } from "lucide-react";

import { GlobalSearchResultRow } from "./GlobalSearchResultRow";

import type { GlobalSearchEntryProps } from "./GlobalSearchResultRow";
import type { SearchResponse } from "~/api/generated-api";

export const UserEntry = ({
  item,
  onSelect,
  typeLabel,
  isActive,
  showPassage,
}: GlobalSearchEntryProps<SearchResponse["data"]["users"][number]>) => {
  const groupsText = item.groups
    .map((group) => upperFirst(toLower(group.name)))
    .slice(0, 2)
    .join(", ");

  return (
    <GlobalSearchResultRow
      to={`/admin/users/${item.id}`}
      onSelect={onSelect}
      leading={
        item.profilePictureUrl ? (
          <img
            src={item.profilePictureUrl}
            alt=""
            className="size-full rounded-full object-cover"
          />
        ) : (
          <UserRound className="size-4" aria-hidden />
        )
      }
      title={`${item.firstName} ${item.lastName}`}
      typeLabel={typeLabel}
      meta={groupsText || undefined}
      isActive={isActive}
      showPassage={showPassage}
    />
  );
};
