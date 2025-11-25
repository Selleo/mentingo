import { useMemo, useState } from "react";

import type { Option } from "~/components/ui/multiselect";

export const useGroupsOptions = (groups?: Array<{ id: string; name: string }>) => {
  const [selectedGroups, setSelectedGroups] = useState<Option[]>([]);

  const filterGroups = useMemo(
    () => (value: string, search: string) =>
      selectedGroups
        .find((g) => g.value === value)
        ?.label.toLowerCase()
        .includes(search.toLowerCase())
        ? 1
        : 0,
    [selectedGroups],
  );

  const options = useMemo(
    () => groups?.map((group) => ({ value: group.id, label: group.name })),
    [groups],
  );

  return { options, selectedGroups, setSelectedGroups, filterGroups };
};
