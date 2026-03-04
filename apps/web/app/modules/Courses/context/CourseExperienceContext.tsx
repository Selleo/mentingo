import { createContext, useContext, useMemo } from "react";

import { useCurrentUser } from "~/api/queries";
import { useUserRole } from "~/hooks/useUserRole";

import type { PropsWithChildren } from "react";
import type { GetCourseResponse } from "~/api/generated-api";

type CourseExperienceContextValue = {
  course: GetCourseResponse["data"];
  isCourseStudentModeActive: boolean;
  isPreviewMode: boolean;
  isEffectiveStudentExperience: boolean;
};

const CourseExperienceContext = createContext<CourseExperienceContextValue | null>(null);

type CourseExperienceProviderProps = PropsWithChildren<{
  course: GetCourseResponse["data"];
  forcePreviewMode?: boolean;
}>;

export function CourseExperienceProvider({
  course,
  forcePreviewMode = false,
  children,
}: CourseExperienceProviderProps) {
  const { data: currentUser } = useCurrentUser();
  const { isAdmin, isContentCreator, isAdminLike, isStudent } = useUserRole();

  const value = useMemo(() => {
    const isCourseStudentModeActive = Boolean(
      !forcePreviewMode && isAdminLike && currentUser?.studentModeCourseIds?.includes(course.id),
    );

    const hasLearnerEnrollment = Boolean(course.enrolled);
    const isContentCreatorLearner =
      isContentCreator && (hasLearnerEnrollment || isCourseStudentModeActive);
    const isAdminLearner = isAdmin && isCourseStudentModeActive;
    const isStudentLearner = isStudent;

    const isPreviewMode =
      forcePreviewMode || (isAdminLike && !isAdminLearner && !isContentCreatorLearner);

    const isEffectiveStudentExperience =
      !isPreviewMode && (isStudentLearner || isAdminLearner || isContentCreatorLearner);

    return {
      course,
      isCourseStudentModeActive,
      isPreviewMode,
      isEffectiveStudentExperience,
    };
  }, [
    course,
    currentUser?.studentModeCourseIds,
    forcePreviewMode,
    isAdmin,
    isAdminLike,
    isContentCreator,
    isStudent,
  ]);

  return (
    <CourseExperienceContext.Provider value={value}>{children}</CourseExperienceContext.Provider>
  );
}

export function useCourseExperience() {
  const context = useContext(CourseExperienceContext);

  if (!context) throw new Error("useCourseExperience must be used within CourseExperienceProvider");

  return context;
}

export function useOptionalCourseExperience() {
  return useContext(CourseExperienceContext);
}
