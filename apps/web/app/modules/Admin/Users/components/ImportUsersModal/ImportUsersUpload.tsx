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

interface ImportUsersUploadProps {
  file: File | null;
  setFile: (file: File | null) => void;
  fileUrl: string | undefined;
  setFileUrl: (url: string | undefined) => void;
  handleUsersImport: () => void;
}

export const ImportUsersUpload = ({
  file,
  setFile,
  fileUrl,
  setFileUrl,
  handleUsersImport,
}: ImportUsersUploadProps) => {
  const { t } = useTranslation();
  return (
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
  );
};
