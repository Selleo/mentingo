import { useCreateLearningPathLanguage } from "~/api/mutations/useLearningPathMutations";
import { LanguageSelector } from "~/components/LanguageSelector/LanguageSelector";

import type { SupportedLanguages } from "@repo/shared";

type LearningPathLanguageSelectorProps = {
  formKey: string;
  language: SupportedLanguages;
  learningPathId?: string;
  baseLanguage?: SupportedLanguages;
  availableLocales?: SupportedLanguages[];
  onChange: (language: SupportedLanguages) => void;
  onLanguageCreated?: () => Promise<void> | void;
  isCreateMode?: boolean;
  canCreateLanguage?: boolean;
};

export const LearningPathLanguageSelector = ({
  formKey,
  language,
  learningPathId,
  baseLanguage,
  availableLocales,
  onChange,
  onLanguageCreated,
  isCreateMode = false,
  canCreateLanguage = false,
}: LearningPathLanguageSelectorProps) => {
  const { mutateAsync: createLanguage } = useCreateLearningPathLanguage();

  const handleCreateLanguage = async (nextLanguage: SupportedLanguages) => {
    if (!learningPathId) return;

    await createLanguage({ learningPathId, language: nextLanguage });
  };

  return (
    <LanguageSelector
      formKey={formKey}
      value={language}
      baseLanguage={baseLanguage}
      availableLocales={availableLocales}
      onChange={onChange}
      onCreateLanguage={handleCreateLanguage}
      onLanguageCreated={onLanguageCreated}
      isCreateMode={isCreateMode}
      canCreateLanguage={Boolean(learningPathId) && canCreateLanguage}
      canDeleteLanguage={false}
    />
  );
};
