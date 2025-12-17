import { isAxiosError } from "axios";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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
import { courseLanguages } from "~/modules/Admin/EditCourse/compontents/CourseLanguageSelector";

import type { SupportedLanguages } from "@repo/shared";

type ArticleSectionLanguageSelectorProps = {
  id: string;
  value: SupportedLanguages;
  baseLanguage?: SupportedLanguages | null;
  availableLocales?: SupportedLanguages[];
  onChange: (language: SupportedLanguages) => void;
  onCreated?: (language: SupportedLanguages) => void;
  onDeleted?: (language: SupportedLanguages) => void;
  onCreate: ({ id, language }: { id: string; language: SupportedLanguages }) => Promise<void>;
  onDelete: ({ id, language }: { id: string; language: SupportedLanguages }) => Promise<void>;
};

export const LanguageSelector = ({
  id,
  value,
  baseLanguage,
  availableLocales,
  onChange,
  onCreated,
  onDeleted,
  onCreate,
  onDelete,
}: ArticleSectionLanguageSelectorProps) => {
  const { t } = useTranslation();

  const [languageToCreate, setLanguageToCreate] = useState<SupportedLanguages | null>(null);
  const [languageToDelete, setLanguageToDelete] = useState<SupportedLanguages | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { addedItems, notAddedItems } = useMemo(() => {
    const added = courseLanguages.filter((item) => availableLocales?.includes(item.key));
    const notAdded = courseLanguages.filter((item) => !availableLocales?.includes(item.key));
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
    try {
      await onCreate({ id, language: languageToCreate });
    } catch (error) {
      const message = isAxiosError(error)
        ? ((error.response?.data ?? {}) as { message?: string }).message
        : undefined;

      if (message !== "adminArticleView.toast.languageAlreadyExists") {
        setLanguageToCreate(null);
        return;
      }
    } finally {
      setIsCreateOpen(false);
    }

    onChange(languageToCreate);
    onCreated?.(languageToCreate);
    setLanguageToCreate(null);
  };

  const handleDeleteLanguage = async () => {
    if (!languageToDelete) return;
    await onDelete({ id, language: languageToDelete });
    setIsDeleteOpen(false);

    const fallback =
      (baseLanguage && baseLanguage !== languageToDelete && baseLanguage) ||
      (availableLocales?.find((locale) => locale !== languageToDelete) as SupportedLanguages) ||
      "en";
    onChange(fallback);
    onDeleted?.(languageToDelete);
    setLanguageToDelete(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={(val) => handleChange(val as SupportedLanguages)}>
          <SelectTrigger className="min-w-[200px]">
            <SelectValue placeholder={t("adminArticleView.section.language.label")} />
          </SelectTrigger>
          <SelectContent>
            {addedItems.map((item) => (
              <SelectItem value={item.key} key={item.key} className="w-full">
                <div className="flex w-full items-center gap-2">
                  <Icon name={item.iconName} className="size-4" />
                  <span className="font-semibold">{t(item.translationKey)}</span>
                  {baseLanguage === item.key && (
                    <span className="rounded bg-neutral-200 px-2 text-[11px] font-medium text-neutral-700">
                      {t("adminArticleView.section.language.baseLanguage")}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}

            {addedItems.length > 0 && notAddedItems.length > 0 && <Separator className="my-1" />}

            {notAddedItems.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs uppercase text-neutral-500">
                  {t("adminArticleView.section.language.notAddedLanguages")}
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
            aria-label={t("adminArticleView.section.language.deleteTitle")}
            onClick={() => {
              setLanguageToDelete(value);
              setIsDeleteOpen(true);
            }}
          >
            <Icon name="TrashIcon" className="size-5" />
          </Button>
        )}
      </div>

      <>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("adminArticleView.section.language.createTitle")}</DialogTitle>
              <DialogDescription>
                {t("adminArticleView.section.language.createDescription", {
                  language: t(
                    courseLanguages.find((item) => item.key === languageToCreate)?.translationKey ??
                      "",
                  ),
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                {t("common.button.cancel")}
              </Button>
              <Button onClick={handleCreateLanguage}>
                {t("contentCreatorView.button.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("adminArticleView.section.language.deleteTitle")}</DialogTitle>
              <DialogDescription>
                {t("adminArticleView.section.language.deleteDescription", {
                  language: t(
                    courseLanguages.find((item) => item.key === languageToDelete)?.translationKey ??
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
      </>
    </div>
  );
};
