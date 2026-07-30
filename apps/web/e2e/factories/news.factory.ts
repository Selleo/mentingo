import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type { SupportedLanguages } from "@repo/shared";
import type { GetNewsResponse } from "~/api/generated-api";

export type NewsFactoryRecord = GetNewsResponse["data"];
export type NewsFactoryCreateInput = {
  language?: SupportedLanguages;
  title?: string;
  summary?: string;
  content?: string;
  status?: "draft" | "published";
  isPublic?: boolean;
};

export type NewsFactoryUpdateInput = NewsFactoryCreateInput;
type UpdateNewsPayload = Parameters<FixtureApiClient["api"]["newsControllerUpdateNews"]>[1];

const createNewsDefaults = () => {
  const suffix = randomUUID().slice(0, 8);

  return {
    title: `${TEST_DATA.news.titlePrefix} ${suffix}`,
    summary: `${TEST_DATA.news.summaryPrefix} ${suffix}`,
    content: `<p>${TEST_DATA.news.summaryPrefix} ${suffix}</p>`,
    status: "published" as const,
    isPublic: true,
  };
};

const toUpdateNewsPayload = (
  language: SupportedLanguages,
  data: NewsFactoryUpdateInput,
): UpdateNewsPayload => ({
  translations: JSON.stringify([
    {
      language,
      title: data.title,
      summary: data.summary,
      content: data.content,
    },
  ]),
  ...(data.status !== undefined ? { status: data.status } : {}),
  ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}),
});

export class NewsFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(input: NewsFactoryCreateInput = {}): Promise<NewsFactoryRecord> {
    const language = input.language ?? "en";
    const createResponse = await this.apiClient.api.newsControllerCreateNews({ language });
    const createdId = createResponse.data.data.id;
    const defaults = createNewsDefaults();

    await this.update(createdId, {
      language,
      title: input.title ?? defaults.title,
      summary: input.summary ?? defaults.summary,
      content: input.content ?? defaults.content,
      status: input.status ?? defaults.status,
      isPublic: input.isPublic ?? defaults.isPublic,
    });

    return this.getById(createdId, language);
  }

  async getById(id: string, language: SupportedLanguages = "en"): Promise<NewsFactoryRecord> {
    const response = await this.apiClient.api.newsControllerGetNews(id, { language });
    return response.data.data;
  }

  async update(id: string, data: NewsFactoryUpdateInput): Promise<NewsFactoryRecord> {
    const language = data.language ?? "en";

    await this.apiClient.api.newsControllerUpdateNews(id, toUpdateNewsPayload(language, data));

    return this.getById(id, language);
  }

  async delete(id: string): Promise<void> {
    await this.apiClient.api.newsControllerDeleteNews(id);
  }

  async safeGetById(
    id: string,
    language: SupportedLanguages = "en",
  ): Promise<NewsFactoryRecord | null> {
    try {
      return await this.getById(id, language);
    } catch {
      return null;
    }
  }

  async safeGetByIdAnyLanguage(id: string): Promise<NewsFactoryRecord | null> {
    for (const language of Object.values(SUPPORTED_LANGUAGES)) {
      const news = await this.safeGetById(id, language);

      if (news) return news;
    }

    return null;
  }
}
