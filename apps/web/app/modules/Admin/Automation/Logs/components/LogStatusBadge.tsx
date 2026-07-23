import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

import type { EmailStatus } from "../automationLogs.types";
import type { FC } from "react";

const statusConfig: Record<EmailStatus, { variant: "success" | "inProgress" | "destructive"; key: string }> = {
  sent: { variant: "success", key: "automationLogs.status.sent" },
  skipped: { variant: "inProgress", key: "automationLogs.status.skipped" },
  failed: { variant: "destructive", key: "automationLogs.status.failed" },
};

export const LogStatusBadge: FC<{ status: EmailStatus }> = ({ status }) => {
  const { t } = useTranslation();
  const config = statusConfig[status];

  return <Badge variant={config.variant}>{t(config.key)}</Badge>;
};
