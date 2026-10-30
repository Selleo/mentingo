import { AUDIO_UPLOAD_MAX_BYTES, isAudioFile } from "@repo/shared";
import { AudioLines } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { Button } from "~/components/ui/button";

import { AUDIO_ACCEPTED_FILE_TYPES } from "../utils/audioFileTypes";

type AudioUploadControlProps = {
  onUpload: (file: File) => Promise<void>;
};

export const AudioUploadControl = ({ onUpload }: AudioUploadControlProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    setError(null);
    setIsUploading(true);
    try {
      for (const file of files) {
        if (!isAudioFile(file)) {
          setError(t("richText.audio.invalidType"));
          continue;
        }
        if (file.size > AUDIO_UPLOAD_MAX_BYTES) {
          setError(t("richText.audio.tooLarge", { maxMB: AUDIO_UPLOAD_MAX_BYTES / 1024 / 1024 }));
          continue;
        }
        try {
          await onUpload(file);
        } catch (uploadError) {
          setError(getTranslatedApiErrorMessage(uploadError, t, t("richText.audio.uploadFailed")));
        }
      }
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <input
        ref={inputRef}
        data-testid="rich-text-editor-audio-upload-input"
        type="file"
        accept={AUDIO_ACCEPTED_FILE_TYPES.join(",")}
        multiple
        className="hidden"
        aria-label={t("richText.audio.upload")}
        onChange={(event) => void handleFiles(Array.from(event.target.files ?? []))}
      />
      <Button
        data-testid="rich-text-editor-audio-upload-button"
        type="button"
        size="sm"
        variant="ghost"
        aria-label={t("richText.audio.upload")}
        title={t("richText.audio.upload")}
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        <AudioLines className="mr-2 size-4" aria-hidden />
        {isUploading ? t("common.button.uploading") : t("richText.audio.upload")}
      </Button>
      {error && (
        <p role="alert" className="m-0 max-w-xs whitespace-normal text-sm text-error-600">
          {error}
        </p>
      )}
    </div>
  );
};
