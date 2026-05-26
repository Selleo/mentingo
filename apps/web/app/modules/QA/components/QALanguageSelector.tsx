import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";

import useCreateQALanguage from "~/api/mutations/admin/useCreateQALanguage";
import useDeleteQALanguage from "~/api/mutations/admin/useDeleteQALanguage";
import { LanguageSelector } from "~/components/LanguageSelector/LanguageSelector";

import { QA_LANGUAGE_SELECTOR_HANDLES } from "../../../../e2e/data/qa/handles";

type QALanguageSelectorProps = {
  formKey: string;
  qaLanguage: SupportedLanguages;
  qa?: {
    id: string;
    baseLanguage?: SupportedLanguages | null;
    availableLocales?: SupportedLanguages[];
  };
  onChange: (language: SupportedLanguages) => void;
};

export const QALanguageSelector = ({
  formKey,
  qaLanguage,
  qa,
  onChange,
}: QALanguageSelectorProps) => {
  const { mutateAsync: createLanguage } = useCreateQALanguage();
  const { mutateAsync: deleteLanguage } = useDeleteQALanguage();

  const handleCreateLanguage = async (language: SupportedLanguages) => {
    if (!qa) return;

    await createLanguage({ qaId: qa.id, language });
  };

  const handleDeleteLanguage = async (language: SupportedLanguages) => {
    if (!qa) return;

    await deleteLanguage({ qaId: qa.id, language });
  };

  return (
    <LanguageSelector
      formKey={formKey}
      value={qaLanguage}
      baseLanguage={qa?.baseLanguage ?? SUPPORTED_LANGUAGES.EN}
      availableLocales={qa?.availableLocales}
      onChange={onChange}
      onCreateLanguage={handleCreateLanguage}
      onDeleteLanguage={handleDeleteLanguage}
      canCreateLanguage={Boolean(qa)}
      canDeleteLanguage={Boolean(qa)}
      testIds={{
        select: QA_LANGUAGE_SELECTOR_HANDLES.SELECT,
        deleteButton: QA_LANGUAGE_SELECTOR_HANDLES.DELETE_BUTTON,
        createDialog: QA_LANGUAGE_SELECTOR_HANDLES.CREATE_DIALOG,
        createConfirmButton: QA_LANGUAGE_SELECTOR_HANDLES.CREATE_CONFIRM_BUTTON,
        deleteDialog: QA_LANGUAGE_SELECTOR_HANDLES.DELETE_DIALOG,
        deleteConfirmButton: QA_LANGUAGE_SELECTOR_HANDLES.DELETE_CONFIRM_BUTTON,
        option: QA_LANGUAGE_SELECTOR_HANDLES.option,
      }}
    />
  );
};
