import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";
import { useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useEmailTemplateImagePreview } from "~/api/queries/useEmailTemplateImagePreview";
import { IMAGE_UPLOAD_SIZES } from "~/components/FileUploadInput/imageUpload.constants";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Label } from "~/components/ui/label";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";

type EmailTemplateImageUploadProps = {
  source: string;
  disabled: boolean;
  onUpload: (file: File) => Promise<void>;
};

export function EmailTemplateImageUpload({
  source,
  disabled,
  onUpload,
}: EmailTemplateImageUploadProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: uploadedImageUrl } = useEmailTemplateImagePreview(source);
  const imageUrl = source.startsWith("asset:") ? uploadedImageUrl : source;

  const handleUploadImage = (file: File) => {
    if (inputRef.current) inputRef.current.value = "";
    void onUpload(file).catch(() => undefined);
  };

  return (
    <div className="space-y-3" data-testid={EMAIL_TEMPLATES_HANDLES.IMAGE_UPLOAD}>
      <Label htmlFor={inputId} className="text-xs">
        {t("emailTemplates.ui.uploadImage")}
      </Label>
      <ImageUploadInput
        inputId={inputId}
        fileInputRef={inputRef}
        field={{ value: source }}
        imageUrl={imageUrl}
        imageFit="contain"
        size={IMAGE_UPLOAD_SIZES.SMALL}
        accept={ALLOWED_LESSON_IMAGE_FILE_TYPES.join(",")}
        disabled={disabled}
        isUploading={disabled}
        handleImageUpload={handleUploadImage}
      />
      <p className="text-xs leading-relaxed text-neutral-500">{t("emailTemplates.ui.imageHint")}</p>
    </div>
  );
}
