import { describe, expect, it } from "vitest";

import { mergeCurriculumPreview } from "./CourseLessons.helpers";

import type { Chapter } from "../EditCourse.types";
import type { CurriculumPreview } from "~/modules/CourseAuthoring/courseAuthoring.types";

const chapter = (id: string, title: string, lessonId: string): Chapter => ({
  id,
  title,
  updatedAt: "2026-01-01T00:00:00.000Z",
  displayOrder: 1,
  isFree: false,
  lessonCount: 1,
  lessons: [
    {
      id: lessonId,
      updatedAt: "2026-01-01T00:00:00.000Z",
      type: "content",
      displayOrder: 1,
      title: "Existing lesson",
      description: "Existing content",
      chapterId: id,
    },
  ],
});

const preview: CurriculumPreview = {
  proposalId: "proposal-1",
  status: "accepted",
  outline: [
    {
      id: "chapter-new",
      title: "Draft chapter",
      lessons: [{ id: "lesson-new", title: "Draft lesson", lessonType: "quiz" }],
    },
    {
      id: "chapter-existing",
      title: "Renamed chapter",
      lessons: [{ id: "lesson-existing", title: "Renamed lesson", lessonType: "content" }],
    },
  ],
};

describe("mergeCurriculumPreview", () => {
  it("adds draft rows, updates matching rows, and preserves unrelated canonical rows", () => {
    const unrelated = chapter("chapter-unrelated", "Unrelated chapter", "lesson-unrelated");
    const existing = {
      ...chapter("chapter-existing", "Existing chapter", "lesson-existing"),
      displayOrder: 2,
      lessonCount: 2,
      lessons: [
        ...chapter("chapter-existing", "Existing chapter", "lesson-existing").lessons,
        {
          id: "lesson-preserved",
          updatedAt: "2026-01-01T00:00:00.000Z",
          type: "content" as const,
          displayOrder: 2,
          title: "Unrelated lesson",
          description: "Keep this content",
          chapterId: "chapter-existing",
        },
      ],
    };

    const result = mergeCurriculumPreview([unrelated, existing], preview);

    expect(result.map(({ id }) => id)).toEqual([
      "chapter-new",
      "chapter-unrelated",
      "chapter-existing",
    ]);
    expect(result[0].lessons[0]).toMatchObject({
      id: "lesson-new",
      title: "Draft lesson",
      type: "quiz",
    });
    expect(result[2]).toMatchObject({
      id: "chapter-existing",
      title: "Renamed chapter",
      lessons: [
        { id: "lesson-existing", title: "Renamed lesson" },
        { id: "lesson-preserved", title: "Unrelated lesson" },
      ],
    });
    expect(result[1]).toMatchObject({
      id: unrelated.id,
      title: unrelated.title,
      lessons: unrelated.lessons,
    });
    expect(unrelated.displayOrder).toBe(1);
    expect(existing.lessons).toHaveLength(2);
  });

  it("returns canonical rows unchanged when the preview is cleared", () => {
    const canonical = [chapter("chapter-1", "Canonical", "lesson-1")];

    expect(mergeCurriculumPreview(canonical, null)).toBe(canonical);
  });

  it("keeps repeated draft callbacks idempotent for an empty course", () => {
    const first = mergeCurriculumPreview([], preview);
    const second = mergeCurriculumPreview([], preview);
    const final = mergeCurriculumPreview([], { ...preview, proposalId: "proposal-2" });

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(final).toHaveLength(2);
    expect(second.map(({ id }) => id)).toEqual(first.map(({ id }) => id));
  });

  it("inserts operation-derived rows at their requested course positions", () => {
    const canonical = [
      chapter("chapter-existing", "Existing chapter", "lesson-existing"),
      chapter("chapter-after", "Later chapter", "lesson-after"),
    ];
    const operationPreview: CurriculumPreview = {
      proposalId: "proposal-operations",
      status: "pending",
      outline: [
        {
          id: "chapter-existing",
          title: "Existing chapter",
          displayOrder: 0,
          lessons: [
            {
              id: "lesson-inserted",
              title: "Generated quiz",
              lessonType: "quiz",
              displayOrder: 1,
            },
          ],
        },
        {
          id: "chapter-generated",
          title: "Generated chapter",
          displayOrder: 1,
          lessons: [
            {
              id: "lesson-generated",
              title: "Generated lesson",
              lessonType: "content",
              displayOrder: 0,
            },
          ],
        },
      ],
    };

    const result = mergeCurriculumPreview(canonical, operationPreview);

    expect(result.map(({ id }) => id)).toEqual([
      "chapter-existing",
      "chapter-generated",
      "chapter-after",
    ]);
    expect(result[0].lessons.map(({ id }) => id)).toEqual(["lesson-existing", "lesson-inserted"]);
    expect(result[1].lessons[0]).toMatchObject({
      id: "lesson-generated",
      title: "Generated lesson",
      type: "content",
    });
  });

  it("previews chapter and lesson removals without an outline", () => {
    const first = chapter("chapter-first", "First", "lesson-first");
    const second = chapter("chapter-second", "Second", "lesson-second");
    const result = mergeCurriculumPreview([first, second], {
      proposalId: "delete-preview",
      status: "pending",
      outline: [],
      operations: [
        {
          operationId: "delete-lesson",
          type: "lesson.delete",
          targetId: "lesson-first",
          dependencies: [],
          payload: {},
        },
        {
          operationId: "delete-chapter",
          type: "chapter.delete",
          targetId: "chapter-second",
          dependencies: [],
          payload: {},
        },
      ],
    });

    expect(result.map((item) => item.id)).toEqual(["chapter-first"]);
    expect(result[0].lessons).toEqual([]);
    expect(first.lessons).toHaveLength(1);
  });
});

