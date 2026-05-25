import { CERTIFICATE_RESET_SCOPES, type CertificateResetScope } from "@repo/shared";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useResetCourseCertificates } from "~/api/mutations/useResetCourseCertificates";
import { useCertificateResetOptions } from "~/api/queries/useCertificateResetOptions";
import { useCertificateResetUsersSuspense } from "~/api/queries/useCertificateResetUsers";
import { Button } from "~/components/ui/button";
import { useDebounce } from "~/hooks/useDebounce";
import { usePaginationReducer } from "~/hooks/usePaginationReducer";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { CertificateResetDialog } from "./CertificateResetDialog";

import type { CertificateResetGroup } from "./CertificateResetDialog.types";

type CertificateResetSectionProps = {
  courseId: string;
  disabled: boolean;
};

const EMPTY_RESET_GROUPS: CertificateResetGroup[] = [];

export function CertificateResetSection({ courseId, disabled }: CertificateResetSectionProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);

  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetScope, setResetScope] = useState<CertificateResetScope>(CERTIFICATE_RESET_SCOPES.ALL);

  const [sendResetEmail, setSendResetEmail] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const {
    pagination: { page: usersPage, perPage: usersPerPage, search: usersSearch },
    setPage: setUsersPage,
    setPerPage: setUsersPerPage,
    setSearch: setUsersSearch,
    resetPagination: resetUsersPagination,
  } = usePaginationReducer();

  const debouncedUsersSearch = useDebounce(usersSearch, 300);

  const { mutate: resetCourseCertificates, isPending: isResettingCertificates } =
    useResetCourseCertificates();

  const { data: resetOptions } = useCertificateResetOptions(
    courseId,
    language,
    isResetDialogOpen && !!courseId,
  );

  const { groups = EMPTY_RESET_GROUPS, activeCertificateUserCount = 0 } = resetOptions ?? {};

  const {
    data: {
      users = [],
      pagination: { totalItems: usersTotalItems = 0 },
    },
    isFetching: isLoadingResetUsers,
  } = useCertificateResetUsersSuspense(
    {
      courseId,
      language,
      page: usersPage,
      perPage: usersPerPage,
      search: debouncedUsersSearch || undefined,
    },
    {
      enabled:
        isResetDialogOpen && resetScope === CERTIFICATE_RESET_SCOPES.USERS && Boolean(courseId),
    },
  );

  const enabledGroupIds = useMemo(() => new Set(groups.map((group) => group.id)), [groups]);

  const disabledResetScopes = useMemo(
    () => ({
      [CERTIFICATE_RESET_SCOPES.ALL]: false,
      [CERTIFICATE_RESET_SCOPES.GROUPS]: groups.length === 0,
      [CERTIFICATE_RESET_SCOPES.USERS]: activeCertificateUserCount === 0,
    }),
    [activeCertificateUserCount, groups.length],
  );

  const toggleGroupSelection = useCallback(
    (groupId: string) => {
      if (!enabledGroupIds.has(groupId)) return;

      setSelectedGroupIds((ids) =>
        ids.includes(groupId) ? ids.filter((id) => id !== groupId) : [...ids, groupId],
      );
    },
    [enabledGroupIds],
  );

  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUserIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId],
    );
  }, []);

  useEffect(() => {
    setSelectedGroupIds((ids) => {
      const enabledIds = ids.filter((id) => enabledGroupIds.has(id));

      return enabledIds.length === ids.length ? ids : enabledIds;
    });
  }, [enabledGroupIds]);

  useEffect(() => {
    if (!disabledResetScopes[resetScope]) return;

    setResetScope(CERTIFICATE_RESET_SCOPES.ALL);
  }, [disabledResetScopes, resetScope]);

  const canSubmitReset =
    resetScope === CERTIFICATE_RESET_SCOPES.ALL ||
    (resetScope === CERTIFICATE_RESET_SCOPES.GROUPS && selectedGroupIds.length > 0) ||
    (resetScope === CERTIFICATE_RESET_SCOPES.USERS && selectedUserIds.length > 0);

  const resetDialogState = () => {
    setSelectedGroupIds([]);
    setSelectedUserIds([]);
    setResetScope(CERTIFICATE_RESET_SCOPES.ALL);
    setSendResetEmail(true);
    resetUsersPagination();
  };

  const handleResetCertificates = () => {
    resetCourseCertificates(
      {
        courseId,
        data: {
          scope: resetScope,
          ...(resetScope === CERTIFICATE_RESET_SCOPES.GROUPS && { groupIds: selectedGroupIds }),
          ...(resetScope === CERTIFICATE_RESET_SCOPES.USERS && { userIds: selectedUserIds }),
          sendEmail: sendResetEmail,
        },
      },
      {
        onSuccess: () => {
          setIsResetDialogOpen(false);
          resetDialogState();
        },
      },
    );
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-neutral-950">
            {t("adminCourseView.settings.other.resetCertificates")}
          </p>
          <p className="text-sm text-neutral-700">
            {t("adminCourseView.settings.other.resetCertificatesDescription")}
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={disabled}
          onClick={() => setIsResetDialogOpen(true)}
        >
          <RotateCcw className="mr-2 size-4" />
          {t("adminCourseView.settings.button.resetCertificates")}
        </Button>
      </div>

      <CertificateResetDialog
        open={isResetDialogOpen}
        resetScope={resetScope}
        groups={groups}
        users={users}
        usersTotalItems={usersTotalItems}
        usersPage={usersPage}
        usersPerPage={usersPerPage}
        usersSearch={usersSearch}
        isLoadingUsers={isLoadingResetUsers}
        selectedGroupIds={selectedGroupIds}
        selectedUserIds={selectedUserIds}
        disabledScopes={disabledResetScopes}
        sendResetEmail={sendResetEmail}
        canSubmitReset={canSubmitReset}
        isResettingCertificates={isResettingCertificates}
        onOpenChange={setIsResetDialogOpen}
        onResetScopeChange={setResetScope}
        onToggleGroup={toggleGroupSelection}
        onToggleUser={toggleUserSelection}
        onUsersPageChange={setUsersPage}
        onUsersPerPageChange={setUsersPerPage}
        onUsersSearchChange={setUsersSearch}
        onSendResetEmailChange={setSendResetEmail}
        onSubmit={handleResetCertificates}
      />
    </>
  );
}
