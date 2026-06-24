import { Clock } from "lucide-react";

import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

import { DEFAULT_TIME_STEP_MINUTES } from "./calendarTimeSelect.utils";

type CalendarTimeInputProps = {
  value: string;
  stepMinutes?: number;
  testId?: string;
  disabled?: boolean;
  onChange: (time: string) => void;
};

const normalizeTimeValue = (value: string) => {
  if (!value) return "";

  const match = /^(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return "";

  return `${match[1]}:${match[2]}`;
};

export function CalendarTimeInput({
  value,
  stepMinutes = DEFAULT_TIME_STEP_MINUTES,
  testId,
  disabled = false,
  onChange,
}: CalendarTimeInputProps) {
  return (
    <div className="relative">
      <Clock
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
        aria-hidden="true"
      />
      <Input
        type="time"
        data-testid={testId}
        value={normalizeTimeValue(value)}
        step={stepMinutes * 60}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "block w-full min-w-[10.5rem] appearance-none pl-9 pr-3 tabular-nums",
          "[&::-webkit-calendar-picker-indicator]:hidden",
          "[&::-webkit-datetime-edit]:m-0 [&::-webkit-datetime-edit]:p-0",
          "[&::-webkit-datetime-edit-fields-wrapper]:p-0",
        )}
      />
    </div>
  );
}
