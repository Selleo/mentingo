import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import type { EditableResourceVisibility } from "@repo/shared";

export type VisibilityChangeConfirmation = {
  resourceIds: string[];
  visibility: EditableResourceVisibility;
  affectedUsedAssetCount: number;
  clearSelection: boolean;
};

type AssetLibraryVisibilityConfirmationDialogProps = {
  confirmation: VisibilityChangeConfirmation | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export const AssetLibraryVisibilityConfirmationDialog = ({
  confirmation,
  isPending,
  onOpenChange,
  onConfirm,
}: AssetLibraryVisibilityConfirmationDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={Boolean(confirmation)} onOpenChange={onOpenChange}>
      <DialogContent noCloseButton>
        <DialogHeader>
          <DialogTitle>{t("richText.assetLibrary.visibility.confirmationTitle")}</DialogTitle>
          <DialogDescription>
            {confirmation?.resourceIds.length === 1
              ? t("richText.assetLibrary.visibility.usedWarning")
              : t("richText.assetLibrary.visibility.bulkUsedWarning", {
                  count: confirmation?.affectedUsedAssetCount,
                })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              {t("common.cancel")}
            </Button>
          </DialogClose>
          <Button disabled={isPending} onClick={onConfirm}>
            {t("richText.assetLibrary.visibility.makePrivate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
