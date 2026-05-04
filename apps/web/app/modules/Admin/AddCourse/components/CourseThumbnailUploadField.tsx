import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type CourseThumbnailUploadFieldProps = {
  inputId: string;
  imageUrl?: string | null;
  isUploading?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  onFileSelect: (file: File) => void;
  onClear?: () => void;
  error?: string;
};

export const CourseThumbnailUploadField = ({
  inputId,
  imageUrl,
  isUploading = false,
  inputRef,
  onFileSelect,
  onClear,
  error,
}: CourseThumbnailUploadFieldProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <div
        className={cn(
          "relative flex min-h-44 overflow-hidden rounded-lg border bg-neutral-50",
          error ? "border-red-400" : "border-neutral-300",
          isUploading && "opacity-70",
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={t("adminScorm.create.thumbnailPreviewAlt")}
            className="h-44 w-full object-cover"
          />
        ) : (
          <div className="flex w-full flex-col items-center justify-center gap-2 p-6 text-center text-neutral-700">
            {isUploading ? (
              <Loader2 className="size-8 animate-spin text-primary-700" aria-hidden="true" />
            ) : (
              <ImageIcon className="size-8 text-primary-700" aria-hidden="true" />
            )}
            <p className="body-base-md text-neutral-950">
              {isUploading
                ? t("common.other.uploadingImage")
                : t("adminScorm.create.uploadThumbnail")}
            </p>
            <p className="body-sm">{t("adminScorm.create.uploadThumbnailDescription")}</p>
          </div>
        )}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg"
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
      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
      {imageUrl && onClear ? (
        <Button type="button" variant="outline" className="mt-4" onClick={onClear}>
          <Trash2 className="mr-2 size-4" />
          {t("adminCourseView.settings.button.removeThumbnail")}
        </Button>
      ) : null}
    </div>
  );
};
