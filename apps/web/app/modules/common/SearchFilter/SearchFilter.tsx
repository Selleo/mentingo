import { debounce } from "lodash-es";
import { Search } from "lucide-react";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type React from "react";

export type FilterType = "text" | "select" | "state" | "status";

export type TextFilterValue = string | undefined;
export type SelectFilterValue = string | undefined;
export type StatusFilterValue = boolean | undefined;

export type FilterValue = TextFilterValue | SelectFilterValue | StatusFilterValue;

export type FilterOption = {
  value: string;
  label: string;
};

export type BaseFilterConfig = {
  name: string;
  placeholder?: string;
  default?: FilterValue;
  hideAll?: boolean;
};

export type TextFilterConfig = BaseFilterConfig & {
  type: "text";
};

export type SelectFilterConfig = BaseFilterConfig & {
  type: "select" | "state";
  options: FilterOption[] | undefined;
};

export type StatusFilterConfig = BaseFilterConfig & {
  type: "status";
};

export type FilterConfig = TextFilterConfig | SelectFilterConfig | StatusFilterConfig;

export type FilterValues = Partial<{
  [key: string]: FilterValue;
}>;

interface SearchFilterProps {
  id?: string;
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (name: string, value: FilterValue) => void;
  isLoading?: boolean;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({
  id,
  filters,
  values,
  onChange,
  isLoading,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const debouncedSearchTitle = debounce(onChange, 300);

  const handleChange = (name: string, value: FilterValue) => {
    if (filters.find((filter) => filter?.type === "status")?.name === name) {
      onChange(name, value === "all" ? undefined : value === "archived");
    } else {
      onChange(name, value === "all" ? undefined : (value as string));
    }
  };

  const handleTextChange = (name: string, value: string) => {
    debouncedSearchTitle(name, value || undefined);
  };

  const handleClearAll = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    filters.forEach((filter) => {
      onChange(filter.name, filter.default);
    });
  };

  const isAnyFilterApplied = useMemo(() => {
    for (const filter of filters) {
      if (values[filter.name] !== filter.default) {
        return true;
      }
    }

    return false;
  }, [filters, values]);

  return (
    <div id={id} className="flex grow flex-wrap items-center gap-2 py-6">
      {filters.map((filter) => {
        if (filter?.type === "text") {
          return (
            <div key={filter?.name} className="relative max-w-2xl flex-grow">
              <Search className="absolute left-2 top-1/2 size-5 -translate-y-1/2 transform text-neutral-800" />
              <Input
                ref={inputRef}
                type="text"
                placeholder={filter?.placeholder || `${t("common.other.search")}...`}
                className="w-full max-w-[320px] border border-neutral-300 py-2 pl-8 pr-4 md:max-w-none"
                onChange={(e) => handleTextChange(filter?.name, e.target.value)}
                defaultValue={values?.[filter?.name] as string}
              />
            </div>
          );
        }

        if (filter?.type === "select" || filter?.type === "state") {
          const value = values?.[filter?.name];

          return (
            <Select
              key={filter?.name}
              value={(value as string) ?? "all"}
              onValueChange={(value) => handleChange(filter?.name, value)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full max-w-[320px] border border-neutral-300 sm:w-[180px]">
                <SelectValue placeholder={filter?.placeholder || t("common.other.all")} />
              </SelectTrigger>
              <SelectContent>
                {!filter.hideAll && (
                  <SelectItem value="all">
                    {t("common.other.all")} {filter?.placeholder}
                  </SelectItem>
                )}
                {filter?.options?.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        if (filter?.type === "status") {
          return (
            <Select
              key={filter?.name}
              value={
                values?.[filter?.name] === undefined
                  ? "all"
                  : values?.[filter?.name] === true
                    ? "archived"
                    : "active"
              }
              onValueChange={(value) => handleChange(filter?.name, value)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full max-w-[320px] border border-neutral-300 sm:w-[180px]">
                <SelectValue placeholder={t("common.other.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                {!filter.hideAll && (
                  <SelectItem value="all">{t("common.other.allStatuses")}</SelectItem>
                )}
                <SelectItem value="active">{t("common.other.active")}</SelectItem>
                <SelectItem value="archived">{t("common.other.archived")}</SelectItem>
              </SelectContent>
            </Select>
          );
        }
      })}

      {isAnyFilterApplied && (
        <Button
          className="border border-primary-500 bg-transparent text-accent-foreground"
          onClick={handleClearAll}
          disabled={isLoading}
        >
          {t("common.button.clearAll")}
        </Button>
      )}
    </div>
  );
};
