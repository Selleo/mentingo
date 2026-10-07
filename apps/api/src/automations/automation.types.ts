import type {
  AutomationDefinition,
  AutomationPlaceholderValue,
  AutomationWorkflowIssue,
  AutomationEventKind,
  AutomationStatus,
  SupportedLanguages,
} from "@repo/shared";
import type { AUTOMATION_LIFECYCLE_OPERATIONS } from "src/automations/automation.constants";
import type { DatabasePg, UUIDType } from "src/common";
import type { automations } from "src/storage/schema";

export type AutomationLifecycleOperation =
  (typeof AUTOMATION_LIFECYCLE_OPERATIONS)[keyof typeof AUTOMATION_LIFECYCLE_OPERATIONS];

export interface AutomationRuntime {
  cancelPendingAutomationEmailDeliveries(
    db: DatabasePg,
    automationId: UUIDType,
    reasonCode: string,
  ): Promise<void>;
}

type AutomationRow = typeof automations.$inferSelect;

export type AutomationLocalizedMetadata = {
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
  name: Partial<Record<SupportedLanguages, string>>;
  description: Partial<Record<SupportedLanguages, string>>;
};

export type AutomationRecord = Omit<AutomationRow, "name" | "description"> & {
  name: string;
  description: string;
  hasLocalizedMetadataChanges: boolean;
  draftDefinition: AutomationDefinition;
  appliedDefinition: AutomationDefinition | null;
};

export type CreateAutomationRecord = {
  id?: UUIDType;
  tenantId?: UUIDType;
  name: string;
  description: string;
  draftDefinition: AutomationDefinition;
  appliedDefinition?: AutomationDefinition | null;
  status?: AutomationStatus;
  executionVersion?: number;
  builtInKey?: AutomationEventKind;
  localizedMetadata?: AutomationLocalizedMetadata;
};

export type UpdateAutomationRecord = Partial<
  Omit<CreateAutomationRecord, "id" | "tenantId" | "localizedMetadata">
>;

export type AutomationMetadataUpdate = Omit<
  UpdateAutomationRecord,
  "draftDefinition" | "appliedDefinition"
> & {
  draftRootStepId?: UUIDType | null;
  appliedRootStepId?: UUIDType | null;
  appliedName?: string | null;
  appliedDescription?: string | null;
  updatedAt: string;
};

export type LocalizedAutomationRow = Omit<AutomationRow, "name" | "description"> & {
  name: string;
  description: string;
  hasLocalizedMetadataChanges: boolean;
  localizedAppliedName: string | null;
  localizedAppliedDescription: string | null;
};

export type AutomationSimulationEventData = {
  fields: Record<string, AutomationPlaceholderValue>;
  issues: AutomationWorkflowIssue[];
};
