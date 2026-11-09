import {
  ALLOWED_IMAGE_FILE_EXTENSIONS,
  MAX_SETTINGS_IMAGE_FILE_SIZE_BYTES,
  formatFileSize,
} from "@repo/shared";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useUploadPlatformLogo } from "~/api/mutations/admin/useUploadPlatformLogo";
import { IMAGE_UPLOAD_SIZES } from "~/components/FileUploadInput/imageUpload.constants";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Icon } from "~/components/Icon";
import { useHandleImageUpload } from "~/hooks/useHandleImageUpload";
import { usePlatformLogo } from "~/hooks/usePlatformLogo";

import { SETTINGS_PAGE_HANDLES } from "../../../../../e2e/data/settings/handles";
import { BrandingImageAction, BrandingImageTile } from "../components/admin/BrandingImageTile";

export const PlatformLogoForm = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: currentLogoUrl } = usePlatformLogo();
  const { mutateAsync: uploadLogo, isPending } = useUploadPlatformLogo();

  const {
    imageUrl: logoUrl,
    isUploading,
    handleImageUpload,
    removeImage,
  } = useHandleImageUpload({
    onUpload: async (file) => {
      await uploadLogo({ logo: file });
    },
    onRemove: async () => {
      await uploadLogo({ logo: null });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    initialImageUrl: currentLogoUrl ?? null,
    uploadSuccessMessage: t("platformLogo.toast.logoUploadedSuccessfully"),
    removeSuccessMessage: t("platformLogo.toast.logoRemovedSuccessfully"),
    uploadErrorMessage: t("platformLogo.toast.logoFetchError"),
    removeErrorMessage: t("platformLogo.toast.logoFetchError"),
  });

  return (
    <BrandingImageTile
      testId={SETTINGS_PAGE_HANDLES.PLATFORM_LOGO_CARD}
      title={t("platformLogo.header")}
      description={t("platformLogo.subHeader")}
    >
      <ImageUploadInput
        field={{ value: logoUrl || undefined }}
        handleImageUpload={handleImageUpload}
        isUploading={isUploading || isPending}
        imageUrl={logoUrl}
        fileInputRef={fileInputRef}
        variant="video"
        size={IMAGE_UPLOAD_SIZES.COMPACT}
        inputId="platform-logo"
        accept={ALLOWED_IMAGE_FILE_EXTENSIONS.join(",")}
        imageFit="contain"
        detailsText={t("platformLogo.field.imageRequirements", {
          maxSize: formatFileSize(MAX_SETTINGS_IMAGE_FILE_SIZE_BYTES),
        })}
        inputTestId={SETTINGS_PAGE_HANDLES.PLATFORM_LOGO_INPUT}
        actions={
          logoUrl && (
            <BrandingImageAction
              label={t("platformLogo.button.removeLogo")}
              onClick={removeImage}
              testId={SETTINGS_PAGE_HANDLES.PLATFORM_LOGO_REMOVE}
              isDestructive
            >
              <Icon name="TrashIcon" className="size-4" />
            </BrandingImageAction>
          )
        }
      />
      {isUploading && (
        <p className="details-md text-neutral-500">{t("common.other.uploadingImage")}</p>
      )}
    </BrandingImageTile>
  );
};
