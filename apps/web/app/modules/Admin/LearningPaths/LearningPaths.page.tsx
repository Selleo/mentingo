import {
  useLoaderData,
  useSearchParams,
  type ClientLoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/react";
import { PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { learningPathsQueryOptions, useLearningPaths } from "~/api/queries/useLearningPaths";
import { queryClient } from "~/api/queryClient";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useToast } from "~/components/ui/use-toast";
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { InlineLearningPathCard } from "~/modules/LearningPaths/components/InlineLearningPathCard";
import { setPageTitle } from "~/utils/setPageTitle";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../../e2e/data/learning-paths/handles";

import { CreateLearningPathCard } from "./components/CreateLearningPathCard";

import type { LearningPathListItem } from "./types";
import type { CreateLearningPathBody } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.adminLearningPaths");

export const clientLoader = async (_: ClientLoaderFunctionArgs) => {
  const { language } = useLanguageStore.getState();

  return queryClient.fetchQuery(learningPathsQueryOptions({ language }));
};

const invalidateLearningPaths = async () => {
  await queryClient.invalidateQueries({ queryKey: ["learning-paths"] });
};

const invalidateCourses = async () => {
  await queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY });
};

export default function AdminLearningPathsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const loaderLearningPaths = useLoaderData<typeof clientLoader>();
  const { data: currentUser } = useCurrentUserSuspense();
  const { language: appLanguage } = useLanguageStore.getState();
  const { permissions } = usePermissions();
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
  const { data: learningPaths = loaderLearningPaths } = useLearningPaths({ language: appLanguage });
  const { data: groups = [] } = useGroupsQuery();
  const [pathLanguages, setPathLanguages] = useState<Record<string, SupportedLanguages>>({});
  const [createLanguage, setCreateLanguage] = useState<SupportedLanguages>(appLanguage);
  const [isCreateOpen, setIsCreateOpen] = useState(searchParams.get("create") === "1");
  const [searchValue, setSearchValue] = useState("");
  const createCardRef = useRef<HTMLDivElement | null>(null);

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

  const isMutationPending =
    isCreatePending ||
    isUpdatePending ||
    isDeletePending ||
    isAddPending ||
    isRemovePending ||
    isReorderPending ||
    isEnrollUsersPending ||
    isEnrollGroupsPending ||
    isUnenrollUsersPending ||
    isUnenrollGroupsPending;

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

  const handleCreateLearningPath = async (data: CreateLearningPathBody) => {
    await createLearningPath(data);
    await invalidateLearningPaths();
    toast({ description: t("adminLearningPathsView.toast.created") });
    closeCreateCard();
  };

  const handleUpdateLearningPath = async (
    learningPath: LearningPathListItem,
    data: Parameters<typeof updateLearningPath>[0]["data"],
  ) => {
    await updateLearningPath({
      learningPathId: learningPath.id,
      data,
    });
    await invalidateLearningPaths();
    toast({ description: t("adminLearningPathsView.toast.updated") });
  };

  const handleDeleteLearningPath = async (learningPathId: string) => {
    await deleteLearningPath(learningPathId);
    await invalidateLearningPaths();
    toast({ description: t("adminLearningPathsView.toast.deleted") });
  };

  const handleEnrollStudents = async (learningPathId: string, studentIds: string[]) => {
    await enrollUsersToLearningPath({
      learningPathId,
      data: { studentIds },
    });
    await invalidateLearningPaths();
    toast({ description: t("learningPathsView.enrollment.studentsEnrolled") });
  };

  const handleEnrollGroups = async (learningPathId: string, groupIds: string[]) => {
    await enrollGroupsToLearningPath({
      learningPathId,
      data: { groupIds },
    });
    await invalidateLearningPaths();
    toast({ description: t("learningPathsView.enrollment.groupsEnrolled") });
  };

  const handleUnenrollStudents = async (learningPathId: string, studentIds: string[]) => {
    await unenrollUsersFromLearningPath({
      learningPathId,
      data: { studentIds },
    });
    await invalidateLearningPaths();
    toast({ description: t("learningPathsView.enrollment.studentsUnenrolled") });
  };

  const handleUnenrollGroups = async (learningPathId: string, groupIds: string[]) => {
    await unenrollGroupsFromLearningPath({
      learningPathId,
      data: { groupIds },
    });
    await invalidateLearningPaths();
    toast({ description: t("learningPathsView.enrollment.groupsUnenrolled") });
  };

  const totalPaths = learningPaths.pagination.totalItems;
  const visibleLearningPaths = useMemo(() => {
    const normalizedSearchValue = searchValue.trim().toLowerCase();

    return learningPaths.data.filter((learningPath) => {
      if (!normalizedSearchValue) return true;

      return `${learningPath.title} ${learningPath.description}`
        .toLowerCase()
        .includes(normalizedSearchValue);
    });
  }, [learningPaths.data, searchValue]);

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminLearningPathsView.breadcrumbs.learningPaths"),
          href: "/learning-paths",
        },
      ]}
    >
      <section
        className="flex flex-col gap-6 md:gap-8"
        data-testid={LEARNING_PATHS_PAGE_HANDLES.ADMIN_PAGE}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col lg:p-0">
            <h4
              className="h4 pb-1 text-neutral-950"
              data-testid={LEARNING_PATHS_PAGE_HANDLES.HEADING}
            >
              {t("adminLearningPathsView.title")}
            </h4>
            <p className="body-lg-md text-neutral-800">{t("adminLearningPathsView.description")}</p>
            <p className="details-md mt-1 text-neutral-600">
              {t("adminLearningPathsView.summary", { count: totalPaths })}
            </p>
          </div>

          <div className="flex shrink-0 gap-3">
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={t("learningPathsView.searchPlaceholder")}
                className="h-10 pl-9 text-sm"
              />
            </div>
            {canCreateLearningPaths && (
              <Button type="button" variant="primary" className="gap-2" onClick={openCreateCard}>
                <Plus className="size-4" />
                {t("adminLearningPathsView.buttons.create")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {visibleLearningPaths.map((learningPath) => (
            <InlineLearningPathCard
              key={learningPath.id}
              learningPath={learningPath}
              canEdit={
                canEditAnyLearningPath ||
                (canEditOwnLearningPaths && learningPath.authorId === currentUser?.id)
              }
              canUpdateCourses={
                canUpdateAnyLearningPathCourses ||
                (canUpdateOwnLearningPathCourses && learningPath.authorId === currentUser?.id)
              }
              canDelete={canDeleteLearningPaths}
              canManageEnrollment={canManageLearningPathEnrollment}
              canExport={canExportLearningPath}
              currentLanguage={appLanguage}
              selectedLanguage={pathLanguages[learningPath.id] ?? appLanguage}
              onLanguageChange={(language) =>
                setPathLanguages((current) => ({ ...current, [learningPath.id]: language }))
              }
              onUpdate={(data) => handleUpdateLearningPath(learningPath, data)}
              onLanguageCreated={async () => {
                await invalidateLearningPaths();
                toast({ description: t("adminLearningPathsView.toast.languageCreated") });
              }}
              onDelete={() => handleDeleteLearningPath(learningPath.id)}
              onAddCourses={async (courseIds) => {
                await addCoursesToLearningPath({
                  learningPathId: learningPath.id,
                  data: { courseIds },
                });
                await Promise.all([invalidateLearningPaths(), invalidateCourses()]);
                toast({ description: t("adminLearningPathsView.toast.coursesAdded") });
              }}
              onRemoveCourse={async (courseId) => {
                await removeCourseFromLearningPath({ learningPathId: learningPath.id, courseId });
                await invalidateLearningPaths();
                toast({ description: t("adminLearningPathsView.toast.courseRemoved") });
              }}
              onReorderCourses={async (courseIds) => {
                await reorderLearningPathCourses({
                  learningPathId: learningPath.id,
                  data: { courseIds },
                });
                await invalidateLearningPaths();
                toast({ description: t("adminLearningPathsView.toast.coursesReordered") });
              }}
              onEnrollStudents={(studentIds) => handleEnrollStudents(learningPath.id, studentIds)}
              onEnrollGroups={(groupIds) => handleEnrollGroups(learningPath.id, groupIds)}
              onUnenrollStudents={(studentIds) =>
                handleUnenrollStudents(learningPath.id, studentIds)
              }
              onUnenrollGroups={(groupIds) => handleUnenrollGroups(learningPath.id, groupIds)}
              groupOptions={groupOptions}
              isPending={isMutationPending}
              showCourseProgress={false}
            />
          ))}

          {isCreateOpen && canCreateLearningPaths && (
            <div ref={createCardRef}>
              <CreateLearningPathCard
                language={createLanguage}
                onLanguageChange={setCreateLanguage}
                onCancel={closeCreateCard}
                onCreate={handleCreateLearningPath}
                isPending={isCreatePending}
              />
            </div>
          )}

          {!learningPaths.data.length && canCreateLearningPaths && !isCreateOpen && (
            <button
              type="button"
              className="rounded-xl border border-dashed border-primary-200 bg-primary-50/30 py-5 text-center text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
              onClick={openCreateCard}
            >
              <Plus className="mr-2 inline size-4" />
              {t("adminLearningPathsView.buttons.create")}
            </button>
          )}

          {learningPaths.data.length > 0 && canCreateLearningPaths && !isCreateOpen && (
            <button
              type="button"
              className="rounded-xl border border-dashed border-primary-200 bg-primary-50/30 py-5 text-center text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
              onClick={openCreateCard}
            >
              <Plus className="mr-2 inline size-4" />
              {t("adminLearningPathsView.buttons.create")}
            </button>
          )}
        </div>
      </section>
    </PageWrapper>
  );
}
