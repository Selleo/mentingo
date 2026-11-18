import { format, parse, startOfToday } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { ACCESS_END_DATE_FORMAT } from "~/modules/SuperAdmin/utils/accessEnd.utils";
import { getDateLocale } from "~/utils/getDateLocale";

import { TENANT_FORM_HANDLES } from "../../../../e2e/data/tenants/handles";

const SELECTABLE_YEARS_AHEAD = 10;

type AccessEndDatePickerProps = {
  id: string;
  /** The last day of access as `yyyy-MM-dd`, or empty for unlimited access. */
  value: string;
  onChange: (value: string) => void;
};

export function AccessEndDatePicker({ id, value, onChange }: AccessEndDatePickerProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const locale = getDateLocale(language);
  const selectedDate = value ? parse(value, ACCESS_END_DATE_FORMAT, new Date()) : undefined;
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            data-testid={TENANT_FORM_HANDLES.ACCESS_ENDS_AT_INPUT}
            className={cn(
              "h-10 w-full justify-start gap-2 rounded-lg border-neutral-300 bg-white font-normal shadow-none",
              { "text-neutral-950": selectedDate, "text-neutral-500": !selectedDate },
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-neutral-500" aria-hidden />
            <span className="truncate">
              {selectedDate
                ? format(selectedDate, "PPP", { locale })
                : t("superAdminTenantsView.form.accessEndsAtPlaceholder")}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Calendar
            variant="default"
            mode="single"
            captionLayout="dropdown-buttons"
            selected={selectedDate}
            onSelect={(date) => date && onChange(format(date, ACCESS_END_DATE_FORMAT))}
            disabled={{ before: startOfToday() }}
            fromYear={currentYear}
            toYear={currentYear + SELECTABLE_YEARS_AHEAD}
            initialFocus
            weekStartsOn={1}
            locale={locale}
          />
        </PopoverContent>
      </Popover>
      {selectedDate && (
        <Button
          type="button"
          variant="ghost"
          className="h-10 shrink-0 px-3"
          aria-label={t("superAdminTenantsView.form.accessEndsAtClear")}
          data-testid={TENANT_FORM_HANDLES.ACCESS_ENDS_AT_CLEAR}
          onClick={() => onChange("")}
        >
          <X className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
