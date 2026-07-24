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

import type { LogStatusFilter } from "../automationLogs.types";
import type { FC } from "react";

interface LogsFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: LogStatusFilter;
  onStatusFilterChange: (filter: LogStatusFilter) => void;
}

export const LogsFilters: FC<LogsFiltersProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  const { t } = useTranslation();

  const statusOptions: { value: LogStatusFilter; labelKey: string }[] = [
    { value: "All", labelKey: "automationLogs.filters.all" },
    { value: "success", labelKey: "automationLogs.filters.success" },
    { value: "skipped", labelKey: "automationLogs.filters.skipped" },
    { value: "failed", labelKey: "automationLogs.filters.failed" },
  ];

  return (
    <div className="mb-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("automationLogs.filters.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <Select
        value={statusFilter}
        onValueChange={(value) => onStatusFilterChange(value as LogStatusFilter)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
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
