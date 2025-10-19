import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useUploadCertificateBackgroundImage } from "~/api/mutations/admin/useUploadCertificateBackgroundImage";
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

const certificateBackgroundSchema = z.object({
  certificateBackgroundImage: z.instanceof(File).nullable(),
});

interface CertificateBackgroundUploadProps {
  certificateBackgroundImage: string | null;
}

export function CertificateBackgroundUpload({
  certificateBackgroundImage: initialCertificateBackgroundImage,
}: CertificateBackgroundUploadProps) {
  const { t } = useTranslation();
  const { mutate: uploadCertificateBackground, isPending } = useUploadCertificateBackgroundImage();
  const { setValue, control } = useForm({ resolver: zodResolver(certificateBackgroundSchema) });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    imageUrl: certificateBackgroundImage,
    isUploading,
    handleImageUpload,
    removeImage,
  } = useHandleImageUpload({
    onUpload: (file) => {
      setValue("certificateBackgroundImage", file);
    },
    onRemove: () => {
      setValue("certificateBackgroundImage", null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    initialImageUrl: initialCertificateBackgroundImage,
  });

  const handleUploadCertificateBackground = () => {
    const uploadedCertificateBackgroundImage = control._formValues.certificateBackgroundImage;
    uploadCertificateBackground({
      certificateBackgroundImage: uploadedCertificateBackgroundImage,
    });
  };

  return (
    <Card id="certificate-background-upload">
      <CardHeader>
        <CardTitle className="h5">{t("certificateBackgroundUpload.title")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("certificateBackgroundUpload.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Controller
          key="userAvatar"
          name="userAvatar"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-y-2">
              <ImageUploadInput
                field={{
                  ...field,
                  value: certificateBackgroundImage || undefined,
                }}
                handleImageUpload={handleImageUpload}
                isUploading={isUploading}
                imageUrl={certificateBackgroundImage}
                fileInputRef={fileInputRef}
              />
              {isUploading && <p>{t("certificateBackgroundUpload.other.uploading")}</p>}
            </div>
          )}
        />
        {certificateBackgroundImage && (
          <Button onClick={removeImage} className="mt-4 rounded bg-red-500 px-6 py-2 text-white">
            <Icon name="TrashIcon" className="mr-2" />
            {t("certificateBackgroundUpload.button.removeBackgroundImage")}
          </Button>
        )}
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button disabled={isPending} type="submit" onClick={handleUploadCertificateBackground}>
          {t("common.button.save")}
        </Button>
      </CardFooter>
    </Card>
  );
}
