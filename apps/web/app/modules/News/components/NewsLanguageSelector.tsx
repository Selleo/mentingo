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
  onCreateLanguage?: (language: SupportedLanguages) => Promise<void>;
  onDeleteLanguage?: (language: SupportedLanguages) => Promise<void>;
};

export const NewsLanguageSelector = ({
  formKey,
  value,
  baseLanguage,
  availableLocales,
  onChange,
  onCreateLanguage,
  onDeleteLanguage,
}: NewsLanguageSelectorProps) => {
  return (
    <LanguageSelector
      formKey={formKey}
      value={value}
      baseLanguage={baseLanguage}
      availableLocales={availableLocales}
      onChange={onChange}
      onCreateLanguage={onCreateLanguage}
      onDeleteLanguage={onDeleteLanguage}
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
