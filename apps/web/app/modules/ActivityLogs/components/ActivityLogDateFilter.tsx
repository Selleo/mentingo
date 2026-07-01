import { format, isAfter, isBefore, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { getDateLabel } from "~/modules/ActivityLogs/activityLogs.filters";

import type { Locale } from "date-fns";

type ActivityLogDateFilterProps = {
  value?: string;
  placeholder: string;
  calendarLocale: Locale;
  minDate?: Date;
  maxDate?: Date;
  onChange: (value: string | undefined) => void;
};

export function ActivityLogDateFilter({
  value,
  placeholder,
  calendarLocale,
  minDate,
  maxDate,
  onChange,
}: ActivityLogDateFilterProps) {
  const selectedDate = value ? parseISO(value) : undefined;
  const hasValidDate = Boolean(selectedDate && !Number.isNaN(selectedDate.getTime()));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full max-w-[320px] flex items-center gap-3 bg-white font-normal border-neutral-300 shadow-sm sm:w-[180px]",
            hasValidDate ? "text-neutral-900 hover:text-neutral-900" : "text-neutral-500",
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
          <span className="grow truncate text-left">
            {getDateLabel(value, placeholder, calendarLocale)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          variant="default"
          mode="single"
          captionLayout="dropdown-buttons"
          selected={hasValidDate ? selectedDate : undefined}
          onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : undefined)}
          disabled={(date) =>
            Boolean((minDate && isBefore(date, minDate)) || (maxDate && isAfter(date, maxDate)))
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
