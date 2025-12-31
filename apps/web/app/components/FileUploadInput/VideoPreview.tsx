import { useTranslation } from "react-i18next";

import { Icon } from "../Icon";
import { Button } from "../ui/button";

import type { MouseEvent as ReactMouseEvent } from "react";

interface VideoPreviewProps {
  handleFileDelete: () => void;
  isProcessing?: boolean;
  setFile: (file: File | null) => void;
  setVideoPreview: (url: string | null) => void;
  videoPreview: string | null;
}

export const VideoPreview = ({
  handleFileDelete,
  isProcessing,
  setFile,
  setVideoPreview,
  videoPreview,
}: VideoPreviewProps) => {
  const { t } = useTranslation();

  const handleDeleteVideo = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    handleFileDelete();
    setFile(null);
    setVideoPreview(null);
  };

  return (
    <div className="relative size-full">
      {isProcessing ? (
        <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-y-3 rounded-lg border border-neutral-200 bg-[rgba(18,21,33,0.85)]">
          <div className="flex size-14 items-center justify-center rounded-full bg-neutral-900/60">
            <Icon name="UploadImageIcon" className="size-8 text-primary-400" />
          </div>
          <div className="body-sm flex flex-col gap-y-1 text-center">
            <span className="text-white">{t("uploadFile.processing.title")}</span>
            <span className="details text-neutral-200">{t("uploadFile.processing.body")}</span>
          </div>
          <Button variant="destructive" className="mt-2 gap-x-1" onClick={handleDeleteVideo}>
            <Icon name="TrashIcon" /> {t("uploadFile.remove.video")}
          </Button>
        </div>
      ) : (
        <>
          <video src={videoPreview ?? ""} className="h-auto w-full">
            <track kind="captions" className="sr-only" />
          </video>
          <label
            htmlFor="file-upload"
            className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-y-3 rounded-lg border border-neutral-200 bg-[rgba(18,21,33,0.8)]"
          >
            <Icon name="UploadImageIcon" className="size-10 text-primary-700" />
            <div className="body-sm flex flex-col gap-y-1">
              <div className="text-center">
                <span className="text-primary-400">{t("uploadFile.header")}</span>{" "}
                <span className="text-white">{t("uploadFile.subHeader")}</span>
              </div>
              <div className="details text-neutral-200">{t("uploadFile.details.video")}</div>
            </div>

            <Button variant="destructive" className="mt-2 gap-x-1" onClick={handleDeleteVideo}>
              <Icon name="TrashIcon" /> {t("uploadFile.remove.video")}
            </Button>
          </label>
        </>
      )}
    </div>
  );
};
