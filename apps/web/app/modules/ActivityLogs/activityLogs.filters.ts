import { format, parseISO } from "date-fns";

import type { ActivityLogActionType } from "@repo/shared";
import type { Locale } from "date-fns";

export type ActivityLogFilterOption<TValue extends string> = {
  value: TValue;
  label: string;
};

export type ActivityLogActionOption = ActivityLogFilterOption<ActivityLogActionType>;

export const getSelectedOptionLabel = <TValue extends string>(
  options: ActivityLogFilterOption<TValue>[],
  value: TValue | undefined,
) => options.find((option) => option.value === value)?.label;

export const getSelectedActionLabel = (
  options: ActivityLogActionOption[],
  values: ActivityLogActionType[],
  placeholder: string,
  selectedCountLabel: string,
) => {
  if (values.length === 0) return placeholder;

  if (values.length === 1) {
    return getSelectedOptionLabel(options, values[0]) ?? placeholder;
  }

  return selectedCountLabel;
};

export const getDateLabel = (value: string | undefined, placeholder: string, locale: Locale) => {
  if (!value) return placeholder;

  const selectedDate = parseISO(value);

  if (Number.isNaN(selectedDate.getTime())) return placeholder;

  return format(selectedDate, "PPP", { locale });
};
