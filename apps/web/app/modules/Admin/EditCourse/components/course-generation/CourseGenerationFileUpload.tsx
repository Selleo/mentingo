import { LUMA_FILE_INGESTION_ALLOWED_EXTENSIONS } from "@repo/shared";
import { Paperclip } from "lucide-react";
import { useRef } from "react";

import { Button } from "~/components/ui/button";

import type { ChangeEvent } from "react";

type CourseGenerationFileUploadProps = {
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
};

export function CourseGenerationFileUpload({
  disabled = false,
  onFilesSelected,
}: CourseGenerationFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    onFilesSelected(files);
    event.target.value = "";
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="flex size-8 p-0 items-center justify-center rounded-lg"
        aria-label="Attach file"
      >
        <Paperclip className="size-4" />
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        disabled={disabled}
        accept={LUMA_FILE_INGESTION_ALLOWED_EXTENSIONS.join(",")}
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
