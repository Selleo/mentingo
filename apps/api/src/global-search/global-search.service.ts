import { Injectable } from "@nestjs/common";
import { PERMISSIONS, GLOBAL_SEARCH_MODES, GLOBAL_SEARCH_SEMANTIC_STATUSES } from "@repo/shared";

import { hasAnyPermission, hasPermission } from "src/common/permissions/permission.utils";
import { FileService } from "src/file/file.service";
import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";

import { GLOBAL_SEARCH_MIN_QUERY_LENGTH, SEARCH_ENTITY_TYPES } from "./global-search.constants";
import { GlobalSearchRepository } from "./global-search.repository";
import { GLOBAL_SEARCH_LESSON_ACCESS } from "./global-search.types";
import { HybridSearchRepository } from "./hybrid-search.repository";
import { fuseSearchMatches } from "./hybrid-search.utils";
import { SemanticSearchEmbeddingService } from "./semantic-search-index.embedding.service";

import type { MatchRow } from "./global-search.types";
import type { GlobalSearchMode, GlobalSearchResponse } from "./schemas/global-search.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class GlobalSearchService {
  constructor(
    private readonly globalSearchRepository: GlobalSearchRepository,
    private readonly fileService: FileService,
    private readonly hybridSearchRepository: HybridSearchRepository,
    private readonly semanticSearchEmbeddingService: SemanticSearchEmbeddingService,
  ) {}

  async search(
    searchQuery: string,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
    mode: GlobalSearchMode = GLOBAL_SEARCH_MODES.KEYWORD,
  ): Promise<GlobalSearchResponse> {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
      return this.emptyResponse();
    }

    let embedding: number[] | undefined;
    let semanticStatus: GlobalSearchResponse["semanticStatus"];
    if (mode === GLOBAL_SEARCH_MODES.HYBRID) {
      try {
        embedding = await this.semanticSearchEmbeddingService.embedQuery(trimmedQuery);
      } catch {
        semanticStatus = GLOBAL_SEARCH_SEMANTIC_STATUSES.UNAVAILABLE;
      }
      if (embedding) {
        semanticStatus = (await this.hybridSearchRepository.hasCurrentChunks(currentUser))
          ? GLOBAL_SEARCH_SEMANTIC_STATUSES.READY
          : GLOBAL_SEARCH_SEMANTIC_STATUSES.PENDING;
      }
    }
    const findMatches = async (
      entityType: Parameters<GlobalSearchRepository["findMatches"]>[0],
    ) => {
      if (mode === GLOBAL_SEARCH_MODES.KEYWORD) {
        return this.globalSearchRepository.findMatches(entityType, language, trimmedQuery);
      }
      const keyword = await this.hybridSearchRepository.findKeywordMatches(
        entityType,
        trimmedQuery,
        currentUser,
      );
      if (!embedding) return keyword;
      const semantic = await this.hybridSearchRepository.findSemanticMatches(
        entityType,
        embedding,
        currentUser,
      );
      return fuseSearchMatches(keyword, semantic);
    };

    const [
      courseMatches,
      lessonMatches,
      learningPathMatches,
      newsMatches,
      articleMatches,
      qaMatches,
    ] = await Promise.all([
      findMatches(SEARCH_ENTITY_TYPES.COURSE),
      findMatches(SEARCH_ENTITY_TYPES.LESSON),
      findMatches(SEARCH_ENTITY_TYPES.LEARNING_PATH),
      findMatches(SEARCH_ENTITY_TYPES.NEWS),
      findMatches(SEARCH_ENTITY_TYPES.ARTICLE),
      findMatches(SEARCH_ENTITY_TYPES.QA),
    ]);

    const [
      allCourses,
      myCourses,
      availableCourses,
      learningPathsResults,
      lessonsResults,
      newsResults,
      articlesResults,
      qaResults,
      usersResults,
      categoriesResults,
      groupsResults,
    ] = await Promise.all([
      this.getAllCourses(courseMatches, language, currentUser),
      this.getMyCourses(courseMatches, language, currentUser),
      this.getAvailableCourses(courseMatches, language, currentUser),
      this.getLearningPaths(learningPathMatches, language, currentUser),
      this.getLessons(lessonMatches, language, trimmedQuery, currentUser),
      this.getNews(newsMatches, language, currentUser),
      this.getArticles(articleMatches, language, currentUser),
      this.getQA(qaMatches, language, currentUser),
      this.getUsers(trimmedQuery, currentUser),
      this.getCategories(trimmedQuery, language, currentUser),
      this.getGroups(trimmedQuery, language, currentUser),
    ]);

    return this.resolveImageUrls({
      searchMode: mode,
      semanticStatus,
      allCourses: this.withPassages(allCourses, courseMatches),
      myCourses: this.withPassages(myCourses, courseMatches),
      availableCourses: this.withPassages(availableCourses, courseMatches),
      learningPaths: this.withPassages(learningPathsResults, learningPathMatches),
      lessons: this.withPassages(lessonsResults, lessonMatches),
      news: this.withPassages(newsResults, newsMatches),
      articles: this.withPassages(articlesResults, articleMatches),
      qa: this.withPassages(qaResults, qaMatches),
      users: usersResults,
      categories: categoriesResults,
      groups: groupsResults,
    });
  }

  private withPassages<T extends { id: string }>(rows: T[], matches: MatchRow[]): T[] {
    const byId = new Map(matches.map((match) => [match.entityId, match]));
    return rows.slice(0, 10).map((row) => {
      const match = byId.get(row.id as MatchRow["entityId"]);
      if (!match?.matchedPassage) return row;
      return {
        ...row,
        matchedPassage: match.matchedPassage,
        matchedAttachmentFileName: match.matchedAttachmentFileName ?? null,
      };
    });
  }

  private async resolveImageUrls(response: GlobalSearchResponse): Promise<GlobalSearchResponse> {
    const [allCourses, myCourses, availableCourses, learningPaths, users] = await Promise.all([
      this.resolveCourseImageUrls(response.allCourses),
      this.resolveCourseImageUrls(response.myCourses),
      this.resolveCourseImageUrls(response.availableCourses),
      Promise.all(
        response.learningPaths.map(async (learningPath) => ({
          ...learningPath,
          thumbnailReference: learningPath.thumbnailReference
            ? await this.fileService.getFileUrl(learningPath.thumbnailReference, {
                quality: IMAGE_QUALITY.XXS,
              })
            : learningPath.thumbnailReference,
        })),
      ),
      Promise.all(
        response.users.map(async (user) => ({
          ...user,
          profilePictureUrl: user.profilePictureUrl
            ? await this.fileService.getFileUrl(user.profilePictureUrl, {
                quality: IMAGE_QUALITY.XXS,
              })
            : user.profilePictureUrl,
        })),
      ),
    ]);

    return {
      ...response,
      allCourses,
      myCourses,
      availableCourses,
      learningPaths,
      users,
    };
  }

  private resolveCourseImageUrls(courses: GlobalSearchResponse["allCourses"]) {
    return Promise.all(
      courses.map(async (course) => ({
        ...course,
        thumbnailUrl: course.thumbnailUrl
          ? await this.fileService.getFileUrl(course.thumbnailUrl, { quality: IMAGE_QUALITY.XXS })
          : course.thumbnailUrl,
      })),
    );
  }

  private getAllCourses(
    matches: MatchRow[],
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    if (!hasPermission(currentUser.permissions, PERMISSIONS.COURSE_UPDATE)) return [];
    return this.globalSearchRepository.getCourseRows(matches, language);
  }

  private getMyCourses(
    matches: MatchRow[],
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    if (hasPermission(currentUser.permissions, PERMISSIONS.COURSE_UPDATE_OWN)) {
      return this.globalSearchRepository.getCourseRows(matches, language, {
        authorId: currentUser.userId,
      });
    }

    if (!hasPermission(currentUser.permissions, PERMISSIONS.COURSE_READ_ASSIGNED)) return [];

    return this.globalSearchRepository.getCourseRows(matches, language, {
      enrolledStudentId: currentUser.userId,
    });
  }

  private getAvailableCourses(
    matches: MatchRow[],
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    if (!hasPermission(currentUser.permissions, PERMISSIONS.COURSE_READ)) return [];
    return this.globalSearchRepository.getCourseRows(matches, language, {
      publishedOnly: true,
      excludeArchived: true,
    });
  }

  private getLearningPaths(
    matches: MatchRow[],
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    if (!hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_PATH_READ)) return [];

    return this.globalSearchRepository.getLearningPaths(matches, language, {
      userId: currentUser.userId,
      canReadOwn: hasAnyPermission(currentUser.permissions, [
        PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
        PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN,
      ]),
    });
  }

  private getLessons(
    matches: MatchRow[],
    language: SupportedLanguages,
    searchQuery: string,
    currentUser: CurrentUserType,
  ) {
    if (!hasPermission(currentUser.permissions, PERMISSIONS.COURSE_READ)) return [];

    if (hasPermission(currentUser.permissions, PERMISSIONS.COURSE_UPDATE)) {
      return this.globalSearchRepository.getLessons(matches, language, searchQuery, {
        userId: currentUser.userId,
        access: GLOBAL_SEARCH_LESSON_ACCESS.ALL,
      });
    }

    if (hasPermission(currentUser.permissions, PERMISSIONS.COURSE_UPDATE_OWN)) {
      return this.globalSearchRepository.getLessons(matches, language, searchQuery, {
        userId: currentUser.userId,
        access: GLOBAL_SEARCH_LESSON_ACCESS.OWN,
      });
    }

    return this.globalSearchRepository.getLessons(matches, language, searchQuery, {
      userId: currentUser.userId,
      access: GLOBAL_SEARCH_LESSON_ACCESS.ENROLLED,
    });
  }

  private getNews(matches: MatchRow[], language: SupportedLanguages, currentUser: CurrentUserType) {
    if (
      !hasAnyPermission(currentUser.permissions, [
        PERMISSIONS.NEWS_READ_PUBLIC,
        PERMISSIONS.NEWS_MANAGE,
        PERMISSIONS.NEWS_MANAGE_OWN,
      ])
    ) {
      return [];
    }

    return this.globalSearchRepository.getNews(
      matches,
      language,
      hasAnyPermission(currentUser.permissions, [
        PERMISSIONS.NEWS_MANAGE,
        PERMISSIONS.NEWS_MANAGE_OWN,
      ]),
    );
  }

  private getArticles(
    matches: MatchRow[],
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    if (
      !hasAnyPermission(currentUser.permissions, [
        PERMISSIONS.ARTICLE_READ_PUBLIC,
        PERMISSIONS.ARTICLE_MANAGE,
        PERMISSIONS.ARTICLE_MANAGE_OWN,
      ])
    ) {
      return [];
    }

    return this.globalSearchRepository.getArticles(
      matches,
      language,
      hasAnyPermission(currentUser.permissions, [
        PERMISSIONS.ARTICLE_MANAGE,
        PERMISSIONS.ARTICLE_MANAGE_OWN,
      ]),
    );
  }

  private getQA(matches: MatchRow[], language: SupportedLanguages, currentUser: CurrentUserType) {
    if (
      !hasAnyPermission(currentUser.permissions, [
        PERMISSIONS.QA_READ_PUBLIC,
        PERMISSIONS.QA_MANAGE,
        PERMISSIONS.QA_MANAGE_OWN,
      ])
    ) {
      return [];
    }

    return this.globalSearchRepository.getQA(matches, language);
  }

  private getUsers(searchQuery: string, currentUser: CurrentUserType) {
    if (!hasPermission(currentUser.permissions, PERMISSIONS.USER_MANAGE)) return [];
    return this.globalSearchRepository.getUsers(searchQuery);
  }

  private getCategories(
    searchQuery: string,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    if (
      !hasAnyPermission(currentUser.permissions, [
        PERMISSIONS.CATEGORY_READ,
        PERMISSIONS.CATEGORY_MANAGE,
      ])
    ) {
      return [];
    }

    return this.globalSearchRepository.getCategories(searchQuery, language);
  }

  private getGroups(
    searchQuery: string,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    if (
      !hasAnyPermission(currentUser.permissions, [PERMISSIONS.GROUP_READ, PERMISSIONS.GROUP_MANAGE])
    ) {
      return [];
    }

    return this.globalSearchRepository.getGroups(searchQuery, language);
  }

  private emptyResponse(): GlobalSearchResponse {
    return {
      allCourses: [],
      myCourses: [],
      availableCourses: [],
      learningPaths: [],
      lessons: [],
      news: [],
      articles: [],
      qa: [],
      users: [],
      categories: [],
      groups: [],
    };
  }
}
