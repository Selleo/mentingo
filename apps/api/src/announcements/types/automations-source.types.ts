import type { AutomationStatus, AutomationType } from "./automations.types";
import type { LocalizedText } from "node_modules/@repo/shared/dist/index.cjs";
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
