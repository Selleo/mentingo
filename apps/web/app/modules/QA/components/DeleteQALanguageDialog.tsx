import { useTranslation } from "react-i18next";

import useDeleteQALanguage from "~/api/mutations/admin/useDeleteQALanguage";
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

type DeleteQALanguageDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  qaId?: string;
  language?: SupportedLanguages | null;
  onDeleted?: (language: SupportedLanguages) => void;
};

export const DeleteQALanguageDialog = ({
  open,
  setOpen,
  qaId,
  language,
  onDeleted,
}: DeleteQALanguageDialogProps) => {
  const { t } = useTranslation();

  const { mutateAsync: deleteLanguage } = useDeleteQALanguage();

  const handleConfirm = async () => {
    if (!(qaId && language)) return;

    await deleteLanguage({ qaId, language });
    onDeleted?.(language);
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
