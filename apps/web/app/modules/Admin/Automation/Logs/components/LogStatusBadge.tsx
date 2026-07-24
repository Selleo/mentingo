import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

import type { AutomationLogStatus } from "../automationLogs.types";
import type { FC } from "react";

const statusConfig: Record<
  AutomationLogStatus,
  { variant: "success" | "inProgress" | "destructive"; key: string }
> = {
  success: { variant: "success", key: "automationLogs.status.success" },
  skipped: { variant: "inProgress", key: "automationLogs.status.skipped" },
  failed: { variant: "destructive", key: "automationLogs.status.failed" },
};

export const LogStatusBadge: FC<{ status: AutomationLogStatus }> = ({ status }) => {
  const { t } = useTranslation();
  const config = statusConfig[status];

  return <Badge variant={config.variant}>{t(config.key)}</Badge>;
};
