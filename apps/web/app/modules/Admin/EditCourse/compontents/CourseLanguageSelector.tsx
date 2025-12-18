import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteCourseLanguage } from "~/api/mutations/admin/useDeleteCourseLanguage";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

import { CreateLanguageDialog } from "./CreateNewLanguageModal";
import { DeleteLanguageDialog } from "./DeleteLanguageDialog";

import type { SupportedLanguages } from "@repo/shared";
import type { IconName } from "~/types/shared";

export const courseLanguages: {
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
];

type LanguageSelectorProps = {
  courseLanguage: SupportedLanguages;
  course?: {
    id: string;
    baseLanguage?: SupportedLanguages | null;
    availableLocales?: SupportedLanguages[];
  };
  onChange: (language: SupportedLanguages) => void;
  setOpenGenerateTranslationModal: (open: boolean) => void;
};

export const CourseLanguageSelector = ({
  courseLanguage,
  course,
  onChange,
  setOpenGenerateTranslationModal,
}: LanguageSelectorProps) => {
  const { t } = useTranslation();

  const [createNewLanguageDialog, setCreateNewLanguageDialog] = useState(false);
  const [languageToCreate, setLanguageToCreate] = useState<SupportedLanguages | null>(null);
  const [languageToDelete, setLanguageToDelete] = useState<SupportedLanguages | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { mutateAsync: deleteLanguage } = useDeleteCourseLanguage();

  const addedItems = courseLanguages.filter(
    (item) => !!course?.availableLocales?.includes(item.key),
  );
  const notAddedItems = courseLanguages.filter(
    (item) => !(course?.availableLocales?.includes(item.key) ?? false),
  );

  const baseLanguageTranslationKey = courseLanguages.find(
    (item) => item.key === course?.baseLanguage,
  )?.translationKey;

  const handleLanguageChange = (key: SupportedLanguages) => {
    if (!(course?.availableLocales?.includes(key) ?? false)) {
      setCreateNewLanguageDialog(true);
      setLanguageToCreate(key);
    } else {
      onChange(key);
    }
  };

  const handleDelete = async () => {
    if (!(course && languageToDelete)) return;

    await deleteLanguage({ courseId: course.id, language: languageToDelete });
  };

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Icon name="Info" className="h-auto w-6 cursor-default text-neutral-800" />
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="center"
            className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
          >
            {t("adminCourseView.createLanguage.editConstraints", {
              baseLanguage: t(baseLanguageTranslationKey ?? ""),
            })}
            <TooltipArrow className="fill-black" />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Select value={courseLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger className="min-w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {addedItems.map((item) => (
            <SelectItem value={item.key} key={item.key} className="w-full">
              <div className="flex w-full items-center gap-2">
                <Icon name={item.iconName} className="size-4" />
                <span className="font-semibold">{t(item.translationKey)}</span>
                {course?.baseLanguage === item.key && (
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

      {course?.baseLanguage !== courseLanguage && (
        <Button
          size="icon"
          type="button"
          variant="outline"
          className="shrink-0 p-1 rounded-lg"
          onClick={() => {
            setLanguageToDelete(courseLanguage);
            setIsDeleteDialogOpen(true);
          }}
        >
          <Icon name="TrashIcon" className="size-5" />
        </Button>
      )}

      {languageToCreate && course && (
        <CreateLanguageDialog
          open={createNewLanguageDialog}
          setOpen={setCreateNewLanguageDialog}
          languageToCreate={languageToCreate}
          onConfirm={(language) => {
            onChange(language);
            setLanguageToCreate(null);
          }}
          setOpenGenerateMissingTranslations={setOpenGenerateTranslationModal}
          courseId={course.id}
        />
      )}

      <DeleteLanguageDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        language={languageToDelete}
        onConfirm={async () => {
          await handleDelete();
          setIsDeleteDialogOpen(false);
        }}
      />
    </div>
  );
};
