import {
  type AutomationDefinition,
  type AutomationWorkflowTemplate,
  type AutomationWorkflow,
  type AutomationPlaceholderValue,
  ACCOUNT_ACTION_KINDS,
  AUTOMATION_VALIDATION_ISSUE_CODES,
  SUPPORTED_LANGUAGES,
  AUTOMATION_RECIPIENT_TYPES,
  AUTOMATION_MAPPING_TYPES,
  AUTOMATION_STEP_TYPES,
  AUTOMATION_TEMPLATE_TYPES,
  AUTOMATION_STATUSES,
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_PLACEHOLDER_TYPES,
  AUTOMATION_RUN_STATUSES,
  AUTOMATION_EMAIL_DELIVERY_STATUSES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
} from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema, paginatedResponse } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

export const automationLanguageQuerySchema = Type.Optional(supportedLanguagesSchema);

const closed = { additionalProperties: false };

export const automationValueSchema = Type.Union([
  Type.String(),
  Type.Number(),
  Type.Boolean(),
  Type.Null(),
  Type.Array(Type.Unknown()),
  Type.Record(Type.String(), Type.Unknown()),
]);

export const automationPlaceholderValueSchemas = {
  [AUTOMATION_PLACEHOLDER_TYPES.STRING]: Type.String(),
  [AUTOMATION_PLACEHOLDER_TYPES.NUMBER]: Type.Number(),
  [AUTOMATION_PLACEHOLDER_TYPES.BOOLEAN]: Type.Boolean(),
  [AUTOMATION_PLACEHOLDER_TYPES.URL]: Type.String(),
  [AUTOMATION_PLACEHOLDER_TYPES.COLLECTION]: Type.Array(Type.Unknown()),
  [AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING]: Type.Union([
    Type.String(),
    Type.Record(
      Type.String({ pattern: `^(${Object.values(SUPPORTED_LANGUAGES).join("|")})$` }),
      Type.String(),
      { minProperties: 1, additionalProperties: false },
    ),
  ]),
};

export const automationTemplateReferenceSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal(AUTOMATION_TEMPLATE_TYPES.BUILTIN),
      key: Type.Enum(BUILT_IN_EMAIL_TEMPLATE_KEYS),
    },
    closed,
  ),
  Type.Object({ type: Type.Literal(AUTOMATION_TEMPLATE_TYPES.CUSTOM), id: UUIDSchema }, closed),
]);

export const automationMappingSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal(AUTOMATION_MAPPING_TYPES.EVENT_FIELD),
      field: Type.String({ minLength: 1 }),
    },
    closed,
  ),
  Type.Object(
    { type: Type.Literal(AUTOMATION_MAPPING_TYPES.STATIC), value: automationValueSchema },
    closed,
  ),
]);

export const automationRecipientSelectionSchema = Type.Union([
  Type.Object({ type: Type.Literal(AUTOMATION_RECIPIENT_TYPES.EVENT) }, closed),
  Type.Object({ type: Type.Literal(AUTOMATION_RECIPIENT_TYPES.EVERYONE) }, closed),
  Type.Object({ type: Type.Literal(AUTOMATION_RECIPIENT_TYPES.USER), userId: UUIDSchema }, closed),
  Type.Object(
    { type: Type.Literal(AUTOMATION_RECIPIENT_TYPES.GROUP), groupId: UUIDSchema },
    closed,
  ),
  Type.Object({ type: Type.Literal(AUTOMATION_RECIPIENT_TYPES.ROLE), roleId: UUIDSchema }, closed),
]);
export const automationRecipientOptionTypeSchema = Type.Union([
  Type.Literal(AUTOMATION_RECIPIENT_TYPES.USER),
  Type.Literal(AUTOMATION_RECIPIENT_TYPES.GROUP),
  Type.Literal(AUTOMATION_RECIPIENT_TYPES.ROLE),
]);
export const automationRecipientOptionSchema = Type.Object(
  { id: UUIDSchema, label: Type.String(), description: Type.Optional(Type.String()) },
  closed,
);
export const paginatedAutomationRecipientOptionSchema = paginatedResponse(
  Type.Array(automationRecipientOptionSchema),
);
export type AutomationRecipientOptionResponse = Static<typeof automationRecipientOptionSchema>;

const identity = {
  id: UUIDSchema,
  parentId: Type.Union([UUIDSchema, Type.Null()]),
  position: Type.Integer({ minimum: 0 }),
  automationId: Type.Optional(UUIDSchema),
};

