import { CircleOff, Hourglass, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { INACTIVITY_LEVEL_COLORS, INACTIVITY_LEVELS } from "../constants/courseActivity.constants";
import { getInactivityLevel } from "../utils/courseActivity.utils";

import {
  CourseActivityBarChart,
  CourseActivityPanel,
  EmptyCourseActivity,
  ScreenReaderCourseList,
} from "./ReportCourseActivityChart";

import type { ActivitySubjectLabelKeys, CourseActivityItem } from "../types/courseActivity.types";

export function PopularCoursesChart({
  courses,
  timezone,
  labelKeys,
}: {
  courses: CourseActivityItem[];
  timezone: string;
  labelKeys: ActivitySubjectLabelKeys;
}) {
  const { t } = useTranslation();
  const title = t(labelKeys.popular);
  const metricLabel = t("reports.activity.learners");
  const bars = courses.map((course) => ({ ...course, value: course.activeLearners }));

  return (
    <CourseActivityPanel icon={TrendingUp} title={title} subtitle={metricLabel}>
      {bars.length > 0 ? (
        <CourseActivityBarChart
          bars={bars}
          metricLabel={metricLabel}
          ariaLabel={`${title}: ${metricLabel}`}
          timezone={timezone}
        />
      ) : (
        <EmptyCourseActivity />
      )}
      <ScreenReaderCourseList bars={bars} metricLabel={metricLabel} />
    </CourseActivityPanel>
  );
}

export function InactiveCoursesChart({
  courses,
  timezone,
  labelKeys,
}: {
  courses: CourseActivityItem[];
  timezone: string;
  labelKeys: ActivitySubjectLabelKeys;
}) {
  const { t } = useTranslation();
  const title = t(labelKeys.inactive);
  const metricLabel = t("reports.activity.days");
  const neverActiveCourses = courses.filter((course) => course.inactiveDays === null);
  const bars = courses.flatMap((course) =>
    course.inactiveDays === null ? [] : [{ ...course, value: course.inactiveDays }],
  );
  const barColors = bars.map((bar) => INACTIVITY_LEVEL_COLORS[getInactivityLevel(bar.value)]);

  return (
    <CourseActivityPanel icon={Hourglass} title={title} subtitle={metricLabel}>
      {neverActiveCourses.length > 0 && (
        <div className="mt-3 rounded-lg bg-neutral-50 p-3">
          <p className="body-sm-md flex items-center gap-2 text-neutral-800">
            <CircleOff className="size-4 text-error-600" aria-hidden="true" />
            {t("reports.activity.never")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {neverActiveCourses.map((course) => (
              <li
                key={course.id}
                title={course.label}
                className="details max-w-full truncate rounded-full border border-error-200 bg-white px-2.5 py-1 text-neutral-800"
              >
                {course.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {bars.length > 0 && (
        <>
          <CourseActivityBarChart
            bars={bars}
            metricLabel={metricLabel}
            ariaLabel={`${title}: ${metricLabel}`}
            timezone={timezone}
            barColors={barColors}
          />
          <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-3">
            {Object.values(INACTIVITY_LEVELS).map((level) => (
              <li key={level} className="details flex items-center gap-1.5 text-neutral-800">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: INACTIVITY_LEVEL_COLORS[level] }}
                  aria-hidden="true"
                />
                {t(`reports.activity.levels.${level}`)}
              </li>
            ))}
          </ul>
        </>
      )}
      {courses.length === 0 && <EmptyCourseActivity />}
      <ScreenReaderCourseList bars={bars} metricLabel={metricLabel} />
    </CourseActivityPanel>
  );
}
