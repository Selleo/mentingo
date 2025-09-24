import { useState } from "react";

import { useImportUsers } from "~/api/mutations/admin/useImportUsers";
import { Dialog } from "~/components/ui/dialog";

import { ImportUsersResult } from "./ImportUsersResult";
import { ImportUsersUpload } from "./ImportUsersUpload";

import type { ImportUsersResponse } from "~/api/generated-api";
import type { UsersParams } from "~/api/queries/useUsers";

interface ImportUsersModalProps {
  open: boolean;
  onClose: () => void;
  searchParams?: UsersParams;
}

export const ImportUsersModal = ({ open, onClose, searchParams }: ImportUsersModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | undefined>(undefined);

  const [importUsersResult, setImportUsersResult] = useState<ImportUsersResponse | null>(null);

  const { mutate: importUsers } = useImportUsers(searchParams);

  const handleUsersImport = () => {
    if (!file) return;

    importUsers(file, {
      onSuccess: (data) => {
        setFile(null);
        setFileUrl(undefined);
        setImportUsersResult(data);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {importUsersResult ? (
        <ImportUsersResult onClose={onClose} importResult={importUsersResult} />
      ) : (
        <ImportUsersUpload
          file={file}
          setFile={setFile}
          fileUrl={fileUrl}
          setFileUrl={setFileUrl}
          handleUsersImport={handleUsersImport}
        />
      )}
    </Dialog>
  );
};
