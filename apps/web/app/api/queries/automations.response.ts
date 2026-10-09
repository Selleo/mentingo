import { AUTOMATION_STEP_TYPES } from "@repo/shared";

import type {
  AutomationDto,
  AutomationEventDefinition,
  AutomationPlaceholderMappings,
  AutomationPlaceholderValue,
  AutomationWorkflow,
  AutomationWorkflowTemplate,
} from "@repo/shared";
import type {
  ListAutomationEventsResponse,
  GetAutomationResponse,
  ListAvailableEmailTemplatesResponse,
  ListBuiltInAutomationTemplatesResponse,
} from "~/api/generated-api";
import type { AutomationTemplateOption } from "~/modules/Admin/Automations/automations.types";

// Swagger widens recursive JSON to object. The API validates these values against
// the shared contract; keep that generated-client bridge at this boundary.
function mapAutomationJsonValue(
  value: object | AutomationPlaceholderValue,
): AutomationPlaceholderValue {
  return value as AutomationPlaceholderValue;
}

function mapApiWorkflowToAutomationWorkflow(
  workflow: GetAutomationResponse["data"]["workflow"],
): AutomationWorkflow {
  return {
    ...workflow,
    steps: workflow.steps.map((step) => {
      if (step.type !== AUTOMATION_STEP_TYPES.SEND_EMAIL) {
        return step;
      }

      return {
        ...step,
        config: {
          ...step.config,
          mappings: step.config.mappings as AutomationPlaceholderMappings | undefined,
        },
      };
    }),
  };
}

export function mapAutomationResponse(automation: GetAutomationResponse["data"]): AutomationDto {
  return {
    ...automation,
    workflow: mapApiWorkflowToAutomationWorkflow(automation.workflow),
    appliedDefinition: automation.appliedDefinition
      ? {
          ...automation.appliedDefinition,
          workflow: mapApiWorkflowToAutomationWorkflow(automation.appliedDefinition.workflow),
        }
      : null,
  };
}

export function mapAutomationEventResponses(
  events: ListAutomationEventsResponse["data"],
): AutomationEventDefinition[] {
  return events.map((event) => ({
    ...event,
    fields: event.fields.map((field) => ({
      ...field,
      sampleValue: mapAutomationJsonValue(field.sampleValue),
    })),
    providedVariables: event.providedVariables.map((variable) => ({
      ...variable,
      sampleValue: mapAutomationJsonValue(variable.sampleValue),
    })),
  }));
}

export function mapAutomationTemplateResponses(
  templates: ListAvailableEmailTemplatesResponse["data"],
): AutomationTemplateOption[] {
  return templates.map((template) => ({
    ...template,
    placeholders: template.placeholders.map((placeholder) => ({
      ...placeholder,
      sampleValue: mapAutomationJsonValue(placeholder.sampleValue),
    })),
  }));
}

export function mapAutomationWorkflowTemplateResponses(
  templates: ListBuiltInAutomationTemplatesResponse["data"],
): AutomationWorkflowTemplate[] {
  return templates.map((template) => ({
    ...template,
    definition: {
      ...template.definition,
      workflow: mapApiWorkflowToAutomationWorkflow(template.definition.workflow),
    },
  }));
}
