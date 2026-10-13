import { AUTOMATION_EMAIL_DELIVERY_STATUSES, AUTOMATION_RUN_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import type { AutomationEmailDeliveryStatus, AutomationRunStatus } from "@repo/shared";

const statusColors = {
  [AUTOMATION_RUN_STATUSES.SUCCEEDED]: "text-success-700",
  [AUTOMATION_RUN_STATUSES.FAILED]: "text-error-700",
  [AUTOMATION_RUN_STATUSES.CANCELLED]: "text-neutral-500",
  [AUTOMATION_RUN_STATUSES.PENDING]: "text-neutral-500",
  [AUTOMATION_RUN_STATUSES.PROCESSING]: "text-blue-600",
  [AUTOMATION_RUN_STATUSES.WARNINGS]: "text-amber-700",
  [AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING]: "text-amber-700",
  [AUTOMATION_EMAIL_DELIVERY_STATUSES.SKIPPED]: "text-neutral-500",
} as const;

export function AutomationRunStatusText({
  status,
  label,
}: {
  status: AutomationRunStatus | AutomationEmailDeliveryStatus;
  label?: string;
}) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs leading-none",
        statusColors[status],
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {label ?? t(`automations.executionStatuses.${status}`)}
    </span>
  );
}
