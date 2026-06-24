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
  canUseLearningMode: boolean;
  canUpdateLearningProgress: boolean;
  activeLearningModeCourseIds: string[];
};

const CourseExperienceContext = createContext<CourseExperienceContextValue | null>(null);

type CourseAccessProviderProps = PropsWithChildren<{
  course: GetCourseResponse["data"];
  forcePreviewMode?: boolean;
}>;

export function resolveCourseExperienceState({
  course,
  forcePreviewMode,
  currentUserId,
  canUseLearningMode,
  canUpdateLearningProgress,
  activeLearningModeCourseIds,
}: CourseExperienceResolverParams): CourseExperienceContextValue {
  const isCourseStudentModeActive =
    !forcePreviewMode && canUseLearningMode && activeLearningModeCourseIds.includes(course.id);

  const isCourseAuthor = currentUserId === course.authorId;

  const canLearnByEnrollment =
    canUpdateLearningProgress && !isCourseAuthor && Boolean(course.enrolled);

  const canLearnByLearningMode = canUseLearningMode && isCourseStudentModeActive;

  const isPreviewMode =
    forcePreviewMode || (canUseLearningMode && !canLearnByLearningMode && !canLearnByEnrollment);

  const isEffectiveStudentExperience =
    !isPreviewMode && (canLearnByEnrollment || canLearnByLearningMode || canUpdateLearningProgress);

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
  const { hasAccess: canUseLearningMode } = usePermissions({
    required: PERMISSIONS.LEARNING_MODE_USE,
  });
  const { hasAccess: canUpdateLearningProgress } = usePermissions({
    required: PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  });

  const value = useMemo(() => {
    return resolveCourseExperienceState({
      course,
      forcePreviewMode,
      currentUserId: currentUser?.id,
      canUseLearningMode,
      canUpdateLearningProgress,
      activeLearningModeCourseIds: currentUser?.studentModeCourseIds ?? [],
    });
  }, [
    course,
    currentUser?.id,
    currentUser?.studentModeCourseIds,
    forcePreviewMode,
    canUseLearningMode,
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
