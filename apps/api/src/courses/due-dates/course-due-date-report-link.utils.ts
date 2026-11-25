import { match } from "ts-pattern";

import {
  REPORT_CONFIGURATION_SEARCH_PARAM,
  REPORT_FILTER_FIELDS,
  REPORT_FILTER_OPERATORS,
  REPORT_STATUS,
  REPORT_VIEWS,
  REPORTS_PAGE_PATH,
} from "src/report/constants/reports.constants";

import type { CourseDueDateReportRange } from "./course-due-date-reminder.types";

const REPORT_TIMEZONE = "UTC";

const DUE_DATE_CONDITION = {
  id: REPORT_FILTER_FIELDS.DUE_DATE,
  field: REPORT_FILTER_FIELDS.DUE_DATE,
} as const;

const buildDueDateCondition = ({ firstDay, lastDay }: CourseDueDateReportRange) =>
  match(firstDay)
    .with(null, () => ({
      ...DUE_DATE_CONDITION,
      operator: REPORT_FILTER_OPERATORS.LTE,
      value: lastDay,
    }))
    .with(lastDay, () => ({
      ...DUE_DATE_CONDITION,
      operator: REPORT_FILTER_OPERATORS.EQ,
      value: lastDay,
    }))
    .otherwise((day) => ({
      ...DUE_DATE_CONDITION,
      operator: REPORT_FILTER_OPERATORS.BETWEEN,
      value: day,
      secondValue: lastDay,
    }));

/** Opens the organisation report narrowed to unfinished courses due within the given days. */
export const buildUnfinishedCoursesDueReportUrl = (
  tenantOrigin: string,
  dueDateRange: CourseDueDateReportRange,
) => {
  const reportConfiguration = {
    view: REPORT_VIEWS.ORGANISATION,
    timezone: REPORT_TIMEZONE,
    subject: null,
    groupIds: [],
    filters: {
      join: "and",
      conditions: [
        buildDueDateCondition(dueDateRange),
        {
          id: REPORT_FILTER_FIELDS.STATUS,
          field: REPORT_FILTER_FIELDS.STATUS,
          operator: REPORT_FILTER_OPERATORS.IN,
          value: [REPORT_STATUS.NOT_STARTED, REPORT_STATUS.IN_PROGRESS],
        },
      ],
      groups: [],
    },
  };

  const searchParams = new URLSearchParams({
    [REPORT_CONFIGURATION_SEARCH_PARAM]: JSON.stringify(reportConfiguration),
  });

  return `${tenantOrigin.replace(/\/$/, "")}${REPORTS_PAGE_PATH}?${searchParams.toString()}`;
};
