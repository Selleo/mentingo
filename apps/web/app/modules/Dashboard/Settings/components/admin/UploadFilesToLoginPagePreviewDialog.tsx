import { X } from "lucide-react";
import { useMemo } from "react";
import { createPortal } from "react-dom";

import { Button } from "~/components/ui/button";

interface UploadFilesToLoginPagePreviewDialogProps {
  open: boolean;
  resourceName: string;
  resourceUrl: string;
  onClose: () => void;
}

export const UploadFilesToLoginPagePreviewDialog = ({
  open,
  resourceName,
  resourceUrl,
  onClose,
}: UploadFilesToLoginPagePreviewDialogProps) => {
  const modal = useMemo(() => {
    if (!open) return null;

    return (
      <div className="fixed left-0 top-0 z-10 box-border flex size-full justify-center bg-gray-900/50 p-4">
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
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>
          <div className="box-border flex flex-1 justify-center overflow-auto rounded-b-lg bg-neutral-50 p-4">
            <div className="flex size-full rounded-md bg-white shadow-sm">
              <iframe
                title={resourceName}
                src={`${resourceUrl}#toolbar=0`}
                className="size-full rounded border-0"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }, [onClose, open, resourceName, resourceUrl]);

  if (!modal) return null;

  if (typeof document === "undefined") {
    return modal;
  }

  return createPortal(modal, document.body);
};
