import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

interface DeleteQADialogProps {
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
}

export default function DeleteQADialog({ onConfirm, loading = false }: DeleteQADialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    await onConfirm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={(event) => event.stopPropagation()}
          disabled={loading}
          className="gap-2 size-8 border-destructive text-destructive hover:bg-red-100 hover:border-destructive hover:text-destructive"
        >
          <Icon name="TrashIcon" className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{t("qaView.delete.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("qaView.delete.confirm")}</p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} type="button">
            {t("common.button.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading} type="button">
            {t("common.button.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
