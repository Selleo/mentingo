import { useNavigate, useParams } from "@remix-run/react";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteLiveTraining } from "~/api/mutations/live-training/useDeleteLiveTraining";
import { useUpdateLiveTraining } from "~/api/mutations/live-training/useUpdateLiveTraining";
import { useLiveTraining } from "~/api/queries/live-training/useLiveTraining";
import { useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
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
} from "~/modules/LiveTraining/utils/liveTrainingEditForm";

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

export default function LiveTrainingPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editFormState, setEditFormState] = useState<LiveTrainingEditFormState | null>(null);
  const language = useLanguageStore((state) => state.language);
  const { data: currentUser } = useCurrentUserSuspense();
  const {
    data: liveTraining,
    isError,
    isLoading,
    error,
  } = useLiveTraining(id, language, {
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

  const isEditFormDirty = useMemo(() => {
    if (!liveTraining || !editFormState) return false;

    return isLiveTrainingEditFormDirty(liveTraining, editFormState, language);
  }, [editFormState, language, liveTraining]);

  useEffect(() => {
    if (!liveTraining) return;

    setEditFormState(buildLiveTrainingEditFormState(liveTraining, language));
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

  const handleSaveEdit = async () => {
    if (!id || !liveTraining || !editFormState || !isEditFormDirty || isUpdating) return;

    await updateLiveTraining({
      id,
      data: buildUpdateLiveTrainingPayload(editFormState, liveTraining.timezone),
    });
  };

  const handleDeleteLiveTraining = async () => {
    if (!id) return;

    await deleteLiveTraining({ id });
    setIsDeleteDialogOpen(false);
    navigate("/calendar");
  };

  useEffect(() => {
    if (!id) {
      navigate("/calendar", { replace: true });
      return;
    }

    if (!isError) return;

    const shouldRedirect =
      !isAxiosError(error) || error.response?.status === 400 || error.response?.status === 404;

    if (shouldRedirect) {
      navigate("/calendar", { replace: true });
    }
  }, [error, id, isError, navigate]);

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
            onEditFormStateChange={updateEditFormState}
            onEditPopoverClose={handleSaveEdit}
          />
          <LiveTrainingWorkspace liveTraining={liveTraining} />
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
