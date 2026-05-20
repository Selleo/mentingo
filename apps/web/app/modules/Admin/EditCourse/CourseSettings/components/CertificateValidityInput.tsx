import {
  CERTIFICATE_VALIDITY_TYPES,
  CERTIFICATE_VALIDITY_UNITS,
  type CertificateValidityType,
  type CertificateValidityUnit,
} from "@repo/shared";
import { format, isValid, parseISO } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

type CertificateValidityInputProps = {
  disabled: boolean;
  validityType: CertificateValidityType;
  validityValue: number;
  validityUnit: CertificateValidityUnit;
  validityDate: string;
  validityDateError: string | null;
  onValidityTypeChange: (value: CertificateValidityType) => void;
  onValidityValueChange: (value: number) => void;
  onValidityUnitChange: (value: CertificateValidityUnit) => void;
  onValidityDateChange: (value: string) => void;
};

export function CertificateValidityInput({
  disabled,
  validityType,
  validityValue,
  validityUnit,
  validityDate,
  validityDateError,
  onValidityTypeChange,
  onValidityValueChange,
  onValidityUnitChange,
  onValidityDateChange,
}: CertificateValidityInputProps) {
  const { t, i18n } = useTranslation();
  const selectedValidityDate = validityDate ? parseISO(validityDate) : undefined;
  const isSelectedValidityDateValid = selectedValidityDate && isValid(selectedValidityDate);
  const currentYear = new Date().getFullYear();
  const calendarLocale = i18n.language.startsWith("pl") ? pl : enUS;

  return (
    <div className="grid gap-3 md:grid-cols-[180px_1fr_160px]">
      <div className="space-y-2">
        <Label>{t("adminCourseView.settings.field.validityType")}</Label>
        <Select value={validityType} onValueChange={onValidityTypeChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CERTIFICATE_VALIDITY_TYPES.PERIOD}>
              {t("adminCourseView.settings.other.validityPeriod")}
            </SelectItem>
            <SelectItem value={CERTIFICATE_VALIDITY_TYPES.FIXED_DATE}>
              {t("adminCourseView.settings.other.validityFixedDate")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {validityType === CERTIFICATE_VALIDITY_TYPES.PERIOD ? (
        <>
          <div className="space-y-2">
            <Label className="block mb-2">
              {t("adminCourseView.settings.field.validityValue")}
            </Label>
            <Input
              min={1}
              type="number"
              value={validityValue}
              disabled={disabled}
              onChange={(event) => onValidityValueChange(Number(event.target.value) || 1)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("adminCourseView.settings.field.validityUnit")}</Label>
            <Select value={validityUnit} onValueChange={onValidityUnitChange} disabled={disabled}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CERTIFICATE_VALIDITY_UNITS.DAYS}>
                  {t("adminCourseView.settings.other.days")}
                </SelectItem>
                <SelectItem value={CERTIFICATE_VALIDITY_UNITS.MONTHS}>
                  {t("adminCourseView.settings.other.months")}
                </SelectItem>
                <SelectItem value={CERTIFICATE_VALIDITY_UNITS.YEARS}>
                  {t("adminCourseView.settings.other.years")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <div className="space-y-2 md:col-span-2">
          <Label>{t("adminCourseView.settings.field.validUntil")}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                className={cn(
                  "h-[42px] w-full justify-start gap-3 rounded-lg border-neutral-300 bg-white px-3 py-2 font-normal shadow-none hover:border-neutral-300",
                  isSelectedValidityDateValid
                    ? "text-neutral-900 hover:text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-500",
                )}
              >
                <Icon name="Calendar" className="size-4 text-neutral-500" />
                <span className="grow text-left">
                  {isSelectedValidityDateValid
                    ? format(selectedValidityDate, "PPP", { locale: calendarLocale })
                    : t("adminCourseView.selectDate")}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <Calendar
                variant="default"
                captionLayout="dropdown-buttons"
                mode="single"
                selected={isSelectedValidityDateValid ? selectedValidityDate : undefined}
                onSelect={(date) => {
                  if (!date) return onValidityDateChange("");

                  return onValidityDateChange(format(date, "yyyy-MM-dd"));
                }}
                fromYear={currentYear - 10}
                toYear={currentYear + 30}
                initialFocus
                weekStartsOn={1}
                locale={calendarLocale}
              />
            </PopoverContent>
          </Popover>
          {validityDateError && <p className="text-sm text-destructive">{validityDateError}</p>}
        </div>
      )}
    </div>
  );
}
