import { useTranslation } from "react-i18next";

import FileUploadInput from "~/components/FileUploadInput/FileUploadInput";
import { Button } from "~/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { USERS_IMPORT_MODAL_HANDLES } from "../../../../../../e2e/data/users/handles";

interface ImportUsersUploadProps {
  file: File | null;
  setFile: (file: File | null) => void;
  fileUrl: string | undefined;
  setFileUrl: (url: string | undefined) => void;
  handleUsersImport: () => void;
  isImportingUsers: boolean;
}

export const ImportUsersUpload = ({
  file,
  setFile,
  fileUrl,
  setFileUrl,
  handleUsersImport,
  isImportingUsers,
}: ImportUsersUploadProps) => {
  const { t } = useTranslation();
  return (
    <DialogContent data-testid={USERS_IMPORT_MODAL_HANDLES.ROOT} className="gap-2">
      <DialogHeader>
        <DialogTitle>{t("adminUsersView.modal.title.import")}</DialogTitle>
      </DialogHeader>
      <DialogDescription>
        <span className="body-sm block text-muted-foreground">
          {t("adminUsersView.modal.description.import")}
        </span>
      </DialogDescription>

      <div className="py-4">
        <div data-testid={USERS_IMPORT_MODAL_HANDLES.UPLOAD}>
          <FileUploadInput
            className="max-w-none"
            inputTestId={USERS_IMPORT_MODAL_HANDLES.FILE_INPUT}
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
        </div>
        <div className="pt-2 text-sm leading-none text-red-400">
          {t("adminUsersView.modal.note.import")}
        </div>
      </div>

      <DialogFooter>
        <Button
          data-testid={USERS_IMPORT_MODAL_HANDLES.SUBMIT}
          disabled={!file || isImportingUsers}
          onClick={handleUsersImport}
        >
          {t("adminUsersView.modal.title.import")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
