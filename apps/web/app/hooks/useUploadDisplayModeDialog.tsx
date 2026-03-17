import { useCallback, useEffect, useRef, useState } from "react";

import { UploadDisplayModeDialog } from "~/components/RichText/components/UploadDisplayModeDialog";

import type { RichTextResourceDisplayMode } from "./useEntityResourceUpload";

type PendingDialogData = {
  fileName: string;
  resolve: (mode: RichTextResourceDisplayMode | null) => void;
};

export const useUploadDisplayModeDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<RichTextResourceDisplayMode>("preview");
  const pendingRef = useRef<PendingDialogData | null>(null);

  const askForDisplayMode = useCallback((fileName: string) => {
    setMode("preview");
    setIsOpen(true);

    return new Promise<RichTextResourceDisplayMode | null>((resolve) => {
      pendingRef.current = { fileName, resolve };
    });
  }, []);

  const handleCancel = useCallback(() => {
    pendingRef.current?.resolve(null);
    pendingRef.current = null;
    setIsOpen(false);
  }, []);

  const handleConfirm = useCallback(() => {
    pendingRef.current?.resolve(mode);
    pendingRef.current = null;
    setIsOpen(false);
  }, [mode]);

  useEffect(() => {
    return () => {
      pendingRef.current?.resolve(null);
      pendingRef.current = null;
    };
  }, []);

  const dialog = (
    <UploadDisplayModeDialog
      open={isOpen}
      fileName={pendingRef.current?.fileName ?? null}
      mode={mode}
      onModeChange={setMode}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );

  return { askForDisplayMode, dialog };
};
