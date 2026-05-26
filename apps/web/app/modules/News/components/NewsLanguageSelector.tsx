import { useAddNewsLanguage } from "~/api/mutations/useAddNewsLanguage";
import { useDeleteNewsLanguage } from "~/api/mutations/useDeleteNewsLanguage";
import { LanguageSelector } from "~/components/LanguageSelector/LanguageSelector";

import { NEWS_LANGUAGE_SELECTOR_HANDLES } from "../../../../e2e/data/news/handles";

import type { SupportedLanguages } from "@repo/shared";

type NewsLanguageSelectorProps = {
  formKey: string;
  newsId: string;
  value: SupportedLanguages;
  baseLanguage?: SupportedLanguages | null;
  availableLocales?: SupportedLanguages[];
  onChange: (language: SupportedLanguages) => void;
};

export const NewsLanguageSelector = ({
  formKey,
  newsId,
  value,
  baseLanguage,
  availableLocales,
  onChange,
}: NewsLanguageSelectorProps) => {
  const { mutateAsync: addLanguage } = useAddNewsLanguage();
  const { mutateAsync: deleteLanguage } = useDeleteNewsLanguage();

  const handleCreateLanguage = async (language: SupportedLanguages) => {
    await addLanguage({ id: newsId, data: { language } });
  };

  const handleDeleteLanguage = async (language: SupportedLanguages) => {
    await deleteLanguage({ id: newsId, language });
  };

  return (
    <LanguageSelector
      formKey={formKey}
      value={value}
      baseLanguage={baseLanguage}
      availableLocales={availableLocales}
      onChange={onChange}
      onCreateLanguage={handleCreateLanguage}
      onDeleteLanguage={handleDeleteLanguage}
      testIds={{
        select: NEWS_LANGUAGE_SELECTOR_HANDLES.SELECT,
        deleteButton: NEWS_LANGUAGE_SELECTOR_HANDLES.DELETE_BUTTON,
        createDialog: NEWS_LANGUAGE_SELECTOR_HANDLES.CREATE_DIALOG,
        createConfirmButton: NEWS_LANGUAGE_SELECTOR_HANDLES.CREATE_CONFIRM_BUTTON,
        deleteDialog: NEWS_LANGUAGE_SELECTOR_HANDLES.DELETE_DIALOG,
        deleteConfirmButton: NEWS_LANGUAGE_SELECTOR_HANDLES.DELETE_CONFIRM_BUTTON,
      }}
      labels={{
        placeholder: "newsView.language.label",
        baseLanguage: "newsView.language.baseLanguage",
        notAddedLanguages: "newsView.language.notAddedLanguages",
        createTitle: "newsView.language.createTitle",
        createDescription: "newsView.language.createDescription",
        deleteTitle: "newsView.language.deleteTitle",
        deleteDescription: "newsView.language.deleteDescription",
      }}
    />
  );
};
