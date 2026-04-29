import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useMemo } from "react";

import { AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { cn } from "~/lib/utils";

import { getActivityLogActionConfig } from "../activityLogs.utils";

import { ActivityLogMetadata } from "./ActivityLogMetadata";
import { ActivityLogSummaryBadges } from "./ActivityLogSummaryBadges";

import type { ActivityLogItem } from "../activityLogs.utils";

type ActivityLogTimelineItemProps = {
  item: ActivityLogItem;
};

export const ActivityLogTimelineItem = ({ item }: ActivityLogTimelineItemProps) => {
  const createdAt = useMemo(() => new Date(item.createdAt), [item.createdAt]);
  const actionConfig = getActivityLogActionConfig(item.actionType);
  const ActionIcon = actionConfig.icon;

  const time = format(createdAt, "HH:mm:ss");
  const date = format(createdAt, "dd.MM.yyyy");

  return (
    <AccordionItem value={item.id} className="group border-0">
      <div className="flex gap-4">
        <div className="w-24 shrink-0 pt-5 text-center lg:w-28">
          <div className="text-xl font-semibold tracking-tight text-neutral-950">{time}</div>
          <div className="mt-2 inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
            {date}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <AccordionTrigger
            className={cn(
              "relative flex w-full items-center justify-between gap-4 rounded-t-[1.75rem] border border-neutral-200 bg-white px-5 py-5 text-left transition-colors hover:no-underline hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-0 data-[state=open]:rounded-b-none",
            )}
          >
            <div className="flex min-w-0 items-center gap-4">
              <div
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-2xl border-2 bg-white",
                  actionConfig.ringClassName,
                )}
              >
                <ActionIcon className={cn("size-5", actionConfig.iconClassName)} />
              </div>
              <p className="truncate text-base font-semibold text-neutral-900">{item.actorEmail}</p>
              <ActivityLogSummaryBadges item={item} />
            </div>

            <div className="mt-0.5 rounded-full border border-neutral-200 bg-neutral-50 p-2 text-neutral-500 transition-colors group-data-[state=open]:bg-white">
              <ChevronDown className="size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </AccordionTrigger>
          <AccordionContent className="-mt-px px-0 pb-0 pt-0">
            <div className="rounded-b-[1.75rem] border border-t-0 border-neutral-200 bg-neutral-50 px-5 py-5">
              <div className="mb-4 text-sm text-neutral-500">
                <span className="font-medium text-neutral-700">ID:</span>{" "}
                <span className="text-neutral-900">{item.resourceId ?? "n/a"}</span>
              </div>

              <ActivityLogMetadata metadata={item.metadata} />
            </div>
          </AccordionContent>
        </div>
      </div>
    </AccordionItem>
  );
};
