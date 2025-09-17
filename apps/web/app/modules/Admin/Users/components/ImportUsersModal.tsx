import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useImportUsers } from "~/api/mutations/admin/useImportUsers";
import FileUploadInput from "~/components/FileUploadInput/FileUploadInput";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import type { UsersParams } from "~/api/queries/useUsers";

interface ImportUsersModalProps {
  open: boolean;
  onClose: () => void;
  searchParams?: UsersParams;
}

export const ImportUsersModal = ({ open, onClose, searchParams }: ImportUsersModalProps) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | undefined>(undefined);

  const { mutate: importUsers } = useImportUsers(searchParams);

  const handleUsersImport = () => {
    if (!file) return;

    importUsers(file, {
      onSuccess: () => {
        setFile(null);
        setFileUrl(undefined);
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="gap-2">
        <DialogHeader>
          <DialogTitle>{t("adminUsersView.modal.title.import")}</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          <div className="body-sm text-muted-foreground">
            {t("adminUsersView.modal.description.import")}
          </div>
        </DialogDescription>

        <div className="py-4">
          <FileUploadInput
            className="max-w-none"
            handleFileUpload={async (uploadedFile: File) => {
              setFile(uploadedFile);
              setFileUrl(URL.createObjectURL(uploadedFile));
            }}
            handleFileDelete={() => {
              setFile(null);
              setFileUrl(undefined);
            }}
            isUploading={false}
            contentTypeToDisplay="Spreadsheet"
            url={fileUrl}
          />
          <div className="pt-2 text-sm leading-none text-red-400">
            {t("adminUsersView.modal.note.import")}
          </div>
        </div>

        <DialogFooter>
          <Button disabled={!file} onClick={handleUsersImport}>
            {t("adminUsersView.modal.title.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
