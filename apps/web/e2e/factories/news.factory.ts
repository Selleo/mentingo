import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type { SupportedLanguages } from "@repo/shared";
import type { GetNewsResponse, GetNewsListResponse, UpdateNewsBody } from "~/api/generated-api";

export type NewsFactoryRecord = GetNewsResponse["data"];
export type NewsFactoryListRecord = GetNewsListResponse["data"][number];
export type NewsFactoryCreateInput = {
  language?: SupportedLanguages;
  title?: string;
  summary?: string;
  content?: string;
  status?: "draft" | "published";
  isPublic?: boolean;
};

export type NewsFactoryUpdateInput = NewsFactoryCreateInput;

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

const toUpdateNewsFormData = (
  language: SupportedLanguages,
  data: NewsFactoryUpdateInput,
): FormData => {
  const formData = new FormData();

  formData.append("language", language);
  if (data.title !== undefined) formData.append("title", data.title);
  if (data.summary !== undefined) formData.append("summary", data.summary);
  if (data.content !== undefined) formData.append("content", data.content);
  if (data.status !== undefined) formData.append("status", data.status);
  if (data.isPublic !== undefined) formData.append("isPublic", String(data.isPublic));

  return formData;
};

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

  async findByTitle(
    title: string,
    language: SupportedLanguages = "en",
  ): Promise<NewsFactoryListRecord | null> {
    const response = await this.apiClient.api.newsControllerGetNewsList({
      language,
      page: 1,
      searchQuery: title,
    });

    return response.data.data.find((news) => news.title === title) ?? null;
  }

  async update(id: string, data: NewsFactoryUpdateInput): Promise<NewsFactoryRecord> {
    const language = data.language ?? "en";

    await this.apiClient.api.newsControllerUpdateNews(
      id,
      toUpdateNewsFormData(language, data) as unknown as UpdateNewsBody,
    );

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
