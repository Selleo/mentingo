import { cn } from "~/lib/utils";

import { getActivityLogActionConfig } from "../activityLogs.utils";

import type { ActivityLogItem } from "../activityLogs.utils";

type ActivityLogTimelineRailProps = {
  item: ActivityLogItem;
};

export const ActivityLogTimelineRail = ({ item }: ActivityLogTimelineRailProps) => {
  const actionConfig = getActivityLogActionConfig(item.actionType);
  const Icon = actionConfig.icon;

  return (
    <div className="relative flex w-14 shrink-0 justify-center pt-7">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-neutral-300 to-transparent" />
      <div
        className={cn(
          "relative z-10 grid size-12 place-items-center rounded-full border-2 bg-white",
          actionConfig.ringClassName,
        )}
      >
        <Icon className={cn("size-5", actionConfig.iconClassName)} />
      </div>
    </div>
  );
};
