import { AUTOMATION_TRIGGER_DEFINITIONS } from "./automationTriggers";
import {
  AUTOMATION_EVENT_KINDS as EVENTS,
  AUTOMATION_PLACEHOLDER_TYPES as TYPES,
} from "./automations";
import type { AutomationEventKind } from "./automations";
import type { AutomationProvidedVariable } from "../types/automations";

const snakeCase = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const publicNames: Record<string, string> = {
  courses_url: "courses_link",
  reset_link: "reset_password_link",
  formatted_course_due_date: "course_due_date",
  due_date: "course_due_date",
  expires_at: "certificate_expiration_date",
  progress_link: "course_progress_link",
  days_before_due_date: "days_until_deadline",
  magic_link: "sign_in_link",
};
const liveTrainingEvents: readonly AutomationEventKind[] = [
  EVENTS.LIVE_TRAINING_STARTED,
  EVENTS.LIVE_TRAINING_REMINDER,
  EVENTS.LIVE_TRAINING_ENDED,
];

const extra = (
  key: string,
  sourceKey: string,
  dataType: AutomationProvidedVariable["dataType"],
  label: string,
  labelKey: string,
): AutomationProvidedVariable => ({
  key,
  sourceKey,
  dataType,
  label,
  labelKey: `automationBuilder.variables.${labelKey}`,
  sampleValue: dataType === TYPES.BOOLEAN ? true : "https://example.invalid/example",
});

/** Public authoring vocabulary. Producer keys and historical aliases remain compatibility contracts. */
export const AUTOMATION_EVENT_VARIABLES: Record<AutomationEventKind, AutomationProvidedVariable[]> =
  Object.fromEntries(
    AUTOMATION_TRIGGER_DEFINITIONS.map((trigger) => {
      const variables: AutomationProvidedVariable[] = trigger.providedVariables.flatMap(
        (variable) => {
          const source = variable.sourceKey ?? variable.key;
          // Internal reason codes are represented by the readable Yes/No condition instead.
          if (trigger.type === EVENTS.CERTIFICATE_EXPIRED && source === "reason") return [];
          let key = publicNames[source] ?? snakeCase(source);
          let labelKey = variable.labelKey;
          let label = variable.label;
          if (source === "title" || source === "content") {
            key = `announcement_${source}`;
            if (liveTrainingEvents.includes(trigger.type)) {
              key = `live_training_${source}`;
              labelKey = `automationBuilder.variables.${key}`;
              label = source === "title" ? "Live training title" : "Live training message";
            }
          }
          if (trigger.type === EVENTS.ANNOUNCEMENT && source === "button_link")
            key = "announcement_link";
          if (source === "live_training_link") {
            labelKey = "automationBuilder.variables.live_training_link";
            label = "Live training link";
          }
          if (trigger.type === EVENTS.COURSE_CHAT_MENTION && source === "course_link")
            key = "discussion_link";
          if (trigger.type === EVENTS.COURSE_CHAT_MENTION && source === "message")
            key = "message_content";
          if (source === "create_password_link") {
            labelKey = "automationBuilder.variables.create_password_link";
            label = "Create password link";
          }
          return [{ ...variable, key, sourceKey: source, labelKey, label }];
        },
      );
      switch (trigger.type) {
        case EVENTS.USER_ASSIGNED_TO_COURSE:
          variables.push(
            extra("has_deadline", "has_deadline", TYPES.BOOLEAN, "Has a deadline", "has_deadline"),
          );
          break;
        case EVENTS.USER_FINISHED_COURSE:
          variables.push(
            extra(
              "certificate_link",
              "certificate_link",
              TYPES.URL,
              "Certificate link",
              "certificate_link",
            ),
            extra("courses_link", "courses_link", TYPES.URL, "Browse courses link", "courses_link"),
          );
          break;
        case EVENTS.USER_SHORT_INACTIVITY:
        case EVENTS.USER_LONG_INACTIVITY:
          variables.push(
            extra("has_course", "has_course", TYPES.BOOLEAN, "Related to a course", "has_course"),
            extra("platform_link", "platform_link", TYPES.URL, "Platform link", "platform_link"),
          );
          break;
        case EVENTS.CERTIFICATE_EXPIRED:
          variables.push(
            extra(
              "was_manually_reset",
              "was_manually_reset",
              TYPES.BOOLEAN,
              "Reset by an administrator",
              "was_manually_reset",
            ),
          );
          break;
        case EVENTS.COURSE_DUE_DATE_REMINDER:
          variables.push(
            extra("is_due_today", "is_due_today", TYPES.BOOLEAN, "Due today", "is_due_today"),
            extra(
              "is_due_tomorrow",
              "is_due_tomorrow",
              TYPES.BOOLEAN,
              "Due tomorrow",
              "is_due_tomorrow",
            ),
          );
          break;
      }
      // Full names are meaningful independently of first/last names and used by existing emails.
      if (trigger.type === EVENTS.PASSWORD_RECOVERY || trigger.type === EVENTS.USER_FIRST_LOGIN) {
        variables.push({
          key: "user_name",
          sourceKey: "name",
          dataType: TYPES.STRING,
          label: "Full name",
          labelKey: "automationBuilder.variables.userName",
          sampleValue: "",
        });
      }
      const identityVariables: AutomationProvidedVariable[] = [
        {
          key: "user_first_name",
          sourceKey: "userFirstName",
          label: "First name",
          labelKey: "automationBuilder.variables.userFirstName",
          dataType: TYPES.STRING,
          sampleValue: "Alex",
        },
        {
          key: "user_last_name",
          sourceKey: "userLastName",
          label: "Last name",
          labelKey: "automationBuilder.variables.userLastName",
          dataType: TYPES.STRING,
          sampleValue: "Morgan",
        },
        {
          key: "user_email",
          sourceKey: "userEmail",
          label: "Email address",
          labelKey: "automationBuilder.variables.userEmail",
          dataType: TYPES.STRING,
          sampleValue: "alex@example.invalid",
        },
      ];
      return [
        trigger.type,
        [
          ...identityVariables,
          ...variables.filter(
            (variable) => !identityVariables.some((identity) => identity.key === variable.key),
          ),
        ],
      ];
    }),
  ) as Record<AutomationEventKind, AutomationProvidedVariable[]>;

export function resolveAutomationEventFieldSourceKey(kind: AutomationEventKind, key: string) {
  return (
    AUTOMATION_EVENT_VARIABLES[kind].find((variable) => variable.key === key)?.sourceKey ??
    AUTOMATION_TRIGGER_DEFINITIONS.find((trigger) => trigger.type === kind)?.providedVariables.find(
      (variable) => variable.key === key,
    )?.sourceKey ??
    key
  );
}
