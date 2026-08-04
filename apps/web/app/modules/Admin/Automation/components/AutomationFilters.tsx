import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type { FC } from "react";

export type StatusFilter = "All" | "enabled" | "disabled" | "draft" | "archived";

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
    { value: "enabled", labelKey: "automationView.filters.enabled" },
    { value: "disabled", labelKey: "automationView.filters.disabled" },
    { value: "draft", labelKey: "automationView.filters.drafts" },
    { value: "archived", labelKey: "automationView.filters.archived" },
  ];

  return (
    <div className="mb-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("automationView.filters.searchPlaceholder")}
          className="pl-9"
          data-testid="automation-page-search-input"
        />
      </div>

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
