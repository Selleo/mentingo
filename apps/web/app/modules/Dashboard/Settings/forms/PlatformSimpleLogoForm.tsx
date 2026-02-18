import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useUploadPlatformSimpleLogo } from "~/api/mutations/admin/useUploadPlatformSimpleLogo";
import { usePlatformSimpleLogo } from "~/api/queries";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { useHandleImageUpload } from "~/hooks/useHandleImageUpload";

export const PlatformSimpleLogoForm = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: currentLogoUrl } = usePlatformSimpleLogo();
  const { mutateAsync: uploadLogo, isPending } = useUploadPlatformSimpleLogo();

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
    initialImageUrl: typeof currentLogoUrl === "string" ? currentLogoUrl : null,
    uploadSuccessMessage: t("platformSimpleLogo.toast.logoUploadedSuccessfully"),
    removeSuccessMessage: t("platformSimpleLogo.toast.logoRemovedSuccessfully"),
    uploadErrorMessage: t("platformSimpleLogo.toast.logoFetchError"),
    removeErrorMessage: t("platformSimpleLogo.toast.logoFetchError"),
  });

  return (
    <Card className="h-full border-neutral-200 bg-white shadow-sm">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-base font-semibold">{t("platformSimpleLogo.header")}</CardTitle>
        <CardDescription className="text-sm leading-5 text-neutral-700">
          {t("platformSimpleLogo.subHeader")}
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
            inputId="simple-logo"
            accept=".png, .svg"
            variant="video"
            imageFit="contain"
            detailsText={t("platformSimpleLogo.field.imageRequirements")}
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
            {t("platformSimpleLogo.button.removeLogo")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
