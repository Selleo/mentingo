import { Image } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useEmailTemplateImagePreview } from "~/api/queries/useEmailTemplateImagePreview";

import type { EmailTemplateBlock } from "../emailTemplates.types";

export type EmailTemplateCanvasImageProps = {
  block: Extract<EmailTemplateBlock, { type: "image" }>;
};

export function EmailTemplateCanvasImage({ block }: EmailTemplateCanvasImageProps) {
  const { t } = useTranslation();

  const { data, isFetching, isError } = useEmailTemplateImagePreview(block.attrs.src);

  const isUploadedAsset = block.attrs.src.startsWith("asset:");
  const imageSource = isUploadedAsset ? data : block.attrs.src;

  if (!imageSource || (!isUploadedAsset && !imageSource.startsWith("https://"))) {
    return (
      <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-neutral-50 text-neutral-500">
        <Image className="size-7" />
        <span className="text-xs">
          {isFetching ? t("emailTemplates.ui.loading") : t("emailTemplates.ui.imageSource")}
        </span>
        {isError && (
          <span className="text-xs text-destructive">{t("emailTemplates.ui.requestFailed")}</span>
        )}
      </div>
    );
  }
  return (
    <img
      src={imageSource}
      alt={block.attrs.alt}
      width={block.attrs.width}
      className="mx-auto h-auto max-w-full"
      referrerPolicy="no-referrer"
    />
  );
}
