import {
  AUTOMATION_VALIDATION_ISSUE_CODES,
  type AutomationValidationIssueCode,
  SUPPORTED_LANGUAGES,
  AUTOMATION_TRIGGER_DEFINITIONS,
  AUTOMATION_EVENT_VARIABLES,
  AUTOMATION_RESERVED_BRANDING_PLACEHOLDER,
  type AutomationEventDefinition,
  type AutomationPlaceholderDefinition,
  type AutomationPlaceholderMappings,
  type AutomationPlaceholderValue,
  type AutomationWorkflowIssue,
  type SupportedLanguages,
  isAutomationFieldAvailable,
  AUTOMATION_PLACEHOLDER_TYPES,
  AUTOMATION_FIELD_SENSITIVITIES,
  AUTOMATION_MAPPING_TYPES,
} from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { automationPlaceholderValueSchemas } from "../schema/automation.schema";

import type { UUIDType } from "src/common";

export const isValidAutomationPlaceholderValue = (
  value: AutomationPlaceholderValue,
  type: AutomationPlaceholderDefinition["type"],
): boolean => {
  if (!Value.Check(automationPlaceholderValueSchemas[type], value)) {
    return false;
  }

  if (type === AUTOMATION_PLACEHOLDER_TYPES.URL) {
    if (typeof value !== "string") {
      return false;
    }

    try {
      const url = new URL(value);

      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }

  return true;
};

export function getAutomationMappingIssues(
  event: AutomationEventDefinition,
  placeholders: AutomationPlaceholderDefinition[],
  mappings: AutomationPlaceholderMappings,
  stepId: UUIDType,
): AutomationWorkflowIssue[] {
  const issues = getMissingRequiredMappingIssues(placeholders, mappings, stepId);

  const placeholdersByName = new Map(
    placeholders.map((placeholder) => [placeholder.name, placeholder]),
  );

  for (const [name, mapping] of Object.entries(mappings)) {
    const issue = getConfiguredMappingIssue(
      event,
      name,
      mapping,
      placeholdersByName.get(name),
      stepId,
    );

    if (issue) {
      issues.push(issue);
    }
  }

  if (event.accountAction && getAccountActionPlaceholderNames(event, mappings).length === 0) {
    issues.push({
      code: AUTOMATION_VALIDATION_ISSUE_CODES.MISSING_ACCOUNT_ACTION,
      message: "Map the required account action link.",
      stepId,
    });
  }

  return issues;
}

function getMissingRequiredMappingIssues(
  placeholders: AutomationPlaceholderDefinition[],
  mappings: AutomationPlaceholderMappings,
  stepId: UUIDType,
): AutomationWorkflowIssue[] {
  return placeholders
    .filter(
      (placeholder) =>
        placeholder.name !== AUTOMATION_RESERVED_BRANDING_PLACEHOLDER &&
        placeholder.required &&
        !mappings[placeholder.name],
    )
    .map((placeholder) => ({
      code: AUTOMATION_VALIDATION_ISSUE_CODES.MISSING_MAPPING,
      message: "Map this tag used in the email.",
      stepId,
      placeholder: placeholder.name,
    }));
}

function getConfiguredMappingIssue(
  event: AutomationEventDefinition,
  name: string,
  mapping: AutomationPlaceholderMappings[string],
  placeholder: AutomationPlaceholderDefinition | undefined,
  stepId: UUIDType,
): AutomationWorkflowIssue | null {
  const createMappingIssue = (
    code: AutomationValidationIssueCode,
    message: string,
  ): AutomationWorkflowIssue => ({ code, message, stepId, placeholder: name });

  if (name === AUTOMATION_RESERVED_BRANDING_PLACEHOLDER) {
    return createMappingIssue(
      AUTOMATION_VALIDATION_ISSUE_CODES.RESERVED_MAPPING,
      "Branding is resolved by the platform.",
    );
  }

  if (!placeholder) {
    return createMappingIssue(
      AUTOMATION_VALIDATION_ISSUE_CODES.UNKNOWN_PLACEHOLDER,
      "This placeholder is not defined by the template.",
    );
  }

  if (!placeholder.required) {
    return null;
  }

  if (mapping.type === AUTOMATION_MAPPING_TYPES.STATIC) {
    return isValidAutomationPlaceholderValue(mapping.value, placeholder.type)
      ? null
      : createMappingIssue(
          AUTOMATION_VALIDATION_ISSUE_CODES.MAPPING_TYPE_MISMATCH,
          "The static value does not match the placeholder type.",
        );
  }

  const field = event.fields.find((field) => field.key === mapping.field);

  if (!field) {
    return createMappingIssue(
      AUTOMATION_VALIDATION_ISSUE_CODES.UNKNOWN_EVENT_FIELD,
      "Select a supported field from the starting event.",
    );
  }

  const typesMatch =
    field.type === placeholder.type ||
    (field.type === AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING &&
      placeholder.type === AUTOMATION_PLACEHOLDER_TYPES.STRING);

  return typesMatch
    ? null
    : createMappingIssue(
        AUTOMATION_VALIDATION_ISSUE_CODES.MAPPING_TYPE_MISMATCH,
        "The event field does not match the placeholder type.",
      );
}

const readEventFieldValue = (
  field: string,
  fields: Record<string, AutomationPlaceholderValue>,
): AutomationPlaceholderValue | undefined => {
  if (fields[field] !== undefined) {
    return fields[field];
  }

  const aliases = [
    ...Object.values(AUTOMATION_EVENT_VARIABLES).flat(),
    ...AUTOMATION_TRIGGER_DEFINITIONS.flatMap((trigger) => trigger.providedVariables),
  ].filter((variable) => variable.key === field && variable.sourceKey);

  for (const alias of aliases) {
    const sourceKey = alias.sourceKey;

    if (sourceKey && fields[sourceKey] !== undefined) {
      return fields[sourceKey];
    }
  }

  return undefined;
};

export function resolveAutomationMappings(
  mappings: AutomationPlaceholderMappings,
  fields: Record<string, AutomationPlaceholderValue>,
  language: SupportedLanguages,
  fallbackLanguage: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  usedPlaceholderNames?: readonly string[],
): Record<string, AutomationPlaceholderValue> {
  const usedMappings = Object.entries(mappings).filter(
    ([name]) => !usedPlaceholderNames || usedPlaceholderNames.includes(name),
  );

  return Object.fromEntries(
    usedMappings.map(([name, mapping]) => {
      const value = resolveMappingSourceValue(mapping, fields);

      return [name, localizeMappedValue(value, language, fallbackLanguage)];
    }),
  );
}

function resolveMappingSourceValue(
  mapping: AutomationPlaceholderMappings[string],
  fields: Record<string, AutomationPlaceholderValue>,
): AutomationPlaceholderValue {
  const value =
    mapping.type === AUTOMATION_MAPPING_TYPES.STATIC
      ? mapping.value
      : readEventFieldValue(mapping.field, fields);

  if (value === undefined) {
    throw new Error("Missing notification field");
  }

  return value;
}

function localizeMappedValue(
  value: AutomationPlaceholderValue,
  language: SupportedLanguages,
  fallbackLanguage: SupportedLanguages,
): AutomationPlaceholderValue {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) =>
      Object.values(SUPPORTED_LANGUAGES).includes(key as SupportedLanguages),
    )
  ) {
    return value[language] ?? value[fallbackLanguage] ?? value[SUPPORTED_LANGUAGES.EN] ?? "";
  }

  return value;
}

