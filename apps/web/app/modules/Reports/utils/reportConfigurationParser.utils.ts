import {
  DEFAULT_REPORT_CONFIGURATION,
  MAX_REPORT_CONDITIONS,
  MAX_REPORT_GROUP_IDS,
  MAX_REPORT_TIMEZONE_LENGTH,
  REPORT_FIELD_KEYS,
  REPORT_OPERATOR_KEYS,
  REPORT_VIEWS,
} from "../constants/reports.constants";

import type {
  FilterJoin,
  ReportCondition,
  ReportConditionGroup,
  ReportConfiguration,
  ReportFilterField,
  ReportFilterOperator,
  ReportSubject,
  ReportSubjectType,
  ReportView,
} from "../types/reports.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFilterJoin = (value: unknown): value is FilterJoin => value === "and" || value === "or";

const isSubjectType = (value: unknown): value is ReportSubjectType =>
  value === "course" || value === "path" || value === "learner";

const isConditionValue = (value: unknown) =>
  value === undefined ||
  typeof value === "string" ||
  typeof value === "number" ||
  (Array.isArray(value) &&
    value.every((item) => typeof item === "string" || typeof item === "number"));

const isReportCondition = (value: unknown): value is ReportCondition =>
  isRecord(value) &&
  typeof value.id === "string" &&
  REPORT_FIELD_KEYS.includes(value.field as ReportFilterField) &&
  REPORT_OPERATOR_KEYS.includes(value.operator as ReportFilterOperator) &&
  isConditionValue(value.value);

const isValidTimezone = (timezone: string) => {
  if (timezone.length > MAX_REPORT_TIMEZONE_LENGTH) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

const isValidGroupIds = (groupIds: unknown) =>
  groupIds === undefined ||
  (Array.isArray(groupIds) &&
    groupIds.length <= MAX_REPORT_GROUP_IDS &&
    groupIds.every((id) => typeof id === "string"));

const parseConditionGroups = (groups: unknown[]): ReportConditionGroup[] | null => {
  const parsedGroups = groups.flatMap((group) => {
    if (
      !isRecord(group) ||
      typeof group.id !== "string" ||
      !isFilterJoin(group.join) ||
      !Array.isArray(group.conditions)
    )
      return [];
    const conditions = group.conditions.filter(isReportCondition);
    if (conditions.length !== group.conditions.length || !conditions.length) return [];
    return [{ id: group.id, join: group.join, conditions }];
  });
  return parsedGroups.length === groups.length ? parsedGroups : null;
};

const parseSubject = (subject: unknown): ReportSubject | undefined => {
  if (subject === null || subject === undefined) return null;
  if (
    !isRecord(subject) ||
    typeof subject.id !== "string" ||
    typeof subject.name !== "string" ||
    !isSubjectType(subject.type)
  )
    return undefined;
  return { id: subject.id, name: subject.name, type: subject.type };
};

/**
 * Reads a report configuration shared through the URL. Returns the default configuration when
 * none is given and null when the value is malformed, so the page can warn instead of guessing.
 */
export function parseReportConfiguration(raw: string | null): ReportConfiguration | null {
  if (!raw) return DEFAULT_REPORT_CONFIGURATION;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !REPORT_VIEWS.includes(parsed.view as ReportView)) return null;

    const filters = isRecord(parsed.filters) ? parsed.filters : {};
    if (!isFilterJoin(filters.join)) return null;
    const conditions = Array.isArray(filters.conditions) ? filters.conditions : [];
    const groups = Array.isArray(filters.groups) ? filters.groups : [];
    if (groups.length > 1) return null;

    const validConditions = conditions.filter(isReportCondition);
    if (validConditions.length !== conditions.length) return null;
    const validGroups = parseConditionGroups(groups);
    if (!validGroups) return null;
    const conditionCount =
      validConditions.length +
      validGroups.reduce((total, group) => total + group.conditions.length, 0);
    if (conditionCount > MAX_REPORT_CONDITIONS) return null;

    if (!isValidGroupIds(parsed.groupIds)) return null;
    const subject = parseSubject(parsed.subject);
    if (subject === undefined) return null;
    const timezone = typeof parsed.timezone === "string" ? parsed.timezone : "UTC";
    if (!isValidTimezone(timezone)) return null;

    return {
      view: parsed.view as ReportView,
      timezone,
      subject,
      groupIds: Array.isArray(parsed.groupIds) ? (parsed.groupIds as string[]) : [],
      filters: { join: filters.join, conditions: validConditions, groups: validGroups },
    };
  } catch {
    return null;
  }
}
