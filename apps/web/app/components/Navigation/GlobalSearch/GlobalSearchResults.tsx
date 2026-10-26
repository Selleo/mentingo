import {
  type GlobalSearchMode,
  GLOBAL_SEARCH_MODES,
  GLOBAL_SEARCH_RESULT_TYPES,
  GLOBAL_SEARCH_SEMANTIC_STATUSES,
} from "@repo/shared";
import { CircleAlert } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useGlobalSearch } from "~/api/queries/useGlobalSearch";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { GlobalSearchContent } from "./GlobalSearchContent";

import type {
  GlobalSearchAdministrativeResults,
  GlobalSearchResultNode,
} from "./globalSearchNodes";

const NO_RESULTS: GlobalSearchResultNode[] = [];
const NO_ADMINISTRATIVE_RESULTS: GlobalSearchAdministrativeResults = {
  users: [],
  groups: [],
  categories: [],
};

export const GlobalSearchResults = ({
  debouncedSearch,
  mode = GLOBAL_SEARCH_MODES.KEYWORD,
  isDebouncing = false,
  onSelect,
  activeIndex,
  setTotalItems,
  onBackToKeywords,
}: {
  debouncedSearch: string;
  mode?: GlobalSearchMode;
  isDebouncing?: boolean;
  onSelect: () => void;
  activeIndex: number;
  setTotalItems: (count: number) => void;
  onBackToKeywords?: () => void;
}) => {
  const { data: globalSettings } = useGlobalSettings();
  const language = useLanguageStore((state) => state.language);
  const { t } = useTranslation();
  const isLearningPathsEnabled = globalSettings?.learningPathsEnabled !== false;
  const isSearchReady = debouncedSearch.length >= 3;

  const {
    data: searchResults,
    isFetching,
    isError,
  } = useGlobalSearch(
    { searchQuery: debouncedSearch, language, mode },
    { enabled: isSearchReady && !isDebouncing },
  );

  const isPending = isFetching || isDebouncing;
  const showResults = !isPending && !isError;
  const results = useMemo(
    () =>
      showResults && searchResults
        ? searchResults.results.filter(
            (node) =>
              isLearningPathsEnabled || node.type !== GLOBAL_SEARCH_RESULT_TYPES.LEARNING_PATH,
          )
        : NO_RESULTS,
    [isLearningPathsEnabled, searchResults, showResults],
  );
  const administrative = useMemo(
    () =>
      showResults && searchResults
        ? {
            users: searchResults.users,
            groups: searchResults.groups,
            categories: searchResults.categories,
          }
        : NO_ADMINISTRATIVE_RESULTS,
    [searchResults, showResults],
  );

  useEffect(() => {
    if (isFetching || isDebouncing || isError) setTotalItems(0);
  }, [isFetching, isDebouncing, isError, setTotalItems]);

  if (isError && !isDebouncing) {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600">
          <CircleAlert className="size-5" aria-hidden />
        </span>
        <span className="body-sm-md text-neutral-950">{t("globalSearch.searchFailed")}</span>
      </div>
    );
  }

  const isAiRanked = mode === GLOBAL_SEARCH_MODES.HYBRID;
  const isSettled = !isFetching && !isDebouncing;
  // Partial indexing is not surfaced: results are still useful, and the notice read as an error.
  // Only a failed AI request is shown, because the user explicitly asked for AI ranking.
  const semanticNotice =
    isAiRanked &&
    isSettled &&
    searchResults?.semanticStatus === GLOBAL_SEARCH_SEMANTIC_STATUSES.UNAVAILABLE
      ? t("globalSearch.semanticUnavailable")
      : undefined;

  return (
    <>
      {semanticNotice && (
        <p
          role="status"
          className="mx-2.5 mb-2 border-l-2 border-primary-200 py-1 pl-3 text-xs leading-5 text-neutral-600"
        >
          {semanticNotice}
        </p>
      )}
      <GlobalSearchContent
        isFetching={isPending}
        results={results}
        administrative={administrative}
        onSelect={onSelect}
        activeIndex={activeIndex}
        setTotalItems={setTotalItems}
        query={debouncedSearch}
        isAiRanked={isAiRanked}
        emptyAction={
          isAiRanked && onBackToKeywords
            ? { label: t("globalSearch.backToKeywords"), onClick: onBackToKeywords }
            : undefined
        }
      />
    </>
  );
};
