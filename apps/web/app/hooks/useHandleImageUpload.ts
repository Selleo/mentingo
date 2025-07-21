import { useCallback } from "react";

import { useToast } from "~/components/ui/use-toast";

import type { UseFormSetValue, FieldValues, Path } from "react-hook-form";

type UseHandleImageUpload<T extends FieldValues> = {
  fieldName: Path<T>;
  setValue: UseFormSetValue<T>;
  setDisplayThumbnailUrl: (url: string | null) => void;
  setIsUploading: (isUploading: boolean) => void;
};

export function useHandleImageUpload<T extends FieldValues>({
  fieldName,
  setValue,
  setDisplayThumbnailUrl,
  setIsUploading,
}: UseHandleImageUpload<T>) {
  const { toast } = useToast();

  return useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        setDisplayThumbnailUrl(URL.createObjectURL(file));
        setValue(fieldName, file as T[typeof fieldName]);
      } catch (error) {
        toast({ description: `Error uploading image: ${error}`, variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
    },
    [fieldName, setDisplayThumbnailUrl, setIsUploading, setValue, toast],
  );
}
