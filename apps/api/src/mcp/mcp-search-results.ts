import { GLOBAL_SEARCH_RESULT_TYPES, sanitizeRichTextSummary } from "@repo/shared";

import type {
  McpContentSearchResponse,
  McpLearnerContentSearchResponse,
  McpLinkedResultNode,
  McpLinkedSearchResponse,
  McpSearchContext,
} from "./mcp-search-results.types";
import type { GlobalSearchResult } from "src/global-search/schemas/global-search.schema";

/** Match the destinations used by the web GlobalSearch entries, without changing REST results. */
export function shapeMcpSearchResults(
  results: GlobalSearchResult,
  context: McpSearchContext,
): McpContentSearchResponse | McpLinkedSearchResponse | McpLearnerContentSearchResponse {
  const resource = new URL(context.resource);
  if (!["https:", "http:"].includes(resource.protocol) || resource.username || resource.password) {
    throw new Error("Invalid bound MCP resource");
  }
  const origin = resource.origin;
  const text = (value: string | undefined) =>
    value === undefined
      ? undefined
      : sanitizeRichTextSummary(value)
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 2000);
  const pathUrl = (path: string, id: string) => `${origin}/${path}/${encodeURIComponent(id)}`;
  const courseUrl = (id: string) => pathUrl("course", id);
  const qaUrl = (id: string) => `${origin}/qa?${new URLSearchParams({ qaId: id }).toString()}`;

  if (context.searchOnly) {
    // Explicit projection prevents future REST fields from silently expanding SEARCH scope.
    // The service attaches passages without their document type: course hits can include
    // resource matches, so course passage/attachment data is deliberately excluded here.
    const course = (row: GlobalSearchResult["allCourses"][number]) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      thumbnailUrl: row.thumbnailUrl,
      courseChapterCount: row.courseChapterCount,
      completedChapterCount: row.completedChapterCount,
      url: courseUrl(row.id),
    });
    const content = (row: GlobalSearchResult["news"][number], url: string) => ({
      id: row.id,
      title: row.title,
      matchedPassage: context.studentOnly ? text(row.matchedPassage) : row.matchedPassage,
      matchedAttachmentFileName: row.matchedAttachmentFileName,
      url,
    });
    return {
      searchMode: results.searchMode,
      semanticStatus: results.semanticStatus,
      allCourses: results.allCourses.map(course),
      myCourses: results.myCourses.map(course),
      availableCourses: results.availableCourses.map(course),
      news: results.news.map((row) => content(row, pathUrl("news", row.id))),
      articles: results.articles.map((row) => content(row, pathUrl("articles", row.id))),
      qa: results.qa.map((row) => content(row, qaUrl(row.id))),
      ...(context.includeLearnerLessons
        ? {
            lessons: results.lessons.map((row) => ({
              id: row.id,
              title: text(row.title) ?? "",
              courseId: row.courseId,
              matchedPassage: text(row.matchedPassage),
              matchedAttachmentFileName: text(row.matchedAttachmentFileName ?? undefined) ?? null,
              url: `${courseUrl(row.courseId)}/lesson/${encodeURIComponent(row.id)}`,
            })),
          }
        : {}),
    };
  }

  // Authoring integrations get the same ranked tree as the search dialog, uncapped, so agents
  // see which course (and chapter) each lesson belongs to without follow-up calls.
  const lessonUrl = (courseId: string, lessonId: string) =>
    `${courseUrl(courseId)}/lesson/${encodeURIComponent(lessonId)}`;
  const linkNode = (node: GlobalSearchResult["results"][number]): McpLinkedResultNode => {
    switch (node.type) {
      case GLOBAL_SEARCH_RESULT_TYPES.COURSE:
        return {
          ...node,
          url: courseUrl(node.id),
          lessons: node.lessons.map((lesson) => ({
            ...lesson,
            url: lessonUrl(lesson.courseId, lesson.id),
          })),
        };
      case GLOBAL_SEARCH_RESULT_TYPES.LEARNING_PATH:
        return {
          ...node,
          url: `${origin}/development-paths?${new URLSearchParams({
            searchQuery: node.title,
          }).toString()}`,
        };
      case GLOBAL_SEARCH_RESULT_TYPES.NEWS:
        return { ...node, url: pathUrl("news", node.id) };
      case GLOBAL_SEARCH_RESULT_TYPES.ARTICLE:
        return { ...node, url: pathUrl("articles", node.id) };
      default:
        return { ...node, url: qaUrl(node.id) };
    }
  };

  return {
    searchMode: results.searchMode,
    semanticStatus: results.semanticStatus,
    results: results.results.map(linkNode),
    users: results.users.map((row) => ({ ...row, url: pathUrl("admin/users", row.id) })),
    categories: results.categories.map((row) => ({
      ...row,
      url: pathUrl("admin/categories", row.id),
    })),
    groups: results.groups.map((row) => ({ ...row, url: pathUrl("admin/groups", row.id) })),
  };
}
