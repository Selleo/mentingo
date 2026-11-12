import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { createFeatureProvider } from "./feature-provider";
import { normalizePromptSnapshots, runFeatureTask, validateFeatureCatalogue } from "./feature-task";
import { sha256 } from "./semantic-evaluator";

import type { HttpRunConfig } from "./evaluation.types";
import type {
  CapturedFeatureModelRequest,
  CapturedFeatureTaskResult,
  CoreAiFeature,
  FeatureCatalogue,
  FeatureItem,
  FeatureProviderConfiguration,
  FeatureRunOptions,
  FeatureTaskResult,
} from "./feature-catalogue.types";

/** Capture exact model arguments without mistaking the declared dataset fixture for a raw request. */
export async function captureFeatureTask(
  feature: CoreAiFeature,
  item: FeatureItem,
  options: FeatureRunOptions,
  providerMetadata?: Record<string, unknown>,
): Promise<CapturedFeatureTaskResult> {
  const input = JSON.parse(JSON.stringify(item.input)) as FeatureItem["input"];
  const expectedOutput = JSON.parse(
    JSON.stringify(item.expectedOutput),
  ) as FeatureItem["expectedOutput"];
  const effectiveModelRequests: CapturedFeatureModelRequest[] = [];
  const model = options.model;
  const capturedModel: FeatureRunOptions["model"] = model
    ? async (request) => {
        const captured: CapturedFeatureModelRequest = {
          request: {
            kind: request.kind,
            messages: request.messages.map(({ role, content }) => ({ role, content })),
            ...(request.schema
              ? { schema: JSON.parse(JSON.stringify(request.schema)) as Record<string, unknown> }
              : {}),
            ...(request.structuredOutputMode
              ? { structuredOutputMode: request.structuredOutputMode }
              : {}),
            ...(request.texts ? { texts: [...request.texts] } : {}),
          },
          requestSha256: "",
          outcome: "failed",
        };
        captured.requestSha256 = sha256(JSON.stringify(captured.request));
        effectiveModelRequests.push(captured);
        const output = await model(request);
        captured.outcome = "returned";
        captured.outputSha256 = sha256(JSON.stringify(output) ?? "undefined");
        return output;
      }
    : undefined;
  let result: FeatureTaskResult;
  let runnerFailureCategory: string | undefined;
  let runnerFailureStatus: number | undefined;
  try {
    result = await runFeatureTask(feature, item, { ...options, model: capturedModel });
  } catch (error: unknown) {
    const knownNames = [
      "Error",
      "TypeError",
      "SyntaxError",
      "AbortError",
      "TimeoutError",
      "AI_APICallError",
      "AI_NoOutputGeneratedError",
      "AI_NoObjectGeneratedError",
      "AI_InvalidArgumentError",
      "AI_InvalidPromptError",
      "AI_LoadAPIKeyError",
      "AI_UnsupportedFunctionalityError",
      "AI_RetryError",
      "AI_TypeValidationError",
      "AI_JSONParseError",
      "AI_InvalidResponseDataError",
      "AI_EmptyResponseBodyError",
      "AI_TooManyEmbeddingValuesForCallError",
    ];
    const details =
      error && typeof error === "object"
        ? (error as { name?: unknown; statusCode?: unknown; status?: unknown })
        : {};
    runnerFailureCategory =
      typeof details.name === "string" && knownNames.includes(details.name)
        ? details.name
        : "UnclassifiedError";
    const status = details.statusCode ?? details.status;
    if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599)
      runnerFailureStatus = status;
    result = {
      caseId: item.id,
      featureId: feature.featureId,
      status: "failed",
      executionLevel: item.metadata.executionLevel,
      checks: {},
      promptFragments: [],
      reason:
        "Task failed: verify snapshot completeness, explicit opt-in/config, output contract, isolated fixtures and provider availability. No provider or application error body was recorded.",
    };
  }
  if (Object.values(result.checks).some((check) => check === false)) result.status = "failed";
  const nativeTask = ["app", "assistant", "audio"].includes(item.input.task.kind);
  let modelProvenance: CapturedFeatureTaskResult["metadata"]["modelProvenance"] =
    "no_model_request_observed";
  if (nativeTask && options.run) modelProvenance = "native_runtime_not_observed";
  const publicProviderConfig = providerMetadata
    ? Object.fromEntries(
        [
          "model",
          "baseURL",
          "timeoutMs",
          "maxOutputTokens",
          "maxRetries",
          "configSha256",
          "telemetryEnabled",
        ]
          .filter((key) => providerMetadata[key] !== undefined)
          .map((key) => [key, providerMetadata[key]]),
      )
    : undefined;
  if (effectiveModelRequests.length)
    modelProvenance = publicProviderConfig
      ? "explicit_cli_provider_configuration"
      : "model_call_observed_configuration_unavailable";
  let nativeEvidenceProvenance: CapturedFeatureTaskResult["metadata"]["nativeEvidenceProvenance"] =
    "not_applicable";
  if (nativeTask && options.run) {
    nativeEvidenceProvenance =
      result.output !== undefined || Object.keys(result.checks).length
        ? "adapter_returned_checks_and_output"
        : "not_observed";
  }
  return {
    ...result,
    input,
    expectedOutput,
    metadata: {
      ...(result.configurationEvidence
        ? { configurationEvidence: result.configurationEvidence }
        : {}),
      ...(result.voiceDeliveryEvidence
        ? { voiceDeliveryEvidence: result.voiceDeliveryEvidence }
        : {}),
      caseId: item.id,
      featureId: feature.featureId,
      scope: result.executionLevel,
      inputProvenance: "declared_published_fixture",
      declaredInputSha256: sha256(JSON.stringify(input)),
      expectedOutputProvenance: "versioned_catalogue",
      effectiveModelRequests,
      modelRequestCaptureBoundary: "FeatureModel_arguments",
      modelProvenance,
      ...(effectiveModelRequests.length && publicProviderConfig
        ? { effectiveProviderConfig: publicProviderConfig }
        : {}),
      nativeEvidenceProvenance,
      rawHttpRequestsCaptured: false,
      rawProviderResponsesCaptured: false,
      synthetic: true,
      ...(runnerFailureCategory ? { runnerFailureCategory } : {}),
      ...(runnerFailureStatus !== undefined ? { runnerFailureStatus } : {}),
    },
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "prepare" },
      feature: { type: "string", multiple: true },
      case: { type: "string", multiple: true },
      out: { type: "string" },
      "prompt-snapshots": { type: "string" },
      "prompt-source": { type: "string" },
      "provider-config": { type: "string" },
      "app-config": { type: "string" },
      "allow-model-requests": { type: "boolean", default: false },
      "allow-app-requests": { type: "boolean", default: false },
    },
  });
  if (!["prepare", "run", "list"].includes(String(values.mode)))
    throw new Error("Unknown feature task mode");
  const raw = readFileSync(resolve(__dirname, "feature-catalogue.v1.json"), "utf8");
  const catalogue = JSON.parse(raw) as FeatureCatalogue;
  validateFeatureCatalogue(catalogue);
  const features = catalogue.features.filter(
    (feature) => !values.feature?.length || values.feature.includes(feature.featureId),
  );
  if (
    !features.length ||
    values.feature?.some((id) => !features.some((feature) => feature.featureId === id))
  )
    throw new Error("Unknown feature ID");
  if (values.mode === "list") {
    process.stdout.write(
      `${JSON.stringify(
        features.map((feature) => ({
          featureId: feature.featureId,
          datasetName: feature.datasetName,
          cases: feature.items.length,
          executionLevel: feature.executionLevel,
          limitations: feature.limitations,
        })),
        null,
        2,
      )}\n`,
    );
    return;
  }
  if (!values.out) throw new Error("Explicit local --out path required");
  const selectedIds = features.flatMap((feature) => feature.items.map((item) => item.id));
  if (values.case?.some((id) => !selectedIds.includes(id)))
    throw new Error("Unknown selected case ID");
  const promptSource =
    values["prompt-source"] ?? (values["prompt-snapshots"] ? "managed" : "local");
  if (
    !["managed", "local"].includes(promptSource) ||
    (promptSource === "managed" && !values["prompt-snapshots"]) ||
    (promptSource === "local" && values["prompt-snapshots"])
  )
    throw new Error("Choose managed snapshots or explicit local source; no implicit fallback");
  const promptSnapshots = values["prompt-snapshots"]
    ? normalizePromptSnapshots(JSON.parse(readFileSync(values["prompt-snapshots"], "utf8")))
    : undefined;
  const appConfig = values["app-config"]
    ? (JSON.parse(readFileSync(values["app-config"], "utf8")) as HttpRunConfig)
    : undefined;
  const provider =
    values.mode === "run" && values["allow-model-requests"] && values["provider-config"]
      ? createFeatureProvider(
          JSON.parse(
            readFileSync(values["provider-config"], "utf8"),
          ) as FeatureProviderConfiguration,
        )
      : undefined;
  const results: CapturedFeatureTaskResult[] = [];
  for (const feature of features)
    for (const item of feature.items) {
      if (values.case?.length && !values.case.includes(item.id)) continue;
      results.push(
        await captureFeatureTask(
          feature,
          item,
          {
            run: values.mode === "run",
            allowModelRequests: values["allow-model-requests"],
            allowAppRequests: values["allow-app-requests"],
            appConfig,
            model: provider?.model,
            promptSnapshots,
          },
          provider?.metadata,
        ),
      );
    }
  const summary = {
    total: results.length,
    prepared: results.filter((result) => result.status === "prepared").length,
    needsReview: results.filter((result) => result.status === "needs_review").length,
    failed: results.filter((result) => result.status === "failed").length,
    notRun: results.filter((result) => result.status === "not_run").length,
  };
  let exitCode = 0;
  if (summary.failed || summary.notRun) exitCode = 1;
  else if (summary.needsReview) exitCode = 2;
  writeFileSync(
    values.out,
    `${JSON.stringify(
      {
        purpose:
          values.mode === "run"
            ? "explicit_manual_feature_execution"
            : "offline_prepared_feature_tasks_no_requests",
        featureCatalogueSha256: sha256(raw),
        runnerCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        createdAt: new Date().toISOString(),
        promptSource,
        model: provider?.metadata,
        calibration: "pending_domain_review",
        summary,
        results,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(`${JSON.stringify({ ...summary, exitCode })}\n`);
  process.exitCode = exitCode;
}

if (require.main === module)
  main().catch(() => {
    process.stderr.write(
      "Feature task setup failed; check explicit arguments and catalogue. No credentials or provider details printed.\n",
    );
    process.exitCode = 1;
  });
