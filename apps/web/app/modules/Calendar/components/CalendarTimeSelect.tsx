import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type CalendarTimeSelectProps = {
  value: string;
  stepMinutes?: number;
  onChange: (time: string) => void;
};

const DEFAULT_TIME_STEP_MINUTES = 15;

const padTimePart = (value: number) => String(value).padStart(2, "0");

const buildTimeOptions = (stepMinutes: number) => {
  const options: string[] = [];

  for (
    let minutesFromMidnight = 0;
    minutesFromMidnight < 24 * 60;
    minutesFromMidnight += stepMinutes
  ) {
    const hours = Math.floor(minutesFromMidnight / 60);
    const minutes = minutesFromMidnight % 60;
    options.push(`${padTimePart(hours)}:${padTimePart(minutes)}`);
  }

  return options;
};

export function CalendarTimeSelect({
  value,
  stepMinutes = DEFAULT_TIME_STEP_MINUTES,
  onChange,
}: CalendarTimeSelectProps) {
  const options = useMemo(() => buildTimeOptions(stepMinutes), [stepMinutes]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
