import type {
  AUTOMATION_DEFINITION_KINDS,
  AutomationValidationIssueCode,
  AUTOMATION_TEMPLATE_TYPES,
  AUTOMATION_MAPPING_TYPES,
  AUTOMATION_RECIPIENT_TYPES,
  AUTOMATION_STEP_TYPES,
  AutomationEmailDeliveryStatus,
  AutomationEventKind,
  AutomationRunStatus,
  AutomationPlaceholderType,
  AutomationStatus,
  BuiltInEmailTemplateKey,
} from "../constants/automations";
import type { SupportedLanguages } from "../constants/languages";

/** JSON-only values; no arbitrary expressions or executable mapping sources. */
export type AutomationPlaceholderValue =
  | string
  | number
  | boolean
  | null
  | AutomationPlaceholderValue[]
  | { [key: string]: AutomationPlaceholderValue };

export type AutomationTemplateReference =
  | { type: typeof AUTOMATION_TEMPLATE_TYPES.BUILTIN; key: BuiltInEmailTemplateKey }
  | { type: typeof AUTOMATION_TEMPLATE_TYPES.CUSTOM; id: string };

/** Field is a catalog key, never an author-provided property traversal expression. */
export type AutomationPlaceholderMapping =
  | { type: typeof AUTOMATION_MAPPING_TYPES.EVENT_FIELD; field: string }
  | { type: typeof AUTOMATION_MAPPING_TYPES.STATIC; value: AutomationPlaceholderValue };

export type AutomationPlaceholderMappings = Record<string, AutomationPlaceholderMapping>;
export type AutomationTriggerConfig = { eventKind?: AutomationEventKind | null };
export type AutomationDefinitionKind =
  (typeof AUTOMATION_DEFINITION_KINDS)[keyof typeof AUTOMATION_DEFINITION_KINDS];

export type AutomationConditionConfig = { field?: string };

export type AutomationStepConfiguration =
  | ({ name: "condition" } & AutomationConditionConfig)
  | { name: AutomationEventKind | null }
  | ({
      name: "send_email";
    } & AutomationSendEmailConfig);

export type AutomationFieldAvailability = { field: string; equals: boolean };
export type AutomationEmailBranchPlan =
  | { templateKey: BuiltInEmailTemplateKey }
  | { field: string; yes: AutomationEmailBranchPlan; no: AutomationEmailBranchPlan };

export type AutomationProvidedVariable = {
  availableWhen?: AutomationFieldAvailability;
  key: string;
  label: string;
  labelKey?: string;
  dataType: AutomationPlaceholderType;
  sampleValue: AutomationPlaceholderValue;
  sourceKey?: string;
  sensitivity?: "ordinary" | "account_action_link";
};

export type AutomationRecipientSelection =
  | { type: typeof AUTOMATION_RECIPIENT_TYPES.EVENT }
  | { type: typeof AUTOMATION_RECIPIENT_TYPES.EVERYONE }
  | { type: typeof AUTOMATION_RECIPIENT_TYPES.USER; userId: string }
  | { type: typeof AUTOMATION_RECIPIENT_TYPES.GROUP; groupId: string }
  | { type: typeof AUTOMATION_RECIPIENT_TYPES.ROLE; roleId: string };

export type AutomationRecipientOptionType =
  | typeof AUTOMATION_RECIPIENT_TYPES.USER
  | typeof AUTOMATION_RECIPIENT_TYPES.GROUP
  | typeof AUTOMATION_RECIPIENT_TYPES.ROLE;
export type AutomationRecipientOptionsQuery = {
  language?: SupportedLanguages;
  type: AutomationRecipientOptionType;
  search?: string;
  id?: string;
  page?: number;
  perPage?: number;
};
export type AutomationRecipientOption = { id: string; label: string; description?: string };

export type AutomationSendEmailConfig = {
  /** Existing workflows without a selection use event-linked recipients. */
  recipients?: AutomationRecipientSelection;
  template?: AutomationTemplateReference | null;
  mappings?: AutomationPlaceholderMappings;
};

export type AutomationStepIdentity = {
  id: string;
  parentId: string | null;
  /** Zero-based sibling order, independent of array or database retrieval order. */
  position: number;
  /** Optional in editor drafts; when supplied must match the containing automation. */
  automationId?: string;
};

