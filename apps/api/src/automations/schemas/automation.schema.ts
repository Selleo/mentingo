import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_NODE_KINDS,
  AUTOMATION_TRIGGER_TYPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { automationTypes, AutomationStatus } from "src/announcements/types/automations.types";
import { baseResponse, UUIDSchema } from "src/common";


const localizedTextSchema = Type.Partial(
  Type.Record(Type.Enum(SUPPORTED_LANGUAGES), Type.String()),
);

const providedVariableSchema = Type.Object({
  key: Type.String({ minLength: 1 }),
  value: Type.Unknown(),
});

export const automationTypeSchema = Type.Union([
  Type.Literal(automationTypes[0]),
  Type.Literal(automationTypes[1]),
  Type.Literal(automationTypes[2]),
]);

export const automationTypeContextSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    providedVariables: Type.Array(providedVariableSchema),
  },
  { additionalProperties: true },
);

export const automationRecordSchema = Type.Object({
  id: UUIDSchema,
  createdAt: Type.String(),
  updatedAt: Type.String(),
  name: localizedTextSchema,
  description: Type.Union([localizedTextSchema, Type.Null()]),
  status: Type.Enum(AutomationStatus),
  lastRun: Type.Union([Type.String(), Type.Null()]),
});

export const automationCreateSchema = Type.Object({
  name: localizedTextSchema,
  description: Type.Optional(localizedTextSchema),
  status: Type.Enum(AutomationStatus),
});

export const automationUpdateSchema = Type.Partial(
  Type.Object({
    name: localizedTextSchema,
    description: localizedTextSchema,
    status: Type.Enum(AutomationStatus),
  }),
);

export const automationStatusSchema = Type.Object({
  status: Type.Enum(AutomationStatus),
});

export const automationStepSchema = Type.Object({
  id: UUIDSchema,
  createdAt: Type.String(),
  updatedAt: Type.String(),
  automationId: UUIDSchema,
  parentId: Type.Union([UUIDSchema, Type.Null()]),
  type: automationTypeSchema,
  typeContext: automationTypeContextSchema,
});

export const automationStepInputSchema = Type.Object({
  parentId: Type.Union([UUIDSchema, Type.Null()]),
  automationId: UUIDSchema,
  type: automationTypeSchema,
  typeContext: automationTypeContextSchema,
});

export const automationStepBulkUpdateSchema = Type.Object({
  id: UUIDSchema,
  parentId: Type.Union([UUIDSchema, Type.Null()]),
  automationId: UUIDSchema,
  type: automationTypeSchema,
  typeContext: automationTypeContextSchema,
});

export const automationStepTreeSchema = Type.Array(automationStepBulkUpdateSchema);

export const automationSaveSchema = Type.Object({
  metadata: automationUpdateSchema,
  steps: automationStepTreeSchema,
});

export const automationIdResponseSchema = baseResponse(Type.Object({ id: UUIDSchema }));

export const automationSaveResponseSchema = baseResponse(
  Type.Object({
    id: UUIDSchema,
    stepCount: Type.Number(),
  }),
);

export const simulationNodeSchema = Type.Object({
  id: UUIDSchema,
  kind: Type.Union(AUTOMATION_NODE_KINDS.map((kind) => Type.Literal(kind))),
  type: Type.Union([
    ...AUTOMATION_TRIGGER_TYPES.map((type) => Type.Literal(type)),
    ...AUTOMATION_ACTION_TYPES.map((type) => Type.Literal(type)),
  ]),
  label: Type.String(),
  parentId: Type.Union([UUIDSchema, Type.Null()]),
  children: Type.Array(UUIDSchema),
  config: Type.Record(Type.String(), Type.Unknown()),
});

export const runSimulationSchema = Type.Object({
  nodes: Type.Array(simulationNodeSchema),
  language: Type.Enum(SUPPORTED_LANGUAGES),
});

const simulationValidationErrorSchema = Type.Object({
  nodeId: Type.String(),
  nodeName: Type.String(),
  field: Type.String(),
  description: Type.String(),
});

export const simulationResultSchema = Type.Object({
  overallStatus: Type.Union([Type.Literal("success"), Type.Literal("failed")]),
  nodeResults: Type.Array(
    Type.Object({
      nodeId: Type.String(),
      nodeName: Type.String(),
      kind: Type.Union([Type.Literal("trigger"), Type.Literal("action")]),
      status: Type.Union([Type.Literal("valid"), Type.Literal("invalid")]),
      errors: Type.Array(simulationValidationErrorSchema),
    }),
  ),
  eventData: Type.Array(
    Type.Object({
      key: Type.String(),
      label: Type.String(),
      dataType: Type.Union([
        Type.Literal("string"),
        Type.Literal("number"),
        Type.Literal("date"),
        Type.Literal("url"),
      ]),
    }),
  ),
  placeholderMappings: Type.Object(
    {},
    {
      additionalProperties: Type.Array(
        Type.Object({
          placeholder: Type.String(),
          mappedVariable: Type.Union([Type.String(), Type.Null()]),
          sampleValue: Type.Union([Type.String(), Type.Null()]),
        }),
      ),
    },
  ),
  emailPreviews: Type.Array(
    Type.Object({
      nodeId: Type.String(),
      nodeName: Type.String(),
      subject: Type.String(),
      senderAddress: Type.String(),
      htmlBody: Type.String(),
      recipientAddress: Type.String(),
    }),
  ),
});

export type AutomationCreateBody = Static<typeof automationCreateSchema>;
export type AutomationUpdateBody = Static<typeof automationUpdateSchema>;
export type AutomationStatusBody = Static<typeof automationStatusSchema>;
export type AutomationStepInputBody = Static<typeof automationStepInputSchema>;
export type AutomationStepBulkUpdateBody = Static<typeof automationStepBulkUpdateSchema>;
export type AutomationSaveBody = Static<typeof automationSaveSchema>;
