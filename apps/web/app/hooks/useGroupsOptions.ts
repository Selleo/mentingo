import { useMemo, useState } from "react";

import type { Option } from "~/components/ui/multiselect";

export const useGroupsOptions = (groups?: Array<{ id: string; name: string }>) => {
  const [selectedGroups, setSelectedGroups] = useState<Option[]>([]);

  const filterGroups = useMemo(
    () => (value: string, search: string) =>
      groups
        ?.find((group) => group.id === value)
        ?.name.toLowerCase()
        .includes(search.toLowerCase())
        ? 1
        : 0,
    [groups],
  );

  const options = useMemo(
    () => groups?.map((group) => ({ value: group.id, label: group.name })),
    [groups],
  );

  return { options, selectedGroups, setSelectedGroups, filterGroups };
};
