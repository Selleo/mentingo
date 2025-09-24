import { useEffect, useState } from "react";
import { match } from "ts-pattern";

import { FileUploadLoading } from "~/components/FileUploadInput/FileUploadLoading";
import { cn } from "~/lib/utils";
import { ContentTypes } from "~/modules/Admin/EditCourse/EditCourse.types";

import EmptyStateUpload from "./EmptyStateUpload";
import { PresentationPreview } from "./PresentationPreview";
import { SpreadsheetPreview } from "./SpreadsheetPreview";
import { VideoPreview } from "./VideoPreview";

import type { ChangeEvent } from "react";

type FileUploadInputProps = {
  handleFileUpload: (file: File) => Promise<void>;
  handleFileDelete: () => void;
  isUploading: boolean;
  contentTypeToDisplay: string;
  url?: string;
  className?: string;
};

const ACCEPTED_TYPE_FORMATS = {
  [ContentTypes.VIDEO_LESSON_FORM]: ".mp4,.avi,.mov",
  [ContentTypes.PRESENTATION_FORM]: ".pptx,.ppt,.odp",
  ["Image"]: ".svg,.png,.jpg",
  ["Spreadsheet"]: ".xlsx,.csv",
};

const FileUploadInput = ({
  handleFileUpload,
  handleFileDelete,
  isUploading,
  contentTypeToDisplay,
  url,
  className,
}: FileUploadInputProps) => {
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (url) {
      setVideoPreview(url);
    } else setVideoPreview(null);
  }, [url]);

  const acceptedTypes = ACCEPTED_TYPE_FORMATS[contentTypeToDisplay];

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      if (contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM) {
        const videoURL = URL.createObjectURL(uploadedFile);
        setVideoPreview(videoURL);
      }
      await handleFileUpload(uploadedFile);
    }
  };

  const renderFilePreview = () => {
    if (isUploading) return <FileUploadLoading />;

    return match(contentTypeToDisplay)
      .with(ContentTypes.VIDEO_LESSON_FORM, () => {
        return (
          <VideoPreview
            videoPreview={videoPreview}
            acceptedTypes={acceptedTypes}
            handleFileChange={handleFileChange}
            handleFileDelete={handleFileDelete}
            isUploading={isUploading}
            setFile={setFile}
            setVideoPreview={setVideoPreview}
          />
        );
      })
      .with(ContentTypes.PRESENTATION_FORM, () => {
        return (
          <PresentationPreview
            acceptedTypes={acceptedTypes}
            handleFileChange={handleFileChange}
            isUploading={isUploading}
            setFile={setFile}
            setVideoPreview={setVideoPreview}
            url={url}
          />
        );
      })
      .with("Spreadsheet", () => {
        return (
          <SpreadsheetPreview
            file={file}
            acceptedTypes={acceptedTypes}
            handleFileChange={handleFileChange}
            handleFileDelete={handleFileDelete}
            setVideoPreview={setVideoPreview}
            setFile={setFile}
            isUploading={isUploading}
          />
        );
      })
      .otherwise(() => null);
  };

  const filePreview = renderFilePreview();

  if (!videoPreview && !file) {
    return (
      <EmptyStateUpload
        acceptedTypes={acceptedTypes}
        handleFileChange={handleFileChange}
        isUploading={isUploading}
        contentTypeToDisplay={contentTypeToDisplay}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative h-[240px] w-full max-w-[440px] overflow-hidden rounded-lg border border-neutral-200",
        className,
      )}
    >
      {filePreview}
    </div>
  );
};

export default FileUploadInput;
