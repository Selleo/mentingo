import { useCallback, useState } from "react";

import { useToast } from "~/components/ui/use-toast";

type UseHandleImageUploadOptions = {
  onUpload: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  initialImageUrl: string | null;
  uploadSuccessMessage?: string;
  removeSuccessMessage?: string;
  uploadErrorMessage?: string;
  removeErrorMessage?: string;
};

export function useHandleImageUpload({
  onUpload,
  onRemove,
  initialImageUrl,
  uploadSuccessMessage,
  removeSuccessMessage,
  uploadErrorMessage,
  removeErrorMessage,
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
        if (uploadSuccessMessage) {
          toast({ description: uploadSuccessMessage });
        }
      } catch (error) {
        toast({
          description: uploadErrorMessage ?? `Error uploading image: ${error}`,
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload, toast, uploadErrorMessage, uploadSuccessMessage],
  );

  const removeImage = useCallback(async () => {
    try {
      setImageUrl(null);
      if (onRemove) {
        await onRemove();
      }
      if (removeSuccessMessage) {
        toast({ description: removeSuccessMessage });
      }
    } catch (error) {
      toast({
        description: removeErrorMessage ?? `Error removing image: ${error}`,
        variant: "destructive",
      });
    }
  }, [onRemove, removeErrorMessage, removeSuccessMessage, toast]);

  return {
    imageUrl,
    isUploading,
    handleImageUpload,
    removeImage,
  };
}
