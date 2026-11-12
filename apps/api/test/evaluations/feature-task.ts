import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import Handlebars from "handlebars";

import {
  buildAiJudgeConfigurationGeneratorPrompt,
  buildAiJudgeConfigurationValidatorPrompt,
} from "src/ai/judge-configuration-generation/utils/ai-judge-configuration-prompts";
import {
  preserveAiJudgeRepairScope,
  normalizeGeneratedAiJudgeConfiguration,
} from "src/ai/judge-configuration-generation/utils/ai-judge-configuration-repair";
import {
  buildAiMentorConfigurationGeneratorPrompt,
  buildAiMentorConfigurationValidatorPrompt,
} from "src/ai/mentor-configuration-generation/utils/ai-mentor-configuration-prompts";
import { preserveAiMentorRepairScope } from "src/ai/mentor-configuration-generation/utils/ai-mentor-configuration-repair";
import { streamVoiceSentenceMarkup } from "src/ai/utils/voice-delivery";

import { runHttpCase, validateHttpConfig } from "./http-adapter";
import { runAssistantFeature, runAudioFeature } from "./native-feature-adapters";
import { sha256 } from "./semantic-evaluator";

import type { RegressionDataset } from "./evaluation.types";
import type {
  CoreAiFeature,
  FeatureCatalogue,
  FeatureItem,
  FeatureModelRequest,
  FeatureRunOptions,
  FeatureTaskResult,
  PromptFragmentRecord,
  PromptSnapshots,
} from "./feature-catalogue.types";
import type { TSchema } from "@sinclair/typebox";
import type { ReferencedAiJudgeConfiguration } from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

const repositoryRoot = resolve(__dirname, "../../../..");
const promptDirectory = resolve(repositoryRoot, "packages/prompts/src/templates");
const promptRequire = createRequire(resolve(repositoryRoot, "packages/prompts/package.json"));
const { parse: parseYaml } = promptRequire("yaml") as {
  parse: (text: string) => { id: string; version: number; template: string };
};

export function validateFeatureCatalogue(catalogue: FeatureCatalogue): void {
  if (
    catalogue.version !== 1 ||
    catalogue.project !== "mentingo" ||
    !Array.isArray(catalogue.features) ||
    !catalogue.features.length
  )
    throw new Error("Invalid Core feature catalogue");
  const featureIds = new Set<string>();
  const caseIds = new Set<string>();
  for (const feature of catalogue.features) {
    if (
      !feature.featureId ||
      featureIds.has(feature.featureId) ||
      !feature.datasetName ||
      !feature.sourcePaths.length ||
      !feature.items.length
    )
      throw new Error("Duplicate or incomplete AI feature");
    featureIds.add(feature.featureId);
    for (const item of feature.items) {
      if (
        !item.id ||
        caseIds.has(item.id) ||
        item.metadata.featureId !== feature.featureId ||
        item.metadata.caseId !== item.id ||
        item.metadata.synthetic !== true ||
        !item.input.scenario ||
        !item.input.sourceDocuments.length ||
        !item.expectedOutput.rubric.length ||
        !["prompt", "app", "embedding", "assistant", "audio", "unsupported"].includes(
          item.input.task.kind,
        )
      )
        throw new Error("Incomplete normalized feature dataset item");
      caseIds.add(item.id);
    }
  }
}

/** Root exports production snapshots with either top-level label or per-record production labels. */
export function normalizePromptSnapshots(value: unknown): PromptSnapshots {
  if (!value || typeof value !== "object") throw new Error("Invalid prompt snapshot file");
  const raw = value as { label?: string; prompts?: Array<Record<string, unknown>> };
  if (!Array.isArray(raw.prompts)) throw new Error("Prompt snapshot file needs prompts array");
  return {
    prompts: raw.prompts.map((snapshot) => {
      let label = snapshot.label ?? raw.label;
      if (
        label === undefined &&
        Array.isArray(snapshot.labels) &&
        snapshot.labels.includes("production")
      )
        label = "production";
      return {
        name: String(snapshot.name ?? ""),
        version: Number(snapshot.version),
        prompt: snapshot.prompt as string,
        config: snapshot.config as Record<string, unknown> | undefined,
        label: label as "production" | "candidate",
      };
    }),
  };
}

