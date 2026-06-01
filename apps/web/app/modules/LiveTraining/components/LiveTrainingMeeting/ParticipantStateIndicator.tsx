import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

type ParticipantStateIndicatorProps = {
  enabled: boolean;
  enabledIcon: ReactNode;
  disabledIcon: ReactNode;
  label: string;
};

export function ParticipantStateIndicator({
  enabled,
  enabledIcon,
  disabledIcon,
  label,
}: ParticipantStateIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-white shadow-sm",
        {
          "bg-primary-500/90": enabled,
          "bg-danger-500/90": !enabled,
        },
      )}
      aria-label={label}
      title={label}
    >
      {enabled && enabledIcon}
      {!enabled && disabledIcon}
    </span>
  );
}
