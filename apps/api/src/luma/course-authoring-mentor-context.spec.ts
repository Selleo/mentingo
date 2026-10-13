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
      targetId: "00000000-0000-4000-8000-000000000014",
      payload: { lessonType: "quiz", title: "Quiz", questions: [{ answer: "secret" }] },
    } as unknown as AuthoringOperation;
    const mentor = {
      ...content,
      operationId: "00000000-0000-4000-8000-000000000005",
      targetId: "00000000-0000-4000-8000-000000000015",
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

const lessonId = "11111111-1111-4111-8111-111111111111";
const chapterId = "22222222-2222-4222-8222-222222222222";
const blockId = "33333333-3333-4333-8333-333333333333";
const neighborId = "44444444-4444-4444-8444-444444444444";
const baseLesson = {
  id: lessonId,
  chapterId,
  chapterTitle: "Policy",
  title: "Retention",
  description: `<p data-authoring-block-id="${blockId}">Keep records for 30 days.</p><p data-authoring-block-id="${neighborId}">Keep access restricted.</p>`,
};
const metadataPatch: AuthoringOperation = {
  type: "lesson.metadata.update",
  operationId: "55555555-5555-4555-8555-555555555555",
  targetId: lessonId,
  language: "en",
  baselineHash: "a".repeat(64),
  dependencies: [],
  payload: { description: `<p data-authoring-block-id="${blockId}">Keep records for 60 days.</p>` },
};
const blockPatch: AuthoringOperation = {
  ...metadataPatch,
  type: "lesson.block.replace",
  operationId: "66666666-6666-4666-8666-666666666666",
  payload: { blockId, html: "<p>Keep records for 90 days.</p>" },
};

describe("approved Mentor reference projection", () => {
  it("replaces metadata descriptions without losing baseline titles or chapter headings", () => {
    const result = buildMentorCourseContextDocument("Mentor", [baseLesson], [metadataPatch], "en");
    expect(result).toContain("## Policy / Retention");
    expect(result).toContain("60 days");
    expect(result).not.toContain("30 days");
  });

  it("preserves the baseline body for title-only metadata edits", () => {
    const result = buildMentorCourseContextDocument(
      "Mentor",
      [baseLesson],
      [{ ...metadataPatch, payload: { title: "Updated retention" } }],
      "en",
    );
    expect(result).toContain("## Policy / Updated retention");
    expect(result).toContain("30 days");
    expect(result).toContain("Keep access restricted.");
  });

  it("uses native block replacement and preserves neighboring baseline blocks", () => {
    const result = buildMentorCourseContextDocument("Mentor", [baseLesson], [blockPatch], "en");
    expect(result).toContain("90 days");
    expect(result).not.toContain("30 days");
    expect(result).toContain("Keep access restricted.");
    expect(baseLesson.description).toContain("30 days");
  });

  it("projects dependent block replacements after description writes despite input order", () => {
    const result = buildMentorCourseContextDocument(
      "Mentor",
      [baseLesson],
      [{ ...blockPatch, dependencies: [metadataPatch.operationId] }, metadataPatch],
      "en",
    );
    expect(result).toContain("90 days");
    expect(result).not.toContain("60 days");
    expect(result).not.toContain("30 days");
  });

  it("does not silently retain stale references for invalid block targets", () => {
    expect(() =>
      buildMentorCourseContextDocument(
        "Mentor",
        [baseLesson],
        [
          {
            ...blockPatch,
            payload: { blockId: "77777777-7777-4777-8777-777777777777", html: "<p>New text</p>" },
          },
        ],
        "en",
      ),
    ).toThrow();
  });

  it("does not apply other languages' text patches to the localized baseline", () => {
    const result = buildMentorCourseContextDocument(
      "Mentor",
      [baseLesson],
      [{ ...metadataPatch, language: "pl" }],
      "en",
    );
    expect(result).toContain("30 days");
    expect(result).not.toContain("60 days");
  });

  it("applies structural deletions independently of the operation language", () => {
    const result = buildMentorCourseContextDocument(
      "Mentor",
      [baseLesson],
      [{ ...metadataPatch, type: "lesson.delete", language: "pl" }],
      "en",
    );
    expect(result).toBeNull();
  });

  it("does not retain content created and then deleted in the same batch", () => {
    const create: AuthoringOperation = {
      ...metadataPatch,
      type: "lesson.create",
      chapterId,
      baselineHash: null,
      displayOrder: 0,
      payload: {
        lessonType: "content",
        title: "Retention",
        description: "<p>New records policy.</p>",
      },
    };
    const remove: AuthoringOperation = {
      ...metadataPatch,
      type: "lesson.delete",
      operationId: blockPatch.operationId,
      dependencies: [create.operationId],
    };
    expect(buildMentorCourseContextDocument("Mentor", [], [remove, create], "en")).toBeNull();
  });
});
