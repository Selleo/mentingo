import { Search } from "lucide-react";

export type StatusFilter = "All" | "Enabled" | "Disabled" | "Draft" | "Archived";

interface AutomationFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
}

export const AutomationFilters: React.FC<AutomationFiltersProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  const tabs: { value: StatusFilter; label: string }[] = [
    { value: "All", label: "Wszystkie" },
    { value: "Enabled", label: "Włączone" },
    { value: "Disabled", label: "Wyłączone" },
    { value: "Draft", label: "Szkice" },
    { value: "Archived", label: "Zarchiwizowane" },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs mb-6">
      <div className="relative w-full sm:max-w-xs">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4.5 w-4.5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Szukaj po nazwie lub opisie..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onStatusFilterChange(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === tab.value
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};
