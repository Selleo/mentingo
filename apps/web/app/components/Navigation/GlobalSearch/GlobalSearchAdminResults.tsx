import { useQueries } from "@tanstack/react-query";

import { allCoursesQueryOptions, categoriesQueryOptions, usersQueryOptions } from "~/api/queries";
import { groupsQueryOptions } from "~/api/queries/admin/useGroups";
import { qaSearchQueryOptions } from "~/api/queries/useAllQA";
import { announcementsForUserOptions } from "~/api/queries/useAnnouncementsForUser";
import { articlesSearchQueryOptions } from "~/api/queries/useArticlesSearch";
import { newsSearchQueryOptions } from "~/api/queries/useNewsList";
import { useUserRole } from "~/hooks/useUserRole";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AnnouncementEntry } from "./AnnouncementEntry";
import { ArticleEntry } from "./ArticleEntry";
import { CategoryEntry } from "./CategoryEntry";
import { CourseEntry } from "./CourseEntry";
import { GlobalSearchContent } from "./GlobalSearchContent";
import { GroupEntry } from "./GroupEntry";
import { NewsEntry } from "./NewsEntry";
import { QAEntry } from "./QAEntry";
import { UserEntry } from "./UserEntry";

import type { GlobalSearchItem } from "./GlobalSearchContent";

export const GlobalSearchAdminResults = ({
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
  const { isAdmin, isContentCreator } = useUserRole();
  const isAllowed = isAdmin || isContentCreator;
  const { language } = useLanguageStore();

  const tabsToDisplay = useQueries({
    queries: [
      allCoursesQueryOptions({ searchQuery: debouncedSearch }),
      usersQueryOptions({ keyword: debouncedSearch }, { enabled: isAllowed }),
      categoriesQueryOptions({ title: debouncedSearch }, { enabled: isAllowed }),
      groupsQueryOptions({ name: debouncedSearch }, { enabled: isAllowed }),
      announcementsForUserOptions({ title: debouncedSearch }, { enabled: isAllowed }),
      newsSearchQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: debouncedSearch.length >= 3 },
      ),
      articlesSearchQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: debouncedSearch.length >= 3 },
      ),
      qaSearchQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: debouncedSearch.length >= 3 },
      ),
    ],
    combine: (results) => {
      const [
        courses,
        users,
        categories,
        groups,
        announcements,
        newsResults,
        articlesResults,
        qaResults,
      ] = results;

      const coursesData = courses?.data;
      const usersData = users?.data?.data;
      const categoriesData = categories?.data;
      const groupsData = groups?.data;
      const announcementsData = announcements?.data;
      const newsData = newsResults?.data;
      const articlesData = articlesResults?.data;
      const qaData = qaResults?.data;

      const mapped: GlobalSearchItem[] = [
        {
          resultType: "allCourses",
          resultData: coursesData ?? [],
          Component: CourseEntry,
        },
        {
          resultType: "users",
          resultData: usersData ?? [],
          Component: UserEntry,
        },
        {
          resultType: "categories",
          resultData: categoriesData ?? [],
          Component: CategoryEntry,
        },
        {
          resultType: "groups",
          resultData: groupsData ?? [],
          Component: GroupEntry,
        },
        {
          resultType: "announcements",
          resultData: announcementsData ?? [],
          Component: AnnouncementEntry,
        },
        {
          resultType: "news",
          resultData: newsData ?? [],
          Component: NewsEntry,
        },
        {
          resultType: "articles",
          resultData: articlesData ?? [],
          Component: ArticleEntry,
        },
        {
          resultType: "qa",
          resultData: qaData ?? [],
          Component: QAEntry,
        },
      ];

      const isFetching = results.some((r) => Boolean(r?.isFetching));

      return { items: mapped, isFetching };
    },
  });

  return (
    <GlobalSearchContent
      tabsToDisplay={tabsToDisplay}
      onSelect={onSelect}
      activeIndex={activeIndex}
      setTotalItems={setTotalItems}
    />
  );
};