it("projects metadata without a chapter override or replacing lesson content", () => {
  const existing = chapter("chapter-existing", "Existing chapter", "lesson-existing");
  const result = mergeCurriculumPreview([existing], {
    proposalId: "metadata-proposal",
    status: "pending",
    outline: [],
    operations: [
      {
        operationId: "metadata-1",
        targetId: "lesson-existing",
        type: "lesson.metadata.update",
        dependencies: [],
        payload: { title: "New title" },
      },
    ],
  });
  expect(result[0].lessons[0]).toEqual({ ...existing.lessons[0], title: "New title" });
  expect(existing.lessons[0].title).toBe("Existing lesson");
});

const orderingOperation = (id: string, index: number) => ({
  operationId: `order-${id}`,
  type: "lesson.update",
  targetId: id,
  chapterId: "chapter-1",
  displayOrder: index,
  dependencies: [],
  payload: { title: id, lessonType: "content" },
});
const orderedChapter = () => ({
  ...chapter("chapter-1", "Chapter", "A"),
  lessonCount: 4,
  lessons: ["A", "B", "C", "D"].map((id, index) => ({
    ...chapter("chapter-1", "Chapter", id).lessons[0],
    id,
    title: id,
    displayOrder: index + 1,
  })),
});

it("previews simultaneous absolute moves to the end without moving one target twice", () => {
  const result = mergeCurriculumPreview([orderedChapter()], {
    proposalId: "order-preview",
    status: "pending",
    outline: [],
    operations: [orderingOperation("A", 2), orderingOperation("B", 3)],
  });
  expect(result[0].lessons.map((lesson) => lesson.id)).toEqual(["C", "D", "A", "B"]);
});

it("uses the reorder target chapter rather than an absent chapterId", () => {
  const result = mergeCurriculumPreview([orderedChapter()], {
    proposalId: "order-preview",
    status: "pending",
    outline: [],
    operations: [
      {
        operationId: "reorder-1",
        type: "lesson.reorder",
        targetId: "chapter-1",
        dependencies: [],
        payload: { orderedIds: ["D", "C", "B", "A"] },
      },
    ],
  });
  expect(result[0].lessons.map((lesson) => lesson.id)).toEqual(["D", "C", "B", "A"]);
});

it("preserves canonical content in an outline-only title preview", () => {
  const original = orderedChapter();
  const result = mergeCurriculumPreview([original], {
    proposalId: "title-preview",
    status: "pending",
    outline: [
      {
        id: original.id,
        title: original.title,
        lessons: [{ id: "A", title: "Renamed", lessonType: "content" }],
      },
    ],
  });
  expect(result[0].lessons[0]).toMatchObject({ title: "Renamed", description: "Existing content" });
  expect(original.lessons[0].title).toBe("A");
});

it("appends unpositioned creates in dependency order rather than stale outline order", () => {
  const result = mergeCurriculumPreview([], {
    proposalId: "dependency-preview",
    status: "pending",
    outline: [
      {
        id: "chapter-1",
        title: "Chapter",
        lessons: [
          { id: "B", title: "B", lessonType: "content" },
          { id: "A", title: "A", lessonType: "content" },
          { id: "not-generated", title: "Future lesson", lessonType: "content" },
        ],
      },
    ],
    operations: [
      {
        operationId: "B-op",
        type: "lesson.create",
        targetId: "B",
        chapterId: "chapter-1",
        dependencies: ["A-op"],
        payload: { title: "B", lessonType: "content" },
      },
      {
        operationId: "chapter-op",
        type: "chapter.create",
        targetId: "chapter-1",
        dependencies: [],
        payload: { title: "Chapter", displayOrder: 0 },
      },
      {
        operationId: "A-op",
        type: "lesson.create",
        targetId: "A",
        chapterId: "chapter-1",
        dependencies: ["chapter-op"],
        payload: { title: "A", lessonType: "content" },
      },
    ],
  });
  expect(result[0].lessons.map((lesson) => lesson.id)).toEqual(["A", "B"]);
});
