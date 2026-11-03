import { Check, CircleAlert, CircleCheck, Clock3, RotateCw } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

export function CompetencyStatus({
  confirmed,
  expiring,
  children,
  label,
  compact = false,
}: {
  confirmed: boolean;
  expiring?: boolean;
  children: ReactNode;
  label?: string;
  compact?: boolean;
}) {
  let StatusIcon = CircleAlert;
  if (confirmed) StatusIcon = CircleCheck;
  if (expiring) StatusIcon = Clock3;
  let marker: ReactNode = "!";
  if (confirmed) marker = <Check className="size-3" />;
  if (expiring) marker = <RotateCw className="size-3" />;
  return (
    <Badge
      variant="outline"
      aria-label={label}
      role={label ? "img" : undefined}
      title={compact ? undefined : label}
      className={cn(
        "relative inline-flex w-fit gap-1.5 rounded-full px-2.5 py-1 text-xs",
        compact &&
          "min-h-10 min-w-16 justify-center rounded-md border-0 px-3 py-2 text-sm font-semibold",
        confirmed && !expiring && "bg-success-50 text-success-800",
        !confirmed && !expiring && "bg-error-50 text-error-800",
        expiring && "bg-warning-50 text-warning-800",
      )}
    >
      {compact ? (
        <span
          className={cn(
            "absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white",
            confirmed && !expiring && "bg-success-600",
            !confirmed && !expiring && "bg-error-600",
            expiring && "bg-warning-600",
          )}
          aria-hidden="true"
        >
          {marker}
        </span>
      ) : (
        <StatusIcon className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      {children}
    </Badge>
  );
}
