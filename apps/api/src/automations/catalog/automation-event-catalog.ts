import {
  ACCOUNT_ACTION_KINDS,
  AUTOMATION_BRANCH_FIELD_AVAILABILITY,
  AUTOMATION_PLACEHOLDER_TYPES,
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_TRIGGER_DEFINITIONS,
  AUTOMATION_EVENT_VARIABLES,
  type AutomationEventDefinition,
  type AutomationEventFieldDefinition,
  type AutomationEventKind,
} from "@repo/shared";

import { AUTOMATION_EVENT_DEFINITIONS } from "./automation-event-definitions";

const ACCOUNT_ACTIONS_BY_EVENT: Partial<
  Record<AutomationEventDefinition["kind"], NonNullable<AutomationEventDefinition["accountAction"]>>
> = {
  [AUTOMATION_EVENT_KINDS.PASSWORD_RECOVERY]: ACCOUNT_ACTION_KINDS.RESET_PASSWORD,
  [AUTOMATION_EVENT_KINDS.PASSWORD_REMINDER]: ACCOUNT_ACTION_KINDS.CREATE_PASSWORD,
  [AUTOMATION_EVENT_KINDS.USER_INVITE]: ACCOUNT_ACTION_KINDS.CREATE_PASSWORD,
  [AUTOMATION_EVENT_KINDS.MAGIC_LINK]: ACCOUNT_ACTION_KINDS.SIGN_IN,
};

/** Event availability and variables belong to trigger definitions, independently of selected templates. */
export const AUTOMATION_EVENT_CATALOG: AutomationEventDefinition[] =
  AUTOMATION_TRIGGER_DEFINITIONS.map((trigger) => {
    const definition = AUTOMATION_EVENT_DEFINITIONS.find((event) => event.kind === trigger.type);

    if (!definition) {
      throw new Error(`Missing automation event definition: ${trigger.type}`);
    }

    const additions = getBranchCatalogFields(trigger.type);
    const rules = AUTOMATION_BRANCH_FIELD_AVAILABILITY[trigger.type] ?? {};

    const canonicalFields = [
      ...definition.fields,
      ...additions.filter(
        (field) => !definition.fields.some((existing) => existing.key === field.key),
      ),
    ].map((field) => ({
      ...field,
      ...(rules[field.key] ? { availableWhen: rules[field.key] } : {}),
    }));

    const legacyVariables = [
      ...trigger.providedVariables,
      ...additions
        .filter(
          (field) =>
            !trigger.providedVariables.some(
              (variable) => variable.key === field.key || variable.sourceKey === field.key,
            ),
        )
        .map((field) => ({
          key: field.key,
          sourceKey: field.key,
          label: field.label,
          labelKey: `automationBuilder.variables.${field.key}`,
          dataType: field.type,
          sensitivity: field.sensitivity,
          sampleValue: field.sampleValue,
        })),
    ].map((variable) => {
      const canonicalField = canonicalFields.find((field) => field.key === variable.sourceKey);

      return {
        ...variable,
        availableWhen: canonicalField?.availableWhen,
        sampleValue: canonicalField?.sampleValue ?? variable.sampleValue,
      };
    });

    const providedVariables = AUTOMATION_EVENT_VARIABLES[trigger.type].map((variable) => {
      const field = canonicalFields.find((field) => field.key === variable.sourceKey);

      return {
        ...variable,
        availableWhen: field?.availableWhen,
        sampleValue: field?.sampleValue ?? variable.sampleValue,
      };
    });

    const aliases = [...legacyVariables, ...providedVariables]
      .filter((variable) => !canonicalFields.some((field) => field.key === variable.key))
      .map((variable) => ({
        key: variable.key,
        label: variable.label,
        type: variable.dataType,
        sampleValue: variable.sampleValue,
        sensitivity: variable.sensitivity,
        availableWhen: variable.availableWhen,
      }));

    return {
      ...definition,
      fields: [
        ...new Map([...canonicalFields, ...aliases].map((field) => [field.key, field])).values(),
      ],
      providedVariables,
      ...(ACCOUNT_ACTIONS_BY_EVENT[trigger.type]
        ? { accountAction: ACCOUNT_ACTIONS_BY_EVENT[trigger.type] }
        : {}),
    };
  });

export const findAutomationEventDefinition = (kind: string | null | undefined) =>
  AUTOMATION_EVENT_CATALOG.find((event) => event.kind === kind);

function getBranchCatalogFields(kind: AutomationEventKind): AutomationEventFieldDefinition[] {
  const boolean = (key: string, label: string) => ({
    key,
    label,
    type: AUTOMATION_PLACEHOLDER_TYPES.BOOLEAN,
    sampleValue: true,
  });

  const link = (key: string, label: string) => ({
    key,
    label,
    type: AUTOMATION_PLACEHOLDER_TYPES.URL,
    sampleValue: "https://example.invalid/example",
  });

  switch (kind) {
    case AUTOMATION_EVENT_KINDS.USER_ASSIGNED_TO_COURSE:
      return [boolean("has_deadline", "Has a deadline")];
    case AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE:
      return [
        link("certificate_link", "Certificate link"),
        link("courses_link", "Browse courses link"),
      ];
    case AUTOMATION_EVENT_KINDS.CERTIFICATE_EXPIRED:
      return [boolean("was_manually_reset", "Reset by an administrator")];
    case AUTOMATION_EVENT_KINDS.USER_SHORT_INACTIVITY:
    case AUTOMATION_EVENT_KINDS.USER_LONG_INACTIVITY:
      return [boolean("has_course", "Related to a course"), link("platform_link", "Platform link")];
    case AUTOMATION_EVENT_KINDS.COURSE_DUE_DATE_REMINDER:
      return [boolean("is_due_today", "Due today"), boolean("is_due_tomorrow", "Due tomorrow")];
    default:
      return [];
  }
}
