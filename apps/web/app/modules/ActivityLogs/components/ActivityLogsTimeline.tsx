import { useTranslation } from "react-i18next";

import { Accordion } from "~/components/ui/accordion";

import { ActivityLogTimelineItem } from "./ActivityLogTimelineItem";
import { ActivityLogTimelineSkeleton } from "./ActivityLogTimelineSkeleton";

import type { ActivityLogItem } from "../activityLogs.utils";

type ActivityLogsTimelineProps = {
  items?: ActivityLogItem[];
  isLoading?: boolean;
};

export const ActivityLogsTimeline = ({
  items = [],
  isLoading = false,
}: ActivityLogsTimelineProps) => {
  const { t } = useTranslation();

  if (isLoading) return <ActivityLogTimelineSkeleton />;

  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-lg font-medium text-neutral-900">
          {t("activityLogsView.emptyState.title")}
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          {t("activityLogsView.emptyState.description")}
        </p>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="flex flex-col gap-5 px-4 mb-4">
      {items.map((item) => (
        <ActivityLogTimelineItem key={item.id} item={item} />
      ))}
    </Accordion>
  );
};