export function validatePromptSnapshots(snapshots: PromptSnapshots): void {
  if (!Array.isArray(snapshots.prompts) || !snapshots.prompts.length)
    throw new Error("No managed production prompt snapshots supplied");
  const names = new Set<string>();
  for (const snapshot of snapshots.prompts) {
    if (
      !snapshot.name ||
      names.has(snapshot.name) ||
      !["production", "candidate"].includes(snapshot.label) ||
      !Number.isInteger(snapshot.version) ||
      snapshot.version < 1 ||
      typeof snapshot.prompt !== "string" ||
      !snapshot.prompt.trim()
    )
      throw new Error("Invalid or duplicate managed production prompt snapshot");
    names.add(snapshot.name);
  }
}

/** Render a pinned managed snapshot when supplied; never silently replace it with local source. */
export function prepareFeaturePrompt(
  item: FeatureItem,
  snapshots?: PromptSnapshots,
): { request: FeatureModelRequest; fragments: PromptFragmentRecord[] } {
  if (snapshots) {
    snapshots = normalizePromptSnapshots(snapshots);
    validatePromptSnapshots(snapshots);
  }
  const messages: FeatureModelRequest["messages"] = [];
  const fragments: PromptFragmentRecord[] = [];
  for (const fragment of item.input.task.promptFragments ?? []) {
    let template: string;
    let version: number;
    if (snapshots) {
      const snapshot = snapshots.prompts.find((candidate) => candidate.name === fragment.promptId);
      if (!snapshot)
        throw new Error(`Required production prompt snapshot is missing: ${fragment.promptId}`);
      template = snapshot.prompt;
      version = snapshot.version;
    } else {
      const prompt = readdirSync(promptDirectory)
        .filter((file) => file.endsWith(".yaml"))
        .map((file) => parseYaml(readFileSync(resolve(promptDirectory, file), "utf8")))
        .find((candidate) => candidate.id === fragment.promptId);
      if (!prompt || typeof prompt.template !== "string")
        throw new Error("Unknown authoritative prompt source");
      template = prompt.template;
      version = prompt.version;
    }
    const content = Handlebars.compile(template, { strict: true, noEscape: Boolean(snapshots) })(
      item.input.task.variables ?? {},
    );
    if (!content.trim()) throw new Error("Rendered prompt is empty");
    messages.push({ role: fragment.role, content });
    let origin: PromptFragmentRecord["origin"] = "local_source";
    let production = false;
    if (snapshots) {
      const pinned = snapshots.prompts.find((snapshot) => snapshot.name === fragment.promptId);
      production = pinned?.label === "production";
      origin = production ? "managed_production_snapshot" : "candidate_source_snapshot";
    }
    fragments.push({
      name: fragment.promptId,
      version,
      origin,
      production,
      sha256: sha256(template),
      role: fragment.role,
    });
  }
  const generation = item.input.task.generationInput;
  if (generation) {
    if (messages.some((message) => message.role !== "system"))
      throw new Error("Native configuration fragments must be system prompts");
    const system = messages.map((message) => message.content).join("\n\n");
    messages.splice(0, messages.length, { role: "system", content: system });
    if (item.input.task.messages?.length)
      throw new Error("Native configuration inputs cannot be mixed with ad hoc messages");
    let content: string;
    switch (generation.kind) {
      case "mentor-generator":
        content = buildAiMentorConfigurationGeneratorPrompt(generation.input);
        break;
      case "mentor-validator":
        content = buildAiMentorConfigurationValidatorPrompt(generation.input);
        break;
      case "judge-generator":
        content = buildAiJudgeConfigurationGeneratorPrompt(generation.input);
        break;
      case "judge-validator":
        content = buildAiJudgeConfigurationValidatorPrompt(generation.input);
        break;
      default:
        throw new Error("Unknown native configuration input kind");
    }
    messages.push({ role: "user", content });
  } else messages.push(...(item.input.task.messages ?? []));
  return {
    request: {
      kind: item.input.task.kind === "embedding" ? "embedding" : "prompt",
      messages,
      texts: item.input.task.texts,
    },
    fragments,
  };
}

