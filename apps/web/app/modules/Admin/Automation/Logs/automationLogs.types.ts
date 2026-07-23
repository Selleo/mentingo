export type EmailStatus = "sent" | "skipped" | "failed";

export interface LogEmailEntry {
  recipientEmail: string;
  recipientName: string;
  status: EmailStatus;
  templateName: string | null;
  language: string | null;
  skipReason: string | null;
  failReason: string | null;
}

export interface AutomationLogEntry {
  id: string;
  automationName: string;
  automationId: string;
  ranAt: string;
  triggerEvent: string;
  duration: string;
  emails: LogEmailEntry[];
}

export type LogStatusFilter = "All" | "sent" | "skipped" | "failed";
