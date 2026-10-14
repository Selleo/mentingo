import { VIDEO_PROCESSING_STATUSES, type VideoProcessingStatus } from "@repo/shared";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { DEFAULT_VIDEO_ASPECT_RATIO, formatVideoAspectRatio } from "./aspectRatio";

type VideoProcessingPlaceholderProps = {
  status: VideoProcessingStatus;
};

const PLACEHOLDER_STYLE = { aspectRatio: formatVideoAspectRatio(DEFAULT_VIDEO_ASPECT_RATIO) };

export const VideoProcessingPlaceholder = ({ status }: VideoProcessingPlaceholderProps) => {
  const { t } = useTranslation();

  const { icon, titleKey, bodyKey } = match(status)
    .with(VIDEO_PROCESSING_STATUSES.PROCESSING, () => ({
      icon: <Loader2 className="size-8 animate-spin text-white" aria-hidden />,
      titleKey: "richText.video.processing.title",
      bodyKey: "richText.video.processing.body",
    }))
    .with(VIDEO_PROCESSING_STATUSES.FAILED, () => ({
      icon: <AlertTriangle className="size-8 text-error-400" aria-hidden />,
      titleKey: "richText.video.processingFailed.title",
      bodyKey: "richText.video.processingFailed.body",
    }))
    .exhaustive();

  return (
    <div className="w-full">
      <div
        role="status"
        className="relative flex w-full items-center justify-center overflow-hidden bg-black text-center"
        style={PLACEHOLDER_STYLE}
      >
        <div className="flex flex-col items-center gap-y-3 px-6">
          {icon}
          <div className="flex flex-col gap-y-1">
            <span className="body-sm-md text-white">{t(titleKey)}</span>
            <span className="details-md text-neutral-300">{t(bodyKey)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
