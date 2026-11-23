import { useTranslation } from "react-i18next";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import {
  ACTIVITY_SUBJECT_LABEL_KEYS,
  ACTIVITY_SUBJECTS,
  CALENDAR_DATE_TIMEZONE,
} from "../constants/courseActivity.constants";
import { formatReportDate } from "../utils/reports.utils";

import { ReportActivityPeriodControls } from "./ReportActivityPeriodControls";
import { CourseActivityHighlights } from "./ReportCourseActivityHighlights";
import { InactiveCoursesChart, PopularCoursesChart } from "./ReportCourseActivityRankings";

import type { ActivitySubject } from "../types/courseActivity.types";
import type { ReportActivityPeriod, ReportCourseActivity } from "../types/reports-api.types";

type ReportCourseActivityProps = {
  subject?: ActivitySubject;
  period: ReportActivityPeriod;
  onPeriodChange: (period: ReportActivityPeriod) => void;
  timezone: string;
  data?: ReportCourseActivity;
  isFetching?: boolean;
};

export function ReportCourseActivity({
  subject = ACTIVITY_SUBJECTS.COURSE,
  period,
  onPeriodChange,
  timezone,
  data,
  isFetching,
}: ReportCourseActivityProps) {
  const { t } = useTranslation();
  const labelKeys = ACTIVITY_SUBJECT_LABEL_KEYS[subject];
  const language = useLanguageStore((state) => state.language);
  const hasCourseActivity = Boolean(data && (data.popular.length || data.inactive.length));
  const formatPeriodDate = (date: string) =>
    formatReportDate(date, language, CALENDAR_DATE_TIMEZONE);

  return (
    <section className="flex flex-col gap-4" aria-busy={isFetching}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="h6 text-neutral-950">{t(labelKeys.title)}</h2>
          <p className="details text-neutral-800">
            {t("reports.activity.period", {
              from: formatPeriodDate(period.from),
              to: formatPeriodDate(period.to),
            })}
          </p>
        </div>
        <ReportActivityPeriodControls
          key={`${period.from}:${period.to}`}
          period={period}
          onPeriodChange={onPeriodChange}
          isFetching={isFetching}
        />
      </header>
      {data && hasCourseActivity && <CourseActivityHighlights data={data} labelKeys={labelKeys} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <PopularCoursesChart
          courses={data?.popular ?? []}
          timezone={timezone}
          labelKeys={labelKeys}
        />
        <InactiveCoursesChart
          courses={data?.inactive ?? []}
          timezone={timezone}
          labelKeys={labelKeys}
        />
      </div>
    </section>
  );
}
