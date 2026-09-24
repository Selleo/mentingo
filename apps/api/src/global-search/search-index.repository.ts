import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import {
  articles,
  chapters,
  courses,
  learningPaths,
  lessons,
  news,
  assessmentQuestionChoiceOptions,
  assessmentQuestionTrueFalseStatements,
  assessmentQuestionScaleOptions,
  assessmentQuestionDragAndDropOptions,
  assessmentQuestions,
  assessments,
  questionsAndAnswers,
  resourceEntity,
  resources,
  searchDocuments,
} from "src/storage/schema";

import {
  getSearchLanguageConfig,
  SEARCH_DOCUMENT_TYPES,
  SEARCH_DOCUMENT_WEIGHTS,
  SEARCH_ENTITY_TYPES,
} from "./global-search.constants";

import type {
  DeleteSearchDocumentsInput,
  DocumentSelectionInput,
  LessonLocalizedFieldQueryInput,
  QuestionLocalizedFieldQueryInput,
  ReplaceSearchDocumentsInput,
  SearchDocumentWeight,
} from "./global-search.types";
import type { SupportedLanguages } from "@repo/shared";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import type { UUIDType } from "src/common";

@Injectable()
export class SearchIndexRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  private asLocalizedJsonbObject(fieldExpression: SQL | AnyPgColumn) {
    return sql`
      CASE
        WHEN jsonb_typeof(${fieldExpression}) = 'object' THEN ${fieldExpression}
        ELSE '{}'::jsonb
      END
    `;
  }

  async replaceEntityDocuments(input: ReplaceSearchDocumentsInput) {
    const db = input.db ?? this.db;

    await this.deleteEntityDocuments({
      entityType: input.entityType,
      entityId: input.entityId,
      db,
    });

    const documents = input.documents.filter((document) => document.content.trim().length > 0);
    if (documents.length === 0) return;

    await db.insert(searchDocuments).values(
      documents.map(({ weight, ...document }) => ({
        entityType: input.entityType,
        entityId: input.entityId,
        documentType: document.documentType,
        language: document.language,
        content: document.content.trim(),
        metadata: document.metadata ?? {},
        searchVector: sql`
          setweight(
            to_tsvector(${getSearchLanguageConfig(
              document.language,
            )}::regconfig, ${document.content.trim()}),
            ${weight}
          )
        `,
      })),
    );
  }

  async deleteEntityDocuments(input: DeleteSearchDocumentsInput) {
    const db = input.db ?? this.db;

    await db
      .delete(searchDocuments)
      .where(
        and(
          eq(searchDocuments.entityType, input.entityType),
          eq(searchDocuments.entityId, input.entityId),
        ),
      );
  }

  async deleteEntityDocumentsByIds(
    entityType: DeleteSearchDocumentsInput["entityType"],
    entityIds: UUIDType[],
    dbInstance?: DatabasePg,
  ) {
    if (entityIds.length === 0) return;
    const db = dbInstance ?? this.db;

    await db
      .delete(searchDocuments)
      .where(
        and(
          eq(searchDocuments.entityType, entityType),
          inArray(searchDocuments.entityId, entityIds),
        ),
      );
  }

  getCourseSearchSource(courseId: UUIDType, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    return db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        availableLocales: courses.availableLocales,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
  }

  getLearningPathSearchSource(learningPathId: UUIDType, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    return db
      .select({
        id: learningPaths.id,
        title: learningPaths.title,
        description: learningPaths.description,
        availableLocales: learningPaths.availableLocales,
      })
      .from(learningPaths)
      .where(eq(learningPaths.id, learningPathId))
      .limit(1);
  }

  getNewsSearchSource(newsId: UUIDType, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    return db
      .select({
        id: news.id,
        title: news.title,
        summary: news.summary,
        content: news.content,
        availableLocales: news.availableLocales,
      })
      .from(news)
      .where(eq(news.id, newsId))
      .limit(1);
  }

  getArticleSearchSource(articleId: UUIDType, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    return db
      .select({
        id: articles.id,
        title: articles.title,
        summary: articles.summary,
        content: articles.content,
        availableLocales: articles.availableLocales,
      })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);
  }

  getQASearchSource(qaId: UUIDType, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    return db
      .select({
        id: questionsAndAnswers.id,
        title: questionsAndAnswers.title,
        description: questionsAndAnswers.description,
        availableLocales: questionsAndAnswers.availableLocales,
      })
      .from(questionsAndAnswers)
      .where(eq(questionsAndAnswers.id, qaId))
      .limit(1);
  }

  async refreshLessonDocuments(lessonIds: UUIDType[], dbInstance?: DatabasePg) {
    if (lessonIds.length === 0) return;
    const db = dbInstance ?? this.db;

    await this.deleteEntityDocumentsByIds(SEARCH_ENTITY_TYPES.LESSON, lessonIds, db);

    const docs = db
      .$with("lesson_search_documents")
      .as(this.buildLessonDocumentsQuery(db, lessonIds));

    const documents = await db
      .with(docs)
      .select({
        tenantId: docs.tenantId,
        entityType: docs.entityType,
        entityId: docs.entityId,
        documentType: docs.documentType,
        language: docs.language,
        content: sql<string>`trim(${docs.content})`,
        weight: docs.weight,
        metadata: docs.metadata,
      })
      .from(docs)
      .where(sql`length(trim(${docs.content})) > 0`);

    if (documents.length === 0) return;

    await db
      .insert(searchDocuments)
      .values(
        documents.map(({ weight, ...document }) => ({
          ...document,
          searchVector: this.buildSearchVector(document.language, document.content, weight),
        })),
      )
      .onConflictDoUpdate({
        target: [
          searchDocuments.tenantId,
          searchDocuments.entityType,
          searchDocuments.entityId,
          searchDocuments.documentType,
          searchDocuments.language,
        ],
        set: {
          content: sql`EXCLUDED.content`,
          searchVector: sql`EXCLUDED.search_vector`,
          metadata: sql`EXCLUDED.metadata`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }

  private buildLessonDocumentsQuery(db: DatabasePg, lessonIds: UUIDType[]) {
    return unionAll(
      this.buildLessonLocalizedFieldQuery({
        db,
        lessonIds,
        fieldExpression: lessons.title,
        lateralAlias: "title",
        documentType: SEARCH_DOCUMENT_TYPES.TITLE,
        weight: SEARCH_DOCUMENT_WEIGHTS.B,
      }),
      this.buildLessonLocalizedFieldQuery({
        db,
        lessonIds,
        fieldExpression: sql`COALESCE(${lessons.description}, '{}'::jsonb)`,
        lateralAlias: "description",
        documentType: SEARCH_DOCUMENT_TYPES.DESCRIPTION,
        weight: SEARCH_DOCUMENT_WEIGHTS.C,
      }),
      this.buildQuestionLocalizedFieldQuery({
        db,
        lessonIds,
        fieldExpression: assessmentQuestions.title,
        lateralAlias: "title",
        documentType: sql<string>`'question_title:' || ${assessmentQuestions.id}::text`,
        weight: SEARCH_DOCUMENT_WEIGHTS.B,
        metadata: sql<Record<string, unknown>>`
          JSONB_BUILD_OBJECT('sliceType', 'question_title', 'questionId', ${assessmentQuestions.id})
        `,
      }),
      this.buildQuestionLocalizedFieldQuery({
        db,
        lessonIds,
        fieldExpression: sql`COALESCE(${assessmentQuestions.prompt}, '{}'::jsonb)`,
        lateralAlias: "description",
        documentType: sql<string>`'question_description:' || ${assessmentQuestions.id}::text`,
        weight: SEARCH_DOCUMENT_WEIGHTS.C,
        metadata: sql<Record<string, unknown>>`
          JSONB_BUILD_OBJECT('sliceType', 'question_description', 'questionId', ${assessmentQuestions.id})
        `,
      }),
      this.buildAnswerOptionDocumentsQuery(db, lessonIds),
      this.buildResourceDocumentsQuery(db, lessonIds),
    );
  }

  private buildLessonLocalizedFieldQuery({
    db,
    lessonIds,
    fieldExpression,
    lateralAlias,
    documentType,
    weight,
  }: LessonLocalizedFieldQueryInput) {
    return db
      .select(
        this.buildDocumentSelection({
          tenantId: lessons.tenantId,
          entityId: lessons.id,
          documentType: sql<string>`${documentType}`,
          language: sql<SupportedLanguages>`${sql.raw(lateralAlias)}.lang`,
          content: sql<string>`${sql.raw(lateralAlias)}.value`,
          weight,
        }),
      )
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .innerJoin(
        sql`LATERAL jsonb_each_text(${this.asLocalizedJsonbObject(fieldExpression)}) AS ${sql.raw(
          lateralAlias,
        )}(lang, value)`,
        sql`true`,
      )
      .where(
        and(
          inArray(lessons.id, lessonIds),
          sql`${sql.raw(lateralAlias)}.lang = ANY(${courses.availableLocales})`,
          sql`LENGTH(TRIM(${sql.raw(lateralAlias)}.value)) > 0`,
        ),
      );
  }

  private buildQuestionLocalizedFieldQuery({
    db,
    lessonIds,
    fieldExpression,
    lateralAlias,
    documentType,
    weight,
    metadata,
  }: QuestionLocalizedFieldQueryInput) {
    return db
      .select(
        this.buildDocumentSelection({
          tenantId: assessmentQuestions.tenantId,
          entityId: lessons.id,
          documentType,
          language: sql<SupportedLanguages>`${sql.raw(lateralAlias)}.lang`,
          content: sql<string>`${sql.raw(lateralAlias)}.value`,
          weight,
          metadata,
        }),
      )
      .from(assessmentQuestions)
      .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
      .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .innerJoin(
        sql`LATERAL jsonb_each_text(${this.asLocalizedJsonbObject(fieldExpression)}) AS ${sql.raw(
          lateralAlias,
        )}(lang, value)`,
        sql`true`,
      )
      .where(
        and(
          inArray(lessons.id, lessonIds),
          sql`${sql.raw(lateralAlias)}.lang = ANY(${courses.availableLocales})`,
          sql`length(trim(${sql.raw(lateralAlias)}.value)) > 0`,
        ),
      );
  }

  private buildAnswerOptionDocumentsQuery(db: DatabasePg, lessonIds: UUIDType[]) {
    const buildOptionQuery = (
      optionTable: AnyPgTable,
      optionId: AnyPgColumn,
      optionQuestionId: AnyPgColumn,
      optionTenantId: AnyPgColumn,
      optionLanguage: SQL | AnyPgColumn,
      optionLabel: SQL | AnyPgColumn,
    ) =>
      db
        .select(
          this.buildDocumentSelection({
            tenantId: optionTenantId,
            entityId: lessons.id,
            documentType: sql<string>`'answer_option:' || ${optionId}::text`,
            language: sql<SupportedLanguages>`${optionLanguage}`,
            content: sql<string>`${optionLabel}`,
            weight: SEARCH_DOCUMENT_WEIGHTS.C,
            metadata: sql<Record<string, unknown>>`
          JSONB_BUILD_OBJECT(
            'sliceType',
            'answer_option',
            'questionId',
            ${assessmentQuestions.id},
            'answerOptionId',
            ${optionId}
          )
        `,
          }),
        )
        .from(optionTable)
        .innerJoin(assessmentQuestions, eq(assessmentQuestions.id, optionQuestionId))
        .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
        .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .innerJoin(courses, eq(courses.id, chapters.courseId))
        .where(
          and(
            inArray(lessons.id, lessonIds),
            sql`${optionLanguage} = ANY(${courses.availableLocales})`,
            sql`LENGTH(TRIM(${optionLabel})) > 0`,
          ),
        );

    const scaleOptionQuery = db
      .select(
        this.buildDocumentSelection({
          tenantId: assessmentQuestionScaleOptions.tenantId,
          entityId: lessons.id,
          documentType: sql<string>`'answer_option:' || ${assessmentQuestionScaleOptions.id}::text`,
          language: sql<SupportedLanguages>`scale_locale.lang`,
          content: sql<string>`scale_locale.value`,
          weight: SEARCH_DOCUMENT_WEIGHTS.C,
          metadata: sql<Record<string, unknown>>`
            JSONB_BUILD_OBJECT(
              'sliceType', 'answer_option',
              'questionId', ${assessmentQuestions.id},
              'answerOptionId', ${assessmentQuestionScaleOptions.id}
            )
          `,
        }),
      )
      .from(assessmentQuestionScaleOptions)
      .innerJoin(
        assessmentQuestions,
        eq(assessmentQuestions.id, assessmentQuestionScaleOptions.questionId),
      )
      .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
      .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .innerJoin(
        sql`LATERAL JSONB_EACH_TEXT(${this.asLocalizedJsonbObject(assessmentQuestionScaleOptions.label)}) AS scale_locale(lang, value)`,
        sql`true`,
      )
      .where(
        and(
          inArray(lessons.id, lessonIds),
          sql`scale_locale.lang = ANY(${courses.availableLocales})`,
          sql`LENGTH(TRIM(scale_locale.value)) > 0`,
        ),
      );

    return unionAll(
      buildOptionQuery(
        assessmentQuestionChoiceOptions,
        assessmentQuestionChoiceOptions.id,
        assessmentQuestionChoiceOptions.questionId,
        assessmentQuestionChoiceOptions.tenantId,
        assessmentQuestionChoiceOptions.language,
        assessmentQuestionChoiceOptions.label,
      ),
      buildOptionQuery(
        assessmentQuestionTrueFalseStatements,
        assessmentQuestionTrueFalseStatements.id,
        assessmentQuestionTrueFalseStatements.questionId,
        assessmentQuestionTrueFalseStatements.tenantId,
        assessmentQuestionTrueFalseStatements.language,
        assessmentQuestionTrueFalseStatements.statement,
      ),
      scaleOptionQuery,
      buildOptionQuery(
        assessmentQuestionDragAndDropOptions,
        assessmentQuestionDragAndDropOptions.id,
        assessmentQuestionDragAndDropOptions.questionId,
        assessmentQuestionDragAndDropOptions.tenantId,
        assessmentQuestionDragAndDropOptions.language,
        assessmentQuestionDragAndDropOptions.label,
      ),
    );
  }

  private buildResourceDocumentsQuery(db: DatabasePg, lessonIds: UUIDType[]) {
    const fileName = sql<string>`
      COALESCE(
        NULLIF(${resources.metadata}->>'originalFilename', ''),
        NULLIF(regexp_replace(${resources.reference}, '^.*/', ''), '')
      )
    `;
    const content = sql<string>`
      TRIM(CONCAT_WS(' ', ${fileName}, COALESCE(${resources.title}->>locale.lang, '')))
    `;

    return db
      .select(
        this.buildDocumentSelection({
          tenantId: resourceEntity.tenantId,
          entityId: resourceEntity.entityId,
          documentType: sql<string>`'resource:' || ${resources.id}::text`,
          language: sql<SupportedLanguages>`locale.lang`,
          content,
          weight: SEARCH_DOCUMENT_WEIGHTS.D,
          metadata: sql<Record<string, unknown>>`
          JSONB_BUILD_OBJECT(
            'sliceType',
            'resource',
            'resourceId',
            ${resources.id},
            'fileName',
            ${fileName}
          )
        `,
        }),
      )
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .innerJoin(lessons, eq(lessons.id, resourceEntity.entityId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .innerJoin(sql`LATERAL unnest(${courses.availableLocales}) AS locale(lang)`, sql`true`)
      .where(
        and(
          inArray(lessons.id, lessonIds),
          eq(resourceEntity.entityType, SEARCH_ENTITY_TYPES.LESSON),
          eq(resourceEntity.relationshipType, "attachment"),
          eq(resources.archived, false),
          sql`length(${content}) > 0`,
        ),
      );
  }

  private buildDocumentSelection({
    tenantId,
    entityId,
    documentType,
    language,
    content,
    weight,
    metadata = sql<Record<string, unknown>>`'{}'::jsonb`,
  }: DocumentSelectionInput) {
    return {
      tenantId: sql<UUIDType>`${tenantId}`.as("tenant_id"),
      entityType: sql<string>`${SEARCH_ENTITY_TYPES.LESSON}`.as("entity_type"),
      entityId: sql<UUIDType>`${entityId}`.as("entity_id"),
      documentType: sql<string>`${documentType}`.as("document_type"),
      language: sql<SupportedLanguages>`${language}`.as("language"),
      content: sql<string>`${content}`.as("content"),
      weight: sql<SearchDocumentWeight>`${weight}`.as("weight"),
      metadata: sql<Record<string, unknown>>`${metadata}`.as("metadata"),
    };
  }

  private buildSearchVector(
    language: SupportedLanguages,
    content: string,
    weight: SearchDocumentWeight,
  ) {
    return sql`
      setweight(to_tsvector(${getSearchLanguageConfig(language)}::regconfig, ${content}), ${weight})
    `;
  }
}
