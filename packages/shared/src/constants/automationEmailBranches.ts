import { resolveAutomationEventFieldSourceKey } from "./automationEventVariables";
import {
  AUTOMATION_EVENT_KINDS as EVENTS,
  BUILT_IN_EMAIL_TEMPLATE_KEYS as TEMPLATES,
} from "./automations";
import type {
  AutomationEmailBranchPlan,
  AutomationEventDefinition,
  AutomationFieldAvailability,
  AutomationPlaceholderValue,
} from "../types/automations";
import type { AutomationEventKind } from "./automations";
import { CERTIFICATE_ARCHIVE_REASONS } from "./certificate";

export const AUTOMATION_EMAIL_BRANCH_PLANS: Partial<
  Record<AutomationEventKind, AutomationEmailBranchPlan>
> = {
  [EVENTS.USER_ASSIGNED_TO_COURSE]: {
    field: "has_deadline",
    yes: { templateKey: TEMPLATES.ASSIGNMENT_WITH_DEADLINE },
    no: { templateKey: TEMPLATES.ASSIGNMENT_WITHOUT_DEADLINE },
  },
  [EVENTS.USER_FINISHED_COURSE]: {
    field: "has_certificate",
    yes: { templateKey: TEMPLATES.COMPLETION_WITH_CERTIFICATE },
    no: { templateKey: TEMPLATES.COMPLETION_WITHOUT_CERTIFICATE },
  },
  [EVENTS.CERTIFICATE_EXPIRED]: {
    field: "was_manually_reset",
    yes: { templateKey: TEMPLATES.CERTIFICATE_MANUALLY_RESET },
    no: { templateKey: TEMPLATES.CERTIFICATE_NATURALLY_EXPIRED },
  },
  [EVENTS.USER_SHORT_INACTIVITY]: {
    field: "has_course",
    yes: { templateKey: TEMPLATES.SHORT_INACTIVITY_COURSE },
    no: { templateKey: TEMPLATES.SHORT_INACTIVITY_PLATFORM },
  },
  [EVENTS.USER_LONG_INACTIVITY]: {
    field: "has_course",
    yes: { templateKey: TEMPLATES.LONG_INACTIVITY_COURSE },
    no: { templateKey: TEMPLATES.LONG_INACTIVITY_PLATFORM },
  },
  [EVENTS.COURSE_DUE_DATE_REMINDER]: {
    field: "is_due_today",
    yes: { templateKey: TEMPLATES.DEADLINE_TODAY },
    no: {
      field: "is_due_tomorrow",
      yes: { templateKey: TEMPLATES.DEADLINE_TOMORROW },
      no: { templateKey: TEMPLATES.DEADLINE_UPCOMING },
    },
  },
};

export const AUTOMATION_BRANCH_FIELD_AVAILABILITY: Partial<
  Record<AutomationEventKind, Record<string, AutomationFieldAvailability>>
> = {
  [EVENTS.USER_ASSIGNED_TO_COURSE]: {
    formatted_course_due_date: { field: "has_deadline", equals: true },
  },
  [EVENTS.USER_FINISHED_COURSE]: {
    certificate_link: { field: "has_certificate", equals: true },
    courses_link: { field: "has_certificate", equals: false },
  },
  [EVENTS.USER_SHORT_INACTIVITY]: {
    course_name: { field: "has_course", equals: true },
    course_link: { field: "has_course", equals: true },
    platform_link: { field: "has_course", equals: false },
  },
  [EVENTS.USER_LONG_INACTIVITY]: {
    course_name: { field: "has_course", equals: true },
    course_link: { field: "has_course", equals: true },
    platform_link: { field: "has_course", equals: false },
  },
};

/** Capture facts, not email wording, from the producer's authoritative snapshot. */
export function deriveAutomationBranchFieldValues(
  kind: AutomationEventKind,
  fields: Readonly<Record<string, AutomationPlaceholderValue>>,
) {
  const result: Record<string, AutomationPlaceholderValue> = {};
  if (kind === EVENTS.USER_ASSIGNED_TO_COURSE)
    result.has_deadline =
      typeof fields.formatted_course_due_date === "string" &&
      fields.formatted_course_due_date.trim().length > 0;
  if (kind === EVENTS.USER_FINISHED_COURSE && typeof fields.has_certificate === "boolean") {
    result[fields.has_certificate ? "certificate_link" : "courses_link"] = fields.button_link ?? "";
  }
  if (kind === EVENTS.USER_SHORT_INACTIVITY || kind === EVENTS.USER_LONG_INACTIVITY) {
    result.has_course =
      typeof fields.course_name === "string" && fields.course_name.trim().length > 0;
    if (!result.has_course) result.platform_link = fields.course_link ?? "";
  }
  if (
    kind === EVENTS.CERTIFICATE_EXPIRED &&
    (fields.reason === CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET ||
      fields.reason === CERTIFICATE_ARCHIVE_REASONS.EXPIRED)
  )
    result.was_manually_reset = fields.reason === CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET;
  if (kind === EVENTS.COURSE_DUE_DATE_REMINDER && typeof fields.days_before_due_date === "number") {
    result.is_due_today = fields.days_before_due_date === 0;
    result.is_due_tomorrow = fields.days_before_due_date === 1;
  }
  return result;
}

export function getCanonicalAutomationField(event: AutomationEventDefinition, field: string) {
  return resolveAutomationEventFieldSourceKey(event.kind, field);
}
