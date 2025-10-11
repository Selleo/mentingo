import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { Icon } from "../Icon";

interface ImageUploadProps {
  field: { value?: string };
  handleImageUpload: (file: File) => void;
  isUploading: boolean;
  imageUrl?: string | null;
  fileInputRef?: React.RefObject<HTMLInputElement>;
}

const ImageUploadInput = ({
  field,
  handleImageUpload,
  isUploading,
  imageUrl,
  fileInputRef,
}: ImageUploadProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-y-2">
      <div className="relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-solid border-gray-300 bg-gray-100">
        {imageUrl && (
          <img
            src={imageUrl || field.value}
            alt="Uploaded"
            className="h-full w-full object-cover"
          />
        )}
        <div
          className={cn("absolute inset-0 flex flex-col items-center justify-center text-center", {
            "text-white": field.value,
          })}
        >
          <Icon name="UploadImageIcon" />

          <div className="mt-2 flex items-center justify-center">
            <span className={`text-lg font-semibold text-primary-400`}>
              {field.value ? t("uploadFile.replace") : t("uploadFile.header")}
            </span>
            <span className="ml-2 text-lg font-semibold">{t("uploadFile.subHeader")}</span>
          </div>

          <div
            className={cn("mt-2 w-full px-2 text-sm", {
              "text-white": field.value,
              "text-gray-600": !field.value,
            })}
          >
            PNG, JPG or JPEG (max. 20 MB, 800x800px)
          </div>
        </div>
        <input
          ref={fileInputRef}
          data-testid="imageUpload"
          type="file"
          accept=".png, .jpg, .jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImageUpload(file);
            }
          }}
          disabled={isUploading}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
};

export default ImageUploadInput;
