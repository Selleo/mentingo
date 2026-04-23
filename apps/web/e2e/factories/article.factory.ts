import { randomUUID } from "node:crypto";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type { SupportedLanguages } from "@repo/shared";
import type {
  CreateArticleBody,
  GetArticleResponse,
  GetArticleSectionResponse,
  GetArticleTocResponse,
  UpdateArticleBody,
  UpdateArticleSectionBody,
} from "~/api/generated-api";

export type ArticleFactoryRecord = GetArticleResponse["data"];
export type ArticleSectionFactoryRecord = GetArticleSectionResponse["data"];
export type ArticleTocSectionRecord = GetArticleTocResponse["data"]["sections"][number];

export type ArticleFactoryCreateInput = {
  language?: SupportedLanguages;
  sectionId?: string;
  sectionTitle?: string;
  title?: string;
  summary?: string;
  content?: string;
  status?: "draft" | "published";
  isPublic?: boolean;
};

export type ArticleFactoryUpdateInput = Omit<
  ArticleFactoryCreateInput,
  "sectionId" | "sectionTitle"
>;
export type ArticleSectionFactoryCreateInput = {
  language?: SupportedLanguages;
  title?: string;
};

const createArticleDefaults = () => {
  const suffix = randomUUID().slice(0, 8);

  return {
    title: `${TEST_DATA.article.titlePrefix} ${suffix}`,
    summary: `${TEST_DATA.article.summaryPrefix} ${suffix}`,
    content: `<p>${TEST_DATA.article.summaryPrefix} ${suffix}</p>`,
    status: "published" as const,
    isPublic: true,
  };
};

const createSectionTitle = () =>
  `${TEST_DATA.article.sectionTitlePrefix} ${randomUUID().slice(0, 8)}`;

const toUpdateArticleFormData = (
  language: SupportedLanguages,
  data: ArticleFactoryUpdateInput,
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

export class ArticleFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async createSection(
    input: ArticleSectionFactoryCreateInput = {},
  ): Promise<ArticleSectionFactoryRecord> {
    const language = input.language ?? "en";
    const response = await this.apiClient.api.articlesControllerCreateArticleSection({ language });
    const sectionId = response.data.data.id;

    if (input.title) {
      await this.updateSection(sectionId, { language, title: input.title });
      return this.getSectionById(sectionId, language);
    }

    return this.getSectionById(sectionId, language);
  }

  async create(input: ArticleFactoryCreateInput = {}): Promise<ArticleFactoryRecord> {
    const language = input.language ?? "en";
    let sectionId = input.sectionId;

    if (!sectionId) {
      const section = await this.createSection({
        language,
        title: input.sectionTitle ?? createSectionTitle(),
      });
      sectionId = section.id;
    }

    const response = await this.apiClient.api.articlesControllerCreateArticle({
      language,
      sectionId,
    } satisfies CreateArticleBody);

    const articleId = response.data.data.id;
    const defaults = createArticleDefaults();

    await this.update(articleId, {
      language,
      title: input.title ?? defaults.title,
      summary: input.summary ?? defaults.summary,
      content: input.content ?? defaults.content,
      status: input.status ?? defaults.status,
      isPublic: input.isPublic ?? defaults.isPublic,
    });

    return this.getById(articleId, language);
  }

  async createWithSection(input: ArticleFactoryCreateInput = {}): Promise<{
    article: ArticleFactoryRecord;
    section: ArticleSectionFactoryRecord;
  }> {
    const language = input.language ?? "en";
    const section = input.sectionId
      ? await this.getSectionById(input.sectionId, language)
      : await this.createSection({
          language,
          title: input.sectionTitle ?? createSectionTitle(),
        });

    const article = await this.create({
      ...input,
      language,
      sectionId: section.id,
    });

    return { article, section };
  }

  async getById(id: string, language: SupportedLanguages = "en"): Promise<ArticleFactoryRecord> {
    const response = await this.apiClient.api.articlesControllerGetArticle(id, { language });
    return response.data.data;
  }

  async safeGetById(
    id: string,
    language: SupportedLanguages = "en",
  ): Promise<ArticleFactoryRecord | null> {
    try {
      return await this.getById(id, language);
    } catch {
      return null;
    }
  }

  async update(id: string, data: ArticleFactoryUpdateInput): Promise<ArticleFactoryRecord> {
    const language = data.language ?? "en";

    await this.apiClient.api.articlesControllerUpdateArticle(
      id,
      toUpdateArticleFormData(language, data) as unknown as UpdateArticleBody,
    );

    return this.getById(id, language);
  }

  async delete(id: string): Promise<void> {
    await this.apiClient.api.articlesControllerDeleteArticle(id);
  }

  async getSectionById(
    id: string,
    language: SupportedLanguages = "en",
  ): Promise<ArticleSectionFactoryRecord> {
    const response = await this.apiClient.api.articlesControllerGetArticleSection(id, { language });
    return response.data.data;
  }

  async safeGetSectionById(
    id: string,
    language: SupportedLanguages = "en",
  ): Promise<ArticleSectionFactoryRecord | null> {
    try {
      return await this.getSectionById(id, language);
    } catch {
      return null;
    }
  }

  async updateSection(
    id: string,
    data: ArticleSectionFactoryCreateInput,
  ): Promise<ArticleSectionFactoryRecord> {
    const language = data.language ?? "en";

    await this.apiClient.api.articlesControllerUpdateArticleSection(id, {
      language,
      title: data.title,
    } as UpdateArticleSectionBody);

    return this.getSectionById(id, language);
  }

  async deleteSection(id: string): Promise<void> {
    await this.apiClient.api.articlesControllerDeleteArticleSection(id);
  }

  async getToc(
    language: SupportedLanguages = "en",
    isDraftMode?: boolean,
  ): Promise<ArticleTocSectionRecord[]> {
    const response = await this.apiClient.api.articlesControllerGetArticleToc({
      language,
      ...(isDraftMode === undefined ? {} : { isDraftMode }),
    });
    return response.data.data.sections;
  }
}
