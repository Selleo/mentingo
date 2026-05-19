import { useSearchParams } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SearchInput } from "~/components/SearchInput/SearchInput";
import { useDebounce } from "~/hooks/useDebounce";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../../e2e/data/learning-paths/handles";

export function LearningPathsSearchInput() {
  const { t } = useTranslation();

  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("searchQuery") ?? "";

  const [value, setValue] = useState(searchQuery);
  const debouncedValue = useDebounce(value, 300);

  const isHydratingFromUrlRef = useRef(false);

  useEffect(() => {
    isHydratingFromUrlRef.current = true;

    setValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedValue !== value) return;

    if (isHydratingFromUrlRef.current) {
      isHydratingFromUrlRef.current = false;
      return;
    }

    const nextSearchQuery = debouncedValue.trim();

    if (nextSearchQuery === searchQuery) return;

    const nextParams = new URLSearchParams(searchParams);

    if (nextSearchQuery) {
      nextParams.set("searchQuery", nextSearchQuery);
    } else {
      nextParams.delete("searchQuery");
    }

    setSearchParams(nextParams, { replace: true });
  }, [debouncedValue, searchParams, searchQuery, setSearchParams, value]);

  return (
    <SearchInput
      data-testid={LEARNING_PATHS_PAGE_HANDLES.SEARCH_INPUT}
      value={value}
      clearable
      wrapperClassName="w-full max-w-lg"
      placeholder={t("learningPathsView.searchPlaceholder")}
      onChange={(event) => {
        isHydratingFromUrlRef.current = false;
        setValue(event.target.value);
      }}
    />
  );
}
