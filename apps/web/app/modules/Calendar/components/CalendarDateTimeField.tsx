import { format, parseISO } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { CalendarFormFieldLabel } from "./CalendarFormFieldLabel";
import { CalendarTimeInput } from "./CalendarTimeInput";
import { CalendarTimeSelect } from "./CalendarTimeSelect";

type CalendarDateTimeFieldTimeInputVariant = "select" | "native";

type CalendarDateTimeFieldProps = {
  label: string;
  tooltip: string;
  date: string;
  time: string;
  portalledDatePicker?: boolean;
  hideTime?: boolean;
  timeStepMinutes?: number;
  timeInputVariant?: CalendarDateTimeFieldTimeInputVariant;
  dateButtonTestId?: string;
  timeSelectTestId?: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
};

const parseDateInputValue = (date: string) => {
  if (!date) return undefined;

  const parsedDate = parseISO(date);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

export function CalendarDateTimeField({
  label,
  tooltip,
  date,
  time,
  portalledDatePicker = true,
  hideTime = false,
  timeStepMinutes,
  timeInputVariant = "select",
  dateButtonTestId,
  timeSelectTestId,
  onDateChange,
  onTimeChange,
}: CalendarDateTimeFieldProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const calendarLocale = language === "pl" ? pl : enUS;
  const selectedDate = parseDateInputValue(date);

  return (
    <div className="grid gap-2">
      <CalendarFormFieldLabel label={label} tooltip={tooltip} />
      <div
        className={cn("grid gap-2", {
          "grid-cols-[1fr_8.5rem]": !hideTime && timeInputVariant === "select",
          "grid-cols-[1fr_12rem]": !hideTime && timeInputVariant === "native",
        })}
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              data-testid={dateButtonTestId}
              className={cn(
                "w-full justify-start gap-2 border-neutral-300 bg-white font-normal shadow-none",
                {
                  "text-neutral-950": selectedDate,
                  "text-neutral-500": !selectedDate,
                },
              )}
            >
              <CalendarDays className="size-4 shrink-0 text-neutral-500" />
              <span className="truncate text-left">
                {selectedDate
                  ? format(selectedDate, "PPP", { locale: calendarLocale })
                  : t("common.other.selectDate", { defaultValue: "Select date" })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2" portalled={portalledDatePicker}>
            <Calendar
              variant="default"
              mode="single"
              captionLayout="dropdown-buttons"
              selected={selectedDate}
              onSelect={(nextDate) => {
                if (!nextDate) return;
                onDateChange(format(nextDate, "yyyy-MM-dd"));
              }}
              fromYear={new Date().getFullYear() - 1}
              toYear={new Date().getFullYear() + 3}
              initialFocus
              weekStartsOn={1}
              locale={calendarLocale}
            />
          </PopoverContent>
        </Popover>
        {!hideTime &&
          (timeInputVariant === "native" ? (
            <CalendarTimeInput
              value={time}
              stepMinutes={timeStepMinutes}
              testId={timeSelectTestId}
              onChange={onTimeChange}
              disabled={!selectedDate}
            />
          ) : (
            <CalendarTimeSelect
              value={time}
              stepMinutes={timeStepMinutes}
              testId={timeSelectTestId}
              onChange={onTimeChange}
            />
          ))}
      </div>
    </div>
  );
}
