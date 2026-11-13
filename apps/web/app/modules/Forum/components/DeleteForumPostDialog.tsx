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

import { FORUM_HANDLES } from "../../../../e2e/data/forum/handles";

type DeleteForumPostDialogProps = {
  open: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DeleteForumPostDialog({
  open,
  isDeleting,
  onOpenChange,
  onConfirm,
}: DeleteForumPostDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={FORUM_HANDLES.DELETE_DIALOG}>
        <DialogHeader>
          <DialogTitle>{t("forum.deleteDialog.title")}</DialogTitle>
          <DialogDescription>{t("forum.deleteDialog.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid={FORUM_HANDLES.DELETE_DIALOG_CANCEL_BUTTON}
          >
            {t("common.button.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid={FORUM_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON}
          >
            {t("common.button.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
