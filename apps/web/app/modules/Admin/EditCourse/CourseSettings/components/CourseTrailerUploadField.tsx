import { ALLOWED_VIDEO_FILE_TYPES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { RefObject } from "react";

type CourseTrailerUploadFieldProps = {
  inputId: string;
  trailerUrl?: string;
  trailerEmbedUrl?: string;
  isUploading: boolean;
  inputRef: RefObject<HTMLInputElement>;
  onFileSelect: (file: File) => void;
  onDelete: () => void;
};

export const CourseTrailerUploadField = ({
  inputId,
  trailerUrl,
  trailerEmbedUrl,
  isUploading,
  inputRef,
  onFileSelect,
  onDelete,
}: CourseTrailerUploadFieldProps) => {
  const { t } = useTranslation();

  const actionText = trailerUrl ? t("uploadFile.replace") : t("uploadFile.header");
  const statusText = isUploading ? t("uploadFile.toast.videoUploading") : t("uploadFile.subHeader");

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "relative flex aspect-video w-full overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50",
          isUploading && "opacity-70",
        )}
      >
        {trailerUrl && (
          <div className="absolute inset-0 bg-neutral-950">
            {trailerEmbedUrl ? (
              <iframe
                src={trailerEmbedUrl}
                title={t("adminCourseView.settings.trailerPreview", {
                  defaultValue: "Trailer preview",
                })}
                allow="autoplay; encrypted-media"
                allowFullScreen
                loading="lazy"
                className="h-full w-full border-none"
              />
            ) : (
              <video src={trailerUrl} className="h-full w-full object-cover" muted playsInline>
                <track kind="captions" className="sr-only" />
              </video>
            )}
          </div>
        )}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center",
            trailerUrl
              ? "bg-black/55 text-white backdrop-blur-[1px]"
              : "bg-neutral-50 text-neutral-900",
          )}
        >
          <Icon name="UploadImageIcon" className="size-8 text-primary-700" />
          <div className="flex items-center justify-center rounded-md border bg-white px-2 py-1 text-sm font-semibold text-neutral-900 sm:text-base">
            <span>{actionText}</span>
            {!isUploading && <span className="ml-1">{statusText}</span>}
          </div>
          <div className="w-fit rounded-md border bg-white px-2 py-1 text-[13px] font-medium leading-5 text-neutral-900">
            {isUploading ? statusText : t("adminCourseView.settings.other.trailerUploadDetails")}
          </div>
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ALLOWED_VIDEO_FILE_TYPES.join(",")}
          disabled={isUploading}
          className={cn(
            "absolute inset-0 opacity-0",
            isUploading ? "cursor-not-allowed" : "cursor-pointer",
          )}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFileSelect(file);
          }}
        />
      </div>
      {trailerUrl && (
        <Button type="button" onClick={onDelete} variant="destructive">
          <Icon name="TrashIcon" className="mr-2" />
          {t("adminCourseView.settings.button.removeTrailer")}
        </Button>
      )}
    </div>
  );
};
