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

type CompetencyDeleteConfirmationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  pending: boolean;
  onDelete: () => Promise<void>;
};

export function CompetencyDeleteConfirmation({
  open,
  onOpenChange,
  name,
  pending,
  onDelete,
}: CompetencyDeleteConfirmationProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("competencies.deleteCompetency")}</DialogTitle>
          <DialogDescription>
            {t("competencies.deleteCompetencyConfirmation", { name })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              {t("competencies.cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            className="bg-error-700 hover:bg-error-800"
            disabled={pending}
            aria-busy={pending}
            onClick={() => void onDelete()}
          >
            {t("common.button.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
