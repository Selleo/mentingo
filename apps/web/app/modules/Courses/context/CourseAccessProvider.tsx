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

type CourseExperienceResolverParams = {
  course: GetCourseResponse["data"];
  forcePreviewMode: boolean;
  isAdmin: boolean;
  isAdminLike: boolean;
  isContentCreator: boolean;
  isStudent: boolean;
  activeLearningModeCourseIds: string[];
};

const CourseExperienceContext = createContext<CourseExperienceContextValue | null>(null);

type CourseAccessProviderProps = PropsWithChildren<{
  course: GetCourseResponse["data"];
  forcePreviewMode?: boolean;
}>;

function resolveCourseExperienceState({
  course,
  forcePreviewMode,
  isAdmin,
  isAdminLike,
  isContentCreator,
  isStudent,
  activeLearningModeCourseIds,
}: CourseExperienceResolverParams): CourseExperienceContextValue {
  const isCourseStudentModeActive =
    !forcePreviewMode && isAdminLike && activeLearningModeCourseIds.includes(course.id);

  const canContentCreatorLearn =
    isContentCreator && (!!course.enrolled || isCourseStudentModeActive);

  const canAdminLearn = isAdmin && isCourseStudentModeActive;

  const isPreviewMode =
    forcePreviewMode || (isAdminLike && !canAdminLearn && !canContentCreatorLearn);

  const isEffectiveStudentExperience =
    !isPreviewMode && (isStudent || canAdminLearn || canContentCreatorLearn);

  return {
    course,
    isCourseStudentModeActive,
    isPreviewMode,
    isEffectiveStudentExperience,
  };
}

export function CourseAccessProvider({
  course,
  forcePreviewMode = false,
  children,
}: CourseAccessProviderProps) {
  const { data: currentUser } = useCurrentUser();
  const { isAdmin, isContentCreator, isAdminLike, isStudent } = useUserRole();

  const value = useMemo(() => {
    return resolveCourseExperienceState({
      course,
      forcePreviewMode,
      isAdmin,
      isAdminLike,
      isContentCreator,
      isStudent,
      activeLearningModeCourseIds: currentUser?.studentModeCourseIds ?? [],
    });
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

export function useCourseAccessProvider() {
  const context = useContext(CourseExperienceContext);

  if (!context) throw new Error("useCourseAccessProvider must be used within CourseAccessProvider");

  return context;
}

export function useOptionalCourseAccessProvider() {
  return useContext(CourseExperienceContext);
}
