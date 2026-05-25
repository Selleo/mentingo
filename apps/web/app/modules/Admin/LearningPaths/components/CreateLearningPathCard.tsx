import { LEARNING_PATH_STATUSES, type SupportedLanguages } from "@repo/shared";
import { ImagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { getLocalizedResourceLanguage } from "~/components/LanguageSelector/utils";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { LearningPathLanguageSelector } from "~/modules/Admin/LearningPaths/LearningPathLanguageSelector";

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

  return (
    <Form {...form}>
      <form
        className="flex flex-col rounded-xl border border-primary-100 bg-white shadow-sm md:flex-row"
        onSubmit={form.handleSubmit(handleCreate)}
      >
        <div className="p-5 md:pr-0">
          <label className="relative block aspect-video w-full cursor-pointer overflow-hidden rounded-lg bg-neutral-100 md:w-[260px] md:max-w-[260px] md:rounded-tl-xl">
            <img
              src={thumbnailPreviewUrl || DefaultPhotoCourse}
              alt={title || t("adminLearningPathsView.editor.createTitle")}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.src = DefaultPhotoCourse;
              }}
            />
            <div className="absolute inset-0 grid place-items-center bg-white/90 text-neutral-900">
              <div className="grid place-items-center gap-2 rounded-2xl bg-white px-4 py-3 text-neutral-900 shadow-sm">
                <ImagePlus className="size-5" />
                <span className="text-xs font-semibold">{t("uploadFile.header")}</span>
              </div>
            </div>
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
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="grid min-w-0 flex-1 gap-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder={t("adminLearningPathsView.form.titlePlaceholder")}
                        className="h-9 text-sm"
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
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder={t("adminLearningPathsView.form.descriptionPlaceholder")}
                        className="!mt-2 h-9 text-sm"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <LearningPathLanguageSelector
                formKey={formKey}
                language={value}
                onChange={onChange}
                isCreateMode
              />
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("common.button.cancel")}
            </Button>
            <Button type="submit" disabled={!title.trim() || !description.trim() || isPending}>
              {t("common.button.create")}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
