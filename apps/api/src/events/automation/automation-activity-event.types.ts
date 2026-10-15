import type { ActivityLogActionType } from "@repo/shared";
import type { AutomationRecord } from "src/automations/automation.types";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type AutomationActivitySnapshot = Pick<
  AutomationRecord,
  | "name"
  | "description"
  | "status"
  | "executionVersion"
  | "draftDefinition"
  | "appliedDefinition"
  | "baseLanguage"
  | "availableLocales"
>;

export type AutomationActivityEventData = {
  actor: ActorUserType;
  operation: ActivityLogActionType;
  resourceId?: string;
  previous?: AutomationActivitySnapshot;
  resource?: AutomationActivitySnapshot;
  context?: Record<string, string>;
};
