import {
  buildMentorCourseContextDocument,
  mentorCourseContextKey,
} from "./course-authoring-mentor-context";

import type { AuthoringOperation } from "./schema/course-authoring-operations.schema";

describe("course authoring Mentor context", () => {
  it("combines same-export content with current course bodies and omits non-content lesson types", () => {
    const content: AuthoringOperation = {
      type: "lesson.create",
      operationId: "00000000-0000-4000-8000-000000000001",
      targetId: "00000000-0000-4000-8000-000000000002",
      chapterId: "00000000-0000-4000-8000-000000000003",
      language: "en",
      baselineHash: null,
      dependencies: [],
      displayOrder: 0,
      payload: {
        lessonType: "content",
        title: "New lesson",
        description:
          "<h2>New topic</h2><p>Visible <strong>lesson</strong>.</p><script>private note</script>",
      },
    };
    const quiz = {
      ...content,
      operationId: "00000000-0000-4000-8000-000000000004",
      payload: { lessonType: "quiz", title: "Quiz", questions: [{ answer: "secret" }] },
    } as unknown as AuthoringOperation;
    const mentor = {
      ...content,
      operationId: "00000000-0000-4000-8000-000000000005",
      payload: {
        lessonType: "ai_mentor",
        title: "Mentor",
        configuration: { additionalInstructions: "private instructions" },
      },
    } as unknown as AuthoringOperation;

    const result = buildMentorCourseContextDocument(
      "Course coach",
      [
        {
          id: "00000000-0000-4000-8000-000000000006",
          chapterId: "00000000-0000-4000-8000-000000000017",
          chapterTitle: "Existing chapter",
          title: "Existing lesson",
          description: "<p>Existing course content.</p>",
        },
      ],
      [content, quiz, mentor],
    );

    expect(result).toContain("## Existing chapter / Existing lesson");
    expect(result).toContain("Existing course content.");
    expect(result).toContain("## New lesson");
    expect(result).toContain("New topic");
    expect(result).toContain("Visible lesson.");
    expect(result).not.toContain("private note");
    expect(result).not.toContain("answer");
    expect(result).not.toContain("private instructions");
  });

  it("uses accepted update bodies in place of their previous course body", () => {
    const update: AuthoringOperation = {
      type: "lesson.update",
      operationId: "00000000-0000-4000-8000-000000000007",
      targetId: "00000000-0000-4000-8000-000000000008",
      chapterId: "00000000-0000-4000-8000-000000000003",
      language: "en",
      baselineHash: "a".repeat(64),
      dependencies: [],
      payload: {
        lessonType: "content",
        title: "Updated lesson",
        description: "<p>Revised course content.</p>",
      },
    };

    const result = buildMentorCourseContextDocument(
      "Course coach",
      [
        {
          id: "00000000-0000-4000-8000-000000000008",
          chapterId: "00000000-0000-4000-8000-000000000003",
          chapterTitle: null,
          title: "Original lesson",
          description: "<p>Outdated course content.</p>",
        },
      ],
      [update],
    );

    expect(result).toContain("Revised course content.");
    expect(result).not.toContain("Outdated course content.");
  });

  it("does not create an empty file and provides a stable per-operation key", () => {
    expect(buildMentorCourseContextDocument("Mentor", [], [])).toBeNull();
    expect(mentorCourseContextKey("operation-id")).toBe("operation-id:course-context");
  });

  it("omits deleted lessons and chapters from both stored and exported context", () => {
    const lessonToDelete: AuthoringOperation = {
      type: "lesson.delete",
      operationId: "00000000-0000-4000-8000-000000000018",
      targetId: "00000000-0000-4000-8000-000000000019",
      baselineHash: "a".repeat(64),
      language: "en",
      dependencies: [],
    };
    const chapterToDelete: AuthoringOperation = {
      type: "chapter.delete",
      operationId: "00000000-0000-4000-8000-000000000020",
      targetId: "00000000-0000-4000-8000-000000000021",
      baselineHash: "b".repeat(64),
      language: "en",
      dependencies: [],
    };
    const lessonInDeletedChapter: AuthoringOperation = {
      type: "lesson.create",
      operationId: "00000000-0000-4000-8000-000000000022",
      targetId: "00000000-0000-4000-8000-000000000023",
      chapterId: chapterToDelete.targetId,
      language: "en",
      baselineHash: null,
      dependencies: [],
      displayOrder: 0,
      payload: {
        lessonType: "content",
        title: "Must not survive its chapter",
        description: "<p>Deleted chapter content.</p>",
      },
    };
    const result = buildMentorCourseContextDocument(
      "Mentor",
      [
        {
          id: lessonToDelete.targetId,
          chapterId: "00000000-0000-4000-8000-000000000024",
          chapterTitle: null,
          title: "Deleted lesson",
          description: "<p>Removed lesson body.</p>",
        },
        {
          id: "00000000-0000-4000-8000-000000000025",
          chapterId: chapterToDelete.targetId,
          chapterTitle: "Deleted chapter",
          title: "Child lesson",
          description: "<p>Removed chapter body.</p>",
        },
      ],
      [lessonToDelete, chapterToDelete, lessonInDeletedChapter],
    );

    expect(result).toBeNull();
  });
});
