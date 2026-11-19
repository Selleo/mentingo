import { FileSpreadsheet, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SplitButton } from "~/components/SplitButton/SplitButton";

import { REPORTS_HANDLES } from "../../../../e2e/data/reports/handles";

type ReportExportMenuProps = {
  disabled: boolean;
  onExport: (format: "xlsx" | "pdf") => void;
};

export function ReportExportMenu({ disabled, onExport }: ReportExportMenuProps) {
  const { t } = useTranslation();

  return (
    <SplitButton
      icon={<FileSpreadsheet className="size-4 shrink-0" aria-hidden="true" />}
      disabled={disabled}
      testId={REPORTS_HANDLES.EXPORT_SPREADSHEET}
      secondaryLabel={t("reports.exports.exportPdf")}
      secondaryIcon={<FileText className="size-4 shrink-0" aria-hidden="true" />}
      secondaryDisabled={disabled}
      menuAriaLabel={t("reports.exports.moreOptions")}
      onClick={() => onExport("xlsx")}
      onSecondaryClick={() => onExport("pdf")}
    >
      {t("reports.exports.exportSpreadsheet")}
    </SplitButton>
  );
}
