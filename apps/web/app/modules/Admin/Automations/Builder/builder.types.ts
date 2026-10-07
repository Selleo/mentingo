import type { AutomationEventKind, AutomationStepType } from "@repo/shared";

/** Catalog-backed blocks carried by the builder's drag overlay and drop targets. */
export type BuilderBlock = {
  type: AutomationStepType;
  eventKind?: AutomationEventKind;
  label: string;
};
