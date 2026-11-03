import { useState } from "react";

import { useDebounce } from "~/hooks/useDebounce";

import { PICKER_PAGE } from "../utils/competenciesPicker.utils";

/** Server search for a picker: the query to request and a setter for the typed text. */
export function useCompetenciesPickerSearch() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim());
  return { setSearch, query: { ...PICKER_PAGE, search: debouncedSearch || undefined } };
}