/** Reuse production structured-output contracts; these are not parallel handwritten schemas. */
export async function featureResponseSchema(id?: string): Promise<TSchema | undefined> {
  if (id === "voice-sentences")
    return (await import("src/ai/schemas/voice-delivery.schema")).voiceDeliverySentenceSchema;
  if (!id) return undefined;
  if (id === "judge") return (await import("src/ai/utils/ai.schema")).aiJudgeJudgementSchema;
  if (id === "translation")
    return (await import("src/ai/utils/ai.schema")).generateTranslationSchema;
  if (["mentor-teacher-fields", "mentor-roleplay-fields", "mentor-validation"].includes(id)) {
    const schemas = await import(
      "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema"
    );
    const map: Record<string, TSchema> = {
      "mentor-teacher-fields": schemas.generatedAiMentorTeacherConfigurationFieldsSchema,
      "mentor-roleplay-fields": schemas.generatedAiMentorRoleplayConfigurationFieldsSchema,
      "mentor-validation": schemas.aiMentorConfigurationValidatorModelResultSchema,
    };
    return map[id];
  }
  if (["judge-configuration", "judge-validation"].includes(id)) {
    const schemas = await import(
      "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema"
    );
    if (id === "judge-configuration")
      return schemas.referencedAiJudgeConfigurationStructuredOutputSchema;
    return schemas.aiJudgeConfigurationValidatorStructuredOutputSchema;
  }
  throw new Error("Unknown feature structured-output contract");
}

