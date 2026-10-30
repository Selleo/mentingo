import { useCompetencyCatalog } from "~/api/queries/useCompetencyCatalog";

import { useCompetenciesPickerSearch } from "../hooks/useCompetenciesPickerSearch";
import { SELECTED_RECORDS_PAGE } from "../utils/competenciesPicker.utils";

import { CompetenciesSelect, type CompetenciesSelectProps } from "./CompetenciesSelect";

import type { CompetencyCatalogItem } from "../competencies.types";

type CompetenciesCompetencyPickerProps = Omit<
  CompetenciesSelectProps,
  "options" | "onSearchChange" | "onChange"
> & {
  onChange: (value: string, competency?: CompetencyCatalogItem) => void;
  /** Hides competencies that cannot be chosen here. */
  isAvailable?: (competency: CompetencyCatalogItem) => boolean;
};

export function CompetenciesCompetencyPicker({
  value,
  selectedLabel,
  onChange,
  isAvailable = () => true,
  ...props
}: CompetenciesCompetencyPickerProps) {
  const { setSearch, query } = useCompetenciesPickerSearch();
  const competencies = (useCompetencyCatalog(query).data?.data ?? []).filter(isAvailable);
  const resolvesSelected =
    Boolean(value) && !selectedLabel && !competencies.some((item) => item.id === value);
  const selected = useCompetencyCatalog(
    { ...SELECTED_RECORDS_PAGE, ids: [value] },
    resolvesSelected,
  ).data?.data[0];

  return (
    <CompetenciesSelect
      {...props}
      value={value}
      selectedLabel={selectedLabel ?? selected?.name}
      options={competencies.map((competency) => ({
        value: competency.id,
        label: competency.name,
        description: competency.categoryName ?? undefined,
      }))}
      onChange={(id) =>
        onChange(
          id,
          competencies.find((competency) => competency.id === id),
        )
      }
      onSearchChange={setSearch}
    />
  );
}
