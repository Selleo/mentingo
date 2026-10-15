import { NotFoundException } from "@nestjs/common";
import { FEATURES, PERMISSIONS, sanitizeRichTextSummary, type PermissionKey } from "@repo/shared";

import { COURSE_ENROLLMENT_SCOPES } from "src/courses/schemas/courseQuery";

import * as Schemas from "./mcp-student-tool.schemas";
import { asMcpInputSchema } from "./mcp-tool.schema";

import type {
  McpStudentCourseMetadata,
  McpStudentPageQuery,
  McpStudentServices,
} from "./mcp-student.types";
import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpServer } from "@modelcontextprotocol/server";

export const MCP_STUDENT_MAX_TEXT_LENGTH = 16000;
export const MCP_STUDENT_MAX_SUMMARY_LENGTH = 2000;
const MCP_STUDENT_MAX_TITLE_LENGTH = 500;
export const MCP_STUDENT_TOOL_PERMISSIONS = {
  list_courses: [PERMISSIONS.COURSE_READ, PERMISSIONS.COURSE_READ_ASSIGNED],
  get_course: [PERMISSIONS.COURSE_READ, PERMISSIONS.COURSE_READ_ASSIGNED],
  list_articles: [PERMISSIONS.ARTICLE_READ_PUBLIC],
  get_article: [PERMISSIONS.ARTICLE_READ_PUBLIC],
  list_news: [PERMISSIONS.NEWS_READ_PUBLIC],
  get_news: [PERMISSIONS.NEWS_READ_PUBLIC],
  list_qa_entries: [PERMISSIONS.QA_READ_PUBLIC],
  get_qa_entry: [PERMISSIONS.QA_READ_PUBLIC],
} satisfies Record<string, PermissionKey[]>;

export const MCP_STUDENT_TOOL_FEATURES = {
  list_articles: FEATURES.ARTICLES,
  get_article: FEATURES.ARTICLES,
  list_news: FEATURES.NEWS,
  get_news: FEATURES.NEWS,
  list_qa_entries: FEATURES.QA,
  get_qa_entry: FEATURES.QA,
} as const;

/** Only authored text: discard embedded resource URLs, attributes and active HTML. */
function boundedText(value: string | null | undefined, maxLength = MCP_STUDENT_MAX_TEXT_LENGTH) {
  const text = sanitizeRichTextSummary(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    text: text.slice(0, maxLength),
    truncated: text.length > maxLength,
  };
}

function pageRows<T extends { title: string | null }>(rows: T[], input: McpStudentPageQuery) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;
  const query = input.query?.toLocaleLowerCase();
  const matches = query
    ? rows.filter((row) => row.title?.toLocaleLowerCase().includes(query))
    : rows;
  return {
    data: matches.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, perPage: pageSize, totalItems: matches.length },
  };
}