export const automationWorkflowSchema = Type.Object(
  {
    rootStepId: Type.Union([UUIDSchema, Type.Null()]),
    steps: Type.Array(
      Type.Union([
        Type.Object(
          {
            ...identity,
            type: Type.Literal(AUTOMATION_STEP_TYPES.CONDITION),
            config: Type.Object(
              { field: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })) },
              closed,
            ),
          },
          closed,
        ),
        Type.Object(
          {
            ...identity,
            type: Type.Literal(AUTOMATION_STEP_TYPES.TRIGGER),
            config: Type.Object(
              {
                eventKind: Type.Optional(
                  Type.Union([Type.Enum(AUTOMATION_EVENT_KINDS), Type.Null()]),
                ),
              },
              closed,
            ),
          },
          closed,
        ),
        Type.Object(
          {
            ...identity,
            type: Type.Literal(AUTOMATION_STEP_TYPES.SEND_EMAIL),
            config: Type.Object(
              {
                template: Type.Optional(
                  Type.Union([automationTemplateReferenceSchema, Type.Null()]),
                ),
                mappings: Type.Optional(Type.Record(Type.String(), automationMappingSchema)),
                recipients: Type.Optional(automationRecipientSelectionSchema),
              },
              closed,
            ),
          },
          closed,
        ),
      ]),
      { maxItems: 100 },
    ),
  },
  closed,
);

export const automationDefinitionSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.String({ maxLength: 5000 }),
    workflow: automationWorkflowSchema,
  },
  closed,
);

export const createAutomationSchema = automationDefinitionSchema;

export const automationWorkflowTemplateSchema = Type.Object(
  {
    key: Type.Enum(BUILT_IN_EMAIL_TEMPLATE_KEYS),
    definition: automationDefinitionSchema,
  },
  closed,
);

export const updateAutomationSchema = Type.Partial(automationDefinitionSchema, {
  minProperties: 1,
});

export const automationSchema = Type.Object(
  {
    ...automationDefinitionSchema.properties,
    id: UUIDSchema,
    status: Type.Enum(AUTOMATION_STATUSES),
    executionVersion: Type.Integer(),
    hasUnappliedChanges: Type.Boolean(),
    appliedDefinition: Type.Union([automationDefinitionSchema, Type.Null()]),
    createdAt: Type.String(),
    updatedAt: Type.String(),
  },
  closed,
);

export const deleteAutomationSchema = Type.Object({ id: UUIDSchema }, closed);

export type DeleteAutomationResponse = Static<typeof deleteAutomationSchema>;

export const paginatedAutomationSchema = paginatedResponse(Type.Array(automationSchema));

export const automationIssueSchema = Type.Object(
  {
    code: Type.Enum(AUTOMATION_VALIDATION_ISSUE_CODES),
    message: Type.String(),
    stepId: Type.Optional(Type.String()),
    placeholder: Type.Optional(Type.String()),
  },
  closed,
);

export const simulateAutomationSchema = Type.Object(
  {
    workflow: automationWorkflowSchema,
    sampleValues: Type.Optional(Type.Record(Type.String(), automationValueSchema)),
    language: Type.Optional(supportedLanguagesSchema),
  },
  closed,
);

export const automationStepTraceSchema = Type.Object(
  {
    stepId: Type.String(),
    type: Type.Enum(AUTOMATION_STEP_TYPES),
    field: Type.Optional(Type.String()),
    matchedCount: Type.Integer({ minimum: 0 }),
    skippedCount: Type.Integer({ minimum: 0 }),
    failedCount: Type.Integer({ minimum: 0 }),
    trueCount: Type.Integer({ minimum: 0 }),
    falseCount: Type.Integer({ minimum: 0 }),
  },
  closed,
);

export const automationSimulationSchema = Type.Object(
  {
    issues: Type.Array(automationIssueSchema),
    steps: Type.Array(automationStepTraceSchema),
    recipientPolicy: Type.Union([Type.String(), Type.Null()]),
    sampleRecipient: Type.Union([
      Type.Object({ email: Type.String(), name: Type.String() }, closed),
      Type.Null(),
    ]),
    previews: Type.Array(
      Type.Object(
        {
          stepId: Type.String(),
          sampleRecipient: Type.Optional(
            Type.Union([
              Type.Object({ email: Type.String(), name: Type.String() }, closed),
              Type.Null(),
            ]),
          ),
          template: automationTemplateReferenceSchema,
          subject: Type.String(),
          html: Type.String(),
          language: supportedLanguagesSchema,
        },
        closed,
      ),
    ),
  },
  closed,
);

export const automationPlaceholderSchema = Type.Object(
  {
    name: Type.String(),
    label: Type.String(),
    type: Type.Enum(AUTOMATION_PLACEHOLDER_TYPES),
    required: Type.Boolean(),
    sampleValue: automationValueSchema,
    description: Type.Optional(Type.String()),
  },
  closed,
);

