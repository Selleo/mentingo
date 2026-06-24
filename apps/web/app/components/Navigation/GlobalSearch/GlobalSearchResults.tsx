import { useMemo } from "react";

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
  onSelect,
  activeIndex,
  setTotalItems,
}: {
  debouncedSearch: string;
  onSelect: () => void;
  activeIndex: number;
  setTotalItems: (count: number) => void;
}) => {
  const { data: globalSettings } = useGlobalSettings();
  const { language } = useLanguageStore();
  const isLearningPathsEnabled = globalSettings?.learningPathsEnabled !== false;
  const isSearchReady = debouncedSearch.length >= 3;

  const { data: searchResults, isFetching } = useGlobalSearch(
    { searchQuery: debouncedSearch, language },
    { enabled: isSearchReady },
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
      isFetching,
      items: mapped,
    };
  }, [isFetching, isLearningPathsEnabled, searchResults]);

  return (
    <GlobalSearchContent
      tabsToDisplay={tabsToDisplay}
      onSelect={onSelect}
      activeIndex={activeIndex}
      setTotalItems={setTotalItems}
    />
  );
};
