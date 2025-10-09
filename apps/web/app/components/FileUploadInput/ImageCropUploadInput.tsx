import { t } from "i18next";
import { useState } from "react";
import Cropper from "react-easy-crop";

import { cn } from "~/lib/utils";

import { Icon } from "../Icon";

import { generateImageCrop } from "./utils";

import type { Area, Point } from "react-easy-crop";

type ImageCropUploadProps = {
  handleImageUpload: (file: File) => void;
  handleImageCropUpload: (file: File) => void;
  isUploading: boolean;
  isCroppable: boolean;
  imageUrl?: string | null;
  fileInputRef?: React.RefObject<HTMLInputElement>;
};

export const ImageCropUploadInput = ({
  handleImageUpload,
  handleImageCropUpload,
  isUploading,
  isCroppable,
  imageUrl,
  fileInputRef,
}: ImageCropUploadProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropComplete = async (_croppedArea: Area, croppedAreaPixels: Area) => {
    if (imageUrl) {
      handleImageCropUpload(await generateImageCrop(imageUrl, croppedAreaPixels));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-y-2">
      <div className="relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-solid border-gray-300 bg-gray-100">
        {imageUrl ? (
          <>
            {isCroppable ? (
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropComplete}
              />
            ) : (
              <img src={imageUrl} alt="Uploaded" className="h-full w-full object-cover" />
            )}
          </>
        ) : (
          <>
            <div
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center text-center",
                {
                  "text-white": imageUrl,
                },
              )}
            >
              <Icon name="UploadImageIcon" />

              <div className="mt-2 flex items-center justify-center">
                <span className={`text-lg font-semibold text-primary-400`}>
                  {imageUrl ? t("uploadFile.replace") : t("uploadFile.header")}
                </span>
                <span className="ml-2 text-lg font-semibold">{t("uploadFile.subHeader")}</span>
              </div>

              <div
                className={cn("mt-2 w-full px-2 text-sm", {
                  "text-white": imageUrl,
                  "text-gray-600": !imageUrl,
                })}
              >
                {t("uploadFile.details.imageCrop")}
              </div>
            </div>
            <input
              ref={fileInputRef}
              data-testid="imageUpload"
              type="file"
              accept=".png, .jpg, .jpeg, .svg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImageUpload(file);
                }
              }}
              disabled={isUploading}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </>
        )}
      </div>
    </div>
  );
};
