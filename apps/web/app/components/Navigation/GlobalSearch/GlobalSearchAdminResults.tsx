import { useQueries } from "@tanstack/react-query";

import { allCoursesQueryOptions, categoriesQueryOptions, usersQueryOptions } from "~/api/queries";
import { groupsQueryOptions } from "~/api/queries/admin/useGroups";
import { announcementsForUserOptions } from "~/api/queries/useAnnouncementsForUser";
import { useUserRole } from "~/hooks/useUserRole";

import { AnnouncementEntry } from "./AnnouncementEntry";
import { CategoryEntry } from "./CategoryEntry";
import { CourseEntry } from "./CourseEntry";
import { GlobalSearchContent } from "./GlobalSearchContent";
import { GroupEntry } from "./GroupEntry";
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

  const tabsToDisplay = useQueries({
    queries: [
      allCoursesQueryOptions({ searchQuery: debouncedSearch }),
      usersQueryOptions({ keyword: debouncedSearch }, { enabled: isAllowed }),
      categoriesQueryOptions({ title: debouncedSearch }, { enabled: isAllowed }),
      groupsQueryOptions({ name: debouncedSearch }, { enabled: isAllowed }),
      announcementsForUserOptions({ title: debouncedSearch }, { enabled: isAllowed }),
    ],
    combine: (results) => {
      const [courses, users, categories, groups, announcements] = results;

      const coursesData = courses?.data;
      const usersData = users?.data;
      const categoriesData = categories?.data;
      const groupsData = groups?.data;
      const announcementsData = announcements?.data;

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
