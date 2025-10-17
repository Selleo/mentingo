import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUploadPlatformLogo } from "~/api/mutations/admin/useUploadPlatformLogo";
import PlatformLogoUploadInput from "~/components/FileUploadInput/PlatformLogoUploadInput";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { useHandleImageUpload } from "~/hooks/useHandleImageUpload";
import { usePlatformLogo } from "~/hooks/usePlatformLogo";

interface PlatformLogoFormData {
  logo: File | null;
}

export const PlatformLogoForm = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: currentLogoUrl } = usePlatformLogo();
  const { mutate: uploadLogo, isPending } = useUploadPlatformLogo();

  const { control, handleSubmit, setValue } = useForm<PlatformLogoFormData>({
    defaultValues: {
      logo: null,
    },
  });

  const {
    imageUrl: logoUrl,
    isUploading,
    handleImageUpload,
    removeImage,
  } = useHandleImageUpload({
    onUpload: (file) => {
      setValue("logo", file);
    },
    onRemove: () => {
      setValue("logo", null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    initialImageUrl: currentLogoUrl ?? null,
  });

  const onSubmit = (data: PlatformLogoFormData) => {
    uploadLogo({ logo: data.logo ?? null });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle className="h5">{t("platformLogo.header")}</CardTitle>
          <CardDescription className="body-lg-md">{t("platformLogo.subHeader")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Controller
            name="logo"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="logo" className="body-base-md">
                  {t("platformLogo.field.uploadLabel")}
                </Label>
                <PlatformLogoUploadInput
                  field={{
                    ...field,
                    value: logoUrl || undefined,
                  }}
                  handleImageUpload={handleImageUpload}
                  isUploading={isUploading}
                  imageUrl={logoUrl}
                  fileInputRef={fileInputRef}
                />
                {isUploading && <p>{t("common.other.uploadingImage")}</p>}
              </div>
            )}
          />
          {logoUrl && (
            <Button type="button" onClick={removeImage} variant="destructive" className="mt-4">
              <Icon name="TrashIcon" className="mr-2" />
              {t("platformLogo.button.removeLogo")}
            </Button>
          )}
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? t("common.button.uploading") : t("common.button.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
