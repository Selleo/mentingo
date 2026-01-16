import { useTranslation } from "react-i18next";

import useDeleteLoginPageFile from "~/api/mutations/admin/useDeleteLoginPageFile";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface UploadFilesToLoginPageDeleteDialogProps {
  open: boolean;
  resourceId: string | null;
  resourceName: string;
  onClose: () => void;
}

export const UploadFilesToLoginPageDeleteDialog = ({
  open,
  resourceId,
  resourceName,
  onClose,
}: UploadFilesToLoginPageDeleteDialogProps) => {
  const { t } = useTranslation();
  const { mutateAsync: deleteLoginPageFile, isPending: isDeleting } = useDeleteLoginPageFile();

  const handleConfirm = async () => {
    if (!resourceId) return;
    await deleteLoginPageFile({ id: resourceId });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle>{t("loginFilesUpload.deleteDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("loginFilesUpload.deleteDialog.description", { name: resourceName })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isDeleting}>
            {t("common.button.cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? t("common.button.saving") : t("loginFilesUpload.deleteDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
