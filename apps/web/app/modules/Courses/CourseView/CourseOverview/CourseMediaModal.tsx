import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";
import { Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import VideoUploadInput from "~/components/FileUploadInput/VideoUploadInput";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";

import { COURSE_HERO_PLACEHOLDER_BACKGROUND } from "./courseHeroPlaceholder";

import type { RefObject } from "react";

type CourseMediaModalProps = {
  heroImagePositionDraft: number;
  imageInputRef: RefObject<HTMLInputElement>;
  imagePreviewUrl?: string;
  isSaving: boolean;
  onClose: () => void;
  onImageSelection: (file: File) => void;
  onPositionChange: (position: number) => void;
  onSave: () => Promise<void>;
  onTrailerSelection: (file: File) => void;
  selectedTrailerFile: File | null;
  trailerInputRef: RefObject<HTMLInputElement>;
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
  onTrailerSelection,
  selectedTrailerFile,
  trailerInputRef,
}: CourseMediaModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl border-0 bg-white p-4 shadow-2xl md:p-6"
        noCloseButton
        aria-describedby={undefined}
      >
        <div className="mb-4 flex items-center justify-between md:mb-6">
          <DialogTitle className="font-gothic text-xl font-bold text-neutral-950 md:text-2xl">
            {t("modernCourseView.media.title")}
          </DialogTitle>
          <button
            type="button"
            aria-label={t("modernCourseView.common.close")}
            onClick={onClose}
            disabled={isSaving}
          >
            <X className="size-5 text-neutral-800 md:size-6" />
          </button>
        </div>

        <div className="mb-6">
          <p className="mb-3 block text-sm font-semibold text-neutral-950">
            {t("modernCourseView.media.currentImage")}
          </p>
          <div className="relative mb-4 aspect-[21/9] overflow-hidden rounded-xl border-2 border-neutral-200">
            <div
              role="img"
              aria-label={t("modernCourseView.media.previewAlt")}
              className="absolute inset-0 size-full bg-cover bg-no-repeat"
              style={{
                backgroundImage: imagePreviewUrl
                  ? `url(${JSON.stringify(imagePreviewUrl)})`
                  : COURSE_HERO_PLACEHOLDER_BACKGROUND,
                backgroundPosition: `center ${heroImagePositionDraft}%`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 text-sm font-semibold text-white">
              {t("modernCourseView.media.previewPosition")}
            </div>
          </div>
          <div className="rounded-xl p-4">
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
            <label
              htmlFor="course-hero-image-upload"
              className="mb-3 block text-sm font-semibold text-neutral-950"
            >
              {t("modernCourseView.media.uploadImage")}
            </label>
            <ImageUploadInput
              field={{}}
              handleImageUpload={onImageSelection}
              isUploading={isSaving}
              disabled={isSaving}
              fileInputRef={imageInputRef}
              inputId="course-hero-image-upload"
              variant="video"
              accept={ALLOWED_LESSON_IMAGE_FILE_TYPES.join(",")}
              detailsText={`${t("modernCourseView.media.imageLimit")} · ${t(
                "modernCourseView.media.imageRecommendation",
              )}`}
            />
          </div>

          <div>
            <label
              htmlFor="course-trailer-upload"
              className="mb-3 block text-sm font-semibold text-neutral-950"
            >
              {t("modernCourseView.media.trailer")}
            </label>
            <VideoUploadInput
              handleVideoUpload={onTrailerSelection}
              isUploading={isSaving}
              disabled={isSaving}
              file={selectedTrailerFile}
              fileInputRef={trailerInputRef}
              inputId="course-trailer-upload"
              detailsText={`${t("modernCourseView.media.videoLimit")} · ${t(
                "modernCourseView.media.videoRecommendation",
              )}`}
            />
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
      </DialogContent>
    </Dialog>
  );
}
