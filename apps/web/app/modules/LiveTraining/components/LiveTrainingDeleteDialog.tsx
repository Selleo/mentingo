import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type LiveTrainingDeleteDialogProps = {
  open: boolean;
  isDeleting: boolean;
  linkedLessonCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
};

export function LiveTrainingDeleteDialog({
  open,
  isDeleting,
  linkedLessonCount,
  onOpenChange,
  onConfirm,
}: LiveTrainingDeleteDialogProps) {
  const { t } = useTranslation();
  const hasLinkedLessons = linkedLessonCount > 0;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold text-neutral-950">
            {t("liveTrainingView.deleteDialog.title")}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {hasLinkedLessons
              ? t("liveTrainingView.deleteDialog.assignedToLessonsDescription", {
                  count: linkedLessonCount,
                })
              : t("liveTrainingView.deleteDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {t("common.button.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting || hasLinkedLessons}
          >
            {t("common.button.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
