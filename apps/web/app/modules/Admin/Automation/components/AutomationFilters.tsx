import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

import type { FC } from "react";

export type StatusFilter = "All" | "Enabled" | "Disabled" | "Draft" | "Archived";

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

  const tabs: { value: StatusFilter; labelKey: string }[] = [
    { value: "All", labelKey: "automationView.filters.all" },
    { value: "Enabled", labelKey: "automationView.filters.enabled" },
    { value: "Disabled", labelKey: "automationView.filters.disabled" },
    { value: "Draft", labelKey: "automationView.filters.drafts" },
    { value: "Archived", labelKey: "automationView.filters.archived" },
  ];

  return (
    <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-lg border bg-background p-4 shadow-sm sm:flex-row">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("automationView.filters.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <Tabs
        value={statusFilter}
        onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}
      >
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};
