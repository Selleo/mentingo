import { describe, expect, it } from "vitest";

import { buildCurriculumReview, movedIds } from "./buildCurriculumReview";

import type { ReviewProposal } from "./curriculumReview.types";
import type { AuthoringOperation, CurriculumPreview } from "../courseAuthoring.types";
import type { Chapter, Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

const lesson = (id: string, title: string, displayOrder: number, chapterId: string): Lesson => ({
  id,
  title,
  displayOrder,
  chapterId,
  type: "content" as Lesson["type"],
  description: "<p>Body</p>",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const chapter = (id: string, title: string, displayOrder: number, lessons: Lesson[]): Chapter =>
  ({
    id,
    title,
    displayOrder,
    lessons,
    lessonCount: lessons.length,
    updatedAt: "2026-01-01T00:00:00.000Z",
    isFree: false,
  }) as Chapter;

const operation = (overrides: Partial<AuthoringOperation>): AuthoringOperation => ({
  operationId: crypto.randomUUID(),
  targetId: "target",
  type: "lesson.update",
  dependencies: [],
  payload: {},
  ...overrides,
});

const course = () => [
  chapter("c1", "Basics", 0, [lesson("l1", "Intro", 0, "c1"), lesson("l2", "Setup", 1, "c1")]),
  chapter("c2", "Advanced", 1, [lesson("l3", "Deep dive", 0, "c2")]),
];

const preview = (operations: AuthoringOperation[], outline: CurriculumPreview["outline"] = []) =>
  ({ proposalId: "p", status: "pending", operations, outline }) satisfies CurriculumPreview;

describe("movedIds", () => {
  it("flags only the item that moved when two neighbours swap", () => {
    expect([...movedIds(["a", "b", "c"], ["b", "a", "c"])]).toHaveLength(1);
  });

  it("does not flag items shifted by inserts or removals", () => {
    expect(movedIds(["a", "b", "c"], ["a", "x", "c"]).size).toBe(0);
  });
});

describe("buildCurriculumReview", () => {
  it("keeps removed lessons visible at their original position", () => {
    const model = buildCurriculumReview({
      chapters: course(),
      preview: preview([operation({ type: "lesson.delete", targetId: "l1" })]),
    });

    expect(model.chapters[0].lessons.map((item) => [item.id, item.kind])).toEqual([
      ["l1", "removed"],
      ["l2", "unchanged"],
    ]);
    expect(model.counts.removed).toBe(1);
    expect(model.changes.map((change) => change.key)).toEqual(["lesson:l1"]);
  });

  it("marks new, edited and renamed nodes and attributes them to proposals", () => {
    const create = operation({
      type: "lesson.create",
      targetId: "l9",
      chapterId: "c2",
      displayOrder: 1,
      payload: { title: "Wrap-up", lessonType: "content", description: "<p>New</p>" },
    });
    const edit = operation({
      type: "lesson.block.replace",
      targetId: "l2",
      payload: { blockId: "b1", html: "<p>Changed</p>" },
    });
    const proposals: ReviewProposal[] = [
      {
        id: "proposal-a",
        summary: "Add wrap-up",
        rationale: "",
        warnings: [],
        blockedQuality: false,
        decision: "pending",
        operationIds: [create.operationId, edit.operationId],
        dependsOnProposalIds: [],
        courseLevel: false,
      },
    ];

    const model = buildCurriculumReview({
      chapters: course(),
      preview: preview(
        [
          create,
          edit,
          operation({
            type: "chapter.update",
            targetId: "c2",
            payload: { title: "Advanced topics", displayOrder: 1 },
          }),
        ],
        [
          {
            id: "c2",
            title: "Advanced topics",
            lessons: [{ id: "l9", title: "Wrap-up", lessonType: "content", displayOrder: 1 }],
          },
        ],
      ),
      proposals,
    });

    const advanced = model.chapters.find((item) => item.id === "c2");
    expect(advanced?.kind).toBe("edited");
    expect(advanced?.previousTitle).toBe("Advanced");
    expect(advanced?.lessons.map((item) => [item.id, item.kind])).toEqual([
      ["l3", "unchanged"],
      ["l9", "added"],
    ]);
    expect(advanced?.changeCounts.added).toBe(1);
    const setup = model.chapters[0].lessons.find((item) => item.id === "l2");
    expect(setup?.kind).toBe("edited");
    expect(setup?.proposalIds).toEqual(["proposal-a"]);
    expect(model.counts).toEqual({ added: 1, edited: 2, removed: 0, moved: 0 });
  });

  it("shows a reorder as a move with its origin, not as delete plus add", () => {
    const model = buildCurriculumReview({
      chapters: course(),
      preview: preview([
        operation({
          type: "lesson.reorder",
          targetId: "c1",
          chapterId: "c1",
          payload: { orderedIds: ["l2", "l1"] },
        }),
      ]),
    });

    const lessons = model.chapters[0].lessons;
    expect(lessons.map((item) => item.id)).toEqual(["l2", "l1"]);
    const moved = lessons.filter((item) => item.kind === "moved");
    expect(moved).toHaveLength(1);
    expect(moved[0].movedFrom?.chapterId).toBe("c1");
    expect(model.counts.moved).toBe(1);
    expect(model.counts.removed + model.counts.added).toBe(0);
  });

  it("keeps a removed chapter with all of its lessons as one change stop", () => {
    const model = buildCurriculumReview({
      chapters: course(),
      preview: preview([operation({ type: "chapter.delete", targetId: "c2" })]),
    });

    expect(model.chapters.map((item) => [item.id, item.kind])).toEqual([
      ["c1", "unchanged"],
      ["c2", "removed"],
    ]);
    expect(model.chapters[1].lessons.every((item) => item.kind === "removed")).toBe(true);
    expect(model.changes.map((change) => change.key)).toEqual(["chapter:c2"]);
  });

  it("lists course-level changes first", () => {
    const model = buildCurriculumReview({
      chapters: course(),
      courseId: "course-1",
      courseTitle: "Course",
      preview: preview([
        operation({
          type: "course.metadata.update",
          targetId: "course-1",
          payload: { title: "New" },
        }),
      ]),
    });

    expect(model.course?.operations).toHaveLength(1);
    expect(model.changes[0].key).toBe("course:course-1");
  });
});
