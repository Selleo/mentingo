import { FEATURES, PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";

import { COURSE_ENROLLMENT_SCOPES } from "src/courses/schemas/courseQuery";

import {
  registerMcpStudentTools,
  MCP_STUDENT_MAX_TEXT_LENGTH,
  MCP_STUDENT_TOOL_PERMISSIONS,
} from "./mcp-student-tools";

import type { McpStudentServices } from "./mcp-student.types";
import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpServer } from "@modelcontextprotocol/server";
import type { CurrentUserType } from "src/common/types/current-user.type";

const LANGUAGE = SUPPORTED_LANGUAGES.EN;
const ID = "00000000-0000-0000-0000-000000000001";
const actor: CurrentUserType = {
  userId: ID,
  tenantId: "tenant-id",
  email: "learner@example.com",
  roleSlugs: [],
  permissions: [
    PERMISSIONS.COURSE_READ_ASSIGNED,
    PERMISSIONS.ARTICLE_READ_PUBLIC,
    PERMISSIONS.NEWS_READ_PUBLIC,
    PERMISSIONS.QA_READ_PUBLIC,
  ],
};

function setup() {
  const handlers = new Map<
    string,
    (input: Record<string, unknown>) => Promise<{ structuredContent: Record<string, unknown> }>
  >();
  const server = { registerTool: jest.fn((name, _config, handler) => handlers.set(name, handler)) };
  const course = {
    id: ID,
    title: "Accessible course",
    description: "<p>Course overview</p>",
    category: "General",
    enrolled: true,
    courseChapterCount: 2,
    priceInCents: 0,
    currency: "USD",
    chapters: [{ lessons: [{ hiddenAnswer: "private lesson" }] }],
    resources: [{ url: "https://storage.example/private?token=secret" }],
    stripePriceId: "internal-stripe-id",
    authorEmail: "private@example.com",
  };
  const pagination = { page: 1, perPage: 10, totalItems: 1 };
  const editorial = {
    id: ID,
    title: "Published article",
    plainContent:
      '<p>Safe text</p><img src="https://storage.example/private?token=secret"><a href="https://storage.example/file">Label</a><script>secret script</script>',
    content: "injected signed URL https://storage.example/private?token=secret",
    resources: { files: ["private token"] },
    metadata: { secret: "internal" },
  };
  const courses = {
    getAvailableCourses: jest.fn().mockResolvedValue({ data: [course], pagination }),
    getCoursesForUser: jest.fn().mockResolvedValue({ data: [course], pagination }),
    getCourse: jest.fn().mockResolvedValue(course),
  };
  const articles = {
    getArticles: jest.fn().mockResolvedValue([editorial]),
    getArticle: jest.fn().mockResolvedValue(editorial),
  };
  const news = {
    getNewsList: jest
      .fn()
      .mockResolvedValue({ data: [{ ...editorial, summary: "Summary" }], pagination }),
    getNews: jest.fn().mockResolvedValue(editorial),
  };
  const qa = {
    getAllQA: jest.fn().mockResolvedValue([{ ...editorial, availableLocales: [LANGUAGE] }]),
    getQA: jest.fn().mockResolvedValue({
      ...editorial,
      description: editorial.plainContent,
      availableLocales: [LANGUAGE],
    }),
  };
  const assertFeatureEnabled = jest.fn().mockResolvedValue(undefined);
  const run = jest.fn(async (_permissions, operation) => ({
    content: [],
    structuredContent: await operation(actor),
  }));
  registerMcpStudentTools(
    server as unknown as McpServer,
    run as McpToolRunner,
    { courses, articles, news, qa, assertFeatureEnabled } as unknown as McpStudentServices,
    "https://tenant.example/mcp",
  );
  return { handlers, courses, articles, news, qa, run, assertFeatureEnabled };
}

