import { UserPlus, X } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  LEARNING_PATH_ENROLLED_USERS_QUERY_KEY,
  useLearningPathEnrolledUsers,
  type LearningPathEnrolledUsersSearchParams,
} from "~/api/queries/useLearningPathEnrolledUsers";
import { queryClient } from "~/api/queryClient";
import {
  ITEMS_PER_PAGE_OPTIONS,
  Pagination,
  type ItemsPerPageOption,
} from "~/components/Pagination/Pagination";
import { Button } from "~/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { LearningPathEnrollmentControls } from "~/modules/LearningPaths/components/LearningPathEnrollmentControls";
import { LearningPathEnrollmentDrawerDialogs } from "~/modules/LearningPaths/components/LearningPathEnrollmentDrawerDialogs";
import { LearningPathEnrollmentTable } from "~/modules/LearningPaths/components/LearningPathEnrollmentTable";

import type { Option } from "~/components/ui/multiselect";
import type { FilterConfig, FilterValue } from "~/modules/common/SearchFilter/SearchFilter";

type LearningPathEnrollmentDrawerProps = {
  learningPathId: string;
  groupOptions: Option[];
  isPending: boolean;
  onEnrollStudents: (studentIds: string[]) => Promise<void>;
  onEnrollGroups: (groupIds: string[]) => Promise<void>;
  onUnenrollStudents: (studentIds: string[]) => Promise<void>;
  onUnenrollGroups: (groupIds: string[]) => Promise<void>;
};

