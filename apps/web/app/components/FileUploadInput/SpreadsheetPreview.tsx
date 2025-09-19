import { FileCheck2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Icon } from "../Icon";
import { Button } from "../ui/button";

interface SpreadsheetPreviewProps {
  file: File | null;
  acceptedTypes: string;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleFileDelete: () => void;
  setVideoPreview: (url: string | null) => void;
  setFile: (file: File | null) => void;
  isUploading: boolean;
}

export const SpreadsheetPreview = ({
  file,
  acceptedTypes,
  handleFileChange,
  setFile,
  handleFileDelete,
  setVideoPreview,
  isUploading,
}: SpreadsheetPreviewProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative h-full w-full">
        <label
          htmlFor="file-upload"
          className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-y-3 rounded-t-lg border-b"
        >
          <Icon name="UploadImageIcon" className="size-10 text-primary-700" />
          <div className="body-sm flex flex-col gap-y-1">
            <div className="text-center">
              <span className="text-primary-700">{t("uploadFile.header")}</span>{" "}
              <span className="text-neutral-950">{t("uploadFile.subHeader")}</span>
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
      </div>
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-x-2">
          <FileCheck2 className="size-3 text-neutral-800" />
          <span className="body-sm text-neutral-900">{file?.name}</span>
        </div>
        <Button
          variant="ghost"
          className="aspect-square"
          onClick={() => {
            handleFileDelete();
            setFile(null);
            setVideoPreview(null);
          }}
        >
          <Icon name="X" className="size-2 text-neutral-600" />
        </Button>
      </div>
    </div>
  );
};