export const getAccountActionPlaceholderNames = (
  event: AutomationEventDefinition,
  mappings: AutomationPlaceholderMappings,
): string[] =>
  Object.entries(mappings)
    .filter(
      ([, mapping]) =>
        mapping.type === AUTOMATION_MAPPING_TYPES.EVENT_FIELD &&
        event.fields.some(
          (field) =>
            field.key === mapping.field &&
            field.sensitivity === AUTOMATION_FIELD_SENSITIVITIES.ACCOUNT_ACTION_LINK,
        ),
    )
    .map(([name]) => name);

export function getAutomationBranchMappingIssues(
  event: AutomationEventDefinition,
  placeholders: AutomationPlaceholderDefinition[],
  mappings: AutomationPlaceholderMappings,
  stepId: UUIDType,
  facts: Record<string, boolean>,
): AutomationWorkflowIssue[] {
  return placeholders
    .filter((placeholder) => placeholder.required)
    .flatMap((placeholder) => {
      const mapping = mappings[placeholder.name];

      if (
        mapping?.type !== AUTOMATION_MAPPING_TYPES.EVENT_FIELD ||
        isAutomationFieldAvailable(event, mapping.field, facts)
      ) {
        return [];
      }

      return [
        {
          code: AUTOMATION_VALIDATION_ISSUE_CODES.FIELD_UNAVAILABLE_ON_BRANCH,
          message:
            "This variable requires a matching Yes/No path. Add a condition before using it.",
          stepId,
          placeholder: placeholder.name,
        },
      ];
    });
}
