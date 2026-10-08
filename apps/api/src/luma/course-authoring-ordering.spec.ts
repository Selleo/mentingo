import { buildAuthoringPlacements } from "./course-authoring-ordering";

import type { AuthoringOperation } from "./schema/course-authoring-operations.schema";

const create = (targetId: string, displayOrder: number): AuthoringOperation => ({
  type: "chapter.create",
  operationId: targetId,
  targetId,
  baselineHash: null,
  language: "en",
  dependencies: [],
  payload: { title: targetId, displayOrder },
});
const reorder: AuthoringOperation = {
  type: "chapter.reorder",
  operationId: "reorder",
  targetId: "course",
  baselineHash: "baseline",
  language: "en",
  dependencies: [],
  payload: { orderedIds: ["B", "A"] },
};

describe("authoring curriculum placement", () => {
  it("places new siblings in approved order instead of provider completion order", () => {
    expect(buildAuthoringPlacements([create("C", 2), create("B", 1), create("A", 0)])).toEqual([
      { kind: "chapter", targetId: "A", displayOrder: 1 },
      { kind: "chapter", targetId: "B", displayOrder: 2 },
      { kind: "chapter", targetId: "C", displayOrder: 3 },
    ]);
  });
  it("preserves an explicit reorder after earlier scalar placements", () => {
    const placements = buildAuthoringPlacements([create("A", 0), create("B", 1), reorder]);
    expect(placements.slice(-2)).toEqual([
      { kind: "chapter", targetId: "B", displayOrder: 1 },
      { kind: "chapter", targetId: "A", displayOrder: 2 },
    ]);
  });
  it("allows later placement instructions to override an earlier explicit reorder", () => {
    expect(buildAuthoringPlacements([reorder, create("C", 0)]).at(-1)).toEqual({
      kind: "chapter",
      targetId: "C",
      displayOrder: 1,
    });
  });
  it("omits deleted targets and compacts surviving explicit reorder positions", () => {
    const deletion: AuthoringOperation = {
      type: "chapter.delete",
      operationId: "delete-B",
      targetId: "B",
      baselineHash: "baseline",
      language: "en",
      dependencies: [],
    };
    expect(buildAuthoringPlacements([create("B", 1), reorder, deletion])).toEqual([
      { kind: "chapter", targetId: "A", displayOrder: 1 },
    ]);
  });
});

it("keeps chapter-local lesson placements independent across parallel chapter results", () => {
  const lesson = (id: string, chapterId: string, displayOrder: number): AuthoringOperation => ({
    type: "lesson.create",
    operationId: id,
    targetId: id,
    chapterId,
    displayOrder,
    baselineHash: null,
    language: "en",
    dependencies: [],
    payload: { lessonType: "content", title: id, description: "<p>Lesson</p>" },
  });
  const result = buildAuthoringPlacements([
    lesson("X-C", "X", 2),
    lesson("Y-C", "Y", 2),
    lesson("X-A", "X", 0),
    lesson("Y-A", "Y", 0),
  ]);
  expect(result).toEqual([
    { kind: "lesson", chapterId: "X", targetId: "X-A", displayOrder: 1 },
    { kind: "lesson", chapterId: "X", targetId: "X-C", displayOrder: 3 },
    { kind: "lesson", chapterId: "Y", targetId: "Y-A", displayOrder: 1 },
    { kind: "lesson", chapterId: "Y", targetId: "Y-C", displayOrder: 3 },
  ]);
});
