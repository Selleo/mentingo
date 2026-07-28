import { ALLOWED_VIDEO_FILE_TYPES } from "@repo/shared";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";
import { useObjectUrl } from "~/modules/Admin/AddCourse/hooks/useObjectUrl";

import type { RefObject } from "react";

type VideoUploadInputProps = {
  handleVideoUpload: (file: File) => void;
  isUploading: boolean;
  disabled?: boolean;
  file?: File | null;
  fileInputRef?: RefObject<HTMLInputElement>;
  inputId?: string;
  ariaLabel?: string;
  detailsText?: string;
  className?: string;
};

const VideoUploadInput = ({
  handleVideoUpload,
  isUploading,
  disabled = false,
  file,
  fileInputRef,
  inputId,
  ariaLabel,
  detailsText,
  className,
}: VideoUploadInputProps) => {
  const { t } = useTranslation();
  const previewUrl = useObjectUrl(file);
  const isDisabled = isUploading || disabled;

  return (
    <div
      className={cn(
        "relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-solid border-gray-300 bg-gray-100",
        isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      )}
    >
      {previewUrl && (
        <video src={previewUrl} className="size-full object-cover" muted playsInline>
          <track kind="captions" className="sr-only" />
        </video>
      )}

      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center px-3 text-center",
          previewUrl
            ? "bg-[rgba(0,0,0,0.5)] text-white backdrop-blur-[1px]"
            : "bg-gradient-to-b from-[rgba(255,255,255,0.95)] to-[rgba(245,245,245,0.95)] text-neutral-900",
        )}
      >
        <Play className="size-8 text-primary-700" aria-hidden="true" />

        <div className="mt-2 flex max-w-full items-center justify-center rounded-md border bg-white px-2 py-1 text-sm font-semibold text-neutral-900 sm:text-base">
          <span className="truncate">{file?.name ?? t("uploadFile.header")}</span>
          {!file && <span className="ml-1">{t("uploadFile.subHeader")}</span>}
        </div>

        <div className="mt-2 w-fit rounded-md border bg-white px-2 py-1 text-[13px] font-medium leading-5 text-neutral-900">
          {detailsText ?? t("uploadFile.details.video")}
        </div>
      </div>

      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_VIDEO_FILE_TYPES.join(",")}
        aria-label={ariaLabel}
        disabled={isDisabled}
        onChange={(event) => {
          const selectedFile = event.target.files?.[0];
          if (selectedFile) {
            handleVideoUpload(selectedFile);
          }
        }}
        className={cn(
          "absolute inset-0 opacity-0",
          isDisabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      />
    </div>
  );
};

export default VideoUploadInput;
