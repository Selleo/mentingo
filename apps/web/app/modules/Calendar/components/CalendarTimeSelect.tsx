import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { DEFAULT_TIME_STEP_MINUTES, buildTimeOptions } from "./calendarTimeSelect.utils";

type CalendarTimeSelectProps = {
  value: string;
  stepMinutes?: number;
  testId?: string;
  onChange: (time: string) => void;
};

export function CalendarTimeSelect({
  value,
  stepMinutes = DEFAULT_TIME_STEP_MINUTES,
  testId,
  onChange,
}: CalendarTimeSelectProps) {
  const options = useMemo(() => buildTimeOptions(stepMinutes), [stepMinutes]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        className="max-h-72"
        showScrollButtons={false}
        viewportClassName="h-auto max-h-72 overflow-y-auto"
      >
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