export const automationTemplateSchema = Type.Object(
  {
    reference: automationTemplateReferenceSchema,
    name: Type.String(),
    baseLanguage: supportedLanguagesSchema,
    placeholders: Type.Array(automationPlaceholderSchema),
  },
  closed,
);

const fieldAvailabilitySchema = Type.Optional(
  Type.Object({ field: Type.String(), equals: Type.Boolean() }, closed),
);

export const automationEventSchema = Type.Object(
  {
    kind: Type.Enum(AUTOMATION_EVENT_KINDS),
    label: Type.String(),
    description: Type.String(),
    recipientPolicy: Type.String(),
    fields: Type.Array(
      Type.Object(
        {
          availableWhen: fieldAvailabilitySchema,
          key: Type.String(),
          label: Type.String(),
          type: Type.Enum(AUTOMATION_PLACEHOLDER_TYPES),
          sampleValue: automationValueSchema,
          description: Type.Optional(Type.String()),
          sensitivity: Type.Optional(
            Type.Union([Type.Literal("ordinary"), Type.Literal("account_action_link")]),
          ),
        },
        closed,
      ),
    ),
    providedVariables: Type.Array(
      Type.Object(
        {
          availableWhen: fieldAvailabilitySchema,
          key: Type.String(),
          label: Type.String(),
          labelKey: Type.Optional(Type.String()),
          dataType: Type.Enum(AUTOMATION_PLACEHOLDER_TYPES),
          sampleValue: automationValueSchema,
          sourceKey: Type.Optional(Type.String()),
          sensitivity: Type.Optional(
            Type.Union([Type.Literal("ordinary"), Type.Literal("account_action_link")]),
          ),
        },
        closed,
      ),
    ),
    accountAction: Type.Optional(
      Type.Union([
        Type.Literal(ACCOUNT_ACTION_KINDS.CREATE_PASSWORD),
        Type.Literal(ACCOUNT_ACTION_KINDS.RESET_PASSWORD),
        Type.Literal(ACCOUNT_ACTION_KINDS.SIGN_IN),
      ]),
    ),
  },
  closed,
);

export const automationRunSchema = Type.Object(
  {
    id: UUIDSchema,
    automationId: UUIDSchema,
    automationName: Type.String(),
    steps: Type.Array(automationStepTraceSchema),
    failureReasonCode: Type.Union([Type.String(), Type.Null()]),
    emailAddresses: Type.Array(Type.String()),
    occurrenceId: Type.String(),
    eventKind: Type.Enum(AUTOMATION_EVENT_KINDS),
    status: Type.Enum(AUTOMATION_RUN_STATUSES),
    createdAt: Type.String(),
    completedAt: Type.Union([Type.String(), Type.Null()]),
    succeededCount: Type.Integer(),
    failedCount: Type.Integer(),
    cancelledCount: Type.Integer(),
  },
  closed,
);

export const automationEmailDeliverySchema = Type.Object(
  {
    id: UUIDSchema,
    runId: UUIDSchema,
    stepId: Type.String(),
    stepOrder: Type.Integer({ minimum: 0 }),
    recipientItemId: Type.String(),
    recipientEmail: Type.String(),
    template: automationTemplateReferenceSchema,
    status: Type.Enum(AUTOMATION_EMAIL_DELIVERY_STATUSES),
    attemptCount: Type.Integer(),
    language: Type.Union([supportedLanguagesSchema, Type.Null()]),
    createdAt: Type.String(),
    completedAt: Type.Union([Type.String(), Type.Null()]),
    reasonCode: Type.Union([Type.String(), Type.Null()]),
  },
  closed,
);

export const automationRunDetailSchema = Type.Object(
  { run: automationRunSchema, deliveries: Type.Array(automationEmailDeliverySchema) },
  closed,
);

export const paginatedAutomationRunSchema = paginatedResponse(Type.Array(automationRunSchema));

export type AutomationResponse = Omit<
  Static<typeof automationSchema>,
  "workflow" | "appliedDefinition"
> &
  AutomationDefinition & { appliedDefinition: AutomationDefinition | null };

export type CreateAutomationBody = AutomationDefinition;

export type UpdateAutomationBody = Partial<AutomationDefinition>;

export type SimulateAutomationBody = Omit<
  Static<typeof simulateAutomationSchema>,
  "workflow" | "sampleValues"
> & { workflow: AutomationWorkflow; sampleValues?: Record<string, AutomationPlaceholderValue> };

export type AutomationSimulationResponse = Static<typeof automationSimulationSchema>;

export type AutomationTemplateResponse = Static<typeof automationTemplateSchema>;

export type AutomationWorkflowTemplateResponse = AutomationWorkflowTemplate;

export type AutomationRunDetailResponse = Static<typeof automationRunDetailSchema>;
