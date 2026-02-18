import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useUploadPlatformLogo } from "~/api/mutations/admin/useUploadPlatformLogo";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { useHandleImageUpload } from "~/hooks/useHandleImageUpload";
import { usePlatformLogo } from "~/hooks/usePlatformLogo";

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
    <Card className="h-full border-neutral-200 bg-white shadow-sm">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-base font-semibold">{t("platformLogo.header")}</CardTitle>
        <CardDescription className="text-sm leading-5 text-neutral-700">
          {t("platformLogo.subHeader")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-col gap-y-1.5">
          <ImageUploadInput
            field={{ value: logoUrl || undefined }}
            handleImageUpload={handleImageUpload}
            isUploading={isUploading || isPending}
            imageUrl={logoUrl}
            fileInputRef={fileInputRef}
            variant="video"
            inputId="platform-logo"
            accept=".png, .svg"
            imageFit="contain"
            detailsText={t("platformLogo.field.imageRequirements")}
          />
          {isUploading && (
            <p className="text-xs font-medium text-neutral-500">
              {t("common.other.uploadingImage")}
            </p>
          )}
        </div>
        {logoUrl && (
          <Button type="button" onClick={removeImage} variant="destructive" size="sm">
            <Icon name="TrashIcon" className="mr-2" />
            {t("platformLogo.button.removeLogo")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
