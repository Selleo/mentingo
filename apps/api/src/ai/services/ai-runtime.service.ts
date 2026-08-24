import {
  AiCapability,
  AiCapabilityProvider,
  createLumaClient,
  type AiRuntimeConfiguration,
  type GenerateAiJudgeConfigurationOptions,
  type GenerateAiMentorConfigurationOptions,
  type GenerateTranslationsOptions,
  type GenerateTranslationsResponse,
  type MentorChatOptions,
  type MentorJudgeOptions,
  type TranscribeDictationOptions,
  type TranscribeDictationResponse,
  type ValidateAiJudgeConfigurationOptions,
} from "@japro/luma-sdk";
import { Injectable, Logger } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";

import { LUMA_CONFIGURATION_CACHE_TTL_MS } from "src/ai/ai-runtime.constants";
import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import {
  generatedAiMentorRoleplayConfigurationFieldsSchema,
  generatedAiMentorTeacherConfigurationFieldsSchema,
} from "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema";
import {
  aiJudgeConfigurationValidatorStructuredOutputSchema,
  referencedAiJudgeConfigurationStructuredOutputSchema,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import { loadAiSdk, loadOpenAiSdk } from "src/ai/utils/ai-esm";
import { AI_TELEMETRY_FUNCTION_IDS, buildAiTelemetry } from "src/ai/utils/ai-telemetry";
import { aiJudgeJudgementSchema, generateTranslationSchema } from "src/ai/utils/ai.schema";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";
import { EnvService } from "src/env/services/env.service";
import { dbAls } from "src/storage/db/db-als.store";

import type { OpenAIProvider } from "@ai-sdk/openai";
import type { AiMentorChatStreamResult, AiStreamTextResult } from "src/ai/ai-chat.types";
import type { AiRuntimeSource } from "src/ai/ai-runtime.types";
import type { AiJudgeModelResult } from "src/ai/judge-configuration/judge-configuration.types";
import type { GeneratedAiMentorConfigurationFields } from "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema";
import type {
  AiJudgeConfigurationValidatorStructuredOutput,
  ReferencedAiJudgeConfiguration,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";

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
    const source = await this.resolveSource(capability);

    if (source === AI_RUNTIME_SOURCES.LUMA) {
      try {
        const luma = await this.getLumaClient();
        const { embeddings } = await luma.ai.createEmbeddings({ texts: contents });

        return embeddings;
      } catch (error) {
        this.logger.warn(
          `Luma embeddings failed for ${capability}; falling back to core embeddings: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return this.createCoreEmbeddings(contents);
  }

  async streamMentorChat(
    input: MentorChatOptions,
    createCoreStream: () => Promise<AiStreamTextResult>,
  ): Promise<AiMentorChatStreamResult> {
    const source = await this.resolveSource(AiCapability.AiMentorChat);

    if (source === AI_RUNTIME_SOURCES.LUMA) {
      try {
        const luma = await this.getLumaClient();
        const response = await luma.mentor.streamChat(input);

        return {
          source: AI_RUNTIME_SOURCES.LUMA,
          textStream: this.readLumaTextStream(response.data as unknown as AsyncIterable<Buffer>),
        };
      } catch (error) {
        this.logger.warn(
          `Luma mentor chat failed; falling back to core mentor chat: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const coreStream = await createCoreStream();

    return {
      source: AI_RUNTIME_SOURCES.CORE,
      textStream: coreStream.textStream,
      coreStream,
    };
  }

  async generateMentorChat(
    input: MentorChatOptions,
    generateCoreMessage: () => Promise<string>,
  ): Promise<string> {
    const source = await this.resolveSource(AiCapability.AiMentorChat);

    if (source === AI_RUNTIME_SOURCES.LUMA) {
      try {
        const luma = await this.getLumaClient();
        const { message } = await luma.mentor.generateChat(input);
        return message;
      } catch (error) {
        this.logger.warn(
          `Luma mentor generation failed; falling back to core mentor generation: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return generateCoreMessage();
  }

  async judgeMentor(
    input: MentorJudgeOptions,
    judgeCore: () => Promise<AiJudgeModelResult>,
  ): Promise<AiJudgeModelResult> {
    const source = await this.resolveSource(AiCapability.AiMentorJudge);

    if (source === AI_RUNTIME_SOURCES.LUMA) {
      try {
        const luma = await this.getLumaClient();
        const result = await luma.mentor.judge(input);
        if (!Value.Check(aiJudgeJudgementSchema, result))
          throw new Error("Luma mentor Judge returned an invalid structured result");

        return result;
      } catch (error) {
        this.logger.warn(
          `Luma mentor judge failed; falling back to core mentor judge: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return judgeCore();
  }

  async generateTranslations(
    input: GenerateTranslationsOptions,
    generateCoreTranslations: () => Promise<GenerateTranslationsResponse>,
  ): Promise<GenerateTranslationsResponse> {
    if (
      (await this.resolveSource(AiCapability.TranslationGeneration)) === AI_RUNTIME_SOURCES.LUMA
    ) {
      try {
        const luma = await this.getLumaClient();

        const result = await luma.ai.generateTranslations(input);

        if (!Value.Check(generateTranslationSchema, result)) {
          throw new Error("Luma translation generation returned an invalid structured result");
        }

        return result;
      } catch (error) {
        this.logger.warn(
          `Luma translation generation failed; falling back to core translation generation: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return generateCoreTranslations();
  }

  async generateJudgeConfiguration(
    input: GenerateAiJudgeConfigurationOptions,
    generateCoreConfiguration: () => Promise<ReferencedAiJudgeConfiguration>,
  ): Promise<ReferencedAiJudgeConfiguration> {
    if (
      (await this.resolveSource(AiCapability.AiJudgeConfigurationGenerator)) ===
      AI_RUNTIME_SOURCES.LUMA
    ) {
      try {
        const luma = await this.getLumaClient();
        const result = await luma.ai.generateJudgeConfiguration(input);
        if (!Value.Check(referencedAiJudgeConfigurationStructuredOutputSchema, result))
          throw new Error("Luma AI Judge configuration generator returned an invalid result");

        return result;
      } catch (error) {
        this.logger.warn(
          `Luma AI Judge configuration generation failed; falling back to core generation: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return generateCoreConfiguration();
  }

  async generateMentorConfiguration(
    input: GenerateAiMentorConfigurationOptions,
    generateCoreConfiguration: () => Promise<GeneratedAiMentorConfigurationFields>,
  ): Promise<GeneratedAiMentorConfigurationFields> {
    if (
      (await this.resolveSource(AiCapability.AiMentorConfigurationGenerator)) ===
      AI_RUNTIME_SOURCES.LUMA
    ) {
      try {
        const luma = await this.getLumaClient();
        const result = await luma.ai.generateMentorConfiguration(input);
        const schema =
          input.configurationType === "teacher"
            ? generatedAiMentorTeacherConfigurationFieldsSchema
            : generatedAiMentorRoleplayConfigurationFieldsSchema;

        if (!Value.Check(schema, result))
          throw new Error("Luma AI Mentor configuration generator returned an invalid result");

        return result as GeneratedAiMentorConfigurationFields;
      } catch (error) {
        this.logger.warn(
          `Luma AI Mentor configuration generation failed; falling back to core generation: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return generateCoreConfiguration();
  }

  async validateJudgeConfiguration(
    input: ValidateAiJudgeConfigurationOptions,
    validateCoreConfiguration: () => Promise<AiJudgeConfigurationValidatorStructuredOutput>,
  ): Promise<AiJudgeConfigurationValidatorStructuredOutput> {
    if (
      (await this.resolveSource(AiCapability.AiJudgeConfigurationValidator)) ===
      AI_RUNTIME_SOURCES.LUMA
    ) {
      try {
        const luma = await this.getLumaClient();
        const result = await luma.ai.validateJudgeConfiguration(input);
        if (!Value.Check(aiJudgeConfigurationValidatorStructuredOutputSchema, result))
          throw new Error("Luma AI Judge configuration validator returned an invalid result");

        return result;
      } catch (error) {
        this.logger.warn(
          `Luma AI Judge configuration validation failed; falling back to core validation: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return validateCoreConfiguration();
  }

  async transcribeDictation(
    input: TranscribeDictationOptions,
    transcribeCore: () => Promise<TranscribeDictationResponse | undefined>,
  ): Promise<TranscribeDictationResponse | undefined> {
    const source = await this.resolveSource(AiCapability.DictationTranscription);

    if (source === AI_RUNTIME_SOURCES.LUMA) {
      try {
        const luma = await this.getLumaClient();
        return await luma.ai.transcribeDictation(input);
      } catch (error) {
        this.logger.warn(
          `Luma dictation transcription failed; falling back to core transcription: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return transcribeCore();
  }

  async resolveSource(capability: AiCapability): Promise<AiRuntimeSource> {
    const configuration = await this.getLumaConfiguration();
    const capabilityStatus = configuration?.capabilities?.[capability];

    if (capabilityStatus?.enabled && capabilityStatus.provider === AiCapabilityProvider.Luma) {
      return AI_RUNTIME_SOURCES.LUMA;
    }

    return AI_RUNTIME_SOURCES.CORE;
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

  private async *readLumaTextStream(stream: AsyncIterable<Buffer>): AsyncIterable<string> {
    for await (const chunk of stream) {
      const text = chunk.toString("utf8");
      if (text) {
        yield text;
      }
    }
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

  private async getLumaClient() {
    const client = await this.getLumaClientOrNull();
    if (!client) {
      throw new Error("Luma is not configured");
    }

    return client;
  }

  private async getLumaClientOrNull() {
    const [apiKey, baseURL] = await Promise.all([
      this.envService
        .getEnv("LUMA_API_KEY")
        .then((r) => r.value)
        .catch(() => process.env.LUMA_API_KEY),
      Promise.resolve(process.env.LUMA_BASE_URL),
    ]);

    if (!apiKey || !baseURL) {
      return null;
    }

    return createLumaClient({ apiKey, baseURL });
  }
}
