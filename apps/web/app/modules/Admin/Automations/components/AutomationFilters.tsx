import { AUTOMATION_STATUSES, type AutomationStatus } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { SearchInput } from "~/components/SearchInput/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type { FC } from "react";

export type StatusFilter = "All" | AutomationStatus;

interface AutomationFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
}

export const AutomationFilters: FC<AutomationFiltersProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  const { t } = useTranslation();

  const statusOptions: { value: StatusFilter; labelKey: string }[] = [
    { value: "All", labelKey: "automationView.filters.all" },
    { value: AUTOMATION_STATUSES.ENABLED, labelKey: "automationView.filters.enabled" },
    { value: AUTOMATION_STATUSES.DISABLED, labelKey: "automationView.filters.disabled" },
    { value: AUTOMATION_STATUSES.DRAFT, labelKey: "automationView.filters.drafts" },
    { value: AUTOMATION_STATUSES.ARCHIVED, labelKey: "automationView.filters.archived" },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <SearchInput
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t("automationView.filters.searchPlaceholder")}
        aria-label={t("automationView.filters.searchPlaceholder")}
        wrapperClassName="w-full sm:max-w-xs"
        data-testid="automation-page-search-input"
      />

      <Select
        value={statusFilter}
        onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}
      >
        <SelectTrigger className="w-full sm:w-[180px]" data-testid="automation-page-status-filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
