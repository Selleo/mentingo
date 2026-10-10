import type {
  CourseAuthoringOrderErrorCode,
  CourseAuthoringOrderGroup,
  CourseAuthoringOrderOperation,
} from "./courseAuthoringOrder.types";

export class CourseAuthoringOrderError extends Error {
  constructor(public readonly code: CourseAuthoringOrderErrorCode) {
    super(`courseAuthoring.errors.${code}`);
    this.name = "CourseAuthoringOrderError";
  }
}

export const orderCourseAuthoringOperations = <
  T extends { operationId: string; dependencies: readonly string[] },
>(
  operations: readonly T[],
): T[] => {
  const ids = new Set(operations.map((operation) => operation.operationId));
  if (ids.size !== operations.length) throw new CourseAuthoringOrderError("duplicateOperation");
  if (operations.some((operation) => operation.dependencies.some((id) => !ids.has(id))))
    throw new CourseAuthoringOrderError("missingDependency");
  const pending = [...operations];
  const completed = new Set<string>();
  const ordered: T[] = [];
  while (pending.length) {
    const index = pending.findIndex((operation) =>
      operation.dependencies.every((id) => completed.has(id)),
    );
    if (index < 0) throw new CourseAuthoringOrderError("dependencyCycle");
    const [operation] = pending.splice(index, 1);
    completed.add(operation.operationId);
    ordered.push(operation);
  }
  return ordered;
};

const groupKey = (group: CourseAuthoringOrderGroup) =>
  group.kind === "chapter" ? "chapters" : `lessons:${group.chapterId}`;

const payloadFields = (payload: unknown): Record<string, unknown> =>
  payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};

/** Scalar positions are simultaneous absolute slots; untouched siblings retain their order. */
const placeBatch = (ids: readonly string[], positions: Map<string, number>): string[] => {
  const requested = [...positions.entries()].sort(([, left], [, right]) => left - right);
  if (!requested.length) return [...ids];
  const slots: number[] = [];
  let ceiling = ids.length;
  for (let index = requested.length - 1; index >= 0; index--) {
    slots[index] = Math.min(requested[index][1], ceiling - 1);
    ceiling = slots[index];
  }
  const result: Array<string | undefined> = Array.from({ length: ids.length });
  let previous = -1;
  requested.forEach(([id], index) => {
    const slot = Math.max(slots[index], previous + 1);
    result[slot] = id;
    previous = slot;
  });
  const untouched = ids.filter((id) => !positions.has(id));
  let next = 0;
  return result.map((id) => id ?? untouched[next++]);
};

/** Plans final ranks against siblings that exist after the frozen mutations have executed. */
export const planCourseAuthoringOrder = (
  currentGroups: readonly CourseAuthoringOrderGroup[],
  operations: readonly CourseAuthoringOrderOperation[],
): CourseAuthoringOrderGroup[] => {
  const groups = new Map<string, CourseAuthoringOrderGroup>();
  const original = new Map<string, readonly string[]>();
  for (const group of currentGroups) {
    const key = groupKey(group);
    if (groups.has(key) || new Set(group.orderedIds).size !== group.orderedIds.length)
      throw new CourseAuthoringOrderError("invalidOperations");
    original.set(key, group.orderedIds);
    groups.set(key, { ...group, orderedIds: [...group.orderedIds] });
  }
  const pending = new Map<string, Map<string, number>>();
  const ordered = orderCourseAuthoringOperations(operations);
  const deleted = new Set(
    ordered
      .filter(
        (operation) => operation.type === "chapter.delete" || operation.type === "lesson.delete",
      )
      .map((operation) => operation.targetId),
  );
  const flush = (key: string) => {
    const group = groups.get(key);
    const positions = pending.get(key);
    if (group && positions) group.orderedIds = placeBatch(group.orderedIds, positions);
    pending.delete(key);
  };
  for (const operation of ordered) {
    if (deleted.has(operation.targetId)) continue;
    let key: string;
    let position: unknown;
    switch (operation.type) {
      case "chapter.create":
      case "chapter.update":
        key = "chapters";
        position = payloadFields(operation.payload).displayOrder;
        break;
      case "lesson.create":
      case "lesson.update":
        if (operation.displayOrder === undefined || deleted.has(operation.chapterId ?? ""))
          continue;
        key = `lessons:${operation.chapterId}`;
        position = operation.displayOrder;
        break;
      case "chapter.reorder":
      case "lesson.reorder": {
        key = operation.type === "chapter.reorder" ? "chapters" : `lessons:${operation.targetId}`;
        flush(key);
        const group = groups.get(key);
        const ids = payloadFields(operation.payload).orderedIds;
        if (
          !group ||
          !Array.isArray(ids) ||
          ids.some((id) => typeof id !== "string") ||
          new Set(ids).size !== ids.length
        )
          throw new CourseAuthoringOrderError("invalidReorder");
        const surviving = (ids as string[]).filter((id) => !deleted.has(id));
        if (surviving.some((id) => !group.orderedIds.includes(id)))
          throw new CourseAuthoringOrderError("targetOutsideCourse");
        group.orderedIds = [
          ...surviving,
          ...group.orderedIds.filter((id) => !surviving.includes(id)),
        ];
        continue;
      }
      default:
        continue;
    }
    if (typeof position !== "number" || !Number.isSafeInteger(position) || position < 0)
      throw new CourseAuthoringOrderError("invalidOperations");
    const group = groups.get(key);
    if (!group || !group.orderedIds.includes(operation.targetId))
      throw new CourseAuthoringOrderError("targetOutsideCourse");
    const positions = pending.get(key) ?? new Map<string, number>();
    positions.delete(operation.targetId);
    positions.set(operation.targetId, position);
    pending.set(key, positions);
  }
  for (const key of pending.keys()) flush(key);
  return [...groups.entries()]
    .filter(([key, group]) =>
      group.orderedIds.some((id, index) => id !== original.get(key)?.[index]),
    )
    .map(([, group]) => group);
};
