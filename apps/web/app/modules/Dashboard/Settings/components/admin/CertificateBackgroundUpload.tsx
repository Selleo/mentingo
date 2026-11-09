import { MAX_SETTINGS_IMAGE_FILE_SIZE_BYTES, formatFileSize } from "@repo/shared";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUploadCertificateBackgroundImage } from "~/api/mutations/admin/useUploadCertificateBackgroundImage";
import { IMAGE_UPLOAD_SIZES } from "~/components/FileUploadInput/imageUpload.constants";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Icon } from "~/components/Icon";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { useHandleImageUpload } from "~/hooks/useHandleImageUpload";
import CertificatePreview from "~/modules/Profile/Certificates/CertificatePreview";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import { BrandingImageAction, BrandingImageTile } from "./BrandingImageTile";

interface CertificateBackgroundUploadProps {
  certificateBackgroundImage: string | null;
  platformLogo: string | null;
}

export function CertificateBackgroundUpload({
  certificateBackgroundImage: initialCertificateBackgroundImage,
  platformLogo,
}: CertificateBackgroundUploadProps) {
  const { t } = useTranslation();
  const { mutateAsync: uploadCertificateBackground, isPending } =
    useUploadCertificateBackgroundImage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const {
    imageUrl: certificateBackgroundImage,
    isUploading,
    handleImageUpload,
    removeImage,
  } = useHandleImageUpload({
    onUpload: async (file) => {
      await uploadCertificateBackground({
        certificateBackgroundImage: file,
      });
    },
    onRemove: async () => {
      await uploadCertificateBackground({
        certificateBackgroundImage: undefined,
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    initialImageUrl: initialCertificateBackgroundImage,
    uploadSuccessMessage: t("certificateBackgroundUpload.toast.success"),
    removeSuccessMessage: t("certificateBackgroundUpload.toast.success"),
    uploadErrorMessage: t("certificateBackgroundUpload.toast.error"),
    removeErrorMessage: t("certificateBackgroundUpload.toast.error"),
  });

  return (
    <>
      <BrandingImageTile
        id="certificate-background-upload"
        testId={SETTINGS_PAGE_HANDLES.CERTIFICATE_BACKGROUND_CARD}
        title={t("certificateBackgroundUpload.title")}
        description={t("certificateBackgroundUpload.description")}
      >
        <ImageUploadInput
          field={{ value: certificateBackgroundImage || undefined }}
          handleImageUpload={handleImageUpload}
          isUploading={isUploading || isPending}
          imageUrl={certificateBackgroundImage}
          fileInputRef={fileInputRef}
          variant="video"
          size={IMAGE_UPLOAD_SIZES.COMPACT}
          detailsText={t("certificateBackgroundUpload.field.imageRequirements", {
            maxSize: formatFileSize(MAX_SETTINGS_IMAGE_FILE_SIZE_BYTES),
          })}
          inputTestId={SETTINGS_PAGE_HANDLES.CERTIFICATE_BACKGROUND_INPUT}
          actions={
            <>
              <BrandingImageAction
                label={t("certificateBackgroundUpload.button.preview")}
                onClick={() => setIsPreviewOpen(true)}
              >
                <Icon name="Eye" className="size-4" />
              </BrandingImageAction>
              {certificateBackgroundImage && (
                <BrandingImageAction
                  label={t("certificateBackgroundUpload.button.removeCertificateBackgroundImage")}
                  onClick={removeImage}
                  testId={SETTINGS_PAGE_HANDLES.CERTIFICATE_BACKGROUND_REMOVE}
                  isDestructive
                >
                  <Icon name="TrashIcon" className="size-4" />
                </BrandingImageAction>
              )}
            </>
          }
        />
        {isUploading && (
          <p className="details-md text-neutral-500">
            {t("certificateBackgroundUpload.other.uploading")}
          </p>
        )}
      </BrandingImageTile>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className="w-[95vw] max-w-[1120px] border-none bg-transparent p-0 shadow-none"
          noCloseButton
        >
          <CertificatePreview
            studentName="John Doe"
            courseName="Leadership Essentials"
            completionDate="February 17, 2026"
            platformLogo={platformLogo}
            certificateBackgroundImageUrl={certificateBackgroundImage}
            showDownloadButton={false}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
