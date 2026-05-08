import { LEARNING_PATH_STATUSES, type SupportedLanguages } from "@repo/shared";
import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { Button } from "~/components/ui/button";
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

export function CreateLearningPathCard({
  language,
  onLanguageChange,
  onCancel,
  onCreate,
  isPending,
}: CreateLearningPathCardProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);

  const handleImageUpload = (file: File) => {
    setThumbnail(file);
    setThumbnailPreviewUrl(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!title.trim()) return;

    await onCreate({
      language,
      title: title.trim(),
      description: description.trim(),
      ...(thumbnail && { thumbnail }),
      status: LEARNING_PATH_STATUSES.DRAFT,
      includesCertificate: false,
      sequenceEnabled: false,
    });
  };

  return (
    <article className="flex flex-col rounded-xl border border-primary-100 bg-white shadow-sm md:flex-row">
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
            ref={fileInputRef}
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
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("adminLearningPathsView.form.titlePlaceholder")}
              className="h-9 text-sm"
            />
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("adminLearningPathsView.form.descriptionPlaceholder")}
              className="!mt-2 h-9 text-sm"
            />
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <LearningPathLanguageSelector
              language={language}
              onChange={onLanguageChange}
              isCreateMode
            />
          </div>
        </div>

        <div className="mt-7 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.button.cancel")}
          </Button>
          <Button type="button" disabled={!title.trim() || isPending} onClick={handleCreate}>
            {t("common.button.create")}
          </Button>
        </div>
      </div>
    </article>
  );
}
