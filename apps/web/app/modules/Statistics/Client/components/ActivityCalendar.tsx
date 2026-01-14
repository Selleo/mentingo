import { keys, pickBy } from "lodash-es";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Calendar } from "~/components/ui/calendar";
import { Skeleton } from "~/components/ui/skeleton";

import type { GetUserStatisticsResponse } from "~/api/generated-api";

type ActivityCalendarProps = {
  isLoading: boolean;
  streak?: GetUserStatisticsResponse["data"]["streak"];
};

export const ActivityCalendar = ({ isLoading = true, streak }: ActivityCalendarProps) => {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="flex size-full flex-col gap-4 rounded-lg bg-white p-5 md:p-6 drop-shadow-card">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-8 w-12" />
        </div>
        <div className="h-px w-full bg-neutral-100" />
        <div className="flex h-full w-full justify-center">
          <Skeleton className="h-[376px] w-full md:h-full" />
        </div>
      </div>
    );
  }

  return (
    <div
      id="activity-calendar"
      className="flex size-full flex-col gap-4 rounded-lg bg-white p-5 md:p-6 drop-shadow-card"
    >
      <div id="daily-streak" className="flex w-full items-center justify-between">
        <div className="flex items-center gap-x-2 rounded-full bg-primary-50 px-3 py-1">
          <Icon name="Flame" className="size-5" />
          <span className="h4 text-neutral-950">{streak?.current ?? 0}</span>
        </div>
        <span className="body-lg-md text-neutral-800">
          {t("profileWithCalendarView.other.dailyStreak")}
        </span>
      </div>
      <div className="flex w-full justify-center rounded-xl">
        <Calendar
          mode="single"
          showOutsideDays
          fixedWeeks
          weekStartsOn={1}
          dates={keys(pickBy(streak?.activityHistory, Boolean))}
        />
      </div>
    </div>
  );
};
