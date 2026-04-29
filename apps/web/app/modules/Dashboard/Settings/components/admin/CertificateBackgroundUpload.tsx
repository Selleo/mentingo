import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUploadCertificateBackgroundImage } from "~/api/mutations/admin/useUploadCertificateBackgroundImage";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { useHandleImageUpload } from "~/hooks/useHandleImageUpload";
import CertificatePreview from "~/modules/Profile/Certificates/CertificatePreview";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

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
      <Card
        id="certificate-background-upload"
        className="flex h-full flex-col border-neutral-200 bg-white shadow-sm"
        data-testid={SETTINGS_PAGE_HANDLES.CERTIFICATE_BACKGROUND_CARD}
      >
        <CardHeader className="min-h-24 space-y-1 pb-2">
          <CardTitle className="text-base font-semibold">
            {t("certificateBackgroundUpload.title")}
          </CardTitle>
          <CardDescription className="text-sm leading-5 text-neutral-700">
            {t("certificateBackgroundUpload.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <ImageUploadInput
            field={{ value: certificateBackgroundImage || undefined }}
            handleImageUpload={handleImageUpload}
            isUploading={isUploading || isPending}
            imageUrl={certificateBackgroundImage}
            fileInputRef={fileInputRef}
            variant="video"
            detailsText={t("certificateBackgroundUpload.field.imageRequirements")}
            inputTestId={SETTINGS_PAGE_HANDLES.CERTIFICATE_BACKGROUND_INPUT}
          />
          {isUploading && (
            <p className="text-xs font-medium text-neutral-500">
              {t("certificateBackgroundUpload.other.uploading")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {certificateBackgroundImage && (
              <Button
                onClick={removeImage}
                variant="destructive"
                size="sm"
                data-testid={SETTINGS_PAGE_HANDLES.CERTIFICATE_BACKGROUND_REMOVE}
              >
                <Icon name="TrashIcon" className="mr-2" />
                {t("certificateBackgroundUpload.button.removeCertificateBackgroundImage")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewOpen(true)}
            >
              <Icon name="Eye" className="mr-2 size-4" />
              {t("certificateBackgroundUpload.button.preview")}
            </Button>
          </div>
        </CardContent>
      </Card>

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
