import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useUploadBackgroundImage } from "~/api/mutations/admin/useUploadBackgroundImage";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { useHandleImageUpload } from "~/hooks/useHandleImageUpload";

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
    <Card
      id="organization-login-background-image-upload"
      className="flex h-full flex-col border-neutral-200 bg-white shadow-sm"
    >
      <CardHeader className="min-h-24 space-y-1 pb-2">
        <CardTitle className="text-base font-semibold">
          {t("organizationLoginBackgroundImageUpload.title")}
        </CardTitle>
        <CardDescription className="text-sm leading-5 text-neutral-700">
          {t("organizationLoginBackgroundImageUpload.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <ImageUploadInput
          field={{ value: backgroundImage || undefined }}
          handleImageUpload={handleImageUpload}
          isUploading={isUploading || isPending}
          imageUrl={backgroundImage}
          fileInputRef={fileInputRef}
          variant="video"
          detailsText={t("organizationLoginBackgroundImageUpload.field.imageRequirements")}
        />
        {isUploading && (
          <p className="text-xs font-medium text-neutral-500">{t("common.button.uploading")}</p>
        )}
        {backgroundImage && (
          <Button onClick={removeImage} variant="destructive" size="sm">
            <Icon name="TrashIcon" className="mr-2" />
            {t("organizationLoginBackgroundImageUpload.button.removeBackgroundImage")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
