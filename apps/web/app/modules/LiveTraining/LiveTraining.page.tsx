import { redirect, useNavigate, useParams } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteLiveTraining } from "~/api/mutations/live-training/useDeleteLiveTraining";
import { useUpdateLiveTraining } from "~/api/mutations/live-training/useUpdateLiveTraining";
import { currentUserQueryOptions } from "~/api/queries";
import {
  liveTrainingQueryOptions,
  useLiveTraining,
} from "~/api/queries/live-training/useLiveTraining";
import { useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { Skeleton } from "~/components/ui/skeleton";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { LiveTrainingDeleteDialog } from "~/modules/LiveTraining/components/LiveTrainingDeleteDialog";
import { LiveTrainingSessionStage } from "~/modules/LiveTraining/components/LiveTrainingSessionStage";
import { LiveTrainingWorkspace } from "~/modules/LiveTraining/components/LiveTrainingWorkspace";
import { deriveLiveTrainingUiActions } from "~/modules/LiveTraining/utils/liveTrainingActions";
import {
  buildLiveTrainingEditFormState,
  buildUpdateLiveTrainingPayload,
  isLiveTrainingEditFormDirty,
  isLiveTrainingEditFormValid,
} from "~/modules/LiveTraining/utils/liveTrainingEditForm";
import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";

import type { ClientLoaderFunctionArgs } from "@remix-run/react";
import type { LiveTrainingEditFormState } from "~/modules/LiveTraining/liveTrainingEdit.types";

function LiveTrainingPageSkeleton() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-80 rounded-lg" />
      <Skeleton className="h-56 rounded-lg" />
    </div>
  );
}

export const clientLoader = async ({ params, request }: ClientLoaderFunctionArgs) => {
  const [currentUserResponse, globalSettingsResponse] = await Promise.all([
    queryClient.ensureQueryData(currentUserQueryOptions),
    queryClient.ensureQueryData(globalSettingsQueryOptions),
  ]);

  const currentUser = currentUserResponse?.data;
  const globalSettings = globalSettingsResponse?.data;

  if (!currentUser) {
    saveEntryToNavigationHistory(request);
    throw redirect("/auth/login");
  }

  const canReadLiveTraining =
    Boolean(globalSettings?.liveTrainingEnabled) &&
    hasPermission(currentUser.permissions, PERMISSIONS.LIVE_TRAINING_READ);

  if (!canReadLiveTraining) {
    throw redirect("/");
  }

  if (!params.id) {
    throw redirect("/calendar");
  }

  const { language } = useLanguageStore.getState();

  try {
    await queryClient.fetchQuery(liveTrainingQueryOptions(params.id, language, { retry: false }));
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      throw redirect("/");
    }

    if (!isAxiosError(error) || error.response?.status === 400 || error.response?.status === 404) {
      throw redirect("/calendar");
    }

    throw error;
  }

  return null;
};

export default function LiveTrainingPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editFormState, setEditFormState] = useState<LiveTrainingEditFormState | null>(null);
  const language = useLanguageStore((state) => state.language);
  const { data: currentUser } = useCurrentUserSuspense();
  const { data: liveTraining, isLoading } = useLiveTraining(id, language, {
    enabled: Boolean(id),
    retry: false,
  });
  const { mutateAsync: deleteLiveTraining, isPending: isDeleting } = useDeleteLiveTraining();
  const { mutateAsync: updateLiveTraining, isPending: isUpdating } = useUpdateLiveTraining();

  const actions = liveTraining
    ? deriveLiveTrainingUiActions({
        liveTraining,
        currentUserId: currentUser.id,
        permissions: currentUser.permissions,
      })
    : null;

  useEffect(() => {
    if (!liveTraining) return;

    setEditFormState(buildLiveTrainingEditFormState(liveTraining));
  }, [language, liveTraining]);

  const updateEditFormState = <Key extends keyof LiveTrainingEditFormState>(
    key: Key,
    value: LiveTrainingEditFormState[Key],
  ) => {
    setEditFormState((current) => {
      if (!current) return current;

      return { ...current, [key]: value };
    });
  };

  const commitEditFormState = async (nextFormState: LiveTrainingEditFormState) => {
    setEditFormState(nextFormState);

    if (!id || !liveTraining || isUpdating) return;
    if (!isLiveTrainingEditFormDirty(liveTraining, nextFormState)) return;
    if (!isLiveTrainingEditFormValid(nextFormState)) return;

    await updateLiveTraining({
      id,
      data: buildUpdateLiveTrainingPayload(nextFormState, liveTraining.timezone, language),
    });
  };

  const handleDeleteLiveTraining = async () => {
    if (!id) return;

    await deleteLiveTraining({ id });
    setIsDeleteDialogOpen(false);
    navigate("/calendar");
  };

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("calendarView.title"), href: "/calendar" },
        { title: t("liveTrainingView.title"), href: `/live-training/${id ?? ""}` },
      ]}
    >
      {isLoading && <LiveTrainingPageSkeleton />}

      {!isLoading && liveTraining && actions && (
        <div className="grid gap-5">
          <LiveTrainingSessionStage
            liveTraining={liveTraining}
            actions={actions}
            editFormState={editFormState}
            onDeleteClick={() => setIsDeleteDialogOpen(true)}
            onEditFormStateCommit={commitEditFormState}
            onEditFormStateChange={updateEditFormState}
          />
          <LiveTrainingWorkspace liveTraining={liveTraining} actions={actions} />
          <LiveTrainingDeleteDialog
            open={isDeleteDialogOpen}
            isDeleting={isDeleting}
            onOpenChange={setIsDeleteDialogOpen}
            onConfirm={handleDeleteLiveTraining}
          />
        </div>
      )}
    </PageWrapper>
  );
}
