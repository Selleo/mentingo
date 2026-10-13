import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useGlobalSearch } from "~/api/queries/useGlobalSearch";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ArticleEntry } from "./ArticleEntry";
import { CategoryEntry } from "./CategoryEntry";
import { CourseEntry } from "./CourseEntry";
import { GlobalSearchContent } from "./GlobalSearchContent";
import { GroupEntry } from "./GroupEntry";
import { LearningPathEntry } from "./LearningPathEntry";
import { LessonEntry } from "./LessonEntry";
import { MyCourseEntry } from "./MyCourseEntry";
import { NewsEntry } from "./NewsEntry";
import { QAEntry } from "./QAEntry";
import { UserEntry } from "./UserEntry";

import type { GlobalSearchItem } from "./GlobalSearchContent";

export const GlobalSearchResults = ({
  debouncedSearch,
  mode = "keyword",
  isDebouncing = false,
  onSelect,
  activeIndex,
  setTotalItems,
}: {
  debouncedSearch: string;
  mode?: "keyword" | "hybrid";
  isDebouncing?: boolean;
  onSelect: () => void;
  activeIndex: number;
  setTotalItems: (count: number) => void;
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

  const tabsToDisplay = useMemo<{ isFetching: boolean; items: GlobalSearchItem[] }>(() => {
    const mapped: GlobalSearchItem[] = [
      {
        resultType: "allCourses",
        resultData: searchResults?.allCourses ?? [],
        Component: CourseEntry,
      },
      {
        resultType: "myCourses",
        resultData: searchResults?.myCourses ?? [],
        Component: MyCourseEntry,
      },
      {
        resultType: "availableCourses",
        resultData: searchResults?.availableCourses ?? [],
        Component: CourseEntry,
      },
      {
        resultType: "learningPaths",
        resultData: isLearningPathsEnabled ? (searchResults?.learningPaths ?? []) : [],
        Component: LearningPathEntry,
      },
      {
        resultType: "lessons",
        resultData: searchResults?.lessons ?? [],
        Component: LessonEntry,
      },
      {
        resultType: "users",
        resultData: searchResults?.users ?? [],
        Component: UserEntry,
      },
      {
        resultType: "categories",
        resultData: searchResults?.categories ?? [],
        Component: CategoryEntry,
      },
      {
        resultType: "groups",
        resultData: searchResults?.groups ?? [],
        Component: GroupEntry,
      },
      {
        resultType: "news",
        resultData: searchResults?.news ?? [],
        Component: NewsEntry,
      },
      {
        resultType: "articles",
        resultData: searchResults?.articles ?? [],
        Component: ArticleEntry,
      },
      {
        resultType: "qa",
        resultData: searchResults?.qa ?? [],
        Component: QAEntry,
      },
    ];

    return {
      isFetching: isFetching || isDebouncing,
      items: isFetching || isDebouncing || isError ? [] : mapped,
    };
  }, [isFetching, isDebouncing, isError, isLearningPathsEnabled, searchResults]);

  useEffect(() => {
    if (isFetching || isDebouncing || isError) setTotalItems(0);
  }, [isFetching, isDebouncing, isError, setTotalItems]);

  if (isError && !isDebouncing) {
    return (
      <p role="alert" className="px-6 py-4 text-sm text-neutral-700">
        {t("globalSearch.searchFailed")}
      </p>
    );
  }

  return (
    <>
      {mode === "hybrid" &&
        !isFetching &&
        !isDebouncing &&
        searchResults?.semanticStatus === "unavailable" && (
          <p role="status" className="px-2 py-1 text-xs text-neutral-600">
            {t("globalSearch.semanticUnavailable")}
          </p>
        )}
      {mode === "hybrid" &&
        !isFetching &&
        !isDebouncing &&
        searchResults?.semanticStatus === "pending" && (
          <p role="status" className="px-2 py-1 text-xs text-neutral-600">
            {t("globalSearch.semanticPending")}
          </p>
        )}
      <GlobalSearchContent
        tabsToDisplay={tabsToDisplay}
        onSelect={onSelect}
        activeIndex={activeIndex}
        setTotalItems={setTotalItems}
      />
    </>
  );
};
