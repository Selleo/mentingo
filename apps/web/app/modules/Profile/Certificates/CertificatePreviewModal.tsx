import { Dialog, DialogContent } from "~/components/ui/dialog";

import CertificatePreview from "./CertificatePreview";

import type { CertificatePreviewProps } from "./CertificatePreview";

type CertificatePreviewModalProps = Omit<CertificatePreviewProps, "onClose"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CertificatePreviewModal({
  open,
  onOpenChange,
  ...certificatePreviewProps
}: CertificatePreviewModalProps) {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex w-[min(1120px,95vw)] items-center justify-center max-w-none border-0 bg-transparent p-0 shadow-none"
        noCloseButton
      >
        <CertificatePreview {...certificatePreviewProps} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}
