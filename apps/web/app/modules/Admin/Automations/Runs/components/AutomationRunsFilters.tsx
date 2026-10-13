import { AUTOMATION_RUN_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { SearchInput } from "~/components/SearchInput/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type { AutomationRunStatus } from "@repo/shared";

interface AutomationRunsFiltersProps {
  search: string;
  onSearch: (value: string) => void;
  status?: AutomationRunStatus;
  onStatus: (value?: AutomationRunStatus) => void;
}

export function AutomationRunsFilters(props: AutomationRunsFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <SearchInput
        value={props.search}
        onChange={(event) => props.onSearch(event.target.value)}
        placeholder={t("automationLogs.filters.searchPlaceholder")}
        aria-label={t("automationLogs.filters.searchPlaceholder")}
        wrapperClassName="w-full sm:max-w-xs"
      />
      <Select
        value={props.status ?? "All"}
        onValueChange={(value) =>
          props.onStatus(value === "All" ? undefined : (value as AutomationRunStatus))
        }
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All">{t("automations.allStatuses")}</SelectItem>
          {Object.values(AUTOMATION_RUN_STATUSES).map((status) => (
            <SelectItem key={status} value={status}>
              {t(`automations.executionStatuses.${status}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
