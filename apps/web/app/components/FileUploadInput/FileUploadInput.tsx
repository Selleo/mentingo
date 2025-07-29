import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { useEffect, useState } from "react";

import { FileUploadLoading } from "~/components/FileUploadInput/FileUploadLoading";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { ContentTypes } from "~/modules/Admin/EditCourse/EditCourse.types";

import EmptyStateUpload from "./EmptyStateUpload";

import type { ChangeEvent } from "react";

type FileUploadInputProps = {
  handleFileUpload: (file: File) => Promise<void>;
  handleFileDelete: () => void;
  isUploading: boolean;
  contentTypeToDisplay: string;
  url?: string;
};

const ACCEPTED_TYPE_FORMATS = {
  [ContentTypes.VIDEO_LESSON_FORM]: ".mp4,.avi,.mov",
  [ContentTypes.PRESENTATION_FORM]: ".pptx,.ppt,.odp",
  ["Image"]: ".svg,.png,.jpg",
};

const FileUploadInput = ({
  handleFileUpload,
  handleFileDelete,
  isUploading,
  contentTypeToDisplay,
  url,
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

  const docs = url
    ? [
        {
          uri: url,
          fileType: "pptx",
          fileName: "Presentation",
        },
      ]
    : [];

  const renderFilePreview = () => {
    if (isUploading) return <FileUploadLoading />;

    if (contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM) {
      return (
        <div className="relative size-full">
          <video src={videoPreview ?? ""} className="h-auto w-full">
            <track kind="captions" className="sr-only" />
          </video>
          <label
            htmlFor="file-upload"
            className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-y-3 rounded-lg border border-neutral-200 bg-[rgba(18,21,33,0.8)]"
          >
            <Icon name="UploadImageIcon" className="size-10 text-primary-700" />
            <div className="body-sm flex flex-col gap-y-1">
              <div className="text-center">
                <span className="text-primary-400">Click to replace</span>{" "}
                <span className="text-white">or drag and drop</span>
              </div>
              <div className="details text-neutral-200">
                MP4, MOV, MPEG-2 or Hevc (max. to 100MB)
              </div>
            </div>
            <input
              type="file"
              id="file-upload"
              accept={acceptedTypes}
              onChange={handleFileChange}
              disabled={isUploading}
              className="sr-only"
            />
            <Button
              variant="destructive"
              className="mt-2 gap-x-1"
              onClick={() => {
                handleFileDelete();
                setFile(null);
                setVideoPreview(null);
              }}
            >
              <Icon name="TrashIcon" /> Remove video
            </Button>
          </label>
        </div>
      );
    }

    return (
      <div className="h-auto w-full">
        <DocViewer
          documents={docs}
          pluginRenderers={DocViewerRenderers}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
          config={{
            header: {
              disableFileName: true,
              disableHeader: true,
            },
          }}
        />
        <label
          htmlFor="file-upload"
          className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-y-3 rounded-lg border border-neutral-200 bg-[rgba(18,21,33,0.8)]"
        >
          <Icon name="UploadImageIcon" className="size-10 text-primary-700" />
          <div className="body-sm flex flex-col gap-y-1">
            <div className="text-center">
              <span className="text-primary-400">Click to replace</span>{" "}
              <span className="text-white">or drag and drop</span>
            </div>
            <div className="details text-neutral-200">PPT/PPTX (max. to 100MB)</div>
          </div>
          <input
            type="file"
            id="file-upload"
            accept={acceptedTypes}
            onChange={handleFileChange}
            disabled={isUploading}
            className="sr-only"
          />
          <Button
            variant="destructive"
            className="mt-2 gap-x-1"
            onClick={() => {
              setFile(null);
              setVideoPreview(null);
            }}
          >
            <Icon name="TrashIcon" /> Remove presentation
          </Button>
        </label>
      </div>
    );
  };

  const filePreview = renderFilePreview();

  if (!videoPreview && !file) {
    return (
      <EmptyStateUpload
        acceptedTypes={acceptedTypes}
        handleFileChange={handleFileChange}
        isUploading={isUploading}
        contentTypeToDisplay={contentTypeToDisplay}
      />
    );
  }

  return (
    <div className="relative h-[240px] w-full max-w-[440px] overflow-hidden rounded-lg border border-neutral-200">
      {filePreview}
    </div>
  );
};

export default FileUploadInput;
