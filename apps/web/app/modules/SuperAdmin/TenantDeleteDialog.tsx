import { Loader2 } from "lucide-react";
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

import { TENANTS_PAGE_HANDLES } from "../../../e2e/data/tenants/handles";

type TenantDeleteDialogProps = {
  tenantName: string;
  open: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
};

export function TenantDeleteDialog({
  tenantName,
  open,
  isDeleting,
  onOpenChange,
  onConfirm,
}: TenantDeleteDialogProps) {
  const { t } = useTranslation();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isDeleting) onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid={TENANTS_PAGE_HANDLES.DELETE_DIALOG} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("superAdminTenantsView.deleteDialog.title", { name: tenantName })}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {t("superAdminTenantsView.deleteDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid={TENANTS_PAGE_HANDLES.DELETE_DIALOG_CANCEL_BUTTON}
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {t("common.button.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            data-testid={TENANTS_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON}
            onClick={() => void onConfirm()}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {t("common.button.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
