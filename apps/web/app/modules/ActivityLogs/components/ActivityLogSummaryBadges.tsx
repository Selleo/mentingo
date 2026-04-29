import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

import { getActivityLogActionLabel, getActivityLogEntityLabel } from "../activityLogs.utils";

import type { ActivityLogItem } from "../activityLogs.utils";

type ActivityLogSummaryBadgesProps = {
  item: ActivityLogItem;
};

export const ActivityLogSummaryBadges = ({ item }: ActivityLogSummaryBadgesProps) => {
  const { t } = useTranslation();

  const actionLabel = getActivityLogActionLabel(t, item.actionType);
  const entityLabel = getActivityLogEntityLabel(t, item.resourceType);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] leading-none">
      <Badge
        variant="default"
        fontWeight="medium"
        className="rounded-full border-primary-200 bg-primary-50 px-3 py-1.5 text-primary-700"
      >
        <span className="font-medium">{t("activityLogsView.labels.action")}</span>
        <span className="ml-1 font-semibold text-primary-900">{actionLabel}</span>
      </Badge>
      <Badge
        variant="default"
        fontWeight="medium"
        className="rounded-full border-neutral-200 bg-neutral-50 px-3 py-1.5 text-neutral-700"
      >
        <span className="font-medium">{t("activityLogsView.labels.entity")}</span>
        <span className="ml-1 font-semibold text-neutral-900">{entityLabel}</span>
      </Badge>
    </div>
  );
};
