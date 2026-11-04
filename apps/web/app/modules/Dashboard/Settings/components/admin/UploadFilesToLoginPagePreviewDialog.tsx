import { X } from "lucide-react";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { PdfPreviewViewer } from "~/components/RichText/extensions/pdfPreview/PdfPreviewViewer";
import { Button } from "~/components/ui/button";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import { buildLoginPageFilePreviewUrl } from "./buildLoginPageFilePreviewUrl";

interface UploadFilesToLoginPagePreviewDialogProps {
  open: boolean;
  resourceName: string;
  resourceId: string | null;
  onClose: () => void;
}

export const UploadFilesToLoginPagePreviewDialog = ({
  open,
  resourceName,
  resourceId,
  onClose,
}: UploadFilesToLoginPagePreviewDialogProps) => {
  const { t } = useTranslation();

  const modal = useMemo(() => {
    if (!open || !resourceId) return null;

    return (
      <div
        className="fixed left-0 top-0 z-10 box-border flex size-full justify-center bg-gray-900/50 p-4"
        data-testid={SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_PREVIEW_DIALOG}
      >
        <div className="flex size-full max-w-6xl flex-col">
          <div className="flex items-center justify-between rounded-t-lg bg-white p-4">
            <div>
              <h2 className="font-medium text-primary-800">{resourceName}</h2>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex size-8 items-center justify-center p-0 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                data-testid={SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_PREVIEW_CLOSE}
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>
          <div className="box-border flex flex-1 justify-center overflow-auto rounded-b-lg bg-neutral-50 p-4">
            <div className="w-full max-w-4xl">
              <PdfPreviewViewer
                src={buildLoginPageFilePreviewUrl(resourceId)}
                name={resourceName}
                loadingMessage={t("loginFilesUpload.previewDialog.loading")}
                errorMessage={t("loginFilesUpload.previewDialog.error")}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }, [onClose, open, resourceId, resourceName, t]);

  if (!modal) return null;

  if (typeof document === "undefined") {
    return modal;
  }

  return createPortal(modal, document.body);
};
