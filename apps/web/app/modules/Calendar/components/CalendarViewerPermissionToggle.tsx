import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

import { CalendarFormFieldLabel } from "./CalendarFormFieldLabel";

import type { ReactNode } from "react";

type CalendarViewerPermissionToggleProps = {
  id: string;
  checked: boolean;
  label: string;
  tooltip: string;
  icon: ReactNode;
  onCheckedChange: (checked: boolean) => void;
};

export function CalendarViewerPermissionToggle({
  id,
  checked,
  label,
  tooltip,
  icon,
  onCheckedChange,
}: CalendarViewerPermissionToggleProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "group flex cursor-pointer items-center justify-between gap-3 rounded-md border bg-white px-3 py-2.5 transition-colors",
        {
          "border-primary-300": checked,
          "border-danger-200 bg-danger-50/40 hover:border-danger-300": !checked,
        },
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors",
            {
              "border-primary-200 bg-primary-50 text-primary-700": checked,
              "border-danger-200 bg-danger-50 text-danger-700 group-hover:text-danger-800":
                !checked,
            },
          )}
        >
          {icon}
        </span>
        <CalendarFormFieldLabel label={label} tooltip={tooltip} />
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
    </label>
  );
}
