import { useCompetencyProfiles } from "~/api/queries/useCompetencyProfiles";

import { useCompetenciesPickerSearch } from "../hooks/useCompetenciesPickerSearch";
import { SELECTED_RECORDS_PAGE } from "../utils/competenciesPicker.utils";

import { CompetenciesSelect, type CompetenciesSelectProps } from "./CompetenciesSelect";

type CompetenciesProfilePickerProps = Omit<CompetenciesSelectProps, "options" | "onSearchChange">;

export function CompetenciesProfilePicker({
  value,
  selectedLabel,
  ...props
}: CompetenciesProfilePickerProps) {
  const { setSearch, query } = useCompetenciesPickerSearch();
  const profiles = useCompetencyProfiles(query).data?.data ?? [];
  const resolvesSelected =
    Boolean(value) && !selectedLabel && !profiles.some((profile) => profile.id === value);
  const selected = useCompetencyProfiles(
    { ...SELECTED_RECORDS_PAGE, ids: [value] },
    resolvesSelected,
  ).data?.data[0];

  return (
    <CompetenciesSelect
      {...props}
      value={value}
      selectedLabel={selectedLabel ?? selected?.name}
      options={profiles.map((profile) => ({ value: profile.id, label: profile.name }))}
      onSearchChange={setSearch}
    />
  );
}
