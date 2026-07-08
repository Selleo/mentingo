import { createOpenAI } from "@ai-sdk/openai";
import {
  AiCapability,
  AiCapabilityProvider,
  createLumaClient,
  type AiRuntimeConfiguration,
} from "@japro/luma-sdk";
import { Injectable, Logger } from "@nestjs/common";
import { embedMany } from "ai";

import { LUMA_CONFIGURATION_CACHE_TTL_MS } from "src/ai/ai-runtime.constants";
import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";
import { EnvService } from "src/env/services/env.service";
import { dbAls } from "src/storage/db/db-als.store";

import type { OpenAIProvider } from "@ai-sdk/openai";
import type { AiRuntimeSource } from "src/ai/ai-runtime.types";

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
    const { embeddings } = await embedMany({
      model: provider.embeddingModel(OPENAI_MODELS.EMBEDDING),
      values: contents,
    });

    return embeddings;
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
