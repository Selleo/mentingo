import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { BaseEditor } from "~/components/RichText/Editor";
import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { courseLanguages } from "~/modules/Admin/EditCourse/components/CourseLanguageSelector";

import { InlineCategoryCreationForm } from "../../Categories/components/InlineCategoryCreationForm";

import type { SupportedLanguages } from "@repo/shared";
import type { Control, FieldPath, UseFormSetValue } from "react-hook-form";

type CourseMetadataFormValues = {
  title: string;
  categoryId: string;
  language: SupportedLanguages;
  description: string;
};

type CategoryOption = {
  id: string;
  title: string;
};

type CourseMetadataFieldTestIds = {
  titleInput?: string;
  categorySelect?: string;
  categoryOption?: (categoryTitle: string) => string;
  languageSelect?: string;
  languageOption?: (language: SupportedLanguages) => string;
  descriptionEditor?: string;
};

type CourseMetadataFieldsProps<TFormValues extends CourseMetadataFormValues> = {
  control: Control<TFormValues>;
  setValue: UseFormSetValue<TFormValues>;
  categories: CategoryOption[];
  showBaseLanguageTooltip?: boolean;
  testIds?: CourseMetadataFieldTestIds;
};

export const CourseMetadataFields = <TFormValues extends CourseMetadataFormValues>({
  control,
  setValue,
  categories,
  showBaseLanguageTooltip = false,
  testIds,
}: CourseMetadataFieldsProps<TFormValues>) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex space-x-5">
        <FormField
          control={control}
          name={"title" as FieldPath<TFormValues>}
          render={({ field }) => (
            <FormItem className="flex-1">
              <Label htmlFor="title" className="body-base-md">
                <span className="text-red-500">*</span> {t("adminCourseView.settings.field.title")}
              </Label>
              <FormControl>
                <Input
                  data-testid={testIds?.titleInput}
                  id="title"
                  {...field}
                  required
                  placeholder={t("adminCourseView.settings.placeholder.title")}
                  className="placeholder:body-base"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={"categoryId" as FieldPath<TFormValues>}
          render={({ field }) => (
            <FormItem className="flex-1">
              <Label htmlFor="categoryId">
                <span className="text-red-500">*</span>{" "}
                {t("adminCourseView.settings.field.category")}
              </Label>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger
                      data-testid={testIds?.categorySelect}
                      id="categoryId"
                      className="data-[placeholder]:body-base rounded-lg border border-neutral-300 focus:border-primary-800 focus:ring-primary-800"
                    >
                      <SelectValue
                        placeholder={t("adminCourseView.settings.placeholder.category")}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem
                        value={category.id}
                        key={category.id}
                        data-testid={testIds?.categoryOption?.(category.title)}
                      >
                        {category.title}
                      </SelectItem>
                    ))}
                    <InlineCategoryCreationForm
                      onCategoryCreated={(categoryId) => {
                        setValue("categoryId" as FieldPath<TFormValues>, categoryId as never, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }}
                    />
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name={"language" as FieldPath<TFormValues>}
        render={({ field }) => (
          <FormItem>
            <Label className="mt-5 flex items-center gap-4">
              <div>
                <span className="text-red-500">*</span>{" "}
                {t("adminCourseView.settings.field.baseLanguage")}
              </div>
              {showBaseLanguageTooltip ? (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Icon name="Info" className="h-auto w-5 cursor-default text-neutral-400" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="center"
                      className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                    >
                      {t("adminCourseView.settings.other.baseLanguageTooltip")}
                      <TooltipArrow className="fill-black" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </Label>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger data-testid={testIds?.languageSelect}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {courseLanguages.map((item) => (
                  <SelectItem
                    data-testid={testIds?.languageOption?.(item.key)}
                    value={item.key}
                    key={item.key}
                    className="w-full"
                  >
                    <div className="flex w-full items-center gap-2">
                      <Icon name={item.iconName} className="size-4" />
                      <span className="font-semibold">{t(item.translationKey)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={"description" as FieldPath<TFormValues>}
        render={({ field }) => (
          <FormItem className="mt-5">
            <Label htmlFor="description">
              <span className="text-red-500">*</span>{" "}
              {t("adminCourseView.settings.field.description")}
            </Label>
            <div data-testid={testIds?.descriptionEditor}>
              <BaseEditor id="description" {...field} />
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};