export function registerMcpStudentTools(
  server: McpServer,
  run: McpToolRunner,
  services: McpStudentServices,
  resource: string,
): void {
  const boundResource = new URL(resource);
  if (
    !["https:", "http:"].includes(boundResource.protocol) ||
    boundResource.username ||
    boundResource.password
  ) {
    throw new Error("Invalid bound MCP resource");
  }
  const sourceUrl = (path: string, id: string) =>
    `${boundResource.origin}/${path}/${encodeURIComponent(id)}`;
  const qaUrl = (id: string) =>
    `${boundResource.origin}/qa?${new URLSearchParams({ qaId: id }).toString()}`;
  const courseMetadata = (course: McpStudentCourseMetadata) => ({
    id: course.id,
    title: boundedText(course.title, MCP_STUDENT_MAX_TITLE_LENGTH).text,
    description: boundedText(course.description, MCP_STUDENT_MAX_SUMMARY_LENGTH).text,
    category: boundedText(course.category, MCP_STUDENT_MAX_TITLE_LENGTH).text,
    enrolled: course.enrolled,
    courseChapterCount: course.courseChapterCount,
    priceInCents: course.priceInCents,
    currency: course.currency,
    url: sourceUrl("course", course.id),
  });

  server.registerTool(
    "list_courses",
    {
      description:
        "List available or enrolled learner courses for the authenticated account. Metadata only: excludes lessons, assessments and file URLs. Query filters course titles.",
      inputSchema: asMcpInputSchema(Schemas.listStudentCoursesInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ language, scope, page = 1, pageSize = 10, query }) =>
      run(
        scope === COURSE_ENROLLMENT_SCOPES.ENROLLED
          ? [PERMISSIONS.COURSE_READ_ASSIGNED]
          : [PERMISSIONS.COURSE_READ],
        async (user) => {
          const courseQuery = {
            language,
            page,
            perPage: pageSize,
            filters: { title: query, isArchived: false },
            currentUser: user,
            currentUserPermissions: user.permissions,
          };
          const result =
            scope === COURSE_ENROLLMENT_SCOPES.ENROLLED
              ? await services.courses.getCoursesForUser(courseQuery, user.userId)
              : await services.courses.getAvailableCourses(courseQuery, user.userId);
          return { data: result.data.map(courseMetadata), pagination: result.pagination };
        },
      ),
  );

  server.registerTool(
    "get_course",
    {
      description:
        "Read learner-visible course metadata. No lesson or chapter content, assessments, files, authoring configuration or draft courses.",
      inputSchema: asMcpInputSchema(Schemas.getStudentCourseInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ courseId: id, language }) =>
      run(MCP_STUDENT_TOOL_PERMISSIONS.get_course, async (user) => {
        const course = await services.courses.getCourse(id, user, language, { learnerOnly: true });
        return { course: courseMetadata(course) };
      }),
  );

  server.registerTool(
    "list_articles",
    {
      description:
        "List published, unarchived knowledge articles visible to the learner in the requested language. Metadata only. Query filters titles.",
      inputSchema: asMcpInputSchema(Schemas.listStudentContentInputSchema),
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      run(MCP_STUDENT_TOOL_PERMISSIONS.list_articles, async (user) => {
        await services.assertFeatureEnabled(FEATURES.ARTICLES);
        const result = pageRows(await services.articles.getArticles(input.language, user), input);
        return {
          data: result.data.map((row) => ({
            id: row.id,
            title: boundedText(row.title, MCP_STUDENT_MAX_TITLE_LENGTH).text,
            url: sourceUrl("articles", row.id),
          })),
          pagination: result.pagination,
        };
      }),
  );

  server.registerTool(
    "get_article",
    {
      description:
        "Read a published learner-visible article in the requested language. Returns bounded text, never drafts, resource objects or file URLs.",
      inputSchema: asMcpInputSchema(Schemas.getStudentContentInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ id, language }) =>
      run(MCP_STUDENT_TOOL_PERMISSIONS.get_article, async (user) => {
        await services.assertFeatureEnabled(FEATURES.ARTICLES);
        const article = await services.articles.getArticle(id, language, false, user);
        const content = boundedText(article.plainContent);
        return {
          article: {
            id: article.id,
            title: boundedText(article.title, MCP_STUDENT_MAX_TITLE_LENGTH).text,
            content: content.text,
            contentTruncated: content.truncated,
            url: sourceUrl("articles", article.id),
          },
        };
      }),
  );

  server.registerTool(
    "list_news",
    {
      description:
        "List published news visible to the learner in the requested language, newest first. Uses the learner API's fixed page size. Metadata only.",
      inputSchema: asMcpInputSchema(Schemas.listStudentNewsInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ language, page = 1 }) =>
      run(MCP_STUDENT_TOOL_PERMISSIONS.list_news, async (user) => {
        await services.assertFeatureEnabled(FEATURES.NEWS);
        const result = await services.news.getNewsList(language, page, user);
        return {
          data: result.data.map((row) => ({
            id: row.id,
            title: boundedText(row.title, MCP_STUDENT_MAX_TITLE_LENGTH).text,
            summary: boundedText(row.summary, MCP_STUDENT_MAX_SUMMARY_LENGTH).text,
            url: sourceUrl("news", row.id),
          })),
          pagination: result.pagination,
        };
      }),
  );

  server.registerTool(
    "get_news",
    {
      description:
        "Read published learner-visible news in the requested language. Bounded text only, excludes drafts, resources and file URLs.",
      inputSchema: asMcpInputSchema(Schemas.getStudentContentInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ id, language }) =>
      run(MCP_STUDENT_TOOL_PERMISSIONS.get_news, async (user) => {
        await services.assertFeatureEnabled(FEATURES.NEWS);
        const news = await services.news.getNews(id, language, user);
        const content = boundedText(news.plainContent);
        return {
          news: {
            id: news.id,
            title: boundedText(news.title, MCP_STUDENT_MAX_TITLE_LENGTH).text,
            content: content.text,
            contentTruncated: content.truncated,
            url: sourceUrl("news", news.id),
          },
        };
      }),
  );

  server.registerTool(
    "list_qa_entries",
    {
      description:
        "List learner-visible Q&A titles available in the requested language. Query filters titles; answers are retrieved separately.",
      inputSchema: asMcpInputSchema(Schemas.listStudentContentInputSchema),
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      run(MCP_STUDENT_TOOL_PERMISSIONS.list_qa_entries, async (user) => {
        await services.assertFeatureEnabled(FEATURES.QA);
        const rows = await services.qa.getAllQA(input.language, user);
        const result = pageRows(
          rows.filter((row) => row.availableLocales.includes(input.language)),
          input,
        );
        return {
          data: result.data.map((row) => ({
            id: row.id,
            title: boundedText(row.title, MCP_STUDENT_MAX_TITLE_LENGTH).text,
            url: qaUrl(row.id),
          })),
          pagination: result.pagination,
        };
      }),
  );

  server.registerTool(
    "get_qa_entry",
    {
      description:
        "Read a learner-visible Q&A answer in an available language. Bounded text only; excludes internal metadata and embedded file URLs.",
      inputSchema: asMcpInputSchema(Schemas.getStudentQaInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ qaId: id, language }) =>
      run(MCP_STUDENT_TOOL_PERMISSIONS.get_qa_entry, async (user) => {
        await services.assertFeatureEnabled(FEATURES.QA);
        const qa = await services.qa.getQA(id, language, user);
        if (!qa || !qa.availableLocales.includes(language))
          throw new NotFoundException("qaView.toast.notFound");
        const content = boundedText(qa.description);
        return {
          qa: {
            id: qa.id,
            title: boundedText(qa.title, MCP_STUDENT_MAX_TITLE_LENGTH).text,
            answer: content.text,
            contentTruncated: content.truncated,
            url: qaUrl(qa.id),
          },
        };
      }),
  );
}
