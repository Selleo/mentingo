import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";
import { ContentTypes } from "~/modules/Admin/EditCourse/EditCourse.types";

import { Icon } from "../Icon";

interface EmptyStateUploadProps {
  contentTypeToDisplay: string;
  className?: string;
}

const contentTypeFormats = {
  [ContentTypes.VIDEO_LESSON_FORM]: "MP4, MOV, MPEG-2, or Hevc (max. 2GB)",
  [ContentTypes.PRESENTATION_FORM]: "PPT/PPTX (max. 100MB)",
};

const EmptyStateUpload = ({ contentTypeToDisplay, className }: EmptyStateUploadProps) => {
  const { t } = useTranslation();

  return (
    <label
      htmlFor="file-upload"
      className={cn(
        "flex h-[240px] w-full max-w-[440px] flex-col items-center justify-center gap-y-3 rounded-lg border border-neutral-200 bg-white cursor-pointer",
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
    </label>
  );
};

export default EmptyStateUpload;
