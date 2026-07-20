import { Type } from "node_modules/@sinclair/typebox/build/cjs/type";
import { createSelectSchema } from "node_modules/drizzle-typebox/index.cjs";

import { automationSteps } from "src/storage/schema";
import { omitTenantId } from "src/utils/omitTenantId";

import type { AutomationStatus, AutomationType } from "./automations.types";
import type { LocalizedText } from "node_modules/@repo/shared/dist/index.cjs";
import type { Static } from "node_modules/@sinclair/typebox/build/cjs/type";
import type { UUIDType } from "src/common";

export type AutomationRecordInput = {
  name: LocalizedText;
  description: LocalizedText;
  status: AutomationStatus;
};

export type AutomationStepRecordInput = {
  parentId: UUIDType;
  automationId: UUIDType;
  type: AutomationType;
  typeContext: JSON;
};

export type AutomationStepUpdateInput = {
  type: AutomationType;
  typeContext: JSON;
};

export const AutomationStepSchema = Type.Omit(omitTenantId(createSelectSchema(automationSteps)), [
  "createdAt",
  "updatedAt",
]);

export type AutomationStep = Static<typeof AutomationStepSchema>;
