import { format, isAfter, isBefore, parseISO } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { debounce } from "lodash-es";
import { CalendarDays, Search } from "lucide-react";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import MultipleSelector from "~/components/ui/multiselect";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import type React from "react";
import type { Option } from "~/components/ui/multiselect";

export type FilterType = "text" | "select" | "state" | "status" | "multiselect" | "date";

export type TextFilterValue = string | undefined;
export type SelectFilterValue = string | undefined;
export type StatusFilterValue = boolean | undefined;
export type MultiSelectFilterValue = Option[] | undefined;

export type FilterValue =
  | TextFilterValue
  | SelectFilterValue
  | StatusFilterValue
  | MultiSelectFilterValue;

export type FilterOption = {
  value: string;
  label: string;
};

export type BaseFilterConfig = {
  name: string;
  placeholder?: string;
  default?: FilterValue;
  hideAll?: boolean;
  testId?: string;
  optionTestId?: (option: FilterOption) => string;
  minDate?: Date;
  maxDate?: Date;
};

export type TextFilterConfig = BaseFilterConfig & {
  type: "text";
};

export type SelectFilterConfig = BaseFilterConfig & {
  type: "select" | "state" | "multiselect";
  options: FilterOption[] | undefined;
};

export type DateFilterConfig = BaseFilterConfig & {
  type: "date";
};

export type StatusFilterConfig = BaseFilterConfig & {
  type: "status";
};

export type FilterConfig =
  | TextFilterConfig
  | SelectFilterConfig
  | DateFilterConfig
  | StatusFilterConfig;

export type FilterValues = Partial<{
  [key: string]: FilterValue;
}>;

interface SearchFilterProps {
  id?: string;
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (name: string, value: FilterValue) => void;
  isLoading?: boolean;
  className?: string;
  clearAllTestId?: string;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({
  id,
  filters,
  values,
  onChange,
  isLoading,
  className,
  clearAllTestId,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();
  const calendarLocale = i18n.language.startsWith("pl") ? pl : enUS;

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
    <div id={id} className={cn("flex grow flex-wrap items-center gap-2 py-6", className)}>
      {filters.map((filter) => {
        if (filter?.type === "text") {
          return (
            <div key={filter?.name} className="relative max-w-2xl flex-grow">
              <Search className="absolute left-2 top-1/2 size-5 -translate-y-1/2 transform text-neutral-800" />
              <Input
                ref={inputRef}
                data-testid={filter.testId}
                type="text"
                placeholder={filter?.placeholder || `${t("common.other.search")}...`}
                className="w-full max-w-[320px] border border-neutral-300 py-2 pl-8 pr-4 md:max-w-none"
                onChange={(e) => handleTextChange(filter?.name, e.target.value)}
                defaultValue={values?.[filter?.name] as string}
              />
            </div>
          );
        }

        if (filter?.type === "multiselect" && filter?.name === "groups") {
          return (
            <MultipleSelector
              key={filter?.name}
              testId={filter.testId}
              getOptionTestId={filter.optionTestId}
              value={values?.[filter?.name] as Option[]}
              options={filter?.options}
              onChange={(option) => {
                if (option.length == 0) {
                  return handleChange(filter?.name, undefined);
                }

                handleChange(filter?.name, option);
              }}
              placeholder={filter?.placeholder}
              hidePlaceholderWhenSelected
              hideClearAllButton
              maxSelectedVisible={2}
              className="w-fit h-[42px] bg-background p-1.5 max-w-[320px] rounded-lg"
              badgeClassName="bg-accent text-accent-foreground text-sm hover:bg-accent max-w-[120px]"
              commandProps={{
                label: t("adminGroupsView.groupSelect.label"),
                className: "w-fit",
              }}
              inputProps={{
                className: "flex-1 min-w-0 py-0 body-base",
              }}
              searchFilter
              textInputDisabled
            />
          );
        }

        if (filter?.type === "date") {
          const value = values?.[filter?.name];
          const selectedDate = typeof value === "string" && value ? parseISO(value) : undefined;

          return (
            <Popover key={filter?.name}>
              <PopoverTrigger asChild>
                <Button
                  data-testid={filter.testId}
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full max-w-[320px] flex items-center gap-3 bg-white font-normal border-neutral-300 shadow-sm sm:w-[180px]",
                    selectedDate
                      ? "text-neutral-900 hover:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-500",
                  )}
                >
                  <CalendarDays className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
                  <span className="grow truncate text-left">
                    {selectedDate && !Number.isNaN(selectedDate.getTime())
                      ? format(selectedDate, "PPP", { locale: calendarLocale })
                      : filter?.placeholder ||
                        t("common.other.selectDate", { defaultValue: "Select date" })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-2">
                <Calendar
                  variant="default"
                  mode="single"
                  captionLayout="dropdown-buttons"
                  selected={
                    selectedDate && !Number.isNaN(selectedDate.getTime()) ? selectedDate : undefined
                  }
                  onSelect={(date) => {
                    if (!date) {
                      return onChange(filter.name, undefined);
                    }

                    onChange(filter.name, format(date, "yyyy-MM-dd"));
                  }}
                  disabled={(date) =>
                    Boolean(
                      (filter.minDate && isBefore(date, filter.minDate)) ||
                        (filter.maxDate && isAfter(date, filter.maxDate)),
                    )
                  }
                  fromYear={2000}
                  toYear={new Date().getFullYear() + 1}
                  initialFocus
                  weekStartsOn={1}
                  locale={calendarLocale}
                />
              </PopoverContent>
            </Popover>
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
              <SelectTrigger
                data-testid={filter.testId}
                className="w-full max-w-[320px] border border-neutral-300 sm:w-[180px]"
              >
                <SelectValue placeholder={filter?.placeholder || t("common.other.all")} />
              </SelectTrigger>
              <SelectContent>
                {!filter.hideAll && (
                  <SelectItem
                    data-testid={filter.optionTestId?.({
                      value: "all",
                      label: filter?.placeholder ?? t("common.other.all"),
                    })}
                    value="all"
                  >
                    {filter?.placeholder ?? t("common.other.all")}
                  </SelectItem>
                )}
                {filter?.options?.map(({ value, label }) => (
                  <SelectItem
                    key={value}
                    data-testid={filter.optionTestId?.({ value, label })}
                    value={value}
                  >
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
              <SelectTrigger
                data-testid={filter.testId}
                className="w-full max-w-[320px] border border-neutral-300 sm:w-[180px]"
              >
                <SelectValue placeholder={t("common.other.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                {!filter.hideAll && (
                  <SelectItem
                    data-testid={filter.optionTestId?.({
                      value: "all",
                      label: t("common.other.allStatuses"),
                    })}
                    value="all"
                  >
                    {t("common.other.allStatuses")}
                  </SelectItem>
                )}
                <SelectItem
                  data-testid={filter.optionTestId?.({
                    value: "active",
                    label: t("common.other.active"),
                  })}
                  value="active"
                >
                  {t("common.other.active")}
                </SelectItem>
                <SelectItem
                  data-testid={filter.optionTestId?.({
                    value: "archived",
                    label: t("common.other.archived"),
                  })}
                  value="archived"
                >
                  {t("common.other.archived")}
                </SelectItem>
              </SelectContent>
            </Select>
          );
        }
      })}

      {isAnyFilterApplied && (
        <Button
          data-testid={clearAllTestId}
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
