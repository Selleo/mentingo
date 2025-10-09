import { useQueries } from "@tanstack/react-query";

import { announcementsForUserOptions } from "~/api/queries/useAnnouncementsForUser";
import { availableCoursesQueryOptions } from "~/api/queries/useAvailableCourses";
import { contentCreatorCoursesOptions } from "~/api/queries/useContentCreatorCourses";
import { useCurrentUserSuspense } from "~/api/queries/useCurrentUser";

import { AnnouncementEntry } from "./AnnouncementEntry";
import { CourseEntry } from "./CourseEntry";
import { GlobalSearchContent } from "./GlobalSearchContent";

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
  const tabsToDisplay = useQueries({
    queries: [
      contentCreatorCoursesOptions(currentUser?.id ?? "", { searchQuery: debouncedSearch }, true, {
        enabled: debouncedSearch.length >= 3,
      }),
      availableCoursesQueryOptions(
        { searchQuery: debouncedSearch },
        { enabled: debouncedSearch.length >= 3 },
      ),
      announcementsForUserOptions(
        { search: debouncedSearch },
        { enabled: debouncedSearch.length >= 3 },
      ),
    ],
    combine: (results) => {
      const [studentCourses, availableCourses, announcements] = results;
      const studentCoursesData = studentCourses?.data;
      const availableCoursesData = availableCourses?.data;
      const announcementsData = announcements?.data;

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
