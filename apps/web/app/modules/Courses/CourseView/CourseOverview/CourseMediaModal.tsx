import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";
import { Play, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import type { ChangeEvent, RefObject } from "react";

type CourseMediaModalProps = {
  heroImagePositionDraft: number;
  imageInputRef: RefObject<HTMLInputElement>;
  imagePreviewUrl: string;
  isSaving: boolean;
  onClose: () => void;
  onImageSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  onPositionChange: (position: number) => void;
  onSave: () => Promise<void>;
};

export default function CourseMediaModal({
  heroImagePositionDraft,
  imageInputRef,
  imagePreviewUrl,
  isSaving,
  onClose,
  onImageSelection,
  onPositionChange,
  onSave,
}: CourseMediaModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("modernCourseView.common.close")}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl md:p-6">
        <div className="mb-4 flex items-center justify-between md:mb-6">
          <h3 className="font-gothic text-xl font-bold text-neutral-950 md:text-2xl">
            {t("modernCourseView.media.title")}
          </h3>
          <button type="button" onClick={onClose}>
            <X className="size-5 text-neutral-800 md:size-6" />
          </button>
        </div>

        <div className="mb-6">
          <p className="mb-3 block text-sm font-semibold text-neutral-950">
            {t("modernCourseView.media.currentImage")}
          </p>
          <div className="relative mb-4 aspect-[21/9] overflow-hidden rounded-xl border-2 border-neutral-200">
            <img
              src={imagePreviewUrl}
              alt={t("modernCourseView.media.previewAlt")}
              className="size-full object-cover"
              style={{ objectPosition: `center ${heroImagePositionDraft}%` }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 text-sm font-semibold text-white">
              {t("modernCourseView.media.previewPosition")}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="mb-2 text-sm font-semibold text-neutral-950">
              {t("modernCourseView.media.verticalPosition")}
            </p>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={heroImagePositionDraft}
              onChange={(event) => onPositionChange(Number(event.target.value))}
              className="w-full cursor-pointer accent-primary-600"
            />
            <div className="mt-1 flex justify-between text-xs text-neutral-800">
              <span>{heroImagePositionDraft}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <div>
            <p className="mb-3 block text-sm font-semibold text-neutral-950">
              {t("modernCourseView.media.uploadImage")}
            </p>
            <input
              ref={imageInputRef}
              type="file"
              accept={ALLOWED_LESSON_IMAGE_FILE_TYPES.join(",")}
              onChange={onImageSelection}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-6 text-center transition-colors hover:border-primary-700 hover:bg-neutral-100 md:h-48 md:p-8"
            >
              <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-primary-50">
                <Upload className="size-8 text-primary-700" />
              </div>
              <p className="mb-1 text-sm font-semibold text-neutral-950">
                {t("modernCourseView.media.dropImage")}
              </p>
              <p className="mb-3 text-xs text-neutral-800">{t("modernCourseView.media.browse")}</p>
              <p className="text-xs text-neutral-800">{t("modernCourseView.media.imageLimit")}</p>
              <p className="text-xs text-neutral-800">
                {t("modernCourseView.media.imageRecommendation")}
              </p>
            </button>
          </div>

          <div>
            <p className="mb-3 block text-sm font-semibold text-neutral-950">
              {t("modernCourseView.media.trailer")}
            </p>
            <div className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-6 text-center transition-colors hover:border-primary-700 hover:bg-neutral-100 md:h-48 md:p-8">
              <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-amethyst-50">
                <Play className="size-8 text-amethyst-600" />
              </div>
              <p className="mb-1 text-sm font-semibold text-neutral-950">
                {t("modernCourseView.media.dropVideo")}
              </p>
              <p className="mb-3 text-xs text-neutral-800">{t("modernCourseView.media.browse")}</p>
              <p className="text-xs text-neutral-800">{t("modernCourseView.media.videoLimit")}</p>
              <p className="text-xs text-neutral-800">
                {t("modernCourseView.media.videoRecommendation")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            {t("modernCourseView.common.cancel")}
          </Button>
          <Button
            onClick={() => void onSave()}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <Upload className="size-4" />
            {t("modernCourseView.media.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
