// ─── Simulation result types ─────────────────────────────────────────────────
// Shared between SimulationPanel, useSimulation, and useBuilderHeaderActions.

export interface ValidationError {
  nodeId: string;
  nodeName: string;
  field: string;
  description: string;
}

export interface EventDataField {
  key: string;
  label: string;
  dataType: "string" | "number" | "date" | "url";
}

export interface PlaceholderMappingEntry {
  placeholder: string;
  mappedVariable: string | null;
  sampleValue: string | null;
}

export interface EmailPreview {
  nodeId: string;
  nodeName: string;
  subject: string;
  senderAddress: string;
  htmlBody: string;
  recipientAddress: string;
}

export interface NodeValidationResult {
  nodeId: string;
  nodeName: string;
  kind: "trigger" | "action";
  status: "valid" | "invalid";
  errors: ValidationError[];
}

export interface SimulationResult {
  overallStatus: "success" | "failed";
  nodeResults: NodeValidationResult[];
  eventData: EventDataField[];
  placeholderMappings: Record<string, PlaceholderMappingEntry[]>;
  emailPreviews: EmailPreview[];
}

export type SimulationPanelState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; result: SimulationResult }
  | { type: "error"; message: string };
