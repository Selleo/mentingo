import { useTranslation } from "react-i18next";

import { useCreateLanguage } from "~/api/mutations/admin/useCreateLanguage";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "~/components/ui/dialog";

import type { SupportedLanguages } from "@repo/shared";

interface CreateLanguageDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  languageToCreate: SupportedLanguages;
  onConfirm: (language: SupportedLanguages) => void;
  setOpenGenerateMissingTranslations: (open: boolean) => void;
  courseId: string;
}

export const CreateLanguageDialog = ({
  open,
  setOpen,
  languageToCreate,
  onConfirm,
  setOpenGenerateMissingTranslations,
  courseId,
}: CreateLanguageDialogProps) => {
  const { t } = useTranslation();

  const { mutateAsync: createLanguage } = useCreateLanguage();

  const handleConfirm = async () => {
    setOpen(false);

    await createLanguage({ courseId, language: languageToCreate }).then(() => {
      // will be changed to true in next PR
      setOpenGenerateMissingTranslations(false);
      onConfirm(languageToCreate);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>{t("adminCourseView.createLanguage.title")}</DialogTitle>
        <DialogDescription>{t("adminCourseView.createLanguage.description")}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("contentCreatorView.button.cancel")}
          </Button>
          <Button onClick={handleConfirm}>{t("contentCreatorView.button.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
