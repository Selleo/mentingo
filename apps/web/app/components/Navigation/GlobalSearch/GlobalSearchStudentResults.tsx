import { useQueries } from "@tanstack/react-query";

import { studentLessonsQueryOptions } from "~/api/queries";
import { announcementsForUserOptions } from "~/api/queries/useAnnouncementsForUser";
import { availableCoursesQueryOptions } from "~/api/queries/useAvailableCourses";
import { studentCoursesQueryOptions } from "~/api/queries/useStudentCourses";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AnnouncementEntry } from "./AnnouncementEntry";
import { CourseEntry } from "./CourseEntry";
import { GlobalSearchContent } from "./GlobalSearchContent";
import { LessonEntry } from "./LessonEntry";
import { MyCourseEntry } from "./MyCourseEntry";

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
      studentLessonsQueryOptions(
        { searchQuery: debouncedSearch, lessonCompleted: false },
        { enabled: debouncedSearch.length >= 3 },
      ),
    ],
    combine: (results) => {
      const [studentCourses, availableCourses, announcements, studentLessons] = results;
      const studentCoursesData = studentCourses?.data;
      const availableCoursesData = availableCourses?.data;
      const announcementsData = announcements?.data;
      const studentLessonsData = studentLessons?.data;

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
          resultData: studentLessonsData ?? [],
          Component: LessonEntry,
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
