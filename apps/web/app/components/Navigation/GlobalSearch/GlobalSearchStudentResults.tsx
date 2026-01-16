import { useQueries } from "@tanstack/react-query";

import { lessonsQueryOptions } from "~/api/queries";
import { qaSearchQueryOptions } from "~/api/queries/useAllQA";
import { announcementsForUserOptions } from "~/api/queries/useAnnouncementsForUser";
import { articlesSearchQueryOptions } from "~/api/queries/useArticlesSearch";
import { availableCoursesQueryOptions } from "~/api/queries/useAvailableCourses";
import { newsSearchQueryOptions } from "~/api/queries/useNewsList";
import { studentCoursesQueryOptions } from "~/api/queries/useStudentCourses";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AnnouncementEntry } from "./AnnouncementEntry";
import { ArticleEntry } from "./ArticleEntry";
import { CourseEntry } from "./CourseEntry";
import { GlobalSearchContent } from "./GlobalSearchContent";
import { LessonEntry } from "./LessonEntry";
import { MyCourseEntry } from "./MyCourseEntry";
import { NewsEntry } from "./NewsEntry";
import { QAEntry } from "./QAEntry";

import type { GlobalSearchItem } from "./GlobalSearchContent";

export const GlobalSearchStudentResults = ({
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
  const { language } = useLanguageStore();

  const tabsToDisplay = useQueries({
    queries: [
      studentCoursesQueryOptions(
        { searchQuery: debouncedSearch },
        { enabled: debouncedSearch.length >= 3 },
      ),
      availableCoursesQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: debouncedSearch.length >= 3 },
      ),
      announcementsForUserOptions(
        { search: debouncedSearch },
        { enabled: debouncedSearch.length >= 3 },
      ),
      lessonsQueryOptions(
        { searchQuery: debouncedSearch },
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
      qaSearchQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: debouncedSearch.length >= 3 },
      ),
    ],
    combine: (results) => {
      const [
        studentCourses,
        availableCourses,
        announcements,
        lessons,
        newsResults,
        articlesResults,
        qaResults,
      ] = results;
      const studentCoursesData = studentCourses?.data;
      const availableCoursesData = availableCourses?.data;
      const announcementsData = announcements?.data;
      const lessonData = lessons?.data;
      const newsData = newsResults?.data;
      const articlesData = articlesResults?.data;
      const qaData = qaResults?.data;

      const mapped: GlobalSearchItem[] = [
        {
          resultType: "myCourses",
          resultData: studentCoursesData ?? [],
          Component: MyCourseEntry,
        },
        {
          resultType: "availableCourses",
          resultData: availableCoursesData ?? [],
          Component: CourseEntry,
        },
        {
          resultType: "announcements",
          resultData: announcementsData ?? [],
          Component: AnnouncementEntry,
        },
        {
          resultType: "lessons",
          resultData: lessonData ?? [],
          Component: LessonEntry,
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
