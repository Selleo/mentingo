import { useLoaderData, useSearchParams } from "@remix-run/react";
import { PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  useAddCoursesToLearningPath,
  useCreateLearningPath,
  useDeleteLearningPath,
  useEnrollGroupsToLearningPath,
  useEnrollUsersToLearningPath,
  useRemoveCourseFromLearningPath,
  useReorderLearningPathCourses,
  useUnenrollGroupsFromLearningPath,
  useUnenrollUsersFromLearningPath,
  useUpdateLearningPath,
} from "~/api/mutations/useLearningPathMutations";
import { useCurrentUserSuspense } from "~/api/queries";
import { useGroupsQuery } from "~/api/queries/admin/useGroups";
import { useLearningPaths } from "~/api/queries/useLearningPaths";
import { hasPermission } from "~/common/permissions/permission.utils";
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { LearningPathListItem } from "../types";
import type { CreateLearningPathBody, GetLearningPathsResponse } from "~/api/generated-api";

export function useAdminLearningPathsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("searchQuery") ?? "";

  const loaderLearningPaths = useLoaderData<GetLearningPathsResponse>();

  const appLanguage = useLanguageStore((state) => state.language);

  const { data: currentUser } = useCurrentUserSuspense();
  const { permissions } = usePermissions();

  const [pathLanguages, setPathLanguages] = useState<Record<string, SupportedLanguages>>({});
  const [createLanguage, setCreateLanguage] = useState<SupportedLanguages>(appLanguage);

  const [isCreateOpen, setIsCreateOpen] = useState(searchParams.get("create") === "1");
  const createCardRef = useRef<HTMLDivElement | null>(null);

  const { data: learningPaths = loaderLearningPaths } = useLearningPaths({
    language: appLanguage,
    searchQuery,
  });

  const { data: groups = [] } = useGroupsQuery({ language: appLanguage });

  const { mutateAsync: createLearningPath, isPending: isCreatePending } = useCreateLearningPath();
  const { mutateAsync: updateLearningPath, isPending: isUpdatePending } = useUpdateLearningPath();
  const { mutateAsync: deleteLearningPath, isPending: isDeletePending } = useDeleteLearningPath();
  const { mutateAsync: addCoursesToLearningPath, isPending: isAddPending } =
    useAddCoursesToLearningPath();
  const { mutateAsync: removeCourseFromLearningPath, isPending: isRemovePending } =
    useRemoveCourseFromLearningPath();
  const { mutateAsync: reorderLearningPathCourses, isPending: isReorderPending } =
    useReorderLearningPathCourses();
  const { mutateAsync: enrollUsersToLearningPath, isPending: isEnrollUsersPending } =
    useEnrollUsersToLearningPath();
  const { mutateAsync: enrollGroupsToLearningPath, isPending: isEnrollGroupsPending } =
    useEnrollGroupsToLearningPath();
  const { mutateAsync: unenrollUsersFromLearningPath, isPending: isUnenrollUsersPending } =
    useUnenrollUsersFromLearningPath();
  const { mutateAsync: unenrollGroupsFromLearningPath, isPending: isUnenrollGroupsPending } =
    useUnenrollGroupsFromLearningPath();

  const canCreateLearningPaths = hasPermission(permissions, PERMISSIONS.LEARNING_PATH_CREATE);
  const canDeleteLearningPaths = hasPermission(permissions, PERMISSIONS.LEARNING_PATH_DELETE);
  const canManageLearningPathEnrollment = hasPermission(
    permissions,
    PERMISSIONS.LEARNING_PATH_ENROLLMENT,
  );
  const canEditAnyLearningPath = hasPermission(permissions, PERMISSIONS.LEARNING_PATH_UPDATE);
  const canEditOwnLearningPaths = hasPermission(permissions, PERMISSIONS.LEARNING_PATH_UPDATE_OWN);
  const canUpdateAnyLearningPathCourses = hasPermission(
    permissions,
    PERMISSIONS.LEARNING_PATH_COURSE_UPDATE,
  );
  const canUpdateOwnLearningPathCourses = hasPermission(
    permissions,
    PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN,
  );
  const canExportLearningPath =
    hasPermission(permissions, PERMISSIONS.LEARNING_PATH_EXPORT) &&
    Boolean(currentUser?.isManagingTenantAdmin);

  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        value: group.id,
        label: group.name,
      })),
    [groups],
  );

  useEffect(() => {
    setIsCreateOpen(searchParams.get("create") === "1");
  }, [searchParams]);

  useEffect(() => {
    if (!isCreateOpen) return;

    requestAnimationFrame(() => {
      createCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [isCreateOpen]);

  const openCreateCard = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("create", "1");
    setSearchParams(nextParams);
  };

  const closeCreateCard = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams);
    setIsCreateOpen(false);
  };

  const setPathLanguage = (learningPathId: string, language: SupportedLanguages) => {
    setPathLanguages((current) => ({ ...current, [learningPathId]: language }));
  };

  const getSelectedLanguage = (learningPathId: string) =>
    pathLanguages[learningPathId] ?? appLanguage;

  const canEditLearningPath = (learningPath: LearningPathListItem) =>
    canEditAnyLearningPath ||
    (canEditOwnLearningPaths && learningPath.authorId === currentUser?.id);

  const canUpdateLearningPathCourses = (learningPath: LearningPathListItem) =>
    canUpdateAnyLearningPathCourses ||
    (canUpdateOwnLearningPathCourses && learningPath.authorId === currentUser?.id);

  const create = async (data: CreateLearningPathBody) => {
    await createLearningPath(data);
    closeCreateCard();
  };

  return {
    appLanguage,
    learningPaths,
    totalPaths: learningPaths.pagination.totalItems,
    createLanguage,
    setCreateLanguage,
    createCardRef,
    isCreateOpen,
    openCreateCard,
    closeCreateCard,
    groupOptions,
    getSelectedLanguage,
    setPathLanguage,
    canCreateLearningPaths,
    canDeleteLearningPaths,
    canManageLearningPathEnrollment,
    canExportLearningPath,
    canEditLearningPath,
    canUpdateLearningPathCourses,
    create,
    updateLearningPath,
    deleteLearningPath,
    addCoursesToLearningPath,
    removeCourseFromLearningPath,
    reorderLearningPathCourses,
    enrollUsersToLearningPath,
    enrollGroupsToLearningPath,
    unenrollUsersFromLearningPath,
    unenrollGroupsFromLearningPath,
    isCreatePending,
    isMutationPending:
      isCreatePending ||
      isUpdatePending ||
      isDeletePending ||
      isAddPending ||
      isRemovePending ||
      isReorderPending ||
      isEnrollUsersPending ||
      isEnrollGroupsPending ||
      isUnenrollUsersPending ||
      isUnenrollGroupsPending,
  };
}
