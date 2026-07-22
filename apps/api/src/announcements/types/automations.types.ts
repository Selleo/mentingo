export enum AutomationStatus {
  Enabled = "enabled",
  Disabled = "disabled",
  Archived = "archived",
  Draft = "draft",
}

export const automationTypes = ["action", "condition", "trigger"] as const;

export type AutomationType = (typeof automationTypes)[number];
