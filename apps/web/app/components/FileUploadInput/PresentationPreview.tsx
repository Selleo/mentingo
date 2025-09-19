import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { useTranslation } from "react-i18next";

import { Icon } from "../Icon";
import { Button } from "../ui/button";

interface PresentationPreviewProps {
  acceptedTypes: string;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  setFile: (file: File | null) => void;
  setVideoPreview: (url: string | null) => void;
  url?: string;
}

export const PresentationPreview = ({
  acceptedTypes,
  handleFileChange,
  isUploading,
  setFile,
  setVideoPreview,
  url,
}: PresentationPreviewProps) => {
  const { t } = useTranslation();

  const docs = url
    ? [
        {
          uri: url,
          fileType: "pptx",
          fileName: "Presentation",
        },
      ]
    : [];

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
            <span className="text-primary-400">{t("uploadFile.header")}</span>{" "}
            <span className="text-white">{t("uploadFile.subHeader")}</span>
          </div>
          <div className="details text-neutral-200">{t("uploadFile.details.presentation")}</div>
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
          <Icon name="TrashIcon" /> {t("uploadFile.remove.presentation")}
        </Button>
      </label>
    </div>
  );
};
