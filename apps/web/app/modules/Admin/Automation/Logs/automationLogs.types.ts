export type AutomationLogStatus = "success" | "failed" | "skipped";

export interface AutomationLogRecord {
  id: string;
  automationId: string;
  automationName: string;
  eventName: string;
  errorName: string | null;
  status: AutomationLogStatus;
  emailAddresses: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLogEntry {
  id: string;
  automationName: string;
  automationId: string;
  ranAt: string;
  triggerEvent: string;
  status: AutomationLogStatus;
  errorName: string | null;
  emailAddresses: string[];
}

export type LogStatusFilter = "All" | AutomationLogStatus;
