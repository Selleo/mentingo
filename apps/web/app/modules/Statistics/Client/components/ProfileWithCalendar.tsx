import { Link } from "@remix-run/react";
import { keys, pickBy } from "lodash-es";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Skeleton } from "~/components/ui/skeleton";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";

import type { CurrentUserResponse, GetUserStatisticsResponse } from "~/api/generated-api";

type ProfileWithCalendar = {
  user: CurrentUserResponse["data"] | undefined;
  isLoading: boolean;
  streak?: GetUserStatisticsResponse["data"]["streak"];
};

export const ProfileWithCalendar = ({ user, isLoading = true, streak }: ProfileWithCalendar) => {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col gap-6 rounded-lg drop-shadow-card md:flex-row 2xl:max-w-[384px] 2xl:flex-col 2xl:divide-y 2xl:divide-neutral-100 2xl:bg-white 2xl:p-8">
        <div className="w-full rounded-lg bg-white p-8 md:max-w-[352px] 2xl:p-0">
          <div className="flex items-center">
            <Skeleton className="h-4 w-20 rounded-lg" />
          </div>
          <div className="mt-6 flex flex-col items-center">
            <Skeleton className="aspect-square size-[124px] rounded-full" />
            <div className="flex flex-col items-center justify-center">
              <div className="flex h-[38px] w-full max-w-[240px] items-center">
                <Skeleton className="h-6 w-full rounded-lg" />
              </div>
              <div className="flex items-center">
                <Skeleton className="h-4 w-40 rounded-lg" />
              </div>
            </div>
            <Skeleton className="mt-6 h-[38px] w-full rounded-lg" />
          </div>
        </div>
        <div className="flex h-full w-full max-w-[352px] flex-col gap-y-2 rounded-lg bg-white p-8 2xl:p-0">
          <div className="flex items-center py-[21px]">
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="flex h-full w-full justify-center">
            <Skeleton className="h-[376px] w-full md:h-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="profile"
      className="flex size-full flex-col gap-6 rounded-lg drop-shadow-card md:flex-row 2xl:max-w-[384px] 2xl:flex-col 2xl:gap-6 2xl:divide-y 2xl:divide-primary-200 2xl:bg-white 2xl:p-8"
    >
      <div className="w-full gap-y-6 rounded-lg bg-white p-6 md:p-8 2xl:p-0">
        <span className="body-lg-md text-neutral-900">{t("profileWithCalendarView.header")}</span>
        <div className="flex flex-col items-center gap-6">
          <UserAvatar
            className="size-[124px]"
            userName={`${user?.firstName} ${user?.lastName}`}
            profilePictureUrl={user?.profilePictureUrl}
          />
          <div className="text-center">
            <h2 className="h5 font-gothic">
              {user?.firstName} {user?.lastName}
            </h2>
            <a className="body-lg text-neutral-800" href={`mailto:${user?.email}`}>
              {user?.email}
            </a>
          </div>
          <Link to="/settings" className="w-full">
            <Button className="w-full">{t("profileWithCalendarView.button.settings")}</Button>
          </Link>
        </div>
      </div>
      <div className="flex w-full flex-col gap-y-2 bg-white p-6 md:p-8 2xl:p-0 2xl:pt-6">
        <div className="flex flex-row-reverse items-center justify-between 2xl:flex-row">
          <div className="flex items-center gap-x-2 py-2">
            <Icon name="Flame" />
            <span className="h1 text-neutral-950">{streak?.current}</span>
          </div>
          <span className="body-lg-md text-neutral-800">
            {t("profileWithCalendarView.other.dailyStreak")}
          </span>
        </div>
        <div className="flex w-full justify-center">
          <Calendar
            mode="single"
            showOutsideDays
            fixedWeeks
            weekStartsOn={1}
            dates={keys(pickBy(streak?.activityHistory, Boolean))}
          />
        </div>
      </div>
    </div>
  );
};
