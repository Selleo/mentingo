import { useCompetencyCategories } from "~/api/queries/useCompetencyCategories";

import { useCompetenciesPickerSearch } from "../hooks/useCompetenciesPickerSearch";
import { SELECTED_RECORDS_PAGE } from "../utils/competenciesPicker.utils";

import {
  CompetenciesSelect,
  type CompetenciesSelectOption,
  type CompetenciesSelectProps,
} from "./CompetenciesSelect";

type CompetenciesCategoryPickerProps = Omit<
  CompetenciesSelectProps,
  "options" | "onSearchChange"
> & {
  /** Options listed before the categories, such as an uncategorized filter. */
  leadingOptions?: CompetenciesSelectOption[];
};

export function CompetenciesCategoryPicker({
  value,
  selectedLabel,
  leadingOptions = [],
  ...props
}: CompetenciesCategoryPickerProps) {
  const { setSearch, query } = useCompetenciesPickerSearch();
  const categories = useCompetencyCategories(query).data?.data ?? [];
  const resolvesSelected =
    Boolean(value) &&
    !selectedLabel &&
    !leadingOptions.some((option) => option.value === value) &&
    !categories.some((category) => category.id === value);
  const selected = useCompetencyCategories(
    { ...SELECTED_RECORDS_PAGE, ids: [value] },
    resolvesSelected,
  ).data?.data[0];

  return (
    <CompetenciesSelect
      {...props}
      value={value}
      selectedLabel={selectedLabel ?? selected?.name}
      options={[
        ...leadingOptions,
        ...categories.map((category) => ({ value: category.id, label: category.name })),
      ]}
      onSearchChange={setSearch}
    />
  );
}
