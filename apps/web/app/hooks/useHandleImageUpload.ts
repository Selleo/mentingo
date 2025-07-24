import { useCallback, useState } from "react";

import { useToast } from "~/components/ui/use-toast";

type UseHandleImageUploadOptions = {
  onUpload: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  initialImageUrl: string | null;
};

export function useHandleImageUpload({
  onUpload,
  onRemove,
  initialImageUrl,
}: UseHandleImageUploadOptions) {
  const { toast } = useToast();

  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        setImageUrl(URL.createObjectURL(file));
        await onUpload(file);
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
    isUploading,
    handleImageUpload,
    removeImage,
  };
}
