import type { AutomationStatus } from "./automations.types";
import type { LocalizedText } from "node_modules/@repo/shared/dist/index.cjs";
import type { UUIDType } from "src/common";

export type AutomationRecordInput = {
  name: LocalizedText;
  description: LocalizedText;
  triggerId: UUIDType;
  status: AutomationStatus;
};
