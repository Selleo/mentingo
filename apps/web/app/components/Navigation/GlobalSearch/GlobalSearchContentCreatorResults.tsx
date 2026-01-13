import { useQueries } from "@tanstack/react-query";

import { lessonsQueryOptions } from "~/api/queries";
import { announcementsForUserOptions } from "~/api/queries/useAnnouncementsForUser";
import { articlesSearchQueryOptions } from "~/api/queries/useArticlesSearch";
import { availableCoursesQueryOptions } from "~/api/queries/useAvailableCourses";
import { contentCreatorCoursesOptions } from "~/api/queries/useContentCreatorCourses";
import { useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
import { newsSearchQueryOptions } from "~/api/queries/useNewsList";
import { LessonEntry } from "~/components/Navigation/GlobalSearch/LessonEntry";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AnnouncementEntry } from "./AnnouncementEntry";
import { ArticleEntry } from "./ArticleEntry";
import { CourseEntry } from "./CourseEntry";
import { GlobalSearchContent } from "./GlobalSearchContent";
import { NewsEntry } from "./NewsEntry";

import type { GlobalSearchItem } from "./GlobalSearchContent";

export const GlobalSearchContentCreatorResults = ({
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
  const { data: currentUser } = useCurrentUserSuspense();
  const { language } = useLanguageStore();

  const tabsToDisplay = useQueries({
    queries: [
      contentCreatorCoursesOptions(currentUser?.id ?? "", { searchQuery: debouncedSearch }, true, {
        enabled: debouncedSearch.length >= 3,
      }),
      availableCoursesQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: debouncedSearch.length >= 3 },
      ),
      lessonsQueryOptions(
        { searchQuery: debouncedSearch },
        { enabled: debouncedSearch.length >= 3 },
      ),
      announcementsForUserOptions(
        { search: debouncedSearch },
        { enabled: debouncedSearch.length >= 3 },
      ),
      newsSearchQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: debouncedSearch.length >= 3 },
      ),
      articlesSearchQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: debouncedSearch.length >= 3 },
      ),
    ],
    combine: (results) => {
      const [
        studentCourses,
        availableCourses,
        lessons,
        announcements,
        newsResults,
        articlesResults,
      ] = results;
      const studentCoursesData = studentCourses?.data;
      const availableCoursesData = availableCourses?.data;
      const announcementsData = announcements?.data;
      const newsData = newsResults?.data;
      const articlesData = articlesResults?.data;
      const lessonData = lessons?.data;

      const mapped: GlobalSearchItem[] = [
        {
          resultType: "myCourses",
          resultData: studentCoursesData ?? [],
          Component: CourseEntry,
        },

        {
          resultType: "availableCourses",
          resultData: availableCoursesData ?? [],
          Component: CourseEntry,
        },
        {
          resultType: "lessons",
          resultData: lessonData ?? [],
          Component: LessonEntry,
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
