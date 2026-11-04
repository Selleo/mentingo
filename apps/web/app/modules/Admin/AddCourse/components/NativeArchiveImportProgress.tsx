import { FolderUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import {
  NativeArchiveJobProgress,
  NativeArchiveProgressBar,
} from "~/modules/Admin/components/NativeArchiveJobProgress";
import { formatFileSize } from "~/modules/Admin/Scorm/components/ScormPackageUploadField";

import type { NativeArchiveJobProgress as NativeArchiveJobProgressValue } from "~/api/mutations/admin/nativeArchive.types";

const IMPORT_STEP_COUNT = 2;

type NativeArchiveImportProgressProps = {
  file: File;
  isUploading: boolean;
  uploadPercent: number;
  jobProgress: NativeArchiveJobProgressValue | null | undefined;
};

/** Follows an import through its two steps: uploading the package, then importing it. */
export function NativeArchiveImportProgress({
  file,
  isUploading,
  uploadPercent,
  jobProgress,
}: NativeArchiveImportProgressProps) {
  const { t } = useTranslation();
  const currentStep = isUploading ? 1 : 2;

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 rounded-lg border-2 border-primary-200 bg-white p-6">
      <div className="flex w-full min-w-0 items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-800">
          <FolderUp className="size-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="body-base-md truncate text-neutral-950">{file.name}</p>
          <p className="body-sm mt-1 text-neutral-700">
            {formatFileSize(file.size)} ·{" "}
            {t("nativeArchive.progress.step", { current: currentStep, total: IMPORT_STEP_COUNT })}
          </p>
        </div>
      </div>
      {match(isUploading)
        .with(true, () => (
          <NativeArchiveProgressBar
            label={t("nativeArchive.progress.uploadingPackage")}
            percent={uploadPercent}
          />
        ))
        .with(false, () => <NativeArchiveJobProgress progress={jobProgress} />)
        .exhaustive()}
    </div>
  );
}
