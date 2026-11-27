import { useTranslation } from "react-i18next";

type DirectoryGroupLabelProps = {
  email: string;
  isMissingInDirectory: boolean;
};

export function DirectoryGroupLabel({ email, isMissingInDirectory }: DirectoryGroupLabelProps) {
  const { t } = useTranslation();

  return (
    <span className="min-w-0 flex-1 space-y-0.5">
      <span className="body-sm-md block break-all text-neutral-950">{email}</span>
      {isMissingInDirectory && (
        <span className="details block text-error-700">
          {t("directorySync.missingObjects.mappingMissing")}
        </span>
      )}
    </span>
  );
}
