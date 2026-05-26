import { useAddArticleLanguage } from "~/api/mutations/admin/useAddArticleLanguage";
import { useAddArticleSectionLanguage } from "~/api/mutations/admin/useAddArticleSectionLanguage";
import { useDeleteArticleLanguage } from "~/api/mutations/admin/useDeleteArticleLanguage";
import { useDeleteArticleSectionLanguage } from "~/api/mutations/admin/useDeleteArticleSectionLanguage";
import { LanguageSelector } from "~/components/LanguageSelector/LanguageSelector";

import type { SupportedLanguages } from "@repo/shared";

type BaseArticleLanguageSelectorProps = {
  formKey: string;
  id: string;
  value: SupportedLanguages;
  baseLanguage?: SupportedLanguages | null;
  availableLocales?: SupportedLanguages[];
  onChange: (language: SupportedLanguages) => void;
  onCreated?: (language: SupportedLanguages) => void;
  onDeleted?: (language: SupportedLanguages) => void;
};

export const ArticleLanguageSelector = ({
  formKey,
  id,
  value,
  baseLanguage,
  availableLocales,
  onChange,
  onCreated,
  onDeleted,
}: BaseArticleLanguageSelectorProps) => {
  const { mutateAsync: addLanguage } = useAddArticleLanguage();
  const { mutateAsync: deleteLanguage } = useDeleteArticleLanguage();

  const handleCreateLanguage = async (language: SupportedLanguages) => {
    await addLanguage({ id, language });
  };

  const handleDeleteLanguage = async (language: SupportedLanguages) => {
    await deleteLanguage({ id, language });
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
      onLanguageCreated={onCreated}
      onLanguageDeleted={onDeleted}
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

export const ArticleSectionLanguageSelector = ({
  formKey,
  id,
  value,
  baseLanguage,
  availableLocales,
  onChange,
  onCreated,
  onDeleted,
}: BaseArticleLanguageSelectorProps) => {
  const { mutateAsync: addLanguage } = useAddArticleSectionLanguage();
  const { mutateAsync: deleteLanguage } = useDeleteArticleSectionLanguage();

  const handleCreateLanguage = async (language: SupportedLanguages) => {
    await addLanguage({ id, language });
  };

  const handleDeleteLanguage = async (language: SupportedLanguages) => {
    await deleteLanguage({ id, language });
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
      onLanguageCreated={onCreated}
      onLanguageDeleted={onDeleted}
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
