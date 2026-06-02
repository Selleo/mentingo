import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { courseLanguages } from "~/modules/Admin/EditCourse/components/CourseLanguageSelector";

import { CalendarFormFieldLabel } from "./CalendarFormFieldLabel";

import type { SupportedLanguages } from "@repo/shared";

type CalendarLanguageSelectProps = {
  value: SupportedLanguages;
  label: string;
  tooltip: string;
  onChange: (language: SupportedLanguages) => void;
};

export function CalendarLanguageSelect({
  value,
  label,
  tooltip,
  onChange,
}: CalendarLanguageSelectProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-2">
      <CalendarFormFieldLabel label={label} tooltip={tooltip} />
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as SupportedLanguages)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {courseLanguages.map((option) => (
            <SelectItem key={option.key} value={option.key}>
              <div className="flex items-center gap-2">
                <Icon name={option.iconName} className="size-4" />
                <span>{t(option.translationKey)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
