import { Type } from "node_modules/@sinclair/typebox/build/cjs/type";
import { createSelectSchema } from "node_modules/drizzle-typebox/index.cjs";

import { automationSteps } from "src/storage/schema";
import { omitTenantId } from "src/utils/omitTenantId";

import type { AutomationStatus, AutomationType } from "./automations.types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { LocalizedText } from "node_modules/@repo/shared/dist/index.cjs";
import type { Static } from "node_modules/@sinclair/typebox/build/cjs/type";
import type { UUIDType } from "src/common";
import type { automationLogs } from "src/storage/schema";

export type AutomationRecordInput = {
  tenantId: UUIDType;
  name: LocalizedText;
  description: LocalizedText;
  status: AutomationStatus;
};

export type AutomationRecordUpdateInput = Partial<AutomationRecordInput>;

export type AutomationStepRecordInput = {
  parentId: UUIDType | null;
  automationId: UUIDType;
  type: AutomationType;
  typeContext: TypeContext;
};
export type TypeContext = {
  name: string;
  providedVariables: Array<{
    key: string;
    value: unknown;
  }>;
};

export type SendEmailActionContext = TypeContext & {
  templateId: string;
  language?: string;
  variableMapping: Record<string, string>;
};

export type AutomationStepUpdateInput = {
  type: AutomationType;
  typeContext: TypeContext;
};

export type AutomationStepBulkUpdate = {
  id: UUIDType;
  parentId: UUIDType | null;
  automationId: UUIDType;
  type: AutomationType;
  typeContext: TypeContext;
};

export type AutomationActionStep = {
  typeContext: TypeContext;
};
export type AutomationLogRecord = InferSelectModel<typeof automationLogs>;
export type AutomationLogRecordInput = InferInsertModel<typeof automationLogs>;

export const AutomationStepSchema = Type.Omit(omitTenantId(createSelectSchema(automationSteps)), [
  "createdAt",
  "updatedAt",
]);

export type AutomationStep = Static<typeof AutomationStepSchema>;
