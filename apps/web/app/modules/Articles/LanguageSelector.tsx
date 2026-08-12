import { LanguageSelector } from "~/components/LanguageSelector/LanguageSelector";

import type { SupportedLanguages } from "@repo/shared";

type BaseArticleLanguageSelectorProps = {
  formKey: string;
  value: SupportedLanguages;
  baseLanguage?: SupportedLanguages | null;
  availableLocales?: SupportedLanguages[];
  onChange: (language: SupportedLanguages) => void;
  onCreateLanguage?: (language: SupportedLanguages) => Promise<void>;
  onDeleteLanguage?: (language: SupportedLanguages) => Promise<void>;
};

const ArticleLanguageSelectorBase = ({
  formKey,
  value,
  baseLanguage,
  availableLocales,
  onChange,
  onCreateLanguage,
  onDeleteLanguage,
}: BaseArticleLanguageSelectorProps) => {
  return (
    <LanguageSelector
      key={formKey}
      formKey={formKey}
      value={value}
      baseLanguage={baseLanguage}
      availableLocales={availableLocales}
      onChange={onChange}
      onCreateLanguage={onCreateLanguage}
      onDeleteLanguage={onDeleteLanguage}
      labels={{
        placeholder: "adminArticleView.section.language.label",
        baseLanguage: "adminArticleView.section.language.baseLanguage",
        notAddedLanguages: "adminArticleView.section.language.notAddedLanguages",
        createTitle: "adminArticleView.section.language.createTitle",
        createDescription: "adminArticleView.section.language.createDescription",
        deleteTitle: "adminArticleView.section.language.deleteTitle",
        deleteDescription: "adminArticleView.section.language.deleteDescription",
      }}
    />
  );
};

export const ArticleLanguageSelector = ArticleLanguageSelectorBase;
export const ArticleSectionLanguageSelector = ArticleLanguageSelectorBase;