describe("student MCP content tools", () => {
  it("registers only the explicit learner read catalog", () => {
    expect([...setup().handlers.keys()].sort()).toEqual(
      Object.keys(MCP_STUDENT_TOOL_PERMISSIONS).sort(),
    );
    expect(Object.values(MCP_STUDENT_TOOL_PERMISSIONS).flat()).not.toContain(
      PERMISSIONS.COURSE_UPDATE,
    );
  });

  it("uses bound learner identity and existing enrollment/catalog services", async () => {
    const { handlers, courses } = setup();
    await handlers.get("list_student_courses")!({
      scope: COURSE_ENROLLMENT_SCOPES.AVAILABLE,
      language: LANGUAGE,
      page: 2,
      pageSize: 5,
      query: "course",
      userId: "untrusted",
    });
    expect(courses.getAvailableCourses).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        perPage: 5,
        filters: { title: "course", isArchived: false },
        currentUser: actor,
      }),
      actor.userId,
    );
    await handlers.get("list_student_courses")!({
      scope: COURSE_ENROLLMENT_SCOPES.ENROLLED,
      language: LANGUAGE,
    });
    expect(courses.getCoursesForUser).toHaveBeenCalledWith(expect.any(Object), actor.userId);
  });

  it("forces learner access even for an account that owns a course and excludes course internals", async () => {
    const { handlers, courses } = setup();
    const result = await handlers.get("get_student_course")!({ id: ID, language: LANGUAGE });
    expect(courses.getCourse).toHaveBeenCalledWith(ID, actor, LANGUAGE, { learnerOnly: true });
    expect(result.structuredContent).toEqual({
      course: {
        id: ID,
        title: "Accessible course",
        description: "Course overview",
        category: "General",
        enrolled: true,
        courseChapterCount: 2,
        priceInCents: 0,
        currency: "USD",
        url: `https://tenant.example/course/${ID}`,
      },
    });
  });

  it.each(["get_student_article", "get_student_news", "get_student_qa_entry"])(
    "%s emits original sanitized text, never injected file URLs or metadata",
    async (name) => {
      const { handlers } = setup();
      const result = await handlers.get(name)!({ id: ID, language: LANGUAGE });
      const serialized = JSON.stringify(result.structuredContent);
      expect(serialized).toContain("Safe text Label");
      for (const secret of [
        "storage.example",
        "resources",
        "metadata",
        "script",
        "token",
        "injected",
      ])
        expect(serialized).not.toContain(secret);
    },
  );

  it("selects published article mode and checks feature flags on every operation", async () => {
    const { handlers, articles, assertFeatureEnabled } = setup();
    await handlers.get("get_student_article")!({ id: ID, language: LANGUAGE });
    expect(articles.getArticle).toHaveBeenCalledWith(ID, LANGUAGE, false, actor);
    expect(assertFeatureEnabled).toHaveBeenCalledWith(FEATURES.ARTICLES);
    assertFeatureEnabled.mockRejectedValueOnce(new Error("Disabled"));
    await expect(
      handlers.get("get_student_article")!({ id: ID, language: LANGUAGE }),
    ).rejects.toThrow("Disabled");
    expect(articles.getArticle).toHaveBeenCalledTimes(1);
  });

  it("bounds article content and marks truncation", async () => {
    const { handlers, articles } = setup();
    articles.getArticle.mockResolvedValueOnce({
      id: ID,
      title: "Long",
      plainContent: "x".repeat(MCP_STUDENT_MAX_TEXT_LENGTH + 100),
    });
    const result = await handlers.get("get_student_article")!({ id: ID, language: LANGUAGE });
    expect(result.structuredContent.article).toMatchObject({
      content: "x".repeat(MCP_STUDENT_MAX_TEXT_LENGTH),
      contentTruncated: true,
    });
  });

  it("rejects unavailable Q&A languages rather than returning fallback content", async () => {
    const { handlers, qa } = setup();
    qa.getQA.mockResolvedValueOnce({
      id: ID,
      title: "Other",
      description: "Private language",
      availableLocales: [],
    });
    await expect(
      handlers.get("get_student_qa_entry")!({ id: ID, language: LANGUAGE }),
    ).rejects.toThrow();
    qa.getAllQA.mockResolvedValueOnce([{ id: ID, title: "Unavailable", availableLocales: [] }]);
    expect(
      (await handlers.get("list_student_qa_entries")!({ language: LANGUAGE })).structuredContent,
    ).toMatchObject({ data: [], pagination: { totalItems: 0 } });
  });
});
