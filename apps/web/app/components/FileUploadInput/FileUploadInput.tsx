import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { match } from "ts-pattern";

import { FileUploadLoading } from "~/components/FileUploadInput/FileUploadLoading";
import { cn } from "~/lib/utils";
import { ContentTypes } from "~/modules/Admin/EditCourse/EditCourse.types";

import EmptyStateUpload from "./EmptyStateUpload";
import { PresentationPreview } from "./PresentationPreview";
import { SpreadsheetPreview } from "./SpreadsheetPreview";
import { VideoPreview } from "./VideoPreview";

type FileUploadInputProps = {
  handleFileUpload: (file: File) => Promise<void>;
  handleFileDelete: () => void;
  isUploading: boolean;
  contentTypeToDisplay: string;
  url?: string;
  className?: string;
};

const ACCEPTED_TYPE_FORMATS: Record<string, Record<string, string[]>> = {
  [ContentTypes.VIDEO_LESSON_FORM]: {
    "video/mp4": [".mp4"],
    "video/x-msvideo": [".avi"],
    "video/quicktime": [".mov"],
  },
  [ContentTypes.PRESENTATION_FORM]: {
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    "application/vnd.ms-powerpoint": [".ppt"],
    "application/vnd.oasis.opendocument.presentation": [".odp"],
  },
  ["Image"]: {
    "image/svg+xml": [".svg"],
    "image/png": [".png"],
    "image/jpeg": [".jpg"],
  },
  ["Spreadsheet"]: {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "text/csv": [".csv"],
  },
};

const FileUploadInput = ({
  handleFileUpload,
  handleFileDelete,
  isUploading,
  contentTypeToDisplay,
  url,
  className,
}: FileUploadInputProps) => {
  const acceptedTypes = ACCEPTED_TYPE_FORMATS[contentTypeToDisplay] || {};

  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const { getRootProps, getInputProps } = useDropzone({
    multiple: false,
    onDropAccepted: (acceptedFiles) => {
      handleFileChange(acceptedFiles[0]);
    },
    disabled: isUploading,
    accept: acceptedTypes,
  });

  useEffect(() => {
    if (url) {
      setVideoPreview(url);
    } else setVideoPreview(null);
  }, [url]);

  const handleFileChange = async (file?: File) => {
    if (file) {
      setFile(file);
      if (contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM) {
        const videoURL = URL.createObjectURL(file);
        setVideoPreview(videoURL);
      }
      await handleFileUpload(file);
    }
  };

  const renderFilePreview = () => {
    if (isUploading) return <FileUploadLoading />;

    return match(contentTypeToDisplay)
      .with(ContentTypes.VIDEO_LESSON_FORM, () => {
        return (
          <VideoPreview
            videoPreview={videoPreview}
            handleFileDelete={handleFileDelete}
            setFile={setFile}
            setVideoPreview={setVideoPreview}
          />
        );
      })
      .with(ContentTypes.PRESENTATION_FORM, () => {
        return (
          <PresentationPreview setFile={setFile} setVideoPreview={setVideoPreview} url={url} />
        );
      })
      .with("Spreadsheet", () => {
        return (
          <SpreadsheetPreview
            file={file}
            handleFileDelete={handleFileDelete}
            setVideoPreview={setVideoPreview}
            setFile={setFile}
          />
        );
      })
      .otherwise(() => null);
  };

  const filePreview = renderFilePreview();

  if (!videoPreview && !file) {
    return (
      <div {...getRootProps()} className="max-w-[440px]">
        <EmptyStateUpload contentTypeToDisplay={contentTypeToDisplay} className={className} />
        <input {...getInputProps()} className="sr-only" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-[240px] w-full max-w-[440px] overflow-hidden rounded-lg border border-neutral-200",
        className,
      )}
      {...getRootProps()}
    >
      {filePreview}
      <input {...getInputProps()} className="sr-only" />
    </div>
  );
};

export default FileUploadInput;
