import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateLearningPathLanguage } from "~/api/mutations/useLearningPathMutations";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";

import type { SupportedLanguages } from "@repo/shared";
import type { IconName } from "~/types/shared";

const languageOptions: {
  key: SupportedLanguages;
  iconName: IconName;
  translationKey: string;
}[] = [
  {
    key: "pl",
    iconName: "PL",
    translationKey: "changeUserLanguageView.options.polish",
  },
  {
    key: "en",
    iconName: "GB",
    translationKey: "changeUserLanguageView.options.english",
  },
  {
    key: "de",
    iconName: "DE",
    translationKey: "changeUserLanguageView.options.german",
  },
  {
    key: "cs",
    iconName: "CS",
    translationKey: "changeUserLanguageView.options.czech",
  },
  {
    key: "lt",
    iconName: "LT",
    translationKey: "changeUserLanguageView.options.lithuanian",
  },
];

type LearningPathLanguageSelectorProps = {
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
  language,
  learningPathId,
  baseLanguage,
  availableLocales,
  onChange,
  onLanguageCreated,
  isCreateMode = false,
  canCreateLanguage = false,
}: LearningPathLanguageSelectorProps) => {
  const { t } = useTranslation();
  const [createNewLanguageDialog, setCreateNewLanguageDialog] = useState(false);
  const [languageToCreate, setLanguageToCreate] = useState<SupportedLanguages | null>(null);
  const { mutateAsync: createLanguage } = useCreateLearningPathLanguage();

  const addedItems = isCreateMode
    ? languageOptions
    : languageOptions.filter((item) => !!availableLocales?.includes(item.key));
  const notAddedItems =
    isCreateMode || !canCreateLanguage
      ? []
      : languageOptions.filter((item) => !(availableLocales?.includes(item.key) ?? false));

  const handleLanguageChange = (key: SupportedLanguages) => {
    if (!isCreateMode && !(availableLocales?.includes(key) ?? false)) {
      setCreateNewLanguageDialog(true);
      setLanguageToCreate(key);
      return;
    }

    onChange(key);
  };

  const handleConfirmCreateLanguage = async () => {
    if (!learningPathId || !languageToCreate) return;

    setCreateNewLanguageDialog(false);
    await createLanguage({ learningPathId, language: languageToCreate });
    await onLanguageCreated?.();
    onChange(languageToCreate);
    setLanguageToCreate(null);
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={language}
        onValueChange={(value) => handleLanguageChange(value as SupportedLanguages)}
      >
        <SelectTrigger className="min-w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {addedItems.map((item) => (
            <SelectItem value={item.key} key={item.key} className="w-full">
              <div className="flex w-full items-center gap-2">
                <Icon name={item.iconName} className="size-4" />
                <span className="font-semibold">{t(item.translationKey)}</span>
                {!isCreateMode && baseLanguage === item.key && (
                  <span className="rounded bg-neutral-200 px-2 text-[11px] font-medium text-neutral-700">
                    {t("adminCourseView.common.baseLanguage")}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}

          {addedItems.length > 0 && notAddedItems.length > 0 && <Separator className="my-1" />}

          {notAddedItems.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs uppercase text-neutral-500">
                {t("adminCourseView.common.notAddedLanguages")}
              </div>
              {notAddedItems.map((item) => (
                <SelectItem value={item.key} key={item.key}>
                  <div className="flex w-full items-center gap-2">
                    <Icon name={item.iconName} className="size-4" />
                    <span className="font-semibold">{t(item.translationKey)}</span>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>

      <Dialog open={createNewLanguageDialog} onOpenChange={setCreateNewLanguageDialog}>
        <DialogContent>
          <DialogTitle>{t("adminCourseView.createLanguage.title")}</DialogTitle>
          <DialogDescription>{t("adminCourseView.createLanguage.description")}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateNewLanguageDialog(false)}>
              {t("contentCreatorView.button.cancel")}
            </Button>
            <Button onClick={handleConfirmCreateLanguage}>
              {t("contentCreatorView.button.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
