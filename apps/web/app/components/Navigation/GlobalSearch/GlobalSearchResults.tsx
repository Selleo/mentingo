import { PERMISSIONS } from "@repo/shared";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  allCoursesQueryOptions,
  categoriesQueryOptions,
  lessonsQueryOptions,
  studentCoursesQueryOptions,
  usersQueryOptions,
} from "~/api/queries";
import { groupsQueryOptions } from "~/api/queries/admin/useGroups";
import { qaSearchQueryOptions } from "~/api/queries/useAllQA";
import { announcementsForUserOptions } from "~/api/queries/useAnnouncementsForUser";
import { articlesSearchQueryOptions } from "~/api/queries/useArticlesSearch";
import { availableCoursesQueryOptions } from "~/api/queries/useAvailableCourses";
import { contentCreatorCoursesOptions } from "~/api/queries/useContentCreatorCourses";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { newsSearchQueryOptions } from "~/api/queries/useNewsList";
import { hasAnyPermission, hasPermission } from "~/common/permissions/permission.utils";
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AnnouncementEntry } from "./AnnouncementEntry";
import { ArticleEntry } from "./ArticleEntry";
import { CategoryEntry } from "./CategoryEntry";
import { CourseEntry } from "./CourseEntry";
import { GlobalSearchContent } from "./GlobalSearchContent";
import { GroupEntry } from "./GroupEntry";
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
  const { data: currentUser } = useCurrentUser();
  const { permissions } = usePermissions();
  const { language } = useLanguageStore();

  const {
    canSearchAllCourses,
    canSearchUsers,
    canSearchCategories,
    canSearchGroups,
    canSearchOwnCourses,
    canSearchStudentCourses,
    canSearchAvailableCourses,
    canSearchAnnouncements,
    canSearchLessons,
    canSearchNews,
    canSearchArticles,
    canSearchQA,
  } = useMemo(() => {
    return {
      canSearchAllCourses: hasAnyPermission(permissions, [PERMISSIONS.COURSE_UPDATE]),
      canSearchUsers: hasPermission(permissions, PERMISSIONS.USER_MANAGE),
      canSearchCategories: hasAnyPermission(permissions, [
        PERMISSIONS.CATEGORY_READ,
        PERMISSIONS.CATEGORY_MANAGE,
      ]),
      canSearchGroups: hasAnyPermission(permissions, [
        PERMISSIONS.GROUP_READ,
        PERMISSIONS.GROUP_MANAGE,
      ]),
      canSearchOwnCourses: hasPermission(permissions, PERMISSIONS.COURSE_UPDATE_OWN),
      canSearchStudentCourses: hasAnyPermission(permissions, [PERMISSIONS.COURSE_READ_ASSIGNED]),
      canSearchAvailableCourses: hasAnyPermission(permissions, [PERMISSIONS.COURSE_READ]),
      canSearchAnnouncements: hasPermission(permissions, PERMISSIONS.ANNOUNCEMENT_READ),
      canSearchLessons: hasAnyPermission(permissions, [PERMISSIONS.COURSE_READ]),
      canSearchNews: hasAnyPermission(permissions, [
        PERMISSIONS.NEWS_READ_PUBLIC,
        PERMISSIONS.NEWS_MANAGE,
        PERMISSIONS.NEWS_MANAGE_OWN,
      ]),
      canSearchArticles: hasAnyPermission(permissions, [
        PERMISSIONS.ARTICLE_READ_PUBLIC,
        PERMISSIONS.ARTICLE_MANAGE,
        PERMISSIONS.ARTICLE_MANAGE_OWN,
      ]),
      canSearchQA: hasAnyPermission(permissions, [
        PERMISSIONS.QA_READ_PUBLIC,
        PERMISSIONS.QA_MANAGE,
        PERMISSIONS.QA_MANAGE_OWN,
      ]),
    };
  }, [permissions]);

  const isSearchReady = debouncedSearch.length >= 3;
  const shouldSearchContentCreatorCourses = isSearchReady && canSearchOwnCourses;
  const shouldSearchStudentCourses =
    isSearchReady && canSearchStudentCourses && !shouldSearchContentCreatorCourses;

  const tabsToDisplay = useQueries({
    queries: [
      allCoursesQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: isSearchReady && canSearchAllCourses },
      ),
      usersQueryOptions({ keyword: debouncedSearch }, { enabled: isSearchReady && canSearchUsers }),
      categoriesQueryOptions(
        { title: debouncedSearch },
        { enabled: isSearchReady && canSearchCategories },
      ),
      groupsQueryOptions({ name: debouncedSearch }, { enabled: isSearchReady && canSearchGroups }),
      contentCreatorCoursesOptions(
        currentUser?.id,
        { searchQuery: debouncedSearch, language },
        canSearchOwnCourses,
        { enabled: shouldSearchContentCreatorCourses },
      ),
      studentCoursesQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: shouldSearchStudentCourses },
      ),
      availableCoursesQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: isSearchReady && canSearchAvailableCourses },
      ),
      announcementsForUserOptions(
        { search: debouncedSearch },
        { enabled: isSearchReady && canSearchAnnouncements },
      ),
      lessonsQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: isSearchReady && canSearchLessons },
      ),
      newsSearchQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: isSearchReady && canSearchNews },
      ),
      articlesSearchQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: isSearchReady && canSearchArticles },
      ),
      qaSearchQueryOptions(
        { searchQuery: debouncedSearch, language },
        { enabled: isSearchReady && canSearchQA },
      ),
    ],
    combine: (results) => {
      const [
        allCourses,
        users,
        categories,
        groups,
        contentCreatorCourses,
        studentCourses,
        availableCourses,
        announcements,
        lessons,
        newsResults,
        articlesResults,
        qaResults,
      ] = results;

      const myCoursesData = shouldSearchContentCreatorCourses
        ? contentCreatorCourses?.data
        : studentCourses?.data;

      const myCoursesComponent = shouldSearchContentCreatorCourses ? CourseEntry : MyCourseEntry;

      const mapped: GlobalSearchItem[] = [
        {
          resultType: "allCourses",
          resultData: allCourses?.data ?? [],
          Component: CourseEntry,
        },
        {
          resultType: "myCourses",
          resultData: myCoursesData ?? [],
          Component: myCoursesComponent,
        },
        {
          resultType: "availableCourses",
          resultData: availableCourses?.data ?? [],
          Component: CourseEntry,
        },
        {
          resultType: "lessons",
          resultData: lessons?.data ?? [],
          Component: LessonEntry,
        },
        {
          resultType: "users",
          resultData: users?.data?.data ?? [],
          Component: UserEntry,
        },
        {
          resultType: "categories",
          resultData: categories?.data ?? [],
          Component: CategoryEntry,
        },
        {
          resultType: "groups",
          resultData: groups?.data ?? [],
          Component: GroupEntry,
        },
        {
          resultType: "announcements",
          resultData: announcements?.data ?? [],
          Component: AnnouncementEntry,
        },
        {
          resultType: "news",
          resultData: newsResults?.data ?? [],
          Component: NewsEntry,
        },
        {
          resultType: "articles",
          resultData: articlesResults?.data ?? [],
          Component: ArticleEntry,
        },
        {
          resultType: "qa",
          resultData: qaResults?.data ?? [],
          Component: QAEntry,
        },
      ];

      const isFetching = results.some((result) => Boolean(result?.isFetching));

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
