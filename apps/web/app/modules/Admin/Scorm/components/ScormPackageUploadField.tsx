import { FileArchive, Replace, Trash2, UploadCloud } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type ScormPackageUploadFieldProps = {
  file?: File;
  error?: string;
  disabled?: boolean;
  readonlyTitle?: string;
  readonlyDescription?: string;
  testIds?: {
    root?: string;
    input?: string;
    selectedFile?: string;
    readonly?: string;
    replaceButton?: string;
    removeButton?: string;
  };
  onChange: (file: File) => void;
  onClear: () => void;
};

const formatFileSize = (size: number) => {
  const sizeInMb = size / (1024 * 1024);

  return `${sizeInMb.toFixed(sizeInMb >= 10 ? 0 : 1)} MB`;
};

export const ScormPackageUploadField = ({
  file,
  error,
  disabled = false,
  readonlyTitle,
  readonlyDescription,
  testIds,
  onChange,
  onClear,
}: ScormPackageUploadFieldProps) => {
  const { t } = useTranslation();

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
    },
    multiple: false,
    disabled,
    noClick: Boolean(file) || disabled,
    onDropAccepted: ([acceptedFile]) => {
      if (acceptedFile) onChange(acceptedFile);
    },
  });

  return (
    <div>
      <div
        {...getRootProps({ "data-testid": testIds?.root })}
        className={cn(
          "group cursor-pointer rounded-lg border-2 border-dashed bg-white p-6 transition-colors",
          file ? "border-primary-200" : "border-neutral-300 hover:border-primary-400",
          isDragActive && "border-primary-600 bg-primary-50",
          error && "border-red-400 bg-red-50/40",
          disabled &&
            "cursor-not-allowed border-neutral-200 bg-neutral-50 opacity-75 hover:border-neutral-200",
        )}
      >
        <input {...getInputProps()} data-testid={testIds?.input} />
        {disabled ? (
          <div data-testid={testIds?.readonly} className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
              <FileArchive className="size-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="body-base-md text-neutral-950">
                {readonlyTitle ?? t("adminScorm.lesson.packageAttached")}
              </p>
              <p className="body-sm mt-1 text-neutral-700">
                {readonlyDescription ?? t("adminScorm.lesson.packageLocked")}
              </p>
            </div>
          </div>
        ) : file ? (
          <div data-testid={testIds?.selectedFile} className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-800">
                <FileArchive className="size-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="body-base-md truncate text-neutral-950">{file.name}</p>
                <p className="body-sm mt-1 text-neutral-700">
                  {formatFileSize(file.size)} · {t("adminScorm.create.packageReady")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                data-testid={testIds?.replaceButton}
                onClick={open}
              >
                <Replace className="mr-2 size-4" />
                {t("adminScorm.create.replacePackage")}
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid={testIds?.removeButton}
                onClick={onClear}
              >
                <Trash2 className="mr-2 size-4" />
                {t("adminScorm.create.removePackage")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-lg bg-primary-50 text-primary-800">
              <UploadCloud className="size-7" aria-hidden="true" />
            </div>
            <p className="body-base-md text-neutral-950">
              {isDragActive
                ? t("adminScorm.create.dropPackage")
                : t("adminScorm.create.uploadPackage")}
            </p>
            <p className="body-sm mt-2 max-w-md text-neutral-700">
              {t("adminScorm.create.uploadPackageDescription")}
            </p>
          </div>
        )}
      </div>
      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
    </div>
  );
};
