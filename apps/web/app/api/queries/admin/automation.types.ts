/**
 * Automation data layer types.
 *
 * These define the shape of data expected from and sent to the backend.
 * Aligned with backend enums and table structures.
 */

// ─── Domain types ───────────────────────────────────────────────────────────────

/** Matches backend AutomationStatus enum (lowercase) */
export type AutomationStatus = "draft" | "enabled" | "disabled" | "archived";

/** Matches backend AutomationType: "trigger" | "action" | "condition" */
export type AutomationNodeKind = "trigger" | "action" | "condition";

/**
 * Backend automation_steps row shape (from getAllAutomationSteps).
 * `typeContext` holds kind, label, config, position and step-specific name.
 */
export interface AutomationStepRaw {
  id: string;
  automationId: string;
  parentId: string | null;
  type: AutomationNodeKind;
  typeContext: {
    name: string;
    label?: string;
    config?: Record<string, unknown>;
    position?: { x: number; y: number };
    [key: string]: unknown;
  };
  createdAt?: string;
  updatedAt?: string;
}

/** Frontend node representation (derived from AutomationStepRaw) */
export interface AutomationNode {
  id: string;
  kind: AutomationNodeKind;
  type: string;
  label: string;
  parentId: string | null;
  children: string[];
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface AutomationLastRun {
  date: string | null;
  status: "success" | "failed" | "never";
}

/** Raw automation record from backend (LocalizedText fields) */
export interface AutomationRecord {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  status: AutomationStatus;
  lastRun: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight item for the list view. */
export interface AutomationListItem {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  lastRun: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full detail including the flow tree. Used in the builder page. */
export interface AutomationDetail {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  nodes: AutomationNode[];
  createdAt: string;
  updatedAt: string;
}

// ─── API response wrappers (matches BaseResponse from apps/api) ────────────────

export interface GetAllAutomationsResponse {
  data: AutomationRecord[];
}

export interface GetAutomationByIdResponse {
  data: AutomationRecord;
}

export interface GetAutomationStepsResponse {
  data: AutomationStepRaw[];
}

// ─── Mutation payloads (request bodies) ────────────────────────────────────────

export interface CreateAutomationBody {
  name: Record<string, string>;
  description?: Record<string, string>;
  status: AutomationStatus;
}

export interface UpdateAutomationBody {
  name?: Record<string, string>;
  description?: Record<string, string>;
  status?: AutomationStatus;
}

/** Step payload for bulk replace (PUT /automation-steps/:automationId/steps) */
export interface AutomationStepBulkItem {
  id: string;
  parentId: string | null;
  automationId: string;
  type: AutomationNodeKind;
  typeContext: {
    name: string;
    label?: string;
    config?: Record<string, unknown>;
    position?: { x: number; y: number };
    [key: string]: unknown;
  };
}
