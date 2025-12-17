import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAddNewsLanguage } from "~/api/mutations/useAddNewsLanguage";
import { useDeleteNewsLanguage } from "~/api/mutations/useDeleteNewsLanguage";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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

const languageOptions: {
  key: SupportedLanguages;
  iconName: "GB" | "PL";
  translationKey: string;
}[] = [
  { key: "pl", iconName: "PL", translationKey: "changeUserLanguageView.options.polish" },
  { key: "en", iconName: "GB", translationKey: "changeUserLanguageView.options.english" },
];

type NewsLanguageSelectorProps = {
  newsId: string;
  value: SupportedLanguages;
  baseLanguage?: SupportedLanguages | null;
  availableLocales?: SupportedLanguages[];
  onChange: (language: SupportedLanguages) => void;
};

export const NewsLanguageSelector = ({
  newsId,
  value,
  baseLanguage,
  availableLocales,
  onChange,
}: NewsLanguageSelectorProps) => {
  const { t } = useTranslation();
  const { mutateAsync: addLanguage } = useAddNewsLanguage();
  const { mutateAsync: deleteLanguage } = useDeleteNewsLanguage();

  const [languageToCreate, setLanguageToCreate] = useState<SupportedLanguages | null>(null);
  const [languageToDelete, setLanguageToDelete] = useState<SupportedLanguages | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { addedItems, notAddedItems } = useMemo(() => {
    const added = languageOptions.filter((item) => availableLocales?.includes(item.key));
    const notAdded = languageOptions.filter((item) => !availableLocales?.includes(item.key));
    return { addedItems: added, notAddedItems: notAdded };
  }, [availableLocales]);

  const handleChange = (lang: SupportedLanguages) => {
    if (availableLocales?.includes(lang)) {
      onChange(lang);
      return;
    }
    setLanguageToCreate(lang);
    setIsCreateOpen(true);
  };

  const handleCreateLanguage = async () => {
    if (!languageToCreate) return;
    await addLanguage({ id: newsId, data: { language: languageToCreate } });
    setIsCreateOpen(false);
    onChange(languageToCreate);
    setLanguageToCreate(null);
  };

  const handleDeleteLanguage = async () => {
    if (!languageToDelete) return;
    await deleteLanguage({ id: newsId, language: languageToDelete });
    setIsDeleteOpen(false);

    const fallback =
      (baseLanguage && baseLanguage !== languageToDelete && baseLanguage) ||
      (availableLocales?.find((locale) => locale !== languageToDelete) as SupportedLanguages) ||
      "en";
    onChange(fallback);
    setLanguageToDelete(null);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={(val) => handleChange(val as SupportedLanguages)}>
        <SelectTrigger className="min-w-[200px]">
          <SelectValue placeholder={t("newsView.language.label")} />
        </SelectTrigger>
        <SelectContent>
          {addedItems.map((item) => (
            <SelectItem value={item.key} key={item.key} className="w-full">
              <div className="flex w-full items-center gap-2">
                <Icon name={item.iconName} className="size-4" />
                <span className="font-semibold">{t(item.translationKey)}</span>
                {baseLanguage === item.key && (
                  <span className="rounded bg-neutral-200 px-2 text-[11px] font-medium text-neutral-700">
                    {t("newsView.language.baseLanguage")}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}

          {addedItems.length > 0 && notAddedItems.length > 0 && <Separator className="my-1" />}

          {notAddedItems.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs uppercase text-neutral-500">
                {t("newsView.language.notAddedLanguages")}
              </div>
              {notAddedItems.map((item) => (
                <SelectItem value={item.key} key={item.key}>
                  <div className="flex w-full items-center gap-2">
                    <Icon name={item.iconName} className="size-4" />
                    <div className="flex flex-col leading-tight">
                      <span className="font-semibold">{t(item.translationKey)}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>

      {baseLanguage && baseLanguage !== value && (
        <Button
          size="icon"
          type="button"
          variant="outline"
          className="shrink-0 p-1 rounded-lg"
          onClick={() => {
            setLanguageToDelete(value);
            setIsDeleteOpen(true);
          }}
        >
          <Icon name="TrashIcon" className="size-5" />
        </Button>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newsView.language.createTitle")}</DialogTitle>
            <DialogDescription>
              {t("newsView.language.createDescription", {
                language: t(
                  languageOptions.find((item) => item.key === languageToCreate)?.translationKey ??
                    "",
                ),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button onClick={handleCreateLanguage}>{t("contentCreatorView.button.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newsView.language.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("newsView.language.deleteDescription", {
                language: t(
                  languageOptions.find((item) => item.key === languageToDelete)?.translationKey ??
                    "",
                ),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteLanguage}>
              {t("common.button.proceed")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
