import { format, isValid, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { getDateLocale } from "~/utils/getDateLocale";

type ReportDatePickerProps = {
  label: string;
  placeholder: string;
  value: string | undefined;
  className?: string;
  onChange: (value: string | undefined) => void;
};

export function ReportDatePicker({
  label,
  placeholder,
  value,
  className,
  onChange,
}: ReportDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const language = useLanguageStore((state) => state.language);
  const calendarLocale = getDateLocale(language);
  const parsedDate = value ? parseISO(value) : undefined;
  const selectedDate = parsedDate && isValid(parsedDate) ? parsedDate : undefined;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={label}
          className={cn(
            "h-10 min-w-0 justify-start gap-2 bg-background font-normal",
            selectedDate
              ? "text-neutral-900 hover:text-neutral-900"
              : "text-muted-foreground hover:text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
          <span className="truncate">
            {selectedDate ? format(selectedDate, "PPP", { locale: calendarLocale }) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          variant="default"
          mode="single"
          captionLayout="dropdown-buttons"
          selected={selectedDate}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : undefined);
            setIsOpen(false);
          }}
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
