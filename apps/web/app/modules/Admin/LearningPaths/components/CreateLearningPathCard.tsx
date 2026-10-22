import { LEARNING_PATH_STATUSES, type SupportedLanguages } from "@repo/shared";
import { Camera, ImagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { Icon } from "~/components/Icon";
import { getLocalizedResourceLanguage } from "~/components/LanguageSelector/utils";
import { AutosizeTextarea } from "~/components/ui/autosize-textarea";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "~/components/ui/form";
import { cn } from "~/lib/utils";
import { courseLanguages } from "~/modules/Admin/EditCourse/components/CourseLanguageSelector";
import { LearningPathLanguageSelector } from "~/modules/Admin/LearningPaths/LearningPathLanguageSelector";
import { LearningPathHeroOutline } from "~/modules/LearningPaths/components/LearningPathHeroOutline";
import { LearningPathStatusBadge } from "~/modules/LearningPaths/components/LearningPathStatusBadge";

import type { CreateLearningPathBody } from "~/api/generated-api";

type CreateLearningPathCardProps = {
  language: SupportedLanguages;
  onLanguageChange: (language: SupportedLanguages) => void;
  onCancel: () => void;
  onCreate: (data: CreateLearningPathBody) => Promise<void>;
  isPending: boolean;
};

type CreateLearningPathFormValues = Pick<CreateLearningPathBody, "title" | "description"> & {
  thumbnail: File | null;
};

export function CreateLearningPathCard({
  language,
  onLanguageChange,
  onCancel,
  onCreate,
  isPending,
}: CreateLearningPathCardProps) {
  const { t } = useTranslation();
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const form = useForm<CreateLearningPathFormValues>({
    defaultValues: {
      title: "",
      description: "",
      thumbnail: null,
    },
  });

  const title = form.watch("title") ?? "";
  const description = form.watch("description") ?? "";

  const {
    formKey,
    selectorProps: { value, onChange },
  } = getLocalizedResourceLanguage({
    value: language,
    onChange: onLanguageChange,
    formKeyParts: ["learning-path", "create"],
  });

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    };
  }, [thumbnailPreviewUrl]);

  const handleImageUpload = (file: File) => {
    const previewUrl = URL.createObjectURL(file);

    setThumbnailPreviewUrl(previewUrl);
    form.setValue("thumbnail", file);
  };

  const handleCreate = async (values: CreateLearningPathFormValues) => {
    const normalizedTitle = values.title.trim();
    const normalizedDescription = values.description.trim();
    if (!normalizedTitle || !normalizedDescription) return;

    await onCreate({
      language,
      title: normalizedTitle,
      description: normalizedDescription,
      ...(values.thumbnail && { thumbnail: values.thumbnail }),
      status: LEARNING_PATH_STATUSES.DRAFT,
      includesCertificate: false,
      sequenceEnabled: false,
    });
  };

  const editableFieldClassName =
    "-mx-3 !mt-0 h-auto min-h-0 w-full rounded-xl border-[1.5px] border-dashed border-transparent bg-transparent px-3 py-2 placeholder:text-neutral-500 hover:border-primary-300 hover:bg-primary-50 focus-visible:border-solid focus-visible:border-primary-300 focus-visible:bg-white";
  const selectedLanguage = courseLanguages.find((item) => item.key === language);

  return (
    <Form {...form}>
      <form
        className="relative isolate rounded-2xl bg-white focus-within:z-30"
        onSubmit={form.handleSubmit(handleCreate)}
      >
        <label className="group relative block aspect-video w-full cursor-pointer overflow-hidden rounded-t-2xl bg-primary-100">
          <img
            src={thumbnailPreviewUrl || DefaultPhotoCourse}
            alt={title || t("adminLearningPathsView.editor.createTitle")}
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = DefaultPhotoCourse;
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,var(--color-white),rgba(255,255,255,0.55)_15%,rgba(255,255,255,0.2)_35%,transparent_60%)]" />
          {thumbnailPreviewUrl ? (
            <span className="absolute bottom-4 right-4 z-10 inline-flex h-8 items-center gap-2 rounded-full !bg-white px-3 text-xs font-semibold leading-none text-neutral-900 shadow-md">
              <Camera className="size-4 shrink-0" />
              {t("uploadFile.replace")}
            </span>
          ) : (
            <span className="absolute inset-0 z-10 grid place-items-center">
              <span className="grid place-items-center gap-2 rounded-2xl bg-white px-5 py-4 text-neutral-900 shadow-md transition group-hover:scale-105">
                <ImagePlus className="size-6" />
                <span className="text-xs font-semibold">{t("uploadFile.header")}</span>
              </span>
            </span>
          )}
          <input
            type="file"
            accept=".png, .jpg, .jpeg"
            className="sr-only"
            disabled={isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
          />
        </label>

        <div className="absolute right-4 top-4 z-20 flex justify-end">
          <LearningPathLanguageSelector
            formKey={formKey}
            language={value}
            onChange={onChange}
            isCreateMode
          />
        </div>

        <div className="relative z-10 flex flex-col gap-4 px-5 pb-6 pt-2 md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <LearningPathStatusBadge status={LEARNING_PATH_STATUSES.DRAFT} />
            {selectedLanguage && (
              <Badge variant="default" className="flex gap-2 bg-neutral-50 text-neutral-700">
                <Icon name={selectedLanguage.iconName} className="size-4" />
              </Badge>
            )}
          </div>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AutosizeTextarea
                    {...field}
                    value={field.value ?? ""}
                    minRows={1}
                    maxRows={4}
                    placeholder={t("adminLearningPathsView.form.titlePlaceholder")}
                    className={cn(
                      editableFieldClassName,
                      "h1 font-gothic text-2xl font-semibold leading-tight text-neutral-950 md:text-4xl",
                    )}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.preventDefault();
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AutosizeTextarea
                    {...field}
                    value={field.value ?? ""}
                    minRows={1}
                    maxRows={10}
                    placeholder={t("adminLearningPathsView.form.descriptionPlaceholder")}
                    className={cn(
                      editableFieldClassName,
                      "text-sm font-normal leading-6 text-neutral-800 md:text-base",
                    )}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex flex-wrap items-center gap-2 pt-1 md:gap-3">
            <Button type="submit" disabled={!title.trim() || !description.trim() || isPending}>
              {t("common.button.create")}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("common.button.cancel")}
            </Button>
          </div>
        </div>

        <LearningPathHeroOutline />
      </form>
    </Form>
  );
}
