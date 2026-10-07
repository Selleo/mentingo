import type { PublishedEmailTemplate } from "@repo/email-templates";
import type {
  AutomationSendEmailStep,
  AutomationStep,
  AutomationStepTrace,
  AutomationPlaceholderValue,
  AutomationRunStatus,
  AutomationEventKind,
  AutomationPlaceholderMappings,
  BuiltInEmailTemplateKey,
  SupportedLanguages,
} from "@repo/shared";
import type {
  AUTOMATION_EMAIL_DELIVERY_DIRECTIONS,
  NOTIFICATION_ACCOUNT_ACTION_KINDS,
} from "src/automation-execution/automation-execution.constants";
import type { UUIDType } from "src/common";
import type {
  automationEmailDeliveries,
  automationRuns,
  automations,
  emailTemplates,
  createTokens,
  magicLinkTokens,
  resetTokens,
  notificationAccountActionIntents,
} from "src/storage/schema";

export type AutomationEmailDeliveryRecord = typeof automationEmailDeliveries.$inferSelect;
export type AutomationRunRecord = typeof automationRuns.$inferSelect;
export type CreateAutomationEmailDelivery = typeof automationEmailDeliveries.$inferInsert;
export type CreateAutomationRun = typeof automationRuns.$inferInsert;

export type UpdateAutomationEmailDelivery = Partial<
  Pick<
    AutomationEmailDeliveryRecord,
    "status" | "attemptCount" | "claimedAt" | "completedAt" | "language" | "reasonCode"
  >
>;

export type AutomationEmailDeliveryDirection =
  (typeof AUTOMATION_EMAIL_DELIVERY_DIRECTIONS)[keyof typeof AUTOMATION_EMAIL_DELIVERY_DIRECTIONS];

export type AutomationEmailDeliveryJob = { tenantId: UUIDType; emailDeliveryId: UUIDType };
export type ClaimedAutomationEmailDelivery = {
  delivery: typeof automationEmailDeliveries.$inferSelect;
  run: typeof automationRuns.$inferSelect;
  step: AutomationSendEmailStep;
  publication: PublishedEmailTemplate;
};
export interface NotificationAccountActionPreparation {
  prepareNotificationAccountActionFields(
    reference: string,
  ): Promise<Record<string, AutomationPlaceholderValue> | null>;
  purgeUnusedNotificationAccountActionIntents(): Promise<void>;
}

export type InterruptedAutomationEmailDelivery = Pick<
  typeof automationEmailDeliveries.$inferSelect,
  "id" | "runId" | "attemptCount" | "status" | "template" | "templateVersion"
>;

export type PendingAutomationEmailDelivery = Pick<
  typeof automationEmailDeliveries.$inferSelect,
  "id" | "runId" | "stepId" | "recipientItemId" | "status" | "stepOrder"
>;

export type AutomationEmailDeliveriesByRecipient = Map<string, PendingAutomationEmailDelivery[]>;
export type AutomationDeliveriesByRun = Map<UUIDType, AutomationEmailDeliveriesByRecipient>;

export type AutomationRecoveryUpdate = Pick<
  typeof automationEmailDeliveries.$inferInsert,
  "status" | "reasonCode" | "completedAt"
>;

export type DefaultAutomationTranslations = Pick<
  typeof automations.$inferSelect,
  | "id"
  | "builtInKey"
  | "name"
  | "description"
  | "appliedName"
  | "appliedDescription"
  | "availableLocales"
>;

export type DefaultAutomationTranslationUpdate = Omit<
  DefaultAutomationTranslations,
  "id" | "builtInKey"
>;

export type PublishedDefaultCustomization = Pick<
  typeof emailTemplates.$inferSelect,
  "id" | "event" | "publication"
>;

export type AutomationEmailDeliveryOutcomeRecord = Pick<
  typeof automationEmailDeliveries.$inferSelect,
  "id" | "status" | "recipientItemId" | "reasonCode"
>;

export interface AutomationRunOutcome {
  status: AutomationRunStatus;
  succeededCount: number;
  failedCount: number;
  cancelledCount: number;
  failureReasonCode: string | null;
  completedAt: string | null;
}

export interface BuiltInAutomationDefinition {
  eventKind: AutomationEventKind;
  name: Record<SupportedLanguages, string>;
  description: Record<SupportedLanguages, string>;
  templateKey: BuiltInEmailTemplateKey;
  mappings: AutomationPlaceholderMappings;
  legacySettingKey?: string;
  legacyDescription?: string;
}

export type NotificationAccountActionKind =
  (typeof NOTIFICATION_ACCOUNT_ACTION_KINDS)[keyof typeof NOTIFICATION_ACCOUNT_ACTION_KINDS];

export type NotificationAccountActionIntentRecord =
  typeof notificationAccountActionIntents.$inferSelect;
export type AccountActionVerificationTable =
  | typeof createTokens
  | typeof resetTokens
  | typeof magicLinkTokens;
export type AccountActionVerificationInsert = {
  userId: UUIDType;
  tokenHash: string;
  expiryDate: Date;
  reminderCount?: number;
};
export type PreparedNotificationAccountActionIntent = Pick<
  typeof notificationAccountActionIntents.$inferInsert,
  "authTokenId" | "encryptedToken" | "tokenCreatedAt" | "tokenExpiresAt"
>;

export type NotificationAccountActionIntent = {
  userId: UUIDType;
  kind: NotificationAccountActionKind;
  applicationOrigin: string;
  tokenTtlMs: number;
  usesCalendarYearExpiry?: boolean;
  reminderCount?: number;
  revokePreviousPasswordSetupTokens?: boolean;
};
export type EncryptedAccountActionToken = {
  ciphertext: string;
  iv: string;
  tag: string;
  encryptedKey: string;
  keyIv: string;
  keyTag: string;
};

export interface NotificationRecipient {
  /** Stable occurrence key, not necessarily a UUID (e.g. email:index or selected:item:email:index). */
  itemId: string;
  email: string;
  name?: string;
  language: SupportedLanguages;
  eventFields: Record<string, AutomationPlaceholderValue>;
  accountActionIntentId?: UUIDType;
}

export interface NotificationEventItem {
  itemId: string;
  eventFields: Record<string, AutomationPlaceholderValue>;
}

export interface UserNotificationEventInput {
  kind: AutomationEventKind;
  user: { id: UUIDType; email: string; firstName: string; lastName: string };
  language: SupportedLanguages;
  eventFields?: Record<string, AutomationPlaceholderValue>;
  accountActionIntentId?: UUIDType;
  /** Stable occurrence keys allow scheduled notifications to be deduplicated. */
  occurrenceId?: string;
}

export type AutomationWorkflowEvaluationSummary = {
  steps: AutomationStepTrace[];
  conditionFailed: boolean;
};

export type AutomationRecipientEmailPlans = {
  conditionFailed: boolean;
  recipients: Map<
    string,
    {
      recipient: NotificationRecipient;
      steps: { step: AutomationStep; stepOrder: number; recipient: NotificationRecipient }[];
    }
  >;
};

export type AutomationRunPlan = AutomationRecipientEmailPlans & AutomationWorkflowEvaluationSummary;
