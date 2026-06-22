import { Injectable } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { hasAnyPermission, hasPermission } from "src/common/permissions/permission.utils";

import { GLOBAL_SEARCH_MIN_QUERY_LENGTH, SEARCH_ENTITY_TYPES } from "./global-search.constants";
import { GlobalSearchRepository } from "./global-search.repository";
import { GLOBAL_SEARCH_LESSON_ACCESS } from "./global-search.types";

import type { MatchRow } from "./global-search.types";
import type { GlobalSearchResponse } from "./schemas/global-search.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class GlobalSearchService {
  constructor(private readonly globalSearchRepository: GlobalSearchRepository) {}

  async search(
    searchQuery: string,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ): Promise<GlobalSearchResponse> {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
      return this.emptyResponse();
    }

    const [
      courseMatches,
      lessonMatches,
      learningPathMatches,
      newsMatches,
      articleMatches,
      qaMatches,
    ] = await Promise.all([
      this.globalSearchRepository.findMatches(SEARCH_ENTITY_TYPES.COURSE, language, trimmedQuery),
      this.globalSearchRepository.findMatches(SEARCH_ENTITY_TYPES.LESSON, language, trimmedQuery),
      this.globalSearchRepository.findMatches(
        SEARCH_ENTITY_TYPES.LEARNING_PATH,
        language,
        trimmedQuery,
      ),
      this.globalSearchRepository.findMatches(SEARCH_ENTITY_TYPES.NEWS, language, trimmedQuery),
      this.globalSearchRepository.findMatches(SEARCH_ENTITY_TYPES.ARTICLE, language, trimmedQuery),
      this.globalSearchRepository.findMatches(SEARCH_ENTITY_TYPES.QA, language, trimmedQuery),
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

    return {
      allCourses,
      myCourses,
      availableCourses,
      learningPaths: learningPathsResults,
      lessons: lessonsResults,
      news: newsResults,
      articles: articlesResults,
      qa: qaResults,
      users: usersResults,
      categories: categoriesResults,
      groups: groupsResults,
    };
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
    return this.globalSearchRepository.getCourseRows(matches, language, { publishedOnly: true });
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
