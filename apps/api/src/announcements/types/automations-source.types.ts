import type { AutomationStatus } from "./automations.types";
import type { LocalizedText } from "node_modules/@repo/shared/dist/index.cjs";

export type AutomationRecordInput = {
  name: LocalizedText;
  description: LocalizedText;
  status: AutomationStatus;
};
