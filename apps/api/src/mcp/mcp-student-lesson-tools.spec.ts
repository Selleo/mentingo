import { LESSON_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";

import {
  registerMcpStudentLessonTools,
  MCP_STUDENT_LESSON_TOOL_PERMISSIONS,
} from "./mcp-student-lesson-tools";

import type { McpStudentLessonRepository } from "./mcp-student-lesson.repository";
import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpServer } from "@modelcontextprotocol/server";

const id = "00000000-0000-4000-8000-000000000001";
const language = SUPPORTED_LANGUAGES.EN;
const actor = {
  userId: id,
  tenantId: id,
  email: "student@example.test",
  permissions: [],
  roleSlugs: [],
};
function setup() {
  const handlers = new Map<
    string,
    (input: Record<string, unknown>) => Promise<{ structuredContent: Record<string, unknown> }>
  >();
  const row = {
    id,
    courseId: id,
    chapterId: id,
    title: "<b>Read this</b>",
    courseTitle: "Course",
    chapterTitle: "Chapter",
    type: LESSON_TYPES.CONTENT,
    displayOrder: 1,
    description:
      '<p>Visible lesson text</p><script>hidden script</script><img src="https://files.example/secret"><a href="https://files.example/secret">Link label</a>',
    resources: ["secret-file"],
    quizAnswers: ["secret-answer"],
    aiPrompt: "secret-prompt",
    revision: "secret-revision",
  };
  const repository = {
    listChapters: jest.fn().mockResolvedValue([
      {
        id,
        courseId: id,
        title: "Chapter",
        displayOrder: 1,
        lessonCount: 1,
        secret: "secret-field",
      },
    ]),
    listLessons: jest
      .fn()
      .mockResolvedValue({ data: [row], pagination: { page: 1, perPage: 10, totalItems: 1 } }),
  };
  const run = jest.fn(async (_permissions, operation) => ({
    content: [],
    structuredContent: await operation(actor),
  }));
  registerMcpStudentLessonTools(
    {
      registerTool: (name: string, _config: unknown, handler: unknown) =>
        handlers.set(name, handler as never),
    } as unknown as McpServer,
    run as McpToolRunner,
    repository as unknown as McpStudentLessonRepository,
    "https://tenant.example/api/mcp",
  );
  return { handlers, repository, row, run };
}

describe("MCP learner lesson adapters", () => {
  it("registers the explicit read-only curriculum catalog", () => {
    expect([...setup().handlers.keys()].sort()).toEqual(
      Object.keys(MCP_STUDENT_LESSON_TOOL_PERMISSIONS).sort(),
    );
  });
  it("preserves bound identity, parent ids and selected language on lesson reads", async () => {
    const { handlers, repository } = setup();
    const result = await handlers.get("get_lesson")!({
      courseId: id,
      chapterId: id,
      lessonId: id,
      language,
      userId: "attacker",
    });
    expect(repository.listLessons).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: id, chapterId: id, lessonId: id, language, pageSize: 1 }),
      actor,
    );
    const lesson = result.structuredContent.lesson as Record<string, unknown>;
    expect(lesson.content).toBe("Visible lesson text Link label");
    expect(lesson.contentReadSupported).toBe(true);
    expect(lesson.url).toBe(`https://tenant.example/course/${id}/lesson/${id}`);
    for (const secret of [
      "secret",
      "hidden script",
      "resources",
      "quizAnswers",
      "aiPrompt",
      "revision",
    ])
      expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("bounds authored text and search summaries", async () => {
    const { handlers, row } = setup();
    row.description = "a".repeat(17000);
    const read = (
      await handlers.get("get_lesson")!({ courseId: id, chapterId: id, lessonId: id, language })
    ).structuredContent.lesson as Record<string, unknown>;
    expect((read.content as string).length).toBe(16000);
    expect(read.contentTruncated).toBe(true);
    const results = (await handlers.get("search_lessons")!({ query: "a", language }))
      .structuredContent.data as { summary: string }[];
    expect(results[0]!.summary.length).toBe(2000);
  });
  it.each([LESSON_TYPES.QUIZ, LESSON_TYPES.AI_MENTOR, LESSON_TYPES.EMBED])(
    "does not expose configuration for %s lessons",
    async (type) => {
      const { handlers, row } = setup();
      row.type = type as typeof row.type;
      row.description = "secret-internal-configuration";
      const result = await handlers.get("get_lesson")!({
        courseId: id,
        chapterId: id,
        lessonId: id,
        language,
      });
      expect(result.structuredContent.lesson).toEqual(
        expect.objectContaining({ content: "", contentReadSupported: false }),
      );
      expect(JSON.stringify(result)).not.toContain("secret");
    },
  );
  it("rejects inaccessible or mismatched lesson and chapter ids without revealing content", async () => {
    const { handlers, repository } = setup();
    repository.listLessons.mockResolvedValue({
      data: [],
      pagination: { page: 1, perPage: 10, totalItems: 0 },
    });
    await expect(
      handlers.get("get_lesson")!({ courseId: id, chapterId: id, lessonId: id, language }),
    ).rejects.toThrow("Lesson not found or unavailable");
    repository.listChapters.mockResolvedValue([]);
    await expect(
      handlers.get("get_chapter")!({ courseId: id, chapterId: id, language }),
    ).rejects.toThrow("Chapter not found or unavailable");
  });
  it("lists safe chapter and lesson metadata and forwards scoped content search", async () => {
    const { handlers, repository } = setup();
    const chapters = await handlers.get("list_chapters")!({ courseId: id, language });
    expect(repository.listChapters).toHaveBeenCalledWith(id, language, actor);
    expect(JSON.stringify(chapters)).not.toContain("secret");
    const listed = await handlers.get("list_lessons")!({ courseId: id, chapterId: id, language });
    expect(JSON.stringify(listed)).not.toContain("Visible lesson text");
    await handlers.get("search_lessons")!({
      courseId: id,
      query: "lesson",
      page: 2,
      pageSize: 5,
      language,
    });
    expect(repository.listLessons).toHaveBeenLastCalledWith(
      { courseId: id, query: "lesson", page: 2, pageSize: 5, language },
      actor,
    );
  });
});
