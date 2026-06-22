import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT, LEARNING_PATH_STATUSES } from "@repo/shared";
import { and, desc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { normalizeSearchTerm } from "src/common/utils/normalizeSearchTerm";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  articleSections,
  articles,
  categories,
  chapters,
  courses,
  groupUsers,
  groups,
  learningPathCourses,
  learningPaths,
  lessons,
  news,
  questionsAndAnswers,
  searchDocuments,
  studentCourses,
  studentLearningPaths,
  users,
} from "src/storage/schema";

import {
  getSearchLanguageConfig,
  SEARCH_DOCUMENT_TYPES,
  SEARCH_ENTITY_TYPES,
} from "./global-search.constants";
import { GLOBAL_SEARCH_LESSON_ACCESS } from "./global-search.types";

import type { GlobalSearchLessonAccess, MatchRow, SearchEntityType } from "./global-search.types";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class GlobalSearchRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findMatches(
    entityType: SearchEntityType,
    language: SupportedLanguages,
    searchQuery: string,
  ): Promise<MatchRow[]> {
    const tsQuery = this.buildTsQuery(searchQuery, language);

    return this.db
      .select({
        entityId: searchDocuments.entityId,
        rank: sql<number>`MAX(ts_rank(${searchDocuments.searchVector}, ${tsQuery}))`,
      })
      .from(searchDocuments)
      .where(
        and(
          eq(searchDocuments.entityType, entityType),
          eq(searchDocuments.language, language),
          sql`${searchDocuments.searchVector} @@ ${tsQuery}`,
        ),
      )
      .groupBy(searchDocuments.entityId)
      .orderBy(desc(sql`MAX(ts_rank(${searchDocuments.searchVector}, ${tsQuery}))`))
      .limit(10);
  }

  async getCourseRows(
    matches: MatchRow[],
    language: SupportedLanguages,
    options: {
      authorId?: UUIDType;
      enrolledStudentId?: UUIDType;
      publishedOnly?: boolean;
    } = {},
  ) {
    const ids = this.matchIds(matches);
    if (ids.length === 0) return [];

    const query = this.db
      .select({
        id: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
        category: this.localizationService.getLocalizedSqlField(
          categories.title,
          language,
          categories,
        ),
        thumbnailUrl: courses.thumbnailS3Key,
        courseChapterCount: courses.chapterCount,
        completedChapterCount: sql<number>`0`,
      })
      .from(courses)
      .innerJoin(categories, eq(categories.id, courses.categoryId))
      .$dynamic();

    if (options.enrolledStudentId) {
      query.leftJoin(studentCourses, eq(studentCourses.courseId, courses.id));
    }

    const rows = await query.where(
      and(
        inArray(courses.id, ids),
        options.authorId ? eq(courses.authorId, options.authorId) : undefined,
        options.publishedOnly ? eq(courses.status, "published") : undefined,
        options.enrolledStudentId
          ? and(
              eq(studentCourses.studentId, options.enrolledStudentId),
              eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
            )
          : undefined,
      ),
    );

    return this.sortByMatches(rows, matches);
  }

  async getLearningPaths(
    matches: MatchRow[],
    language: SupportedLanguages,
    options: { userId: UUIDType; canReadOwn: boolean },
  ) {
    const ids = this.matchIds(matches);
    if (ids.length === 0) return [];

    const rows = await this.db
      .select({
        id: learningPaths.id,
        title: this.localizationService.getLocalizedSqlField(
          learningPaths.title,
          language,
          learningPaths,
        ),
        thumbnailReference: learningPaths.thumbnailReference,
        courses: sql<Array<{ id: UUIDType }>>`
          COALESCE(
            jsonb_agg(jsonb_build_object('id', ${learningPathCourses.courseId}))
              FILTER (WHERE ${learningPathCourses.courseId} IS NOT NULL),
            '[]'::jsonb
          )
        `,
      })
      .from(learningPaths)
      .leftJoin(learningPathCourses, eq(learningPathCourses.learningPathId, learningPaths.id))
      .leftJoin(
        studentLearningPaths,
        and(
          eq(studentLearningPaths.learningPathId, learningPaths.id),
          eq(studentLearningPaths.studentId, options.userId),
        ),
      )
      .where(
        and(
          inArray(learningPaths.id, ids),
          or(
            eq(learningPaths.status, LEARNING_PATH_STATUSES.PUBLISHED),
            isNotNull(studentLearningPaths.id),
            options.canReadOwn ? eq(learningPaths.authorId, options.userId) : undefined,
          ),
        ),
      )
      .groupBy(learningPaths.id);

    return this.sortByMatches(rows, matches);
  }

  async getLessons(
    matches: MatchRow[],
    language: SupportedLanguages,
    searchQuery: string,
    options: { userId: UUIDType; access: GlobalSearchLessonAccess },
  ) {
    const ids = this.matchIds(matches);
    if (ids.length === 0) return [];

    const tsQuery = this.buildTsQuery(searchQuery, language);
    const accessCondition = this.getLessonAccessCondition(options);

    const rows = await this.db
      .select({
        id: lessons.id,
        title: this.localizationService.getLocalizedSqlField(lessons.title, language, courses),
        courseId: courses.id,
        matchedAttachmentFileName: sql<string | null>`
          (
            SELECT ${searchDocuments.metadata}->>'fileName'
            FROM ${searchDocuments}
            WHERE ${searchDocuments.entityType} = ${SEARCH_ENTITY_TYPES.LESSON}
              AND ${searchDocuments.entityId} = ${lessons.id}
              AND ${searchDocuments.language} = ${language}
              AND ${searchDocuments.documentType} LIKE ${`${SEARCH_DOCUMENT_TYPES.RESOURCE}:%`}
              AND ${searchDocuments.searchVector} @@ ${tsQuery}
            ORDER BY ts_rank(${searchDocuments.searchVector}, ${tsQuery}) DESC
            LIMIT 1
          )
        `,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(studentCourses, eq(studentCourses.courseId, courses.id))
      .where(and(inArray(lessons.id, ids), accessCondition))
      .groupBy(lessons.id, courses.id, courses.baseLanguage);

    return this.sortByMatches(rows, matches);
  }

  async getNews(matches: MatchRow[], language: SupportedLanguages, isAdminLike: boolean) {
    const ids = this.matchIds(matches);
    if (ids.length === 0) return [];

    const rows = await this.db
      .select({
        id: news.id,
        title: this.localizationService.getLocalizedSqlField(news.title, language, news),
      })
      .from(news)
      .where(
        and(
          inArray(news.id, ids),
          ne(news.archived, true),
          isNotNull(news.publishedAt),
          isAdminLike ? undefined : sql`${language} = ANY(${news.availableLocales})`,
        ),
      );

    return this.sortByMatches(rows, matches);
  }

  async getArticles(matches: MatchRow[], language: SupportedLanguages, isAdminLike: boolean) {
    const ids = this.matchIds(matches);
    if (ids.length === 0) return [];

    const rows = await this.db
      .select({
        id: articles.id,
        title: this.localizationService.getLocalizedSqlField(articles.title, language, articles),
      })
      .from(articles)
      .innerJoin(articleSections, eq(articleSections.id, articles.articleSectionId))
      .where(
        and(
          inArray(articles.id, ids),
          ne(articles.archived, true),
          isNotNull(articles.publishedAt),
          isAdminLike ? undefined : sql`${language} = ANY(${articles.availableLocales})`,
          isAdminLike ? undefined : sql`${language} = ANY(${articleSections.availableLocales})`,
        ),
      );

    return this.sortByMatches(rows, matches);
  }

  async getQA(matches: MatchRow[], language: SupportedLanguages) {
    const ids = this.matchIds(matches);
    if (ids.length === 0) return [];

    const rows = await this.db
      .select({
        id: questionsAndAnswers.id,
        title: this.localizationService.getLocalizedSqlField(
          questionsAndAnswers.title,
          language,
          questionsAndAnswers,
        ),
      })
      .from(questionsAndAnswers)
      .where(inArray(questionsAndAnswers.id, ids));

    return this.sortByMatches(rows, matches);
  }

  getUsers(searchQuery: string) {
    const searchPattern = `%${searchQuery}%`;

    return this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profilePictureUrl: users.avatarReference,
        groups: sql<Array<{ id: UUIDType; name: string }>>`
          COALESCE(
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'id', ${groups.id},
                'name', ${this.localizationService.getLocalizedSqlField(groups.name, "en", groups)}
              )
            ) FILTER (WHERE ${groups.id} IS NOT NULL),
            '[]'::jsonb
          )
        `,
      })
      .from(users)
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupUsers.groupId))
      .where(
        and(
          eq(users.archived, false),
          or(
            sql`${users.firstName} ILIKE ${searchPattern}`,
            sql`${users.lastName} ILIKE ${searchPattern}`,
            sql`${users.email} ILIKE ${searchPattern}`,
            sql`concat(${users.firstName}, ' ', ${users.lastName}) ILIKE ${searchPattern}`,
          ),
        ),
      )
      .groupBy(users.id)
      .limit(10);
  }

  getCategories(searchQuery: string, language: SupportedLanguages) {
    const title = this.localizationService.getLocalizedSqlField(
      categories.title,
      language,
      categories,
    );

    return this.db
      .select({ id: categories.id, title })
      .from(categories)
      .where(and(ne(categories.archived, true), sql`${title} ILIKE ${`%${searchQuery}%`}`))
      .limit(10);
  }

  getGroups(searchQuery: string, language: SupportedLanguages) {
    const name = this.localizationService.getLocalizedSqlField(groups.name, language, groups);

    return this.db
      .select({ id: groups.id, name })
      .from(groups)
      .where(sql`${name} ILIKE ${`%${searchQuery}%`}`)
      .limit(10);
  }

  private buildTsQuery(searchQuery: string, language: SupportedLanguages) {
    return sql`to_tsquery(${getSearchLanguageConfig(
      language,
    )}::regconfig, ${normalizeSearchTerm(searchQuery)})`;
  }

  private getLessonAccessCondition(options: {
    userId: UUIDType;
    access: GlobalSearchLessonAccess;
  }) {
    if (options.access === GLOBAL_SEARCH_LESSON_ACCESS.ALL) return undefined;
    if (options.access === GLOBAL_SEARCH_LESSON_ACCESS.OWN) {
      return eq(courses.authorId, options.userId);
    }

    return and(
      eq(studentCourses.studentId, options.userId),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
    );
  }

  private matchIds(matches: MatchRow[]) {
    return matches.map((match) => match.entityId);
  }

  private sortByMatches<T extends { id: UUIDType }>(rows: T[], matches: MatchRow[]): T[] {
    const rankById = new Map(matches.map((match, index) => [match.entityId, index]));
    return [...rows].sort((left, right) => {
      const leftRank = rankById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = rankById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank;
    });
  }
}