export async function runFeatureTask(
  feature: CoreAiFeature,
  item: FeatureItem,
  options: FeatureRunOptions,
): Promise<FeatureTaskResult> {
  const common = {
    caseId: item.id,
    featureId: feature.featureId,
    executionLevel: item.metadata.executionLevel,
  };
  if (item.input.task.kind === "unsupported")
    return {
      ...common,
      status: "not_run",
      checks: {},
      promptFragments: [],
      reason:
        item.input.task.reason ?? "No adapter exists for this feature's complete application flow",
    };
  if (item.input.task.kind === "assistant" || item.input.task.kind === "audio") {
    if (!options.run)
      return {
        ...common,
        status: "prepared",
        checks: {},
        promptFragments: [],
        output: { adapter: item.input.task.kind, fixtureCaseId: item.id, requiresFixture: true },
      };
    if (!options.allowAppRequests || !options.appConfig)
      throw new Error(
        "Native assistant/audio requires explicit application opt-in and supplied synthetic fixture",
      );
    return item.input.task.kind === "assistant"
      ? runAssistantFeature(item, options.appConfig)
      : runAudioFeature(item, options.appConfig);
  }
  if (item.input.task.kind === "app") {
    if (!options.run)
      return {
        ...common,
        status: "prepared",
        checks: {},
        promptFragments: [],
        output: { existingCaseId: item.input.task.existingCaseId, fixtureCaseId: item.id },
      };
    const datasets = ["dataset.v1.json", "assessment-cases.v1.json"].map(
      (file) => JSON.parse(readFileSync(resolve(__dirname, file), "utf8")) as RegressionDataset,
    );
    const original = datasets
      .flatMap((dataset) => dataset.cases)
      .find((candidate) => candidate.id === item.input.task.existingCaseId);
    if (!original) throw new Error("Application case adapter reference is missing");
    if (original.execution === "prepared" && original.id !== "authoring-stale-baseline")
      return {
        ...common,
        status: "not_run",
        checks: {},
        promptFragments: [],
        reason: "This historical application case has no complete HTTP adapter yet.",
      };
    if (!options.allowAppRequests || !options.appConfig)
      throw new Error("Application feature tasks require explicit app request opt-in/config");
    validateHttpConfig(options.appConfig);
    const input = { ...original.input };
    if (item.input.task.appVariant === "proposal_only") input.proposalOnly = true;
    if (item.input.task.instructionOverride)
      input.instruction = item.input.task.instructionOverride;
    const staleBaseline = original.id === "authoring-stale-baseline";
    if (staleBaseline)
      Object.assign(input, {
        language: SUPPORTED_LANGUAGES.EN,
        instruction: "Shorten only the course title while preserving its meaning.",
        staleBaseline: true,
      });
    const captured = await runHttpCase(
      {
        ...original,
        execution: staleBaseline ? "authoring" : original.execution,
        id: item.id,
        input,
      },
      options.appConfig,
    );
    let status: FeatureTaskResult["status"] = "needs_review";
    if (captured.status === "failed") status = "failed";
    if (captured.status === "not_run") status = "not_run";
    return { ...common, status, output: captured, checks: captured.checks, promptFragments: [] };
  }
  const { request, fragments } = prepareFeaturePrompt(item, options.promptSnapshots);
  request.schema = await featureResponseSchema(item.input.task.responseSchemaId);
  if (item.input.task.responseSchemaId === "voice-sentences")
    request.structuredOutputMode = "array";
  if (!options.run)
    return {
      ...common,
      status: "prepared",
      output: { ...request, sourceDocuments: item.input.sourceDocuments },
      checks: {},
      promptFragments: fragments,
    };
  if (!options.allowModelRequests || !options.model)
    throw new Error("Prompt/embedding tasks require explicit model request opt-in/config");
  const rawOutput = await options.model(request);
  let output = rawOutput;
  const checks: Record<string, boolean> = {};
  if (request.kind === "embedding") {
    checks.finiteAlignedEmbeddings =
      Array.isArray(output) &&
      output.length === request.texts?.length &&
      output.every(
        (vector) =>
          Array.isArray(vector) &&
          vector.length > 0 &&
          vector.every((value) => typeof value === "number" && Number.isFinite(value)),
      );
    if (checks.finiteAlignedEmbeddings && item.input.task.embeddingOracle) {
      const vectors = output as number[][];
      const { queryIndex, relevantIndex, irrelevantIndex } = item.input.task.embeddingOracle;
      const cosine = (left: number[], right: number[]) => {
        if (!left || !right || left.length !== right.length) return NaN;
        const norm =
          Math.sqrt(left.reduce((sum, value) => sum + value * value, 0)) *
          Math.sqrt(right.reduce((sum, value) => sum + value * value, 0));
        return left.reduce((sum, value, index) => sum + value * right[index], 0) / norm;
      };
      const relevant = cosine(vectors[queryIndex], vectors[relevantIndex]);
      const irrelevant = cosine(vectors[queryIndex], vectors[irrelevantIndex]);
      checks.semanticNeighborOrdering =
        Number.isFinite(relevant) && Number.isFinite(irrelevant) && relevant > irrelevant;
    }
  } else
    checks.nonemptyOutput =
      typeof output === "string"
        ? output.trim().length > 0
        : typeof output === "object" && output !== null;
  if (request.schema) {
    const schema =
      request.structuredOutputMode === "array" ? Type.Array(request.schema) : request.schema;
    checks.productionOutputSchema = Value.Check(schema, output);
  }
  let voiceDeliveryEvidence: FeatureTaskResult["voiceDeliveryEvidence"];
  if (request.structuredOutputMode === "array" && checks.productionOutputSchema) {
    async function* completeSentences() {
      if (!Array.isArray(rawOutput))
        throw new Error("Native voice output must be sentence elements");
      yield* rawOutput;
    }
    let markup = "";
    for await (const chunk of streamVoiceSentenceMarkup(completeSentences())) markup += chunk;
    output = markup.trim();
    checks.nativeSentenceDelivery = true;
    voiceDeliveryEvidence = {
      rawSentences: rawOutput,
      rawSentencesSha256: sha256(JSON.stringify(rawOutput)),
      emittedMarkupSha256: sha256(JSON.stringify(output)),
      scope: "native_sentence_schema_and_markup_without_tts_or_audio_delivery",
    };
  }
  const generation = item.input.task.generationInput;
  let configurationEvidence: FeatureTaskResult["configurationEvidence"];
  if (generation && checks.productionOutputSchema && generation.kind.endsWith("-generator")) {
    if (generation.kind === "mentor-generator") {
      const generated = {
        type: generation.input.configurationType,
        ...(rawOutput as object),
      } as AiMentorConfigurationContent;
      output =
        generation.input.mode === "repair"
          ? preserveAiMentorRepairScope(
              generation.input.currentConfiguration,
              generated,
              generation.input.blockingIssues,
            )
          : generated;
    } else if (generation.kind === "judge-generator") {
      const generated = normalizeGeneratedAiJudgeConfiguration(
        rawOutput as ReferencedAiJudgeConfiguration,
      );
      output =
        generation.input.mode === "repair"
          ? preserveAiJudgeRepairScope(
              generation.input.currentConfiguration,
              generated,
              generation.input.blockingIssues,
            )
          : generated;
    }
    configurationEvidence = {
      rawGeneratedConfiguration: rawOutput,
      rawGeneratedConfigurationSha256: sha256(JSON.stringify(rawOutput)),
      postprocessedOutputSha256: sha256(JSON.stringify(output)),
      scope: "native_prompt_composition_and_generator_postprocessing_without_http_db_or_workflow",
    };
  }
  return {
    ...common,
    status: Object.values(checks).every(Boolean) ? "needs_review" : "failed",
    output,
    ...(configurationEvidence ? { configurationEvidence } : {}),
    ...(voiceDeliveryEvidence ? { voiceDeliveryEvidence } : {}),
    checks,
    promptFragments: fragments,
  };
}
