import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";
import { ContentTypes } from "~/modules/Admin/EditCourse/EditCourse.types";

import { Icon } from "../Icon";

import type { ChangeEvent } from "react";

interface EmptyStateUploadProps {
  acceptedTypes: string;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  contentTypeToDisplay: string;
  className?: string;
}

const contentTypeFormats = {
  [ContentTypes.VIDEO_LESSON_FORM]: "MP4, MOV, MPEG-2, or Hevc (max. 100MB)",
  [ContentTypes.PRESENTATION_FORM]: "PPT/PPTX (max. 100MB)",
};

const EmptyStateUpload = ({
  acceptedTypes,
  handleFileChange,
  isUploading,
  contentTypeToDisplay,
  className,
}: EmptyStateUploadProps) => {
  const { t } = useTranslation();
  return (
    <label
      htmlFor="file-upload"
      className={cn(
        "flex h-[240px] w-full max-w-[440px] flex-col items-center justify-center gap-y-3 rounded-lg border border-neutral-200 bg-white",
        className,
      )}
    >
      <Icon name="UploadImageIcon" className="size-10 text-primary-700" />
      <div className="body-sm flex flex-col gap-y-1">
        <div className="text-center">
          <span className="text-accent-foreground">{t("uploadFile.header")}</span>{" "}
          <span className="text-neutral-950">{t("uploadFile.subHeader")}</span>
        </div>
        <div className="details text-center text-neutral-600">
          {contentTypeFormats[contentTypeToDisplay]}
        </div>
      </div>
      <input
        type="file"
        id="file-upload"
        accept={acceptedTypes}
        onChange={handleFileChange}
        disabled={isUploading}
        className="sr-only"
      />
    </label>
  );
};

export default EmptyStateUpload;
