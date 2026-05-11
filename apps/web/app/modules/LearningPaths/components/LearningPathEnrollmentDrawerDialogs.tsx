import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "~/components/ui/dialog";
import MultipleSelector, { type Option } from "~/components/ui/multiselect";

import { LEARNING_PATH_GROUP_ACTIONS } from "./learningPathEnrollment.types";

import type { LearningPathGroupAction } from "./learningPathEnrollment.types";

type LearningPathEnrollmentDrawerDialogsProps = {
  hasGroups: boolean;
  isPending: boolean;
  selectedNotEnrolledCount: number;
  selectedEnrolledCount: number;
  selectedGroups: Option[];
  groupOptions: Option[];
  groupAction: LearningPathGroupAction | null;
  isEnrollUsersDialogOpen: boolean;
  isUnenrollUsersDialogOpen: boolean;
  onEnrollUsersOpenChange: (open: boolean) => void;
  onUnenrollUsersOpenChange: (open: boolean) => void;
  onSelectedGroupsChange: (groups: Option[]) => void;
  onCloseGroupAction: () => void;
  onConfirmEnrollUsers: () => Promise<void> | void;
  onConfirmUnenrollUsers: () => Promise<void> | void;
  onConfirmGroupAction: () => Promise<void> | void;
};

export function LearningPathEnrollmentDrawerDialogs({
  hasGroups,
  isPending,
  selectedNotEnrolledCount,
  selectedEnrolledCount,
  selectedGroups,
  groupOptions,
  groupAction,
  isEnrollUsersDialogOpen,
  isUnenrollUsersDialogOpen,
  onEnrollUsersOpenChange,
  onUnenrollUsersOpenChange,
  onSelectedGroupsChange,
  onCloseGroupAction,
  onConfirmEnrollUsers,
  onConfirmUnenrollUsers,
  onConfirmGroupAction,
}: LearningPathEnrollmentDrawerDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Dialog open={isEnrollUsersDialogOpen} onOpenChange={onEnrollUsersOpenChange}>
        <DialogPortal>
          <DialogOverlay className="bg-primary-400 opacity-65" />
          <DialogContent>
            <DialogTitle>{t("learningPathsView.enrollment.confirmation.title")}</DialogTitle>
            <DialogDescription>
              {t("learningPathsView.enrollment.confirmation.description")}
            </DialogDescription>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!selectedNotEnrolledCount || isPending}
                onClick={onConfirmEnrollUsers}
              >
                {t("common.button.save")}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <Dialog open={isUnenrollUsersDialogOpen} onOpenChange={onUnenrollUsersOpenChange}>
        <DialogPortal>
          <DialogOverlay className="bg-primary-400 opacity-65" />
          <DialogContent>
            <DialogTitle>
              {t("learningPathsView.enrollment.unenrollConfirmation.title")}
            </DialogTitle>
            <DialogDescription>
              {t("learningPathsView.enrollment.unenrollConfirmation.description")}
            </DialogDescription>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!selectedEnrolledCount || isPending}
                onClick={onConfirmUnenrollUsers}
              >
                {t("common.button.save")}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <Dialog
        open={groupAction !== null}
        onOpenChange={(open) => {
          if (!open) onCloseGroupAction();
        }}
      >
        <DialogPortal>
          <DialogOverlay className="bg-primary-400 opacity-65" />
          <DialogContent>
            <DialogTitle>
              {groupAction === LEARNING_PATH_GROUP_ACTIONS.UNENROLL
                ? t("learningPathsView.enrollment.unenrollGroups")
                : t("learningPathsView.enrollment.enrollGroups")}
            </DialogTitle>
            <DialogDescription>
              {groupAction === LEARNING_PATH_GROUP_ACTIONS.UNENROLL
                ? t("learningPathsView.enrollment.unenrollGroupsDescription")
                : t("learningPathsView.enrollment.enrollGroupsDescription")}
            </DialogDescription>
            <div className="mt-4">
              <MultipleSelector
                value={selectedGroups}
                options={groupOptions}
                onChange={onSelectedGroupsChange}
                placeholder={
                  hasGroups
                    ? t("learningPathsView.enrollment.selectGroups")
                    : t("learningPathsView.enrollment.noGroups")
                }
                className="min-h-10 bg-white"
                maxSelectedVisible={3}
                disabled={!hasGroups || isPending}
              />
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                disabled={!hasGroups || !selectedGroups.length || isPending}
                onClick={onConfirmGroupAction}
              >
                {t("common.button.save")}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}
