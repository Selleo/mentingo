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

import { COURSE_LANGUAGE_DIALOG_HANDLES } from "../../../../../e2e/data/courses/handles";

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
      <DialogContent data-testid={COURSE_LANGUAGE_DIALOG_HANDLES.DELETE_DIALOG}>
        <DialogHeader>
          <DialogTitle>{t("adminCourseView.deleteLanguage.title")}</DialogTitle>
          <DialogDescription>{t("adminCourseView.deleteLanguage.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            data-testid={COURSE_LANGUAGE_DIALOG_HANDLES.DELETE_CANCEL_BUTTON}
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {t("common.button.cancel")}
          </Button>
          <Button
            data-testid={COURSE_LANGUAGE_DIALOG_HANDLES.DELETE_CONFIRM_BUTTON}
            variant="destructive"
            onClick={handleConfirm}
          >
            {t("common.button.proceed")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
