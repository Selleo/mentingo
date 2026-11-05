import { StringDecoder } from "node:string_decoder";

import {
  AiCapability,
  AiCapabilityProvider,
  createLumaClient,
  type AiRuntimeConfiguration,
  type LumaClient,
  type GenerateAiJudgeConfigurationOptions,
  type GenerateAiMentorConfigurationOptions,
  type GenerateTranslationsOptions,
  type GenerateTranslationsResponse,
  type MentorChatOptions,
  type MentorJudgeOptions,
  type TranscribeDictationOptions,
  type TranscribeDictationResponse,
  type ValidateAiJudgeConfigurationOptions,
  type ValidateAiMentorConfigurationOptions,
} from "@mentingo/luma-sdk";
import { Injectable, Logger } from "@nestjs/common";
import { AI_MENTOR_TYPE } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import {
  AI_MENTOR_RAG_EMBEDDING_DIMENSIONS,
  LUMA_CONFIGURATION_CACHE_TTL_MS,
  LUMA_OPENAI_COMPATIBLE_MODEL,
  LUMA_OPENAI_COMPATIBLE_PATH,
} from "src/ai/ai-runtime.constants";
import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import {
  aiJudgeConfigurationValidatorStructuredOutputSchema,
  referencedAiJudgeConfigurationStructuredOutputSchema,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import {
  aiMentorConfigurationValidatorModelResultSchema,
  generatedAiMentorRoleplayConfigurationFieldsSchema,
  generatedAiMentorTeacherConfigurationFieldsSchema,
} from "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema";
import { loadAiSdk, loadOpenAiSdk } from "src/ai/utils/ai-esm";
import { AI_TELEMETRY_FUNCTION_IDS, buildAiTelemetry } from "src/ai/utils/ai-telemetry";
import { aiJudgeJudgementSchema, generateTranslationSchema } from "src/ai/utils/ai.schema";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";
import { FallbackLanguageModel } from "src/ai/utils/fallback-language-model";
import { EnvService } from "src/env/services/env.service";
import { dbAls } from "src/storage/db/db-als.store";

import type { OpenAIProvider } from "@ai-sdk/openai";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { AiMentorChatStreamResult, AiCoreMentorStreamResult } from "src/ai/ai-chat.types";
import type {
  AiRuntimeSource,
  SemanticEmbeddingRequest,
  SemanticEmbeddingResult,
} from "src/ai/ai-runtime.types";
import type { AiJudgeModelResult } from "src/ai/judge-configuration/judge-configuration.types";
import type {
  AiJudgeConfigurationValidatorStructuredOutput,
  ReferencedAiJudgeConfiguration,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import type {
  AiMentorConfigurationValidatorModelResult,
  GeneratedAiMentorConfigurationFields,
} from "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema";

@Injectable()
export class AiRuntimeService {
  private readonly logger = new Logger(AiRuntimeService.name);
  private readonly lumaConfigurationCache = new Map<
    string,
    {
      expiresAt: number;
      value: AiRuntimeConfiguration | null;
    }
  >();

  constructor(private readonly envService: EnvService) {}

  async getAISdkOpenAI(): Promise<OpenAIProvider> {
    const { createOpenAI } = await loadOpenAiSdk();

    return createOpenAI({
      apiKey: await this.envService
        .getEnv("OPENAI_API_KEY")
        .then((r) => r.value)
        .catch(() => process.env.OPENAI_API_KEY),
    });
  }

  async createEmbedding(
    content: string,
    capability: AiCapability = AiCapability.AiMentorRagEmbeddings,
  ): Promise<number[]> {
    const [embedding] = await this.createEmbeddings([content], capability);
    return embedding;
  }

  async createEmbeddings(
    contents: string[],
    capability: AiCapability = AiCapability.AiMentorRagEmbeddings,
  ): Promise<number[][]> {
    return this.runWithLumaFallback({
      capability,
      operation: `embeddings for ${capability}`,
      runLuma: async (luma) =>
        (await this.createLumaEmbeddings(luma, contents, AI_MENTOR_RAG_EMBEDDING_DIMENSIONS))
          .embeddings,
      runCore: () => this.createCoreEmbeddings(contents),
    });
  }

  async streamMentorChat(
    input: MentorChatOptions,
    createCoreStream: () => Promise<AiCoreMentorStreamResult>,
    abortSignal?: AbortSignal,
  ): Promise<AiMentorChatStreamResult> {
    return this.runWithLumaFallback<AiMentorChatStreamResult>({
      capability: AiCapability.AiMentorChat,
      operation: "mentor chat",
      abortSignal,
      runLuma: async (luma) => {
        const response = await luma.mentor.streamChat(input, { signal: abortSignal });

        return {
          source: AI_RUNTIME_SOURCES.LUMA,
          textStream: this.readLumaTextStream(response.data as unknown as AsyncIterable<Buffer>),
        };
      },
      runCore: async () => {
        const coreStream = await createCoreStream();

        return {
          source: AI_RUNTIME_SOURCES.CORE,
          textStream: coreStream.textStream,
          coreStream: coreStream.coreStream,
        };
      },
    });
  }

  async generateMentorChat(
    input: MentorChatOptions,
    generateCoreMessage: () => Promise<string>,
  ): Promise<string> {
    return this.runWithLumaFallback({
      capability: AiCapability.AiMentorChat,
      operation: "mentor generation",
      runLuma: async (luma) => (await luma.mentor.generateChat(input)).message,
      runCore: generateCoreMessage,
    });
  }

  async judgeMentor(
    input: MentorJudgeOptions,
    judgeCore: () => Promise<AiJudgeModelResult>,
  ): Promise<AiJudgeModelResult> {
    return this.runWithLumaFallback({
      capability: AiCapability.AiMentorJudge,
      operation: "mentor judge",
      runLuma: async (luma) => {
        const result = await luma.mentor.judge(input);
        if (!Value.Check(aiJudgeJudgementSchema, result))
          throw new Error("Luma mentor Judge returned an invalid structured result");

        return result;
      },
      runCore: judgeCore,
    });
  }

  async generateTranslations(
    input: GenerateTranslationsOptions,
    generateCoreTranslations: () => Promise<GenerateTranslationsResponse>,
  ): Promise<GenerateTranslationsResponse> {
    return this.runWithLumaFallback({
      capability: AiCapability.TranslationGeneration,
      operation: "translation generation",
      runLuma: async (luma) => {
        const result = await luma.ai.generateTranslations(input);

        if (!Value.Check(generateTranslationSchema, result)) {
          throw new Error("Luma translation generation returned an invalid structured result");
        }

        return result;
      },
      runCore: generateCoreTranslations,
    });
  }

  async generateJudgeConfiguration(
    input: GenerateAiJudgeConfigurationOptions,
    generateCoreConfiguration: () => Promise<ReferencedAiJudgeConfiguration>,
  ): Promise<ReferencedAiJudgeConfiguration> {
    return this.runWithLumaFallback({
      capability: AiCapability.AiJudgeConfigurationGenerator,
      operation: "AI Judge configuration generation",
      runLuma: async (luma) => {
        const result = await luma.ai.generateJudgeConfiguration(input);
        if (!Value.Check(referencedAiJudgeConfigurationStructuredOutputSchema, result))
          throw new Error("Luma AI Judge configuration generator returned an invalid result");

        return result;
      },
      runCore: generateCoreConfiguration,
    });
  }

  async generateMentorConfiguration(
    input: GenerateAiMentorConfigurationOptions,
    generateCoreConfiguration: () => Promise<GeneratedAiMentorConfigurationFields>,
  ): Promise<GeneratedAiMentorConfigurationFields> {
    return this.runWithLumaFallback({
      capability: AiCapability.AiMentorConfigurationGenerator,
      operation: "AI Mentor configuration generation",
      runLuma: async (luma) => {
        const result = await luma.ai.generateMentorConfiguration(input);
        const schema =
          input.configurationType === AI_MENTOR_TYPE.TEACHER
            ? generatedAiMentorTeacherConfigurationFieldsSchema
            : generatedAiMentorRoleplayConfigurationFieldsSchema;

        if (!Value.Check(schema, result))
          throw new Error("Luma AI Mentor configuration generator returned an invalid result");

        return result as GeneratedAiMentorConfigurationFields;
      },
      runCore: generateCoreConfiguration,
    });
  }

  async validateJudgeConfiguration(
    input: ValidateAiJudgeConfigurationOptions,
    validateCoreConfiguration: () => Promise<AiJudgeConfigurationValidatorStructuredOutput>,
  ): Promise<AiJudgeConfigurationValidatorStructuredOutput> {
    return this.runWithLumaFallback({
      capability: AiCapability.AiJudgeConfigurationValidator,
      operation: "AI Judge configuration validation",
      runLuma: async (luma) => {
        const result = await luma.ai.validateJudgeConfiguration(input);
        if (!Value.Check(aiJudgeConfigurationValidatorStructuredOutputSchema, result))
          throw new Error("Luma AI Judge configuration validator returned an invalid result");

        return result;
      },
      runCore: validateCoreConfiguration,
    });
  }

  async validateMentorConfiguration(
    input: ValidateAiMentorConfigurationOptions,
    validateCoreConfiguration: () => Promise<AiMentorConfigurationValidatorModelResult>,
  ): Promise<AiMentorConfigurationValidatorModelResult> {
    return this.runWithLumaFallback({
      capability: AiCapability.AiJudgeConfigurationValidator,
      operation: "AI Mentor configuration validation",
      runLuma: async (luma) => {
        const result = await luma.ai.validateMentorConfiguration(input);
        if (!Value.Check(aiMentorConfigurationValidatorModelResultSchema, result))
          throw new Error("Luma AI Mentor configuration validator returned an invalid result");

        return result;
      },
      runCore: validateCoreConfiguration,
    });
  }

  async transcribeDictation(
    input: TranscribeDictationOptions,
    transcribeCore: () => Promise<TranscribeDictationResponse | undefined>,
  ): Promise<TranscribeDictationResponse | undefined> {
    return this.runWithLumaFallback<TranscribeDictationResponse | undefined>({
      capability: AiCapability.DictationTranscription,
      operation: "dictation transcription",
      runLuma: (luma) => luma.ai.transcribeDictation(input),
      runCore: transcribeCore,
    });
  }

  /**
   * The Core assistant needs OpenAI tool calling, so Luma is reached through its
   * OpenAI-compatible relay, which runs the AI Mentor chat Custom profile.
   */
  async getAssistantLanguageModel(): Promise<LanguageModelV4> {
    const createCoreModel = async () => (await this.getAISdkOpenAI())(OPENAI_MODELS.BASIC);

    return this.runWithLumaFallback<LanguageModelV4>({
      capability: AiCapability.AiMentorChat,
      operation: "Core assistant model",
      runLuma: async () =>
        new FallbackLanguageModel(
          (await this.getLumaOpenAiCompatibleProvider()).chat(LUMA_OPENAI_COMPATIBLE_MODEL),
          createCoreModel,
          (error) => this.logFallback("Core assistant", error),
        ),
      runCore: createCoreModel,
    });
  }

  /**
   * Returns the model that actually produced the vectors, so callers never compare vectors from
   * the Luma profile with vectors from the OpenAI fallback.
   */
  async createSemanticSearchEmbeddings({
    values,
    dimensions,
    coreModel,
    timeoutMs,
  }: SemanticEmbeddingRequest): Promise<SemanticEmbeddingResult> {
    const options = { maxRetries: 0, telemetry: { isEnabled: false } } as const;

    return this.runWithLumaFallback({
      capability: AiCapability.AiMentorRagEmbeddings,
      operation: "semantic search embeddings",
      runLuma: (luma) => this.createLumaEmbeddings(luma, values, dimensions, timeoutMs),
      runCore: async () => {
        const provider = await this.getAISdkOpenAI();
        const { embedMany } = await loadAiSdk();
        const { embeddings } = await embedMany({
          model: provider.embedding(coreModel),
          values,
          abortSignal: AbortSignal.timeout(timeoutMs),
          ...options,
        });

        return { embeddings, model: coreModel };
      },
    });
  }

  async resolveSource(capability: AiCapability): Promise<AiRuntimeSource> {
    const configuration = await this.getLumaConfiguration();
    const capabilityStatus = configuration?.capabilities?.[capability];

    if (capabilityStatus?.enabled && capabilityStatus.provider === AiCapabilityProvider.Luma) {
      return AI_RUNTIME_SOURCES.LUMA;
    }

    return AI_RUNTIME_SOURCES.CORE;
  }

  /** Every Luma call falls back to Mentingo Core unless the caller aborted it. */
  private async runWithLumaFallback<T>({
    capability,
    operation,
    runLuma,
    runCore,
    abortSignal,
  }: {
    capability: AiCapability;
    operation: string;
    runLuma: (luma: LumaClient) => Promise<T>;
    runCore: () => Promise<T>;
    abortSignal?: AbortSignal;
  }): Promise<T> {
    if ((await this.resolveSource(capability)) === AI_RUNTIME_SOURCES.LUMA) {
      try {
        return await runLuma(await this.getLumaClient());
      } catch (error) {
        if (abortSignal?.aborted) throw error;
        this.logFallback(operation, error);
      }
    }

    return runCore();
  }

  private logFallback(operation: string, error: unknown) {
    this.logger.warn(
      `Luma ${operation} failed; falling back to core ${operation}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  private async createCoreEmbeddings(contents: string[]): Promise<number[][]> {
    const provider = await this.getAISdkOpenAI();
    const { embedMany } = await loadAiSdk();

    const { embeddings } = await embedMany({
      model: provider.embeddingModel(OPENAI_MODELS.EMBEDDING),
      values: contents,
      telemetry: buildAiTelemetry(AI_TELEMETRY_FUNCTION_IDS.AI_MENTOR_RAG_EMBEDDINGS),
    });

    return embeddings;
  }

  /** Use the native SDK contract; require vector size and actual model before storing search data. */
  private async createLumaEmbeddings(
    luma: LumaClient,
    values: string[],
    dimensions: number,
    timeoutMs?: number,
  ): Promise<SemanticEmbeddingResult> {
    // SDK 0.4 forwards this additive native request field unchanged. The SDK contract
    // update exposes it publicly without requiring an unpublished package to run Core.
    const request = { texts: values, dimensions };
    const pending = luma.ai.createEmbeddings(request);
    const response =
      timeoutMs === undefined ? await pending : await this.waitForEmbeddings(pending, timeoutMs);
    const { embeddings } = response;
    if (
      embeddings.length !== values.length ||
      embeddings.some(
        (vector) => vector.length !== dimensions || vector.some((value) => !Number.isFinite(value)),
      )
    ) {
      throw new Error(`Luma embeddings did not return finite ${dimensions}-dimensional vectors`);
    }
    // Older Luma servers omit model metadata: fall back rather than guessing a vector space.
    const model: unknown = Reflect.get(response, "model");
    if (typeof model !== "string" || !model.trim()) {
      throw new Error("Luma embeddings did not report their embedding model");
    }
    return { embeddings, model };
  }

  /** Bound a read-only SDK 0.4 request; its transport has no per-call cancellation option. */
  private async waitForEmbeddings<T>(pending: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        pending,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Luma embeddings timed out")), timeoutMs);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private async *readLumaTextStream(stream: AsyncIterable<Buffer>): AsyncIterable<string> {
    const decoder = new StringDecoder("utf8");
    for await (const chunk of stream) {
      const text = decoder.write(chunk);
      if (text) {
        yield text;
      }
    }
    const remaining = decoder.end();
    if (remaining) yield remaining;
  }

  private async getLumaConfiguration(): Promise<AiRuntimeConfiguration | null> {
    const cacheKey = this.getTenantCacheKey();
    if (!cacheKey) {
      return null;
    }

    const now = Date.now();
    const cached = this.lumaConfigurationCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const configuration = await this.fetchLumaConfiguration();
    this.lumaConfigurationCache.set(cacheKey, {
      expiresAt: now + LUMA_CONFIGURATION_CACHE_TTL_MS,
      value: configuration,
    });

    return configuration;
  }

  private getTenantCacheKey() {
    return dbAls.getStore()?.tenantId;
  }

  private async fetchLumaConfiguration(): Promise<AiRuntimeConfiguration | null> {
    const client = await this.getLumaClientOrNull();
    if (!client) return null;

    return client.configuration.get().catch((error) => {
      this.logger.warn(
        `Failed to fetch Luma runtime configuration; using core runtime: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    });
  }

  private async getLumaOpenAiCompatibleProvider(): Promise<OpenAIProvider> {
    const { apiKey, baseURL } = await this.getLumaCredentials();
    if (!apiKey || !baseURL) throw new Error("Luma is not configured");

    const { createOpenAI } = await loadOpenAiSdk();
    return createOpenAI({
      apiKey,
      baseURL: `${baseURL.replace(/\/+$/, "")}${LUMA_OPENAI_COMPATIBLE_PATH}`,
      headers: { "X-API-Key": apiKey },
    });
  }

  private async getLumaClient() {
    const client = await this.getLumaClientOrNull();
    if (!client) {
      throw new Error("Luma is not configured");
    }

    return client;
  }

  private async getLumaClientOrNull() {
    const { apiKey, baseURL } = await this.getLumaCredentials();

    if (!apiKey || !baseURL) {
      return null;
    }

    return createLumaClient({ apiKey, baseURL });
  }

  private async getLumaCredentials() {
    const apiKey = await this.envService
      .getEnv("LUMA_API_KEY")
      .then((r) => r.value)
      .catch(() => process.env.LUMA_API_KEY);

    return { apiKey, baseURL: process.env.LUMA_BASE_URL };
  }
}
