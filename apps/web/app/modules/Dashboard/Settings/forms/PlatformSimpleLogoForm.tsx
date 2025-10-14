import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUploadPlatformSimpleLogo } from "~/api/mutations/admin/useUploadPlatformSimpleLogo";
import { usePlatformSimpleLogo } from "~/api/queries";
import PlatformSimpleLogoUploadInput from "~/components/FileUploadInput/PlatformSimpleLogoUploadInput";
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

interface PlatformSimpleLogoFormData {
  logo: File | null;
}

export const PlatformSimpleLogoForm = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: currentLogoUrl } = usePlatformSimpleLogo();
  const { mutate: uploadLogo, isPending } = useUploadPlatformSimpleLogo();

  const { control, handleSubmit, setValue } = useForm<PlatformSimpleLogoFormData>({
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
    initialImageUrl: typeof currentLogoUrl === "string" ? currentLogoUrl : null,
  });

  const onSubmit = (data: PlatformSimpleLogoFormData) => {
    uploadLogo({ logo: data.logo ?? null });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle>{t("platformSimpleLogo.header")}</CardTitle>
          <CardDescription>{t("platformSimpleLogo.subHeader")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Controller
            name="logo"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="simple-logo">{t("platformSimpleLogo.field.uploadLabel")}</Label>
                <PlatformSimpleLogoUploadInput
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
              {t("platformSimpleLogo.button.removeLogo")}
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
