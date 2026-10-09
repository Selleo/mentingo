import { randomUUID } from "node:crypto";

import { getBuiltInTemplatePublication } from "@repo/email-templates";
import {
  AUTOMATION_MAPPING_TYPES,
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_CONDITION_BRANCH_POSITIONS,
  AUTOMATION_EMAIL_BRANCH_PLANS,
  AUTOMATION_STEP_TYPES,
  AUTOMATION_TEMPLATE_TYPES,
  SUPPORTED_LANGUAGES,
  type AutomationDefinition,
  type AutomationWorkflow,
  type AutomationPlaceholderMappings,
  type AutomationEmailBranchPlan,
  type AutomationStep,
  type AutomationPlaceholderDefinition,
  type AutomationEventKind,
} from "@repo/shared";

import type {
  PublishedDefaultCustomization,
  BuiltInAutomationDefinition,
} from "../automation-execution.types";
import type { UUIDType } from "src/common";

export function buildBuiltInAutomationDefinition(
  builtin: BuiltInAutomationDefinition,
  customization?: PublishedDefaultCustomization,
  metadata?: Pick<AutomationDefinition, "name" | "description">,
): AutomationDefinition {
  const plan = AUTOMATION_EMAIL_BRANCH_PLANS[builtin.eventKind];

  if (plan && !customization) {
    return buildConditionalBuiltInAutomationDefinition(builtin, plan, metadata);
  }

  return {
    name: metadata?.name ?? builtin.name[SUPPORTED_LANGUAGES.EN],
    description: metadata?.description ?? builtin.description[SUPPORTED_LANGUAGES.EN],
    workflow: buildSingleEmailWorkflow(builtin, customization),
  };
}

export function buildConditionalBuiltInAutomationDefinition(
  builtin: BuiltInAutomationDefinition,
  branchPlan: AutomationEmailBranchPlan,
  metadata?: Pick<AutomationDefinition, "name" | "description">,
): AutomationDefinition {
  const triggerStepId = randomUUID();

  return {
    name: metadata?.name ?? builtin.name[SUPPORTED_LANGUAGES.EN],
    description: metadata?.description ?? builtin.description[SUPPORTED_LANGUAGES.EN],
    workflow: {
      rootStepId: triggerStepId,
      steps: [
        {
          id: triggerStepId,
          parentId: null,
          position: 0,
          type: AUTOMATION_STEP_TYPES.TRIGGER,
          config: { eventKind: builtin.eventKind },
        },
        ...buildEmailBranchSteps(branchPlan, triggerStepId, 0),
      ],
    },
  };
}

function buildEmailBranchSteps(
  branchPlan: AutomationEmailBranchPlan,
  parentStepId: UUIDType,
  branchPosition: number,
): AutomationStep[] {
  const stepId = randomUUID();
  const identity = { id: stepId, parentId: parentStepId, position: branchPosition };

  if ("field" in branchPlan) {
    return [
      {
        ...identity,
        type: AUTOMATION_STEP_TYPES.CONDITION,
        config: { field: branchPlan.field },
      },
      ...buildEmailBranchSteps(branchPlan.yes, stepId, AUTOMATION_CONDITION_BRANCH_POSITIONS.YES),
      ...buildEmailBranchSteps(branchPlan.no, stepId, AUTOMATION_CONDITION_BRANCH_POSITIONS.NO),
    ];
  }

  const publication = getBuiltInTemplatePublication(branchPlan.templateKey);

  return [
    {
      ...identity,
      type: AUTOMATION_STEP_TYPES.SEND_EMAIL,
      config: {
        template: { type: AUTOMATION_TEMPLATE_TYPES.BUILTIN, key: branchPlan.templateKey },
        mappings: buildRequiredEventFieldMappings(publication.placeholders),
      },
    },
  ];
}

function buildRequiredEventFieldMappings(
  placeholders: AutomationPlaceholderDefinition[],
): AutomationPlaceholderMappings {
  return Object.fromEntries(
    placeholders
      .filter((placeholder) => placeholder.required)
      .map(({ name }) => [name, { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: name }]),
  );
}

function buildSingleEmailWorkflow(
  builtin: BuiltInAutomationDefinition,
  customization?: PublishedDefaultCustomization,
): AutomationWorkflow {
  const triggerId = randomUUID();
  const actionId = randomUUID();
  const mappings = buildCustomizedTemplateMappings(builtin, customization);

  return {
    rootStepId: triggerId,
    steps: [
      {
        id: triggerId,
        parentId: null,
        position: 0,
        type: AUTOMATION_STEP_TYPES.TRIGGER,
        config: { eventKind: builtin.eventKind },
      },
      {
        id: actionId,
        parentId: triggerId,
        position: 0,
        type: AUTOMATION_STEP_TYPES.SEND_EMAIL,
        config: {
          template: customization
            ? { type: AUTOMATION_TEMPLATE_TYPES.CUSTOM, id: customization.id }
            : { type: AUTOMATION_TEMPLATE_TYPES.BUILTIN, key: builtin.templateKey },
          mappings,
        },
      },
    ],
  };
}

function buildCustomizedTemplateMappings(
  builtin: BuiltInAutomationDefinition,
  customization?: PublishedDefaultCustomization,
): AutomationPlaceholderMappings {
  if (!customization?.publication) {
    return builtin.mappings;
  }

  return Object.fromEntries(
    customization.publication.placeholders
      .filter(({ required }) => required)
      .map(({ name }) => [
        name,
        builtin.mappings[name] ?? {
          type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
          field: resolveLegacyTemplateEventField(builtin.eventKind, name),
        },
      ]),
  );
}

function resolveLegacyTemplateEventField(
  eventKind: AutomationEventKind,
  placeholderName: string,
): string {
  if (eventKind === AUTOMATION_EVENT_KINDS.ADMIN_OVERDUE_COURSES && placeholderName === "courses") {
    return "overdue_courses_summary";
  }

  return placeholderName;
}
