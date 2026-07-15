import type { AutomationStatus } from "./automations.types";

export type CreateAutomationRecordInput = {
  name: string;
  description: string | null;
  status: AutomationStatus;
};
