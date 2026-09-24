import { useTranslation } from "react-i18next";

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
  accept = ".png, .jpg, .jpeg",
  imageFit = "cover",
  detailsText,
  inputTestId,
}: ImageUploadProps) => {
  const { t } = useTranslation();
  const isSmall = size === IMAGE_UPLOAD_SIZES.SMALL;
  const fallbackDetails =
    variant === "video"
      ? "PNG, JPG or JPEG (max. 20 MB, recommended 1920x1080 or higher)"
      : "PNG, JPG or JPEG (max. 20 MB, recommended 1200x1200 or higher)";

  return (
    <div className="flex flex-col items-center justify-center gap-y-2">
      <div
        className={cn(
          "relative flex w-full flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-solid border-gray-300 bg-gray-100",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          { "aspect-video": variant === "video" && size === IMAGE_UPLOAD_SIZES.DEFAULT },
          { "aspect-square": variant === "square" && size === IMAGE_UPLOAD_SIZES.DEFAULT },
          { "h-36": size === IMAGE_UPLOAD_SIZES.COMPACT, "h-20 border": isSmall },
        )}
      >
        {imageUrl && (
          <img
            src={imageUrl || field.value}
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
            },
          )}
        >
          <Icon name="UploadImageIcon" className={cn({ "size-8": isSmall })} />

          <div
            className={cn(
              "mt-2 flex items-center justify-center rounded-md border bg-white px-2 py-1 font-semibold text-neutral-900",
              {
                "text-sm sm:text-base": !isSmall,
                "mt-1 border-0 bg-transparent p-0 text-xs": isSmall,
                "text-white": isSmall && Boolean(field.value),
              },
            )}
          >
            <span className="text-current">
              {field.value ? t("uploadFile.replace") : t("uploadFile.header")}
            </span>
            {!isSmall && <span className="ml-1 text-current">{t("uploadFile.subHeader")}</span>}
          </div>

          {!isSmall && (
            <div
              className={cn(
                "mt-2 w-fit rounded-md border px-2 py-1 text-[13px] font-medium leading-5 bg-white text-neutral-900",
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
      </div>
    </div>
  );
};

export default ImageUploadInput;
