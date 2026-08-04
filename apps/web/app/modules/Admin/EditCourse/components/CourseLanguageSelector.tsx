import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteCourseLanguage } from "~/api/mutations/admin/useDeleteCourseLanguage";
import { Icon } from "~/components/Icon";
import { languageOptions } from "~/components/LanguageSelector/languageOptions";
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
import { cn } from "~/lib/utils";

import { EDIT_COURSE_PAGE_HANDLES } from "../../../../../e2e/data/courses/handles";

import { CreateLanguageDialog } from "./CreateNewLanguageModal";
import { DeleteLanguageDialog } from "./DeleteLanguageDialog";

import type { SupportedLanguages } from "@repo/shared";

export const courseLanguages = languageOptions;

type LanguageSelectorProps = {
  courseLanguage: SupportedLanguages;
  course?: {
    id: string;
    baseLanguage?: SupportedLanguages | null;
    availableLocales?: SupportedLanguages[];
  };
  onChange: (language: SupportedLanguages) => void;
  setOpenGenerateTranslationModal: (open: boolean) => void;
  isAIConfigured: boolean;
  hasMissingTranslations?: boolean;
  className?: string;
  compactOnMobile?: boolean;
  selectTriggerClassName?: string;
  tooltipIconClassName?: string;
};

export const CourseLanguageSelector = ({
  courseLanguage,
  course,
  onChange,
  setOpenGenerateTranslationModal,
  isAIConfigured,
  hasMissingTranslations = false,
  className,
  compactOnMobile,
  selectTriggerClassName,
  tooltipIconClassName,
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
  const selectedLanguage = courseLanguages.find((item) => item.key === courseLanguage);

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

    if (course.baseLanguage) {
      onChange(course.baseLanguage);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Icon
                name="Info"
                className={cn("h-auto w-6 cursor-default text-neutral-800", tooltipIconClassName)}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="center"
            className="max-w-xs whitespace-pre-line break-words rounded border-neutral-200 bg-white px-2 py-1 text-sm shadow-md"
          >
            <span className="text-neutral-950">
              {t("adminCourseView.createLanguage.editConstraints", {
                baseLanguage: t(baseLanguageTranslationKey ?? ""),
              })}
            </span>
            <TooltipArrow className="fill-white" />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {hasMissingTranslations && isAIConfigured && (
        <Button
          type="button"
          size="icon"
          aria-label={t("adminCourseView.common.generateMissingTranslations")}
          title={t("adminCourseView.common.generateMissingTranslations")}
          onClick={() => setOpenGenerateTranslationModal(true)}
          variant="outline"
          className="shrink-0 rounded-lg bg-white p-1 text-primary-700 hover:bg-white hover:text-primary-700 hover:opacity-100"
        >
          <Icon name="WandSparkles" className="size-5" />
        </Button>
      )}

      <Select value={courseLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger
          data-testid={EDIT_COURSE_PAGE_HANDLES.LANGUAGE_SELECT}
          className={cn("min-w-[200px]", selectTriggerClassName)}
          aria-label={
            compactOnMobile && selectedLanguage ? t(selectedLanguage.translationKey) : undefined
          }
        >
          {compactOnMobile && selectedLanguage ? (
            <SelectValue>
              <span className="flex min-w-0 items-center gap-2">
                <Icon name={selectedLanguage.iconName} className="size-4 shrink-0" />
                <span className="hidden truncate font-semibold sm:inline">
                  {t(selectedLanguage.translationKey)}
                </span>
                {course?.baseLanguage === selectedLanguage.key && (
                  <span className="hidden rounded bg-neutral-200 px-2 text-[11px] font-medium text-neutral-700 sm:inline">
                    {t("adminCourseView.common.baseLanguage")}
                  </span>
                )}
              </span>
            </SelectValue>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          {addedItems.map((item) => (
            <SelectItem
              data-testid={EDIT_COURSE_PAGE_HANDLES.languageOption(item.key)}
              value={item.key}
              key={item.key}
              className="w-full"
            >
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
                <SelectItem
                  data-testid={EDIT_COURSE_PAGE_HANDLES.languageOption(item.key)}
                  value={item.key}
                  key={item.key}
                >
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
          data-testid={EDIT_COURSE_PAGE_HANDLES.DELETE_LANGUAGE_BUTTON}
          size="icon"
          type="button"
          variant="outline"
          className="shrink-0 rounded-lg bg-white p-1 text-primary-700 hover:bg-white hover:text-primary-700 hover:opacity-100"
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
          isAIConfigured={isAIConfigured}
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
