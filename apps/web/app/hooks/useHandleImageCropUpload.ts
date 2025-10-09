import { useCallback, useState } from "react";

import { useToast } from "~/components/ui/use-toast";

type UseHandleImageCropUploadOptions = {
  onUpload: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  initialImageUrl: string | null;
  isInitialImageCroppable: boolean;
};

export function useHandleImageCropUpload({
  onUpload,
  onRemove,
  initialImageUrl,
  isInitialImageCroppable,
}: UseHandleImageCropUploadOptions) {
  const { toast } = useToast();

  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [imageCropUrl, setImageCropUrl] = useState<string | null>(initialImageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [isCroppable, setIsCroppable] = useState(isInitialImageCroppable);

  const handleImageUpload = useCallback(
    async (file: File) => {
      setImageUrl(URL.createObjectURL(file));
      setIsCroppable(imageUrl !== initialImageUrl);
    },
    [imageUrl, initialImageUrl],
  );

  const handleImageCropUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setImageCropUrl(URL.createObjectURL(file));
      try {
        await onUpload(file);
        setIsCroppable(true);
      } catch (error) {
        toast({ description: `Error uploading image: ${error}`, variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload, toast],
  );

  const removeImage = useCallback(async () => {
    setImageUrl(null);
    if (onRemove) {
      await onRemove();
    }
  }, [onRemove]);

  return {
    imageUrl,
    imageCropUrl,
    isUploading,
    isCroppable,
    handleImageUpload,
    handleImageCropUpload,
    removeImage,
  };
}
