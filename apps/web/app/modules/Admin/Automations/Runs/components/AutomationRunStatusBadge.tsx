import { AUTOMATION_RUN_STATUSES, AUTOMATION_EMAIL_DELIVERY_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

import type { AutomationEmailDeliveryStatus, AutomationRunStatus } from "@repo/shared";

const variants = {
  [AUTOMATION_RUN_STATUSES.SUCCEEDED]: "success",
  [AUTOMATION_RUN_STATUSES.FAILED]: "destructive",
  [AUTOMATION_RUN_STATUSES.CANCELLED]: "blocked",
  [AUTOMATION_RUN_STATUSES.PENDING]: "draft",
  [AUTOMATION_RUN_STATUSES.PROCESSING]: "notStarted",
  [AUTOMATION_RUN_STATUSES.WARNINGS]: "inProgress",
  [AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING]: "inProgress",
  [AUTOMATION_EMAIL_DELIVERY_STATUSES.SKIPPED]: "notStarted",
} as const;

export function AutomationRunStatusBadge({
  status,
}: {
  status: AutomationRunStatus | AutomationEmailDeliveryStatus;
}) {
  const { t } = useTranslation();

  return (
    <Badge className="w-fit" variant={variants[status]}>
      {t(`automations.executionStatuses.${status}`)}
    </Badge>
  );
}
