import { NotFoundException } from "@nestjs/common";
import { LESSON_TYPES, PERMISSIONS } from "@repo/shared";

import { boundedMcpStudentText } from "./mcp-student-text";
import * as Schemas from "./mcp-student-tool.schemas";
import { asMcpInputSchema } from "./mcp-tool.schema";

import type { McpStudentLessonRepository } from "./mcp-student-lesson.repository";
import type { McpStudentLessonRow } from "./mcp-student-lesson.types";
import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpServer } from "@modelcontextprotocol/server";

const courseRead = [PERMISSIONS.COURSE_READ, PERMISSIONS.COURSE_READ_ASSIGNED];
export const MCP_STUDENT_LESSON_TOOL_PERMISSIONS = {
  list_chapters: courseRead,
  get_chapter: courseRead,
  list_lessons: courseRead,
  get_lesson: courseRead,
  search_lessons: courseRead,
};

/** Register only for student:read: management tools keep their existing contracts. */
export function registerMcpStudentLessonTools(
  server: McpServer,
  run: McpToolRunner,
  repository: McpStudentLessonRepository,
  resource: string,
): void {
  const origin = new URL(resource).origin;
  const lessonMetadata = (row: McpStudentLessonRow) => ({
    id: row.id,
    title: boundedMcpStudentText(row.title, 500).text,
    type: row.type,
    displayOrder: row.displayOrder,
    chapterId: row.chapterId,
    chapterTitle: boundedMcpStudentText(row.chapterTitle, 500).text,
    courseId: row.courseId,
    courseTitle: boundedMcpStudentText(row.courseTitle, 500).text,
    url: `${origin}/course/${encodeURIComponent(row.courseId)}/lesson/${encodeURIComponent(row.id)}`,
  });

  server.registerTool(
    "list_chapters",
    {
      description:
        "List ordered chapters in a published public course or a private course you are enrolled in. Read-only; administrator privileges do not bypass enrollment.",
      inputSchema: asMcpInputSchema(Schemas.listStudentChaptersInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ courseId, language }) =>
      run(courseRead, async (user) => ({
        courseId,
        chapters: (await repository.listChapters(courseId, language, user)).map((row) => ({
          id: row.id,
          title: boundedMcpStudentText(row.title, 500).text,
          displayOrder: row.displayOrder,
        })),
      })),
  );

  server.registerTool(
    "get_chapter",
    {
      description:
        "Read a learner-visible chapter's title and order. Use list_lessons to page through its lessons. Public courses and your enrolled private courses only.",
      inputSchema: asMcpInputSchema(Schemas.getStudentChapterInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ courseId, chapterId, language }) =>
      run(courseRead, async (user) => {
        const chapter = (await repository.listChapters(courseId, language, user)).find(
          (row) => row.id === chapterId,
        );
        if (!chapter) throw new NotFoundException("Chapter not found or unavailable");
        return {
          id: chapter.id,
          courseId,
          title: boundedMcpStudentText(chapter.title, 500).text,
          displayOrder: chapter.displayOrder,
        };
      }),
  );

  server.registerTool(
    "list_lessons",
    {
      description:
        "List ordered lesson metadata in an accessible course chapter. Optional query filters lesson titles and authored text. No progress or completion changes.",
      inputSchema: asMcpInputSchema(Schemas.listStudentLessonsInputSchema),
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      run(courseRead, async (user) => {
        const result = await repository.listLessons(input, user);
        return {
          courseId: input.courseId,
          chapterId: input.chapterId,
          data: result.data.map(lessonMetadata),
          pagination: result.pagination,
        };
      }),
  );

  server.registerTool(
    "get_lesson",
    {
      description:
        "Read a lesson in a published public course or your enrolled private course. Returns bounded authored text for content lessons and metadata for other lesson types. Excludes quiz answers, AI prompts, embedded files and playback URLs. Does not start or complete the lesson.",
      inputSchema: asMcpInputSchema(Schemas.getStudentLessonInputSchema),
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      run(courseRead, async (user) => {
        const result = await repository.listLessons({ ...input, page: 1, pageSize: 1 }, user);
        const lesson = result.data[0];
        if (!lesson) throw new NotFoundException("Lesson not found or unavailable");
        const readable = lesson.type === LESSON_TYPES.CONTENT;
        const content = boundedMcpStudentText(readable ? lesson.description : null);
        return {
          lesson: {
            ...lessonMetadata(lesson),
            content: content.text,
            contentTruncated: content.truncated,
            contentReadSupported: readable,
          },
        };
      }),
  );

  server.registerTool(
    "search_lessons",
    {
      description:
        "Find lessons by localized title or authored content text across public courses and private courses you are enrolled in. Optionally restrict to one course. Returns bounded text summaries and links; no quiz answers, files or AI configuration.",
      inputSchema: asMcpInputSchema(Schemas.searchStudentLessonsInputSchema),
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      run(courseRead, async (user) => {
        const result = await repository.listLessons(input, user);
        return {
          data: result.data.map((row) => ({
            ...lessonMetadata(row),
            summary: boundedMcpStudentText(
              row.type === LESSON_TYPES.CONTENT ? row.description : null,
              2000,
            ).text,
          })),
          pagination: result.pagination,
        };
      }),
  );
}
