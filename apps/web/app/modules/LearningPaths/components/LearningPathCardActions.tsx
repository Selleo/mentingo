import { CheckCircle2, Trash, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { LearningPathEnrollmentDrawer } from "~/modules/LearningPaths/components/LearningPathEnrollmentDrawer";
import { LearningPathSettingsDrawer } from "~/modules/LearningPaths/components/LearningPathSettingsDrawer";

import type { FormEvent } from "react";
import type { GetLearningPathsResponse, UpdateLearningPathBody } from "~/api/generated-api";
import type { Option } from "~/components/ui/multiselect";

type LearningPathListItem = GetLearningPathsResponse["data"][number];

type LearningPathCardActionsProps = {
  canEdit: boolean;
  canDelete: boolean;
  canManageEnrollment: boolean;
  learningPathId: string;
  canPlayCourses: boolean;
  isPending: boolean;
  isEnrolled: boolean;
  groupOptions: Option[];
  status: LearningPathListItem["status"];
  sequenceEnabled: boolean;
  includesCertificate: boolean;
  onEnrollCurrentUser?: () => Promise<void>;
  onDelete: () => Promise<void> | void;
  onEnrollStudents?: (studentIds: string[]) => Promise<void>;
  onEnrollGroups?: (groupIds: string[]) => Promise<void>;
  onUnenrollStudents?: (studentIds: string[]) => Promise<void>;
  onUnenrollGroups?: (groupIds: string[]) => Promise<void>;
  onStatusChange: (status: UpdateLearningPathBody["status"]) => Promise<void> | void;
  onSequenceEnabledChange: (sequenceEnabled: boolean) => Promise<void> | void;
  onCertificateChange: (includesCertificate: boolean) => Promise<void> | void;
};

export function LearningPathCardActions({
  canEdit,
  canDelete,
  canManageEnrollment,
  learningPathId,
  canPlayCourses: _canPlayCourses,
  isPending,
  isEnrolled,
  groupOptions,
  status,
  sequenceEnabled,
  includesCertificate,
  onEnrollCurrentUser,
  onDelete,
  onEnrollStudents,
  onEnrollGroups,
  onUnenrollStudents,
  onUnenrollGroups,
  onStatusChange,
  onSequenceEnabledChange,
  onCertificateChange,
}: LearningPathCardActionsProps) {
  const { t } = useTranslation();

  const submitDelete = async (event: FormEvent) => {
    event.preventDefault();
    await onDelete();
  };

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
      {canEdit || canDelete || canManageEnrollment ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {canManageEnrollment &&
            !!onEnrollStudents &&
            !!onEnrollGroups &&
            !!onUnenrollStudents &&
            !!onUnenrollGroups && (
              <LearningPathEnrollmentDrawer
                learningPathId={learningPathId}
                groupOptions={groupOptions}
                isPending={isPending}
                onEnrollStudents={onEnrollStudents}
                onEnrollGroups={onEnrollGroups}
                onUnenrollStudents={onUnenrollStudents}
                onUnenrollGroups={onUnenrollGroups}
              />
            )}
          {canEdit && (
            <LearningPathSettingsDrawer
              status={status}
              sequenceEnabled={sequenceEnabled}
              includesCertificate={includesCertificate}
              isPending={isPending}
              onStatusChange={onStatusChange}
              onSequenceEnabledChange={onSequenceEnabledChange}
              onCertificateChange={onCertificateChange}
            />
          )}
          {canDelete && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={isPending}
                  className="border-error-200 text-error-600 hover:border-error-400 hover:text-error-700"
                  aria-label={t("common.button.delete")}
                >
                  <Trash className="size-4 text-current" />
                </Button>
              </DialogTrigger>
              <DialogPortal>
                <DialogOverlay className="bg-primary-400 opacity-65" />
                <DialogContent className="max-w-md">
                  <DialogTitle className="text-xl font-semibold text-neutral-900">
                    {t("adminLearningPathsView.deleteModal.title")}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm text-neutral-600">
                    {t("adminLearningPathsView.deleteModal.description")}
                  </DialogDescription>
                  <form onSubmit={submitDelete} className="mt-6 flex justify-end gap-4">
                    <DialogClose asChild>
                      <Button variant="ghost" type="button" className="text-primary-800">
                        {t("common.button.cancel")}
                      </Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button type="submit" className="bg-error-500 text-white hover:bg-error-600">
                        {t("common.button.delete")}
                      </Button>
                    </DialogClose>
                  </form>
                </DialogContent>
              </DialogPortal>
            </Dialog>
          )}
        </div>
      ) : (
        <>
          {isEnrolled && (
            <Badge variant="success" className="gap-1.5">
              <CheckCircle2 className="size-3.5" />
              {t("learningPathsView.enrollment.enrolled")}
            </Badge>
          )}
          {!isEnrolled && (
            <Button
              type="button"
              variant="primary"
              className="gap-2"
              disabled={isPending || !onEnrollCurrentUser}
              onClick={() => {
                void onEnrollCurrentUser?.();
              }}
            >
              <UserPlus className="size-4" />
              {t("learningPathsView.enrollment.enroll")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
