import { Download, FileSpreadsheet, Info } from "lucide-react";
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
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { triggerBrowserDownload } from "~/utils/downloadFile";

import { USERS_IMPORT_MODAL_HANDLES } from "../../../../../../e2e/data/users/handles";

import { buildUsersImportSampleCsv } from "./ImportUsersUpload.utils";

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

  const language = useLanguageStore((state) => state.language);

  const handleSampleDownload = () => {
    triggerBrowserDownload(
      new Blob([buildUsersImportSampleCsv(t, language)], {
        type: "text/csv;charset=utf-8",
      }),
      t("adminUsersView.modal.sampleFile.filename"),
    );
  };

  return (
    <DialogContent
      data-testid={USERS_IMPORT_MODAL_HANDLES.ROOT}
      className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl"
    >
      <DialogHeader className="border-b border-neutral-200 bg-primary-50/50 px-6 py-5 pr-12">
        <DialogTitle>{t("adminUsersView.modal.title.import")}</DialogTitle>
        <DialogDescription className="body-sm pt-1 leading-6 text-muted-foreground">
          {t("adminUsersView.modal.description.import")}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-6 py-5">
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-800">
              <FileSpreadsheet className="size-5" aria-hidden="true" />
            </span>
            <span className="body-sm-md text-neutral-900">
              {t("adminUsersView.modal.sampleFile.filename")}
            </span>
          </div>
          <Button
            data-testid={USERS_IMPORT_MODAL_HANDLES.SAMPLE_DOWNLOAD}
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2 sm:w-auto"
            onClick={handleSampleDownload}
          >
            <Download className="size-4" aria-hidden="true" />
            {t("adminUsersView.modal.button.downloadSample")}
          </Button>
        </div>
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
        <div className="flex gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm leading-5 text-neutral-700">
          <Info className="mt-0.5 size-4 shrink-0 text-neutral-500" aria-hidden="true" />
          <span>{t("adminUsersView.modal.note.import")}</span>
        </div>
      </div>

      <DialogFooter className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
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
