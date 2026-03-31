import { PERMISSIONS } from "@repo/shared";
import { createContext, useContext, useMemo } from "react";

import { useCurrentUser } from "~/api/queries";
import { usePermissions } from "~/hooks/usePermissions";

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
  currentUserId?: string;
  canManageUsers: boolean;
  canManageCourses: boolean;
  canManageOwnCourses: boolean;
  canUpdateLearningProgress: boolean;
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
  currentUserId,
  canManageUsers,
  canManageCourses,
  canManageOwnCourses,
  canUpdateLearningProgress,
  activeLearningModeCourseIds,
}: CourseExperienceResolverParams): CourseExperienceContextValue {
  const isCourseStudentModeActive =
    !forcePreviewMode && canManageCourses && activeLearningModeCourseIds.includes(course.id);

  const isCourseAuthor = currentUserId === course.authorId;

  const canContentCreatorLearn =
    canManageOwnCourses && (isCourseStudentModeActive || (!isCourseAuthor && !!course.enrolled));

  const canAdminLearn = canManageUsers && isCourseStudentModeActive;

  const isPreviewMode =
    forcePreviewMode || (canManageCourses && !canAdminLearn && !canContentCreatorLearn);

  const isEffectiveStudentExperience =
    !isPreviewMode && (canUpdateLearningProgress || canAdminLearn || canContentCreatorLearn);

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
  const { hasAccess: canManageUsers } = usePermissions({ required: PERMISSIONS.USER_MANAGE });
  const { hasAccess: canManageOwnCourses } = usePermissions({
    required: PERMISSIONS.COURSE_UPDATE_OWN,
  });
  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });
  const { hasAccess: canUpdateLearningProgress } = usePermissions({
    required: PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  });

  const value = useMemo(() => {
    return resolveCourseExperienceState({
      course,
      forcePreviewMode,
      currentUserId: currentUser?.id,
      canManageUsers,
      canManageCourses,
      canManageOwnCourses,
      canUpdateLearningProgress,
      activeLearningModeCourseIds: currentUser?.studentModeCourseIds ?? [],
    });
  }, [
    course,
    currentUser?.id,
    currentUser?.studentModeCourseIds,
    forcePreviewMode,
    canManageUsers,
    canManageCourses,
    canManageOwnCourses,
    canUpdateLearningProgress,
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
