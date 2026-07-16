/**
 * Automation data layer types.
 *
 * These define the shape of data expected from and sent to the backend.
 * Once the API is built, these types will be superseded by the generated-api types.
 * Until then, they serve as the contract between frontend and (future) backend.
 *
 * ─── DESIGN DECISIONS ──────────────────────────────────────────────────────────
 *
 * 1. The automation "flow" is stored as a flat adjacency list of nodes.
 *    Each node has a `parentId` and `children[]` for tree reconstruction.
 *    This makes serialization/deserialization trivial and allows the backend
 *    to store it in a single JSON column or a normalized `automation_nodes` table.
 *
 * 2. Node `config` is an open Record<string, unknown> on the frontend.
 *    The backend can validate it per node `type` using a discriminated union
 *    or JSON Schema at persistence time.
 *
 * 3. Status follows a state machine: Draft → Active → Disabled → Archived.
 *    The frontend toggle in the builder only switches between Draft ↔ Active.
 *
 * 4. `lastRun` is read-only; populated by the backend scheduler/executor.
 *
 * ─── NAMING CONVENTION ─────────────────────────────────────────────────────────
 *
 * - `*Response` types represent raw API response wrappers (BaseResponse shape).
 * - `*Body` types represent payloads sent via POST/PUT/PATCH.
 * - Domain types (AutomationListItem, AutomationDetail, AutomationNode) are
 *   the extracted `.data` from responses.
 */

// ─── Domain types ───────────────────────────────────────────────────────────────

export type AutomationStatus = "Draft" | "Active" | "Disabled" | "Archived";

export type AutomationNodeKind = "condition" | "action";

export type AutomationConditionType =
  | "course_deadline"
  | "overdue"
  | "not_completed"
  | "user_enrolled"
  | "certificate_expiring_soon"
  | "live_transmission_starting_soon";

export type AutomationActionType = "send_email";

export type AutomationNodeType = AutomationConditionType | AutomationActionType;

export interface AutomationNode {
  /** UUID assigned by the backend. New (unsaved) nodes use a client-generated temp id. */
  id: string;
  kind: AutomationNodeKind;
  type: AutomationNodeType;
  label: string;
  parentId: string | null;
  children: string[];
  /** Type-specific configuration (validated per `type` on the backend). */
  config: Record<string, unknown>;
  /** Display position on canvas (stored for UX persistence). */
  position: { x: number; y: number };
}

export interface AutomationLastRun {
  date: string | null;
  status: "success" | "failed" | "never";
}

/** Lightweight item for the list view. Does NOT contain nodes. */
export interface AutomationListItem {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  trigger: string;
  actionsCount: number;
  lastRun: AutomationLastRun;
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
  data: AutomationListItem[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
  };
}

export interface GetAutomationByIdResponse {
  data: AutomationDetail;
}

// ─── Mutation payloads (request bodies) ────────────────────────────────────────

export interface CreateAutomationBody {
  name: string;
  description?: string;
}

export interface UpdateAutomationBody {
  name?: string;
  description?: string;
  status?: AutomationStatus;
  /** Full node tree — sent on every save from the builder. */
  nodes?: AutomationNode[];
}

export interface DeleteAutomationBody {
  /** Optional soft-delete flag; defaults to hard delete. */
  archive?: boolean;
}
