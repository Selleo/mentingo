import { AUTOMATION_STATUSES, type AutomationStatus } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

import type { FC } from "react";

const statusConfig = {
  [AUTOMATION_STATUSES.ENABLED]: {
    variant: "success" as const,
    key: "automationView.status.enabled",
  },
  [AUTOMATION_STATUSES.DISABLED]: {
    variant: "notStarted" as const,
    key: "automationView.status.disabled",
  },
  [AUTOMATION_STATUSES.DRAFT]: { variant: "draft" as const, key: "automationView.status.draft" },
  [AUTOMATION_STATUSES.ARCHIVED]: {
    variant: "blocked" as const,
    key: "automationView.status.archived",
  },
};

export const StatusBadge: FC<{ status: AutomationStatus }> = ({ status }) => {
  const { t } = useTranslation();
  const config = statusConfig[status];

  return (
    <Badge className="w-fit" variant={config.variant}>
      {t(config.key)}
    </Badge>
  );
};
