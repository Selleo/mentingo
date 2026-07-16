import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

import type { FC } from "react";

const statusConfig = {
  Enabled: { variant: "success" as const, key: "automationView.status.enabled" },
  Disabled: { variant: "notStarted" as const, key: "automationView.status.disabled" },
  Draft: { variant: "draft" as const, key: "automationView.status.draft" },
  Archived: { variant: "blocked" as const, key: "automationView.status.archived" },
};

export const StatusBadge: FC<{ status: "Enabled" | "Disabled" | "Draft" | "Archived" }> = ({
  status,
}) => {
  const { t } = useTranslation();
  const config = statusConfig[status];

  return <Badge variant={config.variant}>{t(config.key)}</Badge>;
};