export type AutomationTriggerStep = AutomationStepIdentity & {
  type: typeof AUTOMATION_STEP_TYPES.TRIGGER;
  config: AutomationTriggerConfig;
};
export type AutomationSendEmailStep = AutomationStepIdentity & {
  type: typeof AUTOMATION_STEP_TYPES.SEND_EMAIL;
  config: AutomationSendEmailConfig;
};
export type AutomationConditionStep = AutomationStepIdentity & {
  type: typeof AUTOMATION_STEP_TYPES.CONDITION;
  config: AutomationConditionConfig;
};
export type AutomationStep =
  | AutomationTriggerStep
  | AutomationSendEmailStep
  | AutomationConditionStep;

/** Metadata only. Counts support occurrences containing multiple event items. */
export type AutomationStepTrace = {
  stepId: string;
  type: AutomationStep["type"];
  field?: string;
  matchedCount: number;
  skippedCount: number;
  failedCount: number;
  trueCount: number;
  falseCount: number;
};
export type AutomationWorkflow = { rootStepId: string | null; steps: AutomationStep[] };

export type AutomationPlaceholderDefinition = {
  name: string;
  label: string;
  type: AutomationPlaceholderType;
  required: boolean;
  sampleValue: AutomationPlaceholderValue;
  description?: string;
};

export type AutomationEventFieldDefinition = {
  availableWhen?: AutomationFieldAvailability;
  key: string;
  label: string;
  type: AutomationPlaceholderType;
  sampleValue: AutomationPlaceholderValue;
  description?: string;
  /** Sensitivity belongs to the source and survives placeholder renaming. */
  sensitivity?: "ordinary" | "account_action_link";
};
export type AutomationEventDefinition = {
  kind: AutomationEventKind;
  label: string;
  description: string;
  recipientPolicy: string;
  fields: AutomationEventFieldDefinition[];
  providedVariables: AutomationProvidedVariable[];
  accountAction?: "create_password" | "reset_password" | "sign_in";
};

export type AutomationDefinition = {
  name: string;
  description: string;
  workflow: AutomationWorkflow;
};
export type AutomationWorkflowTemplate = {
  key: BuiltInEmailTemplateKey;
  definition: AutomationDefinition;
};
export type AutomationDto = AutomationDefinition & {
  id: string;
  status: AutomationStatus;
  executionVersion: number;
  hasUnappliedChanges: boolean;
  appliedDefinition: AutomationDefinition | null;
  createdAt: string;
  updatedAt: string;
};
export type CreateAutomationInput = AutomationDefinition;
export type UpdateAutomationInput = Partial<AutomationDefinition>;
export type AutomationListQuery = {
  language?: SupportedLanguages;
  page?: number;
  perPage?: number;
  search?: string;
  status?: AutomationStatus;
};

export type AutomationWorkflowIssue = {
  code: AutomationValidationIssueCode;
  message: string;
  stepId?: string;
  placeholder?: string;
};
export type AutomationSimulationInput = {
  automationId?: string;
  workflow: AutomationWorkflow;
  sampleValues?: Record<string, AutomationPlaceholderValue>;
  language?: SupportedLanguages;
};
export type AutomationSimulationPreview = {
  stepId: string;
  sampleRecipient?: { email: string; name: string } | null;
  template: AutomationTemplateReference;
  subject: string;
  html: string;
  language: SupportedLanguages;
};
export type AutomationSimulationResult = {
  steps: AutomationStepTrace[];
  issues: AutomationWorkflowIssue[];
  recipientPolicy: string | null;
  sampleRecipient: { email: string; name: string } | null;
  previews: AutomationSimulationPreview[];
};

/** Metadata only: do not add event payloads, rendered messages, or credentials. */
export type AutomationRunSummary = {
  steps: AutomationStepTrace[];
  automationName: string;
  failureReasonCode: string | null;
  emailAddresses: string[];
  id: string;
  automationId: string;
  occurrenceId: string;
  eventKind: AutomationEventKind;
  status: AutomationRunStatus;
  createdAt: string;
  completedAt: string | null;
  succeededCount: number;
  failedCount: number;
  cancelledCount: number;
};
export type AutomationEmailDeliverySummary = {
  id: string;
  runId: string;
  stepId: string;
  recipientItemId: string;
  stepOrder: number;
  recipientEmail: string;
  template: AutomationTemplateReference;
  status: AutomationEmailDeliveryStatus;
  attemptCount: number;
  language: SupportedLanguages | null;
  createdAt: string;
  completedAt: string | null;
  reasonCode: string | null;
};
export type AutomationRunQuery = {
  search?: string;
  page?: number;
  perPage?: number;
  automationId?: string;
  status?: AutomationRunStatus;
};
