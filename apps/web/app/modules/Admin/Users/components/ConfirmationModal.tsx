import { capitalize } from "lodash-es";
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

interface ConfirmationModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  selectedUsers: number;
  type: string;
  name: string;
}

export const ConfirmationModal = ({
  open,
  onCancel,
  onConfirm,
  selectedUsers,
  type,
  name,
}: ConfirmationModalProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`adminUsersView.modal.title.confirmation`)}</DialogTitle>

          <DialogDescription>
            {selectedUsers === 1
              ? t(`adminUsersView.modal.description.confirmationFor${capitalize(type)}Singular`, {
                  [type]: name,
                })
              : t(`adminUsersView.modal.description.confirmationFor${capitalize(type)}Plural`, {
                  [type]: name,
                  number: selectedUsers,
                })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("common.button.cancel")}
          </Button>
          <Button onClick={onConfirm} variant="primary">
            {t(`adminUsersView.modal.button.continue`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
