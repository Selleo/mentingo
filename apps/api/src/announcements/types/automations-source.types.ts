import type { AutomationStatus } from "./automations.types";

export type AutomationRecordInput = {
  name: string;
  description: string | null;
  status: AutomationStatus;
};
