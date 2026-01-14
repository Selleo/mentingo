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
  DialogTrigger,
} from "~/components/ui/dialog";

type TransferOwnershipDialogProps = {
  selectedUserLabel: string;
  isDisabled?: boolean;
  onConfirm: () => void;
};

const TransferOwnershipDialog = ({
  selectedUserLabel,
  onConfirm,
  isDisabled = false,
}: TransferOwnershipDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="shrink-0" disabled={isDisabled}>
          {t("adminCourseView.settings.transferOwnership.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("adminCourseView.settings.transferOwnership.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("adminCourseView.settings.transferOwnership.dialog.description", {
              user: selectedUserLabel,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline">
              {t("adminCourseView.settings.transferOwnership.dialog.cancel")}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button className="bg-error-500 text-white hover:bg-error-600" onClick={onConfirm}>
              {t("adminCourseView.settings.transferOwnership.dialog.confirm")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransferOwnershipDialog;
