export type {
  TriggerType,
  ActionType,
  NodeKind,
  PayloadVariable,
  AutomationStepDefinition,
} from "@repo/shared";

export {
  AUTOMATION_TRIGGER_TYPES,
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_NODE_KINDS,
  AUTOMATION_STATUSES,
  STEP_DEFINITIONS,
  TRIGGER_DEFINITIONS,
  ACTION_DEFINITIONS,
  getStepDefinition,
} from "@repo/shared";

import { ACTION_DEFINITIONS, TRIGGER_DEFINITIONS } from "@repo/shared";

import type { ActionType, NodeKind, TriggerType } from "@repo/shared";

export interface StepConfigField {
  key: string;
  labelKey: string;
  type: "text" | "number" | "select" | "multiselect" | "textarea" | "emailTemplateSelect";
  placeholderKey?: string;
  options?: { value: string; labelKey: string; label?: string; imageUrl?: string }[];
  dataSource?: "courses" | "users" | "announcements";
}

export interface SidebarBlock {
  kind: NodeKind;
  type: TriggerType | ActionType;
  labelKey: string;
  icon: string;
}

export const TRIGGER_BLOCKS: SidebarBlock[] = TRIGGER_DEFINITIONS.map((d) => ({
  kind: d.kind,
  type: d.type,
  labelKey: d.labelKey,
  icon: d.icon,
}));

export const ACTION_BLOCKS: SidebarBlock[] = ACTION_DEFINITIONS.map((d) => ({
  kind: d.kind,
  type: d.type,
  labelKey: d.labelKey,
  icon: d.icon,
}));

export interface BuilderNode {
  id: string;
  kind: NodeKind;
  type: TriggerType | ActionType;
  label: string;
  parentId: string | null;
  children: string[];
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface BuilderState {
  nodes: BuilderNode[];
  selectedNodeId: string | null;
  automationName: string;
  isActive: boolean;
  simulationPassed: boolean;
  lastSavedAt: string | null;
  isDirty: boolean;
}
