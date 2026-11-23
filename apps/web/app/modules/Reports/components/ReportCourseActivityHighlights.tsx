import { CalendarClock, CircleOff, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ActivitySubjectLabelKeys } from "../types/courseActivity.types";
import type { ReportCourseActivity } from "../types/reports-api.types";

export function CourseActivityHighlights({
  data,
  labelKeys,
}: {
  data: ReportCourseActivity;
  labelKeys: ActivitySubjectLabelKeys;
}) {
  const { t } = useTranslation();
  const [mostPopularCourse] = data.popular;
  const neverActiveCourseLabels = data.inactive
    .filter((course) => course.inactiveDays === null)
    .map((course) => course.label);
  const [longestInactiveCourse] = data.inactive.flatMap(({ inactiveDays, label }) =>
    inactiveDays === null ? [] : [{ inactiveDays, label }],
  );
  const highlights = [
    {
      key: "topCourse",
      icon: Flame,
      label: t(labelKeys.topSubject),
      value: mostPopularCourse?.label ?? "",
      context: t("reports.activity.tooltip.learners", {
        count: mostPopularCourse?.activeLearners ?? 0,
      }),
    },
    ...(longestInactiveCourse
      ? [
          {
            key: "longestGap",
            icon: CalendarClock,
            label: t("reports.activity.highlights.longestGap"),
            value: t("reports.activity.highlights.days", {
              count: longestInactiveCourse.inactiveDays,
            }),
            context: longestInactiveCourse.label,
          },
        ]
      : []),
    {
      key: "neverActive",
      icon: CircleOff,
      label: t(labelKeys.neverActive),
      value: neverActiveCourseLabels.length,
      context: neverActiveCourseLabels.join(", "),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {highlights.map(({ key, icon: HighlightIcon, label, value, context }) => (
        <article
          key={key}
          className="flex min-w-0 flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-5"
        >
          <p className="body-sm-md flex items-center gap-2 text-neutral-800">
            <HighlightIcon className="size-4 shrink-0 text-neutral-800" aria-hidden="true" />
            {label}
          </p>
          <p className="h6 truncate text-neutral-950" title={String(value)}>
            {value}
          </p>
          {context && (
            <p className="details truncate text-neutral-800" title={context}>
              {context}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
