import {
  ALLOWED_IMAGE_FILE_EXTENSIONS,
  MAX_IMAGE_FILE_SIZE_BYTES,
  formatFileSize,
} from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useRichTextMediaUrl } from "~/components/RichText/contentPolicyContext";
import { cn } from "~/lib/utils";

import { Icon } from "../Icon";

import { IMAGE_UPLOAD_SIZES } from "./imageUpload.constants";

import type { ImageUploadSize } from "./imageUpload.types";

interface ImageUploadProps {
  field: { value?: string };
  handleImageUpload: (file: File) => void;
  isUploading: boolean;
  disabled?: boolean;
  imageUrl?: string | null;
  fileInputRef?: React.RefObject<HTMLInputElement>;
  inputId?: string;
  variant?: "square" | "video";
  size?: ImageUploadSize;
  accept?: string;
  imageFit?: "cover" | "contain";
  detailsText?: string;
  inputTestId?: string;
  actions?: React.ReactNode;
}

const ImageUploadInput = ({
  field,
  handleImageUpload,
  isUploading,
  disabled = false,
  imageUrl,
  fileInputRef,
  inputId,
  variant = "square",
  size = IMAGE_UPLOAD_SIZES.DEFAULT,
  accept = ALLOWED_IMAGE_FILE_EXTENSIONS.join(","),
  imageFit = "cover",
  detailsText,
  inputTestId,
  actions,
}: ImageUploadProps) => {
  const { t } = useTranslation();
  const safeImageUrl = useRichTextMediaUrl(imageUrl || field.value);
  const isSmall = size === IMAGE_UPLOAD_SIZES.SMALL;
  const isCompact = size === IMAGE_UPLOAD_SIZES.COMPACT;
  const hasImage = Boolean(field.value);
  const fallbackDetails = t("uploadFile.details.imageCrop", {
    maxSize: formatFileSize(MAX_IMAGE_FILE_SIZE_BYTES),
  });

  return (
    <div className="flex flex-col items-center justify-center gap-y-2">
      <div
        className={cn(
          "relative flex w-full flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-solid border-gray-300 bg-gray-100",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          { "aspect-video": variant === "video" && size === IMAGE_UPLOAD_SIZES.DEFAULT },
          { "aspect-square": variant === "square" && size === IMAGE_UPLOAD_SIZES.DEFAULT },
          { "h-20 border": isSmall },
          {
            "group h-40 border border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-primary-500":
              isCompact,
            "border-solid border-neutral-200 bg-white": isCompact && hasImage,
          },
        )}
      >
        {safeImageUrl && (
          <img
            src={safeImageUrl}
            alt="Uploaded"
            className={cn(
              "h-full w-full",
              imageFit === "cover" ? "object-cover" : "object-contain p-4",
            )}
          />
        )}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center px-3 text-center",
            {
              "bg-black/50 text-white backdrop-blur-[1px]": field.value,
              "bg-gradient-to-b from-white/95 to-neutral-100/95 text-neutral-900": !field.value,
              "bg-transparent from-transparent to-transparent": isCompact && !hasImage,
              "opacity-0 transition-opacity group-hover:opacity-100": isCompact && hasImage,
            },
          )}
        >
          <Icon name="UploadImageIcon" className={cn({ "size-8": isSmall || isCompact })} />

          <div
            className={cn(
              "mt-2 flex items-center justify-center rounded-md border bg-white px-2 py-1 font-semibold text-neutral-900",
              {
                "text-sm sm:text-base": !isSmall && !isCompact,
                "mt-1 border-0 bg-transparent p-0 text-xs": isSmall,
                "border-0 bg-transparent p-0 text-sm": isCompact,
                "text-white": (isSmall || isCompact) && hasImage,
              },
            )}
          >
            <span className="text-current">
              {field.value ? t("uploadFile.replace") : t("uploadFile.header")}
            </span>
            {!isSmall && <span className="ml-1 text-current">{t("uploadFile.subHeader")}</span>}
          </div>

          {!isSmall && !(isCompact && hasImage) && (
            <div
              className={cn(
                "mt-2 w-fit rounded-md border px-2 py-1 text-[13px] font-medium leading-5 bg-white text-neutral-900",
                {
                  "mt-1 border-0 bg-transparent p-0 text-xs font-normal text-neutral-500":
                    isCompact,
                },
              )}
            >
              {detailsText ?? fallbackDetails}
            </div>
          )}
        </div>
        <input
          id={inputId}
          ref={fileInputRef}
          data-testid={inputTestId}
          type="file"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImageUpload(file);
            }
          }}
          disabled={isUploading || disabled}
          className={cn(
            "absolute inset-0 opacity-0",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
          )}
        />
        {actions && <div className="absolute right-2 top-2 z-10 flex gap-1">{actions}</div>}
      </div>
    </div>
  );
};

export default ImageUploadInput;
