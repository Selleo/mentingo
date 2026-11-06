import type { HttpRunConfig } from "./evaluation.types";
import type { SemanticProviderConfig } from "./semantic-evaluator.types";
import type { TSchema } from "@sinclair/typebox";

export type FeatureTask = {
  kind: "prompt" | "app" | "embedding" | "assistant" | "audio" | "unsupported";
  promptFragments?: Array<{ promptId: string; role: "system" | "user" }>;
  variables?: Record<string, string | number>;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  responseSchemaId?: string;
  existingCaseId?: string;
  appVariant?: "proposal_only";
  instructionOverride?: string;
  requireSources?: boolean;
  language?: string;
  expectedTranscript?: string;
  texts?: string[];
  embeddingOracle?: { queryIndex: number; relevantIndex: number; irrelevantIndex: number };
  reason?: string;
};

export type FeatureItem = {
  id: string;
  input: {
    task: FeatureTask;
    scenario: string;
    sourceDocuments: Array<{ id: string; text: string }>;
  };
  expectedOutput: {
    rubric: string[];
    requiredFacts: string[];
    forbiddenFacts: string[];
    nativeEvidenceRequired: string[];
  };
  metadata: {
    featureId: string;
    caseId: string;
    synthetic: true;
    reviewStatus: "pending_domain_review";
    sourcePaths: string[];
    traceNames: string[];
    promptIds: string[];
    executionLevel: string;
  };
};

export type CoreAiFeature = {
  featureId: string;
  datasetName: string;
  traceNames: string[];
  functionIds: string[];
  promptIds: string[];
  sourcePaths: string[];
  executionLevel: string;
  limitations: string[];
  items: FeatureItem[];
};
export type FeatureCatalogue = { version: 1; project: "mentingo"; features: CoreAiFeature[] };
export type PromptSnapshot = {
  name: string;
  version: number;
  prompt: string;
  label: "production";
  config?: Record<string, unknown>;
};
export type PromptSnapshots = { prompts: PromptSnapshot[] };
export type PromptFragmentRecord = {
  name: string;
  version: number;
  origin: "managed_production_snapshot" | "local_source";
  production: boolean;
  sha256: string;
  role: "system" | "user";
};
export type FeatureModelRequest = {
  kind: "prompt" | "embedding";
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  schema?: TSchema;
  texts?: string[];
};
export type FeatureModel = (request: FeatureModelRequest) => Promise<unknown>;
export type FeatureTaskResult = {
  caseId: string;
  featureId: string;
  status: "prepared" | "needs_review" | "failed" | "not_run";
  executionLevel: string;
  output?: unknown;
  checks: Record<string, boolean>;
  promptFragments: PromptFragmentRecord[];
  reason?: string;
};
export type CapturedFeatureModelRequest = {
  request: {
    kind: FeatureModelRequest["kind"];
    messages: FeatureModelRequest["messages"];
    schema?: Record<string, unknown>;
    texts?: string[];
  };
  requestSha256: string;
  outcome: "returned" | "failed";
  outputSha256?: string;
};
/** The published fixture is separate from observations at the model/native adapter boundaries. */
export type CapturedFeatureTaskResult = FeatureTaskResult & {
  input: FeatureItem["input"];
  expectedOutput: FeatureItem["expectedOutput"];
  metadata: {
    caseId: string;
    featureId: string;
    scope: string;
    inputProvenance: "declared_published_fixture";
    declaredInputSha256: string;
    expectedOutputProvenance: "versioned_catalogue";
    effectiveModelRequests: CapturedFeatureModelRequest[];
    modelRequestCaptureBoundary: "FeatureModel_arguments";
    modelProvenance:
      | "explicit_cli_provider_configuration"
      | "model_call_observed_configuration_unavailable"
      | "native_runtime_not_observed"
      | "no_model_request_observed";
    effectiveProviderConfig?: Record<string, unknown>;
    nativeEvidenceProvenance:
      | "adapter_returned_checks_and_output"
      | "not_observed"
      | "not_applicable";
    rawHttpRequestsCaptured: false;
    rawProviderResponsesCaptured: false;
    synthetic: true;
    runnerFailureCategory?: string;
    runnerFailureStatus?: number;
  };
};
export type FeatureRunOptions = {
  run: boolean;
  allowModelRequests?: boolean;
  allowAppRequests?: boolean;
  promptSnapshots?: PromptSnapshots;
  appConfig?: HttpRunConfig;
  model?: FeatureModel;
};
export type FeatureProviderConfiguration = SemanticProviderConfig;
