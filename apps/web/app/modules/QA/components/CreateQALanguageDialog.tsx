import { useTranslation } from "react-i18next";

import useCreateQALanguage from "~/api/mutations/admin/useCreateQALanguage";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "~/components/ui/dialog";

import type { SupportedLanguages } from "@repo/shared";

type CreateQALanguageDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  qaId: string;
  languageToCreate: SupportedLanguages | null;
  onConfirm: (language: SupportedLanguages) => void;
};

export const CreateQALanguageDialog = ({
  open,
  setOpen,
  qaId,
  languageToCreate,
  onConfirm,
}: CreateQALanguageDialogProps) => {
  const { t } = useTranslation();

  const { mutateAsync: createLanguage } = useCreateQALanguage();

  const handleConfirm = async () => {
    if (!languageToCreate) return;

    setOpen(false);
    await createLanguage({ qaId, language: languageToCreate });
    onConfirm(languageToCreate);
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
