import { MAX_SETTINGS_IMAGE_FILE_SIZE_BYTES, formatFileSize } from "@repo/shared";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useUploadBackgroundImage } from "~/api/mutations/admin/useUploadBackgroundImage";
import { IMAGE_UPLOAD_SIZES } from "~/components/FileUploadInput/imageUpload.constants";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Icon } from "~/components/Icon";
import { useHandleImageUpload } from "~/hooks/useHandleImageUpload";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import { BrandingImageAction, BrandingImageTile } from "./BrandingImageTile";

interface OrganizationLoginBackgroundUploadProps {
  backgroundImage: string | null;
}

export function OrganizationLoginBackgroundUpload({
  backgroundImage: initialBackgroundImage,
}: OrganizationLoginBackgroundUploadProps) {
  const { t } = useTranslation();
  const { mutateAsync: uploadBackgroundImage, isPending } = useUploadBackgroundImage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    imageUrl: backgroundImage,
    isUploading,
    handleImageUpload,
    removeImage,
  } = useHandleImageUpload({
    onUpload: async (file) => {
      await uploadBackgroundImage({ backgroundImage: file });
    },
    onRemove: async () => {
      await uploadBackgroundImage({ backgroundImage: null });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    initialImageUrl: initialBackgroundImage,
    uploadSuccessMessage: t("organizationLoginBackgroundImageUpload.toast.success"),
    removeSuccessMessage: t("organizationLoginBackgroundImageUpload.toast.success"),
    uploadErrorMessage: t("organizationLoginBackgroundImageUpload.toast.error"),
    removeErrorMessage: t("organizationLoginBackgroundImageUpload.toast.error"),
  });

  return (
    <BrandingImageTile
      id="organization-login-background-image-upload"
      testId={SETTINGS_PAGE_HANDLES.LOGIN_BACKGROUND_CARD}
      title={t("organizationLoginBackgroundImageUpload.title")}
      description={t("organizationLoginBackgroundImageUpload.description")}
    >
      <ImageUploadInput
        field={{ value: backgroundImage || undefined }}
        handleImageUpload={handleImageUpload}
        isUploading={isUploading || isPending}
        imageUrl={backgroundImage}
        fileInputRef={fileInputRef}
        variant="video"
        size={IMAGE_UPLOAD_SIZES.COMPACT}
        detailsText={t("organizationLoginBackgroundImageUpload.field.imageRequirements", {
          maxSize: formatFileSize(MAX_SETTINGS_IMAGE_FILE_SIZE_BYTES),
        })}
        inputTestId={SETTINGS_PAGE_HANDLES.LOGIN_BACKGROUND_INPUT}
        actions={
          backgroundImage && (
            <BrandingImageAction
              label={t("organizationLoginBackgroundImageUpload.button.removeBackgroundImage")}
              onClick={removeImage}
              testId={SETTINGS_PAGE_HANDLES.LOGIN_BACKGROUND_REMOVE}
              isDestructive
            >
              <Icon name="TrashIcon" className="size-4" />
            </BrandingImageAction>
          )
        }
      />
      {isUploading && <p className="details-md text-neutral-500">{t("common.button.uploading")}</p>}
    </BrandingImageTile>
  );
}
