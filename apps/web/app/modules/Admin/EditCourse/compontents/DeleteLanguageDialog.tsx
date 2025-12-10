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

import type { SupportedLanguages } from "@repo/shared";

type DeleteLanguageDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  language?: SupportedLanguages | null;
  onConfirm?: (language: SupportedLanguages) => void;
};

export const DeleteLanguageDialog = ({
  open,
  setOpen,
  language,
  onConfirm,
}: DeleteLanguageDialogProps) => {
  const { t } = useTranslation();

  const handleConfirm = () => {
    if (language && onConfirm) {
      onConfirm(language);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("adminCourseView.deleteLanguage.title")}</DialogTitle>
          <DialogDescription>{t("adminCourseView.deleteLanguage.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.button.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            {t("common.button.proceed")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
