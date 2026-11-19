import { AlertTriangle, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { REPORTS_HANDLES } from "../../../../e2e/data/reports/handles";

type ReportScopeNoticesProps = {
  warnings: string[];
  adaptedConditionCount: number;
};

export function ReportScopeNotices({ warnings, adaptedConditionCount }: ReportScopeNoticesProps) {
  const { t } = useTranslation();
  if (!warnings.length && !adaptedConditionCount) return null;

  return (
    <div className="space-y-2 border-t border-neutral-100 p-4">
      {warnings.map((warning) => (
        <div
          key={warning}
          role="alert"
          data-testid={REPORTS_HANDLES.WARNING}
          className="body-sm flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-warning-900"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {warning}
        </div>
      ))}
      {adaptedConditionCount > 0 && (
        <div className="body-sm flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-primary-900">
          <Info className="mt-0.5 size-4 shrink-0" />
          {t("reports.filters.adaptedNotice", { count: adaptedConditionCount })}
        </div>
      )}
    </div>
  );
}