export function LearningPathEnrollmentDrawer({
  learningPathId,
  groupOptions,
  isPending,
  onEnrollStudents,
  onEnrollGroups,
  onUnenrollStudents,
  onUnenrollGroups,
}: LearningPathEnrollmentDrawerProps) {
  const { t } = useTranslation();
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [selectedGroups, setSelectedGroups] = useState<Option[]>([]);
  const [groupAction, setGroupAction] = useState<"enroll" | "unenroll" | null>(null);
  const [isEnrollUsersDialogOpen, setIsEnrollUsersDialogOpen] = useState(false);
  const [isUnenrollUsersDialogOpen, setIsUnenrollUsersDialogOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [searchParams, setSearchParams] = useState<LearningPathEnrolledUsersSearchParams>({
    page: 1,
    perPage: ITEMS_PER_PAGE_OPTIONS[0],
    sort: "enrolledAt",
  });

  const { data: usersResponse, isFetching } = useLearningPathEnrolledUsers(
    learningPathId,
    searchParams,
  );

  const users = usersResponse?.data ?? [];
  const pagination = usersResponse?.pagination;
  const selectedStudentIds = Object.keys(selectedRows).filter((id) => selectedRows[id]);
  const selectedNotEnrolledIds = selectedStudentIds.filter((id) =>
    users.some((user) => user.id === id && !user.enrolledAt),
  );
  const selectedEnrolledIds = selectedStudentIds.filter((id) =>
    users.some((user) => user.id === id && user.enrolledAt),
  );
  const allPageSelected = users.length > 0 && users.every((user) => selectedRows[user.id]);
  const hasGroups = groupOptions.length > 0;

  const filterConfig: FilterConfig[] = useMemo(
    () => [
      {
        type: "text",
        name: "keyword",
        placeholder: t("learningPathsView.enrollment.filters.placeholder.searchByKeyword"),
      },
      {
        type: "multiselect",
        name: "groups",
        placeholder: t("adminUsersView.filters.placeholder.groups"),
        options: groupOptions,
        disabled: !hasGroups,
      },
    ],
    [groupOptions, hasGroups, t],
  );

  useEffect(() => {
    if (hasGroups) return;

    setSelectedGroups([]);
    setSearchParams((current) => ({ ...current, groups: undefined }));
  }, [hasGroups]);

  const handleFilterChange = (name: string, value: FilterValue) => {
    startTransition(() => {
      setSearchParams((current) => ({
        ...current,
        [name]: value,
        page: 1,
      }));
    });
  };

  const invalidateEnrollment = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [LEARNING_PATH_ENROLLED_USERS_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["learning-paths"] }),
    ]);
  };

  const handleEnrollSelectedStudents = async () => {
    if (!selectedNotEnrolledIds.length) return;

    await onEnrollStudents(selectedNotEnrolledIds);
    setSelectedRows({});
    setIsEnrollUsersDialogOpen(false);
    await invalidateEnrollment();
  };

  const handleUnenrollSelectedStudents = async () => {
    if (!selectedEnrolledIds.length) return;

    await onUnenrollStudents(selectedEnrolledIds);
    setSelectedRows({});
    setIsUnenrollUsersDialogOpen(false);
    await invalidateEnrollment();
  };

  const handleGroupAction = async () => {
    if (!selectedGroups.length) return;

    const groupIds = selectedGroups.map((group) => group.value);

    if (groupAction === "enroll") {
      await onEnrollGroups(groupIds);
    }

    if (groupAction === "unenroll") {
      await onUnenrollGroups(groupIds);
    }

    setSelectedGroups([]);
    setGroupAction(null);
    await invalidateEnrollment();
  };

  const handleToggleAllRows = (checked: boolean) => {
    setSelectedRows((current) => ({
      ...current,
      ...Object.fromEntries(users.map((user) => [user.id, Boolean(checked)])),
    }));
  };

  const handleToggleRow = (userId: string, checked: boolean) => {
    setSelectedRows((current) => ({
      ...current,
      [userId]: checked,
    }));
  };

  const page = pagination?.page ?? searchParams.page ?? 1;
  const perPage = (pagination?.perPage ??
    searchParams.perPage ??
    ITEMS_PER_PAGE_OPTIONS[0]) as ItemsPerPageOption;
  const totalItems = pagination?.totalItems ?? users.length;

  const filterValues = useMemo(
    () => ({
      ...searchParams,
      page: String(searchParams.page ?? 1),
      perPage: String(searchParams.perPage ?? ITEMS_PER_PAGE_OPTIONS[0]),
    }),
    [searchParams],
  );

  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={isPending}
          aria-label={t("learningPathsView.enrollment.manage")}
        >
          <UserPlus className="size-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bottom-0 left-auto right-0 top-0 mt-0 h-full w-full max-w-[960px] rounded-none border-l border-primary-100 bg-white p-0 shadow-xl [&>div:first-child]:hidden">
        <div className="flex items-start justify-between gap-4 border-b border-primary-100 px-6 py-6">
          <div>
            <DrawerTitle className="body-base-md text-primary-950">
              {t("learningPathsView.enrollment.title")}
            </DrawerTitle>
            <DrawerDescription className="details-md mt-1 text-neutral-600">
              {t("learningPathsView.enrollment.description")}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button type="button" variant="ghost" size="icon" className="shrink-0">
              <X className="size-5" />
            </Button>
          </DrawerClose>
        </div>

        <div className="flex h-full min-h-0 flex-col gap-5 px-6 py-6">
          <LearningPathEnrollmentControls
            isPending={isPending}
            filterConfig={filterConfig}
            filterValues={filterValues}
            isLoading={isFetching}
            hasGroups={hasGroups}
            selectedNotEnrolledCount={selectedNotEnrolledIds.length}
            selectedEnrolledCount={selectedEnrolledIds.length}
            isUserDropdownOpen={isUserDropdownOpen}
            isGroupDropdownOpen={isGroupDropdownOpen}
            onFilterChange={handleFilterChange}
            setIsUserDropdownOpen={setIsUserDropdownOpen}
            setIsGroupDropdownOpen={setIsGroupDropdownOpen}
            onOpenUserEnroll={() => setIsEnrollUsersDialogOpen(true)}
            onOpenUserUnenroll={() => setIsUnenrollUsersDialogOpen(true)}
            onOpenGroupEnroll={() => setGroupAction("enroll")}
            onOpenGroupUnenroll={() => setGroupAction("unenroll")}
          />

          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-neutral-200">
            <LearningPathEnrollmentTable
              users={users}
              selectedRows={selectedRows}
              isPending={isPending}
              allPageSelected={allPageSelected}
              onToggleAllRows={handleToggleAllRows}
              onToggleRow={handleToggleRow}
            />
          </div>

          <Pagination
            currentPage={page}
            itemsPerPage={perPage}
            totalItems={totalItems}
            onPageChange={(nextPage) =>
              startTransition(() => setSearchParams((current) => ({ ...current, page: nextPage })))
            }
            onItemsPerPageChange={(itemsPerPageValue) => {
              const parsedPerPage = Number(itemsPerPageValue);
              startTransition(() =>
                setSearchParams((current) => ({
                  ...current,
                  perPage: Number.isNaN(parsedPerPage) ? ITEMS_PER_PAGE_OPTIONS[0] : parsedPerPage,
                  page: 1,
                })),
              );
            }}
          />
        </div>

        <LearningPathEnrollmentDrawerDialogs
          hasGroups={hasGroups}
          isPending={isPending}
          selectedNotEnrolledCount={selectedNotEnrolledIds.length}
          selectedEnrolledCount={selectedEnrolledIds.length}
          selectedGroups={selectedGroups}
          groupOptions={groupOptions}
          groupAction={groupAction}
          isEnrollUsersDialogOpen={isEnrollUsersDialogOpen}
          isUnenrollUsersDialogOpen={isUnenrollUsersDialogOpen}
          onEnrollUsersOpenChange={setIsEnrollUsersDialogOpen}
          onUnenrollUsersOpenChange={setIsUnenrollUsersDialogOpen}
          onSelectedGroupsChange={setSelectedGroups}
          onCloseGroupAction={() => {
            setGroupAction(null);
            setSelectedGroups([]);
          }}
          onConfirmEnrollUsers={handleEnrollSelectedStudents}
          onConfirmUnenrollUsers={handleUnenrollSelectedStudents}
          onConfirmGroupAction={handleGroupAction}
        />
      </DrawerContent>
    </Drawer>
  );
}
