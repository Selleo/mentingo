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

import { COURSE_LANGUAGE_DIALOG_HANDLES } from "../../../../../e2e/data/courses/handles";

import type { SupportedLanguages } from "@repo/shared";

interface CreateLanguageDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  languageToCreate: SupportedLanguages;
  onConfirm: (language: SupportedLanguages) => void;
  setOpenGenerateMissingTranslations: (open: boolean) => void;
  courseId: string;
  isAIConfigured: boolean;
}

export const CreateLanguageDialog = ({
  open,
  setOpen,
  languageToCreate,
  onConfirm,
  setOpenGenerateMissingTranslations,
  courseId,
  isAIConfigured,
}: CreateLanguageDialogProps) => {
  const { t } = useTranslation();

  const { mutateAsync: createLanguage } = useCreateLanguage();

  const handleConfirm = async () => {
    setOpen(false);

    await createLanguage({ courseId, language: languageToCreate }).then(() => {
      setOpenGenerateMissingTranslations(isAIConfigured);
      onConfirm(languageToCreate);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent data-testid={COURSE_LANGUAGE_DIALOG_HANDLES.CREATE_DIALOG}>
        <DialogTitle>{t("adminCourseView.createLanguage.title")}</DialogTitle>
        <DialogDescription>{t("adminCourseView.createLanguage.description")}</DialogDescription>
        <DialogFooter>
          <Button
            data-testid={COURSE_LANGUAGE_DIALOG_HANDLES.CREATE_CANCEL_BUTTON}
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {t("contentCreatorView.button.cancel")}
          </Button>
          <Button
            data-testid={COURSE_LANGUAGE_DIALOG_HANDLES.CREATE_CONFIRM_BUTTON}
            onClick={handleConfirm}
          >
            {t("contentCreatorView.button.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
