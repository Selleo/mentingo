import { Dialog, DialogContent } from "~/components/ui/dialog";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onClose: () => void;
  onRestoreFocus: () => void;
};

export function HelpdeskVideoDialogFrame({ children, onClose, onRestoreFocus }: Props) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="z-[80]"
        className="z-[81] max-h-[92dvh] w-[calc(100vw-24px)] max-w-5xl gap-0 overflow-y-auto rounded-xl p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
