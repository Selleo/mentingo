import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { Icon } from "../Icon";

interface EmptyStateUploadProps {
  className?: string;
}

const EmptyStateUpload = ({ className }: EmptyStateUploadProps) => {
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
      </div>
    </label>
  );
};

export default EmptyStateUpload;
