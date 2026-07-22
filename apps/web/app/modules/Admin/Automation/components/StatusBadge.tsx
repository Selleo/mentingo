import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

import type { FC } from "react";

const statusConfig = {
  enabled: { variant: "success" as const, key: "automationView.status.enabled" },
  disabled: { variant: "notStarted" as const, key: "automationView.status.disabled" },
  draft: { variant: "draft" as const, key: "automationView.status.draft" },
  archived: { variant: "blocked" as const, key: "automationView.status.archived" },
};

export const StatusBadge: FC<{ status: "enabled" | "disabled" | "draft" | "archived" }> = ({
  status,
}) => {
  const { t } = useTranslation();
  const config = statusConfig[status];

  return <Badge variant={config.variant}>{t(config.key)}</Badge>;
};
