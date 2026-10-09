import {
  orderCourseAuthoringOperations,
  planCourseAuthoringOrder,
} from "./course-authoring-ordering";

import type { CourseAuthoringOrderOperation } from "@repo/shared";

const place = (id: string, position: number): CourseAuthoringOrderOperation => ({
  operationId: id,
  targetId: id,
  type: "chapter.update",
  dependencies: [],
  payload: { displayOrder: position },
});
const reorder = (ids: string[], dependencies: string[] = []): CourseAuthoringOrderOperation => ({
  operationId: "reorder",
  targetId: "course",
  type: "chapter.reorder",
  dependencies,
  payload: { orderedIds: ids },
});
const plan = (ids: string[], operations: CourseAuthoringOrderOperation[]) =>
  planCourseAuthoringOrder([{ kind: "chapter", orderedIds: ids }], operations)[0]?.orderedIds ??
  ids;

describe("authoring final curriculum order", () => {
  it("keeps simultaneous right-moving targets in their absolute slots", () => {
    expect(plan(["A", "B", "C", "D"], [place("A", 2), place("B", 3)])).toEqual([
      "C",
      "D",
      "A",
      "B",
    ]);
  });
  it("orders new siblings independently of provider completion", () => {
    expect(plan(["C", "B", "A"], [place("C", 2), place("B", 1), place("A", 0)])).toEqual([
      "A",
      "B",
      "C",
    ]);
  });
  it("compacts a partial accepted selection with missing absolute positions", () => {
    expect(plan(["C", "A"], [place("C", 2), place("A", 0)])).toEqual(["A", "C"]);
    expect(plan(["B", "A"], [place("A", 10), place("B", 11)])).toEqual(["A", "B"]);
  });
  it("resolves colliding slots in intent order independently of remapped native UUIDs", () => {
    const temporary = ["temp-B", "temp-A"];
    const native = ["native-A", "native-Z"];
    const preview = plan(temporary, [place("temp-A", 0), place("temp-B", 0)]);
    const applied = plan(native, [place("native-Z", 0), place("native-A", 0)]);
    expect(preview).toEqual(["temp-A", "temp-B"]);
    expect(applied).toEqual(["native-Z", "native-A"]);
  });
  it("preserves explicit reorder boundaries and later scalar overrides", () => {
    expect(
      plan(
        ["A", "B", "C"],
        [place("C", 0), reorder(["B", "A"]), { ...place("C", 0), operationId: "last-C" }],
      ),
    ).toEqual(["C", "B", "A"]);
  });
  it("orders dependency continuations before computing final ranks", () => {
    const operations = [reorder(["B", "A"], ["A"]), place("A", 0)];
    expect(orderCourseAuthoringOperations(operations).map((item) => item.operationId)).toEqual([
      "A",
      "reorder",
    ]);
    expect(plan(["A", "B"], operations)).toEqual(["B", "A"]);
  });
  it("filters deleted targets from explicit ordering without reviving them", () => {
    const deletion = {
      operationId: "delete-B",
      type: "chapter.delete",
      targetId: "B",
      dependencies: [],
    };
    expect(plan(["A", "C"], [place("B", 1), reorder(["B", "C", "A"]), deletion])).toEqual([
      "C",
      "A",
    ]);
  });
  it("leaves unrelated chapters and sibling groups untouched", () => {
    const result = planCourseAuthoringOrder(
      [
        { kind: "chapter", orderedIds: ["X", "Y"] },
        { kind: "lesson", chapterId: "X", orderedIds: ["B", "A"] },
        { kind: "lesson", chapterId: "Y", orderedIds: ["Z"] },
      ],
      [{ ...place("A", 0), type: "lesson.update", chapterId: "X", displayOrder: 0 }],
    );
    expect(result).toEqual([{ kind: "lesson", chapterId: "X", orderedIds: ["A", "B"] }]);
  });
  it.each([
    [[place("A", 0), place("A", 1)], "duplicateOperation"],
    [[{ ...place("A", 0), dependencies: ["missing"] }], "missingDependency"],
    [
      [
        { ...place("A", 0), dependencies: ["B"] },
        { ...place("B", 1), dependencies: ["A"] },
      ],
      "dependencyCycle",
    ],
  ] as const)("rejects invalid dependency plans", (operations, code) => {
    expect(() => orderCourseAuthoringOperations(operations)).toThrow(
      `courseAuthoring.errors.${code}`,
    );
  });
  it("rejects foreign targets instead of silently inventing sibling positions", () => {
    expect(() => plan(["A"], [place("foreign", 0)])).toThrow(
      "courseAuthoring.errors.targetOutsideCourse",
    );
  });
});
