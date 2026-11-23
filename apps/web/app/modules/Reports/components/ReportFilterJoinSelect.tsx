import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { REPORTS_HANDLES } from "../../../../e2e/data/reports/handles";

import type { FilterJoin } from "../types/reports.types";

export function ReportFilterJoinSelect({
  value,
  onChange,
}: {
  value: FilterJoin;
  onChange: (join: FilterJoin) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="body-sm flex items-center gap-1.5 text-neutral-700">
      <span>{t("reports.filters.matchPrefix")}</span>
      <Select value={value} onValueChange={(join) => onChange(join as FilterJoin)}>
        <SelectTrigger
          aria-label={t("reports.filters.matching")}
          data-testid={REPORTS_HANDLES.MATCHING}
          className="h-8 w-auto gap-1.5 px-2.5 font-medium text-primary-800"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(["and", "or"] as const).map((join) => (
            <SelectItem key={join} value={join} data-testid={REPORTS_HANDLES.matchingOption(join)}>
              {t(`reports.filters.join.${join}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>{t("reports.filters.matchSuffix")}</span>
    </div>
  );
}
