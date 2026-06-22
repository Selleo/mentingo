import { Injectable } from "@nestjs/common";
import { SUPPORTED_LANGUAGES, isSupportedLanguage } from "@repo/shared";

import {
  SEARCH_DOCUMENT_TYPES,
  SEARCH_DOCUMENT_WEIGHTS,
  SEARCH_ENTITY_TYPES,
} from "./global-search.constants";
import { SearchIndexRepository } from "./search-index.repository";

import type {
  DeleteSearchDocumentsInput,
  LocalizedRecord,
  ReplaceSearchDocumentsInput,
  SearchDocumentInput,
  SearchDocumentWeight,
} from "./global-search.types";
import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class SearchIndexService {
  constructor(private readonly searchIndexRepository: SearchIndexRepository) {}

  async replaceEntityDocuments(input: ReplaceSearchDocumentsInput) {
    return this.searchIndexRepository.replaceEntityDocuments(input);
  }

  async deleteEntityDocuments(input: DeleteSearchDocumentsInput) {
    return this.searchIndexRepository.deleteEntityDocuments(input);
  }

  async deleteEntityDocumentsByIds(
    entityType: DeleteSearchDocumentsInput["entityType"],
    entityIds: UUIDType[],
    dbInstance?: DatabasePg,
  ) {
    return this.searchIndexRepository.deleteEntityDocumentsByIds(entityType, entityIds, dbInstance);
  }

  async refreshLessons(lessonIds: UUIDType[], dbInstance?: DatabasePg) {
    return this.searchIndexRepository.refreshLessonDocuments(lessonIds, dbInstance);
  }

  async refreshCourse(courseId: UUIDType, dbInstance?: DatabasePg) {
    const [course] = await this.searchIndexRepository.getCourseSearchSource(courseId, dbInstance);

    if (!course) {
      await this.deleteEntityDocuments({
        entityType: SEARCH_ENTITY_TYPES.COURSE,
        entityId: courseId,
        db: dbInstance,
      });
      return;
    }

    await this.replaceEntityDocuments({
      entityType: SEARCH_ENTITY_TYPES.COURSE,
      entityId: course.id,
      documents: [
        ...this.localizedDocuments(course.title, course.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.TITLE,
          weight: SEARCH_DOCUMENT_WEIGHTS.A,
        }),
        ...this.localizedDocuments(course.description, course.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.DESCRIPTION,
          weight: SEARCH_DOCUMENT_WEIGHTS.B,
        }),
      ],
      db: dbInstance,
    });
  }

  async refreshLearningPath(learningPathId: UUIDType, dbInstance?: DatabasePg) {
    const [learningPath] = await this.searchIndexRepository.getLearningPathSearchSource(
      learningPathId,
      dbInstance,
    );

    if (!learningPath) {
      await this.deleteEntityDocuments({
        entityType: SEARCH_ENTITY_TYPES.LEARNING_PATH,
        entityId: learningPathId,
        db: dbInstance,
      });
      return;
    }

    await this.replaceEntityDocuments({
      entityType: SEARCH_ENTITY_TYPES.LEARNING_PATH,
      entityId: learningPath.id,
      documents: [
        ...this.localizedDocuments(learningPath.title, learningPath.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.TITLE,
          weight: SEARCH_DOCUMENT_WEIGHTS.A,
        }),
        ...this.localizedDocuments(learningPath.description, learningPath.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.DESCRIPTION,
          weight: SEARCH_DOCUMENT_WEIGHTS.B,
        }),
      ],
      db: dbInstance,
    });
  }

  async refreshNews(newsId: UUIDType, dbInstance?: DatabasePg) {
    const [newsRow] = await this.searchIndexRepository.getNewsSearchSource(newsId, dbInstance);

    if (!newsRow) {
      await this.deleteEntityDocuments({
        entityType: SEARCH_ENTITY_TYPES.NEWS,
        entityId: newsId,
        db: dbInstance,
      });
      return;
    }

    await this.replaceEntityDocuments({
      entityType: SEARCH_ENTITY_TYPES.NEWS,
      entityId: newsRow.id,
      documents: [
        ...this.localizedDocuments(newsRow.title, newsRow.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.TITLE,
          weight: SEARCH_DOCUMENT_WEIGHTS.A,
        }),
        ...this.localizedDocuments(newsRow.summary, newsRow.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.SUMMARY,
          weight: SEARCH_DOCUMENT_WEIGHTS.B,
        }),
        ...this.localizedDocuments(newsRow.content, newsRow.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.CONTENT,
          weight: SEARCH_DOCUMENT_WEIGHTS.C,
        }),
      ],
      db: dbInstance,
    });
  }

  async refreshArticle(articleId: UUIDType, dbInstance?: DatabasePg) {
    const [article] = await this.searchIndexRepository.getArticleSearchSource(
      articleId,
      dbInstance,
    );

    if (!article) {
      await this.deleteEntityDocuments({
        entityType: SEARCH_ENTITY_TYPES.ARTICLE,
        entityId: articleId,
        db: dbInstance,
      });
      return;
    }

    await this.replaceEntityDocuments({
      entityType: SEARCH_ENTITY_TYPES.ARTICLE,
      entityId: article.id,
      documents: [
        ...this.localizedDocuments(article.title, article.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.TITLE,
          weight: SEARCH_DOCUMENT_WEIGHTS.A,
        }),
        ...this.localizedDocuments(article.summary, article.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.SUMMARY,
          weight: SEARCH_DOCUMENT_WEIGHTS.B,
        }),
        ...this.localizedDocuments(article.content, article.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.CONTENT,
          weight: SEARCH_DOCUMENT_WEIGHTS.C,
        }),
      ],
      db: dbInstance,
    });
  }

  async refreshQA(qaId: UUIDType, dbInstance?: DatabasePg) {
    const [qa] = await this.searchIndexRepository.getQASearchSource(qaId, dbInstance);

    if (!qa) {
      await this.deleteEntityDocuments({
        entityType: SEARCH_ENTITY_TYPES.QA,
        entityId: qaId,
        db: dbInstance,
      });
      return;
    }

    await this.replaceEntityDocuments({
      entityType: SEARCH_ENTITY_TYPES.QA,
      entityId: qa.id,
      documents: [
        ...this.localizedDocuments(qa.title, qa.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.TITLE,
          weight: SEARCH_DOCUMENT_WEIGHTS.A,
        }),
        ...this.localizedDocuments(qa.description, qa.availableLocales, {
          documentType: SEARCH_DOCUMENT_TYPES.DESCRIPTION,
          weight: SEARCH_DOCUMENT_WEIGHTS.B,
        }),
      ],
      db: dbInstance,
    });
  }

  async refreshLesson(lessonId: UUIDType, dbInstance?: DatabasePg) {
    await this.refreshLessons([lessonId], dbInstance);
  }

  private localizedDocuments(
    value: LocalizedRecord,
    availableLocales: SupportedLanguages[] | null | undefined,
    options: {
      documentType: string;
      weight: SearchDocumentWeight;
      metadata?: Record<string, unknown>;
    },
  ): SearchDocumentInput[] {
    return this.resolveLocales(availableLocales, value)
      .map((language) => ({
        documentType: options.documentType,
        language,
        content: this.contentToText(this.localizedValue(value, language)),
        weight: options.weight,
        metadata: options.metadata,
      }))
      .filter((document) => document.content.length > 0);
  }

  private resolveLocales(
    availableLocales: SupportedLanguages[] | null | undefined,
    ...values: LocalizedRecord[]
  ): SupportedLanguages[] {
    const locales = new Set<SupportedLanguages>();

    for (const language of availableLocales ?? []) {
      if (isSupportedLanguage(language)) locales.add(language);
    }

    for (const value of values) {
      for (const language of Object.keys(this.asRecord(value))) {
        if (isSupportedLanguage(language)) locales.add(language);
      }
    }

    if (locales.size === 0) locales.add(SUPPORTED_LANGUAGES.EN);

    return [...locales];
  }

  private localizedValue(value: LocalizedRecord, language: SupportedLanguages) {
    return this.asRecord(value)[language];
  }

  private asRecord(value: LocalizedRecord): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private contentToText(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  }
}
