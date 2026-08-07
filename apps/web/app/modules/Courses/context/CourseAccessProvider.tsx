import { PERMISSIONS, type PermissionKey } from "@repo/shared";
import { createContext, useContext, useEffect, useMemo } from "react";

import { useMarkCourseOpened } from "~/api/mutations/useMarkCourseOpened";
import { useCurrentUser } from "~/api/queries";
import { hasPermission } from "~/common/permissions/permission.utils";

import type { PropsWithChildren } from "react";
import type { GetCourseResponse } from "~/api/generated-api";

type CourseExperienceContextValue = {
  course: GetCourseResponse["data"];
  isCourseStudentModeActive: boolean;
  isPreviewMode: boolean;
  isEffectiveStudentExperience: boolean;
  canEditCourse: boolean;
  isAdminExperience: boolean;
};

type CourseExperienceResolverParams = {
  course: GetCourseResponse["data"];
  forcePreviewMode: boolean;
  currentUserId?: string;
  canUseLearningMode: boolean;
  canUpdateLearningProgress: boolean;
  canEditCourse?: boolean;
  activeLearningModeCourseIds: string[];
};

type CourseUpdateAccessParams = {
  authorId?: string;
  currentUserId?: string;
  permissions: readonly PermissionKey[];
};

const CourseExperienceContext = createContext<CourseExperienceContextValue | null>(null);

type CourseAccessProviderProps = PropsWithChildren<{
  course: GetCourseResponse["data"];
  forcePreviewMode?: boolean;
}>;

export function canUpdateCourseByAuthor({
  authorId,
  currentUserId,
  permissions,
}: CourseUpdateAccessParams): boolean {
  const canUpdateAnyCourse = hasPermission(permissions, PERMISSIONS.COURSE_UPDATE);
  const canUpdateOwnCourse = hasPermission(permissions, PERMISSIONS.COURSE_UPDATE_OWN);
  const isCourseAuthor = Boolean(authorId && currentUserId && currentUserId === authorId);

  return canUpdateAnyCourse || (canUpdateOwnCourse && isCourseAuthor);
}

export function resolveCourseExperienceState({
  course,
  forcePreviewMode,
  currentUserId,
  canUseLearningMode,
  canUpdateLearningProgress,
  canEditCourse = false,
  activeLearningModeCourseIds,
}: CourseExperienceResolverParams): CourseExperienceContextValue {
  const isCourseStudentModeActive =
    !forcePreviewMode && canUseLearningMode && activeLearningModeCourseIds.includes(course.id);

  const isCourseAuthor = currentUserId === course.authorId;

  const canLearnByEnrollment =
    canUpdateLearningProgress && !isCourseAuthor && Boolean(course.enrolled);

  const canLearnByLearningMode = canUseLearningMode && isCourseStudentModeActive;

  const isPreviewMode =
    forcePreviewMode ||
    !currentUserId ||
    (canUseLearningMode && !canLearnByLearningMode && !canLearnByEnrollment);

  const isEffectiveStudentExperience =
    !isPreviewMode && (canLearnByEnrollment || canLearnByLearningMode || canUpdateLearningProgress);
  const isAdminExperience = canEditCourse && !isCourseStudentModeActive;

  return {
    course,
    isCourseStudentModeActive,
    isPreviewMode,
    isEffectiveStudentExperience,
    canEditCourse,
    isAdminExperience,
  };
}

export function CourseAccessProvider({
  course,
  forcePreviewMode = false,
  children,
}: CourseAccessProviderProps) {
  const { data: currentUser } = useCurrentUser();
  const { mutate: markCourseOpened } = useMarkCourseOpened();

  const permissions = currentUser?.permissions ?? [];
  const canUseLearningMode = hasPermission(permissions, PERMISSIONS.LEARNING_MODE_USE);
  const canUpdateLearningProgress = hasPermission(
    permissions,
    PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  );
  const canEditCourse = canUpdateCourseByAuthor({
    authorId: course.authorId,
    currentUserId: currentUser?.id,
    permissions,
  });

  const value = useMemo(() => {
    return resolveCourseExperienceState({
      course,
      forcePreviewMode,
      currentUserId: currentUser?.id,
      canUseLearningMode,
      canUpdateLearningProgress,
      canEditCourse,
      activeLearningModeCourseIds: currentUser?.studentModeCourseIds ?? [],
    });
  }, [
    course,
    currentUser?.id,
    currentUser?.studentModeCourseIds,
    forcePreviewMode,
    canUseLearningMode,
    canUpdateLearningProgress,
    canEditCourse,
  ]);

  useEffect(() => {
    if (!course.enrolled || !value.isEffectiveStudentExperience) return;

    markCourseOpened(course.id);
  }, [course.enrolled, course.id, markCourseOpened, value.isEffectiveStudentExperience]);

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
