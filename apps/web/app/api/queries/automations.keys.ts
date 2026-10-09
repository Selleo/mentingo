import type {
  AutomationRecipientOptionsQuery,
  AutomationEventKind,
  AutomationListQuery,
  AutomationRunQuery,
} from "@repo/shared";

export const AUTOMATIONS_QUERY_KEY = ["automations"] as const;

export const AUTOMATIONS_QUERY_KEYS = {
  detail: (automationId: string) => [...AUTOMATIONS_QUERY_KEY, automationId] as const,
  list: (query: AutomationListQuery) => [...AUTOMATIONS_QUERY_KEY, "list", query] as const,
  recipientOptions: (query: AutomationRecipientOptionsQuery) =>
    [...AUTOMATIONS_QUERY_KEY, "recipient-options", query] as const,
  events: [...AUTOMATIONS_QUERY_KEY, "events"] as const,
  templates: [...AUTOMATIONS_QUERY_KEY, "templates"] as const,
  workflowTemplates: [...AUTOMATIONS_QUERY_KEY, "workflow-templates"] as const,
  runs: (query: AutomationRunQuery) => [...AUTOMATIONS_QUERY_KEY, "runs", query] as const,
  run: (automationRunId: string) => [...AUTOMATIONS_QUERY_KEY, "run", automationRunId] as const,
  overlaps: (eventKind: AutomationEventKind | null | undefined, automationId?: string) =>
    [...AUTOMATIONS_QUERY_KEY, "overlaps", eventKind, automationId] as const,
};
