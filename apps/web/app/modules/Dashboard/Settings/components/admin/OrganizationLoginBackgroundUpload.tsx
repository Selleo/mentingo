import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useUploadBackgroundImage } from "~/api/mutations/admin/useUploadBackgroundImage";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
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
import { useHandleImageUpload } from "~/hooks/useHandleImageUpload";

const OrganizationLoginBackgroundUploadSchema = z.object({
  backgroundImage: z.instanceof(File).nullable(),
});

interface OrganizationLoginBackgroundUploadProps {
  backgroundImage: string | null;
}

export function OrganizationLoginBackgroundUpload({
  backgroundImage: initialBackgroundImage,
}: OrganizationLoginBackgroundUploadProps) {
  const { t } = useTranslation();
  const { mutate: uploadBackgroundImage, isPending } = useUploadBackgroundImage();
  const { setValue, control } = useForm({
    resolver: zodResolver(OrganizationLoginBackgroundUploadSchema),
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    imageUrl: backgroundImage,
    isUploading,
    handleImageUpload,
    removeImage,
  } = useHandleImageUpload({
    onUpload: (file) => {
      setValue("backgroundImage", file);
    },
    onRemove: () => {
      setValue("backgroundImage", null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    initialImageUrl: initialBackgroundImage,
  });

  const handleUploadBackgroundImage = () => {
    const uploadedBackgroundImage = control._formValues.backgroundImage;
    uploadBackgroundImage({
      backgroundImage: uploadedBackgroundImage,
    });
  };

  return (
    <Card id="organization-login-background-image-upload">
      <CardHeader>
        <CardTitle className="h5">{t("organizationLoginBackgroundImageUpload.title")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("organizationLoginBackgroundImageUpload.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Controller
          name="backgroundImage"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-y-2">
              <ImageUploadInput
                field={{
                  ...field,
                  value: backgroundImage || undefined,
                }}
                handleImageUpload={handleImageUpload}
                isUploading={isUploading}
                imageUrl={backgroundImage}
                fileInputRef={fileInputRef}
                variant="video"
              />
              {isUploading && <p>{t("common.button.uploading")}</p>}
            </div>
          )}
        />
        {backgroundImage && (
          <Button onClick={removeImage} className="mt-4 rounded bg-red-500 px-6 py-2 text-white">
            <Icon name="TrashIcon" className="mr-2" />
            {t("organizationLoginBackgroundImageUpload.button.removeBackgroundImage")}
          </Button>
        )}
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button disabled={isPending} type="submit" onClick={handleUploadBackgroundImage}>
          {t("common.button.save")}
        </Button>
      </CardFooter>
    </Card>
  );
}
