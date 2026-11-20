import { useCompetencyTracks } from "~/api/queries/useCompetencyTracks";

import { useCompetenciesPickerSearch } from "../hooks/useCompetenciesPickerSearch";
import { SELECTED_RECORDS_PAGE } from "../utils/competenciesPicker.utils";

import { CompetenciesSelect, type CompetenciesSelectProps } from "./CompetenciesSelect";

type CompetenciesTrackPickerProps = Omit<CompetenciesSelectProps, "options" | "onSearchChange">;

export function CompetenciesTrackPicker({
  value,
  selectedLabel,
  ...props
}: CompetenciesTrackPickerProps) {
  const { setSearch, query } = useCompetenciesPickerSearch();
  const tracks = useCompetencyTracks(query).data?.data ?? [];
  const resolvesSelected =
    Boolean(value) && !selectedLabel && !tracks.some((track) => track.id === value);
  const selected = useCompetencyTracks({ ...SELECTED_RECORDS_PAGE, ids: [value] }, resolvesSelected)
    .data?.data[0];

  return (
    <CompetenciesSelect
      {...props}
      value={value}
      selectedLabel={selectedLabel ?? selected?.name}
      options={tracks.map((track) => ({ value: track.id, label: track.name }))}
      onSearchChange={setSearch}
    />
  );
}
