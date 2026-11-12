export type SemanticStatus = "pass" | "fail" | "insufficient_evidence";
export type EvidenceKind = "input" | "source" | "candidate" | "workflow";
export type EvidenceRecord = { id: string; kind: EvidenceKind; text: string };
export type EvidenceReference = { recordId: string; quote: string };
export type SemanticDimension = { id: string; instruction: string };
export type SemanticVerdict = {
  dimensionId: string;
  status: SemanticStatus;
  reason: string;
  evidence: EvidenceReference[];
};

export type SemanticCase = {
  caseId: string;
  scenario: string;
  sourceDocuments: Array<{ id: string; text: string }>;
  roleInstructions: string;
  dimensions: SemanticDimension[];
  history: Array<{ pullRequest: string; commit: string; originalFailure: string }>;
  calibrationCandidates: Array<{
    id: string;
    candidate: string;
    expected: Record<string, SemanticStatus>;
    rationale: string;
  }>;
};

export type SemanticRegistry = {
  version: 1;
  reviewStatus: "developer_authored_not_human_gold";
  cases: SemanticCase[];
};
export type SemanticProvider = (request: { system: string; prompt: string }) => Promise<string>;
export type SemanticEvaluation = {
  evaluatorVersion: string;
  promptSha256: string;
  evidenceSha256: string;
  calibration: "uncalibrated";
  evaluatorStatus: "valid" | "invalid_output" | "provider_error" | "missing_evidence";
  verdict: SemanticStatus;
  dimensions: SemanticVerdict[];
};

/** Only explicitly named environment variables supply credentials; no .env discovery. */
export type SemanticProviderConfig = {
  model: string;
  apiKeyEnv: string;
  baseURL?: string;
  timeoutMs?: number;
};
